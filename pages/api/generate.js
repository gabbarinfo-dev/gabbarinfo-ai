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

    // We now support both text + image
    const { prompt, type } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing in environment variables",
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // 🔹 IMAGE MODE (only when explicitly requested)
    if (type === "image") {
      const model = genAI.getGenerativeModel({
        // image-capable model
        model: "gemini-1.5-flash",
      });

      // Ask Gemini to return an image (PNG)
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
          responseMimeType: "image/png",
        },
      });

      const candidates = result?.response?.candidates || [];
      const first = candidates[0];
      const parts = first?.content?.parts || [];
      const imagePart = parts.find(
        (p) => p.inlineData && p.inlineData.data
      );

      if (!imagePart) {
        console.error("No image data in Gemini response:", result);
        return res.status(500).json({
          error: "No image data returned from model",
        });
      }

      const base64 = imagePart.inlineData.data;
      const dataUrl = `data:image/png;base64,${base64}`;

      return res.status(200).json({
        imageBase64: dataUrl,
      });
    }

    // 🔹 TEXT MODE (DEFAULT) – your old behavior, unchanged
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest", // or "gemini-1.5-flash" if you prefer
    });

    // exactly like before
    const result = await model.generateContent(prompt);
    const response = result.response;

    const text =
      (response && typeof response.text === "function"
        ? response.text()
        : "") || "";

    if (!text.trim()) {
      // If Gemini returned nothing, surface that clearly
      console.error("GENERATION EMPTY RESPONSE:", response);
      return res.status(500).json({
        error: "Empty response from model",
        text: "",
      });
    }

    return res.status(200).json({ text: text.trim() });
  } catch (err) {
    console.error("GENERATION ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      details: err?.message || String(err),
    });
  }
}
