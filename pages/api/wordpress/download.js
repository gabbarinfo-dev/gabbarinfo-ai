// pages/api/wordpress/download.js
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const zipPath = path.join(process.cwd(), "public", "plugins", "gabbarinfo-connect.zip");

    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ ok: false, error: "Plugin archive not found" });
    }

    const stat = fs.statSync(zipPath);
    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Length": stat.size,
      "Content-Disposition": 'attachment; filename="gabbarinfo-connect.zip"',
      "Cache-Control": "public, max-age=3600",
    });

    const readStream = fs.createReadStream(zipPath);
    readStream.pipe(res);
  } catch (err) {
    console.error("Plugin download error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
