// pages/api/images/generate.js

import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ ok: false, message: "Only POST is allowed on this endpoint." });
  }

  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      message:
        "Missing GOOGLE_API_KEY (or GEMINI_API_KEY) in environment variables.",
    });
  }

  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({
      ok: false,
      message: "Please send a JSON body with a 'prompt' string.",
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    // We use a text-capable model that can return images when we ask for image/png.
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "Generate a high quality marketing image as PNG for this brief: " +
                prompt,
            },
          ],
        },
      ],
      generationConfig: {
        // This is the key: we tell Gemini we want an image back.
        responseMimeType: "image/png",
      },
    });

    const candidates = result?.response?.candidates || [];
    const first = candidates[0];
    const parts = first?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData && p.inlineData.data);

    if (!imagePart) {
      return res.status(500).json({
        ok: false,
        message: "No image data returned from Gemini.",
        raw: result,
      });
    }

    const base64 = imagePart.inlineData.data;
    const dataUrl = `data:image/png;base64,${base64}`;

    return res.status(200).json({
      ok: true,
      imageBase64: dataUrl,
    });
  } catch (err) {
    console.error("Error in /api/images/generate:", err);
    return res.status(500).json({
      ok: false,
      message: "Error generating image.",
      error: err?.message || String(err),
    });
  }
}
