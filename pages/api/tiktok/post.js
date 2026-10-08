// pages/api/tiktok/post.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email || "ndantare@gmail.com";

  const { caption, imageUrl, videoUrl, privacyLevel = "PUBLIC_TO_EVERYONE" } = req.body || {};

  if (!imageUrl && !videoUrl) {
    return res.status(400).json({ ok: false, error: "Missing imageUrl or videoUrl to post to TikTok." });
  }

  try {
    const { data: memRow } = await supabaseServer
      .from("agent_memory")
      .select("content")
      .eq("email", email)
      .eq("memory_type", "tiktok_connection")
      .maybeSingle();

    if (!memRow?.content) {
      return res.status(400).json({ ok: false, error: "TikTok account is not connected." });
    }

    const conn = JSON.parse(memRow.content);
    const accessToken = conn.accessToken;

    if (!accessToken) {
      return res.status(400).json({ ok: false, error: "TikTok access token missing or expired." });
    }

    // 1. Fetch Creator Info to determine allowed privacy levels
    let effectivePrivacy = privacyLevel || "SELF_ONLY";
    try {
      const creatorRes = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const creatorData = await creatorRes.json();
      const allowed = creatorData.data?.privacy_level_options;
      if (Array.isArray(allowed) && allowed.length > 0) {
        if (!allowed.includes(effectivePrivacy)) {
          console.log(`[TikTok Post] Privacy ${effectivePrivacy} not allowed. Using ${allowed[0]}`);
          effectivePrivacy = allowed[0];
        }
      } else {
        effectivePrivacy = "SELF_ONLY";
      }
    } catch (cErr) {
      console.warn("[TikTok Creator Info Check Warn]:", cErr);
      effectivePrivacy = "SELF_ONLY";
    }

    const titleText = (caption || "Bella & Diva Jewellery").slice(0, 85);
    const isVideo = Boolean(videoUrl);

    // Build photo list: TikTok Photo Carousel requires at least 2 images
    let photoImages = [];
    if (Array.isArray(req.body?.images) && req.body.images.length >= 2) {
      photoImages = req.body.images.filter(Boolean);
    } else if (imageUrl) {
      photoImages = [
        imageUrl,
        req.body?.image2Url || "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1080&q=80",
      ];
    } else {
      photoImages = [
        "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1080&q=80",
        "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1080&q=80",
      ];
    }

    // TikTok Content Posting API v2 endpoints:
    // Videos use /v2/post/publish/video/init/
    // Photos use /v2/post/publish/content/init/
    const targetEndpoint = isVideo
      ? "https://open.tiktokapis.com/v2/post/publish/video/init/"
      : "https://open.tiktokapis.com/v2/post/publish/content/init/";

    const postPayload = isVideo
      ? {
          post_info: {
            title: (caption || "Bella & Diva Jewellery").slice(0, 2000),
            privacy_level: effectivePrivacy,
            disable_comment: false,
            disable_duet: false,
            disable_stitch: false,
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: videoUrl,
          },
        }
      : {
          post_info: {
            title: titleText,
            description: caption || "",
            privacy_level: effectivePrivacy,
            disable_comment: false,
            auto_add_music: false,
          },
          source_info: {
            source: "PULL_FROM_URL",
            photo_cover_index: 1,
            photo_images: photoImages,
          },
          post_mode: "DIRECT_POST",
          media_type: "PHOTO",
        };

    const ttRes = await fetch(targetEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postPayload),
    });

    const ttData = await ttRes.json();
    if (!ttRes.ok || ttData.error?.code !== "ok") {
      console.error("[TikTok Publish Error]:", ttData);
      return res.status(400).json({
        ok: false,
        error: ttData.error?.message || "Failed to publish content to TikTok.",
        details: ttData,
      });
    }

    return res.status(200).json({
      ok: true,
      publishId: ttData.data?.publish_id,
      mediaType: isVideo ? "VIDEO" : "PHOTO",
      message: "Content successfully dispatched to TikTok!",
    });
  } catch (err) {
    console.error("[TikTok Publish Fatal Error]:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
