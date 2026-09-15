// pages/api/video/job-status.js
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

  const workerUrl = process.env.RAILWAY_WORKER_URL || "http://localhost:8080";
  const workerSecret = process.env.WORKER_SECRET_KEY || "gabbar_worker_secret_2026";

  try {
    const response = await fetch(`${workerUrl.replace(/\/+$/, "")}/jobs/status/${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${workerSecret}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("[VideoJobStatus] Error polling Railway worker:", err);
    return res.status(500).json({
      ok: false,
      error: "Unable to query video worker. " + err.message,
    });
  }
}
