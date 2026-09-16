// pages/api/video/generate.js - delegates to Railway GPU Worker
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.body?.userEmail;

  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Please log in to create video reels." });
  }

  const {
    style = "talking_avatar",
    topic,
    customScript = "",
    scriptMode = "ai_prompt",
    niche = "marketing",
    language = "hindi",
    voice = "alloy",
    backgroundBeat = "upbeat_lofi",
    durationSeconds = 15,
  } = req.body;

  const workerUrl = process.env.RAILWAY_WORKER_URL || "https://video-worker-production-96d4.up.railway.app";
  const workerSecret = process.env.WORKER_SECRET_KEY || "gabbar_worker_secret_2026";

  try {
    const response = await fetch(`${workerUrl.replace(/\/+$/, "")}/jobs/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({
        videoType: "reel",
        payload: {
          topic: topic || customScript.slice(0, 50),
          customScript,
          scriptMode,
          durationSeconds,
          niche,
          language,
          voice,
          backgroundBeat,
          selectedStyle: style,
        },
        userEmail,
      }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Worker dispatch failed: " + err.message });
  }
}
