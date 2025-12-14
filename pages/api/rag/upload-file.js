// pages/api/rag/upload-file.js

// IMPORTANT: disable body parser for file uploads
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
    // -------------------------------
    // 1. Parse multipart form
    // -------------------------------
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = formidable({ multiples: false });

      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const memoryType = String(fields.memory_type || "").toLowerCase(); // global | client
    const clientEmail = fields.client_email ? String(fields.client_email) : null;
    const saveFile = String(fields.save_file || "yes"); // yes | no
    const file = files.file;

    if (!file) {
      return res.status(400).json({
        ok: false,
        message: "No file received",
      });
    }

    if (!["global", "client"].includes(memoryType)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid memory_type",
      });
    }

    if (memoryType === "client" && !clientEmail) {
      return res.status(400).json({
        ok: false,
        message: "client_email required for client memory",
      });
    }

    // --------------------------------
    // 2. Read file buffer (ALWAYS)
    // --------------------------------
    const localPath = file.filepath;
    const originalName = file.originalFilename || "uploaded_file";
    const mimeType = file.mimetype || "application/octet-stream";

    if (!localPath) {
      return res.status(500).json({
        ok: false,
        message: "File path missing from upload",
      });
    }

    const buffer = fs.readFileSync(localPath);

    // --------------------------------
    // 3. Optionally upload to Supabase
    // --------------------------------
    let filePath = null;

    if (saveFile === "yes") {
      const safeName = originalName.replace(/\s+/g, "_");
      filePath = `kb/${Date.now()}_${safeName}`;

      const { error: uploadErr } = await supabaseServer.storage
        .from("knowledge-base")
        .upload(filePath, buffer, {
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
    }

    // --------------------------------
    // 4. Call process-file API
    // --------------------------------
    const processRes = await fetch(
      `${process.env.NEXTAUTH_URL}/api/rag/process-file`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: memoryType.toUpperCase(), // GLOBAL | CLIENT
          client_email: memoryType === "client" ? clientEmail : null,
          save_file: saveFile,
          file_path: filePath, // null if save=no
          original_name: originalName,
          buffer: saveFile === "no" ? buffer.toString("base64") : null,
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

    // --------------------------------
    // 5. Final success response
    // --------------------------------
    return res.status(200).json({
      ok: true,
      message: "File uploaded & processed successfully",
      saved_file: saveFile === "yes",
      file_path: filePath,
    });

  } catch (err) {
    console.error("UPLOAD API CRASH:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error in upload-file",
      error: err.message,
    });
  }
}
