// pages/api/linkedin/status.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;

  if (!email) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const { data, error } = await supabaseServer
      .from("agent_memory")
      .select("content, updated_at")
      .eq("email", email)
      .eq("memory_type", "linkedin_connection")
      .maybeSingle();

    if (error) {
      console.error("[LinkedIn Status Error]:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    if (!data?.content) {
      return res.status(200).json({ ok: true, connected: false });
    }

    let parsed = null;
    try {
      parsed = JSON.parse(data.content);
    } catch (_) {}

    const hasMemberToken = Boolean(parsed?.accessToken);
    const hasPageToken = Boolean(parsed?.pageAccessToken);

    if (!hasMemberToken && !hasPageToken) {
      return res.status(200).json({ ok: true, connected: false });
    }

    return res.status(200).json({
      ok: true,
      connected: true,
      isMemberConnected: hasMemberToken,
      isPageConnected: hasPageToken,
      member: parsed?.member || null,
      organizations: parsed?.organizations || [],
      connectedAt: parsed?.connectedAt || parsed?.pageConnectedAt || data.updated_at,
    });
  } catch (err) {
    console.error("[LinkedIn Status Catch]:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
