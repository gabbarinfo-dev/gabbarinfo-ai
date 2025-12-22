// pages/api/meta/create-campaign.js
// ADMIN-ONLY • PAUSED CAMPAIGN • REAL META API
// Uses stored Meta system user token + ad account from Supabase

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

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
    // 1) AUTH + ADMIN CHECK
    // ---------------------------
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }

    const ADMIN_EMAILS = ["ndantare@gmail.com"];
    const isAdmin = ADMIN_EMAILS.includes(
      (session.user.email || "").toLowerCase()
    );

    if (!isAdmin) {
      return res.status(403).json({
        ok: false,
        message: "Only admin can execute Meta campaigns",
      });
    }

    // ---------------------------
    // 2) FETCH META CONNECTION
    // ---------------------------
    const { data: conn, error } = await supabase
      .from("meta_connections")
      .select("system_user_token, fb_ad_account_id")
      .eq("email", session.user.email.toLowerCase())
      .single();

    if (error || !conn) {
      return res.status(400).json({
        ok: false,
        message: "Meta account not connected for this user",
      });
    }

    const ACCESS_TOKEN = conn.system_user_token;
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
    const finalStatus = "PAUSED"; // 🔒 HARD LOCK

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

    if (!fbRes.ok || fbJson.error) {
      return res.status(400).json({
        ok: false,
        message: "Meta API error while creating campaign",
        fbStatus: fbRes.status,
        fbResponse: fbJson,
      });
    }

    // ---------------------------
    // 5) SUCCESS
    // ---------------------------
    return res.status(200).json({
      ok: true,
      message: "Paused Meta campaign created (admin test)",
      campaignId: fbJson.id,
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
