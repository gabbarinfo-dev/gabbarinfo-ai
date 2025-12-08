// pages/api/meta/create-campaign.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID;
  const ACCESS_TOKEN =
    process.env.FB_AD_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN;

  if (!AD_ACCOUNT_ID || !ACCESS_TOKEN) {
    return res.status(500).json({
      ok: false,
      message:
        "Missing FB_AD_ACCOUNT_ID or FB_AD_ACCESS_TOKEN env vars. Set them in Vercel first.",
    });
  }

  try {
    const {
      name,
      objective,
      dailyBudget,
      status,
      specialAdCategories,
    } = req.body || {};

    // Very basic validation
    if (!name) {
      return res.status(400).json({
        ok: false,
        message: "Campaign name is required.",
      });
    }

    // Meta objectives examples: "CONVERSIONS", "TRAFFIC", "AWARENESS", etc.
    const finalObjective = objective || "CONVERSIONS";

    // Status: "PAUSED" or "ACTIVE". Default to PAUSED for safety.
    const finalStatus = status || "PAUSED";

    // Meta expects budget in minor units (e.g. 100 INR -> 10000).
    // Here we accept a number like 500 (meaning 500 currency units) and multiply.
    let dailyBudgetMinor = null;
    if (dailyBudget != null) {
      const num = Number(dailyBudget);
      if (!Number.isFinite(num) || num <= 0) {
        return res.status(400).json({
          ok: false,
          message:
            "dailyBudget must be a positive number (e.g. 500 for ₹500 or £500).",
        });
      }
      dailyBudgetMinor = Math.round(num * 100);
    }

    const url = `https://graph.facebook.com/v21.0/act_${AD_ACCOUNT_ID}/campaigns`;

    const params = new URLSearchParams();
    params.append("name", name);
    params.append("objective", finalObjective);
    params.append("status", finalStatus);
    params.append(
      "special_ad_categories",
      JSON.stringify(specialAdCategories || []) // usually []
    );

    if (dailyBudgetMinor != null) {
      params.append("daily_budget", String(dailyBudgetMinor));
    }

    params.append("access_token", ACCESS_TOKEN);

    const fbRes = await fetch(url, {
      method: "POST",
      body: params,
    });

    const fbJson = await fbRes.json().catch(() => ({}));

    if (!fbRes.ok || fbJson.error) {
      return res.status(400).json({
        ok: false,
        message: "Meta Marketing API returned an error.",
        fbStatus: fbRes.status,
        fbResponse: fbJson,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Campaign created (or Meta accepted the request).",
      campaignId: fbJson.id,
      fbResponse: fbJson,
    });
  } catch (err) {
    console.error("META CAMPAIGN ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error while creating campaign.",
      error: err?.message || String(err),
    });
  }
}
