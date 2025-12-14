// pages/api/rag/upload-file.js

export const config = {
  api: {
    bodyParser: false,
  },
};

import formidable from "formidable";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }

  try {
    const form = formidable({
      multiples: false,
      keepExtensions: true,
    });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = files.file;
    const memoryType = fields.memory_type;
    const clientEmail = fields.client_email || null;
    const saveFile = fields.save_file || "no";

    if (!file || !memoryType) {
      return res.status(400).json({
        ok: false,
        message: "Missing file or memory_type",
      });
    }

    // 🔥 IMPORTANT FIX
    // Vercel-safe way to read file
    const buffer = file.buffer;

    if (!buffer) {
      return res.status(400).json({
        ok: false,
        message: "File buffer missing (Vercel upload issue)",
      });
    }

    // -------------------------
    // If NOT saving physical file
    // -------------------------
    if (saveFile === "no") {
      return res.status(200).json({
        ok: true,
        message: "File received (not stored). Ready for processing.",
        file_path: null,
      });
    }

    // -------------------------
    // Save to Supabase Storage
    // -------------------------
    const cleanName = file.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${Date.now()}_${cleanName}`;

    const { error } = await supabaseServer.storage
      .from("knowledge-base")
      .upload(storagePath, buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      return res.status(500).json({
        ok: false,
        message: "Supabase upload failed",
        error,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "File uploaded successfully",
      file_path: storagePath,
    });

  } catch (err) {
    console.error("UPLOAD API CRASH:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error",
      error: err.message,
    });
  }
}
