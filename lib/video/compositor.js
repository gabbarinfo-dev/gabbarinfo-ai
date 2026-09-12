// lib/video/compositor.js

/**
 * Prepares the multi-track video timeline and storyboard:
 * - Sequenced video scenes (with transitions)
 * - Timed voiceover audio track
 * - Word-level animated karaoke captions
 * - Upbeat background royalty-free audio track
 */
export function buildVideoTimeline({ script, voiceover, scenes, backgroundBeat = "upbeat_lofi" }) {
  const totalDuration = voiceover.duration || 15;
  const numScenes = scenes.length || 1;
  const durationPerScene = totalDuration / numScenes;

  // Build timeline tracks
  const videoTracks = scenes.map((scene, idx) => ({
    id: scene.id || idx + 1,
    startSec: Math.round(idx * durationPerScene * 100) / 100,
    endSec: Math.round((idx + 1) * durationPerScene * 100) / 100,
    duration: Math.round(durationPerScene * 100) / 100,
    videoUrl: scene.videoUrl,
    previewImage: scene.previewImage,
    text: scene.text,
  }));

  // Background beat royalty-free tracks
  const beats = {
    upbeat_lofi: "https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3",
    commercial_energetic: "https://assets.mixkit.co/music/preview/mixkit-hip-hop-02-738.mp3",
    chill_acoustic: "https://assets.mixkit.co/music/preview/mixkit-spirit-of-the-lake-285.mp3",
  };

  const selectedMusicUrl = beats[backgroundBeat] || beats.upbeat_lofi;

  return {
    aspectRatio: "9:16",
    resolution: { width: 1080, height: 1920 },
    totalDuration,
    voiceoverUrl: voiceover.audioBase64,
    backgroundMusicUrl: selectedMusicUrl,
    musicVolume: 0.18, // ducking under voiceover
    scenes: videoTracks,
    captions: voiceover.timedWords || [],
    title: script.title,
    caption: script.caption,
  };
}
