
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
  const accessToken = process.env.META_SYSTEM_USER_TOKEN || meta.fb_user_access_token;
  if (!accessToken) {
    console.error(`[Instagram Organic] Meta access token is missing.`);
    throw new Error("Meta access token unavailable. Please re-connect your account.");
  }

  const API_VERSION = "v21.0";

  // --- STEP 1: Create Media Container ---
  console.log(`[Instagram Organic] Step 1: Creating media container for ID ${instagramId}...`);
  const containerUrl = `https://graph.facebook.com/${API_VERSION}/${instagramId}/media`;

  const containerParams = new URLSearchParams();
  containerParams.append("image_url", imageUrl);
  containerParams.append("caption", caption || "");
  containerParams.append("access_token", accessToken);

  const containerRes = await fetch(containerUrl, {
    method: "POST",
    body: containerParams
  });

  const containerJson = await containerRes.json().catch(() => ({}));
  if (!containerRes.ok) {
    const errorMsg = containerJson.error?.message || `Meta Container Error (Status: ${containerRes.status})`;
    console.error(`[Instagram Organic] Container Creation Failed:`, containerJson);
    throw new Error(`Instagram Media Container Creation Failed: ${errorMsg}`);
  }

  const creationId = containerJson.id;
  if (!creationId) {
    throw new Error("Instagram Media Container ID missing from response.");
  }

  // --- STEP 1.5: Poll for Media Readiness ---
  console.log(`[Instagram Organic] Waiting for media container ${creationId} to be ready...`);
  let attempts = 0;
  const maxAttempts = 10;
  let isReady = false;

  while (attempts < maxAttempts && !isReady) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s between checks

    const statusUrl = `https://graph.facebook.com/${API_VERSION}/${creationId}?fields=status_code&access_token=${accessToken}`;
    const statusRes = await fetch(statusUrl);
    const statusJson = await statusRes.json().catch(() => ({}));

    if (statusJson.status_code === "FINISHED") {
      isReady = true;
      console.log(`[Instagram Organic] Media container ready.`);
    } else if (statusJson.status_code === "ERROR") {
      throw new Error(`Instagram Media Processing Failed: ${JSON.stringify(statusJson)}`);
    } else {
      console.log(`[Instagram Organic] Status: ${statusJson.status_code || "UNKNOWN"}. Waiting... (${attempts}/${maxAttempts})`);
    }
  }

  if (!isReady) {
    throw new Error("Instagram Media Container Timed Out (Not processed in time).");
  }

  // --- STEP 2: Publish Media ---
  console.log(`[Instagram Organic] Step 2: Publishing media (Creation ID: ${creationId})...`);
  const publishUrl = `https://graph.facebook.com/${API_VERSION}/${instagramId}/media_publish`;

  const publishParams = new URLSearchParams();
  publishParams.append("creation_id", creationId);
  publishParams.append("access_token", accessToken);

  const publishRes = await fetch(publishUrl, {
    method: "POST",
    body: publishParams
  });

  const publishJson = await publishRes.json().catch(() => ({}));
  if (!publishRes.ok) {
    const errorMsg = publishJson.error?.message || `Meta Publish Error (Status: ${publishRes.status})`;
    console.error(`[Instagram Organic] Publishing Failed:`, publishJson);
    throw new Error(`Instagram Media Publishing Failed: ${errorMsg}`);
  }

  console.log(`[Instagram Organic] Published successfully! Post ID: ${publishJson.id}`);
  return publishJson;
}
