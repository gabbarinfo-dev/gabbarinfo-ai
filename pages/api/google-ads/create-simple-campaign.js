// pages/api/google-ads/create-simple-campaign.js
// Replaceable — server route that validates payload, and (optionally)
// verifies Google Ads credentials using a per-user refresh token stored
// in Supabase (public.google_connections).
//
// Requirements (env):
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - GOOGLE_ADS_BASIC_ACCESS (set to "true" to enable verification branch)
//
// NOTE: this file expects you already created lib/googleAdsHelper.js which
// exports listAccessibleCustomers({ refreshToken }) -> { ok, status, json }
// (the earlier helper you added).
import { getGoogleAdsCustomerForEmail } from "../../../lib/googleAdsClient";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]"; // path relative to this file
import { createClient } from "@supabase/supabase-js";
import { listAccessibleCustomers } from "../../../lib/googleAdsHelper";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Supabase access will fail for server-side token lookup."
  );
}

const supabaseServer = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

export default async function handler(req, res) {
  // CORS HEADERS
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Allow OPTIONS (preflight) + POST
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST is allowed." });
  }

  try {
    const body = req.body;

    if (!body || typeof body !== "object") {
      return res.status(400).json({
        ok: false,
        message: "Missing or invalid JSON body.",
      });
    }


    const { customerId, campaign, adGroups, refreshToken: incomingRefreshToken } = body;

    // --- validation (same rules you had) ---
    const errors = [];
    if (!customerId || typeof customerId !== "string") {
      errors.push("customerId (string) is required.");
    }

    if (!campaign || typeof campaign !== "object") {
      errors.push("campaign object is required.");
    } else {
      if (!campaign.name) errors.push("campaign.name is required.");
      if (!campaign.network) errors.push("campaign.network is required.");
      if (typeof campaign.dailyBudgetMicros !== "number") {
        errors.push("campaign.dailyBudgetMicros (number) is required.");
      }
      if (!campaign.finalUrl) errors.push("campaign.finalUrl is required.");
    }

    if (!Array.isArray(adGroups) || adGroups.length === 0) {
      errors.push("adGroups (non-empty array) is required.");
    } else {
      adGroups.forEach((ag, idx) => {
        if (!ag.name) errors.push(`adGroups[${idx}].name is required.`);
        if (typeof ag.cpcBidMicros !== "number") {
          errors.push(`adGroups[${idx}].cpcBidMicros (number) is required.`);
        }
        if (!Array.isArray(ag.keywords) || ag.keywords.length === 0) {
          errors.push(`adGroups[${idx}].keywords (non-empty array) is required.`);
        }
        if (!Array.isArray(ag.ads) || ag.ads.length === 0) {
          errors.push(`adGroups[${idx}].ads (non-empty array) is required.`);
        }
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({ ok: false, message: "Validation failed.", errors });
    }
    return res.status(200).json({
  ok: true,
  message: "API working. Google block skipped.",
});

    // ---------------------------
// REAL GOOGLE ADS CREATION
// ---------------------------

// const session = await getServerSession(req, res, authOptions);
// const email = session?.user?.email?.toLowerCase?.().trim?.();
const email = "test@test.com";


if (!email) {
  return res.status(401).json({
    ok: false,
    message: "No user email found in session.",
  });
}

const customer = await getGoogleAdsCustomerForEmail(email);

// 1. Budget
const budget = await customer.campaignBudgets.create({
  name: `Budget ${Date.now()}`,
  amount_micros: campaign.dailyBudgetMicros,
  delivery_method: "STANDARD",
});

// 2. Campaign
const createdCampaign = await customer.campaigns.create({
  name: campaign.name,
  advertising_channel_type: "SEARCH",
  status: "PAUSED",
  campaign_budget: budget.resource_name,
  network_settings: {
    target_google_search: true,
    target_search_network: true,
    target_content_network: false,
    target_partner_search_network: false,
  },
});

// 3. Ad Groups
for (const ag of adGroups) {
  const createdAdGroup = await customer.adGroups.create({
    name: ag.name,
    campaign: createdCampaign.resource_name,
    cpc_bid_micros: ag.cpcBidMicros,
  });

  // 4. Keywords
  for (const kw of ag.keywords) {
    await customer.adGroupCriteria.create({
      ad_group: createdAdGroup.resource_name,
      keyword: {
        text: kw,
        match_type: "PHRASE",
      },
      status: "ENABLED",
    });
  }

  // 5. Ads
  for (const ad of ag.ads) {
    await customer.adGroupAds.create({
      ad_group: createdAdGroup.resource_name,
      ad: {
        final_urls: [campaign.finalUrl],
        responsive_search_ad: {
          headlines: [
            { text: ad.headline1 },
            { text: ad.headline2 },
            { text: ad.headline3 },
          ],
          descriptions: [
            { text: ad.description1 },
            { text: ad.description2 },
          ],
        },
      },
      status: "PAUSED",
    });
  }
}

return res.status(200).json({
  ok: true,
  message: "Search campaign created successfully (PAUSED).",
});

} catch (err) {
  console.error("Unhandled error in create-simple-campaign:", err);
  return res.status(500).json({
    ok: false,
    message: "Server error while handling campaign creation.",
    error: String(err.message || err),
  });
}
}

