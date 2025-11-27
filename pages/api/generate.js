// pages/api/generate.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const modelName =
  process.env.GEMINI_MODEL || "gemini-flash-latest"; // keep your env if set

if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      prompt,
      maxOutputTokens = 768, // plenty of space for campaign steps
      temperature = 0.5, // balanced, not too random
    } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const model = genAI.getGenerativeModel({
      model: modelName,
    });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens,
        temperature,
      },
    });

    // Standard Gemini response shape
    const resp = result.response;
    let text = "";

    if (typeof resp.text === "function") {
      text = resp.text() || "";
    }

    // Fallbacks
    if (!text && resp.candidates?.[0]?.content?.parts) {
      text =
        resp.candidates[0].content.parts
          .map((p) => p.text || "")
          .join("") || "";
    }

    if (!text) {
      text = "No response from model.";
    }

    return res.status(200).json({
      text,
      // You can keep raw for debugging if you want:
      // raw: resp,
    });
  } catch (err) {
    console.error("Gemini API error:", err);

    // Normalise error message a bit
    const msg =
      err?.response?.statusText ||
      err?.message ||
      "Unknown error from Google API";

    return res.status(500).json({
      error: "Google API error (debuggable)",
      debug: msg,
    });
  }
}
