// lib/video/elevenlabs-service.js
/**
 * ElevenLabs High-Fidelity Voice Synthesis Service
 * Supports: Hindi, American English, British English, and character voice matching.
 * Graceful fallback to OpenAI TTS-HD if quota is depleted or network error occurs.
 */

import OpenAI from "openai";

// Curated high-converting ElevenLabs default voices
export const ELEVENLABS_VOICES = {
  // US Voices
  en_us_male: "pNInz6obpgDQGcFmaJgB",     // Adam - Deep, engaging narrator / conversational
  en_us_female: "21m00Tcm4TlvDq8ikWAM",   // Rachel - Warm, professional American female
  en_us_young: "AZnzlk1XvdvUeBnXmlld",    // Domi - Energetic youthful female

  // UK Voices
  en_uk_male: "JBFqnCBsd6RMkjVDRZzb",     // George - Refined British gentleman
  en_uk_female: "pFZP5JQG7iQjIQuC4Bku",   // Lily - Articulate British female

  // Hindi Multilingual Voices (eleven_multilingual_v2 natively handles Hindi devanagari & hinglish)
  hindi_male: "VR6AewLTigWG4xSOukaG",     // Arnold / Multilingual deep male
  hindi_female: "LcfcDJNUP1GQjkzn1xUU",   // Emily / Multilingual warm female
};

/**
 * Resolve the optimal ElevenLabs voice ID based on language, gender, and cadence.
 */
export function resolveElevenLabsVoiceId({ language = "en_us", gender = "male", voice = null }) {
  const normLang = (language || "").toLowerCase().replace("-", "_");

  if (normLang.includes("hi") || normLang.includes("hindi")) {
    return gender === "female" ? ELEVENLABS_VOICES.hindi_female : ELEVENLABS_VOICES.hindi_male;
  }
  if (normLang.includes("uk") || normLang.includes("gb") || normLang.includes("british")) {
    return gender === "female" ? ELEVENLABS_VOICES.en_uk_female : ELEVENLABS_VOICES.en_uk_male;
  }

  // Default to US
  return gender === "female" ? ELEVENLABS_VOICES.en_us_female : ELEVENLABS_VOICES.en_us_male;
}

/**
 * Generate studio-grade speech audio buffer via ElevenLabs.
 * @param {object} params
 * @param {string} params.text - Dialogue or narrative text to speak
 * @param {string} [params.language="en_us"] - "hindi" | "en_us" | "en_uk"
 * @param {"male"|"female"} [params.gender="male"]
 * @param {string} [params.voiceId] - Specific voice ID if desired
 * @returns {Promise<{ ok: boolean, buffer?: Buffer, provider: "elevenlabs" | "openai", error?: string }>}
 */
export async function generateStudioSpeech({
  text,
  language = "en_us",
  gender = "male",
  voiceId = null,
}) {
  if (!text || !text.trim()) {
    return { ok: false, error: "Empty text for speech synthesis" };
  }

  const cleanText = text.trim();
  const elevenApiKey = process.env.ELEVENLABS_API_KEY;

  if (elevenApiKey) {
    try {
      const targetVoice = voiceId || resolveElevenLabsVoiceId({ language, gender });
      console.log(`[ElevenLabs] Synthesizing speech (${language}, ${gender}) using voice ${targetVoice}...`);

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
        console.log(`[ElevenLabs] Successfully generated speech (${buffer.length} bytes)`);
        return { ok: true, buffer, provider: "elevenlabs" };
      }

      const errText = await res.text();
      console.warn(`[ElevenLabs] Request returned ${res.status}: ${errText}, falling back to OpenAI TTS-HD...`);
    } catch (elevenErr) {
      console.warn("[ElevenLabs] Synthesis error:", elevenErr.message, "- trying OpenAI TTS fallback...");
    }
  }

  // Graceful Fallback: OpenAI TTS-1-HD
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const openaiVoice = gender === "female" ? "shimmer" : "onyx";
      console.log(`[OpenAI TTS] Generating fallback speech via tts-1-hd (${openaiVoice})...`);

      const mp3Res = await openai.audio.speech.create({
        model: "tts-1-hd",
        voice: openaiVoice,
        input: cleanText,
        response_format: "mp3",
      });

      const buffer = Buffer.from(await mp3Res.arrayBuffer());
      return { ok: true, buffer, provider: "openai" };
    } catch (openaiErr) {
      console.error("[OpenAI TTS] Fallback also failed:", openaiErr.message);
      return { ok: false, error: `Speech generation failed: ${openaiErr.message}` };
    }
  }

  return { ok: false, error: "No voice synthesis API keys configured (ElevenLabs or OpenAI)." };
}
