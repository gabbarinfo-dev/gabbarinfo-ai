// pages/api/rag/process-file.js

import { supabaseServer } from "../../../lib/supabaseServer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const embedModel = genAI.getGenerativeModel({
  model: "models/text-embedding-004",
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }

  try {
    const {
      mode,
      client_email,
      buffer,
      original_name,
    } = req.body;

    if (!buffer) {
      return res.status(400).json({
        ok: false,
        message: "File buffer missing",
      });
    }

    const fileBuffer = Buffer.from(buffer, "base64");
    const lowerName = (original_name || "").toLowerCase();

    let extractedText = "";
    let fileType = "";

    // ---------------- FILE TYPE HANDLING ----------------
    if (lowerName.endsWith(".pdf")) {
      fileType = "pdf";
      const parsed = await pdfParse(fileBuffer);
      extractedText = parsed.text;

    } else if (lowerName.endsWith(".docx")) {
      fileType = "docx";
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      extractedText = result.value;

    } else {
      return res.status(400).json({
        ok: false,
        message: "Unsupported file type",
      });
    }

    if (!extractedText || extractedText.trim().length < 5) {
      return res.status(400).json({
        ok: false,
        message: "No meaningful text extracted",
      });
    }

    // ---------------- EMBEDDING ----------------
    const embedRes = await embedModel.embedContent(extractedText);
    const embedding = embedRes.embedding.values;

    const table =
      mode === "GLOBAL" ? "global_memory" : "client_memory";

    const { error } = await supabaseServer.from(table).insert({
      client_email: mode === "CLIENT" ? client_email : null,
      type: fileType,
      title: original_name,
      content: extractedText,
      embedding,
    });

    if (error) {
      return res.status(500).json({
        ok: false,
        message: "DB insert failed",
        error: error.message,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Processed & stored successfully",
    });

  } catch (err) {
    console.error("PROCESS FILE ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error in process-file",
      error: err.message,
    });
  }
}
