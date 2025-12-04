// pages/api/agent/execute.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed." });
  }

  try {
    const body = req.body;

    if (!body || !body.type) {
      return res.status(400).json({
        ok: false,
        message: "Missing 'type' field in JSON.",
      });
    }

    // Decide routing based on "type"
    if (body.type === "google_ads_campaign") {
      // Forward to Google Ads stub
      const gaRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/google-ads/create-simple-campaign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body.data),
      });

      const gaJson = await gaRes.json();
      return res.status(200).json({
        ok: true,
        forwardedTo: "google_ads",
        response: gaJson,
      });
    }

    if (body.type === "meta_ads_creative") {
      // Forward to Creative stub
      const metaRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ads/create-creative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body.data),
      });

      const metaJson = await metaRes.json();
      return res.status(200).json({
        ok: true,
        forwardedTo: "creative_service",
        response: metaJson,
      });
    }

    return res.status(400).json({
      ok: false,
      message: "Unknown type. Expected google_ads_campaign or meta_ads_creative.",
    });

  } catch (err) {
    console.error("Agent execution error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error",
      error: err.message,
    });
  }
}
