// lib/video/voiceover.js
import OpenAI from "openai";

/**
 * Generates an MP3 voiceover using OpenAI TTS and calculates word timing markers.
 */
export async function generateVoiceover({ text, voice = "nova", speed = 1.05 }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY for voiceover generation.");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const validVoices = ["nova", "onyx", "alloy", "fable", "shimmer", "echo"];
  const chosenVoice = validVoices.includes(voice.toLowerCase()) ? voice.toLowerCase() : "nova";

  const mp3Response = await openai.audio.speech.create({
    model: "tts-1",
    voice: chosenVoice,
    input: text,
    speed: Math.max(0.8, Math.min(1.3, speed)),
    response_format: "mp3",
  });

  const arrayBuffer = await mp3Response.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);

  // Approximate duration: MP3 at 128kbps is ~16,000 bytes per second
  const estimatedSeconds = Math.max(3, Math.round((audioBuffer.length / 16000) * 10) / 10);

  // Compute word-level timing markers for animated glowing captions
  const words = text.split(/\s+/).filter(Boolean);
  const durationPerWord = words.length > 0 ? estimatedSeconds / words.length : 0.3;

  const timedWords = words.map((w, index) => ({
    word: w.replace(/^[^\w]+|[^\w]+$/g, ""),
    original: w,
    startTime: Math.round(index * durationPerWord * 100) / 100,
    endTime: Math.round((index + 1) * durationPerWord * 100) / 100,
  }));

  const audioBase64 = `data:audio/mp3;base64,${audioBuffer.toString("base64")}`;

  return {
    audioBuffer,
    audioBase64,
    voice: chosenVoice,
    duration: estimatedSeconds,
    timedWords,
  };
}
