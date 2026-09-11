// lib/gmbHelper.js
// Google Business Profile (GMB) REST API Helper
// Handles Account Management, Business Information, Locations, and Performance

import { exchangeRefreshToken } from "./googleAdsHelper";

const GMB_ACCOUNT_MGMT_BASE = "https://mybusinessaccountmanagement.googleapis.com/v1";
const GMB_BUSINESS_INFO_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";
const GMB_PERFORMANCE_BASE = "https://businessprofileperformance.googleapis.com/v1";

/**
 * Exchange refresh token to get a fresh access token
 */
export async function getGmbAccessToken({ refreshToken }) {
  const res = await exchangeRefreshToken({ refreshToken });
  if (!res.ok) {
    return { ok: false, error: res.json?.error || "Failed to exchange token" };
  }
  return { ok: true, accessToken: res.accessToken, scope: res.scope };
}

/**
 * List all Google Business Profile accounts accessible by the user
 */
export async function listGmbAccounts({ accessToken }) {
  try {
    const resp = await fetch(`${GMB_ACCOUNT_MGMT_BASE}/accounts`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const json = await resp.json();
    if (!resp.ok) {
      return { ok: false, status: resp.status, json, error: json.error?.message || "Failed to list accounts" };
    }

    return {
      ok: true,
      status: 200,
      accounts: json.accounts || [],
    };
  } catch (err) {
    return { ok: false, status: 500, error: err.message };
  }
}

/**
 * List all locations under a specific GMB account
 */
export async function listGmbLocations({ accessToken, accountName }) {
  try {
    const readMask = "name,title,storefrontAddress,websiteUri,phoneNumbers,categories,metadata,profile";
    const url = `${GMB_BUSINESS_INFO_BASE}/${accountName}/locations?readMask=${encodeURIComponent(readMask)}&pageSize=50`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const json = await resp.json();
    if (!resp.ok) {
      return { ok: false, status: resp.status, json, error: json.error?.message || "Failed to list locations" };
    }

    return {
      ok: true,
      status: 200,
      locations: json.locations || [],
    };
  } catch (err) {
    return { ok: false, status: 500, error: err.message };
  }
}

/**
 * Create a new Google Business Profile Location
 */
export async function createGmbLocation({ accessToken, accountName, locationData }) {
  try {
    const payload = {
      title: locationData.title || locationData.businessName,
      primaryCategory: {
        name: locationData.categoryName || "categories/gcid:digital_marketing_agency",
      },
      storefrontAddress: {
        regionCode: locationData.regionCode || "IN",
        postalCode: locationData.postalCode || "",
        locality: locationData.locality || locationData.city || "",
        administrativeArea: locationData.state || "",
        addressLines: Array.isArray(locationData.addressLines)
          ? locationData.addressLines
          : [locationData.address || ""].filter(Boolean),
      },
      websiteUri: locationData.websiteUri || locationData.website || "",
      phoneNumbers: {
        primaryPhone: locationData.phoneNumber || locationData.phone || "",
      },
    };

    const resp = await fetch(`${GMB_BUSINESS_INFO_BASE}/${accountName}/locations?validateOnly=false`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await resp.json();
    if (!resp.ok) {
      return { ok: false, status: resp.status, json, error: json.error?.message || "Failed to create location" };
    }

    return {
      ok: true,
      status: resp.status,
      location: json,
    };
  } catch (err) {
    return { ok: false, status: 500, error: err.message };
  }
}

/**
 * Fetch daily performance metrics for a location (Search & Maps impressions, calls)
 */
export async function getGmbLocationPerformance({ accessToken, locationName }) {
  try {
    // Last 30 days time range
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDate = {
      year: thirtyDaysAgo.getFullYear(),
      month: thirtyDaysAgo.getMonth() + 1,
      day: thirtyDaysAgo.getDate(),
    };
    const endDate = {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };

    const metrics = [
      "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
      "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
      "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
      "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
      "CALL_CLICKS",
      "WEBSITE_CLICKS",
    ];

    const queryParams = new URLSearchParams();
    metrics.forEach((m) => queryParams.append("dailyMetric", m));
    queryParams.append("dailyRange.startDate.year", startDate.year);
    queryParams.append("dailyRange.startDate.month", startDate.month);
    queryParams.append("dailyRange.startDate.day", startDate.day);
    queryParams.append("dailyRange.endDate.year", endDate.year);
    queryParams.append("dailyRange.endDate.month", endDate.month);
    queryParams.append("dailyRange.endDate.day", endDate.day);

    const url = `${GMB_PERFORMANCE_BASE}/${locationName}:getDailyMetricsTimeSeries?${queryParams.toString()}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const json = await resp.json();
    if (!resp.ok) {
      return { ok: false, status: resp.status, json, error: json.error?.message || "Failed to fetch metrics" };
    }

    return {
      ok: true,
      status: 200,
      timeSeries: json.timeSeries || [],
    };
  } catch (err) {
    return { ok: false, status: 500, error: err.message };
  }
}
