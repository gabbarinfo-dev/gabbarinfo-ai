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
const { runShopifyAutopilotCycle, generateShopifyArticleOnDemand } = require("./lib/shopify-autopilot");
const { generateStudioSpeech } = require("./lib/elevenlabs-service");
const { generateSyncLabsLipSync } = require("./lib/synclabs-service");
const {
  generateAdGraphic,
  uploadImageToMeta,
  executeMetaCampaign,
  executeFullMetaCampaign,
} = require("./lib/meta-campaign-service");

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
app.get(["/jobs/status/:jobId", "/meta/jobs/status/:jobId"], requireAuth, (req, res) => {
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
    campaignName: job.campaignName || job.result?.campaignName || null,
    videoUrl: job.videoUrl || null,
    result: job.result || null,
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
// Precision Lip-Sync Engines (Sync Labs v2 Flagship + Replicate Fallback)
// -------------------------------------------------------------
async function generatePrecisionLipSync({ imageUrl, videoUrl, audioUrl, jobId }) {
  const targetMediaUrl = videoUrl || imageUrl;

  // 1. Primary: Sync Labs v2 Precision Lip-Sync (sync-3 -> lipsync-2-pro -> lipsync-2)
  if (process.env.SYNC_LABS_API_KEY && targetMediaUrl && audioUrl) {
    try {
      log(jobId, `Attempting precision lip-sync via Sync Labs (sync-3)...`);
      const syncRes = await generateSyncLabsLipSync({
        videoUrl: targetMediaUrl,
        audioUrl,
        model: "sync-3",
        jobId,
        log,
      });

      if (syncRes.ok && syncRes.videoUrl) {
        log(jobId, `Sync Labs precision lip-sync succeeded: ${syncRes.videoUrl}`);
        return syncRes.videoUrl;
      }
      log(jobId, `Sync Labs returned note: ${syncRes.error || "Falling back to secondary engine"}`);
    } catch (syncErr) {
      log(jobId, `Sync Labs exception: ${syncErr.message}, falling back to Replicate...`);
    }
  }

  // 2. Secondary Fallback: Replicate GPU SadTalker
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("Missing both SYNC_LABS_API_KEY and REPLICATE_API_TOKEN in environment variables");

  log(jobId, `Dispatching fallback SadTalker GPU lip-sync prediction to Replicate (preprocess: full)...`);
  const prediction = await callReplicateWithRetry(
    "https://api.replicate.com/v1/predictions",
    {
      version: "a519cc0cfebaaeade068b23899165a11ec76aaa1d2b313d40d214f204ec957a3",
      input: {
        source_image: imageUrl || targetMediaUrl,
        driven_audio: audioUrl,
        still: false,
        use_enhancer: true,
        enhancer: "gfpgan",
        preprocess: "full",
        expression_scale: 1.25,
      },
    },
    token,
    jobId
  );
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
  throw new Error("Lip-sync prediction timed out after 240s");
}

// Resilient Replicate caller with automatic 429 rate-limit backoff
async function callReplicateWithRetry(url, payload, token, jobId, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 429) {
      let waitSec = 12;
      try {
        const body = await res.json();
        if (body.retry_after) waitSec = Math.max(10, Number(body.retry_after) + 2);
      } catch (_) {}
      log(jobId, `Replicate rate limited (429). Cooling down for ${waitSec}s before attempt ${attempt + 1}/${maxRetries}...`);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Replicate API error (${res.status}): ${errText}`);
    }

    return await res.json();
  }
  throw new Error(`Replicate call exceeded max rate-limit retries (${maxRetries})`);
}

// Backward-compatibility alias
const generateSadTalkerLipSync = generatePrecisionLipSync;

async function generateGenerativeClip({ prompt, isWidescreen, jobId }) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("Missing REPLICATE_API_TOKEN in environment variables");

  log(jobId, `Dispatching Generative AI Video prediction to Replicate (AnimateDiff)...`);
  const aspectDesc = isWidescreen ? "16:9 widescreen cinematic landscape" : "9:16 vertical smartphone format";
  const cleanPrompt = `${prompt}, ${aspectDesc}, cinematic lighting, photorealistic 8k, physical character motion, fluid movement, no text, no watermark, masterpiece`;

  const prediction = await callReplicateWithRetry(
    "https://api.replicate.com/v1/predictions",
    {
      version: "beecf59c4aee8d81bf04f0381033dfa10dc16e845b4ae00d281e2fa377e48a9f",
      input: {
        prompt: cleanPrompt,
        n_prompt: "bad quality, blurry, distorted, static, low resolution, text, typography, watermark, logo, poster",
        steps: 25,
        guidance_scale: 7.5,
      },
    },
    token,
    jobId
  );
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
  const cleanPrompt = `${prompt}, ${aspectDesc}, cinematic lighting, photorealistic 8k, fluid physical motion, moving elements, no text, no watermark, masterpiece`;

  const inputPayload = {
    prompt: cleanPrompt,
    prompt_optimizer: true,
  };
  if (firstFrameUrl) {
    inputPayload.first_frame_image = firstFrameUrl;
  }

  const prediction = await callReplicateWithRetry(
    "https://api.replicate.com/v1/models/minimax/video-01/predictions",
    { input: inputPayload },
    token,
    jobId
  );
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

  const prediction = await callReplicateWithRetry(
    "https://api.replicate.com/v1/models/wan-video/wan-2.1-1.3b/predictions",
    {
      input: {
        prompt: `${prompt}, cinematic lighting, photorealistic 8k, fluid motion, atmospheric depth, no text, no watermark`,
        aspect_ratio: aspectDesc,
      },
    },
    token,
    jobId
  );
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

  if (payload.elevenLabsApiKey) process.env.ELEVENLABS_API_KEY = payload.elevenLabsApiKey;
  if (payload.syncLabsApiKey) process.env.SYNC_LABS_API_KEY = payload.syncLabsApiKey;
  if (payload.openAiApiKey) process.env.OPENAI_API_KEY = payload.openAiApiKey;

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
  job.metadata = { title: script.title, youtubeTitle: script.youtubeTitle, description: script.description, scenes: script.scenes };

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
  // Honor user-assigned character voices! Only auto-assign if missing or colliding.
  const maleVoiceList = ["onyx", "echo", "ash", "alloy"];
  const femaleVoiceList = ["shimmer", "nova", "coral"];
  const usedVoices = new Set();

  activeCharacters.forEach((c, idx) => {
    const isFemale = c.gender === "female" || /\b(woman|girl|lady|female|queen|mother|sister|she|her)\b/i.test(`${c.name} ${c.traits}`);
    c.gender = isFemale ? "female" : "male";
    const voiceList = isFemale ? femaleVoiceList : maleVoiceList;

    let chosenVoice = (c.voice || "").toLowerCase().trim();
    if (!chosenVoice || usedVoices.has(chosenVoice) || !["onyx", "echo", "ash", "alloy", "shimmer", "nova", "coral", "fable", "sage"].includes(chosenVoice)) {
      chosenVoice = voiceList.find(v => !usedVoices.has(v)) || voiceList[idx % voiceList.length];
    }
    c.voice = chosenVoice;
    usedVoices.add(chosenVoice);
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

    const charGender = isNarrator ? "male" : ((voice === "shimmer" || voice === "nova") ? "female" : "male");
    const speechResult = await generateStudioSpeech({
      text: spokenText.replace(/^["']|["']$/g, ""),
      language: language || "hindi",
      gender: charGender,
      voiceId: voice,
      openai,
      apiKey: process.env.ELEVENLABS_API_KEY,
    });

    if (!speechResult.ok || !speechResult.buffer) {
      throw new Error(speechResult.error || "Failed to synthesize character speech audio.");
    }

    const audioBuf = speechResult.buffer;
    const audioPath = path.join(jobDir, `scene_${i}_audio.mp3`);
    fs.writeFileSync(audioPath, audioBuf);
    audioFiles.push(audioPath);
  }

  // Step 3: Visual & GPU Video Generation
  job.progress = 55;
  job.stage = `Generating visual scenes [Mode: ${animationStyle}]...`;
  log(job.id, `Rendering visuals for ${script.scenes.length} scenes (engine: ${animationStyle})...`);

  const sceneVisuals = [];
  const charFaceCache = {};
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
      let hasExistingFace = false;
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

        // Check character face cache to ensure 100% consistent facial identity across all scenes!
        if (charFaceCache[speakingChar.name]) {
          fs.writeFileSync(imgPath, charFaceCache[speakingChar.name]);
          hasExistingFace = true;
          log(job.id, `Reusing locked face portrait for Character "${speakingChar.name}" in Scene ${i + 1}`);
        } else {
          if (visualEngine === "pixar_3d") {
            prompt = `High-end 3D Pixar Disney CGI animation film still. Medium close-up portrait of ${speakingChar.name}, a charismatic ${charGender} (${speakingChar.traits || "expressive animated character"}). Big expressive clear reflective eyes, open detailed eyelids, natural animated mouth speaking, vibrant subsurface scattering skin, colorful studio CGI lighting, setting: ${scene.visualDescription}, 8k render, masterpiece.`;
          } else if (visualEngine === "anime_2d") {
            prompt = `Studio Ghibli and Makoto Shinkai 2D anime key visual film still. Medium close-up portrait of ${speakingChar.name}, a ${charGender} (${speakingChar.traits || "expressive anime character"}). Crisp detailed anime eyes with reflections, clean linework, vibrant cinematic lighting, expressive mouth delivering dialogue, setting: ${scene.visualDescription}, masterpiece.`;
          } else {
            // Photorealistic human (cinema realism)
            prompt = `Cinematic 35mm film photograph. Medium close-up portrait of ${speakingChar.name}, an authentic photorealistic ${charGender} (${speakingChar.traits || "striking expressive actor"}). Crisp sharp open eyes with clear pupils and defined irises, natural eyelids, authentic emotional facial expression delivering dialogue, natural human skin texture with subtle pores, no deformities. 85mm prime portrait lens f/1.8, shallow depth of field with soft bokeh background. Setting: ${scene.visualDescription}. Arri Alexa Mini LF 8k, master lighting, photorealistic masterpiece.`;
          }
        }
      }

      if (!hasExistingFace) {
        let imgGen = null;
        const sceneImageModels = ["gpt-image-2", "gpt-image-2-2026-04-21", "gpt-image-1.5"];
        for (const m of sceneImageModels) {
          try {
            imgGen = await openai.images.generate({
              model: m,
              prompt: prompt.slice(0, 950),
              n: 1,
              size: "1024x1024",
            });
            if (imgGen?.data?.[0]?.b64_json || imgGen?.data?.[0]?.url) break;
          } catch (e) {
            console.warn(`[VideoWorker] Scene image generation with ${m} failed:`, e.message);
          }
        }

        let imgBuf = null;
        if (imgGen?.data?.[0]?.b64_json) {
          imgBuf = Buffer.from(imgGen.data[0].b64_json, "base64");
        } else if (imgGen?.data?.[0]?.url) {
          const fetchRes = await fetch(imgGen.data[0].url);
          imgBuf = Buffer.from(await fetchRes.arrayBuffer());
        }

        if (imgBuf) {
          fs.writeFileSync(imgPath, imgBuf);
          if (!isNarrator) {
            const speakingChar = activeCharacters.find(c => c.name.toLowerCase() === (scene.speaker || "").toLowerCase()) || activeCharacters[0];
            charFaceCache[speakingChar.name] = imgBuf;
          }
        } else {
          log(job.id, `Image generation returned no data for scene ${i}, using fallback`);
          await createFallbackImage(imgPath, isWidescreen ? 1920 : 1080, isWidescreen ? 1080 : 1920, scene.speaker || "Scene");
        }
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
// Smart B-Roll & Visual Keyword Generator for Commercial Reels
// -------------------------------------------------------------
function getSmartBrollQuery(text = "", sceneIdx = 0, totalScenes = 4, niche = "", topic = "", candidateQuery = "") {
  if (candidateQuery && candidateQuery.trim()) {
    const cleanCand = candidateQuery
      .replace(/\b(gabbarinfo|gabbar|brand|company|app|system|software|assistant)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanCand.length >= 3 && !/^(scene|promo|reel|video|robot|rocket|space)/i.test(cleanCand)) {
      return cleanCand;
    }
  }

  const lower = (text + " " + topic + " " + niche).toLowerCase();

  // 1. Pain / Hook / Chaos / Burning money / Bad agencies
  if (
    sceneIdx === 0 ||
    /burning|waste|wasting|expensive|retainer|agencies|tools|fragmented|chaos|trap|trapped|struggling|exhausted|frustrated|problem|loss|spending|dollars|thousands|money|bleeding|juggling|sick of/i.test(lower)
  ) {
    const hookQueries = [
      "entrepreneur working laptop office",
      "busy modern office workspace",
      "creative agency team meeting",
      "business professional typing laptop",
      "modern corporate executive desk",
    ];
    return hookQueries[sceneIdx % hookQueries.length];
  }

  // 2. AI / Autonomous / Solution / Technology / Dashboard
  if (
    /ai|autonomous|self-driving|assistant|eliminat|breakthrough|all-in-one|solution|secret|mechanism|operating system|autopilot|smart/i.test(lower)
  ) {
    const aiQueries = [
      "data analytics screen laptop",
      "modern computer code screen",
      "high tech office workflow",
      "digital marketing dashboard computer",
      "technology team modern office",
    ];
    return aiQueries[sceneIdx % aiQueries.length];
  }

  // 3. Marketing / Growth / Ads / SEO / Campaigns / Traffic
  if (
    /google ads|meta|campaigns|seo|marketing|traffic|clicks|leads|sales|growth|results|scale|rankings|dual-visual|social media|analytics/i.test(lower)
  ) {
    const marketingQueries = [
      "digital marketing analytics screen",
      "social media advertising campaigns laptop",
      "business growth charts modern office",
      "online traffic analytics strategy",
      "data analytics dashboard graphs",
    ];
    return marketingQueries[sceneIdx % marketingQueries.length];
  }

  // 4. CTA / Offer / Success / Pricing / Access (NEVER space rockets!)
  const ctaQueries = [
    "confident business founder smiling modern office",
    "executive working on laptop modern studio",
    "business partnership handshake celebration",
    "happy entrepreneur celebrating success",
    "creative team applauding modern office",
  ];
  return ctaQueries[sceneIdx % ctaQueries.length];
}

function getSmartVisualPrompt(cleanText = "", speaker = "", sceneIdx = 0, totalScenes = 4, brandName = "", serviceToPromote = "") {
  const lowerSpeaker = (speaker || "").toLowerCase();
  const lowerText = (cleanText || "").toLowerCase();
  const noTextGuard = " Absolutely NO text, NO letters, NO words, NO subtitles, NO typography, NO watermark, NO logo, NO posters, NO banners, NO UI overlays, NO buttons. Pure photorealistic cinematic film scene.";

  // 1. Customer Scene (Scene 1 or 3 in Skit, or pain hook)
  if (lowerSpeaker.includes("customer") || lowerSpeaker.includes("client") || (sceneIdx === 0 && /sick|waste|wasting|expensive|struggl|frustrated|thousands|agencies|chaos/i.test(lowerText))) {
    return `Vertical 9:16 cinematic film scene. Medium close-up portrait of an authentic business professional client in a modern high-end office, sitting at a desk with an open laptop, looking at the screen with relatable frustration and stress, natural human skin texture, shallow depth of field, 85mm prime lens f/1.8, soft ambient office lighting, 8k resolution, photorealistic, masterpiece.${noTextGuard}`;
  }

  // 2. Founder / Owner Scene (Scene 2 or 4 in Skit, or solution pitch)
  if (lowerSpeaker.includes("founder") || lowerSpeaker.includes("owner") || (sceneIdx % 2 === 1)) {
    if (sceneIdx === totalScenes - 1 || /launch|pricing|check|call|claim|tap|link|subscribe/i.test(lowerText)) {
      return `Vertical 9:16 cinematic film scene. Confident charismatic business founder and executive for "${brandName || 'our brand'}" in a modern high-tech studio, smiling warmly directly at camera with professional welcoming gesture, sleek dual computer monitors in background, 85mm prime lens, master lighting, 8k photorealistic.${noTextGuard}`;
    }
    return `Vertical 9:16 cinematic film scene. Professional business founder for "${brandName || 'our brand'}" in a sleek glass office, standing before glowing computer monitors showing live digital marketing analytics and growth dashboards, looking knowledgeable and confident, 35mm cinema lens, 8k photorealistic.${noTextGuard}`;
  }

  // 3. Marketing & Ads Analytics
  if (/google ads|meta|campaigns|seo|marketing|traffic|analytics|leads/i.test(lowerText)) {
    return `Vertical 9:16 cinematic scene. Ultra-modern creative agency workspace with sleek computer screens displaying real-time digital advertising performance, campaign metrics, and growth graphs, cinematic atmospheric lighting, 8k resolution.${noTextGuard}`;
  }

  // 4. Autonomous AI / Software (NEVER mechanical toy robots!)
  if (/ai|autonomous|self-driving|assistant|eliminat|autopilot/i.test(lowerText)) {
    return `Vertical 9:16 cinematic scene. Modern minimalist tech office with high-end workstation displaying automated software workflows and clean digital interfaces, executive studio lighting, 8k resolution.${noTextGuard}`;
  }

  return `Vertical 9:16 cinematic commercial scene. Professional business workspace representing modern digital agency operations, 8k photorealistic, volumetric lighting, masterpiece.${noTextGuard}`;
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

  if (payload.elevenLabsApiKey) process.env.ELEVENLABS_API_KEY = payload.elevenLabsApiKey;
  if (payload.syncLabsApiKey) process.env.SYNC_LABS_API_KEY = payload.syncLabsApiKey;
  if (payload.openAiApiKey) process.env.OPENAI_API_KEY = payload.openAiApiKey;

  const targetSecs = Math.max(10, Math.min(60, Number(durationSeconds) || 15));
  const isWidescreen = false;

  job.progress = 10;
  job.stage = `Generating ~${targetSecs}s viral reel script...`;
  log(job.id, `Starting dedicated fast Reel pipeline (${targetSecs}s) [Style: ${selectedStyle}, Lang: ${language}, Mode: ${scriptMode}]`);

  const hasCustomScript = !!(customScript && customScript.trim());
  function sanitizeDialogue(str) {
    if (!str) return "";
    return str
      .replace(/^Scene\s*\d+\s*(?:\([^)]+\)|\[[^\]]+\])?\s*[:\-–—]?\s*/i, "")
      .replace(/^(?:\(?\s*(?:Customer|Client|Consumer|User|Owner|Founder|Agency|Director|Host|Speaker\s*\d*)\s*\)?)\s*[:\-–—]?\s*/i, "")
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
      .trim();
  }

  let reelScript = null;

  if (hasCustomScript) {
    log(job.id, `Using user-provided custom script for reel (${customScript.length} chars)`);
    const lines = customScript.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const numScenes = Math.min(8, Math.max(1, lines.length));
    const secPerScene = Math.round((targetSecs / numScenes) * 10) / 10;

    reelScript = {
      title: topic || (brandName ? `${brandName} Promo` : "Custom Reel Masterpiece"),
      fullScript: customScript,
      scenes: lines.slice(0, numScenes).map((line, idx) => {
        const clean = sanitizeDialogue(line) || line;
        const speaker = /customer|client/i.test(line) ? "customer" : (/founder|owner/i.test(line) ? "owner" : (idx % 2 === 0 ? "customer" : "owner"));
        return {
          sceneNumber: idx + 1,
          rawLine: line,
          speaker,
          text: clean,
          spokenAudio: clean,
          visualPrompt: `Vertical 9:16 cinematic portrait or action shot. Dynamic visual representing: ${clean.slice(0, 100)}. Cinematic lighting, photorealistic 8k, masterpiece`,
          searchQuery: getSmartBrollQuery(clean, idx, numScenes, niche, topic),
          duration: secPerScene,
        };
      })
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
- Scene 1 (Customer Problem): The customer complains about a real frustration, wasted money, or struggle with old methods.
- Scene 2 (Owner Solution): The business owner introduces "${brandName || "our brand"}" and how "${serviceToPromote || "our signature service"}" solves it effortlessly.
- Scene 3+ (Proof, Offer & CTA): The owner highlights key USPs, announces the special deal: "${specialOffer || "exclusive promotion"}" and CTA: "${promoCTA}".`;
    } else if (promoAngle === "founder_pitch") {
      angleRule = `PROMOTIONAL ANGLE: Excited Founder / Owner Direct Pitch
- The charismatic business owner speaks directly to camera with high passion and authority.
- Scene 1: Provocative hook calling out the customer's costly mistake or bloated industry traps.
- Scene 2: The breakthrough: Introduces "${brandName || "our company"}" and how "${serviceToPromote || "our service"}" transforms results.
- Scene 3+ (USPs, Offer & CTA): Key differentiators, unbeatable offer: "${specialOffer || "limited-time offer"}" + Urgency CTA: "${promoCTA}".`;
    } else {
      angleRule = `PROMOTIONAL ANGLE: High-Converting Direct Response Commercial Ad
- Scene 1: Pattern interrupt hook targeting the prospect's immediate pain and cost of inaction.
- Scene 2: Clear value: Why "${brandName || "our team"}" delivers 10x better results with "${serviceToPromote || "our solution"}".
- Scene 3+ (USPs, Offer & CTA): Specific capabilities, scarcity deal: "${specialOffer || "special deal"}" + Action CTA: "${promoCTA}".`;
    }

    let wordTarget = targetSecs <= 15 ? "between 38 and 48 spoken words total" : targetSecs <= 30 ? "between 75 and 95 spoken words total" : "between 140 and 175 spoken words total";
    let sceneCountReq = targetSecs <= 15 ? "3 to 4 sequential scenes" : targetSecs <= 30 ? "4 to 6 sequential scenes" : "6 to 8 sequential scenes";

    const promoPrompt = `You are an elite commercial video director creating a high-converting ${targetSecs}-second vertical promo ad for Instagram Reels, TikTok, and YouTube Shorts.
Brand Name: "${brandName || "Our Brand"}"
Product / Service: "${serviceToPromote || "Premium Services"}"
Special Offer: "${specialOffer || "Exclusive Limited-Time Deal"}"
Call to Action: "${promoCTA}"
${langRule}
${angleRule}

Requirements:
- Structure: ${sceneCountReq} totaling ~${targetSecs} seconds.
- Total spoken words: ${wordTarget} (natural human speaking pace).
- Spoken lines must be full, expressive spoken sentences (1-2 sentences per scene). NEVER write robotic 3-word bullets!
- Brand name "${brandName || "Our Brand"}" MUST be spoken clearly.
- Offer "${specialOffer}" and CTA "${promoCTA}" MUST be delivered in the final scene.
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
    if (reelScript.scenes) {
      reelScript.scenes = reelScript.scenes.map(s => ({
        ...s,
        text: sanitizeDialogue(s.text),
        spokenAudio: sanitizeDialogue(s.spokenAudio || s.text),
      }));
    }
  }

  const OPENAI_VOICE_MAP = {
    adam: "alloy",
    charlie: "onyx",
    roger: "echo",
    george: "fable",
    arnold: "alloy",
    rachel: "nova",
    sarah: "shimmer",
    lily: "nova",
    emily: "nova",
  };
  const ALLOWED_VOICES = ["nova", "shimmer", "echo", "onyx", "fable", "alloy", "ash", "sage", "coral"];

  let ttsVoice = String(voice || (language === "en_uk" ? "fable" : "alloy")).toLowerCase().trim();
  if (OPENAI_VOICE_MAP[ttsVoice]) {
    ttsVoice = OPENAI_VOICE_MAP[ttsVoice];
  } else if (!ALLOWED_VOICES.includes(ttsVoice)) {
    ttsVoice = language === "en_uk" ? "fable" : "alloy";
  }

  job.progress = 25;
  job.stage = "Synthesizing studio voiceover audio (ElevenLabs / TTS-HD)...";
  log(job.id, `Synthesizing audio with base voice: ${ttsVoice} (Lang: ${language})`);

  const isSkitJob = promoAngle === "customer_owner_skit" || (
    reelScript.scenes.length >= 2 &&
    (
      reelScript.scenes.some(s => /(?:customer|client)\s*[:\-–—\)]/i.test(s.rawLine || "")) ||
      (/frustrated|outdated|struggling|broken|customer|client/i.test(reelScript.scenes[0].text || reelScript.scenes[0].rawLine || ""))
    )
  );

  const reelAudioPath = path.join(jobDir, "reel_voiceover.mp3");

  if (isSkitJob && reelScript.scenes.length >= 2) {
    log(job.id, "Synthesizing alternating 2-character skit voiceover (Customer + Founder)...");
    let customerVoice = "nova";
    if (["nova", "shimmer"].includes(ttsVoice.toLowerCase())) {
      customerVoice = language === "en_uk" ? "fable" : "onyx";
    } else {
      customerVoice = "nova";
    }
    const ownerVoice = ttsVoice || "alloy";

    const sceneAudioPaths = [];
    for (let sIdx = 0; sIdx < reelScript.scenes.length; sIdx++) {
      const sc = reelScript.scenes[sIdx];
      const isCustomer = sc.speaker === "customer" || sIdx % 2 === 0;
      const v = isCustomer ? customerVoice : ownerVoice;
      const g = (v === "nova" || v === "shimmer") ? "female" : "male";
      const cleanText = sanitizeDialogue(sc.spokenAudio || sc.text);

      const sRes = await generateStudioSpeech({
        text: cleanText.replace(/^["']|["']$/g, ""),
        language: language || "hindi",
        gender: g,
        voiceId: v,
        openai,
        apiKey: process.env.ELEVENLABS_API_KEY,
      });

      if (!sRes.ok || !sRes.buffer) {
        throw new Error(sRes.error || `Failed to synthesize audio for scene ${sIdx + 1}`);
      }

      const scAudioP = path.join(jobDir, `skit_audio_${sIdx}.mp3`);
      fs.writeFileSync(scAudioP, sRes.buffer);
      sceneAudioPaths.push(scAudioP);
    }

    // Concatenate scene audio files with FFmpeg
    const concatListFile = path.join(jobDir, "skit_audio_list.txt");
    const fileContent = sceneAudioPaths.map(p => `file '${p.replace(/\\/g, "/")}'`).join("\n");
    fs.writeFileSync(concatListFile, fileContent);

    await new Promise((resolve, reject) => {
      const p = spawn("ffmpeg", [
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concatListFile,
        "-c", "copy",
        "-loglevel", "error",
        reelAudioPath,
      ]);
      p.on("close", (code) => {
        if (code === 0 && fs.existsSync(reelAudioPath)) resolve();
        else reject(new Error(`Audio concat failed with code ${code}`));
      });
      p.on("error", reject);
    });
    log(job.id, "Multi-character skit voiceover successfully concatenated!");
  } else {
    // Baseline combined voiceover (used for B-roll / fallback)
    const fullSpokenText = reelScript.scenes.map(s => sanitizeDialogue(s.spokenAudio || s.text)).join(" ");
    const baselineGender = (ttsVoice === "shimmer" || ttsVoice === "nova") ? "female" : "male";
    const fullAudioRes = await generateStudioSpeech({
      text: fullSpokenText.replace(/^["']|["']$/g, ""),
      language: language || "hindi",
      gender: baselineGender,
      voiceId: ttsVoice,
      openai,
      apiKey: process.env.ELEVENLABS_API_KEY,
    });

    if (!fullAudioRes.ok || !fullAudioRes.buffer) {
      throw new Error(fullAudioRes.error || "Failed to synthesize studio voiceover audio.");
    }

    const fullAudioBuf = fullAudioRes.buffer;
    fs.writeFileSync(reelAudioPath, fullAudioBuf);
  }

  // Check visual style
  job.progress = 45;
  const sceneVisuals = [];

  if (selectedStyle === "talking_avatar" || isSkitJob) {
    // TRUE LIP-SYNC TALKING AVATAR (Sync Labs Precision Lip-Sync + Replicate Fallback)
    job.stage = isSkitJob
      ? "Rendering 2-character lip-synced commercial skit (Customer & Founder)..."
      : "Rendering photorealistic character portrait & precision lip-sync...";
    log(job.id, isSkitJob ? "Rendering 2-character skit with alternating Customer & Founder actors..." : "Generating talking avatar lip-sync with Sync Labs / Precision Engine...");

    // Helper to generate a precision lip-synced scene video with native embedded audio
    async function renderTalkingActorScene({ characterImgPrompt, spokenText, voiceToUse, filenamePrefix }) {
      const imgPath = path.join(jobDir, `${filenamePrefix}_char.png`);
      const audioPath = path.join(jobDir, `${filenamePrefix}_audio.mp3`);
      const vidPath = path.join(jobDir, `${filenamePrefix}_talking.mp4`);

      // 1. Synthesize Scene Audio via ElevenLabs or OpenAI TTS
      const cleanLine = sanitizeDialogue(spokenText);
      const actorGender = (voiceToUse === "shimmer" || voiceToUse === "nova") ? "female" : "male";
      const actorSpeechRes = await generateStudioSpeech({
        text: cleanLine.replace(/^["']|["']$/g, ""),
        language: language || "hindi",
        gender: actorGender,
        voiceId: voiceToUse,
        openai,
        apiKey: process.env.ELEVENLABS_API_KEY,
      });

      if (!actorSpeechRes.ok || !actorSpeechRes.buffer) {
        throw new Error(actorSpeechRes.error || "Failed to synthesize actor speech audio.");
      }

      fs.writeFileSync(audioPath, actorSpeechRes.buffer);

      // 2. Generate Character Image (or reuse existing locked character face)
      if (reusedImgPath && fs.existsSync(reusedImgPath)) {
        fs.copyFileSync(reusedImgPath, imgPath);
        log(job.id, `Reusing locked actor portrait for ${filenamePrefix}`);
      } else {
        let imgGen = null;
        const charImageModels = ["gpt-image-2", "gpt-image-1.5", "dall-e-3"];
        for (const m of charImageModels) {
          try {
            imgGen = await openai.images.generate({
              model: m,
              prompt: characterImgPrompt.slice(0, 950),
              n: 1,
              size: "1024x1792",
            });
            if (imgGen.data?.[0]?.b64_json || imgGen.data?.[0]?.url) break;
          } catch (e) {
            console.warn(`[VideoWorker] Character image generation with ${m} (1024x1792) failed:`, e.message);
            try {
              imgGen = await openai.images.generate({
                model: m,
                prompt: characterImgPrompt.slice(0, 950),
                n: 1,
                size: "1024x1024",
              });
              if (imgGen.data?.[0]?.b64_json || imgGen.data?.[0]?.url) break;
            } catch (e2) {
              console.warn(`[VideoWorker] Character image generation with ${m} (1024x1024) failed:`, e2.message);
            }
          }
        }

        if (imgGen?.data?.[0]?.b64_json) {
          fs.writeFileSync(imgPath, Buffer.from(imgGen.data[0].b64_json, "base64"));
        } else if (imgGen?.data?.[0]?.url) {
          const fetchRes = await fetch(imgGen.data[0].url);
          fs.writeFileSync(imgPath, Buffer.from(await fetchRes.arrayBuffer()));
        } else {
          await createFallbackImage(imgPath, 1080, 1920, filenamePrefix);
        }
      }

      // 3. SadTalker GPU Lip-Sync
      try {
        job.stage = `Generating GPU lip-sync for ${filenamePrefix}...`;
        const audioPubUrl = await uploadPublicFile(audioPath, `${filenamePrefix}_${job.id}.mp3`, "audio/mpeg");
        const imgPubUrl = await uploadPublicFile(imgPath, `${filenamePrefix}_${job.id}.png`, "image/png");

        const talkingVidUrl = await generateSadTalkerLipSync({
          imageUrl: imgPubUrl,
          audioUrl: audioPubUrl,
          jobId: job.id,
        });

        const fetchVid = await fetch(talkingVidUrl);
        if (fetchVid.ok) {
          fs.writeFileSync(vidPath, Buffer.from(await fetchVid.arrayBuffer()));
          log(job.id, `SadTalker generated native lip-synced video for ${filenamePrefix}`);
          return { type: "video", path: vidPath, imagePath: imgPath, hasEmbeddedAudio: true, audioPath };
        }
      } catch (sTalkErr) {
        log(job.id, `SadTalker (${filenamePrefix}) fallback: ${sTalkErr.message}`);
      }

      return { type: "image", path: imgPath, imagePath: imgPath, hasEmbeddedAudio: false, audioPath };
    }

    const isSkit = promoAngle === "customer_owner_skit" || (
      reelScript.scenes.length >= 2 &&
      (/frustrated|outdated|struggling|broken|customer|client/i.test(reelScript.scenes[0].text || reelScript.scenes[0].rawLine || ""))
    );

    if (isSkit && reelScript.scenes.length >= 2) {
      // 2-CHARACTER COMMERCIAL SKIT: Alternating Customer and Founder scenes with locked face continuity!
      log(job.id, `Rendering alternating 2-character commercial skit (${reelScript.scenes.length} scenes)...`);

      let customerVoice = (["nova", "shimmer"].includes(ttsVoice.toLowerCase())) ? (language === "en_uk" ? "fable" : "onyx") : "nova";
      let founderVoice = ttsVoice;

      let cachedCustomerImg = null;
      let cachedFounderImg = null;

      for (let sIdx = 0; sIdx < reelScript.scenes.length; sIdx++) {
        const sc = reelScript.scenes[sIdx];
        const rawLine = sc.spokenAudio || sc.text || "";
        const cleanText = sanitizeDialogue(rawLine);
        const isCustomer = (sc.speaker && sc.speaker.toLowerCase().includes("customer")) ||
                           (sIdx % 2 === 0) ||
                           (/frustrated|chaos|struggl|burning|broken|pain|chaos|thousands/i.test(rawLine));

        const actorRole = isCustomer ? "Customer" : "Founder";
        const actorVoice = isCustomer ? customerVoice : founderVoice;
        const filenamePrefix = `skit_sc${sIdx + 1}_${actorRole.toLowerCase()}`;

        let prompt = "";
        let reusePath = null;

        if (isCustomer) {
          if (cachedCustomerImg && fs.existsSync(cachedCustomerImg)) {
            reusePath = cachedCustomerImg;
          } else {
            prompt = `Vertical 9:16 cinematic portrait of an authentic business professional client in a modern high-end office, sitting at a desk with an open laptop, relatable frustrated expression, natural human skin texture, soft ambient office lighting, 8k resolution, photorealistic. Absolutely NO text, NO words, NO letters, NO typography, NO watermark, NO posters, NO banners.`;
          }
        } else {
          if (cachedFounderImg && fs.existsSync(cachedFounderImg)) {
            reusePath = cachedFounderImg;
          } else {
            prompt = `Vertical 9:16 cinematic portrait of a charismatic business founder for "${brandName || 'our brand'}" in a high-end modern glass studio, smiling warmly directly at camera, professional welcoming gesture, sleek modern workstation in background, 85mm prime lens, master lighting, 8k photorealistic. Absolutely NO text, NO words, NO letters, NO typography, NO watermark, NO posters, NO banners.`;
          }
        }

        job.stage = `Lip-syncing Scene ${sIdx + 1}/${reelScript.scenes.length} (${actorRole})...`;
        const seg = await renderTalkingActorScene({
          characterImgPrompt: prompt,
          spokenText: cleanText,
          voiceToUse: actorVoice,
          filenamePrefix,
          reusedImgPath: reusePath,
        });

        if (isCustomer && !cachedCustomerImg && seg.imagePath) {
          cachedCustomerImg = seg.imagePath;
        } else if (!isCustomer && !cachedFounderImg && seg.imagePath) {
          cachedFounderImg = seg.imagePath;
        }

        sceneVisuals.push(seg);
      }

    } else {
      // SINGLE SPOKESPERSON: Deeply tailored to topic, brand, and niche
      const presenterContext = serviceToPromote || topic || niche;
      const presenterPrompt = scriptMode === "product_promo"
        ? `Vertical 9:16 cinematic portrait of a charismatic founder and expert spokesperson for "${brandName || 'our brand'}" specializing in "${presenterContext}", looking directly into camera with confident friendly expression, modern high-tech studio with dual monitors in background, professional lighting, 8k photorealistic. Absolutely NO text, NO words, NO letters, NO poster graphics.`
        : `Vertical 9:16 cinematic portrait of an authentic ${niche} expert looking directly into camera with expressive sharp eyes, natural friendly smile, modern ambient studio relevant to ${topic}, professional lighting, 8k photorealistic. Absolutely NO text, NO words, NO letters, NO poster graphics.`;

      job.stage = "Rendering spokesperson actor & GPU lip-sync...";
      const presenterSeg = await renderTalkingActorScene({
        characterImgPrompt: presenterPrompt,
        spokenText: fullSpokenText,
        voiceToUse: ttsVoice,
        filenamePrefix: "spokesperson",
      });
      sceneVisuals.push(presenterSeg);
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
        let smartPrompt;
        if (scriptMode === "product_promo") {
          smartPrompt = getSmartVisualPrompt(sc.text, sc.speaker, i, reelScript.scenes.length, brandName, serviceToPromote);
        } else {
          const cleanAction = (sc.visualPrompt || sc.text || "")
            .replace(/^Scene\s*\d+\s*(?:\([^)]+\)|\[[^\]]+\])?\s*[:\-–—]?\s*/i, "")
            .replace(/^(?:\(?\s*(?:Customer|Client|Consumer|User|Owner|Founder|Agency|Director|Host|Speaker|Narrator\s*\d*)\s*\)?)\s*[:\-–—]?\s*/i, "")
            .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
            .trim();
          smartPrompt = `Vertical 9:16 cinematic movie scene. ${cleanAction}. Photorealistic 8k, dynamic camera motion, cinematic dramatic lighting, masterpiece. Absolutely NO text, NO letters, NO words, NO subtitles, NO watermark, NO logo, NO posters, NO banners.`;
        }
        const scPrompt = smartPrompt;
        let imgRes = null;
        const reelImageModels = ["gpt-image-2", "gpt-image-1.5", "dall-e-3"];
        for (const m of reelImageModels) {
          try {
            imgRes = await openai.images.generate({
              model: m,
              prompt: scPrompt.slice(0, 950),
              n: 1,
              size: "1024x1792",
            });
            if (imgRes?.data?.[0]?.b64_json || imgRes?.data?.[0]?.url) break;
          } catch (e) {
            console.warn(`[VideoWorker] Reel scene image generation with ${m} (1024x1792) failed:`, e.message);
            try {
              imgRes = await openai.images.generate({
                model: m,
                prompt: scPrompt.slice(0, 950),
                n: 1,
                size: "1024x1024",
              });
              if (imgRes?.data?.[0]?.b64_json || imgRes?.data?.[0]?.url) break;
            } catch (e2) {
              console.warn(`[VideoWorker] Reel scene image generation with ${m} (1024x1024) failed:`, e2.message);
            }
          }
        }

        if (imgRes?.data?.[0]?.b64_json) {
          fs.writeFileSync(scImgPath, Buffer.from(imgRes.data[0].b64_json, "base64"));
        } else if (imgRes?.data?.[0]?.url) {
          const fetchRes = await fetch(imgRes.data[0].url);
          fs.writeFileSync(scImgPath, Buffer.from(await fetchRes.arrayBuffer()));
        }

        // Fast video motion via Wan 2.1 or AnimateDiff (all scenes)
        job.stage = `Generating neural video motion for scene ${i + 1}/${reelScript.scenes.length}...`;
        try {
          const vidUrl = await generateWanVideo({
            prompt: smartPrompt,
            isWidescreen: false,
            jobId: job.id,
          }).catch(() => generateGenerativeClip({
            prompt: smartPrompt,
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
          log(job.id, `Reel scene ${i + 1} video fallback: ${vErr.message}`);
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
    const usedPexelsIds = new Set();

    for (let i = 0; i < reelScript.scenes.length; i++) {
      const sc = reelScript.scenes[i];
      const scVidPath = path.join(jobDir, `pexels_sc_${i}.mp4`);
      let fetched = false;

      if (pexelsKey) {
        try {
          const smartQ = getSmartBrollQuery(sc.text, i, reelScript.scenes.length, niche, topic, sc.searchQuery);
          const q = encodeURIComponent(smartQ);
          log(job.id, `Scene ${i + 1}/${reelScript.scenes.length} B-roll query: "${smartQ}"`);

          const pexRes = await fetch(`https://api.pexels.com/videos/search?query=${q}&orientation=portrait&per_page=12&size=medium`, {
            headers: { Authorization: pexelsKey },
          });
          const pexData = await pexRes.json();
          const videos = (pexData.videos && Array.isArray(pexData.videos)) ? pexData.videos : [];

          // Select a unique video not yet used in this reel
          const chosenVideo = videos.find(v => !usedPexelsIds.has(v.id)) || videos[i % Math.max(1, videos.length)] || videos[0];

          if (chosenVideo) {
            usedPexelsIds.add(chosenVideo.id);
            const pexFiles = chosenVideo.video_files || [];
            const bestFile = pexFiles.find(f => f.height > f.width && f.file_type === "video/mp4") ||
                             pexFiles.find(f => f.file_type === "video/mp4") ||
                             pexFiles[0];

            if (bestFile?.link) {
              const dl = await fetch(bestFile.link);
              if (dl.ok) {
                fs.writeFileSync(scVidPath, Buffer.from(await dl.arrayBuffer()));
                sceneVisuals.push({ type: "video", path: scVidPath });
                fetched = true;
                log(job.id, `Scene ${i + 1} acquired unique vertical B-roll: Pexels #${chosenVideo.id} (${bestFile.width}x${bestFile.height})`);
              }
            }
          }
        } catch (pErr) {
          log(job.id, `Pexels query error scene ${i}: ${pErr.message}`);
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
  job.metadata = { title: reelScript.title || topic, scenes: reelScript.scenes };
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
          const scaleCropVf = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
          const args = [
            "-y",
          ];
          if (!vis.hasEmbeddedAudio) {
            args.push("-stream_loop", "-1");
          }
          args.push(
            "-i", vis.path,
            "-vf", scaleCropVf,
            "-c:v", "libx264",
            "-threads", "2",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            "-r", "25"
          );

          if (vis.hasEmbeddedAudio) {
            // CRITICAL: Preserve SadTalker's native frame-perfect lip-synced audio without stripping or looping!
            args.push("-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2");
          } else {
            args.push("-t", `${durationPerScene}`, "-an");
          }

          args.push("-loglevel", "error", segPath);
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
            vf = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`;
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

        const allHaveAudio = visuals.length > 0 && visuals.every(v => v.hasEmbeddedAudio);

        let finalArgs;
        if (allHaveAudio) {
          // Both/all segments have native synchronized audio from SadTalker GPU!
          // Concatenate segments directly preserving frame-perfect lip-sync:
          finalArgs = [
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", segListPath,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            "-loglevel", "error",
            outputPath
          ];
        } else {
          // Combined voiceover overlay (for motion B-roll, generative diffusion, or static images)
          const totalVideoRuntime = Math.max(targetDurationSecs, Math.round(visuals.length * durationPerScene));
          finalArgs = [
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
        }

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
    try {
      delete require.cache[require.resolve("./lib/brand-integrity-guard")];
      delete require.cache[require.resolve("./lib/seo-autopilot")];
    } catch (_) {}
    const { runSeoAutopilotCycle: freshRunSeo } = require("./lib/seo-autopilot");
    const results = await freshRunSeo({ supabase, openai, force, logger: (msg) => log("SEO_AP", msg) });
    res.json({ ok: true, count: results.length, results });
  } catch (err) {
    log("AUTOPILOT", `SEO Autopilot Error: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/autopilot/shopify/trigger", requireAuth, async (req, res) => {
  try {
    const force = Boolean(req.body?.force || req.query?.force);
    const email = req.body?.email || req.query?.email || null;
    log("AUTOPILOT", `Manual trigger: Shopify SEO Autopilot (force: ${force}, email: ${email || "all"})`);
    const results = await runShopifyAutopilotCycle({ supabase, openai, force, email, logger: (msg) => log("SHOPIFY_AP", msg) });
    res.json({ ok: true, count: results.length, results });
  } catch (err) {
    log("AUTOPILOT", `Shopify Autopilot Error: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/autopilot/shopify/generate-article", requireAuth, async (req, res) => {
  try {
    const { topic, keywords, targetLocations, tone, brandName } = req.body || {};
    if (!topic) return res.status(400).json({ ok: false, error: "Topic is required" });
    log("AUTOPILOT", `On-demand Shopify article generation: "${topic}" (${brandName}) [target: ${targetLocations || "global"}]`);
    const generated = await generateShopifyArticleOnDemand({ topic, keywords, targetLocations, tone, brandName, openai });
    res.json({ ok: true, generated });
  } catch (err) {
    log("AUTOPILOT", `Shopify On-Demand Generation Error: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// -------------------------------------------------------------
// Meta Ads Suite Offload Endpoints (Protected by WORKER_SECRET_KEY)
// -------------------------------------------------------------
const visualJobCache = new Map();

app.post("/meta/generate-visual", requireAuth, async (req, res) => {
  try {
    const { prompt, service, offer, tagline, businessName, cacheKey } = req.body || {};
    if (!prompt) return res.status(400).json({ ok: false, error: "Prompt is required" });

    const key = cacheKey || `${prompt}_${service || ""}_${offer || ""}_${tagline || ""}_${businessName || ""}`;
    if (visualJobCache.has(key)) {
      log("META_VISUAL", `Reusing in-flight or cached visual generation for key: ${key.slice(0, 60)}...`);
      try {
        const cached = await visualJobCache.get(key);
        if (cached && cached.imageUrl) {
          return res.json({ ok: true, imageUrl: cached.imageUrl, storageFileName: cached.storageFileName, fromCache: true });
        }
      } catch (cacheErr) {
        log("META_VISUAL", `Cached job failed: ${cacheErr.message}, re-generating...`);
        visualJobCache.delete(key);
      }
    }

    log("META_VISUAL", `Generating ad graphic for "${service || businessName}" (key: ${key.slice(0, 45)})...`);
    const promise = generateAdGraphic({
      openaiClient: openai,
      supabaseClient: supabase,
      prompt,
      service,
      offer,
      tagline,
      businessName,
      logger: (msg) => log("META_VISUAL", msg),
    });

    visualJobCache.set(key, promise);
    setTimeout(() => visualJobCache.delete(key), 15 * 60 * 1000);

    const result = await promise;
    res.json({ ok: true, imageUrl: result.imageUrl, storageFileName: result.storageFileName });
  } catch (err) {
    if (req.body?.cacheKey) visualJobCache.delete(req.body.cacheKey);
    log("META_VISUAL", `Error generating visual: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/meta/execute-campaign", requireAuth, async (req, res) => {
  try {
    const { clientEmail, platform, payload, metaConnection } = req.body || {};
    if (!payload || !payload.campaign_name) {
      return res.status(400).json({ ok: false, message: "Valid payload with campaign_name is required" });
    }

    log("META_CAMPAIGN", `[ExecuteCampaign] Request for ${clientEmail || "unknown"} - Campaign: "${payload.campaign_name}"`);

    const result = await executeFullMetaCampaign({
      clientEmail,
      platform,
      payload,
      metaConnection,
      supabaseClient: supabase,
      logger: (msg) => log("META_CAMPAIGN", msg),
    });

    return res.status(200).json(result);
  } catch (err) {
    log("META_CAMPAIGN", `[ExecuteCampaign] Error: ${err.message}`);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

app.post("/meta/create-campaign", requireAuth, async (req, res) => {
  try {
    const {
      clientEmail,
      userEmail,
      adAccountId,
      accessToken,
      pageId,
      instagramActorId,
      payload,
      imagePrompt,
      service,
      offer,
      tagline,
      businessName,
      userProvidedImageUrl,
      imageHash: existingImageHash,
      platform,
      metaConnection,
    } = req.body || {};

    const targetEmail = clientEmail || userEmail;
    if (!payload || !payload.campaign_name) {
      return res.status(400).json({ ok: false, error: "Valid campaign payload with campaign_name is required" });
    }

    if (adAccountId) payload.adAccountId = adAccountId;
    if (accessToken) payload.accessToken = accessToken;
    if (pageId) payload.pageId = pageId;
    if (instagramActorId) payload.instagramActorId = instagramActorId;

    log("META_CAMPAIGN", `[CreateCampaign] Executing campaign "${payload.campaign_name}" for ${targetEmail || "direct"}...`);

    let finalImageHash = existingImageHash || null;
    let finalImageUrl = userProvidedImageUrl || null;
    let ephemeralFile = null;

    // 1. Resolve / Generate Image if hash not provided
    if (!finalImageHash) {
      if (userProvidedImageUrl) {
        log("META_CAMPAIGN", `Uploading user-provided image: ${userProvidedImageUrl}`);
        finalImageHash = await uploadImageToMeta({
          adAccountId: adAccountId || payload.adAccountId,
          accessToken: accessToken || payload.accessToken,
          imageUrl: userProvidedImageUrl,
          logger: (msg) => log("META_CAMPAIGN", msg),
        });
      } else if (imagePrompt) {
        log("META_CAMPAIGN", `Generating visual with AI for campaign...`);
        const graphic = await generateAdGraphic({
          openaiClient: openai,
          supabaseClient: supabase,
          prompt: imagePrompt,
          service,
          offer,
          tagline,
          businessName,
          logger: (msg) => log("META_CAMPAIGN", msg),
        });

        finalImageUrl = graphic.imageUrl;
        ephemeralFile = graphic.storageFileName;

        finalImageHash = await uploadImageToMeta({
          adAccountId: adAccountId || payload.adAccountId,
          accessToken: accessToken || payload.accessToken,
          imageBuffer: graphic.imageBuffer,
          imageUrl: graphic.imageUrl,
          logger: (msg) => log("META_CAMPAIGN", msg),
        });
      }
    }

    if (finalImageHash) {
      if (!payload.ad_sets) payload.ad_sets = [{}];
      if (!payload.ad_sets[0].ad_creative) payload.ad_sets[0].ad_creative = {};
      payload.ad_sets[0].ad_creative.image_hash = finalImageHash;
      if (finalImageUrl) payload.ad_sets[0].ad_creative.imageUrl = finalImageUrl;
    }

    // 2. Publish Campaign using the full production engine
    const campaignResult = await executeFullMetaCampaign({
      clientEmail: targetEmail,
      platform: platform || ["facebook", "instagram"],
      payload,
      metaConnection,
      supabaseClient: supabase,
      logger: (msg) => log("META_CAMPAIGN", msg),
    });

    // 3. Ephemeral storage cleanup
    if (ephemeralFile && supabase) {
      try {
        await supabase.storage.from("instagram-creatives").remove([ephemeralFile]);
        log("META_CAMPAIGN", `Cleaned up ephemeral image: ${ephemeralFile}`);
      } catch (_) {}
    }

    res.json({
      ok: true,
      ...campaignResult,
      campaignId: campaignResult.id,
      imageHash: finalImageHash,
      imageUrl: finalImageUrl,
    });
  } catch (err) {
    log("META_CAMPAIGN", `Campaign execution error: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message, message: err.message });
  }
});

// -------------------------------------------------------------
// Asynchronous Background Meta Campaign Job Endpoint (Zero Vercel Timeout)
// -------------------------------------------------------------
app.post(["/meta/jobs/create-campaign", "/meta/jobs/create"], requireAuth, async (req, res) => {
  try {
    const {
      clientEmail,
      userEmail,
      businessId,
      adAccountId,
      accessToken,
      pageId,
      instagramActorId,
      payload,
      imagePrompt,
      service,
      offer,
      tagline,
      businessName,
      userProvidedImageUrl,
      imageHash: existingImageHash,
      platform,
      metaConnection,
    } = req.body || {};

    const targetEmail = clientEmail || userEmail;
    if (!payload || !payload.campaign_name) {
      return res.status(400).json({ ok: false, error: "Valid campaign payload with campaign_name is required" });
    }

    const jobId = `meta_job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const job = {
      id: jobId,
      type: "meta_campaign",
      userEmail: targetEmail,
      businessId: businessId || null,
      campaignName: payload.campaign_name,
      status: "processing",
      progress: 10,
      stage: "Connecting to Meta Ads engine & verifying credentials...",
      result: null,
      error: null,
      createdAt: new Date().toISOString(),
    };
    jobs.set(jobId, job);
    log(jobId, `[AsyncMetaJob] Queued background Meta campaign job for "${payload.campaign_name}" (${targetEmail || "direct"})`);

    // Respond immediately in <200ms so Vercel NEVER times out
    res.json({ ok: true, jobId, status: "processing", campaignName: payload.campaign_name });

    // Execute the complete orchestration pipeline in the background on Railway
    setImmediate(async () => {
      try {
        if (adAccountId) payload.adAccountId = adAccountId;
        if (accessToken) payload.accessToken = accessToken;
        if (pageId) payload.pageId = pageId;
        if (instagramActorId) payload.instagramActorId = instagramActorId;

        let finalImageHash = existingImageHash || null;
        let finalImageUrl = userProvidedImageUrl || null;
        let ephemeralFile = null;

        // 1. Resolve / Generate AI Image if hash not provided
        if (!finalImageHash) {
          if (userProvidedImageUrl) {
            job.stage = "Uploading user image to Meta Ads...";
            job.progress = 25;
            log(jobId, `Uploading user image to Meta: ${userProvidedImageUrl}`);
            finalImageHash = await uploadImageToMeta({
              adAccountId: adAccountId || payload.adAccountId,
              accessToken: accessToken || payload.accessToken,
              imageUrl: userProvidedImageUrl,
              logger: (msg) => log(jobId, msg),
            });
          } else if (imagePrompt) {
            job.stage = "Generating photorealistic AI ad visual with GabbarInfo AI...";
            job.progress = 30;
            log(jobId, `Generating photorealistic ad visual for "${service || businessName}"...`);
            const graphic = await generateAdGraphic({
              openaiClient: openai,
              supabaseClient: supabase,
              prompt: imagePrompt,
              service,
              offer,
              tagline,
              businessName,
              logger: (msg) => log(jobId, msg),
            });

            finalImageUrl = graphic.imageUrl;
            ephemeralFile = graphic.storageFileName;

            job.stage = "Applying typography overlays & uploading creative to Meta...";
            job.progress = 60;
            log(jobId, `Uploading generated graphic to Meta Graph API...`);
            finalImageHash = await uploadImageToMeta({
              adAccountId: adAccountId || payload.adAccountId,
              accessToken: accessToken || payload.accessToken,
              imageBuffer: graphic.imageBuffer,
              imageUrl: graphic.imageUrl,
              logger: (msg) => log(jobId, msg),
            });
          }
        }

        if (finalImageHash) {
          if (!payload.ad_sets) payload.ad_sets = [{}];
          if (!payload.ad_sets[0].ad_creative) payload.ad_sets[0].ad_creative = {};
          payload.ad_sets[0].ad_creative.image_hash = finalImageHash;
          if (finalImageUrl) payload.ad_sets[0].ad_creative.imageUrl = finalImageUrl;
        }

        // 2. Execute Campaign Creation
        job.stage = "Configuring targeting, budget & publishing campaign live to Meta...";
        job.progress = 80;
        log(jobId, `Executing full Meta campaign publishing...`);

        const campaignResult = await executeFullMetaCampaign({
          clientEmail: targetEmail,
          platform: platform || ["facebook", "instagram"],
          payload,
          metaConnection,
          supabaseClient: supabase,
          logger: (msg) => log(jobId, msg),
        });

        // 3. Ephemeral cleanup
        if (ephemeralFile && supabase) {
          try {
            await supabase.storage.from("instagram-creatives").remove([ephemeralFile]);
          } catch (_) {}
        }

        // 4. Update Supabase client memory so user state is persistent even across refreshes
        if (supabase && targetEmail && businessId) {
          try {
            const { data: memData } = await supabase
              .from("agent_memory")
              .select("content")
              .eq("email", targetEmail)
              .eq("memory_type", "client")
              .maybeSingle();

            if (memData?.content) {
              const parsed = typeof memData.content === "string" ? JSON.parse(memData.content) : memData.content;
              if (parsed?.business_answers?.[businessId]?.campaign_state) {
                parsed.business_answers[businessId].campaign_state.stage = "COMPLETED";
                parsed.business_answers[businessId].campaign_state.final_result = campaignResult;
                await supabase
                  .from("agent_memory")
                  .update({ content: JSON.stringify(parsed), updated_at: new Date().toISOString() })
                  .eq("email", targetEmail)
                  .eq("memory_type", "client");
                log(jobId, `Updated agent_memory to COMPLETED for ${targetEmail}`);
              }
            }
          } catch (memErr) {
            log(jobId, `Failed to update agent_memory: ${memErr.message}`);
          }
        }

        // 5. Mark job as complete
        job.status = "completed";
        job.progress = 100;
        job.stage = "Campaign published successfully to Meta Ads!";
        job.completedAt = new Date().toISOString();
        job.result = {
          ok: true,
          ...campaignResult,
          campaignId: campaignResult.id,
          campaignName: payload.campaign_name,
          imageHash: finalImageHash,
          imageUrl: finalImageUrl,
        };
        log(jobId, `Meta campaign background job successfully completed! Campaign ID: ${campaignResult.id}`);
      } catch (err) {
        log(jobId, `Meta campaign background job failed: ${err.message}`);
        job.status = "failed";
        job.error = err.message;
        job.completedAt = new Date().toISOString();
      }
    });
  } catch (err) {
    log("META_CAMPAIGN", `Error queueing background campaign job: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/autopilot/status", requireAuth, (req, res) => {
  res.json({
    ok: true,
    social_cron: "15 9 * * * (09:15 AM IST Daily, Asia/Kolkata)",
    seo_cron: "0 9 * * * (09:00 AM IST Daily, Asia/Kolkata)",
    shopify_cron: "30 9 * * * (09:30 AM IST Daily, Asia/Kolkata)",
    hasSupabase: Boolean(supabase),
    hasOpenAI: Boolean(openai),
  });
});

app.post("/system/reload", requireAuth, (req, res) => {
  try {
    const modules = [
      "./lib/brand-integrity-guard",
      "./lib/seo-autopilot",
      "./lib/social-autopilot",
      "./lib/shopify-autopilot",
      "./lib/meta-campaign-service",
    ];
    const reloaded = [];
    for (const mod of modules) {
      try {
        const resolved = require.resolve(mod);
        delete require.cache[resolved];
        require(mod);
        reloaded.push(mod);
      } catch (e) {
        log("SYS", `Failed to reload ${mod}: ${e.message}`);
      }
    }
    log("SYS", `Successfully reloaded modules: ${reloaded.join(", ")}`);
    res.json({ ok: true, reloaded, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// -------------------------------------------------------------
// Scheduled Native Cron Jobs (Reliable Background Execution in Asia/Kolkata)
// -------------------------------------------------------------
// 1. Daily SEO Suite Autopilot (Runs 09:00 AM IST Daily)
cron.schedule("0 9 * * *", async () => {
  log("CRON_SEO", "Executing scheduled SEO Suite Autopilot cycle (09:00 AM IST)...");
  try {
    try {
      delete require.cache[require.resolve("./lib/brand-integrity-guard")];
      delete require.cache[require.resolve("./lib/seo-autopilot")];
    } catch (_) {}
    const { runSeoAutopilotCycle: freshRunSeo } = require("./lib/seo-autopilot");
    await freshRunSeo({ supabase, openai, force: false, logger: (msg) => log("CRON_SEO", msg) });
  } catch (e) {
    log("CRON_SEO", `Scheduled SEO cycle error: ${e.message}`);
  }
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

// 2. Daily Social Media Planner Autopilot (Runs 09:15 AM IST Daily)
cron.schedule("15 9 * * *", async () => {
  log("CRON_SOCIAL", "Executing scheduled Social Media Planner Autopilot cycle (09:15 AM IST)...");
  try {
    await runSocialAutopilotCycle({ supabase, openai, force: false, logger: (msg) => log("CRON_SOCIAL", msg) });
  } catch (e) {
    log("CRON_SOCIAL", `Scheduled Social cycle error: ${e.message}`);
  }
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

// 3. Daily Shopify SEO Autopilot (Runs 09:30 AM IST Daily)
cron.schedule("30 9 * * *", async () => {
  log("CRON_SHOPIFY", "Executing scheduled Shopify SEO Autopilot cycle (09:30 AM IST)...");
  try {
    await runShopifyAutopilotCycle({ supabase, openai, force: false, logger: (msg) => log("CRON_SHOPIFY", msg) });
  } catch (e) {
    log("CRON_SHOPIFY", `Scheduled Shopify cycle error: ${e.message}`);
  }
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 GabbarInfo Video Worker running on port ${PORT}`);
  console.log(`🛡️ Auth Protected with WORKER_SECRET_KEY`);
  console.log(`🎬 FFmpeg Engine Ready for Reels & Long-Form YouTube`);
  console.log(`=======================================================`);
});
