// pages/api/rag/upload-file.js

export const config = {
  api: {
    bodyParser: false,
  },
};

import formidable from "formidable";
import fs from "fs";
import path from "path";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = formidable({
        multiples: false,
        keepExtensions: true,
      });

      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const memoryType = fields.memory_type;
    const clientEmail = fields.client_email || null;
    const saveFile = fields.save_file || "no";
    const file = files.file;

    if (!memoryType || !file) {
      return res.status(400).json({
        ok: false,
        message: "Missing memory_type or file",
      });
    }

    if (memoryType === "client" && !clientEmail) {
      return res.status(400).json({
        ok: false,
        message: "client_email required for client memory",
      });
    }

    // ------------------------------
    // SAFE filename handling (FIX)
    // ------------------------------
    const safeOriginalName =
      file.originalFilename ||
      file.newFilename ||
      `upload_${Date.now()}`;

    const cleanName = safeOriginalName
      .toString()
      .replace(/[^a-zA-Z0-9.\-_]/g, "_");

    const bucketPath = `${Date.now()}_${cleanName}`;

    // --------------------------------
    // If NOT saving physical file
    // --------------------------------
    if (saveFile === "no") {
      return res.status(200).json({
        ok: true,
        message: "File received. Ready for processing.",
        file_path: null,
        save_file: "no",
      });
    }

    // --------------------------------
    // Save file to Supabase
    // --------------------------------
    const buffer = fs.readFileSync(file.filepath);

    const { error: uploadErr } = await supabaseServer.storage
      .from("knowledge-base")
      .upload(bucketPath, buffer, {
        contentType: file.mimetype || "application/octet-stream",
        upsert: true,
      });

    if (uploadErr) {
      return res.status(500).json({
        ok: false,
        message: "Supabase upload failed",
        error: uploadErr.message,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "File uploaded successfully",
      file_path: bucketPath,
      save_file: "yes",
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error",
      error: err.message,
    });
  }
}
