
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

    // Build logo instruction
    let logoInstruction = "";
    if (state.assets.logoDecision === "use_logo" && state.assets.logoUrl) {
        logoInstruction = `If Logo Available = YES\n→ Place the provided business logo here using this reference: ${state.assets.logoUrl}`;
    } else {
        logoInstruction = `If Logo Available = NO\n→ Place the text "${businessName}" in elegant clean typography inside this area`;
    }

    // Build offer instruction
    let offerInstruction = "";
    if (offer && offer.toLowerCase() !== "none") {
        offerInstruction = `
OFFER BADGE
Position: Top-right region
Bounding box: x=740px, y=80px, width=260px, height=120px

Place a promotional badge with the text: "${offer}"
Badge style:
• bright promotional highlight
• modern sticker or ribbon style
• short readable offer text`;
    } else {
        offerInstruction = `
OFFER BADGE: NONE — Do not include any promotional badge or discount text.`;
    }

    // Build contact instruction
    let contactInstruction = "";
    if (contactInfo) {
        contactInstruction = `
CONTACT AREA
Position: Bottom-right safe region
Bounding box: x=640px, y=900px, width=380px, height=120px

Display text: "Contact: ${contactInfo}"
Typography: clean, subtle and readable.`;
    } else {
        contactInstruction = `
CONTACT AREA
Position: Bottom-right safe region
Bounding box: x=640px, y=900px, width=380px, height=120px

Display text: "DM us"
Typography: clean, subtle and readable.`;
    }

    const industry = state.businessCategory || "Business";

    const prompt = `
Create a high-end, professional marketing image designed to be posted as a social media advertisement.

IMPORTANT:
This is NOT a social media interface screenshot.
It is a standalone promotional graphic.
Do NOT include any phone frames, app interfaces, or social media UI elements.

IMAGE SIZE: 1080 × 1080 pixels (square format)

BUSINESS DETAILS:
- Business Name: ${businessName}
- Industry: ${industry}
- Primary Service: ${service}

VISUAL CONCEPT:
Create a premium advertising visual that clearly represents the service "${service}" within the "${industry}" industry.

Interpret the service visually depending on the industry context. Examples:
- Laundry → washing machines, clean folded clothes
- Salon → hair styling tools, grooming environment
- Automobile repair → mechanic tools, engines
- Bearing industry → industrial machinery, precision components
- Astrology → cosmic elements, zodiac imagery
- Content writing → laptop workspace, writing tools, creative desk

STYLE:
• premium commercial advertising
• modern clean composition
• high-end studio lighting
• realistic or photorealistic marketing style
• minimal clutter
• marketing-ready creative

LAYOUT GRID:

Top margin safe area: 80px
Bottom margin safe area: 120px

LOGO / BRANDING AREA
Position: Top-left
Bounding box: x=60px, y=60px, width=300px, height=120px
${logoInstruction}

SERVICE VISUAL AREA
Position: Center region
Bounding box: x=120px, y=200px, width=840px, height=600px
The main visual representing "${service}" must dominate this area.
${offerInstruction}
${contactInstruction}

CRITICAL TEXT RULES:
- SPELL EVERY WORD EXACTLY AS PROVIDED. The business name is exactly: "${businessName}" — do NOT add extra letters, do NOT misspell.
- Keep text in the image to an absolute MINIMUM.

STRICTLY FORBIDDEN:
- No Instagram UI or interface elements
- No phone frame or device mockups
- No social media logos or icons (no Instagram, Facebook, Twitter/X icons)
- No likes/comments/share interface elements
- No watermarks
- No hashtags or caption text
- No nonsensical or garbled text

OUTPUT:
A professional marketing creative representing "${service}" for "${businessName}" following the layout constraints above.
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
