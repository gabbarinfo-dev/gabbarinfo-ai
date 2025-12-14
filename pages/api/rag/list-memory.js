// pages/api/rag/list-memory.js

import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  try {
    const page = parseInt(req.query.page || "1", 10) || 1;
    const pageSize = parseInt(req.query.page_size || "10", 10) || 10;
    const offset = (page - 1) * pageSize;

    // fetch global and client memories separately (we'll combine)
    const [{ data: gdata, error: gerr }, { data: cdata, error: cerr }] = await Promise.all([
      supabaseServer
        .from("global_memory")
        .select("*")
        .order("id", { ascending: false })
        .range(offset, offset + pageSize - 1),
      supabaseServer
        .from("client_memory")
        .select("*")
        .order("id", { ascending: false })
        .range(offset, offset + pageSize - 1),
    ]);

    if (gerr && cerr) {
      return res.status(500).json({ success: false, message: "DB error", error: { gerr, cerr } });
    }

    // combine - simple approach: merge arrays (caller can paginate UI-side)
    const items = [
      ...(gdata || []).map((r) => ({ ...r, table: "global" })),
      ...(cdata || []).map((r) => ({ ...r, table: "client" })),
    ];

    // get total counts for both tables
    const [{ count: gc }, { count: cc }] = await Promise.all([
      supabaseServer.from("global_memory").select("id", { count: "exact", head: true }),
      supabaseServer.from("client_memory").select("id", { count: "exact", head: true }),
    ]);

    const total = (gc || 0) + (cc || 0);

    return res.status(200).json({ success: true, items, total });
  } catch (err) {
    console.error("list-memory error", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
}
