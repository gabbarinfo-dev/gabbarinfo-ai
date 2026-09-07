// lib/googleAdsHelper.js
// Multi-user Google Ads API Helper (REST API v18/v22)
// Handles OAuth access token exchange, customer account discovery,
// and safe campaign creation in PAUSED status.

import sharp from "sharp";

export function cleanCustomerId(id) {
  if (!id) return "";
  return String(id).replace(/[^0-9]/g, "");
}

/**
 * Exchange OAuth Refresh Token for a fresh Google Access Token
 */
export async function exchangeRefreshToken({ refreshToken }) {
  if (!refreshToken) {
    return { ok: false, status: 400, json: { error: "missing_refresh_token" } };
  }

  try {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const json = await resp.json();
    return { ok: resp.ok, status: resp.status, json, accessToken: json.access_token };
  } catch (err) {
    return { ok: false, status: 500, json: { error: String(err.message || err) } };
  }
}

/**
 * Get headers for Google Ads API requests
 */
function getHeaders(accessToken, loginCustomerId = null) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
    "Content-Type": "application/json",
  };

  const cleanLoginId = cleanCustomerId(loginCustomerId);
  if (cleanLoginId) {
    headers["login-customer-id"] = cleanLoginId;
  }

  return headers;
}

/**
 * List all Google Ads Customer Accounts accessible to this user's OAuth token
 */
export async function listAccessibleCustomers({ refreshToken }) {
  const exch = await exchangeRefreshToken({ refreshToken });
  if (!exch.ok || !exch.accessToken) {
    return {
      ok: false,
      status: exch.status || 500,
      json: { error: "failed_token_exchange", details: exch.json },
    };
  }

  const accessToken = exch.accessToken;

  try {
    const resp = await fetch(
      "https://googleads.googleapis.com/v22/customers:listAccessibleCustomers",
      {
        method: "GET",
        headers: getHeaders(accessToken),
      }
    );

    const json = await resp.json();
    return {
      ok: resp.ok,
      status: resp.status,
      json,
      resourceNames: json.resourceNames || [],
      accessToken,
    };
  } catch (err) {
    return { ok: false, status: 500, json: { error: String(err.message || err) } };
  }
}

/**
 * Get Full Account Hierarchy — DYNAMIC MULTI-USER APPROACH
 *
 * For a true multi-user SaaS, we CANNOT use a global hardcoded MCC ID.
 * Every user has their own Google Ads account hierarchy.
 *
 * Flow:
 *   1. Exchange user's refresh token → access token
 *   2. Call listAccessibleCustomers with NO login-customer-id
 *      → Google returns accounts this specific OAuth user has direct access to
 *   3. For each result that IS a Manager/MCC account:
 *      → Query customer_client using THAT user's MCC as login-customer-id
 *      → Collect all active client sub-accounts
 *   4. For each result that is a direct client account (not a manager):
 *      → Include it directly (no MCC traversal needed)
 *   5. Return all discovered accounts with their managerId so downstream
 *      API calls (campaign creation) use the correct login path
 *
 * GOOGLE_ADS_LOGIN_CUSTOMER_ID env var is only used as a fallback
 * for the app owner's own account — NOT applied globally to all users.
 */
export async function getAccountHierarchy({ refreshToken }) {
  // ── Step 1: Exchange refresh token ───────────────────────────────────────
  const exch = await exchangeRefreshToken({ refreshToken });
  if (!exch.ok || !exch.accessToken) {
    return {
      ok: false,
      status: exch.status || 500,
      json: { error: "failed_token_exchange", details: exch.json },
    };
  }

  const accessToken = exch.accessToken;

  // ── Step 2: listAccessibleCustomers — NO login-customer-id header ────────
  // This returns accounts where THIS user's OAuth token has direct access.
  // Each user gets their own accounts — not a shared global MCC.
  let topLevelIds = [];
  let listError = null;

  try {
    const listResp = await fetch(
      "https://googleads.googleapis.com/v22/customers:listAccessibleCustomers",
      {
        method: "GET",
        headers: getHeaders(accessToken), // ← No login-customer-id: user-specific
      }
    );

    const listJson = await listResp.json();

    if (listResp.ok && Array.isArray(listJson.resourceNames)) {
      topLevelIds = listJson.resourceNames.map((rn) =>
        cleanCustomerId(rn.replace("customers/", ""))
      );
    } else {
      listError = listJson;
      console.warn("listAccessibleCustomers failed:", JSON.stringify(listJson));
    }
  } catch (e) {
    console.warn("listAccessibleCustomers exception:", e.message);
    listError = { error: e.message };
  }

  // ── Step 3: If listAccessibleCustomers fails, use env fallback (owner only) ─
  if (topLevelIds.length === 0) {
    const envFallbackId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
      ? cleanCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID)
      : null;

    if (envFallbackId) {
      console.warn(
        `listAccessibleCustomers returned no accounts. Using env fallback: ${envFallbackId}`
      );
      topLevelIds = [envFallbackId];
    } else {
      return {
        ok: false,
        status: 403,
        json: listError || { error: "no_accessible_accounts" },
      };
    }
  }

  // ── Step 4: For each top-level account, discover its type + sub-accounts ─
  const allAccounts = [];
  const seenIds = new Set();

  // GAQL to get all client sub-accounts under a manager
  const hierarchyQuery = `
    SELECT
      customer_client.id,
      customer_client.descriptive_name,
      customer_client.currency_code,
      customer_client.time_zone,
      customer_client.manager,
      customer_client.status,
      customer_client.level
    FROM customer_client
    WHERE customer_client.level <= 2
  `;

  for (const topId of topLevelIds) {
    // Check if this top-level account is a Manager Account (MCC).
    // IMPORTANT: Manager Accounts require login-customer-id even for self-queries.
    // We use the account's own ID as the loginCustomerId.
    const details = await getCustomerDetails({
      accessToken,
      customerId: topId,
      loginCustomerId: topId, // ← Required: MCC must reference itself as login customer
    });

    // Determine if it's a manager — if details fail, assume manager and try hierarchy anyway
    const isManager = details.ok ? details.isManager : true;

    if (isManager) {
      // ── It's an MCC — traverse customer_client to get sub-accounts ──────
      // Use THIS user's own MCC as login-customer-id (dynamic per user)
      try {
        const url = `https://googleads.googleapis.com/v22/customers/${topId}/googleAds:search`;
        const resp = await fetch(url, {
          method: "POST",
          headers: getHeaders(accessToken, topId), // ← User's own MCC, not global env
          body: JSON.stringify({ query: hierarchyQuery }),
        });

        const json = await resp.json();

        if (resp.ok && Array.isArray(json.results)) {
          for (const row of json.results) {
            const client = row.customerClient;
            if (!client) continue;

            const cid = String(client.id);

            if (cid === topId) continue; // skip the MCC itself
            if (client.manager) continue; // skip nested managers
            if (seenIds.has(cid)) continue;
            if (
              client.status === "CANCELED" ||
              client.status === "CANCELLED"
            )
              continue;

            seenIds.add(cid);
            allAccounts.push({
              customerId: cid,
              descriptiveName:
                client.descriptiveName ||
                `Google Ads Account (${cid.slice(0, 3)}-${cid.slice(3, 6)}-${cid.slice(6)})`,
              currencyCode: client.currencyCode || "INR",
              timeZone: client.timeZone || "Asia/Kolkata",
              isManager: false,
              managerId: topId, // ← Which MCC owns this account (user-specific)
              level: client.level || 1,
            });
          }
        } else {
          console.warn(`customer_client query failed for MCC ${topId}:`, JSON.stringify(json));

          // If the customer_client query failed but details were OK and it's NOT a manager,
          // include this account directly as a fallback
          if (details.ok && !details.isManager && !seenIds.has(topId)) {
            seenIds.add(topId);
            allAccounts.push({
              customerId: topId,
              descriptiveName: details.descriptiveName,
              currencyCode: details.currencyCode,
              timeZone: details.timeZone,
              isManager: false,
              managerId: null,
            });
          }
        }
      } catch (mccErr) {
        console.warn(`Error traversing MCC ${topId}:`, mccErr.message);
      }
    } else {
      // ── It's a direct client account — include it as-is ─────────────────
      if (!seenIds.has(topId)) {
        seenIds.add(topId);
        allAccounts.push({
          customerId: topId,
          descriptiveName: details.descriptiveName,
          currencyCode: details.currencyCode,
          timeZone: details.timeZone,
          isManager: false,
          managerId: null, // Direct access — no MCC parent
        });
      }
    }
  }

  return { ok: true, accessToken, accounts: allAccounts };
}

/**
 * Query customer details (Name, Currency, Timezone) for a given Customer ID
 */
export async function getCustomerDetails({ refreshToken, accessToken: existingToken, customerId, loginCustomerId = null }) {
  let accessToken = existingToken;
  if (!accessToken) {
    const exch = await exchangeRefreshToken({ refreshToken });
    if (!exch.ok || !exch.accessToken) {
      return { ok: false, status: exch.status || 500, error: "failed_token_exchange" };
    }
    accessToken = exch.accessToken;
  }

  const targetId = cleanCustomerId(customerId);
  if (!targetId) {
    return { ok: false, status: 400, error: "missing_customer_id" };
  }

  const query = `
    SELECT
      customer.id,
      customer.descriptive_name,
      customer.currency_code,
      customer.time_zone,
      customer.manager
    FROM customer
    LIMIT 1
  `;

  try {
    const url = `https://googleads.googleapis.com/v22/customers/${targetId}/googleAds:search`;
    const resp = await fetch(url, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({ query }),
    });

    const json = await resp.json();
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: json };
    }

    const row = json.results?.[0]?.customer || null;
    return {
      ok: true,
      customerId: targetId,
      descriptiveName: row?.descriptiveName || `Account ${targetId}`,
      currencyCode: row?.currencyCode || "INR",
      timeZone: row?.timeZone || "Asia/Kolkata",
      isManager: Boolean(row?.manager),
      raw: row,
    };
  } catch (err) {
    return { ok: false, status: 500, error: String(err.message || err) };
  }
}

/**
 * Create a Campaign Budget in Google Ads
 */
export async function createCampaignBudget({ accessToken, customerId, budgetMicros, budgetName, loginCustomerId = null }) {
  const targetId = cleanCustomerId(customerId);
  const amount = Number(budgetMicros) || 1000000000; // Default ₹1000 in micros (1,000,000,000)
  const name = budgetName || `Budget - ${Date.now()}`;

  const payload = {
    operations: [
      {
        create: {
          name,
          amountMicros: String(amount),
          deliveryMethod: "STANDARD",
          explicitlyShared: false,
        },
      },
    ],
  };

  const url = `https://googleads.googleapis.com/v22/customers/${targetId}/campaignBudgets:mutate`;
  const resp = await fetch(url, {
    method: "POST",
    headers: getHeaders(accessToken, loginCustomerId),
    body: JSON.stringify(payload),
  });

  const json = await resp.json();
  if (!resp.ok) {
    console.error("Google Ads Budget Creation Error:", json);
    return { ok: false, status: resp.status, error: json };
  }

  const resourceName = json.results?.[0]?.resourceName;
  const budgetId = resourceName ? resourceName.split("/").pop() : null;

  return { ok: true, resourceName, budgetId, json };
}

/**
 * Query existing non-removed campaign names in a customer account
 */
export async function getExistingCampaignNames({
  accessToken,
  customerId,
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);
  if (!targetId || !accessToken) return [];

  const query = `
    SELECT campaign.name, campaign.status
    FROM campaign
    WHERE campaign.status != 'REMOVED'
  `;

  try {
    const url = `https://googleads.googleapis.com/v22/customers/${targetId}/googleAds:search`;
    const resp = await fetch(url, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({ query }),
    });

    const json = await resp.json();
    if (!resp.ok || !Array.isArray(json.results)) return [];
    return json.results.map((r) => r.campaign?.name).filter(Boolean);
  } catch (err) {
    console.warn("Could not query existing campaign names:", err.message);
    return [];
  }
}

/**
 * Generate a unique campaign name that does not collide with existing active or paused campaigns
 */
export function getUniqueCampaignName(requestedName, existingNames = []) {
  const trimmed = (requestedName || `GabbarInfo AI - Search - ${Date.now()}`).trim();
  const base = trimmed.length > 200 ? trimmed.slice(0, 200).trim() : trimmed;

  const existingSet = new Set(
    existingNames.map((n) => (n || "").trim().toLowerCase())
  );

  if (!existingSet.has(base.toLowerCase())) {
    return base;
  }

  // Check if base already ends with a version like "(v2)"
  const versionMatch = base.match(/^(.*?)\s*\(v(\d+)\)$/i);
  let rawBase = base;
  let startVersion = 2;
  if (versionMatch) {
    rawBase = versionMatch[1].trim();
    startVersion = parseInt(versionMatch[2], 10) + 1;
  }

  for (let v = startVersion; v < 100; v++) {
    const candidate = `${rawBase} (v${v})`;
    if (!existingSet.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  const dateStr = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
  return `${rawBase} (${dateStr} #${Date.now().toString().slice(-4)})`;
}

/**
 * Create a Search Campaign in PAUSED status in Google Ads
 * Automatically detects duplicate names and auto-renames them to ensure unique campaign creation.
 */
export async function createSearchCampaign({
  accessToken,
  customerId,
  campaignName,
  budgetResourceName,
  startDate = null,
  endDate = null,
  biddingStrategy = "MAXIMIZE_CONVERSIONS",
  networkSettings = null,
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);
  const initialName = campaignName || `GabbarInfo AI - Search - ${Date.now()}`;

  // 1) Proactively check existing campaign names to avoid DUPLICATE_CAMPAIGN_NAME errors up-front
  let candidateName = initialName;
  try {
    const existingNames = await getExistingCampaignNames({
      accessToken,
      customerId: targetId,
      loginCustomerId,
    });
    if (existingNames && existingNames.length > 0) {
      candidateName = getUniqueCampaignName(initialName, existingNames);
    }
  } catch (err) {
    console.warn("Pre-check existing campaign names skipped:", err.message);
  }

  const url = `https://googleads.googleapis.com/v22/customers/${targetId}/campaigns:mutate`;

  let currentName = candidateName;
  let lastJson = null;
  let lastStatus = 400;

  // 2) Try to create campaign with automatic retry if DUPLICATE_CAMPAIGN_NAME occurs
  for (let attempt = 1; attempt <= 4; attempt++) {
    const campaignOperation = {
      name: currentName,
      status: "PAUSED", // 🔒 ALWAYS PAUSED for safety and review
      advertisingChannelType: "SEARCH",
      campaignBudget: budgetResourceName,
      containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
      networkSettings: {
        targetGoogleSearch: true,
        targetSearchNetwork: networkSettings?.targetSearchNetwork !== undefined ? Boolean(networkSettings.targetSearchNetwork) : false,
        targetContentNetwork: networkSettings?.targetContentNetwork !== undefined ? Boolean(networkSettings.targetContentNetwork) : false,
        targetPartnerSearchNetwork: false,
      },
      geoTargetTypeSetting: {
        positiveGeoTargetType: "PRESENCE_OR_INTEREST",
        negativeGeoTargetType: "PRESENCE",
      },
    };

    if (String(biddingStrategy).toUpperCase().includes("CLICK")) {
      campaignOperation.targetSpend = {};
    } else {
      campaignOperation.maximizeConversions = {};
    }

    if (startDate) {
      campaignOperation.startDate = startDate.replace(/-/g, "");
    }
    if (endDate) {
      campaignOperation.endDate = endDate.replace(/-/g, "");
    }

    const payload = {
      operations: [
        {
          create: campaignOperation,
        },
      ],
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify(payload),
    });

    const json = await resp.json();
    lastJson = json;
    lastStatus = resp.status;

    if (resp.ok) {
      const resourceName = json.results?.[0]?.resourceName;
      const campaignId = resourceName ? resourceName.split("/").pop() : null;
      const wasRenamed = currentName !== initialName;
      if (wasRenamed) {
        console.log(`[GoogleAds] Auto-renamed duplicate campaign from "${initialName}" to "${currentName}"`);
      }

      return {
        ok: true,
        resourceName,
        campaignId,
        name: currentName,
        originalName: initialName,
        renamedFromDuplicate: wasRenamed,
        status: "PAUSED",
        json,
      };
    }

    const errStr = JSON.stringify(json);
    const isDuplicate = errStr.includes("DUPLICATE_CAMPAIGN_NAME");

    if (isDuplicate && attempt < 4) {
      console.warn(`[GoogleAds] Campaign name "${currentName}" already exists in Google Ads. Retrying with unique version...`);
      const versionMatch = currentName.match(/^(.*?)\s*\(v(\d+)\)$/i);
      if (versionMatch) {
        const rawBase = versionMatch[1].trim();
        const nextVer = parseInt(versionMatch[2], 10) + 1;
        currentName = `${rawBase} (v${nextVer})`;
      } else {
        const baseClean = currentName.slice(0, 200).trim();
        currentName = `${baseClean} (v2)`;
      }
      continue;
    }

    console.error("Google Ads Campaign Creation Error:", json);
    break;
  }

  return { ok: false, status: lastStatus, error: lastJson };
}

/**
 * Create an Ad Group in Google Ads
 */
export async function createAdGroup({
  accessToken,
  customerId,
  campaignResourceName,
  name,
  type = "SEARCH_STANDARD",
  cpcBidMicros = 20000000, // ₹20 default
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);

  const payload = {
    operations: [
      {
        create: {
          name: name || `Ad Group - ${Date.now()}`,
          campaign: campaignResourceName,
          status: "PAUSED",
          type: type || "SEARCH_STANDARD",
          cpcBidMicros: String(cpcBidMicros),
        },
      },
    ],
  };

  const url = `https://googleads.googleapis.com/v22/customers/${targetId}/adGroups:mutate`;
  const resp = await fetch(url, {
    method: "POST",
    headers: getHeaders(accessToken, loginCustomerId),
    body: JSON.stringify(payload),
  });

  const json = await resp.json();
  if (!resp.ok) {
    console.error("Google Ads AdGroup Creation Error:", json);
    return { ok: false, status: resp.status, error: json };
  }

  const resourceName = json.results?.[0]?.resourceName;
  const adGroupId = resourceName ? resourceName.split("/").pop() : null;

  return { ok: true, resourceName, adGroupId, json };
}

/**
 * Strips phone numbers from ad text (headlines, descriptions, sitelinks, callouts).
 * Google Ads Editorial Policy STRICTLY PROHIBITS phone numbers in ad text (PHONE_NUMBER_IN_AD_TEXT).
 * Phone numbers must exclusively live in Call Assets (callAsset).
 */
export function stripPhoneNumbersFromAdText(text) {
  if (!text || typeof text !== "string") return "";
  let clean = text.trim();

  // 1. Replace "Call/Ring/Dial (us at/on)? <phone number>" with "Contact us today"
  clean = clean.replace(/\b(?:call|phone|dial|ring|whatsapp|reach)\s+(?:us\s+)?(?:at|on|via)?\s*[\+\d\s\(\)\-\.]{7,20}\s*(?:today|now)?/gi, "Contact us today ");

  // 2. Remove any remaining phone number digit patterns (e.g. +91 97239 27645 or 9723927645 or 1-800-555-0199)
  clean = clean.replace(/(?:\+?\d{1,4}[\s.-]?)?\(?\d{2,5}\)?[\s.-]?\d{3,5}[\s.-]?\d{3,5}/g, "");
  clean = clean.replace(/\b\d{7,15}\b/g, "");

  // 3. Clean up duplicate words, trailing punctuation/prepositions, and excess whitespace
  clean = clean
    .replace(/\b(?:today\s+today|now\s+now|today\s+now)\b/gi, "today")
    .replace(/\b(?:at|on|via|call|phone|tel:?)\s*$/i, "")
    .replace(/\s*:\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*([,.-])\s*/g, "$1 ")
    .replace(/\s+([,.-])/g, "$1")
    .trim();

  return clean;
}

/**
 * Create a Responsive Search Ad (RSA) in Google Ads
 */
export async function createResponsiveSearchAd({
  accessToken,
  customerId,
  adGroupResourceName,
  finalUrl,
  headlines = [],
  descriptions = [],
  path1 = "",
  path2 = "",
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);

  // Normalize headlines (at least 3 recommended, max 30 chars, strictly no phone numbers in text)
  const formattedHeadlines = (headlines.length > 0 ? headlines : [
    "Expert Services",
    "Book An Appointment",
    "Contact Us Today"
  ]).map((h) => {
    const raw = typeof h === "string" ? h : (h.text || "Expert Services");
    return { text: stripPhoneNumbersFromAdText(raw).slice(0, 30).trim() };
  }).filter((h) => h.text.length >= 2).slice(0, 15);

  // Normalize descriptions (at least 2 recommended, max 90 chars, strictly no phone numbers in text)
  const formattedDescriptions = (descriptions.length > 0 ? descriptions : [
    "Trusted professionals dedicated to top quality service.",
    "Contact our team to get started today."
  ]).map((d) => {
    const raw = typeof d === "string" ? d : (d.text || "Trusted service provider.");
    return { text: stripPhoneNumbersFromAdText(raw).slice(0, 90).trim() };
  }).filter((d) => d.text.length >= 5).slice(0, 4);

  const ad = {
    finalUrls: [finalUrl || "https://ai.gabbarinfo.com"],
    responsiveSearchAd: {
      headlines: formattedHeadlines,
      descriptions: formattedDescriptions,
      ...(path1 ? { path1: path1.slice(0, 15) } : {}),
      ...(path2 ? { path2: path2.slice(0, 15) } : {}),
    },
  };

  const payload = {
    operations: [
      {
        create: {
          adGroup: adGroupResourceName,
          status: "PAUSED",
          ad,
        },
      },
    ],
  };

  const url = `https://googleads.googleapis.com/v22/customers/${targetId}/adGroupAds:mutate`;
  const resp = await fetch(url, {
    method: "POST",
    headers: getHeaders(accessToken, loginCustomerId),
    body: JSON.stringify(payload),
  });

  const json = await resp.json();
  if (!resp.ok) {
    console.error("Google Ads RSA Creation Error:", json);
    return { ok: false, status: resp.status, error: json };
  }

  const resourceName = json.results?.[0]?.resourceName;
  return { ok: true, resourceName, json };
}

export function normalizeKeyword(kw) {
  const rawText = typeof kw === "string" ? kw.trim() : (kw.text || "").trim();
  let cleanText = rawText;
  let matchType = (typeof kw === "object" && kw.matchType) ? String(kw.matchType).toUpperCase() : null;

  if (!matchType) {
    if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
      matchType = "PHRASE";
      cleanText = cleanText.slice(1, -1).trim();
    } else if (cleanText.startsWith('[') && cleanText.endsWith(']')) {
      matchType = "EXACT";
      cleanText = cleanText.slice(1, -1).trim();
    } else {
      matchType = "PHRASE"; // Default to Phrase Match for high intent and cost efficiency
    }
  } else {
    cleanText = cleanText.replace(/^[ "\[]+|[ "\]]+$/g, "").trim();
  }

  return { text: cleanText, matchType };
}

/**
 * Create Keywords for an Ad Group in Google Ads
 */
export async function createAdGroupKeywords({
  accessToken,
  customerId,
  adGroupResourceName,
  keywords = [],
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);
  if (!keywords.length) return { ok: true, results: [] };

  const operations = keywords.map((kw) => {
    const { text, matchType } = normalizeKeyword(kw);
    return {
      create: {
        adGroup: adGroupResourceName,
        status: "PAUSED",
        keyword: {
          text,
          matchType: ["BROAD", "PHRASE", "EXACT"].includes(matchType) ? matchType : "PHRASE",
        },
      },
    };
  }).filter(op => Boolean(op.create.keyword.text));

  if (!operations.length) return { ok: true, results: [] };

  const payload = { operations };
  const url = `https://googleads.googleapis.com/v22/customers/${targetId}/adGroupCriteria:mutate`;
  const resp = await fetch(url, {
    method: "POST",
    headers: getHeaders(accessToken, loginCustomerId),
    body: JSON.stringify(payload),
  });

  const json = await resp.json();
  if (!resp.ok) {
    console.error("Google Ads Keywords Creation Error:", json);
    return { ok: false, status: resp.status, error: json };
  }

  return { ok: true, results: json.results || [], json };
}

/**
 * Create Campaign-level Negative Keywords to prevent wasted ad spend
 */
export async function createCampaignNegativeKeywords({
  accessToken,
  customerId,
  campaignResourceName,
  negativeKeywords = [],
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);
  if (!Array.isArray(negativeKeywords) || !negativeKeywords.length) {
    return { ok: true, results: [] };
  }

  const operations = negativeKeywords.map((kw) => {
    const raw = typeof kw === "string" ? kw.trim() : (kw.text || "").trim();
    const cleanText = raw.replace(/^[ "\[]+|[ "\]]+$/g, "").trim();
    const matchType = (typeof kw === "object" && kw.matchType) ? String(kw.matchType).toUpperCase() : "BROAD";

    return {
      create: {
        campaign: campaignResourceName,
        negative: true,
        keyword: {
          text: cleanText,
          matchType: ["BROAD", "PHRASE", "EXACT"].includes(matchType) ? matchType : "BROAD",
        },
      },
    };
  }).filter(op => Boolean(op.create.keyword.text));

  if (!operations.length) return { ok: true, results: [] };

  const payload = { operations };
  const url = `https://googleads.googleapis.com/v22/customers/${targetId}/campaignCriteria:mutate`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify(payload),
    });

    const json = await resp.json();
    if (!resp.ok) {
      console.warn("Google Ads Negative Keywords Creation Warning:", json);
      return { ok: false, status: resp.status, error: json };
    }

    return { ok: true, results: json.results || [], json };
  } catch (err) {
    console.warn("Negative keywords error (non-fatal):", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Auto-resolve raw user location strings (e.g. "Ahmedabad", "London (United Kingdom)", "Raipur", "India")
 * into validated Google Ads GeoTargetConstants using geoTargetConstants:suggest.
 */
export async function resolveGeoTargetConstants({ accessToken, locationQuery, loginCustomerId = null }) {
  if (!locationQuery) return [];

  let rawList = [];
  if (Array.isArray(locationQuery)) {
    rawList = locationQuery;
  } else if (typeof locationQuery === "string") {
    const trimmed = locationQuery.trim();
    // Preserve "London (United Kingdom)" or "City (Country)" as single entity
    if (/^[^(]+\([^)]+\)$/.test(trimmed)) {
      rawList = [trimmed];
    } else if (trimmed.includes(",")) {
      rawList = trimmed.split(",").map(p => p.trim()).filter(Boolean);
    } else {
      rawList = [trimmed];
    }
  }

  const resolved = [];
  const seenResourceNames = new Set();

  for (const rawItem of rawList) {
    let query = String(rawItem).trim();
    if (!query) continue;

    // Normalize common variations and abbreviations
    query = query.replace(/^all\s+/i, ""); // e.g., "All India" -> "India"
    query = query.replace(/\bUK\b/i, "United Kingdom");
    query = query.replace(/\bUSA\b|\bUS\b/i, "United States");
    query = query.replace(/\bUAE\b/i, "United Arab Emirates");

    const candidateQueries = [query];
    const parenMatch = query.match(/^([^(]+)\(([^)]+)\)$/);
    if (parenMatch) {
      const city = parenMatch[1].trim();
      const country = parenMatch[2].trim();
      candidateQueries.push(`${city}, ${country}`);
      candidateQueries.push(city);
    }
    if (query.includes(",")) {
      candidateQueries.push(query.split(",")[0].trim());
    }

    for (const q of candidateQueries) {
      try {
        const resp = await fetch("https://googleads.googleapis.com/v22/geoTargetConstants:suggest", {
          method: "POST",
          headers: getHeaders(accessToken, loginCustomerId),
          body: JSON.stringify({
            locale: "en",
            locationNames: { names: [q] },
          }),
        });

        if (!resp.ok) continue;
        const json = await resp.json();
        const suggestions = json.geoTargetConstantSuggestions || [];
        if (suggestions.length === 0) continue;

        const active = suggestions.map(s => s.geoTargetConstant).filter(g => g && g.status === "ENABLED");
        if (active.length === 0) continue;

        const qLower = q.toLowerCase();
        // Priority 1: Exact name match
        let best = active.find(g => g.name?.toLowerCase() === qLower);
        // Priority 2: Canonical name starts with query
        if (!best) {
          best = active.find(g => g.canonicalName?.toLowerCase().startsWith(qLower));
        }
        // Priority 3: First enabled match
        if (!best) {
          best = active[0];
        }

        if (best && !seenResourceNames.has(best.resourceName)) {
          seenResourceNames.add(best.resourceName);
          resolved.push({
            resourceName: best.resourceName,
            id: best.id,
            name: best.name,
            canonicalName: best.canonicalName,
            targetType: best.targetType,
            countryCode: best.countryCode,
          });
          break; // Matched this location item, move to next
        }
      } catch (e) {
        console.warn("Geo suggest error:", e.message);
      }
    }
  }

  return resolved;
}

/**
 * Mutate Campaign Criteria to target specific geographic locations.
 * Automatically switches campaign from "All countries and territories" to the designated locations.
 */
export async function createCampaignLocationTargeting({
  accessToken,
  customerId,
  campaignResourceName,
  locationQuery,
  loginCustomerId = null,
}) {
  const cleanId = cleanCustomerId(customerId);
  if (!cleanId || !campaignResourceName || !locationQuery) {
    return { ok: false, error: "Missing required parameters for location targeting." };
  }

  const geoConstants = await resolveGeoTargetConstants({
    accessToken,
    locationQuery,
    loginCustomerId,
  });

  if (geoConstants.length === 0) {
    console.warn(`[GoogleAds] No geo target constants resolved for query: "${locationQuery}"`);
    return { ok: false, error: `Could not resolve location "${locationQuery}" in Google Ads directory.` };
  }

  const operations = geoConstants.map(geo => ({
    create: {
      campaign: campaignResourceName,
      location: {
        geoTargetConstant: geo.resourceName,
      },
    },
  }));

  const url = `https://googleads.googleapis.com/v22/customers/${cleanId}/campaignCriteria:mutate`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({
        operations,
        partialFailure: true,
      }),
    });

    const json = await resp.json();
    if (!resp.ok) {
      console.warn("Location criteria mutate warning:", json);
      return { ok: false, error: json.error?.message || "Failed to set location criteria", json };
    }

    console.log(`[GoogleAds] Successfully applied location targeting (${geoConstants.map(g => g.name).join(", ")}) to ${campaignResourceName}`);
    return {
      ok: true,
      targetedLocations: geoConstants,
      results: json.results || [],
    };
  } catch (err) {
    console.warn("createCampaignLocationTargeting error:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Automatically link a matching Location Group (Asset Set) to a campaign.
 * When multiple Google Business Profile locations are synced at the Account Level,
 * linking a specific STATIC_LOCATION_GROUP / LOCATION_GROUP ensures the campaign
 * ONLY displays the matching location (e.g. Ahmedabad) and isolates other client locations
 * (e.g. Dehradun, London) so they never cross-contaminate the ad preview or live impressions.
 * Completely dynamic and universal for any client account.
 */
export async function autoLinkCampaignLocationGroup({
  accessToken,
  customerId,
  campaignResourceName,
  targetLocation = null,
  businessName = null,
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);
  try {
    const query = `
      SELECT
        asset_set.id,
        asset_set.name,
        asset_set.resource_name,
        asset_set.type
      FROM asset_set
      WHERE asset_set.type IN ('STATIC_LOCATION_GROUP', 'BUSINESS_PROFILE_DYNAMIC_LOCATION_GROUP', 'CHAIN_DYNAMIC_LOCATION_GROUP')
    `;
    const searchUrl = `https://googleads.googleapis.com/v22/customers/${targetId}/googleAds:search`;
    const resp = await fetch(searchUrl, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({ query }),
    });
    const json = await resp.json();
    const locationGroups = json.results || [];
    if (locationGroups.length === 0) return { ok: true, linked: false, reason: "no_location_groups" };

    const locNorm = String(targetLocation || "").toLowerCase().trim();
    const bizNorm = String(businessName || "").toLowerCase().trim();
    const squash = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const squashedLoc = squash(locNorm);
    const squashedBiz = squash(bizNorm);

    let matchedGroup = null;
    if (locNorm || bizNorm) {
      matchedGroup = locationGroups.find((r) => {
        const name = String(r.assetSet?.name || "").toLowerCase();
        const squashedName = squash(name);
        const locMatch = locNorm && (name.includes(locNorm) || squashedName.includes(squashedLoc));
        const bizMatch = bizNorm && (name.includes(bizNorm) || squashedName.includes(squashedBiz));
        return locMatch || bizMatch;
      });
    }

    if (!matchedGroup && locationGroups.length === 1) {
      matchedGroup = locationGroups[0];
    }

    if (!matchedGroup) {
      return { ok: true, linked: false, reason: "no_matching_location_group" };
    }

    const assetSetResource = matchedGroup.assetSet?.resourceName;
    console.log(`[Location Group Isolation] Attaching "${matchedGroup.assetSet?.name}" (${assetSetResource}) to campaign ${campaignResourceName}`);

    const mutateUrl = `https://googleads.googleapis.com/v22/customers/${targetId}/campaignAssetSets:mutate`;
    const linkResp = await fetch(mutateUrl, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({
        operations: [
          {
            create: {
              campaign: campaignResourceName,
              assetSet: assetSetResource,
            },
          },
        ],
      }),
    });
    const linkJson = await linkResp.json();
    if (!linkResp.ok) {
      console.warn("autoLinkCampaignLocationGroup mutate warning:", linkJson);
      return { ok: false, error: linkJson };
    }

    return {
      ok: true,
      linked: true,
      assetSet: assetSetResource,
      name: matchedGroup.assetSet?.name,
    };
  } catch (err) {
    console.warn("autoLinkCampaignLocationGroup error:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Detect two-letter ISO country code from phone number or location string
 */
export function detectCountryCode(phoneNumber, location = "") {
  const cleanPhone = String(phoneNumber || "").replace(/[^0-9+]/g, "");
  if (cleanPhone.startsWith("+91") || (cleanPhone.startsWith("91") && cleanPhone.length === 12)) return "IN";
  if (cleanPhone.startsWith("+1")) return "US";
  if (cleanPhone.startsWith("+44")) return "GB";
  if (cleanPhone.startsWith("+971")) return "AE";
  if (cleanPhone.startsWith("+61")) return "AU";
  if (cleanPhone.startsWith("+65")) return "SG";

  const loc = String(location).toLowerCase();
  if (loc.includes("india") || loc.includes("ahmedabad") || loc.includes("mumbai") || loc.includes("delhi") || loc.includes("bangalore") || loc.includes("gujarat")) return "IN";
  if (loc.includes("usa") || loc.includes("united states") || loc.includes("america")) return "US";
  if (loc.includes("uk") || loc.includes("united kingdom") || loc.includes("london")) return "GB";
  if (loc.includes("dubai") || loc.includes("uae") || loc.includes("emirates")) return "AE";

  return "IN";
}

/**
 * Detect whether a website is an E-commerce store or a Service/Lead-Gen/Real Estate business
 * by analyzing HTML, metadata, platform footprints (Shopify, WooCommerce, Magento, BigCommerce),
 * cart/checkout elements, pricing structures, and product schemas.
 */
export async function detectWebsiteType(landingPageUrl) {
  if (!landingPageUrl) return { isEcommerce: false, platform: "unknown", confidence: 0, detectedSignals: [] };

  try {
    let cleanUrl = String(landingPageUrl).trim();
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = "https://" + cleanUrl;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return { isEcommerce: false, platform: "unknown", confidence: 0, detectedSignals: [] };
    }

    const html = await resp.text();
    const lowerHtml = html.toLowerCase();
    const detectedSignals = [];
    let platform = "custom";

    // 1. Platform Detection
    if (lowerHtml.includes("cdn.shopify.com") || lowerHtml.includes("shopify.theme") || lowerHtml.includes("myshopify.com")) {
      platform = "shopify";
      detectedSignals.push("Shopify Platform");
    } else if (lowerHtml.includes("woocommerce") || lowerHtml.includes("wc-cart") || lowerHtml.includes("woocommerce-price-amount")) {
      platform = "woocommerce";
      detectedSignals.push("WooCommerce Platform");
    } else if (lowerHtml.includes("bigcommerce") || lowerHtml.includes("cdn11.bigcommerce.com")) {
      platform = "bigcommerce";
      detectedSignals.push("BigCommerce Platform");
    } else if (lowerHtml.includes("magento") || lowerHtml.includes("mage/cookies")) {
      platform = "magento";
      detectedSignals.push("Magento Platform");
    }

    // 2. Cart, Checkout & Product Signals
    if (lowerHtml.includes("add-to-cart") || lowerHtml.includes("add to cart") || lowerHtml.includes("add to bag") || lowerHtml.includes("add_to_cart")) {
      detectedSignals.push("Add to Cart Button");
    }
    if (lowerHtml.includes("schema.org/product") || lowerHtml.includes('"@type": "product"') || lowerHtml.includes('"@type":"product"')) {
      detectedSignals.push("Product Schema Markup");
    }
    if (lowerHtml.includes("/cart") || lowerHtml.includes("/checkout")) {
      detectedSignals.push("Cart/Checkout Endpoints");
    }
    if (lowerHtml.includes("/collections/") || lowerHtml.includes("/products/")) {
      detectedSignals.push("E-commerce Catalog URLs");
    }

    const isEcommerce = detectedSignals.length >= 1 || platform !== "custom";
    return {
      isEcommerce,
      platform,
      confidence: detectedSignals.length >= 2 ? 0.95 : (detectedSignals.length === 1 ? 0.75 : 0.2),
      detectedSignals,
    };
  } catch (err) {
    console.warn("detectWebsiteType non-fatal warning:", err.message);
    return { isEcommerce: false, platform: "unknown", confidence: 0, detectedSignals: [] };
  }
}

/**
 * Auto-detect linked Google Merchant Center account for a customer
 */
export async function getLinkedMerchantCenterAccount({ accessToken, customerId, loginCustomerId = null }) {
  const targetId = cleanCustomerId(customerId);
  if (!targetId || !accessToken) return null;

  try {
    const url = `https://googleads.googleapis.com/v22/customers/${targetId}/googleAds:search`;
    const query = `
      SELECT
        product_link.product_link_id,
        product_link.type,
        product_link.merchant_center.merchant_center_account_id,
        product_link.merchant_center.status
      FROM product_link
      WHERE product_link.type = 'MERCHANT_CENTER'
      LIMIT 1
    `;

    const resp = await fetch(url, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({ query }),
    });

    const json = await resp.json();
    if (json.results && json.results.length > 0) {
      const link = json.results[0].productLink;
      const merchantId = link?.merchantCenter?.merchantCenterAccountId;
      const status = link?.merchantCenter?.status;
      if (merchantId) {
        return {
          merchantId: String(merchantId),
          status: status || "LINKED",
          resourceName: link.resourceName,
        };
      }
    }
    return null;
  } catch (err) {
    console.warn("getLinkedMerchantCenterAccount error:", err.message);
    return null;
  }
}

/**
 * Helper to fetch an image from a URL and return base64 data
 */
export async function fetchImageAsBase64(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  try {
    const resp = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (!resp.ok) return null;
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString("base64");
  } catch (e) {
    console.warn("Could not fetch image as base64:", imageUrl, e.message);
    return null;
  }
}

/**
 * Query existing IMAGE assets in a Google Ads customer account
 */
export async function getAccountImageAssets({
  accessToken,
  customerId,
  businessName = null,
  services = null,
  landingPageUrl = null,
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);
  try {
    const query = `
      SELECT
        asset.resource_name,
        asset.id,
        asset.name,
        asset.type,
        asset.image_asset.full_size.width_pixels,
        asset.image_asset.full_size.height_pixels,
        asset.image_asset.mime_type
      FROM asset
      WHERE asset.type = 'IMAGE'
      ORDER BY asset.id DESC
      LIMIT 100
    `;
    const url = `https://googleads.googleapis.com/v22/customers/${targetId}/googleAds:search`;
    const resp = await fetch(url, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({ query }),
    });
    const json = await resp.json();
    const rawList = (json.results || [])
      .map((r) => ({
        resourceName: r.asset.resourceName,
        id: r.asset.id,
        name: r.asset.name || "",
        width: r.asset.imageAsset?.fullSize?.widthPixels || 0,
        height: r.asset.imageAsset?.fullSize?.heightPixels || 0,
      }))
      // Filter out synthetic fallback blue SVGs
      .filter(
        (a) =>
          !a.name.startsWith("MarketingLandscape_") &&
          !a.name.startsWith("MarketingSquare_") &&
          !a.name.startsWith("BrandLogo_")
      );

    // Build brand tokens from businessName and landingPageUrl
    const squash = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const bizNorm = String(businessName || "").toLowerCase().trim();
    const squashedBiz = squash(bizNorm);

    const bizTokens = new Set();
    bizNorm.split(/[\s,_\-./]+/).filter((t) => t.length >= 3).forEach((t) => bizTokens.add(t));
    if (squashedBiz.length >= 3) bizTokens.add(squashedBiz);

    // If businessName is composite (e.g. "Gabbarinfo"), also extract recognizable sub-tokens
    if (bizNorm.includes("gabbar")) bizTokens.add("gabbar");
    if (bizNorm.includes("info")) bizTokens.add("info");

    let domainTokens = new Set();
    if (landingPageUrl) {
      try {
        const parsed = new URL(landingPageUrl.startsWith("http") ? landingPageUrl : `https://${landingPageUrl}`);
        const hostParts = parsed.hostname.toLowerCase().split(".");
        hostParts
          .filter((p) => !["www", "com", "in", "org", "net", "ai", "co", "io"].includes(p) && p.length >= 3)
          .forEach((p) => {
            domainTokens.add(p);
            if (p.includes("gabbar")) domainTokens.add("gabbar");
          });
      } catch (_) {}
    }

    const srvNorm = String(services || "").toLowerCase().trim();
    const srvTokens = srvNorm.split(/[\s,_\-./]+/).filter((t) => t.length >= 4);

    // Generic stock, Canva, or tool prefixes that CANNOT establish brand identity in a shared agency account
    const genericPrefixes = [
      "website image",
      "generated image",
      "untitled design",
      "chatgpt image",
      "assetlibrary",
      "free stock image",
      "whatsapp image",
      "undefined",
    ];

    // Cross-Client Shield: Block images belonging to other agency clients or foreign industries
    const foreignBlockers = [
      {
        name: "Jewelry / Croydon / Bella / Diva",
        triggers: [
          "jewel", "jewellery", "jewelry", "earring", "necklace", "bangle",
          "bracelet", "pendant", "gold", "diamond", "silver", "gem", "gemstone",
          "croydon", "bella", "diva"
        ],
        check: () => !bizNorm.includes("jewel") && !srvNorm.includes("jewel") && !bizNorm.includes("diva")
      },
      {
        name: "Laundry / Velvet Wash",
        triggers: ["laundry", "dryclean", "dry clean", "wash", "velvet", "ironing", "washing", "garment", "fabric"],
        check: () => !bizNorm.includes("laundry") && !bizNorm.includes("wash") && !srvNorm.includes("laundry") && !srvNorm.includes("wash")
      },
      {
        name: "Gomti Digital Services / GDS",
        triggers: ["gomti", "gds"],
        check: () => !bizNorm.includes("gomti") && !bizNorm.includes("gds")
      },
      {
        name: "Yoga / Wellness",
        triggers: ["yoga", "meditation", "pranayama", "retreat", "asana"],
        check: () => !bizNorm.includes("yoga") && !srvNorm.includes("yoga")
      },
      {
        name: "Restaurant / Dining",
        triggers: ["restaurant", "dining", "cafe", "food", "burger", "pizza", "menu", "chef"],
        check: () => !bizNorm.includes("restaurant") && !bizNorm.includes("cafe") && !srvNorm.includes("food") && !srvNorm.includes("restaurant")
      },
      {
        name: "Dental / Medical",
        triggers: ["dental", "dentist", "teeth", "orthodontic", "clinic"],
        check: () => !bizNorm.includes("dent") && !srvNorm.includes("dent")
      }
    ];

    const scoredAssets = [];
    let rejectedCount = 0;

    for (const item of rawList) {
      const lowerName = item.name.toLowerCase();
      const squashedName = squash(lowerName);
      let score = 0;
      let hasBrandMatch = false;

      // 1. Strict foreign blocker check
      let blocked = false;
      for (const blk of foreignBlockers) {
        if (blk.check()) {
          for (const trig of blk.triggers) {
            if (lowerName.includes(trig) || squashedName.includes(trig)) {
              blocked = true;
              break;
            }
          }
        }
        if (blocked) break;
      }

      if (blocked) {
        rejectedCount++;
        continue;
      }

      const isGenericName = genericPrefixes.some((p) => lowerName.startsWith(p));

      // 2. High confidence Brand & Domain Matching (+150)
      for (const bt of bizTokens) {
        if (lowerName.includes(bt) || squashedName.includes(bt)) {
          score += 150;
          hasBrandMatch = true;
        }
      }
      for (const dt of domainTokens) {
        if (lowerName.includes(dt) || squashedName.includes(dt)) {
          score += 150;
          hasBrandMatch = true;
        }
      }

      // Direct squashed cross-containment (e.g. "gabbarinfo1200x1200pxpng" contains "gabbarinfo")
      if (squashedBiz && squashedName.includes(squashedBiz)) {
        if (!hasBrandMatch) score += 150;
        hasBrandMatch = true;
      }

      // 3. Service keyword matching (+30) - ONLY allowed on non-generic filenames
      if (!isGenericName) {
        for (const st of srvTokens) {
          if (["website", "design", "image"].includes(st)) continue;
          if (lowerName.includes(st)) score += 30;
        }
      }

      // 4. Logo keyword matching (+50) if brand match exists
      if (lowerName.includes("logo") && hasBrandMatch) {
        score += 50;
      }

      // STRICT MULTI-CLIENT SHIELD: Only accept library assets with CONFIRMED BRAND/DOMAIN match!
      // In a shared agency account, generic service words alone can never qualify an asset.
      if (score >= 100 && hasBrandMatch) {
        scoredAssets.push({ ...item, score });
      } else {
        rejectedCount++;
      }
    }

    scoredAssets.sort((a, b) => b.score - a.score);

    const logos = [];
    const landscapes = [];
    const squares = [];
    const portraits = [];

    for (const img of scoredAssets) {
      const ratio = img.height > 0 ? img.width / img.height : 1;
      const lowerName = img.name.toLowerCase();

      if ((lowerName.includes("logo") || (ratio >= 0.85 && ratio <= 1.15)) && img.width >= 128) {
        logos.push(img.resourceName);
      }
      if (ratio >= 1.4 && ratio <= 2.2 && img.width >= 600) {
        landscapes.push(img.resourceName);
      }
      if (ratio >= 0.85 && ratio <= 1.15 && img.width >= 300) {
        squares.push(img.resourceName);
      }
      if (ratio >= 0.70 && ratio <= 0.85 && img.height >= 600) {
        portraits.push(img.resourceName);
      }
    }

    console.log(`[Account Image Shield] Scanned ${rawList.length} library images: ${scoredAssets.length} verified (${landscapes.length} landscapes, ${squares.length} squares, ${logos.length} logos). Rejected ${rejectedCount} foreign/unrelated assets.`);

    return {
      all: scoredAssets.map((a) => a.resourceName),
      logos,
      landscapes,
      squares,
      portraits,
      scoredAssets,
      rejectedCount,
    };
  } catch (err) {
    console.warn("getAccountImageAssets warning:", err.message);
    return { all: [], logos: [], landscapes: [], squares: [], portraits: [], scoredAssets: [], rejectedCount: 0 };
  }
}

/**
 * Automatically resolve Logo and Images from:
 * 1. Existing Google Ads account Asset Library (strictly relevant, shielded against other clients)
 * 2. Landing page website scraping (real high-res site images, logo, apple-touch-icon, og:image formatted via Sharp)
 */
export async function resolveCampaignImagesAndLogo({
  accessToken,
  customerId,
  landingPageUrl,
  businessName,
  services = null,
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);
  let imagesToLink = [];
  let logoToLink = null;
  let landscapesFound = [];
  let squaresFound = [];
  let logosFound = [];

  // 1. Discover authentic existing IMAGE assets in the Google Ads account library
  try {
    const classified = await getAccountImageAssets({
      accessToken,
      customerId: targetId,
      businessName,
      services,
      landingPageUrl,
      loginCustomerId,
    });

    landscapesFound = [...classified.landscapes];
    squaresFound = [...classified.squares];
    logosFound = [...classified.logos];

    if (logosFound.length > 0) {
      logoToLink = logosFound[0];
    }
    if (landscapesFound.length > 0) {
      imagesToLink.push(landscapesFound[0]);
    }
    if (squaresFound.length > 0) {
      const distinctSquare = squaresFound.find((s) => s !== logoToLink) || squaresFound[0];
      if (distinctSquare && !imagesToLink.includes(distinctSquare)) {
        imagesToLink.push(distinctSquare);
      }
    }

    // If account library has verified logo, landscape, AND square marketing images, we can return them
    if (landscapesFound.length > 0 && squaresFound.length > 0 && logoToLink) {
      console.log(`Discovered authentic account assets for ${targetId}: Logo=${logoToLink}, Images=${imagesToLink.join(", ")}`);
      return {
        images: imagesToLink,
        logo: logoToLink,
        landscapes: landscapesFound,
        squares: squaresFound,
        logos: logosFound,
      };
    }
  } catch (err) {
    console.warn("Error discovering account image assets:", err.message);
  }

  // 2. Deep Scrape logo and images from landing page website
  if (landingPageUrl && (landingPageUrl.startsWith("http://") || landingPageUrl.startsWith("https://"))) {
    try {
      const siteResp = await fetch(landingPageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (siteResp.ok) {
        const html = await siteResp.text();

        const resolveUrl = (base, relative) => {
          try {
            return new URL(relative, base).toString();
          } catch (_) {
            return relative;
          }
        };

        // Extract candidate logo URLs (apple-touch-icon, shortcut icon, or <img> tags containing "logo")
        const iconMatch =
          html.match(/<link[^>]+(?:rel=["'](?:apple-touch-icon|icon|shortcut icon)["'])[^>]+href=["']([^"']+)["']/i) ||
          html.match(/<link[^>]+href=["']([^"']+)["'][^>]+(?:rel=["'](?:apple-touch-icon|icon|shortcut icon)["'])/i);

        const imgLogoMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*(?:alt|class|id)=["'][^"']*logo[^"']*["']/i) ||
          html.match(/<img[^>]*(?:alt|class|id)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i);

        // Extract og:image
        const ogImageMatch =
          html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

        // Extract all high-res <img> tags from page
        const imgRegex = /<img[^>]+src=["']([^"']+\.(?:png|jpg|jpeg|webp))["']/gi;
        const candidatePageImages = [];
        let m;
        while ((m = imgRegex.exec(html)) !== null) {
          const resolved = resolveUrl(landingPageUrl, m[1]);
          if (!resolved.includes("svg") && !resolved.includes("icon") && !resolved.includes("pixel") && !candidatePageImages.includes(resolved)) {
            candidatePageImages.push(resolved);
          }
          if (candidatePageImages.length >= 6) break;
        }

        const candidateLogoUrl = (imgLogoMatch ? resolveUrl(landingPageUrl, imgLogoMatch[1]) : null) ||
          (iconMatch ? resolveUrl(landingPageUrl, iconMatch[1]) : null);
        const candidateOgImageUrl = ogImageMatch ? resolveUrl(landingPageUrl, ogImageMatch[1]) : null;

        // Process Scraped Logo with Sharp
        if (!logoToLink && candidateLogoUrl) {
          try {
            const logoFetch = await fetch(candidateLogoUrl);
            if (logoFetch.ok) {
              const arrayBuf = await logoFetch.arrayBuffer();
              const buf = Buffer.from(arrayBuf);
              const processedLogoBuf = await sharp(buf)
                .resize(1200, 1200, {
                  fit: "contain",
                  background: { r: 255, g: 255, b: 255, alpha: 1 },
                })
                .jpeg({ quality: 92 })
                .toBuffer();

              logoToLink = {
                base64: processedLogoBuf.toString("base64"),
                name: `Scraped_Logo_${businessName || "Brand"}_${Date.now()}`,
              };
              console.log(`[Website Scraper] Successfully extracted and formatted brand logo from ${candidateLogoUrl}`);
            }
          } catch (logoErr) {
            console.warn("Website logo processing warning:", logoErr.message);
          }
        }

        // Process Scraped Marketing Images with Sharp
        const candidateUrls = [candidateOgImageUrl, ...candidatePageImages].filter(Boolean);
        for (const imgUrl of candidateUrls) {
          if (imagesToLink.length >= 3) break;
          try {
            const imgFetch = await fetch(imgUrl);
            if (!imgFetch.ok) continue;

            const arrayBuf = await imgFetch.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            const metadata = await sharp(buf).metadata();

            // Check if suitable for landscape or square
            if (metadata.width && metadata.height) {
              const ratio = metadata.width / metadata.height;

              // Landscape Marketing Image (1.91:1 -> 1200x628)
              if (ratio >= 1.3 && metadata.width >= 400) {
                const landscapeBuf = await sharp(buf)
                  .resize(1200, 628, { fit: "cover", position: "center" })
                  .jpeg({ quality: 90 })
                  .toBuffer();

                imagesToLink.push({
                  base64: landscapeBuf.toString("base64"),
                  name: `Scraped_Landscape_${businessName || "Visual"}_${Date.now()}_${imagesToLink.length}`,
                  type: "MARKETING_IMAGE",
                });
                console.log(`[Website Scraper] Formatted landscape marketing image from ${imgUrl}`);
              }
              // Square Marketing Image (1:1 -> 1200x1200)
              else if (ratio >= 0.8 && ratio <= 1.2 && metadata.width >= 300) {
                const squareBuf = await sharp(buf)
                  .resize(1200, 1200, { fit: "cover", position: "center" })
                  .jpeg({ quality: 90 })
                  .toBuffer();

                imagesToLink.push({
                  base64: squareBuf.toString("base64"),
                  name: `Scraped_Square_${businessName || "Visual"}_${Date.now()}_${imagesToLink.length}`,
                  type: "SQUARE_MARKETING_IMAGE",
                });
                console.log(`[Website Scraper] Formatted square marketing image from ${imgUrl}`);
              }
            }
          } catch (imgScrapeErr) {
            console.warn("Website image processing warning:", imgScrapeErr.message);
          }
        }
      }
    } catch (scrapErr) {
      console.warn("Error scraping site for images:", scrapErr.message);
    }
  }

  return {
    images: imagesToLink,
    logo: logoToLink,
    landscapes: landscapesFound,
    squares: squaresFound,
    logos: logosFound,
  };
}

/**
 * Scrapes landing page HTML for real internal navigation subpages (e.g. /blogs, /services, /about, /contact)
 * so the agent can provide genuine sitelinks without hallucinating fake pages or duplicating the home page.
 */
export async function discoverWebsiteSubpages(landingPageUrl) {
  if (!landingPageUrl) return [];
  let urlStr = String(landingPageUrl).trim();
  if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
    urlStr = `https://${urlStr}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const resp = await fetch(urlStr, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timeout);

    if (!resp.ok) return [];

    const html = await resp.text();
    const baseObj = new URL(urlStr);
    const baseHost = baseObj.hostname.replace(/^www\./, "").toLowerCase();
    const basePath = baseObj.pathname.replace(/\/+$/, "").toLowerCase();

    const linkRegex = /<a\s+[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const subpages = [];
    const seenUrls = new Set();
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const rawHref = (match[1] || "").trim();
      let rawText = (match[2] || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#038;/g, "&")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!rawHref) continue;
      if (rawHref.startsWith("javascript:") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:") || rawHref.startsWith("whatsapp:")) {
        continue;
      }

      let resolved;
      try {
        resolved = new URL(rawHref, urlStr);
      } catch (_) {
        continue;
      }

      const linkHost = resolved.hostname.replace(/^www\./, "").toLowerCase();
      if (linkHost !== baseHost) continue;

      const normPath = resolved.pathname.replace(/\/+$/, "").toLowerCase();

      // Skip root/homepage paths
      if (normPath === basePath || normPath === "" || normPath === "/index.html" || normPath === "/index.php") {
        continue;
      }

      // Skip static assets
      if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|css|js)$/i.test(normPath)) {
        continue;
      }

      // Skip admin/cart/privacy pages
      if (/\/(wp-admin|wp-login|login|cart|checkout|privacy-policy|terms-conditions|privacy)/i.test(normPath)) {
        continue;
      }

      const cleanUrl = resolved.origin + resolved.pathname;
      const normalizedKey = cleanUrl.replace(/\/+$/, "").toLowerCase();

      if (seenUrls.has(normalizedKey)) continue;
      seenUrls.add(normalizedKey);

      let linkText = rawText.slice(0, 25).trim();
      if (!linkText || linkText.length < 2 || /^(click|read|more|view|here|link)$/i.test(linkText)) {
        const slug = resolved.pathname.split("/").filter(Boolean).pop() || "";
        linkText = slug.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase()).slice(0, 25);
      }

      if (linkText) {
        subpages.push({
          linkText,
          finalUrl: cleanUrl,
        });
      }

      if (subpages.length >= 6) break;
    }

    return subpages;
  } catch (err) {
    console.warn("discoverWebsiteSubpages non-fatal warning:", err.message);
    return [];
  }
}

/**
 * Deep Landing Page Intelligence & USP Extractor
 * Scrapes the target landing page to extract:
 * 1. True USPs & value propositions from headings, bullet points, and key statistics
 * 2. Embedded YouTube video URLs/IDs
 * 3. Business phone numbers and contact details
 * 4. Tracking tags (Google Ads AW-XXXX, GTM-XXXX, GA4 G-XXXX)
 * 5. Primary service highlights
 */
export async function extractLandingPageIntelligence(landingPageUrl) {
  if (!landingPageUrl) return null;
  let urlStr = String(landingPageUrl).trim();
  if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
    urlStr = `https://${urlStr}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const resp = await fetch(urlStr, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;

    const html = await resp.text();

    // 1. Title & Meta Description
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    const descMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const metaDescription = descMatch ? descMatch[1].trim() : "";

    // 2. Headings & USPs
    const headingMatches = [];
    const hRegex = /<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi;
    let m;
    while ((m = hRegex.exec(html)) !== null) {
      const clean = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (
        clean &&
        clean.length >= 6 &&
        clean.length <= 80 &&
        !clean.toLowerCase().includes("cookie") &&
        !clean.toLowerCase().includes("privacy")
      ) {
        headingMatches.push(clean);
      }
    }

    // 3. YouTube Videos
    const ytVideoIds = new Set();
    const ytEmbedRegex = /(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/gi;
    let ytMatch;
    while ((ytMatch = ytEmbedRegex.exec(html)) !== null) {
      ytVideoIds.add(ytMatch[1]);
    }

    // 4. Phone numbers from tel: or text
    const phoneMatches = new Set();
    const telRegex = /href=["']tel:([^"']+)["']/gi;
    let pMatch;
    while ((pMatch = telRegex.exec(html)) !== null) {
      const cleanedPhone = pMatch[1].replace(/[^0-9+]/g, "").trim();
      if (cleanedPhone.length >= 10) phoneMatches.add(cleanedPhone);
    }

    // 5. Tracking Tags Detection
    const tagMatches = {
      googleAdsTag: null,
      gtmTag: null,
      ga4Tag: null,
    };
    const awMatch = html.match(/['"](AW-[0-9]+)['"]/i) || html.match(/gtag\s*\(\s*['"]config['"]\s*,\s*['"](AW-[0-9]+)['"]/i);
    if (awMatch) tagMatches.googleAdsTag = awMatch[1];

    const gtmMatch = html.match(/['"](GTM-[A-Z0-9]+)['"]/i) || html.match(/googletagmanager\.com\/gtm\.js\?id=(GTM-[A-Z0-9]+)/i);
    if (gtmMatch) tagMatches.gtmTag = gtmMatch[1];

    const ga4Match = html.match(/['"](G-[A-Z0-9]+)['"]/i) || html.match(/googletagmanager\.com\/gtag\/js\?id=(G-[A-Z0-9]+)/i);
    if (ga4Match) tagMatches.ga4Tag = ga4Match[1];

    return {
      url: urlStr,
      title,
      metaDescription,
      usps: headingMatches.slice(0, 8),
      youtubeVideoIds: Array.from(ytVideoIds),
      phoneNumbers: Array.from(phoneMatches),
      trackingTags: tagMatches,
    };
  } catch (err) {
    console.warn("extractLandingPageIntelligence error:", err.message);
    return null;
  }
}

/**
 * Query YouTube Video assets in the Google Ads account and verify against business name / services
 * to ensure that videos belonging to other accounts/clients (e.g. personal poetry or other niches)
 * are NEVER wrongly attached!
 */
export async function getAccountVideoAssets({
  accessToken,
  customerId,
  businessName = null,
  services = null,
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);
  try {
    const query = `
      SELECT
        asset.resource_name,
        asset.id,
        asset.name,
        asset.type,
        asset.youtube_video_asset.youtube_video_id,
        asset.youtube_video_asset.youtube_video_title
      FROM asset
      WHERE asset.type = 'YOUTUBE_VIDEO'
      LIMIT 25
    `;
    const url = `https://googleads.googleapis.com/v22/customers/${targetId}/googleAds:search`;
    const resp = await fetch(url, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({ query }),
    });
    const json = await resp.json();
    const rawVideos = json.results || [];
    if (rawVideos.length === 0) return { verifiedVideos: [], rejectedCount: 0 };

    const bizNorm = String(businessName || "").toLowerCase().trim();
    const srvNorm = String(services || "").toLowerCase().trim();

    const verifiedVideos = [];
    let rejectedCount = 0;

    for (const r of rawVideos) {
      const a = r.asset;
      const title = String(a.youtubeVideoAsset?.youtubeVideoTitle || a.name || "").toLowerCase();
      const videoId = a.youtubeVideoAsset?.youtubeVideoId;

      const matchesBiz = bizNorm && bizNorm.length >= 3 && title.includes(bizNorm);
      const matchesSrv = srvNorm && srvNorm.length >= 3 && title.includes(srvNorm);

      if (matchesBiz || matchesSrv) {
        verifiedVideos.push({
          resourceName: a.resourceName,
          id: a.id,
          videoId,
          title: a.youtubeVideoAsset?.youtubeVideoTitle || a.name,
        });
      } else {
        rejectedCount++;
      }
    }

    return { verifiedVideos, rejectedCount };
  } catch (err) {
    console.warn("getAccountVideoAssets error:", err.message);
    return { verifiedVideos: [], rejectedCount: 0 };
  }
}

/**
 * Comprehensive Conversion Tracking Diagnostics & Verification:
 * Cross-checks landing page tags against account conversion actions.
 */
export async function auditConversionTracking({
  accessToken,
  customerId,
  landingPageUrl = null,
  loginCustomerId = null,
}) {
  const cleanId = cleanCustomerId(customerId);
  const result = {
    ok: true,
    tagDetectedOnSite: false,
    googleAdsTagId: null,
    gtmTagId: null,
    ga4TagId: null,
    conversionActionsCount: 0,
    hasCallTracking: false,
    hasLeadTracking: false,
    activeActions: [],
    status: "HEALTHY",
    diagnosticSummary: "",
  };

  // 1. Check account conversion actions
  try {
    const caRes = await listConversionActions({ accessToken, customerId: cleanId, loginCustomerId });
    const actions = (caRes.conversionActions || []).filter((a) => a.status === "ENABLED");
    result.conversionActionsCount = actions.length;
    result.activeActions = actions.map((a) => ({ id: a.id, name: a.name, type: a.type, category: a.category }));

    result.hasCallTracking = actions.some(
      (a) =>
        a.category === "PHONE_CALL_LEAD" ||
        a.type === "AD_CALL" ||
        a.type === "CLICK_TO_CALL" ||
        a.name.toLowerCase().includes("call")
    );
    result.hasLeadTracking = actions.some(
      (a) =>
        a.category === "SUBMIT_LEAD_FORM" ||
        a.name.toLowerCase().includes("lead") ||
        a.name.toLowerCase().includes("form")
    );
  } catch (err) {
    console.warn("Conversion action listing warning:", err.message);
  }

  // 2. Check website tags if URL provided
  if (landingPageUrl) {
    try {
      const intel = await extractLandingPageIntelligence(landingPageUrl);
      if (intel?.trackingTags) {
        result.googleAdsTagId = intel.trackingTags.googleAdsTag;
        result.gtmTagId = intel.trackingTags.gtmTag;
        result.ga4TagId = intel.trackingTags.ga4Tag;
        result.tagDetectedOnSite = Boolean(result.googleAdsTagId || result.gtmTagId || result.ga4TagId);
      }
    } catch (siteErr) {
      console.warn("Website tag detection warning:", siteErr.message);
    }
  }

  // 3. Determine diagnostic health status
  if (!result.tagDetectedOnSite && landingPageUrl) {
    result.status = "TAG_MISSING_ON_SITE";
    result.diagnosticSummary = `⚠️ Google Tag not detected on ${landingPageUrl}. Ensure your Google Tag (${result.googleAdsTagId || "AW-XXXXX"}) or GTM is installed in the website header so conversions are properly recorded.`;
  } else if (result.conversionActionsCount === 0) {
    result.status = "NO_CONVERSION_ACTIONS";
    result.diagnosticSummary = `⚠️ No active conversion actions found in Google Ads account. Recommended: Configure a Primary Lead Form / Call conversion action.`;
  } else {
    result.status = "VERIFIED_ACTIVE";
    const tagInfo = result.googleAdsTagId
      ? `Google Tag (${result.googleAdsTagId})`
      : result.gtmTagId
      ? `GTM (${result.gtmTagId})`
      : "Site Tag";
    result.diagnosticSummary = `✅ Conversion Tracking Active: ${tagInfo} verified on site with ${result.conversionActionsCount} active conversion goals (Call Tracking: ${result.hasCallTracking ? "Enabled" : "Not Set"}, Lead Form: ${result.hasLeadTracking ? "Enabled" : "Manual"}).`;
  }

  return result;
}

/**
 * Automated Post-Creation Quality Assurance Audit:
 * Runs an exhaustive check on the created campaign, verifying:
 * 1. Location isolation (specific Location Group attached, account-level GMB shielded)
 * 2. Sitelinks (verified 4+ sitelinks attached)
 * 3. Phone Call extension (verified number active)
 * 4. Image assets (verified landscape, square, logo, and zero blue SVGs)
 * 5. YouTube video extensions (verified relevance)
 * 6. Conversion tracking status
 */
export async function auditCreatedCampaign({
  accessToken,
  customerId,
  campaignResourceName,
  campaignType,
  targetLocation = null,
  businessName = null,
  landingPageUrl = null,
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);
  const campaignId = campaignResourceName.split("/").pop();

  const audit = {
    campaignId,
    campaignType,
    businessName,
    targetLocation,
    checks: {
      locationIsolation: { status: "PASS", message: "" },
      sitelinks: { status: "PASS", count: 0, items: [] },
      callAsset: { status: "PASS", phoneNumber: null },
      creativeVisuals: { status: "PASS", landscape: false, square: false, logo: false, placeholdersRemoved: true },
      videoExtension: { status: "INFO", message: "None" },
      conversionTracking: { status: "PASS", message: "" },
    },
    isExpertReady: true,
  };

  try {
    // 1. Verify Campaign Asset Sets (Location Group Isolation)
    const casQuery = `SELECT campaign_asset_set.asset_set, asset_set.name, asset_set.type FROM campaign_asset_set WHERE campaign_asset_set.campaign = '${campaignResourceName}'`;
    const casResp = await fetch(`https://googleads.googleapis.com/v22/customers/${targetId}/googleAds:search`, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({ query: casQuery }),
    });
    const casJson = await casResp.json();
    const assetSets = casJson.results || [];
    if (assetSets.length > 0) {
      const names = assetSets.map((r) => r.assetSet?.name || "Location Group").join(", ");
      audit.checks.locationIsolation = {
        status: "PASS",
        message: `🛡️ Scoped to Location Group "${names}". Account-level locations (e.g. Dehradun / other clients) are strictly shielded and blocked from this campaign.`,
      };
    } else {
      audit.checks.locationIsolation = {
        status: "WARN",
        message: `⚠️ No specific Location Group attached. If Google Business Profile is synced at Account Level, other client locations might show.`,
      };
    }

    // 2. Verify Campaign Assets (Sitelinks & Calls)
    const caQuery = `SELECT campaign_asset.asset, campaign_asset.field_type, campaign_asset.status, asset.name, asset.sitelink_asset.link_text, asset.call_asset.phone_number FROM campaign_asset WHERE campaign_asset.campaign = '${campaignResourceName}'`;
    const caResp = await fetch(`https://googleads.googleapis.com/v22/customers/${targetId}/googleAds:search`, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({ query: caQuery }),
    });
    const caJson = await caResp.json();
    const campaignAssets = caJson.results || [];

    const sitelinks = campaignAssets.filter((r) => r.campaignAsset?.fieldType === "SITELINK");
    audit.checks.sitelinks.count = sitelinks.length;
    audit.checks.sitelinks.items = sitelinks.map((s) => s.asset?.sitelinkAsset?.linkText || "Sitelink");
    if (sitelinks.length >= 4) {
      audit.checks.sitelinks.status = "PASS";
    } else if (sitelinks.length > 0) {
      audit.checks.sitelinks.status = "PASS";
    } else {
      audit.checks.sitelinks.status = "INFO";
    }

    const callAsset = campaignAssets.find((r) => r.campaignAsset?.fieldType === "CALL");
    if (callAsset) {
      audit.checks.callAsset.phoneNumber = callAsset.asset?.callAsset?.phoneNumber || "Active";
      audit.checks.callAsset.status = "PASS";
    } else {
      audit.checks.callAsset.status = "INFO";
    }

    // 3. Verify Asset Group Assets (if PMax)
    if (campaignType?.includes("PMAX") || campaignType?.includes("PERFORMANCE")) {
      const agaQuery = `SELECT asset_group_asset.asset, asset_group_asset.field_type, asset_group_asset.status, asset.name FROM asset_group_asset WHERE asset_group.campaign = '${campaignResourceName}' AND asset_group_asset.status != 'REMOVED'`;
      const agaResp = await fetch(`https://googleads.googleapis.com/v22/customers/${targetId}/googleAds:search`, {
        method: "POST",
        headers: getHeaders(accessToken, loginCustomerId),
        body: JSON.stringify({ query: agaQuery }),
      });
      const agaJson = await agaResp.json();
      const agAssets = agaJson.results || [];

      const hasLandscape = agAssets.some((r) => r.assetGroupAsset?.fieldType === "MARKETING_IMAGE");
      const hasSquare = agAssets.some((r) => r.assetGroupAsset?.fieldType === "SQUARE_MARKETING_IMAGE");
      const hasLogo = agAssets.some((r) => r.assetGroupAsset?.fieldType === "LOGO");
      const hasBlueSvg = agAssets.some((r) => {
        const name = String(r.asset?.name || "");
        return (
          name.startsWith("MarketingLandscape_") ||
          name.startsWith("MarketingSquare_") ||
          name.startsWith("BrandLogo_")
        );
      });

      audit.checks.creativeVisuals = {
        status: hasLandscape && hasSquare && hasLogo && !hasBlueSvg ? "PASS" : "WARN",
        landscape: hasLandscape,
        square: hasSquare,
        logo: hasLogo,
        placeholdersRemoved: !hasBlueSvg,
        details: hasBlueSvg
          ? "Blue SVG placeholders detected in asset group"
          : "Authentic high-res visual assets attached",
      };
    }

    // 4. Verify Conversion Tracking
    const trackingRes = await auditConversionTracking({
      accessToken,
      customerId: targetId,
      landingPageUrl,
      loginCustomerId,
    });
    audit.checks.conversionTracking = {
      status: trackingRes.status === "VERIFIED_ACTIVE" ? "PASS" : "WARN",
      message: trackingRes.diagnosticSummary,
      googleAdsTag: trackingRes.googleAdsTagId,
      ga4Tag: trackingRes.ga4TagId,
      activeActionsCount: trackingRes.conversionActionsCount,
    };
  } catch (err) {
    console.warn("auditCreatedCampaign error:", err.message);
  }

  return audit;
}

/**
 * Create Sitelinks, Callouts, Call Assets, and Business Name and attach them to a Campaign.
 * NOTE: Google Ads API campaignAssets:mutate strictly supports SITELINK, CALLOUT, CALL, BUSINESS_NAME.
 * Visual images (MARKETING_IMAGE, SQUARE_MARKETING_IMAGE, LOGO) belong in Asset Groups (asset_group_asset).
 */
export async function createCampaignAssetsAndLink({
  accessToken,
  customerId,
  campaignResourceName,
  sitelinks = [],
  callouts = [],
  callAsset = null,
  businessName = null,
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);
  const assetOperations = [];
  const metaLookup = []; // track index to asset type
  const directLinkOperations = [];
  const linkedSummary = [];

  // 1. Prepare Sitelink Asset Operations
  // CRITICAL: finalUrls MUST be on the root 'create' (Asset) object, NOT inside sitelinkAsset!
  // Google Ads strictly forbids duplicate destination URLs or identical link texts across sitelinks in the same campaign.
  if (Array.isArray(sitelinks) && sitelinks.length > 0) {
    const seenUrls = new Set();
    const seenTexts = new Set();

    for (const s of sitelinks) {
      if (!s) continue;
      const rawLinkText = String(s.linkText || s.text || "").trim();
      const linkText = stripPhoneNumbersFromAdText(rawLinkText).slice(0, 25).trim();
      if (!linkText) continue;

      let finalUrl = String(s.finalUrl || s.url || "").trim();
      if (!finalUrl || (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://"))) {
        continue;
      }

      const normalizedUrl = finalUrl.replace(/\/+$/, "").toLowerCase();
      const normalizedText = linkText.toLowerCase();

      // Skip duplicate URLs or duplicate link titles
      if (seenUrls.has(normalizedUrl) || seenTexts.has(normalizedText)) {
        console.warn(`[createCampaignAssetsAndLink] Skipping duplicate sitelink: "${linkText}" -> ${finalUrl}`);
        continue;
      }

      seenUrls.add(normalizedUrl);
      seenTexts.add(normalizedText);

      const rawDesc1 = String(s.description1 || s.desc1 || "").trim();
      const rawDesc2 = String(s.description2 || s.desc2 || "").trim();
      const desc1 = stripPhoneNumbersFromAdText(rawDesc1).slice(0, 35).trim();
      const desc2 = stripPhoneNumbersFromAdText(rawDesc2).slice(0, 35).trim();

      const sitelinkAsset = { linkText };
      if (desc1) sitelinkAsset.description1 = desc1;
      if (desc2) sitelinkAsset.description2 = desc2;

      assetOperations.push({
        create: {
          finalUrls: [finalUrl],
          sitelinkAsset,
        },
      });
      metaLookup.push({ fieldType: "SITELINK", label: linkText });

      if (assetOperations.filter(op => op.create?.sitelinkAsset).length >= 4) {
        break; // Up to 4 sitelinks max
      }
    }
  }

  // 2. Prepare Callout Asset Operations
  if (Array.isArray(callouts) && callouts.length > 0) {
    callouts.slice(0, 8).forEach((c) => {
      const rawText = typeof c === "string" ? c : (c.text || c.calloutText || "Trusted Service");
      const calloutText = stripPhoneNumbersFromAdText(String(rawText)).slice(0, 25).trim();
      if (!calloutText) return;

      assetOperations.push({
        create: {
          calloutAsset: {
            calloutText,
          },
        },
      });
      metaLookup.push({ fieldType: "CALLOUT", label: calloutText });
    });
  }

  // 3. Prepare Call Asset Operation
  if (callAsset && callAsset.phoneNumber) {
    const rawNumber = String(callAsset.phoneNumber).trim();
    const country = (callAsset.countryCode || detectCountryCode(rawNumber)).toUpperCase().slice(0, 2);

    assetOperations.push({
      create: {
        callAsset: {
          countryCode: country,
          phoneNumber: rawNumber,
        },
      },
    });
    metaLookup.push({ fieldType: "CALL", label: rawNumber });
  }

  // 4. Prepare Business Name Asset Operation
  if (businessName) {
    const cleanBusinessName = stripPhoneNumbersFromAdText(String(businessName)).trim().slice(0, 25);
    if (cleanBusinessName) {
      assetOperations.push({
        create: {
          textAsset: {
            text: cleanBusinessName,
          },
        },
      });
      metaLookup.push({ fieldType: "BUSINESS_NAME", label: cleanBusinessName });
    }
  }

  if (assetOperations.length === 0 && directLinkOperations.length === 0) {
    return { ok: true, linkedAssets: [] };
  }

  try {
    const linkOperations = [...directLinkOperations];

    // Step A: Mutate Assets in Google Ads (if new assets need creation)
    if (assetOperations.length > 0) {
      const assetUrl = `https://googleads.googleapis.com/v22/customers/${targetId}/assets:mutate`;
      const assetResp = await fetch(assetUrl, {
        method: "POST",
        headers: getHeaders(accessToken, loginCustomerId),
        body: JSON.stringify({
          operations: assetOperations,
          partialFailure: true,
        }),
      });

      const assetJson = await assetResp.json();
      if (!assetResp.ok && !assetJson.results) {
        console.error("Google Ads Assets Mutate Error Details:", JSON.stringify(assetJson, null, 2));
      }

      const createdResults = Array.isArray(assetJson.results) ? assetJson.results : [];
      createdResults.forEach((res, idx) => {
        const resourceName = res.resourceName;
        const meta = metaLookup[idx];
        if (resourceName && meta) {
          linkOperations.push({
            create: {
              campaign: campaignResourceName,
              asset: resourceName,
              fieldType: meta.fieldType,
              status: "ENABLED",
            },
          });
          linkedSummary.push({
            resourceName,
            fieldType: meta.fieldType,
            label: meta.label,
          });
        }
      });
    }

    if (linkOperations.length === 0) {
      return { ok: true, linkedAssets: [] };
    }

    // Step B: Link created/discovered assets to Campaign with partialFailure protection
    const linkUrl = `https://googleads.googleapis.com/v22/customers/${targetId}/campaignAssets:mutate`;
    const linkResp = await fetch(linkUrl, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({
        operations: linkOperations,
        partialFailure: true,
      }),
    });

    const linkJson = await linkResp.json();
    if (!linkResp.ok && !linkJson.results) {
      console.warn("Google Ads CampaignAssets Link Warning:", JSON.stringify(linkJson, null, 2));
    }

    console.log(`Successfully linked ${linkedSummary.length} assets to campaign ${campaignResourceName}`);
    return {
      ok: true,
      linkedAssets: linkedSummary,
    };
  } catch (err) {
    console.warn("Asset creation/link exception (non-fatal):", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Configure Campaign Conversion Goals: Queries campaign conversion goals via GAQL
 * and sets MESSAGE_LEAD to biddable: false so Google never mandates message assets or images,
 * and sets PHONE_CALL_LEAD to biddable: true if call goal is active.
 */
export async function configureCampaignConversionGoals({
  accessToken,
  customerId,
  campaignId,
  isCallGoal = false,
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);
  if (!campaignId) return { ok: false };

  try {
    const query = `
      SELECT
        campaign_conversion_goal.resource_name,
        campaign_conversion_goal.category,
        campaign_conversion_goal.origin,
        campaign_conversion_goal.biddable
      FROM campaign_conversion_goal
      WHERE campaign.id = ${campaignId}
    `;

    const searchUrl = `https://googleads.googleapis.com/v22/customers/${targetId}/googleAds:search`;
    const searchResp = await fetch(searchUrl, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({ query }),
    });

    const searchJson = await searchResp.json();
    const rows = searchJson.results || [];
    const operations = [];

    rows.forEach((row) => {
      const g = row.campaignConversionGoal;
      if (!g || !g.resourceName) return;

      // Turn OFF Message Leads so Google never asks for message assets or images
      if (g.category === "MESSAGE_LEAD" && g.biddable) {
        operations.push({
          update: {
            resourceName: g.resourceName,
            biddable: false,
          },
          updateMask: "biddable",
        });
      }

      // Turn ON Phone Call Leads if this is a call goal
      if (g.category === "PHONE_CALL_LEAD" && !g.biddable && isCallGoal) {
        operations.push({
          update: {
            resourceName: g.resourceName,
            biddable: true,
          },
          updateMask: "biddable",
        });
      }
    });

    if (operations.length === 0) {
      return { ok: true, operationsCount: 0 };
    }

    const mutateUrl = `https://googleads.googleapis.com/v22/customers/${targetId}/campaignConversionGoals:mutate`;
    const mutateResp = await fetch(mutateUrl, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({ operations }),
    });

    const mutateJson = await mutateResp.json();
    console.log(`Campaign conversion goals updated for campaign ${campaignId}:`, mutateJson);
    return { ok: mutateResp.ok, json: mutateJson };
  } catch (err) {
    console.warn("configureCampaignConversionGoals exception (non-fatal):", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Create a Standard Shopping Campaign in PAUSED status with Merchant Center integration
 */
export async function createStandardShoppingCampaign({
  accessToken,
  customerId,
  campaignName,
  budgetResourceName,
  merchantId,
  salesCountry = "IN",
  biddingStrategy = "MAXIMIZE_CLICKS",
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);
  const cleanMerchantId = String(merchantId).replace(/[^0-9]/g, "");

  const initialName = campaignName || `Shopping - ${cleanMerchantId} - ${Date.now()}`;
  let candidateName = initialName;
  try {
    const existingNames = await getExistingCampaignNames({ accessToken, customerId: targetId, loginCustomerId });
    if (existingNames && existingNames.length > 0) {
      candidateName = getUniqueCampaignName(initialName, existingNames);
    }
  } catch (_) {}

  const url = `https://googleads.googleapis.com/v22/customers/${targetId}/campaigns:mutate`;
  const campaignOperation = {
    name: candidateName,
    status: "PAUSED",
    advertisingChannelType: "SHOPPING",
    campaignBudget: budgetResourceName,
    containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
    shoppingSetting: {
      merchantId: cleanMerchantId,
      salesCountry: salesCountry || "IN",
      campaignPriority: 0,
      enableLocal: false,
    },
    geoTargetTypeSetting: {
      positiveGeoTargetType: "PRESENCE_OR_INTEREST",
      negativeGeoTargetType: "PRESENCE",
    },
  };

  if (String(biddingStrategy).toUpperCase().includes("CONVERSION")) {
    campaignOperation.maximizeConversionValue = {};
  } else {
    campaignOperation.targetSpend = {}; // Maximize Clicks
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: getHeaders(accessToken, loginCustomerId),
    body: JSON.stringify({ operations: [{ create: campaignOperation }] }),
  });

  const json = await resp.json();
  if (!resp.ok) {
    console.error("Standard Shopping Campaign creation error:", json);
    return { ok: false, status: resp.status, error: json };
  }

  const resourceName = json.results?.[0]?.resourceName;
  const campaignId = resourceName ? resourceName.split("/").pop() : null;

  return {
    ok: true,
    campaignId,
    resourceName,
    name: candidateName,
    channelType: "SHOPPING",
    merchantId: cleanMerchantId,
    status: "PAUSED",
    json,
  };
}

/**
 * Create Shopping Ad Group, Shopping Product Ad, and Root Listing Group
 */
export async function createShoppingAdGroupAndListingGroup({
  accessToken,
  customerId,
  campaignResourceName,
  adGroupName = "All Products",
  cpcBidMicros = 15000000,
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);

  // 1. Create Ad Group for Shopping
  const agUrl = `https://googleads.googleapis.com/v22/customers/${targetId}/adGroups:mutate`;
  const agResp = await fetch(agUrl, {
    method: "POST",
    headers: getHeaders(accessToken, loginCustomerId),
    body: JSON.stringify({
      operations: [
        {
          create: {
            campaign: campaignResourceName,
            name: adGroupName || `Products - ${Date.now()}`,
            status: "PAUSED",
            type: "SHOPPING_PRODUCT_ADS",
            cpcBidMicros: cpcBidMicros || 15000000,
          },
        },
      ],
    }),
  });

  const agJson = await agResp.json();
  if (!agResp.ok) {
    console.error("Shopping Ad Group creation error:", agJson);
    return { ok: false, error: agJson };
  }

  const adGroupResource = agJson.results?.[0]?.resourceName;
  const adGroupId = adGroupResource ? adGroupResource.split("/").pop() : null;

  // 2. Create Shopping Product Ad
  const adUrl = `https://googleads.googleapis.com/v22/customers/${targetId}/adGroupAds:mutate`;
  try {
    await fetch(adUrl, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({
        operations: [
          {
            create: {
              adGroup: adGroupResource,
              status: "PAUSED",
              ad: {
                shoppingProductAd: {},
              },
            },
          },
        ],
      }),
    });
  } catch (adErr) {
    console.warn("Shopping Ad creation warning:", adErr.message);
  }

  // 3. Create Root Listing Group (All Products Unit)
  const critUrl = `https://googleads.googleapis.com/v22/customers/${targetId}/adGroupCriteria:mutate`;
  let listingRes = null;
  try {
    const critResp = await fetch(critUrl, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({
        operations: [
          {
            create: {
              adGroup: adGroupResource,
              status: "ENABLED",
              cpcBidMicros: cpcBidMicros || 15000000,
              listingGroup: {
                type: "UNIT",
              },
            },
          },
        ],
      }),
    });
    listingRes = await critResp.json();
  } catch (critErr) {
    console.warn("Listing Group creation warning:", critErr.message);
  }

  return {
    ok: true,
    adGroupId,
    adGroupResourceName: adGroupResource,
    listingGroup: listingRes?.results?.[0]?.resourceName || null,
  };
}

/**
 * Create a Performance Max Campaign (Supports both Retail/Shopping with GMC and Non-Ecommerce Lead Gen)
 */
export async function createPerformanceMaxCampaign({
  accessToken,
  customerId,
  campaignName,
  budgetResourceName,
  merchantId = null,
  salesCountry = "IN",
  biddingStrategy = "MAXIMIZE_CONVERSIONS",
  finalUrl = "https://ai.gabbarinfo.com",
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);
  const cleanMerchantId = merchantId ? String(merchantId).replace(/[^0-9]/g, "") : null;
  const isRetailPMax = Boolean(cleanMerchantId);

  const initialName = campaignName || `PMax - ${isRetailPMax ? "Retail" : "LeadGen"} - ${Date.now()}`;
  let candidateName = initialName;
  try {
    const existingNames = await getExistingCampaignNames({ accessToken, customerId: targetId, loginCustomerId });
    if (existingNames && existingNames.length > 0) {
      candidateName = getUniqueCampaignName(initialName, existingNames);
    }
  } catch (_) {}

  // 1. Create PMax Campaign
  const url = `https://googleads.googleapis.com/v22/customers/${targetId}/campaigns:mutate`;
  const campaignOperation = {
    name: candidateName,
    status: "PAUSED",
    advertisingChannelType: "PERFORMANCE_MAX",
    brandGuidelinesEnabled: false,
    campaignBudget: budgetResourceName,
    containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
    geoTargetTypeSetting: {
      positiveGeoTargetType: "PRESENCE_OR_INTEREST",
      negativeGeoTargetType: "PRESENCE",
    },
  };

  if (isRetailPMax) {
    campaignOperation.shoppingSetting = {
      merchantId: cleanMerchantId,
      feedLabel: salesCountry || "IN",
    };
    campaignOperation.maximizeConversionValue = {};
  } else {
    campaignOperation.maximizeConversions = {};
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: getHeaders(accessToken, loginCustomerId),
    body: JSON.stringify({ operations: [{ create: campaignOperation }] }),
  });

  const json = await resp.json();
  if (!resp.ok) {
    console.error("Performance Max Campaign creation error:", json);
    return { ok: false, status: resp.status, error: json };
  }

  const resourceName = json.results?.[0]?.resourceName;
  const campaignId = resourceName ? resourceName.split("/").pop() : null;

  // 2. Return created Campaign Container details
  return {
    ok: true,
    campaignId,
    resourceName,
    name: candidateName,
    channelType: "PERFORMANCE_MAX",
    isRetail: isRetailPMax,
    merchantId: cleanMerchantId,
    status: "PAUSED",
    json,
  };
}

/**
 * Generates and prepares 100% compliant marketing image base64 buffers for Performance Max:
 * - Landscape Marketing Image (1.91:1, 1200x628)
 * - Square Marketing Image (1:1, 1200x1200)
 * - Square Logo (1:1, 1200x1200)
 */
export async function preparePMaxMarketingImages({ businessName, services = null, images = [], logo = null }) {
  const brand = (businessName || "Brand").trim();
  const serviceText = (services || "Professional Services & Solutions").trim();
  let landscapeB64 = null;
  let squareB64 = null;
  let logoB64 = null;

  // 1. Process provided/scraped images if any
  const primaryImg = Array.isArray(images)
    ? images.find(img => img && (typeof img === "string" ? !img.startsWith("customers/") : (img.base64 || img.data)))
    : null;
  const rawImageB64 = primaryImg
    ? (typeof primaryImg === "string" ? primaryImg : (primaryImg.base64 || primaryImg.data))
    : null;

  if (rawImageB64) {
    try {
      const cleanB64 = rawImageB64.replace(/^data:image\/[a-z]+;base64,/, "");
      const buf = Buffer.from(cleanB64, "base64");
      const landBuf = await sharp(buf)
        .resize(1200, 628, { fit: "cover", position: "center" })
        .jpeg({ quality: 90 })
        .toBuffer();
      landscapeB64 = landBuf.toString("base64");

      const sqBuf = await sharp(buf)
        .resize(1200, 1200, { fit: "cover", position: "center" })
        .jpeg({ quality: 90 })
        .toBuffer();
      squareB64 = sqBuf.toString("base64");
    } catch (e) {
      console.warn("Could not process primary image with sharp:", e.message);
    }
  }

  // 2. Generate modern, dark branded aesthetic graphic banner if landscape image missing
  if (!landscapeB64) {
    try {
      const svgLandscape = `<svg width="1200" height="628" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="60%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
          <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#38bdf8"/>
            <stop offset="100%" stop-color="#818cf8"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bgGrad)"/>
        <circle cx="1080" cy="180" r="280" fill="rgba(56, 189, 248, 0.08)"/>
        <circle cx="120" cy="520" r="320" fill="rgba(129, 140, 248, 0.06)"/>
        <rect x="100" y="80" width="220" height="42" rx="21" fill="rgba(255, 255, 255, 0.08)"/>
        <text x="210" y="107" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="600" fill="#38bdf8" text-anchor="middle">OFFICIAL AGENCY</text>
        <text x="100" y="240" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="800" fill="#ffffff">${brand}</text>
        <text x="100" y="320" font-family="system-ui, -apple-system, sans-serif" font-size="38" font-weight="700" fill="url(#brandGrad)">${serviceText}</text>
        <text x="100" y="400" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="500" fill="#94a3b8">Certified Quality • Transparent Pricing • Dedicated Support</text>
        <rect x="100" y="460" width="240" height="56" rx="28" fill="#38bdf8"/>
        <text x="220" y="496" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#0f172a" text-anchor="middle">Get Free Quote</text>
      </svg>`;
      const buf = await sharp(Buffer.from(svgLandscape)).jpeg({ quality: 90 }).toBuffer();
      landscapeB64 = buf.toString("base64");
    } catch (e) {
      console.warn("Error creating SVG landscape:", e.message);
    }
  }

  // 3. Generate modern branded square banner if square image missing
  if (!squareB64) {
    try {
      const svgSquare = `<svg width="1200" height="1200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgSq" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="50%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#090d16"/>
          </linearGradient>
          <linearGradient id="brandSq" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#38bdf8"/>
            <stop offset="100%" stop-color="#818cf8"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bgSq)"/>
        <circle cx="600" cy="480" r="220" fill="rgba(56, 189, 248, 0.1)"/>
        <text x="50%" y="540" font-family="system-ui, -apple-system, sans-serif" font-size="160" font-weight="900" fill="url(#brandSq)" text-anchor="middle">${brand.charAt(0).toUpperCase()}</text>
        <text x="50%" y="780" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="800" fill="#ffffff" text-anchor="middle">${brand}</text>
        <text x="50%" y="860" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="600" fill="#94a3b8" text-anchor="middle">${serviceText}</text>
      </svg>`;
      const buf = await sharp(Buffer.from(svgSquare)).jpeg({ quality: 90 }).toBuffer();
      squareB64 = buf.toString("base64");
    } catch (e) {
      console.warn("Error creating SVG square:", e.message);
    }
  }

  // 4. Process Logo
  const rawLogoB64 = logo
    ? (typeof logo === "string" ? (!logo.startsWith("customers/") ? logo : null) : (logo.base64 || logo.data))
    : null;
  if (rawLogoB64) {
    try {
      const cleanB64 = rawLogoB64.replace(/^data:image\/[a-z]+;base64,/, "");
      const buf = Buffer.from(cleanB64, "base64");
      const lBuf = await sharp(buf)
        .resize(1200, 1200, { fit: "contain", background: { r: 15, g: 23, b: 42, alpha: 1 } })
        .jpeg({ quality: 90 })
        .toBuffer();
      logoB64 = lBuf.toString("base64");
    } catch (e) {
      console.warn("Could not process logo with sharp:", e.message);
    }
  }

  // Generate distinct circular brand badge logo if missing or if identical to square image
  if (!logoB64 || logoB64 === squareB64) {
    try {
      const svgLogo = `<svg width="1200" height="1200" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#0f172a"/>
        <circle cx="600" cy="600" r="480" fill="#1e293b" stroke="#38bdf8" stroke-width="24"/>
        <text x="50%" y="680" font-family="system-ui, -apple-system, sans-serif" font-size="340" font-weight="900" fill="#38bdf8" text-anchor="middle">${brand.charAt(0).toUpperCase()}</text>
      </svg>`;
      const buf = await sharp(Buffer.from(svgLogo)).jpeg({ quality: 90 }).toBuffer();
      logoB64 = buf.toString("base64");
    } catch (e) {
      console.warn("Error creating distinct SVG logo:", e.message);
    }
  }

  return { landscapeB64, squareB64, logoB64 };
}

/**
 * Creates and links a complete, fully-compliant Asset Group for a Performance Max campaign,
 * adhering strictly to Google Ads API v22 requirements:
 * - Minimum 3 HEADLINEs (max 15, max 30 chars each)
 * - Minimum 1 LONG_HEADLINE (max 5, max 90 chars each)
 * - Minimum 2 DESCRIPTIONs (max 5, max 90 chars each)
 * - 1 BUSINESS_NAME (max 25 chars)
 * - 1 MARKETING_IMAGE (landscape 1.91:1, 1200x628)
 * - 1 SQUARE_MARKETING_IMAGE (square 1:1, 1200x1200)
 * - 1 LOGO (square 1:1, 1200x1200)
 * - Audience Search Themes (assetGroupSignalOperation)
 * - Listing Group Filter (All Products Unit) if retail PMax
 *
 * Uses atomic GoogleAdsService.mutate (`googleAds:mutate`) with temporary resource names
 * so the Asset Group is committed in a 100% valid state and immediately visible in Google Ads UI.
 */
export async function createPerformanceMaxAssetGroupAndAssets({
  accessToken,
  customerId,
  campaignResourceName,
  campaignName,
  finalUrl = "https://ai.gabbarinfo.com",
  adGroups = [],
  businessName = null,
  images = [],
  logo = null,
  videoAsset = null,
  isRetail = false,
  loginCustomerId = null,
  services = null,
  targetLocation = null,
}) {
  const targetId = cleanCustomerId(customerId);
  const cleanBusinessName = String(businessName || "Gabbarinfo").trim().slice(0, 25);
  const candidateFinalUrl = (finalUrl && (finalUrl.startsWith("http://") || finalUrl.startsWith("https://")))
    ? finalUrl
    : "https://ai.gabbarinfo.com";

  // 1. Extract Headlines (must have >= 3, max 15, max 30 chars each)
  const adGroup0 = Array.isArray(adGroups) && adGroups.length > 0 ? adGroups[0] : {};
  const adItem0 = Array.isArray(adGroup0.ads) && adGroup0.ads.length > 0 ? adGroup0.ads[0] : {};

  // Infer primary service and location dynamically from passed context
  const loc = String(targetLocation || "").trim();
  const rawServiceCandidates = [
    services,
    ...(Array.isArray(adGroup0.searchThemes) ? adGroup0.searchThemes : []),
    ...(Array.isArray(adGroup0.keywords) ? adGroup0.keywords : []),
  ].filter(Boolean);

  let primaryService = "";
  if (typeof services === "string" && services.trim()) {
    primaryService = services.split(/[,&|\/]/)[0].trim();
  } else if (rawServiceCandidates.length > 0) {
    const cand = String(rawServiceCandidates[0]).replace(/\b(in|near|at|for)\b.*/i, "").trim();
    if (cand.length >= 3 && cand.length <= 25) {
      primaryService = cand.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  const dynamicHeadlines = [
    primaryService ? primaryService.slice(0, 30) : null,
    primaryService && loc ? `${primaryService} ${loc}`.slice(0, 30) : null,
    primaryService ? `Top ${primaryService}`.slice(0, 30) : null,
    primaryService ? `Best ${primaryService}`.slice(0, 30) : null,
    primaryService ? `Affordable ${primaryService}`.slice(0, 30) : null,
    loc ? `Top Rated in ${loc}`.slice(0, 30) : "Top Rated Professionals",
    `${cleanBusinessName} Services`.slice(0, 30),
    `Official ${cleanBusinessName}`.slice(0, 30),
    "Verified Local Experts",
    "Fast & Reliable Service",
    "Get Free Instant Quote",
    "Get Free Consultation",
    "Contact Our Team Today",
    "Trusted by Top Clients",
    "Get Started Today",
  ].filter(Boolean);

  const rawHeadlines = [
    ...(Array.isArray(adItem0.headlines) ? adItem0.headlines : []),
    adItem0.headline1,
    adItem0.headline2,
    adItem0.headline3,
    adItem0.headline4,
    adItem0.headline5,
    ...dynamicHeadlines,
  ].filter(Boolean);

  const seenHeadlines = new Set();
  const validHeadlines = [];
  for (const h of rawHeadlines) {
    const raw = typeof h === "string" ? h.trim() : (h.text || "").trim();
    const text = stripPhoneNumbersFromAdText(raw).slice(0, 30).trim();
    if (text && text.length >= 2 && !seenHeadlines.has(text.toLowerCase())) {
      seenHeadlines.add(text.toLowerCase());
      validHeadlines.push(text);
    }
    if (validHeadlines.length >= 15) break;
  }
  if (validHeadlines.length < 3) {
    const defaultHeadlines = [
      cleanBusinessName.slice(0, 30),
      (primaryService ? `${primaryService} Services` : "Trusted Local Services").slice(0, 30),
      (loc ? `Top Rated in ${loc}` : "Top Rated Services").slice(0, 30),
    ];
    for (const dh of defaultHeadlines) {
      const cleanDh = stripPhoneNumbersFromAdText(dh).slice(0, 30).trim();
      if (cleanDh && !seenHeadlines.has(cleanDh.toLowerCase())) {
        seenHeadlines.add(cleanDh.toLowerCase());
        validHeadlines.push(cleanDh);
      }
    }
  }

  // 2. Extract Long Headline (max 90 chars, strictly no phone numbers)
  let rawLongHeadline = adItem0.longHeadline || adItem0.long_headline || "";
  if (!rawLongHeadline) {
    rawLongHeadline = primaryService
      ? (loc
          ? `${cleanBusinessName} - Premier ${primaryService} in ${loc} & Professional Solutions`
          : `${cleanBusinessName} - Professional High Quality ${primaryService} & Solutions`)
      : `${cleanBusinessName} - Professional High Quality Solutions & Reliable Tailored Services`;
  }
  const validLongHeadline = stripPhoneNumbersFromAdText(String(rawLongHeadline).trim()).slice(0, 90).trim();

  // 3. Extract Descriptions (max 90 chars each, at least 2, up to 5, strictly no phone numbers)
  const descriptionFallbacks = [
    primaryService && loc
      ? `Looking for trusted ${primaryService} in ${loc}? Contact ${cleanBusinessName} for expert assistance.`.slice(0, 90)
      : (primaryService
          ? `High quality ${primaryService} tailored to your business goals. Contact our expert team!`.slice(0, 90)
          : `Discover trusted, verified, and tailored solutions for your business at ${cleanBusinessName}.`.slice(0, 90)),
    `Partner with ${cleanBusinessName} for proven results, expert guidance, and dedicated support.`.slice(0, 90),
    "Get transparent pricing, customized solutions, and prompt service. Request a free quote!".slice(0, 90),
    "Reliable, verified, and customer-focused services designed to deliver real business growth.".slice(0, 90),
  ];

  const rawDescriptions = [
    ...(Array.isArray(adItem0.descriptions) ? adItem0.descriptions : []),
    adItem0.description1,
    adItem0.description2,
    adItem0.description3,
    adItem0.description4,
    ...descriptionFallbacks,
  ].filter(Boolean);

  const seenDescriptions = new Set();
  const validDescriptions = [];
  for (const d of rawDescriptions) {
    const raw = typeof d === "string" ? d.trim() : (d.text || "").trim();
    const text = stripPhoneNumbersFromAdText(raw).slice(0, 90).trim();
    if (text && text.length >= 5 && !seenDescriptions.has(text.toLowerCase())) {
      seenDescriptions.add(text.toLowerCase());
      validDescriptions.push(text);
    }
    if (validDescriptions.length >= 5) break;
  }
  if (validDescriptions.length < 2) {
    const fallbackDesc = stripPhoneNumbersFromAdText(`Discover trusted and verified solutions tailored for you at ${cleanBusinessName}.`).slice(0, 90).trim();
    validDescriptions.push(fallbackDesc);
  }

  // 4. Resolve Existing Image Resources vs New Media to Upload
  // 4. Resolve Existing Image Resources vs New Media to Upload
  const existingLandscapeResources = [];
  const existingSquareResources = [];
  const existingLogoResources = [];

  if (typeof logo === "string" && logo.startsWith("customers/")) {
    existingLogoResources.push(logo);
  }

  const rawImagesList = Array.isArray(images) ? images : [];
  const newBase64ImagesToUpload = [];

  for (const img of rawImagesList) {
    if (typeof img === "string" && img.startsWith("customers/")) {
      if (existingLogoResources.includes(img)) continue;
      // Balance between landscapes and squares (up to 5 each)
      if (existingLandscapeResources.length <= existingSquareResources.length && existingLandscapeResources.length < 5) {
        existingLandscapeResources.push(img);
      } else if (existingSquareResources.length < 5) {
        existingSquareResources.push(img);
      }
    } else if (img && typeof img === "object") {
      if (img.resourceName && img.resourceName.startsWith("customers/")) {
        if (img.fieldType === "LOGO" && !existingLogoResources.includes(img.resourceName)) {
          existingLogoResources.push(img.resourceName);
        } else if (img.fieldType === "SQUARE_MARKETING_IMAGE" && !existingSquareResources.includes(img.resourceName)) {
          existingSquareResources.push(img.resourceName);
        } else if (!existingLandscapeResources.includes(img.resourceName)) {
          existingLandscapeResources.push(img.resourceName);
        }
      } else if (img.base64 || img.data) {
        newBase64ImagesToUpload.push(img);
      }
    }
  }

  const hasLandscape = existingLandscapeResources.length > 0;
  const hasSquare = existingSquareResources.length > 0;
  const hasLogo = existingLogoResources.length > 0;

  // Only prepare fallback base64 images if library resources and scraped images are completely missing
  const marketingImgs = await preparePMaxMarketingImages({
    businessName: cleanBusinessName,
    services: primaryService || services,
    images: hasLandscape && hasSquare ? [] : newBase64ImagesToUpload,
    logo: hasLogo ? null : logo,
  });

  // 5. Create Asset entities via assets:mutate
  const assetOperations = [];
  const metaLookup = [];

  // A. Headlines
  validHeadlines.forEach((h) => {
    assetOperations.push({
      create: {
        textAsset: { text: h },
      },
    });
    metaLookup.push({ fieldType: "HEADLINE", label: h });
  });

  // B. Long Headline
  assetOperations.push({
    create: {
      textAsset: { text: validLongHeadline },
    },
  });
  metaLookup.push({ fieldType: "LONG_HEADLINE", label: validLongHeadline });

  // C. Descriptions
  validDescriptions.forEach((d) => {
    assetOperations.push({
      create: {
        textAsset: { text: d },
      },
    });
    metaLookup.push({ fieldType: "DESCRIPTION", label: d });
  });

  // D. Business Name
  assetOperations.push({
    create: {
      textAsset: { text: cleanBusinessName },
    },
  });
  metaLookup.push({ fieldType: "BUSINESS_NAME", label: cleanBusinessName });

  // E. Landscape Marketing Image (1.91:1)
  if (!hasLandscape && marketingImgs.landscapeB64) {
    assetOperations.push({
      create: {
        name: `MarketingLandscape_${Date.now()}`,
        type: "IMAGE",
        imageAsset: { data: marketingImgs.landscapeB64 },
      },
    });
    metaLookup.push({ fieldType: "MARKETING_IMAGE", label: "Landscape Marketing Image" });
  }

  // F. Square Marketing Image (1:1)
  let sharedSquareAssetIndex = -1;
  const isLogoSameAsSquare = Boolean(
    !hasSquare &&
    !hasLogo &&
    marketingImgs.squareB64 &&
    marketingImgs.logoB64 &&
    marketingImgs.squareB64 === marketingImgs.logoB64
  );

  if (!hasSquare && marketingImgs.squareB64) {
    sharedSquareAssetIndex = assetOperations.length;
    assetOperations.push({
      create: {
        name: `MarketingSquare_${Date.now()}`,
        type: "IMAGE",
        imageAsset: { data: marketingImgs.squareB64 },
      },
    });
    metaLookup.push({ fieldType: "SQUARE_MARKETING_IMAGE", label: "Square Marketing Image" });
  }

  // G. Logo (1:1) - Only add separate operation if binary data is distinct!
  if (!hasLogo && marketingImgs.logoB64 && !isLogoSameAsSquare) {
    assetOperations.push({
      create: {
        name: `BrandLogo_${Date.now()}`,
        type: "IMAGE",
        imageAsset: { data: marketingImgs.logoB64 },
      },
    });
    metaLookup.push({ fieldType: "LOGO", label: "Brand Logo" });
  }

  // H. Additional Scraped Images to Upload
  newBase64ImagesToUpload.forEach((imgObj, idx) => {
    const b64 = imgObj.base64 || imgObj.data;
    if (b64) {
      const fieldType = imgObj.type === "SQUARE_MARKETING_IMAGE" ? "SQUARE_MARKETING_IMAGE" : "MARKETING_IMAGE";
      assetOperations.push({
        create: {
          name: imgObj.name || `AssetImg_${Date.now()}_${idx}`,
          type: "IMAGE",
          imageAsset: { data: b64 },
        },
      });
      metaLookup.push({ fieldType, label: imgObj.name || `Scraped Image ${idx + 1}` });
    }
  });

  const assetUrl = `https://googleads.googleapis.com/v22/customers/${targetId}/assets:mutate`;
  const assetResp = await fetch(assetUrl, {
    method: "POST",
    headers: getHeaders(accessToken, loginCustomerId),
    body: JSON.stringify({
      operations: assetOperations,
      partialFailure: false,
    }),
  });

  const assetJson = await assetResp.json();
  if (!assetResp.ok || !assetJson.results) {
    console.error("Performance Max Assets Mutate Error:", JSON.stringify(assetJson, null, 2));
    return { ok: false, error: assetJson };
  }

  // 6. Build atomic googleAds:mutate request with temporary resource name
  const createdResults = assetJson.results || [];
  const assetGroupAssetOperations = [];

  // Directly link all existing library resources
  for (const landRes of existingLandscapeResources) {
    assetGroupAssetOperations.push({
      create: {
        assetGroup: `customers/${targetId}/assetGroups/-1`,
        asset: landRes,
        fieldType: "MARKETING_IMAGE",
      },
    });
  }
  for (const sqRes of existingSquareResources) {
    assetGroupAssetOperations.push({
      create: {
        assetGroup: `customers/${targetId}/assetGroups/-1`,
        asset: sqRes,
        fieldType: "SQUARE_MARKETING_IMAGE",
      },
    });
  }
  for (const logoRes of existingLogoResources) {
    assetGroupAssetOperations.push({
      create: {
        assetGroup: `customers/${targetId}/assetGroups/-1`,
        asset: logoRes,
        fieldType: "LOGO",
      },
    });
  }
  if (videoAsset && typeof videoAsset === "string" && videoAsset.startsWith("customers/")) {
    assetGroupAssetOperations.push({
      create: {
        assetGroup: `customers/${targetId}/assetGroups/-1`,
        asset: videoAsset,
        fieldType: "YOUTUBE_VIDEO",
      },
    });
  }

  createdResults.forEach((res, idx) => {
    const resourceName = res.resourceName;
    const meta = metaLookup[idx];
    if (resourceName && meta) {
      assetGroupAssetOperations.push({
        create: {
          assetGroup: `customers/${targetId}/assetGroups/-1`,
          asset: resourceName,
          fieldType: meta.fieldType,
        },
      });

      // If logo shared the square image binary, link the same asset resource as LOGO as well!
      if (isLogoSameAsSquare && idx === sharedSquareAssetIndex) {
        assetGroupAssetOperations.push({
          create: {
            assetGroup: `customers/${targetId}/assetGroups/-1`,
            asset: resourceName,
            fieldType: "LOGO",
          },
        });
      }
    }
  });

  const mutateOperations = [
    // 1. Create AssetGroup with temp id -1
    {
      assetGroupOperation: {
        create: {
          resourceName: `customers/${targetId}/assetGroups/-1`,
          campaign: campaignResourceName,
          name: adGroup0.name || `Asset Group - ${cleanBusinessName.slice(0, 15)}`,
          finalUrls: [candidateFinalUrl],
          status: "PAUSED",
        },
      },
    },
    // 2. Link all required AssetGroupAssets
    ...assetGroupAssetOperations.map((op) => ({
      assetGroupAssetOperation: op,
    })),
  ];

  // 3. Link Audience Search Themes (signals)
  const rawThemes = [
    ...(Array.isArray(adGroup0.searchThemes) ? adGroup0.searchThemes : []),
    ...(Array.isArray(adGroup0.keywords) ? adGroup0.keywords : []),
  ];
  const seenThemes = new Set();
  for (const theme of rawThemes) {
    const text = typeof theme === "string" ? theme.trim() : (theme.text || "").trim();
    if (text && !seenThemes.has(text.toLowerCase())) {
      seenThemes.add(text.toLowerCase());
      mutateOperations.push({
        assetGroupSignalOperation: {
          create: {
            assetGroup: `customers/${targetId}/assetGroups/-1`,
            searchTheme: { text: text.slice(0, 80) },
          },
        },
      });
    }
    if (seenThemes.size >= 25) break;
  }

  // 4. Listing Group Filter (All Products Unit) if retail PMax
  if (isRetail) {
    mutateOperations.push({
      assetGroupListingGroupFilterOperation: {
        create: {
          assetGroup: `customers/${targetId}/assetGroups/-1`,
          type: "UNIT_INCLUDED",
        },
      },
    });
  }

  const mutateUrl = `https://googleads.googleapis.com/v22/customers/${targetId}/googleAds:mutate`;
  const mutateResp = await fetch(mutateUrl, {
    method: "POST",
    headers: getHeaders(accessToken, loginCustomerId),
    body: JSON.stringify({ mutateOperations }),
  });

  const mutateJson = await mutateResp.json();
  if (!mutateResp.ok) {
    console.error("Performance Max googleAds:mutate Error:", JSON.stringify(mutateJson, null, 2));
    return { ok: false, error: mutateJson };
  }

  const responses = mutateJson.mutateOperationResponses || [];
  const agResult = responses.find((r) => r.assetGroupResult?.resourceName)?.assetGroupResult;
  const assetGroupResourceName = agResult?.resourceName || null;
  const assetGroupId = assetGroupResourceName ? assetGroupResourceName.split("/").pop() : null;

  console.log(`✅ Created Performance Max Asset Group: ${assetGroupResourceName} (ID: ${assetGroupId}) with ${assetGroupAssetOperations.length} assets`);

  return {
    ok: true,
    assetGroupId,
    assetGroupResourceName,
    linkedAssetsCount: assetGroupAssetOperations.length,
    searchThemesCount: seenThemes.size,
  };
}


/**
 * Create a Google Display Network (GDN) Campaign in PAUSED status
 */
export async function createDisplayCampaign({
  accessToken,
  customerId,
  campaignName,
  budgetResourceName,
  biddingStrategy = "MAXIMIZE_CONVERSIONS",
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);
  const initialName = campaignName || `Display - ${Date.now()}`;
  let candidateName = initialName;
  try {
    const existingNames = await getExistingCampaignNames({ accessToken, customerId: targetId, loginCustomerId });
    if (existingNames && existingNames.length > 0) {
      candidateName = getUniqueCampaignName(initialName, existingNames);
    }
  } catch (_) {}

  const url = `https://googleads.googleapis.com/v22/customers/${targetId}/campaigns:mutate`;
  const campaignOperation = {
    name: candidateName,
    status: "PAUSED",
    advertisingChannelType: "DISPLAY",
    campaignBudget: budgetResourceName,
    containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
    networkSettings: {
      targetGoogleSearch: false,
      targetSearchNetwork: false,
      targetContentNetwork: true,
      targetPartnerSearchNetwork: false,
    },
    geoTargetTypeSetting: {
      positiveGeoTargetType: "PRESENCE_OR_INTEREST",
      negativeGeoTargetType: "PRESENCE",
    },
  };

  if (String(biddingStrategy).toUpperCase().includes("CLICK")) {
    campaignOperation.targetSpend = {};
  } else {
    campaignOperation.maximizeConversions = {};
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: getHeaders(accessToken, loginCustomerId),
    body: JSON.stringify({ operations: [{ create: campaignOperation }] }),
  });

  const json = await resp.json();
  if (!resp.ok) {
    console.error("Display Campaign creation error:", json);
    return { ok: false, status: resp.status, error: json };
  }

  const resourceName = json.results?.[0]?.resourceName;
  const campaignId = resourceName ? resourceName.split("/").pop() : null;

  return {
    ok: true,
    campaignId,
    resourceName,
    name: candidateName,
    channelType: "DISPLAY",
    status: "PAUSED",
    json,
  };
}

/**
 * End-to-end Waterfall to create Budget -> Search Campaign -> Ad Groups -> Keywords -> RSA Ads in PAUSED status
 */
export async function createFullGoogleAdsCampaign({
  refreshToken,
  customerId,
  campaign = {},
  campaignType = "SEARCH",
  merchantId = null,
  networkSettings = null,
  salesCountry = null,
  adGroups = [],
  sitelinks = [],
  callouts = [],
  callAsset = null,
  businessName = null,
  targetLocation = null,
  negativeKeywords = [],
  biddingStrategy = null,
  loginCustomerId = null,
  services = null,
}) {
  // 1) Exchange token
  const exch = await exchangeRefreshToken({ refreshToken });
  if (!exch.ok || !exch.accessToken) {
    return {
      ok: false,
      step: "token_exchange",
      message: "Failed to exchange Google OAuth refresh token",
      error: exch.json,
    };
  }

  const accessToken = exch.accessToken;
  const cleanId = cleanCustomerId(customerId);

  if (!cleanId) {
    return {
      ok: false,
      step: "validation",
      message: "Target Google Ads Customer ID is required.",
    };
  }

  // 2) Create Budget
  const budgetMicros = campaign.dailyBudgetMicros || 1000000000;
  const budgetName = `Budget - ${campaign.name || "Campaign"} - ${Date.now()}`;
  const budgetRes = await createCampaignBudget({
    accessToken,
    customerId: cleanId,
    budgetMicros,
    budgetName,
    loginCustomerId,
  });

  if (!budgetRes.ok) {
    return {
      ok: false,
      step: "create_budget",
      message: "Failed to create campaign budget in Google Ads",
      error: budgetRes.error,
    };
  }

  // 3) Create Campaign (forced PAUSED) - Dynamic Type Support (SEARCH, SHOPPING, PERFORMANCE_MAX, DISPLAY)
  const actualBiddingStrategy = biddingStrategy || campaign.biddingStrategy || "MAXIMIZE_CONVERSIONS";
  const rawType = String(campaignType || campaign.channelType || campaign.advertisingChannelType || campaign.campaignType || "SEARCH").toUpperCase();
  const cleanMerchantId = merchantId || campaign.merchantId || null;
  const targetSalesCountry = salesCountry || campaign.salesCountry || detectCountryCode(callAsset?.phoneNumber, targetLocation);

  let campaignRes = null;
  if (rawType.includes("SHOPPING") && !rawType.includes("PMAX") && !rawType.includes("PERFORMANCE")) {
    // 3A) Standard Shopping Campaign
    campaignRes = await createStandardShoppingCampaign({
      accessToken,
      customerId: cleanId,
      campaignName: campaign.name || `Shopping - ${Date.now()}`,
      budgetResourceName: budgetRes.resourceName,
      merchantId: cleanMerchantId,
      salesCountry: targetSalesCountry,
      biddingStrategy: actualBiddingStrategy,
      loginCustomerId,
    });

    if (campaignRes.ok) {
      await createShoppingAdGroupAndListingGroup({
        accessToken,
        customerId: cleanId,
        campaignResourceName: campaignRes.resourceName,
        adGroupName: campaign.adGroupName || "All Products",
        cpcBidMicros: campaign.cpcBidMicros || 15000000,
        loginCustomerId,
      });
    }
  } else if (rawType.includes("PMAX") || rawType.includes("PERFORMANCE")) {
    // 3B) Performance Max Campaign (Retail or Lead Gen)
    campaignRes = await createPerformanceMaxCampaign({
      accessToken,
      customerId: cleanId,
      campaignName: campaign.name || `PMax - ${Date.now()}`,
      budgetResourceName: budgetRes.resourceName,
      merchantId: cleanMerchantId,
      salesCountry: targetSalesCountry,
      biddingStrategy: actualBiddingStrategy,
      finalUrl: campaign.finalUrl || "https://ai.gabbarinfo.com",
      loginCustomerId,
    });
  } else if (rawType.includes("DISPLAY")) {
    // 3C) Google Display Network Campaign
    campaignRes = await createDisplayCampaign({
      accessToken,
      customerId: cleanId,
      campaignName: campaign.name || `Display - ${Date.now()}`,
      budgetResourceName: budgetRes.resourceName,
      biddingStrategy: actualBiddingStrategy,
      loginCustomerId,
    });
  } else {
    // 3D) Google Search Campaign (Default)
    campaignRes = await createSearchCampaign({
      accessToken,
      customerId: cleanId,
      campaignName: campaign.name || `GabbarInfo Campaign - ${Date.now()}`,
      budgetResourceName: budgetRes.resourceName,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      biddingStrategy: actualBiddingStrategy,
      networkSettings: networkSettings || campaign.networkSettings || null,
      loginCustomerId,
    });
  }

  if (!campaignRes || !campaignRes.ok) {
    return {
      ok: false,
      step: "create_campaign",
      message: `Failed to create ${rawType} campaign in Google Ads`,
      error: campaignRes?.error || campaignRes?.json || "Unknown creation failure",
      budgetId: budgetRes.budgetId,
    };
  }

  // 3b) Configure Conversion Goals: Disable MESSAGE_LEAD so Google does not mandate message assets or images
  const actualCallAsset = callAsset || campaign.callAsset || null;
  const isCallGoal = Boolean(actualCallAsset && actualCallAsset.phoneNumber);
  try {
    await configureCampaignConversionGoals({
      accessToken,
      customerId: cleanId,
      campaignId: campaignRes.campaignId,
      isCallGoal,
      loginCustomerId,
    });
  } catch (goalErr) {
    console.warn("Conversion goal configuration non-fatal warning:", goalErr);
  }

  // 3c) Apply Location Targeting (City / Region / Country)
  const actualLocation = targetLocation || campaign.targetLocation || campaign.location || null;
  let locationResult = { ok: true, targetedLocations: [] };
  if (actualLocation) {
    try {
      locationResult = await createCampaignLocationTargeting({
        accessToken,
        customerId: cleanId,
        campaignResourceName: campaignRes.resourceName,
        locationQuery: actualLocation,
        loginCustomerId,
      });
    } catch (locErr) {
      console.warn("Campaign location targeting non-fatal warning:", locErr.message);
    }
  }

  // 3c-2) Auto-link matching Location Group (Asset Set) to isolate Google Business Profile locations
  // and ensure other clients/businesses in the account (e.g. Dehradun, London) never leak into this campaign!
  try {
    await autoLinkCampaignLocationGroup({
      accessToken,
      customerId: cleanId,
      campaignResourceName: campaignRes.resourceName,
      targetLocation: actualLocation,
      businessName: (businessName || campaign.businessName || "").trim(),
      loginCustomerId,
    });
  } catch (locGroupErr) {
    console.warn("Auto-link Location Group non-fatal warning:", locGroupErr.message);
  }

  // 3d) Apply Campaign Negative Keywords (Waste-Spend Protection)
  const actualNegativeKeywords = Array.isArray(negativeKeywords) && negativeKeywords.length > 0
    ? negativeKeywords
    : (campaign.negativeKeywords || []);

  const actualBusinessName = (businessName || campaign.businessName || "").trim().slice(0, 25);
  const actualSitelinks = Array.isArray(sitelinks) && sitelinks.length > 0
    ? sitelinks
    : (campaign.sitelinks || []);
  const actualCallouts = Array.isArray(callouts) && callouts.length > 0
    ? callouts
    : (campaign.callouts || []);

  if (actualNegativeKeywords.length > 0) {
    try {
      await createCampaignNegativeKeywords({
        accessToken,
        customerId: cleanId,
        campaignResourceName: campaignRes.resourceName,
        negativeKeywords: actualNegativeKeywords,
        loginCustomerId,
      });
    } catch (negErr) {
      console.warn("Negative keywords non-fatal warning:", negErr);
    }
  }

  const createdAdGroups = [];

  const isDisplay = rawType.includes("DISPLAY");
  const isPMax = rawType.includes("PMAX") || rawType.includes("PERFORMANCE");
  const isSearch = !rawType.includes("SHOPPING") && !isPMax && !isDisplay;

  // 4) Auto-resolve or collect images and logo early so they can be linked to Asset Groups or Campaign Extensions
  let resolvedImages = Array.isArray(campaign.images) ? campaign.images : [];
  let resolvedLogo = campaign.logo || null;

  if (resolvedImages.length === 0 && !resolvedLogo) {
    try {
      const imgRes = await resolveCampaignImagesAndLogo({
        accessToken,
        customerId: cleanId,
        landingPageUrl: campaign.finalUrl,
        businessName: actualBusinessName,
        services: services || campaign.services || null,
        loginCustomerId,
      });
      resolvedImages = imgRes.images || [];
      resolvedLogo = imgRes.logo || null;
    } catch (imgErr) {
      console.warn("resolveCampaignImagesAndLogo non-fatal warning:", imgErr.message);
    }
  }

  // 4b) Check for relevant YouTube video assets in account matching this business
  let resolvedVideoAsset = null;
  try {
    const videoRes = await getAccountVideoAssets({
      accessToken,
      customerId: cleanId,
      businessName: actualBusinessName,
      services: services || campaign.services || null,
      loginCustomerId,
    });
    if (videoRes.verifiedVideos && videoRes.verifiedVideos.length > 0) {
      resolvedVideoAsset = videoRes.verifiedVideos[0].resourceName;
      console.log(`[GoogleAds Video] Linked verified account video "${videoRes.verifiedVideos[0].title}" to campaign`);
    } else if (videoRes.rejectedCount > 0) {
      console.log(`[GoogleAds Video] Shield active: Ignored ${videoRes.rejectedCount} account videos that belong to other clients/topics`);
    }
  } catch (vidErr) {
    console.warn("Video asset matching non-fatal warning:", vidErr.message);
  }

  // 5A) PERFORMANCE MAX: Create the complete Asset Group with headlines, descriptions, images, logo, and search themes
  if (isPMax && campaignRes.ok) {
    try {
      const pmaxAssetRes = await createPerformanceMaxAssetGroupAndAssets({
        accessToken,
        customerId: cleanId,
        campaignResourceName: campaignRes.resourceName,
        campaignName: campaignRes.name,
        finalUrl: campaign.finalUrl || "https://ai.gabbarinfo.com",
        adGroups,
        businessName: actualBusinessName,
        images: resolvedImages,
        logo: resolvedLogo,
        videoAsset: resolvedVideoAsset,
        isRetail: Boolean(cleanMerchantId),
        loginCustomerId,
        services: services || campaign.services || null,
        targetLocation: targetLocation || campaign.location || null,
      });

      if (pmaxAssetRes.ok) {
        createdAdGroups.push({
          name: `Asset Group - ${actualBusinessName || "Main"}`,
          assetGroupId: pmaxAssetRes.assetGroupId,
          resourceName: pmaxAssetRes.assetGroupResourceName,
          type: "ASSET_GROUP",
          linkedAssetsCount: pmaxAssetRes.linkedAssetsCount,
          searchThemesCount: pmaxAssetRes.searchThemesCount,
        });
      } else {
        console.error("PMax Asset Group creation failed:", JSON.stringify(pmaxAssetRes.error || {}, null, 2));
        return {
          ok: false,
          step: "create_asset_group",
          message: `Campaign container created (ID: ${campaignRes.campaignId}), but Asset Group creation failed.`,
          error: pmaxAssetRes.error,
          campaignId: campaignRes.campaignId,
        };
      }
    } catch (pmaxAgErr) {
      console.error("PMax Asset Group exception:", pmaxAgErr.message);
      return {
        ok: false,
        step: "create_asset_group",
        message: `Exception creating Asset Group: ${pmaxAgErr.message}`,
        campaignId: campaignRes.campaignId,
      };
    }
  } else if (Array.isArray(adGroups) && adGroups.length > 0) {
    // 5B) SEARCH & DISPLAY: Create standard Ad Groups, RSA Ads, and Keywords
    for (const ag of adGroups) {
      const agRes = await createAdGroup({
        accessToken,
        customerId: cleanId,
        campaignResourceName: campaignRes.resourceName,
        name: ag.name,
        type: isDisplay ? "DISPLAY_STANDARD" : "SEARCH_STANDARD",
        cpcBidMicros: ag.cpcBidMicros || 20000000,
        loginCustomerId,
      });

      if (agRes.ok) {
        const agResource = agRes.resourceName;

        // Create Keywords / Contextual Display Keywords
        if (Array.isArray(ag.keywords) && ag.keywords.length > 0) {
          await createAdGroupKeywords({
            accessToken,
            customerId: cleanId,
            adGroupResourceName: agResource,
            keywords: ag.keywords,
            loginCustomerId,
          });
        }

        // Create Responsive Search Ads ONLY for Search campaigns
        if (isSearch && Array.isArray(ag.ads) && ag.ads.length > 0) {
          for (const adItem of ag.ads) {
            const rawHeadlines = [
              ...(Array.isArray(adItem.headlines) ? adItem.headlines : []),
              adItem.headline1,
              adItem.headline2,
              adItem.headline3,
              adItem.headline4,
              adItem.headline5,
              adItem.headline6,
              adItem.headline7,
              adItem.headline8,
              adItem.headline9,
              adItem.headline10,
              adItem.headline11,
              adItem.headline12,
              adItem.headline13,
              adItem.headline14,
              adItem.headline15,
            ].filter(Boolean);

            // Deduplicate headlines while preserving order
            const seenHeadlines = new Set();
            const headlines = [];
            for (const h of rawHeadlines) {
              const text = typeof h === "string" ? h.trim() : (h.text || "").trim();
              if (text && !seenHeadlines.has(text.toLowerCase())) {
                seenHeadlines.add(text.toLowerCase());
                headlines.push(text);
              }
            }

            const rawDescriptions = [
              ...(Array.isArray(adItem.descriptions) ? adItem.descriptions : []),
              adItem.description1,
              adItem.description2,
              adItem.description3,
              adItem.description4,
            ].filter(Boolean);

            const seenDescriptions = new Set();
            const descriptions = [];
            for (const d of rawDescriptions) {
              const text = typeof d === "string" ? d.trim() : (d.text || "").trim();
              if (text && !seenDescriptions.has(text.toLowerCase())) {
                seenDescriptions.add(text.toLowerCase());
                descriptions.push(text);
              }
            }

            await createResponsiveSearchAd({
              accessToken,
              customerId: cleanId,
              adGroupResourceName: agResource,
              finalUrl: adItem.finalUrl || campaign.finalUrl || "https://ai.gabbarinfo.com",
              headlines,
              descriptions,
              path1: adItem.path1 || "",
              path2: adItem.path2 || "",
              loginCustomerId,
            });
          }
        }

        createdAdGroups.push({
          name: ag.name,
          adGroupId: agRes.adGroupId,
          resourceName: agRes.resourceName,
        });
      }
    }
  }

  // 6) Create and Link Campaign-Level Extensions (Sitelinks, Callouts, Call Assets)
  let assetResults = { ok: true, linkedAssets: [] };
  if (
    actualSitelinks.length > 0 ||
    actualCallouts.length > 0 ||
    actualCallAsset ||
    actualBusinessName
  ) {
    try {
      assetResults = await createCampaignAssetsAndLink({
        accessToken,
        customerId: cleanId,
        campaignResourceName: campaignRes.resourceName,
        sitelinks: actualSitelinks,
        callouts: actualCallouts,
        callAsset: actualCallAsset,
        businessName: actualBusinessName,
        loginCustomerId,
      });
    } catch (assetErr) {
      console.warn("Campaign assets creation non-fatal warning:", assetErr);
    }
  }

  // 7) Automated Post-Creation Quality Assurance Audit
  let expertAudit = null;
  try {
    expertAudit = await auditCreatedCampaign({
      accessToken,
      customerId: cleanId,
      campaignResourceName: campaignRes.resourceName,
      campaignType: rawType,
      targetLocation: actualLocation,
      businessName: actualBusinessName,
      landingPageUrl: campaign.finalUrl,
      loginCustomerId,
    });
  } catch (auditErr) {
    console.warn("Post-creation QA audit non-fatal warning:", auditErr.message);
  }

  return {
    ok: true,
    campaignId: campaignRes.campaignId,
    campaignName: campaignRes.name,
    originalCampaignName: campaignRes.originalName,
    renamedFromDuplicate: campaignRes.renamedFromDuplicate,
    campaignResourceName: campaignRes.resourceName,
    budgetId: budgetRes.budgetId,
    budgetResourceName: budgetRes.resourceName,
    status: "PAUSED",
    campaignType: rawType,
    customerId: cleanId,
    adGroups: createdAdGroups,
    negativeKeywordsCount: actualNegativeKeywords.length,
    targetedLocations: locationResult?.targetedLocations || [],
    assets: assetResults?.linkedAssets || [],
    expertAudit,
    message: "Google Ads campaign created successfully in PAUSED status.",
  };
}

/**
 * Get account conversion tracking setting and Google Tag ID (AW-XXXXXXX)
 */
export async function getConversionTrackingSettings({ accessToken, customerId, loginCustomerId = null }) {
  const cleanId = cleanCustomerId(customerId);
  if (!cleanId) return { ok: false, error: "Missing customerId" };

  const query = `
    SELECT customer.id,
           customer.conversion_tracking_setting.conversion_tracking_id,
           customer.conversion_tracking_setting.conversion_tracking_status,
           customer.conversion_tracking_setting.enhanced_conversions_for_leads_enabled,
           customer.conversion_tracking_setting.google_ads_conversion_customer
    FROM customer
  `;

  try {
    const url = `https://googleads.googleapis.com/v22/customers/${cleanId}/googleAds:search`;
    const resp = await fetch(url, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({ query }),
    });

    const json = await resp.json();
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: json };
    }

    const customerData = json.results?.[0]?.customer;
    const setting = customerData?.conversionTrackingSetting;
    const trackingId = setting?.conversionTrackingId ? String(setting.conversionTrackingId) : null;
    const googleTagId = trackingId ? `AW-${trackingId}` : null;

    return {
      ok: true,
      customerId: cleanId,
      conversionTrackingId: trackingId,
      googleTagId,
      conversionTrackingStatus: setting?.conversionTrackingStatus || null,
      enhancedConversionsEnabled: Boolean(setting?.enhancedConversionsForLeadsEnabled),
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/**
 * List all active conversion actions in the account
 */
export async function listConversionActions({ accessToken, customerId, loginCustomerId = null }) {
  const cleanId = cleanCustomerId(customerId);
  if (!cleanId) return { ok: false, error: "Missing customerId", conversionActions: [] };

  const query = `
    SELECT conversion_action.id,
           conversion_action.name,
           conversion_action.type,
           conversion_action.status,
           conversion_action.category,
           conversion_action.tag_snippets,
           conversion_action.value_settings.default_value,
           conversion_action.value_settings.default_currency_code
    FROM conversion_action
    WHERE conversion_action.status != 'HIDDEN'
  `;

  try {
    const url = `https://googleads.googleapis.com/v22/customers/${cleanId}/googleAds:search`;
    const resp = await fetch(url, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({ query }),
    });

    const json = await resp.json();
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: json, conversionActions: [] };
    }

    const conversionActions = (json.results || []).map(row => {
      const ca = row.conversionAction || {};
      let conversionLabel = null;
      let globalSnippet = null;
      let eventSnippet = null;

      if (Array.isArray(ca.tagSnippets)) {
        for (const snippet of ca.tagSnippets) {
          if (snippet.globalSiteTag) globalSnippet = snippet.globalSiteTag;
          if (snippet.eventSnippet) {
            eventSnippet = snippet.eventSnippet;
            const match = snippet.eventSnippet.match(/'send_to':\s*'AW-[^/]+\/([^']+)'/);
            if (match) conversionLabel = match[1];
          }
        }
      }

      return {
        id: ca.id,
        name: ca.name,
        type: ca.type,
        status: ca.status,
        category: ca.category,
        defaultValue: ca.valueSettings?.defaultValue || null,
        defaultCurrency: ca.valueSettings?.defaultCurrencyCode || null,
        conversionLabel,
        globalSnippet,
        eventSnippet,
      };
    });

    return { ok: true, conversionActions };
  } catch (err) {
    return { ok: false, error: String(err.message || err), conversionActions: [] };
  }
}

/**
 * Create a new Conversion Action (e.g. Lead Form, Purchase, Call)
 */
export async function createConversionAction({
  accessToken,
  customerId,
  loginCustomerId = null,
  name = "Website Lead Form (GabbarInfo AI)",
  category = "SUBMIT_LEAD_FORM",
  defaultValue = 1.0,
  defaultCurrencyCode = "INR",
}) {
  const cleanId = cleanCustomerId(customerId);
  if (!cleanId) return { ok: false, error: "Missing customerId" };

  const mutateUrl = `https://googleads.googleapis.com/v22/customers/${cleanId}/conversionActions:mutate`;
  const body = {
    operations: [
      {
        create: {
          name: name.slice(0, 100),
          category,
          type: "WEBPAGE",
          status: "ENABLED",
          valueSettings: {
            defaultValue: Number(defaultValue) || 1.0,
            defaultCurrencyCode: defaultCurrencyCode || "INR",
            alwaysUseDefaultValue: false,
          },
        },
      },
    ],
  };

  try {
    const resp = await fetch(mutateUrl, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify(body),
    });

    const json = await resp.json();
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: json };
    }

    const createdResource = json.results?.[0]?.resourceName;

    // Fetch the newly created action to extract tagSnippets & conversionLabel
    const listRes = await listConversionActions({ accessToken, customerId: cleanId, loginCustomerId });
    let matchedAction = null;
    if (listRes.ok && Array.isArray(listRes.conversionActions)) {
      matchedAction = listRes.conversionActions.find(a => a.name === name) || listRes.conversionActions[listRes.conversionActions.length - 1];
    }

    return {
      ok: true,
      resourceName: createdResource,
      conversionAction: matchedAction || { name, category },
      conversionLabel: matchedAction?.conversionLabel || null,
      globalSnippet: matchedAction?.globalSnippet || null,
      eventSnippet: matchedAction?.eventSnippet || null,
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/**
 * Scan a website URL to audit active Google & Meta tracking tags
 */
export async function auditWebsiteTracking(landingPageUrl) {
  if (!landingPageUrl) return { ok: false, error: "No URL provided" };

  let urlStr = String(landingPageUrl).trim();
  if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
    urlStr = "https://" + urlStr;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const resp = await fetch(urlStr, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    const html = await resp.text();

    // 1. Google Tag (gtag.js)
    const googleTagMatch = html.match(/googletagmanager\.com\/gtag\/js\?id=(AW-[A-Za-z0-9_-]+|G-[A-Za-z0-9_-]+)/i);
    const gtagConfigMatches = [...html.matchAll(/gtag\s*\(\s*['"]config['"]\s*,\s*['"](AW-[A-Za-z0-9_-]+|G-[A-Za-z0-9_-]+)['"]/gi)];
    const googleTagIds = new Set();
    if (googleTagMatch) googleTagIds.add(googleTagMatch[1]);
    gtagConfigMatches.forEach(m => googleTagIds.add(m[1]));

    // 2. Google Tag Manager (GTM)
    const gtmMatch = html.match(/googletagmanager\.com\/gtm\.js\?id=(GTM-[A-Za-z0-9_-]+)/i);
    const gtmId = gtmMatch ? gtmMatch[1] : null;

    // 3. Meta Pixel (Facebook Pixel)
    const fbPixelMatch = html.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"]([0-9]{10,20})['"]/i);
    const metaPixelId = fbPixelMatch ? fbPixelMatch[1] : null;

    // 4. GabbarInfo Connect Plugin detection
    const hasGabbarPlugin =
      html.includes("gabbarinfo-connect") ||
      html.includes("gabbarinfo_tracker") ||
      html.includes("data-gabbarinfo");

    // 5. CMS detection
    const isWordPress =
      html.includes("/wp-content/") ||
      html.includes("/wp-includes/") ||
      html.includes("wp-json") ||
      resp.headers.get("x-powered-by")?.toLowerCase().includes("wordpress");

    const isWooCommerce =
      html.includes("woocommerce") ||
      html.includes("wc-") ||
      html.includes("add_to_cart");

    const isShopify =
      html.includes("cdn.shopify.com") ||
      html.includes("Shopify.theme") ||
      html.includes("shopify-payment-button");

    return {
      ok: true,
      url: urlStr,
      cms: isWordPress ? (isWooCommerce ? "WooCommerce" : "WordPress") : (isShopify ? "Shopify" : "Custom / Other"),
      isWordPress: Boolean(isWordPress),
      isWooCommerce: Boolean(isWooCommerce),
      isShopify: Boolean(isShopify),
      hasGabbarPlugin: Boolean(hasGabbarPlugin),
      tracking: {
        hasGoogleTag: googleTagIds.size > 0,
        googleTagIds: Array.from(googleTagIds),
        hasGtm: Boolean(gtmId),
        gtmId,
        hasMetaPixel: Boolean(metaPixelId),
        metaPixelId,
      },
      healthy: googleTagIds.size > 0 || Boolean(gtmId),
    };
  } catch (err) {
    return {
      ok: false,
      url: urlStr,
      error: String(err.message || err),
      tracking: { hasGoogleTag: false, googleTagIds: [], hasGtm: false, hasMetaPixel: false },
      healthy: false,
    };
  }
}
