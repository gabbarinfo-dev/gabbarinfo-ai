// pages/api/google-ads/test.js

import { GoogleAdsApi } from "google-ads-api";

export default async function handler(req, res) {
  try {
    const {
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_ADS_DEVELOPER_TOKEN,
      GOOGLE_ADS_REFRESH_TOKEN,
      GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    } = process.env;

    const missing = [];
    if (!GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
    if (!GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
    if (!GOOGLE_ADS_DEVELOPER_TOKEN) missing.push("GOOGLE_ADS_DEVELOPER_TOKEN");
    if (!GOOGLE_ADS_REFRESH_TOKEN) missing.push("GOOGLE_ADS_REFRESH_TOKEN");
    if (!GOOGLE_ADS_LOGIN_CUSTOMER_ID) missing.push("GOOGLE_ADS_LOGIN_CUSTOMER_ID");

    if (missing.length > 0) {
      return res.status(500).json({
        ok: false,
        step: "env_check",
        message: "Missing env vars",
        missing,
      });
    }

    // 1) Init Google Ads API client
    const client = new GoogleAdsApi({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      developer_token: GOOGLE_ADS_DEVELOPER_TOKEN,
    });

    // 2) Create a Customer instance using your MCC as both login & target
    const customer = client.Customer({
      customer_id: GOOGLE_ADS_LOGIN_CUSTOMER_ID,        // "8060320443"
      login_customer_id: GOOGLE_ADS_LOGIN_CUSTOMER_ID, // same MCC
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
    });

    // 3) Run a very simple GAQL query
    const query = `
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone
      FROM customer
      LIMIT 1
    `;

    const rows = await customer.query(query);

    return res.status(200).json({
      ok: true,
      step: "gaql_query",
      message: "Successfully queried Google Ads API via google-ads-api client.",
      rowCount: rows.length,
      rows,
    });
  } catch (err) {
    console.error("Google Ads test error:", err);
    return res.status(500).json({
      ok: false,
      step: "exception",
      message: "Unexpected error when calling Google Ads API",
      error: err.message || String(err),
    });
  }
}
