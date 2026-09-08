// lib/services/image-service.js
/**
 * Unified Server-Side Image Generation Service for GabbarInfo AI
 *
 * Centralizes all visual creation across:
 * - Independent AI Image Tool
 * - SEO Blog Hero Banner (16:9) & Mid Infographic (1:1)
 * - Individual Social Posts (Instagram & Facebook)
 * - Social Media Planner Autopilot
 * - Meta Ads Creative Posters
 *
 * Standardized on: gpt-image-2 (primary) with fallback to gpt-image-1.
 * Supports ephemeral storage lifecycle with automatic cleanup.
 */

import OpenAI from "openai";
import { supabaseServer } from "../supabaseServer";
import { AI_MODELS } from "../ai/ai-config";
import { reserveCredits, releaseCredits } from "../billing/credit-meter";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a high-converting platform visual using standardized AI models.
 * @param {object} params
 * @param {string} params.prompt
 * @param {string} [params.businessId]
 * @param {string} [params.userEmail]
 * @param {"1:1"|"16:9"} [params.aspectRatio="1:1"]
 * @param {string} [params.actionType="IMAGE_GENERATION"]
 * @param {boolean} [params.meterCredits=true]
 * @param {boolean} [params.persistInSupabase=true]
 * @returns {Promise<{ ok: boolean, imageUrl?: string, imageBase64?: string, storageFileName?: string, error?: string }>}
 */
export async function generatePlatformGraphic({
  prompt,
  businessId = "default_business",
  userEmail = null,
  aspectRatio = "1:1",
  actionType = "IMAGE_GENERATION",
  meterCredits = true,
  persistInSupabase = true,
}) {
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return { ok: false, error: "Missing or invalid image prompt." };
  }

  // 1. Credit Reservation (if enabled and user authenticated)
  let reservation = null;
  if (meterCredits && userEmail) {
    reservation = await reserveCredits({
      businessId,
      userEmail,
      actionType,
      referenceId: prompt.substring(0, 40),
    });

    if (!reservation.ok) {
      return { ok: false, error: reservation.error };
    }
  }

  // 2. Resolve dimensions
  const imageSize = aspectRatio === "16:9" ? "1792x1024" : "1024x1024";

  // 3. Primary & Fallback Model Execution
  const primaryModel = AI_MODELS.IMAGE_PRIMARY;
  const fallbackModel = AI_MODELS.IMAGE_FALLBACK;

  let result = null;
  let modelUsed = primaryModel;
  let imageBuffer = null;
  let imageBase64 = null;

  try {
    console.log(`[ImageService] Generating ${aspectRatio} graphic using ${primaryModel}...`);
    result = await openai.images.generate({
      model: primaryModel,
      prompt,
      size: imageSize,
    });
  } catch (primaryErr) {
    console.warn(`[ImageService] Primary model ${primaryModel} failed (${primaryErr.message}), falling back to ${fallbackModel}...`);
    try {
      modelUsed = fallbackModel;
      result = await openai.images.generate({
        model: fallbackModel,
        prompt,
        size: "1024x1024", // Standard size for fallback
      });
    } catch (fallbackErr) {
      console.warn(`[ImageService] OpenAI models failed, trying visual fallback:`, fallbackErr.message);
      try {
        const encodedPrompt = encodeURIComponent(prompt.slice(0, 300));
        const width = aspectRatio === "16:9" ? 1280 : 1024;
        const height = aspectRatio === "16:9" ? 720 : 1024;
        const pollUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
        const pollRes = await fetch(pollUrl);
        if (pollRes.ok) {
          imageBuffer = Buffer.from(await pollRes.arrayBuffer());
          imageBase64 = imageBuffer.toString("base64");
          modelUsed = "pollinations-fallback";
        }
      } catch (pollErr) {
        console.error("[ImageService] Fallback also failed:", pollErr.message);
      }

      if (!imageBuffer) {
        // Release reserved credits on failure
        if (reservation?.transactionId && userEmail) {
          await releaseCredits({
            userEmail,
            transactionId: reservation.transactionId,
            cost: reservation.cost,
            reason: "Image generation provider failure",
          });
        }

        return {
          ok: false,
          error: `Image generation failed: ${fallbackErr.message}`,
        };
      }
    }
  }

  // 4. Extract image data
  const rawUrl = result?.data?.[0]?.url || null;
  const rawB64 = result?.data?.[0]?.b64_json || null;

  if (!imageBase64 && rawB64) {
    imageBase64 = rawB64;
  }

  if (rawB64) {
    imageBuffer = Buffer.from(rawB64, "base64");
  } else if (rawUrl) {
    try {
      const fetchRes = await fetch(rawUrl);
      imageBuffer = Buffer.from(await fetchRes.arrayBuffer());
      imageBase64 = imageBuffer.toString("base64");
    } catch (fetchErr) {
      console.warn("[ImageService] Failed to buffer image from URL:", fetchErr.message);
    }
  }

  if (!imageBuffer && !rawUrl) {
    if (reservation?.transactionId && userEmail) {
      await releaseCredits({
        userEmail,
        transactionId: reservation.transactionId,
        cost: reservation.cost,
        reason: "Empty image payload returned from provider",
      });
    }
    return { ok: false, error: "No image data returned from provider." };
  }

  // 5. Ephemeral Storage Staging (Supabase Bucket: instagram-creatives)
  let publicUrl = rawUrl;
  let storageFileName = null;

  if (persistInSupabase && imageBuffer) {
    try {
      storageFileName = `ai_img_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
      const { data: uploadData, error: uploadErr } = await supabaseServer.storage
        .from("instagram-creatives")
        .upload(storageFileName, imageBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (!uploadErr && uploadData) {
        const { data: pubData } = supabaseServer.storage
          .from("instagram-creatives")
          .getPublicUrl(storageFileName);
        publicUrl = pubData.publicUrl;
      }
    } catch (storageErr) {
      console.warn("[ImageService] Storage staging warning:", storageErr.message);
    }
  }

  return {
    ok: true,
    imageUrl: publicUrl,
    imageBase64,
    storageFileName,
    modelUsed,
  };
}

/**
 * Cleanup / delete ephemeral image after publishing to avoid storage costs.
 * @param {string} storageFileName
 */
export async function cleanupEphemeralImage(storageFileName) {
  if (!storageFileName) return;
  try {
    await supabaseServer.storage.from("instagram-creatives").remove([storageFileName]);
    console.log(`[ImageService] Ephemeral storage cleaned up: ${storageFileName}`);
  } catch (err) {
    console.warn("[ImageService] Storage cleanup warning:", err.message);
  }
}
