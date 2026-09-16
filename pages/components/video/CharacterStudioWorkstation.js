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
  const [newCharArchetype, setNewCharArchetype] = useState("photoreal_human");
  const [newCharTraits, setNewCharTraits] = useState("rugged brown leather jacket, short dark hair, intense expressive eyes");
  const [newCharBackstory, setNewCharBackstory] = useState("");
  const [newCharGender, setNewCharGender] = useState("male");
  const [newCharVoice, setNewCharVoice] = useState("onyx");
  const [creatingCharacter, setCreatingCharacter] = useState(false);

  // Story & Episode Generator State
  const [creationMode, setCreationMode] = useState("ai_prompt"); // "ai_prompt" | "custom_script" | "business_media"
  const [animationStyle, setAnimationStyle] = useState("generative_video"); // "generative_video" | "hybrid_lip_sync" | "cinematic_scenes"
  const [narrativeType, setNarrativeType] = useState("standalone"); // "standalone" | "episodic"
  const [customScript, setCustomScript] = useState("");
  const [vocalEmotion, setVocalEmotion] = useState("dramatic_story"); // "dramatic_story" | "poetic_shayar" | "warm_storybook" | "commercial_pitch"
  const [selectedCompanion, setSelectedCompanion] = useState(null);
  const [selectedCompanion2, setSelectedCompanion2] = useState(null);
  const [clientMedia, setClientMedia] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const [videoFormat, setVideoFormat] = useState("reel_9_16"); // "reel_9_16" | "youtube_16_9"
  const [language, setLanguage] = useState("hindi"); // "hindi" | "en_us" | "en_uk"
  const [durationMinutes, setDurationMinutes] = useState(2); // 1 | 2 | 3 | 4 | 5
  const [audience, setAudience] = useState("family"); // "kids" | "teens" | "family" | "adult"
  const [videoTitle, setVideoTitle] = useState("The Secret Discovery");
  const [episodeTitle, setEpisodeTitle] = useState("The Secret Discovery");
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [suggestedIdeas, setSuggestedIdeas] = useState([]);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
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
  const fileInputRef = useRef(null);

  // Archetype Presets (including Ultra-Realistic Living Humans)
  const ARCHETYPES = [
    { id: "photoreal_human", label: "Ultra-Realistic Human", emoji: "👤", desc: "8K cinema still, authentic skin pores & natural eyes" },
    { id: "hollywood_cinema", label: "Hollywood Live-Action", emoji: "🎥", desc: "35mm Arri Alexa film still, moody cinematic lighting" },
    { id: "indian_cinema", label: "Bollywood Realism", emoji: "🇮🇳", desc: "Expressive Indian realism, cultural elegance & lighting" },
    { id: "documentary_realism", label: "Documentary Realism", emoji: "🎙️", desc: "Authentic true-life photojournalism portrait" },
    { id: "pixar_3d", label: "3D Pixar Animation", emoji: "✨", desc: "Whimsical, friendly, high-detail 3D CGI" },
    { id: "storybook_kids", label: "Children's Storybook", emoji: "🧸", desc: "Watercolor, warm nostalgic picture book" },
    { id: "anime_2d", label: "2D Anime Hero", emoji: "⚡", desc: "Crisp lineart, vibrant anime key visual" },
    { id: "comic_hero", label: "Comic Book Hero", emoji: "🦸", desc: "Bold Marvel/Spider-Verse comic art & action" },
    { id: "cyberpunk", label: "Cyberpunk Manga", emoji: "🦾", desc: "Neon glows, futuristic gear, cinematic" },
    { id: "pet_companion", label: "3D Animal / Pet", emoji: "🐶", desc: "Adorable Pixar dog, cat, or animal companion" },
    { id: "corporate_spokesperson", label: "Corporate Spokesperson", emoji: "💼", desc: "Professional business attire & studio lighting" },
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
          gender: newCharGender,
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

  // Handle Client Media Upload
  const handleMediaUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingMedia(true);
    setToastMsg(`Uploading ${files.length} file(s)...`);

    for (const file of files) {
      try {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        const fileBase64 = await base64Promise;

        const res = await fetch("/api/character/upload-media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileBase64,
            filename: file.name,
            contentType: file.type || (file.name.endsWith(".mp4") ? "video/mp4" : "image/jpeg"),
            userEmail,
          }),
        });
        const data = await res.json();
        if (data.ok && data.url) {
          setClientMedia((prev) => [...prev, { url: data.url, type: data.type, name: data.name }]);
        }
      } catch (uploadErr) {
        console.error("Failed to upload file:", uploadErr);
      }
    }
    setUploadingMedia(false);
    setToastMsg("Media uploaded successfully!");
    setTimeout(() => setToastMsg(""), 4000);
  };

  // AI Story Ideator: Generate 4 creative story pitches
  const handleGenerateIdeas = async () => {
    try {
      setGeneratingIdeas(true);
      setErrorMsg("");
      const res = await fetch("/api/character/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterName: selectedCharacter?.name || "Hero",
          characterArchetype: selectedCharacter?.archetype || "photoreal_human",
          characterTraits: selectedCharacter?.visualTraits || "charismatic, expressive",
          companionName: selectedCompanion?.name,
          companionTraits: selectedCompanion?.visualTraits,
          audience,
          duration: durationMinutes,
          language,
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.ideas)) {
        setSuggestedIdeas(data.ideas);
        setToastMsg("Generated 4 trending story concepts!");
        setTimeout(() => setToastMsg(""), 3500);
      } else {
        throw new Error(data.error || "Failed to generate story ideas");
      }
    } catch (err) {
      console.warn("Failed to generate ideas:", err);
      setErrorMsg(err.message);
    } finally {
      setGeneratingIdeas(false);
    }
  };

  // Generate Story Episode
  const handleGenerateStory = async (e) => {
    e.preventDefault();
    if (creationMode !== "business_media" && !selectedCharacter && characters.length === 0) {
      setErrorMsg("Please create or select an exclusive character first.");
      return;
    }
    if (creationMode === "custom_script" && !customScript.trim()) {
      setErrorMsg("Please enter your custom script or shayari lines.");
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
      setStoryStep("Dispatching video render task to Railway persistent worker...");

      const activeChars = [
        selectedCharacter ? {
          name: selectedCharacter.name,
          role: "Lead Character",
          voice: selectedCharacter.voice || (selectedCharacter.gender === "female" ? "shimmer" : "onyx"),
          traits: selectedCharacter.visualTraits,
          archetype: selectedCharacter.archetype || "photoreal_human",
          gender: selectedCharacter.gender || (selectedCharacter.voice === "shimmer" || selectedCharacter.voice === "nova" ? "female" : "male")
        } : null,
        selectedCompanion ? {
          name: selectedCompanion.name,
          role: "Co-Star 1",
          voice: selectedCompanion.voice || (selectedCompanion.gender === "female" ? "shimmer" : "onyx"),
          traits: selectedCompanion.visualTraits,
          archetype: selectedCompanion.archetype || "photoreal_human",
          gender: selectedCompanion.gender || (selectedCompanion.voice === "shimmer" || selectedCompanion.voice === "nova" ? "female" : "male")
        } : null,
        selectedCompanion2 ? {
          name: selectedCompanion2.name,
          role: "Co-Star 2",
          voice: selectedCompanion2.voice || (selectedCompanion2.gender === "female" ? "coral" : "echo"),
          traits: selectedCompanion2.visualTraits,
          archetype: selectedCompanion2.archetype || "photoreal_human",
          gender: selectedCompanion2.gender || (selectedCompanion2.voice === "shimmer" || selectedCompanion2.voice === "nova" ? "female" : "male")
        } : null,
      ].filter(Boolean);

      const effectiveTitle = narrativeType === "episodic"
        ? `Episode ${episodeNumber}: ${episodeTitle || "The Grand Tale"}`
        : (videoTitle || episodeTitle || "The Grand Tale");

      const res = await fetch("/api/video/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoType: videoFormat === "youtube_16_9" || durationMinutes >= 2 ? "long_form_youtube" : "character_story",
          payload: {
            characterId: selectedCharacter?.id,
            companionId: selectedCompanion?.id,
            characters: activeChars,
            format: videoFormat,
            narrativeType,
            scriptMode: creationMode,
            animationStyle,
            customScript,
            vocalEmotion,
            storyPrompt,
            episodeTitle,
            videoTitle: effectiveTitle,
            episodeNumber,
            seasonNumber,
            audience,
            durationMinutes,
            language,
            clientMedia,
            targetMinutes: durationMinutes,
          },
          userEmail,
        }),
      });

      const data = await res.json();
      if (!data.ok || !data.jobId) throw new Error(data.error || "Failed to start background video job");

      const jobId = data.jobId;
      setStoryStep("Worker queued your video. Starting AI generation...");

      // Poll background worker until completed
      await new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
          try {
            const pollRes = await fetch(`/api/video/job-status?jobId=${encodeURIComponent(jobId)}&userEmail=${encodeURIComponent(userEmail)}`);
            const jobData = await pollRes.json();

            if (jobData.ok) {
              setStoryStep(`${jobData.stage} (${jobData.progress}%)`);

              if (jobData.status === "completed" && jobData.videoUrl) {
                clearInterval(interval);
                masterVideoUrlRef.current = jobData.videoUrl;
                setGeneratedStory({
                  title: jobData.metadata?.title || episodeTitle,
                  youtubeTitle: jobData.metadata?.youtubeTitle || episodeTitle,
                  description: jobData.metadata?.description || storyPrompt,
                  masterVideoUrl: jobData.videoUrl,
                  totalDuration: videoFormat === "youtube_16_9" ? 270 : 30,
                  scenes: [],
                  character: selectedCharacter,
                });
                setToastMsg("🎬 Master video generated by Railway worker! Ready to play & publish.");
                setTimeout(() => setToastMsg(""), 7000);
                resolve();
              } else if (jobData.status === "failed") {
                clearInterval(interval);
                reject(new Error(jobData.error || "Video rendering failed on background worker."));
              }
            }
          } catch (pollErr) {
            console.warn("[VideoPoll] Status check:", pollErr.message);
          }
        }, 3000);
      });
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

    // Preload All Story Scene Images / Videos + Master Character Image
    const charImg = new Image();
    charImg.crossOrigin = "anonymous";
    charImg.src = generatedStory.character?.referenceSheetUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80";

    const sceneMedia = await Promise.all(
      (generatedStory.scenes || []).map((s) => {
        return new Promise((resolve) => {
          if (s.isClientVideo || s.videoUrl?.endsWith(".mp4") || s.videoUrl?.endsWith(".webm")) {
            const vid = document.createElement("video");
            vid.crossOrigin = "anonymous";
            vid.src = s.videoUrl;
            vid.muted = true;
            vid.playsInline = true;
            vid.onloadeddata = () => resolve({ type: "video", element: vid });
            vid.onerror = () => resolve({ type: "image", element: charImg });
            vid.load();
            setTimeout(() => resolve({ type: "video", element: vid }), 5000);
          } else {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = s.videoUrl || generatedStory.character?.referenceSheetUrl || charImg.src;
            img.onload = () => resolve({ type: "image", element: img });
            img.onerror = () => resolve({ type: "image", element: charImg });
            setTimeout(() => resolve({ type: "image", element: img }), 4000);
          }
        });
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

        // Dynamic Scene Frame Animation (Video playback or Ken Burns zoom)
        const curMedia = sceneMedia[sceneIndex] || { type: "image", element: charImg };
        if (curMedia.type === "video" && curMedia.element) {
          if (curMedia.element.paused) curMedia.element.play().catch(() => {});
          ctx.drawImage(curMedia.element, 0, 0, canvasWidth, canvasHeight);
        } else if (curMedia.element && curMedia.element.naturalWidth > 0) {
          const zoom = 1.0 + (sceneRatio * 0.08);
          const panX = (sceneIndex % 2 === 0 ? 1 : -1) * (sceneRatio * 20);
          const w = canvasWidth * zoom;
          const h = canvasHeight * zoom;
          const x = (canvasWidth - w) / 2 + panX;
          const y = (canvasHeight - h) / 2;
          ctx.drawImage(curMedia.element, x, y, w, h);
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

      // EPHEMERAL PURGE TRIGGER: Self-destruct temporary storage file + client-uploaded videos
      setPublishStep("Executing ephemeral auto-purge (0 MB net storage)...");
      const additionalPaths = (generatedStory.scenes || [])
        .map((s) => s.videoUrl)
        .filter(Boolean);

      await fetch("/api/video/cleanup-storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl,
          filePath: masterFilePathRef.current,
          clientMedia,
          additionalPaths,
          userEmail,
        }),
      });

      setClientMedia([]);
      setStoragePurged(true);
      setToastMsg("🚀 Published live to all selected channels! Client uploaded videos & staging files auto-destructed (0 MB storage).");
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
              <div style={{ fontSize: 13, fontWeight: 800, color: "#cbd5e1", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>2. CHOOSE CREATION MODE & STORY FORMAT</span>
                <span style={{ fontSize: 11, color: "#a855f7", fontWeight: 700 }}>Pro Studio Engine</span>
              </div>

              {/* 3 CREATION MODES TABS */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
                <button
                  type="button"
                  onClick={() => setCreationMode("ai_prompt")}
                  style={{
                    padding: "10px 6px",
                    borderRadius: 10,
                    background: creationMode === "ai_prompt" ? "rgba(139, 92, 246, 0.25)" : "rgba(255, 255, 255, 0.03)",
                    border: creationMode === "ai_prompt" ? "2px solid #a855f7" : "1px solid rgba(255, 255, 255, 0.08)",
                    color: creationMode === "ai_prompt" ? "#c084fc" : "#94a3b8",
                    fontWeight: 800,
                    fontSize: 11.5,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <span style={{ fontSize: 16 }}>🎭</span>
                  <span>AI Character Story</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCreationMode("custom_script")}
                  style={{
                    padding: "10px 6px",
                    borderRadius: 10,
                    background: creationMode === "custom_script" ? "rgba(236, 72, 153, 0.25)" : "rgba(255, 255, 255, 0.03)",
                    border: creationMode === "custom_script" ? "2px solid #ec4899" : "1px solid rgba(255, 255, 255, 0.08)",
                    color: creationMode === "custom_script" ? "#f472b6" : "#94a3b8",
                    fontWeight: 800,
                    fontSize: 11.5,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <span style={{ fontSize: 16 }}>📜</span>
                  <span>Custom Shayari / Script</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCreationMode("business_media")}
                  style={{
                    padding: "10px 6px",
                    borderRadius: 10,
                    background: creationMode === "business_media" ? "rgba(59, 130, 246, 0.25)" : "rgba(255, 255, 255, 0.03)",
                    border: creationMode === "business_media" ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.08)",
                    color: creationMode === "business_media" ? "#60a5fa" : "#94a3b8",
                    fontWeight: 800,
                    fontSize: 11.5,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <span style={{ fontSize: 16 }}>🏭</span>
                  <span>My Factory / Media</span>
                </button>
              </div>

              {/* Format Switcher (9:16 Reel vs 16:9 YouTube) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div
                  onClick={() => setVideoFormat("reel_9_16")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: videoFormat === "reel_9_16" ? "rgba(236, 72, 153, 0.18)" : "rgba(255, 255, 255, 0.03)",
                    border: videoFormat === "reel_9_16" ? "2px solid #ec4899" : "1px solid rgba(255, 255, 255, 0.08)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 12.5, color: videoFormat === "reel_9_16" ? "#f472b6" : "#f8fafc" }}>
                    <span>📱 9:16 Social Reel</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>
                    15–30s fast viral hook for Instagram, FB & YT Shorts.
                  </div>
                </div>

                <div
                  onClick={() => setVideoFormat("youtube_16_9")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: videoFormat === "youtube_16_9" ? "rgba(59, 130, 246, 0.18)" : "rgba(255, 255, 255, 0.03)",
                    border: videoFormat === "youtube_16_9" ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.08)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 12.5, color: videoFormat === "youtube_16_9" ? "#60a5fa" : "#f8fafc" }}>
                    <span>🖥️ 16:9 YouTube Story</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>
                    3–5 min widescreen story episodes or business features.
                  </div>
                </div>
              </div>

              {/* Target Video Duration Selector */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 800, color: "#38bdf8" }}>
                    ⏱️ Target Video Duration:
                  </label>
                  <span style={{ fontSize: 10.5, color: "#94a3b8" }}>
                    {durationMinutes === 1 ? "4–5 Scene Beats" : durationMinutes === 2 ? "8–10 Scene Beats" : durationMinutes === 3 ? "12–14 Scene Beats" : durationMinutes === 4 ? "16–18 Scene Beats" : "20–24 Master Scenes"}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                  {[
                    { mins: 1, label: "1 Min", sub: "~60s" },
                    { mins: 2, label: "2 Mins", sub: "~120s" },
                    { mins: 3, label: "3 Mins", sub: "~180s" },
                    { mins: 4, label: "4 Mins", sub: "~240s" },
                    { mins: 5, label: "5+ Mins", sub: "300s+" },
                  ].map((d) => (
                    <div
                      key={d.mins}
                      onClick={() => setDurationMinutes(d.mins)}
                      style={{
                        padding: "8px 4px",
                        borderRadius: 8,
                        textAlign: "center",
                        background: durationMinutes === d.mins ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.03)",
                        border: durationMinutes === d.mins ? "2px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: durationMinutes === d.mins ? "#38bdf8" : "#cbd5e1" }}>
                        {d.label}
                      </div>
                      <div style={{ fontSize: 9.5, color: "#64748b", marginTop: 2 }}>{d.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Target Audience & Genre Demographics */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: "#cbd5e1", marginBottom: 6 }}>
                  🎯 Target Audience & Story Tone:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { id: "kids", label: "🧸 Children & Kids (3-10)", desc: "Playful, whimsical, educational moral" },
                    { id: "teens", label: "⚡ Teens & YA (11-18)", desc: "High-energy fantasy, mystery & action" },
                    { id: "family", label: "🌟 Family & All Ages", desc: "Inspiring, emotional & heartfelt" },
                    { id: "adult", label: "🎬 Adult & Cinema Drama", desc: "Deep narrative, suspense & true stories" },
                  ].map((a) => (
                    <div
                      key={a.id}
                      onClick={() => setAudience(a.id)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: audience === a.id ? "rgba(168, 85, 247, 0.2)" : "rgba(255, 255, 255, 0.03)",
                        border: audience === a.id ? "2px solid #a855f7" : "1px solid rgba(255, 255, 255, 0.08)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, color: audience === a.id ? "#c084fc" : "#e2e8f0" }}>
                        {a.label}
                      </div>
                      <div style={{ fontSize: 9.5, color: "#94a3b8", marginTop: 2 }}>{a.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Narrative Scope Switcher (Standalone vs Episodic) */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: "#cbd5e1", marginBottom: 6 }}>
                  📖 Story Progression / Scope:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div
                    onClick={() => setNarrativeType("standalone")}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: narrativeType === "standalone" ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.03)",
                      border: narrativeType === "standalone" ? "2px solid #10b981" : "1px solid rgba(255, 255, 255, 0.08)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 12, color: narrativeType === "standalone" ? "#34d399" : "#cbd5e1" }}>
                      🌟 Standalone Story
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                      Complete 1-off story with punchline & conclusion.
                    </div>
                  </div>

                  <div
                    onClick={() => setNarrativeType("episodic")}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: narrativeType === "episodic" ? "rgba(139, 92, 246, 0.2)" : "rgba(255, 255, 255, 0.03)",
                      border: narrativeType === "episodic" ? "2px solid #8b5cf6" : "1px solid rgba(255, 255, 255, 0.08)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 12, color: narrativeType === "episodic" ? "#a78bfa" : "#cbd5e1" }}>
                      📚 Episodic Series
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                      Continuous serialized episodes with chapter lore.
                    </div>
                  </div>
                </div>
              </div>

              {/* Animation Engine Style: Cinematic World Video vs Hybrid Dialogue Lip-Sync vs Multi-Scene */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: "#cbd5e1", marginBottom: 6 }}>
                  ⚡ Video Animation Engine:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div
                    onClick={() => setAnimationStyle("generative_video")}
                    style={{
                      padding: "10px 10px",
                      borderRadius: 10,
                      background: animationStyle === "generative_video" ? "rgba(168, 85, 247, 0.2)" : "rgba(255, 255, 255, 0.03)",
                      border: animationStyle === "generative_video" ? "2px solid #a855f7" : "1px solid rgba(255, 255, 255, 0.08)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 800, fontSize: 11.5, color: animationStyle === "generative_video" ? "#c084fc" : "#cbd5e1" }}>
                      <span>🎥 Cinematic AI Video</span>
                      <span style={{ fontSize: 8.5, fontWeight: 900, padding: "1px 4px", borderRadius: 4, background: "#a855f7", color: "#fff" }}>Higgsfield GPU</span>
                    </div>
                    <div style={{ fontSize: 9.5, color: "#94a3b8", marginTop: 3, lineHeight: 1.3 }}>
                      Minimax / Runway world video with moving cars, cityscapes, fluid environment physics &amp; camera motion.
                    </div>
                  </div>

                  <div
                    onClick={() => setAnimationStyle("live_talking_head")}
                    style={{
                      padding: "10px 10px",
                      borderRadius: 10,
                      background: animationStyle === "live_talking_head" ? "rgba(236, 72, 153, 0.2)" : "rgba(255, 255, 255, 0.03)",
                      border: animationStyle === "live_talking_head" ? "2px solid #ec4899" : "1px solid rgba(255, 255, 255, 0.08)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 800, fontSize: 11.5, color: animationStyle === "live_talking_head" ? "#f472b6" : "#cbd5e1" }}>
                      <span>🗣️ B-Roll + Lip-Sync</span>
                      <span style={{ fontSize: 8.5, fontWeight: 900, padding: "1px 4px", borderRadius: 4, background: "#ec4899", color: "#fff" }}>Hybrid</span>
                    </div>
                    <div style={{ fontSize: 9.5, color: "#94a3b8", marginTop: 3, lineHeight: 1.3 }}>
                      Wide cinematic world B-roll for narration + physical character face lip-sync strictly on spoken dialogue.
                    </div>
                  </div>

                  <div
                    onClick={() => setAnimationStyle("cinematic_scenes")}
                    style={{
                      padding: "10px 10px",
                      borderRadius: 10,
                      background: animationStyle === "cinematic_scenes" ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.03)",
                      border: animationStyle === "cinematic_scenes" ? "2px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 800, fontSize: 11.5, color: animationStyle === "cinematic_scenes" ? "#38bdf8" : "#cbd5e1" }}>
                      <span>🎬 Multi-Scene Motion</span>
                    </div>
                    <div style={{ fontSize: 9.5, color: "#94a3b8", marginTop: 3, lineHeight: 1.3 }}>
                      High-res keyframe scenes with 2.5D camera zoom &amp; lighting pan.
                    </div>
                  </div>
                </div>
              </div>

              {/* Vocal Emotion & Delivery Tone */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: "#cbd5e1", marginBottom: 6 }}>
                  🎙️ Vocal Emotion & Delivery Cadence:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { id: "poetic_shayar", label: "Poetic Shayar", desc: "Soulful pauses & Urdu/Hindi cadence", emoji: "🪕" },
                    { id: "dramatic_story", label: "Dramatic Story", desc: "Cinematic, deep suspense & intensity", emoji: "🎭" },
                    { id: "warm_storybook", label: "Warm Storybook", desc: "Gentle, friendly fairytale narrator", emoji: "🧸" },
                    { id: "commercial_pitch", label: "Commercial Pitch", desc: "Crisp, authoritative B2B energy", emoji: "⚡" },
                  ].map((emo) => {
                    const isSelected = vocalEmotion === emo.id;
                    return (
                      <div
                        key={emo.id}
                        onClick={() => setVocalEmotion(emo.id)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: isSelected ? "rgba(245, 158, 11, 0.2)" : "rgba(255, 255, 255, 0.03)",
                          border: isSelected ? "2px solid #f59e0b" : "1px solid rgba(255, 255, 255, 0.08)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 11.5, color: isSelected ? "#fbbf24" : "#cbd5e1" }}>
                          {emo.emoji} {emo.label}
                        </div>
                        <div style={{ fontSize: 9.5, color: "#94a3b8", marginTop: 2 }}>
                          {emo.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Character Casting: Co-Star 1 & Co-Star 2 */}
              {characters.length > 1 && creationMode !== "business_media" && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: characters.length > 2 ? "1fr 1fr" : "1fr", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: "#cbd5e1", marginBottom: 6 }}>
                        👥 Co-Star 1 (Duo Mode):
                      </label>
                      <select
                        value={selectedCompanion?.id || ""}
                        onChange={(e) => {
                          const found = characters.find((c) => c.id === e.target.value);
                          setSelectedCompanion(found || null);
                        }}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#fff", fontSize: 12.5 }}
                      >
                        <option value="">None (Solo Performance)</option>
                        {characters
                          .filter((c) => c.id !== selectedCharacter?.id && c.id !== selectedCompanion2?.id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.archetype?.replace("_", " ")})
                            </option>
                          ))}
                      </select>
                    </div>

                    {characters.length > 2 && (
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: "#cbd5e1", marginBottom: 6 }}>
                          👥 Co-Star 2 (Trio / Ensemble):
                        </label>
                        <select
                          value={selectedCompanion2?.id || ""}
                          onChange={(e) => {
                            const found = characters.find((c) => c.id === e.target.value);
                            setSelectedCompanion2(found || null);
                          }}
                          style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#fff", fontSize: 12.5 }}
                        >
                          <option value="">None</option>
                          {characters
                            .filter((c) => c.id !== selectedCharacter?.id && c.id !== selectedCompanion?.id)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.archetype?.replace("_", " ")})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Language Selector (Hindi / US English / UK English) */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: "#f8fafc", marginBottom: 6 }}>
                  🗣️ Spoken Language:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setLanguage("hindi")}
                    style={{
                      padding: "8px",
                      borderRadius: 10,
                      background: language === "hindi" ? "rgba(245, 158, 11, 0.22)" : "rgba(255, 255, 255, 0.03)",
                      border: language === "hindi" ? "2px solid #f59e0b" : "1px solid rgba(255, 255, 255, 0.08)",
                      color: language === "hindi" ? "#fbbf24" : "#cbd5e1",
                      fontWeight: 800,
                      fontSize: 11.5,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>🇮🇳</span>
                    <span>Hindi (हिंदी)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLanguage("en_us")}
                    style={{
                      padding: "8px",
                      borderRadius: 10,
                      background: language === "en_us" ? "rgba(59, 130, 246, 0.22)" : "rgba(255, 255, 255, 0.03)",
                      border: language === "en_us" ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.08)",
                      color: language === "en_us" ? "#60a5fa" : "#cbd5e1",
                      fontWeight: 800,
                      fontSize: 11.5,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>🇺🇸</span>
                    <span>American (US)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLanguage("en_uk")}
                    style={{
                      padding: "8px",
                      borderRadius: 10,
                      background: language === "en_uk" ? "rgba(236, 72, 153, 0.22)" : "rgba(255, 255, 255, 0.03)",
                      border: language === "en_uk" ? "2px solid #ec4899" : "1px solid rgba(255, 255, 255, 0.08)",
                      color: language === "en_uk" ? "#f472b6" : "#cbd5e1",
                      fontWeight: 800,
                      fontSize: 11.5,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>🇬🇧</span>
                    <span>British (UK)</span>
                  </button>
                </div>
              </div>

              {/* DYNAMIC MODE INPUTS */}
              {creationMode === "custom_script" ? (
                /* MODE B: CUSTOM SCRIPT / SHAYARI INPUT */
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#f472b6" }}>
                      ✍️ Paste Your Exact Dialogue, Poem, or Shayari:
                    </label>
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>100% Verbatim Delivery</span>
                  </div>
                  <textarea
                    rows={4}
                    value={customScript}
                    onChange={(e) => setCustomScript(e.target.value)}
                    placeholder="उदा.&#10;इश्क की राह में जब-जब कोई क़दम उठा है,&#10;अँधेरों में भी कोई चिराग सा जला है...&#10;(लिखें अपनी पूरी शायरी या स्क्रिप्ट यहाँ)"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(236, 72, 153, 0.4)", color: "#fff", fontSize: 13, resize: "vertical", lineHeight: 1.6 }}
                    required
                  />
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                    💡 The AI will speak your exact lines with soulful poetic pauses and emotional rhythm without altering a single word.
                  </div>
                </div>
              ) : creationMode === "business_media" ? (
                /* MODE C: BUSINESS / MANUFACTURER MEDIA */
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#60a5fa", marginBottom: 6 }}>
                    🏭 Business / Factory Topic & Commercial Goal:
                  </label>
                  <input
                    type="text"
                    value={storyPrompt}
                    onChange={(e) => setStoryPrompt(e.target.value)}
                    placeholder="e.g. Apex Precision CNC & Lathe Machine Plant in Pune - Export Quality Standards"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(59, 130, 246, 0.4)", color: "#fff", fontSize: 13, marginBottom: 12 }}
                    required
                  />

                  {/* Media Uploader */}
                  <div style={{ padding: "14px", borderRadius: 10, border: "2px dashed rgba(59, 130, 246, 0.4)", background: "rgba(59, 130, 246, 0.05)", textAlign: "center", marginBottom: 10 }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      multiple
                      accept="video/mp4,video/quicktime,image/*"
                      onChange={handleMediaUpload}
                      style={{ display: "none" }}
                    />
                    <div style={{ fontSize: 24, marginBottom: 4 }}>📹</div>
                    <div style={{ fontWeight: 800, fontSize: 12.5, color: "#93c5fd" }}>
                      Upload Factory Videos (.mp4) or Photos
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", margin: "4px 0 10px" }}>
                      Lathe machines, production line clips, worker footage, or product photos.
                    </div>
                    <button
                      type="button"
                      disabled={uploadingMedia}
                      onClick={() => fileInputRef.current?.click()}
                      style={{ padding: "7px 16px", borderRadius: 8, background: "#2563eb", border: "none", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                    >
                      {uploadingMedia ? "⏳ Uploading..." : "📁 Browse Device Files"}
                    </button>
                  </div>

                  {/* Uploaded Media Chips */}
                  {clientMedia.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {clientMedia.map((m, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0, 0, 0, 0.6)", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "#cbd5e1" }}>
                          <span>{m.type === "video" ? "🎬" : "🖼️"}</span>
                          <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name || `Clip ${idx + 1}`}</span>
                          <span
                            onClick={() => setClientMedia((prev) => prev.filter((_, i) => i !== idx))}
                            style={{ cursor: "pointer", color: "#f87171", fontWeight: 900, marginLeft: 4 }}
                          >
                            ✕
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* MODE A: AI CHARACTER STORY WRITER */
                <>
                  {/* AI Story Ideator Section */}
                  <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(139, 92, 246, 0.08)", border: "1px solid rgba(139, 92, 246, 0.25)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: "#c084fc" }}>
                          ✨ AI Story Ideator
                        </div>
                        <div style={{ fontSize: 10.5, color: "#94a3b8" }}>
                          Auto-generate 4 viral pitches tailored to {selectedCharacter?.name || "your character"} & {audience} audience.
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={generatingIdeas}
                        onClick={handleGenerateIdeas}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 8,
                          background: generatingIdeas ? "rgba(255, 255, 255, 0.1)" : "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)",
                          border: "none",
                          color: "#fff",
                          fontSize: 11.5,
                          fontWeight: 800,
                          cursor: generatingIdeas ? "not-allowed" : "pointer",
                        }}
                      >
                        {generatingIdeas ? "⏳ Brainstorming..." : "💡 Suggest 4 Pitches"}
                      </button>
                    </div>

                    {/* Suggested Ideas Grid */}
                    {suggestedIdeas.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                        {suggestedIdeas.map((idea) => (
                          <div
                            key={idea.id}
                            onClick={() => {
                              setVideoTitle(idea.title);
                              setEpisodeTitle(idea.title);
                              setStoryPrompt(`${idea.hook} — ${idea.premise}`);
                              setToastMsg(`Applied story pitch: "${idea.title}"`);
                              setTimeout(() => setToastMsg(""), 3000);
                            }}
                            style={{
                              padding: "10px",
                              borderRadius: 8,
                              background: "rgba(0, 0, 0, 0.4)",
                              border: "1px solid rgba(192, 132, 252, 0.2)",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <span style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 4, background: "rgba(168, 85, 247, 0.25)", color: "#d8b4fe", fontWeight: 700 }}>
                                {idea.genre || "Story"}
                              </span>
                              <span style={{ fontSize: 10, color: "#38bdf8", fontWeight: 700 }}>Click to use ↵</span>
                            </div>
                            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#f8fafc", marginBottom: 3 }}>
                              {idea.title}
                            </div>
                            <div style={{ fontSize: 10, color: "#cbd5e1", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {idea.premise}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Title & Conditional Episode Sequencing */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>
                      {narrativeType === "episodic" ? "Episode Title:" : "Story / Video Title:"}
                    </label>
                    <input
                      type="text"
                      value={narrativeType === "episodic" ? episodeTitle : videoTitle}
                      onChange={(e) => {
                        if (narrativeType === "episodic") {
                          setEpisodeTitle(e.target.value);
                        } else {
                          setVideoTitle(e.target.value);
                          setEpisodeTitle(e.target.value);
                        }
                      }}
                      placeholder={narrativeType === "episodic" ? "e.g. The Secret Discovery" : "e.g. The Hidden Truth Behind The Miracle"}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#fff", fontSize: 13 }}
                      required
                    />
                  </div>

                  {/* Conditional Episode Controls (Active only when episodic series is selected) */}
                  {narrativeType === "episodic" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#a78bfa", marginBottom: 4 }}>
                          📚 Season #:
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={seasonNumber}
                          onChange={(e) => setSeasonNumber(Math.max(1, parseInt(e.target.value) || 1))}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, background: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(139, 92, 246, 0.3)", color: "#fff", fontSize: 12 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#a78bfa", marginBottom: 4 }}>
                          🎬 Episode #:
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={episodeNumber}
                          onChange={(e) => setEpisodeNumber(Math.max(1, parseInt(e.target.value) || 1))}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, background: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(139, 92, 246, 0.3)", color: "#fff", fontSize: 12 }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 6, background: "rgba(255, 255, 255, 0.02)", border: "1px dashed rgba(255, 255, 255, 0.08)", marginBottom: 14 }}>
                      <span style={{ fontSize: 12, opacity: 0.5 }}>🔒</span>
                      <span style={{ fontSize: 11, color: "#64748b" }}>
                        Episode numbering is greyed out. (Switch to <strong>Episodic Series</strong> above to enable chapter lore & episode numbers).
                      </span>
                    </div>
                  )}

                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>
                      Story Plot / Mission Concept:
                    </label>
                    <textarea
                      rows={3}
                      value={storyPrompt}
                      onChange={(e) => setStoryPrompt(e.target.value)}
                      placeholder="Describe the adventure, conflict, or lesson in this video..."
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#fff", fontSize: 13, resize: "vertical" }}
                      required
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={generatingStory}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: 10,
                  background:
                    creationMode === "custom_script"
                      ? "linear-gradient(135deg, #ec4899 0%, #a855f7 100%)"
                      : creationMode === "business_media"
                      ? "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)"
                      : videoFormat === "youtube_16_9"
                      ? "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)"
                      : "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
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
                <span>
                  {generatingStory
                    ? "✨ Synthesizing Episode & Scene Visuals…"
                    : creationMode === "custom_script"
                    ? "🪕 Synthesize Shayari & Video"
                    : creationMode === "business_media"
                    ? "🏭 Generate Business Showcase Video"
                    : "🎬 Generate Episode Script & Narration"}
                </span>
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
                  {generatedStory.masterVideoUrl ? (
                    <video
                      src={generatedStory.masterVideoUrl}
                      controls
                      autoPlay
                      playsInline
                      style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
                    />
                  ) : generatedStory.scenes[activeSceneIndex]?.isClientVideo ? (
                    <video
                      key={activeSceneIndex}
                      src={generatedStory.scenes[activeSceneIndex]?.videoUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <img
                      key={activeSceneIndex}
                      src={
                        generatedStory.scenes[activeSceneIndex]?.videoUrl ||
                        generatedStory.character?.referenceSheetUrl ||
                        selectedCharacter?.referenceSheetUrl
                      }
                      alt={generatedStory.scenes[activeSceneIndex]?.chapter || "Scene"}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transform: isPlaying ? "scale(1.06)" : "scale(1)",
                        transition: "transform 4s ease-out, opacity 0.3s ease",
                      }}
                    />
                  )}

                  {/* Gradient Overlay */}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%)", pointerEvents: "none" }} />

                  {/* Scene Counter & Chapter Badge */}
                  <div style={{ position: "absolute", top: 12, left: 14, background: "rgba(0, 0, 0, 0.75)", border: "1px solid #ec4899", color: "#f472b6", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>🎬 Scene {activeSceneIndex + 1} of {generatedStory.scenes.length}</span>
                    {generatedStory.scenes[activeSceneIndex]?.chapter && (
                      <span style={{ color: "#e2e8f0" }}>• {generatedStory.scenes[activeSceneIndex].chapter}</span>
                    )}
                  </div>

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

              {generatedStory?.masterVideoUrl && (
                <a
                  href={generatedStory.masterVideoUrl}
                  download={`${(episodeTitle || "character-story").slice(0, 30).replace(/\s+/g, "-")}.mp4`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginTop: 10,
                    width: "100%",
                    padding: "11px",
                    borderRadius: 10,
                    background: "rgba(59, 130, 246, 0.2)",
                    border: "1px solid #3b82f6",
                    color: "#60a5fa",
                    fontWeight: 800,
                    fontSize: 13,
                    textAlign: "center",
                    display: "block",
                    textDecoration: "none",
                    boxShadow: "0 4px 14px rgba(59, 130, 246, 0.2)",
                  }}
                >
                  ⬇️ Download Master 1080p MP4
                </a>
              )}

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

              {/* Character Gender Selector */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>Character Gender:</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setNewCharGender("male"); setNewCharVoice("onyx"); }}
                    style={{
                      padding: "8px",
                      borderRadius: 8,
                      background: newCharGender === "male" ? "rgba(59, 130, 246, 0.25)" : "rgba(255, 255, 255, 0.03)",
                      border: newCharGender === "male" ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.08)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer"
                    }}
                  >
                    ♂️ Male
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewCharGender("female"); setNewCharVoice("shimmer"); }}
                    style={{
                      padding: "8px",
                      borderRadius: 8,
                      background: newCharGender === "female" ? "rgba(236, 72, 153, 0.25)" : "rgba(255, 255, 255, 0.03)",
                      border: newCharGender === "female" ? "2px solid #ec4899" : "1px solid rgba(255, 255, 255, 0.08)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer"
                    }}
                  >
                    ♀️ Female
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewCharGender("other"); setNewCharVoice("alloy"); }}
                    style={{
                      padding: "8px",
                      borderRadius: 8,
                      background: newCharGender === "other" ? "rgba(168, 85, 247, 0.25)" : "rgba(255, 255, 255, 0.03)",
                      border: newCharGender === "other" ? "2px solid #a855f7" : "1px solid rgba(255, 255, 255, 0.08)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer"
                    }}
                  >
                    🤖 Creature/Robot
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>Voice Personality & Gender:</label>
                <select
                  value={newCharVoice}
                  onChange={(e) => setNewCharVoice(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "#030712", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#fff", fontSize: 13 }}
                >
                  <optgroup label="♂️ Male Voices">
                    <option value="onyx">Onyx (Deep & Authoritative)</option>
                    <option value="echo">Echo (Heroic & Energetic)</option>
                    <option value="ash">Ash (Crisp & Focused)</option>
                  </optgroup>
                  <optgroup label="♀️ Female Voices">
                    <option value="shimmer">Shimmer (Warm & Expressive)</option>
                    <option value="nova">Nova (Charming & Bright)</option>
                    <option value="coral">Coral (Elegant & Gentle)</option>
                  </optgroup>
                  <optgroup label="🎙️ Narrator & Gender-Neutral">
                    <option value="fable">Fable (British Storyteller)</option>
                    <option value="alloy">Alloy (Dynamic & Friendly)</option>
                  </optgroup>
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
