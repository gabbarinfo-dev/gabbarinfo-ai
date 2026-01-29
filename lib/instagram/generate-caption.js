
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

        // ... (prompt logic stays same, using safe constants) ...

    } catch (e) {
        console.error("Caption Generation Error:", e);
        const bizName = state.businessName || "our team";
        const service = state.context.service || "premium quality";
        // Fallback that still meets basic branding requirements if AI fails
        const fallbackCaption = `Experience top-tier ${service} with ${bizName}. ${state.context.offer ? `Special offer: ${state.context.offer}!` : "Contact us to learn more today!"}`;
        return {
            caption: fallbackCaption,
            hashtags: ["#qualityservice", "#business", "#instagram"]
        };
    }
}

