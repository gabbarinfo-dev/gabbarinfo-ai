// pages/api/character/delete.js
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
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const { characterId } = req.body;

  if (!characterId) {
    return res.status(400).json({ ok: false, error: "Missing character ID." });
  }

  try {
    const { data: rows, error: fetchErr } = await supabase
      .from("agent_memory")
      .select("id, content")
      .eq("email", userEmail)
      .eq("memory_type", "client_character");

    if (fetchErr) throw fetchErr;

    let targetRowId = null;
    for (const r of (rows || [])) {
      try {
        const c = typeof r.content === "string" ? JSON.parse(r.content) : r.content;
        if (c.id === characterId || r.id === characterId) {
          targetRowId = r.id;
          break;
        }
      } catch {}
    }

    if (!targetRowId) {
      return res.status(404).json({ ok: false, error: "Character not found." });
    }

    const { error: delErr } = await supabase
      .from("agent_memory")
      .delete()
      .eq("id", targetRowId)
      .eq("email", userEmail);

    if (delErr) throw delErr;

    console.log(`[CharacterDelete] Successfully deleted character "${characterId}" for ${userEmail}`);
    return res.status(200).json({ ok: true, deletedId: characterId });
  } catch (err) {
    console.error("[CharacterDelete] Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
