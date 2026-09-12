// pages/api/character/list.js
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
    return res.status(200).json({ ok: true, characters: [] });
  }

  try {
    const { data, error } = await supabase
      .from("agent_memory")
      .select("id, content, updated_at")
      .eq("email", userEmail)
      .eq("memory_type", "client_character")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const characters = (data || []).map((row) => {
      try {
        const parsed = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
        return {
          dbId: row.id,
          ...parsed,
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    return res.status(200).json({ ok: true, characters });
  } catch (err) {
    console.error("[CharacterList] Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
