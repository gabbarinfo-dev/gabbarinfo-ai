// lib/instagram/generate-image.js

import OpenAI from "openai";

/**
 * Maps a service name to concrete, recognizable visual elements for DALL-E.
 * This ensures the generated image actually looks like the service, not just "digital glowing stuff".
 */
function getServiceVisualElements(service) {
    const s = (service || "").toLowerCase();

    // ── ADVERTISING / MARKETING ───────────────────────────────────────
    if (s.includes("google ads") || s.includes("google ad") || s.includes("ppc") || s.includes("pay per click")) {
        return `Google-style search results interface with colorful G-icon in blue-red-yellow-green palette, a glowing magnifying glass over a search bar, rising bar chart showing ad performance, CPC bid numbers, keyword bubbles floating in depth, cursor clicking an ad result`;
    }
    if (s.includes("social media ad") || s.includes("meta ad") || s.includes("facebook ad") || s.includes("instagram ad")) {
        return `glowing heart/like thumb-up icons, Instagram-style story frame, comment speech bubbles, notification bell, colorful engagement counter rising, social feed grid of square image tiles in neon blue-purple palette`;
    }
    if (s.includes("social media") || s.includes("instagram") || s.includes("facebook") || s.includes("linkedin") || s.includes("twitter") || s.includes("tiktok")) {
        return `floating social media platform logo shapes (hearts, thumbs-up, speech bubbles, notification bells), smartphone screen with a glowing social feed, engagement icons radiating energy, follower count rising in neon digits`;
    }
    if (s.includes("email marketing") || s.includes("email campaign")) {
        return `open envelope with a glowing letter, inbox interface with unread notification badge, email open-rate graph going upward, @ symbol in neon, cursor clicking a call-to-action button`;
    }
    if (s.includes("content marketing") || s.includes("content creation") || s.includes("blog") || s.includes("copywriting")) {
        return `elegant typewriter or keyboard with glowing keys, open notebook with text lines, quill pen on modern dark surface, speech bubble with star rating, document with a publish button`;
    }
    if (s.includes("seo") || s.includes("search engine optim")) {
        return `search bar with a glowing magnifying glass, website ranking ladder showing position #1, rising analytics graph with upward arrow, keyword cloud, backlink network connecting nodes, Google SERP-style result snippet`;
    }
    if (s.includes("influencer") || s.includes("creator")) {
        return `smartphone front-camera selfie setup with ring light, social analytics dashboard on a tablet, follower count spike graph, collaboration handshake, floating brand logos`;
    }

    // ── TECHNOLOGY / SOFTWARE ─────────────────────────────────────────
    if (s.includes("web design") || s.includes("website design") || s.includes("ui") || s.includes("ux")) {
        return `browser window with colorful wireframe layout, design grid with color palettes and typography samples, CSS color swatches, Figma/vector-style artboard, responsive screens (desktop + mobile + tablet) side by side`;
    }
    if (s.includes("web develop") || s.includes("website develop") || s.includes("app develop")) {
        return `glowing code editor with syntax-highlighted HTML/CSS/JS, browser chrome showing a live website, responsive device mockups, terminal with running lines of code, GitHub-style branch diagram`;
    }
    if (s.includes("mobile app") || s.includes("ios") || s.includes("android")) {
        return `sleek smartphone floating at angle showing an app's colorful UI, app icons arranged in a grid, push notification bubble, App Store / Play Store badge shapes, touch gesture ripple`;
    }
    if (s.includes("cybersecur") || s.includes("security") || s.includes("network security")) {
        return `padlock icon with glowing shield, fingerprint scan graphic, firewall/network grid with blocked intrusion, binary stream background, secure checkmark badge`;
    }
    if (s.includes("cloud") || s.includes("saas") || s.includes("hosting")) {
        return `glowing cloud icon with upload/download arrows, server rack in blue light, data flowing between devices, bandwidth meter, uptime percentage gauge`;
    }
    if (s.includes("data") || s.includes("analytics") || s.includes("business intelligence")) {
        return `multiple chart types (bar, line, pie) glowing on a dark dashboard, data pipeline flowing between icons, magnifying glass over a database, KPI numbers in neon`;
    }
    if (s.includes("ai") || s.includes("artificial intelligen") || s.includes("machine learn") || s.includes("automation")) {
        return `robotic arm working alongside a human hand, neural network node diagram glowing, circuit-brain hybrid, gears turning inside a lightbulb, AI chip with radiating data pulses`;
    }
    if (s.includes("software") || s.includes("it service") || s.includes("tech support")) {
        return `clean monitor with a running dashboard, headset on a desk, cogs/gears mechanism, checkmark workflow diagram, tech support agent silhouette at a bright workstation`;
    }

    // ── FINANCE / BUSINESS ────────────────────────────────────────────
    if (s.includes("account") || s.includes("bookkeeping") || s.includes("tax") || s.includes("ca ") || s.includes("chartered")) {
        return `stacked gold coins with upward trend arrow, balance sheet document, calculator, percentage symbol in elegant typography, bank building facade, financial growth chart`;
    }
    if (s.includes("invest") || s.includes("stock") || s.includes("trading") || s.includes("finance")) {
        return `candlestick stock chart in glowing green/red, bull and bear silhouettes, rising trend line, portfolio pie chart, gold bar and coins, dollar/rupee symbol elevated on a podium`;
    }
    if (s.includes("insurance")) {
        return `protective umbrella over a family silhouette, shield with a checkmark, house-car-health icons grouped together, policy document with seal, digital claim form`;
    }
    if (s.includes("loan") || s.includes("mortgage") || s.includes("credit")) {
        return `house with a key and approved stamp, handshake with bank, credit score meter going to excellent, document with a green checkmark, interest rate comparison chart`;
    }
    if (s.includes("real estate") || s.includes("property") || s.includes("realty")) {
        return `modern house with a FOR SALE sign, keys on a blueprint, aerial neighbourhood view, building exterior with sunset, compass rose on a property map`;
    }

    // ── HEALTH / WELLNESS ─────────────────────────────────────────────
    if (s.includes("gym") || s.includes("fitness") || s.includes("personal train")) {
        return `dynamic athlete lifting weights in dramatic studio lighting, barbell + dumbbell arrangement, body transformation silhouette before/after concept, motivational energy burst`;
    }
    if (s.includes("yoga") || s.includes("meditation") || s.includes("mindfulness")) {
        return `serene figure in lotus pose at sunrise, mandala geometric pattern in soft colours, zen stones with smoke wisps, peaceful nature setting with warm golden light`;
    }
    if (s.includes("spa") || s.includes("salon") || s.includes("beauty") || s.includes("skin")) {
        return `luxury spa treatment table with orchid, smooth stone and candle arrangement, skincare product bottles in white marble environment, soft bokeh warm lighting, elegant cosmetic textures`;
    }
    if (s.includes("doctor") || s.includes("clinic") || s.includes("health") || s.includes("medical") || s.includes("dental")) {
        return `stethoscope on a clean white surface, modern clinic interior, cross/health symbol in blue, heartbeat ECG line, doctor hands with gloves, pill capsule geometry`;
    }
    if (s.includes("nasha") || s.includes("rehab") || s.includes("recovery") || s.includes("addiction") || s.includes("de-addict")) {
        return `hands breaking free from chains, sunrise over a peaceful garden, person walking toward light at the end of a tunnel, support hands, green seedling growing from dark ground`;
    }

    // ── FOOD & HOSPITALITY ────────────────────────────────────────────
    if (s.includes("restaurant") || s.includes("food") || s.includes("cafe") || s.includes("catering")) {
        return `beautifully plated gourmet dish with garnish, rustic wooden table setting, chef hands at work, steam rising from a bowl, vibrant food photography with rich colors`;
    }
    if (s.includes("bakery") || s.includes("pastry") || s.includes("cake") || s.includes("dessert")) {
        return `artisan cake with floral decoration, croissants and pastries on marble surface, powdered sugar cloud, warm oven light on baked goods, close-up texture of chocolate drizzle`;
    }
    if (s.includes("hotel") || s.includes("resort") || s.includes("hospitality") || s.includes("travel") || s.includes("tour")) {
        return `luxury hotel suite with ocean view, passport and boarding pass flat-lay, globe with travel route lines, poolside with palm trees, suitcase on cobblestone street`;
    }

    // ── EDUCATION ─────────────────────────────────────────────────────
    if (s.includes("educat") || s.includes("tutori") || s.includes("course") || s.includes("training") || s.includes("coaching")) {
        return `open books with glowing graduation cap, pencil and light-bulb concept, digital e-learning interface on tablet, teacher at a futuristic whiteboard, star/grade achievement badge`;
    }

    // ── JEWELLERY / FASHION / LUXURY ─────────────────────────────────
    if (s.includes("jewel") || s.includes("gold") || s.includes("diamond") || s.includes("kundan") || s.includes("ornament")) {
        return `close-up macro shot of gemstone facets catching light, gold and silver bangles on black velvet, diamond ring on white marble with dramatic side lighting, pearl necklace arrangement`;
    }
    if (s.includes("fashion") || s.includes("cloth") || s.includes("wear") || s.includes("boutique") || s.includes("dress")) {
        return `high-fashion editorial look on clean studio backdrop, folded fabric detail with rich texture, clothing rack in a minimalist boutique, editorial runway lighting`;
    }

    // ── LOGISTICS / DELIVERY ─────────────────────────────────────────
    if (s.includes("logistics") || s.includes("delivery") || s.includes("shipping") || s.includes("courier") || s.includes("supply chain")) {
        return `delivery van on a city road with route map overlay, cardboard box with fast-delivery checkmark, global supply chain network map, warehouse with organized shelves, GPS tracker pin moving`;
    }

    // ── DEFAULT: service name as subject ─────────────────────────────
    return `premium, creative visual that CLEARLY represents "${service}" using recognizable icons, tools, and symbols specific to this exact service and industry. Include at least 3 distinct visual elements that a viewer would immediately associate with "${service}".`;
}

export async function generateImage(state, visualMood) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OpenAI API Key missing. Cannot generate image.");
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const businessName = state.businessName || "Your Business";
    const service = state.context.service || "General Services";
    const industry = state.businessCategory || "Business";
    const effectiveMood = visualMood || "Premium digital art with dramatic lighting";

    // Get concrete, service-specific visual elements
    const serviceElements = getServiceVisualElements(service);

    const prompt = `
[STRICTLY FORBIDDEN]
- NO LEGIBLE TEXT, WORDS, LETTERS, or NUMBERS of any kind
- NO UI elements like navigation bars or top/bottom app bars
- NO phone frames, laptop bezels, or device mockups AROUND the scene
- NO social media engagement counters with readable digits
- NO literal promotional labels (No "Free", "Sale", "50% Off")
- NO generic abstract glowing orbs or energy blobs with NO service relevance

[PRIMARY DIRECTIVE — READ THIS FIRST]
This image MUST visually represent the service: "${service}".
A viewer with no caption should be able to GUESS the service from the image alone.
Use the mandatory visual elements listed below. Do NOT substitute with generic abstract concepts.

[MANDATORY SERVICE-SPECIFIC VISUAL ELEMENTS — MUST BE INCLUDED]
${serviceElements}

[COMPOSITION & LAYOUT]
- Format: square 1:1, 1024×1024, premium Instagram post
- Leave a CLEAN AREA (dark or low-detail) in the CENTER or LOWER-CENTER for text overlays
- Style: Use the visual mood as art direction: "${effectiveMood}"
- Perspective: choose the most dramatic option — overhead flat-lay, cinematic wide-angle, or extreme close-up macro

[VISUAL QUALITY RULES]
- Ultra-sharp focus on the primary subject
- Rich, saturated colours with strong contrast — avoid muted or pastel unless it fits the service
- Professional studio or editorial lighting quality
- Zero blur on key elements — allow natural depth-of-field only in backgrounds
- Feel: HIGH-END COMMERCIAL. Not stock. Not clip-art. Not generic.

[BUSINESS CONTEXT]
- Business: ${businessName}
- Industry: ${industry}
- Service: ${service}

Remember: The single most important rule is that the image must CLEARLY show what "${service}" is. Prioritise relevance over aesthetics.
    `;

    try {
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
        });

        const imageUrl = response.data[0].url;
        return { imageUrl, imagePrompt: prompt };

    } catch (e) {
        console.error("Image Generation Error:", e);
        throw new Error("Failed to generate image. Please try again.");
    }
}
