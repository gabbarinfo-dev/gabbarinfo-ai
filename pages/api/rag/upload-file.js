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
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = formidable({ multiples: false });
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = files.file;
    if (!file || !file.filepath) {
      return res.status(400).json({
        ok: false,
        message: "File path missing",
      });
    }

    const memoryType = String(fields.memory_type || "global");
    const clientEmail = fields.client_email
      ? String(fields.client_email)
      : null;
    const saveFile = String(fields.save_file || "yes");

    const buffer = fs.readFileSync(file.filepath);
    const originalName = file.originalFilename || "uploaded_file";
    const mimeType = file.mimetype || "application/octet-stream";

    let filePath = null;

    if (saveFile === "yes") {
      const safeName = originalName.replace(/\s+/g, "_");
      filePath = `kb/${Date.now()}_${safeName}`;

      const { error } = await supabaseServer.storage
        .from("knowledge-base")
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        return res.status(500).json({
          ok: false,
          message: "Supabase upload failed",
          error: error.message,
        });
      }
    }

    const processRes = await fetch(
      `${process.env.NEXTAUTH_URL}/api/rag/process-file`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memory_type: memoryType,
          client_email: clientEmail,
          save_file: saveFile,
          file_path: filePath,
          original_name: originalName,
          mime_type: mimeType,
          buffer_base64:
            saveFile === "no" ? buffer.toString("base64") : null,
        }),
      }
    );

    const processData = await processRes.json();

    if (!processRes.ok) {
      return res.status(500).json({
        ok: false,
        message: "Process file failed",
        error: processData,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "File uploaded & processed",
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
