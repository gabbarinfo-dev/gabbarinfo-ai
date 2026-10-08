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

    // If we have an access token, dynamically fetch creator_info to get the real avatar & privacy levels
    if (conn.accessToken && (!conn.user?.avatarUrl || !conn.privacyOptions)) {
      try {
        const creatorRes = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${conn.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        const creatorData = await creatorRes.json();
        if (creatorData.data) {
          const cd = creatorData.data;
          conn.user = {
            ...conn.user,
            avatarUrl: cd.creator_avatar_url || conn.user?.avatarUrl,
            displayName: cd.creator_nickname || cd.creator_username || conn.user?.displayName,
            username: cd.creator_username,
          };
          conn.privacyOptions = cd.privacy_level_options || ["SELF_ONLY"];

          // Persist updated profile info
          await supabaseServer.from("agent_memory").upsert(
            {
              email,
              memory_type: "tiktok_connection",
              content: JSON.stringify(conn),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "email,memory_type" }
          );
        }
      } catch (cErr) {
        console.warn("[TikTok Creator Info Query Warn]:", cErr);
      }
    }

    return res.status(200).json({
      ok: true,
      connected: true,
      openId: conn.openId,
      user: conn.user || {},
      privacyOptions: conn.privacyOptions || ["SELF_ONLY"],
      connectedAt: conn.connectedAt,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
