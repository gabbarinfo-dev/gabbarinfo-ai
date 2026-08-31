// lib/instagram/generate-image.js

import OpenAI from "openai";
import { supabaseServer } from "../supabaseServer";

/**
 * Builds a dynamic, bespoke Graphic Design Art Direction prompt based on industry & service.
 * Ensures every post looks like an award-winning human graphic design agency poster (Screenshots 3 & 4 style).
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
    const s = (service || "").toLowerCase();
    const ind = (industry || "").toLowerCase();

    let styleDirection = "";

    // ── JEWELLERY / FASHION / LUXURY ─────────────────────────────────
    if (s.includes("jewel") || s.includes("gold") || s.includes("diamond") || s.includes("kundan") || s.includes("fashion") || s.includes("boutique") || ind.includes("jewel") || ind.includes("fashion")) {
        styleDirection = `
[VISUAL STYLE: LUXURY EDITORIAL & HIGH FASHION]
- Aesthetically stunning high-fashion editorial commercial ad poster.
- Deep royal emerald green, velvet black, or warm marble backdrop with dramatic cinematic lighting.
- An elegant Indian model wearing the exquisite handcrafted jewelry pieces OR an ultra-luxurious macro composition of gold, diamonds, and gemstones catching crystal-clear light reflections.
- Typography: Luxury royal serif & sophisticated gold-accented typography with ornate flourish dividers.
- Top-Left: Elegant luxury monogram and brand typography: "${businessName}".
- Main Headline: Bold, romantic luxury serif typography: "${service}".
- Subtitle: "${tagline || 'Exquisite Craftsmanship & Timeless Elegance'}".
${offer ? `- Special Promo Badge: An ornate vintage gold crest/badge stating: "${offer}".` : ''}
- Feature Badges (bottom-left): 3 minimalist gold icons with labels ("Premium Quality", "Exquisite Craftsmanship", "Timeless Elegance").
- Bottom-Right: A sleek dark green and gold-bordered pill CTA button reading: "${ctaText}".
`;
    }
    // ── DIGITAL MARKETING / TECH / SAAS / ADS ────────────────────────
    else if (s.includes("google ad") || s.includes("meta ad") || s.includes("seo") || s.includes("marketing") || s.includes("software") || s.includes("web") || s.includes("app") || s.includes("tech") || s.includes("video") || ind.includes("tech") || ind.includes("marketing")) {
        styleDirection = `
[VISUAL STYLE: MODERN 3D TECH & CORPORATE GRAPHIC DESIGN]
- Clean, ultra-crisp modern agency commercial ad graphic on a pristine light gradient or dark sleek glassmorphism background.
- Features a high-gloss 3D emblem or podium with 3D rising bar charts, growth arrows, or sleek digital interfaces with realistic depth and lighting.
- Typography: Ultra-clean, bold modern sans-serif typography with colorful accent lines.
- Top-Left: Crisp modern brand mark and name: "${businessName}".
- Main Headline: Prominent, high-impact typography: "${service}".
- Subtitle: "${tagline || 'Drive Real Growth & High Conversions'}".
${offer ? `- Special Promo Badge: A stylish modern gradient badge stating: "${offer}".` : ''}
- Feature Badges (bottom-left): 3 neat corporate icon pills ("Targeted Campaigns", "Higher Conversions", "Maximum ROI").
- Bottom-Right: A high-contrast modern pill CTA button reading: "${ctaText}".
`;
    }
    // ── FOOD / RESTAURANT / CAFE / BAKERY ────────────────────────────
    else if (s.includes("food") || s.includes("restaurant") || s.includes("cafe") || s.includes("bakery") || s.includes("cake") || s.includes("catering") || ind.includes("food")) {
        styleDirection = `
[VISUAL STYLE: APPETIZING GOURMET CULINARY ADVERTISEMENT]
- Mouthwatering, commercial food photography poster with warm ambient lighting.
- Beautifully plated signature gourmet dishes on rustic wood or white marble with fresh garnishes and rising steam.
- Typography: Warm, elegant culinary typography with appetizing warm gold or rich amber accents.
- Top-Left: Chic restaurant emblem: "${businessName}".
- Main Headline: Bold stylish typography: "${service}".
- Subtitle: "${tagline || 'Fresh Flavours & Unforgettable Taste'}".
${offer ? `- Promo Badge: A vibrant appetizing seal stating: "${offer}".` : ''}
- Bottom-Right: An inviting, rounded pill CTA button reading: "${ctaText}".
`;
    }
    // ── HEALTHCARE / CLINIC / DENTAL / SPA ───────────────────────────
    else if (s.includes("clinic") || s.includes("dental") || s.includes("doctor") || s.includes("health") || s.includes("medical") || s.includes("spa") || s.includes("skin") || ind.includes("health")) {
        styleDirection = `
[VISUAL STYLE: PREMIUM HEALTHCARE & CLINICAL EXCELLENCE]
- Clean, trustworthy, bright commercial poster with soft medical-blue, turquoise, or warm spa tones.
- Modern high-tech clinic environment, caring medical professional in uniform or pristine wellness setting.
- Typography: Crisp, authoritative, modern medical typography.
- Top-Left: Trustworthy medical badge: "${businessName}".
- Main Headline: Clean bold typography: "${service}".
- Subtitle: "${tagline || 'Advanced Care & Trusted Expertise'}".
${offer ? `- Promo Badge: A clean clinical offer badge: "${offer}".` : ''}
- Bottom-Right: A reassuring modern pill CTA button reading: "${ctaText}".
`;
    }
    // ── FITNESS / GYM / SPORTS ───────────────────────────────────────
    else if (s.includes("gym") || s.includes("fitness") || s.includes("trainer") || s.includes("workout") || ind.includes("fitness")) {
        styleDirection = `
[VISUAL STYLE: HIGH-ENERGY DYNAMIC ATHLETIC POSTER]
- High-contrast, dynamic fitness commercial poster with dramatic studio rim lighting.
- Determined athlete in motion with gym weights and energizing background textures.
- Typography: Bold, italicized, powerhouse display typography in vibrant neon accents.
- Top-Left: Athletic brand mark: "${businessName}".
- Main Headline: Bold energetic typography: "${service}".
- Subtitle: "${tagline || 'Transform Your Body & Elevate Your Strength'}".
${offer ? `- Promo Badge: An explosive discount badge: "${offer}".` : ''}
- Bottom-Right: A high-visibility pill CTA button reading: "${ctaText}".
`;
    }
    // ── REAL ESTATE / ARCHITECTURE / INTERIOR ─────────────────────────
    else if (s.includes("real estate") || s.includes("property") || s.includes("home") || s.includes("interior") || ind.includes("real estate")) {
        styleDirection = `
[VISUAL STYLE: LUXURY ARCHITECTURAL & REAL ESTATE POSTER]
- Breath-taking luxury modern villa or contemporary interior living room with golden hour sunset lighting through large glass windows.
- Typography: Sophisticated, architectural serif and clean sans-serif typography.
- Top-Left: Premium developer emblem: "${businessName}".
- Main Headline: Elegant typography: "${service}".
- Subtitle: "${tagline || 'Exclusive Living & Prime Locations'}".
${offer ? `- Promo Badge: A golden real estate badge: "${offer}".` : ''}
- Bottom-Right: An elegant pill CTA button reading: "${ctaText}".
`;
    }
    // ── DEFAULT COMMERCIAL GRAPHIC ───────────────────────────────────
    else {
        styleDirection = `
[VISUAL STYLE: PREMIUM COMMERCIAL GRAPHIC DESIGN POSTER]
- Award-winning agency-quality commercial poster tailored to ${service}.
- Balanced composition, striking focal subject, harmonious color palette with professional lighting.
- Top-Left: Clean brand mark: "${businessName}".
- Main Headline: Bold headline typography: "${service}".
- Subtitle: "${tagline || 'Excellence & Professional Solutions'}".
${offer ? `- Promo Badge: An eye-catching badge stating: "${offer}".` : ''}
- Bottom-Right: A polished pill CTA button reading: "${ctaText}".
`;
    }

    return `
You are a world-class commercial graphic designer creating a finished, agency-grade Instagram ad poster.

${styleDirection}

[CRITICAL TYPOGRAPHY & DESIGN RULES]
1. Format: Square 1:1, 1024x1024, ultra-high-definition advertisement poster.
2. Render ONLY the following specific quoted text elements cleanly into the design:
   - Top-Left Brand: "${businessName}"
   - Main Headline: "${service}"
   - Subtitle: "${tagline || service}"
   ${offer ? `- Offer Badge: "${offer}"` : ''}
   - Bottom-Right CTA: "${ctaText}"
3. STRICTLY NO RANDOM GIBBERISH: Do NOT render any other fake letters, lorem ipsum, or garbled background text.
4. Ensure all letters are sharp, legible, correctly spelled, and seamlessly color-matched to the visual theme.
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

