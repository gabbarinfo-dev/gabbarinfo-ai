// pages/api/meta/job-status.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.query?.userEmail;

  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ ok: false, error: "Missing jobId" });
  }

  const workerUrl = process.env.RAILWAY_WORKER_URL || "https://video-worker-production-96d4.up.railway.app";
  const workerSecret = process.env.WORKER_SECRET_KEY || "gabbar_worker_secret_2026";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${workerUrl.replace(/\/+$/, "")}/jobs/status/${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${workerSecret}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error("[MetaJobStatus] Error querying Railway worker:", err.message);
    return res.status(500).json({
      ok: false,
      error: "Unable to query Meta worker: " + err.message,
    });
  }
}
