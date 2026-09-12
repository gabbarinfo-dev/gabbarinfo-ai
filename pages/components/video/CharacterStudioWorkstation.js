"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import styles from "./CharacterStudioBackground.module.css";

export default function CharacterStudioWorkstation() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email;

  // Characters State
  const [characters, setCharacters] = useState([]);
  const [loadingCharacters, setLoadingCharacters] = useState(true);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Character Form State
  const [newCharName, setNewCharName] = useState("");
  const [newCharArchetype, setNewCharArchetype] = useState("pixar_3d");
  const [newCharTraits, setNewCharTraits] = useState("bright blue jacket, expressive curious eyes, messy dark hair");
  const [newCharBackstory, setNewCharBackstory] = useState("");
  const [newCharVoice, setNewCharVoice] = useState("nova");
  const [creatingCharacter, setCreatingCharacter] = useState(false);

  // Story & Episode Generator State
  const [videoFormat, setVideoFormat] = useState("reel_9_16"); // "reel_9_16" | "youtube_16_9"
  const [language, setLanguage] = useState("hindi"); // "hindi" | "en_us" | "en_uk"
  const [episodeTitle, setEpisodeTitle] = useState("Episode 1: The Secret Discovery");
  const [storyPrompt, setStoryPrompt] = useState("Embarks on a quest through a magical neon city to find an ancient artifact");
  const [generatingStory, setGeneratingStory] = useState(false);
  const [storyStep, setStoryStep] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  // Generated Story Timeline
  const [generatedStory, setGeneratedStory] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);

  // Publishing & Auto-Purge State
  const [publishing, setPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState("");
  const [publishStatus, setPublishStatus] = useState({});
  const [selectedChannels, setSelectedChannels] = useState(["instagram", "facebook", "youtube"]);
  const [storagePurged, setStoragePurged] = useState(false);

  // Refs
  const audioRef = useRef(null);
  const masterVideoUrlRef = useRef(null);
  const masterFilePathRef = useRef(null);

  // Archetype Presets
  const ARCHETYPES = [
    { id: "comic_hero", label: "Comic Book Hero", emoji: "🦸", desc: "Bold Marvel/Spider-Verse comic art & action" },
    { id: "pixar_3d", label: "3D Pixar Animation", emoji: "✨", desc: "Whimsical, friendly, high-detail 3D CGI" },
    { id: "anime_2d", label: "2D Anime Hero", emoji: "⚡", desc: "Crisp lineart, vibrant anime key visual" },
    { id: "storybook_kids", label: "Children's Storybook", emoji: "🧸", desc: "Watercolor, warm nostalgic picture book" },
    { id: "cyberpunk", label: "Cyberpunk Manga", emoji: "🦾", desc: "Neon glows, futuristic gear, cinematic" },
    { id: "photoreal_mascot", label: "Photoreal Mascot", emoji: "🦁", desc: "Ultra-detailed live-action brand character" },
  ];

  // Fetch Client's Private Characters
  const fetchCharacters = async () => {
    try {
      setLoadingCharacters(true);
      const q = userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : "";
      const res = await fetch(`/api/character/list${q}`);
      const data = await res.json();
      if (data.ok && data.characters) {
        setCharacters(data.characters);
        if (data.characters.length > 0 && !selectedCharacter) {
          setSelectedCharacter(data.characters[0]);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch characters:", e);
    } finally {
      setLoadingCharacters(false);
    }
  };

  useEffect(() => {
    fetchCharacters();
  }, [userEmail]);

  // Create Exclusive Character
  const handleCreateCharacter = async (e) => {
    e.preventDefault();
    if (!newCharName.trim()) return;
    setCreatingCharacter(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/character/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCharName,
          archetype: newCharArchetype,
          visualTraits: newCharTraits,
          backstory: newCharBackstory,
          voice: newCharVoice,
          userEmail,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to create character");

      setToastMsg(`🎉 Exclusive Character "${data.character.name}" created and locked in your private vault!`);
      setTimeout(() => setToastMsg(""), 6000);
      setCharacters((prev) => [data.character, ...prev]);
      setSelectedCharacter(data.character);
      setShowCreateModal(false);
      setNewCharName("");
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setCreatingCharacter(false);
    }
  };

  // Delete Character from Vault
  const handleDeleteCharacter = async (char, e) => {
    e.stopPropagation();
    if (!confirm(`Delete exclusive character "${char.name}" from your vault?`)) return;

    try {
      const res = await fetch("/api/character/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: char.id,
          dbMemoryType: char.dbMemoryType,
          userEmail,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to delete character");

      setCharacters((prev) => prev.filter((c) => c.id !== char.id && c.dbId !== char.dbId));
      if (selectedCharacter?.id === char.id) {
        setSelectedCharacter(null);
      }
      setToastMsg(`🗑️ Character "${char.name}" deleted from your vault.`);
      setTimeout(() => setToastMsg(""), 5000);
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  // Generate Story Episode
  const handleGenerateStory = async (e) => {
    e.preventDefault();
    if (!selectedCharacter && characters.length === 0) {
      setErrorMsg("Please create or select an exclusive character first.");
      return;
    }

    setGeneratingStory(true);
    setGeneratedStory(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setErrorMsg("");
    setStoragePurged(false);
    masterVideoUrlRef.current = null;
    masterFilePathRef.current = null;

    try {
      setStoryStep("Writing episodic script and locking character traits...");
      const res = await fetch("/api/character/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: selectedCharacter?.id,
          format: videoFormat,
          storyPrompt,
          episodeTitle,
          language,
          userEmail,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to generate story episode");

      setGeneratedStory(data);
      setToastMsg("🎬 Episode generated! Ready to preview & syndicate.");
      setTimeout(() => setToastMsg(""), 5000);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setGeneratingStory(false);
      setStoryStep("");
    }
  };

  // Bake Master Composite Video
  const compositeAndBakeMaster = async () => {
    if (!generatedStory) return null;
    if (masterVideoUrlRef.current) return masterVideoUrlRef.current;

    const isWidescreen = videoFormat === "youtube_16_9";
    const canvasWidth = isWidescreen ? 1920 : 720;
    const canvasHeight = isWidescreen ? 1080 : 1280;

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContextClass();
    const dest = audioCtx.createMediaStreamDestination();

    // Voiceover Audio
    const voRes = await fetch(generatedStory.voiceoverAudio);
    const voArrBuf = await voRes.arrayBuffer();
    const voBuffer = await audioCtx.decodeAudioData(voArrBuf);

    const voSource = audioCtx.createBufferSource();
    voSource.buffer = voBuffer;
    voSource.connect(dest);

    // Preload Character Image
    const charImg = new Image();
    charImg.crossOrigin = "anonymous";
    charImg.src = generatedStory.character.referenceSheetUrl;
    await new Promise((resolve) => {
      charImg.onload = resolve;
      charImg.onerror = resolve;
      setTimeout(resolve, 3000);
    });

    const canvasStream = canvas.captureStream(30);
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]);

    let mimeType = "video/webm";
    if (typeof MediaRecorder !== "undefined") {
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
        mimeType = "video/webm;codecs=vp9,opus";
      } else if (MediaRecorder.isTypeSupported("video/mp4")) {
        mimeType = "video/mp4";
      }
    }

    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: isWidescreen ? 3500000 : 2000000,
    });

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const totalDuration = generatedStory.totalDuration || voBuffer.duration || 20;
    recorder.start();
    await audioCtx.resume();
    voSource.start(0);

    const startTime = performance.now();
    let animId;

    await new Promise((resolve) => {
      const renderFrame = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        if (elapsed >= totalDuration) {
          cancelAnimationFrame(animId);
          resolve();
          return;
        }

        const scenes = generatedStory.scenes || [];
        const sceneDuration = totalDuration / Math.max(scenes.length, 1);
        const sceneIndex = Math.min(Math.floor(elapsed / sceneDuration), scenes.length - 1);
        const sceneElapsed = elapsed - (sceneIndex * sceneDuration);
        const sceneRatio = Math.max(0, Math.min(1, sceneElapsed / sceneDuration));

        // Draw animated background
        const bgGradient = ctx.createRadialGradient(
          canvasWidth / 2, canvasHeight / 2, 50,
          canvasWidth / 2, canvasHeight / 2, canvasWidth / 1.2
        );
        bgGradient.addColorStop(0, "#1e1b4b");
        bgGradient.addColorStop(0.5, "#0f172a");
        bgGradient.addColorStop(1, "#020617");
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Character Zoom Animation (Ken Burns)
        if (charImg.complete && charImg.naturalWidth > 0) {
          const zoom = 1.0 + (sceneRatio * 0.08);
          const w = canvasWidth * zoom;
          const h = canvasHeight * zoom;
          const x = (canvasWidth - w) / 2;
          const y = (canvasHeight - h) / 2;
          ctx.drawImage(charImg, x, y, w, h);
        }

        // Cinematic Lower Vignette
        const vignetteHeight = isWidescreen ? 360 : 480;
        const vignette = ctx.createLinearGradient(0, canvasHeight - vignetteHeight, 0, canvasHeight);
        vignette.addColorStop(0, "rgba(0,0,0,0)");
        vignette.addColorStop(1, "rgba(0,0,0,0.85)");
        ctx.fillStyle = vignette;
        ctx.fillRect(0, canvasHeight - vignetteHeight, canvasWidth, vignetteHeight);

        // Chapter Badge (Widescreen Long-Form)
        if (isWidescreen && scenes[sceneIndex]?.chapter) {
          ctx.save();
          ctx.font = "800 24px 'Plus Jakarta Sans', sans-serif";
          ctx.fillStyle = "#ec4899";
          ctx.fillText(`CHAPTER ${sceneIndex + 1}: ${scenes[sceneIndex].chapter.toUpperCase()}`, 60, 80);
          ctx.restore();
        }

        // Subtitles
        const activeWordObj = (generatedStory.captions || []).find(
          (c) => elapsed >= c.startTime && elapsed <= c.endTime
        );
        const activeWord = activeWordObj?.original || scenes[sceneIndex]?.text?.slice(0, 35) || "";

        if (activeWord) {
          ctx.save();
          ctx.font = isWidescreen ? "900 48px 'Plus Jakarta Sans', Arial, sans-serif" : "900 36px 'Plus Jakarta Sans', Arial, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const textWidth = ctx.measureText(activeWord.toUpperCase()).width;
          const boxWidth = Math.max(textWidth + 40, 200);
          const boxHeight = isWidescreen ? 80 : 64;
          const boxX = (canvasWidth - boxWidth) / 2;
          const boxY = isWidescreen ? canvasHeight - 120 : canvasHeight - 180;

          ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 14);
          ctx.fill();

          ctx.strokeStyle = "#ec4899";
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.fillText(activeWord.toUpperCase(), canvasWidth / 2, boxY + (boxHeight / 2));
          ctx.restore();
        }

        animId = requestAnimationFrame(renderFrame);
      };

      animId = requestAnimationFrame(renderFrame);
    });

    recorder.stop();
    await audioCtx.close();

    const blob = await new Promise((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType }));
      };
    });

    if (blob.size < 10000) {
      throw new Error(`Master recording empty (${blob.size} bytes).`);
    }

    // Direct Signed Upload
    const signRes = await fetch("/api/video/get-upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: `${selectedCharacter?.name || "character"}_${videoFormat}_master.${mimeType.includes("mp4") ? "mp4" : "webm"}`,
        userEmail,
      }),
    });

    const signData = await signRes.json();
    if (!signRes.ok || !signData.signedUrl) {
      throw new Error(signData.error || "Failed to create upload staging slot.");
    }

    await fetch(signData.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body: blob,
    });

    masterVideoUrlRef.current = signData.publicUrl;
    masterFilePathRef.current = signData.filePath;
    return signData.publicUrl;
  };

  // 1-Click Multi-Channel Publish with Immediate Ephemeral Purge
  const handlePublishAll = async () => {
    if (!generatedStory) return;
    setPublishing(true);
    setStoragePurged(false);

    try {
      setPublishStep("Baking high-resolution master video with subtitles & voice...");
      const videoUrl = await compositeAndBakeMaster();

      const targets = videoFormat === "youtube_16_9" ? ["youtube"] : selectedChannels;

      for (const ch of targets) {
        setPublishStep(`Publishing to ${ch.toUpperCase()}...`);
        setPublishStatus((prev) => ({ ...prev, [ch]: { loading: true } }));

        const res = await fetch("/api/video/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: ch,
            videoUrl,
            title: generatedStory.youtubeTitle || generatedStory.title,
            caption: generatedStory.description || generatedStory.title,
            userEmail,
          }),
        });

        const data = await res.json();
        if (data.ok) {
          setPublishStatus((prev) => ({ ...prev, [ch]: { success: true, url: data.videoUrl } }));
        } else {
          setPublishStatus((prev) => ({ ...prev, [ch]: { error: data.error } }));
        }
      }

      // EPHEMERAL PURGE TRIGGER: Self-destruct temporary storage file
      setPublishStep("Executing ephemeral auto-purge (0 MB net storage)...");
      await fetch("/api/video/cleanup-storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl,
          filePath: masterFilePathRef.current,
          userEmail,
        }),
      });

      setStoragePurged(true);
      setToastMsg("🚀 All channels published live & staging file auto-purged (0 MB storage footprint)!");
      setTimeout(() => setToastMsg(""), 8000);
    } catch (err) {
      console.error("[PublishAll] Error:", err);
      setErrorMsg(err.message);
    } finally {
      setPublishing(false);
      setPublishStep("");
    }
  };

  return (
    <div className={styles.universeContainer}>
      {/* ── BACKGROUND LAYER: AURORAS ── */}
      <div className={styles.auroraLayer}>
        <div className={styles.auroraBlob1} />
        <div className={styles.auroraBlob2} />
        <div className={styles.auroraBlob3} />
      </div>

      {/* ── BACKGROUND LAYER: COMIC HALFTONE DOTS & SPEED RAYS ── */}
      <div className={styles.comicGridOverlay} />
      <div className={styles.comicSpeedRays} />

      {/* ── FOREGROUND WORKSPACE (GLASSMORPHIC) ── */}
      <div className={styles.foregroundWorkspace}>
        {/* Top Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 24 }}>✨</span>
              <h1 style={{ margin: 0, fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 900, background: "linear-gradient(135deg, #f43f5e 0%, #a855f7 50%, #38bdf8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                AI Character Studio & Long-Form Video Engine
              </h1>
              <span style={{ background: "rgba(236, 72, 153, 0.2)", border: "1px solid #ec4899", color: "#f472b6", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 800 }}>
                PRO IP VAULT
              </span>
            </div>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
              Exclusive, consistent client characters for viral 9:16 social reels and full 16:9 YouTube story episodes with zero storage footprint.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {storagePurged && (
              <div style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#6ee7b7", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <span>🛡️ 0 MB Storage Purge Active</span>
              </div>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: "9px 16px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
                border: "none",
                color: "#fff",
                fontWeight: 800,
                fontSize: 12.5,
                cursor: "pointer",
                boxShadow: "0 4px 18px rgba(236, 72, 153, 0.4)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>+ Create Exclusive Character IP</span>
            </button>
          </div>
        </div>

        {/* Comic & Animation Universes Badge Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 20, padding: "10px 16px", borderRadius: 12, background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: 0.5 }}>
            🎨 Supported Animation Styles:
          </span>
          <span style={{ padding: "4px 10px", borderRadius: 20, background: "rgba(236, 72, 153, 0.15)", border: "1px solid #ec4899", color: "#f472b6", fontSize: 11, fontWeight: 700 }}>
            🦸 Comic Book Hero
          </span>
          <span style={{ padding: "4px 10px", borderRadius: 20, background: "rgba(139, 92, 246, 0.15)", border: "1px solid #8b5cf6", color: "#c084fc", fontSize: 11, fontWeight: 700 }}>
            ✨ 3D Pixar Animation
          </span>
          <span style={{ padding: "4px 10px", borderRadius: 20, background: "rgba(59, 130, 246, 0.15)", border: "1px solid #3b82f6", color: "#60a5fa", fontSize: 11, fontWeight: 700 }}>
            ⚡ 2D Shonen Anime
          </span>
          <span style={{ padding: "4px 10px", borderRadius: 20, background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", color: "#34d399", fontSize: 11, fontWeight: 700 }}>
            🧸 Children's Storybook
          </span>
          <span style={{ padding: "4px 10px", borderRadius: 20, background: "rgba(245, 158, 11, 0.15)", border: "1px solid #f59e0b", color: "#fbbf24", fontSize: 11, fontWeight: 700 }}>
            🦾 Cyberpunk Manga
          </span>
        </div>

        {/* Notification Toasts */}
        {toastMsg && (
          <div style={{ padding: "10px 16px", borderRadius: 10, background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981", color: "#a7f3d0", fontSize: 13, marginBottom: 18, fontWeight: 600 }}>
            {toastMsg}
          </div>
        )}

        {errorMsg && (
          <div style={{ padding: "10px 16px", borderRadius: 10, background: "rgba(239, 68, 68, 0.2)", border: "1px solid #ef4444", color: "#fca5a5", fontSize: 13, marginBottom: 18 }}>
            {errorMsg}
          </div>
        )}

        {/* Main Grid: Control Panel (Left) & Preview / Publisher (Right) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: 24 }}>
          {/* ── LEFT COLUMN: CHARACTER VAULT & STORY BUILDER ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Step 1: Select Character IP */}
            <div style={{ background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(14px)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 18, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#cbd5e1" }}>
                  1. SELECT EXCLUSIVE CLIENT CHARACTER
                </span>
                <span style={{ fontSize: 11, color: "#818cf8", fontWeight: 700 }}>
                  🔒 100% Private to Your Account
                </span>
              </div>

              {loadingCharacters ? (
                <div style={{ padding: 20, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                  Loading your private character vault…
                </div>
              ) : characters.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", background: "rgba(255, 255, 255, 0.02)", borderRadius: 12, border: "1px dashed rgba(255, 255, 255, 0.12)" }}>
                  <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: 13 }}>You have no characters created yet.</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    style={{ padding: "8px 16px", borderRadius: 8, background: "#8b5cf6", border: "none", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                  >
                    + Create Your First Character IP
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(135px, 1fr))", gap: 12 }}>
                  {characters.map((char) => {
                    const isSelected = selectedCharacter?.id === char.id;
                    return (
                      <div
                        key={char.id}
                        onClick={() => setSelectedCharacter(char)}
                        style={{
                          borderRadius: 12,
                          padding: 10,
                          background: isSelected ? "rgba(236, 72, 153, 0.18)" : "rgba(255, 255, 255, 0.03)",
                          border: isSelected ? "2px solid #ec4899" : "1px solid rgba(255, 255, 255, 0.08)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          textAlign: "center",
                          position: "relative",
                        }}
                      >
                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCharacter(char, e)}
                          title="Delete this character"
                          style={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            background: "rgba(0, 0, 0, 0.75)",
                            border: "1px solid rgba(239, 68, 68, 0.6)",
                            borderRadius: "50%",
                            width: 24,
                            height: 24,
                            color: "#f87171",
                            fontSize: 11,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 10,
                          }}
                        >
                          ✕
                        </button>

                        <img
                          src={char.referenceSheetUrl}
                          alt={char.name}
                          style={{ width: "100%", height: 100, borderRadius: 8, objectFit: "cover", marginBottom: 8 }}
                        />
                        <div style={{ fontWeight: 800, fontSize: 12.5, color: isSelected ? "#f472b6" : "#f1f5f9" }}>
                          {char.name}
                        </div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>
                          {char.archetype?.replace("_", " ").toUpperCase()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2: Format & Story Concept */}
            <form onSubmit={handleGenerateStory} style={{ background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(14px)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 18, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#cbd5e1", marginBottom: 14 }}>
                2. CHOOSE VIDEO FORMAT & EPISODIC CONCEPT
              </div>

              {/* Format Switcher */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div
                  onClick={() => setVideoFormat("reel_9_16")}
                  style={{
                    padding: "12px",
                    borderRadius: 12,
                    background: videoFormat === "reel_9_16" ? "rgba(236, 72, 153, 0.18)" : "rgba(255, 255, 255, 0.03)",
                    border: videoFormat === "reel_9_16" ? "2px solid #ec4899" : "1px solid rgba(255, 255, 255, 0.08)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 13, color: videoFormat === "reel_9_16" ? "#f472b6" : "#f8fafc" }}>
                    <span>📱 9:16 Social Reel</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                    15–30s fast viral hook for Instagram, FB Reels & YT Shorts.
                  </div>
                </div>

                <div
                  onClick={() => setVideoFormat("youtube_16_9")}
                  style={{
                    padding: "12px",
                    borderRadius: 12,
                    background: videoFormat === "youtube_16_9" ? "rgba(59, 130, 246, 0.18)" : "rgba(255, 255, 255, 0.03)",
                    border: videoFormat === "youtube_16_9" ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.08)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 13, color: videoFormat === "youtube_16_9" ? "#60a5fa" : "#f8fafc" }}>
                    <span>🖥️ 16:9 YouTube Story</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                    3–5 min widescreen story episodes with chapters & progression.
                  </div>
                </div>
              </div>

              {/* Language Selector (Hindi / US English / UK English) */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#f8fafc", marginBottom: 8 }}>
                  🗣️ Spoken Language & Voiceover Accent:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setLanguage("hindi")}
                    style={{
                      padding: "10px 8px",
                      borderRadius: 10,
                      background: language === "hindi" ? "rgba(245, 158, 11, 0.22)" : "rgba(255, 255, 255, 0.03)",
                      border: language === "hindi" ? "2px solid #f59e0b" : "1px solid rgba(255, 255, 255, 0.08)",
                      color: language === "hindi" ? "#fbbf24" : "#cbd5e1",
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>🇮🇳</span>
                    <span>Hindi (हिंदी)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLanguage("en_us")}
                    style={{
                      padding: "10px 8px",
                      borderRadius: 10,
                      background: language === "en_us" ? "rgba(59, 130, 246, 0.22)" : "rgba(255, 255, 255, 0.03)",
                      border: language === "en_us" ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.08)",
                      color: language === "en_us" ? "#60a5fa" : "#cbd5e1",
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>🇺🇸</span>
                    <span>American (US)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLanguage("en_uk")}
                    style={{
                      padding: "10px 8px",
                      borderRadius: 10,
                      background: language === "en_uk" ? "rgba(236, 72, 153, 0.22)" : "rgba(255, 255, 255, 0.03)",
                      border: language === "en_uk" ? "2px solid #ec4899" : "1px solid rgba(255, 255, 255, 0.08)",
                      color: language === "en_uk" ? "#f472b6" : "#cbd5e1",
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>🇬🇧</span>
                    <span>British (UK)</span>
                  </button>
                </div>
              </div>

              {/* Episode Title */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>
                  Episode Title:
                </label>
                <input
                  type="text"
                  value={episodeTitle}
                  onChange={(e) => setEpisodeTitle(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#fff", fontSize: 13 }}
                  required
                />
              </div>

              {/* Story Prompt */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>
                  Story Plot / Mission:
                </label>
                <textarea
                  rows={3}
                  value={storyPrompt}
                  onChange={(e) => setStoryPrompt(e.target.value)}
                  placeholder="Describe the adventure, conflict, or lesson in this episode..."
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#fff", fontSize: 13, resize: "vertical" }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={generatingStory}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: 10,
                  background: videoFormat === "youtube_16_9" ? "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)" : "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
                  border: "none",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: generatingStory ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 20px rgba(139, 92, 246, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span>{generatingStory ? "✨ Writing & Synthesizing Episode…" : "🎬 Generate Episode Script & Narration"}</span>
              </button>

              {generatingStory && (
                <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(139, 92, 246, 0.15)", border: "1px solid rgba(139, 92, 246, 0.3)", color: "#c4b5fd", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>⏳</span>
                  <span>{storyStep}</span>
                </div>
              )}
            </form>
          </div>

          {/* ── RIGHT COLUMN: ADAPTIVE PREVIEW & 1-CLICK PUBLISHER ── */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            {/* Viewport Frame (Adapts between 9:16 Vertical Phone and 16:9 Cinema Monitor) */}
            <div
              style={{
                width: videoFormat === "youtube_16_9" ? "100%" : 290,
                maxWidth: videoFormat === "youtube_16_9" ? 540 : 290,
                height: videoFormat === "youtube_16_9" ? 304 : 540,
                background: "#000",
                borderRadius: videoFormat === "youtube_16_9" ? 18 : 38,
                border: "8px solid #1e293b",
                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(139, 92, 246, 0.2)",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                transition: "all 0.3s ease",
              }}
            >
              {generatedStory ? (
                <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#090d16" }}>
                  <img
                    src={generatedStory.character?.referenceSheetUrl || selectedCharacter?.referenceSheetUrl}
                    alt="Character"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transform: isPlaying ? "scale(1.05)" : "scale(1)",
                      transition: "transform 4s ease-out",
                    }}
                  />

                  {/* Gradient Overlay */}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%)", pointerEvents: "none" }} />

                  {/* Widescreen Chapter Badge */}
                  {videoFormat === "youtube_16_9" && (
                    <div style={{ position: "absolute", top: 12, left: 14, background: "rgba(0, 0, 0, 0.7)", border: "1px solid #3b82f6", color: "#60a5fa", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                      {generatedStory.scenes[activeSceneIndex]?.chapter || "CHAPTER 1"}
                    </div>
                  )}

                  {/* Subtitle Box */}
                  <div style={{ position: "absolute", bottom: videoFormat === "youtube_16_9" ? 24 : 40, left: 16, right: 16, textAlign: "center" }}>
                    <span style={{ display: "inline-block", padding: "6px 14px", borderRadius: 8, background: "rgba(0, 0, 0, 0.8)", border: "1px solid #ec4899", color: "#fff", fontWeight: 900, fontSize: videoFormat === "youtube_16_9" ? 14 : 12, letterSpacing: 0.5 }}>
                      "{generatedStory.scenes[activeSceneIndex]?.text?.slice(0, 45)}..."
                    </span>
                  </div>

                  {/* Playback Controls */}
                  <div style={{ position: "absolute", bottom: 8, right: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (audioRef.current) {
                          if (isPlaying) {
                            audioRef.current.pause();
                            setIsPlaying(false);
                          } else {
                            audioRef.current.play();
                            setIsPlaying(true);
                          }
                        }
                      }}
                      style={{ background: "rgba(255, 255, 255, 0.2)", border: "none", color: "#fff", borderRadius: 999, width: 28, height: 28, cursor: "pointer", fontSize: 12 }}
                    >
                      {isPlaying ? "⏸" : "▶"}
                    </button>
                  </div>

                  <audio
                    ref={audioRef}
                    src={generatedStory.voiceoverAudio}
                    onEnded={() => setIsPlaying(false)}
                    onTimeUpdate={(e) => {
                      const t = e.target.currentTime;
                      setCurrentTime(t);
                      const sIdx = generatedStory.scenes.findIndex((s) => t >= s.startSec && t <= s.endSec);
                      if (sIdx !== -1 && sIdx !== activeSceneIndex) setActiveSceneIndex(sIdx);
                    }}
                  />
                </div>
              ) : (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", color: "#64748b" }}>
                  <span style={{ fontSize: 36, marginBottom: 8 }}>🎭</span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>Adaptive Preview Screen</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    {videoFormat === "youtube_16_9" ? "16:9 Cinematic YouTube Story" : "9:16 Vertical Viral Reel"}
                  </div>
                </div>
              )}
            </div>

            {/* Publishing Controls with Auto-Purge Notice */}
            <div style={{ width: "100%", maxWidth: 540, background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(14px)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 16, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: "#cbd5e1" }}>
                  🚀 SYNDICATION & AUTO-PURGE
                </span>
                <span style={{ fontSize: 10.5, color: "#10b981", fontWeight: 700 }}>
                  ⚡ Self-Destructs from Storage After Post
                </span>
              </div>

              {videoFormat === "reel_9_16" ? (
                <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                  {["instagram", "facebook", "youtube"].map((ch) => (
                    <label key={ch} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: "#e2e8f0", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedChannels.includes(ch)}
                        onChange={() => {
                          setSelectedChannels((prev) =>
                            prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
                          );
                        }}
                        style={{ accentColor: "#ec4899" }}
                      />
                      <span>{ch === "instagram" ? "📸 Instagram" : ch === "facebook" ? "📘 Facebook" : "🔴 YouTube Shorts"}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 14 }}>
                  🔴 Target: <strong>YouTube Long-Form Channel</strong> (Widescreen 16:9 with chapters & descriptions).
                </div>
              )}

              <button
                type="button"
                onClick={handlePublishAll}
                disabled={!generatedStory || publishing}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 10,
                  background: generatedStory ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "rgba(255, 255, 255, 0.05)",
                  border: "none",
                  color: generatedStory ? "#fff" : "#64748b",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: generatedStory && !publishing ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span>{publishing ? "🚀 Baking & Syndicating Live…" : "🚀 Publish Live & Auto-Purge Storage"}</span>
              </button>

              {publishing && (
                <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: "rgba(16, 185, 129, 0.15)", color: "#6ee7b7", fontSize: 11.5, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>⏳</span>
                  <span>{publishStep}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: CREATE EXCLUSIVE CHARACTER IP ── */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 520, background: "#0b1120", border: "1px solid rgba(139, 92, 246, 0.4)", borderRadius: 20, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#fff" }}>
                  Create Exclusive Character IP
                </h3>
                <p style={{ margin: 0, fontSize: 11.5, color: "#94a3b8" }}>
                  Generate a 360° turnaround sheet locked to your private account.
                </p>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: "none", border: "none", color: "#64748b", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <form onSubmit={handleCreateCharacter}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>Character Name:</label>
                <input
                  type="text"
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  placeholder="e.g. Maya, Detective Leo, Cyber Sam"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "#030712", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#fff", fontSize: 13 }}
                  required
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>Animation Archetype:</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {ARCHETYPES.map((arch) => (
                    <div
                      key={arch.id}
                      onClick={() => setNewCharArchetype(arch.id)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: newCharArchetype === arch.id ? "rgba(236, 72, 153, 0.2)" : "rgba(255, 255, 255, 0.02)",
                        border: newCharArchetype === arch.id ? "1.5px solid #ec4899" : "1px solid rgba(255, 255, 255, 0.06)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: "#fff" }}>{arch.emoji} {arch.label}</div>
                      <div style={{ fontSize: 9.5, color: "#94a3b8" }}>{arch.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>Signature Visual Traits:</label>
                <input
                  type="text"
                  value={newCharTraits}
                  onChange={(e) => setNewCharTraits(e.target.value)}
                  placeholder="e.g. red hooded cape, golden goggles, energetic smile"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "#030712", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#fff", fontSize: 13 }}
                  required
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>Voice Personality:</label>
                <select
                  value={newCharVoice}
                  onChange={(e) => setNewCharVoice(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "#030712", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#fff", fontSize: 13 }}
                >
                  <option value="nova">Nova (Warm & Expressive)</option>
                  <option value="shimmer">Shimmer (Charming & Bright)</option>
                  <option value="alloy">Alloy (Dynamic & Friendly)</option>
                  <option value="fable">Fable (British Storyteller)</option>
                  <option value="echo">Echo (Heroic & Energetic)</option>
                  <option value="onyx">Onyx (Deep & Authoritative)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(255, 255, 255, 0.05)", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCharacter}
                  style={{ padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)", border: "none", color: "#fff", fontWeight: 800, cursor: creatingCharacter ? "not-allowed" : "pointer", fontSize: 12.5 }}
                >
                  {creatingCharacter ? "✨ Baking Master Character Sheet…" : "🔒 Lock & Save Character IP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
