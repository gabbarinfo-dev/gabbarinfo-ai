// pages/api/character/upload-media.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.body?.userEmail;

  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Please log in to upload media." });
  }

  const { fileBase64, filename = "upload.mp4", contentType = "video/mp4" } = req.body || {};

  if (!fileBase64) {
    return res.status(400).json({ ok: false, error: "Missing fileBase64 data." });
  }

  try {
    const base64Marker = ";base64,";
    const base64Index = fileBase64.indexOf(base64Marker);
    const rawBase64 = base64Index !== -1 ? fileBase64.slice(base64Index + base64Marker.length) : fileBase64.replace(/^data:.*?;base64,/, "");
    const buffer = Buffer.from(rawBase64, "base64");

    const safeEmail = userEmail.replace(/[^a-zA-Z0-9]/g, "_");
    const timestamp = Date.now();
    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "");
    const finalFilename = `${safeEmail}_${timestamp}_${cleanFilename}`;
    const isVideo = contentType.startsWith("video/");

    try {
      const { uploadToMediaBridge } = await import("../../../lib/wordpress/media-bridge.js");
      const mbResult = await uploadToMediaBridge({
        filename: finalFilename,
        buffer,
        userEmail,
      });
      console.log(`[UploadMedia] Successfully stored raw client media on Hosting Media Bridge: ${mbResult.url}`);
      return res.status(200).json({
        ok: true,
        url: mbResult.url,
        type: isVideo ? "video" : "image",
        name: filename,
        filePath: mbResult.fileName,
      });
    } catch (mbErr) {
      console.warn("[UploadMedia] Media Bridge fallback to Supabase:", mbErr.message);
      const filePath = `client_media/${finalFilename}`;
      const { error: uploadError } = await supabase.storage
        .from("instagram-creatives")
        .upload(filePath, buffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from("instagram-creatives")
        .getPublicUrl(filePath);

      return res.status(200).json({
        ok: true,
        url: publicData.publicUrl,
        type: isVideo ? "video" : "image",
        name: filename,
        filePath,
      });
    }
  } catch (err) {
    console.error("[UploadMedia] Error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Failed to upload media." });
  }
}
