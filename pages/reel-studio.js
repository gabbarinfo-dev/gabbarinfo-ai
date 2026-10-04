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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [countdown, setCountdown] = useState(null); // null | 3 | 2 | 1
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [isScreenConnected, setIsScreenConnected] = useState(false);
  const countdownIntervalRef = useRef(null);

  // Audio beep cue helper for 3-2-1 countdown & start chime
  const playBeep = (freq = 800, duration = 0.12) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  };

  // Helper time formatter
  const formatTime = (sec) => {
    if (typeof sec !== "number" || isNaN(sec) || !isFinite(sec) || sec < 0) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Studio configuration controls
  const [zoomFactor, setZoomFactor] = useState(1.0); // Default 1.0x (Fit screen, no giant buttons!)
  const [panPosition, setPanPosition] = useState(0.5); // Smooth horizontal pan slider (0.05 to 0.95)
  const panPositionRef = useRef(0.5);
  const [framingMode, setFramingMode] = useState("fill"); // "fill" (Tall 9:16 Vertical) | "full" (Edge-to-edge 9:16) | "classic" (16:9 Letterbox)
  const [focusArea, setFocusArea] = useState("center"); // "center" | "left" | "right" | "top"
  const [punchZoomOnClick, setPunchZoomOnClick] = useState(false); // Off by default to avoid sudden jumps
  const [autoZoomOnHover, setAutoZoomOnHover] = useState(false); // Off by default so zoom stays at user's slider setting
  const [cameraSpeed, setCameraSpeed] = useState(0.08); // Lerp factor: 0.03 (smooth/cinematic) to 0.18 (snappy)
  const [bgBlur, setBgBlur] = useState(24); // px
  const [bgDim, setBgDim] = useState(0.45); // 0 to 1
  const [frameRadius, setFrameRadius] = useState(24); // rounded corners for foreground
  const [showRipples, setShowRipples] = useState(true);
  const [autoPan, setAutoPan] = useState(false);
  const [brandText, setBrandText] = useState("GabbarInfo AI");
  const [showBrandBadge, setShowBrandBadge] = useState(false); // Clean video by default
  const [recordMic, setRecordMic] = useState(true); // capture user microphone voiceover

  // Hidden/Active Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const animFrameIdRef = useRef(null);
  const screenStreamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const fileInputRef = useRef(null);
  const bgIntervalRef = useRef(null);
  const blurCanvasRef = useRef(null);

  // Screen Studio Camera tracking state (normalized 0 to 1 coordinates) & Dynamic Zoom physics
  const targetFocusRef = useRef({ x: 0.5, y: 0.5 });
  const currentCameraRef = useRef({ x: 0.5, y: 0.5 });
  const targetZoomRef = useRef(1.0);
  const currentZoomRef = useRef(1.0);
  const lastMousePosRef = useRef({ x: 0.5, y: 0.5, time: Date.now() });
  const mouseStopTimerRef = useRef(null);
  const clickRipplesRef = useRef([]);

  // Cross-Tab Cursor Tracking, Timeline Replay & Optical Motion Detection Refs
  const cursorTimelineRef = useRef([]);
  const isRecordingRef = useRef(false);
  const recordingStartTimeRef = useRef(0);
  const lastRecordedDurationRef = useRef(0);
  const activeCursorPosRef = useRef({ x: 0.5, y: 0.5, visible: false });
  const motionCanvasRef = useRef(null);
  const prevFrameDataRef = useRef(null);
  const lastMotionCheckTimeRef = useRef(0);
  const lastBroadcastCursorTimeRef = useRef(0);
  const userManualOverrideRef = useRef(0); // Protects manual pan & zoom from being overridden

  // Direct Zoom Trigger Helper
  const setCameraZoom = (val) => {
    const clamped = Math.max(1.0, Math.min(3.8, val));
    targetZoomRef.current = clamped;
    userManualOverrideRef.current = Date.now();
    setZoomFactor(clamped);
  };

  // -------------------------------------------------------------
  // 1. FILE UPLOAD HANDLER & PLAYBACK CONTROLS
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

    const video = videoRef.current;
    if (video) {
      video.src = url;
      video.currentTime = 0;
      video.load();
      video.onloadeddata = () => {
        setDuration(video.duration || 0);
        video.play().then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.warn("Autoplay blocked:", err);
          setIsPlaying(false);
        });
        startRenderLoop();
      };
      video.ontimeupdate = () => {
        setCurrentTime(video.currentTime || 0);
      };
      video.onended = () => {
        setIsPlaying(false);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          handleStopRecording();
        }
      };
    }
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.ended || (video.duration && video.currentTime >= video.duration - 0.2)) {
      video.currentTime = 0;
    }
    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        startRenderLoop();
      }).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e) => {
    const video = videoRef.current;
    if (!video) return;
    const t = parseFloat(e.target.value);
    video.currentTime = t;
    setCurrentTime(t);
    startRenderLoop();
  };

  // -------------------------------------------------------------
  // 2. LIVE SCREEN CAPTURE (BROWSER NATIVE)
  // -------------------------------------------------------------
  const handleStartScreenCapture = async (autoRecord = true) => {
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
      setIsScreenConnected(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Handle user clicking "Stop sharing" from Chrome bar
      stream.getVideoTracks()[0].onended = () => {
        setIsScreenConnected(false);
        handleStopRecording();
      };

      setRecordedBlobUrl(null);
      startRenderLoop();

      // Automatically launch 3-2-1 countdown now that window is selected!
      if (autoRecord) {
        triggerRecordingCountdown();
      }
    } catch (err) {
      console.warn("Screen capture cancelled or denied:", err);
    }
  };

  // -------------------------------------------------------------
  // 3. MOUSE TRACKING & INTERACTIVE CAMERA DIRECTOR (DYNAMIC ZOOM + PAN)
  // -------------------------------------------------------------

  // Real-Time Cross-Tab Cursor Tracking (Screen Studio Camera Follow)
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    let channel;
    try {
      channel = new BroadcastChannel("gabbar_reel_cursor_channel");
    } catch (e) {
      return;
    }

    const handleMessage = (e) => {
      const msg = e.data;
      if (!msg) return;

      if (msg.type === "CURSOR_MOVE") {
        lastBroadcastCursorTimeRef.current = Date.now();
        const cx = Math.max(0.04, Math.min(0.96, msg.x));
        const cy = Math.max(0.04, Math.min(0.96, msg.y));

        targetFocusRef.current = { x: cx, y: cy };
        activeCursorPosRef.current = { x: cx, y: cy, visible: true };

        // Record cursor movement to timeline if recording is active
        if (isRecordingRef.current) {
          const t = (Date.now() - recordingStartTimeRef.current) / 1000;
          cursorTimelineRef.current.push({ t, x: cx, y: cy, type: "move" });
        }

        // Screen Studio Dynamic Motion Zoom:
        // When cursor is sliding quickly, pull back slightly (~1.4x) for overview
        // When cursor hovers or pauses on a button/text, smoothly punch in (2.2x - 2.5x)!
        if (autoZoomOnHover) {
          const now = Date.now();
          const dt = Math.max(1, now - lastMousePosRef.current.time);
          const dx = cx - lastMousePosRef.current.x;
          const dy = cy - lastMousePosRef.current.y;
          const dist = Math.hypot(dx, dy);
          const speed = dist / dt;

          lastMousePosRef.current = { x: cx, y: cy, time: now };

          if (speed > 0.001) {
            targetZoomRef.current = 1.45; // wide view during slide
          }

          if (mouseStopTimerRef.current) clearTimeout(mouseStopTimerRef.current);
          mouseStopTimerRef.current = setTimeout(() => {
            targetZoomRef.current = Math.max(2.2, zoomFactor); // punch in when hovering on target
          }, 160);
        }
      } else if (msg.type === "CURSOR_CLICK") {
        lastBroadcastCursorTimeRef.current = Date.now();
        const cx = Math.max(0.04, Math.min(0.96, msg.x));
        const cy = Math.max(0.04, Math.min(0.96, msg.y));
        targetFocusRef.current = { x: cx, y: cy };
        activeCursorPosRef.current = { x: cx, y: cy, visible: true };

        if (isRecordingRef.current) {
          const t = (Date.now() - recordingStartTimeRef.current) / 1000;
          cursorTimelineRef.current.push({ t, x: cx, y: cy, type: "click" });
        }

        if (showRipples) {
          clickRipplesRef.current.push({
            x: cx * 1080,
            y: cy * 1920,
            radius: 0,
            alpha: 1.0,
          });
        }

        if (punchZoomOnClick) {
          targetZoomRef.current = Math.min(3.2, targetZoomRef.current + 0.4);
          setTimeout(() => {
            targetZoomRef.current = Math.max(2.2, zoomFactor);
          }, 350);
        }
      }
    };

    channel.addEventListener("message", handleMessage);

    return () => {
      channel.removeEventListener("message", handleMessage);
      try {
        channel.close();
      } catch (e) {}
    };
  }, [autoZoomOnHover, zoomFactor, showRipples, punchZoomOnClick]);

  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = (e.clientX - rect.left) / rect.width;
    const clientY = (e.clientY - rect.top) / rect.height;

    const clampedX = Math.max(0.06, Math.min(0.94, clientX));
    const clampedY = Math.max(0.06, Math.min(0.94, clientY));

    targetFocusRef.current = { x: clampedX, y: clampedY };
    activeCursorPosRef.current = { x: clampedX, y: clampedY, visible: true };
    panPositionRef.current = clampedX;
    userManualOverrideRef.current = Date.now();

    if (isRecordingRef.current) {
      const t = (Date.now() - recordingStartTimeRef.current) / 1000;
      cursorTimelineRef.current.push({ t, x: clampedX, y: clampedY, type: "move" });
    }

    // Screen Studio Dynamic Motion Zoom:
    // When moving quickly across the canvas, zoom out slightly (~1.35x) for context.
    // When the cursor slows down or stops on an element, punch in deep (1.8x - 2.5x)!
    if (autoZoomOnHover) {
      const now = Date.now();
      const dt = Math.max(1, now - lastMousePosRef.current.time);
      const dx = clampedX - lastMousePosRef.current.x;
      const dy = clampedY - lastMousePosRef.current.y;
      const dist = Math.hypot(dx, dy);
      const speed = dist / dt;

      lastMousePosRef.current = { x: clampedX, y: clampedY, time: now };

      if (speed > 0.0012) {
        targetZoomRef.current = 1.25;
      }

      if (mouseStopTimerRef.current) clearTimeout(mouseStopTimerRef.current);
      mouseStopTimerRef.current = setTimeout(() => {
        targetZoomRef.current = Math.max(1.8, zoomFactor);
      }, 150);
    }
  };

  // Scroll wheel to zoom in/out smoothly in real-time
  const handleCanvasWheel = (e) => {
    e.preventDefault();
    userManualOverrideRef.current = Date.now();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    const newZoom = Math.max(1.0, Math.min(3.6, targetZoomRef.current + delta));
    targetZoomRef.current = newZoom;
    setZoomFactor(newZoom);
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width;
    const cy = (e.clientY - rect.top) / rect.height;

    targetFocusRef.current = { x: cx, y: cy };
    activeCursorPosRef.current = { x: cx, y: cy, visible: true };
    userManualOverrideRef.current = Date.now();

    if (isRecordingRef.current) {
      const t = (Date.now() - recordingStartTimeRef.current) / 1000;
      cursorTimelineRef.current.push({ t, x: cx, y: cy, type: "click" });
    }

    // Dynamic Punch Zoom: clicking toggles between wide overview (1.15x) and deep punch (2.5x+)
    if (punchZoomOnClick) {
      if (targetZoomRef.current < 1.7) {
        const nextZoom = Math.max(2.2, zoomFactor);
        targetZoomRef.current = nextZoom;
        setZoomFactor(nextZoom);
      } else {
        targetZoomRef.current = 1.15;
        setZoomFactor(1.15);
      }
    }

    if (showRipples) {
      clickRipplesRef.current.push({
        x: cx * 1080,
        y: cy * 1920,
        radius: 0,
        alpha: 1.0,
      });
    }
  };

  // When mouse leaves preview, PRESERVE smooth camera focus (Do NOT snap back to center!)
  const handleCanvasMouseLeave = () => {
    if (mouseStopTimerRef.current) clearTimeout(mouseStopTimerRef.current);
  };

  const handleResetCamera = () => {
    if (mouseStopTimerRef.current) clearTimeout(mouseStopTimerRef.current);
    targetFocusRef.current = { x: 0.5, y: 0.5 };
    activeCursorPosRef.current = { x: 0.5, y: 0.5, visible: false };
    userManualOverrideRef.current = Date.now();
    targetZoomRef.current = zoomFactor;
    setFocusArea("center");
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
        // Prevent drawing black frames ONLY if we are actively capturing a live screen and user stopped it
        if (video.srcObject && !sourceVideoUrl) {
          const screenTrack = screenStreamRef.current?.getVideoTracks()?.[0];
          if (screenTrack && screenTrack.readyState === "ended") {
            return;
          }
        }
        const ctx = canvas.getContext("2d");
        const outW = 1080;
        const outH = 1920;

        if (canvas.width !== outW) canvas.width = outW;
        if (canvas.height !== outH) canvas.height = outH;
        ctx.clearRect(0, 0, outW, outH);

        const srcW = video.videoWidth || 1920;
        const srcH = video.videoHeight || 1080;

        const now = Date.now();

        // 0a. Camera Pan & Tracking Director
        if (autoPan) {
          const t = now * 0.0006;
          // Smoothly glides across screen: Left (0.18) -> Center (0.5) -> Right (0.82)
          targetFocusRef.current = {
            x: 0.5 + Math.sin(t) * 0.32,
            y: 0.5 + Math.cos(t * 0.7) * 0.14,
          };
          targetZoomRef.current = 1.0;
        } else if (
          isPlaying &&
          cursorTimelineRef.current.length > 0 &&
          now - userManualOverrideRef.current > 4000 &&
          now - lastMousePosRef.current.time > 900
        ) {
          // Replay if timeline actually has non-center movement (variance > 0.06)
          const hasMovement = cursorTimelineRef.current.some(
            (e) => Math.abs(e.x - 0.5) > 0.06 || Math.abs(e.y - 0.5) > 0.06
          );
          if (hasMovement) {
            const ct = video.currentTime || 0;
            let closest = null;
            let minDiff = 0.35;
            for (let i = 0; i < cursorTimelineRef.current.length; i++) {
              const entry = cursorTimelineRef.current[i];
              const diff = Math.abs(entry.t - ct);
              if (diff < minDiff) {
                minDiff = diff;
                closest = entry;
              }
            }
            if (closest) {
              targetFocusRef.current = { x: closest.x, y: closest.y };
              activeCursorPosRef.current = { x: closest.x, y: closest.y, visible: true };
            }
          }
        } else {
          // Manual Pan Slider Direct Control (Slide Left <---> Right smoothly):
          const px = panPositionRef.current !== undefined ? panPositionRef.current : 0.5;
          targetFocusRef.current = {
            x: px,
            y: targetFocusRef.current.y || 0.5,
          };
        }
        // 1. Smooth Camera Physics (Exponential Lerp towards focus target & dynamic zoom)
        currentCameraRef.current.x +=
          (targetFocusRef.current.x - currentCameraRef.current.x) * cameraSpeed;
        currentCameraRef.current.y +=
          (targetFocusRef.current.y - currentCameraRef.current.y) * cameraSpeed;

        currentZoomRef.current +=
          (targetZoomRef.current - currentZoomRef.current) * (cameraSpeed * 1.3);

        const camX = currentCameraRef.current.x;
        const camY = currentCameraRef.current.y;
        const dynamicZoom = Math.max(1.0, currentZoomRef.current);

        // 2. LAYER 1: Aesthetic Blurred & Dimmed Backdrop (Hardware GPU-scaled: 0% CPU, 0ms lag!)
        if (!blurCanvasRef.current && typeof document !== "undefined") {
          blurCanvasRef.current = document.createElement("canvas");
          blurCanvasRef.current.width = 120;
          blurCanvasRef.current.height = 213;
        }
        const bCanvas = blurCanvasRef.current;
        if (bCanvas) {
          const bCtx = bCanvas.getContext("2d");
          bCtx.drawImage(video, 0, 0, 120, 213);
          ctx.save();
          ctx.drawImage(bCanvas, 0, 0, outW, outH);
          ctx.fillStyle = `rgba(6, 10, 20, ${bgDim})`;
          ctx.fillRect(0, 0, outW, outH);
          ctx.restore();
        }

        // 3. Dark Gradient Overlay for high-end cinematic feel
        const gradient = ctx.createLinearGradient(0, 0, 0, outH);
        gradient.addColorStop(0, "rgba(8, 13, 26, 0.45)");
        gradient.addColorStop(0.5, "rgba(8, 13, 26, 0.15)");
        gradient.addColorStop(1, "rgba(8, 13, 26, 0.7)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, outW, outH);

        // 4. LAYER 2: DYNAMICALLY ZOOMED & FOCUSED Desktop Screen Cutout
        let cardW, cardH, cardX, cardY;
        if (framingMode === "full") {
          cardW = outW;
          cardH = outH;
          cardX = 0;
          cardY = 0;
        } else if (framingMode === "classic") {
          const cardMargin = 35;
          cardW = outW - cardMargin * 2;
          cardH = cardW / ((srcW && srcH) ? (srcW / srcH) : (16 / 9));
          cardX = cardMargin;
          cardY = (outH - cardH) / 2;
        } else {
          // Default: "fill" - TALL IMMERSIVE 9:16 VERTICAL CARD (Fills the phone vertically in 9:16!)
          cardW = 1000;
          cardH = 1520;
          cardX = (outW - cardW) / 2;
          cardY = (outH - cardH) / 2;
        }

        const cardAspect = cardW / cardH;
        // Calculate crop window on source video centered around (camX, camY) using dynamicZoom!
        let cropH = srcH / Math.max(1.0, dynamicZoom);
        let cropW = cropH * cardAspect;

        if (cropW > srcW) {
          cropW = srcW;
          cropH = cropW / cardAspect;
        }

        let sx = camX * srcW - cropW / 2;
        let sy = camY * srcH - cropH / 2;

        // Clamp crop within bounds
        sx = Math.max(0, Math.min(Math.max(0, srcW - cropW), sx));
        sy = Math.max(0, Math.min(Math.max(0, srcH - cropH), sy));

        ctx.save();
        // Drop shadow for the floating app frame
        if (framingMode !== "full") {
          ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
          ctx.shadowBlur = 38;
          ctx.shadowOffsetY = 18;
        }

        // Clip rounded rectangle
        ctx.beginPath();
        const effectiveRadius = framingMode === "full" ? 0 : frameRadius;
        if (ctx.roundRect) {
          ctx.roundRect(cardX, cardY, cardW, cardH, effectiveRadius);
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
        if (framingMode !== "full") {
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
        }

        // 5b. SCREEN STUDIO CURSOR SPOTLIGHT HALO (Follows user's mouse cursor across desktop!)
        if (activeCursorPosRef.current && activeCursorPosRef.current.visible) {
          const cur = activeCursorPosRef.current;
          const px = cur.x * srcW;
          const py = cur.y * srcH;
          const relX = (px - sx) / cropW;
          const relY = (py - sy) / cropH;
          const curCanvasX = cardX + relX * cardW;
          const curCanvasY = cardY + relY * cardH;

          if (
            curCanvasX >= cardX - 25 &&
            curCanvasX <= cardX + cardW + 25 &&
            curCanvasY >= cardY - 25 &&
            curCanvasY <= cardY + cardH + 25
          ) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(curCanvasX, curCanvasY, 20, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(56, 189, 248, 0.85)";
            ctx.lineWidth = 3;
            ctx.shadowColor = "#38bdf8";
            ctx.shadowBlur = 14;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(curCanvasX, curCanvasY, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = "#ffffff";
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.restore();
          }
        }

        // 5c. Click Ripples / Visual Pulse FX
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
          const headerY = framingMode === "full" ? 110 : Math.max(90, cardY - 45);
          ctx.fillText(`⚡ ${brandText}`, outW / 2, headerY);

          ctx.font = "600 20px Inter, sans-serif";
          ctx.fillStyle = "#38bdf8";
          ctx.fillText("AI ENGINE DEMO", outW / 2, headerY + 31);
          ctx.restore();
        }

        // 7. Footer CTA Pill
        if (showBrandBadge) {
          ctx.save();
          const pillW = 420;
          const pillH = 64;
          const pillX = (outW - pillW) / 2;
          const pillY = framingMode === "full" ? 1800 : Math.min(1820, cardY + cardH + 35);

          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(pillX, pillY, pillW, pillH, 32);
          } else {
            ctx.rect(pillX, pillY, pillW, pillH);
          }
          ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
          ctx.strokeStyle = "rgba(16, 185, 129, 0.5)";
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();

          ctx.font = "700 22px Inter, sans-serif";
          ctx.fillStyle = "#34d399";
          ctx.textAlign = "center";
          ctx.fillText("🚀 Try Free at ai.gabbarinfo.com", outW / 2, pillY + 40);
          ctx.restore();
        }
      }

      if (!document.hidden) {
        animFrameIdRef.current = requestAnimationFrame(render);
      }
    };

    if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    animFrameIdRef.current = requestAnimationFrame(render);

    // Background tab render ticker (fires ONLY when hidden during recording/playback, NO RAF fork bomb!)
    if (bgIntervalRef.current) clearInterval(bgIntervalRef.current);
    bgIntervalRef.current = setInterval(() => {
      if (document.hidden && (isRecordingRef.current || isPlaying)) {
        render();
      }
    }, 66);
  }, [zoomFactor, cameraSpeed, bgBlur, bgDim, frameRadius, showRipples, autoPan, brandText, showBrandBadge, framingMode]);

  // Restart loop on setting changes & tab visibility
  useEffect(() => {
    startRenderLoop();
    const handleVis = () => {
      if (!document.hidden) {
        startRenderLoop();
      }
    };
    document.addEventListener("visibilitychange", handleVis);
    return () => {
      document.removeEventListener("visibilitychange", handleVis);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (bgIntervalRef.current) clearInterval(bgIntervalRef.current);
    };
  }, [startRenderLoop]);

  // -------------------------------------------------------------
  // 5. EXPORT / RECORD 9:16 REEL TO MP4 / WEBM (WITH MIC VOICEOVER)
  // -------------------------------------------------------------
  const handleStartRecording = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      recordedChunksRef.current = [];
      const stream = canvas.captureStream(60);

      // 1. Microphone voiceover capture (safe)
      let micTrack = null;
      if (recordMic && navigator.mediaDevices?.getUserMedia) {
        try {
          const mStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          micStreamRef.current = mStream;
          if (mStream.getAudioTracks().length > 0) {
            micTrack = mStream.getAudioTracks()[0];
          }
        } catch (err) {
          console.warn("Microphone access denied or unavailable:", err);
        }
      }

      // 2. Source video / live screen audio capture (Safe extraction without calling video.captureStream() on MediaStream)
      let videoAudioTrack = null;
      try {
        if (screenStreamRef.current && screenStreamRef.current.getAudioTracks().length > 0) {
          videoAudioTrack = screenStreamRef.current.getAudioTracks()[0];
        } else if (videoRef.current && mode === "upload") {
          const v = videoRef.current;
          let audioStream = null;
          if (typeof v.captureStream === "function") {
            try { audioStream = v.captureStream(); } catch (e) {}
          } else if (typeof v.mozCaptureStream === "function") {
            try { audioStream = v.mozCaptureStream(); } catch (e) {}
          }
          if (audioStream && audioStream.getAudioTracks().length > 0) {
            videoAudioTrack = audioStream.getAudioTracks()[0];
          }
        }
      } catch (audErr) {
        console.warn("Could not capture system/video audio:", audErr);
      }

      // 3. Audio Mixing using Web Audio API (Mic + System/Video Audio)
      if (micTrack && videoAudioTrack) {
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            const audioCtx = new AudioCtx();
            if (audioCtx.state === "suspended") {
              await audioCtx.resume();
            }
            audioContextRef.current = audioCtx;
            const dest = audioCtx.createMediaStreamDestination();

            const micSource = audioCtx.createMediaStreamSource(new MediaStream([micTrack]));
            const videoSource = audioCtx.createMediaStreamSource(new MediaStream([videoAudioTrack]));

            micSource.connect(dest);
            videoSource.connect(dest);

            const mixedTrack = dest.stream.getAudioTracks()[0];
            if (mixedTrack) {
              stream.addTrack(mixedTrack);
            }
          } else {
            stream.addTrack(micTrack);
          }
        } catch (mixErr) {
          console.warn("Audio mixing fallback, adding mic track directly:", mixErr);
          try { stream.addTrack(micTrack); } catch (e) {}
        }
      } else if (micTrack) {
        try { stream.addTrack(micTrack); } catch (e) {}
      } else if (videoAudioTrack) {
        try { stream.addTrack(videoAudioTrack); } catch (e) {}
      }

      // 4. Robust MediaRecorder initialization with fallbacks
      let recorder = null;
      let usedMime = "";
      const mimeOptions = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4",
      ];

      for (const mime of mimeOptions) {
        try {
          if (MediaRecorder.isTypeSupported(mime)) {
            usedMime = mime;
            recorder = new MediaRecorder(stream, {
              mimeType: mime,
              videoBitsPerSecond: 8000000,
            });
            break;
          }
        } catch (e) {}
      }

      if (!recorder) {
        try {
          recorder = new MediaRecorder(stream);
        } catch (eFallback) {
          console.error("Default MediaRecorder creation failed:", eFallback);
          alert("MediaRecorder error: " + eFallback.message);
          return;
        }
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        try {
          if (recordedChunksRef.current && recordedChunksRef.current.length > 0) {
            const finalMime = recorder.mimeType || usedMime || "video/webm";
            const blob = new Blob(recordedChunksRef.current, { type: finalMime });
            if (blob.size > 0) {
              const url = URL.createObjectURL(blob);
              setRecordedBlobUrl(url);
              setShowDownloadModal(true); // Open modal with video preview and download immediately!
            }
          }
        } catch (stopErr) {
          console.error("Error creating video blob on stop:", stopErr);
        }
        setIsProcessing(false);
        setIsRecording(false);
        isRecordingRef.current = false;
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      isRecordingRef.current = true;
      recordingStartTimeRef.current = Date.now();
      cursorTimelineRef.current = [];
      setRecordingSeconds(0);

      // If video source is loaded, play from start
      const video = videoRef.current;
      if (video && sourceVideoUrl) {
        video.currentTime = 0;
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      }

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (startErr) {
      console.error("Failed to start recording:", startErr);
      alert("Could not start recording: " + startErr.message);
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

  // 3-2-1 Cinematic Countdown before recording starts (with audible cues)
  const triggerRecordingCountdown = () => {
    if (countdown !== null || isRecording) return;
    setCountdown(3);
    playBeep(650, 0.14);
    let count = 3;
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        playBeep(650, 0.14);
      } else {
        clearInterval(countdownIntervalRef.current);
        setCountdown(null);
        playBeep(1200, 0.28); // Celebratory GO cue
        handleStartRecording();
      }
    }, 1000);
  };

  const handleStopRecording = () => {
    isRecordingRef.current = false;
    lastRecordedDurationRef.current = recordingSeconds;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === "recording") {
        setIsProcessing(true);
        try {
          mediaRecorderRef.current.requestData();
        } catch (e) {}
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {}
      }
    } else {
      setIsRecording(false);
      setIsProcessing(false);
    }

    // Clean up mic stream cleanly so browser recording dot turns off
    if (micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch (e) {}
      audioContextRef.current = null;
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
            padding: "14px 24px",
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

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {recordedBlobUrl && (
              <button
                type="button"
                onClick={handleDownload}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#042416",
                  fontWeight: 800,
                  fontSize: 12,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>💾</span> Download Finished Reel
              </button>
            )}
            <Link
              href="/"
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#cbd5e1",
                fontSize: 12,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              ← Back to Dashboard
            </Link>
          </div>
        </header>

        {/* Persistent Top Success Banner when reel is recorded */}
        {recordedBlobUrl && (
          <div
            style={{
              padding: "10px 24px",
              background: "linear-gradient(90deg, rgba(16, 185, 129, 0.3) 0%, rgba(56, 189, 248, 0.25) 100%)",
              borderBottom: "1px solid rgba(16, 185, 129, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>🎉</span>
              <div>
                <strong style={{ fontSize: 13, color: "#34d399", display: "block" }}>
                  Your 9:16 Vertical Reel is Ready!
                </strong>
                <span style={{ fontSize: 11, color: "#cbd5e1" }}>
                  Video, dynamic cursor zooms, and voiceover rendered successfully.
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowDownloadModal(true)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 12,
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  cursor: "pointer",
                }}
              >
                👁️ Watch Preview
              </button>
              <button
                type="button"
                onClick={handleDownload}
                style={{
                  padding: "7px 18px",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#042416",
                  fontWeight: 800,
                  fontSize: 12,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 0 20px rgba(16, 185, 129, 0.4)",
                }}
              >
                💾 Download MP4
              </button>
            </div>
          </div>
        )}

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
                      padding: "20px 16px",
                      borderRadius: 12,
                      border: sourceVideoFile ? "2px solid rgba(16, 185, 129, 0.4)" : "2px dashed rgba(56, 189, 248, 0.35)",
                      background: sourceVideoFile ? "rgba(16, 185, 129, 0.05)" : "rgba(56, 189, 248, 0.03)",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontSize: 28, marginBottom: 6 }}>{sourceVideoFile ? "🎬" : "📤"}</span>
                    <strong style={{ fontSize: 13, color: sourceVideoFile ? "#34d399" : "#38bdf8" }}>
                      {sourceVideoFile ? `✓ Loaded: ${sourceVideoFile.name}` : "Click to Upload MP4 / WebM Recording"}
                    </strong>
                    <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                      {sourceVideoFile ? "Click here if you want to switch to a different video file" : "Standard 16:9 desktop screen recording (e.g. from Win+Alt+R or OBS)"}
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      onChange={handleFileUpload}
                      style={{ display: "none" }}
                    />
                  </label>

                  {/* Video Playback & Seek Controller */}
                  {sourceVideoFile && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "14px 16px",
                        borderRadius: 12,
                        background: "rgba(15, 23, 42, 0.8)",
                        border: "1px solid rgba(56, 189, 248, 0.25)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: isPlaying ? "#10b981" : "#f59e0b", display: "inline-block" }} />
                          <strong style={{ fontSize: 12, color: isPlaying ? "#34d399" : "#fbbf24" }}>
                            {isPlaying ? "Playing Live Preview" : "Preview Paused"}
                          </strong>
                        </div>
                        <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          onClick={togglePlayPause}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            background: isPlaying ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.25)",
                            border: `1px solid ${isPlaying ? "rgba(239, 68, 68, 0.5)" : "rgba(16, 185, 129, 0.5)"}`,
                            color: isPlaying ? "#fca5a5" : "#34d399",
                            fontWeight: 800,
                            fontSize: 12,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isPlaying ? "⏸️ Pause" : "▶️ Play"}
                        </button>

                        <input
                          type="range"
                          min="0"
                          max={duration || 100}
                          step="0.1"
                          value={currentTime}
                          onChange={handleSeek}
                          style={{ flex: 1, accentColor: "#38bdf8", cursor: "pointer" }}
                        />
                      </div>

                      <p style={{ margin: 0, fontSize: 11, color: "#cbd5e1", lineHeight: 1.4 }}>
                        👆 Click <strong>Play</strong> to watch your video on the right. <strong>Move your mouse</strong> over the phone screen to direct where the camera zooms.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                    Captures your GabbarInfo AI window or tab live. Your mouse movements will be tracked smoothly on the vertical canvas.
                  </p>
                  <button
                    onClick={() => handleStartScreenCapture(true)}
                    style={{
                      padding: "12px 18px",
                      borderRadius: 10,
                      background: isScreenConnected
                        ? "rgba(16, 185, 129, 0.2)"
                        : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: isScreenConnected ? "#34d399" : "#042416",
                      fontWeight: 800,
                      fontSize: 13,
                      border: isScreenConnected ? "1px solid #10b981" : "none",
                      cursor: "pointer",
                    }}
                  >
                    {isScreenConnected ? "✅ Screen Connected & Ready (Click to Change)" : "🖥️ Select Window / Tab & Start"}
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

              {/* Framing Mode Selector */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 8 }}>
                  📐 Framing Style (How Video Fits on Phone)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { id: "fill", label: "📱 Vertical Fill", desc: "3x Larger (Best for Reels)" },
                    { id: "full", label: "🌟 Full Bleed", desc: "Edge-to-Edge 9:16" },
                    { id: "classic", label: "🖥️ Mini 16:9", desc: "Letterbox Center" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFramingMode(f.id)}
                      style={{
                        padding: "8px 6px",
                        borderRadius: 10,
                        background: framingMode === f.id ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.05)",
                        border: `1px solid ${framingMode === f.id ? "#38bdf8" : "rgba(255, 255, 255, 0.1)"}`,
                        color: framingMode === f.id ? "#38bdf8" : "#94a3b8",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        gap: 2,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 800 }}>{f.label}</span>
                      <span style={{ fontSize: 9.5, opacity: 0.8 }}>{f.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera Focus Position */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", display: "block", marginBottom: 8 }}>
                  🎯 Camera Focus Position
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                  {[
                    { id: "center", label: "🎯 Center", x: 0.5, y: 0.5 },
                    { id: "left", label: "👈 Left Nav", x: 0.15, y: 0.5 },
                    { id: "right", label: "👉 Right Main", x: 0.85, y: 0.5 },
                    { id: "top", label: "🔼 Top Bar", x: 0.5, y: 0.18 },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        targetFocusRef.current = { x: p.x, y: p.y };
                        activeCursorPosRef.current = { x: p.x, y: p.y, visible: true };
                        userManualOverrideRef.current = Date.now();
                        setFocusArea(p.id);
                      }}
                      style={{
                        padding: "7px 4px",
                        borderRadius: 8,
                        background: focusArea === p.id ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.05)",
                        border: `1px solid ${focusArea === p.id ? "#10b981" : "rgba(255, 255, 255, 0.1)"}`,
                        color: focusArea === p.id ? "#34d399" : "#cbd5e1",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Horizontal Pan Slider */}
              <div style={{ background: "rgba(56, 189, 248, 0.08)", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(56, 189, 248, 0.25)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 800, color: "#ffffff" }}>
                    ↔️ Slide Screen Left / Right (Pan)
                  </label>
                  <button
                    type="button"
                    onClick={() => setAutoPan(!autoPan)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: autoPan ? "linear-gradient(135deg, #10b981, #059669)" : "rgba(255, 255, 255, 0.08)",
                      color: autoPan ? "#042416" : "#38bdf8",
                      fontWeight: 800,
                      fontSize: 11,
                      border: "none",
                      cursor: "pointer",
                      boxShadow: autoPan ? "0 0 14px rgba(16, 185, 129, 0.5)" : "none",
                    }}
                  >
                    {autoPan ? "✨ Auto-Glide: ON" : "🎬 Auto-Glide: OFF"}
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>Camera Focus:</span>
                  <span style={{ fontSize: 12, color: "#38bdf8", fontWeight: 800 }}>
                    {autoPan ? "Auto-Scanning across screen" : panPosition < 0.35 ? "Left Sidebar" : panPosition > 0.65 ? "Right Panel" : "Center Overview"}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.06"
                  max="0.94"
                  step="0.01"
                  value={panPosition}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setAutoPan(false);
                    setPanPosition(val);
                    panPositionRef.current = val;
                    targetFocusRef.current = { x: val, y: targetFocusRef.current.y };
                    userManualOverrideRef.current = Date.now();
                  }}
                  style={{ width: "100%", accentColor: "#38bdf8", cursor: "pointer", height: 8 }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  <span>👈 Left Sidebar (0%)</span>
                  <span>🎯 Center (50%)</span>
                  <span>👉 Right Panel (100%)</span>
                </div>
              </div>

              {/* Zoom Level */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#cbd5e1" }}>🔍 Zoom Magnitude</label>
                  <span style={{ fontSize: 12, color: "#38bdf8", fontWeight: 700 }}>{zoomFactor.toFixed(1)}x {zoomFactor === 1.0 ? "(Fit Screen)" : ""}</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="3.5"
                  step="0.1"
                  value={zoomFactor}
                  onChange={(e) => setCameraZoom(parseFloat(e.target.value))}
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
                    checked={autoZoomOnHover}
                    onChange={(e) => setAutoZoomOnHover(e.target.checked)}
                    style={{ accentColor: "#38bdf8" }}
                  />
                  <span>Dynamic Motion Zoom (Pulls out when moving, zooms in deep when hovering)</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#cbd5e1", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={punchZoomOnClick}
                    onChange={(e) => setPunchZoomOnClick(e.target.checked)}
                    style={{ accentColor: "#38bdf8" }}
                  />
                  <span>Click to Punch Zoom (Instant toggle between wide & close-up)</span>
                </label>

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
                  <span>Auto-Scan Camera (Hands-free slow cinematic glide & breathe zoom)</span>
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
                  type="button"
                  onClick={() => {
                    if (mode === "upload") {
                      if (!sourceVideoUrl) {
                        fileInputRef.current?.click();
                      } else {
                        triggerRecordingCountdown();
                      }
                    } else {
                      if (!isScreenConnected && !screenStreamRef.current) {
                        handleStartScreenCapture(true);
                      } else {
                        triggerRecordingCountdown();
                      }
                    }
                  }}
                  style={{
                    padding: "14px 20px",
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: 14,
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    boxShadow: "0 0 25px rgba(239, 68, 68, 0.4)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🔴</span> Start Recording Reel
                  </div>
                  {((mode === "upload" && !sourceVideoUrl) || (mode === "record" && !isScreenConnected && !screenStreamRef.current)) && (
                    <span style={{ fontSize: 10.5, opacity: 0.85, fontWeight: 500 }}>
                      {mode === "upload" ? "(Click to pick video & start)" : "(Click to pick window/tab & start)"}
                    </span>
                  )}
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
            {/* Prominent Live Status Bar */}
            {isRecording ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  maxWidth: 360,
                  marginBottom: 10,
                  padding: "10px 16px",
                  borderRadius: 14,
                  background: "rgba(239, 68, 68, 0.25)",
                  border: "1px solid rgba(239, 68, 68, 0.6)",
                  boxShadow: "0 0 25px rgba(239, 68, 68, 0.25)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "#ef4444",
                      display: "inline-block",
                      boxShadow: "0 0 10px #ef4444",
                    }}
                  />
                  <strong style={{ fontSize: 13, color: "#fca5a5" }}>
                    🔴 RECORDING: {formatTime(recordingSeconds)}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={handleStopRecording}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 8,
                    background: "#ef4444",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 800,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  ⏹️ Stop & Save
                </button>
              </div>
            ) : recordedBlobUrl ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  maxWidth: 360,
                  marginBottom: 10,
                  padding: "10px 16px",
                  borderRadius: 14,
                  background: "rgba(16, 185, 129, 0.2)",
                  border: "1px solid rgba(16, 185, 129, 0.6)",
                  boxShadow: "0 0 25px rgba(16, 185, 129, 0.25)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>🎉</span>
                  <strong style={{ fontSize: 13, color: "#34d399" }}>Reel Recorded!</strong>
                </div>
                <button
                  type="button"
                  onClick={handleDownload}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#042416",
                    border: "none",
                    fontWeight: 800,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  💾 Download MP4
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  maxWidth: 360,
                  marginBottom: 10,
                  padding: "8px 14px",
                  borderRadius: 12,
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13 }}>👁️</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>
                    Director Preview (Not Recording)
                  </span>
                </div>
                <span style={{ fontSize: 10, color: "#64748b" }}>Test Zooms Live</span>
              </div>
            )}

            {/* Phone Screen Frame (9:16) */}
            <div
              style={{
                width: 350,
                height: 622,
                borderRadius: 36,
                border: "4px solid rgba(255, 255, 255, 0.18)",
                boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.95), 0 0 50px rgba(56, 189, 248, 0.2)",
                overflow: "hidden",
                position: "relative",
                background: "#060913",
                cursor: "crosshair",
              }}
              onMouseMove={handleCanvasMouseMove}
              onClick={handleCanvasClick}
              onWheel={handleCanvasWheel}
              onMouseLeave={handleCanvasMouseLeave}
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

              {/* Click to Play Overlay when video is paused */}
              {sourceVideoUrl && !isPlaying && (
                <div
                  onClick={togglePlayPause}
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0, 0, 0, 0.4)",
                    zIndex: 15,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      background: "rgba(16, 185, 129, 0.95)",
                      boxShadow: "0 0 30px rgba(16, 185, 129, 0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                      paddingLeft: 4,
                      color: "#042416",
                      marginBottom: 8,
                    }}
                  >
                    ▶
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#ffffff", background: "rgba(0,0,0,0.7)", padding: "4px 12px", borderRadius: 999 }}>
                    Click to Play Preview
                  </span>
                </div>
              )}

              {/* Overlay Prompt when no video is loaded */}
              {!sourceVideoUrl && !isScreenConnected && !screenStreamRef.current && (
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
                    background: "rgba(6, 9, 19, 0.9)",
                    zIndex: 10,
                  }}
                >
                  <span style={{ fontSize: 44, marginBottom: 12 }}>📱</span>
                  <strong style={{ fontSize: 16, color: "#ffffff", marginBottom: 6 }}>
                    No Video Source Active
                  </strong>
                  <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, margin: "0 0 16px 0" }}>
                    Select a 16:9 screen video or capture your live screen to direct your 9:16 Reel.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (mode === "upload") {
                        fileInputRef.current?.click();
                      } else {
                        handleStartScreenCapture(true);
                      }
                    }}
                    style={{
                      padding: "11px 20px",
                      borderRadius: 10,
                      background: "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
                      color: "#031525",
                      fontWeight: 800,
                      fontSize: 13,
                      border: "none",
                      cursor: "pointer",
                      boxShadow: "0 0 25px rgba(56, 189, 248, 0.45)",
                    }}
                  >
                    {mode === "upload" ? "📁 Pick 16:9 Video File" : "🖥️ Select Window / Tab & Start"}
                  </button>
                </div>
              )}
            </div>

            {/* Quick Zoom & Focus Preset Buttons */}
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%", maxWidth: 390 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Zoom:
                </span>
                {[
                  { label: "1.0x Full Screen (No Crop)", val: 1.0 },
                  { label: "1.8x Balanced", val: 1.8 },
                  { label: "2.5x Close-Up", val: 2.5 },
                  { label: "3.2x Macro", val: 3.2 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setCameraZoom(preset.val)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 20,
                      background: Math.abs(zoomFactor - preset.val) < 0.25 ? "rgba(56, 189, 248, 0.3)" : "rgba(255, 255, 255, 0.08)",
                      border: `1px solid ${Math.abs(zoomFactor - preset.val) < 0.25 ? "#38bdf8" : "rgba(255, 255, 255, 0.15)"}`,
                      color: Math.abs(zoomFactor - preset.val) < 0.25 ? "#38bdf8" : "#cbd5e1",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {preset.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleResetCamera}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.35)",
                    color: "#34d399",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  title="Reset to center full screen"
                >
                  🔄 Reset Center
                </button>
              </div>

              {/* Quick Focus Targets */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Pan:
                </span>
                {[
                  { label: "🎯 Center", x: 0.5, y: 0.5, id: "center" },
                  { label: "👈 Left Nav", x: 0.15, y: 0.5, id: "left" },
                  { label: "👉 Right Main", x: 0.85, y: 0.5, id: "right" },
                  { label: "🔼 Top Bar", x: 0.5, y: 0.18, id: "top" },
                ].map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => {
                      targetFocusRef.current = { x: pos.x, y: pos.y };
                      activeCursorPosRef.current = { x: pos.x, y: pos.y, visible: true };
                      userManualOverrideRef.current = Date.now();
                      setFocusArea(pos.id);
                    }}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 16,
                      background: focusArea === pos.id ? "rgba(16, 185, 129, 0.25)" : "rgba(255, 255, 255, 0.06)",
                      border: `1px solid ${focusArea === pos.id ? "#10b981" : "rgba(255, 255, 255, 0.12)"}`,
                      color: focusArea === pos.id ? "#34d399" : "#cbd5e1",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {pos.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    const next = !autoPan;
                    setAutoPan(next);
                    if (next) userManualOverrideRef.current = 0;
                  }}
                  style={{
                    padding: "5px 11px",
                    borderRadius: 16,
                    background: autoPan ? "rgba(56, 189, 248, 0.35)" : "rgba(255, 255, 255, 0.06)",
                    border: `1px solid ${autoPan ? "#38bdf8" : "rgba(255, 255, 255, 0.15)"}`,
                    color: autoPan ? "#38bdf8" : "#cbd5e1",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: autoPan ? "0 0 15px rgba(56, 189, 248, 0.4)" : "none",
                  }}
                  title="Automatically pans across the 16:9 screen smoothly like a camera operator"
                >
                  {autoPan ? "✨ Auto-Glide: ON" : "✨ Auto-Glide"}
                </button>
              </div>

              {/* SMOOTH HORIZONTAL PAN SLIDER UNDER CANVAS */}
              <div
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "rgba(15, 23, 42, 0.9)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#ffffff" }}>
                    ↔️ Slide Screen (Pan Left / Right)
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setAutoPan(!autoPan)}
                      style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: autoPan ? "linear-gradient(135deg, #10b981, #059669)" : "rgba(255, 255, 255, 0.08)",
                        color: autoPan ? "#042416" : "#38bdf8",
                        fontWeight: 800,
                        fontSize: 10,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {autoPan ? "✨ Auto: ON" : "🎬 Auto: OFF"}
                    </button>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8" }}>
                      {autoPan ? "Scanning" : panPosition < 0.35 ? "Left Sidebar" : panPosition > 0.65 ? "Right Panel" : "Center Overview"}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0.06"
                  max="0.94"
                  step="0.01"
                  value={panPosition}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setAutoPan(false);
                    setPanPosition(val);
                    panPositionRef.current = val;
                    targetFocusRef.current = { x: val, y: targetFocusRef.current.y };
                    userManualOverrideRef.current = Date.now();
                  }}
                  style={{ width: "100%", accentColor: "#38bdf8", cursor: "pointer", height: 6 }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8" }}>
                  <span>👈 Left (0%)</span>
                  <span>🎯 Center (50%)</span>
                  <span>👉 Right (100%)</span>
                </div>
              </div>

              {/* VIDEO PLAYBACK & REPLAY SCRUBBER CONTROLLER (Visible when video is loaded or recorded!) */}
              {sourceVideoUrl && (
                <div
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: "rgba(15, 23, 42, 0.95)",
                    border: "1px solid rgba(56, 189, 248, 0.35)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    boxShadow: "0 0 25px rgba(56, 189, 248, 0.15)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: isPlaying ? "#10b981" : "#f59e0b", display: "inline-block" }} />
                      <strong style={{ fontSize: 12, color: isPlaying ? "#34d399" : "#fbbf24" }}>
                        {isPlaying ? "▶ Playing (Move mouse to direct!)" : "⏸ Paused (Hit Play to Direct)"}
                      </strong>
                    </div>
                    <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      onClick={togglePlayPause}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        background: isPlaying ? "rgba(239, 68, 68, 0.25)" : "rgba(16, 185, 129, 0.3)",
                        border: `1px solid ${isPlaying ? "rgba(239, 68, 68, 0.6)" : "rgba(16, 185, 129, 0.6)"}`,
                        color: isPlaying ? "#fca5a5" : "#34d399",
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isPlaying ? "⏸ Pause" : "▶ Play Video"}
                    </button>

                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      step="0.1"
                      value={currentTime}
                      onChange={handleSeek}
                      style={{ flex: 1, accentColor: "#38bdf8", cursor: "pointer" }}
                    />
                  </div>

                  <p style={{ margin: 0, fontSize: 10.5, color: "#cbd5e1", lineHeight: 1.4 }}>
                    👆 <strong>Director Mode:</strong> Hit <strong>Play</strong>, then move your mouse over the phone screen or click <strong>Left Nav / Right Main</strong> above to direct your zooms & pans in real time!
                  </p>
                </div>
              )}

              {/* PRIMARY ONE-CLICK RECORD / FINISH / DOWNLOAD BUTTON */}
              <div style={{ width: "100%", maxWidth: 360, marginTop: 4 }}>
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (mode === "upload") {
                        if (!sourceVideoUrl) {
                          fileInputRef.current?.click();
                        } else {
                          triggerRecordingCountdown();
                        }
                      } else {
                        if (!isScreenConnected && !screenStreamRef.current) {
                          handleStartScreenCapture(true);
                        } else {
                          triggerRecordingCountdown();
                        }
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "14px 20px",
                      borderRadius: 12,
                      background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                      color: "#ffffff",
                      fontWeight: 800,
                      fontSize: 15,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      boxShadow: "0 0 30px rgba(239, 68, 68, 0.5)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16 }}>
                      <span>🔴</span> {sourceVideoUrl ? "Bake & Export Directed 9:16 Reel" : "Start Recording 9:16 Reel"}
                    </div>
                    {sourceVideoUrl ? (
                      <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255, 255, 255, 0.9)" }}>
                        (Records video with your live mouse slides & zooms into a new 9:16 Reel)
                      </span>
                    ) : ((mode === "upload" && !sourceVideoUrl) || (mode === "record" && !isScreenConnected && !screenStreamRef.current)) ? (
                      <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255, 255, 255, 0.85)" }}>
                        {mode === "upload" ? "(Click to pick 16:9 video & begin)" : "(Click to pick window/tab & begin)"}
                      </span>
                    ) : null}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    style={{
                      width: "100%",
                      padding: "13px 20px",
                      borderRadius: 12,
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
                      boxShadow: "0 0 25px rgba(16, 185, 129, 0.45)",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>⏹️</span> Stop & Save 9:16 Reel ({recordingSeconds}s)
                  </button>
                )}

                {recordedBlobUrl && (
                  <button
                    type="button"
                    onClick={handleDownload}
                    style={{
                      marginTop: 8,
                      width: "100%",
                      padding: "13px 20px",
                      borderRadius: 12,
                      background: "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
                      color: "#031525",
                      fontWeight: 800,
                      fontSize: 14,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      boxShadow: "0 0 25px rgba(56, 189, 248, 0.4)",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>💾</span> Download 1080x1920 Reel MP4
                  </button>
                )}

                {/* Mic Voiceover Live Toggle */}
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      color: recordMic ? "#34d399" : "#94a3b8",
                      cursor: "pointer",
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: recordMic ? "rgba(16, 185, 129, 0.12)" : "rgba(255, 255, 255, 0.05)",
                      border: `1px solid ${recordMic ? "rgba(16, 185, 129, 0.3)" : "rgba(255, 255, 255, 0.1)"}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={recordMic}
                      onChange={(e) => setRecordMic(e.target.checked)}
                      style={{ accentColor: "#10b981" }}
                    />
                    <span>{recordMic ? "🎙️ Mic Voiceover: ACTIVE (Speaking recorded)" : "🔇 Mic Voiceover: OFF"}</span>
                  </label>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  padding: "6px 14px",
                  borderRadius: 12,
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  fontSize: 11,
                  color: "#94a3b8",
                  flexWrap: "wrap",
                }}
              >
                <span>🖱️ <strong>Scroll wheel</strong> to zoom</span>
                <span>•</span>
                <span>👆 <strong>Click video</strong> to toggle punch</span>
                <span>•</span>
                <span>🎯 <strong>Move mouse</strong> to aim</span>
              </div>
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

        {/* 3... 2... 1... COUNTDOWN OVERLAY */}
        {countdown !== null && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(4, 8, 18, 0.9)",
              backdropFilter: "blur(14px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 3000,
            }}
          >
            <div
              style={{
                fontSize: 130,
                fontWeight: 900,
                color: "#38bdf8",
                lineHeight: 1,
                marginBottom: 20,
                textShadow: "0 0 60px rgba(56, 189, 248, 0.9)",
              }}
            >
              {countdown}
            </div>
            <strong style={{ fontSize: 24, color: "#ffffff", letterSpacing: -0.5 }}>
              Get Ready to Demo & Speak!
            </strong>
            <p style={{ fontSize: 14, color: "#94a3b8", marginTop: 8 }}>
              Recording starts automatically in {countdown}s… Switch to your demo window now!
            </p>
          </div>
        )}

        {/* REEL READY DOWNLOAD MODAL */}
        {recordedBlobUrl && showDownloadModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(4, 8, 18, 0.88)",
              backdropFilter: "blur(12px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 3000,
              padding: 16,
            }}
          >
            <div
              style={{
                background: "#0c1324",
                border: "2px solid #10b981",
                borderRadius: 24,
                padding: "26px 28px",
                maxWidth: 440,
                width: "100%",
                maxHeight: "92vh",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                boxShadow: "0 0 60px rgba(16, 185, 129, 0.35)",
              }}
            >
              <div style={{ fontSize: 44, marginBottom: 6 }}>🎉</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", margin: "0 0 6px 0" }}>
                Your 9:16 Reel is Ready!
              </h2>
              <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", margin: "0 0 16px 0" }}>
                Dynamic zooms, smooth camera panning, and microphone voiceover are rendered together.
              </p>

              {/* Recorded video player */}
              <video
                src={recordedBlobUrl}
                controls
                autoPlay
                loop
                muted
                playsInline
                style={{
                  width: "100%",
                  maxHeight: 320,
                  borderRadius: 14,
                  background: "#000",
                  marginBottom: 18,
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  boxShadow: "0 0 25px rgba(56, 189, 248, 0.15)",
                }}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                <button
                  type="button"
                  onClick={handleDownload}
                  style={{
                    padding: "14px 20px",
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#042416",
                    fontWeight: 800,
                    fontSize: 15,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 0 30px rgba(16, 185, 129, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 18 }}>💾</span> Download 1080x1920 Reel MP4
                </button>

                <button
                  type="button"
                  onClick={() => setShowDownloadModal(false)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    background: "rgba(255, 255, 255, 0.08)",
                    color: "#cbd5e1",
                    fontWeight: 600,
                    fontSize: 12,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
