// pages/api/rag/delete-memory.js

import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Only POST allowed" });
  }

  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: "Missing id" });

    // Try delete from client_memory first
    let { error: delErr } = await supabaseServer.from("client_memory").delete().eq("id", id);
    if (!delErr) {
      // find if any row was deleted (supabase returns success even if 0 rows - we can verify by selecting)
      const { data } = await supabaseServer.from("client_memory").select("id").eq("id", id);
      if (!data || data.length === 0) {
        // successfully deleted or model returned no row
        return res.status(200).json({ success: true, message: "Deleted from client_memory (if existed)" });
      }
    }

    // Attempt delete from global_memory
    const { error: delErr2 } = await supabaseServer.from("global_memory").delete().eq("id", id);
    if (!delErr2) {
      return res.status(200).json({ success: true, message: "Deleted from global_memory (if existed)" });
    }

    // If both had errors
    return res.status(500).json({ success: false, message: "Delete failed", error: { delErr, delErr2 } });
  } catch (err) {
    console.error("delete-memory error", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
}
