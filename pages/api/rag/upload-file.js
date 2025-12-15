import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: { bodyParser: false },
};

// ---------- CLIENTS ----------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({
  model: "models/text-embedding-004",
});

// ---------- HELPERS ----------
async function extractTextSafe(filePath, ext) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("Invalid uploaded file");
  }

  if (ext === ".pdf") {
    try {
      const buffer = fs.readFileSync(filePath);
      const data = await pdf(buffer);
      return data.text || "";
    } catch (err) {
      throw new Error("PDF parse failed (corrupt or unsupported PDF)");
    }
  }

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || "";
  }

  throw new Error("Unsupported file type");
}

async function embedText(text) {
  const result = await embedModel.embedContent(text);
  return result.embedding.values;
}

// ---------- API ----------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = formidable({
    keepExtensions: true,
    multiples: false,
  });

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    // ---- FILE NORMALIZATION (IMPORTANT FIX)
    let file = files.file;
    if (Array.isArray(file)) file = file[0];

    if (!file || !file.filepath) {
      return res.status(400).json({ error: "Invalid uploaded file" });
    }

    const filePath = file.filepath;
    const originalName = file.originalFilename || "";
    const ext = path.extname(originalName).toLowerCase();

    if (![".pdf", ".docx"].includes(ext)) {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    const memoryType = fields.memoryType; // "global" | "client"
    const clientEmail = fields.clientEmail || null;

    if (memoryType === "client" && !clientEmail) {
      return res.status(400).json({ error: "Client email required" });
    }

    // ---------- EXTRACT ----------
    const extractedText = await extractTextSafe(filePath, ext);

    if (!extractedText || extractedText.trim().length < 20) {
      return res.status(400).json({ error: "Empty or unreadable document" });
    }

    // ---------- EMBED ----------
    const embedding = await embedText(extractedText);

    // ---------- INSERT MEMORY ----------
    if (memoryType === "global") {
      const { error } = await supabase.from("global_memory").insert({
        content: extractedText,
        embedding,
        created_by: "admin",
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.from("client_memory").insert({
        client_email: clientEmail,
        content: extractedText,
        embedding,
      });
      if (error) throw error;
    }

    // ---------- META LOG (optional but safe)
    await supabase.from("file_uploads").insert({
      file_path: originalName,
      extracted_text_length: extractedText.length,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return res.status(500).json({
      error: err.message || "Upload failed",
    });
  }
}
