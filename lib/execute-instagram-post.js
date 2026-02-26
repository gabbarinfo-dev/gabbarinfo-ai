// lib/execute-instagram-post.js
import { supabaseServer } from "./supabaseServer";

/**
 * Execute an organic Instagram post publishing.
 * This follows the Meta Graph API two-step publishing flow.
 * 
 * @param {Object} params
 * @param {string} params.userEmail - User's email to fetch Meta connection
 * @param {string} params.imageUrl - Publicly accessible URL of the image
 * @param {string} params.caption - The post caption
 */
export async function executeInstagramPost({ userEmail, imageUrl, caption }) {
  if (!userEmail) throw new Error("userEmail is required for Instagram publishing.");
  if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
    throw new Error(
      "Instagram image must be a publicly accessible URL (http/https)."
    );
  }

  console.log(`[Instagram Organic] Starting publish for ${userEmail}...`);

  // 1. Fetch Meta Connection data from Supabase
  const { data: meta, error } = await supabaseServer
    .from("meta_connections")
    .select("instagram_actor_id, ig_business_id, fb_user_access_token")
    .eq("email", userEmail.toLowerCase())
    .single();

  if (error || !meta) {
    console.error(`[Instagram Organic] Error fetching meta connection:`, error);
    throw new Error("Meta connection not found. Please connect your Facebook/Instagram account in the dashboard.");
  }

  // 2. Resolve Instagram ID (instagram_actor_id > ig_business_id)
  const instagramId = meta.instagram_actor_id || meta.ig_business_id;
  if (!instagramId) {
    console.error(`[Instagram Organic] Both instagram_actor_id and ig_business_id are missing.`);
    throw new Error("Instagram Publishing ID not found. Please re-sync your business assets in the dashboard.");
  }

  // 3. Resolve Access Token (System User Token > fb_user_access_token)
  const accessToken = meta.fb_user_access_token;
  if (!accessToken) {
    console.error(`[Instagram Organic] Meta access token is missing.`);
    throw new Error("Meta access token unavailable. Please re-connect your account.");
  }

  const API_VERSION = "v21.0";

  // --- STEP 1: Create Media Container ---
  const containerUrl = `https://graph.facebook.com/${API_VERSION}/${instagramId}/media`;
  console.log("IG GRAPH CALL → MEDIA:", containerUrl);
  const containerParams = new URLSearchParams();
  containerParams.append("image_url", imageUrl);
  containerParams.append("caption", caption || "");
  containerParams.append("access_token", accessToken);

  const containerRes = await fetch(containerUrl, {
    method: "POST",
    body: containerParams
  });

  const containerJson = await containerRes.json().catch(() => ({}));
  console.log("IG GRAPH RESPONSE → MEDIA:", containerJson);
  if (!containerRes.ok) {
    const errorMsg = containerJson.error?.message || `Meta Container Error (Status: ${containerRes.status})`;
    console.error(`[Instagram Organic] Container Creation Failed:`, containerJson);
    throw new Error(`Instagram Media Container Creation Failed: ${errorMsg}`);
  }

  const creationId = containerJson.id;
  if (!creationId) {
    throw new Error("Instagram Media Container ID missing from response.");
  }

  // Optional readiness check to reduce "Media ID is not available" errors
  try {
    const statusUrl = `https://graph.facebook.com/${API_VERSION}/${creationId}?fields=status_code&access_token=${accessToken}`;
    for (let i = 0; i < 3; i++) {
      const statusRes = await fetch(statusUrl);
      const statusJson = await statusRes.json().catch(() => ({}));
      const status = statusJson.status_code;
      console.log(`[Instagram Organic] Container Status Check ${i + 1}:`, status);
      if (status === "FINISHED" || status === "PUBLISHED") {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (e) {
    console.warn("[Instagram Organic] Container readiness check failed:", e.message);
  }

  // --- STEP 2: Publish Media ---
  const publishUrl = `https://graph.facebook.com/${API_VERSION}/${instagramId}/media_publish`;
  console.log("IG GRAPH CALL → PUBLISH:", publishUrl);

  const publishParams = new URLSearchParams();
  publishParams.append("creation_id", creationId);
  publishParams.append("access_token", accessToken);

  const publishRes = await fetch(publishUrl, {
    method: "POST",
    body: publishParams
  });

  const publishJson = await publishRes.json().catch(() => ({}));
  console.log("IG GRAPH RESPONSE → PUBLISH:", publishJson);
  if (!publishRes.ok) {
    const errorMsg = publishJson.error?.message || `Meta Publish Error (Status: ${publishRes.status})`;
    console.error(`[Instagram Organic] Publishing Failed:`, publishJson);
    throw new Error(`Instagram Media Publishing Failed: ${errorMsg}`);
  }

  console.log(`[Instagram Organic] Published successfully! Post ID: ${publishJson.id}`);
  return {
    mediaResponseJson: containerJson,
    publishResponseJson: publishJson
  };
}
