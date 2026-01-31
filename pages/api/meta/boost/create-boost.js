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

  const email = session.user.email;
  const { page_id, post_id, daily_budget = 500, duration = 7 } = req.body;

  if (!page_id || !post_id) {
    return res.status(400).json({ error: "Missing page or post" });
  }

  try {
    const { data } = await supabaseServer
      .from("meta_connections")
      .select("system_user_token, fb_ad_account_id")
      .eq("email", email)
      .single();

    if (!data?.fb_ad_account_id) {
      return res.status(400).json({ error: "Ad account not connected" });
    }

    const token = data.system_user_token || process.env.META_SYSTEM_USER_TOKEN;
    const adAccountId = data.fb_ad_account_id.startsWith("act_")
      ? data.fb_ad_account_id
      : `act_${data.fb_ad_account_id}`;

    /* =======================
       1️⃣ CREATE CAMPAIGN
    ======================= */
    const campaignRes = await fetch(
      `https://graph.facebook.com/v19.0/${adAccountId}/campaigns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Boosted Page Post (Engagement)",
          objective: "POST_ENGAGEMENT",
          status: "PAUSED",
          access_token: token,
        }),
      }
    );

    const campaign = await campaignRes.json();
    if (!campaign.id) {
      return res.status(400).json(campaign);
    }

    /* =======================
       2️⃣ CREATE AD SET
    ======================= */
    const adSetRes = await fetch(
      `https://graph.facebook.com/v19.0/${adAccountId}/adsets`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Boost Ad Set",
          campaign_id: campaign.id,
          daily_budget: daily_budget * 100,
          billing_event: "IMPRESSIONS",
          optimization_goal: "POST_ENGAGEMENT",
          bid_strategy: "LOWEST_COST_WITHOUT_CAP",
          targeting: {
            geo_locations: { countries: ["IN"] },
          },
          status: "PAUSED",
          access_token: token,
        }),
      }
    );

    const adSet = await adSetRes.json();
    if (!adSet.id) {
      return res.status(400).json(adSet);
    }

    /* =======================
       3️⃣ CREATE CREATIVE
    ======================= */
    const creativeRes = await fetch(
      `https://graph.facebook.com/v19.0/${adAccountId}/adcreatives`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object_story_id: `${page_id}_${post_id}`,
          access_token: token,
        }),
      }
    );

    const creative = await creativeRes.json();
    if (!creative.id) {
      return res.status(400).json(creative);
    }

    /* =======================
       4️⃣ CREATE AD
    ======================= */
    const adRes = await fetch(
      `https://graph.facebook.com/v19.0/${adAccountId}/ads`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Boosted Post Ad",
          adset_id: adSet.id,
          creative: { creative_id: creative.id },
          status: "PAUSED",
          access_token: token,
        }),
      }
    );

    const ad = await adRes.json();
    if (!ad.id) {
      return res.status(400).json(ad);
    }

    return res.json({
      success: true,
      campaign_id: campaign.id,
      adset_id: adSet.id,
      ad_id: ad.id,
    });
  } catch (err) {
    console.error("BOOST ERROR:", err);
    return res.status(500).json({ error: "Boost failed" });
  }
}
