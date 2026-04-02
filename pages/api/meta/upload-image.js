// pages/api/meta/upload-image.js
// Upload a publicly-hosted image (imageUrl) to the Facebook Ad Account
// and return the image_hash that can be used in ad creatives.
//

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }
  const session = await getServerSession(req, res, authOptions);
  const headerEmail = req.headers["x-client-email"];
  const clientEmail =
    (session?.user?.email && session.user.email.toLowerCase()) ||
    (typeof headerEmail === "string" ? headerEmail.toLowerCase() : null);
  if (!clientEmail) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }

  const { data: meta, error } = await supabase
    .from("meta_connections")
    .select("fb_ad_account_id")
    .eq("email", clientEmail)
    .single();

  if (error || !meta?.fb_ad_account_id) {
    return res.status(400).json({
      ok: false,
      message: "Meta ad account not connected for this user.",
    });
  }

  const AD_ACCOUNT_ID = (meta.fb_ad_account_id || "").toString().replace(/^act_/, "");
  const ACCESS_TOKEN = process.env.META_SYSTEM_USER_TOKEN;

  try {
    const { imageUrl, imageBase64 } = req.body || {};

    if (!imageUrl && !imageBase64) {
      return res.status(400).json({
        ok: false,
        message: "Either imageUrl or imageBase64 is required in JSON body.",
      });
    }

    const graphUrl = `https://graph.facebook.com/v24.0/act_${AD_ACCOUNT_ID}/adimages`;

    let resp;
    if (imageUrl) {
      // 🔧 FIX: Fetch the image server-side and upload as multipart (source field).
      // Using Meta's url= parameter requires extra app capabilities that the system
      // user token doesn't have → causes (#3) OAuthException.
      // Fetching and re-uploading ourselves uses the same path as AI-generated images.
      console.log(`🖼️ [upload-image] Fetching user-provided image from URL: ${imageUrl}`);
      let imageBuffer;
      try {
        const fetchRes = await fetch(imageUrl);
        if (!fetchRes.ok) {
          return res.status(400).json({
            ok: false,
            message: `Failed to fetch image from the provided URL (HTTP ${fetchRes.status}). Please ensure the URL is publicly accessible.`,
          });
        }
        const arrayBuffer = await fetchRes.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      } catch (fetchErr) {
        return res.status(400).json({
          ok: false,
          message: `Could not download image from the provided URL: ${fetchErr.message}`,
        });
      }

      if (!imageBuffer || imageBuffer.length < 1024) {
        return res.status(400).json({
          ok: false,
          message: "The image at the provided URL is too small or invalid.",
          details: { size_bytes: imageBuffer?.length || 0 },
        });
      }

      // Determine content type from URL extension
      const lowerUrl = imageUrl.toLowerCase().split("?")[0];
      const contentType = lowerUrl.endsWith(".jpg") || lowerUrl.endsWith(".jpeg")
        ? "image/jpeg"
        : "image/png";
      const fileName = lowerUrl.endsWith(".jpg") || lowerUrl.endsWith(".jpeg")
        ? "user-image.jpg"
        : "user-image.png";

      console.log(`🖼️ [upload-image] Uploading fetched image as multipart: ${fileName} (${imageBuffer.length} bytes)`);
      const blob = new Blob([imageBuffer], { type: contentType });
      const form = new FormData();
      form.append("source", blob, fileName);
      form.append("access_token", ACCESS_TOKEN);
      resp = await fetch(graphUrl, {
        method: "POST",
        body: form,
      });
    } else {
      const cleaned = imageBase64
        .toString()
        .replace(/^data:image\/\w+;base64,/, "")
        .replace(/\s+/g, "");
      const rawBuffer = Buffer.from(cleaned, "base64");
      if (!rawBuffer || rawBuffer.length < 1024) {
        return res.status(400).json({
          ok: false,
          message: "Generated image looks invalid or too small for upload.",
          details: { size_bytes: rawBuffer?.length || 0 },
        });
      }

      // ✅ Convert to JPEG q85 via sharp — PNG at 1024×1024 can be 3-5 MB,
      // which sometimes causes Meta upload failures. JPEG stays under 500 KB.
      let buffer;
      try {
        buffer = await sharp(rawBuffer)
          .resize(1080, 1080, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();
        console.log(`🖼️ [upload-image] Converted to JPEG: ${buffer.length} bytes (was ${rawBuffer.length} bytes PNG)`);
      } catch (convertErr) {
        console.warn("⚠️ [upload-image] JPEG conversion failed, using raw buffer:", convertErr.message);
        buffer = rawBuffer;
      }

      const blob = new Blob([buffer], { type: "image/jpeg" });
      const form = new FormData();
      // Use 'source' for file uploads per Graph API conventions
      form.append("source", blob, "creative.jpg");
      form.append("access_token", ACCESS_TOKEN);
      resp = await fetch(graphUrl, {
        method: "POST",
        body: form,
      });
    }

    let json;
    try {
      json = await resp.json();
    } catch (_) {
      const txt = await resp.text();
      json = { raw: txt };
    }

    if (!resp.ok) {
      // Facebook returns 400/400-like errors in JSON. Forward them.
      console.error("❌ FB adimages error (HTTP", resp.status, "):", JSON.stringify(json, null, 2));
      return res.status(resp.status || 500).json({
        ok: false,
        message: "Facebook API returned an error during image upload.",
        details: json,
      });
    }

    // Success payload shape:
    // { images: { "<filename_or_hash>": { hash: "IMAGE_HASH", url: "..."} } }
    if (!json || !json.images) {
      return res.status(500).json({
        ok: false,
        message: "Unexpected response from Facebook when uploading image.",
        details: json,
      });
    }

    // Take the first image hash returned
    const imageKeys = Object.keys(json.images || {});
    if (imageKeys.length === 0) {
      return res.status(500).json({
        ok: false,
        message: "No image hashes returned by Facebook.",
        details: json,
      });
    }

    const firstKey = imageKeys[0];
    const imageHash = json.images[firstKey]?.hash;

    if (!imageHash) {
      return res.status(500).json({
        ok: false,
        message: "Image hash missing in Facebook response.",
        details: json,
      });
    }

    // Return the image_hash to caller
    return res.status(200).json({
      ok: true,
      imageHash,
      raw: json,
    });
  } catch (err) {
    console.error("Unexpected error in /api/meta/upload-image:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error while uploading image to Facebook.",
      error: err.message || String(err),
    });
  }
}
