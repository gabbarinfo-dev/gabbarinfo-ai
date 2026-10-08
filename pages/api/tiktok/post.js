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

  const { caption, imageUrl, images, videoUrl, privacyLevel = "PUBLIC_TO_EVERYONE" } = req.body || {};

  const hasPhotos = Array.isArray(images) ? images.length > 0 : Boolean(imageUrl);
  if (!hasPhotos && !videoUrl) {
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
    let rawPhotoImages = [];
    if (Array.isArray(req.body?.images) && req.body.images.length >= 2) {
      rawPhotoImages = req.body.images.filter(Boolean);
    } else if (imageUrl) {
      rawPhotoImages = [
        imageUrl,
        req.body?.image2Url || "https://ai.gabbarinfo.com/media/jewellery/slide2.jpg",
      ];
    } else {
      rawPhotoImages = [
        "https://ai.gabbarinfo.com/media/jewellery/slide1.jpg",
        "https://ai.gabbarinfo.com/media/jewellery/slide2.jpg",
      ];
    }

    // MANDATORY TIKTOK RULE: PULL_FROM_URL strictly enforces that all media URLs
    // belong to the verified domain (https://ai.gabbarinfo.com).
    const verifiedDomain = "https://ai.gabbarinfo.com";
    const photoImages = rawPhotoImages.map((imgUrl, idx) => {
      if (typeof imgUrl === "string" && imgUrl.startsWith(verifiedDomain)) {
        return imgUrl;
      }
      return `${verifiedDomain}/api/tiktok/media-serve?url=${encodeURIComponent(imgUrl)}&slide=${idx + 1}`;
    });

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

      const rawMsg = ttData.error?.message || "";
      const rawCode = ttData.error?.code || "";
      let friendlyError = rawMsg || "Failed to publish content to TikTok.";

      if (
        rawCode === "unaudited_client_can_only_post_to_private_accounts" ||
        rawMsg.includes("content-sharing-guidelines") ||
        rawMsg.toLowerCase().includes("unaudited")
      ) {
        friendlyError =
          "TikTok Sandbox Policy: Before TikTok approves the app, TikTok strictly requires the connected TikTok account (@indianbellandiva) to be set to 'Private Account' in the mobile app. Please open TikTok on your phone > Profile > Settings & Privacy > Privacy > Toggle 'Private account' ON, then click Publish again.";
      }

      return res.status(400).json({
        ok: false,
        error: friendlyError,
        rawCode,
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
