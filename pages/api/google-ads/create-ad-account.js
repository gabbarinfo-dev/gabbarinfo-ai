// pages/api/google-ads/create-ad-account.js
// Provisions a new Google Ads account under the Agency MCC (CustomerService.CreateCustomerClient)
// or guides the user seamlessly if MCC requires prior spend history.

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import { exchangeRefreshToken, cleanCustomerId } from "../../../lib/googleAdsHelper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(
  SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY || ""
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ ok: false, message: "Not authenticated" });
  }

  const email = session.user.email.toLowerCase().trim();

  try {
    const { accountName, currencyCode = "INR", timeZone = "Asia/Kolkata" } = req.body;

    if (!accountName) {
      return res.status(400).json({ ok: false, message: "Account / Business name is required." });
    }

    const MCC_ID = cleanCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
    const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

    if (!MCC_ID || !DEVELOPER_TOKEN) {
      return res.status(400).json({
        ok: false,
        message: "Google Ads Manager Account (MCC) is not configured on the server.",
      });
    }

    // 1. Fetch user or agency refresh token
    const { data: connection } = await supabase
      .from("google_connections")
      .select("refresh_token")
      .eq("email", email)
      .maybeSingle();

    const refreshToken = connection?.refresh_token || session.refreshToken || null;

    if (!refreshToken) {
      return res.status(400).json({
        ok: false,
        message: "No Google authorization found. Please sign in with Google.",
      });
    }

    // 2. Exchange token
    const tokenResult = await exchangeRefreshToken({ refreshToken });
    if (!tokenResult.ok) {
      return res.status(400).json({ ok: false, message: "Failed to exchange Google OAuth token." });
    }

    const accessToken = tokenResult.accessToken;

    // 3. Call Google Ads API v22 createCustomerClient
    const createUrl = `https://googleads.googleapis.com/v22/customers/${MCC_ID}:createCustomerClient`;
    const createResp = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": DEVELOPER_TOKEN,
        "login-customer-id": MCC_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerClient: {
          descriptiveName: accountName,
          currencyCode,
          timeZone,
        },
        emailAddress: email,
        accessRole: "ADMIN",
      }),
    });

    const createJson = await createResp.json();

    // Handle Google Ads anti-fraud policy (Ineligible MCC until $1,000 spend)
    if (!createResp.ok) {
      const firstError = createJson?.error?.details?.[0]?.errors?.[0];
      const errorCode = firstError?.errorCode?.customerError;
      const errorMsg = firstError?.message || createJson?.error?.message || "Failed to create Google Ads account.";

      if (errorCode === "CREATION_DENIED_INELIGIBLE_MCC") {
        return res.status(200).json({
          ok: false,
          policyRestricted: true,
          code: "CREATION_DENIED_INELIGIBLE_MCC",
          message:
            "Google Ads requires new advertisers to create their initial account with payment verification directly at ads.google.com.",
          actionUrl: "https://ads.google.com/home/",
          instructions:
            "1. Click the link to open Google Ads.\n2. Create your account with your billing details (takes 60 seconds).\n3. Return here and click 'Refresh Account List' — your new account will instantly appear!",
        });
      }

      return res.status(400).json({
        ok: false,
        message: errorMsg,
        details: createJson,
      });
    }

    // 4. Extract new customer ID
    // Resource name format: "customers/1234567890"
    const resourceName = createJson.resourceName || "";
    const newCustomerId = cleanCustomerId(resourceName.replace("customers/", ""));

    if (newCustomerId) {
      // Save newly created customer_id for this user
      await supabase
        .from("google_connections")
        .update({
          customer_id: newCustomerId,
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);
    }

    return res.status(200).json({
      ok: true,
      customerId: newCustomerId,
      resourceName,
      invitationLink: createJson.invitationLink || null,
      message: `Google Ads account "${accountName}" (ID: ${newCustomerId}) created and linked successfully!`,
    });
  } catch (err) {
    console.error("Google Ads account creation error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}
