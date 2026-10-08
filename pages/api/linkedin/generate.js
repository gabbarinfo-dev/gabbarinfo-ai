// pages/api/linkedin/generate.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const { topic = "", brandName = "", tone = "thought_leadership" } = req.body || {};

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "AI key is not configured." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const promptText = `You are GabbarInfo AI, an executive B2B growth and social media strategist.
Create a high-performing, viral, and engaging LinkedIn post about:
Topic / Goal: "${topic || "Business innovation and scaling success"}"
${brandName ? `Brand / Company: "${brandName}"` : ""}
Tone: ${tone}

Formatting rules for LinkedIn:
1. Start with a powerful 1-2 sentence hook that stops the scroll.
2. Use short, readable paragraphs (1-2 sentences per line) with white space.
3. Include actionable takeaways, bullet points or insights.
4. Conclude with an engaging open-ended question to spark comments.
5. Add 3 to 5 targeted, high-reach hashtags at the bottom (e.g. #BusinessGrowth #Leadership).
6. Do NOT mention any AI model names (no ChatGPT, Gemini, Claude). The system is GabbarInfo AI.
7. Return ONLY the final ready-to-publish post text without markdown fences or meta commentary.`;

    const result = await model.generateContent(promptText);
    const text = result?.response?.text()?.trim() || "";

    return res.status(200).json({
      ok: true,
      content: text,
    });
  } catch (err) {
    console.error("[LinkedIn Generate Catch]:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to generate LinkedIn post content.",
    });
  }
}
