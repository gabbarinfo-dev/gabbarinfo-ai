// pages/api/rag/upload-file.js

export const config = {
  api: { bodyParser: false },
};

import formidable from "formidable";
import fs from "fs";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }

  try {
    // 1. Parse form
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = formidable({ multiples: false });
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = files.file;
    const memoryType = String(fields.memory_type || "").toLowerCase();
    const clientEmail = fields.client_email || null;

    if (!file) {
      return res.status(400).json({ ok: false, message: "No file received" });
    }

    if (!["global", "client"].includes(memoryType)) {
      return res.status(400).json({ ok: false, message: "Invalid memory_type" });
    }

    if (memoryType === "client" && !clientEmail) {
      return res.status(400).json({ ok: false, message: "client_email required" });
    }

    // 2. Upload directly to Supabase (STREAM — no buffer)
    const originalName = file.originalFilename || "file";
    const mimeType = file.mimetype || "application/octet-stream";
    const safeName = originalName.replace(/\s+/g, "_");
    const filePath = `kb/${Date.now()}_${safeName}`;

    const stream = fs.createReadStream(file.filepath);

    const { error: uploadErr } = await supabaseServer.storage
      .from("knowledge-base")
      .upload(filePath, stream, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadErr) {
      return res.status(500).json({
        ok: false,
        message: "Supabase upload failed",
        error: uploadErr.message,
      });
    }

    // 3. Call process-file
    const processRes = await fetch(
      `${process.env.NEXTAUTH_URL}/api/rag/process-file`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: memoryType.toUpperCase(), // GLOBAL | CLIENT
          client_email: memoryType === "client" ? clientEmail : null,
          file_path: filePath,
          original_name: originalName,
          mime_type: mimeType,
        }),
      }
    );

    const processData = await processRes.json();

    if (!processRes.ok) {
      return res.status(500).json({
        ok: false,
        message: "Processing failed",
        error: processData,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "File uploaded & processed successfully",
      file_path: filePath,
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error in upload-file",
      error: err.message,
    });
  }
}
