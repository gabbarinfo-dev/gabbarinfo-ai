// pages/api/shopify/webhooks/customers-data-request.js
/**
 * Mandatory Shopify GDPR Compliance Webhook: Customers Data Request
 * 
 * Triggered when a merchant receives a customer data request under GDPR/CCPA.
 * Must verify HMAC and respond with 200 OK.
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
      console.warn("[Shopify GDPR] customers/data_request HMAC verification failed");
      return res.status(401).send("Unauthorized");
    }

    const payload = JSON.parse(rawBodyBuffer.toString("utf8") || "{}");
    console.log(`[Shopify GDPR] Handled customers/data_request for shop: ${payload.shop_domain}, customer: ${payload.customer?.email || payload.customer?.id}`);

    // GabbarInfo AI only accesses catalog/products and does not store private customer personal data.
    // Return 200 OK as required by Shopify review standards.
    return res.status(200).json({
      ok: true,
      message: "Customer data request received and processed.",
    });
  } catch (err) {
    console.error("[Shopify GDPR] customers/data_request error:", err);
    return res.status(200).json({ ok: true }); // Always respond 200 to acknowledge webhook receipt
  }
}
