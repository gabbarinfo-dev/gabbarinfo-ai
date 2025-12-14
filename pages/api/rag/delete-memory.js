// pages/api/rag/delete-memory.js

export const runtime = "nodejs";

import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Only POST allowed" });
  }

  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Memory ID required",
      });
    }

    // ---------------- TRY DELETE FROM GLOBAL ----------------
    const { error: globalErr } = await supabaseServer
      .from("global_memory")
      .delete()
      .eq("id", id);

    // ---------------- TRY DELETE FROM CLIENT ----------------
    const { error: clientErr } = await supabaseServer
      .from("client_memory")
      .delete()
      .eq("id", id);

    if (globalErr && clientErr) {
      console.error("DELETE ERROR:", globalErr || clientErr);
      return res.status(500).json({
        success: false,
        message: "Failed to delete memory",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Memory deleted successfully",
    });
  } catch (err) {
    console.error("DELETE MEMORY CRASH:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}
