import axios from "axios";
import { getAccessToken } from "../../../lib/googleAdsClient";

export default async function handler(req, res) {
  try {
    const token = await getAccessToken();

    const customerId = process.env.GOOGLE_ADS_CLIENT_ACCOUNT_ID;
    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

    const query = `
  SELECT customer.id, customer.descriptive_name
  FROM customer
`;


const response = await axios.post(
  `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:searchStream`,
  { query },
  {
    headers: {
      Authorization: `Bearer ${token}`,
      "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      "login-customer-id": loginCustomerId,
      "Content-Type": "application/json"
    }
  }
);




    // searchStream returns array of batches
    const results = response.data.flatMap(batch => batch.results || []);

    return res.status(200).json({
      ok: true,
      results
    });

  } catch (err) {
    console.error("GOOGLE ADS LIST ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      ok: false,
      error: err.response?.data || err.message
    });
  }
}
