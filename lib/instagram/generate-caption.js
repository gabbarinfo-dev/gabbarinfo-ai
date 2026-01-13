
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
        const service = state.context.service;
        const offer = state.context.offer;
        const website = state.assets.websiteUrl;
        const phone = state.assets.phone;

        // 🔥 FIX 4: CAPTION QUALITY (MANDATORY REQUIREMENTS)
       const prompt = `
You are a senior Instagram performance copywriter.

Your task is to write a HIGH-CONVERSION organic Instagram caption for a real business.
This caption will be published directly. Treat this as FINAL production copy.

========================
BUSINESS CONTEXT (FACTS)
========================
- Business Name: "${businessName}"
- Primary Service: "${service}"
- Offer / Promotion: "${offer || "No explicit discount"}"
- Contact Method:
  ${
    website
      ? `Website → ${website}`
      : phone
      ? `Phone / WhatsApp → ${phone}`
      : "None (No external contact method)"
  }

========================
NON-NEGOTIABLE RULES
========================
1. VOICE:
   - Write in first-person plural ONLY ("We", "Our").
   - Never write in third person.

2. BUSINESS NAME:
   - You MUST explicitly mention "${businessName}" at least once.
   - Never use placeholders like "your business", "our company", or "your Instagram account".

3. SERVICE FOCUS:
   - You MUST clearly mention and reinforce "${service}".
   - The benefit of the service must be obvious to a potential customer.

4. OFFER HANDLING:
   - If an offer exists ("${offer}"), it MUST be clearly highlighted.
   - If no offer exists, do NOT invent discounts.

5. CTA — STRICT ENFORCEMENT:
   - If a WEBSITE is provided:
     → You MUST include a CTA that explicitly tells users to VISIT the website.
     → The website URL MUST appear verbatim in the caption.
     → Phrases like "Contact us today" are NOT allowed.
   - If PHONE or WHATSAPP is provided:
     → You MUST include a CTA that explicitly tells users to CALL or WHATSAPP.
     → The phone number MUST appear verbatim.
   - If no contact method exists:
     → Use "Send us a DM" as the ONLY acceptable CTA.

6. STRUCTURE (MANDATORY):
   - Line 1: Strong hook (benefit-driven, not generic).
   - Line 2–3: Service value + offer (if any).
   - Line 4: Clear, explicit CTA (as per rules above).
   - Line 5: Hashtags.

7. HASHTAGS:
   - 3 to 5 hashtags only.
   - Must be relevant to "${service}" and business growth.
   - No generic spam hashtags (#instagood, #likeforlike, etc.).

========================
ABSOLUTE PROHIBITIONS
========================
- ❌ Generic CTAs ("Contact us today", "Reach out now" without method)
- ❌ Placeholder language
- ❌ Explaining what you are doing
- ❌ Emojis overload (max 2 emojis total)
- ❌ Quotation marks around the whole caption

========================
OUTPUT FORMAT (STRICT)
========================
Return ONLY valid JSON. No explanations. No markdown.

{
  "caption": "Full Instagram caption text here",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
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
        // Fallback that still meets basic branding requirements if AI fails
        const fallbackCaption = `Experience top-tier ${state.context.service} with ${state.businessName}. ${state.context.offer ? `Don't miss out: ${state.context.offer}!` : "Quality you can trust."} Contact us today!`;
        return {
            caption: fallbackCaption,
            hashtags: ["#qualityservice", "#business", "#instagram"]
        };
    }
}
