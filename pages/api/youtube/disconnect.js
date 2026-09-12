// pages/api/youtube/disconnect.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.body?.userEmail;

  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Not logged in" });
  }

  try {
    await supabase
      .from("agent_memory")
      .delete()
      .eq("email", userEmail)
      .eq("memory_type", "youtube_account");

    return res.status(200).json({ ok: true, message: "YouTube account disconnected successfully" });
  } catch (err) {
    console.error("[YouTube Disconnect] Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
