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
    const { page_id } = req.body;

    if (!page_id) {
        return res.status(400).json({ error: "page_id is required" });
    }

    try {
        const { data, error } = await supabaseServer
            .from("meta_connections")
            .select("fb_page_access_token")
            .eq("email", email)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: "Meta connection not found" });
        }

        const { fb_page_access_token } = data;

        if (!fb_page_access_token) {
            return res.status(400).json({ error: "Page access token missing" });
        }

        const url = `https://graph.facebook.com/v19.0/${page_id}/posts?fields=id,message,created_time,is_eligible_for_promotion&limit=3`;

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${fb_page_access_token}`,
            },
        });

        const result = await response.json();

        if (result.error) {
            return res.status(500).json({ error: result.error.message });
        }

        const filteredPosts = (result.data || []).filter(post => post.is_eligible_for_promotion === true);

        return res.status(200).json({ posts: filteredPosts });
    } catch (err) {
        console.error("List posts error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
