// pages/api/rag/upload-file.js

// Disable body parser (required for formidable)
export const config = {
  api: { bodyParser: false },
};

import formidable from "formidable";
import fs from "fs";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }

  try {
    // -----------------------------------------
    // Parse file + fields using formidable
    // -----------------------------------------
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = formidable({ multiples: false });
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const memoryType = (fields.memory_type || "").toLowerCase(); // "global" or "client"
    const clientEmail = fields.client_email || null;
    const saveFile = fields.save_file === "yes" ? "yes" : "no";
    const file = files.file;

    // ------------------------------
    // Validate
    // ------------------------------
    if (!memoryType || !file) {
      return res.status(400).json({
        ok: false,
        message: "Missing memory_type or file.",
      });
    }

    if (memoryType === "client" && !clientEmail) {
      return res.status(400).json({
        ok: false,
        message: "client_email is required for CLIENT memory.",
      });
    }

    // ---------------------------------------------------------
    // CASE A: Do NOT save physical file (only send for extract)
    // ---------------------------------------------------------
    if (saveFile === "no") {
      return res.status(200).json({
        ok: true,
        message: "File received (NOT saved). Proceed with processing.",
        file_path: null, // tells process-file.js that bucket download is NOT needed
      });
    }

    // ---------------------------------------------------------
    // CASE B: Save physical file into Supabase Storage
    // ---------------------------------------------------------
    const localPath = file.filepath;
    const originalName = file.originalFilename;
    const buffer = fs.readFileSync(localPath);

    // Create a clean safe storage path
    const bucketPath = `${Date.now()}_${originalName}`;

    const { error: uploadErr } = await supabaseServer.storage
      .from("knowledge-base")
      .upload(bucketPath, buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadErr) {
      return res.status(500).json({
        ok: false,
        message: "Failed to upload file.",
        error: uploadErr,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "File uploaded successfully.",
      file_path: bucketPath,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Server error.",
      error: err.message,
    });
  }
}
