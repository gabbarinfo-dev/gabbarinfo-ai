// pages/api/wordpress/social-share.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import { executeFacebookPost } from "../../../lib/execute-facebook-post";

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

  const {
    platform = "facebook", // "facebook" | "instagram" | "both"
    title,
    postUrl,
    featuredImageUrl,
    caption,
    hashtags = "#DigitalMarketing #SEO #BusinessGrowth #GABBARinfo",
  } = req.body;

  if (!postUrl) {
    return res.status(400).json({ ok: false, error: "Blog post URL is required" });
  }

  try {
    // 1. Check Meta Connection
    const { data: meta, error: metaErr } = await supabase
      .from("meta_connections")
      .select("fb_page_id, fb_page_access_token, fb_user_access_token, instagram_actor_id, ig_business_id")
      .eq("email", userEmail.toLowerCase())
      .single();

    if (!meta || (!meta.fb_user_access_token && !meta.fb_page_access_token)) {
      return res.status(200).json({
        ok: false,
        require_connect: true,
        message: "Your Facebook account is not connected yet. Please connect Facebook to share this post.",
      });
    }

    const results = {};

    // 2. Share to Facebook Page
    if (platform === "facebook" || platform === "both") {
      try {
        const fullMessage = `${title ? `📢 ${title}\n\n` : ""}${caption ? `${caption}\n\n` : ""}Read full article here 👇\n${postUrl}\n\n${hashtags}`;
        const fbRes = await executeFacebookPost({
          userEmail,
          imageUrl: featuredImageUrl,
          caption: fullMessage,
          targetPlatform: "facebook",
        });
        results.facebook = { ok: true, id: fbRes?.id };
      } catch (fbErr) {
        console.error("Facebook share error:", fbErr.message);
        results.facebook = { ok: false, error: fbErr.message };
      }
    }

    // 3. Share to Instagram
    if (platform === "instagram" || platform === "both") {
      const igId = meta.instagram_actor_id || meta.ig_business_id;
      if (!igId) {
        results.instagram = { ok: false, error: "No connected Instagram business account found." };
      } else if (!featuredImageUrl) {
        results.instagram = { ok: false, error: "Instagram requires an image to publish a post." };
      } else {
        try {
          const API_VERSION = "v21.0";
          const token = meta.fb_page_access_token || meta.fb_user_access_token;
          const igCaption = `${title ? `✨ ${title}\n\n` : ""}${caption ? `${caption}\n\n` : ""}🔗 Read the complete guide on our website: ${postUrl}\n\n${hashtags}`;

          // Step A: Create container
          const containerUrl = `https://graph.facebook.com/${API_VERSION}/${igId}/media`;
          const cParams = new URLSearchParams();
          cParams.append("image_url", featuredImageUrl);
          cParams.append("caption", igCaption);
          cParams.append("access_token", token);

          const cRes = await fetch(containerUrl, { method: "POST", body: cParams });
          const cJson = await cRes.json();

          if (!cRes.ok || !cJson?.id) {
            throw new Error(cJson.error?.message || "Failed to create Instagram container");
          }

          // Step B: Publish container
          const publishUrl = `https://graph.facebook.com/${API_VERSION}/${igId}/media_publish`;
          const pParams = new URLSearchParams();
          pParams.append("creation_id", cJson.id);
          pParams.append("access_token", token);

          const pRes = await fetch(publishUrl, { method: "POST", body: pParams });
          const pJson = await pRes.json();

          if (!pRes.ok || !pJson?.id) {
            throw new Error(pJson.error?.message || "Failed to publish Instagram post");
          }

          results.instagram = { ok: true, id: pJson.id };
        } catch (igErr) {
          console.error("Instagram share error:", igErr.message);
          results.instagram = { ok: false, error: igErr.message };
        }
      }
    }

    return res.status(200).json({
      ok: true,
      results,
    });
  } catch (err) {
    console.error("Social share error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
