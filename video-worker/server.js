// video-worker/server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const PORT = process.env.PORT || 8080;
const WORKER_SECRET_KEY = process.env.WORKER_SECRET_KEY || "gabbar_worker_secret_2026";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Initialize OpenAI
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Ensure temp storage directory exists
const TMP_DIR = path.join(os.tmpdir(), "gabbarinfo-video-renders");
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// In-memory Job Store with auto-cleanup
const jobs = new Map();

// Helper to log with timestamp
function log(jobId, msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${ts}] [Job ${jobId || "SYS"}] ${msg}`);
}

// Auth Middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : req.query.token;
  if (!token || token !== WORKER_SECRET_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized worker access." });
  }
  next();
}

// -------------------------------------------------------------
// Healthcheck Endpoint
// -------------------------------------------------------------
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    uptime: Math.round(process.uptime()),
    activeJobs: Array.from(jobs.values()).filter(j => j.status === "processing").length,
    queuedJobs: Array.from(jobs.values()).filter(j => j.status === "queued").length,
  });
});

// -------------------------------------------------------------
// Job Status Polling Endpoint
// -------------------------------------------------------------
app.get("/jobs/status/:jobId", requireAuth, (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ ok: false, error: "Job not found or expired." });
  }
  res.json({
    ok: true,
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    videoUrl: job.videoUrl || null,
    metadata: job.metadata || {},
    error: job.error || null,
    createdAt: job.createdAt,
    completedAt: job.completedAt || null,
  });
});

// -------------------------------------------------------------
// Create Video Job Endpoint
// -------------------------------------------------------------
app.post("/jobs/create", requireAuth, async (req, res) => {
  const {
    videoType = "reel", // "reel" | "character_story" | "long_form_youtube"
    payload = {},
    userEmail,
  } = req.body;

  if (!userEmail) {
    return res.status(400).json({ ok: false, error: "Missing userEmail" });
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const job = {
    id: jobId,
    userEmail,
    videoType,
    payload,
    status: "queued",
    progress: 5,
    stage: "Job queued in Railway background worker",
    videoUrl: null,
    error: null,
    createdAt: new Date().toISOString(),
  };

  jobs.set(jobId, job);
  log(jobId, `Queued new ${videoType} job for user: ${userEmail}`);

  // Trigger processing asynchronously
  setImmediate(() => processJob(jobId));

  res.status(202).json({
    ok: true,
    jobId,
    status: "queued",
    message: "Video generation dispatched to background worker.",
  });
});

// -------------------------------------------------------------
// Background Job Runner
// -------------------------------------------------------------
async function processJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = "processing";
  job.progress = 10;
  job.stage = "Starting video pipeline...";

  const jobDir = path.join(TMP_DIR, jobId);
  if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });

  try {
    if (job.videoType === "long_form_youtube") {
      await processLongFormYouTube(job, jobDir);
    } else if (job.videoType === "character_story") {
      await processCharacterStory(job, jobDir);
    } else {
      await processReelVideo(job, jobDir);
    }

    job.status = "completed";
    job.progress = 100;
    job.stage = "Master video generated & hosted successfully!";
    job.completedAt = new Date().toISOString();
    log(jobId, `Job completed successfully! Master URL: ${job.videoUrl}`);

  } catch (err) {
    log(jobId, `Job FAILED: ${err.message}`);
    console.error(err);
    job.status = "failed";
    job.error = err.message || "Failed to render video.";
    job.stage = "Generation failed.";
  } finally {
    // Cleanup temporary files after 15 minutes
    setTimeout(() => {
      try {
        if (fs.existsSync(jobDir)) {
          fs.rmSync(jobDir, { recursive: true, force: true });
        }
      } catch (e) {}
    }, 15 * 60 * 1000);
  }
}

// -------------------------------------------------------------
// Long-Form YouTube Pipeline (4-6 mins, 3-4 characters)
// -------------------------------------------------------------
async function processLongFormYouTube(job, jobDir) {
  const { payload } = job;
  const {
    topic = "The Mystery of the Neon Horizon",
    storyPrompt,
    characters = [],
    language = "hindi",
    targetMinutes = 4.5, // 4 to 6 mins
    vocalEmotion = "dramatic_story",
  } = payload;

  job.progress = 15;
  job.stage = "Scriptwriting 4–6 min multi-character storyline with GPT-4o...";
  log(job.id, `Generating long-form script (~${targetMinutes} min) for "${topic}"`);

  // Default characters if not provided
  const activeCharacters = characters.length >= 2 ? characters : [
    { name: "Kabir", role: "Protagonist / Visionary", voice: "onyx", traits: "bold, confident, determined" },
    { name: "Tara", role: "Companion / Strategist", voice: "shimmer", traits: "analytical, wise, caring" },
    { name: "Dev", role: "Mentor / Veteran", voice: "echo", traits: "deep voice, calm authority, observant" },
  ];

  const charListPrompt = activeCharacters.map(c => `- ${c.name} (${c.role}): voice profile "${c.voice}", traits: ${c.traits}`).join("\n");

  const numScenes = Math.max(12, Math.min(24, Math.round(targetMinutes * 3.5))); // ~14-20 scenes for 4-5 mins
  log(job.id, `Creating ${numScenes} sequenced scenes for target duration ${targetMinutes} mins.`);

  let langInstruction = "Language: Hindi (fluent, natural, expressive dialogue in Devanagari script).";
  if (language === "en_us") langInstruction = "Language: American English (natural cinematic conversational dialogue).";
  if (language === "en_uk") langInstruction = "Language: British English (eloquent cadence and phrasing).";

  const systemPrompt = `You are a world-class YouTube cinematic screenplay director.
You are writing a COMPLETE, start-to-end self-contained 4 to 6 minute dramatic story (NOT an episode, fully concludes with emotional punchline/moral).
FORMAT: 16:9 Widescreen YouTube Cinematic Masterpiece.
${langInstruction}
CHARACTERS:
${charListPrompt}

REQUIREMENTS:
1. Divide into exactly ${numScenes} scenes.
2. Each scene must feature dialogue from one of the characters or narrator, with intense emotional progression (Hook -> Conflict -> Revelation -> Climax -> Resolution).
3. Return ONLY valid JSON:
{
  "title": "Compelling Title",
  "youtubeTitle": "High CTR YouTube Title",
  "description": "Engaging description with timestamps",
  "scenes": [
    {
      "sceneNumber": 1,
      "speaker": "${activeCharacters[0].name}",
      "chapter": "Chapter Title",
      "narration": "Dialogue line spoken (15-25 words)",
      "visualDescription": "High-detail cinematic visual description of characters in setting",
      "searchKeyword": "1-2 keywords for ambient B-roll"
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.75,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Write a complete 4-6 minute concluded story on topic: "${storyPrompt || topic}". Must have ${numScenes} scenes.` }
    ],
  });

  const script = JSON.parse(completion.choices[0].message.content);
  job.metadata = { title: script.title, youtubeTitle: script.youtubeTitle };

  // Step 2: Multi-Character Voiceover Synthesis
  job.progress = 30;
  job.stage = "Synthesizing multi-character voice acting via OpenAI TTS...";
  log(job.id, `Synthesizing ${script.scenes.length} dialogue tracks with distinct character voices...`);

  const audioFiles = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const charObj = activeCharacters.find(c => c.name.toLowerCase() === (scene.speaker || "").toLowerCase()) || activeCharacters[i % activeCharacters.length];
    const voice = charObj.voice || "nova";

    job.stage = `Recording dialogue: ${scene.speaker || "Character"} (${i + 1}/${script.scenes.length})...`;
    job.progress = 30 + Math.round((i / script.scenes.length) * 25); // 30% to 55%

    const mp3Response = await openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: scene.narration,
      response_format: "mp3",
    });

    const audioBuf = Buffer.from(await mp3Response.arrayBuffer());
    const audioPath = path.join(jobDir, `scene_${i}_audio.mp3`);
    fs.writeFileSync(audioPath, audioBuf);
    audioFiles.push(audioPath);
  }

  // Step 3: Visual Generation (DALL-E 3 / gpt-image-2 for key scenes, stock clips for transitions)
  job.progress = 55;
  job.stage = "Generating cinematic visual scenes...";
  log(job.id, `Rendering visuals for ${script.scenes.length} scenes...`);

  const sceneVisuals = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    job.stage = `Rendering visual frame ${i + 1}/${script.scenes.length}...`;
    job.progress = 55 + Math.round((i / script.scenes.length) * 20); // 55% to 75%

    const imgPath = path.join(jobDir, `scene_${i}_visual.png`);
    try {
      const prompt = `Cinematic 16:9 movie still frame. ${scene.visualDescription}. Hyper-detailed, 8k resolution, dramatic cinematic lighting, photorealistic color grading.`;
      const imgGen = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt.slice(0, 950),
        n: 1,
        size: "1792x1024",
      });

      if (imgGen.data?.[0]?.url) {
        const fetchRes = await fetch(imgGen.data[0].url);
        const imgBuf = Buffer.from(await fetchRes.arrayBuffer());
        fs.writeFileSync(imgPath, imgBuf);
        sceneVisuals.push({ type: "image", path: imgPath });
      } else {
        throw new Error("No image data");
      }
    } catch (imgErr) {
      log(job.id, `Image gen fallback for scene ${i}: ${imgErr.message}`);
      // Fallback solid gradient / placeholder if image gen limits hit
      await createFallbackImage(imgPath, 1920, 1080, scene.speaker || "Scene");
      sceneVisuals.push({ type: "image", path: imgPath });
    }
  }

  // Step 4: FFmpeg Master Assembly
  job.progress = 75;
  job.stage = "FFmpeg server-side master 1080p video compilation...";
  log(job.id, "Assembling master video via FFmpeg...");

  const masterVideoPath = path.join(jobDir, "master_output.mp4");
  await assembleFFmpegVideo({
    jobDir,
    scenes: script.scenes,
    audioFiles,
    visuals: sceneVisuals,
    outputPath: masterVideoPath,
    isWidescreen: true,
    onProgress: (p) => {
      job.progress = 75 + Math.round(p * 0.15); // 75% to 90%
    },
  });

  // Step 5: Upload Finished Master MP4
  job.progress = 90;
  job.stage = "Uploading finished video to media bridge...";
  const finalFilename = `youtube_long_${Date.now()}.mp4`;
  const uploadedUrl = await uploadMasterVideo(masterVideoPath, finalFilename, job.userEmail);
  job.videoUrl = uploadedUrl;
}

// -------------------------------------------------------------
// Reels / Shorts Video Pipeline (9:16 vertical)
// -------------------------------------------------------------
async function processReelVideo(job, jobDir) {
  const { payload } = job;
  const {
    topic = "Viral Social Reel",
    niche = "business",
    language = "hindi",
    voice = "nova",
  } = payload;

  job.progress = 20;
  job.stage = "Generating viral reel script...";

  const scriptRes = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You are an elite short-form video creator. Return JSON with title and 4 scenes (narration, visualPrompt, searchQuery)." },
      { role: "user", content: `Create a 30s viral vertical reel on topic: "${topic}" in ${language}.` }
    ],
  });

  const script = JSON.parse(scriptRes.choices[0].message.content);

  // Synthesize single continuous voiceover
  job.progress = 40;
  job.stage = "Synthesizing voiceover audio...";
  const fullText = script.scenes.map(s => s.narration).join(" ... ");
  const voRes = await openai.audio.speech.create({
    model: "tts-1",
    voice,
    input: fullText,
    response_format: "mp3",
  });
  const voBuf = Buffer.from(await voRes.arrayBuffer());
  const voPath = path.join(jobDir, "voiceover.mp3");
  fs.writeFileSync(voPath, voBuf);

  // Generate visuals
  job.progress = 60;
  job.stage = "Generating vertical scenes...";
  const visuals = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const imgPath = path.join(jobDir, `reel_scene_${i}.png`);
    try {
      const imgGen = await openai.images.generate({
        model: "dall-e-3",
        prompt: `${scene.visualPrompt}, vertical 9:16 smartphone wallpaper format, photorealistic 4k`,
        n: 1,
        size: "1024x1792",
      });
      const fetchRes = await fetch(imgGen.data[0].url);
      fs.writeFileSync(imgPath, Buffer.from(await fetchRes.arrayBuffer()));
      visuals.push({ type: "image", path: imgPath });
    } catch (e) {
      await createFallbackImage(imgPath, 1080, 1920, "Reel Scene");
      visuals.push({ type: "image", path: imgPath });
    }
  }

  // Assemble FFmpeg 9:16
  job.progress = 80;
  job.stage = "Encoding 9:16 vertical master video...";
  const masterPath = path.join(jobDir, "master_reel.mp4");
  await assembleFFmpegVideo({
    jobDir,
    scenes: script.scenes,
    audioFiles: [voPath],
    visuals,
    outputPath: masterPath,
    isWidescreen: false,
    onProgress: (p) => { job.progress = 80 + Math.round(p * 0.1); }
  });

  job.progress = 92;
  job.stage = "Uploading reel master...";
  job.videoUrl = await uploadMasterVideo(masterPath, `reel_${Date.now()}.mp4`, job.userEmail);
}

// -------------------------------------------------------------
// Character Story Pipeline
// -------------------------------------------------------------
async function processCharacterStory(job, jobDir) {
  // Routes to long-form or reel depending on format
  const isWidescreen = job.payload?.format === "youtube_16_9";
  if (isWidescreen) {
    return processLongFormYouTube(job, jobDir);
  } else {
    return processReelVideo(job, jobDir);
  }
}

// -------------------------------------------------------------
// FFmpeg Video Assembly Engine
// -------------------------------------------------------------
async function assembleFFmpegVideo({ jobDir, scenes, audioFiles, visuals, outputPath, isWidescreen = true, onProgress }) {
  return new Promise((resolve, reject) => {
    const width = isWidescreen ? 1920 : 1080;
    const height = isWidescreen ? 1080 : 1920;

    // Concat all audio files if multiple
    const combinedAudioPath = path.join(jobDir, "combined_audio.mp3");
    if (audioFiles.length > 1) {
      const audioListPath = path.join(jobDir, "audiolist.txt");
      const listContent = audioFiles.map(f => `file '${f.replace(/\\/g, "/")}'`).join("\n");
      fs.writeFileSync(audioListPath, listContent);

      const concatProc = spawn("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", audioListPath, "-c", "copy", combinedAudioPath]);
      concatProc.on("close", (code) => {
        if (code !== 0) return reject(new Error(`Audio concat failed with code ${code}`));
        proceedWithVideo();
      });
      concatProc.on("error", reject);
    } else {
      fs.copyFileSync(audioFiles[0], combinedAudioPath);
      proceedWithVideo();
    }

    function proceedWithVideo() {
      // Calculate duration from audio using ffprobe or file size estimation
      const stats = fs.statSync(combinedAudioPath);
      const approxDurationSecs = Math.max(10, Math.round(stats.size / 16000));
      const durationPerScene = Math.max(3, Math.round((approxDurationSecs / visuals.length) * 10) / 10);

      // Create video segments for each visual
      const segmentFiles = [];
      let currentIdx = 0;

      function renderNextSegment() {
        if (currentIdx >= visuals.length) {
          concatSegments();
          return;
        }

        const vis = visuals[currentIdx];
        const segPath = path.join(jobDir, `seg_${currentIdx}.mp4`);
        segmentFiles.push(segPath);

        // Zoom/Pan animation filter for cinematic feel
        const vf = isWidescreen
          ? `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.001,1.15)':d=${Math.round(durationPerScene * 25)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080`
          : `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.001,1.15)':d=${Math.round(durationPerScene * 25)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920`;

        const args = [
          "-y",
          "-loop", "1",
          "-t", `${durationPerScene}`,
          "-i", vis.path,
          "-vf", vf,
          "-c:v", "libx264",
          "-pix_fmt", "yuv420p",
          "-r", "25",
          segPath
        ];

        const segProc = spawn("ffmpeg", args);
        segProc.on("close", (code) => {
          if (code !== 0) return reject(new Error(`Segment ${currentIdx} failed with code ${code}`));
          currentIdx++;
          if (onProgress) onProgress(currentIdx / visuals.length);
          renderNextSegment();
        });
        segProc.on("error", reject);
      }

      function concatSegments() {
        const segListPath = path.join(jobDir, "seglist.txt");
        fs.writeFileSync(segListPath, segmentFiles.map(f => `file '${f.replace(/\\/g, "/")}'`).join("\n"));

        // Combine video segments and merge audio track
        const finalArgs = [
          "-y",
          "-f", "concat",
          "-safe", "0",
          "-i", segListPath,
          "-i", combinedAudioPath,
          "-c:v", "libx264",
          "-c:a", "aac",
          "-b:a", "192k",
          "-pix_fmt", "yuv420p",
          "-movflags", "+faststart",
          "-shortest",
          outputPath
        ];

        const finalProc = spawn("ffmpeg", finalArgs);
        finalProc.on("close", (code) => {
          if (code !== 0) return reject(new Error(`Final assembly failed with code ${code}`));
          resolve(outputPath);
        });
        finalProc.on("error", reject);
      }

      renderNextSegment();
    }
  });
}

// -------------------------------------------------------------
// Fallback Canvas Image Generator
// -------------------------------------------------------------
async function createFallbackImage(targetPath, width, height, title) {
  // Creates a clean 1-pixel color image then scales via ffmpeg
  const args = [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=0x1e1b4b:s=${width}x${height}:d=1`,
    "-vframes", "1",
    targetPath
  ];
  return new Promise((resolve) => {
    const p = spawn("ffmpeg", args);
    p.on("close", () => resolve(targetPath));
    p.on("error", () => resolve(targetPath));
  });
}

// -------------------------------------------------------------
// Upload Master Video to Media Bridge / Supabase
// -------------------------------------------------------------
async function uploadMasterVideo(filePath, filename, userEmail) {
  const fileBuffer = fs.readFileSync(filePath);

  // 1. Try WordPress Ephemeral Media Bridge
  try {
    const wpApiKey = process.env.WORDPRESS_API_KEY || "gb_6XvSNZPT9h4aV2s2P0x1uUuP";
    const wpSite = "https://www.gabbarinfo.com";
    const endpoint = `${wpSite}/wp-json/gabbarinfo/v1/media-bridge/upload?api_key=${encodeURIComponent(wpApiKey)}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename,
        content_base64: fileBuffer.toString("base64"),
      }),
    });

    const data = await res.json();
    if (data.ok && data.url) {
      log(null, `Uploaded master video to WordPress Media Bridge: ${data.url}`);
      return data.url;
    }
  } catch (wpErr) {
    log(null, `Media bridge upload warning: ${wpErr.message}`);
  }

  // 2. Fallback to Supabase Storage
  if (supabase) {
    const storagePath = `master_videos/${filename}`;
    const { error: upErr } = await supabase.storage
      .from("instagram-creatives")
      .upload(storagePath, fileBuffer, { contentType: "video/mp4", upsert: true });

    if (!upErr) {
      const { data: pubData } = supabase.storage
        .from("instagram-creatives")
        .getPublicUrl(storagePath);
      log(null, `Uploaded master video to Supabase Storage: ${pubData.publicUrl}`);
      return pubData.publicUrl;
    }
  }

  throw new Error("Failed to upload master video to both WordPress and Supabase storage.");
}

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 GabbarInfo Video Worker running on port ${PORT}`);
  console.log(`🛡️ Auth Protected with WORKER_SECRET_KEY`);
  console.log(`🎬 FFmpeg Engine Ready for Reels & Long-Form YouTube`);
  console.log(`=======================================================`);
});
