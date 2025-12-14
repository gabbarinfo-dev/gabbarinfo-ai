// pages/api/rag/upload-file.js

export const config = {
  api: { bodyParser: false },
};

import formidable from "formidable";
import fs from "fs";
import path from "path";

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

    const uploadedFile = files.file;
    if (!uploadedFile || !uploadedFile.filepath) {
      return res.status(400).json({ ok: false, message: "File path missing" });
    }

    const buffer = fs.readFileSync(uploadedFile.filepath);

    const payload = {
      original_name: uploadedFile.originalFilename || "uploaded-file",
      mime_type: uploadedFile.mimetype || "application/octet-stream",
      memory_type: String(fields.memory_type || "global"),
      client_email: fields.client_email || null,
      save_file: String(fields.save_file || "no"),
      buffer_base64: buffer.toString("base64"),
    };

    const baseUrl = `https://${req.headers.host}`;

    const processRes = await fetch(`${baseUrl}/api/rag/process-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await processRes.json();

    if (!processRes.ok) {
      return res.status(500).json({
        ok: false,
        message: "process-file failed",
        error: data,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Upload + processing successful",
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
