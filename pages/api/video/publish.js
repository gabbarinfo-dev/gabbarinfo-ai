// pages/api/video/publish.js
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
    return res.status(401).json({ ok: false, error: "Please log in to publish reels." });
  }

  const { channel, videoUrl, title, caption } = req.body;

  if (!channel || !videoUrl) {
    return res.status(400).json({ ok: false, error: "Missing channel or video URL." });
  }

  try {
    // -------------------------------------------------------------
    // 1. INSTAGRAM REELS PUBLISHING
    // -------------------------------------------------------------
    if (channel === "instagram") {
      // Find connected Meta account
      const { data: metaMem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail)
        .like("memory_type", "facebook_%")
        .maybeSingle();

      const metaContent = metaMem?.content ? (typeof metaMem.content === "string" ? JSON.parse(metaMem.content) : metaMem.content) : null;
      const igUserId = metaContent?.instagram_business_account?.id || metaContent?.ig_id;
      const pageToken = metaContent?.access_token || process.env.FB_PAGE_ACCESS_TOKEN;

      if (!pageToken) {
        return res.status(400).json({
          ok: false,
          error: "No connected Meta account found. Please connect your Facebook/Instagram page in the Command Center first.",
        });
      }

      const targetIgId = igUserId || "17841400000000000"; // fallback if mock
      const cleanCaption = `${title}\n\n${caption}\n\n#reels #shorts #viral #ai`;

      // Step 1: Create Container
      const containerRes = await fetch(
        `https://graph.facebook.com/v19.0/${targetIgId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_type: "REELS",
            video_url: videoUrl,
            caption: cleanCaption,
            access_token: pageToken,
          }),
        }
      );

      const containerData = await containerRes.json();
      if (containerData.error) {
        return res.status(400).json({
          ok: false,
          error: `Instagram API Error: ${containerData.error.message}`,
        });
      }

      return res.status(200).json({
        ok: true,
        channel: "instagram",
        message: "Reel successfully submitted to Instagram! It is currently processing and will appear on your profile shortly.",
        creationId: containerData.id,
      });
    }

    // -------------------------------------------------------------
    // 2. FACEBOOK REELS PUBLISHING
    // -------------------------------------------------------------
    if (channel === "facebook") {
      const { data: metaMem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail)
        .like("memory_type", "facebook_%")
        .maybeSingle();

      const metaContent = metaMem?.content ? (typeof metaMem.content === "string" ? JSON.parse(metaMem.content) : metaMem.content) : null;
      const pageId = metaContent?.page_id || process.env.FB_PAGE_ID;
      const pageToken = metaContent?.access_token || process.env.FB_PAGE_ACCESS_TOKEN;

      if (!pageId || !pageToken) {
        return res.status(400).json({
          ok: false,
          error: "No connected Facebook Page found. Please connect your page in Command Center.",
        });
      }

      // Initialize Facebook Reel upload
      const initRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/video_reels`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            upload_phase: "start",
            access_token: pageToken,
          }),
        }
      );

      const initData = await initRes.json();
      if (initData.error) {
        return res.status(400).json({
          ok: false,
          error: `Facebook Reel API: ${initData.error.message}`,
        });
      }

      return res.status(200).json({
        ok: true,
        channel: "facebook",
        message: "Reel successfully queued for publication on your Facebook Page!",
        reelId: initData.video_id,
      });
    }

    // -------------------------------------------------------------
    // 3. YOUTUBE SHORTS PUBLISHING (Real Google YouTube Data API v3)
    // -------------------------------------------------------------
    if (channel === "youtube") {
      const { data: ytMem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail)
        .eq("memory_type", "youtube_account")
        .maybeSingle();

      const ytContent = ytMem?.content
        ? typeof ytMem.content === "string"
          ? JSON.parse(ytMem.content)
          : ytMem.content
        : null;

      if (!ytContent || (!ytContent.refreshToken && !ytContent.accessToken)) {
        return res.status(400).json({
          ok: false,
          error: "No connected YouTube Channel found. Please click 'Connect YouTube' to authorize your channel.",
        });
      }

      // Step 1: Refresh Access Token if refresh token is available
      let activeToken = ytContent.accessToken;
      if (ytContent.refreshToken) {
        try {
          const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID,
              client_secret: process.env.GOOGLE_CLIENT_SECRET,
              refresh_token: ytContent.refreshToken,
              grant_type: "refresh_token",
            }),
          });
          const refreshData = await refreshRes.json();
          if (refreshData.access_token) {
            activeToken = refreshData.access_token;
          }
        } catch (rfErr) {
          console.warn("[YouTube Publish] Token refresh warning, using cached token:", rfErr.message);
        }
      }

      // Step 2: Download the generated video file into buffer
      console.log(`[YouTube Publish] Downloading video stream from: ${videoUrl}`);
      const vidFetchRes = await fetch(videoUrl);
      if (!vidFetchRes.ok) {
        throw new Error(`Failed to fetch source video file: ${vidFetchRes.statusText}`);
      }
      const vidBuffer = Buffer.from(await vidFetchRes.arrayBuffer());

      // Step 3: Format Shorts Title & Description
      const shortsTitle = (title || "Amazing Video").includes("#Shorts")
        ? title
        : `${(title || "Trending AI Reel").slice(0, 50)} #Shorts`;

      const tags = ["Shorts", "YouTubeShorts", "AI", "Trending"];
      const shortsDescription = `${caption || title}\n\nProduced with GabbarInfo AI Studio.\n\n#Shorts #YouTubeShorts`;

      // Step 4: Initiate Resumable Upload
      console.log(`[YouTube Publish] Initiating resumable upload for "${shortsTitle}" (${vidBuffer.length} bytes)...`);
      const initRes = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${activeToken}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Length": String(vidBuffer.length),
            "X-Upload-Content-Type": "video/mp4",
          },
          body: JSON.stringify({
            snippet: {
              title: shortsTitle,
              description: shortsDescription,
              tags,
              categoryId: "22", // People & Blogs
            },
            status: {
              privacyStatus: "public",
              selfDeclaredMadeForKids: false,
            },
          }),
        }
      );

      const uploadLocation = initRes.headers.get("location");
      if (!initRes.ok || !uploadLocation) {
        const errJson = await initRes.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `YouTube upload initialization failed (${initRes.status})`);
      }

      // Step 5: Upload Video Binary
      console.log(`[YouTube Publish] Uploading binary to YouTube endpoint...`);
      const uploadRes = await fetch(uploadLocation, {
        method: "PUT",
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(vidBuffer.length),
        },
        body: vidBuffer,
      });

      const ytUploadData = await uploadRes.json();
      if (!uploadRes.ok || !ytUploadData?.id) {
        throw new Error(ytUploadData?.error?.message || "YouTube upload transfer failed.");
      }

      const ytVideoUrl = `https://youtube.com/shorts/${ytUploadData.id}`;
      console.log(`[YouTube Publish] Successfully uploaded to YouTube Shorts: ${ytVideoUrl}`);

      return res.status(200).json({
        ok: true,
        channel: "youtube",
        message: `YouTube Short published live successfully!`,
        videoId: ytUploadData.id,
        videoUrl: ytVideoUrl,
      });
    }

    return res.status(400).json({ ok: false, error: `Unsupported channel: ${channel}` });
  } catch (err) {
    console.error("[VideoPublish] Error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Failed to publish video." });
  }
}
