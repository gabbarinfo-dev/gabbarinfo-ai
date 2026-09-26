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

  const { mode, brandKey } = req.body || {};

  try {
    // 1. Purge ephemeral draft states from agent_memory table
    const deletePromises = [
      supabase.from("agent_memory").delete().eq("email", email).eq("memory_type", "google_ads_state"),
      supabase.from("agent_memory").delete().eq("email", email).like("memory_type", "campaign_visual_%"),
      supabase.from("agent_memory").delete().eq("email", email).like("memory_type", "meta_draft_%"),
      supabase.from("agent_memory").delete().eq("email", email).like("memory_type", "social_draft_%"),
      supabase.from("agent_memory").delete().eq("email", email).like("memory_type", "post_draft_%"),
    ];
    await Promise.allSettled(deletePromises);

    // 2. Atomically wipe all in-flight campaign_state from client memory profile
    const { data: clientMem } = await supabase
      .from("agent_memory")
      .select("content")
      .eq("email", email)
      .eq("memory_type", "client")
      .maybeSingle();

    if (clientMem?.content) {
      try {
        const content = typeof clientMem.content === "string" ? JSON.parse(clientMem.content) : clientMem.content;
        let modified = false;

        if (content.campaign_state) {
          delete content.campaign_state;
          modified = true;
        }

        if (content.business_answers && typeof content.business_answers === "object") {
          for (const k of Object.keys(content.business_answers)) {
            if (content.business_answers[k]?.campaign_state) {
              delete content.business_answers[k].campaign_state;
              modified = true;
            }
          }
        }

        if (modified) {
          await supabase
            .from("agent_memory")
            .update({
              content: JSON.stringify(content),
              updated_at: new Date().toISOString(),
            })
            .eq("email", email)
            .eq("memory_type", "client");
        }
      } catch (pErr) {
        console.warn("[Agent Reset] Note cleaning client memory:", pErr.message);
      }
    }

    console.log(`🧹 [Agent Reset] Completely purged all draft campaign state & visual cache for ${email} (switched to mode: ${mode || "general"})`);

    return res.status(200).json({
      ok: true,
      message: "Campaign draft cache & in-flight state purged instantaneously",
    });
  } catch (err) {
    console.error("[Agent Reset] Error purging draft memory:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
