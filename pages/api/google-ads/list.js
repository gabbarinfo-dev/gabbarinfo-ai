import { getAccessToken } from "../../../lib/googleAdsClient";

export const config = {
  runtime: "nodejs"
};

export default async function handler(req, res) {
  try {
    const token = await getAccessToken();

    const customerId = process.env.GOOGLE_ADS_CLIENT_ACCOUNT_ID;

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status
      FROM campaign
      LIMIT 20
    `;

    const url = `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:searchStream`;

    console.log("GOOGLE ADS URL:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        "Content-Type": "application/json",
        "x-goog-user-project": process.env.GOOGLE_CLOUD_PROJECT_ID
      },
      body: JSON.stringify({ query })
    });

    const raw = await response.text();
    console.log("GOOGLE RAW RESPONSE:", raw);

    if (!response.ok) {
      throw new Error(raw);
    }

    const data = JSON.parse(raw);

    const results = Array.isArray(data)
      ? data.flatMap(batch => batch.results || [])
      : [];

    return res.status(200).json({
      ok: true,
      results
    });

  } catch (err) {
    console.error("GOOGLE ADS LIST ERROR:", err.message);

    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}
