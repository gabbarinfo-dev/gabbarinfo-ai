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
    const maxRounds = 3; // <= YOU CHOSE OPTION B

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
        response.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
        "";

      if (!text.trim()) break;

      fullText += text;

      const finishReason = response.candidates?.[0]?.finishReason;

      // If model signals it is done → stop early
      if (finishReason === "STOP" || finishReason === "STOPPING" || finishReason === "EOF") {
        break;
      }

      // Prepare next continuation
      requestPrompt = "Continue the previous answer WITHOUT repeating anything.";
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
