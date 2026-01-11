// lib/instagram/generate-image.js
import OpenAI from "openai";

export async function generateImage(state) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OpenAI API Key missing. Cannot generate image.");
    }

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    const footerText = state.assets.websiteUrl || state.assets.phone || state.businessName;
    
    const prompt = `
        Create a professional, high-quality Instagram post image for a business named "${state.businessName}".
        
        Topic/Context: ${state.context.rawIntent || state.context.service || "General promotion"}
        
        Design Requirements:
        1. Aspect Ratio: Square (1:1).
        2. Style: Modern, clean, and professional.
        3. Text Overlay (MANDATORY):
           - Place the business name "${state.businessName}" in the top-left corner like a logo.
           - Create a distinct bottom footer strip containing the text: "${footerText}".
        4. The main visual should clearly represent the topic.
        
        No other text should be on the image.
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
