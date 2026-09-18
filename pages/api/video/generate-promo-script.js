// pages/api/video/generate-promo-script.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import OpenAI from "openai";

function decodeHtmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#038;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\[&hellip;\]/g, "...");
}

async function scrapeDeepWebsiteContext(websiteUrl) {
  if (!websiteUrl || !websiteUrl.trim().startsWith("http")) return "";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7500);

    const siteRes = await fetch(websiteUrl.trim(), {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeoutId);

    if (!siteRes.ok) return "";

    const html = await siteRes.text();

    // 1. Meta Title & Descriptions
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const metaDescMatch =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);

    // 2. Extract Headings (H1 to H4)
    const headings = [];
    const hRegex = /<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi;
    let m;
    while ((m = hRegex.exec(html)) !== null) {
      const cleanH = decodeHtmlEntities(m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      if (cleanH.length > 3 && cleanH.length < 180 && !headings.includes(cleanH)) {
        headings.push(cleanH);
      }
    }

    // 3. Extract Key Feature Bullets / List Items
    const bulletItems = [];
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    while ((m = liRegex.exec(html)) !== null) {
      const cleanLi = decodeHtmlEntities(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      if (
        cleanLi.length > 8 &&
        cleanLi.length < 220 &&
        !/privacy|terms|cookie|login|cart|checkout|faq|blog/i.test(cleanLi) &&
        !bulletItems.includes(cleanLi)
      ) {
        bulletItems.push(cleanLi);
      }
    }

    // 4. Extract Clean Body Text (strip scripts, styles, header, footer, nav)
    const cleanBody = decodeHtmlEntities(
      html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
        .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ")
        .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
        .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
        .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    );

    const title = decodeHtmlEntities(titleMatch ? titleMatch[1].trim() : ogTitleMatch ? ogTitleMatch[1].trim() : "");
    const description = decodeHtmlEntities(metaDescMatch ? metaDescMatch[1].trim() : "");

    return `
WEBSITE EXTRACTED CORE INTELLIGENCE:
- Website URL: ${websiteUrl.trim()}
- Page Title: ${title || "N/A"}
- Core Meta Description: ${description || "N/A"}
- Prominent Headings & Value Propositions:
${headings.slice(0, 10).map((h) => `  * ${h}`).join("\n")}
- Key Features & Capabilities:
${bulletItems.slice(0, 10).map((b) => `  * ${b}`).join("\n")}
- Semantic Body Context (Clean Excerpt):
${cleanBody.slice(0, 2500)}
`;
  } catch (crawlErr) {
    console.warn("[PromoScript] Website deep scrape warning:", crawlErr.message);
    return "";
  }
}

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
    promoAngle = "direct_response", // "founder_pitch" | "customer_owner_skit" | "direct_response"
    promoCTA = "Subscribe Your Plan",
    language = "en_us", // "hindi" | "en_us" | "en_uk"
    durationSeconds = 15,
  } = req.body;

  const targetSecs = Math.max(10, Math.min(60, Number(durationSeconds) || 15));

  // 1. Deeply crawl website context if URL is provided
  const scrapedContext = await scrapeDeepWebsiteContext(websiteUrl);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: "Missing OpenAI API key" });
  }

  const openai = new OpenAI({ apiKey });

  // 2. Language-specific spoken voice instructions
  let langInstruction = "";
  if (language === "hindi") {
    langInstruction = `CRITICAL LANGUAGE DIRECTIVE (HINDI - हिंदी):
All spoken lines MUST be written in natural, fluent, colloquial Devanagari script (हिंदी) with authentic Indian commercial phrasing and idioms so neural Indian voices speak with native Indian cadence and 0% foreign accent! Do NOT write Latin transliterated Hinglish. Write pure Devanagari.`;
  } else if (language === "en_uk") {
    langInstruction = `CRITICAL LANGUAGE DIRECTIVE (BRITISH ENGLISH):
Write in refined, eloquent, charismatic British English. Use authentic British commercial terminology (e.g. bespoke, brilliant, whilst, enquire, complimentary, tailored, claim your slot). Absolutely NO American slang.`;
  } else {
    langInstruction = `CRITICAL LANGUAGE DIRECTIVE (AMERICAN ENGLISH):
Write in high-energy, authoritative, punchy American commercial direct-response cadence. Crisp, confident, and action-oriented.`;
  }

  // 3. Duration calibration & pacing
  let durationSpecs = "";
  if (targetSecs <= 15) {
    durationSpecs = `DURATION SPECIFICATIONS (${targetSecs}-Second Viral Hook Reel):
- Scene Count: Exactly 3 to 4 punchy, high-impact sequential scenes.
- Spoken Word Count: Exactly 38 to 48 spoken words total across all scenes (ideal pacing for 15s with zero dead air).
- Tone: Fast-paced, high impact, pattern-interrupting, punchy hooks.`;
  } else if (targetSecs <= 30) {
    durationSpecs = `DURATION SPECIFICATIONS (${targetSecs}-Second Commercial Story Reel):
- Scene Count: Exactly 4 to 6 structured sequential scenes.
- Spoken Word Count: Exactly 75 to 95 spoken words total across all scenes.
- Flow: Scroll-stopping Hook -> Problem Agitation & Cost of Inaction -> Breakthrough Mechanism & Core USPs -> Proof/Transformation -> Irresistible Urgency Offer & CTA.`;
  } else {
    durationSpecs = `DURATION SPECIFICATIONS (${targetSecs}-Second Deep-Dive Commercial):
- Scene Count: Exactly 6 to 8 comprehensive sequential scenes.
- Spoken Word Count: Exactly 140 to 175 spoken words total across all scenes.
- Flow: Pattern Interrupt -> Detailed Industry Pain & Why Alternatives Fail -> Deep Feature & USP Breakdown -> Tangible Proof & ROI -> Irresistible Offer -> Direct Action CTA.`;
  }

  // 4. Promotional Angle & Copywriting Framework
  let anglePrompt = "";
  if (promoAngle === "customer_owner_skit") {
    anglePrompt = `PROMOTIONAL ANGLE: Customer & Owner Relatable Skit (2-Character Screenplay)
- Scene 1 (Customer Problem): The customer speaks with genuine, visceral frustration about the burning pain point or costly nightmare they are dealing with (e.g. burning thousands on agencies, dealing with 5 broken tools, or zero results).
- Scene 2 (Owner Solution & Empathy): The business owner/founder steps in with confidence and warmth, introducing "${brandName || "our company"}" and how "${serviceToPromote || "our signature solution"}" eliminates that exact frustration.
- Scenes 3-4 (Breakthrough USPs & Proof): The owner breaks down the specific USPs, technology, or capabilities extracted from the product/website, proving why it delivers superior results.
- Final Scene (Offer & CTA): The owner delivers the special deal: "${specialOffer || "exclusive limited-time offer"}" and direct CTA: "${promoCTA}".
- Tag each scene with the speaker: "Scene 1 (Customer): ...", "Scene 2 (Founder): ...".`;
  } else if (promoAngle === "founder_pitch") {
    anglePrompt = `PROMOTIONAL ANGLE: Charismatic Founder / Owner Direct Pitch
- The visionary business owner speaks straight into the camera lens with raw honesty, high passion, and deep authority.
- Hook: An eye-opening truth exposing the costly trap or myth in the industry (e.g. why companies waste thousands on bloated retainers or fragmented apps).
- Agitation: Calling out the exact fatigue, confusion, or wasted budget prospects experience.
- The Breakthrough: Why we built "${brandName || "our brand"}" and how "${serviceToPromote || "our system"}" transforms results with its unique autonomous USPs.
- Proof & Contrast: Concrete outcomes and operational freedom.
- Urgency Offer & CTA: Direct invitation presenting "${specialOffer || "special deal"}" and command: "${promoCTA}".`;
  } else {
    anglePrompt = `PROMOTIONAL ANGLE: High-Converting Direct Response Commercial Ad (Battle-Tested PAS / Direct Response)
- This is an aggressive, high-converting commercial video sales ad designed for immediate action.
- Hook (0-3s): Scroll-stopping pattern interrupt directly calling out the prospect's most painful, costly mistake or frustration using real context.
- Agitate: Expose the hidden drain and daily chaos of continuing with the old way.
- Core Mechanism & USPs: Reveal "${brandName || "our brand"}" as the ultimate unfair advantage, highlighting the specific capabilities of "${serviceToPromote || "our system"}" and extracted USPs.
- Tangible Transformation: Contrast the chaotic before vs effortless after with concrete leverage.
- Irresistible Urgency & CTA: Unbeatable limited-time offer "${specialOffer || "special offer"}" + unequivocal action command "${promoCTA}".`;
  }

  const prompt = `You are an elite, world-class direct-response commercial copywriter and viral video director.
Create an authentic, punchy, high-converting commercial screenplay for a ${targetSecs}-second vertical promotional reel (Instagram Reels, TikTok, YouTube Shorts).

BRAND / BUSINESS NAME: "${brandName || "Our Brand"}"
PRODUCT / SERVICE TO PROMOTE: "${serviceToPromote || "Autonomous Growth Suite"}"
SPECIAL DEAL / LIMITED OFFER: "${specialOffer || "Exclusive Limited-Time Promotion"}"
CALL TO ACTION (CTA): "${promoCTA}"
TARGET DURATION: ${targetSecs} seconds

${scrapedContext ? scrapedContext : "NOTE: If website context is limited, use deep industry-specific expertise to identify the most compelling USPs, pain points, and conversion triggers for this product/service."}

${langInstruction}

${durationSpecs}

${anglePrompt}

CRITICAL COPYWRITING DIRECTIVES:
1. NO ROBOTIC TRIVIAL 1-SENTENCE SUMMARIES:
   - NEVER output shallow, lazy generic bullet lines like "Scene 1: Struggling? Scene 2: Solution! Scene 3: Buy now!".
   - Each scene MUST contain 1 to 2 complete, expressive spoken sentences that flow naturally when spoken aloud by a real human or digital avatar.
2. WEAVE IN CONCRETE CHANNELS, METRICS & USPs:
   - Do NOT just say generic words like "marketing" or "flawless campaigns". Weave in the REAL concrete channels, tools, numbers, and features extracted from the website context (e.g., Google Ads, Meta campaigns, SEO articles, social graphics, replacing $5K agencies, or eliminating 5-app tool hopping).
   - The brand name "${brandName || "Our Brand"}" MUST be spoken clearly and prominently.
   - The CTA "${promoCTA}" and offer "${specialOffer}" must be delivered with natural urgency in the closing scene.
3. FORMAT:
   - "formattedScript" must be clean multiline text where each scene starts with "Scene 1:" (or "Scene 1 (Customer):").
   - Spoken dialogue ONLY in the script lines—no stage directions or parenthetical sound effects inside the spoken dialogue.

Return ONLY valid JSON:
{
  "title": "Short catchy high-converting ad title",
  "extractedUsps": [
    "Concrete USP 1",
    "Concrete USP 2",
    "Concrete USP 3"
  ],
  "formattedScript": "Scene 1: [Spoken line]\\nScene 2: [Spoken line]\\n...",
  "scenes": [
    {
      "sceneNumber": 1,
      "speaker": "Speaker Name",
      "line": "Spoken line",
      "visualDescription": "Visual camera framing and backdrop for vertical 9:16 video",
      "durationEstimate": 4
    }
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.75,
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
