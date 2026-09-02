// lib/instagram/generate-image.js

import OpenAI from "openai";
import { supabaseServer } from "../supabaseServer";

/**
 * Builds a dynamic, bespoke Graphic Design Art Direction prompt based on industry & service.
 * Ensures every post looks like an award-winning human graphic design agency poster (Screenshots 3 & 4 style).
 */
const CREATIVE_ARCHETYPES = [
    {
        name: "HERO_COMMERCIAL_SHOWCASE",
        description: `
[VISUAL ARCHETYPE: HERO COMMERCIAL SHOWCASE & PEDESTAL]
- Ultra-premium, high-gloss commercial ad poster.
- Features a striking, hyper-realistic focal subject representing "${service}" displayed with pride on a sleek modern pedestal or floating center-right with dramatic studio lighting.
- Materials & Atmosphere: Polished reflections, subtle ambient particle glow, and deep rich contrast.
- Color Palette: Sophisticated dark luxury palette (obsidian slate, deep sapphire, or rich charcoal) with vibrant color-matched rim lighting.
- Typography: Ultra-clean, bold modern display typography with high readability.
`
    },
    {
        name: "BRIGHT_MINIMALIST_STUDIO",
        description: `
[VISUAL ARCHETYPE: BRIGHT MINIMALIST & CONTEMPORARY STUDIO]
- Pristine, daylight-filled high-end commercial ad aesthetic with soft architectural shadows.
- Features a clean, elegant composition showing the authentic tools, products, or professional environment of "${service}" in immaculate detail.
- Materials & Atmosphere: Soft matte textures, bright airy space, smooth light travertine or clean off-white gradient backdrop.
- Color Palette: Bright, fresh, and modern with crisp high-contrast dark typography and vibrant accent lines.
- Typography: Sophisticated contemporary sans-serif typography with generous breathing room.
`
    },
    {
        name: "CINEMATIC_ATMOSPHERIC_SCENE",
        description: `
[VISUAL ARCHETYPE: CINEMATIC ATMOSPHERIC COMMERCIAL]
- Cinematic editorial ad poster with rich narrative depth and authentic atmosphere.
- Features a dramatic, real-world commercial perspective of "${service}" — showing exquisite finished results, master craftsmanship, or high-end professional equipment in its natural premium setting.
- Materials & Atmosphere: Warm golden hour or moody studio lighting, realistic depth of field, and rich textural details.
- Color Palette: Rich, warm, and cinematic color harmony tailored seamlessly to "${service}" and "${industry}".
- Typography: Bold, authoritative serif or modern grotesque typography with elegant dividers.
`
    },
    {
        name: "DYNAMIC_MODERN_GRAPHIC",
        description: `
[VISUAL ARCHETYPE: DYNAMIC MODERN 3D AGENCY GRAPHIC]
- Cutting-edge agency commercial graphic design with dynamic depth and layered 3D accents.
- Features high-impact 3D visual icons, emblems, or stylized physical elements representing "${service}" with realistic materials and glossy finishes.
- Materials & Atmosphere: Sleek glassmorphism panels, energetic directional lighting, and crisp geometric accents.
- Color Palette: Bold high-contrast two-tone gradient background with vibrant glowing accent elements.
- Typography: High-impact powerhouse advertising typography with colored highlight badges.
`
    }
];

/**
 * Builds a universal, dynamic Graphic Design Art Direction prompt for ANY business or industry.
 * Rotates visual archetypes dynamically to ensure no two posts look identical.
 */
function buildArtDirectionPrompt({
    businessName,
    service,
    tagline,
    offer,
    ctaText,
    industry,
    visualMood
}) {
    // Dynamically rotate across creative archetypes based on timestamp or random pick
    const archetypeIndex = Math.floor(Math.random() * CREATIVE_ARCHETYPES.length);
    const selectedArchetype = CREATIVE_ARCHETYPES[archetypeIndex];

    const safeService = service || "Professional Services";
    const safeIndustry = industry || "Business";
    const safeTagline = tagline || "Excellence & Precision Solutions";

    return `
You are an award-winning commercial graphic designer and art director creating a finished, agency-grade Instagram ad poster for a client.

[CLIENT BUSINESS CONTEXT]
- Business Name: "${businessName}"
- Industry: "${safeIndustry}"
- Specific Service / Product: "${safeService}"
- Key Tagline: "${safeTagline}"
${offer ? `- Promotional Offer: "${offer}"` : ''}
- Call to Action: "${ctaText}"

[VISUAL DIRECTION & THEME]
${selectedArchetype.description}
${visualMood ? `- Mood Note: ${visualMood}` : ''}

[SUBJECT MATTER RULES - CRITICAL]
- Accurately and beautifully depict the REAL-WORLD focal subject of "${safeService}" (e.g. if industrial bearings: gleaming chrome steel bearings with precision reflections; if laundry: crisp freshly-pressed luxury fabrics; if salon: glowing styled hair and premium cosmetics; if dentist: pristine smile and high-tech care; if tech/AI: sleek 3D holographic digital interfaces; if jewellery: handcrafted jewelry catching sparkling light).
- The imagery must look authentic, premium, and instantly recognizable for "${safeService}".

[STRICT BRAND ANCHORS & LAYOUT BLUEPRINT]
1. Format: Square 1:1, 1024x1024, ultra-high-definition agency advertisement poster.
2. Top-Left: Crisp brand monogram/logo and brand name: "${businessName}".
3. Main Headline: Prominent, high-contrast, bold typography: "${safeService}".
4. Subtitle: "${safeTagline}".
${offer ? `5. Promo Badge: An eye-catching, high-contrast promotional badge/seal stating: "${offer}".` : ''}
6. Feature Badges (bottom-left): 3 neat, minimalist pill badges with icons and labels relevant to "${safeService}" (e.g., Quality, Reliability, Fast Service).
7. Bottom-Right: A sleek, high-visibility pill CTA button reading: "${ctaText}".

[ANTI-GIBBERISH & QUALITY RULES]
- Render ONLY the specified quoted text elements cleanly and correctly spelled.
- STRICTLY NO RANDOM FAKE LETTERS, lorem ipsum, or garbled background text.
- Ultra-sharp focus, professional lighting, zero noise, agency commercial finish.
`.trim();
}

export async function generateImage(state, visualMood, taglineOverride) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OpenAI API Key missing. Cannot generate image.");
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const businessName = state.businessName || "Gabbarinfo";
    const service = state.context?.service || "Services";
    const industry = state.businessCategory || "Business";
    const tagline = taglineOverride || state.content?.tagline || "";
    const offer = state.context?.offer || "";

    // Resolve CTA text dynamically based on user contact choice
    let ctaText = "DM Us ✈️";
    const method = state.assets?.contactMethod || "dm";
    if (method === "website" && state.assets?.websiteUrl) {
        const cleanDomain = state.assets.websiteUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
        ctaText = `Visit: ${cleanDomain}`;
    } else if (method === "phone" && state.assets?.phone) {
        ctaText = `Call: ${state.assets.phone}`;
    } else if (method === "whatsapp" && state.assets?.phone) {
        ctaText = `WhatsApp: ${state.assets.phone}`;
    }

    const prompt = buildArtDirectionPrompt({
        businessName,
        service,
        tagline,
        offer,
        ctaText,
        industry,
        visualMood
    });

    const modelToUse = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
    console.log(`🎨 [${modelToUse}] Generating bespoke ad poster for "${service}" (${businessName})...`);

    try {
        let response;
        try {
            response = await openai.images.generate({
                model: modelToUse,
                prompt,
                size: "1024x1024",
            });
        } catch (modelErr) {
            console.warn(`⚠️ [${modelToUse}] failed (${modelErr?.message}), trying fallback to gpt-image-1...`);
            response = await openai.images.generate({
                model: "gpt-image-1",
                prompt,
                size: "1024x1024",
            });
        }

        let imageBuffer = null;
        if (response.data?.[0]?.b64_json) {
            imageBuffer = Buffer.from(response.data[0].b64_json, "base64");
        } else if (response.data?.[0]?.url) {
            const imgFetch = await fetch(response.data[0].url);
            imageBuffer = Buffer.from(await imgFetch.arrayBuffer());
        }

        if (!imageBuffer) {
            throw new Error("OpenAI returned no image data.");
        }

        const fileName = `ig_creative_${Date.now()}.png`;

        const { error: uploadErr } = await supabaseServer.storage
            .from("instagram-creatives")
            .upload(fileName, imageBuffer, {
                contentType: "image/png",
                upsert: true
            });

        if (uploadErr) throw uploadErr;

        const {
            data: { publicUrl }
        } = supabaseServer.storage
            .from("instagram-creatives")
            .getPublicUrl(fileName);

        console.log(`✅ [${modelToUse}] Creative generated & stored: ${publicUrl}`);

        return {
            imageUrl: publicUrl,
            imagePrompt: prompt,
            storageFileName: fileName
        };

    } catch (e) {
        console.error("========== OPENAI IMAGE ERROR ==========");
        console.error(e);
        throw e;
    }
}

