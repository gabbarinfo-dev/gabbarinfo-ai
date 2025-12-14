// pages/api/rag/list-memory.js

import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  try {
    // ---------------------------
    // FETCH GLOBAL MEMORY
    // ---------------------------
    const { data: globalData, error: globalErr } = await supabaseServer
      .from("global_memory")
      .select("*")
      .order("id", { ascending: false });

    if (globalErr) {
      return res.status(500).json({
        success: false,
        message: "Failed to load global memory.",
        error: globalErr,
      });
    }

    // ---------------------------
    // FETCH CLIENT MEMORY
    // ---------------------------
    const { data: clientData, error: clientErr } = await supabaseServer
      .from("client_memory")
      .select("*")
      .order("id", { ascending: false });

    if (clientErr) {
      return res.status(500).json({
        success: false,
        message: "Failed to load client memory.",
        error: clientErr,
      });
    }

    // ---------------------------
    // COMBINE BOTH
    // ---------------------------
    const combined = [
      ...globalData.map((item) => ({
        ...item,
        client_email: null, // Mark as GLOBAL
      })),
      ...clientData,
    ];

    return res.status(200).json({
      success: true,
      items: combined,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error loading memory.",
      error: err.message,
    });
  }
}
