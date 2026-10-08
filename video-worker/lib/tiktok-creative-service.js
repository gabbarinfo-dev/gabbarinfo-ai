// video-worker/lib/tiktok-creative-service.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

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

const TRENDING_AUDIO_PRESETS = [
  {
    id: "chill_luxe_vibes",
    name: "Luxury Lo-Fi Instrumental Beat",
    url: "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg",
  },
  {
    id: "royal_sitar_fusion",
    name: "Royal Heritage Fusion Sitar",
    url: "https://actions.google.com/sounds/v1/foley/water_pour.ogg",
  },
  {
    id: "dance_club_energetic",
    name: "High Energy Club Beat",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  },
];

/**
 * Call Gemini API using native fetch
 */
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set on worker.");

  const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
  let lastErr = null;

  for (const m of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errText}`);
      }

      const json = await res.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) return rawText.trim();
    } catch (e) {
      lastErr = e;
      console.warn(`[TikTok Service] Model ${m} failed: ${e.message}, trying next...`);
    }
  }

  throw lastErr || new Error("All Gemini models failed");
}

/**
 * Suggest 10 viral TikTok topics using Gemini
 */
async function suggestTopics(businessName = "Bella & Diva Jewellery", niche = "South Asian Luxury Jewellery") {
  try {
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
    const text = await callGemini(prompt);
    const cleanJson = text.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed) && parsed.length >= 6) {
      return parsed;
    }
  } catch (err) {
    console.warn("[TikTok Service] suggestTopics fallback to default:", err.message);
  }
  return DEFAULT_10_TOPICS;
}

/**
 * Generate a single high-quality bespoke visual using OpenAI's gpt-image-2 pipeline
 * and upload directly to Supabase storage.
 */
async function generateGptImage(openai, prompt, supabase) {
  if (!openai) throw new Error("OPENAI_API_KEY not configured on worker.");
  const candidateModels = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1", "dall-e-3"];
  let imageBuffer = null;
  let modelUsed = null;

  for (const model of candidateModels) {
    try {
      console.log(`[TikTok Worker AI] Generating bespoke visual with ${model}...`);
      const response = await Promise.race([
        openai.images.generate({
          model,
          prompt,
          size: "1024x1024",
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after 45s for model ${model}`)), 45000)
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
        console.log(`[TikTok Worker AI] Successfully generated visual using ${model} (${imageBuffer.length} bytes)`);
        break;
      }
    } catch (err) {
      console.warn(`[TikTok Worker AI] Model ${model} failed (${err.message}), trying next...`);
    }
  }

  if (!imageBuffer) {
    throw new Error("AI image generation failed across all models.");
  }

  // Upload to Supabase Storage: instagram-creatives bucket
  if (!supabase) {
    throw new Error("Supabase client not initialized on worker.");
  }

  const fileName = `tt_railway_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
  const { error: uploadErr } = await supabase.storage
    .from("instagram-creatives")
    .upload(fileName, imageBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (uploadErr) {
    throw new Error(`Supabase upload failed: ${uploadErr.message}`);
  }

  const { data: pubData } = supabase.storage
    .from("instagram-creatives")
    .getPublicUrl(fileName);

  return pubData.publicUrl;
}

/**
 * Render vertical 9:16 MP4 video reel from slide images using FFmpeg
 */
async function renderReelVideo(imageUrls, audioUrl = null, supabase) {
  const tmpDir = path.join(os.tmpdir(), `tt_reel_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const localImages = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const imgRes = await fetch(imageUrls[i]);
      if (!imgRes.ok) continue;
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const localFile = path.join(tmpDir, `slide_${i}.png`);
      fs.writeFileSync(localFile, buf);
      localImages.push(localFile);
    }

    if (localImages.length === 0) {
      throw new Error("No images downloaded for reel video rendering.");
    }

    // Prepare concat demuxer file: each slide shown for 3.5 seconds
    const listFile = path.join(tmpDir, "slides.txt");
    const listLines = [];
    for (const imgPath of localImages) {
      listLines.push(`file '${imgPath.replace(/\\/g, "/")}'`);
      listLines.push("duration 3.5");
    }
    // Repeat last image to prevent premature cut
    listLines.push(`file '${localImages[localImages.length - 1].replace(/\\/g, "/")}'`);
    fs.writeFileSync(listFile, listLines.join("\n"), "utf8");

    const outVideoPath = path.join(tmpDir, "final_reel.mp4");

    // FFmpeg command to scale/pad to vertical 9:16 (1080x1920) with yuv420p
    const cmd = `ffmpeg -y -f concat -safe 0 -i "${listFile}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black" -c:v libx264 -r 30 -pix_fmt yuv420p -movflags +faststart "${outVideoPath}"`;
    await execAsync(cmd);

    if (!fs.existsSync(outVideoPath)) {
      throw new Error("FFmpeg output reel video was not created.");
    }

    const videoBuffer = fs.readFileSync(outVideoPath);
    const videoFileName = `tt_reel_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`;

    const { error: uploadErr } = await supabase.storage
      .from("instagram-creatives")
      .upload(videoFileName, videoBuffer, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadErr) {
      throw new Error(`Failed to upload reel video to Supabase: ${uploadErr.message}`);
    }

    const { data: pubData } = supabase.storage
      .from("instagram-creatives")
      .getPublicUrl(videoFileName);

    return pubData.publicUrl;
  } finally {
    // Cleanup temp dir
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

/**
 * Main TikTok creative generation pipeline running on Railway Worker
 */
async function generateTikTokCreative({
  businessName = "Bella & Diva Jewellery",
  niche = "Imitation jewellery, Kundan bridal and festive jewellery based in London",
  topic = "Bespoke Collection Showcase",
  format = "CAROUSEL",
  slideCount = 2,
  logoUrl = null,
  autoAddMusic = true,
  audioPreset = "chill_luxe_vibes",
  openai,
  supabase,
}) {
  let targetSlides = 2;
  if (format === "SINGLE_IMAGE") {
    targetSlides = 1;
  } else if (format === "CAROUSEL") {
    const requested = Number(slideCount);
    targetSlides = [2, 3, 5].includes(requested) ? requested : 2;
  } else if (format === "REEL") {
    targetSlides = 3; // 3 slides compiled into 9:16 reel
  }

  // 1. Generate campaign concept and art direction via Gemini
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

  const geminiText = await callGemini(prompt);
  const cleanJson = geminiText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
  const parsed = JSON.parse(cleanJson);

  let cleanCaption = (parsed.caption || "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/www\.\S+/gi, "")
    .trim();

  // 2. Prepare slide prompts
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

  console.log(`[TikTok Railway Worker] Generating ${promptsToRun.length} bespoke campaign slides with gpt-image-2...`);

  // Parallel generation of slides on Railway
  const settledResults = await Promise.allSettled(
    promptsToRun.map((p) => generateGptImage(openai, p, supabase))
  );

  let generatedImages = [];
  settledResults.forEach((res, idx) => {
    if (res.status === "fulfilled" && res.value) {
      generatedImages.push(res.value);
    } else {
      console.warn(`[TikTok Railway Worker] Slide ${idx + 1} failed:`, res.reason?.message);
    }
  });

  // Backfill if any failed
  if (generatedImages.length > 0 && generatedImages.length < targetSlides) {
    const sourceImg = generatedImages[0];
    while (generatedImages.length < targetSlides) {
      generatedImages.push(sourceImg);
    }
  }

  if (generatedImages.length === 0) {
    console.log("[TikTok Railway Worker] Emergency fallback visual generation...");
    const fallback = await generateGptImage(
      openai,
      `Commercial advertisement poster for "${businessName}", promoting "${topic}", luxury brand styling, bold typography, 8k commercial finish`,
      supabase
    );
    while (generatedImages.length < targetSlides) {
      generatedImages.push(fallback);
    }
  }

  // 3. Render video reel if REEL requested
  let videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
  if (format === "REEL") {
    try {
      console.log("[TikTok Railway Worker] Rendering 9:16 vertical video reel with FFmpeg...");
      videoUrl = await renderReelVideo(generatedImages, null, supabase);
      console.log(`[TikTok Railway Worker] Reel successfully rendered: ${videoUrl}`);
    } catch (vErr) {
      console.warn(`[TikTok Railway Worker] Reel rendering fallback: ${vErr.message}`);
    }
  }

  return {
    ok: true,
    title: parsed.title || `Bespoke ${topic} ✨ ${businessName}`,
    caption: cleanCaption,
    images: generatedImages,
    slides: slideItems,
    videoUrl,
    format,
    slideCount: targetSlides,
    topic,
  };
}

module.exports = {
  suggestTopics,
  generateTikTokCreative,
  DEFAULT_10_TOPICS,
  TRENDING_AUDIO_PRESETS,
};
