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
  const email = session?.user?.email?.toLowerCase().trim();
  if (!email) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const { mode } = req.body || {};

  try {
    // Purge Google Ads draft state completely
    await supabase
      .from("agent_memory")
      .delete()
      .eq("email", email)
      .eq("memory_type", "google_ads_state");

    console.log(`[Agent Reset] Cleared draft campaign memory for ${email} (switched to mode: ${mode || "general"})`);

    return res.status(200).json({
      ok: true,
      message: "Campaign draft cache purged successfully",
    });
  } catch (err) {
    console.error("[Agent Reset] Error purging draft memory:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
