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

  // ACTION 2: GENERATE CONNECTED BRAND CAMPAIGN (SINGLE IMAGE, 2/3/5 CAROUSEL, OR REEL)
  const {
    topic = "Bespoke Collection Showcase",
    format = "CAROUSEL", // "SINGLE_IMAGE" | "CAROUSEL" | "REEL"
    slideCount = 2, // 1 for SINGLE_IMAGE, or 2, 3, 5 for CAROUSEL
    logoUrl = null,
  } = req.body || {};

  let targetSlides = 2;
  if (format === "SINGLE_IMAGE") {
    targetSlides = 1;
  } else if (format === "CAROUSEL") {
    const requested = Number(slideCount);
    targetSlides = [2, 3, 5].includes(requested) ? requested : 2;
  } else {
    targetSlides = 1;
  }

  try {
    let modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    if (modelName.includes("models/")) modelName = modelName.replace("models/", "");

    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `
You are an award-winning Creative Director & Copywriter developing a finished, high-converting commercial brand advertising campaign for:
Brand Name: "${businessName}"
Industry / Niche: ${niche}
Topic / Focus: "${topic}"
Format: ${format} (${targetSlides} Connected Slide${targetSlides > 1 ? "s" : ""})
${logoUrl ? `Brand Logo: Provided (${logoUrl}) - Anchor brand mark prominently on every slide.` : `Brand Logo: Use official typographic brand monogram for "${businessName}".`}

[CAMPAIGN NARRATIVE BLUEPRINT]
Create a connected, multi-slide promotional campaign promoting "${businessName}".
This is NOT just generic photos of objects; each slide must have a distinct, connected role in driving brand awareness and customer conversion:

${targetSlides === 1 ? `
- Slide 1 (Single Hero Ad Poster): An agency-grade finished commercial ad poster (like Instagram/FB sponsored ads). Features brand logo/monogram in top corner, bold display headline for "${topic}", hero commercial visual, 3 value/trust badges (e.g. Premium Quality, Fast Dispatch, Verified), and a sleek Call to Action pill button ("DM to Order", "Book Now", "Enquire Today").
` : ""}

${targetSlides === 2 ? `
- Slide 1 (The Hook & Hero Showcase): High-impact visual hook highlighting the customer desire or problem + bold typography headline + brand mark "${businessName}".
- Slide 2 (The Solution & Conversion): The brand's craftsmanship, key service benefits, 3 trust badges + prominent Call to Action button ("DM to Customise", "Book Consultation", "Order Now").
` : ""}

${targetSlides === 3 ? `
- Slide 1 (The Curiosity / Problem Hook): The scroll-stopping question or hook highlighting the client's desire/pain point + brand header.
- Slide 2 (The Craftsmanship & Deep Value): In-depth look at materials, unique method, or bespoke service pillars + 3 feature badges.
- Slide 3 (The Offer & Direct CTA): Irresistible offer, customer guarantee seals, and high-visibility Call to Action banner.
` : ""}

${targetSlides === 5 ? `
- Slide 1 (Cover / Guide Title Card): Bold editorial title card (e.g. "The 5 Secrets to..." or "2026 Bridal Edit Vol. 1") + brand monogram.
- Slide 2 (Pillar 1): First key feature/style/benefit + high-end commercial visual.
- Slide 3 (Pillar 2): Second key feature/style/benefit + high-end commercial visual.
- Slide 4 (Pillar 3): Third key feature/style/benefit + high-end commercial visual.
- Slide 5 (Closing Card & Conversion): Brand trust summary + guarantee seals + clear DM/Booking prompt.
` : ""}

[STRICT POSTER ART DIRECTION FOR EACH SLIDE]
All slides must share the same high-end agency design style, harmonious brand color palette, and professional typography.
For each of the ${targetSlides} slide(s), construct an image prompt for gpt-image-2 that specifies:
1. Agency ad poster layout (1024x1024).
2. Top-Left: Crisp brand monogram/logo and brand name "${businessName}".
3. Headline: Exact quoted headline text in bold display typography.
4. Value Badges: 2 to 3 minimalist pill badges tailored to ${niche}.
5. CTA Button: Sleek bottom CTA button.
6. Lighting & Studio finish: High-contrast luxury commercial art direction.
7. Anti-gibberish rule: Render ONLY specified quoted text cleanly and correctly spelled, no random fake letters.

Also generate:
- "title": Short catchy TikTok title under 70 characters.
- "caption": Engaging, viral TikTok caption (120-180 words) with hook, storytelling, value points, clear CTA, and 4-6 hashtags. (STRICT: NO RAW HTTP/WWW URLS).

OUTPUT RAW JSON ONLY (no markdown blocks):
{
  "title": "...",
  "caption": "...",
  "slides": [
    {
      "slide_number": 1,
      "slide_title": "...",
      "slide_subtitle": "...",
      "image_prompt": "..."
    }
  ]
}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleanJson = text.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(cleanJson);

    // Sanitize caption: Remove raw URLs for TikTok compliance
    let cleanCaption = (parsed.caption || "")
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/www\.\S+/gi, "")
      .trim();

    // Prepare slide prompts
    const slideItems = Array.isArray(parsed.slides) ? parsed.slides.slice(0, targetSlides) : [];
    const promptsToRun = [];

    for (let i = 0; i < targetSlides; i++) {
      const s = slideItems[i];
      if (s?.image_prompt) {
        promptsToRun.push(s.image_prompt);
      } else {
        promptsToRun.push(
          `Finished agency commercial ad poster for "${businessName}", promoting "${topic}", Slide ${i + 1} of ${targetSlides}, brand logo header for "${businessName}", bold typography headline, 3 minimalist trust badges, sleek CTA button, 8k luxury commercial catalog`
        );
      }
    }

    console.log(`[TikTok AI] Generating ${promptsToRun.length} bespoke campaign slides with gpt-image-2 for: "${businessName}" - "${topic}"...`);

    // Execute image generation with gpt-image-2
    const settledResults = await Promise.allSettled(
      promptsToRun.map((p) => generateGptImage(p, email))
    );

    let generatedImages = [];
    settledResults.forEach((res, idx) => {
      if (res.status === "fulfilled" && res.value) {
        generatedImages.push(res.value);
      } else {
        console.warn(`[TikTok AI] Slide ${idx + 1} failed:`, res.reason?.message);
      }
    });

    // If any slide failed, backfill from successfully generated slides
    if (generatedImages.length > 0 && generatedImages.length < targetSlides) {
      const sourceImg = generatedImages[0];
      while (generatedImages.length < targetSlides) {
        generatedImages.push(sourceImg);
      }
    }

    // If completely empty, make one single fallback attempt
    if (generatedImages.length === 0) {
      console.log("[TikTok AI] Retrying single emergency bespoke image generation...");
      const singleImg = await generateGptImage(
        `Commercial agency advertisement poster for "${businessName}", promoting "${topic}", luxury brand styling, bold typography, trust badges, 8k commercial finish`,
        email
      );
      while (generatedImages.length < targetSlides) {
        generatedImages.push(singleImg);
      }
    }

    return res.status(200).json({
      ok: true,
      title: parsed.title || `Bespoke ${topic} ✨ ${businessName}`,
      caption: cleanCaption,
      images: generatedImages,
      slides: slideItems,
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      format,
      slideCount: targetSlides,
      topic,
    });
  } catch (err) {
    console.error("[TikTok AI Generate Creative Error]:", err);
    return res.status(500).json({
      ok: false,
      error: `AI Campaign Generation Error: ${err.message}. Please click 'Generate Post with AI' to re-synthesize.`,
    });
  }
}
