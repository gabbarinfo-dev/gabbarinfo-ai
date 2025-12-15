import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: { bodyParser: false },
};

/* ------------------ CLIENTS ------------------ */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({
  model: "models/text-embedding-004",
});

/* ------------------ HELPERS ------------------ */
async function extractText(filepath, mimetype) {
  try {
    if (mimetype === "application/pdf") {
      const buffer = fs.readFileSync(filepath);
      const data = await pdf(buffer);
      return data.text || "";
    }

    if (
      mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ path: filepath });
      return result.value || "";
    }

    throw new Error("Unsupported file type");
  } catch (err) {
    throw new Error("PDF parse failed (corrupt or unsupported PDF)");
  }
}

async function embedText(text) {
  const res = await embedModel.embedContent(text);
  return res.embedding.values;
}

/* ------------------ API ------------------ */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = formidable({ keepExtensions: true, multiples: false });

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    /* ---- FIX: formidable returns array ---- */
    const uploaded = Array.isArray(files.file)
      ? files.file[0]
      : files.file;

    if (!uploaded?.filepath) {
      return res.status(400).json({ error: "Invalid uploaded file" });
    }

    const memoryType = fields.memoryType; // "global" | "client"
    const clientEmail = fields.clientEmail || null;

    if (memoryType === "client" && !clientEmail) {
      return res.status(400).json({ error: "Client email required" });
    }

    /* ---------- EXTRACT ---------- */
    const text = await extractText(uploaded.filepath, uploaded.mimetype);

    if (!text || text.trim().length < 30) {
      return res.status(400).json({ error: "Empty or unreadable document" });
    }

    /* ---------- EMBED ---------- */
    const embedding = await embedText(text);

    /* ---------- INSERT MEMORY ---------- */
    if (memoryType === "global") {
      const { error } = await supabase.from("global_memory").insert({
        title: uploaded.originalFilename,
        content: text,
        embedding,
        created_by: "admin",
      });
      if (error) throw error;
    }

    if (memoryType === "client") {
      const { error } = await supabase.from("client_memory").insert({
        client_email: clientEmail,
        title: uploaded.originalFilename,
        content: text,
        embedding,
      });
      if (error) throw error;
    }

    /* ---------- META LOG ---------- */
    await supabase.from("file_uploads").insert({
      file_name: uploaded.originalFilename,
      memory_type: memoryType,
      client_email: clientEmail,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return res.status(500).json({
      error: err.message || "Upload failed",
    });
  }
}
