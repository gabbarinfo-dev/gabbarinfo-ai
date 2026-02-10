// pages/api/google-ads/create-simple-campaign.js
// Replaceable — server route that validates payload, and (optionally)
// verifies Google Ads credentials using a per-user refresh token stored
// in Supabase (public.google_connections).
//
// Requirements (env):
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - GOOGLE_ADS_BASIC_ACCESS (set to "true" to enable verification branch)
//
// NOTE: this file expects you already created lib/googleAdsHelper.js which
// exports listAccessibleCustomers({ refreshToken }) -> { ok, status, json }
// (the earlier helper you added).

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]"; // path relative to this file
import { createClient } from "@supabase/supabase-js";
import { listAccessibleCustomers } from "../../../lib/googleAdsHelper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Supabase access will fail for server-side token lookup."
  );
}

const supabaseServer = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST is allowed." });
  }

  try {
    const body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ ok: false, message: "Missing or invalid JSON body." });
    }

    const { customerId, campaign, adGroups, refreshToken: incomingRefreshToken } = body;

    // --- validation (same rules you had) ---
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
      return res.status(400).json({ ok: false, message: "Validation failed.", errors });
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
    // 1) Determine refresh token to use:
    //    - incomingRefreshToken (body) has highest priority
    //    - otherwise read from Supabase table public.google_connections by user email
    let refreshTokenToUse = incomingRefreshToken || null;

    if (!refreshTokenToUse) {
      // get server session to find the user's email
      const session = await getServerSession(req, res, authOptions);
      const email = session?.user?.email?.toLowerCase?.().trim?.();

      if (!email) {
        return res.status(401).json({
          ok: false,
          step: "auth",
          message:
            "No valid session / email found. Provide refreshToken in body or ensure you are signed in.",
        });
      }

      // fetch from supabase
      try {
        const { data, error } = await supabaseServer
          .from("google_connections")
          .select("refresh_token, access_token, customer_id, expires_at")
          .eq("email", email)
          .maybeSingle();

        if (error) {
          console.error("Supabase error fetching google_connections:", error);
          // continue to let user know
          return res.status(500).json({
            ok: false,
            step: "supabase_fetch",
            message: "Failed to read Google connection from Supabase.",
            error: error.message || error,
          });
        }

        if (!data || !data.refresh_token) {
          return res.status(404).json({
            ok: false,
            step: "no_refresh_token",
            message:
              "No refresh_token found for your account in Supabase. Provide refreshToken in body or insert it into google_connections table.",
          });
        }

        refreshTokenToUse = data.refresh_token;
      } catch (err) {
        console.error("Unexpected Supabase error:", err);
        return res.status(500).json({
          ok: false,
          step: "supabase_exception",
          message: "Unexpected error reading Supabase google_connections.",
          error: String(err.message || err),
        });
      }
    }

    // 2) Call Google Ads lightweight verification using the refresh token
    try {
      const googleResp = await listAccessibleCustomers({ refreshToken: refreshTokenToUse });

      // listAccessibleCustomers should return an object like { ok, status, json }
      if (!googleResp || !googleResp.ok) {
        return res.status(500).json({
          ok: false,
          step: "google_verification",
          message: "Google Ads verification call failed.",
          details: googleResp?.json || null,
          status: googleResp?.status || null,
        });
      }

      // Success -> return the verification result + original payload
      return res.status(200).json({
        ok: true,
        stub: false,
        message:
          "Basic Access flag is ON and Google verification passed. Campaign creation logic is not executed yet (safe mode).",
        googleVerification: googleResp.json || null,
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
    console.error("Unhandled error in create-simple-campaign:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error while handling campaign creation.",
      error: String(err.message || err),
    });
  }
}
