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
    prompt = "",
    topic = "",
    customScript = "",
    scriptMode = "ai_prompt",
    aspectRatio = "9:16",
    format = "9:16",
    durationSeconds = 30,
    workflowType = "product_ad", // "product_ad" | "creative_film" | "character_story"
    attachedAssets = [], // Array of hosting URLs for uploaded photos/docs
    characterId = null,
    seriesId = null,
    episodeNumber = null,
    niche = "business",
    language = "hindi",
    voice = "alloy",
    backgroundBeat = "upbeat_lofi",
    selectedStyle = "cinema_unified",
  } = req.body;

  const workerUrl = process.env.RAILWAY_WORKER_URL || "https://video-worker-production-96d4.up.railway.app";
  const workerSecret = process.env.WORKER_SECRET_KEY || "gabbar_worker_secret_2026";

  const resolvedTopic = prompt || topic || customScript.slice(0, 80) || "Cinematic Masterpiece";
  const isWidescreen = (aspectRatio === "16:9" || format === "16:9" || format === "youtube_16_9");
  const videoType = (durationSeconds > 60 || isWidescreen) ? "long_form_youtube" : "reel";

  try {
    const response = await fetch(`${workerUrl.replace(/\/+$/, "")}/jobs/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({
        videoType,
        payload: {
          prompt: prompt || resolvedTopic,
          topic: resolvedTopic,
          customScript,
          scriptMode,
          aspectRatio: isWidescreen ? "16:9" : "9:16",
          format: isWidescreen ? "youtube_16_9" : "reel_9_16",
          durationSeconds: Number(durationSeconds) || 30,
          targetMinutes: Math.max(1, Math.round(Number(durationSeconds) / 60)),
          workflowType,
          attachedAssets,
          characterId,
          seriesId,
          episodeNumber,
          niche,
          language,
          voice,
          backgroundBeat,
          selectedStyle,
          // Forward active API keys from environment
          higgsfieldApiKey: process.env.HIGGSFIELD_API_KEY,
          hedraApiKey: process.env.HEDRA_API_KEY,
          elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
          replicateApiToken: process.env.REPLICATE_API_TOKEN,
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
