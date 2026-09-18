// pages/api/social/autopilot-cron.js
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
  console.log(`[Social Autopilot Cron] Offloading cycle to Railway worker (force: ${force})...`);

  const workerUrl = process.env.RAILWAY_WORKER_URL || "https://video-worker-production-96d4.up.railway.app";
  const workerSecret = process.env.WORKER_SECRET_KEY || "gabbar_worker_secret_2026";

  try {
    const workerRes = await fetch(`${workerUrl}/autopilot/social/trigger?token=${encodeURIComponent(workerSecret)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });

    const data = await workerRes.json();
    return res.status(workerRes.status).json(data);
  } catch (err) {
    console.error("[Social Autopilot Cron Proxy Error]:", err);
    return res.status(500).json({
      ok: false,
      error: `Railway worker connection error: ${err.message}`,
    });
  }
}
