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

    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest", // or "gemini-1.5-flash" if you prefer
    });

    // 🔹 Single, simple call – let Gemini handle the rest
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
