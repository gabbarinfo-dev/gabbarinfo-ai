// pages/api/tiktok/disconnect.js
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

  try {
    // 1. Fetch current token to revoke it on TikTok's OAuth servers
    const { data: memRow } = await supabaseServer
      .from("agent_memory")
      .select("content")
      .eq("email", email)
      .eq("memory_type", "tiktok_connection")
      .maybeSingle();

    if (memRow?.content) {
      try {
        const conn = JSON.parse(memRow.content);
        const token = conn.accessToken || conn.refreshToken;
        if (token) {
          const clientKey = "sbawrzibqf32wa91qs";
          const clientSecret = process.env.TIKTOK_SANDBOX_SECRET || "LJGwOhZnUke6YpgYUjYr030CfgxJyvbU";
          const body = new URLSearchParams({
            client_key: clientKey,
            client_secret: clientSecret,
            token,
          }).toString();

          await fetch("https://open.tiktokapis.com/v2/oauth/revoke/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
          });
        }
      } catch (revErr) {
        console.warn("[TikTok Revoke Token Warn]:", revErr);
      }
    }

    // 2. Remove connection from agent_memory
    const { error } = await supabaseServer
      .from("agent_memory")
      .delete()
      .eq("email", email)
      .eq("memory_type", "tiktok_connection");

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(200).json({ ok: true, message: "TikTok account disconnected and OAuth permissions revoked." });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
