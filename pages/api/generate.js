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

    // 🔼 allow one more continuation round
    const maxRounds = 4; 

    let requestPrompt = prompt;

    while (round < maxRounds) {
      round++;

      const result = await model.generateContent({
  contents: [
    {
      role: "user",
      parts: [{ text: requestPrompt }],  // ✅ correct shape
    },
  ],
  generationConfig: {
    temperature,
    maxOutputTokens: 2048,              // our bigger limit
  },
});

      const response = await result.response;
      const text =
        response.text() ||
        response.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
        "";

      if (!text.trim()) break;

      fullText += text;

      const finishReason = response.candidates?.[0]?.finishReason;

      // If model signals it is done → stop early
      if (
        finishReason === "STOP" ||
        finishReason === "STOPPING" ||
        finishReason === "EOF"
      ) {
        break;
      }

      // Ask it to keep going, without repeating
      requestPrompt =
        "Continue the previous answer WITHOUT repeating anything. Pick up exactly where you stopped.";
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
