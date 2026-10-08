// pages/api/tiktok/post.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;

  if (!email) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

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

    const titleText = (caption || "GabbarInfo AI Creative Post").slice(0, 150);
    const isVideo = Boolean(videoUrl);

    // TikTok Content Posting API v2 endpoint
    const postPayload = isVideo
      ? {
          post_info: {
            title: titleText,
            privacy_level: privacyLevel,
            disable_comment: false,
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: videoUrl,
          },
          post_mode: "DIRECT_POST",
          media_type: "VIDEO",
        }
      : {
          post_info: {
            title: titleText,
            description: caption || "",
            privacy_level: privacyLevel,
            disable_comment: false,
          },
          source_info: {
            source: "PULL_FROM_URL",
            photo_cover_index: 1,
            photo_images: [imageUrl],
          },
          post_mode: "DIRECT_POST",
          media_type: "PHOTO",
        };

    const ttRes = await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", {
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
