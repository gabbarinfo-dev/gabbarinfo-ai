import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseServer } from "../../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const { data, error } = await supabaseServer
      .from("meta_connections")
      .select("system_user_token, fb_page_id")
      .eq("email", email)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Meta connection not found" });
    }

    const { system_user_token, fb_page_id } = data;
    const token = system_user_token || process.env.META_SYSTEM_USER_TOKEN;

    if (!token) {
      return res.status(400).json({ error: "System user token missing" });
    }

    const response = await fetch("https://graph.facebook.com/v19.0/me/accounts", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    // Filter ONLY pages whose ID exists in fb_page_id
    // fb_page_id could be a single ID or comma-separated
    const allowedIds = fb_page_id ? fb_page_id.split(",").map(id => id.trim()) : [];
    
    const filteredPages = (result.data || []).filter(page => allowedIds.includes(page.id));

    return res.status(200).json({ pages: filteredPages });
  } catch (err) {
    console.error("List pages error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
