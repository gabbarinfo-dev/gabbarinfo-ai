// lib/instagram/generate-image.js

import OpenAI from "openai";

export async function generateImage(state, visualMood) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OpenAI API Key missing. Cannot generate image.");
    }

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    // Resolve Brand Elements
    const businessName = state.businessName || "Your Business";
    const service = state.context.service || "General Services";
    const offer = state.context.offer || "";
    const method = state.assets.contactMethod;
    let website = "";
    if (method === "website" && state.assets.websiteUrl) website = state.assets.websiteUrl;
    else if ((method === "phone" || method === "whatsapp") && state.assets.phone) website = state.assets.phone;

    // Resolve Logo/Branding Instruction
    let brandingInstruction = "";
    if (state.assets.logoDecision === "use_logo" && state.assets.logoUrl) {
        brandingInstruction = `Incorporate the business logo using this reference URL if possible for style/color, or place a professional logo placeholder in the corner: ${state.assets.logoUrl}`;
    } else {
        brandingInstruction = `Professional typography for the business name: "${businessName}". Place discretely as a logo.`;
    }

    const industry = state.businessCategory || "Business";
    const hasLogo = (state.assets.logoDecision === "use_logo" && state.assets.logoUrl) ? "YES" : "NO";
    const logoRef = state.assets.logoUrl || "";

    // Determine the most relevant contact info for the image
    const contactText = state.assets.phone || state.assets.websiteUrl || "DM us";

    // Default mood if none provided
    const effectiveMood = visualMood || "High-end commercial photography, dramatic lighting";

    const prompt = `
[STRICTLY FORBIDDEN]
- NO TEXT OR NUMBERS OF ANY KIND (No brand names, no contact details, no prices)
- NO UI elements, navigation bars, or app buttons
- NO phone frames, laptop bezels, or device mockups
- NO social media icons (no "likes", "comments", "share")
- NO hashtags, stickers, or barcodes
- NO literal promotional labels (No "Free", "Limited Offer", etc.)

[GOAL]
Create a premium, ultra-high-resolution visual for an Instagram post (square 1080x1080).
The image must be sharp, high-contrast, and visually striking, serving as a clean background for an ad.

[LAYOUT & COMPOSITION]
- CRITICAL: Maintain a clean area (negative space) specifically in the LOWER-LEFT or CENTER-LEFT for text overlays.
- Use varied, non-repetitive compositions: 3D isometric views, overhead flat-lays, or cinematic wide-angle perspectives.

[BUSINESS CONTEXT]
- Industry: ${industry}
- Service: ${service}
- Theme: ${effectiveMood}

[VISUAL STYLE]
- STYLE: Varies by prompt (3D Isometric Illustration, Premium Digital Art, or Sharp Studio Photography). 
- SHARPNESS: Ultra-sharp details, high color definition, zero blur in the focal subject.
- LIGHTING: High-contrast, vibrant, or studio-controlled (avoiding "soft golden glows" unless requested).
- COLOR: Bold, professional palette. NO generic stock-photo filters.

[IMAGE CONTENT]
- A high-end, imaginative visual representing "${service}".
- If a digital service (writing, design, tech): Use creative 3D metaphors, isometric workspaces, or aesthetic equipment flat-lays.
- If a physical service (spa, gym, luxury): Use sharp, modern interior details or cinematic action shots.
- DO NOT repeat the same composition or "golden" atmosphere twice. Be unique.
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
