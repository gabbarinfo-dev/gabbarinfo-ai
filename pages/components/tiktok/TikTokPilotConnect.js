"use client";

import { useEffect, useState } from "react";

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
];

export default function TikTokPilotConnect() {
  const [status, setStatus] = useState("loading"); // loading | idle | connected
  const [userData, setUserData] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Workflow State: Step 1 (Topic), Step 2 (Format), Step 3 (Generated Post), Step 4 (Publish)
  const [selectedTopic, setSelectedTopic] = useState(SUGGESTED_TOPICS[0].title);
  const [customTopic, setCustomTopic] = useState("");
  const [mediaType, setMediaType] = useState("PHOTO"); // "PHOTO" (Carousel) | "VIDEO" (Reel)
  
  // Generation & Publish States
  const [generatingAi, setGeneratingAi] = useState(false);
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

  // STEP 3: USER GENERATES POST WITH AI
  const handleGeneratePost = async () => {
    const topicToUse = customTopic.trim() || selectedTopic;
    if (!topicToUse) return;

    setGeneratingAi(true);
    setPublishError(null);
    setPublishSuccess(null);

    try {
      const res = await fetch("/api/tiktok/generate-creative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topicToUse,
          format: mediaType === "PHOTO" ? "CAROUSEL" : "REEL",
          businessName: "Bella & Diva Jewellery",
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setCaption(data.caption);
        setImages(data.images || []);
        setVideoUrl(data.videoUrl || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4");
        setGeneratedPost({
          title: data.title,
          caption: data.caption,
          images: data.images || [],
          videoUrl: data.videoUrl,
          mediaType,
          topic: topicToUse,
        });
      } else {
        setPublishError(data.error || "Failed to generate AI creative.");
      }
    } catch (err) {
      setPublishError("AI generation error: " + err.message);
    } finally {
      setGeneratingAi(false);
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
        imageUrl: mediaType === "PHOTO" && images.length > 0 ? images[0] : null,
        images: mediaType === "PHOTO" ? images : null,
        videoUrl: mediaType === "VIDEO" ? videoUrl : null,
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
                  {/* Luxury Emerald & Gold Brand Monogram Avatar */}
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #134e4a 0%, #064e3b 100%)",
                      border: "2px solid #facc15",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 900, color: "#fef08a", letterSpacing: 1, fontFamily: "serif" }}>
                      bd
                    </span>
                    <span style={{ fontSize: 7, fontWeight: 800, color: "#a7f3d0", letterSpacing: 1, textTransform: "uppercase" }}>
                      JEWELLERY
                    </span>
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: 14,
                        height: 14,
                        background: "#fe2c55",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 8,
                      }}
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
                <span style={{ fontSize: 11, color: "#a7f3d0", fontWeight: 700 }}>
                  Tailored to Jewellery Niche
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                {SUGGESTED_TOPICS.map((t) => {
                  const isSelected = selectedTopic === t.title && !customTopic;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedTopic(t.title);
                        setCustomTopic("");
                      }}
                      style={{
                        padding: "12px",
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setMediaType("PHOTO")}
                  style={{
                    padding: "12px",
                    borderRadius: 10,
                    background: mediaType === "PHOTO" ? "rgba(254, 44, 85, 0.2)" : "rgba(255, 255, 255, 0.04)",
                    border: `1.5px solid ${mediaType === "PHOTO" ? "#fe2c55" : "rgba(255, 255, 255, 0.1)"}`,
                    color: mediaType === "PHOTO" ? "#fe2c55" : "#94a3b8",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  📸 AI Photo Carousel (2 Slides)
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType("VIDEO")}
                  style={{
                    padding: "12px",
                    borderRadius: 10,
                    background: mediaType === "VIDEO" ? "rgba(37, 244, 238, 0.2)" : "rgba(255, 255, 255, 0.04)",
                    border: `1.5px solid ${mediaType === "VIDEO" ? "#25f4ee" : "rgba(255, 255, 255, 0.1)"}`,
                    color: mediaType === "VIDEO" ? "#25f4ee" : "#94a3b8",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  🎬 9:16 Vertical Video Reel
                </button>
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
              {generatingAi ? "⏳ AI Synthesizing Creative..." : "✨ 3. Generate Post with AI"}
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
                {mediaType === "PHOTO" ? (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                      Carousel Deck ({images.length} Verified Slides):
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      {images.map((img, i) => (
                        <div key={i} style={{ position: "relative" }}>
                          <img
                            src={img}
                            alt={`Slide ${i + 1}`}
                            style={{
                              width: 90,
                              height: 90,
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
                              background: "rgba(0,0,0,0.8)",
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
                      9:16 Video Reel Source:
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
                    <option value="MUTUAL_FOLLOW_FRIENDS">Friends Only</option>
                  </select>
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
