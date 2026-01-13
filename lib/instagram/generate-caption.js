
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
            Act as a world-class social media copywriter for Instagram.
            
            BUSINESS CONTEXT:
            - Business: "${businessName}"
            - Primary Service/Product: "${service}"
            - Promotion/Offer: "${offer || "General High-Quality Service"}"
            - Contact Link/Info: ${website || phone || "Contact us directly via DM"}
            
            COYPWRITING RULES:
            1. PERSPECTIVE: Write in first-person plural ("We", "Our").
            2. MANDATORY INCLUSIONS: You MUST mention "${businessName}", "${service}", and "${offer || "our services"}".
            3. CALL TO ACTION: You MUST include a clear CTA involving "${website || phone || "contacting us"}".
            4. TONE: Professional, premium, exciting, and highly engaging.
            5. STRUCTURE: Engaging hook -> Body mentioning service/offer -> Strong CTA -> 3-5 high-traffic hashtags.
            
            ❌ PROHIBITED: "Here is a great post...", "Check this out", generic placeholders.
            
            OUTPUT FORMAT: Reply ONLY with a valid JSON object:
            {
              "caption": "Your full engaging caption here",
              "hashtags": ["#tag1", "#tag2", "#tag3"]
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
