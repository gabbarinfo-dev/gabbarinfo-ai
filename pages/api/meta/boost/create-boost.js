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
        const url = `https://graph.facebook.com/v19.0/${adAccountId}/promoted_posts`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        return res.status(response.status).json(result);
    } catch (err) {
        console.error("Create boost error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

