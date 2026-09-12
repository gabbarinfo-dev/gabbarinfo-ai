// pages/api/character/create.js
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
    return res.status(401).json({ ok: false, error: "Please log in to create private characters." });
  }

  const {
    name = "Hero Character",
    archetype = "pixar_3d",
    backstory = "",
    visualTraits = "distinct hairstyle, signature vibrant jacket, expressive eyes",
    voice = "nova",
  } = req.body;

  try {
    // 1. Build style prompt anchor for consistency
    const styleAnchors = {
      pixar_3d: "3D Pixar Disney animation style, smooth subsurface scattering, expressive large eyes, charming friendly facial proportions, vibrant cinematic studio lighting, octane render, 8k",
      anime_2d: "High-end 2D anime illustration, Makoto Shinkai style, crisp lineart, cel shading, rich emotional depth, vibrant color palette, anime key visual",
      storybook_kids: "Whimsical children's picture book illustration, soft watercolor and gouache textures, adorable character design, gentle warm lighting, nostalgic storybook art",
      cyberpunk: "Futuristic cyberpunk character, neon reflections, sleek cybernetic accents, high tech apparel, moody cinematic atmospheric lighting, unreal engine 5 render",
      photoreal_mascot: "Photorealistic live-action brand mascot, ultra-detailed fur/skin texture, friendly charismatic presence, studio commercial portrait, 85mm lens f/1.4",
    };

    const chosenStyle = styleAnchors[archetype] || styleAnchors.pixar_3d;
    const prompt = `Full body character turnaround concept art of ${name}: ${visualTraits}. ${chosenStyle}. Character shown in neutral pose with front view, clear facial features, highly distinctive consistent design, solid clean background.`;

    let referenceSheetUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80";

    // 2. Generate Master Reference Image via DALL-E 3
    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const imgGen = await openai.images.generate({
          model: "dall-e-3",
          prompt,
          n: 1,
          size: "1024x1024",
          quality: "hd",
        });

        if (imgGen.data?.[0]?.url) {
          referenceSheetUrl = imgGen.data[0].url;
        }
      } catch (genErr) {
        console.warn("[CharacterCreate] DALL-E generation warning, using archetype fallback:", genErr.message);
      }
    }

    const characterId = `char_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const characterData = {
      id: characterId,
      name,
      archetype,
      backstory,
      visualTraits,
      voice,
      referenceSheetUrl,
      promptAnchor: prompt,
      createdAt: new Date().toISOString(),
      episodesCount: 0,
      isPrivate: true,
      ownerEmail: userEmail,
    };

    // 3. Save into Supabase agent_memory with memory_type = "client_character"
    const { error: dbError } = await supabase.from("agent_memory").insert({
      email: userEmail,
      memory_type: "client_character",
      content: JSON.stringify(characterData),
      updated_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error("[CharacterCreate] Database save error:", dbError);
      throw dbError;
    }

    console.log(`[CharacterCreate] Created private character IP "${name}" (${characterId}) for ${userEmail}`);
    return res.status(200).json({
      ok: true,
      character: characterData,
    });
  } catch (err) {
    console.error("[CharacterCreate] Fatal error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Failed to create character." });
  }
}
