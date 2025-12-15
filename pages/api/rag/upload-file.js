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

/* ================== CLIENTS ================== */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({
  model: "models/text-embedding-004",
});

/* ================== HELPERS ================== */
async function extractText(file) {
  const filePath = file.filepath || file.path;
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("Invalid uploaded file");
  }

  const ext = path.extname(file.originalFilename || "").toLowerCase();

  try {
    if (ext === ".pdf") {
      const buffer = fs.readFileSync(filePath);
      const data = await pdf(buffer);
      if (!data.text || data.text.trim().length < 20) {
        throw new Error("PDF parse failed (corrupt or unsupported PDF)");
      }
      return data.text;
    }

    if (ext === ".docx") {
      const result = await mammoth.extractRawText({ path: filePath });
      if (!result.value || result.value.trim().length < 20) {
        throw new Error("Empty DOCX content");
      }
      return result.value;
    }

    throw new Error("Unsupported file type");
  } catch (err) {
    if (ext === ".pdf") {
      throw new Error("PDF parse failed (corrupt or unsupported PDF)");
    }
    throw err;
  }
}

async function embed(text) {
  const result = await embedModel.embedContent(text.slice(0, 12000));
  return result.embedding.values;
}

/* ================== API ================== */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = formidable({ multiples: false, keepExtensions: true });

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const uploaded = Array.isArray(files.file)
      ? files.file[0]
      : files.file;

    if (!uploaded) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const memoryType = String(fields.memoryType || "").toLowerCase();
    const clientEmail =
      fields.clientEmail && String(fields.clientEmail).trim()
        ? String(fields.clientEmail).trim()
        : null;

    if (memoryType === "client" && !clientEmail) {
      return res.status(400).json({ error: "Client email required" });
    }

    /* ---------- EXTRACT ---------- */
    const extractedText = await extractText(uploaded);

    /* ---------- EMBED ---------- */
    const embedding = await embed(extractedText);

    /* ---------- INSERT MEMORY ---------- */
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

    /* ---------- STORE FILE META ---------- */
    await supabase.from("file_uploads").insert({
      file_path: uploaded.originalFilename,
      extracted_text: extractedText.slice(0, 20000),
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return res.status(400).json({
      error: err.message || "Upload failed",
    });
  }
}
