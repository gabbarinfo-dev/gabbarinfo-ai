// pages/api/wordpress/optimize-status.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    // Also allow direct API calls if session is missing
  }

  const jobId = req.query?.jobId || req.body?.jobId;
  if (!jobId) {
    return res.status(400).json({ ok: false, error: "jobId query parameter is required" });
  }

  const workerUrl = process.env.RAILWAY_WORKER_URL || "https://video-worker-production-96d4.up.railway.app";
  const workerSecret = process.env.WORKER_SECRET_KEY || "gabbar_worker_secret_2026";
  const endpoint = `${workerUrl.replace(/\/+$/, "")}/jobs/status/${encodeURIComponent(jobId)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const workerRes = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${workerSecret}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!workerRes.ok) {
      return res.status(workerRes.status).json({
        ok: false,
        error: `Worker returned status ${workerRes.status}`,
      });
    }

    const data = await workerRes.json();
    return res.status(200).json({
      ok: true,
      jobId: data.id || jobId,
      status: data.status || "processing",
      progress: data.progress || 10,
      stage: data.stage || "Processing...",
      result: data.result || null,
      error: data.error || null,
      completedAt: data.completedAt || null,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}
