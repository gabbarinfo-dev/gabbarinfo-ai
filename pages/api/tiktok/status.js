// pages/api/tiktok/status.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;

  if (!email) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const { data: memRow } = await supabaseServer
      .from("agent_memory")
      .select("content")
      .eq("email", email)
      .eq("memory_type", "tiktok_connection")
      .maybeSingle();

    if (!memRow?.content) {
      return res.status(200).json({ ok: true, connected: false });
    }

    const conn = JSON.parse(memRow.content);
    return res.status(200).json({
      ok: true,
      connected: true,
      openId: conn.openId,
      user: conn.user || {},
      connectedAt: conn.connectedAt,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
