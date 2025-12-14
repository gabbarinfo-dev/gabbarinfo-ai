export const config = {
  api: { bodyParser: false },
};

import formidable from "formidable";
import fs from "fs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = formidable({ multiples: false });
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const uploaded =
      Array.isArray(files.file) ? files.file[0] : files.file;

    if (!uploaded || !uploaded.filepath) {
      return res.status(400).json({
        ok: false,
        message: "File not received properly",
      });
    }

    const buffer = fs.readFileSync(uploaded.filepath);

    const processRes = await fetch(
      `${process.env.NEXTAUTH_URL}/api/rag/process-file`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: (fields.memory_type || "global").toUpperCase(),
          client_email: fields.client_email || null,
          filename: uploaded.originalFilename || "file",
          mime_type: uploaded.mimetype || "application/octet-stream",
          content_base64: buffer.toString("base64"),
        }),
      }
    );

    const data = await processRes.json();

    if (!processRes.ok) {
      return res.status(500).json({
        ok: false,
        message: "Process failed",
        error: data,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Upload successful",
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error in upload-file",
    });
  }
}
