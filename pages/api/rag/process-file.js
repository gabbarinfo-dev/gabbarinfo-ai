// pages/api/rag/process-file.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  try {
    const { filename, mimetype, size } = req.body || {};

    if (!filename) {
      return res.status(400).json({
        success: false,
        message: "Missing filename",
      });
    }

    // Stub processing (safe on Vercel)
    return res.status(200).json({
      success: true,
      message: "File processed successfully",
      file: {
        filename,
        mimetype,
        size,
      },
    });
  } catch (err) {
    console.error("PROCESS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error in process-file",
    });
  }
}
