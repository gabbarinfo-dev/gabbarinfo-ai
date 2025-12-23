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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }
const session = await getServerSession(req, res, authOptions);
if (!session?.user?.email) {
  return res.status(401).json({ ok: false, message: "Unauthorized" });
}

const { data: meta, error } = await supabase
  .from("meta_connections")
  .select("fb_ad_account_id, system_user_token")
  .eq("email", session.user.email.toLowerCase())
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
    const { imageUrl } = req.body || {};

    if (!imageUrl || typeof imageUrl !== "string") {
      return res
        .status(400)
        .json({ ok: false, message: "imageUrl (public URL) is required in JSON body." });
    }

    // POST to: https://graph.facebook.com/v16.0/act_{ad_account_id}/adimages
    // send body as application/x-www-form-urlencoded with `url` param (public image)
    const graphUrl = `https://graph.facebook.com/v16.0/act_${AD_ACCOUNT_ID}/adimages`;

    const params = new URLSearchParams();
    params.append("url", imageUrl);
    params.append("access_token", ACCESS_TOKEN);

    const resp = await fetch(graphUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const json = await resp.json();

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
