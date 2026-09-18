// lib/video/elevenlabs-service.js
/**
 * ElevenLabs High-Fidelity Voice Synthesis Service
 * Supports: Hindi, American English, British English, and character voice matching.
 * Graceful fallback to OpenAI TTS (tts-1) if quota is depleted or network error occurs.
 */

import OpenAI from "openai";

// Curated high-converting ElevenLabs default voices
export const ELEVENLABS_VOICES = {
  // US Voices
  en_us_male: "pNInz6obpgDQGcFmaJgB",     // Adam - Deep, engaging narrator / conversational
  en_us_female: "21m00Tcm4TlvDq8ikWAM",   // Rachel - Warm, professional American female
  en_us_charlie: "IKne3meq5aSn9XLyUdCD",  // Charlie - Confident Commercial Executive
  en_us_sarah: "EXAVITQu4vr4xnSDxMaL",    // Sarah - Mature Reassuring Authority
  en_us_roger: "CwhRBWXzGAHq8TQ4Fs17",    // Roger - Casual Resonant Storyteller

  // UK Voices
  en_uk_male: "JBFqnCBsd6RMkjVDRZzb",     // George - Refined British gentleman
  en_uk_female: "pFZP5JQG7iQjIQuC4Bku",   // Lily - Articulate British female

  // Hindi Multilingual Voices (eleven_multilingual_v2 natively handles Hindi devanagari & hinglish)
  hindi_male: "VR6AewLTigWG4xSOukaG",     // Arnold / Multilingual deep male
  hindi_female: "LcfcDJNUP1GQjkzn1xUU",   // Emily / Multilingual warm female
};

// Map legacy or shorthand voice names to valid ElevenLabs voice IDs
export const VOICE_MAP = {
  // Legacy OpenAI Voice mappings
  alloy: {
    en_us: "pNInz6obpgDQGcFmaJgB", // Adam
    en_uk: "JBFqnCBsd6RMkjVDRZzb", // George
    hindi: "VR6AewLTigWG4xSOukaG", // Arnold
  },
  onyx: {
    en_us: "IKne3meq5aSn9XLyUdCD", // Charlie
    en_uk: "JBFqnCBsd6RMkjVDRZzb", // George
    hindi: "VR6AewLTigWG4xSOukaG", // Arnold
  },
  nova: {
    en_us: "21m00Tcm4TlvDq8ikWAM", // Rachel
    en_uk: "pFZP5JQG7iQjIQuC4Bku", // Lily
    hindi: "LcfcDJNUP1GQjkzn1xUU", // Emily
  },
  shimmer: {
    en_us: "EXAVITQu4vr4xnSDxMaL", // Sarah
    en_uk: "pFZP5JQG7iQjIQuC4Bku", // Lily
    hindi: "LcfcDJNUP1GQjkzn1xUU", // Emily
  },
  fable: {
    en_us: "JBFqnCBsd6RMkjVDRZzb", // George
    en_uk: "JBFqnCBsd6RMkjVDRZzb", // George
    hindi: "VR6AewLTigWG4xSOukaG", // Arnold
  },
  echo: {
    en_us: "CwhRBWXzGAHq8TQ4Fs17", // Roger
    en_uk: "JBFqnCBsd6RMkjVDRZzb", // George
    hindi: "VR6AewLTigWG4xSOukaG", // Arnold
  },

  // Direct ElevenLabs shorthand names
  adam: "pNInz6obpgDQGcFmaJgB",
  rachel: "21m00Tcm4TlvDq8ikWAM",
  charlie: "IKne3meq5aSn9XLyUdCD",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  roger: "CwhRBWXzGAHq8TQ4Fs17",
  george: "JBFqnCBsd6RMkjVDRZzb",
  lily: "pFZP5JQG7iQjIQuC4Bku",
  arnold: "VR6AewLTigWG4xSOukaG",
  emily: "LcfcDJNUP1GQjkzn1xUU",
};

/**
 * Resolve the optimal ElevenLabs voice ID based on voice name/id, language, and gender.
 */
export function resolveElevenLabsVoiceId({ language = "en_us", gender = "male", voice = null }) {
  const normLang = (language || "").toLowerCase().replace("-", "_");
  const langKey = normLang.includes("hi") || normLang.includes("hindi")
    ? "hindi"
    : normLang.includes("uk") || normLang.includes("gb") || normLang.includes("british")
    ? "en_uk"
    : "en_us";

  if (voice) {
    const vKey = String(voice).toLowerCase().trim();
    // If it's already a full ElevenLabs voice ID (approx 20 chars alphanumeric)
    if (voice.length >= 18 && !voice.includes(" ")) {
      return voice;
    }
    // Shorthand mapping
    if (VOICE_MAP[vKey]) {
      if (typeof VOICE_MAP[vKey] === "string") {
        return VOICE_MAP[vKey];
      }
      return VOICE_MAP[vKey][langKey] || VOICE_MAP[vKey].en_us;
    }
  }

  if (langKey === "hindi") {
    return gender === "female" ? ELEVENLABS_VOICES.hindi_female : ELEVENLABS_VOICES.hindi_male;
  }
  if (langKey === "en_uk") {
    return gender === "female" ? ELEVENLABS_VOICES.en_uk_female : ELEVENLABS_VOICES.en_uk_male;
  }

  return gender === "female" ? ELEVENLABS_VOICES.en_us_female : ELEVENLABS_VOICES.en_us_male;
}

/**
 * Generate studio-grade speech audio buffer via ElevenLabs.
 */
export async function generateStudioSpeech({
  text,
  language = "en_us",
  gender = "male",
  voiceId = null,
  apiKey = null,
}) {
  if (!text || !text.trim()) {
    return { ok: false, error: "Empty text for speech synthesis" };
  }

  const cleanText = text.trim();
  const elevenApiKey = apiKey || process.env.ELEVENLABS_API_KEY;

  if (elevenApiKey) {
    try {
      const targetVoice = resolveElevenLabsVoiceId({ language, gender, voice: voiceId });
      console.log(`[ElevenLabs] Synthesizing studio voiceover (${language}, ${gender}) using ElevenLabs voice ${targetVoice}...`);

      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoice}`, {
        method: "POST",
        headers: {
          "xi-api-key": elevenApiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        console.log(`[ElevenLabs] Successfully generated studio speech (${buffer.length} bytes)`);
        return { ok: true, buffer, provider: "elevenlabs" };
      }

      const errText = await res.text();
      console.warn(`[ElevenLabs] Request returned ${res.status}: ${errText}, falling back to OpenAI TTS...`);
    } catch (elevenErr) {
      console.warn("[ElevenLabs] Synthesis error:", elevenErr.message, "- trying OpenAI TTS fallback...");
    }
  }

  // Graceful Fallback: OpenAI TTS (model: "tts-1-hd" with "tts-1" fallback)
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const openaiVoice = gender === "female" ? "shimmer" : "onyx";
      console.log(`[OpenAI TTS] Generating fallback speech via tts-1-hd (${openaiVoice})...`);

      let mp3Res;
      try {
        mp3Res = await openai.audio.speech.create({
          model: "tts-1-hd",
          voice: openaiVoice,
          input: cleanText,
          response_format: "mp3",
        });
      } catch (hdErr) {
        console.warn("[OpenAI TTS] tts-1-hd error, trying tts-1:", hdErr.message);
        mp3Res = await openai.audio.speech.create({
          model: "tts-1",
          voice: openaiVoice,
          input: cleanText,
          response_format: "mp3",
        });
      }

      const buffer = Buffer.from(await mp3Res.arrayBuffer());
      return { ok: true, buffer, provider: "openai" };
    } catch (openaiErr) {
      console.error("[OpenAI TTS] Fallback also failed:", openaiErr.message);
      return { ok: false, error: `Speech generation failed: ${openaiErr.message}` };
    }
  }

  return { ok: false, error: "No voice synthesis API keys configured (ElevenLabs or OpenAI)." };
}
