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

// ---------- HELPERS ----------
async function extractTextSafe(filePath, ext) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("Invalid uploaded file");
  }

  // PDF
  if (ext === ".pdf") {
    try {
      const buffer = fs.readFileSync(filePath);
      const data = await pdf(buffer);
      if (!data.text || data.text.trim().length < 10) {
        throw new Error("Empty PDF");
      }
      return data.text;
    } catch (e) {
      throw new Error("PDF parse failed (corrupt or unsupported PDF)");
    }
  }

  // DOCX
  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    if (!result.value || result.value.trim().length < 10) {
      throw new Error("Empty DOCX");
    }
    return result.value;
  }

  throw new Error("Unsupported file type");
}

async function embed(text) {
  const result = await embedModel.embedContent(text);
  return result.embedding.values;
}

// ---------- API ----------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = formidable({
    multiples: false,
    keepExtensions: true,
  });

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    // ---------- FILE NORMALIZE ----------
    let file = files.file;
    if (Array.isArray(file)) file = file[0];
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const filePath = file.filepath;
    const originalName = file.originalFilename || "uploaded_file";
    const ext = path.extname(originalName).toLowerCase();

    if (![".pdf", ".docx"].includes(ext)) {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    // ---------- MEMORY TYPE ----------
    const rawMemoryType = String(fields.memoryType || "").toLowerCase();
    const memoryType =
      rawMemoryType.includes("global") ? "global" : "client";

    const clientEmail =
      memoryType === "client" ? fields.clientEmail : null;

    if (memoryType === "client" && !clientEmail) {
      return res.status(400).json({ error: "Client email required" });
    }

    // ---------- EXTRACT ----------
    const extractedText = await extractTextSafe(filePath, ext);

    // ---------- EMBED ----------
    const embedding = await embed(extractedText);

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

    // ---------- FILE META ----------
    await supabase.from("file_uploads").insert({
      file_path: originalName,
      extracted_text: extractedText,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return res.status(500).json({
      error: err.message || "Upload failed",
    });
  }
}
