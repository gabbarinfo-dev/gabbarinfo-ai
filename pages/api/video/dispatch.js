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

  const ADMIN_EMAIL = "ndantare@gmail.com";
  if (userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({
      ok: false,
      error: "AI Video Studio & Reels are currently in private studio testing. Public access is coming soon!",
    });
  }

  const { videoType = "reel", payload = {} } = req.body;

  // Normalize voice to valid engine enum ('nova', 'shimmer', 'echo', 'onyx', 'fable', 'alloy', 'ash', 'sage', 'coral')
  const OPENAI_VOICE_MAP = {
    adam: "alloy",
    charlie: "onyx",
    roger: "echo",
    george: "fable",
    arnold: "alloy",
    rachel: "nova",
    sarah: "shimmer",
    lily: "nova",
    emily: "nova",
  };
  const ALLOWED_VOICES = ["nova", "shimmer", "echo", "onyx", "fable", "alloy", "ash", "sage", "coral"];

  let normalizedVoice = String(payload.voice || "alloy").toLowerCase().trim();
  if (OPENAI_VOICE_MAP[normalizedVoice]) {
    normalizedVoice = OPENAI_VOICE_MAP[normalizedVoice];
  } else if (!ALLOWED_VOICES.includes(normalizedVoice)) {
    normalizedVoice = "alloy";
  }

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
        payload: {
          ...payload,
          voice: normalizedVoice,
          elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
          syncLabsApiKey: process.env.SYNC_LABS_API_KEY,
          openAiApiKey: process.env.OPENAI_API_KEY,
        },
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
