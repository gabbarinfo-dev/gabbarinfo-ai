// pages/api/agent/intent.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      message: "Only POST allowed",
    });
  }

  try {
    const { query, mode } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        ok: false,
        message: "query (string) is required",
      });
    }

    // 🔒 DO NOT create campaigns here
    // 🔒 DO NOT touch Meta / Google APIs
    // 🔒 ONLY infer intent

    const lower = query.toLowerCase();

    let platform = null;
    let objective = null;
    let confidence = "low";

    // Platform detection
    if (lower.includes("facebook") || lower.includes("instagram") || lower.includes("meta") || mode === "instagram_post") {
      platform = "meta";
    }

    if (lower.includes("google")) {
      platform = "google";
    }

    // Objective detection
    if (lower.includes("whatsapp")) {
      objective = "whatsapp_messages";
      confidence = "high";
    } else if (lower.includes("message")) {
      objective = "messages";
      confidence = "medium";
    } else if (lower.includes("traffic")) {
      objective = "traffic";
      confidence = "medium";
    } else if (lower.includes("lead")) {
      objective = "leads";
      confidence = "medium";
    } else if (lower.includes("call")) {
      objective = "calls";
      confidence = "medium";
    } else {
      objective = "generic";
      confidence = "low";
    }

    // Explicit override for mode
    if (mode === "instagram_post") {
      platform = "meta";
      objective = "INSTAGRAM_POST";
      confidence = "high";
    }

    return res.status(200).json({
      ok: true,
      intent: {
        raw_query: query,
        platform,
        objective,
        confidence,
        requires_confirmation: true,
      },
      intent_type: mode === "instagram_post" ? "INSTAGRAM_POST" : null, // Adding top-level indicator
    });

  } catch (err) {
    console.error("INTENT ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Intent detection failed",
    });
  }
}
