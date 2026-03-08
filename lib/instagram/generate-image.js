
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
- NO social media UI elements (no "likes", "comments", "share" icons)
- NO phone frames, laptop bezels, or device mockups showing an app
- NO Instagram, Facebook, or WhatsApp app interfaces
- NO watermarks, random numbers, or garbled background text
- NO hashtags in the image
- NO navigation bars or app buttons
- NO "Price Tags" or large discount stickers

[GOAL]
Create a premium, high-end "Lifestyle Marketing Photography" visual for an Instagram post (square 1080x1080). 
The image must feel like a page from a luxury magazine.

[BUSINESS CONTEXT]
- Brand/Company Name: ${businessName}
- Industry: ${industry}
- MAIN SERVICE TO ADVERTISE: ${service}
- SPECIAL OFFER: ${offer && offer !== "None" ? offer : "None"}
- CONTACT TO DISPLAY: ${contactText}

[VISUAL STYLE & AESTHETIC]
- THEME: Modern, Minimalist, Global Professional
- LIGHTING: Bright & Airy, High-key studio lighting
- COMPOSITION: Hero-centric text placement with plenty of negative space
- VIBE: Sophisticated and clean

[STRICT TEXT HIERARCHY & LAYOUT]
1. BRAND NAME (Top-Left): Place "${businessName.toUpperCase()}" in a tiny, minimalist, light watermark-style font in the top-left corner. It should be subtle and secondary.
2. HERO SERVICE (Center): Write "${service.toUpperCase()}" in LARGE, BOLD, high-contrast typography in the absolute center of the image. This is the main headline.
3. OFFER & CONTACT (Below Center): Clearly write the following details in a clean, professional, and LEGIBLE font directly BELOW the hero service name:
   - LINE 1 (Offer): "${offer && offer !== "None" ? offer : ""}"
   - LINE 2 (Contact): "${contactText}"
   *(Ensure these are in a high-contrast heavy sans-serif font to prevent AI garbling)*

[HERO VISUAL]
- A realistic, high-end visual representing "${service}" in the background (e.g., if hair saloon, a minimalist sleek salon interior or beautiful hair textures). The visual should not distract from the central text.

[TECHNICAL SPECS]
- High-resolution commercial photography style.
- ZERO cluttered elements.
- Soft color palette consistent with ${industry}.
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
