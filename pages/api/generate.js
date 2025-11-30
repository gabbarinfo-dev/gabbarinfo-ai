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

    // Read prompt + optional params from body
    const {
      prompt,
      temperature = 0.5,
      maxOutputTokens = 1024,
    } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'prompt'" });
    }

    // Use env model if present, fallback to gemini-flash-latest
    const API_KEY = process.env.GEMINI_API_KEY;
    const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-flash-latest";

    if (!API_KEY) {
      return res
        .status(500)
        .json({ error: "Server misconfigured: GEMINI_API_KEY missing" });
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
    });

    let fullText = "";
    let round = 0;
    const maxRounds = 3; // you chose multi-round completion
    let requestPrompt = prompt;

    while (round < maxRounds) {
      round++;

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: requestPrompt }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens,
        },
      });

      const response = await result.response;

      const chunkText =
        (typeof response.text === "function" && response.text()) ||
        response.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("") ||
        "";

      if (!chunkText.trim()) {
        break;
      }

      // Append with a blank line between rounds
      fullText += (fullText ? "\n\n" : "") + chunkText;

      const finishReason = response.candidates?.[0]?.finishReason;

      // If model says it's done and NOT just cut by max tokens, stop
      if (finishReason && finishReason !== "MAX_TOKENS") {
        break;
      }

      // Ask the model to continue without repeating
      requestPrompt =
        "Continue the previous answer WITHOUT repeating anything.";
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
