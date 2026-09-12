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
  const [batchPublishing, setBatchPublishing] = useState(false);

  // Channel Connection States & Preferences
  const [youtubeStatus, setYoutubeStatus] = useState({ connected: false, channel: null, loading: true });
  const [metaStatus, setMetaStatus] = useState({ connected: false, meta: null, loading: true });
  const [selectedChannels, setSelectedChannels] = useState(["instagram", "facebook", "youtube"]);
  const [autopilotChannels, setAutopilotChannels] = useState({ instagram: true, facebook: true, youtube: true });
  const [autopilotCadence, setAutopilotCadence] = useState("daily");
  const [toastMsg, setToastMsg] = useState("");
  const [autopilotSaving, setAutopilotSaving] = useState(false);
  const [compositing, setCompositing] = useState(false);
  const [compositingStep, setCompositingStep] = useState("");

  const refreshChannelStatuses = async () => {
    try {
      const [ytRes, metaRes] = await Promise.all([
        fetch("/api/youtube/status").then((r) => r.json()).catch(() => ({ connected: false })),
        fetch("/api/meta/status").then((r) => r.json()).catch(() => ({ connected: false })),
      ]);
      setYoutubeStatus({ connected: !!ytRes.connected, channel: ytRes.channel || null, loading: false });
      setMetaStatus({ connected: !!metaRes.connected, meta: metaRes.meta || null, loading: false });
    } catch (_) {
      setYoutubeStatus((prev) => ({ ...prev, loading: false }));
      setMetaStatus((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    refreshChannelStatuses();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("youtube_connected")) {
        setToastMsg(`✅ YouTube Channel "${params.get("channel") || "Authorized"}" connected successfully!`);
        setTimeout(() => setToastMsg(""), 7000);
      } else if (params.get("youtube_error")) {
        setErrorMsg(`YouTube Connection Failed: ${params.get("youtube_error")}`);
      }
    }
  }, []);

  const handleDisconnectYouTube = async () => {
    if (!confirm("Disconnect your YouTube channel from Reels Studio?")) return;
    try {
      await fetch("/api/youtube/disconnect", { method: "POST" });
      setYoutubeStatus({ connected: false, channel: null, loading: false });
      setToastMsg("YouTube Channel disconnected.");
      setTimeout(() => setToastMsg(""), 4000);
    } catch (e) {
      alert("Failed to disconnect: " + e.message);
    }
  };

  const toggleChannelSelection = (ch) => {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const handlePublishSelected = async () => {
    if (!generatedVideo || selectedChannels.length === 0 || batchPublishing) return;
    setBatchPublishing(true);
    try {
      for (const ch of selectedChannels) {
        await handlePublish(ch);
      }
    } finally {
      setBatchPublishing(false);
    }
  };

  const handleSaveAutopilot = async () => {
    setAutopilotSaving(true);
    try {
      const activeChannels = Object.entries(autopilotChannels)
        .filter(([_, active]) => active)
        .map(([ch]) => ch);

      const res = await fetch("/api/video/save-autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          channels: activeChannels,
          cadence: autopilotCadence,
          niche,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setToastMsg(`⚡ Autopilot configured for: ${activeChannels.join(", ")} (${autopilotCadence})`);
        setTimeout(() => setToastMsg(""), 6000);
      } else {
        alert("Failed to save autopilot: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Failed to save autopilot: " + err.message);
    } finally {
      setAutopilotSaving(false);
    }
  };

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
      if (bgMusicRef.current) {
        bgMusicRef.current.volume = 0.15;
        bgMusicRef.current.play().catch((err) => console.warn("Background music play error:", err));
      }
      if (videoPlayerRef.current) {
        videoPlayerRef.current.play().catch(console.warn);
      }
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

  // Master In-Browser Video & Audio Compositor Engine
  const compositeAndBakeVideo = async () => {
    if (!generatedVideo) return null;
    if (generatedVideo.compositeVideoUrl) return generatedVideo.compositeVideoUrl;

    setCompositing(true);
    setCompositingStep("Initializing Master Audio & Video Compositor...");

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 1280;
      const ctx = canvas.getContext("2d");

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const dest = audioCtx.createMediaStreamDestination();

      // Step 1: Decode Voiceover Audio into Memory Buffer
      setCompositingStep("Decoding studio voiceover...");
      let voBuffer;
      if (generatedVideo.voiceoverUrl.startsWith("data:")) {
        const base64Data = generatedVideo.voiceoverUrl.split(",")[1];
        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        voBuffer = await audioCtx.decodeAudioData(bytes.buffer);
      } else {
        const voRes = await fetch(generatedVideo.voiceoverUrl);
        const voArrBuf = await voRes.arrayBuffer();
        voBuffer = await audioCtx.decodeAudioData(voArrBuf);
      }

      // Step 2: Decode Background Music into Memory Buffer
      setCompositingStep("Mixing background soundtrack...");
      let bgBuffer = null;
      try {
        const bgRes = await fetch(generatedVideo.backgroundMusicUrl || "/audio/upbeat_lofi.mp3");
        if (bgRes.ok) {
          const bgArrBuf = await bgRes.arrayBuffer();
          bgBuffer = await audioCtx.decodeAudioData(bgArrBuf);
        }
      } catch (bgErr) {
        console.warn("[VideoStudio] Background music load warning:", bgErr);
      }

      const voSource = audioCtx.createBufferSource();
      voSource.buffer = voBuffer;
      voSource.connect(dest);

      let bgSource = null;
      if (bgBuffer) {
        bgSource = audioCtx.createBufferSource();
        bgSource.buffer = bgBuffer;
        bgSource.loop = true;
        const bgGain = audioCtx.createGain();
        bgGain.gain.value = 0.15; // Duck music to 15% so voiceover is loud & clear
        bgSource.connect(bgGain);
        bgGain.connect(dest);
      }

      // Step 3: Preload all video scenes into local memory Blobs to guarantee 0% CORS taint
      setCompositingStep("Preloading HD video clips into memory...");
      const videoElements = await Promise.all(
        (generatedVideo.scenes || []).map(async (scene) => {
          const v = document.createElement("video");
          v.muted = true;
          v.playsInline = true;
          v.preload = "auto";
          try {
            const fetchRes = await fetch(scene.videoUrl);
            if (fetchRes.ok) {
              const blob = await fetchRes.blob();
              v.src = URL.createObjectURL(blob);
            } else {
              v.crossOrigin = "anonymous";
              v.src = scene.videoUrl;
            }
          } catch {
            v.crossOrigin = "anonymous";
            v.src = scene.videoUrl;
          }

          await new Promise((resolve) => {
            v.onloadeddata = resolve;
            v.onerror = resolve;
            setTimeout(resolve, 4000);
          });
          return v;
        })
      );

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
        videoBitsPerSecond: 1800000,
      });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const totalDuration = generatedVideo.totalDuration || voBuffer.duration || 15;
      recorder.start();

      await audioCtx.resume();
      voSource.start(0);
      if (bgSource) bgSource.start(0);

      setCompositingStep("Baking subtitles, voice & music into master video...");

      let animId;
      const startTime = performance.now();

      await new Promise((resolve) => {
        const renderFrame = () => {
          const elapsed = (performance.now() - startTime) / 1000;

          if (elapsed >= totalDuration) {
            cancelAnimationFrame(animId);
            resolve();
            return;
          }

          const scenes = generatedVideo.scenes || [];
          const sceneIndex = Math.min(
            Math.floor((elapsed / totalDuration) * scenes.length),
            scenes.length - 1
          );
          const currentVid = videoElements[sceneIndex];

          if (currentVid && currentVid.readyState >= 2) {
            if (currentVid.paused) currentVid.play().catch(() => {});
            ctx.drawImage(currentVid, 0, 0, 720, 1280);
          } else {
            ctx.fillStyle = "#090d16";
            ctx.fillRect(0, 0, 720, 1280);
          }

          // Dark lower third vignette for subtitle contrast
          const vignette = ctx.createLinearGradient(0, 800, 0, 1280);
          vignette.addColorStop(0, "rgba(0,0,0,0)");
          vignette.addColorStop(1, "rgba(0,0,0,0.85)");
          ctx.fillStyle = vignette;
          ctx.fillRect(0, 800, 720, 480);

          // Kinetic Subtitles
          const activeWordObj = (generatedVideo.captions || []).find(
            (c) => elapsed >= c.startTime && elapsed <= c.endTime
          );
          const activeWord = activeWordObj?.original || scenes[sceneIndex]?.text?.slice(0, 26) || "";

          if (activeWord) {
            ctx.save();
            ctx.font = "900 36px 'Plus Jakarta Sans', Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            const textWidth = ctx.measureText(activeWord.toUpperCase()).width;
            const boxWidth = Math.max(textWidth + 36, 180);
            const boxHeight = 60;
            const boxX = (720 - boxWidth) / 2;
            const boxY = 1040;

            ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
            if (ctx.roundRect) {
              ctx.beginPath();
              ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 14);
              ctx.fill();
            } else {
              ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
            }

            ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.shadowColor = "rgba(250, 204, 21, 0.85)";
            ctx.shadowBlur = 14;
            ctx.fillStyle = "#facc15";
            ctx.fillText(activeWord.toUpperCase(), 360, boxY + boxHeight / 2);
            ctx.restore();
          }

          animId = requestAnimationFrame(renderFrame);
        };

        animId = requestAnimationFrame(renderFrame);
      });

      recorder.stop();
      try { voSource.stop(); } catch {}
      try { if (bgSource) bgSource.stop(); } catch {}
      audioCtx.close().catch(() => {});
      videoElements.forEach((v) => {
        try { v.pause(); } catch {}
      });

      setCompositingStep("Uploading master video with burned audio & subtitles…");

      const blob = await new Promise((resolve) => {
        recorder.onstop = () => {
          const finalBlob = new Blob(chunks, { type: mimeType });
          resolve(finalBlob);
        };
      });

      console.log(`[VideoStudio] Composite baked successfully: ${blob.size} bytes (${mimeType})`);

      // Step 4: Get direct signed upload URL (bypasses Vercel 4.5MB limit completely)
      const signRes = await fetch("/api/video/get-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: `master_reel_${Date.now()}.${mimeType.includes("mp4") ? "mp4" : "webm"}`,
        }),
      });
      const signData = await signRes.json();
      if (!signRes.ok || !signData.ok || !signData.signedUrl) {
        throw new Error(signData.error || "Failed to create storage upload URL.");
      }

      // Step 5: Direct Binary Upload to Supabase Storage
      const putRes = await fetch(signData.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": mimeType,
        },
        body: blob,
      });

      if (!putRes.ok) {
        throw new Error(`Failed to upload video to cloud storage (${putRes.status})`);
      }

      console.log("[VideoStudio] Master composite uploaded successfully:", signData.publicUrl);

      const blobUrl = URL.createObjectURL(blob);
      setGeneratedVideo((prev) => ({
        ...prev,
        compositeVideoUrl: signData.publicUrl,
        compositeBlobUrl: blobUrl,
      }));

      return signData.publicUrl;
    } catch (err) {
      console.error("[VideoStudio] Compositing failed:", err);
      alert("Compositing error: " + err.message);
      throw err;
    } finally {
      setCompositing(false);
      setCompositingStep("");
    }
  };

  // 1-Click Multi-Channel Publisher
  const handlePublish = async (channel) => {
    if (!generatedVideo) return;
    setPublishingChannel(channel);
    setPublishStatus((prev) => ({ ...prev, [channel]: { loading: true } }));

    try {
      // Step 1: Ensure real master composite video with burned subtitles & audio is ready
      let videoUrlToPublish = generatedVideo.compositeVideoUrl;
      if (!videoUrlToPublish) {
        videoUrlToPublish = await compositeAndBakeVideo();
      }

      if (!videoUrlToPublish) {
        throw new Error("Unable to bake master composite video.");
      }

      const res = await fetch("/api/video/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          videoUrl: videoUrlToPublish,
          title: generatedVideo.title || topic,
          caption: generatedVideo.caption || topic,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setPublishStatus((prev) => ({
          ...prev,
          [channel]: {
            success: true,
            message: data.message,
            videoUrl: data.videoUrl,
            videoId: data.videoId,
          },
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

  const handleDownloadMaster = async () => {
    try {
      let downloadUrl = generatedVideo?.compositeBlobUrl;
      if (!downloadUrl) {
        await compositeAndBakeVideo();
        downloadUrl = generatedVideo?.compositeBlobUrl;
      }
      if (!downloadUrl) return;

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${(topic || "gabbarinfo-reel").slice(0, 30).replace(/\s+/g, "-")}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert("Export failed: " + err.message);
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

        {/* Global Toast Notification */}
        {toastMsg && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 16px",
              borderRadius: 12,
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              color: "#6ee7b7",
              fontWeight: 700,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>{toastMsg}</span>
            <button
              onClick={() => setToastMsg("")}
              style={{ background: "none", border: "none", color: "#6ee7b7", cursor: "pointer", fontSize: 16 }}
            >
              ✕
            </button>
          </div>
        )}

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

        {/* RIGHT COLUMN: SMARTPHONE 9:16 VERTICAL PREVIEW PLAYER & PUBLISHING HUB */}
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
                {(!currentScene?.isAvatar && currentScene?.videoUrl && !currentScene?.videoUrl.match(/\.(jpg|jpeg|png|webp|gif)($|\?)/i)) ? (
                  <video
                    ref={videoPlayerRef}
                    key={currentScene.videoUrl}
                    src={currentScene.videoUrl}
                    autoPlay
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
                      color: "#facc15",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      textShadow: "0 2px 10px rgba(0,0,0,0.8)",
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

                {/* Compositing / Baking Overlay */}
                {compositing && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(10, 15, 29, 0.88)",
                      backdropFilter: "blur(8px)",
                      zIndex: 50,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 20,
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        border: "3px solid rgba(236, 72, 153, 0.25)",
                        borderTopColor: "#ec4899",
                        animation: "spin 1s linear infinite",
                        marginBottom: 16,
                      }}
                    />
                    <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>
                      Baking Master Video
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 6, maxWidth: 220, lineHeight: 1.4 }}>
                      {compositingStep || "Burning subtitles & mixing audio..."}
                    </div>
                  </div>
                )}
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
                <div style={{ fontSize: 14, fontWeight: 800, color: "#cbd5e1" }}>
                  Vertical 9:16 Video Player
                </div>
                <div style={{ fontSize: 12, marginTop: 6, color: "#94a3b8", lineHeight: 1.45 }}>
                  Type your topic on the left and click <strong>Generate</strong> to preview your reel here with animated captions.
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

              <button
                onClick={handleDownloadMaster}
                disabled={compositing}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: compositing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {compositing ? "⏳ Baking..." : "⬇ Download Master"}
              </button>
            </div>
          )}

          {/* ALWAYS-VISIBLE MULTI-CHANNEL PUBLISHING & AUTOPILOT HUB */}
          <div
            style={{
              width: 320,
              background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(8, 13, 22, 0.98) 100%)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 18,
              padding: 18,
              boxShadow: "0 12px 30px rgba(0, 0, 0, 0.5)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#f8fafc", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
                🚀 Publishing Channels
              </span>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(16, 185, 129, 0.15)", color: "#10b981", fontWeight: 700, border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                ● Multi-Channel Hub
              </span>
            </div>

            {/* Channels List with Checkboxes, Connection Badges, and Single Post Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* 1. INSTAGRAM REELS */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.07)",
                  borderRadius: 11,
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes("instagram")}
                      onChange={() => toggleChannelSelection("instagram")}
                      style={{ accentColor: "#ec4899", cursor: "pointer", width: 14, height: 14 }}
                    />
                    <span>📸 Instagram Reels</span>
                  </label>
                  {metaStatus.connected ? (
                    <span style={{ fontSize: 10, color: "#34d399", fontWeight: 700 }}>● Connected</span>
                  ) : (
                    <a
                      href="/api/facebook/connect"
                      style={{ fontSize: 10, color: "#38bdf8", textDecoration: "none", fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(56, 189, 248, 0.1)" }}
                    >
                      🔗 Connect Meta
                    </a>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => handlePublish("instagram")}
                    disabled={!generatedVideo || publishingChannel === "instagram"}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 7,
                      background: generatedVideo ? "linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)" : "rgba(255, 255, 255, 0.05)",
                      border: "none",
                      color: generatedVideo ? "#fff" : "#64748b",
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: generatedVideo ? (publishingChannel === "instagram" ? "not-allowed" : "pointer") : "default",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {publishingChannel === "instagram" ? "Publishing…" : "Post to Instagram Only ↗"}
                  </button>
                </div>
              </div>

              {/* 2. FACEBOOK REELS */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.07)",
                  borderRadius: 11,
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes("facebook")}
                      onChange={() => toggleChannelSelection("facebook")}
                      style={{ accentColor: "#1877f2", cursor: "pointer", width: 14, height: 14 }}
                    />
                    <span>📘 Facebook Reels</span>
                  </label>
                  {metaStatus.connected ? (
                    <span style={{ fontSize: 10, color: "#34d399", fontWeight: 700 }}>● Connected</span>
                  ) : (
                    <a
                      href="/api/facebook/connect"
                      style={{ fontSize: 10, color: "#38bdf8", textDecoration: "none", fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(56, 189, 248, 0.1)" }}
                    >
                      🔗 Connect Meta
                    </a>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => handlePublish("facebook")}
                    disabled={!generatedVideo || publishingChannel === "facebook"}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 7,
                      background: generatedVideo ? "#1877f2" : "rgba(255, 255, 255, 0.05)",
                      border: "none",
                      color: generatedVideo ? "#fff" : "#64748b",
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: generatedVideo ? (publishingChannel === "facebook" ? "not-allowed" : "pointer") : "default",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {publishingChannel === "facebook" ? "Publishing…" : "Post to Facebook Only ↗"}
                  </button>
                </div>
              </div>

              {/* 3. YOUTUBE SHORTS (Dedicated Google OAuth Flow) */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: youtubeStatus.connected ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(255, 255, 255, 0.07)",
                  borderRadius: 11,
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes("youtube")}
                      onChange={() => toggleChannelSelection("youtube")}
                      style={{ accentColor: "#ef4444", cursor: "pointer", width: 14, height: 14 }}
                    />
                    <span>🔴 YouTube Shorts</span>
                  </label>
                  {youtubeStatus.connected ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "#f87171", fontWeight: 700 }}>
                        {youtubeStatus.channel?.title?.slice(0, 14) || "Connected"}
                      </span>
                      <button
                        type="button"
                        onClick={handleDisconnectYouTube}
                        style={{ background: "none", border: "none", color: "#64748b", fontSize: 9, cursor: "pointer", textDecoration: "underline", padding: 0 }}
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <a
                      href="/api/youtube/connect"
                      style={{
                        fontSize: 10,
                        color: "#ef4444",
                        textDecoration: "none",
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 5,
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      🔗 Connect YouTube
                    </a>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => handlePublish("youtube")}
                    disabled={!generatedVideo || publishingChannel === "youtube"}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 7,
                      background: generatedVideo ? "#ef4444" : "rgba(255, 255, 255, 0.05)",
                      border: "none",
                      color: generatedVideo ? "#fff" : "#64748b",
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: generatedVideo ? (publishingChannel === "youtube" ? "not-allowed" : "pointer") : "default",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {publishingChannel === "youtube" ? "Publishing…" : "Post to YouTube Only ↗"}
                  </button>
                </div>
              </div>
            </div>

            {/* MASTER 1-CLICK BATCH PUBLISH BUTTON */}
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={handlePublishSelected}
                disabled={!generatedVideo || selectedChannels.length === 0 || batchPublishing}
                style={{
                  width: "100%",
                  padding: "11px",
                  borderRadius: 10,
                  background: generatedVideo && selectedChannels.length > 0
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : "rgba(255, 255, 255, 0.06)",
                  border: "none",
                  color: generatedVideo && selectedChannels.length > 0 ? "#fff" : "#64748b",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: generatedVideo && selectedChannels.length > 0 && !batchPublishing ? "pointer" : "default",
                  boxShadow: generatedVideo && selectedChannels.length > 0 ? "0 4px 15px rgba(16, 185, 129, 0.4)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all 0.2s ease",
                }}
              >
                {batchPublishing ? "Publishing to Selected Channels…" : `🚀 Publish to Selected Channels (${selectedChannels.length})`}
              </button>
            </div>

            {/* Helper text when video not generated yet */}
            {!generatedVideo && (
              <div style={{ marginTop: 9, fontSize: 11, color: "#64748b", textAlign: "center", lineHeight: 1.4 }}>
                Generate your reel first, then click any channel above or publish to all checked channels at once!
              </div>
            )}

            {/* Live Feedback Statuses */}
            {Object.entries(publishStatus).map(([ch, status]) => (
              status.message || status.error ? (
                <div
                  key={ch}
                  style={{
                    marginTop: 8,
                    padding: "7px 10px",
                    borderRadius: 7,
                    fontSize: 11,
                    background: status.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                    color: status.success ? "#6ee7b7" : "#fca5a5",
                    border: status.success ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 6,
                  }}
                >
                  <div>
                    <strong style={{ textTransform: "capitalize" }}>{ch}:</strong> {status.message || status.error}
                    {(ch === "instagram" || ch === "facebook") && status.error && (status.error.includes("invalidated") || status.error.includes("token")) && (
                      <div style={{ marginTop: 4 }}>
                        <a
                          href="/api/facebook/connect"
                          style={{
                            fontSize: 11,
                            color: "#f59e0b",
                            textDecoration: "underline",
                            fontWeight: 700,
                          }}
                        >
                          🔗 Click here to Reconnect Meta
                        </a>
                      </div>
                    )}
                  </div>
                  {status.videoUrl && (
                    <a
                      href={status.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 11,
                        color: "#38bdf8",
                        textDecoration: "underline",
                        fontWeight: 700,
                      }}
                    >
                      View on {ch === "youtube" ? "YouTube" : ch} ↗
                    </a>
                  )}
                </div>
              ) : null
            ))}

            {/* REELS AUTOPILOT CONFIGURATION SECTION */}
            <div style={{ marginTop: 16, borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#ec4899", display: "flex", alignItems: "center", gap: 6 }}>
                  🤖 Reels Autopilot Preferences
                </span>
                <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(236, 72, 153, 0.15)", color: "#f472b6", fontWeight: 700 }}>
                  Active
                </span>
              </div>
              <p style={{ margin: "0 0 10px", fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
                Choose where your autonomous daily reels are automatically published:
              </p>

              {/* Autopilot Channel Checkboxes */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#cbd5e1", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={autopilotChannels.instagram}
                    onChange={(e) => setAutopilotChannels((prev) => ({ ...prev, instagram: e.target.checked }))}
                    style={{ accentColor: "#ec4899" }}
                  />
                  Auto-syndicate to Instagram Reels
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#cbd5e1", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={autopilotChannels.facebook}
                    onChange={(e) => setAutopilotChannels((prev) => ({ ...prev, facebook: e.target.checked }))}
                    style={{ accentColor: "#1877f2" }}
                  />
                  Auto-syndicate to Facebook Reels
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#cbd5e1", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={autopilotChannels.youtube}
                    onChange={(e) => setAutopilotChannels((prev) => ({ ...prev, youtube: e.target.checked }))}
                    style={{ accentColor: "#ef4444" }}
                  />
                  Auto-syndicate to YouTube Shorts
                </label>
              </div>

              {/* Cadence Selection */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>Publishing Cadence:</span>
                <select
                  value={autopilotCadence}
                  onChange={(e) => setAutopilotCadence(e.target.value)}
                  style={{
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: 6,
                    color: "#fff",
                    fontSize: 11,
                    padding: "3px 8px",
                  }}
                >
                  <option value="daily">Daily (1 Reel/day)</option>
                  <option value="every_2_days">Every 2 Days</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleSaveAutopilot}
                disabled={autopilotSaving}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "rgba(236, 72, 153, 0.15)",
                  border: "1px solid rgba(236, 72, 153, 0.4)",
                  color: "#f472b6",
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                }}
              >
                {autopilotSaving ? "Saving Preferences…" : "⚡ Save & Activate Autopilot"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
