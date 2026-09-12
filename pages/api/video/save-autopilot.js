// pages/api/video/save-autopilot.js
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
    return res.status(401).json({ ok: false, error: "Please log in to configure Autopilot." });
  }

  const { enabled = true, channels = ["instagram", "facebook", "youtube"], cadence = "daily", niche = "Business" } = req.body;

  try {
    const configPayload = {
      enabled,
      channels,
      cadence,
      niche,
      updatedAt: new Date().toISOString(),
    };

    const { error } = await supabase.from("agent_memory").upsert(
      {
        email: userEmail,
        memory_type: "reels_autopilot",
        content: JSON.stringify(configPayload),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,memory_type" }
    );

    if (error) throw error;

    return res.status(200).json({
      ok: true,
      message: `Reels Autopilot configured! System will publish to: ${channels.join(", ")}.`,
      config: configPayload,
    });
  } catch (err) {
    console.error("[Reels Autopilot Config] Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
