// pages/api/video/generate-promo-script.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.body?.userEmail;
  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Please log in to generate promotional scripts." });
  }

  const {
    websiteUrl = "",
    brandName = "",
    serviceToPromote = "",
    specialOffer = "",
    promoAngle = "founder_pitch", // "founder_pitch" | "customer_owner_skit" | "direct_response"
    promoCTA = "Click the link in bio",
    language = "en_uk", // "hindi" | "en_us" | "en_uk"
    durationSeconds = 15,
  } = req.body;

  let scrapedContext = "";
  if (websiteUrl && websiteUrl.trim().startsWith("http")) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const siteRes = await fetch(websiteUrl.trim(), {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      clearTimeout(timeoutId);

      if (siteRes.ok) {
        const html = await siteRes.text();
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        const headings = Array.from(html.matchAll(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi))
          .map((m) => m[1].trim())
          .filter(Boolean)
          .slice(0, 5);

        scrapedContext = `
WEBSITE EXTRACTED INSIGHTS:
- Title: ${titleMatch ? titleMatch[1].trim() : "N/A"}
- Description: ${metaDescMatch ? metaDescMatch[1].trim() : "N/A"}
- Key Services/Headings: ${headings.join(" | ")}
`;
      }
    } catch (crawlErr) {
      console.warn("[PromoScript] Website scrape skip:", crawlErr.message);
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: "Missing OpenAI API key" });
  }

  const openai = new OpenAI({ apiKey });

  let langInstruction = "";
  if (language === "hindi") {
    langInstruction = `CRITICAL LANGUAGE RULE (HINDI):
All spoken dialogue lines MUST be written in natural, fluent, colloquial Devanagari script (हिंदी) with authentic Indian commercial phrasing so neural Indian voices deliver native Indian cadence with zero American accent!`;
  } else if (language === "en_uk") {
    langInstruction = `CRITICAL LANGUAGE RULE (BRITISH ENGLISH):
Write in refined, charismatic, eloquent British English. Use authentic British commercial terminology (e.g. bespoke, brilliant, whilst, enquire, complimentary, tailored, book your slot today). Absolutely NO American slang.`;
  } else {
    langInstruction = `CRITICAL LANGUAGE RULE (AMERICAN ENGLISH):
Write in high-energy, punchy, persuasive American direct-response tone. Clear, confident, and action-oriented.`;
  }

  let anglePrompt = "";
  if (promoAngle === "customer_owner_skit") {
    anglePrompt = `PROMOTIONAL ANGLE: Customer & Owner Conversation (2-Actor Dialogue Skit)
- Scene 1 (Customer Problem): The customer expresses real frustration or a burning pain point that they are struggling with.
- Scene 2 (Owner Solution & Brand): The business owner/founder steps in with confidence, introducing "${brandName || "our brand"}" and how "${serviceToPromote || "our signature service"}" solves it effortlessly.
- Scene 3 (Irresistible Offer & CTA): The owner announces the special deal: "${specialOffer || "exclusive limited-time offer"}" and delivers the CTA: "${promoCTA}".`;
  } else if (promoAngle === "founder_pitch") {
    anglePrompt = `PROMOTIONAL ANGLE: Excited Founder / Owner Direct Pitch
- The charismatic business owner speaks directly into the camera with high energy and passion.
- Scene 1: Provocative curiosity hook exposing the #1 mistake or costly problem customers face.
- Scene 2: The breakthrough: Introduces "${brandName || "our company"}" and how "${serviceToPromote || "our service"}" transforms their results.
- Scene 3: Unbeatable limited-time offer: "${specialOffer || "exclusive promotion"}" + Urgency Call-to-Action: "${promoCTA}".`;
  } else {
    anglePrompt = `PROMOTIONAL ANGLE: High-Converting Direct Response Commercial Ad
- Scene 1: Visual pattern interrupt & urgent hook targeting the prospect's immediate need.
- Scene 2: Clear value stack: Why "${brandName || "our team"}" delivers 10x better results with "${serviceToPromote || "our solution"}".
- Scene 3: Scarcity & Offer: "${specialOffer || "special deal"}" + Immediate CTA: "${promoCTA}".`;
  }

  const prompt = `You are an elite commercial copywriter and direct-response video director creating a high-converting ${durationSeconds}-second vertical promotional reel (Instagram Reels / TikTok / YouTube Shorts).

BRAND / BUSINESS NAME: "${brandName || "Our Brand"}"
PRODUCT / SERVICE: "${serviceToPromote || "Premium Services"}"
SPECIAL DEAL / OFFER: "${specialOffer || "Limited-Time Exclusive Deal"}"
CALL TO ACTION: "${promoCTA}"
TARGET DURATION: ${durationSeconds} seconds
${scrapedContext}

${langInstruction}

${anglePrompt}

SPECIFICATIONS:
1. Divide into exactly 3 sequential scenes (Hook, Solution & Brand, Offer & CTA).
2. Word count: Total script must be between 30 and 45 words total to fit perfectly in ${durationSeconds} seconds.
3. Every scene MUST mention the key details naturally. The brand name "${brandName || "Our Brand"}" MUST be spoken clearly!

Return ONLY valid JSON:
{
  "title": "Short catchy ad title",
  "formattedScript": "Scene 1: Spoken line for scene 1\\nScene 2: Spoken line for scene 2\\nScene 3: Spoken line for scene 3",
  "scenes": [
    { "sceneNumber": 1, "speaker": "Customer or Founder", "line": "Spoken dialogue for scene 1" },
    { "sceneNumber": 2, "speaker": "Founder/Owner", "line": "Spoken dialogue for scene 2" },
    { "sceneNumber": 3, "speaker": "Founder/Owner", "line": "Spoken dialogue for scene 3" }
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: prompt }],
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    return res.status(200).json({ ok: true, ...parsed });
  } catch (err) {
    console.error("[PromoScript] Generation failed:", err);
    return res.status(500).json({ ok: false, error: "Failed to generate promotional script: " + err.message });
  }
}
