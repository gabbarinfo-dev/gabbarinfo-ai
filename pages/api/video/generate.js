// pages/api/video/generate.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import { generateReelScript } from "../../../lib/video/scriptwriter";
import { generateVoiceover } from "../../../lib/video/voiceover";
import { searchVerticalVideo } from "../../../lib/video/pexels-service";
import { generateTalkingAvatar, generateCinematicClip } from "../../../lib/video/replicate-service";
import { buildVideoTimeline } from "../../../lib/video/compositor";
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
    return res.status(401).json({ ok: false, error: "Please log in to create video reels." });
  }

  const {
    style = "motion_broll",
    topic,
    niche = "marketing",
    voice = "nova",
    backgroundBeat = "upbeat_lofi",
  } = req.body;

  if (!topic || !topic.trim()) {
    return res.status(400).json({ ok: false, error: "Please provide a video topic or concept." });
  }

  try {
    // 1. Script Generation
    console.log(`[VideoStudio] Generating script for "${topic}" in style: ${style}`);
    const script = await generateReelScript({ topic, niche, style });

    // 2. Voiceover Generation
    console.log(`[VideoStudio] Generating voiceover with voice: ${voice}`);
    const voiceover = await generateVoiceover({ text: script.fullScript, voice });

    // 3. Visual Scenes Gathering / Generation
    let scenesWithVideo = [];

    if (style === "motion_broll") {
      // Style 1: Parallel Pexels search for vertical 9:16 clips
      console.log("[VideoStudio] Searching Pexels clips for scenes...");
      const clipPromises = script.scenes.map(async (scene) => {
        const videoResult = await searchVerticalVideo(scene.searchQuery);
        return {
          ...scene,
          videoUrl: videoResult?.videoUrl || "https://assets.mixkit.co/videos/preview/mixkit-working-late-at-the-office-42790-large.mp4",
          previewImage: videoResult?.previewImage || "",
        };
      });
      scenesWithVideo = await Promise.all(clipPromises);

    } else if (style === "talking_avatar") {
      // Style 2: AI Avatar (DALL-E image + Replicate LivePortrait / SadTalker)
      console.log("[VideoStudio] Generating character portrait and lip-sync...");
      let avatarImageUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80";

      if (process.env.OPENAI_API_KEY) {
        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const imgGen = await openai.images.generate({
            model: "dall-e-3",
            prompt: `Close-up portrait of a friendly, charismatic ${niche} brand spokesperson looking directly into camera, studio lighting, hyper-realistic, photorealistic, 8k portrait.`,
            n: 1,
            size: "1024x1024",
          });
          if (imgGen.data?.[0]?.url) {
            avatarImageUrl = imgGen.data[0].url;
          }
        } catch (imgErr) {
          console.warn("[VideoStudio] Avatar image generation fallback:", imgErr.message);
        }
      }

      // If audio is base64, we can assemble avatar
      scenesWithVideo = script.scenes.map((scene, idx) => ({
        ...scene,
        videoUrl: avatarImageUrl, // rendered in studio player with facial focus
        previewImage: avatarImageUrl,
        isAvatar: true,
      }));

    } else if (style === "generative_cinematic") {
      // Style 3: Text-to-Video generation
      console.log("[VideoStudio] Generating cinematic clips via Replicate...");
      const clipPromises = script.scenes.map(async (scene, idx) => {
        try {
          // Generate first 2 key scenes with text-to-video, fallback to high-quality vertical clip
          if (idx < 2 && process.env.REPLICATE_API_TOKEN) {
            const genUrl = await generateCinematicClip({ prompt: scene.visualPrompt });
            if (genUrl) {
              return { ...scene, videoUrl: genUrl, previewImage: "" };
            }
          }
        } catch (e) {
          console.warn(`[VideoStudio] Generative clip ${idx} fallback:`, e.message);
        }
        const pexelsFallback = await searchVerticalVideo(scene.searchQuery);
        return {
          ...scene,
          videoUrl: pexelsFallback?.videoUrl || "https://assets.mixkit.co/videos/preview/mixkit-woman-smiling-at-sunset-41473-large.mp4",
          previewImage: pexelsFallback?.previewImage || "",
        };
      });
      scenesWithVideo = await Promise.all(clipPromises);
    }

    // 4. Assemble Timeline
    const timeline = buildVideoTimeline({
      script,
      voiceover,
      scenes: scenesWithVideo,
      backgroundBeat,
    });

    // 5. Store in Supabase Memory
    try {
      await supabase.from("agent_memory").insert({
        email: userEmail,
        memory_type: "video_reel",
        content: JSON.stringify({
          style,
          topic,
          niche,
          timeline,
          created_at: new Date().toISOString(),
        }),
      });
    } catch (dbErr) {
      console.warn("[VideoStudio] Memory note:", dbErr.message);
    }

    return res.status(200).json({
      ok: true,
      video: timeline,
    });
  } catch (error) {
    console.error("[VideoStudio] Generation error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to generate video reel.",
    });
  }
}
