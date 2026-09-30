// pages/api/video/upload-asset.js
// Uploads heavy user assets directly to Hosting Media Bridge (gabbarinfo.com)
// Completely bypasses Supabase storage to save memory & bandwidth.

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { uploadToMediaBridge } from "../../../lib/wordpress/media-bridge";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.body?.userEmail || "ndantare@gmail.com";

  const { filename, base64, sourceUrl, businessName } = req.body;

  if (!base64 && !sourceUrl) {
    return res.status(400).json({ ok: false, error: "Missing base64 data or sourceUrl" });
  }

  try {
    const cleanFilename = (filename || `asset_${Date.now()}.png`).replace(/[^a-zA-Z0-9._-]/g, "_");

    const uploadRes = await uploadToMediaBridge({
      filename: cleanFilename,
      base64,
      sourceUrl,
      businessName: businessName || "default",
      userEmail,
    });

    return res.status(200).json({
      ok: true,
      url: uploadRes.url,
      fileName: uploadRes.fileName,
      size: uploadRes.size,
      storageType: "hosting_media_bridge",
    });
  } catch (err) {
    console.error("[UploadAsset] Media bridge upload failed:", err);
    return res.status(500).json({
      ok: false,
      error: "Hosting upload failed: " + err.message,
    });
  }
}
