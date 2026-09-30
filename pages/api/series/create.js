// pages/api/series/create.js
// Creates or updates an Episodic Series in Supabase agent_memory
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
    return res.status(401).json({ ok: false, error: "Please log in to manage series." });
  }

  const {
    id = null,
    title = "Untitled Series",
    visualAesthetic = "pixar_3d",
    synopsis = "",
    coreCharacters = [], // [{ id, name, archetype, voice }]
  } = req.body;

  if (!title.trim()) {
    return res.status(400).json({ ok: false, error: "Series title is required." });
  }

  const seriesId = id || "series_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const memoryKey = `client_series_${seriesId}`;

  const seriesData = {
    id: seriesId,
    title: title.trim(),
    visualAesthetic,
    synopsis: synopsis.trim(),
    coreCharacters,
    totalEpisodes: 0,
    episodes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("agent_memory")
      .upsert(
        {
          email: userEmail,
          memory_type: memoryKey,
          content: JSON.stringify(seriesData),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,memory_type" }
      );

    if (error) throw error;

    return res.status(200).json({ ok: true, series: seriesData });
  } catch (err) {
    console.error("[SeriesCreate] Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
