// pages/api/shopify/billing/status.js
import { getShopifyPlanState, SHOPIFY_PLANS } from "../../../../lib/shopify/trial-guard.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const { shop } = req.query;

  if (!shop) {
    return res.status(400).json({ ok: false, error: "Shop domain is required." });
  }

  try {
    const planState = await getShopifyPlanState(shop);
    return res.status(200).json({
      ok: true,
      state: planState,
      availablePlans: SHOPIFY_PLANS,
    });
  } catch (err) {
    console.error("[shopify-billing-status] Error fetching status:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
