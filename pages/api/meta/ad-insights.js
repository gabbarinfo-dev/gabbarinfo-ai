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

        // 1. Get Meta connection details for specific brand or active connection
        const targetBusiness = req.body?.businessName;
        let adAccountId = req.body?.adAccountId;
        let userAccessToken = null;

        if (targetBusiness) {
            const normBiz = String(targetBusiness).toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
            const { data: brandMem } = await supabaseServer
                .from("agent_memory")
                .select("content")
                .eq("email", session.user.email.toLowerCase())
                .eq("memory_type", `meta_conn_${normBiz}`)
                .maybeSingle();

            if (brandMem?.content) {
                try {
                    const parsed = JSON.parse(brandMem.content);
                    adAccountId = adAccountId || parsed.adAccountId;
                    userAccessToken = parsed.userToken || parsed.pageToken;
                } catch (_) {}
            }
        }

        const { data: meta, error } = await supabaseServer
            .from("meta_connections")
            .select("fb_ad_account_id, fb_user_access_token")
            .eq("email", session.user.email.toLowerCase())
            .maybeSingle();

        adAccountId = adAccountId || meta?.fb_ad_account_id;
        userAccessToken = userAccessToken || meta?.fb_user_access_token;

        if (!adAccountId) {
            return res.status(404).json({ ok: false, message: "No Ad Account connected for this profile." });
        }

        const rawAdAccountId = adAccountId;
        const normalizedId = rawAdAccountId.replace(/^act_/, '');
        const adAccountNode = `act_${normalizedId}`;

        // Prioritize user's OAuth token because they own/manage the Ad Account
        const accessToken = userAccessToken || process.env.META_SYSTEM_USER_TOKEN;

        if (!accessToken) {
            return res.status(400).json({ ok: false, message: "Meta access token not found. Please reconnect Meta." });
        }

        // 2. Fetch Ad Account Details (name, currency)
        const accountRes = await fetch(
            `https://graph.facebook.com/v21.0/${adAccountNode}?fields=name,currency&access_token=${accessToken}`
        );
        const accountJson = await accountRes.json();

        if (accountJson.error) {
            throw new Error(accountJson.error.message);
        }

        // 3. Fetch Latest Campaign
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
                data: {
                    account_name: accountJson.name,
                    account_id: adAccountNode,
                    currency: accountJson.currency,
                    campaign_name: null
                },
                message: "No campaigns found for this ad account."
            });
        }

        const campaignId = campaignJson.data[0].id;
        const campaignName = campaignJson.data[0].name;

        // 4. Fetch Campaign Insights (Lifetime)
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
                account_name: accountJson.name,
                account_id: adAccountNode,
                currency: accountJson.currency,
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
