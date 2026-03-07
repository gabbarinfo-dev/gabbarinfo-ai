
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
        const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.0-flash" });

        const businessName = state.businessName || "our business";
        const businessCategory = state.businessCategory || "Business";
        const service = state.context.service || "our services";
        const offer = state.context.offer;
        const website = state.assets.websiteUrl;
        const phone = state.assets.phone;
        const contactMethod = state.assets.contactMethod;

        // Build contact string for caption
        let contactLine = "";
        if (contactMethod === "website" && website) contactLine = `Visit: ${website}`;
        else if (contactMethod === "whatsapp" && phone) contactLine = `WhatsApp: ${phone}`;
        else if (contactMethod === "phone" && phone) contactLine = `Call: ${phone}`;

        const prompt = `
You are a world-class Instagram marketing copywriter who writes high-converting captions for ANY type of business.

BUSINESS INFORMATION:
- Business Name: "${businessName}"
- Industry: "${businessCategory}"
- Primary Service: "${service}"
- Offer: "${offer || "None"}"
- Contact Method: "${contactMethod || "none"}"
- Business Phone: "${phone || "None"}"
- Website: "${website || "None"}"

TASK:
Write a highly engaging Instagram caption promoting the service "${service}" offered by "${businessName}".

COPYWRITING RULES:

VOICE:
• First-person plural ("We", "Our")
• Professional and confident tone
• Marketing-focused but natural

STRUCTURE:
1. Strong hook (first line must grab attention)
2. Explain the value of the service "${service}"
3. Brief benefit explanation relevant to "${businessCategory}"
4. Mention "${businessName}" clearly
5. Strong call-to-action

CONTACT RULES:
${phone ? `Include this line near the end: Contact: ${phone}` : contactLine ? `Include this line near the end: ${contactLine}` : `Include this line: DM us to get started.`}

OFFER RULE:
${offer ? `Mention the offer "${offer}" naturally in the caption. Make it prominent.` : `Do not mention discounts or special offers.`}

GENERIC LANGUAGE RULE:
Avoid vague phrases such as:
• "quality service"
• "best service"
• "trusted solution"
Instead describe what the service actually helps customers achieve.

HASHTAG RULES:
Generate 6–8 hashtags following this mix:
- 2 industry-level hashtags (related to "${businessCategory}")
- 2 niche service hashtags (related to "${service}")
- 1–2 intent hashtags (what customers searching for "${service}" would use)
- 1 brand hashtag (#${businessName.replace(/[^a-zA-Z0-9]/g, "")})

Example structure:
Industry: #ContentMarketing
Service: #ContentWriter
Intent: #HireAWriter
Brand: #${businessName.replace(/[^a-zA-Z0-9]/g, "")}

IMPORTANT:
Do NOT generate generic hashtags like:
#business, #instagram, #qualityservice, #bestservice

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "caption": "Full caption here",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6"]
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
            hashtags: data.hashtags || []
        };

    } catch (e) {
        console.error("Caption Generation Error:", e);
        const bizName = state.businessName || "our team";
        const servName = state.context.service || "premium quality";
        const bizTag = `#${(state.businessName || "business").replace(/[^a-zA-Z0-9]/g, "")}`;
        const servTag = `#${(state.context.service || "service").replace(/[^a-zA-Z0-9]/g, "")}`;

        let fallbackCaption = `Experience top-tier ${servName} with ${bizName}.`;
        if (state.context.offer) fallbackCaption += ` 🔥 Special offer: ${state.context.offer}!`;
        if (state.assets.websiteUrl) fallbackCaption += `\nVisit: ${state.assets.websiteUrl}`;
        else if (state.assets.phone) fallbackCaption += `\nContact: ${state.assets.phone}`;
        else fallbackCaption += " Contact us to learn more today!";

        return {
            caption: fallbackCaption,
            hashtags: [bizTag, servTag, `#${(state.businessCategory || "services").replace(/[^a-zA-Z0-9]/g, "")}`, "#supportlocal", "#growyourbusiness"]
        };
    }
}

