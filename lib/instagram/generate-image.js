
import OpenAI from "openai";

export default async function generateImage(state) {
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

    // 🔥 MARKETING-GRADE PROMPT FIX
    const prompt = `
        Create a professional Instagram marketing poster for ${businessName}.
        
        BUSINESS CONTEXT:
        - Business: "${businessName}"
        - Service: "${service}"
        - Offer: "${offer || "Professional Services"}"
        
        VISUAL REQUIREMENTS:
        - Style: High-end, clean, modern, minimal, bold typography.
        - Content: Visuals must clearly represent the service: ${service}.
        - Branding: Professional placement for ${businessName}.
        - Quality: Marketing-grade, high-resolution advertising photography.
        
        ❌ NEGATIVE CONSTRAINTS:
        - NO UI wireframes, dashboards, or technical schematics.
        - NO generic placeholder text (e.g., "TEXT HERE").
        - NO nonsensical diagrams or 3D wire mesh.
        - DO NOT include phrases like "your Instagram account" or "your business".
        - The poster should look like a real business advertisement.
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
