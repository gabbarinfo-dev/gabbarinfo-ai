// pages/api/generate.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 🔒 Require signed-in user
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { prompt, temperature = 0.5 } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
    });

    let fullText = "";
    let round = 0;
    const maxRounds = 3;
    let requestPrompt = prompt;

    while (round < maxRounds) {
      round++;

      const result = await model.generateContent({
        contents: [{ role: "user", text: requestPrompt }],
        generationConfig: {
          temperature,
          maxOutputTokens: 1024,
        },
      });

      const response = await result.response;
      const text =
        response.text() ||
        response.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("") ||
        "";

      if (!text.trim()) break;

      fullText += text;

      const finishReason = response.candidates?.[0]?.finishReason;
      if (
        finishReason === "STOP" ||
        finishReason === "STOPPING" ||
        finishReason === "EOF"
      ) {
        break;
      }

      // Ask model to continue, without repeating
      requestPrompt = "Continue the previous answer WITHOUT repeating anything.";
    }

    return res.status(200).json({ text: fullText.trim() });
  } catch (err) {
    console.error("GENERATION ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      details: err?.message || String(err),
    });
  }
}
