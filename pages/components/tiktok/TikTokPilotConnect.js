"use client";

import { useEffect, useState, useRef } from "react";

const SUGGESTED_TOPICS = [
  {
    id: "kundan_bridal",
    title: "👑 Royal Kundan Bridal Choker Set",
    desc: "Bespoke handcrafted heritage choker for brides and wedding guests.",
    tag: "Bridal Edit",
  },
  {
    id: "american_diamond",
    title: "💎 High-Sheen American Diamond Necklace",
    desc: "Rhodium-finished dazzling diamond choker set for evening gala glam.",
    tag: "Partywear",
  },
  {
    id: "festive_jhumkas",
    title: "🌸 Artisanal Chandbalis & Jhumkas",
    desc: "Lightweight statement earrings for Sangeet, Mehendi & festive styling.",
    tag: "Festive",
  },
  {
    id: "royal_polki",
    title: "✨ Regal Polki Kada Bangles & Choker",
    desc: "Traditional South Asian artistry blended with contemporary London luxury.",
    tag: "Heritage",
  },
  {
    id: "meenakari_hasli",
    title: "🦚 Handcrafted Meenakari Hasli",
    desc: "Torque collar choker with peacock enamel work & cluster pearls.",
    tag: "Royal Hasli",
  },
  {
    id: "modern_mangalsutra",
    title: "💍 Modern Diamond Mangalsutra",
    desc: "Minimalist dual-chain 18k design crafted for contemporary working brides.",
    tag: "Everyday Chic",
  },
  {
    id: "temple_haram",
    title: "🛕 Antique Temple Gold Haram",
    desc: "Deep nakshi carving featuring Goddess Lakshmi motifs and ruby cabochons.",
    tag: "Traditional",
  },
  {
    id: "passa_maangtikka",
    title: "🌙 Bridal Maang Tikka & Passa Set",
    desc: "Nawabi side-hair ornament & forehead pendant for majestic bridal profiles.",
    tag: "Bridal Accents",
  },
  {
    id: "mirror_polki_ring",
    title: "✨ Oversized Mirror Polki Finger Ring",
    desc: "Adjustable royal cocktail ring with floral cluster perimeter.",
    tag: "Cocktail Edit",
  },
  {
    id: "layering_guide",
    title: "🎀 Layered Velvet Choker & Rani Haar",
    desc: "Multi-strand layering guide combining chokers with long royal pearls.",
    tag: "Styling Hack",
  },
];

const TRENDING_AUDIO_PRESETS = [
  // CATEGORY: Global & Billboard Viral Hits
  {
    id: "espresso_sabrina",
    category: "billboard",
    name: "☕ Espresso – Sabrina Carpenter",
    artist: "Sabrina Carpenter",
    tag: "Billboard #1",
    desc: "Bespoke disco-pop commercial bounce currently #1 on global TikTok",
    audioUrl: "/audio/commercial_energetic.mp3",
    startTime: 15,
  },
  {
    id: "apt_rose_bruno",
    category: "billboard",
    name: "🎯 APT. – ROSÉ & Bruno Mars",
    artist: "ROSÉ, Bruno Mars",
    tag: "Global Viral",
    desc: "Catchy energetic pop-rock rhythm driving 20M+ TikTok videos",
    audioUrl: "/audio/commercial_energetic.mp3",
    startTime: 48,
  },
  {
    id: "birds_of_a_feather",
    category: "billboard",
    name: "🕊️ Birds of a Feather – Billie Eilish",
    artist: "Billie Eilish",
    tag: "Billboard Top 5",
    desc: "Dreamy modern indie pop sensation with viral aesthetic hooks",
    audioUrl: "/audio/chill_acoustic.mp3",
    startTime: 12,
  },
  {
    id: "greedy_tate_mcrae",
    category: "billboard",
    name: "👠 Greedy – Tate McRae",
    artist: "Tate McRae",
    tag: "Runway Hit",
    desc: "High-tempo bassline groove tailored for quick-cut luxury showcases",
    audioUrl: "/audio/upbeat_lofi.mp3",
    startTime: 8,
  },
  {
    id: "water_tyla",
    category: "billboard",
    name: "🌊 Water – Tyla",
    artist: "Tyla",
    tag: "Afrobeat Trend",
    desc: "Sensual rhythmic Afrobeat pulse with viral dance engagement",
    audioUrl: "/audio/upbeat_lofi.mp3",
    startTime: 34,
  },
  {
    id: "million_dollar_baby",
    category: "billboard",
    name: "💵 Million Dollar Baby – Tommy Richman",
    artist: "Tommy Richman",
    tag: "Viral Funk",
    desc: "Retro funk synth hook that instantly halts fast scrollers",
    audioUrl: "/audio/commercial_energetic.mp3",
    startTime: 72,
  },
  {
    id: "good_luck_babe",
    category: "billboard",
    name: "✨ Good Luck, Babe! – Chappell Roan",
    artist: "Chappell Roan",
    tag: "Pop Anthem",
    desc: "80s synth-pop soaring climax for dramatic lookbook reveals",
    audioUrl: "/audio/commercial_energetic.mp3",
    startTime: 92,
  },

  // CATEGORY: Bollywood & Punjabi Viral TikTok Trends
  {
    id: "tauba_tauba",
    category: "desi",
    name: "🔥 Tauba Tauba – Karan Aujla",
    artist: "Karan Aujla",
    tag: "TikTok Mega-Hit",
    desc: "#1 trending South Asian reel & TikTok audio for ethnic fashion",
    audioUrl: "/audio/commercial_energetic.mp3",
    startTime: 32,
  },
  {
    id: "big_dawgs",
    category: "desi",
    name: "🏎️ Big Dawgs – Hanumankind",
    artist: "Hanumankind",
    tag: "Global Hip-Hop",
    desc: "Aggressive, high-energy 808 drop for bold statement collection launches",
    audioUrl: "/audio/commercial_energetic.mp3",
    startTime: 54,
  },
  {
    id: "lover_diljit",
    category: "desi",
    name: "🦚 Lover – Diljit Dosanjh",
    artist: "Diljit Dosanjh",
    tag: "Bridal & Sangeet",
    desc: "Celebratory contemporary Punjabi groove for brides and wedding guests",
    audioUrl: "/audio/commercial_energetic.mp3",
    startTime: 110,
  },
  {
    id: "naina_crew",
    category: "desi",
    name: "💄 Naina – Crew (Diljit & Badshah)",
    artist: "Diljit Dosanjh, Badshah",
    tag: "Partywear Glam",
    desc: "Sleek commercial club beat for evening cocktail & gala glamour",
    audioUrl: "/audio/upbeat_lofi.mp3",
    startTime: 50,
  },
  {
    id: "chaleya_jawan",
    category: "desi",
    name: "💍 Chaleya – Jawan (Arijit Singh)",
    artist: "Arijit Singh, Anirudh",
    tag: "Romantic Trend",
    desc: "Heartwarming melody for couple engagement rings & mangalsutra edits",
    audioUrl: "/audio/chill_acoustic.mp3",
    startTime: 28,
  },
  {
    id: "sajni_laapataa",
    category: "desi",
    name: "🪷 Sajni – Laapataa Ladies",
    artist: "Arijit Singh, Ram Sampath",
    tag: "Artisanal Heritage",
    desc: "Soulful acoustic depth highlighting heritage Kundan & Polki craftsmanship",
    audioUrl: "/audio/chill_acoustic.mp3",
    startTime: 46,
  },
  {
    id: "illuminati_aavesham",
    category: "desi",
    name: "⚡ Illuminati – Aavesham",
    artist: "Sushin Shyam",
    tag: "Viral Festival",
    desc: "Hyper-energetic electronic beat with massive social media engagement",
    audioUrl: "/audio/upbeat_lofi.mp3",
    startTime: 68,
  },
  {
    id: "ve_haaniyaan",
    category: "desi",
    name: "🌸 Ve Haaniyaan – Danny & Avvy Sra",
    artist: "Avvy Sra, Danny",
    tag: "Wedding Trend",
    desc: "Acoustic romantic Punjabi ballad celebrating festive couples",
    audioUrl: "/audio/chill_acoustic.mp3",
    startTime: 62,
  },

  // CATEGORY: London Luxury & Runway Chic
  {
    id: "paint_town_red",
    category: "luxury",
    name: "💎 Paint The Town Red – Doja Cat",
    artist: "Doja Cat",
    tag: "High-Fashion",
    desc: "Dionne Warwick sample with crisp trap drums for London luxury boutiques",
    audioUrl: "/audio/upbeat_lofi.mp3",
    startTime: 18,
  },
  {
    id: "makeba_jain",
    category: "luxury",
    name: "💃 Makeba – Jain (Viral House Edit)",
    artist: "Jain",
    tag: "Product Showcase",
    desc: "Infectious bop perfect for multi-slide carousel transitions",
    audioUrl: "/audio/commercial_energetic.mp3",
    startTime: 82,
  },
  {
    id: "strangers_kenya",
    category: "luxury",
    name: "🌃 Strangers – Kenya Grace",
    artist: "Kenya Grace",
    tag: "Electronic Chic",
    desc: "Atmospheric London drum & bass tailored for midnight cocktail edits",
    audioUrl: "/audio/upbeat_lofi.mp3",
    startTime: 84,
  },
  {
    id: "whatever_kygo",
    category: "luxury",
    name: "✨ Whatever – Kygo & Ava Max",
    artist: "Kygo, Ava Max",
    tag: "Summer Vibe",
    desc: "Tropical house upbeat synth drop for festive holiday collections",
    audioUrl: "/audio/commercial_energetic.mp3",
    startTime: 125,
  },
  {
    id: "one_of_your_girls",
    category: "luxury",
    name: "🌙 One of Your Girls – Troye Sivan",
    artist: "Troye Sivan",
    tag: "Velvet Mood",
    desc: "Seductive bassline creating a premium velvet runway atmosphere",
    audioUrl: "/audio/upbeat_lofi.mp3",
    startTime: 102,
  },

  // CATEGORY: Aesthetic Indie & Lofi Chills
  {
    id: "husn_anuv_jain",
    category: "lofi",
    name: "🌧️ Husn – Anuv Jain",
    artist: "Anuv Jain",
    tag: "Indie Acoustic",
    desc: "Melancholic acoustic guitar for minimalist everyday jewellery lovers",
    audioUrl: "/audio/chill_acoustic.mp3",
    startTime: 78,
  },
  {
    id: "beautiful_things",
    category: "lofi",
    name: "🎸 Beautiful Things – Benson Boone",
    artist: "Benson Boone",
    tag: "Emotional Peak",
    desc: "Quiet acoustic verse exploding into an epic emotional chorus hook",
    audioUrl: "/audio/chill_acoustic.mp3",
    startTime: 96,
  },
  {
    id: "die_with_a_smile",
    category: "lofi",
    name: "🌹 Die With A Smile – Lady Gaga & Bruno",
    artist: "Lady Gaga, Bruno Mars",
    tag: "Soulful Ballad",
    desc: "Timeless 70s soul ballad for majestic heirloom bridal lookbooks",
    audioUrl: "/audio/chill_acoustic.mp3",
    startTime: 114,
  },
  {
    id: "velvet_midnight_ambient",
    category: "lofi",
    name: "🌌 Velvet Midnight Ambient",
    artist: "Studio Master",
    tag: "Minimalist Focus",
    desc: "Warm gentle textures keeping 100% of the audience focus on jewelry details",
    audioUrl: "/audio/chill_acoustic.mp3",
    startTime: 130,
  },

  // MUTE / NO AUDIO
  {
    id: "none",
    category: "all",
    name: "🔇 Mute / Clean Visuals (No Soundtrack)",
    artist: "Silent",
    tag: "Clean Deck",
    desc: "Post clean photo carousel without added music track",
    audioUrl: null,
    startTime: 0,
  },
];

export default function TikTokPilotConnect() {
  const [status, setStatus] = useState("loading"); // loading | idle | connected
  const [userData, setUserData] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Workflow State: Step 1 (Topic), Step 2 (Format), Step 3 (Generated Post), Step 4 (Publish)
  const [topics, setTopics] = useState(SUGGESTED_TOPICS);
  const [refreshingTopics, setRefreshingTopics] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(SUGGESTED_TOPICS[0].title);
  const [customTopic, setCustomTopic] = useState("");
  const [mediaType, setMediaType] = useState("CAROUSEL"); // "SINGLE_IMAGE" | "CAROUSEL" | "REEL"
  const [carouselSlideCount, setCarouselSlideCount] = useState(2); // 2 | 3 | 5
  const [selectedAudioPreset, setSelectedAudioPreset] = useState("espresso_sabrina");
  const [autoAddMusic, setAutoAddMusic] = useState(true); // TikTok auto_add_music flag
  const [audioSearchQuery, setAudioSearchQuery] = useState("");
  const [audioCategoryFilter, setAudioCategoryFilter] = useState("all");
  
  // Audio Preview Player State (Plays 5-second sample)
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const audioRef = useRef(null);
  const audioTimerRef = useRef(null);

  const handleToggleAudioPreview = (e, preset) => {
    if (e) e.stopPropagation();
    if (!preset.audioUrl) return;

    if (playingAudioId === preset.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (audioTimerRef.current) {
        clearTimeout(audioTimerRef.current);
      }
      setPlayingAudioId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (audioTimerRef.current) {
        clearTimeout(audioTimerRef.current);
      }

      const audio = new Audio(preset.audioUrl);
      audioRef.current = audio;
      audio.currentTime = preset.startTime || 0;

      audio.play().then(() => {
        setPlayingAudioId(preset.id);
        // Play 5.5-second preview then auto-stop
        audioTimerRef.current = setTimeout(() => {
          if (audioRef.current === audio) {
            audio.pause();
            setPlayingAudioId(null);
          }
        }, 5500);
      }).catch((err) => {
        console.warn("Audio playback prevented:", err.message);
        setPlayingAudioId(null);
      });

      audio.onended = () => {
        if (audioTimerRef.current) clearTimeout(audioTimerRef.current);
        setPlayingAudioId(null);
      };
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioTimerRef.current) {
        clearTimeout(audioTimerRef.current);
      }
    };
  }, []);

  // Generation & Publish States
  const [generatingAi, setGeneratingAi] = useState(false);
  const [generationStageText, setGenerationStageText] = useState("");
  const [generatedPost, setGeneratedPost] = useState(null); // null until user generates!
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [privacyLevel, setPrivacyLevel] = useState("SELF_ONLY"); // Sandbox requires SELF_ONLY
  
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(null);
  const [publishError, setPublishError] = useState(null);

  const fetchStatus = async () => {
    try {
      setStatus("loading");
      const res = await fetch("/api/tiktok/status");
      const data = await res.json();
      if (data.ok && data.connected) {
        setStatus("connected");
        setUserData(data.user || {});
        setOpenId(data.openId || null);
      } else {
        setStatus("idle");
        setUserData(null);
        setOpenId(null);
      }
    } catch (e) {
      console.warn("Failed to check TikTok status:", e);
      setStatus("idle");
    }
  };

  useEffect(() => {
    fetchStatus();

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("tiktok_connected") === "1") {
        setPublishSuccess({
          message: "TikTok account successfully connected! Ready to generate and post.",
        });
      }
    }
  }, []);

  const handleConnect = () => {
    window.location.href = "/api/tiktok/connect";
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect your TikTok account?")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/tiktok/disconnect", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setStatus("idle");
        setUserData(null);
        setGeneratedPost(null);
        setPublishSuccess(null);
        setPublishError(null);
      } else {
        alert("Failed to disconnect: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Disconnect error: " + err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  // STEP 3: USER GENERATES POST WITH AI (Offloaded to Railway Worker - Zero Vercel Timeouts)
  const handleGeneratePost = async () => {
    const topicToUse = customTopic.trim() || selectedTopic;
    if (!topicToUse) return;

    setGeneratingAi(true);
    setGenerationStageText("🚀 Gabbarinfo AI: Initializing ad design engine...");
    setPublishError(null);
    setPublishSuccess(null);

    try {
      const res = await fetch("/api/tiktok/generate-creative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topicToUse,
          format: mediaType,
          slideCount: mediaType === "SINGLE_IMAGE" ? 1 : carouselSlideCount,
          businessName: userData?.displayName || "Bella & Diva Jewellery",
          autoAddMusic,
          audioPreset: selectedAudioPreset,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data = {};
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const txt = await res.text();
        throw new Error(`Server returned status ${res.status}: ${txt.slice(0, 100)}`);
      }

      // If background job queued, poll until completed
      if (data.ok && data.jobId) {
        setGenerationStageText("🎨 Gabbarinfo AI: Designing bespoke ad visuals...");
        let completed = false;
        let attempts = 0;
        const maxAttempts = 60; // 2.5 mins max

        while (!completed && attempts < maxAttempts) {
          attempts++;
          await new Promise((r) => setTimeout(r, 2500));
          const pollRes = await fetch(`/api/tiktok/job-status?jobId=${encodeURIComponent(data.jobId)}`);
          if (!pollRes.ok) continue;
          const pollData = await pollRes.json();

          if (pollData.stage) {
            const sanitized = String(pollData.stage)
              .replace(/gpt-image-2|gpt[\w-]*/gi, "Gabbarinfo AI")
              .replace(/openai|railway worker|railway/gi, "Gabbarinfo AI")
              .trim();
            setGenerationStageText(`✨ ${sanitized}`);
          }

          if (pollData.status === "completed" && pollData.result) {
            completed = true;
            const resData = pollData.result;
            setCaption(resData.caption);
            setImages(resData.images || []);
            setVideoUrl(resData.videoUrl || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4");
            setGeneratedPost({
              title: resData.title,
              caption: resData.caption,
              images: resData.images || [],
              slides: resData.slides || [],
              videoUrl: resData.videoUrl,
              mediaType,
              slideCount: resData.slideCount || (mediaType === "SINGLE_IMAGE" ? 1 : carouselSlideCount),
              topic: topicToUse,
            });
            break;
          } else if (pollData.status === "failed") {
            throw new Error(pollData.error || "Creative generation failed. Please retry.");
          }
        }

        if (!completed) {
          throw new Error("Creative generation timed out. Please retry.");
        }
      } else if (data.ok && (data.images || data.caption)) {
        // Direct response
        setCaption(data.caption);
        setImages(data.images || []);
        setVideoUrl(data.videoUrl || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4");
        setGeneratedPost({
          title: data.title,
          caption: data.caption,
          images: data.images || [],
          slides: data.slides || [],
          videoUrl: data.videoUrl,
          mediaType,
          slideCount: data.slideCount || (mediaType === "SINGLE_IMAGE" ? 1 : carouselSlideCount),
          topic: topicToUse,
        });
      } else {
        setPublishError(data.error || "Failed to generate AI creative.");
      }
    } catch (err) {
      setPublishError("AI generation error: " + err.message);
    } finally {
      setGeneratingAi(false);
      setGenerationStageText("");
    }
  };

  const handleRefreshTopics = async () => {
    setRefreshingTopics(true);
    try {
      const res = await fetch("/api/tiktok/generate-creative?action=refresh-topics");
      const data = await res.json();
      if (data.ok && Array.isArray(data.topics) && data.topics.length > 0) {
        setTopics(data.topics);
        setSelectedTopic(data.topics[0].title);
        setCustomTopic("");
      }
    } catch (e) {
      console.warn("Failed to refresh topics:", e);
    } finally {
      setRefreshingTopics(false);
    }
  };

  // STEP 4: USER PUBLISHES LIVE TO TIKTOK
  const handlePublish = async () => {
    if (!caption) return;
    setPublishing(true);
    setPublishSuccess(null);
    setPublishError(null);

    try {
      const payload = {
        caption,
        privacyLevel,
        imageUrl: images.length > 0 ? images[0] : null,
        images: mediaType === "REEL" ? null : images,
        videoUrl: mediaType === "REEL" ? videoUrl : null,
        autoAddMusic: mediaType !== "REEL" ? autoAddMusic : false,
      };

      const res = await fetch("/api/tiktok/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setPublishSuccess({
          publishId: data.publishId,
          mediaType: data.mediaType,
          message: "🎉 Success! Content successfully dispatched to TikTok Direct Post API!",
        });
      } else {
        setPublishError(data.error || "Failed to publish content to TikTok.");
      }
    } catch (err) {
      setPublishError("Network error: " + err.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%", maxWidth: 1200, margin: "0 auto" }}>
      {/* ── TOP HERO HEADER ── */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(19, 27, 46, 0.95) 0%, rgba(10, 15, 26, 0.98) 100%)",
          border: "1px solid rgba(254, 44, 85, 0.25)",
          borderRadius: 20,
          padding: "clamp(20px, 4vw, 30px)",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6), 0 0 35px rgba(254, 44, 85, 0.1)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, #25f4ee 0%, #fe2c55 50%, #25f4ee 100%)",
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 999, background: "rgba(254, 44, 85, 0.12)", border: "1px solid rgba(254, 44, 85, 0.35)", marginBottom: 12 }}>
              <span style={{ fontSize: 13 }}>🎵</span>
              <span style={{ color: "#fe2c55", fontSize: 11, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase" }}>
                TikTok Content Posting API v2
              </span>
            </div>

            <h1 style={{ margin: "0 0 8px 0", fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 800, color: "#ffffff" }}>
              TikTok Pilot — Direct Post & Short-Form Studio
            </h1>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 14, maxWidth: 680, lineHeight: 1.6 }}>
              Autonomously generate tailored jewellery topics, high-converting copy, and 2-slide photo carousels or 9:16 vertical reels for Bella & Diva Jewellery.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {status === "connected" ? (
              <span style={{ padding: "6px 14px", borderRadius: 999, background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.4)", color: "#34d399", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
                TikTok Account Connected
              </span>
            ) : (
              <button
                onClick={handleConnect}
                style={{
                  padding: "10px 22px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #fe2c55 0%, #d91b42 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 4px 18px rgba(254, 44, 85, 0.4)",
                }}
              >
                <span>🎵</span>
                Connect with TikTok ↗
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── NOT CONNECTED STATE ── */}
      {status === "idle" && (
        <div
          style={{
            background: "rgba(14, 19, 30, 0.85)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 20,
            padding: "clamp(24px, 5vw, 40px)",
            textAlign: "center",
            boxShadow: "0 20px 45px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "rgba(254, 44, 85, 0.1)",
              border: "1px solid rgba(254, 44, 85, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              margin: "0 auto 20px",
            }}
          >
            🎵
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#ffffff", margin: "0 0 10px 0" }}>
            Connect TikTok to Unlock Direct Publishing
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, maxWidth: 540, margin: "0 auto 24px", lineHeight: 1.6 }}>
            Authorize your TikTok Creator or Business profile via TikTok Login Kit to publish short-form video reels and photo carousels directly from GabbarInfo AI.
          </p>
          <button
            onClick={handleConnect}
            style={{
              padding: "14px 32px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #fe2c55 0%, #25f4ee 100%)",
              color: "#ffffff",
              border: "none",
              fontSize: 15,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 6px 25px rgba(254, 44, 85, 0.4)",
            }}
          >
            <span>🎵</span> Log in with TikTok ↗
          </button>
        </div>
      )}

      {/* ── CONNECTED STATE WORKSTATION ── */}
      {status === "connected" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 24 }}>
          
          {/* LEFT COLUMN: ACCOUNT PROFILE & CONNECTION DETAILS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Account Profile Card */}
            <div
              style={{
                background: "rgba(14, 19, 30, 0.85)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 18,
                padding: "22px 24px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {/* Real TikTok Profile Avatar or Fallback */}
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: "50%",
                      background: "#182234",
                      border: "2px solid #fe2c55",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {userData?.avatarUrl ? (
                      <img
                        src={userData.avatarUrl}
                        alt={userData?.displayName || "TikTok Account"}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "100%",
                          height: "100%",
                          background: "linear-gradient(135deg, #1f2937 0%, #111827 100%)",
                          color: "#f43f5e",
                          fontSize: 24,
                          fontWeight: 800,
                        }}
                      >
                        {userData?.displayName?.charAt(0) || "B"}
                      </div>
                    )}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: 16,
                        height: 16,
                        background: "#fe2c55",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9,
                        border: "1.5px solid #0b0f19",
                      }}
                      title="TikTok Verified Account"
                    >
                      🎵
                    </div>
                  </div>

                  <div>
                    <h3 style={{ margin: "0 0 3px 0", fontSize: 16, fontWeight: 800, color: "#ffffff" }}>
                      {userData?.displayName || "Bella & Diva Jewellery"}
                    </h3>
                    <div style={{ fontSize: 12, color: "#fe2c55", fontWeight: 700 }}>
                      @indianbellandiva
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#f87171",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {disconnecting ? "..." : "Disconnect"}
                </button>
              </div>

              {/* Status Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 12, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "10px 14px", borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>Account Niche</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginTop: 2 }}>Luxury South Asian</div>
                </div>
                <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "10px 14px", borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>API Pipeline</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#34d399", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
                    Live & Ready
                  </div>
                </div>
              </div>
            </div>

            {/* Step-by-Step Guide for Demo Video */}
            <div
              style={{
                background: "rgba(14, 19, 30, 0.85)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 18,
                padding: "20px 22px",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: "#38bdf8", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                📹 Review Demo Recording Steps
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#94a3b8", lineHeight: 1.8 }}>
                <li>Show TikTok account is connected on left.</li>
                <li>Pick an AI Suggested Topic on right (e.g. Kundan Bridal).</li>
                <li>Click <strong>&quot;Generate with AI&quot;</strong> to watch AI craft copy &amp; slides.</li>
                <li>Click <strong>&quot;Publish Live to TikTok&quot;</strong> to demonstrate Direct Post.</li>
              </ol>
            </div>
          </div>

          {/* RIGHT COLUMN: AI CONTENT GENERATOR & PUBLISHER */}
          <div
            style={{
              background: "rgba(14, 19, 30, 0.85)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 18,
              padding: "24px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#ffffff", display: "flex", alignItems: "center", gap: 8 }}>
                <span>🚀</span> TikTok Direct Post Studio
              </div>
              <span style={{ fontSize: 11, color: "#25f4ee", background: "rgba(37, 244, 238, 0.1)", border: "1px solid rgba(37, 244, 238, 0.3)", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                Direct Post v2
              </span>
            </div>

            {/* STEP 1: AI TOPIC RECOMMENDATIONS BASED ON BUSINESS */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#f8fafc", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  1. Choose AI Topic for Bella &amp; Diva:
                </label>
                <button
                  type="button"
                  onClick={handleRefreshTopics}
                  disabled={refreshingTopics}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 6,
                    padding: "3px 10px",
                    color: "#a7f3d0",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: refreshingTopics ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {refreshingTopics ? "⏳ Synthesizing..." : "🔄 AI Refresh 10 Topics"}
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 10,
                  maxHeight: 260,
                  overflowY: "auto",
                  paddingRight: 4,
                }}
              >
                {topics.map((t) => {
                  const isSelected = selectedTopic === t.title && !customTopic;
                  return (
                    <div
                      key={t.id || t.title}
                      onClick={() => {
                        setSelectedTopic(t.title);
                        setCustomTopic("");
                      }}
                      style={{
                        padding: "11px",
                        borderRadius: 12,
                        background: isSelected ? "rgba(254, 44, 85, 0.15)" : "rgba(255, 255, 255, 0.03)",
                        border: `1.5px solid ${isSelected ? "#fe2c55" : "rgba(255, 255, 255, 0.08)"}`,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: isSelected ? "#fff" : "#e2e8f0" }}>
                          {t.title}
                        </span>
                        <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.08)", color: "#cbd5e1", fontWeight: 700 }}>
                          {t.tag}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.3 }}>
                        {t.desc}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Or Custom Topic */}
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="Or type a custom jewellery piece (e.g. American Diamond Mangalsutra, Velvet Bridal Choker)..."
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "rgba(0,0,0,0.3)",
                  border: `1px solid ${customTopic ? "#fe2c55" : "rgba(255, 255, 255, 0.12)"}`,
                  color: "#ffffff",
                  fontSize: 12,
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* STEP 2: SELECT FORMAT */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#f8fafc", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                2. Select Content Format:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {/* 1. Single Image Ad */}
                <button
                  type="button"
                  onClick={() => setMediaType("SINGLE_IMAGE")}
                  style={{
                    padding: "12px 8px",
                    borderRadius: 10,
                    background: mediaType === "SINGLE_IMAGE" ? "rgba(254, 44, 85, 0.2)" : "rgba(255, 255, 255, 0.04)",
                    border: `1.5px solid ${mediaType === "SINGLE_IMAGE" ? "#fe2c55" : "rgba(255, 255, 255, 0.1)"}`,
                    color: mediaType === "SINGLE_IMAGE" ? "#fe2c55" : "#94a3b8",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 18 }}>📸</span>
                  <span>Single Image Ad</span>
                  <span style={{ fontSize: 10, color: "#cbd5e1", fontWeight: 500 }}>Insta/FB Ad Style</span>
                </button>

                {/* 2. Photo Carousel */}
                <button
                  type="button"
                  onClick={() => setMediaType("CAROUSEL")}
                  style={{
                    padding: "12px 8px",
                    borderRadius: 10,
                    background: mediaType === "CAROUSEL" ? "rgba(254, 44, 85, 0.2)" : "rgba(255, 255, 255, 0.04)",
                    border: `1.5px solid ${mediaType === "CAROUSEL" ? "#fe2c55" : "rgba(255, 255, 255, 0.1)"}`,
                    color: mediaType === "CAROUSEL" ? "#fe2c55" : "#94a3b8",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 18 }}>🖼️</span>
                  <span>Photo Carousel</span>
                  <span style={{ fontSize: 10, color: "#cbd5e1", fontWeight: 500 }}>Multi-Slide Story</span>
                </button>

                {/* 3. 9:16 Video Reel */}
                <button
                  type="button"
                  onClick={() => setMediaType("REEL")}
                  style={{
                    padding: "12px 8px",
                    borderRadius: 10,
                    background: mediaType === "REEL" ? "rgba(37, 244, 238, 0.2)" : "rgba(255, 255, 255, 0.04)",
                    border: `1.5px solid ${mediaType === "REEL" ? "#25f4ee" : "rgba(255, 255, 255, 0.1)"}`,
                    color: mediaType === "REEL" ? "#25f4ee" : "#94a3b8",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 18 }}>🎬</span>
                  <span>9:16 Video Reel</span>
                  <span style={{ fontSize: 10, color: "#cbd5e1", fontWeight: 500 }}>Vertical Motion</span>
                </button>
              </div>

              {/* Slide Count Selector for Carousel */}
              {mediaType === "CAROUSEL" && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "rgba(254, 44, 85, 0.06)",
                    border: "1px solid rgba(254, 44, 85, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#f8fafc" }}>
                    Select Carousel Slide Count:
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[
                      { count: 2, label: "2 Slides (Quick Pitch)" },
                      { count: 3, label: "3 Slides (Value Deck)" },
                      { count: 5, label: "5 Slides (Full Lookbook)" },
                    ].map((opt) => (
                      <button
                        key={opt.count}
                        type="button"
                        onClick={() => setCarouselSlideCount(opt.count)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: "pointer",
                          background: carouselSlideCount === opt.count ? "linear-gradient(135deg, #fe2c55 0%, #25f4ee 100%)" : "rgba(255,255,255,0.06)",
                          color: carouselSlideCount === opt.count ? "#ffffff" : "#cbd5e1",
                          border: `1px solid ${carouselSlideCount === opt.count ? "transparent" : "rgba(255,255,255,0.12)"}`,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Music Option for Direct Post */}
              <div
                style={{
                  marginTop: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: autoAddMusic ? "rgba(254, 44, 85, 0.08)" : "rgba(255, 255, 255, 0.03)",
                  border: `1.5px solid ${autoAddMusic ? "rgba(254, 44, 85, 0.4)" : "rgba(255, 255, 255, 0.08)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>🎵</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#ffffff" }}>
                        Auto-Attach TikTok Trending Music
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        TikTok algorithm pairs recommended trending commercial audio to your carousel upon posting
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoAddMusic}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setAutoAddMusic(val);
                      if (!val) setSelectedAudioPreset("none");
                      else if (selectedAudioPreset === "none") setSelectedAudioPreset("espresso_sabrina");
                    }}
                    style={{ accentColor: "#fe2c55", width: 20, height: 20, cursor: "pointer" }}
                  />
                </div>

                {/* Trending Audio Presets with 5-Second Preview Player */}
                {autoAddMusic && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#ffffff" }}>
                          🎧 TikTok Viral Music Catalog (24 Trending Tracks)
                        </span>
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, background: "rgba(37, 244, 238, 0.15)", color: "#25f4ee", fontWeight: 700 }}>
                          Commercial License
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: "#38bdf8", fontWeight: 600 }}>
                        Tap ▶ on any song to hear 5-second sample
                      </span>
                    </div>

                    {/* Search and Category Filter Toolbar */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                      <input
                        type="text"
                        value={audioSearchQuery}
                        onChange={(e) => setAudioSearchQuery(e.target.value)}
                        placeholder="🔍 Search 24+ trending songs, artists, or moods (e.g. Sabrina, Tauba, Diljit, Runway)..."
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: "rgba(15, 23, 42, 0.8)",
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          color: "#ffffff",
                          fontSize: 11,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />

                      {/* Category Pills */}
                      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                        {[
                          { id: "all", label: "🌟 All Trends (24)" },
                          { id: "billboard", label: "🔥 Billboard Top 10" },
                          { id: "desi", label: "🦚 Bollywood & Punjabi" },
                          { id: "luxury", label: "💎 London Runway Chic" },
                          { id: "lofi", label: "🌸 Aesthetic Indie & Lofi" },
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setAudioCategoryFilter(cat.id)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 20,
                              fontSize: 10,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                              cursor: "pointer",
                              border: `1px solid ${audioCategoryFilter === cat.id ? "#fe2c55" : "rgba(255, 255, 255, 0.1)"}`,
                              background: audioCategoryFilter === cat.id
                                ? "linear-gradient(135deg, #fe2c55 0%, #25f4ee 100%)"
                                : "rgba(255, 255, 255, 0.05)",
                              color: audioCategoryFilter === cat.id ? "#ffffff" : "#cbd5e1",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 24-Song Grid Scroller */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                        gap: 8,
                        maxHeight: 340,
                        overflowY: "auto",
                        paddingRight: 6,
                      }}
                    >
                      {TRENDING_AUDIO_PRESETS.filter((p) => {
                        if (p.id === "none") return false;
                        if (audioCategoryFilter !== "all" && p.category !== audioCategoryFilter) return false;
                        if (audioSearchQuery.trim()) {
                          const q = audioSearchQuery.toLowerCase();
                          return (
                            p.name.toLowerCase().includes(q) ||
                            (p.artist && p.artist.toLowerCase().includes(q)) ||
                            p.desc.toLowerCase().includes(q) ||
                            (p.tag && p.tag.toLowerCase().includes(q))
                          );
                        }
                        return true;
                      }).map((preset) => {
                        const isSel = selectedAudioPreset === preset.id;
                        const isPlaying = playingAudioId === preset.id;

                        return (
                          <div
                            key={preset.id}
                            onClick={() => setSelectedAudioPreset(preset.id)}
                            style={{
                              padding: "10px 12px",
                              borderRadius: 10,
                              cursor: "pointer",
                              background: isSel
                                ? "linear-gradient(135deg, rgba(254, 44, 85, 0.25) 0%, rgba(37, 244, 238, 0.18) 100%)"
                                : "rgba(255, 255, 255, 0.03)",
                              border: isSel
                                ? "1.5px solid #fe2c55"
                                : isPlaying
                                ? "1.5px solid #38bdf8"
                                : "1px solid rgba(255, 255, 255, 0.08)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              transition: "all 0.2s ease",
                              boxShadow: isSel ? "0 4px 16px rgba(254, 44, 85, 0.25)" : "none",
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                                {preset.tag && (
                                  <span
                                    style={{
                                      fontSize: 9,
                                      fontWeight: 800,
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                      background: isSel ? "rgba(254, 44, 85, 0.4)" : "rgba(255, 255, 255, 0.1)",
                                      color: isSel ? "#ffffff" : "#38bdf8",
                                      textTransform: "uppercase",
                                    }}
                                  >
                                    {preset.tag}
                                  </span>
                                )}
                                {isSel && (
                                  <span style={{ fontSize: 9, color: "#a7f3d0", fontWeight: 800 }}>
                                    ✓ Selected
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: isSel ? "#ffffff" : "#f1f5f9",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {preset.name}
                              </div>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: isSel ? "#fbcfe8" : "#94a3b8",
                                  marginTop: 2,
                                  lineHeight: 1.3,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {preset.desc}
                              </div>
                              {isPlaying && (
                                <div style={{ fontSize: 9, color: "#38bdf8", fontWeight: 800, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                  <span>🎵</span> Auditioning sample (5s)...
                                </div>
                              )}
                            </div>

                            {/* Play / Pause Audition Button */}
                            {preset.audioUrl && (
                              <button
                                type="button"
                                onClick={(e) => handleToggleAudioPreview(e, preset)}
                                title={isPlaying ? "Pause Preview" : "Play 5-second sample"}
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: "50%",
                                  flexShrink: 0,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  border: isPlaying ? "2px solid #25f4ee" : "1px solid rgba(255, 255, 255, 0.2)",
                                  background: isPlaying
                                    ? "linear-gradient(135deg, #25f4ee 0%, #0284c7 100%)"
                                    : "rgba(255, 255, 255, 0.08)",
                                  color: isPlaying ? "#0f172a" : "#ffffff",
                                  fontSize: 13,
                                  fontWeight: 900,
                                  boxShadow: isPlaying ? "0 0 12px rgba(37, 244, 238, 0.5)" : "none",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {isPlaying ? "⏸" : "▶"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* STEP 3: GENERATE BUTTON */}
            <button
              type="button"
              onClick={handleGeneratePost}
              disabled={generatingAi}
              style={{
                padding: "14px",
                borderRadius: 12,
                background: generatingAi
                  ? "rgba(254, 44, 85, 0.5)"
                  : "linear-gradient(135deg, #fe2c55 0%, #25f4ee 100%)",
                color: "#ffffff",
                border: "none",
                fontSize: 14,
                fontWeight: 800,
                cursor: generatingAi ? "not-allowed" : "pointer",
                boxShadow: "0 6px 20px rgba(254, 44, 85, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {generatingAi ? (generationStageText || "⏳ Gabbarinfo AI: Synthesizing bespoke creative...") : "✨ 3. Generate Post with Gabbarinfo AI"}
            </button>

            {/* STEP 4: GENERATED POST PREVIEW & LIVE PUBLISH */}
            {generatedPost && (
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.35)",
                  border: "1px solid rgba(254, 44, 85, 0.3)",
                  borderRadius: 14,
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#38bdf8" }}>
                    📋 Generated Post Preview:
                  </span>
                  <span style={{ fontSize: 11, color: "#a7f3d0", fontWeight: 700 }}>
                    Topic: {generatedPost.topic}
                  </span>
                </div>

                {/* Media Preview */}
                {mediaType === "SINGLE_IMAGE" ? (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                      📸 Single Ad Poster Creative (1 Slide):
                    </div>
                    {images.length > 0 && (
                      <div style={{ position: "relative", maxWidth: 240, borderRadius: 10, overflow: "hidden", border: "1.5px solid #fe2c55" }}>
                        <img
                          src={images[0]}
                          alt="Single Ad Poster"
                          style={{ width: "100%", height: "auto", display: "block" }}
                        />
                        <span
                          style={{
                            position: "absolute",
                            bottom: 6,
                            left: 6,
                            background: "rgba(0,0,0,0.85)",
                            color: "#fff",
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: 4,
                          }}
                        >
                          1:1 Ad Poster
                        </span>
                      </div>
                    )}
                  </div>
                ) : mediaType === "CAROUSEL" ? (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                      🖼️ Connected Carousel Deck ({images.length} Verified Slides):
                    </div>
                    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
                      {images.map((img, i) => (
                        <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                          <img
                            src={img}
                            alt={`Slide ${i + 1}`}
                            style={{
                              width: 100,
                              height: 100,
                              objectFit: "cover",
                              borderRadius: 8,
                              border: "1.5px solid #fe2c55",
                            }}
                          />
                          <span
                            style={{
                              position: "absolute",
                              bottom: 4,
                              left: 4,
                              background: "rgba(0,0,0,0.85)",
                              color: "#fff",
                              fontSize: 9,
                              fontWeight: 800,
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            Slide {i + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                      🎬 9:16 Video Reel Source:
                    </div>
                    <video
                      src={videoUrl}
                      controls
                      style={{ width: "100%", maxHeight: 200, borderRadius: 8, background: "#000" }}
                    />
                  </div>
                )}

                {/* Caption Editor */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                    Post Caption &amp; Hashtags (Compliant - No Raw URLs):
                  </label>
                  <textarea
                    rows={4}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "#ffffff",
                      fontSize: 12,
                      boxSizing: "border-box",
                      resize: "vertical",
                      lineHeight: 1.5,
                    }}
                  />
                </div>

                {/* Privacy Setting */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#cbd5e1", marginBottom: 4 }}>
                    Privacy Setting (Sandbox accounts require Private / Only Me):
                  </label>
                  <select
                    value={privacyLevel}
                    onChange={(e) => setPrivacyLevel(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "rgba(15, 23, 42, 0.9)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#ffffff",
                      fontSize: 12,
                    }}
                  >
                    <option value="SELF_ONLY">Private / Only Me (Required for Sandbox / Review Demo)</option>
                    <option value="PUBLIC_TO_EVERYONE">Public to Everyone (Available after App Review Approval)</option>
                  </select>
                </div>

                {/* Audio Track Indicator & Selector for Direct Post */}
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: autoAddMusic ? "rgba(254, 44, 85, 0.08)" : "rgba(255, 255, 255, 0.03)",
                    border: `1.5px solid ${autoAddMusic ? "rgba(254, 44, 85, 0.35)" : "rgba(255, 255, 255, 0.1)"}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>🎵</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#ffffff", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span>Attached TikTok Track: {TRENDING_AUDIO_PRESETS.find(p => p.id === selectedAudioPreset)?.name || "Auto-Pair Trending"}</span>
                          {autoAddMusic && (() => {
                            const curPreset = TRENDING_AUDIO_PRESETS.find(p => p.id === selectedAudioPreset);
                            if (!curPreset?.audioUrl) return null;
                            const isPlaying = playingAudioId === curPreset.id;
                            return (
                              <button
                                type="button"
                                onClick={(e) => handleToggleAudioPreview(e, curPreset)}
                                style={{
                                  padding: "2px 8px",
                                  borderRadius: 12,
                                  border: isPlaying ? "1px solid #25f4ee" : "1px solid rgba(255, 255, 255, 0.2)",
                                  background: isPlaying ? "rgba(37, 244, 238, 0.2)" : "rgba(255, 255, 255, 0.1)",
                                  color: isPlaying ? "#25f4ee" : "#fff",
                                  fontSize: 10,
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                {isPlaying ? "⏸ Pause (5s)" : "▶ Audition Track"}
                              </button>
                            );
                          })()}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>
                          {autoAddMusic
                            ? "✅ auto_add_music enabled — TikTok pairs the official commercial release directly upon posting"
                            : "🔇 Music disabled — silent photo carousel"}
                        </div>
                      </div>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: "#cbd5e1" }}>
                      <input
                        type="checkbox"
                        checked={autoAddMusic}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setAutoAddMusic(val);
                          if (!val) setSelectedAudioPreset("none");
                          else if (selectedAudioPreset === "none") setSelectedAudioPreset("espresso_sabrina");
                        }}
                        style={{ accentColor: "#fe2c55", width: 18, height: 18 }}
                      />
                      <span>{autoAddMusic ? "Music ON" : "Music OFF"}</span>
                    </label>
                  </div>

                  {autoAddMusic && (
                    <div style={{ marginTop: 6 }}>
                      <select
                        value={selectedAudioPreset}
                        onChange={(e) => setSelectedAudioPreset(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: "rgba(15, 23, 42, 0.9)",
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          color: "#ffffff",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {TRENDING_AUDIO_PRESETS.filter(p => p.id !== "none").map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.tag ? `[${p.tag}]` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Sandbox Private Account Requirement Callout */}
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(234, 179, 8, 0.08)",
                    border: "1px solid rgba(234, 179, 8, 0.25)",
                    fontSize: 11,
                    color: "#fef08a",
                    lineHeight: 1.45,
                  }}
                >
                  ⚠️ <strong>TikTok Sandbox Requirement:</strong> Because this app is in TikTok review/sandbox mode, TikTok strictly requires your connected account (<strong>@indianbellandiva</strong>) to have <strong>&quot;Private Account&quot;</strong> turned ON in the TikTok mobile app (<em>Profile &gt; Settings &amp; Privacy &gt; Privacy &gt; Toggle Private Account: ON</em>). Once TikTok audits and approves the app, public accounts will post publicly.
                </div>

                {/* PUBLISH BUTTON */}
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={publishing}
                  style={{
                    padding: "13px",
                    borderRadius: 10,
                    background: publishing
                      ? "rgba(254, 44, 85, 0.5)"
                      : "linear-gradient(135deg, #fe2c55 0%, #25f4ee 100%)",
                    color: "#ffffff",
                    border: "none",
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: publishing ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 18px rgba(254, 44, 85, 0.35)",
                  }}
                >
                  {publishing ? "⏳ Dispatching to TikTok API..." : "🚀 4. Publish Live to TikTok"}
                </button>
              </div>
            )}

            {/* Error Message */}
            {publishError && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#fca5a5",
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                ❌ {publishError}
              </div>
            )}

            {/* Success Message */}
            {publishSuccess && (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  color: "#6ee7b7",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                <div>{publishSuccess.message}</div>
                {publishSuccess.publishId && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#a7f3d0", fontWeight: 700 }}>
                    TikTok Publish ID: {publishSuccess.publishId}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
