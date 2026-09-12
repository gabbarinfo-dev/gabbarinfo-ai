"use client";

import { useState, useRef, useEffect } from "react";

export default function ReelsStudioConnect() {
  const [selectedStyle, setSelectedStyle] = useState("motion_broll"); // "motion_broll" | "talking_avatar" | "generative_cinematic"
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("business");
  const [voice, setVoice] = useState("nova");
  const [backgroundBeat, setBackgroundBeat] = useState("upbeat_lofi");
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Generated Video Data
  const [generatedVideo, setGeneratedVideo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [activeCaption, setActiveCaption] = useState("");

  // Publishing State
  const [publishingChannel, setPublishingChannel] = useState(null);
  const [publishStatus, setPublishStatus] = useState({});

  // Audio References
  const voiceoverRef = useRef(null);
  const bgMusicRef = useRef(null);
  const videoPlayerRef = useRef(null);

  const STYLES = [
    {
      id: "motion_broll",
      icon: "⚡",
      name: "Dynamic Motion Reel",
      tag: "Highest ROI",
      tagColor: "#10b981",
      desc: "Synced 9:16 HD vertical video clips + realistic voiceover + glowing kinetic karaoke subtitles.",
      renderTime: "~15s render",
      cost: "~₹0.30 per reel",
      gradient: "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%)",
      border: "rgba(16, 185, 129, 0.4)",
    },
    {
      id: "talking_avatar",
      icon: "👤",
      name: "AI Talking Avatar",
      tag: "Brand Influencer",
      tagColor: "#6366f1",
      desc: "Photorealistic digital persona or brand spokesperson speaking your script with natural lip-sync.",
      renderTime: "~45s render",
      cost: "AI character generation",
      gradient: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%)",
      border: "rgba(99, 102, 241, 0.4)",
    },
    {
      id: "generative_cinematic",
      icon: "🎥",
      name: "Generative AI Video",
      tag: "Cinematic 3D",
      tagColor: "#ec4899",
      desc: "Text-to-video AI synthesis rendering custom photorealistic movie scenes from scratch.",
      renderTime: "~90s render",
      cost: "GPU rendering",
      gradient: "linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%)",
      border: "rgba(236, 72, 153, 0.4)",
    },
  ];

  const QUICK_TOPICS = [
    "3 Secret Hacks to Scale Your Online Store in 2026",
    "Why 90% of Startups Fail in Their First 6 Months",
    "Stop Making This Costly Mistake With Your Advertising",
    "5 High-Income Skills You Can Learn in 30 Days",
  ];

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!topic.trim()) {
      setErrorMsg("Please enter a video topic or hook idea.");
      return;
    }

    setGenerating(true);
    setErrorMsg("");
    setGeneratedVideo(null);
    setIsPlaying(false);
    setCurrentTime(0);

    try {
      setGenerationStep("Writing viral hook and 15s script with AI…");
      await new Promise((r) => setTimeout(r, 600));

      setGenerationStep("Generating neural voiceover and word-level subtitle timings…");
      await new Promise((r) => setTimeout(r, 800));

      setGenerationStep(
        selectedStyle === "motion_broll"
          ? "Gathering 9:16 vertical 4K B-roll clips from Pexels API…"
          : selectedStyle === "talking_avatar"
          ? "Generating character avatar and facial lip-sync…"
          : "Synthesizing text-to-video scenes on GPU…"
      );

      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style: selectedStyle,
          topic: topic.trim(),
          niche,
          voice,
          backgroundBeat,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to generate video.");
      }

      setGeneratedVideo(data.video);
      setGenerationStep("");
    } catch (err) {
      console.error("Video Generation Error:", err);
      setErrorMsg(err.message || "Failed to generate video reel.");
    } finally {
      setGenerating(false);
    }
  };

  // Video Time Synchronizer
  const handleTimeUpdate = () => {
    if (!voiceoverRef.current || !generatedVideo) return;
    const t = voiceoverRef.current.currentTime;
    setCurrentTime(t);

    // Determine current scene
    const scenes = generatedVideo.scenes || [];
    const currentSceneIdx = scenes.findIndex((s) => t >= s.startSec && t <= s.endSec);
    if (currentSceneIdx !== -1 && currentSceneIdx !== activeSceneIndex) {
      setActiveSceneIndex(currentSceneIdx);
    }

    // Determine active karaoke caption word
    const captions = generatedVideo.captions || [];
    const activeWord = captions.find((c) => t >= c.startTime && t <= c.endTime);
    if (activeWord) {
      setActiveCaption(activeWord.original);
    }
  };

  const togglePlayback = () => {
    if (!voiceoverRef.current) return;
    if (isPlaying) {
      voiceoverRef.current.pause();
      if (bgMusicRef.current) bgMusicRef.current.pause();
      if (videoPlayerRef.current) videoPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      voiceoverRef.current.play().catch(console.warn);
      if (bgMusicRef.current) bgMusicRef.current.play().catch(console.warn);
      if (videoPlayerRef.current) videoPlayerRef.current.play().catch(console.warn);
      setIsPlaying(true);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setActiveSceneIndex(0);
    if (voiceoverRef.current) voiceoverRef.current.currentTime = 0;
    if (bgMusicRef.current) bgMusicRef.current.currentTime = 0;
    if (videoPlayerRef.current) videoPlayerRef.current.currentTime = 0;
  };

  // 1-Click Multi-Channel Publisher
  const handlePublish = async (channel) => {
    if (!generatedVideo) return;
    setPublishingChannel(channel);
    setPublishStatus((prev) => ({ ...prev, [channel]: { loading: true } }));

    const currentClipUrl =
      generatedVideo.scenes?.[0]?.videoUrl || "https://ai.gabbarinfo.com/sample-reel.mp4";

    try {
      const res = await fetch("/api/video/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          videoUrl: currentClipUrl,
          title: generatedVideo.title || topic,
          caption: generatedVideo.caption || topic,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setPublishStatus((prev) => ({
          ...prev,
          [channel]: { success: true, message: data.message },
        }));
      } else {
        setPublishStatus((prev) => ({
          ...prev,
          [channel]: { error: data.error || "Publishing failed" },
        }));
      }
    } catch (err) {
      setPublishStatus((prev) => ({
        ...prev,
        [channel]: { error: err.message },
      }));
    } finally {
      setPublishingChannel(null);
    }
  };

  const currentScene = generatedVideo?.scenes?.[activeSceneIndex] || generatedVideo?.scenes?.[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, color: "#fff" }}>
      {/* Hidden Audio Players for Master Sync */}
      {generatedVideo && (
        <>
          <audio
            ref={voiceoverRef}
            src={generatedVideo.voiceoverUrl}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
          />
          <audio
            ref={bgMusicRef}
            src={generatedVideo.backgroundMusicUrl}
            loop
            volume={generatedVideo.musicVolume || 0.18}
          />
        </>
      )}

      {/* Header Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(8, 13, 22, 0.98) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 22,
          padding: "clamp(22px, 3.5vw, 32px)",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)",
                border: "1px solid rgba(236, 72, 153, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                boxShadow: "0 0 25px rgba(236, 72, 153, 0.25)",
              }}
            >
              🎬
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#fff" }}>
                  AI Reels & Shorts Studio
                </h2>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "rgba(236, 72, 153, 0.15)",
                    color: "#f472b6",
                    border: "1px solid rgba(236, 72, 153, 0.3)",
                  }}
                >
                  3 Visual Engines
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
                Generate 15–20s viral vertical video reels with voiceover, kinetic captions, and 1-click publishing.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                padding: "6px 12px",
                borderRadius: 10,
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                fontSize: 12,
                color: "#10b981",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
              ENGINES READY
            </div>
          </div>
        </div>

        {/* 3 VISUAL STYLE SELECTOR CARDS */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            Step 1: Choose Your Reel Visual Style
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {STYLES.map((st) => {
              const isSelected = selectedStyle === st.id;
              return (
                <div
                  key={st.id}
                  onClick={() => setSelectedStyle(st.id)}
                  style={{
                    padding: "16px 18px",
                    borderRadius: 16,
                    background: isSelected ? st.gradient : "rgba(255, 255, 255, 0.02)",
                    border: isSelected ? `2px solid ${st.border}` : "1px solid rgba(255, 255, 255, 0.08)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: isSelected ? "0 8px 24px rgba(0, 0, 0, 0.4)" : "none",
                    position: "relative",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 22 }}>{st.icon}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{st.name}</span>
                    </div>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: "rgba(0, 0, 0, 0.4)",
                        color: st.tagColor,
                        border: `1px solid ${st.tagColor}40`,
                      }}
                    >
                      {st.tag}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.45, marginBottom: 10 }}>
                    {st.desc}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "#cbd5e1" }}>
                    <span>⏱ {st.renderTime}</span>
                    <span style={{ color: "#10b981" }}>{st.cost}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Workspace (Split Grid: Left Form, Right Smartphone Player) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24, alignItems: "start" }}>
        {/* LEFT COLUMN: CONTROLS & SCRIPT INPUT */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(8, 13, 22, 0.95) 100%)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.4)",
          }}
        >
          <form onSubmit={handleGenerate}>
            {/* Topic Input */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>
                🎬 Video Topic, Hook, or Concept:
              </label>
              <textarea
                rows={3}
                placeholder="e.g. 3 Proven secrets to 10x your Shopify sales this month..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontSize: 13.5,
                  outline: "none",
                  resize: "vertical",
                }}
              />
              {/* Quick Inspiration Pills */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {QUICK_TOPICS.map((t, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => setTopic(t)}
                    style={{
                      fontSize: 11,
                      padding: "4px 8px",
                      borderRadius: 6,
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      color: "#94a3b8",
                      cursor: "pointer",
                    }}
                  >
                    💡 {t.slice(0, 32)}…
                  </button>
                ))}
              </div>
            </div>

            {/* Customization Grid: Niche, Voice, Music */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                  Target Niche:
                </label>
                <select
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: 12.5,
                  }}
                >
                  <option value="business">Business & Wealth</option>
                  <option value="ecommerce">eCommerce & Shopify</option>
                  <option value="tech">AI & Technology</option>
                  <option value="fitness">Health & Fitness</option>
                  <option value="lifestyle">Luxury & Lifestyle</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                  AI Voice:
                </label>
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: 12.5,
                  }}
                >
                  <option value="nova">Nova (Energetic Female)</option>
                  <option value="onyx">Onyx (Deep Authority Male)</option>
                  <option value="alloy">Alloy (Balanced Neutral)</option>
                  <option value="fable">Fable (British Narrator)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                  Background Music:
                </label>
                <select
                  value={backgroundBeat}
                  onChange={(e) => setBackgroundBeat(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    fontSize: 12.5,
                  }}
                >
                  <option value="upbeat_lofi">Tech House Vibes</option>
                  <option value="commercial_energetic">High-Energy Hip Hop</option>
                  <option value="chill_acoustic">Chill Ambient</option>
                </select>
              </div>
            </div>

            {/* Generate Button */}
            <button
              type="submit"
              disabled={generating}
              style={{
                width: "100%",
                padding: "14px 20px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
                border: "none",
                color: "#fff",
                fontWeight: 800,
                fontSize: 15,
                cursor: generating ? "not-allowed" : "pointer",
                boxShadow: "0 4px 20px rgba(236, 72, 153, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <span>{generating ? "✨ Generating AI Reel…" : "🚀 Generate 15s AI Reel Now"}</span>
            </button>

            {generating && (
              <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "rgba(139, 92, 246, 0.15)", border: "1px solid rgba(139, 92, 246, 0.3)", color: "#c4b5fd", fontSize: 12.5, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
                <span>{generationStep}</span>
              </div>
            )}

            {errorMsg && (
              <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", fontSize: 12.5 }}>
                {errorMsg}
              </div>
            )}
          </form>

          {/* SCRIPT BREAKDOWN (WHEN GENERATED) */}
          {generatedVideo && (
            <div style={{ marginTop: 24, borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#cbd5e1", marginBottom: 10 }}>
                📝 Generated Script & Scenes:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {generatedVideo.scenes?.map((sc, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setActiveSceneIndex(i);
                      if (voiceoverRef.current) voiceoverRef.current.currentTime = sc.startSec;
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: activeSceneIndex === i ? "rgba(236, 72, 153, 0.15)" : "rgba(255, 255, 255, 0.03)",
                      border: activeSceneIndex === i ? "1px solid #ec4899" : "1px solid rgba(255, 255, 255, 0.06)",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontWeight: 700 }}>
                      <span style={{ color: activeSceneIndex === i ? "#f472b6" : "#94a3b8" }}>Scene {i + 1} ({sc.startSec}s - {sc.endSec}s)</span>
                      <span style={{ fontSize: 11, color: "#64748b" }}>{activeSceneIndex === i ? "▶ Playing" : "Click to view"}</span>
                    </div>
                    <div style={{ color: "#e2e8f0" }}>"{sc.text}"</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SMARTPHONE 9:16 VERTICAL PREVIEW PLAYER */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          {/* Smartphone Frame */}
          <div
            style={{
              width: 290,
              height: 560,
              background: "#000",
              borderRadius: 42,
              border: "8px solid #1e293b",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(236, 72, 153, 0.2)",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* iPhone Dynamic Island */}
            <div
              style={{
                position: "absolute",
                top: 10,
                left: "50%",
                transform: "translateX(-50%)",
                width: 80,
                height: 20,
                background: "#000",
                borderRadius: 999,
                zIndex: 30,
              }}
            />

            {/* Video Viewport */}
            {generatedVideo ? (
              <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#090d16" }}>
                {currentScene?.videoUrl?.includes(".mp4") ? (
                  <video
                    ref={videoPlayerRef}
                    src={currentScene.videoUrl}
                    playsInline
                    loop
                    muted
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <img
                    src={currentScene?.videoUrl || currentScene?.previewImage || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80"}
                    alt="Scene preview"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}

                {/* Dark Gradient Overlay for Caption Readability */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 100%)",
                    pointerEvents: "none",
                  }}
                />

                {/* Dynamic Glowing Karaoke Captions Overlay */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 80,
                    left: 16,
                    right: 16,
                    textAlign: "center",
                    zIndex: 20,
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      display: "inline-block",
                      padding: "6px 14px",
                      borderRadius: 10,
                      background: "rgba(0, 0, 0, 0.75)",
                      backdropFilter: "blur(6px)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      fontSize: 16,
                      fontWeight: 900,
                      color: "#facc15", // bright CapCut yellow
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      textShadow: "0 2px 10px rgba(0,0,0,0.8)",
                      animation: "pulse 0.2s ease-in-out",
                    }}
                  >
                    {activeCaption || currentScene?.text?.slice(0, 30) || "GABBARINFO AI"}
                  </div>
                </div>

                {/* Play/Pause Center Tap Overlay */}
                <div
                  onClick={togglePlayback}
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    background: isPlaying ? "transparent" : "rgba(0, 0, 0, 0.4)",
                    transition: "background 0.2s ease",
                  }}
                >
                  {!isPlaying && (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        background: "rgba(236, 72, 153, 0.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 24,
                        color: "#fff",
                        boxShadow: "0 0 25px rgba(236, 72, 153, 0.6)",
                      }}
                    >
                      ▶
                    </div>
                  )}
                </div>

                {/* Bottom Timeline Bar */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: "rgba(255, 255, 255, 0.2)",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(currentTime / (generatedVideo.totalDuration || 15)) * 100}%`,
                      background: "#ec4899",
                      transition: "width 0.1s linear",
                    }}
                  />
                </div>
              </div>
            ) : (
              /* Idle Empty State */
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  textAlign: "center",
                  color: "#64748b",
                }}
              >
                <div style={{ fontSize: 44, marginBottom: 12 }}>📱</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>
                  9:16 Video Player
                </div>
                <div style={{ fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>
                  Select a style, type your topic, and your rendered reel will appear here with captions.
                </div>
              </div>
            )}
          </div>

          {/* Action Bar Under Smartphone: Playback & Download */}
          {generatedVideo && (
            <div style={{ display: "flex", gap: 10, width: 290 }}>
              <button
                onClick={togglePlayback}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 10,
                  background: isPlaying ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)",
                  border: isPlaying ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(16, 185, 129, 0.4)",
                  color: isPlaying ? "#fca5a5" : "#6ee7b7",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {isPlaying ? "⏸ Pause" : "▶ Play Reel"}
              </button>

              <a
                href={currentScene?.videoUrl || "#"}
                target="_blank"
                rel="noreferrer"
                download="gabbarinfo-reel.mp4"
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                ⬇ MP4
              </a>
            </div>
          )}

          {/* MULTI-CHANNEL AUTO-PUBLISHER BAR (ADD-ON) */}
          {generatedVideo && (
            <div
              style={{
                width: 290,
                background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(8, 13, 22, 0.95) 100%)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 16,
                padding: 14,
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: 10 }}>
                🚀 1-Click Multi-Channel Publish:
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Instagram Reels Button */}
                <button
                  onClick={() => handlePublish("instagram")}
                  disabled={publishingChannel === "instagram"}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)",
                    border: "none",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: publishingChannel === "instagram" ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>📸 Instagram Reels</span>
                  <span>{publishingChannel === "instagram" ? "Publishing…" : "Post ↗"}</span>
                </button>

                {/* Facebook Reels Button */}
                <button
                  onClick={() => handlePublish("facebook")}
                  disabled={publishingChannel === "facebook"}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "#1877f2",
                    border: "none",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: publishingChannel === "facebook" ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>📘 Facebook Reels</span>
                  <span>{publishingChannel === "facebook" ? "Publishing…" : "Post ↗"}</span>
                </button>

                {/* YouTube Shorts Button */}
                <button
                  onClick={() => handlePublish("youtube")}
                  disabled={publishingChannel === "youtube"}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 8,
                    background: "#ff0000",
                    border: "none",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: publishingChannel === "youtube" ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>🔴 YouTube Shorts</span>
                  <span>{publishingChannel === "youtube" ? "Publishing…" : "Post ↗"}</span>
                </button>
              </div>

              {/* Status Message Feedback */}
              {Object.entries(publishStatus).map(([ch, status]) => (
                status.message || status.error ? (
                  <div
                    key={ch}
                    style={{
                      marginTop: 8,
                      padding: "6px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      background: status.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: status.success ? "#6ee7b7" : "#fca5a5",
                      border: status.success ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                    }}
                  >
                    {status.message || status.error}
                  </div>
                ) : null
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
