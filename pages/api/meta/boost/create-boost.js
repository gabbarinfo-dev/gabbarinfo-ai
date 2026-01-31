import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseServer } from "../../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { page_id, post_id, daily_budget = 500, duration = 5 } = req.body;

  if (!page_id || !post_id) {
    return res.status(400).json({ error: "Missing page or post" });
  }

  const { data } = await supabaseServer
    .from("meta_connections")
    .select("system_user_token, fb_ad_account_id")
    .eq("email", session.user.email)
    .single();

  if (!data?.system_user_token || !data?.fb_ad_account_id) {
    return res.status(400).json({ error: "Meta account not connected" });
  }

  const token = data.system_user_token;
  const adAccountId = data.fb_ad_account_id.startsWith("act_")
    ? data.fb_ad_account_id
    : `act_${data.fb_ad_account_id}`;

  const graph = "https://graph.facebook.com/v19.0";

  try {
    // 1️⃣ Campaign
    const campaignRes = await fetch(`${graph}/${adAccountId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        name: "Post Boost Campaign",
        objective: "POST_ENGAGEMENT",
        status: "PAUSED",
        access_token: token,
      }),
    });
    const campaign = await campaignRes.json();

    // 2️⃣ Ad Set
    const adsetRes = await fetch(`${graph}/${adAccountId}/adsets`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        name: "Post Boost AdSet",
        campaign_id: campaign.id,
        daily_budget: String(daily_budget * 100),
        billing_event: "IMPRESSIONS",
        optimization_goal: "POST_ENGAGEMENT",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        targeting: JSON.stringify({
          geo_locations: { countries: ["IN"] },
        }),
        promoted_object: JSON.stringify({
          page_id,
        }),
        status: "PAUSED",
        access_token: token,
      }),
    });
    const adset = await adsetRes.json();

    // 3️⃣ Ad (existing post)
    const adRes = await fetch(`${graph}/${adAccountId}/ads`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        name: "Post Boost Ad",
        adset_id: adset.id,
        creative: JSON.stringify({
          object_story_id: `${page_id}_${post_id}`,
        }),
        status: "PAUSED",
        access_token: token,
      }),
    });

    const ad = await adRes.json();

    return res.status(200).json({
      success: true,
      campaign_id: campaign.id,
      adset_id: adset.id,
      ad_id: ad.id,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Boost failed" });
  }
}
