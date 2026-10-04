// pages/reel-studio.js
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";

export default function ReelStudioPage() {
  // Mode: "upload" | "record"
  const [mode, setMode] = useState("upload");

  // Video source & recording states
  const [sourceVideoUrl, setSourceVideoUrl] = useState(null);
  const [sourceVideoFile, setSourceVideoFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Studio configuration controls
  const [zoomFactor, setZoomFactor] = useState(1.6); // 1.1x to 2.4x
  const [cameraSpeed, setCameraSpeed] = useState(0.08); // Lerp factor: 0.03 (smooth/cinematic) to 0.18 (snappy)
  const [bgBlur, setBgBlur] = useState(24); // px
  const [bgDim, setBgDim] = useState(0.45); // 0 to 1
  const [frameRadius, setFrameRadius] = useState(22); // rounded corners for foreground
  const [showRipples, setShowRipples] = useState(true);
  const [autoPan, setAutoPan] = useState(false);
  const [brandText, setBrandText] = useState("GabbarInfo AI");
  const [showBrandBadge, setShowBrandBadge] = useState(true);

  // Hidden/Active Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const animFrameIdRef = useRef(null);
  const screenStreamRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Camera tracking state (normalized 0 to 1 coordinates)
  const targetFocusRef = useRef({ x: 0.5, y: 0.5 });
  const currentCameraRef = useRef({ x: 0.5, y: 0.5 });
  const clickRipplesRef = useRef([]);

  // -------------------------------------------------------------
  // 1. FILE UPLOAD HANDLER
  // -------------------------------------------------------------
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (sourceVideoUrl) {
      URL.revokeObjectURL(sourceVideoUrl);
    }
    const url = URL.createObjectURL(file);
    setSourceVideoFile(file);
    setSourceVideoUrl(url);
    setRecordedBlobUrl(null);

    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.load();
    }
  };

  // -------------------------------------------------------------
  // 2. LIVE SCREEN CAPTURE (BROWSER NATIVE)
  // -------------------------------------------------------------
  const handleStartScreenCapture = async () => {
    try {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: true,
      });

      screenStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Handle user clicking "Stop sharing" from Chrome bar
      stream.getVideoTracks()[0].onended = () => {
        handleStopRecording();
      };

      setRecordedBlobUrl(null);
      startRenderLoop();
    } catch (err) {
      console.warn("Screen capture cancelled or denied:", err);
      alert("Screen capture was cancelled or permission was denied.");
    }
  };

  // -------------------------------------------------------------
  // 3. MOUSE TRACKING & INTERACTIVE CAMERA DIRECTOR
  // -------------------------------------------------------------
  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = (e.clientX - rect.left) / rect.width;
    const clientY = (e.clientY - rect.top) / rect.height;

    // Map canvas 9:16 coordinates back to focus target on the 16:9 source
    targetFocusRef.current = {
      x: Math.max(0.1, Math.min(0.9, clientX)),
      y: Math.max(0.1, Math.min(0.9, clientY)),
    };
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width;
    const cy = (e.clientY - rect.top) / rect.height;

    targetFocusRef.current = { x: cx, y: cy };

    if (showRipples) {
      clickRipplesRef.current.push({
        x: cx * 1080,
        y: cy * 1920,
        radius: 0,
        alpha: 1.0,
      });
    }
  };

  // -------------------------------------------------------------
  // 4. CORE RENDER LOOP: 16:9 -> 9:16 DYNAMIC ZOOM & BLUR COMPOSITOR
  // -------------------------------------------------------------
  const startRenderLoop = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
    }

    const render = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && (video.readyState >= 2 || video.srcObject)) {
        const ctx = canvas.getContext("2d");
        const outW = 1080;
        const outH = 1920;

        canvas.width = outW;
        canvas.height = outH;

        const srcW = video.videoWidth || 1920;
        const srcH = video.videoHeight || 1080;

        // Auto-pan sinus generator if active
        if (autoPan) {
          const t = Date.now() * 0.0006;
          targetFocusRef.current = {
            x: 0.5 + Math.sin(t) * 0.28,
            y: 0.5 + Math.cos(t * 1.3) * 0.18,
          };
        }

        // 1. Smooth Camera Physics (Exponential Lerp towards focus target)
        currentCameraRef.current.x +=
          (targetFocusRef.current.x - currentCameraRef.current.x) * cameraSpeed;
        currentCameraRef.current.y +=
          (targetFocusRef.current.y - currentCameraRef.current.y) * cameraSpeed;

        const camX = currentCameraRef.current.x;
        const camY = currentCameraRef.current.y;

        // 2. LAYER 1: Aesthetic Blurred & Dimmed Backdrop
        ctx.save();
        ctx.filter = `blur(${bgBlur}px) brightness(${bgDim})`;
        // Scale 16:9 to fill entire 9:16 vertical canvas
        const scaleBack = Math.max(outW / srcW, outH / srcH);
        const backW = srcW * scaleBack;
        const backH = srcH * scaleBack;
        const backX = (outW - backW) / 2;
        const backY = (outH - backH) / 2;
        ctx.drawImage(video, backX, backY, backW, backH);
        ctx.restore();

        // 3. Dark Gradient Overlay for high-end cinematic feel
        const gradient = ctx.createLinearGradient(0, 0, 0, outH);
        gradient.addColorStop(0, "rgba(8, 13, 26, 0.45)");
        gradient.addColorStop(0.5, "rgba(8, 13, 26, 0.15)");
        gradient.addColorStop(1, "rgba(8, 13, 26, 0.7)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, outW, outH);

        // 4. LAYER 2: Zoomed & Focused Desktop Screen Cutout
        // Calculate crop window on source video centered around (camX, camY)
        const cropW = srcW / zoomFactor;
        const cropH = cropW * (outH / outW) * 0.52; // Maintain pleasant proportion inside 9:16 canvas

        let sx = camX * srcW - cropW / 2;
        let sy = camY * srcH - cropH / 2;

        // Clamp crop within bounds
        sx = Math.max(0, Math.min(srcW - cropW, sx));
        sy = Math.max(0, Math.min(srcH - cropH, sy));

        // Placement on 9:16 canvas (card frame with margins)
        const cardMargin = 40;
        const cardW = outW - cardMargin * 2;
        const cardH = cardW * (cropH / cropW);
        const cardX = cardMargin;
        const cardY = (outH - cardH) / 2;

        ctx.save();
        // Drop shadow for the floating app frame
        ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
        ctx.shadowBlur = 38;
        ctx.shadowOffsetY = 18;

        // Clip rounded rectangle
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(cardX, cardY, cardW, cardH, frameRadius);
        } else {
          ctx.rect(cardX, cardY, cardW, cardH);
        }
        ctx.fillStyle = "#0d111c";
        ctx.fill();
        ctx.clip();

        // Draw zoomed crop
        ctx.drawImage(video, sx, sy, cropW, cropH, cardX, cardY, cardW, cardH);
        ctx.restore();

        // Subtle glowing border around card
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(cardX, cardY, cardW, cardH, frameRadius);
        } else {
          ctx.rect(cardX, cardY, cardW, cardH);
        }
        ctx.strokeStyle = "rgba(56, 189, 248, 0.28)";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        // 5. Click Ripples / Visual Pulse FX
        if (showRipples && clickRipplesRef.current.length > 0) {
          ctx.save();
          for (let i = clickRipplesRef.current.length - 1; i >= 0; i--) {
            const rip = clickRipplesRef.current[i];
            rip.radius += 5;
            rip.alpha -= 0.035;

            if (rip.alpha <= 0) {
              clickRipplesRef.current.splice(i, 1);
              continue;
            }

            ctx.beginPath();
            ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(56, 189, 248, ${rip.alpha})`;
            ctx.lineWidth = 4;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(rip.x, rip.y, rip.radius * 0.6, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(16, 185, 129, ${rip.alpha * 0.7})`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          ctx.restore();
        }

        // 6. Header / Brand Badge
        if (showBrandBadge && brandText) {
          ctx.save();
          ctx.font = "800 32px Inter, sans-serif";
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.shadowColor = "rgba(0,0,0,0.8)";
          ctx.shadowBlur = 10;
          ctx.fillText(`⚡ ${brandText}`, outW / 2, cardY - 45);

          ctx.font = "600 20px Inter, sans-serif";
          ctx.fillStyle = "#38bdf8";
          ctx.fillText("AI ENGINE DEMO", outW / 2, cardY - 14);
          ctx.restore();
        }

        // 7. Footer CTA Pill
        ctx.save();
        const pillW = 420;
        const pillH = 64;
        const pillX = (outW - pillW) / 2;
        const pillY = cardY + cardH + 45;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(pillX, pillY, pillW, pillH, 32);
        } else {
          ctx.rect(pillX, pillY, pillW, pillH);
        }
        ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
        ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        ctx.font = "700 22px Inter, sans-serif";
        ctx.fillStyle = "#34d399";
        ctx.textAlign = "center";
        ctx.fillText("🚀 Try Free at ai.gabbarinfo.com", outW / 2, pillY + 40);
        ctx.restore();
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);
  }, [zoomFactor, cameraSpeed, bgBlur, bgDim, frameRadius, showRipples, autoPan, brandText, showBrandBadge]);

  // Restart loop on setting changes
  useEffect(() => {
    startRenderLoop();
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [startRenderLoop]);

  // -------------------------------------------------------------
  // 5. EXPORT / RECORD 9:16 REEL TO MP4 / WEBM
  // -------------------------------------------------------------
  const handleStartRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    recordedChunksRef.current = [];
    const stream = canvas.captureStream(60);

    // If source video has audio, combine audio track into recording
    const video = videoRef.current;
    if (video) {
      let audioStream = null;
      if (video.captureStream) {
        audioStream = video.captureStream();
      } else if (video.mozCaptureStream) {
        audioStream = video.mozCaptureStream();
      }
      if (audioStream && audioStream.getAudioTracks().length > 0) {
        stream.addTrack(audioStream.getAudioTracks()[0]);
      } else if (screenStreamRef.current && screenStreamRef.current.getAudioTracks().length > 0) {
        stream.addTrack(screenStreamRef.current.getAudioTracks()[0]);
      }
    }

    const mimeOptions = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ];
    let selectedMime = mimeOptions.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";

    const recorder = new MediaRecorder(stream, {
      mimeType: selectedMime,
      videoBitsPerSecond: 8000000, // 8 Mbps high quality
    });

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: selectedMime });
      const url = URL.createObjectURL(blob);
      setRecordedBlobUrl(url);
      setIsProcessing(false);
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    };

    recorder.start(100);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setRecordingSeconds(0);

    // If file mode, play video from start
    if (mode === "upload" && video) {
      video.currentTime = 0;
      video.play();
    }

    timerIntervalRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      setIsProcessing(true);
      mediaRecorderRef.current.stop();
    }
  };

  const handleDownload = () => {
    if (!recordedBlobUrl) return;
    const a = document.createElement("a");
    a.href = recordedBlobUrl;
    a.download = `GabbarInfo_Reel_9x16_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <>
      <Head>
        <title>9:16 Reel Creator Studio — GabbarInfo AI</title>
        <meta
          name="description"
          content="Free 100% in-browser auto-zoom & pan screen recorder. Turn 16:9 desktop demos into viral 9:16 Instagram Reels for ₹0."
        />
      </Head>

      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg, #060913 0%, #0a1122 100%)",
          color: "#f8fafc",
          fontFamily: "Inter, -apple-system, sans-serif",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Navigation Bar */}
        <header
          style={{
            padding: "16px 28px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(6, 9, 19, 0.8)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 24 }}>⚡</span>
              <strong style={{ fontSize: 18, color: "#ffffff", letterSpacing: -0.5 }}>
                GabbarInfo <span style={{ color: "#38bdf8" }}>Reel Studio</span>
              </strong>
            </Link>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                padding: "3px 8px",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#34d399",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: 999,
                letterSpacing: 0.5,
              }}
            >
              100% FREE (₹0 COST)
            </span>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Link
              href="/"
              style={{
                fontSize: 13,
                color: "#94a3b8",
                textDecoration: "none",
                padding: "8px 16px",
                borderRadius: 8,
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              ← Back to Dashboard
            </Link>
          </div>
        </header>

        {/* Main Content Layout */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexWrap: "wrap",
            gap: 24,
            padding: "24px",
            maxWidth: 1600,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* LEFT: Controls & Source Setup (Width ~420px) */}
          <div
            style={{
              flex: "1 1 380px",
              maxWidth: 480,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* Input Mode Selector */}
            <div
              style={{
                padding: 4,
                borderRadius: 12,
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                gap: 4,
              }}
            >
              <button
                onClick={() => setMode("upload")}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: mode === "upload" ? "#38bdf8" : "transparent",
                  color: mode === "upload" ? "#041527" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                📁 Upload 16:9 Video
              </button>
              <button
                onClick={() => setMode("record")}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: mode === "record" ? "#10b981" : "transparent",
                  color: mode === "record" ? "#042416" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                🎥 Record Screen Live
              </button>
            </div>

            {/* Source Controls Card */}
            <div
              style={{
                padding: 20,
                borderRadius: 16,
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <h3 style={{ margin: "0 0 12px 0", fontSize: 15, fontWeight: 700, color: "#ffffff" }}>
                {mode === "upload" ? "1. Select Source 16:9 Video" : "1. Capture Screen / Tab"}
              </h3>

              {mode === "upload" ? (
                <div>
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "24px 16px",
                      borderRadius: 12,
                      border: "2px dashed rgba(56, 189, 248, 0.35)",
                      background: "rgba(56, 189, 248, 0.03)",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontSize: 32, marginBottom: 8 }}>📤</span>
                    <strong style={{ fontSize: 13, color: "#38bdf8" }}>
                      {sourceVideoFile ? sourceVideoFile.name : "Click to Upload MP4 / WebM Recording"}
                    </strong>
                    <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                      Standard 16:9 desktop screen recording (e.g. from Win+Alt+R or OBS)
                    </span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      onChange={handleFileUpload}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                    Captures your GabbarInfo AI window or tab live. Your mouse movements will be tracked smoothly on the vertical canvas.
                  </p>
                  <button
                    onClick={handleStartScreenCapture}
                    style={{
                      padding: "12px 18px",
                      borderRadius: 10,
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#042416",
                      fontWeight: 800,
                      fontSize: 13,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    🖥️ Select Window / Tab to Record
                  </button>
                </div>
              )}
            </div>

            {/* Auto-Zoom & Camera Physics Settings */}
            <div
              style={{
                padding: 20,
                borderRadius: 16,
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#ffffff" }}>
                2. Camera Zoom & Motion Physics
              </h3>

              {/* Zoom Level */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#cbd5e1" }}>🔍 Zoom Magnitude</label>
                  <span style={{ fontSize: 12, color: "#38bdf8", fontWeight: 700 }}>{zoomFactor.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="1.1"
                  max="2.4"
                  step="0.1"
                  value={zoomFactor}
                  onChange={(e) => setZoomFactor(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#38bdf8" }}
                />
              </div>

              {/* Camera Follow Speed */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#cbd5e1" }}>🎥 Camera Smoothness (Lerp)</label>
                  <span style={{ fontSize: 12, color: "#38bdf8", fontWeight: 700 }}>
                    {cameraSpeed < 0.06 ? "Cinematic Slow" : cameraSpeed > 0.12 ? "Snappy Fast" : "Balanced"}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.03"
                  max="0.2"
                  step="0.01"
                  value={cameraSpeed}
                  onChange={(e) => setCameraSpeed(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#38bdf8" }}
                />
              </div>

              {/* Background Blur */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#cbd5e1" }}>🌫️ Backdrop Blur</label>
                  <span style={{ fontSize: 12, color: "#38bdf8", fontWeight: 700 }}>{bgBlur}px</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="48"
                  step="2"
                  value={bgBlur}
                  onChange={(e) => setBgBlur(parseInt(e.target.value, 10))}
                  style={{ width: "100%", accentColor: "#38bdf8" }}
                />
              </div>

              {/* Toggles */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#cbd5e1", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={showRipples}
                    onChange={(e) => setShowRipples(e.target.checked)}
                    style={{ accentColor: "#38bdf8" }}
                  />
                  <span>Click Ripple FX (Glow rings on click)</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#cbd5e1", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={autoPan}
                    onChange={(e) => setAutoPan(e.target.checked)}
                    style={{ accentColor: "#38bdf8" }}
                  />
                  <span>Auto-Scan Camera (Hands-free slow cinematic glide)</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#cbd5e1", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={showBrandBadge}
                    onChange={(e) => setShowBrandBadge(e.target.checked)}
                    style={{ accentColor: "#38bdf8" }}
                  />
                  <span>Show Top & Bottom Branding Banners</span>
                </label>
              </div>

              {showBrandBadge && (
                <div>
                  <label style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>Header Badge Title</label>
                  <input
                    type="text"
                    value={brandText}
                    onChange={(e) => setBrandText(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "#0a0f1d",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#ffffff",
                      fontSize: 12,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}
            </div>

            {/* RECORD & EXPORT ACTIONS */}
            <div
              style={{
                padding: 20,
                borderRadius: 16,
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(56, 189, 248, 0.25)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#38bdf8" }}>
                3. Render & Export 9:16 Reel
              </h3>

              {!isRecording ? (
                <button
                  onClick={handleStartRecording}
                  disabled={!sourceVideoUrl && !screenStreamRef.current}
                  style={{
                    padding: "14px 20px",
                    borderRadius: 10,
                    background:
                      sourceVideoUrl || screenStreamRef.current
                        ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                        : "rgba(255, 255, 255, 0.08)",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: 14,
                    border: "none",
                    cursor: sourceVideoUrl || screenStreamRef.current ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: sourceVideoUrl || screenStreamRef.current ? "0 0 25px rgba(239, 68, 68, 0.4)" : "none",
                  }}
                >
                  <span style={{ fontSize: 16 }}>🔴</span> Start Recording Reel
                </button>
              ) : (
                <button
                  onClick={handleStopRecording}
                  style={{
                    padding: "14px 20px",
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#042416",
                    fontWeight: 800,
                    fontSize: 14,
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 0 25px rgba(16, 185, 129, 0.4)",
                  }}
                >
                  <span style={{ fontSize: 16 }}>⏹️</span> Stop & Finish Reel ({recordingSeconds}s)
                </button>
              )}

              {isProcessing && (
                <div style={{ textAlign: "center", fontSize: 12, color: "#38bdf8" }}>
                  ⏳ Finalizing 9:16 vertical render in browser…
                </div>
              )}

              {recordedBlobUrl && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                  <button
                    onClick={handleDownload}
                    style={{
                      padding: "12px 18px",
                      borderRadius: 10,
                      background: "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
                      color: "#031525",
                      fontWeight: 800,
                      fontSize: 13,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    💾 Download 1080x1920 Reel MP4 / WebM
                  </button>
                  <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
                    ✓ Ready to upload directly to Instagram Reels, TikTok, or YouTube Shorts.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Phone Mockup Canvas Live View (9:16 Aspect) */}
          <div
            style={{
              flex: "2 1 500px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 650,
            }}
          >
            <div style={{ marginBottom: 12, textAlign: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1" }}>
                Interactive Director Canvas (Hover or Click to Aim Camera)
              </span>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#64748b" }}>
                Hover mouse over preview to guide camera position smoothly in real-time.
              </p>
            </div>

            {/* Phone Screen Frame (9:16) */}
            <div
              style={{
                width: 360,
                height: 640,
                borderRadius: 36,
                border: "4px solid rgba(255, 255, 255, 0.15)",
                boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(56, 189, 248, 0.15)",
                overflow: "hidden",
                position: "relative",
                background: "#060913",
                cursor: "crosshair",
              }}
              onMouseMove={handleCanvasMouseMove}
              onClick={handleCanvasClick}
            >
              {/* Top Phone Speaker Island */}
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 90,
                  height: 14,
                  background: "#000000",
                  borderRadius: 10,
                  zIndex: 20,
                  pointerEvents: "none",
                }}
              />

              {/* The Master Composite Canvas */}
              <canvas
                ref={canvasRef}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                }}
              />

              {/* Overlay Prompt when no video is loaded */}
              {!sourceVideoUrl && !screenStreamRef.current && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                    textAlign: "center",
                    background: "rgba(6, 9, 19, 0.88)",
                    zIndex: 10,
                  }}
                >
                  <span style={{ fontSize: 44, marginBottom: 12 }}>📱</span>
                  <strong style={{ fontSize: 15, color: "#ffffff", marginBottom: 6 }}>
                    No Video Source Active
                  </strong>
                  <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
                    Upload a 16:9 screen video or click &quot;Record Screen Live&quot; on the left to start directing your 9:16 Reel.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hidden video element used as compositor frame source */}
        <video
          ref={videoRef}
          loop
          muted
          playsInline
          style={{ display: "none" }}
        />
      </div>
    </>
  );
}
