// lib/railway/dispatch-tiktok-creative.js
/**
 * Dispatches TikTok creative generation (carousels and video reels)
 * to the dedicated Railway background worker (video-worker-production-96d4.up.railway.app).
 * Eliminates Vercel 504 FUNCTION_INVOCATION_TIMEOUT completely.
 */

const getWorkerConfig = () => {
  const workerUrl = process.env.RAILWAY_WORKER_URL || "https://video-worker-production-96d4.up.railway.app";
  const workerSecret = process.env.WORKER_SECRET_KEY || "gabbar_worker_secret_2026";
  return { workerUrl: workerUrl.replace(/\/+$/, ""), workerSecret };
};

/**
 * Dispatches TikTok creative generation as a background job to Railway.
 * Returns immediately in <300ms with a jobId, eliminating any possible Vercel timeout.
 */
export async function dispatchTikTokJobToRailway({
  businessName,
  niche,
  topic,
  format,
  slideCount,
  logoUrl,
  autoAddMusic,
  audioPreset,
  soundTitle,
  soundArtist,
  soundCover,
  soundPreviewUrl,
}) {
  const { workerUrl, workerSecret } = getWorkerConfig();
  const endpoint = `${workerUrl}/tiktok/jobs/generate-creative`;
  console.log(`🚂 [TikTok Railway Dispatch] Queueing job at: ${endpoint}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerSecret}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        businessName,
        niche,
        topic,
        format,
        slideCount,
        logoUrl,
        autoAddMusic,
        audioPreset,
        soundTitle,
        soundArtist,
        soundCover,
        soundPreviewUrl,
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      let parsedErr = errText;
      try {
        const j = JSON.parse(errText);
        parsedErr = j.error || j.message || errText;
      } catch (_) {}
      console.warn(`⚠️ [TikTok Railway Dispatch] Worker returned HTTP ${res.status}:`, parsedErr);
      return { ok: false, error: parsedErr || `Worker HTTP ${res.status}` };
    }

    const data = await res.json();
    console.log(`🚀 [TikTok Railway Dispatch] Job queued successfully:`, data.jobId);
    return data;
  } catch (err) {
    console.error("❌ [TikTok Railway Dispatch] Error dispatching job:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Polls Railway worker for status of a TikTok creative job.
 */
export async function getTikTokJobStatus(jobId) {
  const { workerUrl, workerSecret } = getWorkerConfig();
  const endpoint = `${workerUrl}/jobs/status/${encodeURIComponent(jobId)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${workerSecret}` },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return { ok: false, error: `Worker returned HTTP ${res.status}` };
    }

    return await res.json();
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Suggest topics directly from Railway worker (Gemini powered)
 */
export async function suggestTopicsFromRailway(businessName, niche) {
  const { workerUrl, workerSecret } = getWorkerConfig();
  const endpoint = `${workerUrl}/tiktok/suggest-topics`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerSecret}`,
      },
      signal: controller.signal,
      body: JSON.stringify({ businessName, niche }),
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.topics)) {
        return data.topics;
      }
    }
  } catch (err) {
    console.warn("[TikTok Railway] suggestTopics error:", err.message);
  }
  return null;
}
