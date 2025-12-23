import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }

  const { campaign, adset, creative } = req.body || {};
  if (!campaign || !adset || !creative) {
    return res.status(400).json({
      ok: false,
      message: "campaign, adset and creative payload required",
    });
  }

  const { data: meta, error } = await supabase
    .from("meta_connections")
    .select("fb_ad_account_id, system_user_token")
    .eq("email", session.user.email.toLowerCase())
    .single();

  if (error || !meta) {
    return res.status(400).json({
      ok: false,
      message: "Meta connection not found",
    });
  }

  const AD_ACCOUNT_ID = meta.fb_ad_account_id;
  const ACCESS_TOKEN = meta.system_user_token;

  const base = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}`;

  let campaignId, adsetId, creativeId, adId;

  try {
    // 1️⃣ Campaign (PAUSED)
    const campaignRes = await fetch(`${base}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...campaign,
        status: "PAUSED",
        access_token: ACCESS_TOKEN,
      }),
    });

    const campaignJson = await campaignRes.json();
    if (!campaignRes.ok) throw campaignJson;
    campaignId = campaignJson.id;

    // 2️⃣ Ad Set (PAUSED)
    const adsetRes = await fetch(`${base}/adsets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...adset,
        campaign_id: campaignId,
        status: "PAUSED",
        access_token: ACCESS_TOKEN,
      }),
    });

    const adsetJson = await adsetRes.json();
    if (!adsetRes.ok) throw adsetJson;
    adsetId = adsetJson.id;

    // 3️⃣ Creative
    const creativeRes = await fetch(`${base}/adcreatives`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...creative,
        access_token: ACCESS_TOKEN,
      }),
    });

    const creativeJson = await creativeRes.json();
    if (!creativeRes.ok) throw creativeJson;
    creativeId = creativeJson.id;

    // 4️⃣ Ad (PAUSED)
    const adRes = await fetch(`${base}/ads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Gabbarinfo AI Ad",
        adset_id: adsetId,
        creative: { creative_id: creativeId },
        status: "PAUSED",
        access_token: ACCESS_TOKEN,
      }),
    });

    const adJson = await adRes.json();
    if (!adRes.ok) throw adJson;
    adId = adJson.id;

    return res.json({
      ok: true,
      campaignId,
      adsetId,
      creativeId,
      adId,
    });
  } catch (err) {
    // 🔄 ROLLBACK (BEST EFFORT)
    const rollback = async (endpoint, id) => {
      if (!id) return;
      try {
        await fetch(`https://graph.facebook.com/v19.0/${id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: ACCESS_TOKEN }),
        });
      } catch (_) {}
    };

    await rollback("ads", adId);
    await rollback("adcreatives", creativeId);
    await rollback("adsets", adsetId);
    await rollback("campaigns", campaignId);

    console.error("META EXECUTION FAILED:", err);

    return res.status(500).json({
      ok: false,
      message: "Meta execution failed. All created assets rolled back.",
      details: err,
    });
  }
}
