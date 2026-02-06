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
    const { page_id, post_id, goal, daily_budget, duration } = req.body;
    if (!page_id || !post_id) {
        return res.status(400).json({ error: "Missing required fields" });
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

        const { system_user_token, fb_ad_account_id } = data;
        const token = system_user_token || process.env.META_SYSTEM_USER_TOKEN;

        if (!token) {
            return res.status(400).json({ error: "System user token missing" });
        }

        if (!fb_ad_account_id) {
            return res.status(400).json({ error: "Ad account ID missing" });
        }

        const payload = {
            object_story_id: `${page_id}_${post_id}`,
            goal: goal || "PAGE_POST_ENGAGEMENT",
            budget_type: "DAILY",
            daily_budget: daily_budget || 500,
            duration: duration || 5,
            targeting: {
                geo_locations: {
                    countries: ["IN"]
                }
            },
            access_token: token
        };

        // Ensure ad account ID has 'act_' prefix
        const adAccountId = fb_ad_account_id.startsWith("act_") ? fb_ad_account_id : `act_${fb_ad_account_id}`;

        // 1. Create Campaign
        const campaignUrl = `https://graph.facebook.com/v21.0/${adAccountId}/campaigns`;
        const campaignRes = await fetch(campaignUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: `Boost_Post_${post_id}_${Date.now()}`,
                objective: "POST_ENGAGEMENT",
                special_ad_categories: [], // Must be an empty array
                status: "PAUSED",
                access_token: token
            }),
        });
        const campaignData = await campaignRes.json();
        if (campaignData.error) throw new Error(`Campaign error: ${campaignData.error.message}`);
        const campaignId = campaignData.id;

        // 2. Create AdSet
        const adSetUrl = `https://graph.facebook.com/v21.0/${adAccountId}/adsets`;
        // Convert to ISO 8601 strings (required by some versions/flows)
        const startTime = new Date().toISOString();
        const endDt = new Date();
        endDt.setDate(endDt.getDate() + (duration || 7));
        const endTime = endDt.toISOString();

        const adSetRes = await fetch(adSetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: `AdSet_Boost_${post_id}`,
                campaign_id: campaignId,
                promoted_object: { page_id: page_id }, // Required for Page Post boosts
                optimization_goal: "POST_ENGAGEMENT",
                billing_event: "IMPRESSIONS",
                bid_strategy: "LOWEST_COST_WITHOUT_CAP",
                daily_budget: Math.max(100, (daily_budget || 500) * 100), // Min 100 units
                start_time: startTime,
                end_time: endTime,
                targeting: { geo_locations: { countries: ["IN"] } },
                status: "PAUSED",
                access_token: token
            }),
        });
        const adSetData = await adSetRes.json();
        if (adSetData.error) throw new Error(`AdSet error: ${adSetData.error.message}`);
        const adSetId = adSetData.id;

        // 3. Create AdCreative
        const creativeUrl = `https://graph.facebook.com/v21.0/${adAccountId}/adcreatives`;
        const creativeRes = await fetch(creativeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: `Creative_Boost_${post_id}`,
                object_story_id: `${page_id}_${post_id}`,
                access_token: token
            }),
        });
        const creativeData = await creativeRes.json();
        if (creativeData.error) throw new Error(`Creative error: ${creativeData.error.message}`);
        const creativeId = creativeData.id;

        // 4. Create Ad
        const adUrl = `https://graph.facebook.com/v21.0/${adAccountId}/ads`;
        const adRes = await fetch(adUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: `Ad_Boost_${post_id}`,
                adset_id: adSetId,
                creative: { creative_id: creativeId },
                status: "PAUSED",
                access_token: token
            }),
        });
        const adData = await adRes.json();
        if (adData.error) throw new Error(`Ad error: ${adData.error.message}`);

        return res.status(200).json({
            success: true,
            id: adData.id,
            campaign_id: campaignId,
            adset_id: adSetId,
            creative_id: creativeId
        });
    } catch (err) {
        console.error("Create boost error:", err.message);
        return res.status(500).json({ error: err.message || "Internal server error" });
    }
}
