// pages/api/wordpress/autopilot-cron.js
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

  const force = Boolean(req.query?.force === "1" || req.query?.force === "true" || req.body?.force);
  console.log(`[SEO Autopilot Cron] Offloading cycle to Railway background worker (force: ${force})...`);

  const workerUrl = process.env.RAILWAY_WORKER_URL || "https://video-worker-production-96d4.up.railway.app";
  const workerSecret = process.env.WORKER_SECRET_KEY || "gabbar_worker_secret_2026";

  try {
    const workerRes = await fetch(`${workerUrl}/autopilot/seo/trigger?token=${encodeURIComponent(workerSecret)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });

    const data = await workerRes.json();
    return res.status(workerRes.status).json({
      ok: data.ok,
      processed: data.count || (data.results ? data.results.length : 0),
      results: data.results || [],
      error: data.error || null,
    });
  } catch (err) {
    console.error("[SEO Autopilot Cron Proxy Error]:", err);
    return res.status(500).json({
      ok: false,
      error: `Railway worker connection error: ${err.message}`,
    });
  }
}
