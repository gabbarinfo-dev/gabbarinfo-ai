import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY not found in environment" });
    }

    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const response = await genAI.listModels();

        const models = response.models.map(m => ({
            name: m.name,
            supportedMethods: m.supportedGenerationMethods
        }));

        res.status(200).json({
            message: "Success",
            api_key_found: true,
            models: models
        });

    } catch (error) {
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
}
