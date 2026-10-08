// pages/api/tiktok/media-serve.js
/**
 * Serves media from the verified domain (ai.gabbarinfo.com) for TikTok Content Posting API.
 * TikTok strictly verifies domain ownership for PULL_FROM_URL and requires JPEG.
 * This endpoint converts any image format to pristine JPEG directly without redirects.
 */

import sharp from "sharp";

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
    const rawBuffer = Buffer.from(arrayBuffer);

    // TikTok prefers standardized JPEG for carousel slides
    const jpegBuffer = await sharp(rawBuffer)
      .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
      .toBuffer();

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Length", jpegBuffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(200).send(jpegBuffer);
  } catch (err) {
    console.error("[TikTok Media Serve Error]:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
