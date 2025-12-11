// lib/googleAdsHelper.js
// Lightweight helper to exchange a Google refresh token for an access token
// and call Google Ads read-only endpoints (listAccessibleCustomers).
//
// Exports:
// - listAccessibleCustomers({ refreshToken }) => { ok, status, json }
// - exchangeRefreshToken({ refreshToken }) => { ok, status, json }

async function exchangeRefreshToken({ refreshToken }) {
  if (!refreshToken) {
    return { ok: false, status: 400, json: { error: "missing_refresh_token" } };
  }

  try {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const json = await resp.json();
    return { ok: resp.ok, status: resp.status, json };
  } catch (err) {
    return { ok: false, status: 500, json: { error: String(err.message || err) } };
  }
}

async function listAccessibleCustomers({ refreshToken }) {
  // Exchange refresh token -> access token
  const exch = await exchangeRefreshToken({ refreshToken });
  if (!exch.ok || !exch.json?.access_token) {
    return {
      ok: false,
      status: exch.status || 500,
      json: { error: "failed_token_exchange", details: exch.json },
    };
  }

  const accessToken = exch.json.access_token;

  try {
    // Call Google Ads listAccessibleCustomers
    const resp = await fetch(
      "https://googleads.googleapis.com/v18/customers:listAccessibleCustomers",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
        },
      }
    );

    const json = await resp.json();
    return { ok: resp.ok, status: resp.status, json };
  } catch (err) {
    return { ok: false, status: 500, json: { error: String(err.message || err) } };
  }
}

module.exports = {
  exchangeRefreshToken,
  listAccessibleCustomers,
};
