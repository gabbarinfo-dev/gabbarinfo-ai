// pages/api/rag/delete-memory.js

import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Only POST allowed",
    });
  }

  try {
    const { id, mode } = req.body;

    if (!id || !mode) {
      return res.status(400).json({
        success: false,
        message: "Missing id or mode (GLOBAL | CLIENT)",
      });
    }

    let tableName = "";

    if (mode === "GLOBAL") {
      tableName = "global_memory";
    } else if (mode === "CLIENT") {
      tableName = "client_memory";
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid mode",
      });
    }

    // DELETE ROW
    const { error: deleteErr } = await supabaseServer
      .from(tableName)
      .delete()
      .eq("id", id);

    if (deleteErr) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete",
        error: deleteErr,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Memory deleted successfully.",
      id,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
}
