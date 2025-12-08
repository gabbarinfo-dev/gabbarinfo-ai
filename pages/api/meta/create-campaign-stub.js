// pages/api/meta/create-campaign-stub.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      message: "Only POST is allowed on this endpoint.",
    });
  }

  try {
    const body = req.body || {};

    // You can send whatever structure you want here – for example:
    // {
    //   objective: "LEAD_GENERATION",
    //   dailyBudget: 700,
    //   accountId: "act_1234567890",
    //   adSets: [...],
    //   ads: [...]
    // }

    return res.status(200).json({
      ok: true,
      mode: "meta_campaign_stub",
      message:
        "Meta campaign stub only. No real Meta Ads API call has been made.",
      receivedPayload: body,
      simulatedResult: {
        simulatedCampaignId: "sim_camp_" + Date.now(),
        simulatedAdsetId: "sim_adset_" + Date.now(),
        simulatedAdId: "sim_ad_" + Date.now(),
      },
    });
  } catch (err) {
    console.error("Meta campaign stub error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error in Meta campaign stub.",
      error: err.message || String(err),
    });
  }
}
