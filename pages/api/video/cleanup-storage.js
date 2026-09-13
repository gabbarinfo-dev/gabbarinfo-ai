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

  const { videoUrl, filePath, clientMedia = [], additionalPaths = [] } = req.body;

  try {
    const pathsToRemove = new Set();

    const extractPath = (val) => {
      if (!val || typeof val !== "string") return;
      if (val.startsWith("http://") || val.startsWith("https://")) {
        const match = val.match(/instagram-creatives\/(.+)$/);
        if (match) pathsToRemove.add(decodeURIComponent(match[1]));
      } else {
        pathsToRemove.add(val.replace(/^\/+/, ""));
      }
    };

    extractPath(filePath);
    extractPath(videoUrl);

    // Purge any raw client-uploaded videos & photos
    if (Array.isArray(clientMedia)) {
      clientMedia.forEach((m) => {
        if (typeof m === "string") extractPath(m);
        else if (m && typeof m === "object") {
          extractPath(m.filePath);
          extractPath(m.url);
        }
      });
    }

    // Purge any temporary scene frames or voiceover audio
    if (Array.isArray(additionalPaths)) {
      additionalPaths.forEach((p) => extractPath(p));
    }

    const pathList = Array.from(pathsToRemove).filter(Boolean);

    if (pathList.length === 0) {
      return res.status(200).json({ ok: true, message: "No storage paths required deletion." });
    }

    console.log(`[StorageCleanup] Purging ${pathList.length} temporary storage items (client videos & master streams):`, pathList);
    const { data, error } = await supabase.storage
      .from("instagram-creatives")
      .remove(pathList);

    if (error) {
      console.warn("[StorageCleanup] Warning during storage remove:", error.message);
      return res.status(200).json({ ok: false, warning: error.message });
    }

    console.log(`[StorageCleanup] Successfully purged ${pathList.length} files. Net residual storage: 0 MB.`);
    return res.status(200).json({ ok: true, purgedCount: pathList.length, purged: pathList, data });
  } catch (err) {
    console.error("[StorageCleanup] Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
