// lib/googleAdsClient.js
import { GoogleAdsApi } from "google-ads-api";
import { supabaseServer } from "./supabaseServer";

// One singleton API instance for the whole app
const googleAdsApi = new GoogleAdsApi({
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

/**
 * Get a Google Ads "customer" instance for a given user email.
 * This is what your agent will use to create campaigns, ad groups, etc.
 */
export async function getGoogleAdsCustomerForEmail(email) {
  const cleanEmail = email.toLowerCase().trim();

  // 1) Fetch tokens + customer_id from Supabase
  const { data, error } = await supabaseServer
    .from("google_connections")
    .select("refresh_token, customer_id")
    .eq("email", cleanEmail)
    .maybeSingle();

  if (error) {
    console.error("Supabase error in getGoogleAdsCustomerForEmail:", error);
    throw new Error("Failed to load Google connection from DB");
  }

  if (!data) {
    throw new Error("No google_connections row found for this user");
  }

  if (!data.refresh_token) {
    throw new Error(
      "Missing refresh_token – user needs to re-connect Google with consent prompt"
    );
  }

  if (!data.customer_id) {
    throw new Error(
      "Missing customer_id in google_connections – set the client’s Google Ads customer id first"
    );
  }

  // 2) Build a customer object using the library
  const customer = googleAdsApi.Customer({
    customer_id: data.customer_id.replace(/-/g, ""), // library expects digits only
    refresh_token: data.refresh_token,
    login_customer_id: process.env.GOOGLE_ADS_MANAGER_ID
      ? process.env.GOOGLE_ADS_MANAGER_ID.replace(/-/g, "")
      : undefined,
  });

  return customer; // caller can now do customer.campaigns.list(), etc.
}
