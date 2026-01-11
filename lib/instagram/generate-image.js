
import OpenAI from "openai";

export async function generateImage(state) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OpenAI API Key missing. Cannot generate image.");
    }

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    // 7. RELEVANCE ENFORCEMENT & FOOTER RULES
    
    // Resolve Footer Text
    let footerInstruction = "Do NOT include a footer strip. The bottom area must be clean.";
    const method = state.assets.contactMethod;
    
    if (method === "none") {
        footerInstruction = "Do NOT include a footer strip. The bottom area must be clean.";
    } else {
        let footerText = "";
        if (method === "website" && state.assets.websiteUrl) footerText = state.assets.websiteUrl;
        else if ((method === "phone" || method === "whatsapp") && state.assets.phone) footerText = state.assets.phone;
        
        if (footerText) {
             footerInstruction = `Create a distinct, high-contrast bottom footer strip containing the text: "${footerText}".`;
        } else {
             // Fallback if method chosen but no data (shouldn't happen with validation, but safe fallback)
             footerInstruction = "Do NOT include a footer strip.";
        }
    }

    // Resolve Logo Instruction
    let logoInstruction = "";
    if (state.assets.logoDecision === "use_logo") {
        logoInstruction = `Place the business logo (conceptually) in the top-left corner.`;
    } else if (state.assets.logoDecision === "use_text") {
        logoInstruction = `Place the text "${state.businessName}" in the top-left corner as a logo.`;
    } else {
        logoInstruction = "Do NOT include any logo or text in the top-left.";
    }

    const service = state.context.service || "General Business";
    const category = state.businessCategory || "Business";
    const offer = state.context.offer ? `Highlight Offer: "${state.context.offer}"` : "General Brand Awareness";
    const location = state.assets.city ? `Location context: ${state.assets.city}` : "";

    const prompt = `
        Create a professional Instagram post image for a ${category} business specializing in ${service}.
        
        Key Elements:
        - Service Focus: ${service} (Visuals must clearly depict this).
        - ${offer}
        - ${location}
        
        Layout:
        1. Top-Left: ${logoInstruction}
        2. Footer: ${footerInstruction}
        3. Style: Modern, clean, professional, suitable for social media.
        4. Text: NO extra text other than the Logo and Footer.
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
