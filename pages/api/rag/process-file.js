// pages/api/rag/process-file.js

import { supabaseServer } from "../../../lib/supabaseServer";
import { extractTextFromFile } from "../../../utils/extractText";
import { embedAndStore } from "../../../lib/embedAndStore";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }

  try {
    const {
      mode,               // GLOBAL | CLIENT
      client_email,
      file_path,
      original_name,
      mime_type,
    } = req.body;

    if (!file_path) {
      return res.status(400).json({
        ok: false,
        message: "file_path missing",
      });
    }

    // 1. Download file from Supabase
    const { data, error } = await supabaseServer.storage
      .from("knowledge-base")
      .download(file_path);

    if (error || !data) {
      return res.status(500).json({
        ok: false,
        message: "Failed to download file",
        error: error?.message,
      });
    }

    const buffer = Buffer.from(await data.arrayBuffer());

    // 2. Extract text
    const text = await extractTextFromFile(buffer, mime_type);

    if (!text || !text.trim()) {
      return res.status(400).json({
        ok: false,
        message: "No text extracted from file",
      });
    }

    // 3. Embed & store
    await embedAndStore({
      text,
      title: original_name,
      mode,
      client_email,
      file_path,
    });

    return res.status(200).json({
      ok: true,
      message: "File processed successfully",
    });
  } catch (err) {
    console.error("PROCESS ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error in process-file",
      error: err.message,
    });
  }
}
