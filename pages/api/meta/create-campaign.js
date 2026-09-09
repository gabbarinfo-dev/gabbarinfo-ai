// pages/api/meta/create-campaign.js
// ADMIN-ONLY • ACTIVE CAMPAIGN • REAL META API
// Uses stored Meta system user token + ad account from Supabase

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import { reserveQuota, commitQuota, releaseQuota } from "../../../lib/billing/quota-service";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed." });
  }

  try {
    // ---------------------------
    // 1) AUTH + PLAN ENTITLEMENT & QUOTA CHECK
    // ---------------------------
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }

    const userEmail = (session.user.email || "").toLowerCase().trim();
    const { businessId = null } = req.body || {};

    // ---------------------------
    // 2) FETCH META CONNECTION FOR ASSET LOCKING
    // ---------------------------
    const { data: conn, error: connErr } = await supabase
      .from("meta_connections")
      .select("fb_ad_account_id")
      .eq("email", userEmail)
      .maybeSingle();

    const adAccountId = conn?.fb_ad_account_id || null;

    const quotaRes = await reserveQuota({
      session,
      userEmail,
      businessId,
      actionType: "META_CAMPAIGN",
      assetId: adAccountId,
    });

    if (!quotaRes.ok) {
      return res.status(quotaRes.code === "FEATURE_NOT_INCLUDED" ? 403 : 402).json({
        ok: false,
        code: quotaRes.code,
        message: quotaRes.error,
        planId: quotaRes.planId,
        nextResetDate: quotaRes.nextResetDate,
      });
    }

    if (connErr || !conn) {
      return res.status(400).json({
        ok: false,
        message: "Meta account not connected for this user",
      });
    }

    const ACCESS_TOKEN = process.env.META_SYSTEM_USER_TOKEN;
    const AD_ACCOUNT_ID = conn.fb_ad_account_id;

    // ---------------------------
    // 3) INPUT
    // ---------------------------
    const {
      name,
      objective,
      dailyBudget,
      specialAdCategories,
    } = req.body || {};

    if (!name) {
      return res.status(400).json({
        ok: false,
        message: "Campaign name is required",
      });
    }

    const finalObjective = objective || "TRAFFIC";
    const finalStatus = "ACTIVE"; // ✅ Campaigns go live immediately on creation

    let dailyBudgetMinor = null;
    if (dailyBudget !== undefined && dailyBudget !== null) {
      const num = Number(dailyBudget);
      if (!Number.isFinite(num) || num <= 0) {
        return res.status(400).json({
          ok: false,
          message: "dailyBudget must be a positive number",
        });
      }
      dailyBudgetMinor = Math.round(num * 100);
    }

    // ---------------------------
    // 4) META API CALL
    // ---------------------------
    const url = `https://graph.facebook.com/v21.0/act_${AD_ACCOUNT_ID}/campaigns`;

    const params = new URLSearchParams();
    params.append("name", name);
    params.append("objective", finalObjective);
    params.append("status", finalStatus);
    params.append(
      "special_ad_categories",
      JSON.stringify(specialAdCategories || [])
    );

    if (dailyBudgetMinor !== null) {
      params.append("daily_budget", String(dailyBudgetMinor));
    }

    params.append("access_token", ACCESS_TOKEN);

    const fbRes = await fetch(url, {
      method: "POST",
      body: params,
    });

    const fbJson = await fbRes.json().catch(() => ({}));

    if (!fbRes.ok) {
      if (quotaRes?.reservationId) {
        await releaseQuota({
          reservationId: quotaRes.reservationId,
          businessId: quotaRes.businessId,
          cycleStart: quotaRes.cycleStart,
          actionType: "META_CAMPAIGN",
          reason: "Meta API error",
        });
      }
      return res.status(400).json({
        ok: false,
        message: "Meta API error while creating campaign",
        fbStatus: fbRes.status,
        fbResponse: fbJson,
      });
    }

    // ---------------------------
    // 5) SUCCESS & COMMIT QUOTA
    // ---------------------------
    if (quotaRes?.reservationId) {
      await commitQuota({
        reservationId: quotaRes.reservationId,
        businessId: quotaRes.businessId,
        cycleStart: quotaRes.cycleStart,
        actionType: "META_CAMPAIGN",
        userEmail,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Active Meta campaign created successfully",
      campaignId: fbJson.id,
      ad_account_id: `act_${AD_ACCOUNT_ID}`,
      fbResponse: fbJson,
    });
  } catch (err) {
    console.error("META CREATE CAMPAIGN ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error while creating Meta campaign",
      error: err.message || String(err),
    });
  }
}
