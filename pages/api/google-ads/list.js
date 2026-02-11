import { getAccessToken } from "../../../lib/googleAdsClient";

export default async function handler(req, res) {
  try {
    const token = await getAccessToken();

    const customerId = process.env.GOOGLE_ADS_CLIENT_ACCOUNT_ID;
    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status
      FROM campaign
      LIMIT 20
    `;

    const url = `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`;

    console.log("GOOGLE ADS URL:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        "login-customer-id": loginCustomerId,
        "Content-Type": "application/json",
        "x-goog-user-project": process.env.GOOGLE_CLOUD_PROJECT_ID
      },
      body: JSON.stringify({ query })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        ok: false,
        error: data
      });
    }

    return res.status(200).json({
      ok: true,
      results: data.results || []
    });

  } catch (err) {
    console.error("GOOGLE ADS LIST ERROR:", err);

    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}
