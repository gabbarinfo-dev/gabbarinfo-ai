// pages/api/linkedin/autopilot-run.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generatePlatformGraphic } from "../../../lib/services/image-service";
import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;

  if (!email) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    // 1. Retrieve LinkedIn connection
    const { data: connRow } = await supabaseServer
      .from("agent_memory")
      .select("content")
      .eq("email", email)
      .eq("memory_type", "linkedin_connection")
      .maybeSingle();

    if (!connRow?.content) {
      return res.status(400).json({ ok: false, error: "LinkedIn account not connected." });
    }

    const conn = JSON.parse(connRow.content);

    // 2. Retrieve Autopilot configuration
    const { data: configRow } = await supabaseServer
      .from("agent_memory")
      .select("content")
      .eq("email", email)
      .eq("memory_type", "linkedin_autopilot_config")
      .maybeSingle();

    let config = {
      topics: "B2B Growth, AI Automation, Tech Innovation",
      tone: "thought_leadership",
      generateImage: true,
      targetUrn: conn.organizations?.[0]?.urn || conn.member?.urn,
    };

    if (configRow?.content) {
      try {
        config = { ...config, ...JSON.parse(configRow.content) };
      } catch (_) {}
    }

    const targetUrn = config.targetUrn || (conn.organizations?.[0]?.urn || conn.member?.urn);
    const isTargetOrg = targetUrn && targetUrn.startsWith("urn:li:organization:");
    const activeToken = isTargetOrg
      ? (conn.pageAccessToken || conn.accessToken)
      : (conn.accessToken || conn.pageAccessToken);

    if (!activeToken) {
      return res.status(400).json({ ok: false, error: "Active token not found for target destination." });
    }

    const orgObj = conn.organizations?.find((o) => o.urn === targetUrn);
    const authorName = orgObj?.name || conn.member?.name || "Business";

    // 3. Autonomously draft post commentary with Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "Gemini API key is not configured." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const promptText = `You are GabbarInfo AI, managing an executive B2B LinkedIn presence for "${authorName}".
Topics: ${config.topics}
Tone: ${config.tone}

Draft an original, viral thought-leadership post:
- Start with a compelling hook line.
- 3 to 4 actionable insights with clean spacing.
- Conclude with an engaging discussion question.
- Include 3 targeted hashtags (e.g. #Leadership #Innovation).
- Output ONLY the final ready-to-post text without quotes or markdown code blocks.`;

    const aiRes = await model.generateContent(promptText);
    const commentary = aiRes?.response?.text()?.trim() || "";

    if (!commentary) {
      throw new Error("Failed to generate commentary text.");
    }

    // 4. Generate AI image if enabled
    let imageUrl = null;
    let imageUrn = null;

    if (config.generateImage) {
      try {
        const visualIdeaPrompt = `Based on: "${commentary.slice(0, 300)}"
Generate an AI graphic prompt for ${authorName}: sleek 3D isometric tech infographic, dark glassmorphism, vibrant blue and cyan accents, clean minimalist business composition. Max 35 words.`;
        const visualRes = await model.generateContent(visualIdeaPrompt);
        const visualPrompt = visualRes?.response?.text()?.trim() || `Sleek B2B tech visual for ${authorName}`;

        const imgResult = await generatePlatformGraphic({
          prompt: visualPrompt,
          userEmail: email,
          businessId: `biz_${email.replace(/[^a-zA-Z0-9]/g, "_")}`,
          aspectRatio: "1:1",
          meterCredits: false,
          persistInSupabase: true,
        });

        if (imgResult.ok && imgResult.imageUrl) {
          imageUrl = imgResult.imageUrl;

          // Initialize upload to LinkedIn REST API
          const imgBuffRes = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 15000 });
          const contentType = imgBuffRes.headers["content-type"] || "image/jpeg";
          const imageBuffer = Buffer.from(imgBuffRes.data);

          const headers = {
            Authorization: `Bearer ${activeToken}`,
            "LinkedIn-Version": "202401",
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
          };

          const initRes = await axios.post(
            "https://api.linkedin.com/rest/images?action=initializeUpload",
            { initializeUploadRequest: { owner: targetUrn } },
            { headers }
          );

          const uploadUrl = initRes.data?.value?.uploadUrl;
          imageUrn = initRes.data?.value?.image;

          if (uploadUrl && imageUrn) {
            await axios.put(uploadUrl, imageBuffer, {
              headers: { "Content-Type": contentType },
              maxBodyLength: Infinity,
            });
          }
        }
      } catch (imgErr) {
        console.warn("[Autopilot Image Generation Warning]:", imgErr.message);
      }
    }

    // 5. Publish to LinkedIn
    const headers = {
      Authorization: `Bearer ${activeToken}`,
      "LinkedIn-Version": "202401",
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    };

    let postBody = {
      author: targetUrn,
      commentary,
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
          title: "GabbarInfo AI Autopilot Broadcast",
          id: imageUrn,
        },
      };
    }

    let postUrn = null;
    let postUrl = null;

    try {
      const createRes = await axios.post("https://api.linkedin.com/rest/posts", postBody, { headers });
      postUrn = createRes.headers["x-restli-id"] || createRes.data?.id || null;
    } catch (restErr) {
      // Fallback to ugcPosts
      const ugcPayload = {
        author: targetUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: commentary },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      };

      const ugcRes = await axios.post("https://api.linkedin.com/v2/ugcPosts", ugcPayload, {
        headers: {
          Authorization: `Bearer ${activeToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json",
        },
      });
      postUrn = ugcRes.data?.id || ugcRes.headers["x-restli-id"] || null;
    }

    if (postUrn) {
      postUrl = `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/`;
    }

    // 6. Record run in agent_memory history
    try {
      const logEntry = {
        urn: postUrn,
        url: postUrl,
        author: targetUrn,
        preview: commentary.slice(0, 140),
        hasImage: Boolean(imageUrl),
        isAutopilot: true,
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
    } catch (_) {}

    return res.status(200).json({
      ok: true,
      message: "LinkedIn Auto-Pilot executed successfully!",
      postUrn,
      postUrl,
      commentary,
      imageUrl,
    });
  } catch (err) {
    console.error("[LinkedIn Autopilot Run Catch]:", err);
    return res.status(500).json({
      ok: false,
      error: err.response?.data?.message || err.message || "Autopilot execution failed.",
    });
  }
}
