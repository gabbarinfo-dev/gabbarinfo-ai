// pages/api/rag/upload-file.js

// Disable Next.js default body parser (required for formidable)
export const config = {
  api: {
    bodyParser: false,
  },
};

import formidable from "formidable";
import fs from "fs";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }

  try {
    // --------------------------
    // Parse form data (file + fields)
    // --------------------------
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = formidable({ multiples: false });

      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const memoryType = fields.memory_type; // "GLOBAL" or "CLIENT"
    const clientEmail = fields.client_email || null;
    const saveFile = fields.save_file || "no"; // "yes" | "no"
    const file = files.file;

    if (!memoryType || !file) {
      return res.status(400).json({
        ok: false,
        message: "Missing memory_type or file.",
      });
    }

    if (memoryType === "client" && !clientEmail) {
      return res.status(400).json({
        ok: false,
        message: "client_email is required for client memory.",
      });
    }

    // --------------------------------
    // Case 1: Do NOT save physical file
    // --------------------------------
    if (saveFile === "no") {
      return res.status(200).json({
        ok: true,
        message: "File received (NOT stored). Ready for text extraction.",
        file_path: null, // Important → tells process-file.js to skip download
      });
    }

    // --------------------------------
    // Case 2: Save file in Supabase
    // --------------------------------
    const localPath = file.filepath;
    const originalName = file.originalFilename;
    const bucketPath = `${Date.now()}_${originalName}`;

    const buffer = fs.readFileSync(localPath);

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
