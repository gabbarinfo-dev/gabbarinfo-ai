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

        // 1. Get Meta connection details (ig_business_id) for specific brand or active
        const targetBusiness = req.body?.businessName;
        let igBusinessId = req.body?.igBusinessId;
        let accessToken = null;

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
                    igBusinessId = igBusinessId || parsed.igId;
                    accessToken = parsed.userToken || parsed.pageToken;
                } catch (_) {}
            }
        }

        const { data: meta, error } = await supabaseServer
            .from("meta_connections")
            .select("ig_business_id, fb_user_access_token")
            .eq("email", session.user.email.toLowerCase())
            .maybeSingle();

        igBusinessId = igBusinessId || meta?.ig_business_id;
        accessToken = accessToken || meta?.fb_user_access_token;

        if (!igBusinessId) {
            return res.status(404).json({ ok: false, message: "Meta connection or Instagram Business ID not found for this profile." });
        }

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
                name: data.name || "Instagram Account",
                username: data.username || null,
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
