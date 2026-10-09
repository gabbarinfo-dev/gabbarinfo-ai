"use client";

import { useEffect, useState, useRef } from "react";
import { DEFAULT_TRENDING_SONGS } from "../../../lib/tiktok/sounds-catalog";

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
  ...DEFAULT_TRENDING_SONGS,
  {
    id: "none",
    title: "🔇 Mute / Clean Visuals (No Soundtrack)",
    artist: "Silent",
    cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&q=80",
    previewUrl: null,
    duration: "00:00",
    tag: "Clean Deck",
    category: "all",
  },
];

const POPULAR_TIKTOK_SEARCH_SUGGESTIONS = [
  "oasis songs",
  "Obsessed",
  "ocean eyes",
  "Olivia Rodrigo",
  "One Piece",
  "olivia dean songs",
  "oasis",
  "one direction",
  "My Mom",
  "Michelle Van Campen",
  "Let The Cold In",
  "Maëlys",
  "salt & ember",
  "I'll Send It Tomorrow",
  "It Keeps Me Warm",
  "Halcyon",
  "Blessed With Love",
  "Dr. Dion Todd Graham",
  "original sound",
  "original sound - ummii_photographer",
  "UmEr",
  "Candace Thompson",
  "Ain't Gonna Waste My Time",
  "Am a Man",
  "Azrah Harry",
  "Shades of time",
  "Mohira Tillayeva",
  "Cosmic",
  "Trần Anh Dũng",
  "Luxury Fashion",
  "Max-Music",
  "Espresso",
  "Taste",
  "Sabrina Carpenter",
  "BIRDS OF A FEATHER",
  "Billie Eilish",
  "APT.",
  "ROSÉ",
  "Bruno Mars",
  "Die With A Smile",
  "Lady Gaga",
  "Greedy",
  "Tate McRae",
  "Water",
  "Tyla",
  "MILLION DOLLAR BABY",
  "Tommy Richman",
  "Lose Control",
  "Teddy Swims",
  "Beautiful Things",
  "Benson Boone",
  "End of Beginning",
  "Djo",
  "Houdini",
  "Dua Lipa",
  "Saturn",
  "SZA",
  "360",
  "Charli xcx",
  "Good Luck, Babe!",
  "Chappell Roan",
  "Not Like Us",
  "Kendrick Lamar",
  "Too Sweet",
  "Hozier",
  "Taylor Swift",
  "Drake",
  "Eminem",
  "The Weeknd",
  "Justin Bieber",
  "Post Malone",
  "Morgan Wallen",
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
  // TikTok Sounds & Modal State
  const [selectedSound, setSelectedSound] = useState(DEFAULT_TRENDING_SONGS[0]); // Default: My Mom – Michelle Van Campen (Matches TikTok Studio)
  const [selectedAudioPreset, setSelectedAudioPreset] = useState(DEFAULT_TRENDING_SONGS[0].id);
  const [autoAddMusic, setAutoAddMusic] = useState(true); // TikTok auto_add_music flag
  const [showSoundsModal, setShowSoundsModal] = useState(false);
  const [soundSearchQuery, setSoundSearchQuery] = useState("");
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [soundSearchResults, setSoundSearchResults] = useState(null);
  const [searchingSounds, setSearchingSounds] = useState(false);
  const [soundsActiveTab, setSoundsActiveTab] = useState("foryou"); // "foryou" | "favorites" | "recent"
  const [soundFavorites, setSoundFavorites] = useState([DEFAULT_TRENDING_SONGS[0].id, DEFAULT_TRENDING_SONGS[5]?.id || "tt_1746801012"]);
  const [soundRecents, setSoundRecents] = useState([DEFAULT_TRENDING_SONGS[0], DEFAULT_TRENDING_SONGS[1]]);

  // Live Audio Preview Player State
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const audioRef = useRef(null);
  const audioTimerRef = useRef(null);

  const handleToggleAudioPreview = (e, sound) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!sound || (!sound.previewUrl && !sound.audioUrl)) return;

    const streamUrl = sound.previewUrl || sound.audioUrl;

    if (playingAudioId === sound.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (audioTimerRef.current) {
        clearTimeout(audioTimerRef.current);
      }
      setPlayingAudioId(null);
      setPlaybackSeconds(0);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (audioTimerRef.current) {
        clearTimeout(audioTimerRef.current);
      }

      const audio = new Audio(streamUrl);
      audioRef.current = audio;
      setPlayingAudioId(sound.id);
      setPlaybackSeconds(0);

      audio.ontimeupdate = () => {
        setPlaybackSeconds(Math.floor(audio.currentTime));
      };

      audio.play().then(() => {
        // Auto-stop after 30 seconds
        audioTimerRef.current = setTimeout(() => {
          if (audioRef.current === audio) {
            audio.pause();
            setPlayingAudioId(null);
            setPlaybackSeconds(0);
          }
        }, 30000);
      }).catch((err) => {
        console.warn("Audio playback prevented:", err.message);
        setPlayingAudioId(null);
      });

      audio.onended = () => {
        if (audioTimerRef.current) clearTimeout(audioTimerRef.current);
        setPlayingAudioId(null);
        setPlaybackSeconds(0);
      };
    }
  };

  const handleSelectSound = (sound) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (audioTimerRef.current) {
      clearTimeout(audioTimerRef.current);
    }
    setPlayingAudioId(null);
    setPlaybackSeconds(0);

    setSelectedSound(sound);
    setSelectedAudioPreset(sound.id);
    setAutoAddMusic(sound.id !== "none");
    setShowSoundsModal(false);

    if (sound.id !== "none") {
      setSoundRecents((prev) => {
        const filtered = prev.filter((s) => s.id !== sound.id);
        return [sound, ...filtered].slice(0, 15);
      });
    }
  };

  const handleToggleFavorite = (e, soundId) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setSoundFavorites((prev) =>
      prev.includes(soundId) ? prev.filter((id) => id !== soundId) : [...prev, soundId]
    );
  };

  // Real-time live search against Apple Music / iTunes
  useEffect(() => {
    if (!soundSearchQuery.trim()) {
      setSoundSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingSounds(true);
      try {
        const res = await fetch(`/api/tiktok/sounds?q=${encodeURIComponent(soundSearchQuery.trim())}`);
        const data = await res.json();
        if (data.ok && Array.isArray(data.songs)) {
          setSoundSearchResults(data.songs);
        } else {
          setSoundSearchResults([]);
        }
      } catch (err) {
        console.warn("Live sound search error:", err);
        setSoundSearchResults([]);
      } finally {
        setSearchingSounds(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [soundSearchQuery]);

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
        if (typeof window !== "undefined") {
          window.history.replaceState({}, document.title, window.location.pathname + "?tab=tiktok");
        }
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
          audioPreset: selectedSound?.id || selectedAudioPreset,
          soundTitle: selectedSound?.title,
          soundArtist: selectedSound?.artist,
          soundCover: selectedSound?.cover,
          soundPreviewUrl: selectedSound?.previewUrl,
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
                      else if (selectedAudioPreset === "none") setSelectedAudioPreset(selectedSound?.id || "espresso_sabrina");
                    }}
                    style={{ accentColor: "#fe2c55", width: 18, height: 18, cursor: "pointer" }}
                  />
                </div>

                {/* Active TikTok Sound Card & Library Selector */}
                {autoAddMusic && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#ffffff" }}>
                          🎵 Active Attached TikTok Song
                        </span>
                        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: "rgba(254, 44, 85, 0.2)", color: "#fe2c55", fontWeight: 800 }}>
                          Real Vocals &amp; Artists
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: "#38bdf8", fontWeight: 600 }}>
                        Tap ▶ to audition vocals • Search all songs via TikTok library
                      </span>
                    </div>

                    {/* Currently Selected Song Highlight Box */}
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: 12,
                        background: "linear-gradient(135deg, rgba(254, 44, 85, 0.15) 0%, rgba(37, 244, 238, 0.1) 100%)",
                        border: "1.5px solid #fe2c55",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        boxShadow: "0 4px 20px rgba(254, 44, 85, 0.2)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                        {/* Cover Art with Play Button */}
                        <div
                          onClick={(e) => handleToggleAudioPreview(e, selectedSound)}
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 10,
                            position: "relative",
                            overflow: "hidden",
                            cursor: selectedSound?.previewUrl ? "pointer" : "default",
                            flexShrink: 0,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                            border: "1px solid rgba(255,255,255,0.2)",
                          }}
                        >
                          <img
                            src={selectedSound?.cover || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&q=80"}
                            alt={selectedSound?.title || "Sound"}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                          {selectedSound?.previewUrl && (
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                background: playingAudioId === selectedSound?.id ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.35)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#ffffff",
                                fontSize: 18,
                              }}
                            >
                              {playingAudioId === selectedSound?.id ? "⏸" : "▶"}
                            </div>
                          )}
                        </div>

                        {/* Song Details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {selectedSound?.title || "Selected Sound"}
                            </span>
                            {selectedSound?.tag && (
                              <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 4, background: "#fe2c55", color: "#fff" }}>
                                {selectedSound.tag}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "#cbd5e1" }}>
                            {selectedSound?.duration || "00:30"} • {selectedSound?.artist || "Artist"}
                          </div>
                          {playingAudioId === selectedSound?.id && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                              <div style={{ width: 80, height: 3, background: "rgba(255,255,255,0.2)", borderRadius: 2, overflow: "hidden" }}>
                                <div style={{ width: `${Math.min(100, (playbackSeconds / 30) * 100)}%`, height: "100%", background: "#25f4ee" }} />
                              </div>
                              <span style={{ fontSize: 10, color: "#25f4ee", fontWeight: 700 }}>
                                00:{String(playbackSeconds).padStart(2, "0")} (Auditioning vocals)
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Launch Sounds Modal Button (TikTok Studio '+ Add sound' Style) */}
                      <button
                        type="button"
                        onClick={() => setShowSoundsModal(true)}
                        style={{
                          padding: "10px 18px",
                          borderRadius: 10,
                          background: "#fe2c55",
                          color: "#ffffff",
                          border: "none",
                          fontSize: 13,
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexShrink: 0,
                          boxShadow: "0 4px 14px rgba(254, 44, 85, 0.4)",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#e02047")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fe2c55")}
                      >
                        <span style={{ fontSize: 16, fontWeight: 900 }}>+</span>
                        <span>Add sound</span>
                      </button>
                    </div>

                    {/* Quick Trending Hits Pills */}
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        ⚡ TikTok Studio Trending Picks (1-Tap Select):
                      </div>
                      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                        {DEFAULT_TRENDING_SONGS.slice(0, 8).map((s) => {
                          const isSel = selectedSound?.id === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleSelectSound(s)}
                              style={{
                                padding: "5px 10px",
                                borderRadius: 16,
                                fontSize: 10,
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                                cursor: "pointer",
                                border: `1px solid ${isSel ? "#fe2c55" : "rgba(255, 255, 255, 0.12)"}`,
                                background: isSel ? "linear-gradient(135deg, #fe2c55 0%, #25f4ee 100%)" : "rgba(255, 255, 255, 0.05)",
                                color: isSel ? "#ffffff" : "#cbd5e1",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <span>🎵</span>
                              <span>{s.title}</span>
                              <span style={{ opacity: 0.7, fontSize: 9 }}>({s.artist.split(" ")[0]})</span>
                            </button>
                          );
                        })}
                      </div>
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
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>🎵</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#ffffff" }}>
                          Attached TikTok Song
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>
                          {autoAddMusic
                            ? "✅ Real vocal commercial master paired upon publishing to TikTok"
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
                          else if (selectedAudioPreset === "none") setSelectedAudioPreset(selectedSound?.id || DEFAULT_TRENDING_SONGS[0].id);
                        }}
                        style={{ accentColor: "#fe2c55", width: 18, height: 18 }}
                      />
                      <span>{autoAddMusic ? "Music ON" : "Music OFF"}</span>
                    </label>
                  </div>

                  {autoAddMusic && (
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "rgba(15, 23, 42, 0.7)",
                        border: "1px solid rgba(254, 44, 85, 0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                        <div
                          onClick={(e) => handleToggleAudioPreview(e, selectedSound)}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 8,
                            position: "relative",
                            overflow: "hidden",
                            cursor: selectedSound?.previewUrl ? "pointer" : "default",
                            flexShrink: 0,
                            border: "1px solid rgba(255,255,255,0.2)",
                          }}
                        >
                          <img
                            src={selectedSound?.cover || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&q=80"}
                            alt={selectedSound?.title || "Sound"}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                          {selectedSound?.previewUrl && (
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                background: playingAudioId === selectedSound?.id ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.35)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#ffffff",
                                fontSize: 16,
                              }}
                            >
                              {playingAudioId === selectedSound?.id ? "⏸" : "▶"}
                            </div>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {selectedSound?.title || "Selected Track"}
                          </div>
                          <div style={{ fontSize: 11, color: "#cbd5e1" }}>
                            {selectedSound?.duration || "00:30"} • {selectedSound?.artist || "Artist"}
                          </div>
                          {playingAudioId === selectedSound?.id && (
                            <div style={{ fontSize: 10, color: "#25f4ee", fontWeight: 700, marginTop: 2 }}>
                              ▶ Auditioning vocals (00:{String(playbackSeconds).padStart(2, "0")})
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowSoundsModal(true)}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          background: "#fe2c55",
                          color: "#ffffff",
                          border: "none",
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexShrink: 0,
                        }}
                      >
                        <span>🎵</span>
                        <span>Change Sound</span>
                      </button>
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

      {/* ── TIKTOK SOUNDS MODAL (Replicating TikTok "Add Sound" Dialog) ── */}
      {showSoundsModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(0, 0, 0, 0.72)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setShowSoundsModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              color: "#161823",
              borderRadius: 16,
              width: "100%",
              maxWidth: 480,
              maxHeight: "86vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.6)",
              overflow: "hidden",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 24px 14px",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#161823" }}>
                Sounds
              </h3>
              <button
                type="button"
                onClick={() => setShowSoundsModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 22,
                  cursor: "pointer",
                  color: "#161823",
                  lineHeight: 1,
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Search Bar Input (Matching Screenshot Pill with Autocomplete) */}
            <div style={{ padding: "0 24px 14px", position: "relative" }}>
              <div
                style={{
                  background: "#f1f1f2",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 14px",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 16, color: "#8a8b91" }}>🔍</span>
                <input
                  type="text"
                  value={soundSearchQuery}
                  onChange={(e) => {
                    setSoundSearchQuery(e.target.value);
                    setShowSearchSuggestions(true);
                  }}
                  onFocus={() => setShowSearchSuggestions(true)}
                  placeholder="Search sounds"
                  autoFocus
                  style={{
                    flex: 1,
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    fontSize: 14,
                    color: "#161823",
                    fontWeight: 500,
                  }}
                />
                {soundSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSoundSearchQuery("");
                      setShowSearchSuggestions(false);
                    }}
                    style={{
                      background: "#e4e4e6",
                      border: "none",
                      borderRadius: "50%",
                      width: 18,
                      height: 18,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      cursor: "pointer",
                      color: "#5f6065",
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* TikTok Live Search Suggestions Dropdown (Screenshot 3 Autocomplete) */}
              {showSearchSuggestions && soundSearchQuery.trim().length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 24,
                    right: 24,
                    background: "#ffffff",
                    borderRadius: 12,
                    boxShadow: "0 12px 36px rgba(0, 0, 0, 0.18)",
                    border: "1px solid #e4e4e6",
                    zIndex: 200,
                    overflow: "hidden",
                    maxHeight: 280,
                    overflowY: "auto",
                  }}
                >
                  {POPULAR_TIKTOK_SEARCH_SUGGESTIONS.filter((s) =>
                    s.toLowerCase().includes(soundSearchQuery.trim().toLowerCase())
                  )
                    .slice(0, 8)
                    .map((sug, idx, arr) => {
                      const qLower = soundSearchQuery.trim().toLowerCase();
                      const matchIdx = sug.toLowerCase().indexOf(qLower);
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setSoundSearchQuery(sug);
                            setShowSearchSuggestions(false);
                          }}
                          style={{
                            padding: "10px 16px",
                            fontSize: 14,
                            fontWeight: 500,
                            color: "#161823",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            borderBottom: idx < arr.length - 1 ? "1px solid #f4f4f5" : "none",
                            transition: "background 0.12s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f8f8")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                        >
                          <span style={{ color: "#25f4ee", fontWeight: 700, fontSize: 13 }}>🔍</span>
                          <span style={{ flex: 1 }}>
                            {matchIdx >= 0 ? (
                              <>
                                {sug.slice(0, matchIdx)}
                                <strong style={{ color: "#0ea5e9" }}>
                                  {sug.slice(matchIdx, matchIdx + qLower.length)}
                                </strong>
                                {sug.slice(matchIdx + qLower.length)}
                              </>
                            ) : (
                              sug
                            )}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Tabs: For You | Favorites | Recent */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid #f1f1f2",
                padding: "0 24px",
                gap: 24,
              }}
            >
              {[
                { id: "foryou", label: "For You" },
                { id: "favorites", label: "Favorites" },
                { id: "recent", label: "Recent" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setSoundsActiveTab(tab.id);
                    setSoundSearchQuery("");
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: "10px 0",
                    fontSize: 14,
                    fontWeight: soundsActiveTab === tab.id ? 700 : 500,
                    color: soundsActiveTab === tab.id ? "#161823" : "#8a8b91",
                    cursor: "pointer",
                    borderBottom: soundsActiveTab === tab.id ? "2px solid #161823" : "2px solid transparent",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab.label}
                  {tab.id === "favorites" && soundFavorites.length > 0 && ` (${soundFavorites.length})`}
                  {tab.id === "recent" && soundRecents.length > 0 && ` (${soundRecents.length})`}
                </button>
              ))}
            </div>

            {/* Sounds List Scroll Container */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "8px 24px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                minHeight: 320,
              }}
            >
              {/* Searching Indicator */}
              {searchingSounds && (
                <div style={{ padding: "30px 0", textAlign: "center", color: "#8a8b91", fontSize: 13 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                  Searching TikTok sounds in real-time...
                </div>
              )}

              {/* No Search Results / Not Available */}
              {!searchingSounds && soundSearchResults !== null && soundSearchResults.length === 0 && (
                <div style={{ padding: "40px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#161823", marginBottom: 6 }}>
                    Not available
                  </div>
                  <div style={{ fontSize: 13, color: "#8a8b91", maxWidth: 300, margin: "0 auto" }}>
                    No sounds matching &ldquo;{soundSearchQuery}&rdquo; found. Try searching for an artist (e.g. Sabrina Carpenter, Billie Eilish) or song title.
                  </div>
                </div>
              )}

              {/* Empty Favorites */}
              {!searchingSounds && soundSearchResults === null && soundsActiveTab === "favorites" && soundFavorites.length === 0 && (
                <div style={{ padding: "40px 16px", textAlign: "center", color: "#8a8b91", fontSize: 13 }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>❤️</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#161823", marginBottom: 6 }}>No favorites yet</div>
                  Tap the heart icon on any song to save it here.
                </div>
              )}

              {/* Empty Recents */}
              {!searchingSounds && soundSearchResults === null && soundsActiveTab === "recent" && soundRecents.length === 0 && (
                <div style={{ padding: "40px 16px", textAlign: "center", color: "#8a8b91", fontSize: 13 }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🕒</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#161823", marginBottom: 6 }}>No recent sounds</div>
                  Songs you preview or use will appear here.
                </div>
              )}

              {/* List of Song Cards */}
              {!searchingSounds && (() => {
                let displaySongs = DEFAULT_TRENDING_SONGS;
                if (soundSearchResults !== null) {
                  displaySongs = soundSearchResults;
                } else if (soundsActiveTab === "favorites") {
                  displaySongs = DEFAULT_TRENDING_SONGS.filter((s) => soundFavorites.includes(s.id));
                } else if (soundsActiveTab === "recent") {
                  displaySongs = soundRecents;
                }

                return displaySongs.map((song) => {
                  const isPlaying = playingAudioId === song.id;
                  const isFavorite = soundFavorites.includes(song.id);
                  const isCurrentlySelected = selectedSound?.id === song.id;

                  return (
                    <div
                      key={song.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 0",
                        borderBottom: "1px solid #f1f1f2",
                        gap: 12,
                      }}
                    >
                      {/* Left: Album Cover + Play Overlay */}
                      <div
                        onClick={(e) => handleToggleAudioPreview(e, song)}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 8,
                          position: "relative",
                          overflow: "hidden",
                          cursor: "pointer",
                          flexShrink: 0,
                          boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                        }}
                      >
                        <img
                          src={song.cover || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&q=80"}
                          alt={song.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: isPlaying ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.3)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#ffffff",
                            fontSize: 16,
                            transition: "background 0.15s ease",
                          }}
                        >
                          {isPlaying ? "⏸" : "▶"}
                        </div>
                      </div>

                      {/* Middle: Title, Artist/Duration, Scrubber when Playing */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: isCurrentlySelected ? "#fe2c55" : "#161823",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {song.title}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#8a8b91",
                            marginTop: 2,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {song.duration || "00:30"} • {song.artist}
                        </div>

                        {/* Scrubber Timeline (Matching Screenshot Player Slider) */}
                        {isPlaying && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                            <div
                              style={{
                                flex: 1,
                                height: 3,
                                background: "#e4e4e6",
                                borderRadius: 2,
                                position: "relative",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(100, (playbackSeconds / 30) * 100)}%`,
                                  height: "100%",
                                  background: "#161823",
                                  borderRadius: 2,
                                }}
                              />
                            </div>
                            <span style={{ fontSize: 11, color: "#8a8b91", fontWeight: 600 }}>
                              00:{String(playbackSeconds).padStart(2, "0")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right: Favorite Toggle + Pink "Use" Button */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(e, song.id)}
                          title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                          style={{
                            background: "transparent",
                            border: "none",
                            fontSize: 16,
                            cursor: "pointer",
                            padding: 4,
                            lineHeight: 1,
                            color: isFavorite ? "#fe2c55" : "#8a8b91",
                          }}
                        >
                          {isFavorite ? "❤️" : "🤍"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectSound(song)}
                          style={{
                            background: isCurrentlySelected ? "#10b981" : "#fe2c55",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 18px",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                            boxShadow: "0 2px 8px rgba(254, 44, 85, 0.3)",
                            transition: "background 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!isCurrentlySelected) e.currentTarget.style.background = "#e02047";
                          }}
                          onMouseLeave={(e) => {
                            if (!isCurrentlySelected) e.currentTarget.style.background = "#fe2c55";
                          }}
                        >
                          {isCurrentlySelected ? "Selected" : "Use"}
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
