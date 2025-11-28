// pages/api/generate.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  try {
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
    const maxRounds = 3; // Option B: Silent multi-round stitching

    let currentPrompt = prompt;

    while (round < maxRounds) {
      round++;

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: currentPrompt }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: 1024,
        },
      });

      const response = await result.response;

      // Safely extract clean text
      const chunkText =
        response.text() ||
        response.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("") ||
        "";

      if (!chunkText.trim()) break;

      fullText += chunkText;

      // Detect if model is done
      const finishReason = response.candidates?.[0]?.finishReason;
      if (
        finishReason === "STOP" ||
        finishReason === "STOPPING" ||
        finishReason === "EOF"
      ) {
        break;
      }

      // Request continuation silently
      currentPrompt =
        "Continue the previous answer WITHOUT repeating anything.";
    }

    return res.status(200).json({ text: fullText.trim() });
  } catch (err) {
    console.error("GENERATION ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      details: err?.message || err,
    });
  }
}
