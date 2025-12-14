// pages/api/rag/process-file.js

import { supabaseServer } from "../../../lib/supabaseServer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Text model (for image OCR via vision)
const textModel = genAI.getGenerativeModel({
  model: process.env.GEMINI_TEXT_MODEL || "gemini-pro",
});

// Embedding model
const embedModel = genAI.getGenerativeModel({
  model: process.env.GEMINI_EMBED_MODEL || "models/text-embedding-004",
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }

  try {
    const { file_path, mode, client_email, title, save_file } = req.body || {};

    if (!file_path || !mode) {
      return res.status(400).json({ ok: false, message: "Missing file_path or mode" });
    }

    // Download from Supabase Storage
    const { data: fileData, error: downloadErr } = await supabaseServer.storage
      .from("knowledge-base")
      .download(file_path);

    if (downloadErr) {
      return res.status(500).json({ ok: false, message: "File download failed", error: downloadErr });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = "";
    let fileType = "";

    // determine file type from extension
    const lower = file_path.toLowerCase();
    if (lower.endsWith(".pdf")) {
      fileType = "pdf";
      const parsed = await pdfParse(buffer);
      extractedText = parsed.text || "";
    } else if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
      fileType = "docx";
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value || "";
    } else if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
      fileType = "image";

      // Use Gemini vision via textModel.generateContent with inlineData
      const base64img = buffer.toString("base64");
      const visionRes = await textModel.generateContent([
        {
          inlineData: {
            data: base64img,
            mimeType: "image/png",
          },
        },
        "Extract all readable text from this image. Return clean text only.",
      ]);

      // response.text() may vary by client lib; try safe ways:
      const respText = (visionRes?.response?.text && visionRes.response.text()) || visionRes?.output?.text || "";
      extractedText = respText || "";
    } else {
      return res.status(400).json({ ok: false, message: "Unsupported file type" });
    }

    if (!extractedText || extractedText.trim().length < 5) {
      return res.status(400).json({ ok: false, message: "Could not extract meaningful text" });
    }

    // Generate Embedding
    const embedResponse = await embedModel.embedContent(extractedText);
    const embedding = embedResponse.embedding?.values || embedResponse?.data?.[0]?.embedding || null;

    if (!embedding) {
      return res.status(500).json({ ok: false, message: "Embedding generation failed" });
    }

    // Decide table
    let tableName = "";
    if (mode === "GLOBAL" || mode === "global") {
      tableName = "global_memory";
    } else if (mode === "CLIENT" || mode === "client") {
      if (!client_email) {
        return res.status(400).json({ ok: false, message: "client_email required for CLIENT mode" });
      }
      tableName = "client_memory";
    } else {
      return res.status(400).json({ ok: false, message: "Invalid mode" });
    }

    // Insert memory row
    const insertRow = {
      client_email: tableName === "client_memory" ? client_email : null,
      type: fileType,
      title: title || file_path,
      content: extractedText,
      embedding,
      created_at: new Date().toISOString(),
    };

    const { error: insertErr } = await supabaseServer.from(tableName).insert(insertRow);

    if (insertErr) {
      return res.status(500).json({ ok: false, message: "Insert failed", error: insertErr });
    }

    return res.status(200).json({ ok: true, message: "File processed successfully", type: fileType });
  } catch (err) {
    console.error("process-file error:", err);
    return res.status(500).json({ ok: false, message: "Server error", error: err.message });
  }
}
