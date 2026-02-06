import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
    try {
        const session = await getServerSession(req, res, authOptions);
        if (!session?.user?.email) {
            return res.status(401).json({ ok: false, message: "Unauthorized" });
        }

        const { data, error } = await supabaseServer
            .from("meta_connections")
            .select("fb_business_id, fb_page_id, fb_ad_account_id")
            .eq("email", session.user.email)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return res.json({
            ok: true,
            fb_business_id: data?.fb_business_id || null,
            fb_page_id: data?.fb_page_id || null,
            fb_ad_account_id: data?.fb_ad_account_id || null,
        });
    } catch (err) {
        return res.status(500).json({
            ok: false,
            error: err.message,
        });
    }
}
