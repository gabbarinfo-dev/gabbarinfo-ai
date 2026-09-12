// pages/api/character/story.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

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
    return res.status(401).json({ ok: false, error: "Please log in to create character stories." });
  }

  const {
    characterId,
    format = "reel_9_16", // "reel_9_16" (15-30s vertical) | "youtube_16_9" (3-5 min horizontal story)
    storyPrompt = "A mysterious discovery in the enchanted neon forest",
    episodeTitle = "Episode 1: The First Clue",
  } = req.body;

  try {
    // 1. Fetch Character Data
    const { data: memRows } = await supabase
      .from("agent_memory")
      .select("content")
      .eq("email", userEmail)
      .eq("memory_type", "client_character");

    let character = null;
    if (memRows) {
      for (const row of memRows) {
        const c = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
        if (c.id === characterId) {
          character = c;
          break;
        }
      }
    }

    if (!character) {
      // Default fallback character if none selected
      character = {
        name: "Alex",
        archetype: "pixar_3d",
        visualTraits: "charming blue jacket, expressive eyes, messy brown hair",
        referenceSheetUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80",
        voice: "nova",
      };
    }

    const isLongForm = format === "youtube_16_9";
    const numScenes = isLongForm ? 8 : 4;
    const targetDuration = isLongForm ? 90 : 20; // 90s preview long-form / 20s reel

    // 2. Generate Story Script using GPT-4o
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const systemPrompt = `You are an elite Hollywood animated story director and viral social video strategist.
Character Name: "${character.name}"
Visual Traits: "${character.visualTraits}"
Archetype Style: "${character.archetype}"
Format: ${isLongForm ? "16:9 Cinematic YouTube Long-Form Story" : "9:16 Viral Social Reel"}

Create a captivating, emotionally engaging story episode based on the user's prompt: "${storyPrompt}".
Maintain 100% visual consistency by referencing the character's exact appearance in every scene description.

Return ONLY valid JSON matching this exact structure:
{
  "title": "Short Catchy Episode Title",
  "youtubeTitle": "YouTube Optimized Title with Emotional Hook & Keywords",
  "description": "Engaging description with chapter timestamps and hashtags",
  "scenes": [
    {
      "sceneNumber": 1,
      "chapter": "The Awakening",
      "narration": "Voiceover line spoken for this scene (around 10-15 words)",
      "visualDescription": "Detailed visual of ${character.name} with ${character.visualTraits} doing a specific action in the environment",
      "searchKeyword": "1-2 keywords for cinematic ambient visuals"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate an episode titled "${episodeTitle}". Needs exactly ${numScenes} scenes.` }
      ],
    });

    const storyResult = JSON.parse(completion.choices[0].message.content);

    // 3. Synthesize Voiceover Audio via OpenAI TTS
    const fullScriptText = storyResult.scenes.map((s) => s.narration).join(" ");
    const voiceRes = await openai.audio.speech.create({
      model: "tts-1",
      voice: character.voice || "nova",
      input: fullScriptText,
      response_format: "mp3",
    });

    const voiceBuffer = Buffer.from(await voiceRes.arrayBuffer());
    const voiceoverBase64 = `data:audio/mp3;base64,${voiceBuffer.toString("base64")}`;

    // 4. Build Timed Scenes
    const sceneDuration = targetDuration / storyResult.scenes.length;
    const finalScenes = storyResult.scenes.map((s, idx) => ({
      sceneIndex: idx,
      chapter: s.chapter || `Scene ${idx + 1}`,
      text: s.narration,
      visualDescription: s.visualDescription,
      startSec: Math.round(idx * sceneDuration * 10) / 10,
      endSec: Math.round((idx + 1) * sceneDuration * 10) / 10,
      videoUrl: character.referenceSheetUrl,
      previewImage: character.referenceSheetUrl,
      isAvatar: true,
      characterName: character.name,
    }));

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
      format,
      aspectRatio: isLongForm ? "16:9" : "9:16",
      title: storyResult.title || episodeTitle,
      youtubeTitle: storyResult.youtubeTitle || storyResult.title,
      description: storyResult.description,
      totalDuration: targetDuration,
      scenes: finalScenes,
      captions,
      voiceoverAudio: voiceoverBase64,
      backgroundMusicUrl: "/audio/upbeat_lofi.mp3",
    };

    console.log(`[CharacterStory] Generated "${storyResult.title}" (${format}) with ${finalScenes.length} scenes for ${character.name}`);
    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error("[CharacterStory] Error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Failed to generate character story." });
  }
}
