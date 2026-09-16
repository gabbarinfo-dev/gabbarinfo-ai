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
    animationStyle = "generative_video",
    storyStyle = "movie_dialogue", // "movie_dialogue" | "storybook_narrated" | "documentary_voiceover"
  } = payload;

  const durationMins = Number(durationMinutes || targetMinutes) || 2;
  const targetTotalSecs = durationMins * 60;
  const isWidescreen = payload.format === "youtube_16_9";

  job.progress = 15;
  job.stage = `Scriptwriting ~${durationMins} min screenplay with GPT-4o...`;
  log(job.id, `Generating cinematic screenplay (~${durationMins} min, ${targetTotalSecs}s) for "${videoTitle || episodeTitle || topic}" [Style: ${storyStyle}, Animation: ${animationStyle}]`);

  // Character casting:
  // If user provided characters, use them.
  // If user did NOT provide characters, instruct GPT-4o to dynamically extract or invent characters from the prompt.
  const hasUserCharacters = characters && Array.isArray(characters) && characters.length > 0;
  let activeCharacters = hasUserCharacters ? characters.map(c => ({
    name: c.name,
    role: c.role || "Character",
    voice: resolveVoice(c),
    gender: c.gender || "male",
    traits: c.traits || c.visualTraits || "expressive photorealistic person",
    archetype: c.archetype || "photoreal_human",
  })) : [];

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

  // Build System Prompt based on selected storyStyle
  let scriptFormatRules = "";
  if (storyStyle === "movie_dialogue") {
    scriptFormatRules = `
CRITICAL MOVIE / SKIT ACTING RULES (PURE CHARACTER CONVERSATION — ABSOLUTELY NO NARRATOR):
1. This is a real MOVIE / COMEDY SKIT / DRAMA. Like real films and YouTube skits, there is ZERO NARRATION. There is NO Narrator!
2. Characters speak directly to each other! Every single scene MUST feature one of the characters speaking direct spoken dialogue in quotation marks (e.g. "सुन भाई, गाड़ी रोक! वो देख सामने क्या हो रहा है!").
3. If 2 or more characters are present, they MUST converse back-and-forth:
   - Scene 1: Character A initiates conversation or action.
   - Scene 2: Character B replies, argues, reacts, or cracks a joke.
   - Scene 3: Character A responds with emotion or urgency.
   - Scene 4: Climax, resolution, punchline, or realization.
4. For every scene:
   - "type": "dialogue"
   - "speaker": EXACT name of the speaking character. NEVER "Narrator".
   - "spokenAudio": The direct spoken dialogue in quotation marks (30 to 50 words, natural cadence, rich emotion).
   - "visualDescription": Cinematic movie scene still. Describe the setting (moving cars, room, bustling street, lab, cafe), what the characters are doing, their expressions, gestures, and the cinematic camera shot (e.g. wide two-shot, over-the-shoulder, tracking shot).
   - "characterInVisual": Names of characters present in the frame.`;
  } else if (storyStyle === "storybook_narrated") {
    scriptFormatRules = `
CRITICAL STORYBOOK / FABLE RULES:
1. Alternate between "b_roll" (speaker: "Narrator", descriptive scene setting) and "dialogue" (speaker: character name, lines in quotes).
2. For B-roll: "spokenAudio" is the narrator's rich descriptive voiceover.
3. For Dialogue: "spokenAudio" is direct character dialogue in quotes.`;
  } else {
    // documentary_voiceover
    scriptFormatRules = `
CRITICAL DOCUMENTARY / VOICEOVER RULES:
1. Every scene is "b_roll" with speaker "Narrator".
2. "spokenAudio" is authoritative, eloquent voiceover narration over wide cinematic visuals.`;
  }

  const charContext = hasUserCharacters ? `
FIXED USER CHARACTERS TO CAST:
${activeCharacters.map((c, i) => `Character ${i + 1}: Name="${c.name}", Role="${c.role}", Gender="${c.gender}", Voice="${c.voice}", Traits="${c.traits}"`).join("\n")}
` : `
DYNAMIC CHARACTER CREATION:
The user has NOT specified fixed characters. You MUST analyze the story prompt: "${storyPrompt || videoTitle || topic}".
Extract or invent 1 to 3 distinct characters fitting the genre, culture, and setting of this story.
Include a "characters" array in your JSON output defining them:
- "name": authentic name fitting the story (NEVER hardcode generic names)
- "role": role in the scene
- "gender": "male" or "female"
- "traits": visual description (clothing, look, mood)
- "voice": choose "onyx" or "echo" or "ash" for male; "shimmer" or "nova" or "coral" for female
`;

  const systemPrompt = `You are a world-class Hollywood film director and screenwriter.
You are writing a COMPLETE, captivating ${durationMins}-minute cinematic script.
FORMAT: ${isWidescreen ? "16:9 Widescreen YouTube Cinematic Film" : "9:16 Vertical Smartphone Story / Social Reel"}.
${langInstruction}
${audiencePrompt}

${charContext}

${scriptFormatRules}

Divide the story into exactly ${numScenes} sequential scenes.
Each scene's spoken dialogue/audio must be 30 to 50 words in length, rich with drama, emotion, and character personality.

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
      "spokenAudio": "\"Direct first-person spoken dialogue in quotation marks (30 to 50 words)\"",
      "visualDescription": "Detailed cinematic movie shot of characters in the rich environment with moving elements, lighting, camera angle, and expressions",
      "characterInVisual": "Characters in frame"
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.75,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Write a complete ${durationMins} minute screenplay on topic: "${storyPrompt || videoTitle || topic}". Must have ${numScenes} scenes.` }
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
      archetype: "photoreal_human",
    }));
    log(job.id, `Dynamically casted ${activeCharacters.length} custom characters: ${activeCharacters.map(c => `${c.name} (${c.gender}, voice: ${c.voice})`).join(", ")}`);
  } else if (activeCharacters.length === 0) {
    // Fallback if model omitted characters array
    activeCharacters = [
      { name: "Character 1", role: "Protagonist", gender: "male", voice: "onyx", traits: "cinematic actor" },
      { name: "Character 2", role: "Companion", gender: "female", voice: "shimmer", traits: "cinematic actress" },
    ];
  }

  // Step 2: Multi-Character Voiceover Synthesis
  job.progress = 30;
  job.stage = "Synthesizing multi-character voice acting via OpenAI TTS...";
  log(job.id, `Synthesizing ${script.scenes.length} audio tracks with distinct voices...`);

  const audioFiles = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    let voice = "fable"; // Default narrator voice
    const isNarrator = !scene.speaker || scene.speaker.toLowerCase() === "narrator" || scene.type === "b_roll";

    if (!isNarrator) {
      const charObj = activeCharacters.find(c => c.name.toLowerCase() === (scene.speaker || "").toLowerCase());
      if (charObj) {
        voice = resolveVoice(charObj);
      } else {
        voice = resolveVoice(activeCharacters[i % activeCharacters.length]);
      }
    }

    const spokenText = scene.spokenAudio || scene.narration || scene.text || "Dramatic cinematic unfolding";
    job.stage = `Recording ${isNarrator ? "Narrator" : scene.speaker} (${i + 1}/${script.scenes.length})...`;
    job.progress = 30 + Math.round((i / script.scenes.length) * 25); // 30% to 55%

    const mp3Response = await openai.audio.speech.create({
      model: "tts-1",
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
        prompt = `Cinematic ${aspectDesc} 35mm Hollywood film still photograph. ${scene.visualDescription}. Atmospheric wide angle cinematic shot, environmental lighting, fluid depth of field, Arri Alexa Mini LF, 8k resolution, masterpiece.`;
      } else {
        const speakingChar = activeCharacters.find(c => c.name.toLowerCase() === (scene.speaker || "").toLowerCase()) || activeCharacters[0];
        const allChars = activeCharacters.map(c => `${c.name} (${c.traits || "detailed character"})`).join(" and ");
        prompt = `Cinematic ${aspectDesc} movie scene photograph. ${scene.visualDescription}. Characters present: ${allChars}. Active speaking character: ${speakingChar.name}. 35mm cinema camera, Arri Alexa film still, natural skin textures, authentic expressions, dynamic movie lighting, photorealistic 8k, masterpiece.`;
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
      const isDialogueScene = (scene.type === "dialogue") && !isNarrator;

      // 1. Live Talking Head / Hybrid Lip-Sync:
      // - Dialogue Scene: SadTalker lip-sync on the character delivering the dialogue line
      // - B-Roll Scene: Cinematic World Video (moving cars, city, nature) with Narrator voiceover!
      if (animationStyle === "live_talking_head" || animationStyle === "hybrid_lip_sync") {
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
          // B-Roll Narrator Scene: Generate cinematic world video with moving cars, city, nature
          job.stage = `Generating cinematic B-roll video (${i + 1}/${script.scenes.length})...`;
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

      // 2. Generative AI Video (Higgsfield / Minimax / Runway style):
      if (animationStyle === "generative_video" || animationStyle === "cinematic_world_video") {
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
