
import OpenAI from "openai";
import axios from "axios";
import { supabaseServer } from "../supabaseServer";

export default async function generateImage(state) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OpenAI API Key missing. Cannot generate image.");
    }

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    // Resolve Brand Elements
    const businessName = state.businessName || "Your Business";
    const service = state.context.service || "General Services";
    const offer = state.context.offer || "";
    const method = state.assets.contactMethod;
    let website = "";
    if (method === "website" && state.assets.websiteUrl) website = state.assets.websiteUrl;
    else if ((method === "phone" || method === "whatsapp") && state.assets.phone) website = state.assets.phone;

    // Resolve Logo/Branding Instruction
    let brandingInstruction = "";
    if (state.assets.logoDecision === "use_logo" && state.assets.logoUrl) {
        brandingInstruction = `Incorporate the business logo using this reference URL if possible for style/color, or place a professional logo placeholder in the corner: ${state.assets.logoUrl}`;
    } else {
        brandingInstruction = `Professional typography for the business name: "${businessName}". Place discretely as a logo.`;
    }

    // 🔥 MARKETING-GRADE PROMPT FIX
    const prompt = `
        Create a professional Instagram marketing poster for ${businessName}.
        
        BUSINESS CONTEXT:
        - Business: "${businessName}"
        - Service: "${service}"
        - Offer: "${offer || "Professional Services"}"
        
        VISUAL REQUIREMENTS:
        - Style: High-end, clean, modern, minimal, bold typography.
        - Content: Visuals must clearly represent the service: ${service}.
        - Branding: Professional placement for ${businessName}.
        - Quality: Marketing-grade, high-resolution advertising photography.
        
        ❌ NEGATIVE CONSTRAINTS:
        - NO UI wireframes, dashboards, or technical schematics.
        - NO generic placeholder text (e.g., "TEXT HERE").
        - NO nonsensical diagrams or 3D wire mesh.
        - DO NOT include phrases like "your Instagram account" or "your business".
        - The poster should look like a real business advertisement.
    `;

    try {
        // 1. Generate with DALL-E
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
        });

        const dalleUrl = response.data[0].url;
        if (!dalleUrl) throw new Error("DALL-E failed to return an image URL.");

        // 2. Download server-side
        console.log("📥 [Creative] Downloading DALL-E image for re-hosting...");
        const imageResponse = await axios.get(dalleUrl, { responseType: "arraybuffer" });
        const buffer = Buffer.from(imageResponse.data);

        // 3. Re-host to Supabase Storage
        // Path: instagram-creatives/{timestamp}_{filename}.jpg
        const fileName = `ig_${Date.now()}.jpg`;
        const bucketName = "instagram-creatives";

        console.log(`📤 [Creative] Uploading to Supabase Storage: ${bucketName}/${fileName}`);
        const { data: uploadData, error: uploadError } = await supabaseServer.storage
            .from(bucketName)
            .upload(fileName, buffer, {
                contentType: "image/jpeg",
                upsert: true
            });

        if (uploadError) {
            console.error("Supabase Upload Error:", uploadError);
            throw new Error(`Failed to re-host creative image: ${uploadError.message}`);
        }

        // 4. Get Public URL
        const { data: { publicUrl } } = supabaseServer.storage
            .from(bucketName)
            .getPublicUrl(fileName);

        if (!publicUrl) throw new Error("Failed to generate public URL for re-hosted image.");

        console.log("✅ [Creative] Image re-hosted successfully:", publicUrl);

        return {
            imageUrl: publicUrl,
            imagePrompt: prompt
        };

    } catch (e) {
        console.error("Image Generation/Re-hosting Error:", e);
        // STRICT RULE: Do not fall back to DALL-E URL. Abort instead.
        throw new Error(`Creative Image Safety Error: ${e.message}`);
    }
}
