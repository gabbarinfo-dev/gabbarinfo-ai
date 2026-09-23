// lib/railway/dispatch-meta-campaign.js
/**
 * Dispatches Meta Ads campaign orchestration to the dedicated Railway background worker.
 * Eliminates Vercel serverless execution timeouts (FUNCTION_INVOCATION_TIMEOUT)
 * for heavy visual generation, Sharp overlay rendering, and Meta Graph API operations.
 */

/**
 * Dispatches Meta campaign creation as an asynchronous background job to Railway.
 * Returns immediately in <300ms with a jobId, eliminating any possible Vercel timeout.
 */
export async function dispatchMetaCampaignJobToRailway({
  userEmail,
  businessId,
  adAccountId,
  accessToken,
  pageId,
  payload,
  imagePrompt,
  service,
  offer,
  tagline,
  businessName,
  userProvidedImageUrl,
  imageHash,
}) {
  const workerUrl = process.env.RAILWAY_WORKER_URL || "https://video-worker-production-96d4.up.railway.app";
  const workerSecret = process.env.WORKER_SECRET_KEY || "gabbar_worker_secret_2026";

  const endpoint = `${workerUrl.replace(/\/+$/, "")}/meta/jobs/create-campaign`;
  console.log(`🚂 [Railway Dispatch] Queueing Meta campaign background job: ${endpoint}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerSecret}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        userEmail,
        businessId,
        adAccountId,
        accessToken,
        pageId,
        payload,
        imagePrompt,
        service,
        offer,
        tagline,
        businessName,
        userProvidedImageUrl,
        imageHash,
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
      console.warn(`⚠️ [Railway Dispatch] Worker responded with HTTP ${res.status}:`, parsedErr);
      return {
        ok: false,
        status: res.status,
        error: parsedErr || `Worker responded with HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    console.log(`🚀 [Railway Dispatch] Meta campaign job queued successfully:`, data.jobId);
    return data;
  } catch (err) {
    console.error("❌ [Railway Dispatch] Error dispatching campaign job:", err.message);
    return { ok: false, error: err.message };
  }
}

export async function getMetaCampaignJobStatus(jobId) {
  const workerUrl = process.env.RAILWAY_WORKER_URL || "https://video-worker-production-96d4.up.railway.app";
  const workerSecret = process.env.WORKER_SECRET_KEY || "gabbar_worker_secret_2026";
  const endpoint = `${workerUrl.replace(/\/+$/, "")}/jobs/status/${encodeURIComponent(jobId)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${workerSecret}` },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return { ok: false, error: `Worker responded with ${res.status}` };
    }
    return await res.json();
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function dispatchMetaCampaignToRailway({
  userEmail,
  businessId,
  adAccountId,
  accessToken,
  pageId,
  payload,
  imagePrompt,
  service,
  offer,
  tagline,
  businessName,
  userProvidedImageUrl,
  imageHash,
}) {
  const workerUrl = process.env.RAILWAY_WORKER_URL || "https://video-worker-production-96d4.up.railway.app";
  const workerSecret = process.env.WORKER_SECRET_KEY || "gabbar_worker_secret_2026";

  const endpoint = `${workerUrl.replace(/\/+$/, "")}/meta/create-campaign`;
  console.log(`🚂 [Railway Dispatch] Sending Meta campaign to Railway worker: ${endpoint}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 52000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerSecret}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        userEmail,
        businessId,
        adAccountId,
        accessToken,
        pageId,
        payload,
        imagePrompt,
        service,
        offer,
        tagline,
        businessName,
        userProvidedImageUrl,
        imageHash,
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
      console.warn(`⚠️ [Railway Dispatch] Worker responded with HTTP ${res.status}:`, parsedErr);
      return {
        ok: false,
        status: res.status,
        error: parsedErr || `Worker responded with HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    console.log(`✅ [Railway Dispatch] Campaign created successfully via Railway:`, data.campaignId || data.id);
    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("⚠️ [Railway Dispatch] Worker request timed out after 38s.");
      return { ok: false, timedOut: true, error: "Railway worker is still finalizing campaign in background." };
    }
    console.error("❌ [Railway Dispatch] Network / execution error:", err.message);
    return { ok: false, error: err.message };
  }
}

export async function dispatchMetaVisualToRailway({
  prompt,
  service,
  offer,
  tagline,
  businessName,
  cacheKey,
}) {
  const workerUrl = process.env.RAILWAY_WORKER_URL || "https://video-worker-production-96d4.up.railway.app";
  const workerSecret = process.env.WORKER_SECRET_KEY || "gabbar_worker_secret_2026";

  const endpoint = `${workerUrl.replace(/\/+$/, "")}/meta/generate-visual`;
  console.log(`🚂 [Railway Visual Dispatch] Offloading visual generation to Railway: ${endpoint}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerSecret}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        prompt,
        service,
        offer,
        tagline,
        businessName,
        cacheKey,
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText || `Worker responded with HTTP ${res.status}` };
    }

    const data = await res.json();
    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("⏳ [Railway Visual Dispatch] Generation in progress on Railway (32s limit reached on Vercel).");
      return { ok: false, timedOut: true, error: "Visual generation is finalizing in the background on Railway." };
    }
    console.warn("⚠️ [Railway Visual Dispatch] Error:", err.message);
    return { ok: false, error: err.message };
  }
}
