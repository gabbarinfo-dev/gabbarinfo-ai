// lib/video/pexels-service.js

/**
 * Searches Pexels Video API for 9:16 vertical videos matching keywords.
 */
export async function searchVerticalVideo(query, perPage = 3) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.warn("[Pexels] Missing PEXELS_API_KEY");
    return null;
  }

  try {
    const cleanQuery = encodeURIComponent(query.trim() || "modern business lifestyle");
    const url = `https://api.pexels.com/videos/search?query=${cleanQuery}&orientation=portrait&per_page=${perPage}&size=medium`;

    const res = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Pexels] Search error for query "${query}":`, errText);
      return null;
    }

    const data = await res.json();
    if (!data.videos || data.videos.length === 0) {
      // Fallback search with generic engaging topic
      return searchFallbackVideo();
    }

    // Find best portrait mp4 file
    const chosenVideo = data.videos[0];
    const files = chosenVideo.video_files || [];
    
    // Prefer vertical HD files (height > width)
    const portraitFiles = files.filter((f) => f.height > f.width && f.file_type === "video/mp4");
    const bestFile = portraitFiles.find((f) => f.width >= 720) || portraitFiles[0] || files[0];

    if (!bestFile) return null;

    return {
      id: chosenVideo.id,
      videoUrl: bestFile.link,
      previewImage: chosenVideo.image,
      duration: chosenVideo.duration,
      width: bestFile.width,
      height: bestFile.height,
      photographer: chosenVideo.user?.name || "Pexels",
    };
  } catch (err) {
    console.error("[Pexels] Request failed:", err.message);
    return null;
  }
}

async function searchFallbackVideo() {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      "https://api.pexels.com/videos/search?query=abstract+motion+neon&orientation=portrait&per_page=1",
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const vid = data.videos?.[0];
    const best = vid?.video_files?.find((f) => f.height > f.width) || vid?.video_files?.[0];
    if (!best) return null;
    return {
      id: vid.id,
      videoUrl: best.link,
      previewImage: vid.image,
      duration: vid.duration,
      width: best.width,
      height: best.height,
    };
  } catch {
    return null;
  }
}
