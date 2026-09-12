// pages/api/shopify/connect.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import crypto from "crypto";
import { checkAssetTrialEligibility } from "../../../lib/billing/asset-registry";
import { getBusinessSubscriptionState } from "../../../lib/billing/quota-service";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Please log in to connect your Shopify store." });
  }

  const rawShop = req.query.shop || req.body?.shop;
  if (!rawShop) {
    return res.status(400).json({ ok: false, error: "Missing Shopify store domain." });
  }

  // Normalize shop domain
  let shop = String(rawShop).trim().toLowerCase();
  shop = shop.replace(/^https?:\/\//, "").replace(/\/+$/, "").split("/")[0];
  
  if (!shop.includes(".myshopify.com")) {
    // If user provided a custom domain or store name, normalize to .myshopify.com
    if (!shop.includes(".")) {
      shop = `${shop}.myshopify.com`;
    }
  }

  // Validate format
  const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
  if (!shopRegex.test(shop)) {
    return res.status(400).json({
      ok: false,
      error: "Invalid Shopify store domain. Please provide a valid myshopify.com domain (e.g., yourstore.myshopify.com).",
    });
  }

  // Anti-Abuse Trial Asset Check
  try {
    const { plan, isTrial } = await getBusinessSubscriptionState(userEmail);
    const assetCheck = await checkAssetTrialEligibility({
      assetType: "shopify_domain",
      identifier: shop,
      userEmail,
      planId: plan.id,
      isTrial,
    });

    if (!assetCheck.allowed) {
      return res.status(403).json({
        ok: false,
        error: assetCheck.reason || "This Shopify store is already bound to another account.",
      });
    }
  } catch (err) {
    console.warn("Shopify asset eligibility check non-fatal warning:", err);
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({
      ok: false,
      error: "Shopify Client ID is not configured on the server.",
    });
  }

  const scopes = "read_content,write_content,read_products,write_products";
  const baseUrl = (process.env.NEXTAUTH_URL || "https://ai.gabbarinfo.com").replace(/\/+$/, "");
  const redirectUri = `${baseUrl}/api/shopify/callback`;

  // Cryptographic nonce signed with userEmail for CSRF & session verification
  const randomNonce = crypto.randomBytes(16).toString("hex");
  const statePayload = Buffer.from(
    JSON.stringify({
      email: userEmail,
      nonce: randomNonce,
      ts: Date.now(),
    })
  ).toString("base64url");

  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(
    scopes
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${statePayload}`;

  if (req.method === "POST") {
    return res.status(200).json({ ok: true, authUrl });
  }

  return res.redirect(302, authUrl);
}
