// pages/api/google-ads/create-simple-campaign.js
// Replaceable file — safe to paste over your existing file.
// Behavior:
// - Validates incoming payload (same validation you had).
// - If GOOGLE_ADS_BASIC_ACCESS !== "true" -> returns stub (echo).
// - If GOOGLE_ADS_BASIC_ACCESS === "true" -> attempts a lightweight verification
//   call to Google Ads (listAccessibleCustomers) using lib/googleAdsHelper.js.
//   It DOES NOT attempt destructive/mutate campaign creation yet (we'll add that
//   once Basic Access is fully approved and you confirm).
//
// Optional: provide { refreshToken } in request body to use a user-specific refresh token.

import { listAccessibleCustomers, callGoogleAdsApi } from "../../../lib/googleAdsHelper";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ ok: false, message: "Only POST is allowed on this endpoint." });
  }

  try {
    const body = req.body;

    if (!body || typeof body !== "object") {
      return res.status(400).json({
        ok: false,
        message: "Missing or invalid JSON body.",
      });
    }

    const { customerId, campaign, adGroups, refreshToken } = body;

    // Basic validation – keep your previous rules
    const errors = [];

    if (!customerId || typeof customerId !== "string") {
      errors.push("customerId (string) is required.");
    }

    if (!campaign || typeof campaign !== "object") {
      errors.push("campaign object is required.");
    } else {
      if (!campaign.name) errors.push("campaign.name is required.");
      if (!campaign.network) errors.push("campaign.network is required.");
      if (typeof campaign.dailyBudgetMicros !== "number") {
        errors.push("campaign.dailyBudgetMicros (number) is required.");
      }
      if (!campaign.finalUrl) errors.push("campaign.finalUrl is required.");
    }

    if (!Array.isArray(adGroups) || adGroups.length === 0) {
      errors.push("adGroups (non-empty array) is required.");
    } else {
      adGroups.forEach((ag, idx) => {
        if (!ag.name) errors.push(`adGroups[${idx}].name is required.`);
        if (typeof ag.cpcBidMicros !== "number") {
          errors.push(`adGroups[${idx}].cpcBidMicros (number) is required.`);
        }
        if (!Array.isArray(ag.keywords) || ag.keywords.length === 0) {
          errors.push(`adGroups[${idx}].keywords (non-empty array) is required.`);
        }
        if (!Array.isArray(ag.ads) || ag.ads.length === 0) {
          errors.push(`adGroups[${idx}].ads (non-empty array) is required.`);
        }
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        ok: false,
        message: "Validation failed.",
        errors,
      });
    }

    // If basic access flag isn't turned on, keep acting as the safe stub (echo)
    const basicAccessFlag = String(process.env.GOOGLE_ADS_BASIC_ACCESS || "false").toLowerCase();
    if (basicAccessFlag !== "true") {
      return res.status(200).json({
        ok: true,
        stub: true,
        message:
          "Stub only: campaign payload received. Set GOOGLE_ADS_BASIC_ACCESS=true to run verification checks.",
        received: body,
      });
    }

    // ---------------------------
    // GOOGLE ADS BASIC ACCESS FLOW
    // ---------------------------
    // We will attempt a safe verification call to Google Ads to confirm credentials.
    // Use refreshToken from request body if provided (per-user token in Supabase).
    try {
      // Lightweight verification: listAccessibleCustomers to confirm auth + developer token
      const listResp = await listAccessibleCustomers({
        refreshToken: refreshToken || undefined,
        // optionally you can pass developerToken or loginCustomerId here as well
      });

      if (!listResp.ok) {
        // Google returned an error — surface it
        return res.status(500).json({
          ok: false,
          step: "google_verification",
          message: "Google Ads verification call failed.",
          details: listResp.json || null,
          status: listResp.status,
        });
      }

      // If verification succeeded, return helpful info and the original payload.
      return res.status(200).json({
        ok: true,
        stub: false,
        message:
          "Basic Access flag is ON and Google verification passed. Campaign creation logic is not yet executed (safe mode).",
        googleVerification: listResp.json || null,
        received: body,
      });
    } catch (err) {
      console.error("Error during Google Ads verification:", err);
      return res.status(500).json({
        ok: false,
        step: "exception",
        message: "Unexpected error while verifying Google Ads credentials.",
        error: err.message || String(err),
      });
    }
  } catch (err) {
    console.error("Error in /api/google-ads/create-simple-campaign:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error while handling campaign creation stub.",
      error: err.message || String(err),
    });
  }
}
