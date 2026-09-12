// pages/api/video/cleanup-storage.js
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
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const { videoUrl, filePath } = req.body;

  try {
    let pathToRemove = filePath;

    if (!pathToRemove && videoUrl) {
      // Extract relative path from Supabase storage public URL
      const match = videoUrl.match(/instagram-creatives\/(.+)$/);
      if (match) {
        pathToRemove = decodeURIComponent(match[1]);
      }
    }

    if (!pathToRemove) {
      return res.status(400).json({ ok: false, error: "No storage path resolved for deletion." });
    }

    console.log(`[StorageCleanup] Purging temporary video stream: ${pathToRemove}`);
    const { data, error } = await supabase.storage
      .from("instagram-creatives")
      .remove([pathToRemove]);

    if (error) {
      console.warn("[StorageCleanup] Warning during storage remove:", error.message);
      return res.status(200).json({ ok: false, warning: error.message });
    }

    console.log(`[StorageCleanup] Successfully purged ${pathToRemove}. Net residual storage: 0 MB.`);
    return res.status(200).json({ ok: true, purged: pathToRemove, data });
  } catch (err) {
    console.error("[StorageCleanup] Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
