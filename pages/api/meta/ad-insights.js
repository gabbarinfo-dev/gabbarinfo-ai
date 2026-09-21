import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ ok: false, message: "Only POST allowed." });
    }

    try {
        const session = await getServerSession(req, res, authOptions);
        const userEmail = session?.user?.email || req.body?.userEmail;
        if (!userEmail) {
            return res.status(401).json({ ok: false, message: "Not authenticated" });
        }

        const normEmail = userEmail.toLowerCase().trim();

        // 1. Get Meta connection details for specific brand or active connection
        const targetBusiness = req.body?.businessName;
        let adAccountId = req.body?.adAccountId;
        let userAccessToken = null;

        if (targetBusiness) {
            const normBiz = String(targetBusiness).toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
            const { data: brandMem } = await supabaseServer
                .from("agent_memory")
                .select("content")
                .ilike("email", normEmail)
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

        const { data: meta } = await supabaseServer
            .from("meta_connections")
            .select("fb_ad_account_id, fb_user_access_token")
            .ilike("email", normEmail)
            .maybeSingle();

        adAccountId = adAccountId || meta?.fb_ad_account_id;
        userAccessToken = userAccessToken || meta?.fb_user_access_token;

        if (!userAccessToken) {
            return res.status(400).json({ ok: false, message: "Meta access token not found. Please reconnect Meta." });
        }

        // Fetch accessible ad accounts on this token in case needed for switching
        let accessibleAdAccounts = [];
        try {
            const myAds = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,currency&access_token=${userAccessToken}`).then(r => r.json());
            accessibleAdAccounts = myAds.data || [];
        } catch (_) {}

        if (!adAccountId) {
            if (accessibleAdAccounts.length > 0) {
                adAccountId = accessibleAdAccounts[0].id;
            } else {
                return res.status(200).json({
                    ok: false,
                    code: "NO_AD_ACCOUNT",
                    message: "No Ad Account connected for this profile.",
                    accessibleAdAccounts: []
                });
            }
        }

        const rawAdAccountId = adAccountId;
        const normalizedId = rawAdAccountId.replace(/^act_/, '');
        const adAccountNode = `act_${normalizedId}`;

        // 2. Fetch Ad Account Details (name, currency) using user's token
        const accountRes = await fetch(
            `https://graph.facebook.com/v21.0/${adAccountNode}?fields=name,currency&access_token=${userAccessToken}`
        );
        const accountJson = await accountRes.json();

        if (accountJson.error) {
            console.warn(`[Ad Insights] Account query warning (${adAccountNode}):`, accountJson.error.message);
            return res.status(200).json({
                ok: false,
                code: accountJson.error.code === 200 ? "PERMISSION_REQUIRED" : "GRAPH_ERROR",
                message: accountJson.error.message,
                adAccountNode,
                accessibleAdAccounts
            });
        }

        // 3. Fetch Latest Campaign
        const campaignRes = await fetch(
            `https://graph.facebook.com/v21.0/${adAccountNode}/campaigns?limit=5&fields=name&access_token=${userAccessToken}`
        );
        const campaignJson = await campaignRes.json();

        if (campaignJson.error) {
            return res.status(200).json({
                ok: false,
                code: campaignJson.error.code === 200 ? "PERMISSION_REQUIRED" : "GRAPH_ERROR",
                message: campaignJson.error.message,
                adAccountNode,
                account_name: accountJson.name,
                accessibleAdAccounts
            });
        }

        if (!campaignJson.data || campaignJson.data.length === 0) {
            return res.json({
                ok: true,
                data: {
                    account_name: accountJson.name,
                    account_id: adAccountNode,
                    currency: accountJson.currency,
                    campaign_name: null,
                    impressions: 0,
                    reach: 0
                },
                accessibleAdAccounts,
                message: "No active campaigns found in this ad account."
            });
        }

        const campaignId = campaignJson.data[0].id;
        const campaignName = campaignJson.data[0].name;

        // 4. Fetch Campaign Insights (Lifetime)
        const insightsRes = await fetch(
            `https://graph.facebook.com/v21.0/${campaignId}/insights?fields=impressions,reach&period=lifetime&access_token=${userAccessToken}`
        );
        const insightsJson = await insightsRes.json();

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
                impressions,
                reach
            },
            accessibleAdAccounts
        });

    } catch (err) {
        console.error("❌ Ad Insights API Error:", err.message);
        return res.status(200).json({
            ok: false,
            code: "SERVER_ERROR",
            message: err.message || "Failed to fetch ad insights data."
        });
    }
}
