// lib/video/higgsfield-service.js
/**
 * Higgsfield AI Video Generation Client
 * Supports ByteDance Seedance 2.5 and Wan 3.0 Prime via Higgsfield Model APIs.
 */

export async function generateHiggsfieldVideo({
  prompt,
  firstFrameUrl = null,
  aspectRatio = "9:16",
  durationSeconds = 5,
  jobId = "higgsfield_job",
  log = console.log,
}) {
  const apiKey = process.env.HIGGSFIELD_API_KEY;
  const keyId = process.env.HIGGSFIELD_API_KEY_ID;
  const keySecret = process.env.HIGGSFIELD_API_KEY_SECRET;

  const rawKey = apiKey || (keyId && keySecret ? `${keyId}:${keySecret}` : null);
  if (!rawKey) {
    throw new Error("Missing HIGGSFIELD_API_KEY in environment variables.");
  }

  const authHeader = rawKey.startsWith("Key ") ? rawKey : `Key ${rawKey}`;
  const cleanPrompt = `${prompt}, ${aspectRatio === "16:9" ? "16:9 widescreen" : "9:16 vertical smartphone format"}, cinematic lighting, photorealistic 8k, fluid motion, masterpiece, no text, no watermark`;

  // Select model endpoint based on input
  const endpoint = firstFrameUrl
    ? "https://api.higgsfield.ai/bytedance/seedance-2.5/image-to-video"
    : "https://api.higgsfield.ai/bytedance/seedance-2.5/text-to-video";

  const payload = firstFrameUrl
    ? { prompt: cleanPrompt, image_url: firstFrameUrl }
    : { prompt: cleanPrompt };

  log(`[Higgsfield] Dispatching Seedance 2.5 video generation (${firstFrameUrl ? "Image-to-Video" : "Text-to-Video"})...`);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 403 && errText.includes("not_enough_credits")) {
      throw new Error("HIGGSFIELD_TOPUP_REQUIRED: Your Higgsfield balance is $0.00. Please top up funds at open.higgsfield.ai/top-up to generate cinematic videos.");
    }
    throw new Error(`Higgsfield API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const requestId = data.id || data.request_id || data.job_id;

  if (!requestId && data.video_url) {
    return { ok: true, videoUrl: data.video_url };
  }

  if (!requestId) {
    throw new Error("Higgsfield did not return a valid request ID: " + JSON.stringify(data));
  }

  log(`[Higgsfield] Generation queued (ID: ${requestId}). Polling status...`);

  // Poll status endpoint
  const statusUrl = data.status_url || `https://api.higgsfield.ai/requests/${requestId}/status`;
  const startTime = Date.now();

  while ((Date.now() - startTime) < 180000) {
    await new Promise((r) => setTimeout(r, 4000));

    const checkRes = await fetch(statusUrl, {
      headers: { "Authorization": authHeader },
    });

    if (!checkRes.ok) continue;
    const checkData = await checkRes.json();
    const status = (checkData.status || "").toLowerCase();

    if (status === "completed" || status === "succeeded" || status === "done") {
      const videoUrl = checkData.video?.url || checkData.video_url || checkData.output?.video_url || checkData.output?.url || checkData.url;
      log(`[Higgsfield] Video generation succeeded: ${videoUrl}`);
      return { ok: true, videoUrl };
    }

    if (status === "failed" || status === "error") {
      throw new Error(`Higgsfield generation failed: ${checkData.error || checkData.detail || "Generation error"}`);
    }
  }

  throw new Error("Higgsfield video generation timed out after 180s");
}
