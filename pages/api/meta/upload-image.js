// pages/api/meta/upload-image.js
// Upload a publicly-hosted image (imageUrl) to the Facebook Ad Account
// and return the image_hash that can be used in ad creatives.
//

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
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
  .select("fb_ad_account_id, system_user_token")
  .eq("email", clientEmail)
  .single();

if (error || !meta?.fb_ad_account_id || !meta?.system_user_token) {
  return res.status(400).json({
    ok: false,
    message: "Meta ad account not connected for this user.",
  });
}

const AD_ACCOUNT_ID = meta.fb_ad_account_id;
const ACCESS_TOKEN = meta.system_user_token;

try {
  const { imageUrl, imageBase64 } = req.body || {};

  if (!imageUrl && !imageBase64) {
    return res.status(400).json({
      ok: false,
      message: "Either imageUrl or imageBase64 is required in JSON body.",
    });
  }

  const graphUrl = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/adimages`;
 
  let resp;
  if (imageUrl) {
    const params = new URLSearchParams();
    params.append("url", imageUrl);
    params.append("access_token", ACCESS_TOKEN);
    resp = await fetch(graphUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } else {
    const buffer = Buffer.from(imageBase64, "base64");
    const blob = new Blob([buffer], { type: "image/png" });
    const form = new FormData();
    form.append("bytes", blob, "image.png");
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
      console.error("FB adimages error:", json);
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
