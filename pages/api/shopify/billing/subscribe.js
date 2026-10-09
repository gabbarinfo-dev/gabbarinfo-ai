// pages/api/shopify/billing/subscribe.js
import { createClient } from "@supabase/supabase-js";
import { SHOPIFY_PLANS, normalizeShop } from "../../../../lib/shopify/trial-guard.js";
import { getValidShopifyAccessToken } from "../../../../lib/shopify/token-service.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const { shop, planId } = req.body || {};

  if (!shop) {
    return res.status(400).json({ ok: false, error: "Shop domain is required." });
  }

  const targetPlan = SHOPIFY_PLANS[planId];
  if (!targetPlan || targetPlan.isTrial) {
    return res.status(400).json({ ok: false, error: "Invalid paid Shopify plan selected." });
  }

  const normShop = normalizeShop(shop);

  // 1. Fetch valid Shopify Access Token
  let accessToken = null;
  try {
    accessToken = await getValidShopifyAccessToken(shop);
  } catch (err) {
    console.error("[shopify-billing-subscribe] Failed to get valid access token:", err);
  }

  if (!accessToken) {
    // Fallback: search connection memory
    const { data: connRow } = await supabase
      .from("agent_memory")
      .select("content")
      .eq("memory_type", `shopify_conn_${normShop}`)
      .maybeSingle();

    if (connRow?.content) {
      try {
        const parsed = JSON.parse(connRow.content);
        accessToken = parsed.access_token;
      } catch (e) {}
    }
  }

  if (!accessToken) {
    return res.status(401).json({
      ok: false,
      error: "No active Shopify connection found for this store. Please reconnect your store.",
    });
  }

  // 2. Prepare return URL for post-confirmation callback
  const baseUrl = (process.env.NEXTAUTH_URL || "https://ai.gabbarinfo.com").replace(/\/+$/, "");
  const returnUrl = `${baseUrl}/api/shopify/billing/callback?shop=${encodeURIComponent(shop)}&planId=${encodeURIComponent(planId)}`;

  // Determine whether to use test mode (non-production test charge or real charge)
  // If SHOPIFY_BILLING_TEST=false or not set, test mode defaults to false for production review
  const isTestCharge = process.env.SHOPIFY_BILLING_TEST === "true";

  // 3. Construct GraphQL Mutation for Shopify Billing API
  const mutation = `
    mutation AppSubscriptionCreate(
      $name: String!
      $returnUrl: URL!
      $lineItems: [AppSubscriptionLineItemInput!]!
      $test: Boolean
    ) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        lineItems: $lineItems
        test: $test
      ) {
        userErrors {
          field
          message
        }
        confirmationUrl
        appSubscription {
          id
          status
        }
      }
    }
  `;

  const variables = {
    name: `GabbarInfo AI - ${targetPlan.name}`,
    returnUrl,
    test: isTestCharge,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: {
              amount: targetPlan.priceUSD,
              currencyCode: "USD",
            },
            interval: "EVERY_30_DAYS",
          },
        },
      },
    ],
  };

  try {
    const shopifyGqlRes = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });

    if (!shopifyGqlRes.ok) {
      const errText = await shopifyGqlRes.text();
      console.error("[shopify-billing-subscribe] GraphQL HTTP error:", errText);
      return res.status(500).json({ ok: false, error: "Failed to communicate with Shopify Billing API." });
    }

    const gqlData = await shopifyGqlRes.json();
    const result = gqlData?.data?.appSubscriptionCreate;

    if (result?.userErrors && result.userErrors.length > 0) {
      console.error("[shopify-billing-subscribe] GraphQL userErrors:", result.userErrors);
      return res.status(400).json({
        ok: false,
        error: result.userErrors.map((e) => e.message).join(", "),
      });
    }

    const confirmationUrl = result?.confirmationUrl;
    if (!confirmationUrl) {
      return res.status(500).json({
        ok: false,
        error: "Shopify did not return an approval confirmation URL.",
      });
    }

    // Return the native confirmation URL so the merchant can approve with 1 click
    return res.status(200).json({
      ok: true,
      confirmationUrl,
      subscriptionId: result?.appSubscription?.id,
    });
  } catch (err) {
    console.error("[shopify-billing-subscribe] Unexpected error creating charge:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
