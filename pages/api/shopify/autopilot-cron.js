// pages/api/shopify/autopilot-cron.js
import { runShopifyAutopilotCycle } from "../../../lib/shopify/shopify-autopilot.js";

export const maxDuration = 300;
export const config = {
  maxDuration: 300,
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron =
    req.headers["x-vercel-cron"] === "1" ||
    (req.headers["user-agent"] || "").toLowerCase().includes("vercel-cron");

  if (
    cronSecret &&
    req.headers["authorization"] !== `Bearer ${cronSecret}` &&
    req.query?.secret !== cronSecret &&
    !isVercelCron
  ) {
    if (process.env.NODE_ENV === "production" && !req.query?.force) {
      return res.status(401).json({ ok: false, error: "Unauthorized cron trigger" });
    }
  }

  const force = req.query?.force === "true" || req.body?.force === true;
  const email = req.query?.email || req.body?.email || null;

  console.log(`[Shopify Autopilot Cron] Executing cycle (force: ${force}, email: ${email || "all"})...`);

  try {
    const results = await runShopifyAutopilotCycle({
      force,
      email,
      logger: (msg) => console.log(`[Shopify Cron] ${msg}`),
    });

    return res.status(200).json({
      ok: true,
      message: "Shopify Autopilot cycle executed successfully.",
      results,
    });
  } catch (err) {
    console.error("[Shopify Autopilot Cron Error]:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to execute Shopify autopilot cycle.",
    });
  }
}
