
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
The image must feel like a page from a luxury magazine or a curated professional feed.

[BUSINESS CONTEXT]
- Brand Name: ${businessName}
- Industry: ${industry}
- Service to Highlight: ${service}
- Special Offer: ${offer && offer !== "None" ? offer : "None"}

[VISUAL STYLE & AESTHETIC]
- THEME: Modern, Minimalist, Global Professional
- LIGHTING: Bright & Airy, High-key studio lighting, natural soft shadows
- COMPOSITION: Hero-centric, plenty of negative space for a clean look
- VIBE: Sophisticated, clean, and extremely high-quality photography

[BRANDING & TEXT INTEGRATION]
1. BRAND LOGO: Place "${businessName.toUpperCase()}" as a sleek, minimalist watermark in the top corner using elegant sans-serif typography.
2. HERO VISUAL: A realistic, high-end visual representing "${service}". (e.g., if writing service, show a minimalist sleek workspace with a designer pen and a high-end notepad; if tech, show clean modern hardware).
3. THE OFFER: ${offer && offer !== "None" ? `Integrate the text "${offer}" elegantly into the scene, perhaps as a subtle high-end label or a minimalist overlay.` : "NO promotional text or prices."}
4. THE CONTACT: Discretely integrated footer text: "${contactText}"

[TECHNICAL SPECS]
- High-resolution commercial photography style.
- ZERO cluttered background elements.
- Soft, professional color palette consistent with the ${industry} industry.
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
