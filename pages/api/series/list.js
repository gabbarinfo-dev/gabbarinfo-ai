// pages/api/series/list.js
// Lists all Episodic Series created by the user from Supabase agent_memory
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
    return res.status(200).json({ ok: true, series: [] });
  }

  try {
    const { data, error } = await supabase
      .from("agent_memory")
      .select("memory_type, content, updated_at")
      .eq("email", userEmail)
      .ilike("memory_type", "client_series_%")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const series = (data || [])
      .map((row) => {
        try {
          const parsed = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
          return {
            dbMemoryType: row.memory_type,
            updatedAt: row.updated_at,
            ...parsed,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return res.status(200).json({ ok: true, series });
  } catch (err) {
    console.error("[SeriesList] Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
