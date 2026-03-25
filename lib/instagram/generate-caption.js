
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function generateCaption(state) {
    if (!state.context.serviceLocked) {
        throw new Error("Cannot generate caption: Service context is not locked.");
    }

    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY missing. Cannot generate caption.");
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Use the model from ENV or fallback, ensuring we handle common prefixing
        let modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
        if (modelName.includes("models/")) {
            modelName = modelName.replace("models/", "");
        }
        const model = genAI.getGenerativeModel({ model: modelName });

        const businessName = state.businessName || "our business";
        const service = state.context.service || "our services";
        const offer = state.context.offer;
        const website = state.assets.websiteUrl;
        const phone = state.assets.phone;

        const industry = state.businessCategory || "Business";
        const contactMethod = state.assets.contactMethod || "DM";

        const prompt = `
You are a world-class Instagram marketing copywriter who writes high-converting captions for ANY type of business.

BUSINESS INFORMATION
Business Name: "${businessName}"
Industry: "${industry}"
Primary Service: "${service}"
Offer: "${offer || "None"}"
Business Phone: "${phone || "None"}"
Business Website: "${website || "None"}"
Contact Method: "${contactMethod}"

TASK
Write a highly engaging Instagram caption promoting the service "${service}" offered by "${businessName}". Additionally, generate a powerful 5-6 word marketing tagline specifically for an image overlay.

COPYWRITING RULES

VOICE
• First-person plural ("We", "Our")
• Professional and confident tone
• Marketing-focused but natural

STRUCTURE

1. Strong hook (first line must grab attention)
2. Explain the value of the service "${service}"
3. Brief benefit explanation relevant to "${industry}"
4. Mention "${businessName}" clearly
5. Strong call-to-action

TAGLINE RULE (MANDATORY)
• The tagline MUST be based on the Primary Service "${service}" and the brand's identity.
• Do NOT include price, discounts, or offers in the tagline.
• Example if service is "Google Ads": "Expert Google Ads, Unmatched ROI" or "Scale Results with Google Ads".
• Example if service is "Social Media": "Dominating Social Media Presence".

CONTACT RULES

Based on the selected Contact Method: "${contactMethod}"

1. If Contact Method is "website":
   Include this line near the end: Website: ${website || "Visit our link in bio"}

2. If Contact Method is "phone" or "whatsapp":
   Include this line near the end: Contact: ${phone || "Call us today"}

3. If Contact Method is "none":
   Include this line near the end: DM us to get started.

OFFER RULE

If Offer ≠ None
Mention the offer naturally in the caption text (NOT in the tagline).

If Offer = None
Do not mention discounts.

GENERIC LANGUAGE RULE

Avoid vague phrases such as:
• quality service
• best service
• trusted solution

Instead describe what the service actually helps customers achieve.

HASHTAG RULES

Generate 6–8 hashtags following this mix:

2 industry-level hashtags  
2 niche service hashtags  
1–2 intent hashtags (customers searching for the service)  
1 brand hashtag (#${businessName.replace(/[^a-zA-Z0-9]/g, "")})

Example structure:

Industry: #ContentMarketing  
Service: #ContentWriter  
Intent: #HireAWriter  
Brand: #${businessName.replace(/[^a-zA-Z0-9]/g, "")}

IMPORTANT

Do NOT generate generic hashtags like:
#business
#instagram
#qualityservice
#bestservice

LAYOUT HINT RULE
Choose ONE layout letter (A/B/C/D/E) that best fits this business/service for the image overlay design:
• A = Classic centre strip — works well for any general service/tech/digital
• B = Bold bottom card — best for food, retail, local services, physical products
• C = Top headline — best for professional services, law, finance, healthcare
• D = Left-side column — best for creative agencies, photography, interior design
• E = Minimal floating text — best for luxury, jewellery, high-end brands, spas

VISUAL MOOD RULE
Choose a highly specific, creative visual direction for the DALL-E image. Be inventive — avoid generic phrases.
Examples of GOOD moods:
• "Cinematic overhead flat-lay of minimalist tools on dark slate"
• "Neon-lit isometric city with glowing data streams"
• "Golden-hour macro photography of crafted product on marble"
• "Vibrant 3D illustrated characters in a dynamic workspace"
• "Dark luxury editorial photography with dramatic rim lighting"
• "Pastel soft-focus lifestyle photography with bokeh depth"
• "Bold graphic design with geometric shapes and high contrast"
Do NOT use: "3D isometric digital office", "high-end commercial photography" — these are too generic.

OUTPUT FORMAT

Return ONLY valid JSON:

{
  "caption": "Full caption here",
  "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5","#tag6"],
  "tagline": "A punchy 5-6 word tagline for an image overlay",
  "visual_mood": "A highly specific and creative visual style description for DALL-E",
  "layout_hint": "A"
}
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Robust JSON extraction
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Caption resolution failed (invalid response).");

        const data = JSON.parse(jsonMatch[0]);
        if (!data.caption) throw new Error("Caption resolution failed (no text).");

        return {
            caption: data.caption,
            hashtags: data.hashtags || [],
            tagline: data.tagline || (state.context.service ? `Best ${state.context.service} in town` : "Premium Quality Service"),
            visualMood: data.visual_mood || [
                "Cinematic overhead flat-lay of minimalist tools on dark slate",
                "Neon-lit isometric city with glowing data streams",
                "Golden-hour macro photography of crafted product on marble",
                "Dark luxury editorial photography with dramatic rim lighting",
                "Pastel soft-focus lifestyle photography with bokeh depth",
                "Bold geometric graphic shapes in high contrast"
            ][Math.floor(Math.random() * 6)],
            layoutHint: data.layout_hint || null
        };

    } catch (e) {
        console.error("Caption Generation Error:", e);
        const bizName = state.businessName || "our business";
        const servName = state.context.service || "premium service";
        const industry = state.businessCategory || "Business";
        const offer = state.context.offer;
        const phone = state.assets.phone;
        const website = state.assets.websiteUrl;

        // MUCH SMARTER FALLBACK: Still uses the user data to make it look professional
        let fallbackCaption = `At ${bizName}, we pride ourselves on delivering the highest standards in ${servName}.`;

        if (offer) {
            fallbackCaption += `\n\n🔥 LIMITED TIME OFFER: ${offer}`;
        }

        fallbackCaption += `\n\nExperience the difference with ${bizName} in the ${industry} niche.`;

        if (phone && website) {
            fallbackCaption += `\n\n📞 Contact us: ${phone}\n🌐 Visit: ${website}`;
        } else if (phone) {
            fallbackCaption += `\n\n📞 Contact us: ${phone}`;
        } else if (website) {
            fallbackCaption += `\n\n🌐 Visit our website: ${website}`;
        } else {
            fallbackCaption += `\n\n📩 DM us to get started today!`;
        }

        // Generate dynamic hashtags manually for the fallback
        const cleanBiz = bizName.replace(/[^a-zA-Z0-9]/g, "");
        const cleanServ = servName.replace(/[^a-zA-Z0-9]/g, "");
        const cleanInd = industry.replace(/[^a-zA-Z0-9]/g, "");

        return {
            caption: fallbackCaption,
            hashtags: [`#${cleanBiz}`, `#${cleanServ}`, `#${cleanInd}`, "#PremiumService", "#CustomerFirst", "#QualityWork"],
            tagline: state.context.service ? `Best ${state.context.service} in town` : "Premium Quality Service",
            visualMood: "Natural professional photography"
        };
    }
}
