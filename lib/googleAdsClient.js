import { GoogleAdsApi } from "google-ads-api";

let client = null;

export function getGoogleAdsClient() {
  if (client) return client;

  client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });

  return client;
}

export function getCustomer() {
  const client = getGoogleAdsClient();

  return client.Customer({
    customer_id: process.env.GOOGLE_ADS_CLIENT_ACCOUNT_ID,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  });
}
