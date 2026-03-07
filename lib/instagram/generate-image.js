
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

    const prompt = `
Create a high-end, professional marketing image designed to be posted on Instagram.

IMPORTANT
This is NOT an Instagram interface screenshot.
It is a standalone promotional graphic.

IMAGE SIZE
1080 × 1080 pixels (square Instagram post format)

BUSINESS DETAILS
Business Name: ${businessName}
Industry: ${industry}
Primary Service: ${service}
Offer: ${offer || "None"}
Business Phone: ${state.assets.phone || "None"}
Logo Available: ${hasLogo}

VISUAL CONCEPT
Create a premium advertising visual that clearly represents the service "${service}" within the "${industry}" industry.

Interpret the service visually depending on the industry context.

Examples:
Laundry → washing machines, clean folded clothes
Salon → hair styling tools, grooming environment
Automobile repair → mechanic tools, engines
Bearing industry → industrial machinery, precision components
Astrology → cosmic elements, zodiac imagery
Content writing → laptop workspace, writing tools, creative desk

STYLE
• premium commercial advertising
• modern clean composition
• high-end studio lighting
• realistic or photorealistic marketing style
• minimal clutter
• marketing-ready creative

LAYOUT GRID (IMPORTANT)

Image size: 1080 × 1080 px

Top margin safe area: 80 px  
Bottom margin safe area: 120 px

LOGO / BRANDING AREA
Position: Top-left
Bounding box: x=60px, y=60px, width=300px, height=120px

If Logo Available = YES
→ place the provided logo here using this reference: ${logoRef}

If Logo Available = NO
→ place the text "${businessName}" in elegant clean typography inside this area

SERVICE VISUAL AREA
Center region
Bounding box: x=120px, y=200px, width=840px, height=600px

The main visual representing "${service}" must dominate this area.

OFFER BADGE (ONLY IF OFFER EXISTS)

If Offer ≠ None
Place a promotional badge in:

Bounding box: x=740px, y=80px, width=260px, height=120px

Badge style:
• bright promotional highlight
• modern sticker or ribbon style
• short readable offer text

CONTACT AREA

Bottom-right safe region
Bounding box: x=640px, y=900px, width=380px, height=120px

If Business Phone exists
→ display text:

Contact: ${state.assets.phone || ""}

If Business Phone does NOT exist
→ display:

DM us

Typography should be clean, subtle and readable.

STRICTLY FORBIDDEN

• No Instagram UI
• No phone frame
• No social media logos
• No Instagram icons
• No likes/comments interface
• No watermark
• No hashtags
• No captions

OUTPUT
A professional Instagram marketing creative representing "${service}" for "${businessName}" following the layout constraints above.
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
