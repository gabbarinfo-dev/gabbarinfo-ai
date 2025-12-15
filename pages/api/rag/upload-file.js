// pages/api/rag/upload-file.js
export const runtime = "nodejs";

import formidable from "formidable";
import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ---------------- CONFIG ----------------
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx"];
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;

// Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({
  model: "models/text-embedding-004",
});

// Disable default body parsing
export const config = {
  api: {
    bodyParser: false,
  },
};

// ---------------- HELPERS ----------------
function chunkText(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = start + CHUNK_SIZE;
    chunks.push(text.slice(start, end));
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

async function extractText(filePath, ext) {
  if (ext === "pdf") {
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text || "";
  }
  if (ext === "doc" || ext === "docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || "";
  }
  return "";
}

// ---------------- MAIN HANDLER ----------------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }

  try {
    // ---------------- AUTH CHECK ----------------
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user?.role !== "owner") {
      return res.status(403).json({ ok: false, message: "Owner access only" });
    }

    // ---------------- PARSE FORM ----------------
    const form = formidable({
      maxFileSize: MAX_FILE_SIZE,
      multiples: false,
    });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = files.file;
    if (!file) {
      return res.status(400).json({ ok: false, message: "No file uploaded" });
    }

    const originalName = file.originalFilename || "";
    const ext = path.extname(originalName).replace(".", "").toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({
        ok: false,
        message: "Only PDF, DOC, DOCX files are allowed",
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        ok: false,
        message: "File size exceeds 10 MB limit",
      });
    }

    const memoryType = fields.memory_type;
    const clientEmail = fields.client_email || null;
    const saveFile = fields.save_file === "yes";

    if (!["global", "client"].includes(memoryType)) {
      return res.status(400).json({ ok: false, message: "Invalid memory type" });
    }

    if (memoryType === "client" && !clientEmail) {
      return res
        .status(400)
        .json({ ok: false, message: "Client email required" });
    }

    // ---------------- CREATE FILE UPLOAD RECORD ----------------
    const { data: uploadRow, error: uploadErr } = await supabaseServer
      .from("file_uploads")
      .insert({
        owner: session.user.email,
        category: memoryType,
        file_path: null,
        extracted_text: null,
        embedded: false,
      })
      .select()
      .single();

    if (uploadErr) throw uploadErr;

    let storagePath = null;

    // ---------------- SAVE FILE (OPTIONAL) ----------------
    if (saveFile) {
      const fileBuffer = fs.readFileSync(file.filepath);
      storagePath = `${memoryType}/${Date.now()}_${originalName}`;

      const { error: storageErr } = await supabaseServer.storage
        .from("knowledge-base")
        .upload(storagePath, fileBuffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (storageErr) throw storageErr;
    }

    // ---------------- EXTRACT TEXT ----------------
    const extractedText = await extractText(file.filepath, ext);
    if (!extractedText || extractedText.trim().length < 50) {
      return res.status(400).json({
        ok: false,
        message: "Document text is empty or unreadable",
      });
    }

    // ---------------- CHUNK + EMBED ----------------
    const chunks = chunkText(extractedText);
    const inserts = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i].trim();
      if (!chunk) continue;

      const embedResp = await embedModel.embedContent(chunk);
      const embedding = embedResp.embedding.values;

      inserts.push({
        type: ext,
        title: originalName,
        content: chunk,
        embedding,
        ...(memoryType === "client" ? { client_email: clientEmail } : {}),
      });
    }

    // ---------------- INSERT MEMORY ----------------
    if (memoryType === "global") {
      const { error } = await supabaseServer
        .from("global_memory")
        .insert(inserts);
      if (error) throw error;
    } else {
      const { error } = await supabaseServer
        .from("client_memory")
        .insert(inserts);
      if (error) throw error;
    }

    // ---------------- FINALIZE ----------------
    await supabaseServer
      .from("file_uploads")
      .update({
        file_path: storagePath,
        extracted_text: extractedText.slice(0, 5000),
        embedded: true,
      })
      .eq("id", uploadRow.id);

    return res.status(200).json({
      ok: true,
      message: `File processed successfully. Chunks created: ${inserts.length}`,
    });
  } catch (err) {
    console.error("UPLOAD FILE ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Upload failed",
      error: err.message,
    });
  }
}
