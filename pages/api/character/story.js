// pages/api/character/story.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { generateTalkingAvatar } from "../../../lib/video/replicate-service.js";
import { uploadToMediaBridge } from "../../../lib/wordpress/media-bridge.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.body?.userEmail;

  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Please log in to create videos." });
  }

  const {
    characterId,
    companionId,
    format = "reel_9_16", // "reel_9_16" | "youtube_16_9"
    narrativeType = "standalone", // "standalone" (complete self-contained story) | "episodic" (Ep 1, 2...)
    scriptMode = "ai_prompt", // "ai_prompt" | "custom_script" | "business_media"
    animationStyle = "cinematic_scenes", // "cinematic_scenes" | "live_talking_head"
    customScript = "",
    vocalEmotion = "poetic_shayar", // "poetic_shayar" | "dramatic_story" | "warm_storybook" | "commercial_pitch"
    storyPrompt = "A journey of wonder and wisdom",
    episodeTitle = "The Grand Tale",
    videoTitle = "",
    episodeNumber = 1,
    seasonNumber = 1,
    audience = "family", // "kids" | "teens" | "family" | "adult"
    durationMinutes, // 1, 2, 3, 4, 5
    language = "hindi", // "hindi" | "en_us" | "en_uk"
    clientMedia = [], // array of { url, type: "video" | "image" }
  } = req.body;

  try {
    // 1. Fetch Primary Character & Companion from Supabase
    const { data: memRows } = await supabase
      .from("agent_memory")
      .select("content")
      .eq("email", userEmail)
      .ilike("memory_type", "client_character%");

    let character = null;
    let companion = null;

    if (memRows) {
      for (const row of memRows) {
        const c = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
        if (c.id === characterId) character = c;
        if (companionId && c.id === companionId) companion = c;
      }
    }

    if (!character) {
      character = {
        name: scriptMode === "business_media" ? "Host" : "Hero",
        archetype: "photoreal_human",
        visualTraits: "expressive eyes, friendly warm smile",
        referenceSheetUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80",
        voice: "nova",
      };
    }

    // Dynamic duration and scene count
    const durationMins = Number(durationMinutes) || (format === "youtube_16_9" ? 3 : 1);
    let numScenes = 4;
    if (durationMins >= 5) numScenes = 20;
    else if (durationMins >= 4) numScenes = 16;
    else if (durationMins >= 3) numScenes = 12;
    else if (durationMins >= 2) numScenes = 8;
    else numScenes = 4;

    const targetDuration = durationMins * 60;
    const isLongForm = format === "youtube_16_9" || durationMins >= 2;

    const displayTitle = narrativeType === "episodic"
      ? `Episode ${episodeNumber}: ${episodeTitle || "The Grand Tale"}`
      : (videoTitle || episodeTitle || "The Grand Tale");

    // Audience guidance
    let audienceInstruction = "TARGET AUDIENCE: General / Family — Inspiring, emotional, universally engaging.";
    if (audience === "kids") {
      audienceInstruction = "TARGET AUDIENCE: Children & Kids (Ages 3-10) — Whimsical, educational, playful moral story, gentle pacing, innocent wonder, zero scary elements.";
    } else if (audience === "teens") {
      audienceInstruction = "TARGET AUDIENCE: Teens & Young Adults — High energy, fantasy adventure, mystery, snappy witty dialogues.";
    } else if (audience === "adult") {
      audienceInstruction = "TARGET AUDIENCE: Adults & Mature Viewers — Deep cinematic narrative, intense emotional drama, sophisticated dialogues.";
    }

    let langInstruction = "Language: American English (US). Engaging, dynamic American cinematic style.";
    if (language === "hindi") {
      langInstruction = "Language: Hindi (हिंदी). Write all narration lines, dialogue, or poetry in fluent, captivating, natural conversational Hindi (Devanagari script).";
    } else if (language === "en_uk") {
      langInstruction = "Language: British English (UK). Write narration lines in classic British English cadence with authentic UK spelling and phrasing.";
    }

    // 2. Generate Story Script using GPT-4o
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let systemPrompt = "";
    let userPrompt = "";

    const companionText = companion ? `Co-Star / Companion: "${companion.name}" (${companion.visualTraits || "ally"}) with voice "${companion.voice || "onyx"}"` : "";
    const standaloneText = narrativeType === "standalone"
      ? "NARRATIVE SCOPE: Standalone complete story / video. Must have a clear opening, captivating middle, and satisfying resolution or emotional punchline. Do NOT end on a cliffhanger."
      : `NARRATIVE SCOPE: Serialized Episodic Story (Season ${seasonNumber}, Episode ${episodeNumber}). Continuous chapter lore.`;

    if (scriptMode === "custom_script") {
      // User provided their own exact words / shayari
      systemPrompt = `You are an elite video director. The user has provided an EXACT custom script / shayari.
Character: "${character.name}" (${character.visualTraits})
${companionText}
Format: ${isLongForm ? "16:9 Widescreen Story" : "9:16 Viral Social Reel"}
${langInstruction}
Delivery Emotion: ${vocalEmotion}

CRITICAL RULES:
1. Divide the user's EXACT words into ${numScenes} sequential scene beats. DO NOT alter, rewrite, or drop their poetry/lines. Preserve their exact words.
2. For each scene, create an evocative visual description showing ${character.name} ${companion ? `and ${companion.name}` : ""} acting out this moment with matching emotional facial expression.
3. Return ONLY valid JSON matching this exact structure:
{
  "title": "${episodeTitle || "Custom Performance"}",
  "youtubeTitle": "Catchy YouTube Title",
  "description": "Engaging description with tags",
  "scenes": [
    {
      "sceneNumber": 1,
      "chapter": "Part 1 / Couplet 1",
      "narration": "Exact text chunk from user",
      "visualDescription": "Visual description of character acting out this line"
    }
  ]
}`;
      userPrompt = `User's Exact Script/Shayari to perform:\n"""\n${customScript || storyPrompt}\n"""`;

    } else if (scriptMode === "business_media") {
      // Manufacturer / Business mode with client media
      const totalMediaCount = Math.max(clientMedia.length, numScenes);
      systemPrompt = `You are a high-impact B2B & industrial video marketing strategist.
Business / Facility Topic: "${storyPrompt}"
Format: ${isLongForm ? "16:9 Industrial / Commercial Showcase" : "9:16 High-Energy Business Reel"}
${langInstruction}
Delivery Tone: Professional, persuasive, inspiring industrial commercial spotlighting manufacturing precision, technological expertise, and reliable quality.

Create a high-converting promotional script with exactly ${totalMediaCount} scene beats.
Return ONLY valid JSON matching this exact structure:
{
  "title": "${episodeTitle || "Factory & Business Showcase"}",
  "youtubeTitle": "Official Business & Facility Showcase",
  "description": "Commercial overview with contact CTA",
  "scenes": [
    {
      "sceneNumber": 1,
      "chapter": "Facility Overview",
      "narration": "Punchy professional voiceover line (10-15 words)",
      "visualDescription": "Manufacturing/facility focus"
    }
  ]
}`;
      userPrompt = `Create a promotional script for our business/factory based on: "${storyPrompt}". Needs exactly ${totalMediaCount} scenes.`;

    } else {
      // Standard AI Character Story Mode
      systemPrompt = `You are an elite cinematic video director and viral YouTube screenwriter.
Main Character: "${character.name}" (${character.visualTraits}) [Voice: ${character.voice || "nova"}]
Archetype Style: "${character.archetype}"
${companionText}
Format: ${isLongForm ? "16:9 Cinematic YouTube Long-Form Story" : "9:16 Viral Social Reel"}
${standaloneText}
${audienceInstruction}
${langInstruction}

Create a captivating, emotionally engaging narrative story based on the user's prompt: "${storyPrompt}".
Maintain 100% visual consistency by referencing the character's exact appearance ${companion ? `and ${companion.name}` : ""} in every scene description.

IMPORTANT MULTI-CHARACTER RULE:
If a companion is present, alternate dialogues between "${character.name}", "${companion.name}", and occasional "Narrator" to create authentic cinematic multi-character chemistry and dialogue!

Return ONLY valid JSON matching this exact structure:
{
  "title": "${displayTitle}",
  "youtubeTitle": "YouTube Optimized Title with Emotional Hook & Keywords",
  "description": "Engaging description with chapter timestamps and hashtags",
  "scenes": [
    {
      "sceneNumber": 1,
      "speaker": "${character.name}",
      "chapter": "The Awakening",
      "narration": "Dialogue line spoken for this scene (around 12-20 words)",
      "visualDescription": "Detailed visual of ${character.name} ${companion ? `and ${companion.name}` : ""} in the environment",
      "searchKeyword": "1-2 keywords for ambient visuals"
    }
  ]
}`;
      userPrompt = `Generate a ${narrativeType} story titled "${displayTitle}". Needs exactly ${numScenes} sequenced scenes for ${durationMins}-minute runtime.`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const storyResult = JSON.parse(completion.choices[0].message.content);

    // 3. Multi-Character Voiceover Synthesis via OpenAI TTS
    let defaultVoice = character.voice || "nova";
    if (vocalEmotion === "poetic_shayar") defaultVoice = "onyx";
    else if (vocalEmotion === "dramatic_story") defaultVoice = "echo";
    else if (vocalEmotion === "commercial_pitch") defaultVoice = "alloy";
    else if (vocalEmotion === "warm_storybook") defaultVoice = "shimmer";

    console.log(`[CharacterStory] Synthesizing multi-character dialogue for ${storyResult.scenes.length} scenes...`);

    const audioSegments = [];
    for (let sIdx = 0; sIdx < storyResult.scenes.length; sIdx++) {
      const sc = storyResult.scenes[sIdx];
      let sceneVoice = defaultVoice;

      if (companion && sc.speaker && sc.speaker.toLowerCase().includes(companion.name.toLowerCase())) {
        sceneVoice = companion.voice || "shimmer";
      } else if (sc.speaker && sc.speaker.toLowerCase().includes(character.name.toLowerCase())) {
        sceneVoice = character.voice || defaultVoice;
      } else if (sc.speaker && sc.speaker.toLowerCase() === "narrator") {
        sceneVoice = language === "hindi" ? "onyx" : "fable";
      }

      try {
        const vRes = await openai.audio.speech.create({
          model: "tts-1",
          voice: sceneVoice,
          input: sc.narration || "...",
          response_format: "mp3",
        });
        audioSegments.push(Buffer.from(await vRes.arrayBuffer()));
      } catch (voiceErr) {
        console.warn(`[CharacterStory] Scene ${sIdx + 1} voice synthesis fallback:`, voiceErr.message);
      }
    }

    const voiceBuffer = audioSegments.length > 0 ? Buffer.concat(audioSegments) : Buffer.from("");
    const voiceoverBase64 = `data:audio/mp3;base64,${voiceBuffer.toString("base64")}`;

    // 3b. Upload Voiceover to Ephemeral Media Bridge on User Hosting (Required for GPU Lip-Sync)
    let publicAudioUrl = null;
    try {
      const audioFileName = `speech_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.mp3`;
      try {
        const mb = await uploadToMediaBridge({
          filename: audioFileName,
          buffer: voiceBuffer,
          userEmail,
        });
        publicAudioUrl = mb.url;
        console.log("[CharacterStory] Staged voiceover audio on Hosting Media Bridge:", publicAudioUrl);
      } catch (mbErr) {
        console.warn("[CharacterStory] Media Bridge audio fallback to Supabase:", mbErr.message);
        const audioFilePath = `audio/${audioFileName}`;
        const { error: upAudioErr } = await supabase.storage
          .from("instagram-creatives")
          .upload(audioFilePath, voiceBuffer, { contentType: "audio/mpeg", upsert: true });

        if (!upAudioErr) {
          const { data: pubAudioData } = supabase.storage
            .from("instagram-creatives")
            .getPublicUrl(audioFilePath);
          publicAudioUrl = pubAudioData?.publicUrl || null;
        }
      }
    } catch (e) {
      console.warn("[CharacterStory] Audio storage upload warning:", e.message);
    }

    // 3c. Optional: Live Talking Avatar via Replicate SadTalker
    let liveTalkingVideoUrl = null;
    let talkingAvatarNotice = null;

    if (animationStyle === "live_talking_head" && publicAudioUrl && character.referenceSheetUrl) {
      console.log(`[CharacterStory] Triggering SadTalker lip-sync on Replicate for "${character.name}"...`);
      try {
        liveTalkingVideoUrl = await generateTalkingAvatar({
          imageUrl: character.referenceSheetUrl,
          audioUrl: publicAudioUrl,
        });
        console.log("[CharacterStory] SadTalker lip-sync completed:", liveTalkingVideoUrl);
      } catch (lipErr) {
        console.warn("[CharacterStory] Lip-sync generation notice:", lipErr.message);
        if (lipErr.message.includes("REPLICATE_BILLING_REQUIRED")) {
          talkingAvatarNotice = "Replicate billing setup required: Please activate billing at replicate.com/account/billing. Video generated with multi-scene visuals.";
        } else {
          talkingAvatarNotice = `Lip-sync notice: ${lipErr.message}. Generated with multi-scene visuals.`;
        }
      }
    }

    // 4. Build Timed Scenes (Client Media, Talking Video, or gpt-image-2 Scene Generation)
    const sceneDuration = targetDuration / storyResult.scenes.length;
    const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

    console.log(`[CharacterStory] Building ${storyResult.scenes.length} scenes (mode: ${scriptMode}, anim: ${animationStyle})...`);

    const finalScenes = await Promise.all(
      storyResult.scenes.map(async (s, idx) => {
        // If Live Talking Avatar was successfully generated, use the speaking video file
        if (liveTalkingVideoUrl) {
          return {
            sceneIndex: idx,
            chapter: s.chapter || `Part ${idx + 1}`,
            text: s.narration,
            visualDescription: s.visualDescription,
            startSec: Math.round(idx * sceneDuration * 10) / 10,
            endSec: Math.round((idx + 1) * sceneDuration * 10) / 10,
            videoUrl: liveTalkingVideoUrl,
            previewImage: character.referenceSheetUrl,
            isClientVideo: true,
            isTalkingAvatarVideo: true,
            characterName: character.name,
          };
        }

        let sceneVisualUrl = character.referenceSheetUrl;
        let isClientVideo = false;

        if (scriptMode === "business_media" && clientMedia.length > 0) {
          // Use user's own uploaded factory / product media
          const mediaItem = clientMedia[idx % clientMedia.length];
          sceneVisualUrl = mediaItem.url;
          isClientVideo = mediaItem.type === "video";
        } else if (process.env.OPENAI_API_KEY) {
          // Generate dedicated AI scene visual with gpt-image-2
          try {
            const companionPrompt = companion ? `Companion: ${companion.name} (${companion.visualTraits || "ally"}).` : "";
            const isPhotoreal = ["photoreal_human", "hollywood_cinema", "indian_cinema", "documentary_realism"].includes(character.archetype);

            const stylePromptPrefix = isPhotoreal
              ? "Award-winning cinematic 35mm Hollywood film still photograph."
              : "Cinematic animated movie still frame.";

            const styleDetails = isPhotoreal
              ? "Hyper-realistic living human characters, authentic skin pores, lifelike natural eyes with reflections, 35mm Arri Alexa cinema still, 8k resolution, dramatic cinematic studio lighting, shallow depth of field, zero cartoon or plastic CGI artifacts."
              : `Style: ${character.archetype || "3D Pixar Disney animation"}, expressive emotion, vibrant cinematic lighting, studio animation still, masterpiece.`;

            const scenePrompt = `${stylePromptPrefix} Main Character: ${character.name} (${character.visualTraits}). ${companionPrompt} Action & setting: ${s.visualDescription}. ${styleDetails}`;
            
            const imgGen = await openai.images.generate({
              model: imageModel,
              prompt: scenePrompt,
              n: 1,
              size: "1024x1024",
            });

            const imgData = imgGen.data?.[0];
            let imgBuf = null;
            if (imgData?.b64_json) {
              imgBuf = Buffer.from(imgData.b64_json, "base64");
            } else if (imgData?.url) {
              const fetchImg = await fetch(imgData.url);
              if (fetchImg.ok) imgBuf = Buffer.from(await fetchImg.arrayBuffer());
            }

            if (imgBuf) {
              const filename = `scene_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}.png`;
              try {
                const mb = await uploadToMediaBridge({
                  filename,
                  buffer: imgBuf,
                  userEmail,
                });
                sceneVisualUrl = mb.url;
              } catch (mbErr) {
                console.warn(`[CharacterStory] Scene ${idx + 1} Media Bridge fallback:`, mbErr.message);
                const filePath = `scenes/${filename}`;
                const { error: upErr } = await supabase.storage
                  .from("instagram-creatives")
                  .upload(filePath, imgBuf, { contentType: "image/png", upsert: true });

                if (!upErr) {
                  const { data: pubData } = supabase.storage
                    .from("instagram-creatives")
                    .getPublicUrl(filePath);
                  sceneVisualUrl = pubData.publicUrl;
                }
              }
            }
          } catch (sceneErr) {
            console.warn(`[CharacterStory] Scene ${idx + 1} image synthesis warning:`, sceneErr.message);
          }
        }

        return {
          sceneIndex: idx,
          chapter: s.chapter || `Part ${idx + 1}`,
          text: s.narration,
          visualDescription: s.visualDescription,
          startSec: Math.round(idx * sceneDuration * 10) / 10,
          endSec: Math.round((idx + 1) * sceneDuration * 10) / 10,
          videoUrl: sceneVisualUrl,
          previewImage: sceneVisualUrl,
          isClientVideo,
          characterName: character.name,
        };
      })
    );

    // 5. Generate Word-Level Subtitle Timings
    const words = fullScriptText.split(/\s+/).filter(Boolean);
    const wordDuration = targetDuration / Math.max(words.length, 1);
    const captions = words.map((w, idx) => ({
      word: w.toUpperCase(),
      original: w,
      startTime: Math.round(idx * wordDuration * 100) / 100,
      endTime: Math.round((idx + 1) * wordDuration * 100) / 100,
    }));

    const responsePayload = {
      ok: true,
      character,
      companion,
      format,
      narrativeType,
      scriptMode,
      animationStyle,
      isTalkingAvatarVideo: !!liveTalkingVideoUrl,
      warning: talkingAvatarNotice,
      vocalEmotion,
      aspectRatio: isLongForm ? "16:9" : "9:16",
      title: storyResult.title || episodeTitle,
      youtubeTitle: storyResult.youtubeTitle || storyResult.title,
      description: storyResult.description,
      totalDuration: targetDuration,
      scenes: finalScenes,
      captions,
      voiceoverAudio: voiceoverBase64,
      backgroundMusicUrl: vocalEmotion === "poetic_shayar" ? "/audio/meditation_flute.mp3" : "/audio/upbeat_lofi.mp3",
    };

    console.log(`[CharacterStory] Generated "${storyResult.title}" (${format}, ${scriptMode}) with ${finalScenes.length} scenes for ${character.name}`);
    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error("[CharacterStory] Error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Failed to generate character story." });
  }
}

export const config = {
  maxDuration: 60,
};
