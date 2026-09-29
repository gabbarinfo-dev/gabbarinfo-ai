// pages/api/shopify/webhooks/index.js
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
      console.warn("[Shopify Webhook] HMAC verification failed");
      return res.status(401).send("Unauthorized");
    }

    const topic = req.headers["x-shopify-topic"] || "unknown";
    console.log(`[Shopify Webhook] Successfully verified and handled topic: ${topic}`);

    return res.status(200).json({ ok: true, topic });
  } catch (err) {
    console.error("[Shopify Webhook] Error:", err);
    return res.status(200).json({ ok: true });
  }
}
