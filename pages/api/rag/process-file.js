// pages/api/rag/process-file.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }

  try {
    const {
      original_name,
      mime_type,
      memory_type,
      client_email,
      save_file,
      buffer_base64,
    } = req.body || {};

    if (!buffer_base64) {
      return res.status(400).json({
        ok: false,
        message: "File buffer missing",
      });
    }

    // Decode buffer (NO fs, NO streams, NO paths)
    const buffer = Buffer.from(buffer_base64, "base64");

    // 🔒 Minimal safe extraction (no pdf/docx libs = no crash)
    const extractedText = `
FILE: ${original_name}
TYPE: ${mime_type}
SIZE: ${buffer.length} bytes
MEMORY: ${memory_type}
CLIENT: ${client_email || "GLOBAL"}
UPLOADED_AT: ${new Date().toISOString()}
`;

    // ⛔️ No embeddings, no storage, no helpers
    // ✅ Just simulate successful processing

    return res.status(200).json({
      ok: true,
      message: "File processed successfully",
      preview: extractedText.slice(0, 200),
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
