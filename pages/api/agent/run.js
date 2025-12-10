// pages/api/agent/run.js

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ ok: false, message: "Only POST is allowed on this endpoint." });
  }

  try {
    const body = req.body;

    if (!body || typeof body !== "object") {
      return res.status(400).json({
        ok: false,
        message: "Missing or invalid JSON body.",
      });
    }

    const { platform, action, payload } = body;

    if (!platform || typeof platform !== "string") {
      return res.status(400).json({
        ok: false,
        message: "platform (string) is required: 'google' or 'meta'.",
      });
    }

    if (!action || typeof action !== "string") {
      return res.status(400).json({
        ok: false,
        message: "action (string) is required, e.g. 'create_simple_campaign'.",
      });
    }

    if (!payload || typeof payload !== "object") {
      return res.status(400).json({
        ok: false,
        message: "payload (object) is required.",
      });
    }

    // Decide where to forward
    if (platform === "google" && action === "create_simple_campaign") {
      // Forward to your existing Google Ads stub:
      // /api/google-ads/create-simple-campaign
      const resp = await fetch(
        `${BASE_URL}/api/google-ads/create-simple-campaign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        return res.status(resp.status).json({
          ok: false,
          forwardedTo: "google-ads/create-simple-campaign",
          message: "Google Ads stub returned an error.",
          error: data,
        });
      }

      return res.status(200).json({
        ok: true,
        forwardedTo: "google-ads/create-simple-campaign",
        response: data,
      });
    }

    if (platform === "meta" && action === "create_simple_campaign") {
      // Forward to the new Meta stub:
      // /api/meta/create-simple-campaign
      const resp = await fetch(
        `${BASE_URL}/api/meta/create-simple-campaign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        return res.status(resp.status).json({
          ok: false,
          forwardedTo: "meta/create-simple-campaign",
          message: "Meta stub returned an error.",
          error: data,
        });
      }

      return res.status(200).json({
        ok: true,
        forwardedTo: "meta/create-simple-campaign",
        response: data,
      });
    }

    // Unknown combination
    return res.status(400).json({
      ok: false,
      message:
        "Unknown platform/action combo. Expected platform = 'google' or 'meta' and action = 'create_simple_campaign'.",
    });
  } catch (err) {
    console.error("Agent /api/agent/run error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error in /api/agent/run.",
      error: err.message || String(err),
    });
  }
}
