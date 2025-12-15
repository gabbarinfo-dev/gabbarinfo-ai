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

// ---------- SUPABASE ----------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ---------- GEMINI ----------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({
  model: "models/text-embedding-004",
});

// ---------- TEXT EXTRACTION ----------
async function extractTextSafe(file) {
  const filePath = file.filepath || file.path;
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("Invalid uploaded file");
  }

  const ext = path.extname(file.originalFilename || file.name || "")
    .toLowerCase()
    .trim();

  if (ext === ".pdf") {
    const data = await pdf(fs.readFileSync(filePath));
    return data.text;
  }

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error("Unsupported file type");
}

// ---------- EMBEDDING ----------
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

    // -------- FILE NORMALIZATION --------
    let file = files.file;
    if (Array.isArray(file)) file = file[0];
    if (!file) throw new Error("No file uploaded");

    const memoryType = String(fields.memoryType || "").toLowerCase();
    const clientEmail = fields.clientEmail || null;

    if (memoryType === "client" && !clientEmail) {
      throw new Error("Client email required");
    }

    // -------- EXTRACT --------
    const extractedText = await extractTextSafe(file);

    if (!extractedText || extractedText.trim().length < 30) {
      throw new Error("Empty or unreadable document");
    }

    // -------- EMBED --------
    const embedding = await embedText(extractedText);

    // -------- INSERT MEMORY --------
    if (memoryType === "global") {
      const { error } = await supabase.from("global_memory").insert({
        content: extractedText,
        embedding,
        created_by: "admin",
      });
      if (error) throw error;
    }

    if (memoryType === "client") {
      const { error } = await supabase.from("client_memory").insert({
        client_email: clientEmail,
        content: extractedText,
        embedding,
      });
      if (error) throw error;
    }

    // -------- FILE META --------
    await supabase.from("file_uploads").insert({
      file_path: file.originalFilename || file.name,
      extracted_text: extractedText,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return res.status(400).json({
      error: err.message || "Upload failed",
    });
  }
}
