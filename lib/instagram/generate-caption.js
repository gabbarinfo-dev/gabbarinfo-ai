
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
            Act as a world-class social media copywriter for Instagram.
            
            BUSINESS CONTEXT:
            - Business: "${businessName}"
            - Industry/Category: "${businessCategory}"
            - Primary Service/Product: "${service}"
            - Promotion/Offer: "${offer || "No specific offer"}"
            - Contact: ${contactLine || "DM us directly"}
            
            COPYWRITING RULES:
            1. PERSPECTIVE: Write in first-person plural ("We", "Our").
            2. MANDATORY INCLUSIONS:
               - You MUST mention "${businessName}" by name.
               - You MUST mention "${service}" as the core offering.
               ${offer ? `- You MUST highlight the offer "${offer}" prominently (use emojis like 🔥 or ⚡ to draw attention).` : ""}
               ${contactLine ? `- You MUST end with contact info: "${contactLine}".` : ""}
            3. CALL TO ACTION: Strong, actionable CTA (e.g., "Book now", "Visit us today", "DM to get started").
            4. TONE: Professional, premium, exciting, and highly engaging.
            5. STRUCTURE: Engaging hook → Body mentioning service${offer ? "/offer" : ""} → Strong CTA${contactLine ? " with contact info" : ""}.
            
            HASHTAG RULES:
            - Generate 5-8 hashtags.
            - Hashtags MUST be specific to "${service}" and "${businessCategory}".
            - Include the business name as a hashtag (e.g., #${businessName.replace(/[^a-zA-Z0-9]/g, "")}).
            - Do NOT use generic hashtags like #business, #instagram, #qualityservice.
            - Mix: 2-3 high-traffic industry tags + 2-3 niche service tags + 1 brand tag.
            
            ❌ PROHIBITED: "Here is a great post...", "Check this out", generic placeholders, generic hashtags.
            
            OUTPUT FORMAT: Reply ONLY with a valid JSON object:
            {
              "caption": "Your full engaging caption here",
              "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
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
