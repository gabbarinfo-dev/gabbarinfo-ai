// pages/api/linkedin/disconnect.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;

  if (!email) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const { target = "all" } = req.body || {}; // "member", "page", or "all"

  try {
    if (target === "all") {
      const { error } = await supabaseServer
        .from("agent_memory")
        .delete()
        .eq("email", email)
        .eq("memory_type", "linkedin_connection");

      if (error) throw error;
      return res.status(200).json({ ok: true, message: "All LinkedIn connections removed." });
    }

    // Fetch existing connection
    const { data: memRow, error: fetchErr } = await supabaseServer
      .from("agent_memory")
      .select("content")
      .eq("email", email)
      .eq("memory_type", "linkedin_connection")
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!memRow?.content) {
      return res.status(200).json({ ok: true, message: "No active connection found." });
    }

    let conn = {};
    try {
      conn = JSON.parse(memRow.content);
    } catch (_) {}

    if (target === "member") {
      delete conn.accessToken;
      delete conn.refreshToken;
      delete conn.member;
      conn.isMemberConnected = false;
    } else if (target === "page") {
      delete conn.pageAccessToken;
      delete conn.pageRefreshToken;
      delete conn.organizations;
      conn.isPageConnected = false;
    }

    const hasAnyLeft = Boolean(conn.accessToken || conn.pageAccessToken);

    if (!hasAnyLeft) {
      await supabaseServer
        .from("agent_memory")
        .delete()
        .eq("email", email)
        .eq("memory_type", "linkedin_connection");
    } else {
      await supabaseServer
        .from("agent_memory")
        .upsert(
          {
            email,
            memory_type: "linkedin_connection",
            content: JSON.stringify(conn),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email,memory_type" }
        );
    }

    return res.status(200).json({
      ok: true,
      message: `LinkedIn ${target === "member" ? "Personal Profile" : "Company Page"} disconnected successfully.`,
      target,
    });
  } catch (err) {
    console.error("[LinkedIn Disconnect Catch]:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
