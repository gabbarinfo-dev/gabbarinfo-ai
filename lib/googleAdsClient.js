import axios from "axios";

let cachedToken = null;
let tokenExpiry = 0;

export async function getAccessToken() {
  const now = Date.now();

  // Reuse token if still valid
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const params = new URLSearchParams();
  params.append("client_id", process.env.GOOGLE_CLIENT_ID);
  params.append("client_secret", process.env.GOOGLE_CLIENT_SECRET);
  params.append("refresh_token", process.env.GOOGLE_ADS_REFRESH_TOKEN);
  params.append("grant_type", "refresh_token");

  const resp = await axios.post(
    "https://oauth2.googleapis.com/token",
    params,
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  cachedToken = resp.data.access_token;
  tokenExpiry = now + resp.data.expires_in * 1000 - 60000; // minus 1 min buffer

  return cachedToken;
}
