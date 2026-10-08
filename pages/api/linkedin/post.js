// pages/api/linkedin/post.js
import axios from "axios";
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

  const { commentary, imageUrl, targetUrn, title } = req.body || {};

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
    const accessToken = conn?.accessToken;
    const defaultAuthorUrn = conn?.member?.urn;

    if (!accessToken) {
      return res.status(400).json({
        ok: false,
        error: "Active LinkedIn token not found. Please reconnect your account.",
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
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": "202401",
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    };

    let imageUrn = null;

    // 2. If imageUrl is supplied, upload image to LinkedIn
    if (imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("http")) {
      try {
        // Fetch binary image data
        const imageRes = await axios.get(imageUrl, {
          responseType: "arraybuffer",
          timeout: 15000,
        });
        const contentType = imageRes.headers["content-type"] || "image/jpeg";
        const imageBuffer = Buffer.from(imageRes.data);

        // Initialize upload with LinkedIn REST API
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
        imageUrn = initRes.data?.value?.image;

        if (uploadUrl && imageUrn) {
          // Upload binary to uploadUrl
          await axios.put(uploadUrl, imageBuffer, {
            headers: {
              "Content-Type": contentType,
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          });
        }
      } catch (imgErr) {
        console.warn("[LinkedIn Image Upload Warning]:", imgErr?.response?.data || imgErr.message);
        // Fallback: Proceed with text post if image upload fails
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

    if (imageUrn) {
      postBody.content = {
        media: {
          title: title || "GabbarInfo AI Broadcast",
          id: imageUrn,
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

      // Graceful fallback to legacy /v2/ugcPosts endpoint if rest/posts returns specific schema mismatch
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
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json",
        },
      });

      postUrn = ugcRes.data?.id || ugcRes.headers["x-restli-id"] || null;
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
        hasImage: Boolean(imageUrn),
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
