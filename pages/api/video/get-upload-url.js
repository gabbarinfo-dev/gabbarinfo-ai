// pages/api/video/get-upload-url.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

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

  const { filename = "master_reel.webm" } = req.body || {};

  try {
    const safeEmail = userEmail.replace(/[^a-zA-Z0-9]/g, "_");
    const timestamp = Date.now();
    const filePath = `reels/${safeEmail}_${timestamp}_${filename}`;

    const { data, error } = await supabase.storage
      .from("instagram-creatives")
      .createSignedUploadUrl(filePath);

    if (error) throw error;

    const { data: pubData } = supabase.storage
      .from("instagram-creatives")
      .getPublicUrl(filePath);

    return res.status(200).json({
      ok: true,
      signedUrl: data.signedUrl,
      publicUrl: pubData.publicUrl,
      filePath,
    });
  } catch (err) {
    console.error("[GetUploadUrl] Error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Failed to create signed upload URL." });
  }
}
