// lib/meta/brand-verifier.js
/**
 * Brand Security & Anti-Exploitation Verifier
 * Prevents cross-business contamination and unauthorized multi-tenant social syndication
 * by verifying that connected Meta (Facebook/Instagram) assets actually match the active store/website.
 */

// In-memory cache for Meta asset profiles (TTL: 10 minutes)
const metaIdentityCache = new Map();

export function normalizeBrand(str = "") {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\.(com|co\.uk|org|net|in|io|ai|store|shop|myshopify\.com)(\/.*)?$/, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Fetch public profile details (Page Name, Website, IG Username) for a Meta connection
 */
export async function getMetaIdentity(metaConnection) {
  if (!metaConnection) return null;

  const pageId = metaConnection.fb_page_id ? metaConnection.fb_page_id.split(",")[0].trim() : null;
  const igId = metaConnection.ig_business_id || null;
  const token = metaConnection.fb_page_access_token || metaConnection.fb_user_access_token;

  if (!token || (!pageId && !igId)) {
    return null;
  }

  const cacheKey = `${pageId || ""}_${igId || ""}`;
  const cached = metaIdentityCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached.data;
  }

  let pageName = null;
  let pageWebsite = null;
  let pageCategory = null;
  let igUsername = null;
  let igName = null;
  let igWebsite = null;

  const API_VERSION = "v21.0";

  // 1. Fetch Facebook Page Details
  if (pageId) {
    try {
      const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${pageId}?fields=name,website,category&access_token=${token}`);
      if (res.ok) {
        const pData = await res.json();
        pageName = pData.name || null;
        pageWebsite = pData.website || null;
        pageCategory = pData.category || null;
      }
    } catch (e) {
      console.warn("[BrandVerifier] Failed to fetch Facebook Page identity:", e.message);
    }
  }

  // 2. Fetch Instagram Account Details
  if (igId) {
    try {
      const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${igId}?fields=name,username,website&access_token=${token}`);
      if (res.ok) {
        const igData = await res.json();
        igUsername = igData.username || null;
        igName = igData.name || null;
        igWebsite = igData.website || null;
      }
    } catch (e) {
      console.warn("[BrandVerifier] Failed to fetch Instagram identity:", e.message);
    }
  }

  const result = {
    pageId,
    pageName,
    pageWebsite,
    pageCategory,
    igId,
    igUsername,
    igName,
    igWebsite,
  };

  metaIdentityCache.set(cacheKey, { timestamp: Date.now(), data: result });
  return result;
}

/**
 * Validates whether a store identity matches a Meta asset identity.
 */
export function checkBrandMatch({
  storeName = "",
  storeDomain = "",
  shopHandle = "",
  metaIdentity = null,
}) {
  if (!metaIdentity || (!metaIdentity.pageName && !metaIdentity.igUsername && !metaIdentity.pageWebsite)) {
    return {
      isMatched: false,
      status: "NO_SOCIAL_CONNECTED",
      reason: "No active Facebook Page or Instagram Business profile linked to this account.",
      store: { name: storeName, domain: storeDomain, shopHandle },
      meta: null,
    };
  }

  const normStoreDomain = normalizeBrand(storeDomain);
  const normStoreName = normalizeBrand(storeName);
  const normShopHandle = normalizeBrand(shopHandle);

  const normMetaPageName = normalizeBrand(metaIdentity.pageName);
  const normMetaWebsite = normalizeBrand(metaIdentity.pageWebsite || metaIdentity.igWebsite);
  const normMetaIg = normalizeBrand(metaIdentity.igUsername);
  const normMetaIgName = normalizeBrand(metaIdentity.igName);

  const storeTokens = [normStoreDomain, normStoreName, normShopHandle].filter((t) => t && t.length >= 3);
  const metaTokens = [normMetaPageName, normMetaWebsite, normMetaIg, normMetaIgName].filter((t) => t && t.length >= 3);

  let isMatched = false;
  let matchDetail = null;

  for (const s of storeTokens) {
    for (const m of metaTokens) {
      // Direct exact match
      if (s === m) {
        isMatched = true;
        matchDetail = `Direct match: '${s}' matches '${m}'`;
        break;
      }
      // Substring match for compound names (min 4 chars)
      if (s.length >= 4 && m.length >= 4) {
        if (s.includes(m) || m.includes(s)) {
          isMatched = true;
          matchDetail = `Token match: '${s}' related to '${m}'`;
          break;
        }
      }
    }
    if (isMatched) break;
  }

  const metaDisplay = metaIdentity.igUsername
    ? `@${metaIdentity.igUsername}${metaIdentity.pageName ? ` (${metaIdentity.pageName})` : ""}`
    : metaIdentity.pageName || "Connected Meta Channel";

  if (!isMatched) {
    return {
      isMatched: false,
      status: "MISMATCH",
      matchDetail: null,
      reason: `Anti-Exploitation Guard: Connected social channel '${metaDisplay}' belongs to a different business and does not match '${storeName || storeDomain}'.`,
      store: {
        name: storeName || "Shopify Store",
        domain: storeDomain || shopHandle || "store",
      },
      meta: {
        display: metaDisplay,
        pageName: metaIdentity.pageName,
        igUsername: metaIdentity.igUsername,
        website: metaIdentity.pageWebsite || metaIdentity.igWebsite,
      },
    };
  }

  return {
    isMatched: true,
    status: "MATCHED",
    matchDetail,
    reason: `Verified brand alignment between store '${storeName}' and social channel '${metaDisplay}'.`,
    store: {
      name: storeName,
      domain: storeDomain,
    },
    meta: {
      display: metaDisplay,
      pageName: metaIdentity.pageName,
      igUsername: metaIdentity.igUsername,
      website: metaIdentity.pageWebsite || metaIdentity.igWebsite,
    },
  };
}
