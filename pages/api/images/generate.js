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

    const result = await client.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    });

    const imageBase64 = result.data[0].b64_json;

    return res.status(200).json({
      ok: true,
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
