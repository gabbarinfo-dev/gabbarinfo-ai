
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
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
Contact Method: "${contactMethod}"

TASK
Write a highly engaging Instagram caption promoting the service "${service}" offered by "${businessName}".

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

CONTACT RULES

If Business Phone exists:
Include this line near the end:

Contact: ${phone}

If Business Phone does NOT exist:
Include this line:

DM us to get started.

OFFER RULE

If Offer ≠ None
Mention the offer naturally in the caption.

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

OUTPUT FORMAT

Return ONLY valid JSON:

{
  "caption": "Full caption here",
  "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5","#tag6"]
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
        // Fallback that still meets basic branding requirements if AI fails
        const fallbackCaption = `Experience top-tier ${servName} with ${bizName}. ${state.context.offer ? `Special offer: ${state.context.offer}!` : "Contact us to learn more today!"}`;
        return {
            caption: fallbackCaption,
            hashtags: ["#qualityservice", "#business", "#instagram"]
        };
    }
}
