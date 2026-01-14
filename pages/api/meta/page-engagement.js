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

        // 1. Get Meta connection details (fb_page_id and tokens)
        const { data: meta, error } = await supabaseServer
            .from("meta_connections")
            .select("fb_page_id, fb_page_access_token") // 👈 Must use Page Access Token
            .eq("email", session.user.email.toLowerCase())
            .maybeSingle();

        if (error || !meta?.fb_page_id) {
            return res.status(404).json({ ok: false, message: "Meta connection or Facebook Page not found." });
        }

        const pageId = meta.fb_page_id;
        const accessToken = meta.fb_page_access_token; // 👈 STRICT: Use Page Token only

        if (!accessToken) {
            return res.status(400).json({ ok: false, message: "Facebook Page access token not found. Please re-sync your business info." });
        }

        // 2. Fetch Page Basic Metrics (fan_count, followers_count)
        const basicRes = await fetch(
            `https://graph.facebook.com/v21.0/${pageId}?fields=fan_count,followers_count&access_token=${accessToken}`
        );
        const basicJson = await basicRes.json();

        if (basicJson.error) {
            throw new Error(basicJson.error.message);
        }

        // 3. Fetch Page Reach (page_impressions_unique)
        // /v21.0/{page_id}/insights?metric=page_impressions_unique&period=day
        const insightsRes = await fetch(
            `https://graph.facebook.com/v21.0/${pageId}/insights?metric=page_impressions_unique&period=day&access_token=${accessToken}`
        );
        const insightsJson = await insightsRes.json();

        if (insightsJson.error) {
            throw new Error(insightsJson.error.message);
        }

        // Extract latest value from insights
        let reach = 0;
        if (insightsJson.data && insightsJson.data.length > 0) {
            const metric = insightsJson.data.find(m => m.name === "page_impressions_unique");
            if (metric?.values && metric.values.length > 0) {
                // Take the most recent value
                reach = metric.values[metric.values.length - 1].value;
            }
        }

        return res.json({
            ok: true,
            data: {
                fan_count: basicJson.fan_count || 0,
                followers_count: basicJson.followers_count || 0,
                reach: reach
            }
        });

    } catch (err) {
        console.error("❌ Page Engagement API Error:", err.message);
        return res.status(500).json({
            ok: false,
            message: err.message || "Failed to fetch page engagement data."
        });
    }
}
