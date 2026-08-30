// pages/api/google-ads/accounts.js
// Lists accessible Google Ads client accounts for the logged-in user
// and handles selecting/saving the active Google Ads Customer ID.
//
// Uses getAccountHierarchy() which queries customer_client under the MCC
// (GOOGLE_ADS_LOGIN_CUSTOMER_ID) — the correct approach for Agency/MCC accounts.

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import {
  cleanCustomerId,
  getAccountHierarchy,
} from "../../../lib/googleAdsHelper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(
  SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY || ""
);

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ ok: false, message: "Not authenticated" });
  }

  const email = session.user.email.toLowerCase().trim();

  // ----------------------------------------------------
  // GET: List accessible Google Ads accounts & selected ID
  // ----------------------------------------------------
  if (req.method === "GET") {
    try {
      // 1. Fetch user's Google connection from Supabase
      const { data: connection, error: connErr } = await supabase
        .from("google_connections")
        .select("refresh_token, customer_id, updated_at")
        .eq("email", email)
        .maybeSingle();

      if (connErr) {
        console.error("Error fetching google_connections:", connErr);
      }

      // Check for refresh token in DB or in session
      const refreshToken =
        connection?.refresh_token || session.refreshToken || null;

      if (!refreshToken) {
        return res.status(200).json({
          ok: true,
          connected: false,
          message:
            "No Google Ads authorization found. Please sign in with Google to connect your account.",
          accounts: [],
          selectedCustomerId: null,
        });
      }

      // 2. Use getAccountHierarchy — queries customer_client under MCC
      //    GOOGLE_ADS_LOGIN_CUSTOMER_ID = 8060320443 (set in Vercel env vars)
      const hierarchyResp = await getAccountHierarchy({ refreshToken });

      if (!hierarchyResp.ok) {
        // Provide a detailed error message for debugging
        const apiError =
          hierarchyResp.json?.error?.message ||
          hierarchyResp.json?.error?.details?.[0]?.errors?.[0]?.message ||
          JSON.stringify(hierarchyResp.json || {});

        console.error("getAccountHierarchy failed:", hierarchyResp.json);

        return res.status(200).json({
          ok: false,
          connected: true,
          error: "failed_to_list_accounts",
          message: `Failed to retrieve Google Ads accounts: ${apiError}`,
          details: hierarchyResp.json,
          accounts: [],
          selectedCustomerId: connection?.customer_id || null,
        });
      }

      const accountDetails = hierarchyResp.accounts || [];

      // 3. Determine selected Customer ID
      let selectedCustomerId = connection?.customer_id || null;

      // Auto-select the only account if none selected yet
      if (!selectedCustomerId && accountDetails.length === 1) {
        selectedCustomerId = accountDetails[0].customerId;

        // Save the auto-selected ID to Supabase
        await supabase
          .from("google_connections")
          .upsert(
            {
              email,
              customer_id: selectedCustomerId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "email" }
          );
      }

      return res.status(200).json({
        ok: true,
        connected: true,
        accounts: accountDetails,
        selectedCustomerId,
      });
    } catch (err) {
      console.error("GET /api/google-ads/accounts error:", err);
      return res.status(500).json({
        ok: false,
        message: "Internal server error fetching Google Ads accounts",
        error: String(err.message || err),
      });
    }
  }

  // ----------------------------------------------------
  // POST: Select / Switch Active Google Ads Customer ID
  // ----------------------------------------------------
  if (req.method === "POST") {
    try {
      const { customerId } = req.body || {};
      const cleanId = cleanCustomerId(customerId);

      if (!cleanId) {
        return res
          .status(400)
          .json({ ok: false, message: "Valid customerId is required" });
      }

      // Update in Supabase google_connections
      const { error: updateErr } = await supabase
        .from("google_connections")
        .upsert(
          {
            email,
            customer_id: cleanId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email" }
        );

      if (updateErr) {
        console.error("Error updating selected customer_id:", updateErr);
        return res.status(500).json({
          ok: false,
          message: "Failed to save selected Google Ads customer ID.",
          error: updateErr.message,
        });
      }

      return res.status(200).json({
        ok: true,
        message: "Active Google Ads account updated successfully.",
        selectedCustomerId: cleanId,
      });
    } catch (err) {
      console.error("POST /api/google-ads/accounts error:", err);
      return res.status(500).json({
        ok: false,
        message: "Internal server error updating selected Google Ads account",
        error: String(err.message || err),
      });
    }
  }

  return res.status(405).json({ ok: false, message: "Method not allowed" });
}
