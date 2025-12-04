// pages/api/ads/create-creative.js
// Stub: accepts a creative JSON payload and echoes it back.
// Later, this will call DALL·E / SDXL / Meta / LinkedIn APIs as needed.

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

    const { channel, platform, format, objective, creative, metadata } = body;
    const errors = [];

    if (!channel || typeof channel !== "string") {
      errors.push("channel (string) is required.");
    }
    if (!platform || typeof platform !== "string") {
      errors.push("platform (string) is required.");
    }
    if (!format || typeof format !== "string") {
      errors.push("format (string) is required.");
    }
    if (!objective || typeof objective !== "string") {
      errors.push("objective (string) is required.");
    }

    if (!creative || typeof creative !== "object") {
      errors.push("creative object is required.");
    } else {
      if (!creative.imagePrompt) {
        errors.push("creative.imagePrompt is required (for image generation).");
      }
      if (!creative.headline) {
        errors.push("creative.headline is required.");
      }
      if (!creative.primaryText) {
        errors.push("creative.primaryText is required.");
      }
      if (!creative.callToAction) {
        errors.push("creative.callToAction is required.");
      }
      if (!creative.landingPage) {
        errors.push("creative.landingPage is required.");
      }
    }

    if (!metadata || typeof metadata !== "object") {
      errors.push("metadata object is required.");
    } else {
      if (!metadata.targetCountry) {
        errors.push("metadata.targetCountry is required.");
      }
      if (!Array.isArray(metadata.targetLanguages) || metadata.targetLanguages.length === 0) {
        errors.push("metadata.targetLanguages (non-empty array) is required.");
      }
      // adAccountId and campaignName can be optional placeholders for now
    }

    if (errors.length > 0) {
      return res.status(400).json({
        ok: false,
        message: "Validation failed.",
        errors,
      });
    }

    // 🚧 TODO (later):
    // - Use this creative JSON to:
    //   1) Call an image generation API (DALL·E / SDXL) using creative.imagePrompt.
    //   2) Store the generated image in storage and get a URL.
    //   3) Call Meta / LinkedIn / etc. APIs to create ads or posts.

    return res.status(200).json({
      ok: true,
      message:
        "Stub only: creative payload received. Once image + Meta/LinkedIn APIs are configured, this endpoint will actually generate creatives and/or create ads.",
      received: body,
    });
  } catch (err) {
    console.error("Error in /api/ads/create-creative:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error while handling creative stub.",
      error: err.message || String(err),
    });
  }
}
