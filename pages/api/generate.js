// pages/api/generate.js
// Server-side endpoint that calls Google's Gemini API (Generative Language API)
// using an API key and the v1beta generateContent method.

// Expected Vercel environment variables:
// - GEMINI_API_KEY  (your Google API key, starts with "AIza...")
// - GEMINI_MODEL    (e.g. "models/gemini-1.5-flash")

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    // Basic input validation – we expect { prompt: "text" }
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "Bad request: provide { prompt: 'your text' } in JSON body.",
      });
    }

    // Read env
    const API_KEY = process.env.GEMINI_API_KEY;
    const MODEL = process.env.GEMINI_MODEL || "models/gemini-1.5-flash";

    if (!API_KEY) {
      return res.status(500).json({
        error:
          "Server misconfiguration: GEMINI_API_KEY is not defined in environment variables.",
      });
    }

    // Build request for v1beta generateContent
    const url = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${encodeURIComponent(
      API_KEY
    )}`;

    const body = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    };

    const fetchRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await fetchRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      // If response is not JSON, return the raw text for debugging
      return res
        .status(fetchRes.status || 500)
        .json({ error: "Non-JSON response from Google API", raw: text });
    }

    if (!fetchRes.ok) {
      // Forward useful info from Google for debugging
      return res.status(fetchRes.status || 500).json({
        error: "Google API error (debuggable)",
        debug: data,
      });
    }

    // Extract plain text from Gemini response:
    // candidates[0].content.parts[].text
    const candidate = (data.candidates && data.candidates[0]) || null;
    const parts = candidate?.content?.parts || [];
    const assistantText = parts
      .map((p) => (typeof p.text === "string" ? p.text : ""))
      .join("")
      .trim();

    return res.status(200).json({ text: assistantText || "[Empty response]" });
  } catch (err) {
    console.error("generate API error:", err);
    return res
      .status(500)
      .json({ error: "Internal server error", detail: String(err) });
  }
}
