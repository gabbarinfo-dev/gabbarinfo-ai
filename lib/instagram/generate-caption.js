
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function generateCaption(state) {
    // 6. INPUT SANITY CHECK
    if (!state.context.serviceLocked) {
        throw new Error("Cannot generate caption: Service context is not locked.");
    }

    if (!process.env.GEMINI_API_KEY) {
        return { 
            caption: `Check out ${state.businessName}! #business #instagram`, 
            hashtags: ["#business"] 
        };
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            Act as an expert social media manager.
            Write an engaging Instagram caption for a business named "${state.businessName}".
            
            Topic/Service: ${state.context.service}
            Special Offer: ${state.context.offer || "None"}
            Location: ${state.assets.city || "General"}
            Website: ${state.assets.websiteUrl || "N/A"}
            
            Requirements:
            - Professional but engaging tone.
            - Mention the service "${state.context.service}" clearly.
            - ${state.context.offer ? `Highlight the offer: "${state.context.offer}"` : ""}
            - Include 3-5 relevant hashtags.
            - Include a Call to Action (e.g., "Visit our website", "Call us").
            - Output JSON format: { "caption": "...", "hashtags": ["..."] }
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
        // Basic JSON extraction
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            return {
                caption: data.caption,
                hashtags: data.hashtags || []
            };
        }
        
        return {
            caption: text.replace(/#/g, "").trim(), // Fallback
            hashtags: []
        };

    } catch (e) {
        console.error("Caption Generation Error:", e);
        return {
            caption: `Here is a great post for ${state.businessName}.`,
            hashtags: []
        };
    }
}
