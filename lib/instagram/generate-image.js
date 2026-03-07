
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
- NO phone frames or device mockups
- NO Instagram or Facebook app interfaces
- NO watermarks or garbled text
- NO hashtags in the image
- NO navigation bars or app buttons

[GOAL]
Create a high-end, professional commercial advertisement visual for a square social media post (1080x1080).

[BUSINESS CONTEXT]
- Business Name: ${businessName}
- Industry: ${industry}
- Primary Service: ${service}
- Special Offer: ${offer || "None"}
- Logo Reference: ${hasLogo === "YES" ? logoRef : "None (text-based branding instead)"}

[VISUAL COMPOSITION]
Place a high-quality, realistic visual of "${service}" as the hero element in the center. 
The style should be premium commercial photography with studio lighting.

[BRANDING & TEXT]
1. BRANDING (Top-Left): 
   - If Logo Reference is provided: Incorporate the logo professionally.
   - If No Logo: Write "${businessName}" in sleek, minimal typography.
2. OFFER (Top-Right): 
   - ${offer && offer !== "None" ? `Highlight the offer "${offer}" inside a stylish promotional badge or sticker.` : "Do not include any discount text."}
3. CONTACT (Bottom-Right): 
   - Write "${contactText.includes("@") || contactText.includes("http") ? contactText : `Contact: ${contactText}`}" in clean, readable font as a footer element.

[TECHNICAL SPECS]
- Resolution: 1080x1080
- Composition: Minimalist, clean, bold, and high-conversion.
- Spacing: Maintain clear margins (safe areas).
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
