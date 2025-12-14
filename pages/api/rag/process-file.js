// pages/api/rag/process-file.js

import { supabaseServer } from "../../../lib/supabaseServer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

// -------------------------------
// Gemini setup
// -------------------------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Text model (for OCR / image text)
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
    const {
      mode,                 // GLOBAL | CLIENT
      client_email,         // email or null
      save_file,            // yes | no
      file_path,            // path in bucket OR null
      original_name,        // original filename
      buffer,               // base64 buffer (only when save_file === "no")
      mime_type,            // mimetype
    } = req.body;

    if (!mode) {
      return res.status(400).json({
        ok: false,
        message: "Missing mode",
      });
    }

    // ---------------------------------------
    // 1. Prepare file buffer
    // ---------------------------------------
    let fileBuffer = null;

    if (save_file === "yes") {
      if (!file_path) {
        return res.status(400).json({
          ok: false,
          message: "file_path required when save_file=yes",
        });
      }

      const { data, error } = await supabaseServer.storage
        .from("knowledge-base")
        .download(file_path);

      if (error) {
        return res.status(500).json({
          ok: false,
          message: "Failed to download file",
          error: error.message,
        });
      }

      const arrayBuffer = await data.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);

    } else {
      // save_file === "no"
      if (!buffer) {
        return res.status(400).json({
          ok: false,
          message: "Buffer missing for non-saved file",
        });
      }
      fileBuffer = Buffer.from(buffer, "base64");
    }

    // ---------------------------------------
    // 2. Extract text
    // ---------------------------------------
    let extractedText = "";
    let fileType = "text";

    const name = original_name || file_path || "";
    const lowerName = name.toLowerCase();

    if (lowerName.endsWith(".pdf")) {
      fileType = "pdf";
      const parsed = await pdfParse(fileBuffer);
      extractedText = parsed.text;

    } else if (lowerName.endsWith(".docx")) {
      fileType = "docx";
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      extractedText = result.value;

    } else if (
      mime_type?.startsWith("image/") ||
      lowerName.endsWith(".png") ||
      lowerName.endsWith(".jpg") ||
      lowerName.endsWith(".jpeg")
    ) {
      fileType = "image";

      const base64Img = fileBuffer.toString("base64");
      const result = await textModel.generateContent([
        {
          inlineData: {
            data: base64Img,
            mimeType: mime_type || "image/png",
          },
        },
        "Extract all readable text from this image clearly.",
      ]);

      extractedText = result.response.text();

    } else {
      // fallback: treat as plain text
      fileType = "text";
      extractedText = fileBuffer.toString("utf-8");
    }

    if (!extractedText || extractedText.trim().length < 5) {
      return res.status(400).json({
        ok: false,
        message: "No meaningful text extracted",
      });
    }

    // ---------------------------------------
    // 3. Generate embedding
    // ---------------------------------------
    const embedResponse = await embedModel.embedContent(extractedText);
    const embedding = embedResponse.embedding.values;

    // ---------------------------------------
    // 4. Decide table
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
        message: "Invalid mode",
      });
    }

    // ---------------------------------------
    // 5. Insert memory
    // ---------------------------------------
    const { error: insertErr } = await supabaseServer
      .from(tableName)
      .insert({
        client_email: mode === "CLIENT" ? client_email : null,
        type: fileType,
        title: original_name || file_path || "Uploaded file",
        content: extractedText,
        embedding,
      });

    if (insertErr) {
      return res.status(500).json({
        ok: false,
        message: "Database insert failed",
        error: insertErr.message,
      });
    }

    // ---------------------------------------
    // 6. Success
    // ---------------------------------------
    return res.status(200).json({
      ok: true,
      message: "File processed and stored successfully",
      type: fileType,
      saved_file: save_file === "yes",
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
