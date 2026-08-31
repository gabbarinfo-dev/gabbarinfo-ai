// pages/api/images/generate.js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const modelToUse = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
    let result;
    try {
      result = await client.images.generate({
        model: modelToUse,
        prompt,
        size: "1024x1024",
      });
    } catch (modelErr) {
      console.warn(`Failed with ${modelToUse}, falling back to gpt-image-1...`, modelErr?.message);
      result = await client.images.generate({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
      });
    }

    const imageUrl = result.data?.[0]?.url || null;
    const imageBase64 = result.data?.[0]?.b64_json || null;

    if (!imageUrl && !imageBase64) {
      throw new Error("OpenAI did not return image data.");
    }

    return res.status(200).json({
      ok: true,
      imageUrl,
      imageBase64,
    });
  } catch (err) {
    console.error("IMAGE API ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: "Error generating image.",
      details: err?.message || String(err),
    });
  }
}
