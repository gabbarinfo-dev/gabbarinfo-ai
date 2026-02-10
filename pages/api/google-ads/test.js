// pages/api/google-ads/test.js

export default async function handler(req, res) {
  try {
    const {
      GOOGLE_ADS_DEVELOPER_TOKEN,
      GOOGLE_ADS_LOGIN_CUSTOMER_ID,
      GOOGLE_ADS_REFRESH_TOKEN,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
    } = process.env;

    // 1) Check env vars
    const missing = [];
    if (!GOOGLE_ADS_DEVELOPER_TOKEN) missing.push("GOOGLE_ADS_DEVELOPER_TOKEN");
    if (!GOOGLE_ADS_LOGIN_CUSTOMER_ID) missing.push("GOOGLE_ADS_LOGIN_CUSTOMER_ID");
    if (!GOOGLE_ADS_REFRESH_TOKEN) missing.push("GOOGLE_ADS_REFRESH_TOKEN");
    if (!GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
    if (!GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");

    if (missing.length > 0) {
      return res.status(500).json({
        ok: false,
        step: "env_check",
        message: "Some required env vars are missing.",
        missing,
      });
    }

   // 2) Exchange refresh token -> access token
const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
    grant_type: "refresh_token",
  }),
});

console.log("TOKEN RESP STATUS:", tokenResp.status);   // <<< YE LINE


    const tokenJson = await tokenResp.json();

    if (!tokenResp.ok || !tokenJson.access_token) {
      return res.status(500).json({
        ok: false,
        step: "oauth_exchange",
        message: "Failed to exchange refresh token for access token.",
        details: tokenJson,
      });
    }

    const accessToken = tokenJson.access_token;

    // 3) Call Google Ads GAQL search using REST:
    // POST https://googleads.googleapis.com/v18/customers/{customerId}/googleAds:search
    const customerId = GOOGLE_ADS_LOGIN_CUSTOMER_ID; // e.g. "8060320443"

    const query = `
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone
      FROM customer
      LIMIT 1
    `;

    const adsResp = await fetch(
  `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`,
  {
    method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": GOOGLE_ADS_DEVELOPER_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      }
    );
console.log("ADS RESP STATUS:", adsResp.status);   // <<< YE LINE

    const text = await adsResp.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    if (!adsResp.ok) {
      return res.status(500).json({
        ok: false,
        step: "google_ads_call",
        message: "Google Ads API returned an error",
        status: adsResp.status,
        body: parsed,
      });
    }

    return res.status(200).json({
      ok: true,
      step: "google_ads_call",
      message: "Successfully called Google Ads GoogleAdsService.search",
      status: adsResp.status,
      response: parsed,
    });
  } catch (err) {
    console.error("Unexpected error in /api/google-ads/test:", err);
    return res.status(500).json({
      ok: false,
      step: "unexpected",
      message: "Unexpected server error",
      error: String(err?.message || err),
    });
  }
}
