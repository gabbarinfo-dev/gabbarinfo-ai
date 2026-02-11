import { getCustomer } from "../../../lib/googleAdsClient";

export default async function handler(req, res) {
  try {
    const customer = getCustomer();

    const campaigns = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status
      FROM campaign
      ORDER BY campaign.id DESC
      LIMIT 20
    `);

    return res.status(200).json({
      ok: true,
      campaigns,
    });
  } catch (err) {
    console.error("Google Ads List Error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}
