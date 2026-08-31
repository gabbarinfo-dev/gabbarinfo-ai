// pages/api/google-ads/debug.js
// TEMPORARY debug endpoint to diagnose Google Ads API connectivity
// Remove this file after debugging is done.

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const email = session.user.email.toLowerCase().trim();

  // 1. Check env vars (safe: only shows if set or not, not actual values)
  const envCheck = {
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_ADS_DEVELOPER_TOKEN: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    GOOGLE_ADS_DEVELOPER_TOKEN_LENGTH: process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.length || 0,
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "NOT SET",
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  // 2. Check Supabase connection record
  const { data: conn, error: connErr } = await supabase
    .from("google_connections")
    .select("refresh_token, customer_id, updated_at")
    .eq("email", email)
    .maybeSingle();

  const supabaseCheck = {
    error: connErr?.message || null,
    hasRefreshToken: !!conn?.refresh_token,
    refreshTokenLength: conn?.refresh_token?.length || 0,
    customerId: conn?.customer_id || null,
    updatedAt: conn?.updated_at || null,
  };

  // 3. Try token exchange
  let tokenExchange = { ok: false, error: null, statusCode: null };
  const refreshToken = conn?.refresh_token;
  if (refreshToken) {
    try {
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      });
      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      const tokenJson = await tokenResp.json();
      tokenExchange = {
        ok: tokenResp.ok,
        statusCode: tokenResp.status,
        hasAccessToken: !!tokenJson.access_token,
        scope: tokenJson.scope || null,
        error: tokenJson.error || null,
        errorDescription: tokenJson.error_description || null,
      };

      // 4. If token exchange worked, try listAccessibleCustomers
      if (tokenResp.ok && tokenJson.access_token) {
        const accessToken = tokenJson.access_token;
        const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "";

        const listResp = await fetch(
          "https://googleads.googleapis.com/v18/customers:listAccessibleCustomers",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "developer-token": devToken,
              "Content-Type": "application/json",
            },
          }
        );
        const listJson = await listResp.json();

        return res.status(200).json({
          email,
          envCheck,
          supabaseCheck,
          tokenExchange,
          listAccessibleCustomers: {
            ok: listResp.ok,
            status: listResp.status,
            resourceNames: listJson.resourceNames || null,
            error: listJson.error || null,
          },
          developerTokenUsed: devToken ? `${devToken.slice(0, 4)}...${devToken.slice(-4)} (${devToken.length} chars)` : "EMPTY — NOT SET IN VERCEL",
        });
      }
    } catch (e) {
      tokenExchange.error = e.message;
    }
  }

  return res.status(200).json({
    email,
    envCheck,
    supabaseCheck,
    tokenExchange,
  });
}
