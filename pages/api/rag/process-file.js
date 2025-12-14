export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  try {
    const {
      mode,
      client_email,
      filename,
      mime_type,
      content_base64,
    } = req.body || {};

    if (!content_base64) {
      return res.status(400).json({
        ok: false,
        message: "No file content received",
      });
    }

    // 🔒 YAHAN PE FUTURE ME:
    // - text extraction
    // - embeddings
    // - DB insert
    // aayega

    return res.status(200).json({
      ok: true,
      message: "File processed successfully",
      meta: {
        mode,
        client_email,
        filename,
        mime_type,
        size: content_base64.length,
      },
    });
  } catch (err) {
    console.error("PROCESS ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error in process-file",
    });
  }
}
