// pages/api/youtube/status.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.query?.userEmail;

  if (!userEmail) {
    return res.status(200).json({ connected: false, reason: "No session" });
  }

  try {
    const { data: mem, error } = await supabase
      .from("agent_memory")
      .select("content, updated_at")
      .eq("email", userEmail)
      .eq("memory_type", "youtube_account")
      .maybeSingle();

    if (error || !mem?.content) {
      return res.status(200).json({ connected: false });
    }

    const parsed = typeof mem.content === "string" ? JSON.parse(mem.content) : mem.content;

    if (!parsed?.channelId || (!parsed?.accessToken && !parsed?.refreshToken)) {
      return res.status(200).json({ connected: false });
    }

    return res.status(200).json({
      connected: true,
      channel: {
        channelId: parsed.channelId,
        title: parsed.title || "YouTube Channel",
        customUrl: parsed.customUrl || "",
        thumbnail: parsed.thumbnail || "",
        subscriberCount: parsed.subscriberCount || "0",
        connectedAt: parsed.connectedAt || mem.updated_at
      }
    });
  } catch (err) {
    console.error("[YouTube Status] Error:", err);
    return res.status(500).json({ connected: false, error: err.message });
  }
}
