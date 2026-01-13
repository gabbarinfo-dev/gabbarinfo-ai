
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
    const service = state.context?.service || "Professional Services";
    const offer = state.context?.offer || "";
    const method = state.assets?.contactMethod;
    let contactFooter = "";

    if (method === "website") {
        contactFooter = state.assets?.websiteUrl || "Visit our website";
    } else if (method === "phone" || method === "whatsapp") {
        contactFooter = state.assets?.phone || "Contact us directly";
    }

    // Resolve Logo/Branding Instruction
    let brandingInstruction = "";
    if (state.assets.logoDecision === "use_logo" && state.assets.logoUrl) {
        brandingInstruction = `Incorporate the business logo using this reference URL if possible for style/color, or place a professional logo placeholder in the corner: ${state.assets.logoUrl}`;
    } else {
        brandingInstruction = `Professional typography for the business name: "${businessName}". Place discretely as a logo.`;
    }

    // 🔥 FIX 3: MANDATORY IMAGE QUALITY
    const prompt = `
        Create a high-end, professional Instagram post image for a business.
        
        BUSINESS DETAILS:
        - Business Name: ${businessName}
        - Service Focus: ${service}
        - Special Offer: ${offer ? offer : "Professional Service Showcase"}
        - Branding: ${brandingInstruction}
        - Contact Info: ${contactFooter
            ? `Include "${contactFooter}" as a clean footer text.`
            : "No footer text needed."
        }
        
        VISUAL REQUIREMENTS:
        - The image must BEAUTIFULLY and CLEARLY represent the service: ${service}.
        - Style: Premium, clean, modern, marketing-ready, high-resolution.
        - Composition: Balanced, sleek, aesthetic advertising photography or high-end 3D render.
        - Text Rules: NO extra nonsensical text. ONLY the business name/logo and the clean contact footer.
        - Tone: Trustworthy and commercial.
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
        console.error("❌ [DALL-E] Image Generation Error:", {
            message: e.message,
            stack: e.stack,
            cause: e.cause,
            response: e.response?.data
        });
        throw new Error("Failed to generate image. Please try again.");
    }
}
