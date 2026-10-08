"use client";

import { useEffect, useState } from "react";

export default function TikTokPilotConnect() {
  const [status, setStatus] = useState("loading"); // loading | idle | connected
  const [userData, setUserData] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Composer States - Pre-configured for Bella & Diva Jewellery
  const [mediaType, setMediaType] = useState("PHOTO"); // "PHOTO" | "VIDEO"
  const [caption, setCaption] = useState(
    "Timeless royalty handcrafted for your special day ✨ Explore our bespoke Kundan & Bridal Choker sets at Bella & Diva. Worldwide delivery from London! DM or visit www.bellandiva.com #bellandiva #kundan #bridaljewellery #indianbride #londonjewellery"
  );
  const [imageUrl, setImageUrl] = useState(
    "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1080&q=80"
  );
  const [images, setImages] = useState([
    "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1080&q=80",
    "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1080&q=80",
  ]);
  const [videoUrl, setVideoUrl] = useState(
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
  );
  const [privacyLevel, setPrivacyLevel] = useState("SELF_ONLY"); // Sandbox apps require SELF_ONLY
  const [uploadingCustom, setUploadingCustom] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(null);
  const [publishError, setPublishError] = useState(null);

  // Live AI Creative Generation States
  const [aiPrompt, setAiPrompt] = useState("Kundan Bridal Necklace Set for wedding season");
  const [generatingAi, setGeneratingAi] = useState(false);

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setGeneratingAi(true);
    setPublishError(null);
    try {
      const res = await fetch("/api/tiktok/generate-creative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiPrompt }),
      });
      const data = await res.json();
      if (data.ok) {
        setCaption(data.caption);
        if (Array.isArray(data.images) && data.images.length >= 2) {
          setImages(data.images);
          setImageUrl(data.images[0]);
        }
      }
    } catch (err) {
      console.warn("AI generation failed:", err);
    } finally {
      setGeneratingAi(false);
    }
  };

  // Autopilot States
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [autopilotCadence, setAutopilotCadence] = useState("daily");

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
          message: "TikTok account successfully connected! You are ready to publish posts and record your review video.",
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

  const handlePublish = async () => {
    setPublishing(true);
    setPublishSuccess(null);
    setPublishError(null);

    try {
      const payload = {
        caption,
        privacyLevel,
        imageUrl: mediaType === "PHOTO" ? imageUrl : null,
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
          message: data.message || "Content successfully dispatched to TikTok!",
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
          padding: "clamp(20px, 4vw, 32px)",
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
              Directly syndicate 9:16 vertical video reels and high-aesthetic photo carousels to your TikTok profile. Compliant with TikTok Login Kit and Direct Post Content APIs.
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
                  transition: "all 0.2s ease",
                }}
              >
                <span>🎵</span>
                Connect with TikTok ↗
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── NOT CONNECTED STATE (PROMINENT CONNECT CARD) ── */}
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
              borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(254, 44, 85, 0.2) 0%, rgba(37, 244, 238, 0.2) 100%)",
              border: "2px solid rgba(254, 44, 85, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              margin: "0 auto 20px",
            }}
          >
            🎵
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", margin: "0 0 10px 0" }}>
            Authorize GabbarInfo AI on TikTok
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 14, maxWidth: 540, margin: "0 auto 24px", lineHeight: 1.6 }}>
            Click below to sign in with your TikTok account via TikTok Login Kit. You will review requested permissions (profile & direct posting) and return here to post live content.
          </p>

          <button
            onClick={handleConnect}
            style={{
              padding: "13px 36px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #fe2c55 0%, #25f4ee 100%)",
              color: "#ffffff",
              border: "none",
              fontSize: 15,
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              boxShadow: "0 6px 25px rgba(254, 44, 85, 0.4)",
              transition: "transform 0.2s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <span>🎵</span>
            Log in with TikTok ↗
          </button>

          {/* Scopes & Permissions Notice (Critical for Reviewers) */}
          <div
            style={{
              marginTop: 32,
              padding: "16px 20px",
              borderRadius: 14,
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.07)",
              maxWidth: 720,
              margin: "32px auto 0",
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 8 }}>
              📋 Permissions Requested (TikTok Developer App: Bella & Diva Ltd):
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: "#94a3b8", lineHeight: 1.7 }}>
              <li><strong>user.info.basic & user.info.profile</strong>: To display your connected avatar and display name.</li>
              <li><strong>video.upload & video.publish</strong>: To publish approved creative photo cards and short video reels via TikTok Direct Post.</li>
              <li><strong>video.list</strong>: To verify publication status of dispatched posts.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── CONNECTED STATE WORKSTATION ── */}
      {status === "connected" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))", gap: 24 }}>
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
                  {userData?.avatarUrl ? (
                    <img
                      src={userData.avatarUrl}
                      alt={userData.displayName || "TikTok"}
                      style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid #fe2c55", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #fe2c55, #25f4ee)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 26,
                      }}
                    >
                      🎵
                    </div>
                  )}

                  <div>
                    <h3 style={{ margin: "0 0 3px 0", fontSize: 17, fontWeight: 800, color: "#ffffff" }}>
                      {userData?.displayName || "TikTok Creator"}
                    </h3>
                    <div style={{ fontSize: 12, color: "#fe2c55", fontWeight: 700 }}>
                      @{((userData?.displayName || "creator").replace(/\s+/g, "").toLowerCase())}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#f87171",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              </div>

              {/* Stats Bar */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 16 }}>
                <div style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Followers</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                    {userData?.followerCount?.toLocaleString() || "0"}
                  </div>
                </div>
                <div style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Total Likes</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                    {userData?.likesCount?.toLocaleString() || "0"}
                  </div>
                </div>
                <div style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>API Status</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#34d399", marginTop: 4 }}>
                    🟢 Ready
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Demonstration Guide for App Reviewers */}
            <div
              style={{
                background: "linear-gradient(180deg, rgba(16, 24, 38, 0.8) 0%, rgba(10, 15, 26, 0.95) 100%)",
                border: "1px solid rgba(56, 189, 248, 0.2)",
                borderRadius: 18,
                padding: "20px 22px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 16 }}>📹</span>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#38bdf8" }}>
                  Review Demo Walkthrough
                </h4>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.6 }}>
                1. Account connected via TikTok Login Kit.<br />
                2. Select <strong>Photo Carousel</strong> or <strong>Video Reel</strong> on the right.<br />
                3. Click <strong>"Use High-Res Sample Demo"</strong> for instant test media.<br />
                4. Click <strong>"Publish Live to TikTok"</strong> to demonstrate Direct Post.
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN: DIRECT POST COMPOSER */}
          <div
            style={{
              background: "rgba(14, 19, 30, 0.85)",
              border: "1px solid rgba(254, 44, 85, 0.25)",
              borderRadius: 20,
              padding: "24px",
              boxShadow: "0 15px 40px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#ffffff" }}>
                🚀 TikTok Direct Post Studio
              </h3>
              <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(254, 44, 85, 0.15)", color: "#fe2c55", fontWeight: 700 }}>
                Direct Post v2
              </span>
            </div>

            {/* Media Format Selector */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                Select Post Format:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setMediaType("PHOTO")}
                  style={{
                    padding: "10px",
                    borderRadius: 10,
                    background: mediaType === "PHOTO" ? "rgba(254, 44, 85, 0.2)" : "rgba(255, 255, 255, 0.04)",
                    border: `1.5px solid ${mediaType === "PHOTO" ? "#fe2c55" : "rgba(255, 255, 255, 0.1)"}`,
                    color: mediaType === "PHOTO" ? "#fe2c55" : "#94a3b8",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  📸 Photo Creative Carousel
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType("VIDEO")}
                  style={{
                    padding: "10px",
                    borderRadius: 10,
                    background: mediaType === "VIDEO" ? "rgba(37, 244, 238, 0.2)" : "rgba(255, 255, 255, 0.04)",
                    border: `1.5px solid ${mediaType === "VIDEO" ? "#25f4ee" : "rgba(255, 255, 255, 0.1)"}`,
                    color: mediaType === "VIDEO" ? "#25f4ee" : "#94a3b8",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  🎬 9:16 Vertical Video Reel
                </button>
              </div>
            </div>

            {/* AI Direct Creative Generator */}
            <div
              style={{
                background: "linear-gradient(135deg, rgba(254, 44, 85, 0.08), rgba(37, 244, 238, 0.08))",
                border: "1px solid rgba(254, 44, 85, 0.25)",
                borderRadius: 14,
                padding: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                  ✨ AI Creative Generator for Bella & Diva
                </span>
                <span style={{ fontSize: 10, color: "#25f4ee", fontWeight: 700, padding: "2px 8px", background: "rgba(37, 244, 238, 0.15)", borderRadius: 12 }}>
                  LIVE AI ENGINE
                </span>
              </div>
              <p style={{ margin: "0 0 10px 0", fontSize: 11, color: "#94a3b8" }}>
                Type any jewellery piece or collection below. The AI will generate bespoke copy, viral TikTok hashtags, and matching photo carousel slides in real time.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Royal Kundan Bridal Set, Festive Chandbalis, American Diamond Choker..."
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: 10,
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: 12,
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAiGenerate();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAiGenerate}
                  disabled={generatingAi || !aiPrompt.trim()}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 10,
                    background: generatingAi ? "rgba(254, 44, 85, 0.5)" : "linear-gradient(135deg, #fe2c55, #25f4ee)",
                    color: "#fff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: generatingAi ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {generatingAi ? "⏳ Generating..." : "🤖 Generate with AI"}
                </button>
              </div>
            </div>

            {/* Bella & Diva Jewellery Quick Presets */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>
                Or pick a Quick Category:
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setMediaType("PHOTO");
                    const imgs = [
                      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1080&q=80",
                      "https://images.unsplash.com/photo-1611591475819-79b8b730ab61?w=1080&q=80",
                    ];
                    setImages(imgs);
                    setImageUrl(imgs[0]);
                    setCaption(
                      "Timeless royalty handcrafted for your special day ✨ Explore our bespoke Kundan & Bridal Choker sets at Bella & Diva. Worldwide delivery from London! DM or visit www.bellandiva.com #bellandiva #kundan #bridaljewellery #indianbride #londonjewellery"
                    );
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "rgba(255, 215, 0, 0.1)",
                    border: "1px solid rgba(255, 215, 0, 0.3)",
                    color: "#fde047",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  👑 Kundan Bridal Set
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMediaType("PHOTO");
                    const imgs = [
                      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1080&q=80",
                      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=1080&q=80",
                    ];
                    setImages(imgs);
                    setImageUrl(imgs[0]);
                    setCaption(
                      "Dazzle every festive night with our high-sheen American Diamond (AD) Choker sets ✨ Affordable luxury handcrafted for royalty. Tap to order! DM us or shop www.bellandiva.com #bellandiva #americandiamond #partywear #jewellerylover"
                    );
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "rgba(56, 189, 248, 0.1)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    color: "#38bdf8",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  💎 American Diamond
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMediaType("PHOTO");
                    const imgs = [
                      "https://images.unsplash.com/photo-1630019852942-f89202989a59?w=1080&q=80",
                      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=1080&q=80",
                    ];
                    setImages(imgs);
                    setImageUrl(imgs[0]);
                    setCaption(
                      "Elevate your festive look with our signature Chandbalis & Jhumkas 🌸 Lightweight, handcrafted, and stunning from every angle. Available at Bella & Diva London! #bellandiva #jhumkas #festivejewellery #partywear"
                    );
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "rgba(254, 44, 85, 0.1)",
                    border: "1px solid rgba(254, 44, 85, 0.3)",
                    color: "#fe2c55",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ✨ Festive Jhumkas
                </button>
              </div>
            </div>

            {/* Carousel Slide Thumbnails */}
            {mediaType === "PHOTO" && Array.isArray(images) && images.length >= 2 && (
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                  📸 Carousel Slides (2 Images for TikTok Photo Post):
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  {images.map((img, idx) => (
                    <div key={idx} style={{ position: "relative" }}>
                      <img
                        src={img}
                        alt={`Slide ${idx + 1}`}
                        style={{
                          width: 80,
                          height: 80,
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
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: 4,
                        }}
                      >
                        Slide {idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Media URL / Demo Fill */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>
                  {mediaType === "PHOTO" ? "Image Media URL:" : "Video Media URL (MP4):"}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (mediaType === "PHOTO") {
                      setImageUrl("https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1080&q=80");
                    } else {
                      setVideoUrl("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4");
                    }
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#38bdf8",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  ⚡ Use Sample Demo Creative
                </button>
              </div>

              <input
                type="text"
                value={mediaType === "PHOTO" ? imageUrl : videoUrl}
                onChange={(e) => (mediaType === "PHOTO" ? setImageUrl(e.target.value) : setVideoUrl(e.target.value))}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  fontSize: 12,
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Caption Input */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                Post Caption & Hashtags:
              </label>
              <textarea
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  fontSize: 12,
                  boxSizing: "border-box",
                  resize: "vertical",
                  lineHeight: 1.4,
                }}
              />
            </div>

            {/* Privacy Setting */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                Privacy Setting (Sandbox accounts require Self Only):
              </label>
              <select
                value={privacyLevel}
                onChange={(e) => setPrivacyLevel(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "rgba(15, 23, 42, 0.9)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  fontSize: 12,
                }}
              >
                <option value="SELF_ONLY">Private / Only Me (Required for Sandbox / Review Demo)</option>
                <option value="PUBLIC_TO_EVERYONE">Public to Everyone (Available after App Approval)</option>
                <option value="MUTUAL_FOLLOW_FRIENDS">Friends Only</option>
              </select>
            </div>

            {/* Publish Button */}
            <button
              onClick={handlePublish}
              disabled={publishing || (!imageUrl && !videoUrl)}
              style={{
                marginTop: 6,
                padding: "12px 24px",
                borderRadius: 12,
                background: publishing
                  ? "rgba(254, 44, 85, 0.5)"
                  : "linear-gradient(135deg, #fe2c55 0%, #25f4ee 100%)",
                color: "#ffffff",
                border: "none",
                fontSize: 14,
                fontWeight: 800,
                cursor: publishing ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 4px 20px rgba(254, 44, 85, 0.3)",
              }}
            >
              {publishing ? (
                <>⏳ Dispatching to TikTok API...</>
              ) : (
                <>🚀 Publish Live to TikTok</>
              )}
            </button>

            {/* Live Success Alert */}
            {publishSuccess && (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  color: "#34d399",
                  fontSize: 12.5,
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
                  🎉 {publishSuccess.message}
                </div>
                {publishSuccess.publishId && (
                  <div style={{ color: "#cbd5e1", fontSize: 11 }}>
                    TikTok Publish ID: <code style={{ color: "#38bdf8" }}>{publishSuccess.publishId}</code>
                  </div>
                )}
              </div>
            )}

            {/* Live Error Alert */}
            {publishError && (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  color: "#f87171",
                  fontSize: 12.5,
                }}
              >
                ❌ {publishError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
