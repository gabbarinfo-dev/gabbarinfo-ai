// pages/api/rag/process-file.js

import { supabaseServer } from "../../../lib/supabaseServer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const textModel = genAI.getGenerativeModel({ model: "gemini-pro" });
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
      save_file,
      file_path,
      original_name,
      buffer_base64,
      mime_type,
    } = req.body;

    if (!mode) {
      return res.status(400).json({ ok: false, message: "mode missing" });
    }

    let buffer;

    // 1. Get buffer
    if (save_file === "yes") {
      const { data, error } = await supabaseServer.storage
        .from("knowledge-base")
        .download(file_path);

      if (error) {
        return res.status(500).json({
          ok: false,
          message: "File download failed",
          error: error.message,
        });
      }

      const arr = await data.arrayBuffer();
      buffer = Buffer.from(arr);
    } else {
      buffer = Buffer.from(buffer_base64, "base64");
    }

    // 2. Extract text
    let extractedText = "";
    let type = "";

    if (mime_type.includes("pdf")) {
      type = "pdf";
      const parsed = await pdfParse(buffer);
      extractedText = parsed.text;
    } else if (mime_type.includes("word")) {
      type = "docx";
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (mime_type.startsWith("image/")) {
      type = "image";
      const base64img = buffer.toString("base64");
      const result = await textModel.generateContent([
        {
          inlineData: {
            data: base64img,
            mimeType: mime_type,
          },
        },
        "Extract all readable text clearly.",
      ]);
      extractedText = result.response.text();
    } else {
      return res.status(400).json({
        ok: false,
        message: "Unsupported file type",
      });
    }

    if (!extractedText || extractedText.length < 10) {
      return res.status(400).json({
        ok: false,
        message: "No meaningful text extracted",
      });
    }

    // 3. Embedding
    const embed = await embedModel.embedContent(extractedText);

    // 4. Decide table
    const table =
      mode === "GLOBAL" ? "global_memory" : "client_memory";

    // 5. Insert
    const { error } = await supabaseServer.from(table).insert({
      client_email: mode === "CLIENT" ? client_email : null,
      title: original_name,
      type,
      content: extractedText,
      embedding: embed.embedding.values,
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
      message: "Memory stored successfully",
    });
  } catch (err) {
    console.error("PROCESS FILE ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Process server error",
      error: err.message,
    });
  }
}
