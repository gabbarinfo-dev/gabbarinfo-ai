export const config = { api: { bodyParser: false } };

import formidable from "formidable";
import fs from "fs";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, message: "POST only" });

  const form = formidable({ multiples: false });
  const { fields, files } = await new Promise((resolve, reject) => {
    form.parse(req, (err, f, fl) => (err ? reject(err) : resolve({ fields: f, files: fl })));
  });

  const file = files.file;
  if (!file) return res.json({ ok: false, message: "File missing" });

  const memoryType = fields.memory_type;
  const clientEmail = fields.client_email;
  const saveFile = fields.save_file;

  const fileBuffer = fs.readFileSync(file.filepath);

  let storagePath = null;

  // Save file only if user selected "yes"
  if (saveFile === "yes") {
    storagePath = `${memoryType}/${Date.now()}-${file.originalFilename}`;
    await supabaseServer.storage
      .from("knowledge-base")
      .upload(storagePath, fileBuffer, { upsert: true });
  }

  // Call PROCESS FILE API
  const processRes = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/rag/process-file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.originalFilename,
      storage_path: storagePath,
      memory_type: memoryType,
      client_email: clientEmail,
      mimetype: file.mimetype
    })
  });

  const result = await processRes.json();
  return res.json(result);
}
