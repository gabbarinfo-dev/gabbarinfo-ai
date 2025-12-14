// pages/api/rag/process-file.js

// ✅ VERY IMPORTANT — force Node.js runtime
export const runtime = "nodejs";

import { supabaseServer } from "../../../lib/supabaseServer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

// ---------------- GEMINI SETUP ----------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// For OCR (images)
const visionModel = genAI.getGenerativeModel({
  model: "gemini-pro-vision",
});

// For embeddings
const embedModel = genAI.getGenerativeModel({
  model: "models/text-embedding-004",
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }

  try {
    const { file_path, memory_type, client_email, save_file, title } = req.body;

    if (!memory_type) {
      return res.status(400).json({
        ok: false,
        message: "memory_type missing",
      });
    }

    // ------------------------------------------------
    // 1️⃣ DOWNLOAD FILE ONLY IF save_file === "yes"
    // ------------------------------------------------
    let buffer = null;

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
        console.error("DOWNLOAD ERROR:", error);
        return res.status(500).json({
          ok: false,
          message: "Failed to download file",
        });
      }

      const arrayBuffer = await data.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    // ------------------------------------------------
    // 2️⃣ EXTRACT TEXT
    // ------------------------------------------------
    let extractedText = "";
    let fileType = "text";

    if (save_file === "yes" && file_path) {
      const lower = file_path.toLowerCase();

      if (lower.endsWith(".pdf")) {
        fileType = "pdf";
        const parsed = await pdfParse(buffer);
        extractedText = parsed.text;

      } else if (lower.endsWith(".docx")) {
        fileType = "docx";
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;

      } else if (
        lower.endsWith(".png") ||
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg")
      ) {
        fileType = "image";

        const base64 = buffer.toString("base64");

        const visionResult = await visionModel.generateContent([
          {
            inlineData: {
              data: base64,
              mimeType: "image/png",
            },
          },
          "Extract all readable text clearly.",
        ]);

        extractedText = visionResult.response.text();
      } else {
        return res.status(400).json({
          ok: false,
          message: "Unsupported file type",
        });
      }
    } else {
      // ⚠️ If file not saved, we DO NOT process binary files
      return res.status(400).json({
        ok: false,
        message:
          "When save_file=no, text extraction is not possible for binary files",
      });
    }

    if (!extractedText || extractedText.trim().length < 5) {
      return res.status(400).json({
        ok: false,
        message: "No meaningful text extracted",
      });
    }

    // ------------------------------------------------
    // 3️⃣ CREATE EMBEDDING
    // ------------------------------------------------
    const embedRes = await embedModel.embedContent(extractedText);
    const embedding = embedRes.embedding.values;

    // ------------------------------------------------
    // 4️⃣ DECIDE TABLE
    // ------------------------------------------------
    let table = "global_memory";

    if (memory_type === "client") {
      if (!client_email) {
        return res.status(400).json({
          ok: false,
          message: "client_email required for client memory",
        });
      }
      table = "client_memory";
    }

    // ------------------------------------------------
    // 5️⃣ INSERT INTO DB
    // ------------------------------------------------
    const { error: insertErr } = await supabaseServer.from(table).insert({
      client_email: memory_type === "client" ? client_email : null,
      title: title || file_path || "Untitled",
      type: fileType,
      content: extractedText,
      embedding,
    });

    if (insertErr) {
      console.error("DB INSERT ERROR:", insertErr);
      return res.status(500).json({
        ok: false,
        message: "Failed to save memory",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Memory processed & stored successfully",
      type: fileType,
    });

  } catch (err) {
    console.error("PROCESS FILE CRASH:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error",
    });
  }
}
