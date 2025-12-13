// pages/api/rag/upload-file.js

// ⬇ MUST BE FIRST — disable Next.js body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

import formidable from "formidable";
import fs from "fs";
import { supabaseServer } from "../../../lib/supabaseServer";

// Disable Next.js body parser (required for file uploads)
export const config = {
  api: {
    bodyParser: false,
  },
};

// Utility: parse incoming file upload
async function parseUpload(req) {
  return await new Promise((resolve, reject) => {
    const form = formidable({ multiples: false });

    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      message: "Only POST method allowed",
    });
  }

  try {
    // STEP 1 — Parse file
    const { files } = await parseUpload(req);
    const file = files.file;
    if (!file) {
      return res.status(400).json({ ok: false, message: "No file uploaded" });
    }

    const fileBuffer = fs.readFileSync(file.filepath);
    const fileName = `${Date.now()}_${file.originalFilename}`;

    // STEP 2 — Upload file to Supabase Storage
    const { data: storageData, error: storageError } =
      await supabaseServer.storage
        .from("knowledge-base")
        .upload(fileName, fileBuffer, {
          contentType: file.mimetype,
        });

    if (storageError) {
      console.error("Storage upload error:", storageError);
      return res.status(500).json({
        ok: false,
        message: "Failed to upload to storage",
        error: storageError,
      });
    }

    const fileUrl = storageData.path;

    // STEP 3 — Extract text using Gemini
    const textResp = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + process.env.GEMINI_API_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Extract all readable text from this document and return pure text only.`,
              },
              {
                file_data: {
                  mime_type: file.mimetype,
                  file_uri: fileUrl,
                },
              },
            ],
          },
        ],
      }),
    });

    const textJson = await textResp.json();
    const extractedText = textJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!extractedText) {
      return res.status(500).json({
        ok: false,
        message: "Failed to extract text",
        error: textJson,
      });
    }

    // STEP 4 — Chunk text (simple chunking)
    const chunks = [];
    const words = extractedText.split(" ");
    const chunkSize = 200;

    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(" "));
    }

    // STEP 5 — Embed each chunk using Gemini
    const embeddings = [];
    for (const chunk of chunks) {
      const embedResp = await fetch("https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedText?key=" + process.env.GEMINI_API_KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunk }),
      });

      const embedJson = await embedResp.json();
      embeddings.push(embedJson.embedding?.values);
    }

    // STEP 6 — Insert into global_memory + link using memory_links
    for (let i = 0; i < chunks.length; i++) {
      const { data: memoryRow, error: memoryError } = await supabaseServer
        .from("global_memory")
        .insert({
          type: "file_chunk",
          title: file.originalFilename,
          content: chunks[i],
          embedding: embeddings[i],
          created_by: "admin",
        })
        .select()
        .single();

      if (memoryError) {
        console.error("Insert global_memory error:", memoryError);
        continue;
      }

      await supabaseServer.from("memory_links").insert({
        client_email: "admin_only",
        global_memory_id: memoryRow.id,
        file_url: fileUrl,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "File ingested into AI memory successfully.",
      chunks: chunks.length,
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error during file ingestion",
      error: err.message,
    });
  }
}
