// /lib/googleAdsHelper.js
// Helper utilities for calling Google Ads APIs from server-side code (Next.js API routes).
// - Exchanges a refresh token for a short-lived access token.
// - Provides a single helper to call Google Ads REST endpoints with correct headers.
// - Keeps things simple and dependency-free (uses global fetch).
//
// Usage:
// const { callGoogleAdsApi, exchangeRefreshToken } = require("../../lib/googleAdsHelper");
// const resp = await callGoogleAdsApi({ method: "GET", url: "https://googleads.googleapis.com/v18/customers:listAccessibleCustomers", refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN });

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Read required env vars (fall back to null if missing).
 * You may set these in Vercel (recommended) or pass refreshToken to functions directly.
 */
function _env() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
    // This is the long-lived user refresh token you obtained (store in Vercel or Supabase)
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN || null,
    // developer token from your Google Ads manager account (required in header)
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || null,
    // optional login customer id (MCC manager id) - used when making delegated calls
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || null,
  };
}

/**
 * Exchange an OAuth refresh token for a fresh access token.
 * Returns { access_token, expires_in, scope, token_type, expiry_at } or throws an Error.
 *
 * @param {string} refreshToken - refresh token (long-lived). If not provided, uses env.
 */
export async function exchangeRefreshToken(refreshToken) {
  const env = _env();
  const rt = refreshToken || env.refreshToken;
  if (!rt) {
    throw new Error(
      "No Google refresh token provided. Set GOOGLE_ADS_REFRESH_TOKEN in env or pass refreshToken."
    );
  }
  if (!env.clientId || !env.clientSecret) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in environment variables."
    );
  }

  const body = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    refresh_token: rt,
    grant_type: "refresh_token",
  });

  const resp = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = await resp.json();
  if (!resp.ok) {
    const err = new Error(
      `Failed token exchange: ${JSON.stringify(json)}`
    );
    err.response = json;
    throw err;
  }

  const now = Date.now();
  // expires_in is seconds
  const expiryAt = json.expires_in ? now + json.expires_in * 1000 : null;
  return {
    access_token: json.access_token,
    expires_in: json.expires_in,
    scope: json.scope,
    token_type: json.token_type,
    expiry_at: expiryAt,
  };
}

/**
 * Build standard headers for Google Ads API calls.
 * Developer token is required; login-customer-id is optional (MCC/manager).
 *
 * @param {string} accessToken
 * @param {object} opts
 * @param {string} opts.developerToken
 * @param {string} opts.loginCustomerId
 */
export function buildGoogleAdsHeaders(accessToken, opts = {}) {
  const env = _env();
  const developerToken = opts.developerToken || env.developerToken;
  const loginCustomerId = opts.loginCustomerId || env.loginCustomerId;

  if (!developerToken) {
    throw new Error(
      "Missing Google Ads developer token. Set GOOGLE_ADS_DEVELOPER_TOKEN in env or pass developerToken."
    );
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };

  // Optional header used when the call is executed by a manager on behalf of a client
  if (loginCustomerId) {
    headers["login-customer-id"] = String(loginCustomerId);
  }

  return headers;
}

/**
 * Generic helper to call Google Ads REST endpoints.
 *
 * Options:
 * - method (GET/POST/PATCH/DELETE)
 * - url (full URL) OR path (relative path appended to baseUrl)
 * - body (object) - will be JSON.stringified
 * - refreshToken (optional) - to exchange for access token (if omitted uses env)
 * - developerToken (optional)
 * - loginCustomerId (optional)
 *
 * Returns: { ok, status, json } or throws on network-level error.
 */
export async function callGoogleAdsApi(opts = {}) {
  const {
    method = "GET",
    url = null,
    path = null,
    body = null,
    refreshToken = null,
    developerToken = null,
    loginCustomerId = null,
  } = opts;

  if (!url && !path) {
    throw new Error("Either url or path must be provided to callGoogleAdsApi.");
  }

  const finalUrl = url || (path.startsWith("/") ? `https://googleads.googleapis.com${path}` : `https://googleads.googleapis.com/${path}`);

  // 1) Exchange refresh token -> access token
  const tokenInfo = await exchangeRefreshToken(refreshToken);
  const accessToken = tokenInfo.access_token;

  // 2) Build headers
  const headers = buildGoogleAdsHeaders(accessToken, { developerToken, loginCustomerId });

  // 3) Execute fetch
  const fetchOpts = {
    method,
    headers,
  };

  if (body != null && method !== "GET" && method !== "HEAD") {
    fetchOpts.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const resp = await fetch(finalUrl, fetchOpts);
  // try parse JSON (Google returns JSON errors)
  let json;
  try {
    json = await resp.json();
  } catch (e) {
    json = { raw: await resp.text() };
  }

  return {
    ok: resp.ok,
    status: resp.status,
    json,
    tokenInfo,
  };
}

/**
 * Convenience: listAccessibleCustomers helper.
 * Returns the raw response from Google Ads customers:listAccessibleCustomers
 */
export async function listAccessibleCustomers(opts = {}) {
  // URL for listAccessibleCustomers is different (no base path)
  const env = _env();
  const refreshToken = opts.refreshToken || env.refreshToken;
  const developerToken = opts.developerToken || env.developerToken;

  if (!developerToken) {
    throw new Error("Missing GOOGLE_ADS_DEVELOPER_TOKEN in environment.");
  }

  // Exchange token first (so we can build headers)
  const tokenInfo = await exchangeRefreshToken(refreshToken);
  const accessToken = tokenInfo.access_token;

  const headers = buildGoogleAdsHeaders(accessToken, { developerToken, loginCustomerId: opts.loginCustomerId });

  const resp = await fetch("https://googleads.googleapis.com/v18/customers:listAccessibleCustomers", {
    method: "GET",
    headers,
  });

  const json = await resp.json();
  return { ok: resp.ok, status: resp.status, json, tokenInfo };
}

export default {
  exchangeRefreshToken,
  buildGoogleAdsHeaders,
  callGoogleAdsApi,
  listAccessibleCustomers,
};
