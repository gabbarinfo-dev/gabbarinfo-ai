// pages/api/rag/upload-file.js

export const config = {
  api: { bodyParser: false },
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
      fileWriteStreamHandler: () => null, // ⛔ prevent disk write
    });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const memoryType = String(fields.memory_type || "").toLowerCase();
    const clientEmail = fields.client_email || null;
    const saveFile = fields.save_file === "yes" ? "yes" : "no";

    const uploadedFile = files.file;

    if (!uploadedFile) {
      return res.status(400).json({
        ok: false,
        message: "No file received",
      });
    }

    // ✅ Buffer is HERE (this fixes everything)
    const buffer = uploadedFile.toBuffer?.();

    if (!buffer) {
      return res.status(400).json({
        ok: false,
        message: "File buffer missing (Vercel upload issue)",
      });
    }

    // ------------------------------
    // Case: DO NOT SAVE FILE
    // ------------------------------
    if (saveFile === "no") {
      return res.status(200).json({
        ok: true,
        message: "File received (buffer only, not stored)",
        file_path: null,
      });
    }

    // ------------------------------
    // Case: SAVE TO SUPABASE
    // ------------------------------
    const safeName =
      uploadedFile.originalFilename?.replace(/\s+/g, "_") ||
      `upload_${Date.now()}`;

    const filePath = `${Date.now()}_${safeName}`;

    const { error } = await supabaseServer.storage
      .from("knowledge-base")
      .upload(filePath, buffer, {
        contentType: uploadedFile.mimetype || "application/octet-stream",
        upsert: true,
      });

    if (error) {
      return res.status(500).json({
        ok: false,
        message: "Supabase upload failed",
        error: error.message,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "File uploaded successfully",
      file_path: filePath,
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
