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

// Embedding model (text-embedding-004)
const embedModel = genAI.getGenerativeModel({
  model: "models/text-embedding-004",
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }

  try {
    const { file_path, mode, client_email, title, save_file } = req.body;

    if (!file_path || !mode) {
      return res.status(400).json({
        ok: false,
        message: "Missing file_path or mode",
      });
    }

    // ---------------------------------------
    // 1. DOWNLOAD FILE IF save_file === "yes"
    // ---------------------------------------
    let buffer = null;

    if (save_file === "yes") {
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
    }

    let extractedText = "";
    let fileType = "";

    // ---------------------------------------
    // 2. TEXT EXTRACTION BASED ON FILE TYPE
    // ---------------------------------------

    if (file_path.endsWith(".pdf")) {
      fileType = "pdf";

      if (save_file !== "yes") {
        return res.status(400).json({
          ok: false,
          message: "PDF processing requires file to be stored (save_file=yes)",
        });
      }

      const parsed = await pdfParse(buffer);
      extractedText = parsed.text;

    } else if (file_path.endsWith(".docx")) {
      fileType = "docx";

      if (save_file !== "yes") {
        return res.status(400).json({
          ok: false,
          message: "DOCX processing requires file to be stored (save_file=yes)",
        });
      }

      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;

    } else if (
      file_path.endsWith(".png") ||
      file_path.endsWith(".jpg") ||
      file_path.endsWith(".jpeg")
    ) {
      fileType = "image";

      if (save_file !== "yes") {
        return res.status(400).json({
          ok: false,
          message: "Image OCR requires file to be stored (save_file=yes)",
        });
      }

      const base64img = buffer.toString("base64");

      const result = await textModel.generateContent([
        {
          inlineData: {
            data: base64img,
            mimeType: "image/png",
          },
        },
        "Extract all readable text from this image clearly and clean.",
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
    // 3. GENERATE EMBEDDING
    // ---------------------------------------
    const embedResponse = await embedModel.embedContent(extractedText);
    const embedding = embedResponse.embedding.values;

    // ---------------------------------------
    // 4. DECIDE MEMORY TABLE
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
    // 5. INSERT MEMORY ROW
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
