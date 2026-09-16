// video-worker/server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");
const cron = require("node-cron");
const { runSocialAutopilotCycle } = require("./lib/social-autopilot");
const { runSeoAutopilotCycle } = require("./lib/seo-autopilot");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const PORT = process.env.PORT || 8080;
const WORKER_SECRET_KEY = process.env.WORKER_SECRET_KEY || "gabbar_worker_secret_2026";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
}) : null;

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
// Debug Command Execution Endpoint (Protected)
// -------------------------------------------------------------
app.post("/debug/ffmpeg", requireAuth, async (req, res) => {
  const { command = "ffmpeg", args = ["-version"] } = req.body;
  const p = spawn(command, args);
  let stdout = "", stderr = "";
  p.stdout?.on("data", (d) => { stdout += d.toString(); });
  p.stderr?.on("data", (d) => { stderr += d.toString(); });
  p.on("close", (code, signal) => {
    res.json({ ok: true, code, signal, stdout: stdout.slice(-2000), stderr: stderr.slice(-2000) });
  });
  p.on("error", (err) => {
    res.json({ ok: false, error: err.message });
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
// Public File Uploader for GPU AI Pipelines
// -------------------------------------------------------------
async function uploadPublicFile(filePath, filename, contentType = "application/octet-stream") {
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
      return data.url;
    }
  } catch (wpErr) {
    // fallback to Supabase
  }

  // 2. Supabase Storage fallback
  if (supabase) {
    const storagePath = `temp_uploads/${filename}`;
    const { error: upErr } = await supabase.storage
      .from("instagram-creatives")
      .upload(storagePath, fileBuffer, { contentType, upsert: true });

    if (!upErr) {
      const { data: pubData } = supabase.storage
        .from("instagram-creatives")
        .getPublicUrl(storagePath);
      return pubData.publicUrl;
    }
  }

  throw new Error(`Failed to upload public file ${filename}`);
}

// -------------------------------------------------------------
// Replicate GPU Video & Lip-Sync Engines
// -------------------------------------------------------------
async function generateSadTalkerLipSync({ imageUrl, audioUrl, jobId }) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("Missing REPLICATE_API_TOKEN in environment variables");

  log(jobId, `Dispatching SadTalker GPU lip-sync prediction to Replicate...`);
  const createRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "a519cc0cfebaaeade068b23899165a11ec76aaa1d2b313d40d214f204ec957a3",
      input: {
        source_image: imageUrl,
        driven_audio: audioUrl,
        still: false,
        use_enhancer: false,
        expression_scale: 1.1,
      },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`SadTalker start error: ${errText}`);
  }

  const prediction = await createRes.json();
  const pollUrl = prediction.urls?.get;

  const startTime = Date.now();
  while ((Date.now() - startTime) < 240000) {
    await new Promise((r) => setTimeout(r, 4000));
    const statusRes = await fetch(pollUrl, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();
    if (statusData.status === "succeeded") {
      const out = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output;
      log(jobId, `SadTalker GPU lip-sync succeeded: ${out}`);
      return out;
    }
    if (statusData.status === "failed" || statusData.status === "canceled") {
      throw new Error(`SadTalker failed: ${statusData.error || "Unknown error"}`);
    }
  }
  throw new Error("SadTalker prediction timed out after 240s");
}

async function generateGenerativeClip({ prompt, isWidescreen, jobId }) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("Missing REPLICATE_API_TOKEN in environment variables");

  log(jobId, `Dispatching Generative AI Video prediction to Replicate (AnimateDiff)...`);
  const aspectDesc = isWidescreen ? "16:9 widescreen cinematic landscape" : "9:16 vertical smartphone format";
  const cleanPrompt = `${prompt}, ${aspectDesc}, cinematic lighting, photorealistic 8k, physical character motion, fluid movement, masterpiece`;

  const createRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "beecf59c4aee8d81bf04f0381033dfa10dc16e845b4ae00d281e2fa377e48a9f",
      input: {
        prompt: cleanPrompt,
        n_prompt: "bad quality, blurry, distorted, static, low resolution",
        steps: 25,
        guidance_scale: 7.5,
      },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Generative Video start error: ${errText}`);
  }

  const prediction = await createRes.json();
  const pollUrl = prediction.urls?.get;

  const startTime = Date.now();
  while ((Date.now() - startTime) < 240000) {
    await new Promise((r) => setTimeout(r, 4000));
    const statusRes = await fetch(pollUrl, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();
    if (statusData.status === "succeeded") {
      const out = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output;
      log(jobId, `Generative AI Video succeeded: ${out}`);
      return out;
    }
    if (statusData.status === "failed" || statusData.status === "canceled") {
      throw new Error(`Generative Video failed: ${statusData.error || "Unknown error"}`);
    }
  }
  throw new Error("Generative Video prediction timed out after 240s");
}

// -------------------------------------------------------------
// Long-Form / Character Story Pipeline (1-5+ mins, GPU Video & Lip-Sync)
// -------------------------------------------------------------
async function processLongFormYouTube(job, jobDir) {
  const { payload } = job;
  const {
    topic = "The Secret Quest",
    storyPrompt,
    videoTitle,
    episodeTitle,
    characters = [],
    language = "hindi",
    targetMinutes = 2,
    durationMinutes,
    audience = "family",
    vocalEmotion = "dramatic_story",
    animationStyle = "live_talking_head",
  } = payload;

  const durationMins = Number(durationMinutes || targetMinutes) || 2;
  const targetTotalSecs = durationMins * 60;
  const isWidescreen = payload.format === "youtube_16_9";

  job.progress = 15;
  job.stage = `Scriptwriting ~${durationMins} min storyline with GPT-4o...`;
  log(job.id, `Generating story script (~${durationMins} min, ${targetTotalSecs}s) for "${videoTitle || episodeTitle || topic}" [Animation: ${animationStyle}]`);

  // Default characters if not provided
  const activeCharacters = characters.length >= 2 ? characters : (characters.length === 1 ? characters : [
    { name: "Kabir", role: "Protagonist / Visionary", voice: "onyx", traits: "bold, confident, determined", archetype: "photoreal_human" },
    { name: "Tara", role: "Companion / Strategist", voice: "shimmer", traits: "analytical, wise, caring", archetype: "photoreal_human" },
  ]);

  const charListPrompt = activeCharacters.map(c => `- ${c.name} (${c.role || "Character"}): voice "${c.voice || "nova"}", traits: ${c.traits || c.visualTraits || "expressive"}`).join("\n");

  let numScenes = 4;
  if (durationMins >= 5) numScenes = 20;
  else if (durationMins >= 4) numScenes = 16;
  else if (durationMins >= 3) numScenes = 12;
  else if (durationMins >= 2) numScenes = 8;
  else numScenes = 4;

  const sceneTargetSecs = Math.max(12, Math.round(targetTotalSecs / numScenes));
  log(job.id, `Creating ${numScenes} scenes (~${sceneTargetSecs}s per scene) for target ${durationMins} mins.`);

  let langInstruction = "Language: Hindi (fluent, natural, expressive dialogue in Devanagari script).";
  if (language === "en_us") langInstruction = "Language: American English (natural cinematic conversational dialogue).";
  if (language === "en_uk") langInstruction = "Language: British English (eloquent cadence and phrasing).";

  let audiencePrompt = "TARGET AUDIENCE: Family & All Ages (heartfelt, inspiring, universally compelling).";
  if (audience === "kids") {
    audiencePrompt = "TARGET AUDIENCE: Children & Kids (Ages 3-10). Tone: Whimsical, innocent, gentle, educational moral lesson, playful vocabulary, zero scary elements.";
  } else if (audience === "teens") {
    audiencePrompt = "TARGET AUDIENCE: Teens & Young Adults. Tone: High-energy, fantasy adventure, mystery, snappy witty dialogues.";
  } else if (audience === "adult") {
    audiencePrompt = "TARGET AUDIENCE: Adults & Mature Viewers. Tone: Deep cinematic narrative, intense emotional drama, sophisticated dialogues.";
  }

  const systemPrompt = `You are a world-class cinematic screenplay director.
You are writing a COMPLETE, start-to-end self-contained ${durationMins} minute dramatic story.
FORMAT: ${isWidescreen ? "16:9 Widescreen YouTube Cinematic Masterpiece" : "9:16 Vertical Smartphone Story / Social Reel"}.
${langInstruction}
${audiencePrompt}
CHARACTERS:
${charListPrompt}

CRITICAL DURATION & DIALOGUE REQUIREMENTS:
1. Divide into exactly ${numScenes} sequential scenes.
2. Each scene must feature dialogue/narration between 35 and 50 words in length, rich with dramatic emotion and vivid storytelling, so that each spoken line comfortably lasts ~${sceneTargetSecs} seconds to fill the complete ${durationMins}-minute story.
3. Return ONLY valid JSON:
{
  "title": "${videoTitle || episodeTitle || "Compelling Title"}",
  "youtubeTitle": "High CTR Title",
  "description": "Engaging description with timestamps",
  "scenes": [
    {
      "sceneNumber": 1,
      "speaker": "${activeCharacters[0].name}",
      "chapter": "Chapter Title",
      "narration": "Rich expressive spoken dialogue (35 to 50 words)",
      "visualDescription": "High-detail cinematic visual description of characters in setting",
      "searchKeyword": "ambient setting keyword"
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.75,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Write a complete ${durationMins} minute concluded story on topic: "${storyPrompt || videoTitle || topic}". Must have ${numScenes} scenes with 35-50 words per scene.` }
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

  // Step 3: Visual & GPU Video Generation
  job.progress = 55;
  job.stage = `Generating visual scenes [Mode: ${animationStyle}]...`;
  log(job.id, `Rendering visuals for ${script.scenes.length} scenes (engine: ${animationStyle})...`);

  const sceneVisuals = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    job.stage = `Rendering scene ${i + 1}/${script.scenes.length}...`;
    job.progress = 55 + Math.round((i / script.scenes.length) * 20); // 55% to 75%

    const imgPath = path.join(jobDir, `scene_${i}_visual.png`);
    const vidPath = path.join(jobDir, `scene_${i}_video.mp4`);

    try {
      const isPhotoreal = activeCharacters.some(c => ["photoreal_human", "hollywood_cinema", "indian_cinema", "documentary_realism"].includes(c.archetype)) || payload.visualStyle === "photoreal_human";
      const aspectDesc = isWidescreen ? "16:9 widescreen YouTube format" : "vertical 9:16 smartphone format";

      let prompt = "";
      if (isPhotoreal) {
        prompt = `Cinematic ${aspectDesc} 35mm Hollywood film still photograph. ${scene.visualDescription}. Hyper-realistic living human characters, authentic skin pores, lifelike natural eyes with reflections, Arri Alexa Mini LF, 8k resolution, dramatic cinematic studio lighting, shallow depth of field. Zero cartoon or CGI plastic artifacts.`;
      } else {
        prompt = `Cinematic ${aspectDesc} movie still frame. ${scene.visualDescription}. Hyper-detailed, 8k resolution, dramatic cinematic lighting, rich colors, masterpiece.`;
      }

      let imgGen;
      try {
        imgGen = await openai.images.generate({
          model: "gpt-image-2",
          prompt: prompt.slice(0, 950),
          n: 1,
          size: "1024x1024",
        });
      } catch (e1) {
        imgGen = await openai.images.generate({
          model: "dall-e-3",
          prompt: prompt.slice(0, 950),
          n: 1,
          size: isWidescreen ? "1792x1024" : "1024x1792",
        });
      }

      if (imgGen.data?.[0]?.b64_json) {
        const imgBuf = Buffer.from(imgGen.data[0].b64_json, "base64");
        fs.writeFileSync(imgPath, imgBuf);
      } else if (imgGen.data?.[0]?.url) {
        const fetchRes = await fetch(imgGen.data[0].url);
        const imgBuf = Buffer.from(await fetchRes.arrayBuffer());
        fs.writeFileSync(imgPath, imgBuf);
      } else {
        throw new Error("No image data returned");
      }

      // If Live Talking Lip-Sync requested, invoke SadTalker GPU
      if (animationStyle === "live_talking_head") {
        job.stage = `Generating AI talking lip-sync (${i + 1}/${script.scenes.length})...`;
        try {
          const audioPublicUrl = await uploadPublicFile(audioFiles[i], `speech_${job.id}_${i}.mp3`, "audio/mpeg");
          const imgPublicUrl = await uploadPublicFile(imgPath, `char_${job.id}_${i}.png`, "image/png");

          const talkingVideoUrl = await generateSadTalkerLipSync({
            imageUrl: imgPublicUrl,
            audioUrl: audioPublicUrl,
            jobId: job.id,
          });

          const fetchVid = await fetch(talkingVideoUrl);
          if (fetchVid.ok) {
            fs.writeFileSync(vidPath, Buffer.from(await fetchVid.arrayBuffer()));
            sceneVisuals.push({ type: "video", path: vidPath });
            continue;
          }
        } catch (lipErr) {
          log(job.id, `Lip-sync fallback for scene ${i}: ${lipErr.message}`);
        }
      }

      // If Generative AI Video requested, invoke AnimateDiff GPU
      if (animationStyle === "generative_video") {
        job.stage = `Rendering generative AI video (${i + 1}/${script.scenes.length})...`;
        try {
          const genVideoUrl = await generateGenerativeClip({
            prompt: scene.visualDescription,
            isWidescreen,
            jobId: job.id,
          });

          const fetchVid = await fetch(genVideoUrl);
          if (fetchVid.ok) {
            fs.writeFileSync(vidPath, Buffer.from(await fetchVid.arrayBuffer()));
            sceneVisuals.push({ type: "video", path: vidPath });
            continue;
          }
        } catch (genErr) {
          log(job.id, `Generative video fallback for scene ${i}: ${genErr.message}`);
        }
      }

      // Fallback or Multi-Scene Motion style: use high-res image frame
      sceneVisuals.push({ type: "image", path: imgPath });

    } catch (imgErr) {
      log(job.id, `Visual gen fallback for scene ${i}: ${imgErr.message}`);
      await createFallbackImage(imgPath, isWidescreen ? 1920 : 1080, isWidescreen ? 1080 : 1920, scene.speaker || "Scene");
      sceneVisuals.push({ type: "image", path: imgPath });
    }
  }

  // Step 4: FFmpeg Master Assembly
  job.progress = 75;
  job.stage = "FFmpeg server-side master video compilation...";
  log(job.id, "Assembling master video via FFmpeg...");

  const masterVideoPath = path.join(jobDir, "master_output.mp4");
  await assembleFFmpegVideo({
    jobDir,
    scenes: script.scenes,
    audioFiles,
    visuals: sceneVisuals,
    outputPath: masterVideoPath,
    isWidescreen,
    targetDurationSecs: targetTotalSecs,
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
// Reels / Shorts Video Pipeline (9:16 vertical fast reel)
// -------------------------------------------------------------
async function processReelVideo(job, jobDir) {
  return processLongFormYouTube(job, jobDir);
}

// -------------------------------------------------------------
// Character Story Pipeline
// -------------------------------------------------------------
async function processCharacterStory(job, jobDir) {
  return processLongFormYouTube(job, jobDir);
}

// -------------------------------------------------------------
// FFmpeg Video Assembly Engine (Normalizes Videos & Images)
// -------------------------------------------------------------
async function assembleFFmpegVideo({ jobDir, scenes, audioFiles, visuals, outputPath, isWidescreen = true, targetDurationSecs = 120, onProgress }) {
  return new Promise((resolve, reject) => {
    const width = isWidescreen ? 1920 : 1080;
    const height = isWidescreen ? 1080 : 1920;

    // Concat all audio files if multiple
    const combinedAudioPath = path.join(jobDir, "combined_audio.mp3");
    if (audioFiles.length > 1) {
      const audioListPath = path.join(jobDir, "audiolist.txt");
      const listContent = audioFiles.map(f => `file '${f.replace(/\\/g, "/")}'`).join("\n");
      fs.writeFileSync(audioListPath, listContent);

      const concatProc = spawn("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", audioListPath, "-c", "copy", "-loglevel", "error", combinedAudioPath]);
      let concatErr = "";
      concatProc.stderr?.on("data", (c) => { concatErr += c.toString(); });
      concatProc.on("close", (code, signal) => {
        if (code !== 0) return reject(new Error(`Audio concat failed with code ${code || signal}: ${concatErr.slice(-300)}`));
        proceedWithVideo();
      });
      concatProc.on("error", reject);
    } else {
      fs.copyFileSync(audioFiles[0], combinedAudioPath);
      proceedWithVideo();
    }

    function proceedWithVideo() {
      // Calculate duration to match user requested runtime
      const stats = fs.statSync(combinedAudioPath);
      const audioDurationSecs = Math.max(10, Math.round(stats.size / 16000));
      const effectiveTotalSecs = Math.max(audioDurationSecs, targetDurationSecs);
      const durationPerScene = Math.max(4, Math.round((effectiveTotalSecs / visuals.length) * 10) / 10);

      // Create video segments for each visual (either normalizing video clip or animating image)
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

        let segProc;
        if (vis.type === "video") {
          // Normalize existing video clip to exact format, frame rate, and dimensions
          const scaleCropVf = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
          const args = [
            "-y",
            "-i", vis.path,
            "-vf", scaleCropVf,
            "-c:v", "libx264",
            "-threads", "2",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            "-r", "25",
            "-an",
            "-loglevel", "error",
            segPath
          ];
          segProc = spawn("ffmpeg", args);
        } else {
          // Smooth cinematic camera pan/tilt using pure YUV scale + crop
          const isEven = currentIdx % 2 === 0;
          let vf;
          if (isWidescreen) {
            const panExpr = isEven
              ? `(in_w-out_w)*(t/${durationPerScene})`
              : `(in_w-out_w)*(1-t/${durationPerScene})`;
            vf = `scale=2080:1170:force_original_aspect_ratio=increase,crop=2080:1170,crop=1920:1080:${panExpr}:(in_h-out_h)/2`;
          } else {
            const tiltExpr = isEven
              ? `(in_h-out_h)*(t/${durationPerScene})`
              : `(in_h-out_h)*(1-t/${durationPerScene})`;
            vf = `scale=1170:2080:force_original_aspect_ratio=increase,crop=1170:2080,crop=1080:1920:(in_w-out_w)/2:${tiltExpr}`;
          }

          const args = [
            "-y",
            "-loop", "1",
            "-t", `${durationPerScene}`,
            "-i", vis.path,
            "-vf", vf,
            "-c:v", "libx264",
            "-threads", "2",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            "-r", "25",
            "-loglevel", "error",
            segPath
          ];
          segProc = spawn("ffmpeg", args);
        }

        let segErr = "";
        segProc.stderr?.on("data", (chunk) => {
          segErr += chunk.toString();
          if (segErr.length > 2000) segErr = segErr.slice(-2000);
        });

        segProc.on("close", (code, signal) => {
          if (code !== 0) {
            console.error(`[Segment ${currentIdx} Error] code=${code} signal=${signal} err=${segErr}`);
            return reject(new Error(`Segment ${currentIdx} failed with code ${code || signal}: ${segErr.slice(-300)}`));
          }
          currentIdx++;
          if (onProgress) onProgress(currentIdx / visuals.length);
          renderNextSegment();
        });
        segProc.on("error", reject);
      }

      function concatSegments() {
        const segListPath = path.join(jobDir, "seglist.txt");
        fs.writeFileSync(segListPath, segmentFiles.map(f => `file '${f.replace(/\\/g, "/")}'`).join("\n"));

        // Combine video segments and loop/pad audio track to match full video length
        const finalArgs = [
          "-y",
          "-f", "concat",
          "-safe", "0",
          "-i", segListPath,
          "-stream_loop", "-1",
          "-i", combinedAudioPath,
          "-map", "0:v:0",
          "-map", "1:a:0",
          "-c:v", "copy",
          "-c:a", "aac",
          "-b:a", "192k",
          "-threads", "2",
          "-shortest",
          "-movflags", "+faststart",
          "-loglevel", "error",
          outputPath
        ];

        const finalProc = spawn("ffmpeg", finalArgs);
        let finalErr = "";
        finalProc.stderr?.on("data", (chunk) => {
          finalErr += chunk.toString();
          if (finalErr.length > 2000) finalErr = finalErr.slice(-2000);
        });

        finalProc.on("close", (code, signal) => {
          if (code !== 0) {
            return reject(new Error(`Final assembly failed with code ${code || signal}: ${finalErr.slice(-300)}`));
          }
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

// -------------------------------------------------------------
// Autopilot Trigger Endpoints (Protected by WORKER_SECRET_KEY)
// -------------------------------------------------------------
app.post("/autopilot/social/trigger", requireAuth, async (req, res) => {
  try {
    const force = Boolean(req.body?.force || req.query?.force);
    log("AUTOPILOT", `Manual trigger: Social Media Planner Autopilot (force: ${force})`);
    const results = await runSocialAutopilotCycle({ supabase, openai, force, logger: (msg) => log("SOCIAL_AP", msg) });
    res.json({ ok: true, count: results.length, results });
  } catch (err) {
    log("AUTOPILOT", `Social Autopilot Error: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/autopilot/seo/trigger", requireAuth, async (req, res) => {
  try {
    const force = Boolean(req.body?.force || req.query?.force);
    log("AUTOPILOT", `Manual trigger: SEO Suite Autopilot (force: ${force})`);
    const results = await runSeoAutopilotCycle({ supabase, openai, force, logger: (msg) => log("SEO_AP", msg) });
    res.json({ ok: true, count: results.length, results });
  } catch (err) {
    log("AUTOPILOT", `SEO Autopilot Error: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/autopilot/status", requireAuth, (req, res) => {
  res.json({
    ok: true,
    social_cron: "0 3 * * * (08:30 AM IST Daily)",
    seo_cron: "0 2 * * * (07:30 AM IST Daily)",
    hasSupabase: Boolean(supabase),
    hasOpenAI: Boolean(openai),
  });
});

// -------------------------------------------------------------
// Scheduled Native Cron Jobs (Reliable Background Execution)
// -------------------------------------------------------------
// 1. Daily SEO Suite Autopilot (Runs 07:30 AM IST / 02:00 UTC)
cron.schedule("0 2 * * *", async () => {
  log("CRON_SEO", "Executing scheduled SEO Suite Autopilot cycle...");
  try {
    await runSeoAutopilotCycle({ supabase, openai, force: false, logger: (msg) => log("CRON_SEO", msg) });
  } catch (e) {
    log("CRON_SEO", `Scheduled SEO cycle error: ${e.message}`);
  }
});

// 2. Daily Social Media Planner Autopilot (Runs 08:30 AM IST / 03:00 UTC)
cron.schedule("0 3 * * *", async () => {
  log("CRON_SOCIAL", "Executing scheduled Social Media Planner Autopilot cycle...");
  try {
    await runSocialAutopilotCycle({ supabase, openai, force: false, logger: (msg) => log("CRON_SOCIAL", msg) });
  } catch (e) {
    log("CRON_SOCIAL", `Scheduled Social cycle error: ${e.message}`);
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 GabbarInfo Video Worker running on port ${PORT}`);
  console.log(`🛡️ Auth Protected with WORKER_SECRET_KEY`);
  console.log(`🎬 FFmpeg Engine Ready for Reels & Long-Form YouTube`);
  console.log(`=======================================================`);
});
