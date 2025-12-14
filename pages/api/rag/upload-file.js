// pages/api/rag/upload-file.js

export const config = {
  api: {
    bodyParser: false,
  },
};

import formidable from "formidable";
import fs from "fs";

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

    if (!file || !file.filepath) {
      return res.status(400).json({
        ok: false,
        message: "File path missing",
      });
    }

    // Read file safely (no streams)
    const buffer = fs.readFileSync(file.filepath);

    // Call process-file
    const processRes = await fetch(
      `${process.env.NEXTAUTH_URL}/api/rag/process-file`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.originalFilename || "unknown",
          mimetype: file.mimetype || "application/octet-stream",
          size: buffer.length,
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

    return res.status(200).json({
      ok: true,
      message: "File uploaded successfully",
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
