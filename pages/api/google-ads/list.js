// pages/api/google-ads/list.js
// Read-only helper: list all accessible Google Ads customers for your token.

export default async function handler(req, res) {
  try {
    const {
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_ADS_REFRESH_TOKEN,
      GOOGLE_ADS_DEVELOPER_TOKEN,
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

    // 1) Exchange refresh token → access token
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

    const tokenJson = await tokenResp.json();

    if (!tokenResp.ok || !tokenJson.access_token) {
      return res.status(500).json({
        ok: false,
        step: "token_exchange",
        message: "Failed to exchange refresh token",
        details: tokenJson,
      });
    }

    const accessToken = tokenJson.access_token;

    // 2) Call listAccessibleCustomers
    const adsResp = await fetch(
      "https://googleads.googleapis.com/v18/customers:listAccessibleCustomers",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": GOOGLE_ADS_DEVELOPER_TOKEN,
        },
      }
    );

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

    // 3) Success – return the resource names
    return res.status(200).json({
      ok: true,
      step: "list_accessible_customers",
      message: "Successfully listed accessible customers.",
      status: adsResp.status,
      resourceNames: parsed.resourceNames || [],
    });
  } catch (err) {
    console.error("Unexpected error in /api/google-ads/list:", err);
    return res.status(500).json({
      ok: false,
      step: "unexpected",
      message: "Unexpected server error",
      error: String(err?.message || err),
    });
  }
}
