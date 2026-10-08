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

  try {
    const { error } = await supabaseServer
      .from("agent_memory")
      .delete()
      .eq("email", email)
      .eq("memory_type", "linkedin_connection");

    if (error) {
      console.error("[LinkedIn Disconnect Error]:", error);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(200).json({ ok: true, message: "LinkedIn account disconnected successfully." });
  } catch (err) {
    console.error("[LinkedIn Disconnect Catch]:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
