// pages/api/google-ads/create-simple-campaign.js
// Multi-user Google Ads Campaign Creation Endpoint
// Validates payload and executes Campaign Budget, Search Campaign (PAUSED),
// Ad Groups, RSA Ads, and Keywords directly in the user's selected Google Ads account.

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import {
  cleanCustomerId,
  createFullGoogleAdsCampaign,
} from "../../../lib/googleAdsHelper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseServer = createClient(
  SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY || ""
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST is allowed." });
  }

  try {
    const body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ ok: false, message: "Missing or invalid JSON body." });
    }

    const {
      customerId: incomingCustomerId,
      campaign,
      adGroups,
      refreshToken: incomingRefreshToken,
    } = body;

    // 1) Authenticate user session
    const session = await getServerSession(req, res, authOptions);
    const email = session?.user?.email?.toLowerCase()?.trim();

    let refreshTokenToUse = incomingRefreshToken || null;
    let customerIdToUse = incomingCustomerId || null;

    // 2) Look up connection details from Supabase if needed
    if (email && (!refreshTokenToUse || !customerIdToUse)) {
      try {
        const { data, error } = await supabaseServer
          .from("google_connections")
          .select("refresh_token, customer_id")
          .eq("email", email)
          .maybeSingle();

        if (!error && data) {
          if (!refreshTokenToUse && data.refresh_token) {
            refreshTokenToUse = data.refresh_token;
          }
          if (!customerIdToUse && data.customer_id) {
            customerIdToUse = data.customer_id;
          }
        }
      } catch (dbErr) {
        console.warn("Could not query google_connections from Supabase:", dbErr.message);
      }
    }

    // Session fallback for refresh token
    if (!refreshTokenToUse && session?.refreshToken) {
      refreshTokenToUse = session.refreshToken;
    }

    // 3) Validate Refresh Token
    if (!refreshTokenToUse) {
      return res.status(401).json({
        ok: false,
        step: "auth",
        message:
          "No Google Ads authorization found. Please sign in with Google or provide a refresh token.",
      });
    }

    // 4) Validate Customer ID
    const cleanId = cleanCustomerId(customerIdToUse);
    if (!cleanId) {
      return res.status(400).json({
        ok: false,
        step: "validation",
        message:
          "Google Ads customerId is required. Please select or provide a Google Ads account.",
      });
    }

    // 5) Validate Campaign Payload
    if (!campaign || typeof campaign !== "object") {
      return res.status(400).json({
        ok: false,
        step: "validation",
        message: "campaign object is required.",
      });
    }

    const campaignName = campaign.name || `GabbarInfo AI Search - ${Date.now()}`;
    const dailyBudgetMicros =
      typeof campaign.dailyBudgetMicros === "number"
        ? campaign.dailyBudgetMicros
        : typeof campaign.dailyBudget === "number"
        ? campaign.dailyBudget * 1000000
        : 1000000000; // default ₹1,000/day

    const finalUrl = campaign.finalUrl || "https://ai.gabbarinfo.com";

    // 6) Execute Campaign Creation via Google Ads API (always PAUSED)
    const result = await createFullGoogleAdsCampaign({
      refreshToken: refreshTokenToUse,
      customerId: cleanId,
      campaign: {
        ...campaign,
        name: campaignName,
        dailyBudgetMicros,
        finalUrl,
      },
      adGroups: Array.isArray(adGroups) ? adGroups : [],
    });

    if (!result.ok) {
      console.error("Google Ads Campaign Creation Failed:", result);
      return res.status(500).json({
        ok: false,
        step: result.step || "google_ads_api",
        message: result.message || "Failed to create campaign in Google Ads.",
        error: result.error,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Campaign created successfully in Google Ads in PAUSED status.",
      campaignId: result.campaignId,
      campaignName: result.campaignName,
      status: "PAUSED",
      budgetId: result.budgetId,
      customerId: result.customerId,
      adGroups: result.adGroups,
      details: result,
    });
  } catch (err) {
    console.error("Unhandled error in create-simple-campaign:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error while handling Google Ads campaign creation.",
      error: String(err.message || err),
    });
  }
}
