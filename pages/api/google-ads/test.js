// pages/api/google-ads/test.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { GoogleAdsApi } from "google-ads-api";

export default async function handler(req, res) {
  try {
    // 1) Check session (must be logged in via Google)
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res.status(401).json({ error: "Not signed in" });
    }

    // 2) We expect refreshToken from NextAuth (from your last login)
    const refreshToken = session.refreshToken;
    if (!refreshToken) {
      return res.status(400).json({
        error:
          "No Google refresh token found. Try signing out and signing in again, then call this endpoint.",
      });
    }

    // 3) Init Google Ads API client
    const client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });

    // Use your manager account (MCC) or any customer ID you want to query
    const managerId = process.env.GOOGLE_ADS_MANAGER_ID;

    const customer = client.Customer({
      customer_id: managerId,             // who we are querying
      refresh_token: refreshToken,        // whose Google login was used
      login_customer_id: managerId,       // MCC id (no dashes)
    });

    // 4) Simple query: list this customer's basic info
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
      usingCustomerId: managerId,
      rows,
    });
  } catch (err) {
    console.error("Google Ads test error:", err);
    return res.status(500).json({
      error: "Google Ads API call failed",
      details: err.message || String(err),
    });
  }
}
