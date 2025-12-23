// pages/api/meta/execute-campaign.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }

  const {
    campaign_settings,
    ad_sets,
    creative,
    imageHash,
  } = req.body || {};

  if (
    !campaign_settings ||
    !ad_sets?.length ||
    !creative ||
    !imageHash
  ) {
    return res.status(400).json({
      ok: false,
      message: "Missing campaign execution payload",
    });
  }

  const { data: meta, error } = await supabase
    .from("meta_connections")
    .select("fb_ad_account_id, system_user_token, fb_page_id")
    .eq("email", session.user.email.toLowerCase())
    .single();

  if (
    error ||
    !meta?.fb_ad_account_id ||
    !meta?.system_user_token ||
    !meta?.fb_page_id
  ) {
    return res.status(400).json({
      ok: false,
      message: "Meta connection incomplete",
    });
  }

  const AD_ACCOUNT_ID = meta.fb_ad_account_id;
  const ACCESS_TOKEN = meta.system_user_token;
  const PAGE_ID = meta.fb_page_id;

  try {
    // =====================
    // 1️⃣ CREATE CAMPAIGN
    // =====================
    const campaignRes = await fetch(
      `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/campaigns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaign_settings.campaign_name,
          objective: campaign_settings.objective,
          status: "PAUSED",
          special_ad_categories: [],
          access_token: ACCESS_TOKEN,
        }),
      }
    );

    const campaign = await campaignRes.json();
    if (!campaign.id) throw campaign;

    // =====================
    // 2️⃣ CREATE AD SET
    // =====================
    const adSetConfig = ad_sets[0];

    const adSetRes = await fetch(
      `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/adsets`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: adSetConfig.ad_set_name,
          campaign_id: campaign.id,
          daily_budget: campaign_settings.budget.amount * 100,
          billing_event: "IMPRESSIONS",
          optimization_goal: "LINK_CLICKS",
          targeting: {
            geo_locations: {
              countries: adSetConfig.targeting.geo_location.country,
            },
          },
          status: "PAUSED",
          access_token: ACCESS_TOKEN,
        }),
      }
    );

    const adset = await adSetRes.json();
    if (!adset.id) throw adset;

    // =====================
    // 3️⃣ CREATE CREATIVE
    // =====================
    const creativeRes = await fetch(
      `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/adcreatives`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "GabbarInfo Creative",
          object_story_spec: {
            page_id: PAGE_ID,
            link_data: {
              image_hash: imageHash,
              link: creative.destination_url,
              message: creative.body_text,
              name: creative.headline,
              call_to_action: {
                type: creative.call_to_action,
                value: {
                  link: creative.destination_url,
                },
              },
            },
          },
          access_token: ACCESS_TOKEN,
        }),
      }
    );

    const creativeObj = await creativeRes.json();
    if (!creativeObj.id) throw creativeObj;

    // =====================
    // 4️⃣ CREATE AD
    // =====================
    const adRes = await fetch(
      `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/ads`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "GabbarInfo Ad",
          adset_id: adset.id,
          creative: { creative_id: creativeObj.id },
          status: "PAUSED",
          access_token: ACCESS_TOKEN,
        }),
      }
    );

    const ad = await adRes.json();
    if (!ad.id) throw ad;

    return res.status(200).json({
      ok: true,
      campaign_id: campaign.id,
      adset_id: adset.id,
      ad_id: ad.id,
    });
  } catch (err) {
    console.error("META EXECUTION ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: err,
    });
  }
}
