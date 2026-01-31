import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseServer } from "../../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const email = session.user.email;
  const { page_id, post_id, daily_budget = 500, duration = 7 } = req.body;

  if (!page_id || !post_id) {
    return res.status(400).json({ error: "Missing page or post" });
  }

  try {
    const { data, error } = await supabaseServer
      .from("meta_connections")
      .select("system_user_token, fb_ad_account_id")
      .eq("email", email)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Meta connection not found" });
    }

    const token = data.system_user_token || process.env.META_SYSTEM_USER_TOKEN;
    const adAccountId = data.fb_ad_account_id?.startsWith("act_")
      ? data.fb_ad_account_id
      : `act_${data.fb_ad_account_id}`;

    if (!token || !adAccountId) {
      return res.status(400).json({ error: "Meta setup incomplete" });
    }

    // STEP 1: Campaign
    const campaignRes = await fetch(
      `https://graph.facebook.com/v19.0/${adAccountId}/campaigns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          name: "Boosted Post Campaign",
          objective: "POST_ENGAGEMENT",
          status: "PAUSED",
          access_token: token,
        }),
      }
    );

    const campaign = await campaignRes.json();
    if (!campaign.id) return res.status(400).json(campaign);

    // STEP 2: Ad Set
    const adsetRes = await fetch(
      `https://graph.facebook.com/v19.0/${adAccountId}/adsets`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          name: "Boosted Post AdSet",
          campaign_id: campaign.id,
          daily_budget: daily_budget * 100,
          billing_event: "IMPRESSIONS",
          optimization_goal: "POST_ENGAGEMENT",
          bid_strategy: "LOWEST_COST_WITHOUT_CAP",
          targeting: JSON.stringify({
            geo_locations: { countries: ["IN"] },
          }),
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + duration * 86400000).toISOString(),
          status: "PAUSED",
          access_token: token,
        }),
      }
    );

    const adset = await adsetRes.json();
    if (!adset.id) return res.status(400).json(adset);

    // STEP 3: Creative
    const creativeRes = await fetch(
      `https://graph.facebook.com/v19.0/${adAccountId}/adcreatives`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          object_story_id: `${page_id}_${post_id}`,
          access_token: token,
        }),
      }
    );

    const creative = await creativeRes.json();
    if (!creative.id) return res.status(400).json(creative);

    // STEP 4: Ad
    const adRes = await fetch(
      `https://graph.facebook.com/v19.0/${adAccountId}/ads`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          name: "Boosted Post Ad",
          adset_id: adset.id,
          creative: JSON.stringify({ creative_id: creative.id }),
          status: "PAUSED",
          access_token: token,
        }),
      }
    );

    const ad = await adRes.json();
    return res.status(200).json({
      success: true,
      campaign_id: campaign.id,
      adset_id: adset.id,
      ad_id: ad.id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
