// pages/api/generate.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method not allowed");
  const { messages } = req.body || {};
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: "Missing messages" });

  // Build a prompt from messages (simple concatenation).
  const prompt = messages.map(m => (m.role === "user" ? `User: ${m.text}` : `Assistant: ${m.text}`)).join("\n") + "\nAssistant:";

  const KEY = process.env.GEMINI_API_KEY;
  const MODEL = process.env.GEMINI_MODEL || "models/chat-bison-001"; // set to your model if needed

  // If no key configured, return a simple echo (so the UI still works).
  if (!KEY) {
    console.warn("GEMINI_API_KEY not set — returning echo fallback");
    return res.json({ text: `Echo (no GEMINI_API_KEY): ${messages[messages.length - 1].text}` });
  }

  try {
    // Example generic request to a Gemini-like endpoint.
    // NOTE: Replace the URL below with your provider's exact endpoint if different.
    // For Google Gemini, you may need to call:
    //   https://generativelanguage.googleapis.com/v1beta2/{MODEL}:generate
    // or the endpoint your account/docs specify. Adjust accordingly.
    const endpoint = process.env.GEMINI_ENDPOINT || `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generate`;

    // Build a request body in a simple form — adjust for your exact Gemini API shape.
    const body = {
      // many Gemini APIs expect a `prompt` or `instances` structure. Example generic:
      prompt,
      // You can add temperature, max tokens, etc. depending on API.
      maxOutputTokens: 512,
      temperature: 0.2,
    };

    const r = await fetch(endpoint + (process.env.GEMINI_USE_APIKEY_QUERY ? `?key=${KEY}` : ""), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.GEMINI_USE_BEARER === "1" ? { Authorization: `Bearer ${KEY}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const text = await r.text();
      console.error("Gemini API error:", r.status, text);
      return res.status(502).json({ error: "Upstream error", detail: text });
    }

    const data = await r.json();

    // Extract text from response — shape varies by API provider.
    // We'll try common paths then fallback to full JSON.
    let text = "";
    if (data?.candidates?.[0]?.content) text = data.candidates[0].content;
    else if (data?.output?.[0]?.content?.type === "text") text = data.output[0].content.text;
    else if (typeof data?.generated_text === "string") text = data.generated_text;
    else text = JSON.stringify(data).slice(0, 2000); // fallback trimmed

    return res.json({ text });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
