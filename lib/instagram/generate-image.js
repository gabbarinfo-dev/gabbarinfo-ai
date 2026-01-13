
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

    // 🔥 IMAGE PROMPT - MARKETING AD FOCUS
    const prompt = `
        Create a high-end, professional Instagram marketing poster for ${businessName}.
        
        VISUAL RULES:
        1. Branding: The brand name "${businessName}" MUST be clearly visible and bold. If no logo image is available, use strong, high-end typography-led branding.
        2. Offer: If an offer is present ("${offer}"), it MUST be visually dominant. Use a professional badge, sticker, or price tag style with large numeric emphasis (e.g., %, OFF, or INR).
        3. Service: The image MUST beautifully and clearly represent the service: "${service}".
        4. Style: High-contrast, ad-ready, clean, modern advertising photography.
        
        ❌ PROHIBITED (NEGATIVE CONSTRAINTS):
        - NO app UI wireframes, mockups, or dashboards.
        - NO Instagram feeds or phone screens showing social media.
        - NO generic placeholder text like "your business" or "your Instagram account".
        - NO nonsensical diagrams, 3D wire mesh, or technical schematics.
        
        The result must look like a real, high-resolution professional business advertisement ready for a commercial campaign.
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
