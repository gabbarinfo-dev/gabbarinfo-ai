// pages/api/rag/upload-file.js

// Disable Next.js default body parser (required for formidable)
export const config = {
  api: {
    bodyParser: false,
  },
};

import formidable from "formidable";
import fs from "fs";
import { supabaseServer } from "../../../lib/supabaseServer";

// helper to build absolute URL for server-side internal fetch
function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }

  try {
    // Parse form data (file + fields)
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = formidable({ multiples: false });
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const memoryTypeRaw = (fields.memory_type || "").toString();
    const memoryType = memoryTypeRaw.toLowerCase() === "client" ? "CLIENT" : "GLOBAL";
    const clientEmail = (fields.client_email || "").toString() || null;
    const saveFile = (fields.save_file || "yes").toString(); // "yes" | "no"
    const file = files.file;

    if (!memoryTypeRaw || !file) {
      return res.status(400).json({ ok: false, message: "Missing memory_type or file." });
    }

    if (memoryType === "CLIENT" && !clientEmail) {
      return res.status(400).json({ ok: false, message: "client_email is required for client memory." });
    }

    // read buffer
    const localPath = file.filepath;
    const originalName = file.originalFilename || `file_${Date.now()}`;
    const buffer = fs.readFileSync(localPath);

    // decide bucket path
    const timestamp = Date.now();
    let bucketPath;
    if (saveFile === "yes") {
      if (memoryType === "CLIENT") {
        // store under client for organization
        const safeEmail = clientEmail.replace(/[@.]/g, "_");
        bucketPath = `client_${safeEmail}/${timestamp}_${originalName}`;
      } else {
        bucketPath = `global/${timestamp}_${originalName}`;
      }
    } else {
      // temporary path - we'll delete after process
      bucketPath = `temp/${timestamp}_${originalName}`;
    }

    // upload to supabase storage
    const { error: uploadErr } = await supabaseServer.storage
      .from("knowledge-base")
      .upload(bucketPath, buffer, {
        contentType: file.mimetype || "application/octet-stream",
        upsert: true,
      });

    if (uploadErr) {
      return res.status(500).json({ ok: false, message: "Storage upload failed", error: uploadErr });
    }

    // If saveFile === yes then create memory_links entry (store reference)
    if (saveFile === "yes") {
      const { error: linkErr } = await supabaseServer
        .from("memory_links")
        .insert({
          client_email: clientEmail,
          storage_path: bucketPath,
        });

      if (linkErr) {
        console.warn("memory_links insert warning", linkErr);
        // don't fail whole flow for link insert; log and continue
      }
    }

    // Call process-file server endpoint to extract & embed & insert memory
    const baseUrl = getBaseUrl();
    const procRes = await fetch(`${baseUrl}/api/rag/process-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_path: bucketPath,
        mode: memoryType,
        client_email: clientEmail,
        title: originalName,
        save_file: saveFile,
      }),
    });

    const procData = await procRes.json();

    // If we uploaded to temp and chose not to keep file, delete temp object now
    if (saveFile === "no") {
      try {
        await supabaseServer.storage.from("knowledge-base").remove([bucketPath]);
      } catch (e) {
        console.warn("temp file delete warning", e);
      }
    }

    return res.status(procRes.status).json({
      ok: procData.ok,
      message: procData.message || (procData.error ? JSON.stringify(procData.error) : "Processed"),
      proc: procData,
      file_path: bucketPath,
    });
  } catch (err) {
    console.error("upload-file error:", err);
    return res.status(500).json({ ok: false, message: "Server error.", error: err.message });
  }
}
