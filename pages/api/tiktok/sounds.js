// pages/api/tiktok/sounds.js
import https from "https";
import { DEFAULT_TRENDING_SONGS } from "../../lib/tiktok/sounds-catalog.js";

export { DEFAULT_TRENDING_SONGS };

async function searchITunes(query, limit = 25) {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(query.trim());
    const url = `https://itunes.apple.com/search?term=${encoded}&entity=song&limit=${limit}`;

    const req = https.get(url, { family: 4, timeout: 6000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          const results = Array.isArray(parsed.results) ? parsed.results : [];
          const songs = results
            .filter((r) => r.trackName && r.previewUrl)
            .map((r) => ({
              id: `tt_${r.trackId}`,
              title: r.trackName,
              artist: r.artistName || "Unknown Artist",
              cover: r.artworkUrl100 || r.artworkUrl60 || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&q=80",
              previewUrl: r.previewUrl,
              duration: r.trackTimeMillis ? formatDuration(r.trackTimeMillis) : "00:30",
              tag: "Live Search",
              category: "search",
            }));
          resolve(songs);
        } catch (e) {
          resolve([]);
        }
      });
    });

    req.on("error", () => resolve([]));
    req.on("timeout", () => {
      req.destroy();
      resolve([]);
    });
  });
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { q } = req.query || {};

  // If search query provided, search live via iTunes
  if (q && String(q).trim().length > 0) {
    try {
      const results = await searchITunes(String(q), 25);
      return res.status(200).json({
        ok: true,
        query: q,
        count: results.length,
        songs: results,
      });
    } catch (err) {
      return res.status(200).json({
        ok: true,
        query: q,
        count: 0,
        songs: [],
        error: err.message,
      });
    }
  }

  // Default: Return the top TikTok trending catalog
  return res.status(200).json({
    ok: true,
    count: DEFAULT_TRENDING_SONGS.length,
    songs: DEFAULT_TRENDING_SONGS,
  });
}
