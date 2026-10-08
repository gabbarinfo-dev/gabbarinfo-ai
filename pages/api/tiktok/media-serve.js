// pages/api/tiktok/media-serve.js
/**
 * Serves media from the verified domain (ai.gabbarinfo.com) for TikTok Content Posting API.
 * TikTok strictly verifies domain ownership for PULL_FROM_URL.
 * This endpoint proxies any media buffer directly as image/jpeg without redirects.
 */

export default async function handler(req, res) {
  const { url, slide = "1" } = req.query;

  try {
    let targetUrl = url;

    // Fallback to local verified static asset if no URL provided
    if (!targetUrl) {
      const slideNum = slide === "2" ? "2" : "1";
      targetUrl = `https://ai.gabbarinfo.com/media/jewellery/slide${slideNum}.jpg`;
    }

    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch media from source: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const contentType = response.headers.get("content-type") || "image/jpeg";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(200).send(buffer);
  } catch (err) {
    console.error("[TikTok Media Serve Error]:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
