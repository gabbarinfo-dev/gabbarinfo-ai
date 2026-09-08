// pages/api/images/generate.js
/**
 * Hardened Server-Side Image Generation Endpoint
 * Gated by: Authentication, Entitlements, Rate Limiting, and Atomic Credit Metering.
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { verifyEntitlement, FEATURES } from "../../../lib/auth/entitlements";
import { generatePlatformGraphic } from "../../../lib/services/image-service";
import { checkRateLimit } from "../../../lib/middleware/rate-limiter";
import { reserveQuota, commitQuota, releaseQuota } from "../../../lib/billing/quota-service";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Authentication Gate
    const session = await getServerSession(req, res, authOptions);
    const internalSecret = req.headers["x-internal-secret"];
    const isInternalCall = internalSecret && internalSecret === process.env.INTERNAL_AGENT_SECRET;

    if (!session?.user?.email && !isInternalCall) {
      return res.status(401).json({
        ok: false,
        error: "Authentication required to generate images.",
      });
    }

    const userEmail = session?.user?.email || "internal_agent@gabbarinfo.com";

    // 2. Server-Side Rate Limiting Gate (Max 15 requests per minute per user)
    const rateCheck = checkRateLimit(userEmail, "IMAGE_GEN", 15, 60000);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        ok: false,
        error: `Too many image requests. Please wait ${Math.ceil(rateCheck.resetInMs / 1000)} seconds.`,
      });
    }

    // 3. Payload Validation
    const { prompt, businessId, aspectRatio = "1:1" } = req.body || {};
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return res.status(400).json({ ok: false, error: "Missing prompt parameter." });
    }

    // 4. Entitlement & Monthly Service Quota Gate
    let quotaRes = null;
    if (session) {
      quotaRes = await reserveQuota({
        session,
        userEmail,
        businessId,
        actionType: "IMAGE_GENERATION",
      });

      if (!quotaRes.ok) {
        return res.status(quotaRes.code === "FEATURE_NOT_INCLUDED" ? 403 : 402).json({
          ok: false,
          code: quotaRes.code,
          error: quotaRes.error,
          planId: quotaRes.planId,
          nextResetDate: quotaRes.nextResetDate,
        });
      }
    }

    // 5. Central Unified Image Service Execution
    const result = await generatePlatformGraphic({
      prompt: prompt.trim(),
      businessId: quotaRes?.businessId || businessId || "default_business",
      userEmail,
      aspectRatio,
      actionType: "IMAGE_GENERATION",
      meterCredits: !isInternalCall, // Meter if direct user request
      persistInSupabase: true,
    });

    if (!result.ok) {
      if (quotaRes?.reservationId) {
        await releaseQuota({
          reservationId: quotaRes.reservationId,
          businessId: quotaRes.businessId,
          cycleStart: quotaRes.cycleStart,
          actionType: "IMAGE_GENERATION",
          reason: result.error || "Image generation failure",
        });
      }
      return res.status(500).json({
        ok: false,
        error: result.error || "Error generating image.",
      });
    }

    if (quotaRes?.reservationId) {
      await commitQuota({
        reservationId: quotaRes.reservationId,
        businessId: quotaRes.businessId,
        cycleStart: quotaRes.cycleStart,
        actionType: "IMAGE_GENERATION",
        userEmail,
      });
    }

    return res.status(200).json({
      ok: true,
      imageUrl: result.imageUrl,
      imageBase64: result.imageBase64,
      modelUsed: result.modelUsed,
    });
  } catch (err) {
    console.error("[API/Images/Generate] Unhandled error:", err);
    return res.status(500).json({
      ok: false,
      error: "Error generating image.",
      details: err?.message || String(err),
    });
  }
}
