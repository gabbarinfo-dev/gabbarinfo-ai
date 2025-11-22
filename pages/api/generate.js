// pages/api/generate.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message } = req.body || {};
  if (!message || typeof message !== "string") return res.status(400).json({ error: "Missing message" });

  const USE_GEMINI = (process.env.USE_GEMINI || "").toLowerCase() === "true";
  const MODEL = process.env.GEMINI_MODEL || "text-bison-001"; // change if needed
  const TEMPERATURE = parseFloat(process.env.GEMINI_TEMPERATURE || "0.2");

  if (USE_GEMINI) {
    try {
      const baseUrl = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(MODEL)}:generateText`;
      let url = baseUrl;
      const headers = { "Content-Type": "application/json" };

      if ((process.env.GEMINI_USE_QUERY_KEY || "").toLowerCase() === "true") {
        const key = process.env.GEMINI_API_KEY;
        if (!key) throw new Error("GEMINI_API_KEY required when GEMINI_USE_QUERY_KEY=true");
        url += `?key=${encodeURIComponent(key)}`;
      } else if (process.env.GEMINI_BEARER_TOKEN) {
        headers["Authorization"] = `Bearer ${process.env.GEMINI_BEARER_TOKEN}`;
      } else if (process.env.GEMINI_API_KEY) {
        url += `?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
      } else {
        throw new Error("No Gemini credentials found in env");
      }

      const body = {
        prompt: { text: message },
        temperature: TEMPERATURE,
        maxOutputTokens: 512
      };

      const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (!r.ok) {
        const t = await r.text();
        return res.status(502).json({ error: "Gemini error", status: r.status, body: t });
      }
      const j = await r.json();

      // try to extract text
      let reply = null;
      if (j?.candidates && Array.isArray(j.candidates) && j.candidates[0]) {
        const c = j.candidates[0];
        reply = c.output || c.content || (Array.isArray(c) && c[0]?.text) || null;
      }
      if (!reply && j?.output) reply = typeof j.output === "string" ? j.output : JSON.stringify(j.output);
      if (!reply) reply = JSON.stringify(j);

      return res.status(200).json({ text: String(reply) });
    } catch (err) {
      console.error("Gemini error:", err);
      return res.status(500).json({ error: "Gemini call failed", message: err.message });
    }
  }

  // fallback echo
  return res.status(200).json({ text: `Echo (no Gemini configured): ${message}` });
}
