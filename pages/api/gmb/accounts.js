// pages/api/gmb/accounts.js
// Handles listing and selecting Google Business Profile (GMB) accounts and locations

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import { getGmbAccessToken, listGmbAccounts, listGmbLocations } from "../../../lib/gmbHelper";

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

  // GET: Discover GMB accounts & locations
  if (req.method === "GET") {
    try {
      // 1. Fetch user's Google connection from Supabase
      const { data: connection } = await supabase
        .from("google_connections")
        .select("refresh_token, customer_id, updated_at")
        .eq("email", email)
        .maybeSingle();

      const refreshToken = connection?.refresh_token || session.refreshToken || null;

      if (!refreshToken) {
        return res.status(200).json({
          ok: true,
          connected: false,
          hasGmbScope: false,
          accounts: [],
          locations: [],
          selectedLocation: null,
          message: "Please sign in with Google to connect Google Business Profile.",
        });
      }

      // 2. Exchange token
      const tokenResult = await getGmbAccessToken({ refreshToken });
      if (!tokenResult.ok) {
        return res.status(200).json({
          ok: false,
          connected: false,
          needsReauth: true,
          message: "Failed to authenticate with Google. Please re-connect.",
        });
      }

      const { accessToken, scope } = tokenResult;
      const hasGmbScope = (scope || "").includes("business.manage");

      if (!hasGmbScope) {
        return res.status(200).json({
          ok: true,
          connected: false,
          hasGmbScope: false,
          needsReauth: true,
          accounts: [],
          locations: [],
          selectedLocation: null,
          message: "Google Business Profile permission not authorized. Please click Connect to grant access.",
        });
      }

      // 3. List Accounts
      const accountsRes = await listGmbAccounts({ accessToken });
      if (!accountsRes.ok) {
        const isQuotaZero =
          accountsRes.status === 429 ||
          accountsRes.json?.error?.details?.[0]?.reason === "RATE_LIMIT_EXCEEDED";

        return res.status(200).json({
          ok: false,
          connected: true,
          hasGmbScope: true,
          needsReauth: accountsRes.status === 403,
          quotaRestricted: isQuotaZero,
          message: isQuotaZero
            ? "Your Google Business Profile permission is approved! However, Google Cloud sets this API's initial quota to 0 until an access request is submitted for your project."
            : accountsRes.error || "Unable to access Google Business Profile accounts.",
          quotaUrl: "https://developers.google.com/my-business/content/prereqs#request-access",
          accounts: [],
          locations: [],
        });
      }

      const accounts = accountsRes.accounts || [];
      let allLocations = [];

      // 4. Fetch locations for the accounts
      for (const acc of accounts) {
        const locsRes = await listGmbLocations({ accessToken, accountName: acc.name });
        if (locsRes.ok && locsRes.locations) {
          allLocations.push(
            ...locsRes.locations.map((loc) => ({
              ...loc,
              accountName: acc.name,
              accountTitle: acc.accountName,
            }))
          );
        }
      }

      // 5. Get saved active location from agent_memory
      const { data: memRow } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", email)
        .eq("memory_type", "selected_gmb_location")
        .maybeSingle();

      let selectedLocation = null;
      if (memRow?.content) {
        try {
          selectedLocation = JSON.parse(memRow.content);
        } catch (_) {}
      }

      // If no saved selection but locations exist, default to the first
      if (!selectedLocation && allLocations.length > 0) {
        selectedLocation = allLocations[0];
      }

      return res.status(200).json({
        ok: true,
        connected: true,
        hasGmbScope: true,
        accounts,
        locations: allLocations,
        selectedLocation,
        totalLocations: allLocations.length,
      });
    } catch (err) {
      console.error("GMB accounts error:", err);
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  // POST: Set selected active GMB location
  if (req.method === "POST") {
    try {
      const { location } = req.body;
      if (!location) {
        return res.status(400).json({ ok: false, message: "Missing location data" });
      }

      const { getBusinessSubscriptionState } = await import("../../../lib/billing/quota-service");
      const { checkAssetTrialEligibility, registerAssetClaim } = await import("../../../lib/billing/asset-registry");

      const subState = await getBusinessSubscriptionState(`biz_${email.replace(/[^a-zA-Z0-9]/g, "_")}`, email);
      const plan = subState?.plan || {};
      const isTrial = plan.category === "trial" || plan.id === "trial_99" || plan.id === "none" || plan.id === "try";
      const locId = location.name || location.storeCode || location.title || "";

      if (locId) {
        const eligibility = await checkAssetTrialEligibility({
          assetType: "gmb_location",
          identifier: locId,
          userEmail: email,
        });

        if (!eligibility.eligible && isTrial && !subState.isUnlimited) {
          return res.status(403).json({
            ok: false,
            code: "DUPLICATE_TRIAL_ASSET",
            message: eligibility.error,
          });
        }
      }

      await supabase.from("agent_memory").upsert(
        {
          email,
          memory_type: "selected_gmb_location",
          content: JSON.stringify(location),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,memory_type" }
      );

      if (locId) {
        await registerAssetClaim({
          assetType: "gmb_location",
          identifier: locId,
          userEmail: email,
          planId: plan.id || "none",
          isTrial,
        });
      }

      return res.status(200).json({ ok: true, message: "Active location updated" });
    } catch (err) {
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  return res.status(405).json({ ok: false, message: "Method not allowed" });
}
