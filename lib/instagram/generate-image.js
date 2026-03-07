
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

    // Resolve dynamic fields
    const industry = state.businessCategory || "Business";
    const hasLogo = (state.assets.logoDecision === "use_logo" && state.assets.logoUrl) ? "YES" : "NO";
    const offerText = (offer && offer.toLowerCase() !== "none") ? offer : "None";
    const phoneText = state.assets.phone || contactInfo || "None";

    const prompt = `Create a high-end, professional marketing image designed to be posted on Instagram.

IMPORTANT
This is NOT an Instagram interface screenshot.
It is a standalone promotional graphic.

IMAGE SIZE
1080 × 1080 pixels (square Instagram post format)

BUSINESS DETAILS
Business Name: ${businessName}
Industry: ${industry}
Primary Service: ${service}
Offer: ${offerText}
Business Phone: ${phoneText}
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

${hasLogo === "YES" ? `If Logo Available = YES\n→ place the provided logo here using this reference: ${state.assets.logoUrl}` : `If Logo Available = NO\n→ place the text "${businessName}" in elegant clean typography inside this area`}

SERVICE VISUAL AREA
Center region
Bounding box: x=120px, y=200px, width=840px, height=600px

The main visual representing "${service}" must dominate this area.

${offerText !== "None" ? `OFFER BADGE (ONLY IF OFFER EXISTS)

If Offer ≠ None
Place a promotional badge in:

Bounding box: x=740px, y=80px, width=260px, height=120px

Badge style:
• bright promotional highlight
• modern sticker or ribbon style
• short readable offer text: "${offerText}"` : ""}

CONTACT AREA

Bottom-right safe region
Bounding box: x=640px, y=900px, width=380px, height=120px

${phoneText !== "None" ? `If Business Phone exists\n→ display text:\n\nContact: ${phoneText}` : `If Business Phone does NOT exist\n→ display:\n\nDM us`}

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
A professional Instagram marketing creative representing "${service}" for "${businessName}" following the layout constraints above.`;

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


