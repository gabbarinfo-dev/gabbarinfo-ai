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
  const effectiveOffer = specialOffer && specialOffer.trim()
    ? specialOffer.trim()
    : "Launch Pricing & Full Autonomous Access";

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
Write in refined, eloquent, charismatic British English. Use authentic British commercial terminology (e.g. bespoke, whilst, enquire, complimentary, tailored, claim your slot). Absolutely NO American slang.`;
  } else {
    langInstruction = `CRITICAL LANGUAGE DIRECTIVE (AMERICAN ENGLISH):
Write in high-energy, authoritative, punchy American commercial direct-response cadence. Crisp, confident, and action-oriented.`;
  }

  // 3. Duration calibration & pacing
  let durationSpecs = "";
  let fewShotExamples = "";

  if (targetSecs <= 15) {
    durationSpecs = `DURATION SPECIFICATIONS (${targetSecs}-Second Viral Hook Reel):
- Scene Count: Exactly 4 sequential scenes.
- Total Spoken Word Count: Exactly 38 to 48 spoken words total across all scenes (at ~2.8 words/sec, this fills 14-15s with zero dead air).
- Each scene MUST be 9 to 13 spoken words (1 full, punchy sentence). NEVER write 3-word fragments!`;

    fewShotExamples = `GOLD STANDARD EXAMPLES (STUDY THESE FOR STYLE, TONE, AND WORD COUNT):

EXAMPLE 15s DIRECT RESPONSE:
Scene 1: If you're still paying five thousand a month for bloated marketing agencies, you're literally burning cash.
Scene 2: Gabbarinfo AI replaces your entire media buying team with self-driving autonomous agents that never sleep.
Scene 3: Launch high-converting Google Ads, Meta campaigns, and dual-visual SEO from one single dashboard.
Scene 4: Tap the link below right now. Subscribe your plan today and put your marketing on pure autopilot.`;
  } else if (targetSecs <= 30) {
    durationSpecs = `DURATION SPECIFICATIONS (${targetSecs}-Second Commercial Story Reel):
- Scene Count: Exactly 5 to 6 structured sequential scenes.
- Total Spoken Word Count: Exactly 75 to 95 spoken words total across all scenes.
- Flow: Shock Hook -> Agitation & Cost of Inaction -> Breakthrough Mechanism & Core USPs -> Proof / Transformation -> Irresistible Urgency Offer & CTA.`;

    fewShotExamples = `GOLD STANDARD EXAMPLES (STUDY THESE FOR STYLE, TONE, AND WORD COUNT):

EXAMPLE 30s DIRECT RESPONSE:
Scene 1: Why are smart business owners firing their marketing agencies and canceling five software subscriptions this week?
Scene 2: Because jumping between Google Ads Manager, Meta, Canva, and WordPress burns fifteen hours a week with mediocre results.
Scene 3: Gabbarinfo AI replaces the entire tool chaos with one unified, autonomous operating system.
Scene 4: It launches high-converting Search campaigns, designs daily social graphics, and authors dual-visual SEO articles around the clock.
Scene 5: You get ten-x marketing leverage without hiring a single media buyer or paying bloated monthly retainers.
Scene 6: Don't get left behind. Subscribe your plan right now and watch your marketing run completely on self-driving mode.`;
  } else {
    durationSpecs = `DURATION SPECIFICATIONS (${targetSecs}-Second Deep-Dive Commercial):
- Scene Count: Exactly 6 to 8 comprehensive sequential scenes.
- Total Spoken Word Count: Exactly 140 to 175 spoken words total across all scenes.
- Flow: Pattern Interrupt -> Detailed Industry Pain & Why Alternatives Fail -> Deep Feature & USP Breakdown -> Tangible Proof & ROI -> Irresistible Offer -> Direct Action CTA.`;

    fewShotExamples = `GOLD STANDARD EXAMPLES (STUDY THESE FOR STYLE, TONE, AND WORD COUNT):
Each scene should be 20 to 25 words of rich, persuasive narrative, giving deep detail on the pain, the breakthrough USPs, the mechanism, proof, and closing offer.`;
  }

  // 4. Promotional Angle & Copywriting Framework
  let anglePrompt = "";
  if (promoAngle === "customer_owner_skit") {
    anglePrompt = `PROMOTIONAL ANGLE: Customer & Owner Relatable Skit (2-Character Screenplay)
- Scene 1 (Customer Problem): The customer speaks with genuine, visceral frustration about the burning pain point or costly nightmare they are dealing with (e.g. burning thousands on agencies, dealing with 5 broken tools, or zero results).
- Scene 2 (Owner Solution & Empathy): The business owner/founder steps in with confidence and warmth, introducing "${brandName || "our company"}" and how "${serviceToPromote || "our signature solution"}" eliminates that exact frustration.
- Scenes 3-4 (Breakthrough USPs & Proof): The owner breaks down the specific USPs, technology, or capabilities extracted from the product/website, proving why it delivers superior results.
- Final Scene (Offer & CTA): The owner delivers the special deal: "${effectiveOffer}" and direct CTA: "${promoCTA}".
- Tag each scene with the speaker: "Scene 1 (Customer): ...", "Scene 2 (Founder): ...".`;
  } else if (promoAngle === "founder_pitch") {
    anglePrompt = `PROMOTIONAL ANGLE: Charismatic Founder / Owner Direct Pitch
- The visionary business owner speaks straight into the camera lens with raw honesty, high passion, and deep authority.
- Hook: An eye-opening truth exposing the costly trap or myth in the industry (e.g. why companies waste thousands on bloated retainers or fragmented apps).
- Agitation: Calling out the exact fatigue, confusion, or wasted budget prospects experience.
- The Breakthrough: Why we built "${brandName || "our brand"}" and how "${serviceToPromote || "our system"}" transforms results with its unique autonomous USPs.
- Proof & Contrast: Concrete outcomes and operational freedom.
- Urgency Offer & CTA: Direct invitation presenting "${effectiveOffer}" and command: "${promoCTA}".`;
  } else {
    anglePrompt = `PROMOTIONAL ANGLE: High-Converting Direct Response Commercial Ad (Alex Hormozi / Dan Kennedy Style)
- Hook (0-3s): Contrarian shock hook or bold pattern interrupt that stops the scroll dead. Expose the painful cost or rip-off of traditional methods.
- Agitate: Call out the chaotic reality—jumping between multiple apps, generic AI chatbots that don't execute, and burning thousands on retainers.
- Unfair Advantage & Mechanism: Introduce "${brandName || "our brand"}" with its signature mechanism (${serviceToPromote || "our autonomous system"}), highlighting its real extracted USPs.
- Concrete Transformation: Contrast the chaotic manual struggle vs effortless automated growth.
- Action Command & Urgency: Deliver the irresistible offer "${effectiveOffer}" with an unignorable CTA: "${promoCTA}".`;
  }

  const prompt = `You are an elite, top 0.1% direct-response commercial copywriter and viral video director (producing eight-figure video sales ads).
Write a mind-blowing, high-converting commercial screenplay for a ${targetSecs}-second vertical video reel (Instagram Reels, TikTok, YouTube Shorts).

BRAND / BUSINESS NAME: "${brandName || "Our Brand"}"
PRODUCT / SERVICE TO PROMOTE: "${serviceToPromote || "Autonomous Growth Suite"}"
SPECIAL DEAL / LIMITED OFFER: "${effectiveOffer}"
CALL TO ACTION (CTA): "${promoCTA}"
TARGET DURATION: ${targetSecs} seconds

${scrapedContext ? scrapedContext : "NOTE: If website context is limited, use deep industry-specific expertise to identify the most compelling USPs, pain points, and conversion triggers for this product/service."}

${langInstruction}

${durationSpecs}

${anglePrompt}

CRITICAL COPYWRITING DIRECTIVES (ZERO TOLERANCE FOR GENERIC AI SLOGANS):
1. STRICTLY BANNED PHRASES (DO NOT USE UNDER ANY CIRCUMSTANCES):
   - NEVER start with "Struggling with...", "Are you tired of...", or "Looking for..."
   - NEVER use corporate announcements like "Meet [Brand]—your [buzzword]!"
   - NEVER output bullet lists disguised as sentences like "Google Ads, Meta campaigns, SEO—on autopilot 24/7!"
   - NEVER use generic filler like "for our exclusive limited-time promotion!"
2. FULL SENTENCES & CADENCE:
   - Each scene MUST be a complete, well-crafted conversational sentence (9 to 14 words per scene).
   - NEVER output short 3-word fragments!
3. REAL USPs & INTEGRATION:
   - Weave in the actual channels, metrics, and tools from the website context (Google Ads, Meta ads, dual-visual SEO articles, daily graphics, autonomous 24/7 execution, eliminating $5K retainers or 5-tool chaos).
   - Brand name "${brandName || "Our Brand"}" must be spoken clearly.
   - Closing scene MUST deliver the CTA "${promoCTA}".

${fewShotExamples}

Return ONLY valid JSON:
{
  "title": "Short catchy high-converting ad title",
  "extractedUsps": [
    "Concrete USP 1",
    "Concrete USP 2",
    "Concrete USP 3"
  ],
  "formattedScript": "Scene 1: [Full spoken line]\\nScene 2: [Full spoken line]\\n...",
  "scenes": [
    {
      "sceneNumber": 1,
      "speaker": "Speaker Name",
      "line": "Full spoken line",
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
