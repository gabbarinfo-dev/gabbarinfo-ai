// pages/api/shopify/billing/callback.js
import { createClient } from "@supabase/supabase-js";
import { SHOPIFY_PLANS, normalizeShop } from "../../../../lib/shopify/trial-guard.js";
import { getValidShopifyAccessToken } from "../../../../lib/shopify/token-service.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method Not Allowed");
  }

  const { shop, planId, charge_id } = req.query;

  if (!shop || !planId) {
    return res.status(400).send("Missing required parameters: shop or planId.");
  }

  const targetPlan = SHOPIFY_PLANS[planId];
  if (!targetPlan) {
    return res.status(400).send("Invalid plan identifier.");
  }

  const normShop = normalizeShop(shop);
  const baseUrl = (process.env.NEXTAUTH_URL || "https://ai.gabbarinfo.com").replace(/\/+$/, "");

  // 1. Fetch valid Shopify Access Token
  let accessToken = null;
  try {
    accessToken = await getValidShopifyAccessToken(shop);
  } catch (e) {
    console.error("[shopify-billing-callback] Access token lookup error:", e);
  }

  if (!accessToken) {
    const { data: connRow } = await supabase
      .from("agent_memory")
      .select("content")
      .eq("memory_type", `shopify_conn_${normShop}`)
      .maybeSingle();

    if (connRow?.content) {
      try {
        accessToken = JSON.parse(connRow.content).access_token;
      } catch (e) {}
    }
  }

  // 2. Format Subscription GID
  let subGid = charge_id ? String(charge_id) : "";
  if (subGid && !subGid.startsWith("gid://shopify/AppSubscription/")) {
    subGid = `gid://shopify/AppSubscription/${subGid}`;
  }

  let isVerifiedActive = true; // Default to true upon merchant redirect

  if (accessToken && subGid) {
    try {
      const query = `
        query GetAppSubscription($id: ID!) {
          node(id: $id) {
            ... on AppSubscription {
              id
              status
              name
              currentPeriodEnd
            }
          }
        }
      `;

      const checkRes = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query, variables: { id: subGid } }),
      });

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        const subNode = checkData?.data?.node;
        if (subNode && subNode.status !== "ACTIVE" && subNode.status !== "PENDING") {
          console.warn("[shopify-billing-callback] Subscription not active:", subNode.status);
          isVerifiedActive = false;
        }
      }
    } catch (checkErr) {
      console.warn("[shopify-billing-callback] Non-fatal subscription verification error:", checkErr.message);
    }
  }

  if (!isVerifiedActive) {
    return res.redirect(302, `${baseUrl}/?tab=shopify&billing_error=charge_not_active`);
  }

  // 3. Current Billing Cycle Identifier (e.g. 2026-10)
  const billingCycleId = new Date().toISOString().substring(0, 7);

  // 4. Activate Paid Subscription in Supabase
  const subPayload = {
    planId,
    planName: targetPlan.name,
    priceUSD: targetPlan.priceUSD,
    status: "ACTIVE",
    subscriptionId: subGid || `sub_${Date.now()}`,
    billingCycleId,
    activatedAt: new Date().toISOString(),
    shop,
  };

  try {
    await supabase.from("agent_memory").upsert(
      {
        email: `shop_${normShop}@gabbarinfo.internal`,
        memory_type: `shopify_sub_${normShop}`,
        content: JSON.stringify(subPayload),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,memory_type" }
    );

    // Initialize/reset billing cycle usage
    await supabase.from("agent_memory").upsert(
      {
        email: `shop_${normShop}@gabbarinfo.internal`,
        memory_type: `shopify_usage_${normShop}_${billingCycleId}`,
        content: JSON.stringify({
          blogsUsed: 0,
          productOptsUsed: 0,
          cycleStartedAt: new Date().toISOString(),
        }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,memory_type" }
    );
  } catch (dbErr) {
    console.error("[shopify-billing-callback] Database error storing subscription:", dbErr);
  }

  // 5. Clean redirect back to the user's command center with confirmation banner
  return res.redirect(302, `${baseUrl}/?tab=shopify&billing_success=1&plan=${encodeURIComponent(planId)}`);
}
