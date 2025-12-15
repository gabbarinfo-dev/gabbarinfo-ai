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
async function extractTextSafe(filePath, mime) {
  try {
    if (mime === "application/pdf") {
      const buffer = fs.readFileSync(filePath);
      const data = await pdf(buffer);
      return data.text || "";
    }

    if (
      mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || "";
    }

    throw new Error("Unsupported file type");
  } catch (e) {
    // scanned / corrupt PDFs
    return "";
  }
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

  const form = formidable({ multiples: false, keepExtensions: true });

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const uploaded = files.file;
    if (!uploaded) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // formidable v3 fix
    const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    const filePath = file.filepath;

    if (!filePath) {
      return res.status(400).json({ error: "Invalid uploaded file" });
    }

    const memoryType = fields.memoryType; // "global" | "client"
    const clientEmail = fields.clientEmail || null;

    if (memoryType === "client" && !clientEmail) {
      return res.status(400).json({ error: "Client email required" });
    }

    // ---------- EXTRACT ----------
    const extractedText = await extractTextSafe(
      filePath,
      file.mimetype
    );

    if (!extractedText || extractedText.trim().length < 30) {
      return res.status(400).json({
        error: "PDF parse failed (corrupt or scanned PDF)",
      });
    }

    // ---------- EMBED ----------
    const embedding = await embed(extractedText);

    // ---------- INSERT ----------
    if (memoryType === "global") {
      const { error } = await supabase.from("global_memory").insert({
        type: "document",
        content: extractedText,
        embedding,
        created_by: "admin",
      });
      if (error) throw error;
    }

    if (memoryType === "client") {
      const { error } = await supabase.from("client_memory").insert({
        client_email: clientEmail,
        type: "document",
        content: extractedText,
        embedding,
      });
      if (error) throw error;
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return res.status(500).json({
      error: err.message || "Upload failed",
    });
  }
}
