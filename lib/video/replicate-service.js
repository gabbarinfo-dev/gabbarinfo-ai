// lib/video/replicate-service.js

/**
 * Replicate API Client for Style 2 (Talking Avatar) and Style 3 (Generative Video)
 */

/**
 * Polls a Replicate prediction until it finishes.
 */
async function pollPrediction(predictionUrl, token, maxWaitSecs = 120) {
  const startTime = Date.now();
  while ((Date.now() - startTime) / 1000 < maxWaitSecs) {
    const res = await fetch(predictionUrl, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!res.ok) throw new Error("Failed to check prediction status");
    const data = await res.json();

    if (data.status === "succeeded") {
      // Output can be a string URL or an array of URLs
      const output = Array.isArray(data.output) ? data.output[0] : data.output;
      return { ok: true, outputUrl: output };
    }

    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(data.error || `Replicate prediction ${data.status}`);
    }

    // Wait 2 seconds between polls
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Replicate prediction timed out after " + maxWaitSecs + "s");
}

import { generateSyncLabsLipSync } from "./synclabs-service.js";
import { generateHedraTalkingAvatar } from "./hedra-service.js";
import { generateHiggsfieldVideo } from "./higgsfield-service.js";

/**
 * Style 2: Generates a talking presenter video with realistic motion and lip-sync.
 * Priority: Sync Labs sync-3 -> Hedra Character-2 -> Replicate LivePortrait
 * Outdated SadTalker has been completely removed.
 */
export async function generateTalkingAvatar({ imageUrl, audioUrl }) {
  // 1. Primary Engine: Sync Labs v2 Precision Lip-Sync
  if (process.env.SYNC_LABS_API_KEY && imageUrl && audioUrl) {
    try {
      console.log("[VideoService] Attempting precision lip-sync via Sync Labs (sync-3)...");
      const syncRes = await generateSyncLabsLipSync({
        videoUrl: imageUrl,
        audioUrl,
        model: "sync-3",
        jobId: "web_talking_avatar",
      });

      if (syncRes.ok && syncRes.videoUrl) {
        console.log("[VideoService] Sync Labs lip-sync succeeded:", syncRes.videoUrl);
        return syncRes.videoUrl;
      }
    } catch (syncErr) {
      console.warn("[VideoService] Sync Labs notice:", syncErr.message);
    }
  }

  // 2. Secondary Engine: Hedra Character-2 or Replicate LivePortrait
  console.log("[VideoService] Generating talking presenter with Hedra / LivePortrait...");
  const hedraRes = await generateHedraTalkingAvatar({
    imageUrl,
    audioUrl,
    aspectRatio: "9:16",
    jobId: "web_talking_avatar",
    log: console.log,
  });

  return hedraRes.videoUrl;
}

/**
 * Style 3: Generates a cinematic photorealistic video clip.
 * Priority: Higgsfield AI -> Minimax Video-01 -> Wan 2.1
 * Outdated AnimateDiff has been completely removed.
 */
export async function generateCinematicClip({ prompt, firstFrameUrl = null, duration = 5 }) {
  // 1. Try Higgsfield AI if credentials are set
  if (process.env.HIGGSFIELD_API_KEY || (process.env.HIGGSFIELD_API_KEY_ID && process.env.HIGGSFIELD_API_KEY_SECRET)) {
    try {
      console.log("[VideoService] Attempting cinematic video generation via Higgsfield AI...");
      const hfRes = await generateHiggsfieldVideo({
        prompt,
        firstFrameUrl,
        durationSeconds: duration,
        aspectRatio: "9:16",
        jobId: "web_cinematic_clip",
        log: console.log,
      });
      if (hfRes.ok && hfRes.videoUrl) return hfRes.videoUrl;
    } catch (hfErr) {
      console.warn("[VideoService] Higgsfield error:", hfErr.message);
    }
  }

  // 2. High-fidelity Replicate Minimax Video-01 (Hailuo AI tier)
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("Missing REPLICATE_API_TOKEN in environment variables");

  console.log("[VideoService] Generating cinematic clip via Minimax Video-01...");
  const cleanPrompt = `${prompt}, 9:16 vertical cinema reel, cinematic lighting, photorealistic 8k, fluid physical motion, no text, no watermark`;

  const inputPayload = {
    prompt: cleanPrompt,
    prompt_optimizer: true,
  };
  if (firstFrameUrl) {
    inputPayload.first_frame_image = firstFrameUrl;
  }

  const createRes = await fetch("https://api.replicate.com/v1/models/minimax/video-01/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: inputPayload }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    // Fallback to Wan 2.1 if Minimax is unavailable
    console.warn("[VideoService] Minimax init error, falling back to Wan 2.1:", errText);
    const wanRes = await fetch("https://api.replicate.com/v1/models/wan-video/wan-2.1-1.3b/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt: `${prompt}, cinematic 8k, fluid motion, atmospheric depth, no watermark`,
          aspect_ratio: "9:16",
        },
      }),
    });
    if (!wanRes.ok) throw new Error("Failed to start Generative Video prediction: " + (await wanRes.text()));
    const wanPrediction = await wanRes.json();
    const wanResult = await pollPrediction(wanPrediction.urls.get, token, 240);
    return wanResult.outputUrl;
  }

  const prediction = await createRes.json();
  const result = await pollPrediction(prediction.urls.get, token, 300);
  return result.outputUrl;
}
