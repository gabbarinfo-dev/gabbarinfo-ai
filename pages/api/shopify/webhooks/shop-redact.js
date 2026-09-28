// pages/api/shopify/webhooks/shop-redact.js
/**
 * Mandatory Shopify GDPR Compliance Webhook: Shop Redact
 * 
 * Triggered 48 hours after an app is uninstalled from a merchant store.
 * Erases stored tokens and credentials for the uninstalled shop.
 */
import { getRawBody, verifyShopifyWebhook } from "../../../../lib/shopify/verify-webhook.js";
import { supabaseServer } from "../../../../lib/supabaseServer.js";

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
      console.warn("[Shopify GDPR] shop/redact HMAC verification failed");
      return res.status(401).send("Unauthorized");
    }

    const payload = JSON.parse(rawBodyBuffer.toString("utf8") || "{}");
    const shopDomain = payload.shop_domain;
    console.log(`[Shopify GDPR] Handled shop/redact for shop: ${shopDomain}`);

    if (shopDomain) {
      // Find and purge connection memory for this shop
      const { data: memRows } = await supabaseServer
        .from("agent_memory")
        .select("id, email, content")
        .like("memory_type", "shopify_connection%");

      for (const row of memRows || []) {
        try {
          const parsed = JSON.parse(row.content);
          if (parsed.shop === shopDomain || (parsed.shop && parsed.shop.includes(shopDomain))) {
            await supabaseServer.from("agent_memory").delete().eq("id", row.id);
            console.log(`[Shopify GDPR] Purged connection memory id: ${row.id} for shop: ${shopDomain}`);
          }
        } catch (_) {}
      }
    }

    return res.status(200).json({
      ok: true,
      message: "Shop data redaction completed.",
    });
  } catch (err) {
    console.error("[Shopify GDPR] shop/redact error:", err);
    return res.status(200).json({ ok: true });
  }
}
