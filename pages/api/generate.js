// pages/api/generate.js
// Server-side endpoint that calls Gemini with an API key.
//
// Requires Vercel env vars:
// - GEMINI_API_KEY  (your Google API key, starts with "AIza...")
// - GEMINI_MODEL    (e.g. "models/gemini-flash-latest")

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    // Read body from client
    const { prompt, maxOutputTokens = 512, temperature = 0.7 } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "Bad request: provide JSON body { prompt: 'your text' }.",
      });
    }

    // Env
    const API_KEY = process.env.GEMINI_API_KEY;
    const MODEL = process.env.GEMINI_MODEL || "models/gemini-flash-latest";

    if (!API_KEY) {
      return res.status(500).json({
        error: "Server misconfiguration: GEMINI_API_KEY is not defined.",
      });
    }

    // Gemini generateContent request body
    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens,
      },
    };

    // NOTE: Gemini uses v1beta + generateContent
    const url = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent`;

    const fetchRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY, // correct header for API key
      },
      body: JSON.stringify(body),
    });

    const rawText = await fetchRes.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (err) {
      // If response is not JSON, surface raw text
      return res
        .status(fetchRes.status || 500)
        .json({ error: "Non-JSON response from Google API", raw: rawText });
    }

    if (!fetchRes.ok) {
      // Forward Google error with debug info
      return res.status(fetchRes.status || 500).json({
        error: "Google API error (debuggable)",
        debug: data,
      });
    }

    // Extract text from Gemini candidate(s)
    const candidate =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("") || "";

    return res.status(200).json({
      text: candidate || "No response",
      raw: data,
    });
  } catch (err) {
    console.error("generate API error:", err);
    return res
      .status(500)
      .json({ error: "Internal server error", detail: String(err) });
  }
}
