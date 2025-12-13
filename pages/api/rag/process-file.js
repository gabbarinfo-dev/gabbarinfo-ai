import { supabaseServer } from "../../../lib/supabaseServer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

// Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }

  try {
    const { file_path, mode, client_email, title } = req.body;

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

    // Convert blob to buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = "";
    let fileType = "";

    // Determine file type by extension
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

      // Image → Gemini Vision OCR
      const result = await embedModel.generateContent([
        {
          inlineData: {
            data: buffer.toString("base64"),
            mimeType: "image/png",
          },
        },
        "Extract all readable text from this image."
      ]);

      extractedText = result.response.text();
    } else {
      return res.status(400).json({ ok: false, message: "Unsupported file type" });
    }

    if (!extractedText || extractedText.trim().length < 5) {
      return res.status(400).json({ ok: false, message: "Could not extract text" });
    }

    // Generate Embedding
    const embeddingResponse = await embedModel.embedContent(extractedText);
    const embedding = embeddingResponse.embedding.values;

    // Determine table
    let tableName = "";

    if (mode === "GLOBAL") {
      tableName = "global_memory";
    } else if (mode === "CLIENT") {
      if (!client_email) {
        return res.status(400).json({ ok: false, message: "client_email required for CLIENT mode" });
      }
      tableName = "client_memory";
    } else {
      return res.status(400).json({ ok: false, message: "Invalid mode" });
    }

    // Insert into correct table
    const { error: insertErr } = await supabaseServer
      .from(tableName)
      .insert({
        client_email: mode === "CLIENT" ? client_email : null,
        type: fileType,
        title: title || file_path,
        content: extractedText,
        embedding,
      });

    if (insertErr) {
      return res.status(500).json({ ok: false, message: "Insert failed", error: insertErr });
    }

    return res.status(200).json({
      ok: true,
      message: "File processed successfully",
      type: fileType,
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "Server error",
      error: err.message,
    });
  }
}
