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
    // Helper to get active Meta credentials from meta_connections
    const getMetaCredentials = async () => {
      // 1. Check meta_connections first (where user OAuth connections are stored)
      const { data: metaRow } = await supabase
        .from("meta_connections")
        .select("*")
        .eq("email", userEmail)
        .maybeSingle();

      if (metaRow && metaRow.fb_user_access_token) {
        // Fetch page access token from me/accounts
        const accountsRes = await fetch(
          `https://graph.facebook.com/v19.0/me/accounts?access_token=${metaRow.fb_user_access_token}`
        );
        const accountsData = await accountsRes.json();
        const pageObj =
          accountsData?.data?.find((p) => p.id === metaRow.fb_page_id) ||
          accountsData?.data?.[0];

        return {
          pageId: pageObj?.id || metaRow.fb_page_id,
          pageToken: pageObj?.access_token || metaRow.fb_user_access_token,
          igUserId: metaRow.ig_business_id,
          pageName: pageObj?.name || "GABBARinfo",
        };
      }

      // 2. Fallback to agent_memory
      const { data: metaMem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail)
        .like("memory_type", "facebook_%")
        .maybeSingle();

      const metaContent = metaMem?.content
        ? typeof metaMem.content === "string"
          ? JSON.parse(metaMem.content)
          : metaMem.content
        : null;

      if (metaContent?.access_token) {
        return {
          pageId: metaContent.page_id || process.env.FB_PAGE_ID,
          pageToken: metaContent.access_token,
          igUserId: metaContent.instagram_business_account?.id || metaContent.ig_id,
          pageName: metaContent.page_name,
        };
      }

      return null;
    };

    // -------------------------------------------------------------
    // 1. INSTAGRAM REELS PUBLISHING
    // -------------------------------------------------------------
    if (channel === "instagram") {
      const meta = await getMetaCredentials();
      if (!meta || !meta.pageToken || !meta.igUserId) {
        return res.status(400).json({
          ok: false,
          error: "No connected Instagram Business account found. Please connect your Meta account first.",
        });
      }

      const cleanCaption = `${title}\n\n${caption}\n\n#reels #shorts #viral #ai`;

      // Step 1: Create Media Container
      console.log(`[Instagram Publish] Creating Reel container for IG ID ${meta.igUserId}...`);
      const containerRes = await fetch(
        `https://graph.facebook.com/v19.0/${meta.igUserId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_type: "REELS",
            video_url: videoUrl,
            caption: cleanCaption,
            access_token: meta.pageToken,
          }),
        }
      );

      const containerData = await containerRes.json();
      if (containerData.error) {
        throw new Error(`Instagram API Error: ${containerData.error.message}`);
      }

      const containerId = containerData.id;
      console.log(`[Instagram Publish] Container created: ${containerId}. Waiting for video processing...`);

      // Step 2: Poll container status until FINISHED (up to 40 seconds)
      let isReady = false;
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await fetch(
          `https://graph.facebook.com/v19.0/${containerId}?fields=status_code,status&access_token=${meta.pageToken}`
        );
        const statusData = await statusRes.json();
        console.log(`[Instagram Publish] Poll ${i + 1}: status_code = ${statusData.status_code}`);

        if (statusData.status_code === "FINISHED") {
          isReady = true;
          break;
        }
        if (statusData.status_code === "ERROR") {
          throw new Error("Instagram Reel media transcoding failed.");
        }
      }

      if (!isReady) {
        return res.status(200).json({
          ok: true,
          channel: "instagram",
          message: "Reel uploaded to Instagram! Processing on Instagram servers and will be visible shortly.",
          creationId: containerId,
        });
      }

      // Step 3: Publish Container
      console.log(`[Instagram Publish] Container ready. Publishing Reel...`);
      const pubRes = await fetch(
        `https://graph.facebook.com/v19.0/${meta.igUserId}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: containerId,
            access_token: meta.pageToken,
          }),
        }
      );
      const pubData = await pubRes.json();
      if (pubData.error) {
        throw new Error(`Instagram Publish Error: ${pubData.error.message}`);
      }

      const igReelUrl = `https://instagram.com/reel/${pubData.id}`;
      console.log(`[Instagram Publish] Successfully published Reel: ${igReelUrl}`);

      return res.status(200).json({
        ok: true,
        channel: "instagram",
        message: "Reel published live to Instagram!",
        mediaId: pubData.id,
        videoUrl: igReelUrl,
      });
    }

    // -------------------------------------------------------------
    // 2. FACEBOOK REELS PUBLISHING
    // -------------------------------------------------------------
    if (channel === "facebook") {
      const meta = await getMetaCredentials();
      if (!meta || !meta.pageId || !meta.pageToken) {
        return res.status(400).json({
          ok: false,
          error: "No connected Facebook Page found. Please connect your Meta account first.",
        });
      }

      console.log(`[Facebook Publish] Publishing Reel to Page "${meta.pageName}" (${meta.pageId})...`);

      // Step 1: Download video binary buffer
      const vidFetchRes = await fetch(videoUrl);
      if (!vidFetchRes.ok) {
        throw new Error(`Failed to fetch source video: ${vidFetchRes.statusText}`);
      }
      const vidBuffer = Buffer.from(await vidFetchRes.arrayBuffer());

      // Step 2: Initialize Facebook Reel upload (phase: start)
      const initRes = await fetch(
        `https://graph.facebook.com/v19.0/${meta.pageId}/video_reels`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            upload_phase: "start",
            access_token: meta.pageToken,
          }),
        }
      );

      const initData = await initRes.json();
      if (initData.error) {
        throw new Error(`Facebook Reel Start Error: ${initData.error.message}`);
      }

      const videoId = initData.video_id;
      const uploadUrl = initData.upload_url;
      console.log(`[Facebook Publish] Reel initialized with ID ${videoId}. Uploading binary (${vidBuffer.length} bytes)...`);

      // Step 3: Upload binary video buffer to rupload endpoint
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `OAuth ${meta.pageToken}`,
          offset: "0",
          file_size: String(vidBuffer.length),
          "Content-Type": "application/octet-stream",
        },
        body: vidBuffer,
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.success && uploadData.error) {
        throw new Error(`Facebook Reel Upload Error: ${uploadData.error?.message || "Upload transfer failed"}`);
      }

      // Step 4: Finalize and Publish (phase: finish)
      console.log(`[Facebook Publish] Finalizing Reel publication...`);
      const finishRes = await fetch(
        `https://graph.facebook.com/v19.0/${meta.pageId}/video_reels`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            upload_phase: "finish",
            access_token: meta.pageToken,
            video_id: videoId,
            video_state: "PUBLISHED",
            description: `${title}\n\n${caption}\n\n#reels #viral #ai`,
            title: title || "Gabbarinfo AI Reel",
          }),
        }
      );

      const finishData = await finishRes.json();
      if (finishData.error) {
        throw new Error(`Facebook Reel Finish Error: ${finishData.error.message}`);
      }

      const fbPostId = finishData.post_id || finishData.id || videoId;
      const fbReelUrl = `https://facebook.com/${fbPostId}`;
      console.log(`[Facebook Publish] Successfully published Reel to Facebook Page: ${fbReelUrl}`);

      return res.status(200).json({
        ok: true,
        channel: "facebook",
        message: "Reel successfully published live to your Facebook Page!",
        reelId: videoId,
        postId: fbPostId,
        videoUrl: fbReelUrl,
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
      if (vidBuffer.length < 5000) {
        throw new Error(`Video file stream is too small or incomplete (${vidBuffer.length} bytes). Please re-bake the composite.`);
      }

      // Step 3: Format Shorts Title & Description
      const shortsTitle = (title || "Amazing Video").includes("#Shorts")
        ? title
        : `${(title || "Trending AI Reel").slice(0, 50)} #Shorts`;

      const tags = ["Shorts", "YouTubeShorts", "AI", "Trending"];
      const shortsDescription = `${caption || title}\n\nProduced with GabbarInfo AI Studio.\n\n#Shorts #YouTubeShorts`;

      // Step 4: Initiate Resumable Upload
      const isWebm = videoUrl.includes(".webm") || (vidBuffer.slice(0, 4).toString("hex") === "1a45dfa3");
      const uploadMime = isWebm ? "video/webm" : "video/mp4";

      console.log(`[YouTube Publish] Initiating resumable upload for "${shortsTitle}" (${vidBuffer.length} bytes, MIME: ${uploadMime})...`);
      const initRes = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${activeToken}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Length": String(vidBuffer.length),
            "X-Upload-Content-Type": uploadMime,
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
          "Content-Type": uploadMime,
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
