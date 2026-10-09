// pages/api/linkedin/post.js
import axios from "axios";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";
import { PDFDocument } from "pdf-lib";

async function assemblePdfFromImages(imageUrls) {
  const pdfDoc = await PDFDocument.create();
  for (const url of imageUrls) {
    if (!url || typeof url !== "string") continue;
    try {
      const imgRes = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 15000,
      });
      const imgBuffer = Buffer.from(imgRes.data);
      const contentType = (imgRes.headers["content-type"] || "").toLowerCase();
      let embeddedImage;

      if (contentType.includes("png") || url.toLowerCase().endsWith(".png")) {
        try {
          embeddedImage = await pdfDoc.embedPng(imgBuffer);
        } catch (_) {
          embeddedImage = await pdfDoc.embedJpg(imgBuffer);
        }
      } else {
        try {
          embeddedImage = await pdfDoc.embedJpg(imgBuffer);
        } catch (_) {
          embeddedImage = await pdfDoc.embedPng(imgBuffer);
        }
      }

      if (embeddedImage) {
        const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: embeddedImage.width,
          height: embeddedImage.height,
        });
      }
    } catch (slideErr) {
      console.warn("[PDF Carousel Slide Warning]: Failed to embed image", url, slideErr.message);
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;

  if (!email) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const {
    commentary,
    imageUrl,
    videoUrl,
    documentUrl,
    carouselUrls,
    targetUrn,
    title,
  } = req.body || {};

  if (!commentary || !commentary.trim()) {
    return res.status(400).json({ ok: false, error: "Post commentary text cannot be empty." });
  }

  try {
    // 1. Retrieve stored LinkedIn connection
    const { data: memRow, error: memErr } = await supabaseServer
      .from("agent_memory")
      .select("content")
      .eq("email", email)
      .eq("memory_type", "linkedin_connection")
      .maybeSingle();

    if (memErr || !memRow?.content) {
      return res.status(400).json({
        ok: false,
        error: "LinkedIn account is not connected. Please connect your LinkedIn account first.",
      });
    }

    const conn = JSON.parse(memRow.content);
    const isTargetOrg = targetUrn && targetUrn.startsWith("urn:li:organization:");
    const activeToken = isTargetOrg
      ? (conn?.pageAccessToken || conn?.accessToken)
      : (conn?.accessToken || conn?.pageAccessToken);

    const defaultAuthorUrn = isTargetOrg
      ? (conn?.organizations?.[0]?.urn || conn?.member?.urn)
      : (conn?.member?.urn || conn?.organizations?.[0]?.urn);

    if (!activeToken) {
      return res.status(400).json({
        ok: false,
        error: isTargetOrg
          ? "LinkedIn Company Page token is not found. Please connect your Company Page."
          : "LinkedIn Personal Profile token is not found. Please connect your Personal Profile.",
      });
    }

    const authorUrn = targetUrn || defaultAuthorUrn;
    if (!authorUrn) {
      return res.status(400).json({
        ok: false,
        error: "Unable to determine author URN for LinkedIn post. Please reconnect account.",
      });
    }

    const headers = {
      Authorization: `Bearer ${activeToken}`,
      "LinkedIn-Version": "202401",
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    };

    let mediaUrn = null;
    let mediaType = "NONE";

    // 2A. Handle Video Reel Upload
    if (videoUrl && typeof videoUrl === "string" && videoUrl.startsWith("http")) {
      try {
        const videoRes = await axios.get(videoUrl, {
          responseType: "arraybuffer",
          timeout: 45000,
        });
        const videoBuffer = Buffer.from(videoRes.data);
        const videoContentType = videoRes.headers["content-type"] || "video/mp4";

        const initRes = await axios.post(
          "https://api.linkedin.com/rest/videos?action=initializeUpload",
          {
            initializeUploadRequest: {
              owner: authorUrn,
              fileSizeBytes: videoBuffer.length,
              uploadCaptions: false,
              uploadThumbnail: false,
            },
          },
          { headers }
        );

        const uploadUrl =
          initRes.data?.value?.uploadInstructions?.[0]?.uploadUrl ||
          initRes.data?.value?.uploadUrl;
        const vUrn = initRes.data?.value?.video;

        if (uploadUrl && vUrn) {
          await axios.put(uploadUrl, videoBuffer, {
            headers: { "Content-Type": videoContentType },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          });
          mediaUrn = vUrn;
          mediaType = "VIDEO";
        }
      } catch (vidErr) {
        console.warn("[LinkedIn Video Upload Warning]:", vidErr?.response?.data || vidErr.message);
      }
    }

    // 2B. Handle Carousel / PDF Document Upload
    if (!mediaUrn && ((Array.isArray(carouselUrls) && carouselUrls.length > 0) || (documentUrl && typeof documentUrl === "string"))) {
      try {
        let pdfBuffer = null;
        if (Array.isArray(carouselUrls) && carouselUrls.length > 0) {
          pdfBuffer = await assemblePdfFromImages(carouselUrls);
        } else if (documentUrl && documentUrl.startsWith("http")) {
          const docRes = await axios.get(documentUrl, {
            responseType: "arraybuffer",
            timeout: 25000,
          });
          pdfBuffer = Buffer.from(docRes.data);
        }

        if (pdfBuffer && pdfBuffer.length > 0) {
          const initRes = await axios.post(
            "https://api.linkedin.com/rest/documents?action=initializeUpload",
            {
              initializeUploadRequest: {
                owner: authorUrn,
              },
            },
            { headers }
          );

          const uploadUrl = initRes.data?.value?.uploadUrl;
          const dUrn = initRes.data?.value?.document;

          if (uploadUrl && dUrn) {
            await axios.put(uploadUrl, pdfBuffer, {
              headers: { "Content-Type": "application/pdf" },
              maxBodyLength: Infinity,
              maxContentLength: Infinity,
            });
            mediaUrn = dUrn;
            mediaType = "DOCUMENT";
          }
        }
      } catch (docErr) {
        console.warn("[LinkedIn Document Carousel Warning]:", docErr?.response?.data || docErr.message);
      }
    }

    // 2C. Handle Single Image Upload
    if (!mediaUrn && imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("http")) {
      try {
        const imageRes = await axios.get(imageUrl, {
          responseType: "arraybuffer",
          timeout: 15000,
        });
        const contentType = imageRes.headers["content-type"] || "image/jpeg";
        const imageBuffer = Buffer.from(imageRes.data);

        const initRes = await axios.post(
          "https://api.linkedin.com/rest/images?action=initializeUpload",
          {
            initializeUploadRequest: {
              owner: authorUrn,
            },
          },
          { headers }
        );

        const uploadUrl = initRes.data?.value?.uploadUrl;
        const imgUrn = initRes.data?.value?.image;

        if (uploadUrl && imgUrn) {
          await axios.put(uploadUrl, imageBuffer, {
            headers: { "Content-Type": contentType },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          });
          mediaUrn = imgUrn;
          mediaType = "IMAGE";
        }
      } catch (imgErr) {
        console.warn("[LinkedIn Image Upload Warning]:", imgErr?.response?.data || imgErr.message);
      }
    }

    // 3. Create the LinkedIn Post
    let postBody = {
      author: authorUrn,
      commentary: commentary.trim(),
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };

    if (mediaUrn) {
      postBody.content = {
        media: {
          title: title || (mediaType === "VIDEO" ? "GabbarInfo AI Video Reel" : mediaType === "DOCUMENT" ? "GabbarInfo AI Carousel Deck" : "GabbarInfo AI Broadcast"),
          id: mediaUrn,
        },
      };
    }

    let postUrn = null;
    let postUrl = null;

    try {
      const createRes = await axios.post("https://api.linkedin.com/rest/posts", postBody, { headers });
      postUrn = createRes.headers["x-restli-id"] || createRes.data?.id || null;
    } catch (primaryErr) {
      console.warn("[LinkedIn REST posts error]:", primaryErr?.response?.data || primaryErr.message);

      // Fallback for text-only posts
      if (!mediaUrn) {
        const ugcPayload = {
          author: authorUrn,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: {
                text: commentary.trim(),
              },
              shareMediaCategory: "NONE",
            },
          },
          visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
          },
        };

        const ugcRes = await axios.post("https://api.linkedin.com/v2/ugcPosts", ugcPayload, {
          headers: {
            Authorization: `Bearer ${activeToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
          },
        });

        postUrn = ugcRes.data?.id || ugcRes.headers["x-restli-id"] || null;
      } else {
        throw primaryErr;
      }
    }

    if (postUrn) {
      postUrl = `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/`;
    }

    // 4. Save to activity logs in Supabase
    try {
      const logEntry = {
        urn: postUrn,
        url: postUrl,
        author: authorUrn,
        preview: commentary.trim().slice(0, 140),
        mediaType,
        publishedAt: new Date().toISOString(),
      };

      const { data: existingLogs } = await supabaseServer
        .from("agent_memory")
        .select("content")
        .eq("email", email)
        .eq("memory_type", "linkedin_post_history")
        .maybeSingle();

      let historyList = [];
      if (existingLogs?.content) {
        try {
          historyList = JSON.parse(existingLogs.content);
        } catch (_) {}
      }

      historyList = [logEntry, ...(Array.isArray(historyList) ? historyList : [])].slice(0, 30);

      await supabaseServer.from("agent_memory").upsert(
        {
          email,
          memory_type: "linkedin_post_history",
          content: JSON.stringify(historyList),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,memory_type" }
      );
    } catch (logErr) {
      console.warn("[LinkedIn Log Activity Error]:", logErr.message);
    }

    return res.status(200).json({
      ok: true,
      message: "Successfully posted to LinkedIn!",
      postUrn,
      postUrl,
      mediaType,
    });
  } catch (err) {
    console.error("[LinkedIn Post Fatal]:", err?.response?.data || err.message);
    const detail =
      err?.response?.data?.message ||
      err?.response?.data?.error_description ||
      err?.message ||
      "An unexpected error occurred while publishing to LinkedIn.";

    return res.status(500).json({
      ok: false,
      error: detail,
    });
  }
}
