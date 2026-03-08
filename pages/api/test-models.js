import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY not found in environment" });
    }

    try {
        // Using direct fetch to avoid SDK version inconsistencies
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || "Failed to fetch models");
        }

        const models = data.models.map(m => ({
            name: m.name,
            displayName: m.displayName,
            supportedMethods: m.supportedGenerationMethods
        }));

        res.status(200).json({
            message: "Success",
            endpoint_used: "v1beta",
            models: models
        });

    } catch (error) {
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
}
