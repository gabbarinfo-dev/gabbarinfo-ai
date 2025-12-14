// pages/api/rag/upload-file.js

import formidable from "formidable";
import fs from "fs";
import { supabaseServer } from "../../../lib/supabaseServer";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: { bodyParser: false },
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({
  model: "models/text-embedding-004",
});

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ success: false, message: "Method not allowed" });

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ success: false, message: "Upload error" });

    const memoryType = fields.memory_type;
    const clientEmail = fields.client_email || null;

    if (memoryType === "client" && !clientEmail) {
      return res.status(400).json({
        success: false,
        message: "Client email required for client memory.",
      });
    }

    const file = files.file;
    const raw = fs.readFileSync(file.filepath, "utf8");

    // EMBED
    const embed = await embedModel.embedContent(raw);
    const vector = embed.embedding.values;

    // SAVE
    const { error } = await supabaseServer
      .from("knowledge_base")
      .insert({
        content: raw,
        embedding: vector,
        memory_type: memoryType,
        client_email: clientEmail,
      });

    if (error)
      return res.status(500).json({ success: false, message: "DB insert failed", error });

    return res.json({ success: true, message: "File uploaded & stored." });
  });
}
