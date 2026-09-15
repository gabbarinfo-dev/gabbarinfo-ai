// pages/api/video/dispatch.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.body?.userEmail;

  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Please log in to generate videos." });
  }

  const { videoType = "reel", payload = {} } = req.body;

  // Railway Worker Configuration
  const workerUrl = process.env.RAILWAY_WORKER_URL || "http://localhost:8080";
  const workerSecret = process.env.WORKER_SECRET_KEY || "gabbar_worker_secret_2026";

  try {
    const response = await fetch(`${workerUrl.replace(/\/+$/, "")}/jobs/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({
        videoType,
        payload,
        userEmail,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || `Worker returned status ${response.status}`);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("[VideoDispatch] Failed to send job to Railway worker:", err);
    return res.status(500).json({
      ok: false,
      error: "Background video service unavailable. " + err.message,
    });
  }
}
