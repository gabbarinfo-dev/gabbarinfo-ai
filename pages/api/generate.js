// pages/api/generate.js
// Replace the file contents with this exact code.

// Server-side endpoint that calls Google's Generative Language API using an API key.
// This code expects the following Vercel environment variables:
// - GEMINI_API_KEY  (your Google API key, starts with "AIza...")
// - GEMINI_MODEL    (e.g. "models/gemini-flash-latest")

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    // Basic input validation
    const { prompt, maxOutputTokens = 256, temperature = 0.2 } = req.body || {};
    if (!prompt || (typeof prompt !== "string" && !prompt.text)) {
      return res.status(400).json({
        error:
          "Bad request: provide { prompt: 'your text' } or { prompt: { text: 'your text' } } in JSON body.",
      });
    }

    // Read env
    const API_KEY = process.env.GEMINI_API_KEY;
    const MODEL = process.env.GEMINI_MODEL || "models/gemini-flash-latest";

    if (!API_KEY) {
      return res.status(500).json({
        error:
          "Server misconfiguration: GEMINI_API_KEY is not defined in environment variables.",
      });
    }

    // Normalize prompt shape for API
    const promptText = typeof prompt === "string" ? prompt : prompt.text;
    const body = {
      prompt: { text: promptText },
      temperature,
      maxOutputTokens,
    };

    // Use x-goog-api-key header (recommended) and include key as query param for compatibility
    const url = `https://generativelanguage.googleapis.com/v1/${MODEL}:generate?key=${encodeURIComponent(
      API_KEY
    )}`;

    const fetchRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // x-goog-api-key is the correct header when using an API key (do NOT use Authorization: Bearer <API_KEY>)
        "x-goog-api-key": API_KEY,
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

    // If Google returned an error code, forward useful info back
    if (!fetchRes.ok) {
      return res.status(fetchRes.status || 500).json({
        error: "Google API error",
        status: fetchRes.status,
        details: data,
      });
    }

    // Success: return Google response to client (you can modify to pick fields you prefer)
    return res.status(200).json({ result: data });
  } catch (err) {
    console.error("generate API error:", err);
    return res.status(500).json({ error: "Internal server error", detail: String(err) });
  }
}
