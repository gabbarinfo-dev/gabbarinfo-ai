// pages/api/rag/upload-file.js

export const config = {
  api: { bodyParser: false },
};

import formidable from "formidable";
import fs from "fs";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

/* =========================
   INIT CLIENTS
========================= */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const embeddingModel = genAI.getGenerativeModel({
  model: "text-embedding-004",
});

/* =========================
   TEXT EXTRACTION
========================= */

async function extractText(filePath, mime) {
  if (mime.includes("pdf")) {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mime.includes("word") ||
    mime.includes("docx")
  ) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (mime.includes("text")) {
    return fs.readFileSync(filePath, "utf8");
  }

  throw new Error("Unsupported file type");
}

/* =========================
   MAIN HANDLER
========================= */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }

  try {
    /* ---------- PARSE FORM ---------- */
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = formidable({ multiples: false });
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = files.file;
    if (!file || !file.filepath) {
      return res.status(400).json({
        ok: false,
        message: "File path missing",
      });
    }

    const memoryType = String(fields.memory_type || "global").toUpperCase();
    const clientEmail =
      memoryType === "CLIENT"
        ? String(fields.client_email || "")
        : null;

    /* ---------- EXTRACT TEXT ---------- */
    const extractedText = await extractText(
      file.filepath,
      file.mimetype || ""
    );

    if (!extractedText || extractedText.length < 20) {
      return res.status(400).json({
        ok: false,
        message: "No readable text found",
      });
    }

    /* ---------- EMBEDDING ---------- */
    const embeddingResult = await embeddingModel.embedContent(extractedText);
    const embedding = embeddingResult.embedding.values;

    /* ---------- SAVE TO SUPABASE ---------- */
    const { error } = await supabase.from("rag_memory").insert({
      title: file.originalFilename || "Uploaded File",
      content: extractedText,
      embedding,
      memory_type: memoryType,
      client_email: clientEmail,
    });

    if (error) {
      console.error("SUPABASE INSERT ERROR:", error);
      return res.status(500).json({
        ok: false,
        message: "Supabase insert failed",
      });
    }

    /* ---------- DONE ---------- */
    return res.status(200).json({
      ok: true,
      message: "File uploaded, processed & stored",
    });

  } catch (err) {
    console.error("UPLOAD FINAL ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Processing failed",
    });
  }
}
