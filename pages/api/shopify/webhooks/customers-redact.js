// pages/api/shopify/webhooks/customers-redact.js
/**
 * Mandatory Shopify GDPR Compliance Webhook: Customers Redact
 * 
 * Triggered when a merchant receives a customer data deletion request under GDPR/CCPA.
 * Must verify HMAC and delete any stored customer data.
 */
import { getRawBody, verifyShopifyWebhook } from "../../../../lib/shopify/verify-webhook.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const rawBodyBuffer = await getRawBody(req);
    const hmac = req.headers["x-shopify-hmac-sha256"];

    if (!verifyShopifyWebhook(rawBodyBuffer, hmac)) {
      console.warn("[Shopify GDPR] customers/redact HMAC verification failed");
      return res.status(401).send("Unauthorized");
    }

    const payload = JSON.parse(rawBodyBuffer.toString("utf8") || "{}");
    console.log(`[Shopify GDPR] Handled customers/redact for shop: ${payload.shop_domain}, customer: ${payload.customer?.email || payload.customer?.id}`);

    // GabbarInfo AI only accesses products and catalog data and stores zero customer PII.
    return res.status(200).json({
      ok: true,
      message: "Customer redaction processed successfully.",
    });
  } catch (err) {
    console.error("[Shopify GDPR] customers/redact error:", err);
    return res.status(200).json({ ok: true });
  }
}
