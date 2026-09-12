// pages/api/video/upload-composite.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "30mb",
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
    return res.status(401).json({ ok: false, error: "Please log in to upload video." });
  }

  const { videoBase64, filename = "reel.webm", contentType = "video/webm" } = req.body || {};

  if (!videoBase64) {
    return res.status(400).json({ ok: false, error: "Missing videoBase64 data." });
  }

  try {
    const base64Marker = ";base64,";
    const base64Index = videoBase64.indexOf(base64Marker);
    const rawBase64 = base64Index !== -1 ? videoBase64.slice(base64Index + base64Marker.length) : videoBase64.replace(/^data:.*?;base64,/, "");
    const buffer = Buffer.from(rawBase64, "base64");

    if (buffer.length < 5000) {
      console.error(`[VideoCompositor] Corrupted payload: buffer length only ${buffer.length} bytes.`);
      return res.status(400).json({ ok: false, error: `Corrupted video payload (only ${buffer.length} bytes received).` });
    }

    const safeEmail = userEmail.replace(/[^a-zA-Z0-9]/g, "_");
    const timestamp = Date.now();
    const filePath = `reels/${safeEmail}_${timestamp}_${filename}`;

    console.log(`[VideoCompositor] Uploading composite video (${buffer.length} bytes) to Supabase Storage: ${filePath}`);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("instagram-creatives")
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = supabase.storage
      .from("instagram-creatives")
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;
    console.log(`[VideoCompositor] Successfully stored composite video at: ${publicUrl}`);

    return res.status(200).json({
      ok: true,
      videoUrl: publicUrl,
      sizeBytes: buffer.length,
    });
  } catch (err) {
    console.error("[VideoCompositor] Storage upload error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Failed to save video composite." });
  }
}
