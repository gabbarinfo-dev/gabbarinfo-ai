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

    const file = files.file;
    if (!file) {
      return res.status(400).json({ ok: false, message: "No file received" });
    }

    const memoryType = String(fields.memory_type || "").toUpperCase(); // GLOBAL | CLIENT
    const clientEmail = fields.client_email || null;
    const saveFile = String(fields.save_file || "yes"); // yes | no

    if (!["GLOBAL", "CLIENT"].includes(memoryType)) {
      return res.status(400).json({ ok: false, message: "Invalid memory type" });
    }

    if (memoryType === "CLIENT" && !clientEmail) {
      return res.status(400).json({ ok: false, message: "Client email required" });
    }

    // ✅ ALWAYS read buffer safely
    const buffer = fs.readFileSync(file.filepath);
    const originalName = file.originalFilename || "uploaded_file";
    const mimeType = file.mimetype || "application/octet-stream";

    // -------------------------
    // OPTIONAL: Upload to Supabase
    // -------------------------
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

    // -------------------------
    // CALL PROCESS FILE
    // -------------------------
    const processRes = await fetch(
      `${process.env.NEXTAUTH_URL}/api/rag/process-file`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: memoryType,
          client_email: memoryType === "CLIENT" ? clientEmail : null,
          save_file: saveFile,
          file_path: filePath, // null if save=no
          original_name: originalName,
          mime_type: mimeType,
          buffer: buffer.toString("base64"), // ✅ ALWAYS send buffer
        }),
      }
    );

    const result = await processRes.json();

    if (!processRes.ok) {
      return res.status(500).json({
        ok: false,
        message: "Processing failed",
        error: result,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "File uploaded & processed successfully",
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
