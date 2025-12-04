// pages/api/google-ads/create-simple-campaign.js
// For now this is a stub: it just validates the payload shape and echoes it back.
// Later, once Google Ads Basic Access is approved, we'll replace the "TODO" part
// with real Google Ads API calls to create a campaign, ad groups, keywords, and ads.

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

    const { customerId, campaign, adGroups } = body;

    // Basic validation – we can expand this later if needed
    const errors = [];

    if (!customerId || typeof customerId !== "string") {
      errors.push("customerId (string) is required.");
    }

    if (!campaign || typeof campaign !== "object") {
      errors.push("campaign object is required.");
    } else {
      if (!campaign.name) errors.push("campaign.name is required.");
      if (!campaign.network) errors.push("campaign.network is required.");
      if (typeof campaign.dailyBudgetMicros !== "number") {
        errors.push("campaign.dailyBudgetMicros (number) is required.");
      }
      if (!campaign.finalUrl) errors.push("campaign.finalUrl is required.");
    }

    if (!Array.isArray(adGroups) || adGroups.length === 0) {
      errors.push("adGroups (non-empty array) is required.");
    } else {
      adGroups.forEach((ag, idx) => {
        if (!ag.name) errors.push(`adGroups[${idx}].name is required.`);
        if (typeof ag.cpcBidMicros !== "number") {
          errors.push(`adGroups[${idx}].cpcBidMicros (number) is required.`);
        }
        if (!Array.isArray(ag.keywords) || ag.keywords.length === 0) {
          errors.push(`adGroups[${idx}].keywords (non-empty array) is required.`);
        }
        if (!Array.isArray(ag.ads) || ag.ads.length === 0) {
          errors.push(`adGroups[${idx}].ads (non-empty array) is required.`);
        }
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        ok: false,
        message: "Validation failed.",
        errors,
      });
    }

    // 🚧 TODO (later):
    // - Use customerId + your GOOGLE_ADS_* env vars to:
    //   1) Create a campaign (status = PAUSED)
    //   2) Create ad groups under that campaign
    //   3) Attach keywords to each ad group
    //   4) Create responsive search ads in each ad group
    //
    // For now, we just echo back what we got so we can test the flow
    // safely while Google Ads Basic Access is pending.

    return res.status(200).json({
      ok: true,
      message:
        "Stub only: campaign payload received. Once Basic Access is approved, this endpoint will actually create the campaign in Google Ads.",
      received: body,
    });
  } catch (err) {
    console.error("Error in /api/google-ads/create-simple-campaign:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error while handling campaign creation stub.",
      error: err.message || String(err),
    });
  }
}
