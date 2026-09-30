// lib/video/hedra-service.js
/**
 * Hedra Character AI & LivePortrait Lip-Sync Service (v3 API)
 * Generates natural talking human presenters with realistic head movement, eye contact, and emotional lip sync.
 */

export async function generateHedraTalkingAvatar({
  imageUrl,
  audioUrl,
  aspectRatio = "9:16",
  jobId = "hedra_job",
  log = console.log,
}) {
  const hedraKey = process.env.HEDRA_API_KEY || (process.env.HEDRA_KEY_ID && process.env.HEDRA_KEY_SECRET ? `${process.env.HEDRA_KEY_ID}:${process.env.HEDRA_KEY_SECRET}` : null);

  if (hedraKey) {
    try {
      log(`[Hedra] Dispatching talking presenter job to Hedra Omnihuman/Creatify v3...`);
      const authHeader = hedraKey.startsWith("Key ") ? hedraKey : `Key ${hedraKey}`;

      const payload = {
        start_image: { source: "url", url: imageUrl },
        audio: { source: "url", url: audioUrl },
        resolution: "720p",
        aspect_ratio: aspectRatio === "16:9" ? "16:9" : "9:16",
      };

      // Try omnihuman-15, then creatify-aurora
      let createRes = await fetch("https://api.hedra.com/v3/models/omnihuman-15", {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!createRes.ok && createRes.status !== 403) {
        createRes = await fetch("https://api.hedra.com/v3/models/creatify-aurora", {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            start_image: { source: "url", url: imageUrl },
            audio: { source: "url", url: audioUrl },
            resolution: "720p",
          }),
        });
      }

      if (createRes.ok) {
        const createData = await createRes.json();
        const hedraJobId = createData.job_id || createData.id;
        const pollUrl = `https://api.hedra.com/v3/jobs/${hedraJobId}`;

        const startTime = Date.now();
        while ((Date.now() - startTime) < 300000) {
          await new Promise((r) => setTimeout(r, 4000));
          const pollRes = await fetch(pollUrl, {
            headers: { "Authorization": authHeader },
          });

          if (!pollRes.ok) continue;
          const pollData = await pollRes.json();
          const status = (pollData.status || "").toLowerCase();

          if (status === "complete" || status === "completed" || status === "succeeded") {
            const videoUrl = pollData.outputs?.[0]?.url || pollData.video_url || pollData.output?.url || pollData.url;
            log(`[Hedra] Talking presenter generated successfully: ${videoUrl}`);
            return { ok: true, videoUrl };
          }

          if (status === "failed" || status === "error") {
            throw new Error(`Hedra generation failed: ${pollData.error?.message || pollData.error || "Unknown error"}`);
          }
        }
      } else {
        const err = await createRes.text();
        log(`[Hedra] Notice (${createRes.status}): ${err}. Falling back to LivePortrait...`);
      }
    } catch (e) {
      log(`[Hedra] Notice: ${e.message}. Falling back to LivePortrait...`);
    }
  }

  // Fallback: Replicate LivePortrait
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (!replicateToken) {
    throw new Error("Missing both HEDRA_API_KEY and REPLICATE_API_TOKEN for talking avatar generation.");
  }

  log(`[LipSync] Dispatching high-fidelity LivePortrait prediction to Replicate...`);
  const repRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Token ${replicateToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "913a0b5a3e7e2e8e3d67f9175780a525f3c9597ffc6e7a2b97c2e0b57e79c298",
      input: {
        source_image: imageUrl,
        driving_audio: audioUrl,
        flag_eye_retargeting: true,
        flag_lip_retargeting: true,
      },
    }),
  });

  if (!repRes.ok) {
    const err = await repRes.text();
    throw new Error(`Replicate LivePortrait failed to initiate (${repRes.status}): ${err}`);
  }

  const prediction = await repRes.json();
  const pollUrl = prediction.urls?.get;

  const startTime = Date.now();
  while ((Date.now() - startTime) < 240000) {
    await new Promise((r) => setTimeout(r, 4000));
    const statusRes = await fetch(pollUrl, {
      headers: { "Authorization": `Token ${replicateToken}` },
    });
    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();

    if (statusData.status === "succeeded") {
      const out = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output;
      log(`[LipSync] LivePortrait generation succeeded: ${out}`);
      return { ok: true, videoUrl: out };
    }

    if (statusData.status === "failed" || statusData.status === "canceled") {
      throw new Error(`LivePortrait failed: ${statusData.error || "Unknown Replicate error"}`);
    }
  }

  throw new Error("Lip-sync prediction timed out after 240s");
}
