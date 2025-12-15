import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";
import pdf from "pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: { bodyParser: false },
};

/* ---------------- SUPABASE ---------------- */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ---------------- GEMINI ---------------- */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({
  model: "models/text-embedding-004",
});

/* ---------------- API ---------------- */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = formidable({ multiples: false, keepExtensions: true });

  try {
    const { files, fields } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    /* -------- FORMIDABLE v3 FIX (IMPORTANT) -------- */
    const uploadedFile = Array.isArray(files.file)
      ? files.file[0]
      : files.file;

    if (!uploadedFile || !uploadedFile.filepath) {
      return res.status(400).json({ error: "Invalid uploaded file" });
    }

    /* -------- ONLY PDF ALLOWED -------- */
    if (uploadedFile.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Only PDF supported" });
    }

    /* -------- READ PDF SAFELY -------- */
    let extractedText = "";
    try {
      const buffer = fs.readFileSync(uploadedFile.filepath);
      const parsed = await pdf(buffer);
      extractedText = parsed.text;
    } catch (e) {
      return res
        .status(400)
        .json({ error: "PDF parse failed (corrupt or unsupported PDF)" });
    }

    if (!extractedText || extractedText.trim().length < 30) {
      return res.status(400).json({ error: "Empty PDF content" });
    }

    /* -------- EMBEDDING -------- */
    const embedResult = await embedModel.embedContent(extractedText);
    const embedding = embedResult.embedding.values;

    /* -------- FORCE GLOBAL MEMORY ONLY -------- */
    const { error } = await supabase.from("global_memory").insert({
      content: extractedText,
      embedding,
      created_by: "admin",
    });

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return res.status(500).json({
      error: err.message || "Upload failed",
    });
  }
}
