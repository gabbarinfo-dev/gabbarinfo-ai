// pages/api/tiktok/generate-creative.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { supabaseServer } from "../../../lib/supabaseServer";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 10 Diverse High-Converting Topic Concepts for South Asian Jewellery
const DEFAULT_10_TOPICS = [
  {
    id: "kundan_bridal_choker",
    title: "👑 Royal Kundan Bridal Choker Set",
    desc: "Handcrafted uncut polki & emerald choker engineered for regal bride entrances.",
    tag: "Bridal Edit",
  },
  {
    id: "american_diamond_necklace",
    title: "💎 High-Sheen AD Cocktail Necklace",
    desc: "Rhodium-finished dazzling diamond set tailored for black-tie evening galas.",
    tag: "Partywear Glam",
  },
  {
    id: "artisanal_chandbalis",
    title: "🌸 Artisanal Chandbalis & Jhumkas",
    desc: "Lightweight statement earrings intricately crafted for festive & sangeet looks.",
    tag: "Festive Collection",
  },
  {
    id: "regal_polki_kadas",
    title: "✨ Regal Polki Kada Bangles",
    desc: "Heritage Jaipur artistry blended with contemporary London luxury styling.",
    tag: "Heritage Luxury",
  },
  {
    id: "statement_hasli_necklace",
    title: "🦚 Handcrafted Meenakari Hasli",
    desc: "Rigid torque choker with reverse-enamel peacock artistry & pearl clusters.",
    tag: "Royal Hasli",
  },
  {
    id: "diamond_mangalsutra",
    title: "💍 Modern Diamond Mangalsutra",
    desc: "Minimalist dual-chain 18k design crafted for contemporary working brides.",
    tag: "Everyday Chic",
  },
  {
    id: "temple_jewellery_harams",
    title: "🛕 Antique Temple Gold Haram",
    desc: "Deep nakshi carving featuring Goddess Lakshmi motifs and ruby cabochons.",
    tag: "Traditional Temple",
  },
  {
    id: "cocktail_passa_maangtikka",
    title: "🌙 Bridal Maang Tikka & Passa Set",
    desc: "Nawabi side-hair ornament & forehead pendant for majestic bridal profiles.",
    tag: "Bridal Accents",
  },
  {
    id: "chunky_statement_ring",
    title: "✨ Oversized Mirror Polki Finger Ring",
    desc: "Adjustable royal cocktail ring with floral cluster perimeter and glowing foil back.",
    tag: "Cocktail Edit",
  },
  {
    id: "delicate_choker_layering",
    title: "🎀 Layered Velvet Choker & Rani Haar",
    desc: "Multi-strand layering guide combining short collar chokers with long royal pearls.",
    tag: "Styling Hack",
  },
];

/**
 * Generate a single high-quality bespoke image using GabbarInfo AI's approved gpt-image-2 pipeline
 */
async function generateGptImage(prompt, userEmail = "admin") {
  const candidateModels = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1", "dall-e-3"];
  let imageBuffer = null;
  let modelUsed = null;

  for (const model of candidateModels) {
    try {
      console.log(`[TikTok AI] Generating bespoke visual with ${model}...`);
      const response = await Promise.race([
        openai.images.generate({
          model,
          prompt,
          size: "1024x1024",
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after 42s for model ${model}`)), 42000)
        ),
      ]);

      if (response?.data?.[0]?.b64_json) {
        imageBuffer = Buffer.from(response.data[0].b64_json, "base64");
      } else if (response?.data?.[0]?.url) {
        const fetchRes = await fetch(response.data[0].url);
        imageBuffer = Buffer.from(await fetchRes.arrayBuffer());
      }

      if (imageBuffer && imageBuffer.length > 0) {
        modelUsed = model;
        console.log(`[TikTok AI] Successfully generated visual using ${model} (${imageBuffer.length} bytes)`);
        break;
      }
    } catch (err) {
      console.warn(`[TikTok AI] Model ${model} failed (${err.message}), trying next model...`);
    }
  }

  if (!imageBuffer) {
    throw new Error("AI image generation with gpt-image-2 failed to generate visual buffer.");
  }

  // Upload to Supabase Storage: instagram-creatives bucket
  const fileName = `tt_gpt_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
  const { error: uploadErr } = await supabaseServer.storage
    .from("instagram-creatives")
    .upload(fileName, imageBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (uploadErr) {
    throw new Error(`Supabase upload failed: ${uploadErr.message}`);
  }

  const { data: pubData } = supabaseServer.storage
    .from("instagram-creatives")
    .getPublicUrl(fileName);

  return pubData.publicUrl;
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email || "ndantare@gmail.com";

  const { action } = req.query || req.body || {};

  const businessName = req.body?.businessName || "Bella & Diva Jewellery";
  const niche =
    req.body?.niche ||
    "Imitation jewellery, Kundan jewellery, Bridal, Partywear, Casual, American Diamond and Festive jewellery seller based in London";

  // ACTION 1: SUGGEST / REFRESH 10 FRESH TOPICS
  if (action === "suggest-topics" || action === "refresh-topics" || req.method === "GET") {
    try {
      let modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
      if (modelName.includes("models/")) modelName = modelName.replace("models/", "");

      const model = genAI.getGenerativeModel({ model: modelName });
      const prompt = `
You are the elite creative director for "${businessName}" specializing in: ${niche}.
Generate 10 fresh, viral, high-converting TikTok post topic ideas.
Include a diverse mix of Kundan, American Diamond, Bridal, Chandbalis/Jhumkas, Festive Bangles, Mangalsutras, and London Styling Tips.

Output JSON ONLY as an array of 10 objects:
[
  {
    "id": "slug_id",
    "title": "Emoji + Catchy Title (under 45 characters)",
    "desc": "1-sentence customer benefit or hook",
    "tag": "Category Tag (e.g. Bridal Edit, Gala Glam, Festive, Heritage, Everyday Chic, Styling Hack)"
  }
]
`;
      const aiRes = await model.generateContent(prompt);
      const text = aiRes.response.text().trim().replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
      const topics = JSON.parse(text);

      if (Array.isArray(topics) && topics.length >= 6) {
        return res.status(200).json({ ok: true, topics });
      }
    } catch (e) {
      console.warn("[TikTok Topics Suggestion Warning]:", e.message);
    }

    return res.status(200).json({
      ok: true,
      topics: DEFAULT_10_TOPICS,
    });
  }

  // ACTION 2: GENERATE POST CONTENT & BESPOKE GPT-IMAGE-2 VISUALS
  const {
    topic = "Royal Kundan Bridal Choker Set",
    format = "CAROUSEL", // "CAROUSEL" | "REEL"
  } = req.body || {};

  try {
    let modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    if (modelName.includes("models/")) modelName = modelName.replace("models/", "");

    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `
You are the master creative director and copywriter for "${businessName}", an elite South Asian jewellery brand in London specializing in:
${niche}.

The user selected topic: "${topic}".
Content Format: ${format === "CAROUSEL" ? "Photo Carousel Slideshow (2 Slides)" : "Vertical Video Reel"}.

Generate a JSON object with:
1. "title": Short catchy title under 70 characters (Strict limit for TikTok).
2. "caption": A breathtaking, viral TikTok caption (120-180 words) featuring:
   - Irresistible hook (e.g., "The bridal glow everyone will be talking about ✨")
   - Focus on craftsmanship, intricate setting, lightweight feel, and royal aesthetics.
   - Clear CTA to "DM us to order or customize from London! Worldwide shipping available ✨"
   - STRICT RULE: DO NOT INCLUDE ANY RAW URLS (no http or www links) because TikTok Content Sharing Guidelines strictly ban raw URLs in API posts!
   - 4 to 6 trending hashtags (#bellandiva #kundan #bridaljewellery #londonjewellery #southasianbride #jewellerygoals).
3. "image_prompt_1": A vivid, photorealistic prompt for an AI image generator to create Slide 1. Must specify high-end commercial jewellery studio photography of ${topic}, handcrafted polki kundan gemstones, displayed on dark emerald/black velvet neck mannequin, warm dramatic lighting, 8k catalogue quality, no text on image.
4. "image_prompt_2": A vivid, photorealistic prompt for an AI image generator to create Slide 2. Must specify a macro close-up detail shot of ${topic}, showcasing intricate gold finish, hand-set gemstones, exquisite craftsmanship, 8k catalogue quality, no text on image.

OUTPUT RAW JSON ONLY (no markdown blocks, no commentary):
{
  "title": "...",
  "caption": "...",
  "image_prompt_1": "...",
  "image_prompt_2": "..."
}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleanJson = text.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(cleanJson);

    // Filter and sanitize caption: Remove any accidental raw URLs to guarantee TikTok compliance
    let cleanCaption = (parsed.caption || "")
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/www\.\S+/gi, "")
      .trim();

    // GENERATE 2 BESPOKE SLIDES USING GPT-IMAGE-2
    let generatedImages = [];
    try {
      console.log(`[TikTok AI] Generating 2 bespoke visual slides with gpt-image-2 for: "${topic}"...`);
      const [img1Res, img2Res] = await Promise.allSettled([
        generateGptImage(
          parsed.image_prompt_1 ||
            `Luxury commercial jewellery studio photo of ${topic}, handcrafted polki gemstones on black velvet neck mannequin, warm cinematic lighting, 8k catalogue quality`,
          email
        ),
        generateGptImage(
          parsed.image_prompt_2 ||
            `Macro detail close-up of ${topic} jewellery craftsmanship, sparkling faceted gemstones, pristine gold setting, 8k commercial catalogue`,
          email
        ),
      ]);

      if (img1Res.status === "fulfilled" && img1Res.value) {
        generatedImages.push(img1Res.value);
      } else {
        console.warn("[TikTok AI] Slide 1 generation warning:", img1Res.reason?.message);
      }

      if (img2Res.status === "fulfilled" && img2Res.value) {
        generatedImages.push(img2Res.value);
      } else {
        console.warn("[TikTok AI] Slide 2 generation warning:", img2Res.reason?.message);
      }
    } catch (genErr) {
      console.warn("[TikTok AI Image Generation Exception]:", genErr.message);
    }

    // If only one slide succeeded, pair it with itself so TikTok carousel requirement (>= 2 images) is satisfied with the genuine AI visual
    if (generatedImages.length === 1) {
      generatedImages.push(generatedImages[0]);
    }

    if (generatedImages.length === 0) {
      // Last-resort attempt: generate a single bespoke gpt-image-2 visual
      console.log("[TikTok AI] Retrying single bespoke image generation...");
      const singleImg = await generateGptImage(
        `Commercial South Asian luxury jewellery catalog photo of ${topic}, stunning studio lighting, 8k`,
        email
      );
      generatedImages = [singleImg, singleImg];
    }

    return res.status(200).json({
      ok: true,
      title: parsed.title || `Bespoke ${topic} ✨ Bella & Diva`,
      caption: cleanCaption,
      images: generatedImages,
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      format,
      topic,
    });
  } catch (err) {
    console.error("[TikTok AI Generate Creative Error]:", err);
    return res.status(500).json({
      ok: false,
      error: `AI Generation Error: ${err.message}. Please click 'Generate Post with AI' to re-synthesize.`,
    });
  }
}
