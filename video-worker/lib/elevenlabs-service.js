// video-worker/lib/elevenlabs-service.js
/**
 * ElevenLabs High-Fidelity Voice Synthesis Service for Railway Video Worker (CommonJS)
 * Supports: Hindi, American English, British English, and character voice matching.
 * Graceful fallback to OpenAI TTS (model: "tts-1") if quota is depleted or network error occurs.
 */

const ELEVENLABS_VOICES = {
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

const VOICE_MAP = {
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

function resolveElevenLabsVoiceId({ language = "en_us", gender = "male", voice = null }) {
  const normLang = (language || "").toLowerCase().replace("-", "_");
  const langKey = normLang.includes("hi") || normLang.includes("hindi")
    ? "hindi"
    : normLang.includes("uk") || normLang.includes("gb") || normLang.includes("british")
    ? "en_uk"
    : "en_us";

  if (voice) {
    const vKey = String(voice).toLowerCase().trim();
    if (voice.length >= 18 && !voice.includes(" ")) {
      return voice;
    }
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

async function generateStudioSpeech({
  text,
  language = "en_us",
  gender = "male",
  voiceId = null,
  openai = null,
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
      console.log(`[ElevenLabs] Synthesizing speech (${language}, ${gender}) using ElevenLabs voice ${targetVoice}...`);

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
      console.warn(`[ElevenLabs] Returned ${res.status}: ${errText}, falling back to OpenAI TTS...`);
    } catch (elevenErr) {
      console.warn("[ElevenLabs] Error:", elevenErr.message, "- falling back to OpenAI TTS...");
    }
  }

  // Graceful Fallback: OpenAI TTS (model: "tts-1")
  if (openai || process.env.OPENAI_API_KEY) {
    try {
      const aiInstance = openai || new (require("openai"))({ apiKey: process.env.OPENAI_API_KEY });
      const openaiVoice = gender === "female" ? "shimmer" : "onyx";

      const mp3Res = await aiInstance.audio.speech.create({
        model: "tts-1",
        voice: openaiVoice,
        input: cleanText,
        response_format: "mp3",
      });

      const buffer = Buffer.from(await mp3Res.arrayBuffer());
      return { ok: true, buffer, provider: "openai" };
    } catch (openaiErr) {
      console.error("[OpenAI TTS] Fallback error:", openaiErr.message);
      return { ok: false, error: openaiErr.message };
    }
  }

  return { ok: false, error: "No voice synthesis credentials available." };
}

module.exports = {
  ELEVENLABS_VOICES,
  VOICE_MAP,
  resolveElevenLabsVoiceId,
  generateStudioSpeech,
};
