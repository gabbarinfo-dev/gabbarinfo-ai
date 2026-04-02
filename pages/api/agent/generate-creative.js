import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ ok: false });
    }

    const { intake, objective = "Traffic", offer = "" } = req.body;
    if (!intake) {
      return res.status(400).json({ ok: false, error: "Missing intake data" });
    }

    let modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    if (modelName.includes("models/")) modelName = modelName.replace("models/", "");

    const model = genAI.getGenerativeModel({ model: modelName });

    const offerLine = offer && offer.trim()
      ? `Special Offer to feature: "${offer.trim()}"`
      : "No specific offer — AI should suggest a compelling hook.";

    const prompt = `
You are a senior Meta Ads copywriter and strategist.

Using ONLY the information below, generate:
- 3 headlines (max 40 chars each)
- 2 primary texts (max 125 chars each)
- 1 CTA from Meta-approved list (e.g., LEARN_MORE, SHOP_NOW, BOOK_NOW, CONTACT_US, SIGN_UP)
- 1 tagline (max 8 words, punchy, complements the service and offer — this will appear on the ad image)
- 1 DALL-E image prompt (strict rules below)
- targeting suggestions (interests, demographics) for this specific business and location

Rules for ALL fields:
- Do NOT ask questions
- Do NOT use placeholders
- Do NOT say REQUIRED
- Be confident and conversion-focused
- Match the business tone automatically
- Incorporate the special offer naturally into headlines and primary texts if one is provided

STRICT Rules for image_prompt (DALL-E):
- Describe ONLY a clean, photorealistic scene that visually represents the SERVICE
- Absolutely NO text, words, letters, labels, signs, banners, watermarks, or typography of any kind in the image
- Absolutely NO logo, brand name, or business name in the image
- NO animated style, cartoon, infographic, or diagrammatic look
- Focus on real-world visual: e.g. a stylist working, a mechanic fitting a CNG kit, a doctor consulting — whatever matches the service
- Use professional photography lighting, shallow depth of field, cinematic quality

Business Data:
${JSON.stringify(intake, null, 2)}

Objective: ${objective}
${offerLine}

Return STRICT JSON in this exact shape:
{
  "headlines": ["", "", ""],
  "primary_texts": ["", ""],
  "cta": "",
  "tagline": "",
  "image_prompt": "",
  "targeting_suggestions": {
    "interests": ["", ""],
    "demographics": ["", ""]
  }
}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid AI response");
    }

    const creative = JSON.parse(jsonMatch[0]);

    // Cleanup: Ensure values are present
    if (!creative.headlines) creative.headlines = ["Special Offer"];
    if (!creative.primary_texts) creative.primary_texts = [intake.business_about || "Check out our services"];
    if (!creative.cta) creative.cta = "LEARN_MORE";

    return res.json({
      ok: true,
      creative
    });

  } catch (err) {
    console.error("Creative generation error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}
