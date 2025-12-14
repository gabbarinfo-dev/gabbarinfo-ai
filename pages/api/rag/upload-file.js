// pages/api/rag/upload-file.js

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
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = formidable({ multiples: false });
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = files?.file;
    const memoryTypeRaw = fields?.memory_type?.[0] || fields?.memory_type;
    const clientEmail = fields?.client_email?.[0] || fields?.client_email || null;
    const saveFile = fields?.save_file?.[0] || fields?.save_file || "no";

    if (!file || !memoryTypeRaw) {
      return res.status(400).json({
        ok: false,
        message: "Missing file or memory_type",
      });
    }

    const memoryType = memoryTypeRaw.toUpperCase(); // SAFE

    if (memoryType === "CLIENT" && !clientEmail) {
      return res.status(400).json({
        ok: false,
        message: "client_email required for client memory",
      });
    }

    // ---- NO PHYSICAL SAVE ----
    if (saveFile === "no") {
      return res.status(200).json({
        ok: true,
        message: "File received. Processing without saving file.",
        file_path: null,
        mode: memoryType,
        client_email: clientEmail,
        save_file: "no",
      });
    }

    // ---- SAVE FILE ----
    const buffer = fs.readFileSync(file.filepath);
    const safeName = file.originalFilename.replace(/\s+/g, "_");
    const filePath = `${Date.now()}_${safeName}`;

    const { error } = await supabaseServer.storage
      .from("knowledge-base")
      .upload(filePath, buffer, {
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
      file_path: filePath,
      mode: memoryType,
      client_email: clientEmail,
      save_file: "yes",
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
