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
import { supabaseServer } from "../supabaseServer.js";
import { AI_MODELS } from "../ai/ai-config.js";
import { reserveCredits, releaseCredits } from "../billing/credit-meter.js";

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
  customSize = null,
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
  const imageSize = customSize || (aspectRatio === "16:9" ? "1792x1024" : "1024x1024");

  // 3. Approved Model Cascade: gpt-image-2 -> gpt-image-2-2026-04-21 -> gpt-image-1.5
  const candidateModels = AI_MODELS.IMAGE_MODELS || [
    "gpt-image-2",
    "gpt-image-2-2026-04-21",
    "gpt-image-1.5",
  ];

  let result = null;
  let modelUsed = null;
  let imageBuffer = null;
  let imageBase64 = null;
  let lastError = null;

  const withTimeout = (promise, ms = 75000) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Model call timed out after ${ms}ms`)), ms)
      ),
    ]);

  for (const model of candidateModels) {
    try {
      console.log(`[ImageService] Attempting visual generation with approved model: ${model} (${imageSize})...`);
      result = await withTimeout(
        openai.images.generate({
          model,
          prompt,
          size: imageSize,
        }),
        75000
      );

      if (result?.data?.[0]?.b64_json || result?.data?.[0]?.url) {
        modelUsed = model;
        console.log(`[ImageService] Successfully generated visual using ${model}`);
        break;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[ImageService] Model ${model} failed (${err.message}), trying next approved model...`);
    }
  }

  if (!result || (!result?.data?.[0]?.b64_json && !result?.data?.[0]?.url)) {
    // Release reserved credits on failure
    if (reservation?.transactionId && userEmail) {
      await releaseCredits({
        userEmail,
        transactionId: reservation.transactionId,
        cost: reservation.cost,
        reason: "Image generation provider failure across all approved models",
      });
    }

    return {
      ok: false,
      error: `All approved image models failed. Last error: ${lastError?.message || "Unknown error"}`,
    };
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
