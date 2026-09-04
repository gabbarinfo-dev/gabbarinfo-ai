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
 * Create a Search Campaign in PAUSED status in Google Ads
 */
export async function createSearchCampaign({
  accessToken,
  customerId,
  campaignName,
  budgetResourceName,
  startDate = null,
  endDate = null,
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);
  const name = campaignName || `GabbarInfo AI - Search - ${Date.now()}`;

  const campaignOperation = {
    name,
    status: "PAUSED", // 🔒 ALWAYS PAUSED for safety and review
    advertisingChannelType: "SEARCH",
    campaignBudget: budgetResourceName,
    networkSettings: {
      targetGoogleSearch: true,
      targetSearchNetwork: true,
      targetContentNetwork: false,
      targetPartnerSearchNetwork: false,
    },
  };

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

  const url = `https://googleads.googleapis.com/v22/customers/${targetId}/campaigns:mutate`;
  const resp = await fetch(url, {
    method: "POST",
    headers: getHeaders(accessToken, loginCustomerId),
    body: JSON.stringify(payload),
  });

  const json = await resp.json();
  if (!resp.ok) {
    console.error("Google Ads Campaign Creation Error:", json);
    return { ok: false, status: resp.status, error: json };
  }

  const resourceName = json.results?.[0]?.resourceName;
  const campaignId = resourceName ? resourceName.split("/").pop() : null;

  return { ok: true, resourceName, campaignId, name, status: "PAUSED", json };
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
    const text = typeof kw === "string" ? kw : kw.text;
    const matchType = typeof kw === "object" && kw.matchType ? kw.matchType : "BROAD";
    return {
      create: {
        adGroup: adGroupResourceName,
        status: "PAUSED",
        keyword: {
          text,
          matchType,
        },
      },
    };
  });

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
 * Create Sitelinks, Callouts, and Call Assets and attach them to a Campaign
 */
export async function createCampaignAssetsAndLink({
  accessToken,
  customerId,
  campaignResourceName,
  sitelinks = [],
  callouts = [],
  callAsset = null,
  loginCustomerId = null,
}) {
  const targetId = cleanCustomerId(customerId);
  const assetOperations = [];
  const metaLookup = []; // track index to asset type

  // 1. Prepare Sitelink Asset Operations
  if (Array.isArray(sitelinks) && sitelinks.length > 0) {
    sitelinks.slice(0, 6).forEach((s, i) => {
      const linkText = String(s.linkText || s.text || "Learn More").slice(0, 25);
      const desc1 = String(s.description1 || s.desc1 || "High Quality Services").slice(0, 35);
      const desc2 = String(s.description2 || s.desc2 || "Contact Us Today").slice(0, 35);
      const finalUrl = s.finalUrl || s.url || "https://ai.gabbarinfo.com";

      assetOperations.push({
        create: {
          name: `Sitelink - ${linkText} - ${Date.now()}_${i}`,
          sitelinkAsset: {
            linkText,
            description1: desc1,
            description2: desc2,
            finalUrls: [finalUrl],
          },
        },
      });
      metaLookup.push({ fieldType: "SITELINK", label: linkText });
    });
  }

  // 2. Prepare Callout Asset Operations
  if (Array.isArray(callouts) && callouts.length > 0) {
    callouts.slice(0, 8).forEach((c, i) => {
      const rawText = typeof c === "string" ? c : (c.text || c.calloutText || "Trusted Service");
      const calloutText = String(rawText).slice(0, 25);

      assetOperations.push({
        create: {
          name: `Callout - ${calloutText} - ${Date.now()}_${i}`,
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
        name: `Call - ${rawNumber} - ${Date.now()}`,
        callAsset: {
          countryCode: country,
          phoneNumber: rawNumber,
        },
      },
    });
    metaLookup.push({ fieldType: "CALL", label: rawNumber });
  }

  if (assetOperations.length === 0) {
    return { ok: true, linkedAssets: [] };
  }

  try {
    // Step A: Mutate Assets in Google Ads
    const assetUrl = `https://googleads.googleapis.com/v22/customers/${targetId}/assets:mutate`;
    const assetResp = await fetch(assetUrl, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({ operations: assetOperations }),
    });

    const assetJson = await assetResp.json();
    if (!assetResp.ok || !Array.isArray(assetJson.results)) {
      console.warn("Google Ads Assets Mutate Warning:", assetJson);
      return { ok: false, error: assetJson, message: "Could not create assets in Google Ads" };
    }

    // Step B: Link created assets to Campaign
    const linkOperations = [];
    const linkedSummary = [];

    assetJson.results.forEach((res, idx) => {
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

    if (linkOperations.length === 0) {
      return { ok: true, linkedAssets: [] };
    }

    const linkUrl = `https://googleads.googleapis.com/v22/customers/${targetId}/campaignAssets:mutate`;
    const linkResp = await fetch(linkUrl, {
      method: "POST",
      headers: getHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({ operations: linkOperations }),
    });

    const linkJson = await linkResp.json();
    if (!linkResp.ok) {
      console.warn("Google Ads CampaignAssets Link Warning:", linkJson);
      return { ok: false, error: linkJson, message: "Assets created but failed to link to campaign" };
    }

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
  const campaignRes = await createSearchCampaign({
    accessToken,
    customerId: cleanId,
    campaignName: campaign.name || `GabbarInfo Campaign - ${Date.now()}`,
    budgetResourceName: budgetRes.resourceName,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
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

        // Create Responsive Search Ads
        if (Array.isArray(ag.ads) && ag.ads.length > 0) {
          for (const adItem of ag.ads) {
            const headlines = [
              adItem.headline1,
              adItem.headline2,
              adItem.headline3,
              ...(Array.isArray(adItem.headlines) ? adItem.headlines : []),
            ].filter(Boolean);

            const descriptions = [
              adItem.description1,
              adItem.description2,
              ...(Array.isArray(adItem.descriptions) ? adItem.descriptions : []),
            ].filter(Boolean);

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

  // 5) Create and Link Campaign Assets (Sitelinks, Callouts, Call Assets)
  const actualSitelinks = Array.isArray(sitelinks) && sitelinks.length > 0
    ? sitelinks
    : (campaign.sitelinks || []);
  const actualCallouts = Array.isArray(callouts) && callouts.length > 0
    ? callouts
    : (campaign.callouts || []);
  const actualCallAsset = callAsset || campaign.callAsset || null;

  let assetResults = { ok: true, linkedAssets: [] };
  if (actualSitelinks.length > 0 || actualCallouts.length > 0 || actualCallAsset) {
    try {
      assetResults = await createCampaignAssetsAndLink({
        accessToken,
        customerId: cleanId,
        campaignResourceName: campaignRes.resourceName,
        sitelinks: actualSitelinks,
        callouts: actualCallouts,
        callAsset: actualCallAsset,
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
    campaignResourceName: campaignRes.resourceName,
    budgetId: budgetRes.budgetId,
    budgetResourceName: budgetRes.resourceName,
    status: "PAUSED",
    customerId: cleanId,
    adGroups: createdAdGroups,
    assets: assetResults?.linkedAssets || [],
    message: "Google Ads campaign created successfully in PAUSED status.",
  };
}
