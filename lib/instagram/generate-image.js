
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
    let contactInfo = "";
    if (method === "website" && state.assets.websiteUrl) contactInfo = state.assets.websiteUrl;
    else if ((method === "phone" || method === "whatsapp") && state.assets.phone) contactInfo = state.assets.phone;

    // Build offer instruction
    let offerInstruction = "";
    if (offer && offer.toLowerCase() !== "none") {
        offerInstruction = `- OFFER BANNER: Include a highlighted banner or badge with the text "${offer}" placed prominently in the center or upper area. Make it eye-catching with a contrasting color or ribbon effect.`;
    }

    // Build contact instruction
    let contactInstruction = "";
    if (contactInfo) {
        contactInstruction = `- CONTACT INFO: Place "${contactInfo}" in small, clean text in the BOTTOM RIGHT corner.`;
    }

    // Build logo instruction
    let logoInstruction = "";
    if (state.assets.logoDecision === "use_logo" && state.assets.logoUrl) {
        logoInstruction = `- LOGO: Place a small, professional logo in the TOP LEFT corner using this reference for style/color: ${state.assets.logoUrl}`;
    } else {
        logoInstruction = `- LOGO: Place the text "${businessName}" in small, clean, professional typography in the TOP LEFT corner as a logo. Keep it subtle — do NOT make it the main focus.`;
    }

    const prompt = `
        Create a high-end, professional Instagram post image for a business.
        
        BUSINESS DETAILS:
        - Business Name: ${businessName}
        - Service Focus: ${service}
        
        LAYOUT REQUIREMENTS:
        ${logoInstruction}
        ${offerInstruction}
        ${contactInstruction}
        
        VISUAL REQUIREMENTS:
        - The image must BEAUTIFULLY and CLEARLY represent the service: ${service}.
        - Style: Premium, clean, modern, marketing-ready, high-resolution.
        - Composition: Balanced, sleek, aesthetic advertising photography or high-end 3D render.
        - Tone: Trustworthy and commercial.
        
        CRITICAL TEXT RULES:
        - SPELL EVERY WORD EXACTLY AS PROVIDED. The business name is exactly: "${businessName}" — do NOT add extra letters, do NOT misspell.
        - Keep text in the image to an absolute MINIMUM. Only include: the business name (top-left), ${offer ? `the offer "${offer}",` : ""} ${contactInfo ? `and the contact "${contactInfo}" (bottom-right).` : ""}
        - Do NOT add any other random text, gibberish, or filler words.
        
        STRICTLY FORBIDDEN:
        - Do NOT include any social media icons or logos (no Instagram icon, no Facebook icon, no Twitter/X icon, no social media watermarks).
        - Do NOT include any nonsensical or garbled text.
        - Do NOT include any hashtag symbols or hashtag text.
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
