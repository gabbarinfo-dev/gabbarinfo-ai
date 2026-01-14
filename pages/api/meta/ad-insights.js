import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ ok: false, message: "Only POST allowed." });
    }

    try {
        const session = await getServerSession(req, res, authOptions);
        if (!session?.user?.email) {
            return res.status(401).json({ ok: false, message: "Not authenticated" });
        }

        // 1. Get Meta connection details (fb_ad_account_id)
        const { data: meta, error } = await supabaseServer
            .from("meta_connections")
            .select("fb_ad_account_id, fb_user_access_token")
            .eq("email", session.user.email.toLowerCase())
            .maybeSingle();

        if (error || !meta?.fb_ad_account_id) {
            return res.status(404).json({ ok: false, message: "Meta connection or Ad Account ID not found." });
        }

        const rawAdAccountId = meta.fb_ad_account_id;
        const normalizedId = rawAdAccountId.replace(/^act_/, '');
        const adAccountNode = `act_${normalizedId}`;
        // Existing project token pattern: Use system token if available, else user token
        const accessToken = process.env.META_SYSTEM_USER_TOKEN || meta.fb_user_access_token;

        if (!accessToken) {
            return res.status(400).json({ ok: false, message: "Meta access token not found." });
        }

        // 2. Fetch Latest Campaign
        const campaignRes = await fetch(
            `https://graph.facebook.com/v21.0/${adAccountNode}/campaigns?limit=1&fields=name&access_token=${accessToken}`
        );
        const campaignJson = await campaignRes.json();

        if (campaignJson.error) {
            throw new Error(campaignJson.error.message);
        }

        if (!campaignJson.data || campaignJson.data.length === 0) {
            return res.json({
                ok: true,
                data: null,
                message: "No campaigns found for this ad account."
            });
        }

        const campaignId = campaignJson.data[0].id;
        const campaignName = campaignJson.data[0].name;

        // 3. Fetch Campaign Insights (Lifetime)
        const insightsRes = await fetch(
            `https://graph.facebook.com/v21.0/${campaignId}/insights?fields=impressions,reach&period=lifetime&access_token=${accessToken}`
        );
        const insightsJson = await insightsRes.json();

        if (insightsJson.error) {
            throw new Error(insightsJson.error.message);
        }

        let impressions = 0;
        let reach = 0;

        if (insightsJson.data && insightsJson.data.length > 0) {
            impressions = parseInt(insightsJson.data[0].impressions || 0);
            reach = parseInt(insightsJson.data[0].reach || 0);
        }

        return res.json({
            ok: true,
            data: {
                campaign_name: campaignName,
                impressions: impressions,
                reach: reach
            }
        });

    } catch (err) {
        console.error("❌ Ad Insights API Error:", err.message);
        return res.status(500).json({
            ok: false,
            message: err.message || "Failed to fetch ad insights data."
        });
    }
}
