// pages/api/rag/upload-file.js

export const config = {
  api: { bodyParser: false },
};

import formidable from "formidable";
import fs from "fs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }

  try {
    const form = formidable({
      multiples: false,
      keepExtensions: true,
    });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    // ---------- FILE ----------
    const uploadedFile = Array.isArray(files.file)
      ? files.file[0]
      : files.file;

    if (!uploadedFile || !uploadedFile.filepath) {
      return res.status(400).json({
        ok: false,
        message: "File not received correctly",
      });
    }

    const buffer = fs.readFileSync(uploadedFile.filepath);

    // ---------- SAFE FIELD NORMALIZATION ----------
    const memoryTypeRaw = Array.isArray(fields.memory_type)
      ? fields.memory_type[0]
      : fields.memory_type;

    const saveFileRaw = Array.isArray(fields.save_file)
      ? fields.save_file[0]
      : fields.save_file;

    const clientEmailRaw = Array.isArray(fields.client_email)
      ? fields.client_email[0]
      : fields.client_email;

    const memoryType = (memoryTypeRaw || "global").toLowerCase(); // global | client
    const saveFile = (saveFileRaw || "yes").toLowerCase(); // yes | no
    const clientEmail = clientEmailRaw || null;

    if (!["global", "client"].includes(memoryType)) {
      return res.status(400).json({ ok: false, message: "Invalid memory type" });
    }

    if (memoryType === "client" && !clientEmail) {
      return res.status(400).json({ ok: false, message: "Client email required" });
    }

    // ---------- CALL PROCESS FILE ----------
    const processRes = await fetch(
      `${process.env.NEXTAUTH_URL}/api/rag/process-file`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: memoryType.toUpperCase(), // GLOBAL | CLIENT
          client_email: memoryType === "client" ? clientEmail : null,
          original_name: uploadedFile.originalFilename || "uploaded_file",
          mime_type: uploadedFile.mimetype || "application/octet-stream",
          buffer: buffer.toString("base64"), // ✅ ALWAYS PRESENT
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
