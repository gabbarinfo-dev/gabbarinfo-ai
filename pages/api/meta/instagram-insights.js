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

        // 1. Get Meta connection details (ig_business_id)
        const { data: meta, error } = await supabaseServer
            .from("meta_connections")
            .select("ig_business_id, fb_user_access_token")
            .eq("email", session.user.email.toLowerCase())
            .maybeSingle();

        if (error || !meta?.ig_business_id) {
            return res.status(404).json({ ok: false, message: "Meta connection or Instagram Business ID not found." });
        }

        const igBusinessId = meta.ig_business_id;
        // Existing project token pattern: Use system token if available, else user token
        const accessToken = process.env.META_SYSTEM_USER_TOKEN || meta.fb_user_access_token;

        if (!accessToken) {
            return res.status(400).json({ ok: false, message: "Meta access token not found." });
        }

        // 2. Fetch Instagram Basic Metrics (name, followers_count, media_count)
        const apiRes = await fetch(
            `https://graph.facebook.com/v21.0/${igBusinessId}?fields=name,username,followers_count,media_count&access_token=${accessToken}`
        );
        const data = await apiRes.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        return res.json({
            ok: true,
            data: {
                name: data.name || data.username || "Instagram Account",
                id: igBusinessId,
                followers_count: data.followers_count || 0,
                media_count: data.media_count || 0
            }
        });

    } catch (err) {
        console.error("❌ Instagram Insights API Error:", err.message);
        return res.status(500).json({
            ok: false,
            message: err.message || "Failed to fetch Instagram insights data."
        });
    }
}
