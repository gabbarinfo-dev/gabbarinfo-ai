

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

        const ctaText = website ? `Visit ${website}` : (phone ? (state.assets.contactMethod === "whatsapp" ? `WhatsApp us at ${phone}` : `Call ${phone}`) : "DM for details");

        // 🔥 CAPTION QUALITY (STRICT STRUCTURE)
        const prompt = `
            Act as a world-class social media copywriter for Instagram.
            
            REQUIRED STRUCTURE:
            ${businessName} — ${service}
            ${offer ? `🎉 ${offer}` : ""}
            👉 ${ctaText}
            #hashtags
            
            COYPWRITING RULES:
            - NEVER use "your business" or "your Instagram account".
            - NEVER use generic phrases like "contact us today".
            - Tone: Professional, exciting, and branded. Use first-person plural ("We", "Our").
            - Final output must be JSON.
            
            OUTPUT FORMAT (JSON):
            {
              "caption": "The full engaging caption text following the structure above",
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
