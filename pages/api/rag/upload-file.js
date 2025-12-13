// pages/api/rag/upload-file.js

// MUST BE FIRST — disable Next.js body parser for uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

import formidable from "formidable";
import fs from "fs";
import { supabaseServer } from "../../../lib/supabaseServer";

const form = formidable({ multiples: false });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const clientId = fields.clientId;
    const file = files.file;

    if (!clientId || !file) {
      return res.status(400).json({ ok: false, message: "Missing clientId or file" });
    }

    const filePath = file.filepath;
    const fileName = file.originalFilename;

    const storagePath = `client_${clientId}/${fileName}`;
    const fileBuffer = fs.readFileSync(filePath);

    const { error: uploadErr } = await supabaseServer.storage
      .from("knowledge-base")
      .upload(storagePath, fileBuffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadErr) {
      return res.status(500).json({ ok: false, message: "Storage error", error: uploadErr });
    }

    const { error: linkErr } = await supabaseServer
      .from("memory_links")
      .insert({
        client_id: clientId,
        storage_path: storagePath,
      });

    if (linkErr) {
      return res.status(500).json({ ok: false, message: "DB insert error", error: linkErr });
    }

    return res.status(200).json({
      ok: true,
      message: "File uploaded + memory link created",
      path: storagePath,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Server error",
      error: err.message,
    });
  }
}
