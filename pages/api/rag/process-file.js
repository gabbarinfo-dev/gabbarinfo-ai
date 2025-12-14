// pages/api/rag/process-file.js

import { supabaseServer } from "../../../lib/supabaseServer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

// Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Text model (gemini-pro)
const textModel = genAI.getGenerativeModel({
  model: "gemini-pro",
});

// Embedding model
const embedModel = genAI.getGenerativeModel({
  model: "models/text-embedding-004",
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }

  try {
    const { file_path, mode, client_email, title, save_file } = req.body;

    if (!mode) {
      return res.status(400).json({
        ok: false,
        message: "Missing mode",
      });
    }

    let buffer = null;
    let extractedText = "";
    let fileType = "";

    // -----------------------------
    // Case 1: save_file = "no"
    // File is NOT saved, so user expects embedding only if text manually provided.
    // -----------------------------
    if (save_file === "no") {
      return res.status(400).json({
        ok: false,
        message: "save_file=no requires physical file for extraction.",
      });
    }

    // -----------------------------
    // Otherwise → download file from Supabase
    // -----------------------------
    const { data: fileData, error: downloadErr } = await supabaseServer.storage
      .from("knowledge-base")
      .download(file_path);

    if (downloadErr) {
      return res.status(500).json({
        ok: false,
        message: "File download failed",
        error: downloadErr,
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);

    // ---------------------------------------
    // TEXT EXTRACTION BASED ON FILE TYPE
    // ---------------------------------------

    if (file_path.endsWith(".pdf")) {
      fileType = "pdf";
      const parsed = await pdfParse(buffer);
      extractedText = parsed.text;

    } else if (file_path.endsWith(".docx")) {
      fileType = "docx";
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;

    } else if (
      file_path.endsWith(".png") ||
      file_path.endsWith(".jpg") ||
      file_path.endsWith(".jpeg")
    ) {
      fileType = "image";

      const base64img = buffer.toString("base64");

      const result = await textModel.generateContent([
        {
          inlineData: {
            data: base64img,
            mimeType: "image/png",
          },
        },
        "Extract readable text clearly.",
      ]);

      extractedText = result.response.text();

    } else {
      return res.status(400).json({
        ok: false,
        message: "Unsupported file type",
      });
    }

    if (!extractedText || extractedText.trim().length < 5) {
      return res.status(400).json({
        ok: false,
        message: "Could not extract meaningful text",
      });
    }

    // ---------------------------------------
    // GENERATE EMBEDDING
    // ---------------------------------------
    const embedResponse = await embedModel.embedContent(extractedText);
    const embedding = embedResponse.embedding.values;

    // ---------------------------------------
    // DECIDE MEMORY TABLE
    // ---------------------------------------
    let tableName = "";

    if (mode === "GLOBAL") {
      tableName = "global_memory";
    } else if (mode === "CLIENT") {
      if (!client_email) {
        return res.status(400).json({
          ok: false,
          message: "client_email required for CLIENT mode",
        });
      }
      tableName = "client_memory";
    } else {
      return res.status(400).json({
        ok: false,
        message: "Invalid mode (must be GLOBAL or CLIENT)",
      });
    }

    // ---------------------------------------
    // INSERT MEMORY ENTRY
    // ---------------------------------------
    const { error: insertErr } = await supabaseServer.from(tableName).insert({
      client_email: mode === "CLIENT" ? client_email : null,
      type: fileType,
      title: title || file_path,
      content: extractedText,
      embedding,
    });

    if (insertErr) {
      return res.status(500).json({
        ok: false,
        message: "Database insert failed",
        error: insertErr,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "File processed & stored successfully",
      type: fileType,
      saved: save_file,
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Server error",
      error: err.message,
    });
  }
}
