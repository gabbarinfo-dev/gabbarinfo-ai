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

      // Use x-goog-api-key header and include key as query param for compatibility
    const url = `https://generativelanguage.googleapis.com/v1/${MODEL}:generate?key=${encodeURIComponent(API_KEY)}`;

    // DEBUG: call Google and capture full response for troubleshooting
    const fetchRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY,
      },
      body: JSON.stringify(body),
    });

    // read raw text (may be empty or HTML)
    const rawText = await fetchRes.text();

    // return a helpful debug JSON to the client when not OK (so you can screenshot)
    if (!fetchRes.ok) {
      // include status, a few headers, and the raw text (trimmed)
      const debug = {
        status: fetchRes.status,
        statusText: fetchRes.statusText,
        headers: {
          "content-type": fetchRes.headers.get("content-type"),
          "x-goog-request-id": fetchRes.headers.get("x-goog-request-id"),
        },
        raw: rawText ? rawText.slice(0, 2000) : "",
      };
      console.error("Google API DEBUG error:", debug);
      return res.status(fetchRes.status || 500).json({
        error: "Google API error (debuggable)",
        debug,
      });
    }

    // If ok, try to parse JSON normally
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (err) {
      console.error("Google returned non-JSON (but status OK):", { status: fetchRes.status, rawText: rawText.slice(0,2000) });
      return res.status(500).json({
        error: "Non-JSON response from Google API",
        raw: rawText ? rawText.slice(0, 2000) : "",
      });
    }
    
    // Success: return Google response to client (you can modify to pick fields you prefer)
    return res.status(200).json({ result: data });
  } catch (err) {
    console.error("generate API error:", err);
    return res.status(500).json({ error: "Internal server error", detail: String(err) });
  }
}
