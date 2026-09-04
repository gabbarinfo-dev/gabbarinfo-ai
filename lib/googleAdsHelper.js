// lib/googleAdsHelper.js
// Multi-user Google Ads API Helper (REST API v18)
// Handles OAuth access token exchange, customer account discovery,
// and safe campaign creation in PAUSED status.

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
        targetSearchNetwork: true,
        targetContentNetwork: false,
        targetPartnerSearchNetwork: false,
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
          type: "SEARCH_STANDARD",
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

  // Normalize headlines (at least 3 recommended)
  const formattedHeadlines = (headlines.length > 0 ? headlines : [
    "Expert Services",
    "Book An Appointment",
    "Contact Us Today"
  ]).slice(0, 15).map((h) => ({
    text: typeof h === "string" ? h.slice(0, 30) : (h.text || "Expert Services").slice(0, 30),
  }));

  // Normalize descriptions (at least 2 recommended)
  const formattedDescriptions = (descriptions.length > 0 ? descriptions : [
    "Trusted professionals dedicated to top quality service.",
    "Call or visit our website to get started today."
  ]).slice(0, 4).map((d) => ({
    text: typeof d === "string" ? d.slice(0, 90) : (d.text || "Trusted service provider.").slice(0, 90),
  }));

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
export async function getAccountImageAssets({ accessToken, customerId, loginCustomerId = null }) {
  const targetId = cleanCustomerId(customerId);
  try {
    const query = `
      SELECT
        asset.resource_name,
        asset.id,
        asset.name,
        asset.type
      FROM asset
      WHERE asset.type = 'IMAGE'
      LIMIT 10
    `;
    const url = `https://googleads.googleapis.com/v22/customers/${targetId}/googleAds:search`;
    const resp = await fetch(url, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({ query }),
    });
    const json = await resp.json();
    return (json.results || []).map((r) => r.asset.resourceName);
  } catch (err) {
    console.warn("getAccountImageAssets warning:", err.message);
    return [];
  }
}

/**
 * Automatically resolve Logo and Images from:
 * 1. Existing Google Ads account Asset Library
 * 2. Landing page website scraping (apple-touch-icon, favicon, og:image)
 */
export async function resolveCampaignImagesAndLogo({
  accessToken,
  customerId,
  landingPageUrl,
  businessName,
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);
  const imagesToLink = [];
  let logoToLink = null;

  // 1. Try to discover existing IMAGE assets in the Google Ads account
  try {
    const existingAssets = await getAccountImageAssets({ accessToken, customerId: targetId, loginCustomerId });
    if (existingAssets.length > 0) {
      console.log(`Discovered ${existingAssets.length} existing image assets in account ${targetId}`);
      logoToLink = existingAssets[0];
      if (existingAssets.length > 1) {
        imagesToLink.push(...existingAssets.slice(1, 3));
      }
      return { images: imagesToLink, logo: logoToLink };
    }
  } catch (err) {
    console.warn("Error discovering account image assets:", err.message);
  }

  // 2. Scrape logo and images from landing page URL
  if (landingPageUrl && (landingPageUrl.startsWith("http://") || landingPageUrl.startsWith("https://"))) {
    try {
      const siteResp = await fetch(landingPageUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      if (siteResp.ok) {
        const html = await siteResp.text();

        // Extract apple-touch-icon or favicon for logo
        const iconMatch =
          html.match(/<link[^>]+(?:rel=["'](?:apple-touch-icon|icon|shortcut icon)["'])[^>]+href=["']([^"']+)["']/i) ||
          html.match(/<link[^>]+href=["']([^"']+)["'][^>]+(?:rel=["'](?:apple-touch-icon|icon|shortcut icon)["'])/i);

        // Extract og:image for primary visual extension
        const ogImageMatch =
          html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

        const resolveUrl = (base, relative) => {
          try {
            return new URL(relative, base).toString();
          } catch (_) {
            return relative;
          }
        };

        const candidateLogoUrl = iconMatch ? resolveUrl(landingPageUrl, iconMatch[1]) : null;
        const candidateImageUrl = ogImageMatch ? resolveUrl(landingPageUrl, ogImageMatch[1]) : null;

        if (candidateLogoUrl) {
          const logoB64 = await fetchImageAsBase64(candidateLogoUrl);
          if (logoB64) {
            logoToLink = {
              base64: logoB64,
              name: `Logo - ${businessName || "Brand"} - ${Date.now()}`,
            };
          }
        }

        if (candidateImageUrl) {
          const imgB64 = await fetchImageAsBase64(candidateImageUrl);
          if (imgB64) {
            imagesToLink.push({
              base64: imgB64,
              name: `Image - ${businessName || "Visual"} - ${Date.now()}`,
            });
          }
        }
      }
    } catch (scrapErr) {
      console.warn("Error scraping site for images:", scrapErr.message);
    }
  }

  return { images: imagesToLink, logo: logoToLink };
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
 * Create Sitelinks, Callouts, Call Assets, Business Name, Images, and Logo and attach them to a Campaign
 */
export async function createCampaignAssetsAndLink({
  accessToken,
  customerId,
  campaignResourceName,
  sitelinks = [],
  callouts = [],
  callAsset = null,
  businessName = null,
  images = [],
  logo = null,
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
      const linkText = String(s.linkText || s.text || "").trim().slice(0, 25);
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

      const desc1 = String(s.description1 || s.desc1 || "").trim().slice(0, 35);
      const desc2 = String(s.description2 || s.desc2 || "").trim().slice(0, 35);

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
      const calloutText = String(rawText).slice(0, 25);

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
    const cleanBusinessName = String(businessName).trim().slice(0, 25);
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

  // 5. Prepare Image Assets
  if (Array.isArray(images) && images.length > 0) {
    images.forEach((img, idx) => {
      if (typeof img === "string" && img.startsWith("customers/")) {
        directLinkOperations.push({
          create: {
            campaign: campaignResourceName,
            asset: img,
            fieldType: "IMAGE",
            status: "ENABLED",
          },
        });
        linkedSummary.push({ resourceName: img, fieldType: "IMAGE", label: `Image ${idx + 1}` });
      } else {
        const b64 = typeof img === "string" ? img : (img?.base64 || img?.data || null);
        if (b64) {
          assetOperations.push({
            create: {
              name: `Image_${Date.now()}_${idx}`,
              type: "IMAGE",
              imageAsset: {
                data: b64,
              },
            },
          });
          metaLookup.push({ fieldType: "IMAGE", label: `Image ${idx + 1}` });
        }
      }
    });
  }

  // 6. Prepare Business Logo Asset
  if (logo) {
    if (typeof logo === "string" && logo.startsWith("customers/")) {
      directLinkOperations.push({
        create: {
          campaign: campaignResourceName,
          asset: logo,
          fieldType: "LOGO",
          status: "ENABLED",
        },
      });
      linkedSummary.push({ resourceName: logo, fieldType: "LOGO", label: "Business Logo" });
    } else {
      const logoB64 = typeof logo === "string" ? logo : (logo?.base64 || logo?.data || null);
      if (logoB64) {
        assetOperations.push({
          create: {
            name: `Logo_${Date.now()}`,
            type: "IMAGE",
            imageAsset: {
              data: logoB64,
            },
          },
        });
        metaLookup.push({ fieldType: "LOGO", label: "Business Logo" });
      }
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
 * End-to-end Waterfall to create Budget -> Search Campaign -> Ad Groups -> Keywords -> RSA Ads in PAUSED status
 */
export async function createFullGoogleAdsCampaign({
  refreshToken,
  customerId,
  campaign = {},
  adGroups = [],
  sitelinks = [],
  callouts = [],
  callAsset = null,
  businessName = null,
  negativeKeywords = [],
  biddingStrategy = null,
  loginCustomerId = null,
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

  // 3) Create Campaign (forced PAUSED)
  const actualBiddingStrategy = biddingStrategy || campaign.biddingStrategy || "MAXIMIZE_CONVERSIONS";
  const campaignRes = await createSearchCampaign({
    accessToken,
    customerId: cleanId,
    campaignName: campaign.name || `GabbarInfo Campaign - ${Date.now()}`,
    budgetResourceName: budgetRes.resourceName,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    biddingStrategy: actualBiddingStrategy,
    loginCustomerId,
  });

  if (!campaignRes.ok) {
    return {
      ok: false,
      step: "create_campaign",
      message: "Failed to create search campaign in Google Ads",
      error: campaignRes.error,
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

  // 3c) Apply Campaign Negative Keywords (Waste-Spend Protection)
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

  // 4) Optionally create Ad Groups, RSA Ads, and Keywords
  if (Array.isArray(adGroups) && adGroups.length > 0) {
    for (const ag of adGroups) {
      const agRes = await createAdGroup({
        accessToken,
        customerId: cleanId,
        campaignResourceName: campaignRes.resourceName,
        name: ag.name,
        cpcBidMicros: ag.cpcBidMicros || 20000000,
        loginCustomerId,
      });

      if (agRes.ok) {
        const agResource = agRes.resourceName;

        // Create Keywords
        if (Array.isArray(ag.keywords) && ag.keywords.length > 0) {
          await createAdGroupKeywords({
            accessToken,
            customerId: cleanId,
            adGroupResourceName: agResource,
            keywords: ag.keywords,
            loginCustomerId,
          });
        }

        // Create Responsive Search Ads (extract up to 15 headlines and 4 descriptions)
        if (Array.isArray(ag.ads) && ag.ads.length > 0) {
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

  // 5) Auto-resolve or collect images and logo
  let resolvedImages = Array.isArray(campaign.images) ? campaign.images : [];
  let resolvedLogo = campaign.logo || null;

  if (resolvedImages.length === 0 && !resolvedLogo) {
    try {
      const imgRes = await resolveCampaignImagesAndLogo({
        accessToken,
        customerId: cleanId,
        landingPageUrl: campaign.finalUrl,
        businessName: actualBusinessName,
        loginCustomerId,
      });
      resolvedImages = imgRes.images || [];
      resolvedLogo = imgRes.logo || null;
    } catch (imgErr) {
      console.warn("resolveCampaignImagesAndLogo non-fatal warning:", imgErr.message);
    }
  }

  // 6) Create and Link Campaign Assets (Sitelinks, Callouts, Call Assets, Business Name, Images, Logo)
  let assetResults = { ok: true, linkedAssets: [] };
  if (
    actualSitelinks.length > 0 ||
    actualCallouts.length > 0 ||
    actualCallAsset ||
    actualBusinessName ||
    resolvedImages.length > 0 ||
    resolvedLogo
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
        images: resolvedImages,
        logo: resolvedLogo,
        loginCustomerId,
      });
    } catch (assetErr) {
      console.warn("Campaign assets creation non-fatal warning:", assetErr);
    }
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
    customerId: cleanId,
    adGroups: createdAdGroups,
    negativeKeywordsCount: actualNegativeKeywords.length,
    assets: assetResults?.linkedAssets || [],
    message: "Google Ads campaign created successfully in PAUSED status.",
  };
}
