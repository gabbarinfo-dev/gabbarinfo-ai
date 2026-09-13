// lib/wordpress/media-bridge.js
import { supabaseServer } from "../supabaseServer";

/**
 * Get active WordPress pairing credentials for a business
 */
export async function getMediaBridgeConfig(businessName = "default", userEmail = "ndantare@gmail.com") {
  const normalizedBusiness = (businessName || "default")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "_");

  // 1. Lookup specific business pairing
  if (userEmail) {
    const { data: mem } = await supabaseServer
      .from("agent_memory")
      .select("content")
      .eq("email", userEmail)
      .eq("memory_type", `wp_conn_${normalizedBusiness}`)
      .maybeSingle();

    if (mem?.content) {
      try {
        const parsed = JSON.parse(mem.content);
        if (parsed?.siteUrl && parsed?.apiKey) {
          return {
            siteUrl: parsed.siteUrl.replace(/\/+$/, ""),
            apiKey: parsed.apiKey,
          };
        }
      } catch (e) {}
    }

    // 2. Fallback: search any existing wp_conn for this user
    const { data: anyMem } = await supabaseServer
      .from("agent_memory")
      .select("content")
      .eq("email", userEmail)
      .like("memory_type", "wp_conn_%")
      .limit(1);

    if (anyMem?.[0]?.content) {
      try {
        const parsed = JSON.parse(anyMem[0].content);
        if (parsed?.siteUrl && parsed?.apiKey) {
          return {
            siteUrl: parsed.siteUrl.replace(/\/+$/, ""),
            apiKey: parsed.apiKey,
          };
        }
      } catch (e) {}
    }
  }

  // 3. Hard fallback: Primary verified WordPress domain
  return {
    siteUrl: "https://www.gabbarinfo.com",
    apiKey: process.env.WORDPRESS_API_KEY || "gb_6XvSNZPT9h4aV2s2P0x1uUuP",
  };
}

/**
 * Upload a file (Buffer, Base64 string, or remote URL) to the hosting Ephemeral Media Bridge
 * @param {Object} options
 * @param {string} [options.filename]
 * @param {Buffer|string} [options.buffer]
 * @param {string} [options.base64]
 * @param {string} [options.sourceUrl]
 * @param {string} [options.businessName]
 * @param {string} [options.userEmail]
 */
export async function uploadToMediaBridge({
  filename,
  buffer,
  base64,
  sourceUrl,
  businessName,
  userEmail,
}) {
  const config = await getMediaBridgeConfig(businessName, userEmail);
  const endpoint = `${config.siteUrl}/wp-json/gabbarinfo/v1/media-bridge/upload?api_key=${encodeURIComponent(config.apiKey)}`;

  let payload = {};
  if (buffer) {
    payload = {
      filename: filename || `asset_${Date.now()}.bin`,
      content_base64: Buffer.isBuffer(buffer) ? buffer.toString("base64") : buffer,
    };
  } else if (base64) {
    payload = {
      filename: filename || `asset_${Date.now()}.bin`,
      content_base64: base64,
    };
  } else if (sourceUrl) {
    payload = {
      filename: filename || `remote_${Date.now()}.bin`,
      source_url: sourceUrl,
    };
  } else {
    throw new Error("No buffer, base64, or sourceUrl provided to uploadToMediaBridge");
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.message || `Media Bridge upload failed with status ${res.status}`);
  }

  return {
    url: data.url,
    fileName: data.file_name,
    size: data.size,
  };
}

/**
 * Immediately purge one or multiple files from the hosting Ephemeral Media Bridge upon publish
 * @param {Object} options
 * @param {string[]} [options.files]
 * @param {string} [options.file]
 * @param {string[]} [options.urls]
 * @param {string} [options.url]
 * @param {string} [options.businessName]
 * @param {string} [options.userEmail]
 */
export async function purgeFromMediaBridge({
  files,
  file,
  urls,
  url,
  businessName,
  userEmail,
}) {
  try {
    const config = await getMediaBridgeConfig(businessName, userEmail);
    const endpoint = `${config.siteUrl}/wp-json/gabbarinfo/v1/media-bridge/purge?api_key=${encodeURIComponent(config.apiKey)}`;

    const fileList = [];
    if (Array.isArray(files)) fileList.push(...files);
    if (file) fileList.push(file);
    if (Array.isArray(urls)) fileList.push(...urls);
    if (url) fileList.push(url);

    if (fileList.length === 0) return { ok: true, count: 0 };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: fileList }),
    });

    const data = await res.json().catch(() => ({}));
    return data;
  } catch (err) {
    console.error("Purge from media bridge error:", err);
    return { ok: false, error: err.message };
  }
}
