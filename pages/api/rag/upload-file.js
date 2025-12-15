import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";
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
async function extractText(filePath, mime) {
  if (mime === "application/pdf") {
    const data = await pdf(fs.readFileSync(filePath));
    return data.text;
  }

  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ path: filePath });
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

  const form = formidable({ keepExtensions: true });

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = files.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const memoryType = fields.memoryType;
    const clientEmail = fields.clientEmail || null;

    if (memoryType === "client" && !clientEmail) {
      return res.status(400).json({ error: "Client email required" });
    }

    // ---------- EXTRACT ----------
    const extractedText = await extractText(
      file.filepath,
      file.mimetype
    );

    if (!extractedText || extractedText.length < 20) {
      return res.status(400).json({ error: "Empty content" });
    }

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

    // ---------- STORE FILE META ----------
    await supabase.from("file_uploads").insert({
      file_path: file.originalFilename,
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
