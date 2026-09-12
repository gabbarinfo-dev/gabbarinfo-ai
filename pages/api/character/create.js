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
      comic_hero: "Bold modern comic book art style, Spider-Verse / Marvel graphic novel aesthetic, dynamic ink lines, vibrant halftone screen tones, heroic character turnaround, 8k",
      pixar_3d: "3D Pixar Disney animation style, smooth subsurface scattering, expressive large eyes, charming friendly facial proportions, vibrant cinematic studio lighting, octane render, 8k",
      anime_2d: "High-end 2D anime illustration, Makoto Shinkai style, crisp lineart, cel shading, rich emotional depth, vibrant color palette, anime key visual",
      storybook_kids: "Whimsical children's picture book illustration, soft watercolor and gouache textures, adorable character design, gentle warm lighting, nostalgic storybook art",
      cyberpunk: "Futuristic cyberpunk character, neon reflections, sleek cybernetic accents, high tech apparel, moody cinematic atmospheric lighting, unreal engine 5 render",
      photoreal_mascot: "Photorealistic live-action brand mascot, ultra-detailed fur/skin texture, friendly charismatic presence, studio commercial portrait, 85mm lens f/1.4",
    };

    const chosenStyle = styleAnchors[archetype] || styleAnchors.pixar_3d;
    // 2. Refine Prompt with GPT-4o for Maximum Visual Precision
    let finalPrompt = `Full body character turnaround concept art of ${name}: ${visualTraits}. ${chosenStyle}. Character shown in neutral pose with front view and 3/4 view, clear facial features, highly distinctive consistent design, solid clean background.`;

    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const refiner = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content: "You are an expert prompt engineer for Disney, Pixar, and Hollywood animation character sheets. Expand the user's description into a detailed, visually clear prompt specifying gender, age, clothing (cleanly fixing any typos), facial expressions, hair, and style turnaround. Keep it under 80 words. Return ONLY the prompt text.",
            },
            {
              role: "user",
              content: `Character Name: ${name}\nArchetype: ${chosenStyle}\nTraits: ${visualTraits}\nBackstory: ${backstory || "None"}`,
            },
          ],
        });
        const refined = refiner.choices[0]?.message?.content?.trim();
        if (refined) {
          finalPrompt = `${refined}. ${chosenStyle}. Front view turnaround concept art, highly consistent design, solid neutral background.`;
        }
      } catch (e) {
        console.warn("[CharacterCreate] Prompt refiner warning:", e.message);
      }
    }

    // 3. Generate Master Character Reference via gpt-image-2
    let referenceSheetUrl = null;
    const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

    if (process.env.OPENAI_API_KEY) {
      try {
        console.log(`[CharacterCreate] Generating master character turnaround using ${imageModel}...`);
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const imgGen = await openai.images.generate({
          model: imageModel,
          prompt: finalPrompt,
          n: 1,
          size: "1024x1024",
        });

        const imgData = imgGen.data?.[0];
        let imgBuffer = null;

        if (imgData?.b64_json) {
          imgBuffer = Buffer.from(imgData.b64_json, "base64");
        } else if (imgData?.url) {
          const fetchImg = await fetch(imgData.url);
          if (fetchImg.ok) {
            imgBuffer = Buffer.from(await fetchImg.arrayBuffer());
          } else {
            referenceSheetUrl = imgData.url;
          }
        }

        if (imgBuffer) {
          const filename = `char_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.png`;
          const filePath = `characters/${filename}`;

          const { error: upErr } = await supabase.storage
            .from("instagram-creatives")
            .upload(filePath, imgBuffer, { contentType: "image/png", upsert: true });

          if (!upErr) {
            const { data: pubData } = supabase.storage
              .from("instagram-creatives")
              .getPublicUrl(filePath);
            referenceSheetUrl = pubData.publicUrl;
            console.log(`[CharacterCreate] Successfully uploaded master character to CDN: ${referenceSheetUrl}`);
          }
        }
      } catch (genErr) {
        console.error(`[CharacterCreate] ${imageModel} generation failed:`, genErr.message);
      }
    }

    if (!referenceSheetUrl) {
      throw new Error("Unable to synthesize character visual. Please check API key credits.");
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

    // 3. Save into Supabase agent_memory with unique memory_type per character
    const memoryType = `client_character_${characterId}`;
    const { error: dbError } = await supabase.from("agent_memory").upsert({
      email: userEmail,
      memory_type: memoryType,
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
