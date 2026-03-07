
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
        // Use the model from env var, defaulting to gemini-2.0-flash if not set
        const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
        const model = genAI.getGenerativeModel({ model: modelName });

        const businessName = state.businessName || "our business";
        const industry = state.businessCategory || "Business";
        const service = state.context.service || "our services";
        const offer = state.context.offer;
        const website = state.assets.websiteUrl;
        const phone = state.assets.phone;
        const contactMethod = state.assets.contactMethod;

        // Resolve contact line
        let businessPhone = phone || website || "";

        // Build CONTACT RULES section exactly as per template
        let contactRules = "";
        if (businessPhone) {
            contactRules = `If Business Phone exists:
Include this line near the end:

Contact: ${businessPhone}`;
        } else {
            contactRules = `If Business Phone does NOT exist:
Include this line:

DM us to get started.`;
        }

        // Build OFFER RULE section exactly as per template
        let offerRule = "";
        if (offer && offer.toLowerCase() !== "none") {
            offerRule = `If Offer ≠ None
Mention the offer "${offer}" naturally in the caption.`;
        } else {
            offerRule = `If Offer = None
Do not mention discounts.`;
        }

        const brandHashtag = `#${businessName.replace(/[^a-zA-Z0-9]/g, "")}`;

        // ═══════════════════════════════════════════════════════════════════
        // THE EXACT GEMINI CAPTION PROMPT — variables filled exactly as requested
        // ═══════════════════════════════════════════════════════════════════
        const prompt = `You are a world-class Instagram marketing copywriter who writes high-converting captions for ANY type of business.

BUSINESS INFORMATION
Business Name: "${businessName}"
Industry: "${industry}"
Primary Service: "${service}"
Offer: "${offer || "None"}"
Business Phone: "${businessPhone || "None"}"
Contact Method: "${contactMethod || "none"}"

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

${contactRules}

OFFER RULE

${offerRule}

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
1 brand hashtag (${brandHashtag})

Example structure:

Industry: #ContentMarketing  
Service: #ContentWriter  
Intent: #HireAWriter  
Brand: ${brandHashtag}

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
}`;

        // Log for debugging
        console.log(`📝 [Caption Gen] Using model: ${modelName}`);
        console.log(`📝 [Caption Gen] Business: ${businessName} | Service: ${service} | Offer: ${offer || "None"} | Phone: ${businessPhone || "None"}`);

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
