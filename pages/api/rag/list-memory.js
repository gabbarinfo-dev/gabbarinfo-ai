// pages/api/rag/list-memory.js

export const runtime = "nodejs";

import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Only GET allowed" });
  }

  try {
    // ---------------- GLOBAL MEMORY ----------------
    const { data: globalData, error: globalErr } = await supabaseServer
      .from("global_memory")
      .select("id, title, type, created_at")
      .order("created_at", { ascending: false });

    if (globalErr) throw globalErr;

    // ---------------- CLIENT MEMORY ----------------
    const { data: clientData, error: clientErr } = await supabaseServer
      .from("client_memory")
      .select("id, title, type, client_email, created_at")
      .order("created_at", { ascending: false });

    if (clientErr) throw clientErr;

    // ---------------- MERGE + NORMALIZE ----------------
    const items = [
      ...(globalData || []).map((m) => ({
        id: m.id,
        title: m.title,
        type: m.type,
        client_email: "GLOBAL",
        created_at: m.created_at,
      })),
      ...(clientData || []).map((m) => ({
        id: m.id,
        title: m.title,
        type: m.type,
        client_email: m.client_email,
        created_at: m.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.status(200).json({
      success: true,
      items,
    });
  } catch (err) {
    console.error("LIST MEMORY ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}
