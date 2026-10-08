// pages/api/linkedin/generate-image.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { generatePlatformGraphic } from "../../../lib/services/image-service";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;

  if (!email) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const { prompt, commentary, brandName = "B2B Business" } = req.body || {};

  try {
    let finalVisualPrompt = prompt;

    // If no custom visual prompt provided, use Gemini to create an executive visual concept from the commentary/topic
    if (!finalVisualPrompt && commentary) {
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
          const visualIdeaPrompt = `Based on this LinkedIn post commentary: "${commentary.slice(0, 400)}"
Generate a single, vivid, professional prompt for an AI image generator to create a high-impact LinkedIn visual graphic for "${brandName}".
The graphic should be: sleek modern corporate aesthetic, premium isometric 3D or futuristic minimalist infographic style, high-tech dark theme with bright blue and neon accents, clean composition.
Return ONLY the prompt string, under 40 words.`;

          const aiRes = await model.generateContent(visualIdeaPrompt);
          finalVisualPrompt = aiRes?.response?.text()?.trim();
        }
      } catch (_) {}
    }

    if (!finalVisualPrompt) {
      finalVisualPrompt = `Modern executive B2B tech visual for ${brandName}, sleek 3D infographic, dark glassmorphism, vibrant blue and purple accents, high resolution, minimalist`;
    }

    const result = await generatePlatformGraphic({
      prompt: finalVisualPrompt,
      userEmail: email,
      businessId: `biz_${email.replace(/[^a-zA-Z0-9]/g, "_")}`,
      aspectRatio: "1:1",
      actionType: "IMAGE_GENERATION",
      meterCredits: false, // Internal generation
      persistInSupabase: true,
    });

    if (!result.ok || !result.imageUrl) {
      return res.status(500).json({
        ok: false,
        error: result.error || "Failed to generate AI visual graphic.",
      });
    }

    return res.status(200).json({
      ok: true,
      imageUrl: result.imageUrl,
      promptUsed: finalVisualPrompt,
    });
  } catch (err) {
    console.error("[LinkedIn Image Generation Catch]:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to generate visual graphic.",
    });
  }
}
