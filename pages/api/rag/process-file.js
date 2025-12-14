// pages/api/rag/process-file.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }

  try {
    const {
      memory_type,
      client_email,
      save_file,
      file_path,
      original_name,
      mime_type,
      buffer_base64,
    } = req.body || {};

    // ---- STRICT VALIDATION ----
    if (save_file === "yes" && !file_path) {
      return res.status(400).json({
        ok: false,
        message: "file_path missing while save_file = yes",
      });
    }

    if (save_file === "no" && !buffer_base64) {
      return res.status(400).json({
        ok: false,
        message: "buffer missing while save_file = no",
      });
    }

    // ---- NO PROCESSING YET (SAFE STUB) ----
    // This endpoint ONLY confirms payload correctness.
    // Actual embedding / extraction can be added later.

    return res.status(200).json({
      ok: true,
      message: "Process-file executed successfully",
      meta: {
        memory_type,
        client_email,
        save_file,
        file_path,
        original_name,
        mime_type,
      },
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
