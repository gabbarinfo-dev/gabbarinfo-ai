// pages/api/rag/upload-file.js

// ✅ VERY IMPORTANT — force Node.js runtime
export const runtime = "nodejs";

// Disable Next.js body parser (required for formidable)
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
    // Parse form data
    // --------------------------
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = formidable({ multiples: false });
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const memoryType = fields.memory_type; // "global" | "client"
    const clientEmail = fields.client_email || null;
    const saveFile = fields.save_file || "no"; // "yes" | "no"
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
        message: "client_email is required for client memory",
      });
    }

    // --------------------------------
    // CASE 1: DO NOT SAVE PHYSICAL FILE
    // --------------------------------
    if (saveFile === "no") {
      return res.status(200).json({
        ok: true,
        message: "File received. Ready for processing (not stored).",
        file_path: null,
        save_file: "no",
      });
    }

    // --------------------------------
    // CASE 2: SAVE FILE TO SUPABASE
    // --------------------------------
    const localPath = file.filepath;
    const originalName = file.originalFilename;
    const safeName = originalName.replace(/\s+/g, "_");
    const bucketPath = `${Date.now()}_${safeName}`;

    const buffer = fs.readFileSync(localPath);

    const { error: uploadErr } = await supabaseServer.storage
      .from("knowledge-base")
      .upload(bucketPath, buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadErr) {
      console.error("SUPABASE UPLOAD ERROR:", uploadErr);
      return res.status(500).json({
        ok: false,
        message: "Failed to upload file to Supabase",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "File uploaded successfully",
      file_path: bucketPath,
      save_file: "yes",
    });

  } catch (err) {
    console.error("UPLOAD API CRASH:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error",
    });
  }
}
