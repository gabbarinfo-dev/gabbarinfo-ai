// lib/instagram/generate-image.js

import OpenAI from "openai";
import { supabaseServer } from "../supabaseServer.js";

/**
 * Builds a dynamic, bespoke Graphic Design Art Direction prompt based on industry & service.
 * Ensures every post looks like an award-winning human graphic design agency poster (Screenshots 3 & 4 style).
 */
function getCreativeArchetypes(service, industry) {
    const s = service || "Professional Services";
    const ind = industry || "Business";

    return [
        {
            name: "HERO_COMMERCIAL_SHOWCASE",
            description: `
[VISUAL ARCHETYPE: HERO COMMERCIAL SHOWCASE & PEDESTAL]
- Ultra-premium, high-gloss commercial ad poster.
- Features a striking, hyper-realistic focal subject representing "${s}" displayed with pride on a sleek modern pedestal or floating center-right with dramatic studio lighting.
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
- Features a clean, elegant composition showing the authentic tools, products, or professional environment of "${s}" in immaculate detail.
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
- Features a dramatic, real-world commercial perspective of "${s}" — showing exquisite finished results, master craftsmanship, or high-end professional equipment in its natural premium setting.
- Materials & Atmosphere: Warm golden hour or moody studio lighting, realistic depth of field, and rich textural details.
- Color Palette: Rich, warm, and cinematic color harmony tailored seamlessly to "${s}" and "${ind}".
- Typography: Bold, authoritative serif or modern grotesque typography with elegant dividers.
`
        },
        {
            name: "DYNAMIC_MODERN_GRAPHIC",
            description: `
[VISUAL ARCHETYPE: DYNAMIC MODERN 3D AGENCY GRAPHIC]
- Cutting-edge agency commercial graphic design with dynamic depth and layered 3D accents.
- Features high-impact 3D visual icons, emblems, or stylized physical elements representing "${s}" with realistic materials and glossy finishes.
- Materials & Atmosphere: Sleek glassmorphism panels, energetic directional lighting, and crisp geometric accents.
- Color Palette: Bold high-contrast two-tone gradient background with vibrant glowing accent elements.
- Typography: High-impact powerhouse advertising typography with colored highlight badges.
`
        }
    ];
}

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
    const safeService = service || "Professional Services";
    const safeIndustry = industry || "Business";

    return `Ultra-premium, high-gloss 3D commercial agency ad visual for "${safeService}" by ${businessName} (${safeIndustry}). Sleek modern commercial studio lighting, polished reflective pedestal, dramatic depth of field, vibrant contrasting accents on an obsidian slate background. Ultra-sharp focus, cinematic luxury finish. STRICTLY NO GIBBERISH TEXT, NO BLURRY LETTERS, NO WATERMARKS. Pure crystal-clear commercial art.`.trim();
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

    let imageBuffer = null;
    let usedModel = modelToUse;

    const withTimeout = (promise, ms = 40000) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`OpenAI image call timed out after ${ms}ms`)), ms)
        ),
      ]);

    try {
        let response;
        try {
            response = await withTimeout(
                openai.images.generate({
                    model: modelToUse,
                    prompt,
                    size: "1024x1024",
                }),
                40000
            );
        } catch (modelErr) {
            console.warn(`⚠️ [${modelToUse}] failed or timed out (${modelErr?.message}), trying fallback to gpt-image-1.5...`);
            usedModel = "gpt-image-1.5";
            response = await withTimeout(
                openai.images.generate({
                    model: "gpt-image-1.5",
                    prompt,
                    size: "1024x1024",
                }),
                15000
            );
        }

        if (response.data?.[0]?.b64_json) {
            imageBuffer = Buffer.from(response.data[0].b64_json, "base64");
        } else if (response.data?.[0]?.url) {
            const imgFetch = await fetch(response.data[0].url);
            imageBuffer = Buffer.from(await imgFetch.arrayBuffer());
        }
    } catch (e) {
        console.warn("OpenAI image generation error, using high-speed visual fallback:", e.message);
        try {
            const encoded = encodeURIComponent(`Award-winning modern advertising creative poster for ${service}. ${prompt.slice(0, 300)}`);
            const pollUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
            const pollRes = await fetch(pollUrl);
            if (pollRes.ok) {
                imageBuffer = Buffer.from(await pollRes.arrayBuffer());
                usedModel = "pollinations-ai";
            }
        } catch (pollErr) {
            console.warn("Pollinations fallback failed:", pollErr.message);
        }
    }

    if (!imageBuffer) {
        throw new Error("Failed to generate image buffer from both OpenAI and visual provider.");
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

    console.log(`✅ [${usedModel}] Creative generated & stored: ${publicUrl}`);

    return {
        imageUrl: publicUrl,
        imagePrompt: prompt,
        storageFileName: fileName
    };
}

