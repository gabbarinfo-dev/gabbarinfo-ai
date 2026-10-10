// pages/components/video/CinemaStudio.js
// Next-Gen All-in-One AI Cinema & Video Studio
// Clean Gemini/ChatGPT-style prompt interface with Hosting Media Bridge uploads and Supreme Model orchestration.

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

const PLACEHOLDER_PROMPTS = [
  "Launch commercial for our luxury chronometer watch. Extreme macro glide on gold bezel, dark moody lighting, clockwork ticking sound design, deep cinematic voiceover...",
  "A 3D animated bedtime story about a baby dragon who lost his flame. Whimsical Pixar lighting, gentle orchestral melody, warm and comforting narration...",
  "A 2-character comedy skit between a stressed bakery owner and an AI consultant in a sunny glass studio. Punchy dialogue, warm natural lighting...",
  "An action-packed superhero chase scene on rainy neon Tokyo rooftops. 360-degree rolling camera, sparks flying on impact, cinematic hybrid braam bass drops...",
  "A high-converting B2B SaaS product introduction. 3D floating interface mockup, sleek panning motions, upbeat modern lo-fi beat, authoritative founder tone...",
];

export default function CinemaStudio() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email || "ndantare@gmail.com";

  // Prompt & Options State
  const [promptText, setPromptText] = useState("");
  const [aspectRatio, setAspectRatio] = useState("9:16"); // "9:16" | "16:9"
  const [durationSeconds, setDurationSeconds] = useState(20); // 20 | 30 | 60 | 120 | 300
  const [visualAesthetic, setVisualAesthetic] = useState("photoreal_cinema"); // "photoreal_cinema" | "pixar_3d" | "anime_cel" | "commercial_studio"
  const [workflowType, setWorkflowType] = useState("creative_film"); // "product_ad" | "creative_film" | "character_story" | "episodic_series"
  const [language, setLanguage] = useState("en_us"); // "en_us" | "en_uk" | "hindi" | "auto"
  const [audioMode, setAudioMode] = useState("foley_sfx"); // "foley_sfx" | "music_only" | "voiceover" | "dialogue_lipsync"
  const [selectedCharacter, setSelectedCharacter] = useState("auto"); // "auto" or character ID
  const [characterVault, setCharacterVault] = useState([]);

  // Episodic Series State
  const [seriesList, setSeriesList] = useState([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [showCreateSeriesModal, setShowCreateSeriesModal] = useState(false);
  const [newSeriesTitle, setNewSeriesTitle] = useState("");
  const [newSeriesSynopsis, setNewSeriesSynopsis] = useState("");
  const [newSeriesAesthetic, setNewSeriesAesthetic] = useState("pixar_3d");
  const [newSeriesCoreCharIds, setNewSeriesCoreCharIds] = useState([]);
  const [savingSeries, setSavingSeries] = useState(false);

  // Active Series Object
  const activeSeries = seriesList.find((s) => s.id === selectedSeriesId);

  // Asset Attachment State (Stored on Hosting Media Bridge)
  const [attachedFiles, setAttachedFiles] = useState([]); // [{ name, url, size, type }]
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const fileInputRef = useRef(null);

  // Generation & Player State
  const [generating, setGenerating] = useState(false);
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobStage, setJobStage] = useState("");
  const [jobProgress, setJobProgress] = useState(0);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState(null);
  const [generationError, setGenerationError] = useState(null);

  // Social Publishing State
  const [publishPlatforms, setPublishPlatforms] = useState({
    instagram: true,
    facebook: true,
    youtube: true,
  });
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(null);

  // Rotating placeholder index
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % PLACEHOLDER_PROMPTS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Fetch saved Character Vault items
  useEffect(() => {
    async function loadCharacters() {
      try {
        const res = await fetch(`/api/character/list?userEmail=${encodeURIComponent(userEmail)}`);
        const data = await res.json();
        if (data.ok && Array.isArray(data.characters)) {
          setCharacterVault(data.characters);
        }
      } catch (_) {}
    }
    loadCharacters();
  }, [userEmail]);

  // Fetch Episodic Series
  const loadSeries = async () => {
    try {
      const res = await fetch(`/api/series/list?userEmail=${encodeURIComponent(userEmail)}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.series)) {
        setSeriesList(data.series);
        if (data.series.length > 0 && !selectedSeriesId) {
          setSelectedSeriesId(data.series[0].id);
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadSeries();
  }, [userEmail]);

  // Create new Episodic Series
  const handleSaveSeries = async () => {
    if (!newSeriesTitle.trim()) {
      alert("Please provide a series title");
      return;
    }
    setSavingSeries(true);
    try {
      const selectedChars = characterVault.filter((c) =>
        newSeriesCoreCharIds.includes(c.id || c.name)
      );
      const res = await fetch("/api/series/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSeriesTitle.trim(),
          synopsis: newSeriesSynopsis.trim(),
          visualAesthetic: newSeriesAesthetic,
          coreCharacters: selectedChars,
          userEmail,
        }),
      });
      const data = await res.json();
      if (data.ok && data.series) {
        setSeriesList((prev) => [data.series, ...prev]);
        setSelectedSeriesId(data.series.id);
        setVisualAesthetic(data.series.visualAesthetic || "pixar_3d");
        setShowCreateSeriesModal(false);
        setNewSeriesTitle("");
        setNewSeriesSynopsis("");
        setNewSeriesCoreCharIds([]);
      } else {
        alert(data.error || "Failed to create series");
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingSeries(false);
    }
  };

  // Handle direct file upload to Hosting Media Bridge (gabbarinfo.com)
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploadingAsset(true);
    for (const file of files) {
      try {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.readAsDataURL(file);
        });
        const base64 = await base64Promise;

        const res = await fetch("/api/video/upload-asset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            base64,
            userEmail,
          }),
        });

        const data = await res.json();
        if (data.ok && data.url) {
          setAttachedFiles((prev) => [
            ...prev,
            {
              name: file.name,
              url: data.url,
              size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
              type: file.type.startsWith("image/") ? "image" : "doc",
            },
          ]);
        }
      } catch (err) {
        console.error("Asset upload error:", err);
      }
    }
    setUploadingAsset(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachedFile = (idx) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Dispatch Master Video Generation
  const handleGenerate = async () => {
    if (!promptText.trim() && !attachedFiles.length) {
      alert("Please enter a creative vision or drop an asset to begin.");
      return;
    }

    setGenerating(true);
    setGenerationError(null);
    setGeneratedVideoUrl(null);
    setJobProgress(10);
    setJobStage("Dispatching brief to GabbarInfo AI Video Engine...");

    try {
      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText.trim(),
          aspectRatio,
          format: aspectRatio,
          durationSeconds,
          workflowType,
          visualAesthetic,
          language,
          audioMode,
          seriesId: workflowType === "episodic_series" ? selectedSeriesId : null,
          episodeNumber: workflowType === "episodic_series" ? episodeNumber : null,
          attachedAssets: attachedFiles.map((f) => f.url),
          characterId: selectedCharacter !== "auto" ? selectedCharacter : null,
          userEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Generation dispatch failed");
      }

      setActiveJobId(data.jobId);
      pollJobStatus(data.jobId);
    } catch (err) {
      setGenerating(false);
      setGenerationError(err.message);
    }
  };

  // Poll Worker Job Status
  const pollJobStatus = async (jobId) => {
    const startTime = Date.now();
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/video/job-status?jobId=${jobId}`);
        const data = await res.json();

        if (data.ok) {
          if (data.progress) setJobProgress(data.progress);
          if (data.stage) setJobStage(data.stage);

          if (data.status === "completed" && data.videoUrl) {
            clearInterval(interval);
            setGeneratedVideoUrl(data.videoUrl);
            setGenerating(false);
            setJobProgress(100);
            setJobStage("Master video rendered successfully!");
          } else if (data.status === "failed") {
            clearInterval(interval);
            setGenerating(false);
            setGenerationError(data.error || "Generation encountered an issue.");
          }
        }
      } catch (_) {}

      if (Date.now() - startTime > 18 * 60 * 1000) {
        clearInterval(interval);
        setGenerating(false);
        setGenerationError("Video is taking longer than usual to assemble. Please refresh or check back shortly.");
      }
    }, 4000);
  };

  // 1-Click Multi-Platform Publish
  const handlePublish = async () => {
    if (!generatedVideoUrl) return;
    setPublishing(true);
    setPublishSuccess(null);

    try {
      const res = await fetch("/api/video/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: generatedVideoUrl,
          caption: promptText.slice(0, 200) || "Created with GabbarInfo AI Cinema Studio",
          platforms: publishPlatforms,
          userEmail,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setPublishSuccess("Successfully syndicated to selected social platforms!");
      } else {
        throw new Error(data.error || "Syndication failed");
      }
    } catch (e) {
      alert("Publish notice: " + e.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div
      style={{
        padding: "clamp(16px, 3vw, 32px)",
        maxWidth: 1600,
        margin: "0 auto",
        color: "#f8fafc",
        fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
      }}
    >
      {/* Studio Header */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 12px", borderRadius: 20, background: "rgba(99, 102, 241, 0.15)", border: "1px solid rgba(99, 102, 241, 0.3)", color: "#818cf8", fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>
            <span>👑</span> Supreme Multi-Model Video Engine
          </div>
          <h1 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 900, letterSpacing: -0.8, color: "#fff", margin: 0 }}>
            AI Cinema & Video Studio
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14.5, marginTop: 6, margin: 0 }}>
            Direct autonomous commercial ads, children's 3D stories, or cinematic films from a single command.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "#34d399", fontWeight: 600 }}>
            ● GabbarInfo AI Video Engine Online
          </span>
        </div>
      </div>

      {/* Main 2-Column Studio Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 540px), 1fr))",
          gap: 28,
          alignItems: "start",
        }}
      >
        {/* LEFT COLUMN: THE SUPREME COMMAND CARD */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              background: "linear-gradient(180deg, rgba(15, 23, 42, 0.85) 0%, rgba(10, 15, 30, 0.95) 100%)",
              border: "1px solid rgba(99, 102, 241, 0.25)",
              borderRadius: 24,
              padding: "clamp(20px, 3vw, 28px)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
              position: "relative",
              backdropFilter: "blur(16px)",
            }}
          >
            {/* Asset Drag & Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed rgba(99, 102, 241, 0.35)",
                borderRadius: 16,
                padding: "16px 20px",
                background: "rgba(15, 23, 42, 0.4)",
                cursor: "pointer",
                marginBottom: 18,
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(99, 102, 241, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  📎
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#f8fafc" }}>
                    {uploadingAsset ? "Uploading directly to hosting media bridge..." : "Drop Product Photos, Logos, or Briefs"}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    Stores on your web hosting. Preserves your exact product without AI distortion.
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn-gabbar-secondary"
                style={{ padding: "6px 14px", fontSize: 12, borderRadius: 8, pointerEvents: "none" }}
              >
                + Browse Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.docx,.xlsx,.txt"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </div>

            {/* Attached Assets Chips */}
            {attachedFiles.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {attachedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 12px",
                      borderRadius: 10,
                      background: "rgba(99, 102, 241, 0.15)",
                      border: "1px solid rgba(99, 102, 241, 0.3)",
                      fontSize: 12,
                      color: "#e2e8f0",
                    }}
                  >
                    <span>{file.type === "image" ? "🖼️" : "📄"}</span>
                    <span style={{ fontWeight: 600, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachedFile(idx)}
                      style={{ background: "transparent", border: "none", color: "#f43f5e", cursor: "pointer", padding: "0 2px", fontWeight: "bold" }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Episodic Series Control Banner (Appears when Episodic Series is active) */}
            {workflowType === "episodic_series" && (
              <div
                style={{
                  marginBottom: 16,
                  padding: "14px 18px",
                  borderRadius: 16,
                  background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.12) 100%)",
                  border: "1px solid rgba(139, 92, 246, 0.35)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>📺</span>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>Episodic Series Workflow</span>
                      <span style={{ fontSize: 11.5, color: "#cbd5e1", marginLeft: 8 }}>
                        Persistent cast stays locked; each episode has a complete story & auto-casts new guest characters.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateSeriesModal(true)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 8,
                      background: "rgba(139, 92, 246, 0.25)",
                      border: "1px solid rgba(139, 92, 246, 0.45)",
                      color: "#e0e7ff",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    + Create New Series
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={{ fontSize: 10.5, fontWeight: 700, color: "#a5b4fc", textTransform: "uppercase", display: "block", marginBottom: 3 }}>
                      Active Show / Series
                    </label>
                    <select
                      value={selectedSeriesId}
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          setShowCreateSeriesModal(true);
                        } else {
                          setSelectedSeriesId(e.target.value);
                          const found = seriesList.find((s) => s.id === e.target.value);
                          if (found?.visualAesthetic) setVisualAesthetic(found.visualAesthetic);
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "rgba(15, 23, 42, 0.85)",
                        border: "1px solid rgba(139, 92, 246, 0.3)",
                        color: "#fff",
                        fontSize: 12,
                        outline: "none",
                      }}
                    >
                      {seriesList.length === 0 ? (
                        <option value="">(No series found — Click + Create New Series)</option>
                      ) : (
                        seriesList.map((s) => (
                          <option key={s.id} value={s.id}>
                            🎬 {s.title} ({s.visualAesthetic === "pixar_3d" ? "Pixar 3D" : "Photoreal"})
                          </option>
                        ))
                      )}
                      <option value="__new__">+ Create New Series...</option>
                    </select>
                  </div>

                  <div style={{ width: 110 }}>
                    <label style={{ fontSize: 10.5, fontWeight: 700, color: "#a5b4fc", textTransform: "uppercase", display: "block", marginBottom: 3 }}>
                      Episode #
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={episodeNumber}
                      onChange={(e) => setEpisodeNumber(Number(e.target.value) || 1)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "rgba(15, 23, 42, 0.85)",
                        border: "1px solid rgba(139, 92, 246, 0.3)",
                        color: "#fff",
                        fontSize: 12,
                        outline: "none",
                      }}
                    />
                  </div>

                  {activeSeries && activeSeries.coreCharacters?.length > 0 && (
                    <div style={{ flex: "2 1 240px" }}>
                      <label style={{ fontSize: 10.5, fontWeight: 700, color: "#a5b4fc", textTransform: "uppercase", display: "block", marginBottom: 3 }}>
                        Locked Core Cast
                      </label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {activeSeries.coreCharacters.map((c) => (
                          <span
                            key={c.id || c.name}
                            style={{
                              fontSize: 11,
                              padding: "4px 8px",
                              borderRadius: 6,
                              background: "rgba(34, 197, 94, 0.15)",
                              border: "1px solid rgba(34, 197, 94, 0.35)",
                              color: "#86efac",
                              fontWeight: 600,
                            }}
                          >
                            🔒 {c.name}
                          </span>
                        ))}
                        <span style={{ fontSize: 10.5, color: "#cbd5e1", alignSelf: "center" }}>
                          + prompt guest actors
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Gemini-Style Multi-Line Prompt Box */}
            <div style={{ position: "relative", marginBottom: 18 }}>
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder={PLACEHOLDER_PROMPTS[placeholderIdx]}
                rows={4}
                style={{
                  width: "100%",
                  background: "rgba(7, 10, 20, 0.75)",
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  borderRadius: 16,
                  padding: "16px 18px",
                  color: "#fff",
                  fontSize: 14.5,
                  lineHeight: 1.6,
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  transition: "border-color 0.2s ease",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(99, 102, 241, 0.6)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(148, 163, 184, 0.2)")}
              />
            </div>

            {/* The 5 Inline Smart Pills */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 10,
                marginBottom: 22,
              }}
            >
              {/* 1. Format Pill */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
                  Aspect Ratio
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, background: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(99, 102, 241, 0.25)", color: "#fff", fontSize: 12.5, outline: "none" }}
                >
                  <option value="9:16">📱 9:16 Reel / Short</option>
                  <option value="16:9">🖥️ 16:9 YouTube Cinema</option>
                </select>
              </div>

              {/* 2. Duration Pill */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
                  Duration
                </label>
                <select
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value))}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, background: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(99, 102, 241, 0.25)", color: "#fff", fontSize: 12.5, outline: "none" }}
                >
                  <option value={20}>⏱️ 20s (Cinematic Reel / Short)</option>
                  <option value={30}>⏱️ 30s (Commercial Ad)</option>
                  <option value={60}>⏱️ 60s (Complete Story)</option>
                  <option value={120}>⏱️ 2 Mins (Docu / Explainer)</option>
                  <option value={300}>⏱️ 5 Mins (Episodic Film)</option>
                </select>
              </div>

              {/* 3. Visual Aesthetic Pill */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
                  Visual Aesthetic
                </label>
                <select
                  value={visualAesthetic}
                  onChange={(e) => setVisualAesthetic(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, background: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(99, 102, 241, 0.25)", color: "#fff", fontSize: 12.5, outline: "none" }}
                >
                  <option value="photoreal_cinema">🎬 Photoreal Cinema</option>
                  <option value="pixar_3d">🧸 3D Pixar Animation</option>
                  <option value="anime_cel">🎌 Anime & Cel-Shaded</option>
                  <option value="commercial_studio">🎥 Commercial Studio</option>
                </select>
              </div>

              {/* 4. Production Mode Pill */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
                  Production Mode
                </label>
                <select
                  value={workflowType}
                  onChange={(e) => setWorkflowType(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, background: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(99, 102, 241, 0.25)", color: "#fff", fontSize: 12.5, outline: "none" }}
                >
                  <option value="product_ad">🏷️ Real Product Ad</option>
                  <option value="creative_film">🎬 Creative Cinema Film</option>
                  <option value="character_story">📖 Standalone Story</option>
                  <option value="episodic_series">📺 Episodic Series</option>
                </select>
              </div>

              {/* 5. Character Cast Vault Pill */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
                  Character Cast
                </label>
                <select
                  value={selectedCharacter}
                  onChange={(e) => setSelectedCharacter(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, background: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(99, 102, 241, 0.25)", color: "#fff", fontSize: 12.5, outline: "none" }}
                >
                  <option value="auto">✨ Auto-Cast from Prompt</option>
                  {characterVault.map((c) => (
                    <option key={c.id || c.name} value={c.id || c.name}>
                      👤 {c.name} ({c.archetype || "Saved IP"})
                    </option>
                  ))}
                </select>
              </div>

              {/* 6. Audio Track Mode Pill */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
                  Audio Track
                </label>
                <select
                  value={audioMode}
                  onChange={(e) => setAudioMode(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, background: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(99, 102, 241, 0.25)", color: "#fff", fontSize: 12.5, outline: "none" }}
                >
                  <option value="foley_sfx">🎬 Foley Sound FX (Engines, Brakes, Punches + Score)</option>
                  <option value="music_only">🎵 Background Music Only</option>
                  <option value="voiceover">🎙️ Voiceover + Music</option>
                  <option value="dialogue_lipsync">🗣️ Character Dialogue & Lip-Sync</option>
                </select>
              </div>

              {/* 7. Language Pill */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={audioMode === "music_only" || audioMode === "foley_sfx"}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 10,
                    background: (audioMode === "music_only" || audioMode === "foley_sfx") ? "rgba(15, 23, 42, 0.4)" : "rgba(15, 23, 42, 0.9)",
                    border: "1px solid rgba(99, 102, 241, 0.25)",
                    color: (audioMode === "music_only" || audioMode === "foley_sfx") ? "#64748b" : "#fff",
                    fontSize: 12.5,
                    outline: "none"
                  }}
                >
                  <option value="en_us">🇺🇸 English (US)</option>
                  <option value="en_uk">🇬🇧 English (UK)</option>
                  <option value="hindi">🇮🇳 Hindi (हिंदी)</option>
                  <option value="auto">🌐 Auto-Detect</option>
                </select>
              </div>
            </div>

            {/* Master Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                width: "100%",
                padding: "14px 24px",
                borderRadius: 14,
                background: generating
                  ? "rgba(99, 102, 241, 0.5)"
                  : "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
                border: "none",
                color: "#fff",
                fontSize: 15,
                fontWeight: 800,
                cursor: generating ? "not-allowed" : "pointer",
                boxShadow: "0 10px 30px rgba(99, 102, 241, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
            >
              {generating ? (
                <>
                  <div style={{ width: 18, height: 18, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  Directing Cinema Pipeline… ({jobProgress}%)
                </>
              ) : (
                <>🚀 Generate Master Video</>
              )}
            </button>

            {/* Error Banner */}
            {generationError && (
              <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 12, background: "rgba(244, 63, 94, 0.15)", border: "1px solid rgba(244, 63, 94, 0.3)", color: "#fca5a5", fontSize: 13 }}>
                ⚠️ {generationError}
              </div>
            )}

            {/* Active Pipeline Stage Progress */}
            {generating && (
              <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "rgba(7, 10, 20, 0.6)", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
                  <span>{jobStage || "Processing..."}</span>
                  <span style={{ fontWeight: 700, color: "#818cf8" }}>{jobProgress}%</span>
                </div>
                <div style={{ width: "100%", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ width: `${jobProgress}%`, height: "100%", background: "linear-gradient(90deg, #6366f1, #ec4899)", transition: "width 0.4s ease" }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ADAPTIVE 4K PREVIEW PLAYER & 1-CLICK PUBLISHER */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              background: "linear-gradient(180deg, rgba(15, 23, 42, 0.85) 0%, rgba(10, 15, 30, 0.95) 100%)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 24,
              padding: "clamp(20px, 3vw, 28px)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                🎥 Master Video Preview
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                {aspectRatio === "9:16" ? "9:16 Vertical Reel" : "16:9 Cinema Landscape"}
              </span>
            </div>

            {/* Video Screen Container */}
            <div
              style={{
                width: "100%",
                maxWidth: aspectRatio === "9:16" ? 320 : 540,
                aspectRatio: aspectRatio === "9:16" ? "9 / 16" : "16 / 9",
                background: "#000",
                borderRadius: 20,
                border: "2px solid rgba(99, 102, 241, 0.3)",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                boxShadow: "0 15px 35px rgba(0,0,0,0.7)",
              }}
            >
              {generatedVideoUrl ? (
                <video
                  src={generatedVideoUrl}
                  controls
                  autoPlay
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div style={{ textAlign: "center", padding: 24, color: "#64748b" }}>
                  <div style={{ fontSize: 42, marginBottom: 12 }}>🎬</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>
                    {generating ? "AI Engine Rendering Master Footage…" : "Ready for Generation"}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    {generating ? "Applying camera rolling & kinetic subtitles" : "Your 1080p final render will appear here"}
                  </div>
                </div>
              )}
            </div>

            {/* 1-Click Multi-Platform Syndication Section */}
            {generatedVideoUrl && (
              <div style={{ width: "100%", marginTop: 22, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 10 }}>
                  🚀 1-Click Syndication & Auto-Post
                </div>

                <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: "#cbd5e1" }}>
                    <input
                      type="checkbox"
                      checked={publishPlatforms.instagram}
                      onChange={(e) => setPublishPlatforms((p) => ({ ...p, instagram: e.target.checked }))}
                    />
                    Instagram Reels
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: "#cbd5e1" }}>
                    <input
                      type="checkbox"
                      checked={publishPlatforms.facebook}
                      onChange={(e) => setPublishPlatforms((p) => ({ ...p, facebook: e.target.checked }))}
                    />
                    Facebook Page
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: "#cbd5e1" }}>
                    <input
                      type="checkbox"
                      checked={publishPlatforms.youtube}
                      onChange={(e) => setPublishPlatforms((p) => ({ ...p, youtube: e.target.checked }))}
                    />
                    YouTube Shorts
                  </label>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    style={{
                      flex: 1,
                      padding: "11px 18px",
                      borderRadius: 10,
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      border: "none",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: publishing ? "not-allowed" : "pointer",
                    }}
                  >
                    {publishing ? "Publishing Live..." : "🚀 Publish Live to Connected Channels"}
                  </button>

                  <a
                    href={generatedVideoUrl}
                    download="cinema_master_video.mp4"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: "11px 16px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#fff",
                      fontSize: 13,
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      fontWeight: 600,
                    }}
                  >
                    ⬇️ Download
                  </a>
                </div>

                {publishSuccess && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#34d399", fontWeight: 600 }}>
                    ✅ {publishSuccess}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* CREATE NEW SERIES MODAL */}
      {showCreateSeriesModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(8px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "linear-gradient(180deg, #0f172a 0%, #0a0f1e 100%)",
              border: "1px solid rgba(139, 92, 246, 0.35)",
              borderRadius: 20,
              padding: 28,
              width: "100%",
              maxWidth: 520,
              boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>📺</span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>Create New Episodic Series</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateSeriesModal(false)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer" }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                  Series / Show Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. The Neon Detectives, Dragon's Tale"
                  value={newSeriesTitle}
                  onChange={(e) => setNewSeriesTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    color: "#fff",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                  Visual Aesthetic
                </label>
                <select
                  value={newSeriesAesthetic}
                  onChange={(e) => setNewSeriesAesthetic(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    color: "#fff",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="pixar_3d">🧸 3D Pixar Animation (Stylized CGI)</option>
                  <option value="photoreal_cinema">🎬 Photoreal Cinema (Live-Action / Arri Alexa)</option>
                  <option value="anime_cel">🎌 Anime & Cel-Shaded (Makoto Shinkai style)</option>
                  <option value="commercial_studio">🎥 Commercial Studio Grade</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                  World Bible / Premise (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Two quirky detectives solving technological crimes in neo-Tokyo..."
                  value={newSeriesSynopsis}
                  onChange={(e) => setNewSeriesSynopsis(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    color: "#fff",
                    fontSize: 12.5,
                    outline: "none",
                    boxSizing: "border-box",
                    resize: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
                  Select Recurring Core Cast (Locked across all episodes)
                </label>
                {characterVault.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", padding: "8px 0" }}>
                    No saved characters in vault yet. Guest actors will auto-cast per episode from your prompts.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxHeight: 120, overflowY: "auto" }}>
                    {characterVault.map((c) => {
                      const cid = c.id || c.name;
                      const isSelected = newSeriesCoreCharIds.includes(cid);
                      return (
                        <div
                          key={cid}
                          onClick={() => {
                            setNewSeriesCoreCharIds((prev) =>
                              isSelected ? prev.filter((id) => id !== cid) : [...prev, cid]
                            );
                          }}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: isSelected ? "rgba(34, 197, 94, 0.2)" : "rgba(255, 255, 255, 0.05)",
                            border: isSelected ? "1px solid rgba(34, 197, 94, 0.5)" : "1px solid rgba(255, 255, 255, 0.1)",
                            cursor: "pointer",
                            fontSize: 12,
                            color: isSelected ? "#86efac" : "#cbd5e1",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span>{isSelected ? "✅" : "👤"}</span>
                          <span style={{ fontWeight: 600 }}>{c.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateSeriesModal(false)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.08)",
                    border: "none",
                    color: "#cbd5e1",
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSeries}
                  disabled={savingSeries}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
                    border: "none",
                    color: "#fff",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: savingSeries ? "not-allowed" : "pointer",
                  }}
                >
                  {savingSeries ? "Saving..." : "Create Series"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
