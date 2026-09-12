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

/**
 * Style 2: Generates a talking avatar video from an image and voiceover audio.
 */
export async function generateTalkingAvatar({ imageUrl, audioUrl }) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("Missing REPLICATE_API_TOKEN");

  // Using SadTalker on Replicate (cjwbw/sadtalker)
  const createRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "a519cc0cf43a85240d161f2f33c4d7f02f7ae8192a15374b69163947477bb376", // sadtalker
      input: {
        source_image: imageUrl,
        driven_audio: audioUrl,
        still: true,
        enhancer: "gfpgan",
      },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error("Failed to start Avatar prediction: " + errText);
  }

  const prediction = await createRes.json();
  const result = await pollPrediction(prediction.urls.get, token, 150);
  return result.outputUrl;
}

/**
 * Style 3: Generates a cinematic video clip from text prompt.
 */
export async function generateCinematicClip({ prompt, duration = 4 }) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("Missing REPLICATE_API_TOKEN");

  // Using Luma / AnimateDiff / Wan on Replicate
  const cleanPrompt = `${prompt}, 9:16 vertical orientation, cinematic 4k, hyper-realistic, high detail`;

  // Use lucataco/animate-diff or minimax
  const createRes = await fetch("https://api.replicate.com/v1/models/lucataco/animate-diff/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt: cleanPrompt,
        n_prompt: "bad quality, blurry, distorted, horizontal",
        steps: 25,
        guidance_scale: 7.5,
      },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error("Failed to start Generative Video prediction: " + errText);
  }

  const prediction = await createRes.json();
  const result = await pollPrediction(prediction.urls.get, token, 180);
  return result.outputUrl;
}
