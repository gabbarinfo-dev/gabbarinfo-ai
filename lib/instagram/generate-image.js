// lib/instagram/generate-image.js

import OpenAI from "openai";

export async function generateImage(state) {
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

    const prompt = `
[STRICTLY FORBIDDEN]
- NO TEXT OR NUMBERS OF ANY KIND (No brand names, no contact details, no prices)
- NO UI elements, navigation bars, or app buttons
- NO phone frames, laptop bezels, or device mockups
- NO social media icons (no "likes", "comments", "share")
- NO hashtags, stickers, or barcodes
- NO literal promotional labels (No "Free", "Limited Offer", etc.)

[GOAL]
Create a premium, high-resolution "Lifestyle Marketing Background" visual for an Instagram post (square 1080x1080). 
The image must be clean, cinematic, and aesthetic, serving as a background for a professional ad.

[LAYOUT & COMPOSITION]
- CRITICAL: Leave a clean, uncluttered negative space in the CENTER and BOTTOM of the composition. 
- The subject (hero visual) should be artistically positioned to the sides or top to allow for professional text overlays to be added later by code.

[BUSINESS CONTEXT - FOR VISUAL INSPIRATION ONLY]
- Industry: ${industry}
- Service: ${service}
- Mood: Sophisticated, clean, and professional high-end photography.

[VISUAL STYLE]
- LIGHTING: Bright & Airy, High-key studio lighting or beautiful natural soft light.
- AESTHETIC: Modern Minimalist. Elegant professional color palette consistent with ${industry}.
- STYLE: Commercial high-end photography for luxury brand marketing.

[IMAGE CONTENT]
- A realistic, high-end visual representing "${service}" in a professional setting. 
- (e.g., if hair saloon, show a blur of a high-end salon workspace or beautiful hair details; if fitness, show a clean luxury gym interior corner).
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
