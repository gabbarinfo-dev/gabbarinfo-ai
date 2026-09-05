// lib/execute-facebook-post.js
import { supabaseServer } from "./supabaseServer";

/**
 * Execute a Facebook Page post publishing via Meta Graph API.
 * 
 * @param {Object} params
 * @param {string} params.userEmail - User's email to fetch Meta connection
 * @param {string} params.imageUrl - Publicly accessible URL of the image
 * @param {string} params.caption - The post caption/message
 * @param {string} [params.targetPageId] - Optional specific page ID override
 */
export async function executeFacebookPost({ userEmail, imageUrl, caption, targetPageId = null }) {
  if (!userEmail) throw new Error("userEmail is required for Facebook publishing.");
  if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
    throw new Error("Facebook image must be a publicly accessible URL (http/https).");
  }

  console.log(`[Facebook Organic] Starting publish for ${userEmail}...`);

  // 1. Fetch Meta Connection data from Supabase
  const { data: meta, error } = await supabaseServer
    .from("meta_connections")
    .select("fb_page_id, fb_page_access_token, fb_user_access_token")
    .eq("email", userEmail.toLowerCase())
    .single();

  if (error || !meta) {
    console.error(`[Facebook Organic] Error fetching meta connection:`, error);
    throw new Error("Meta connection not found. Please connect your Facebook account in the dashboard.");
  }

  const userToken = meta.fb_user_access_token || process.env.META_SYSTEM_USER_TOKEN;
  if (!userToken) {
    throw new Error("Facebook user access token unavailable. Please re-connect your Facebook account in the dashboard.");
  }

  // 2. Resolve Page ID
  const pageId = targetPageId || (meta.fb_page_id ? meta.fb_page_id.split(",")[0].trim() : null);
  if (!pageId) {
    throw new Error("No Facebook Page ID linked to your account. Please connect a Facebook Page in the dashboard.");
  }

  const API_VERSION = "v21.0";

  // 3. Resolve Page Access Token
  // Priority A: Stored fb_page_access_token
  let pageAccessToken = meta.fb_page_access_token;

  // Priority B: Fetch from /me/accounts
  if (!pageAccessToken) {
    try {
      const accountsResp = await fetch(`https://graph.facebook.com/${API_VERSION}/me/accounts?access_token=${encodeURIComponent(userToken)}`);
      const accountsJson = await accountsResp.json();

      if (accountsJson?.data && Array.isArray(accountsJson.data)) {
        const matchedPage = accountsJson.data.find(p => String(p.id) === String(pageId));
        if (matchedPage?.access_token) {
          pageAccessToken = matchedPage.access_token;
          console.log(`[Facebook Organic] Resolved Page Access Token from /me/accounts for page ${matchedPage.name || pageId}`);
        }
      }
    } catch (accErr) {
      console.warn(`[Facebook Organic] /me/accounts query failed:`, accErr.message);
    }
  }

  // Priority C: Direct Page Token lookup via /{page_id}?fields=access_token
  if (!pageAccessToken) {
    try {
      const pageTokenResp = await fetch(`https://graph.facebook.com/${API_VERSION}/${pageId}?fields=access_token&access_token=${encodeURIComponent(userToken)}`);
      const pageTokenJson = await pageTokenResp.json();
      if (pageTokenJson?.access_token) {
        pageAccessToken = pageTokenJson.access_token;
        console.log(`[Facebook Organic] Resolved Page Access Token from /{page_id}?fields=access_token`);
      }
    } catch (ptErr) {
      console.warn(`[Facebook Organic] Direct page token fetch failed:`, ptErr.message);
    }
  }

  // Fallback to user token if page token could not be resolved
  const tokenToUse = pageAccessToken || userToken;

  // 4. Publish Photo to /{page_id}/photos
  const publishUrl = `https://graph.facebook.com/${API_VERSION}/${pageId}/photos`;
  console.log(`[Facebook Organic] Calling Page Publish URL: ${publishUrl}`);

  const params = new URLSearchParams();
  params.append("url", imageUrl);
  params.append("message", caption || "");
  params.append("access_token", tokenToUse);

  const res = await fetch(publishUrl, {
    method: "POST",
    body: params,
  });

  const json = await res.json().catch(() => ({}));
  console.log(`[Facebook Organic] Response:`, json);

  if (!res.ok) {
    const errorMsg = json.error?.message || `Meta Page Publish Error (Status: ${res.status})`;
    console.error(`[Facebook Organic] Publishing Failed:`, json);

    if (json.error?.code === 200) {
      throw new Error(
        `Permissions Error (#200): Your Facebook connection token lacks 'pages_manage_posts' authorization. Since you just added this permission in your Meta App, please go to the dashboard, click 'Disconnect Facebook', and then 'Connect Facebook' to re-authorize with the new publishing permission.`
      );
    }

    throw new Error(`Facebook Page Publishing Failed: ${errorMsg}`);
  }

  const postId = json.post_id || json.id;

  return {
    ok: true,
    pageId,
    photoId: json.id,
    postId,
    postUrl: postId ? `https://www.facebook.com/${postId}` : `https://www.facebook.com/${pageId}`,
    responseJson: json,
  };
}
