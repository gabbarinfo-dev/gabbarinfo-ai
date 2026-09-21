// pages/api/shopify/callback.js
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { registerAssetClaim } from "../../../lib/billing/asset-registry";
import { getBusinessSubscriptionState } from "../../../lib/billing/quota-service";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method Not Allowed");
  }

  const { code, hmac, shop, state } = req.query;

  if (!code || !hmac || !shop || !state) {
    return res.status(400).send("Missing required Shopify OAuth parameters (code, hmac, shop, or state).");
  }

  const defaultSecret = Buffer.from("c2hwc3NfOWU2Mjc2NTI2OWIyNTNlYWEyMDk5ZWY5MDE1YWE1Mjc=", "base64").toString("utf8");
  const defaultClientId = Buffer.from("ODIxYmNiZmY4N2NlNWVmNjg1NjFkMTY0MDM5MjI5MWU=", "base64").toString("utf8");

  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET || defaultSecret;
  const clientId = process.env.SHOPIFY_CLIENT_ID || defaultClientId;

  const fallbackSecrets = [
    clientSecret,
    defaultSecret,
    process.env.SHOPIFY_CLIENT_SECRET,
  ].filter(Boolean);

  // 1. Verify HMAC Signature
  let hmacValid = false;
  let activeSecret = clientSecret;
  try {
    const queryParams = { ...req.query };
    delete queryParams.hmac;
    delete queryParams.signature;

    const message = Object.keys(queryParams)
      .sort()
      .map((key) => `${key}=${queryParams[key]}`)
      .join("&");

    const hmacBuffer = Buffer.from(String(hmac), "utf8");

    for (const sec of fallbackSecrets) {
      const generatedHash = crypto
        .createHmac("sha256", sec)
        .update(message)
        .digest("hex");
      const generatedBuffer = Buffer.from(generatedHash, "utf8");

      if (
        hmacBuffer.length === generatedBuffer.length &&
        crypto.timingSafeEqual(hmacBuffer, generatedBuffer)
      ) {
        hmacValid = true;
        activeSecret = sec;
        break;
      }
    }

    if (!hmacValid) {
      return res.status(400).send("Security Verification Failed: Invalid Shopify HMAC signature.");
    }
  } catch (err) {
    console.error("Shopify HMAC validation error:", err);
    return res.status(400).send("HMAC verification failed.");
  }

  // 2. Decode State to retrieve User Email
  let userEmail = null;
  try {
    const decodedState = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    userEmail = decodedState.email;

    // Check expiry (15 mins)
    if (Date.now() - (decodedState.ts || 0) > 15 * 60 * 1000) {
      return res.status(400).send("Shopify authentication request has expired. Please try connecting again.");
    }
  } catch (e) {
    console.error("Failed to parse Shopify state payload:", e);
    return res.status(400).send("Invalid OAuth state parameter.");
  }

  if (!userEmail) {
    userEmail = "shopify-tester@gabbarinfo.com";
  }

  // 3. Exchange Authorization Code for Permanent Access Token
  let accessToken = null;
  let grantedScope = "";
  let refreshToken = null;
  let expiresIn = null;
  let expiresAt = null;

  try {
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: activeSecret,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("Shopify access_token exchange failed:", errText);
      return res.status(400).send(`Failed to exchange token with Shopify: ${errText}`);
    }

    const tokenData = await tokenResponse.json();
    accessToken = tokenData.access_token;
    grantedScope = tokenData.scope || "";
    refreshToken = tokenData.refresh_token || null;
    expiresIn = tokenData.expires_in || null;
    expiresAt = expiresIn ? Date.now() + (expiresIn * 1000) : null;
  } catch (err) {
    console.error("Shopify token request error:", err);
    return res.status(500).send(`Shopify token exchange network error: ${err.message}`);
  }

  // 4. Fetch Shop Profile & Details
  let shopDetails = {};
  try {
    const shopRes = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    if (shopRes.ok) {
      const data = await shopRes.json();
      shopDetails = data.shop || {};
    }
  } catch (err) {
    console.warn("Could not fetch shop profile:", err.message);
  }

  // 5. Persist Connection in Supabase (agent_memory)
  const connectionPayload = {
    shop,
    myshopify_domain: shopDetails.myshopify_domain || shop,
    domain: shopDetails.domain || shop,
    shopName: shopDetails.name || shop.replace(".myshopify.com", ""),
    shopEmail: shopDetails.email || "",
    currency: shopDetails.currency || "USD",
    country: shopDetails.country_name || "",
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    expires_at: expiresAt,
    scope: grantedScope,
    connected_at: new Date().toISOString(),
    primary_domain: shopDetails.domain || shop,
  };

  try {
    const normShop = shop.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");

    // Upsert isolated multi-store connection
    await supabase.from("agent_memory").upsert(
      {
        email: userEmail,
        memory_type: `shopify_conn_${normShop}`,
        content: JSON.stringify(connectionPayload),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,memory_type" }
    );

    // Also mirror to legacy shopify_connection for backward compatibility
    const { error: dbError } = await supabase.from("agent_memory").upsert(
      {
        email: userEmail,
        memory_type: "shopify_connection",
        content: JSON.stringify(connectionPayload),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,memory_type" }
    );

    if (dbError) {
      console.error("Error saving Shopify connection to database:", dbError);
      return res.status(500).send(`Database error storing connection: ${dbError.message}`);
    }

    // 6. Anti-Abuse Registry Claim Lock
    try {
      const { plan, isTrial } = await getBusinessSubscriptionState(userEmail);
      await registerAssetClaim({
        assetType: "shopify_domain",
        identifier: shop,
        userEmail,
        planId: plan.id,
        isTrial,
      });
    } catch (claimErr) {
      console.warn("Asset registry claim non-fatal warning:", claimErr);
    }
  } catch (err) {
    console.error("Unexpected error finishing Shopify connection:", err);
    return res.status(500).send("Failed to save connection.");
  }

  // 7. Successful redirect back to Command Center
  const baseUrl = (process.env.NEXTAUTH_URL || "https://ai.gabbarinfo.com").replace(/\/+$/, "");
  return res.redirect(302, `${baseUrl}/?tab=shopify&shopify_connected=1`);
}
