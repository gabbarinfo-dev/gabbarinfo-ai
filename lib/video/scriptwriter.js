// lib/video/scriptwriter.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

/**
 * Generates a viral 15-20 second vertical video script structured into:
 * Hook (0-3s), Value Points (3-12s), and Call-To-Action (12-16s).
 */
export async function generateReelScript({ topic, niche = "general", style = "motion_broll" }) {
  const prompt = `You are a world-class viral short-form video creator for Instagram Reels, TikTok, and YouTube Shorts.
Topic / Idea: "${topic}"
Niche / Style: "${niche}" (Video Style: ${style})

Write a high-converting 15 to 20-second vertical video script. Total spoken words must be between 35 to 55 words so it can be spoken comfortably in ~15 seconds.

Requirements:
1. Scene 1 (0-3s) - The Hook: An irresistible question, controversial statement, or curiosity gap that stops scrolling.
2. Scene 2 (3-8s) - Value Point 1: The core insight or product benefit.
3. Scene 3 (8-13s) - Value Point 2: Supporting proof, secret tip, or feature.
4. Scene 4 (13-16s) - Call to Action (CTA): Clear next step (e.g. "Comment INFO below", "Tap the link in bio", "Save this for later").

Respond ONLY with valid JSON with this exact schema:
{
  "title": "Short viral title with emojis",
  "caption": "Engaging Instagram/YouTube caption with 4-5 relevant hashtags (#shorts #reels)",
  "fullScript": "The complete voiceover text to be spoken continuously by AI.",
  "scenes": [
    {
      "id": 1,
      "text": "Voiceover line for scene 1",
      "searchQuery": "2-3 precise english keywords for vertical stock footage search (e.g. 'luxury lifestyle' or 'stressed person typing')",
      "visualPrompt": "Detailed cinematic prompt for AI character/video generation, 9:16 vertical orientation",
      "duration": 4
    },
    {
      "id": 2,
      "text": "Voiceover line for scene 2",
      "searchQuery": "keywords for scene 2",
      "visualPrompt": "cinematic prompt for scene 2",
      "duration": 4
    },
    {
      "id": 3,
      "text": "Voiceover line for scene 3",
      "searchQuery": "keywords for scene 3",
      "visualPrompt": "cinematic prompt for scene 3",
      "duration": 4
    },
    {
      "id": 4,
      "text": "Voiceover line for scene 4 (CTA)",
      "searchQuery": "keywords for scene 4 (e.g. 'smartphone screen success')",
      "visualPrompt": "cinematic prompt for scene 4",
      "duration": 4
    }
  ]
}`;

  // 1. Try Gemini 1.5 Flash
  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      });
      const rawText = result.response.text();
      return JSON.parse(rawText);
    } catch (geminiErr) {
      console.warn("[Scriptwriter] Gemini generation failed, falling back to OpenAI:", geminiErr.message);
    }
  }

  // 2. Fallback to OpenAI GPT-4o-mini
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      return JSON.parse(completion.choices[0].message.content);
    } catch (openaiErr) {
      console.error("[Scriptwriter] OpenAI fallback failed:", openaiErr.message);
      throw new Error("Failed to generate script: " + openaiErr.message);
    }
  }

  throw new Error("No AI API keys (Gemini or OpenAI) available for script generation.");
}
