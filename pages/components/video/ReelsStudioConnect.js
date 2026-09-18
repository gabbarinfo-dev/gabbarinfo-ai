"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function ReelsStudioConnect() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email;

  const [selectedStyle, setSelectedStyle] = useState("talking_avatar"); // "talking_avatar" | "generative_cinematic" | "motion_broll"
  const [scriptMode, setScriptMode] = useState("ai_prompt"); // "ai_prompt" | "product_promo" | "custom_script"
  const [customScript, setCustomScript] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(15); // 15 | 30 | 60
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("business");
  const [language, setLanguage] = useState("hindi"); // "hindi" | "en_us" | "en_uk"
  const [voice, setVoice] = useState("arnold"); // dynamically updated on lang change
  const [backgroundBeat, setBackgroundBeat] = useState("upbeat_lofi");
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Product / Service Promotional Creator States
  const [brandName, setBrandName] = useState("");
  const [serviceToPromote, setServiceToPromote] = useState("");
  const [specialOffer, setSpecialOffer] = useState("");
  const [promoAngle, setPromoAngle] = useState("founder_pitch"); // "founder_pitch" | "customer_owner_skit" | "direct_response"
  const [promoCTA, setPromoCTA] = useState("Click the link in bio to book your free slot");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [generatingPromoScript, setGeneratingPromoScript] = useState(false);
  const [extractedUsps, setExtractedUsps] = useState([]);

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
  const masterVideoUrlRef = useRef(null);

  const refreshChannelStatuses = async (overrideEmail) => {
    try {
      const activeEmail = overrideEmail || userEmail;
      const q = activeEmail ? `?userEmail=${encodeURIComponent(activeEmail)}` : "";
      const [ytRes, metaRes] = await Promise.all([
        fetch(`/api/youtube/status${q}`).then((r) => r.json()).catch(() => ({ connected: false })),
        fetch(`/api/meta/status${q}`).then((r) => r.json()).catch(() => ({ connected: false })),
      ]);
      setYoutubeStatus({ connected: !!ytRes.connected, channel: ytRes.channel || null, loading: false });
      setMetaStatus({ connected: !!metaRes.connected, meta: metaRes.meta || null, loading: false });
    } catch (_) {
      setYoutubeStatus((prev) => ({ ...prev, loading: false }));
      setMetaStatus((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    if (userEmail) {
      refreshChannelStatuses(userEmail);
    }
  }, [userEmail]);

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
      // Step 1: Bake master video ONCE for all selected channels
      let bakedVideoUrl = masterVideoUrlRef.current || generatedVideo.compositeVideoUrl;
      if (!bakedVideoUrl) {
        bakedVideoUrl = await compositeAndBakeVideo();
      }

      if (!bakedVideoUrl) {
        throw new Error("Unable to bake master composite video.");
      }

      for (const ch of selectedChannels) {
        await handlePublish(ch, bakedVideoUrl);
      }
    } catch (err) {
      console.error("[BatchPublish] Error:", err);
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
      id: "talking_avatar",
      icon: "👤",
      name: "Actor Lip-Sync & Dialogue Reel",
      tag: "Character Lip-Sync (Recommended)",
      tagColor: "#6366f1",
      desc: "Photorealistic digital actor or spokesperson speaking your script with 100% facial lip-sync (SadTalker GPU + GFPGAN Face Enhancer).",
      renderTime: "~45s render",
      cost: "AI character lip-sync",
      gradient: "linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(15, 23, 42, 0.7) 100%)",
      border: "rgba(99, 102, 241, 0.5)",
    },
    {
      id: "generative_cinematic",
      icon: "🎥",
      name: "Cinematic 3D Generative AI Video",
      tag: "Wan 2.1 / 3D Diffusion",
      tagColor: "#ec4899",
      desc: "Text-to-video AI neural synthesis rendering vibrant 3D cinematic scenes from scratch without stock footage.",
      renderTime: "~90s render",
      cost: "GPU rendering",
      gradient: "linear-gradient(135deg, rgba(236, 72, 153, 0.18) 0%, rgba(15, 23, 42, 0.7) 100%)",
      border: "rgba(236, 72, 153, 0.45)",
    },
    {
      id: "motion_broll",
      icon: "⚡",
      name: "Dynamic Motion Reel",
      tag: "HD B-Roll + Subtitles",
      tagColor: "#10b981",
      desc: "Synced 9:16 HD vertical cinematography + realistic voiceover + glowing kinetic karaoke subtitles.",
      renderTime: "~15s render",
      cost: "~₹0.30 per reel",
      gradient: "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%)",
      border: "rgba(16, 185, 129, 0.4)",
    },
  ];

  const CUSTOM_SCRIPT_PLACEHOLDERS = {
    en_uk: `Paste your exact British script or lines here.\nExample:\nScene 1: Still struggling to turn website visitors into high-paying clients?\nScene 2: Our bespoke digital strategy helps UK businesses scale revenue 10x faster.\nScene 3: Tap the link below to claim your complimentary growth consultation today.`,
    en_us: `Paste your exact script or lines here.\nExample:\nScene 1: Are you still losing qualified leads every single day?\nScene 2: Our AI-driven marketing engine scales your sales pipelines 10x faster!\nScene 3: Click the link below and get your free growth audit today.`,
    hindi: `Paste your exact script or lines here.\nExample:\nScene 1: क्या आप भी अपने बिज़नेस में वही पुरानी गलतियाँ कर रहे हैं?\nScene 2: Google Ads और SEO का सही बैलेंस आपके सेल्स को 10x कर सकता है!\nScene 3: लिंक पर क्लिक करें और आज ही अपना फ्री ऑडिट बुक करें।`,
  };

  const QUICK_TOPICS = {
    en_uk: [
      "3 Secrets to Scale Your E-Commerce Store in the UK",
      "Why 90% of Tech Startups Struggle in Year One",
      "Stop Wasting Your Marketing Budget on Ineffective Ads",
      "How to Secure High-Paying Clients in 30 Days",
    ],
    en_us: [
      "3 Secret Hacks to Scale Your Online Store in 2026",
      "Why 90% of Startups Fail in Their First 6 Months",
      "Stop Making This Costly Mistake With Your Advertising",
      "5 High-Income Skills You Can Learn in 30 Days",
    ],
    hindi: [
      "2026 में अपने ऑनलाइन स्टोर की सेल्स 10x कैसे बढ़ाएं?",
      "90% नए बिज़नेस पहले 6 महीनों में क्यों फेल हो जाते हैं?",
      "Google Ads और मेटा विज्ञापनों में यह बड़ी गलती कभी मत करना",
      "3 स्किल्स जो आपको महीने के लाखों कमा कर दे सकती हैं",
    ],
  };

  const VOICES_BY_LANG = {
    en_uk: [
      { id: "george", name: "George (Refined British Gentleman - ElevenLabs)" },
      { id: "lily", name: "Lily (Articulate British Female - ElevenLabs)" },
      { id: "fable", name: "Fable (Classic UK Storyteller)" },
      { id: "alloy", name: "Alloy (Modern International)" },
    ],
    en_us: [
      { id: "adam", name: "Adam (Deep Engaging Narrator - ElevenLabs)" },
      { id: "rachel", name: "Rachel (Warm Professional Female - ElevenLabs)" },
      { id: "charlie", name: "Charlie (Confident Commercial Executive - ElevenLabs)" },
      { id: "sarah", name: "Sarah (Mature Reassuring Authority - ElevenLabs)" },
      { id: "roger", name: "Roger (Casual Resonant Storyteller - ElevenLabs)" },
    ],
    hindi: [
      { id: "arnold", name: "Arnold (Fluent Hindi Commercial Male - ElevenLabs)" },
      { id: "emily", name: "Emily (Warm Hindi Commercial Female - ElevenLabs)" },
      { id: "adam", name: "Adam (Multilingual High-Energy Male - ElevenLabs)" },
      { id: "rachel", name: "Rachel (Multilingual Professional Female - ElevenLabs)" },
    ],
  };

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    if (newLang === "en_uk") {
      setVoice("george");
    } else if (newLang === "en_us") {
      setVoice("adam");
    } else {
      setVoice("arnold");
    }
  };

  const handleGeneratePromoScript = async () => {
    if (!serviceToPromote.trim() && !brandName.trim() && !websiteUrl.trim()) {
      setErrorMsg("Please provide your Brand Name, Service to promote, or Website URL.");
      return;
    }
    setGeneratingPromoScript(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/video/generate-promo-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: websiteUrl.trim(),
          brandName: brandName.trim(),
          serviceToPromote: serviceToPromote.trim(),
          specialOffer: specialOffer.trim(),
          promoAngle,
          promoCTA: promoCTA.trim(),
          language,
          durationSeconds,
          userEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to craft promotional screenplay.");
      }
      setCustomScript(data.formattedScript);
      if (Array.isArray(data.extractedUsps) && data.extractedUsps.length > 0) {
        setExtractedUsps(data.extractedUsps);
      }
      setToastMsg(`✅ ${data.title ? `"${data.title}"` : "Commercial screenplay"} crafted with deep USPs!`);
      setTimeout(() => setToastMsg(""), 6000);
    } catch (err) {
      setErrorMsg(err.message || "Failed to generate promotional script.");
    } finally {
      setGeneratingPromoScript(false);
    }
  };

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (scriptMode === "custom_script" && !customScript.trim()) {
      setErrorMsg("Please paste or write your custom script.");
      return;
    }
    if (scriptMode === "ai_prompt" && !topic.trim()) {
      setErrorMsg("Please enter a video topic or hook idea.");
      return;
    }
    if (scriptMode === "product_promo" && !customScript.trim() && !serviceToPromote.trim() && !brandName.trim()) {
      setErrorMsg("Please enter your Brand Name and Service to promote, or click 'Craft Commercial Script'.");
      return;
    }

    setGenerating(true);
    setErrorMsg("");
    setGeneratedVideo(null);
    setIsPlaying(false);
    setCurrentTime(0);
    masterVideoUrlRef.current = null;

    try {
      setGenerationStep(
        scriptMode === "custom_script"
          ? "Parsing custom screenplay into scenes…"
          : scriptMode === "product_promo"
          ? `Directing ${durationSeconds}s commercial ad for ${brandName || "your brand"}…`
          : `Writing viral hook & ${durationSeconds}s script with AI…`
      );
      await new Promise((r) => setTimeout(r, 600));

      setGenerationStep("Generating neural voiceover & lip-sync timeline…");
      await new Promise((r) => setTimeout(r, 800));

      setGenerationStep("Dispatching reel render to Railway GPU worker...");

      const effectiveTopic = topic.trim() || (brandName ? `${brandName} ${serviceToPromote}` : customScript.slice(0, 50));

      const res = await fetch("/api/video/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoType: "reel",
          payload: {
            topic: effectiveTopic,
            customScript: customScript.trim(),
            scriptMode,
            brandName: brandName.trim(),
            serviceToPromote: serviceToPromote.trim(),
            specialOffer: specialOffer.trim(),
            promoAngle,
            promoCTA: promoCTA.trim(),
            websiteUrl: websiteUrl.trim(),
            durationSeconds,
            niche,
            language,
            voice,
            backgroundBeat,
            selectedStyle,
          },
          userEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok || !data.jobId) {
        throw new Error(data.error || "Failed to start reel generation on worker.");
      }

      const jobId = data.jobId;
      setGenerationStep("Reel queued on Railway worker. Generating AI scenes...");

      await new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
          try {
            const pollRes = await fetch(`/api/video/job-status?jobId=${encodeURIComponent(jobId)}&userEmail=${encodeURIComponent(userEmail)}`);
            const jobData = await pollRes.json();
            if (jobData.ok) {
              setGenerationStep(`${jobData.stage} (${jobData.progress}%)`);

              if (jobData.status === "completed" && jobData.videoUrl) {
                clearInterval(interval);
                masterVideoUrlRef.current = jobData.videoUrl;
                setGeneratedVideo({
                  compositeVideoUrl: jobData.videoUrl,
                  title: jobData.metadata?.title || topic,
                  scenes: [],
                  captions: [],
                });
                setToastMsg("🎬 Master reel rendered by Railway background worker!");
                setTimeout(() => setToastMsg(""), 6000);
                resolve();
              } else if (jobData.status === "failed") {
                clearInterval(interval);
                reject(new Error(jobData.error || "Reel rendering failed on background worker."));
              }
            }
          } catch (pollErr) {
            console.warn("[ReelPoll] Error:", pollErr.message);
          }
        }, 3000);
      });
    } catch (err) {
      console.error("Video Generation Error:", err);
      setErrorMsg(err.message || "Failed to generate video reel.");
    } finally {
      setGenerating(false);
      setGenerationStep("");
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
    if (masterVideoUrlRef.current) return masterVideoUrlRef.current;
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

      // Step 3: Preload all video scenes/avatars into memory Blobs to guarantee 0% CORS taint
      setCompositingStep("Preloading media assets into memory...");
      const mediaElements = await Promise.all(
        (generatedVideo.scenes || []).map(async (scene) => {
          const isImage = scene.isAvatar || (scene.videoUrl && scene.videoUrl.match(/\.(jpg|jpeg|png|webp|gif)($|\?)/i));
          if (isImage) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            try {
              const fetchRes = await fetch(scene.videoUrl);
              if (fetchRes.ok) {
                const blob = await fetchRes.blob();
                img.src = URL.createObjectURL(blob);
              } else {
                img.src = scene.videoUrl;
              }
            } catch {
              img.src = scene.videoUrl;
            }
            await new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
              setTimeout(resolve, 3000);
            });
            return { type: "image", el: img };
          }

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
          return { type: "video", el: v };
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
          const currentMedia = mediaElements[sceneIndex];

          if (currentMedia?.type === "video" && currentMedia.el.readyState >= 2) {
            if (currentMedia.el.paused) currentMedia.el.play().catch(() => {});
            ctx.drawImage(currentMedia.el, 0, 0, 720, 1280);
          } else if (currentMedia?.type === "image" && currentMedia.el.complete && currentMedia.el.naturalWidth > 0) {
            // Subtle cinematic Ken Burns zoom for avatar / static image
            const sceneDuration = totalDuration / Math.max(scenes.length, 1);
            const sceneElapsed = elapsed - (sceneIndex * sceneDuration);
            const sceneRatio = Math.max(0, Math.min(1, sceneElapsed / sceneDuration));
            const zoom = 1.0 + (sceneRatio * 0.08);
            const w = 720 * zoom;
            const h = 1280 * zoom;
            const x = (720 - w) / 2;
            const y = (1280 - h) / 2;
            ctx.drawImage(currentMedia.el, x, y, w, h);
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
      if (Array.isArray(mediaElements)) {
        mediaElements.forEach((item) => {
          try {
            if (item?.type === "video" && item.el) item.el.pause();
          } catch {}
        });
      }

      setCompositingStep("Uploading master video with burned audio & subtitles…");

      const blob = await new Promise((resolve) => {
        recorder.onstop = () => {
          const finalBlob = new Blob(chunks, { type: mimeType });
          resolve(finalBlob);
        };
      });

      if (blob.size < 10000) {
        throw new Error(`Master video recording produced empty stream (${blob.size} bytes). Please ensure browser tab remains active while baking.`);
      }

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
      masterVideoUrlRef.current = signData.publicUrl;

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
  const handlePublish = async (channel, overrideVideoUrl) => {
    if (!generatedVideo) return;
    setPublishingChannel(channel);
    setPublishStatus((prev) => ({ ...prev, [channel]: { loading: true } }));

    try {
      // Step 1: Ensure real master composite video with burned subtitles & audio is ready
      let videoUrlToPublish = overrideVideoUrl || masterVideoUrlRef.current || generatedVideo.compositeVideoUrl;
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
          userEmail: userEmail || session?.user?.email,
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

        // Ephemeral auto-purge: self-destruct master video from staging after publishing
        try {
          await fetch("/api/video/cleanup-storage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoUrl: videoUrlToPublish,
              userEmail: userEmail || session?.user?.email,
            }),
          });
        } catch (_) {}
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
      let downloadUrl = generatedVideo?.compositeVideoUrl || generatedVideo?.compositeBlobUrl;
      if (!downloadUrl) {
        downloadUrl = await compositeAndBakeVideo();
      }
      if (!downloadUrl) return;

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.target = "_blank";
      a.download = `${(topic || "gabbarinfo-reel").slice(0, 30).replace(/\s+/g, "-")}.mp4`;
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

        {/* CHARACTER STUDIO CROSS-PROMO BANNER */}
        <div
          style={{
            marginTop: 20,
            padding: "14px 18px",
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(236, 72, 153, 0.12) 0%, rgba(139, 92, 246, 0.15) 100%)",
            border: "1px solid rgba(236, 72, 153, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>✨</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>
                Need 3D Animated Characters, Verbatim Custom Shayari, or Factory Media Videos?
              </div>
              <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                Switch to the Character Studio &amp; Universal Video Engine for custom scripts, pet co-stars, and B2B industrial promos.
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/?tab=characters";
              }
            }}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
              border: "none",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(236, 72, 153, 0.4)",
            }}
          >
            Open Character Studio ➔
          </button>
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
            {/* SCRIPT CREATION MODE TOGGLE (3 MODES) */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: "#f8fafc", marginBottom: 8 }}>
                🎬 Reel Creation Method:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setScriptMode("ai_prompt")}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 10,
                    background: scriptMode === "ai_prompt" ? "rgba(99, 102, 241, 0.25)" : "rgba(255, 255, 255, 0.03)",
                    border: scriptMode === "ai_prompt" ? "2px solid #6366f1" : "1px solid rgba(255, 255, 255, 0.08)",
                    color: scriptMode === "ai_prompt" ? "#a5b4fc" : "#cbd5e1",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    transition: "all 0.2s ease",
                  }}
                >
                  <span>✨ Viral Hook</span>
                </button>

                <button
                  type="button"
                  onClick={() => setScriptMode("product_promo")}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 10,
                    background: scriptMode === "product_promo" ? "rgba(245, 158, 11, 0.25)" : "rgba(255, 255, 255, 0.03)",
                    border: scriptMode === "product_promo" ? "2px solid #f59e0b" : "1px solid rgba(255, 255, 255, 0.08)",
                    color: scriptMode === "product_promo" ? "#fbbf24" : "#cbd5e1",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    transition: "all 0.2s ease",
                  }}
                >
                  <span>🚀 Promote Product/Service</span>
                </button>

                <button
                  type="button"
                  onClick={() => setScriptMode("custom_script")}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 10,
                    background: scriptMode === "custom_script" ? "rgba(236, 72, 153, 0.25)" : "rgba(255, 255, 255, 0.03)",
                    border: scriptMode === "custom_script" ? "2px solid #ec4899" : "1px solid rgba(255, 255, 255, 0.08)",
                    color: scriptMode === "custom_script" ? "#f472b6" : "#cbd5e1",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    transition: "all 0.2s ease",
                  }}
                >
                  <span>✍️ Provide My Own Script</span>
                </button>
              </div>
            </div>

            {/* SCRIPT / COMMERCIAL AD BUILDER CONTENT */}
            {scriptMode === "product_promo" ? (
              <div
                style={{
                  background: "rgba(245, 158, 11, 0.05)",
                  border: "1px solid rgba(245, 158, 11, 0.25)",
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 18,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: "#fbbf24", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>📢 Commercial Promo & Business Ad Configurator</span>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(245, 158, 11, 0.2)", color: "#fef08a" }}>
                    ⭐ Business Ads
                  </span>
                </div>

                {/* Website URL (Optional Auto-Scanner) */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#cbd5e1", marginBottom: 4 }}>
                    🌐 Website / Landing Page (Optional):
                  </label>
                  <input
                    type="url"
                    placeholder="https://yourbusiness.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "rgba(0, 0, 0, 0.4)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#fff",
                      fontSize: 12.5,
                      outline: "none",
                    }}
                  />
                </div>

                {/* Brand Name & Product/Service Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: "#cbd5e1" }}>
                        🏢 Brand Name to Speak Out:
                      </label>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Apex Digital, Sharma Clinic"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#fff",
                        fontSize: 12.5,
                        outline: "none",
                      }}
                    />
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>
                      🗣️ Characters speak this name out loud!
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#cbd5e1", marginBottom: 4 }}>
                      🎯 Product or Service to Promote:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Google Ads & SEO, Teeth Whitening"
                      value={serviceToPromote}
                      onChange={(e) => setServiceToPromote(e.target.value)}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#fff",
                        fontSize: 12.5,
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Special Offer & CTA */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#cbd5e1", marginBottom: 4 }}>
                      🎁 Special Deal / Limited Offer:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Flat 40% Off this week, Free Audit"
                      value={specialOffer}
                      onChange={(e) => setSpecialOffer(e.target.value)}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#fff",
                        fontSize: 12.5,
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#cbd5e1", marginBottom: 4 }}>
                      ⚡ Call To Action (CTA):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Click link in bio to book"
                      value={promoCTA}
                      onChange={(e) => setPromoCTA(e.target.value)}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#fff",
                        fontSize: 12.5,
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Promotional Angle Selector (3 Cards) */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                    🎭 Promotional Angle & Dialogue Style:
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {[
                      {
                        id: "founder_pitch",
                        icon: "⚡",
                        title: "Owner / Founder Pitch",
                        desc: "Excited founder presents USPs, transformation, and deal directly into camera.",
                      },
                      {
                        id: "customer_owner_skit",
                        icon: "🗣️",
                        title: "Customer & Owner Skit",
                        desc: "Customer shares real problem -> Owner introduces brand solution & special offer.",
                      },
                      {
                        id: "direct_response",
                        icon: "🎯",
                        title: "Persuasive Direct Ad",
                        desc: "High-converting urgency hook, benefits, proof, and immediate call to action.",
                      },
                    ].map((ang) => (
                      <button
                        key={ang.id}
                        type="button"
                        onClick={() => setPromoAngle(ang.id)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: promoAngle === ang.id ? "rgba(245, 158, 11, 0.25)" : "rgba(0, 0, 0, 0.3)",
                          border: promoAngle === ang.id ? "2px solid #f59e0b" : "1px solid rgba(255, 255, 255, 0.08)",
                          color: promoAngle === ang.id ? "#fbbf24" : "#cbd5e1",
                          textAlign: "left",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 11.5, marginBottom: 3 }}>
                          {ang.icon} {ang.title}
                        </div>
                        <div style={{ fontSize: 9.5, color: "#94a3b8", lineHeight: 1.3 }}>
                          {ang.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Instant Craft Screenplay Button */}
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <button
                    type="button"
                    disabled={generatingPromoScript}
                    onClick={handleGeneratePromoScript}
                    style={{
                      flex: 1,
                      padding: "9px 14px",
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                      border: "none",
                      color: "#000",
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: generatingPromoScript ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <span>{generatingPromoScript ? "⏳ Crafting Commercial Script..." : "✨ Craft Promotional Script with AI"}</span>
                  </button>
                </div>

                {/* Screenplay Preview / Edit Box */}
                {customScript && (
                  <div>
                    {extractedUsps && extractedUsps.length > 0 && (
                      <div
                        style={{
                          marginBottom: 10,
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: "rgba(16, 185, 129, 0.08)",
                          border: "1px solid rgba(16, 185, 129, 0.25)",
                        }}
                      >
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#10b981", marginBottom: 5 }}>
                          🎯 Analyzed USPs & Conversion Hooks from Website:
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {extractedUsps.map((usp, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: 10,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: "rgba(16, 185, 129, 0.18)",
                                color: "#6ee7b7",
                                border: "1px solid rgba(16, 185, 129, 0.3)",
                              }}
                            >
                              ✓ {usp}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: "#10b981" }}>
                        ✓ Screenplay Preview (Editable):
                      </label>
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>Characters speak this verbatim</span>
                    </div>
                    <textarea
                      rows={Math.max(5, Math.min(10, (customScript.split("\n").length || 4) + 1))}
                      value={customScript}
                      onChange={(e) => setCustomScript(e.target.value)}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "rgba(0, 0, 0, 0.6)",
                        border: "1px solid rgba(16, 185, 129, 0.4)",
                        color: "#fff",
                        fontSize: 12.5,
                        outline: "none",
                        resize: "vertical",
                        lineHeight: 1.5,
                      }}
                    />
                  </div>
                )}
              </div>
            ) : scriptMode === "custom_script" ? (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#f472b6" }}>
                    📝 Your Custom Script or Dialogue:
                  </label>
                  <span style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>✓ Spoken 100% Verbatim</span>
                </div>
                <textarea
                  rows={5}
                  placeholder={CUSTOM_SCRIPT_PLACEHOLDERS[language] || CUSTOM_SCRIPT_PLACEHOLDERS.en_uk}
                  value={customScript}
                  onChange={(e) => setCustomScript(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "rgba(0, 0, 0, 0.5)",
                    border: "1px solid rgba(236, 72, 153, 0.35)",
                    color: "#fff",
                    fontSize: 13.5,
                    outline: "none",
                    resize: "vertical",
                    lineHeight: 1.5,
                  }}
                />
                <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 4 }}>
                  💡 The AI character will speak your exact script word-for-word with precise lip-sync!
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>
                  🎬 Video Topic, Hook, or Concept:
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    language === "en_uk"
                      ? "e.g. 3 Secrets to scale your bespoke e-commerce store in the UK..."
                      : language === "hindi"
                      ? "e.g. 2026 में अपने ऑनलाइन स्टोर की सेल्स 10x कैसे बढ़ाएं..."
                      : "e.g. 3 Proven secrets to 10x your Shopify sales this month..."
                  }
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
                {/* Quick Inspiration Pills (Language-Aware) */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {(QUICK_TOPICS[language] || QUICK_TOPICS.en_uk).map((t, idx) => (
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
                      💡 {t.slice(0, 34)}…
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Target Reel Duration Selector */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: "#f8fafc", marginBottom: 8 }}>
                ⏱️ Target Reel Duration:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[15, 30, 60].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setDurationSeconds(sec)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      background: durationSeconds === sec ? "rgba(16, 185, 129, 0.22)" : "rgba(255, 255, 255, 0.03)",
                      border: durationSeconds === sec ? "2px solid #10b981" : "1px solid rgba(255, 255, 255, 0.08)",
                      color: durationSeconds === sec ? "#34d399" : "#cbd5e1",
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {sec}s {sec === 15 ? "(Viral Hook)" : sec === 30 ? "(Story Reel)" : "(Deep Dive)"}
                  </button>
                ))}
              </div>
            </div>

            {/* 3-Language Selector (Syncs Voices and Placeholders) */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 800, color: "#f8fafc", marginBottom: 8 }}>
                🗣️ Spoken Language & Voiceover Accent:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => handleLanguageChange("hindi")}
                  style={{
                    padding: "9px 8px",
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
                    gap: 3,
                  }}
                >
                  <span style={{ fontSize: 16 }}>🇮🇳</span>
                  <span>Hindi (हिंदी)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLanguageChange("en_us")}
                  style={{
                    padding: "9px 8px",
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
                    gap: 3,
                  }}
                >
                  <span style={{ fontSize: 16 }}>🇺🇸</span>
                  <span>American (US)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLanguageChange("en_uk")}
                  style={{
                    padding: "9px 8px",
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
                    gap: 3,
                  }}
                >
                  <span style={{ fontSize: 16 }}>🇬🇧</span>
                  <span>British (UK)</span>
                </button>
              </div>
            </div>

            {/* Customization Grid: Niche, Language-Aware Voice, Music */}
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
                  AI Voice ({language === "en_uk" ? "British UK" : language === "en_us" ? "American US" : "Indian Hindi"}):
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
                  {(VOICES_BY_LANG[language] || VOICES_BY_LANG.en_uk).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
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
                {generatedVideo.compositeVideoUrl ? (
                  <video
                    src={generatedVideo.compositeVideoUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (!currentScene?.isAvatar && currentScene?.videoUrl && !currentScene?.videoUrl.match(/\.(jpg|jpeg|png|webp|gif)($|\?)/i)) ? (
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
                      href={userEmail ? `/api/youtube/connect?userEmail=${encodeURIComponent(userEmail)}` : "/api/youtube/connect"}
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
