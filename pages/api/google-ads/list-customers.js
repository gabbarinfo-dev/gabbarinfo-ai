// pages/api/google-ads/list-customers.js

export default async function handler(req, res) {
  // 1) Check required env vars
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_ADS_REFRESH_TOKEN,
    GOOGLE_ADS_DEVELOPER_TOKEN,
    // GOOGLE_ADS_LOGIN_CUSTOMER_ID, // NOT needed for this particular call
  } = process.env;

  const missing = [];
  if (!GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
  if (!GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
  if (!GOOGLE_ADS_REFRESH_TOKEN) missing.push("GOOGLE_ADS_REFRESH_TOKEN");
  if (!GOOGLE_ADS_DEVELOPER_TOKEN) missing.push("GOOGLE_ADS_DEVELOPER_TOKEN");

  if (missing.length > 0) {
    return res.status(500).json({
      ok: false,
      step: "env_check",
      message: "Missing env vars",
      missing,
    });
  }

  try {
    // 2) Exchange refresh token -> access token
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });

    const tokenJson = await tokenResp.json();

    if (!tokenResp.ok || !tokenJson.access_token) {
      console.error("Token exchange error:", tokenJson);
      return res.status(500).json({
        ok: false,
        step: "token_exchange",
        message: "Failed to exchange refresh token",
        details: tokenJson,
      });
    }

    const accessToken = tokenJson.access_token;

    // 3) Call Google Ads API (read-only): listAccessibleCustomers
    const adsResp = await fetch(
      "https://googleads.googleapis.com/v18/customers:listAccessibleCustomers",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": GOOGLE_ADS_DEVELOPER_TOKEN,
          // IMPORTANT: no login-customer-id / customer-id headers for this method
        },
      }
    );

    const adsJson = await adsResp.json();

    if (!adsResp.ok) {
      console.error("Google Ads API error:", adsJson);
      return res.status(500).json({
        ok: false,
        step: "google_ads_call",
        message: "Google Ads API returned an error",
        details: adsJson,
      });
    }

    return res.status(200).json({
      ok: true,
      step: "list_customers",
      message: "Successfully called Google Ads API",
      resourceNames: adsJson.resourceNames || [],
    });
  } catch (err) {
    console.error("Unexpected error in /api/google-ads/list-customers:", err);
    return res.status(500).json({
      ok: false,
      step: "exception",
      message: "Unexpected server error",
      error: err.message,
    });
  }
}
