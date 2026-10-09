// pages/api/linkedin/generate-creative.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { generatePlatformGraphic } from "../../../lib/services/image-service";
import { searchVerticalVideo } from "../../../lib/video/pexels-service";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;

  if (!email) {
    return res.status(401).json({ ok: false, error: "Unauthorized. Please log in." });
  }

  const {
    topic = "",
    brandName = "B2B Business",
    format = "text", // "text" | "image" | "carousel" | "video"
    slideCount = 3,  // 2 to 5 slides
    tone = "thought_leadership",
  } = req.body || {};

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "AI Gemini key is not configured." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 1. Generate LinkedIn Copy (Hook, Story, Takeaways, Question, Hashtags)
    const copyPrompt = `You are GabbarInfo AI, a world-class LinkedIn ghostwriter and B2B viral growth strategist.
Create a high-performing, high-engagement LinkedIn post tailored for:
Topic / Subject: "${topic || "B2B Innovation and Scaling Operations"}"
Brand / Organization: "${brandName}"
Tone: "${tone}"
Post Format: "${format.toUpperCase()}"

Formatting & Structure Rules:
1. HOOK: First 1-2 lines must be an irresistible pattern-interrupt that stops scrolling.
2. STORY / INSIGHT: 2-3 short, punchy paragraphs (1-2 sentences per line with generous line breaks).
3. ACTIONABLE VALUE: 3-4 bullet points with clear, practical takeaways or counter-intuitive lessons.
4. ENGAGEMENT TRIGGER: Conclude with an open-ended question designed to drive high-value comments from decision-makers.
5. HASHTAGS: Exactly 3 to 5 targeted B2B hashtags on the last line (e.g. #Leadership #B2BGrowth #Innovation).
6. BRAND INTEGRITY: Do not mention OpenAI, ChatGPT, or other AI model names.
7. Return ONLY the final ready-to-publish post text with no markdown fences, preamble, or meta explanations.`;

    const copyResult = await model.generateContent(copyPrompt);
    const postCommentary = copyResult?.response?.text()?.trim() || "";

    let generatedImageUrl = null;
    let generatedCarouselUrls = [];
    let generatedVideoUrl = null;

    // 2. Generate Format-Specific Creative Media
    const safeSlideCount = Math.min(5, Math.max(2, parseInt(slideCount, 10) || 3));

    if (format === "image") {
      // Generate Visual Prompt
      const visualPromptQuery = `Based on this topic: "${topic || postCommentary.slice(0, 200)}"
Generate a single, vivid prompt for a photo-realistic modern 3D executive graphic for ${brandName}.
Style: High-tech dark glassmorphism, sleek blue and violet corporate lighting, minimalist 3D infographic elements, 8k resolution.
Output ONLY the prompt under 35 words.`;

      let imgPrompt = "Sleek modern 3D executive B2B visual infographic, dark blue neon lighting, minimalist, 8k";
      try {
        const vRes = await model.generateContent(visualPromptQuery);
        imgPrompt = vRes?.response?.text()?.trim() || imgPrompt;
      } catch (_) {}

      const graphicResult = await generatePlatformGraphic({
        prompt: imgPrompt,
        userEmail: email,
        businessId: `biz_${email.replace(/[^a-zA-Z0-9]/g, "_")}`,
        aspectRatio: "1:1",
        actionType: "IMAGE_GENERATION",
        meterCredits: false,
        persistInSupabase: true,
      });

      if (graphicResult.ok && graphicResult.imageUrl) {
        generatedImageUrl = graphicResult.imageUrl;
      }
    } else if (format === "carousel") {
      // Plan slide themes for 2 to 5 slides
      const slidePlansQuery = `For a ${safeSlideCount}-slide LinkedIn carousel deck about "${topic || "B2B Strategy"}" for ${brandName}:
Create a JSON array of ${safeSlideCount} visual image prompts.
Each slide must represent a progressive step:
- Slide 1: Bold Title Card / Hero Hook cover graphic
- Slide 2: Core Problem & Blindspot visual
- Slide 3: Solution Framework & Key Action Steps
${safeSlideCount >= 4 ? "- Slide 4: Real-world Impact & Proof Metrics\n" : ""}${safeSlideCount >= 5 ? "- Slide 5: Executive Summary & Call to Action\n" : ""}
Each prompt should describe a clean, modern, dark-theme B2B infographic slide graphic with neon blue and cyan accents.
Return ONLY valid JSON array of strings: ["prompt 1", "prompt 2", ...]`;

      let slidePrompts = [];
      try {
        const sRes = await model.generateContent(slidePlansQuery);
        const rawJson = sRes?.response?.text()?.replace(/```json|```/g, "").trim();
        slidePrompts = JSON.parse(rawJson);
      } catch (_) {
        slidePrompts = [
          `Slide 1 Title Card: ${topic || "Strategic B2B Growth"} - Bold dark tech infographic for ${brandName}`,
          `Slide 2 Deep Dive: Core Challenges and Solution Framework for ${topic || "Scaling"}`,
          `Slide 3 Strategic Takeaway: Actionable Execution Guide and Takeaways for ${brandName}`,
        ];
      }

      if (!Array.isArray(slidePrompts) || slidePrompts.length === 0) {
        slidePrompts = [
          `Slide 1 Title: ${topic || "Key Insights"} - Graphic cover for ${brandName}`,
          `Slide 2 Insight: Framework and Strategy for ${topic || "Execution"}`,
        ];
      }

      slidePrompts = slidePrompts.slice(0, safeSlideCount);

      // Generate all slide graphics
      for (const sPrompt of slidePrompts) {
        try {
          const sGraphic = await generatePlatformGraphic({
            prompt: sPrompt,
            userEmail: email,
            businessId: `biz_${email.replace(/[^a-zA-Z0-9]/g, "_")}`,
            aspectRatio: "1:1",
            actionType: "IMAGE_GENERATION",
            meterCredits: false,
            persistInSupabase: true,
          });

          if (sGraphic.ok && sGraphic.imageUrl) {
            generatedCarouselUrls.push(sGraphic.imageUrl);
          }
        } catch (e) {
          console.warn("[Carousel Slide Gen Warning]:", e.message);
        }
      }
    } else if (format === "video") {
      // Find or generate vertical HD video reel matching topic
      const videoQuery = `${topic || "technology business innovation"}`.slice(0, 60);
      try {
        const pexelsVideo = await searchVerticalVideo(videoQuery, 3);
        if (pexelsVideo?.videoUrl) {
          generatedVideoUrl = pexelsVideo.videoUrl;
        }
      } catch (vidErr) {
        console.warn("[Video Reel Lookup Warning]:", vidErr.message);
      }
    }

    return res.status(200).json({
      ok: true,
      commentary: postCommentary,
      imageUrl: generatedImageUrl,
      carouselUrls: generatedCarouselUrls,
      videoUrl: generatedVideoUrl,
      format,
      slideCount: safeSlideCount,
    });
  } catch (err) {
    console.error("[LinkedIn Generate Creative Catch]:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to generate AI LinkedIn creative package.",
    });
  }
}
