// video-worker/lib/synclabs-service.js
/**
 * Sync Labs (Sync.so v2 API) Precision Lip-Sync Service for Railway Video Worker (CommonJS)
 *
 * Models available:
 * - "sync-3": Flagship model with native visual intelligence, highest quality, natural head & eye movements.
 * - "lipsync-2-pro": High fidelity, high reliability, moderate cost.
 * - "lipsync-2": Fast, cost-efficient lipsync for everyday social reels.
 */

async function generateSyncLabsLipSync({
  videoUrl,
  audioUrl,
  model = "sync-3",
  jobId = "sync_job",
  maxWaitSeconds = 300,
  log = console.log,
}) {
  const apiKey = process.env.SYNC_LABS_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Missing SYNC_LABS_API_KEY in environment variables." };
  }

  if (!videoUrl || !audioUrl) {
    return { ok: false, error: "Both videoUrl and audioUrl are required for Sync Labs lip-sync." };
  }

  const modelsToTry = [model, "lipsync-2-pro", "lipsync-2"].filter((v, i, a) => a.indexOf(v) === i);
  let lastError = null;

  for (const currentModel of modelsToTry) {
    try {
      log(jobId, `Dispatching lip-sync generation via Sync Labs (${currentModel})...`);

      const inputPayload = [
        { type: "video", url: videoUrl },
        { type: "audio", url: audioUrl },
      ];

      const res = await fetch("https://api.sync.so/v2/generate", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: currentModel,
          input: inputPayload,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        log(jobId, `Sync Labs ${currentModel} failed with status ${res.status}: ${errText}`);
        lastError = new Error(`Sync Labs init error (${res.status}): ${errText}`);
        continue; // Try next model
      }

      const initData = await res.json();
      const generationId = initData.id;
      if (!generationId) {
        throw new Error("No generation ID returned by Sync Labs API.");
      }

      log(jobId, `Sync Labs job created (${generationId}). Polling status...`);

      const startTime = Date.now();
      const timeoutMs = maxWaitSeconds * 1000;

      while (Date.now() - startTime < timeoutMs) {
        await new Promise((r) => setTimeout(r, 4000));

        const statusRes = await fetch(`https://api.sync.so/v2/generate/${generationId}`, {
          headers: { "x-api-key": apiKey },
        });

        if (!statusRes.ok) {
          log(jobId, `Sync Labs status poll warning (${statusRes.status})`);
          continue;
        }

        const data = await statusRes.json();
        const status = (data.status || "").toUpperCase();

        if (status === "COMPLETED") {
          const finalUrl = data.outputUrl || data.output_url || data.output;
          if (!finalUrl) {
            throw new Error("Sync Labs returned COMPLETED but outputUrl was empty.");
          }
          log(jobId, `Sync Labs lip-sync succeeded via ${currentModel}: ${finalUrl}`);
          return { ok: true, videoUrl: finalUrl, modelUsed: currentModel };
        }

        if (status === "FAILED" || status === "CANCELED" || status === "ERROR") {
          const errMsg = data.error || data.message || "Unknown error";
          log(jobId, `Sync Labs job ${generationId} failed: ${errMsg}`);
          lastError = new Error(`Sync Labs prediction failed: ${errMsg}`);
          break; // Break inner loop to try fallback model
        }

        log(jobId, `Sync Labs status: ${status} (${Math.round((Date.now() - startTime) / 1000)}s)...`);
      }
    } catch (err) {
      log(jobId, `Sync Labs exception during ${currentModel}: ${err.message}`);
      lastError = err;
    }
  }

  return {
    ok: false,
    error: lastError?.message || "Sync Labs lip-sync generation failed across all models.",
  };
}

module.exports = {
  generateSyncLabsLipSync,
};
