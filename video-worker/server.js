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
        use_enhancer: true,
        enhancer: "gfpgan",
        preprocess: "crop",
        expression_scale: 1.25,
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

async function generateMinimaxVideo({ prompt, firstFrameUrl, isWidescreen, jobId }) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("Missing REPLICATE_API_TOKEN in environment variables");

  log(jobId, `Dispatching Minimax Video-01 (Higgsfield/Hailuo class) to Replicate...`);
  const aspectDesc = isWidescreen ? "16:9 cinematic widescreen landscape" : "9:16 vertical cinema reel";
  const cleanPrompt = `${prompt}, ${aspectDesc}, cinematic lighting, photorealistic 8k, fluid physical motion, moving elements, masterpiece`;

  const inputPayload = {
    prompt: cleanPrompt,
    prompt_optimizer: true,
  };
  if (firstFrameUrl) {
    inputPayload.first_frame_image = firstFrameUrl;
  }

  const createRes = await fetch("https://api.replicate.com/v1/models/minimax/video-01/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: inputPayload }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Minimax Video start error: ${errText}`);
  }

  const prediction = await createRes.json();
  const pollUrl = prediction.urls?.get;

  const startTime = Date.now();
  while ((Date.now() - startTime) < 300000) {
    await new Promise((r) => setTimeout(r, 6000));
    const statusRes = await fetch(pollUrl, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();
    if (statusData.status === "succeeded") {
      const out = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output;
      log(jobId, `Minimax Video-01 succeeded: ${out}`);
      return out;
    }
    if (statusData.status === "failed" || statusData.status === "canceled") {
      throw new Error(`Minimax Video failed: ${statusData.error || "Unknown error"}`);
    }
  }
  throw new Error("Minimax Video prediction timed out after 300s");
}

async function generateWanVideo({ prompt, isWidescreen, jobId }) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("Missing REPLICATE_API_TOKEN in environment variables");

  log(jobId, `Dispatching Wan 2.1 Video prediction to Replicate...`);
  const aspectDesc = isWidescreen ? "16:9" : "9:16";

  const createRes = await fetch("https://api.replicate.com/v1/models/wan-video/wan-2.1-1.3b/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt: `${prompt}, cinematic lighting, photorealistic 8k, fluid motion, atmospheric depth`,
        aspect_ratio: aspectDesc,
      },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Wan Video start error: ${errText}`);
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
      log(jobId, `Wan 2.1 Video succeeded: ${out}`);
      return out;
    }
    if (statusData.status === "failed" || statusData.status === "canceled") {
      throw new Error(`Wan Video failed: ${statusData.error || "Unknown error"}`);
    }
  }
  throw new Error("Wan Video prediction timed out after 240s");
}

function resolveVoice(char) {
  if (!char) return "onyx";
  const voice = (char.voice || "").toLowerCase();
  const nameAndTraits = `${char.name || ''} ${char.role || ''} ${char.traits || ''} ${char.visualTraits || ''} ${char.gender || ''}`.toLowerCase();
  const isMale = (char.gender === "male") || /\b(man|boy|guy|male|explorer|father|brother|king|warrior|he|him)\b/i.test(nameAndTraits);
  const isFemale = (char.gender === "female") || /\b(woman|girl|lady|female|queen|mother|sister|she|her)\b/i.test(nameAndTraits);

  if (isMale) {
    if (["nova", "shimmer", "coral", "alloy"].includes(voice)) {
      return "onyx"; // Default authoritative male
    }
    return voice || "onyx";
  }

  if (isFemale) {
    if (["onyx", "echo", "ash", "fable"].includes(voice)) {
      return "shimmer"; // Default expressive female
    }
    return voice || "shimmer";
  }

  return voice || "onyx";
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
    animationStyle = "hybrid_lip_sync", // Default to hybrid_lip_sync so characters visibly talk with lip-sync!
    storyStyle = "movie_dialogue", // "movie_dialogue" | "storybook_narrated" | "documentary_voiceover"
    genre = "action_thriller", // "action_thriller" | "movie_drama" | "comedy_skit" | "sci_fi"
    visualEngine = "photoreal_human", // "photoreal_human" | "pixar_3d" | "anime_2d" | "user_vault"
    customScript = "",
    scriptMode = "ai_prompt",
  } = payload;

  const durationMins = Number(durationMinutes || targetMinutes) || 2;
  const targetTotalSecs = durationMins * 60;
  const isWidescreen = payload.format === "youtube_16_9";
  const hasCustomScript = !!(customScript && customScript.trim());

  job.progress = 15;
  job.stage = hasCustomScript
    ? `Adapting user-provided screenplay (~${durationMins} min, ${targetTotalSecs}s)...`
    : `Scriptwriting ~${durationMins} min screenplay with GPT-4o...`;
  log(job.id, `Generating cinematic screenplay (~${durationMins} min, ${targetTotalSecs}s) for "${videoTitle || episodeTitle || topic}" [CustomScript: ${hasCustomScript}, Style: ${storyStyle}, Genre: ${genre}, Engine: ${visualEngine}]`);

  // Character casting:
  const hasUserCharacters = characters && Array.isArray(characters) && characters.length > 0;
  let activeCharacters = hasUserCharacters ? characters.map(c => ({
    name: c.name,
    role: c.role || "Character",
    voice: resolveVoice(c),
    gender: c.gender || "male",
    traits: c.traits || c.visualTraits || "expressive photorealistic person",
    archetype: c.archetype || visualEngine || "photoreal_human",
  })) : [];

  // Duration Pacing: 8 scenes for 2 mins (15s per scene) to guarantee true 120s runtime!
  let numScenes = 6;
  if (durationMins >= 5) numScenes = 15;
  else if (durationMins >= 4) numScenes = 12;
  else if (durationMins >= 3) numScenes = 10;
  else if (durationMins >= 2) numScenes = 8;
  else numScenes = 5;

  const sceneTargetSecs = Math.max(12, Math.round(targetTotalSecs / numScenes));
  log(job.id, `Creating ${numScenes} dynamic scenes (~${sceneTargetSecs}s per scene) for target ${durationMins} mins (${targetTotalSecs}s total).`);

  let langInstruction = "Language: Hindi. CRITICAL: All spoken dialogue in 'spokenAudio' MUST be written in natural, fluent, colloquial Devanagari script (हिंदी) with authentic phrasing so neural TTS delivers native Indian pronunciation with ZERO robotic or foreign accent!";
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

  let genrePrompt = "";
  if (genre === "action_thriller") {
    genrePrompt = `GENRE: HIGH-OCTANE ACTION THRILLER & STUNTS.
Tone: Fast-paced, high adrenaline, urgent stakes, car chases, daring escapes, explosive confrontations. Dialogue is snappy, tense, and urgent!`;
  } else if (genre === "comedy_skit") {
    genrePrompt = `GENRE: SNAPPY COMEDY SKIT.
Tone: Hilarious, relatable everyday humor, funny misunderstandings, punchy one-liners, and witty comebacks!`;
  } else if (genre === "sci_fi") {
    genrePrompt = `GENRE: SCI-FI & CYBERPUNK.
Tone: Futuristic neon metropolis, advanced gadgets, space mystery, high-tech suspense!`;
  } else {
    // movie_drama
    genrePrompt = `GENRE: INTENSE CINEMATIC DRAMA & EMOTIONAL ACTING.
Tone: Deep emotional realism, authentic human conflicts, heartfelt confrontations, personal stakes!`;
  }

  // Build System Prompt based on selected storyStyle
  let scriptFormatRules = "";
  if (storyStyle === "movie_dialogue") {
    scriptFormatRules = `
CRITICAL MOVIE / SKIT ACTING RULES (PURE CHARACTER CONVERSATION — ABSOLUTELY NO NARRATOR):
1. This is a real MOVIE / COMEDY SKIT / ACTION FILM. There is ZERO NARRATION. There is NO Narrator!
2. Characters speak directly to each other! Every single scene MUST feature one of the characters speaking direct spoken dialogue in quotation marks.
3. CONVERSATIONAL PACING: Spoken dialogue should be 25 to 45 words per scene (or multiple conversational exchanges), timed to comfortably fill ~${sceneTargetSecs} seconds with emotional delivery.
4. STRICT BACK-AND-FORTH DIALOGUE:
   - Alternating character speeches with distinct reactions and urgent stakes.
5. For every scene:
   - "type": "dialogue"
   - "speaker": EXACT name of the speaking character. NEVER "Narrator".
   - "spokenAudio": The direct spoken dialogue in quotation marks (natural, emotional, in Devanagari script if Hindi).
   - "visualDescription": Close-up or medium close-up movie shot of the speaking character. Their expression, clear eyes, gestures, and the cinematic setting.
   - "cameraShot": "close_up" or "medium_close_up" or "action_shot"`;
  } else if (storyStyle === "storybook_narrated") {
    scriptFormatRules = `
CRITICAL STORYBOOK / FABLE RULES:
1. Alternate between "b_roll" (speaker: "Narrator", descriptive scene setting) and "dialogue" (speaker: character name, lines in quotes).
2. For B-roll: "spokenAudio" is the narrator's rich descriptive voiceover (25 to 45 words per scene).
3. For Dialogue: "spokenAudio" is direct character dialogue in quotes (25 to 45 words per scene).`;
  } else {
    // documentary_voiceover
    scriptFormatRules = `
CRITICAL DOCUMENTARY / VOICEOVER RULES:
1. Every scene is "b_roll" with speaker "Narrator".
2. "spokenAudio" is authoritative, eloquent voiceover narration (25 to 45 words per scene) over wide cinematic visuals.`;
  }

  const charContext = hasUserCharacters ? `
FIXED USER CHARACTERS TO CAST:
${activeCharacters.map((c, i) => `Character ${i + 1}: Name="${c.name}", Role="${c.role}", Gender="${c.gender}", Voice="${c.voice}", Traits="${c.traits}"`).join("\n")}
` : `
DYNAMIC CHARACTER CREATION:
The user has NOT specified fixed characters. You MUST analyze the story prompt: "${storyPrompt || videoTitle || topic}".
Extract or invent 2 distinct characters fitting the genre, culture, and setting of this story.
Include a "characters" array in your JSON output defining them:
- "name": authentic realistic name fitting the story (e.g., Rohan, Priya, Vikram, Maya, Alex, Sophia)
- "role": role in the scene
- "gender": "male" or "female"
- "traits": visual description (clothing, look, hair, mood)
- "voice": choose "onyx" or "echo" or "ash" for male; "shimmer" or "nova" or "coral" for female
`;

  const customScriptSection = hasCustomScript ? `
========================================
USER-PROVIDED CUSTOM SCRIPT / SCREENPLAY:
"""
${customScript}
"""
CRITICAL INSTRUCTIONS FOR USER SCRIPT:
1. The user has explicitly provided their OWN script! You MUST preserve their exact dialogue lines, characters, and plot points verbatim!
2. Do NOT replace their words with generic summaries.
3. Divide the user's provided script into exactly ${numScenes} sequential scenes.
4. Extract the character names and assign them to the scene speakers.
5. Create vivid, photorealistic visual descriptions for each scene depicting what happens during that dialogue line.
========================================
` : "";

  const systemPrompt = `You are a world-class Hollywood film director and screenwriter.
You are writing a COMPLETE, captivating ${durationMins}-minute cinematic script (${targetTotalSecs}s runtime).
FORMAT: ${isWidescreen ? "16:9 Widescreen YouTube Cinematic Film" : "9:16 Vertical Smartphone Story / Social Reel"}.
${langInstruction}
${audiencePrompt}
${genrePrompt}

${customScriptSection}
${charContext}

${scriptFormatRules}

Divide the story into exactly ${numScenes} sequential scenes.
Each scene's spoken dialogue must be 25 to 45 words in length, lively, natural, and paced to comfortably fill ~${sceneTargetSecs} seconds.

Return ONLY valid JSON in this exact structure:
{
  "title": "${videoTitle || episodeTitle || "Cinematic Masterpiece"}",
  "youtubeTitle": "High CTR Compelling Title",
  "description": "Engaging description with timestamps",
  ${!hasUserCharacters ? `"characters": [
    { "name": "Name1", "role": "Role", "gender": "male", "traits": "traits", "voice": "onyx" },
    { "name": "Name2", "role": "Role", "gender": "female", "traits": "traits", "voice": "shimmer" }
  ],` : ""}
  "scenes": [
    {
      "sceneNumber": 1,
      "type": "dialogue",
      "speaker": "SpeakingCharacterName",
      "chapter": "Chapter Title",
      "spokenAudio": "\"Direct first-person spoken dialogue in quotation marks (25 to 45 words)\"",
      "visualDescription": "Close-up or medium shot of the speaking character with realistic eyes and expression, in the rich environment",
      "characterInVisual": "Speaking character name"
    }
  ]
}`;

  const userPromptContent = hasCustomScript
    ? `Adapt this user screenplay into ${numScenes} scenes for a ${durationMins} minute film: "${customScript.slice(0, 1000)}"`
    : `Write a complete ${durationMins} minute screenplay on topic: "${storyPrompt || videoTitle || topic}". Must have ${numScenes} scenes.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.75,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPromptContent }
    ],
  });

  const script = JSON.parse(completion.choices[0].message.content);
  job.metadata = { title: script.title, youtubeTitle: script.youtubeTitle };

  // If characters were dynamically generated by GPT-4o, register them now!
  if (!hasUserCharacters && script.characters && Array.isArray(script.characters) && script.characters.length > 0) {
    activeCharacters = script.characters.map(c => ({
      name: c.name,
      role: c.role || "Character",
      gender: c.gender || "male",
      voice: resolveVoice(c),
      traits: c.traits || "expressive cinematic character",
      archetype: visualEngine || "photoreal_human",
    }));
  } else if (activeCharacters.length === 0) {
    // Fallback if model omitted characters array
    activeCharacters = [
      { name: "Character 1", role: "Protagonist", gender: "male", voice: "onyx", traits: "cinematic actor" },
      { name: "Character 2", role: "Companion", gender: "female", voice: "shimmer", traits: "cinematic actress" },
    ];
  }

  // CRITICAL MULTI-CHARACTER RULE:
  // Guarantee that Character 1 and Character 2 have completely different, contrasting voices!
  const maleVoiceList = ["onyx", "echo", "ash", "alloy"];
  const femaleVoiceList = ["shimmer", "nova", "coral"];
  let mVoiceIdx = 0, fVoiceIdx = 0;

  activeCharacters.forEach((c, idx) => {
    const isFemale = c.gender === "female" || /\b(woman|girl|lady|female|queen|mother|sister|she|her)\b/i.test(`${c.name} ${c.traits}`);
    c.gender = isFemale ? "female" : "male";
    if (isFemale) {
      c.voice = femaleVoiceList[fVoiceIdx % femaleVoiceList.length];
      fVoiceIdx++;
    } else {
      c.voice = maleVoiceList[mVoiceIdx % maleVoiceList.length];
      mVoiceIdx++;
    }
    log(job.id, `Cast Character [${idx + 1}]: "${c.name}" (${c.gender}) -> Voice: "${c.voice}"`);
  });

  // CRITICAL SCRIPT NORMALIZATION:
  // In Movie / Skit Dialogue mode, NEVER allow "Narrator" or "b_roll" to take over the audio!
  // Force alternating dialogue between the cast characters!
  if (storyStyle === "movie_dialogue") {
    script.scenes.forEach((sc, idx) => {
      sc.type = "dialogue";
      const isBadSpeaker = !sc.speaker || sc.speaker.toLowerCase().includes("narrator") || sc.speaker.toLowerCase().includes("voiceover");
      if (isBadSpeaker) {
        const assignedChar = activeCharacters[idx % activeCharacters.length];
        sc.speaker = assignedChar.name;
      }
    });
  }

  // Step 2: Multi-Character Voiceover Synthesis
  job.progress = 30;
  job.stage = "Synthesizing multi-character voice acting via OpenAI TTS...";
  log(job.id, `Synthesizing ${script.scenes.length} audio tracks with distinct character voices...`);

  const audioFiles = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    let voice = "onyx";
    let isNarrator = false;

    if (storyStyle !== "movie_dialogue" && (!scene.speaker || scene.speaker.toLowerCase() === "narrator" || scene.type === "b_roll")) {
      isNarrator = true;
      voice = language === "hindi" ? "alloy" : "fable";
    } else {
      // Find exact character
      const speakerClean = (scene.speaker || "").toLowerCase().trim();
      const charObj = activeCharacters.find(c => c.name.toLowerCase().trim() === speakerClean)
        || activeCharacters.find(c => speakerClean.includes(c.name.toLowerCase().trim()))
        || activeCharacters[i % activeCharacters.length];

      voice = charObj.voice || (charObj.gender === "female" ? "shimmer" : "onyx");
      scene.speaker = charObj.name;
    }

    const spokenText = scene.spokenAudio || scene.narration || scene.text || "Dramatic cinematic unfolding";
    job.stage = `Recording ${isNarrator ? "Narrator" : scene.speaker} (${i + 1}/${script.scenes.length}) [Voice: ${voice}]...`;
    job.progress = 30 + Math.round((i / script.scenes.length) * 25);

    log(job.id, `Recording Scene ${i + 1}: Speaker="${isNarrator ? "Narrator" : scene.speaker}" | Voice="${voice}" | Text="${spokenText.slice(0, 40)}..."`);

    const mp3Response = await openai.audio.speech.create({
      model: "tts-1-hd",
      voice,
      input: spokenText.replace(/^["']|["']$/g, ""),
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
    const isNarrator = !scene.speaker || scene.speaker.toLowerCase() === "narrator" || scene.type === "b_roll";
    job.stage = `Rendering scene ${i + 1}/${script.scenes.length} [${isNarrator ? "World B-Roll" : `Character: ${scene.speaker}`}]...`;
    job.progress = 55 + Math.round((i / script.scenes.length) * 20); // 55% to 75%

    const imgPath = path.join(jobDir, `scene_${i}_visual.png`);
    const vidPath = path.join(jobDir, `scene_${i}_video.mp4`);

    try {
      const isPhotoreal = activeCharacters.some(c => ["photoreal_human", "hollywood_cinema", "indian_cinema", "documentary_realism"].includes(c.archetype)) || payload.visualStyle === "photoreal_human";
      const aspectDesc = isWidescreen ? "16:9 widescreen YouTube format" : "vertical 9:16 smartphone format";

      let prompt = "";
      if (isNarrator) {
        if (visualEngine === "pixar_3d") {
          prompt = `High-end 3D Pixar Disney CGI animated scene. ${scene.visualDescription}. Colorful studio lighting, dynamic cinematic atmosphere, 8k render, masterpiece.`;
        } else if (visualEngine === "anime_2d") {
          prompt = `Vibrant 2D anime widescreen film scene. ${scene.visualDescription}. Studio Ghibli and Makoto Shinkai style, dynamic cinematic motion, masterpiece.`;
        } else {
          prompt = `Cinematic ${aspectDesc} 35mm Hollywood action film still photograph. ${scene.visualDescription}. Atmospheric wide angle cinematic shot, environmental lighting, fluid depth of field, Arri Alexa Mini LF, 8k resolution, masterpiece.`;
        }
      } else {
        const speakingChar = activeCharacters.find(c => c.name.toLowerCase() === (scene.speaker || "").toLowerCase()) || activeCharacters[0];
        const isFemale = speakingChar.gender === "female";
        const charGender = isFemale ? "woman" : "man";

        if (visualEngine === "pixar_3d") {
          prompt = `High-end 3D Pixar Disney CGI animation film still. Medium close-up portrait of ${speakingChar.name}, a charismatic ${charGender} (${speakingChar.traits || "expressive animated character"}). Big expressive clear reflective eyes, open detailed eyelids, natural animated mouth speaking, vibrant subsurface scattering skin, colorful studio CGI lighting, setting: ${scene.visualDescription}, 8k render, masterpiece.`;
        } else if (visualEngine === "anime_2d") {
          prompt = `Studio Ghibli and Makoto Shinkai 2D anime key visual film still. Medium close-up portrait of ${speakingChar.name}, a ${charGender} (${speakingChar.traits || "expressive anime character"}). Crisp detailed anime eyes with reflections, clean linework, vibrant cinematic lighting, expressive mouth delivering dialogue, setting: ${scene.visualDescription}, masterpiece.`;
        } else {
          // Photorealistic human (cinema realism)
          prompt = `Cinematic 35mm film photograph. Medium close-up portrait of ${speakingChar.name}, an authentic photorealistic ${charGender} (${speakingChar.traits || "striking expressive actor"}). Crisp sharp open eyes with clear pupils and defined irises, natural eyelids, authentic emotional facial expression delivering dialogue, natural human skin texture with subtle pores, no deformities. 85mm prime portrait lens f/1.8, shallow depth of field with soft bokeh background. Setting: ${scene.visualDescription}. Arri Alexa Mini LF 8k, master lighting, photorealistic masterpiece.`;
        }
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

      // Check Scene Type & Animation Mode
      const isDialogueScene = (storyStyle === "movie_dialogue") || ((scene.type === "dialogue") && !isNarrator);

      // 1. DIALOGUE LIP-SYNC: Whenever a character speaks dialogue, run GPU Lip-Sync with GFPGAN enhancer!
      // This ensures characters visibly speak, move lips and eyes in sync with voiceover!
      if (isDialogueScene || animationStyle === "live_talking_head" || animationStyle === "hybrid_lip_sync" || animationStyle === "lip_sync_dialogue") {
        if (isDialogueScene) {
          job.stage = `Lip-syncing character dialogue for ${scene.speaker} (${i + 1}/${script.scenes.length})...`;
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
            log(job.id, `Lip-sync fallback for dialogue scene ${i}: ${lipErr.message}`);
          }
        } else {
          // B-Roll / Action Scene: Generate cinematic world video with moving cars, city, nature
          job.stage = `Generating cinematic action B-roll video (${i + 1}/${script.scenes.length})...`;
          try {
            let brollVideoUrl;
            try {
              const imgPublicUrl = await uploadPublicFile(imgPath, `frame_${job.id}_${i}.png`, "image/png");
              brollVideoUrl = await generateMinimaxVideo({
                prompt: scene.visualDescription,
                firstFrameUrl: imgPublicUrl,
                isWidescreen,
                jobId: job.id,
              });
            } catch (mmErr) {
              log(job.id, `Minimax fallback to Wan 2.1: ${mmErr.message}`);
              try {
                brollVideoUrl = await generateWanVideo({
                  prompt: scene.visualDescription,
                  isWidescreen,
                  jobId: job.id,
                });
              } catch (wanErr) {
                log(job.id, `Wan fallback to AnimateDiff: ${wanErr.message}`);
                brollVideoUrl = await generateGenerativeClip({
                  prompt: scene.visualDescription,
                  isWidescreen,
                  jobId: job.id,
                });
              }
            }

            if (brollVideoUrl) {
              const fetchVid = await fetch(brollVideoUrl);
              if (fetchVid.ok) {
                fs.writeFileSync(vidPath, Buffer.from(await fetchVid.arrayBuffer()));
                sceneVisuals.push({ type: "video", path: vidPath });
                continue;
              }
            }
          } catch (brollErr) {
            log(job.id, `B-roll video fallback for scene ${i}: ${brollErr.message}`);
          }
        }
      }

      // 2. Generative AI Video (when pure generative action video is selected and not handled above):
      if (!isDialogueScene && (animationStyle === "generative_video" || animationStyle === "cinematic_world_video")) {
        job.stage = `Generating cinematic AI video (${i + 1}/${script.scenes.length})...`;
        try {
          let genVideoUrl;
          try {
            const imgPublicUrl = await uploadPublicFile(imgPath, `frame_${job.id}_${i}.png`, "image/png");
            genVideoUrl = await generateMinimaxVideo({
              prompt: scene.visualDescription,
              firstFrameUrl: imgPublicUrl,
              isWidescreen,
              jobId: job.id,
            });
          } catch (mmErr) {
            log(job.id, `Minimax fallback to Wan 2.1: ${mmErr.message}`);
            try {
              genVideoUrl = await generateWanVideo({
                prompt: scene.visualDescription,
                isWidescreen,
                jobId: job.id,
              });
            } catch (wanErr) {
              log(job.id, `Wan fallback to AnimateDiff: ${wanErr.message}`);
              genVideoUrl = await generateGenerativeClip({
                prompt: scene.visualDescription,
                isWidescreen,
                jobId: job.id,
              });
            }
          }

          if (genVideoUrl) {
            const fetchVid = await fetch(genVideoUrl);
            if (fetchVid.ok) {
              fs.writeFileSync(vidPath, Buffer.from(await fetchVid.arrayBuffer()));
              sceneVisuals.push({ type: "video", path: vidPath });
              continue;
            }
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
  const { payload } = job;
  const {
    topic = "Viral Social Reel",
    customScript = "",
    scriptMode = "ai_prompt", // "ai_prompt" | "product_promo" | "custom_script"
    brandName = "",
    serviceToPromote = "",
    specialOffer = "",
    promoAngle = "founder_pitch", // "founder_pitch" | "customer_owner_skit" | "direct_response"
    promoCTA = "Click the link in bio",
    websiteUrl = "",
    selectedStyle = "talking_avatar", // "talking_avatar" | "generative_cinematic" | "motion_broll"
    language = "hindi",
    voice = "alloy",
    niche = "business",
    backgroundBeat = "upbeat_lofi",
    durationSeconds = 15,
  } = payload;

  const targetSecs = Math.max(10, Math.min(60, Number(durationSeconds) || 15));
  const isWidescreen = false;

  job.progress = 10;
  job.stage = `Generating ~${targetSecs}s viral reel script...`;
  log(job.id, `Starting dedicated fast Reel pipeline (${targetSecs}s) [Style: ${selectedStyle}, Lang: ${language}, Mode: ${scriptMode}]`);

  const hasCustomScript = !!(customScript && customScript.trim());
  let reelScript = null;

  if (hasCustomScript) {
    log(job.id, `Using user-provided custom script for reel (${customScript.length} chars)`);
    const lines = customScript.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const numScenes = Math.min(3, Math.max(1, lines.length));
    const secPerScene = Math.round((targetSecs / numScenes) * 10) / 10;

    reelScript = {
      title: topic || (brandName ? `${brandName} Promo` : "Custom Reel Masterpiece"),
      fullScript: customScript,
      scenes: lines.slice(0, 3).map((line, idx) => ({
        sceneNumber: idx + 1,
        text: line,
        spokenAudio: line,
        visualPrompt: `Vertical 9:16 cinematic portrait or action shot. Dynamic visual representing: ${line.slice(0, 100)}. Cinematic lighting, photorealistic 8k, masterpiece`,
        duration: secPerScene,
      }))
    };
  } else if (scriptMode === "product_promo") {
    log(job.id, `Generating Commercial Promotional Reel for Brand: "${brandName}", Service: "${serviceToPromote}", Offer: "${specialOffer}", Angle: "${promoAngle}"`);
    let langRule = "Language: American English. Dynamic, high-converting commercial direct response tone.";
    if (language === "hindi") {
      langRule = "Language: Hindi. CRITICAL: Spoken text in 'spokenAudio' MUST be written in natural, conversational Devanagari script (हिंदी) with authentic colloquial vocabulary so OpenAI TTS speaks with natural Indian pronunciation without American accent!";
    } else if (language === "en_uk") {
      langRule = "Language: British English. Refined, eloquent British cadence and vocabulary (e.g., bespoke, whilst, enquire, complimentary). Absolutely NO American slang.";
    }

    let angleRule = "";
    if (promoAngle === "customer_owner_skit") {
      angleRule = `PROMOTIONAL ANGLE: Customer & Owner Conversation (2-Character Skit)
- Scene 1 (Customer Problem): The customer complains about a real frustration or problem.
- Scene 2 (Owner Solution): The business owner introduces "${brandName || "our brand"}" and how "${serviceToPromote || "our signature service"}" solves it effortlessly.
- Scene 3 (Urgency Offer & CTA): The owner announces the special deal: "${specialOffer || "exclusive promotion"}" and CTA: "${promoCTA}".`;
    } else if (promoAngle === "founder_pitch") {
      angleRule = `PROMOTIONAL ANGLE: Excited Founder / Owner Direct Pitch
- The charismatic business owner speaks directly to camera with high passion.
- Scene 1: Hook calling out the customer's costly mistake or problem.
- Scene 2: The breakthrough: Introduces "${brandName || "our company"}" and how "${serviceToPromote || "our service"}" transforms results.
- Scene 3: Unbeatable offer: "${specialOffer || "limited-time offer"}" + Urgency CTA: "${promoCTA}".`;
    } else {
      angleRule = `PROMOTIONAL ANGLE: High-Converting Direct Response Commercial Ad
- Scene 1: Pattern interrupt hook targeting the prospect's immediate pain.
- Scene 2: Clear value: Why "${brandName || "our team"}" delivers 10x better results with "${serviceToPromote || "our solution"}".
- Scene 3: Scarcity deal: "${specialOffer || "special deal"}" + Action CTA: "${promoCTA}".`;
    }

    const promoPrompt = `You are an elite commercial video director creating a high-converting ${targetSecs}-second vertical promo ad for Instagram Reels, TikTok, and YouTube Shorts.
Brand Name: "${brandName || "Our Brand"}"
Product / Service: "${serviceToPromote || "Premium Services"}"
Special Offer: "${specialOffer || "Exclusive Limited-Time Deal"}"
Call to Action: "${promoCTA}"
${langRule}
${angleRule}

Requirements:
- Exactly 3 sequential scenes totaling ~${targetSecs} seconds:
  1. Scene 1 (Hook / Problem, 0-5s)
  2. Scene 2 (Solution & Brand Name, 5-10s) - MUST speak brand name "${brandName || "Our Brand"}"
  3. Scene 3 (Offer & CTA, 10-15s) - MUST announce offer "${specialOffer}" and CTA "${promoCTA}"
- Total spoken words: between 30 and 45 words total (natural speaking pace).
- Return ONLY valid JSON:
{
  "title": "${brandName || "Special"} Promo Reel",
  "fullScript": "Complete voiceover text",
  "scenes": [
    {
      "sceneNumber": 1,
      "text": "Spoken line for scene 1",
      "spokenAudio": "Exact spoken line in Devanagari Hindi if Hindi",
      "visualPrompt": "Vertical 9:16 cinematic portrait of speaker looking into camera, professional studio lighting",
      "searchQuery": "business product advertisement"
    },
    {
      "sceneNumber": 2,
      "text": "Spoken line for scene 2",
      "spokenAudio": "Exact spoken line in Devanagari Hindi if Hindi",
      "visualPrompt": "Vertical 9:16 cinematic close-up of speaker confidently explaining solution",
      "searchQuery": "entrepreneur presentation"
    },
    {
      "sceneNumber": 3,
      "text": "Spoken line for scene 3",
      "spokenAudio": "Exact spoken line in Devanagari Hindi if Hindi",
      "visualPrompt": "Vertical 9:16 cinematic portrait of speaker smiling with compelling gesture",
      "searchQuery": "special offer announcement"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: promoPrompt }],
    });
    reelScript = JSON.parse(completion.choices[0].message.content);
  } else {
    let langRule = "Language: American English. Dynamic, viral short-form social media tone.";
    if (language === "hindi") {
      langRule = "Language: Hindi. CRITICAL: Spoken text in 'spokenAudio' MUST be written in natural, conversational Devanagari script (हिंदी) with authentic colloquial vocabulary so OpenAI TTS speaks with natural Indian pronunciation without American accent!";
    } else if (language === "en_uk") {
      langRule = "Language: British English. Refined, eloquent British cadence and vocabulary (e.g. bespoke, whilst, enquire, complimentary). Absolutely NO American slang.";
    }

    const scriptPrompt = `You are a viral social media director creating a ${targetSecs}-second vertical video reel for Instagram Reels, YouTube Shorts, and TikTok.
Topic: "${topic}"
Niche: "${niche}"
${langRule}

Requirements:
- Exactly 3 sequential scenes totaling ~${targetSecs} seconds:
  1. Scene 1 (Hook, 0-5s): Irresistible hook or curiosity trigger.
  2. Scene 2 (Value, 5-10s): The breakthrough insight or secret.
  3. Scene 3 (CTA, 10-15s): Punchy call to action.
- Total spoken words: between 30 and 45 words total (natural speaking pace).
- Return ONLY valid JSON:
{
  "title": "Short catchy title",
  "fullScript": "Complete voiceover text",
  "scenes": [
    {
      "sceneNumber": 1,
      "text": "Spoken line for scene 1",
      "spokenAudio": "Exact spoken line in Devanagari Hindi if Hindi",
      "visualPrompt": "Detailed visual description of the speaker or cinematic action scene in vertical 9:16 framing",
      "searchQuery": "english stock video search keywords"
    },
    {
      "sceneNumber": 2,
      "text": "Spoken line for scene 2",
      "spokenAudio": "Exact spoken line in Devanagari Hindi if Hindi",
      "visualPrompt": "Detailed visual description of scene 2 in vertical 9:16 framing",
      "searchQuery": "english stock video search keywords"
    },
    {
      "sceneNumber": 3,
      "text": "Spoken line for scene 3",
      "spokenAudio": "Exact spoken line in Devanagari Hindi if Hindi",
      "visualPrompt": "Detailed visual description of scene 3 in vertical 9:16 framing",
      "searchQuery": "english stock video search keywords"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: scriptPrompt }],
    });
    reelScript = JSON.parse(completion.choices[0].message.content);
  }

  job.progress = 25;
  job.stage = "Synthesizing studio voiceover audio with tts-1-hd...";
  log(job.id, `Synthesizing audio with voice: ${voice} (Lang: ${language})`);

  let ttsVoice = voice || (language === "en_uk" ? "fable" : "alloy");
  if (language === "en_uk" && ttsVoice.toLowerCase() === "alloy") {
    ttsVoice = "fable";
  } else if (language === "hindi" && !["alloy", "nova", "onyx", "shimmer"].includes(ttsVoice.toLowerCase())) {
    ttsVoice = "alloy";
  }

  const fullSpokenText = reelScript.scenes.map(s => s.spokenAudio || s.text).join(" ");
  const mp3Response = await openai.audio.speech.create({
    model: "tts-1-hd",
    voice: ttsVoice,
    input: fullSpokenText.replace(/^["']|["']$/g, ""),
    response_format: "mp3",
  });

  const fullAudioBuf = Buffer.from(await mp3Response.arrayBuffer());
  const reelAudioPath = path.join(jobDir, "reel_voiceover.mp3");
  fs.writeFileSync(reelAudioPath, fullAudioBuf);

  // Check visual style
  job.progress = 45;
  const sceneVisuals = [];

  if (selectedStyle === "talking_avatar") {
    // TRUE LIP-SYNC TALKING AVATAR (SadTalker + GFPGAN Face Enhancer)
    job.stage = "Rendering photorealistic character portrait & GPU lip-sync...";
    log(job.id, `Generating talking avatar lip-sync with SadTalker...`);

    const charImgPath = path.join(jobDir, "avatar_character.png");
    const charVidPath = path.join(jobDir, "avatar_talking.mp4");

    const avatarPrompt = `Cinematic 35mm photograph. Medium close-up portrait of an authentic, charismatic ${niche} spokesperson looking directly into camera with expressive sharp eyes, clear defined pupils and irises, natural friendly smile, high-end studio lighting, natural human skin texture with subtle pores, 85mm portrait lens f/1.8, shallow depth of field, 8k resolution, masterpiece.`;

    let imgGen;
    try {
      imgGen = await openai.images.generate({
        model: "gpt-image-2",
        prompt: avatarPrompt.slice(0, 950),
        n: 1,
        size: "1024x1024",
      });
    } catch {
      imgGen = await openai.images.generate({
        model: "dall-e-3",
        prompt: avatarPrompt.slice(0, 950),
        n: 1,
        size: "1024x1792",
      });
    }

    if (imgGen.data?.[0]?.b64_json) {
      fs.writeFileSync(charImgPath, Buffer.from(imgGen.data[0].b64_json, "base64"));
    } else if (imgGen.data?.[0]?.url) {
      const fetchRes = await fetch(imgGen.data[0].url);
      fs.writeFileSync(charImgPath, Buffer.from(await fetchRes.arrayBuffer()));
    }

    // Run SadTalker GPU Lip-Sync with GFPGAN
    try {
      job.stage = "Generating AI lip-sync on Replicate GPU (SadTalker + GFPGAN)...";
      const audioPubUrl = await uploadPublicFile(reelAudioPath, `audio_${job.id}.mp3`, "audio/mpeg");
      const imgPubUrl = await uploadPublicFile(charImgPath, `avatar_${job.id}.png`, "image/png");

      const talkingVidUrl = await generateSadTalkerLipSync({
        imageUrl: imgPubUrl,
        audioUrl: audioPubUrl,
        jobId: job.id,
      });

      const fetchVid = await fetch(talkingVidUrl);
      if (fetchVid.ok) {
        fs.writeFileSync(charVidPath, Buffer.from(await fetchVid.arrayBuffer()));
        sceneVisuals.push({ type: "video", path: charVidPath });
      } else {
        sceneVisuals.push({ type: "image", path: charImgPath });
      }
    } catch (sTalkErr) {
      log(job.id, `SadTalker fallback: ${sTalkErr.message}`);
      sceneVisuals.push({ type: "image", path: charImgPath });
    }

  } else if (selectedStyle === "generative_cinematic") {
    // GENERATIVE CINEMATIC AI VIDEO
    job.stage = "Generating cinematic generative AI visuals...";
    log(job.id, `Generating cinematic scenes for reel...`);

    for (let i = 0; i < reelScript.scenes.length; i++) {
      const sc = reelScript.scenes[i];
      const scImgPath = path.join(jobDir, `reel_sc_${i}.png`);
      const scVidPath = path.join(jobDir, `reel_sc_${i}.mp4`);

      try {
        const scPrompt = `Cinematic 9:16 vertical smartphone frame. ${sc.visualPrompt || sc.text}. 35mm movie photography, volumetric lighting, Arri Alexa Mini LF, photorealistic 8k, masterpiece.`;
        const imgRes = await openai.images.generate({
          model: "gpt-image-2",
          prompt: scPrompt.slice(0, 950),
          n: 1,
          size: "1024x1024",
        }).catch(async () => {
          return openai.images.generate({
            model: "dall-e-3",
            prompt: scPrompt.slice(0, 950),
            n: 1,
            size: "1024x1792",
          });
        });

        if (imgRes.data?.[0]?.b64_json) {
          fs.writeFileSync(scImgPath, Buffer.from(imgRes.data[0].b64_json, "base64"));
        } else if (imgRes.data?.[0]?.url) {
          const fetchRes = await fetch(imgRes.data[0].url);
          fs.writeFileSync(scImgPath, Buffer.from(await fetchRes.arrayBuffer()));
        }

        // Fast video motion via Wan 2.1 or AnimateDiff (scene 1)
        if (i === 0) {
          job.stage = "Generating fast neural video motion (Wan 2.1)...";
          try {
            const vidUrl = await generateWanVideo({
              prompt: sc.visualPrompt || sc.text,
              isWidescreen: false,
              jobId: job.id,
            }).catch(() => generateGenerativeClip({
              prompt: sc.visualPrompt || sc.text,
              isWidescreen: false,
              jobId: job.id,
            }));

            if (vidUrl) {
              const fVid = await fetch(vidUrl);
              if (fVid.ok) {
                fs.writeFileSync(scVidPath, Buffer.from(await fVid.arrayBuffer()));
                sceneVisuals.push({ type: "video", path: scVidPath });
                continue;
              }
            }
          } catch (vErr) {
            log(job.id, `Reel video fallback: ${vErr.message}`);
          }
        }

        sceneVisuals.push({ type: "image", path: scImgPath });
      } catch (e) {
        log(job.id, `Reel scene ${i} fallback: ${e.message}`);
        await createFallbackImage(scImgPath, 1080, 1920, sc.text || "Scene");
        sceneVisuals.push({ type: "image", path: scImgPath });
      }
    }
  } else {
    // MOTION B-ROLL (Pexels Vertical 4K HD Clips)
    job.stage = "Fetching vertical 9:16 cinematography matching script...";
    log(job.id, `Fetching Pexels vertical video clips...`);

    const pexelsKey = process.env.PEXELS_API_KEY;
    for (let i = 0; i < reelScript.scenes.length; i++) {
      const sc = reelScript.scenes[i];
      const scVidPath = path.join(jobDir, `pexels_sc_${i}.mp4`);
      let fetched = false;

      if (pexelsKey) {
        try {
          const q = encodeURIComponent(sc.searchQuery || topic || "luxury lifestyle business");
          const pexRes = await fetch(`https://api.pexels.com/videos/search?query=${q}&orientation=portrait&per_page=3&size=medium`, {
            headers: { Authorization: pexelsKey },
          });
          const pexData = await pexRes.json();
          const pexFiles = pexData.videos?.[0]?.video_files || [];
          const bestFile = pexFiles.find(f => f.height > f.width && f.file_type === "video/mp4") || pexFiles[0];

          if (bestFile?.link) {
            const dl = await fetch(bestFile.link);
            if (dl.ok) {
              fs.writeFileSync(scVidPath, Buffer.from(await dl.arrayBuffer()));
              sceneVisuals.push({ type: "video", path: scVidPath });
              fetched = true;
            }
          }
        } catch (pErr) {
          log(job.id, `Pexels query error: ${pErr.message}`);
        }
      }

      if (!fetched) {
        const fallbackImg = path.join(jobDir, `fallback_sc_${i}.png`);
        await createFallbackImage(fallbackImg, 1080, 1920, sc.text || "Scene");
        sceneVisuals.push({ type: "image", path: fallbackImg });
      }
    }
  }

  // FFmpeg Assembly
  job.progress = 80;
  job.stage = "Assembling master 9:16 reel with FFmpeg...";
  log(job.id, "Assembling master reel with FFmpeg...");

  const masterVideoPath = path.join(jobDir, "master_reel_output.mp4");
  await assembleFFmpegVideo({
    jobDir,
    scenes: reelScript.scenes,
    audioFiles: [reelAudioPath],
    visuals: sceneVisuals,
    outputPath: masterVideoPath,
    isWidescreen: false,
    targetDurationSecs: targetSecs,
    onProgress: (p) => {
      job.progress = 80 + Math.round(p * 15);
    },
  });

  // Upload Finished Reel
  job.progress = 95;
  job.stage = "Uploading master reel...";
  const finalFilename = `master_reel_${Date.now()}.mp4`;
  const uploadedUrl = await uploadMasterVideo(masterVideoPath, finalFilename, job.userEmail);
  job.videoUrl = uploadedUrl;
  job.metadata = { title: reelScript.title || topic };
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
      const audioDurationSecs = Math.max(5, Math.round(stats.size / 16000));
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
          // CRITICAL: Loop clip with -stream_loop -1 -t so it fills durationPerScene!
          const scaleCropVf = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
          const args = [
            "-y",
            "-stream_loop", "-1",
            "-t", `${durationPerScene}`,
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

        // Exact runtime guarantee:
        const totalVideoRuntime = Math.max(targetDurationSecs, Math.round(visuals.length * durationPerScene));

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
          "-t", `${totalVideoRuntime}`,
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
