
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

    // 🔥 IMAGE PROMPT - PRINT-READY MARKETING AD POSTER
    const ctaInImage = website ? `show text "Visit ${website}"` : (state.assets.phone ? `show phone number "${state.assets.phone}"` : "show 'DM for details'");

    const prompt = `
        Create a high-end, professional Instagram MARKETING POSTER for the brand: "${businessName}".
        
        MANDATORY VISUAL RULES:
        1. Brand Name: The brand name "${businessName}" MUST appear as LARGE, CLEAR, CENTERED professional typography. This is a typography-led ad.
        2. Product/Service: The service "${service}" must be visually obvious at first glance.
        3. Feature Offer: If an offer is present ("${offer}"), it MUST be visually dominant. Use a professional badge, ribbon, or price-tag style with big numeric emphasis (e.g., %, OFF, or ₹ symbols).
        4. CTA: Include a clear visible CTA in the image: ${ctaInImage}.
        
        STYLE & COMPOSITION:
        - Professional marketing photography or sleek 3D render.
        - High-contrast, ad-ready, clean, and modern.
        - Balanced commercial composition.
        
        ❌ STRICT NEGATIVE CONSTRAINTS (MANDATORY):
        - NO app UI, NO phone mockups, NO dashboards, NO charts.
        - NO lorem ipsum, NO distorted text.
        - NO generic phrases like "your business" or "your brand".
        - NO social media UI frames or feed elements.
        
        This must look like a high-resolution PRINT-READY AD POSTER, not an illustration or concept art.
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
