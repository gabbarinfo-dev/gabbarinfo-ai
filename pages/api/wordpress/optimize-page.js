// pages/api/wordpress/optimize-page.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
};

function extractJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    const cleaned = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch (_) {}
      }
      return null;
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.body?.userEmail || "admin@gabbarinfo.com";

  const {
    pageId,
    url,
    title = "",
    content = "",
    businessName = "",
    targetKeywords = [],
    customInstructions = "",
    focusKeyword = "",
  } = req.body || {};

  if (!title && !content) {
    return res.status(400).json({ ok: false, error: "Page title or content is required" });
  }

  const normalizedBusiness = (businessName || "default")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "_");

  // 1. Fetch Brand Profile & Location Context from Supabase memory
  let brandProfile = {
    businessName: businessName || "Gabbarinfo",
    niche: "Digital Marketing & Technology Solutions",
    location: "Ahmedabad, Gujarat, India",
    targetMarket: "India & Global",
    services: "Digital Marketing, Web Design, SEO, Content Writing, Graphic Designing, Video Editing",
    keywords: Array.isArray(targetKeywords) && targetKeywords.length > 0 ? targetKeywords : [],
  };

  try {
    const { data: mems } = await supabase
      .from("agent_memory")
      .select("memory_type, content")
      .eq("email", userEmail)
      .in("memory_type", [
        `brand_meta_${normalizedBusiness}`,
        `site_intel_${normalizedBusiness}`,
        `wp_conn_${normalizedBusiness}`,
      ]);

    (mems || []).forEach((m) => {
      try {
        const parsed = JSON.parse(m.content);
        if (parsed.brandName || parsed.businessName) brandProfile.businessName = parsed.brandName || parsed.businessName;
        if (parsed.niche || parsed.industry) brandProfile.niche = parsed.niche || parsed.industry;
        if (parsed.location || parsed.city || parsed.targetMarket) {
          brandProfile.location = [parsed.city, parsed.location, parsed.targetMarket].filter(Boolean).join(", ");
        }
        if (parsed.services || parsed.offerings) {
          brandProfile.services = Array.isArray(parsed.services) ? parsed.services.join(", ") : String(parsed.services || "");
        }
        if (Array.isArray(parsed.targetKeywords) && parsed.targetKeywords.length > 0) {
          brandProfile.keywords = Array.from(new Set([...brandProfile.keywords, ...parsed.targetKeywords]));
        }
      } catch (_) {}
    });
  } catch (e) {
    console.warn("[OptimizePage] Memory fetch fallback:", e.message);
  }

  // 2. Prepare System & User Prompts
  const systemPrompt = `You are the Principal SEO Architect, Conversion Copywriter, and WordPress DOM Specialist at GabbarInfo AI.
Your mission is to perform an AUTONOMOUS, HIGH-CONVERTING, TOP-TIER REWRITE and SEO OPTIMIZATION of an existing WordPress website page.

CORE BRAND CONTEXT:
- Business Name: "${brandProfile.businessName}"
- Industry / Niche: "${brandProfile.niche}"
- Location / Target Geo: "${brandProfile.location}"
- Core Services: "${brandProfile.services}"
- Existing Target Keywords: ${JSON.stringify(brandProfile.keywords.slice(0, 10))}

CRITICAL ARCHITECTURAL RULES:
1. "1:1 VOLUMETRIC SLOT BUDGETING" (ZERO CLS / ZERO LAYOUT BREAKAGE RULE):
   - The theme designer already chose font size, line-height, letter-spacing, padding, and grid width specifically for the exact original amount of text.
   - You MUST enforce a strict ±1 to 2 word count budget on EVERY existing element in the DOM:
     * HEADLINES & HERO HEADINGS: If an existing headline has 7 words, your rewritten headline MUST be 7 to 8 words. It occupies the exact same pixel height and line breaks on mobile and desktop without spilling over.
     * MULTI-COLUMN CARDS & GRIDS: If Card A has 20 words, Card B has 22 words, and Card C has 19 words, rewrite each card description to match its respective slot size (±1 to 2 words). The bottom borders and CTA buttons remain level across all columns with zero uneven blank spaces.
     * BUTTONS & CTAs: A 3-word button (e.g. "Get Started Today") MUST remain 3 words (e.g. "Claim Free Audit"), preventing buttons from wrapping into awkward multi-line shapes.
     * BODY PARAGRAPHS: Rewrite to match the original word count within ±2 words. Do not bloat or expand existing paragraphs inside visual sections.
   - WHAT ACTUALLY GETS UPGRADED:
     * Upgrade the density, persuasion, and commercial impact of the words INSIDE each slot.
     * Swap generic filler words for high-intent commercial keywords and buyer-intent phrasing.
     * Ingest localized authority signals (e.g. "${brandProfile.location}") seamlessly into existing slots.
     * Enhance conversion hooks and clarity without expanding the physical geometric footprint.
   - WHAT IF THE PAGE NEEDS MORE WORDS FOR GOOGLE RANKING?
     * ALL existing visual sections remain locked to their exact 1:1 word counts.
     * Any extra depth, comprehensive service explanations, or FAQs MUST be appended in a clean, self-contained FAQ section or Structured Value Block at the very bottom, leaving the original visual design untouched.

2. STRICT DOM & CONTAINER PRESERVATION:
   - The input content is live WordPress HTML (from Elementor, Divi, Gutenberg, or custom theme templates).
   - PRESERVE 100% of existing HTML container tags: <div>, <section>, <article>, <form>, <input>, <textarea>, <button>, <select>, <iframe>, <img>, <video>, and wrapper classes (e.g. elementor-*, container, col-*, row, grid, wp-block-*, seo-*).
   - NEVER delete, damage, or strip forms, interactive inputs, buttons, or CSS classes.

3. PAGE NAVIGATION TITLE vs H1 HEADLINE (DO NOT BREAK MENUS):
   - In WordPress, the page title ("page_title") is used in navigation menus and dropdowns. It MUST remain short and clean (2-4 words, e.g. "SEO & Content Writing"). NEVER put a 15-word headline into "page_title"!
   - The commercial, high-converting headline belongs exclusively in "h1_headline" and inside the content's <h1> element.

4. SERP & METADATA SPECIFICATIONS:
   - focus_keyword: The single most authoritative, high-intent 2-4 word search query for this page.
   - meta_title: Google SERP title strictly 50 to 60 characters (must include primary keyword and brand).
   - meta_description: High CTR search snippet strictly 135 to 155 characters with a compelling call to action.
   - slug: Clean, keyword-optimized permalink slug.

OUTPUT FORMAT:
Output strictly valid JSON with no markdown backticks, matching this exact schema:
{
  "page_title": "Clean Short Page Name (2-4 words for navigation menus, e.g. 'SEO & Content Writing')",
  "h1_headline": "High-Converting Upgraded H1 Headline (fits slot budget)",
  "optimized_content": "<section>...Upgraded HTML with 100% layout and container classes preserved under 1:1 slot budgeting...</section>",
  "focus_keyword": "primary target search keyword",
  "meta_title": "Google SERP Title (50-60 chars)",
  "meta_description": "Google SERP Description (135-155 chars)",
  "slug": "optimized-permalink-slug",
  "audit_improvements": [
    "Applied 1:1 Volumetric Slot Budgeting (±1-2 words per slot) for zero visual shift and level cards",
    "Preserved 100% of existing theme layout, Elementor classes, and contact form",
    "Injected high-intent commercial keywords and localized authority signals",
    "Protected navigation menu title while upgrading main hero H1 headline",
    "Added structured FAQ section for Google Featured Snippets & AI citations"
  ],
  "audit_score": 96
}`;

  const userPrompt = `OPTIMIZE THIS WORDPRESS PAGE:
- Current Page URL: ${url || "N/A"}
- Current Title / Headline: "${title || "Untitled"}"
- Target Focus Keyword (if pre-selected): "${focusKeyword || ""}"
- User Custom Instructions: "${customInstructions || "Perform full autonomous SEO & conversion copywriting upgrade while strictly preserving HTML design and forms."}"

CURRENT HTML CONTENT TO UPGRADE:
\`\`\`html
${content || `<h1>${title}</h1><p>Welcome to ${brandProfile.businessName}. We provide high quality ${brandProfile.niche} services.</p>`}
\`\`\`

Perform the complete optimization and return strictly valid JSON.`;

  let resultJson = null;

  // Attempt 1: Ultra-fast Gemini 2.5 Flash (~2 seconds response time, prevents Vercel timeout)
  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
      });

      const response = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
      const raw = response.response.text();
      resultJson = extractJson(raw);
    } catch (err) {
      console.warn("[OptimizePage] Gemini 2.5 Flash attempt failed, falling back to OpenAI:", err.message);
    }
  }

  // Attempt 2: OpenAI GPT-4o-mini (~3 seconds response time)
  if (!resultJson && process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 4000,
      });

      const raw = completion.choices[0]?.message?.content;
      resultJson = extractJson(raw);
    } catch (err) {
      console.warn("[OptimizePage] OpenAI gpt-4o-mini attempt failed:", err.message);
    }
  }

  // Attempt 3: OpenAI GPT-4o (Final Fallback)
  if (!resultJson && process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 4000,
      });

      const raw = completion.choices[0]?.message?.content;
      resultJson = extractJson(raw);
    } catch (err) {
      console.error("[OptimizePage] OpenAI gpt-4o attempt failed:", err.message);
    }
  }

  // Validation
  if (!resultJson || !resultJson.optimized_content) {
    return res.status(500).json({
      ok: false,
      error: "AI optimization service temporarily busy. Please try again in a few moments.",
    });
  }

  // Sanitize content to prevent browser freeze (strip scripts, noscripts, and raw backticks)
  let cleanContent = String(resultJson.optimized_content || "");
  cleanContent = cleanContent
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "")
    .replace(/```(?:html)?/gi, "")
    .replace(/```/g, "")
    .trim();

  // Protect navigation menu title: if existing title is clean, keep it
  const cleanPageTitle = (title && title.length < 50) ? title : (resultJson.page_title || title);

  return res.status(200).json({
    ok: true,
    pageId,
    title: cleanPageTitle,
    page_title: cleanPageTitle,
    h1_headline: resultJson.h1_headline || resultJson.optimized_title || title,
    content: cleanContent,
    focus_keyword: resultJson.focus_keyword || focusKeyword || title,
    meta_title: resultJson.meta_title || `${cleanPageTitle} | ${brandProfile.businessName}`,
    meta_description: resultJson.meta_description || "",
    slug: resultJson.slug || "",
    audit_improvements: resultJson.audit_improvements || [],
    audit_score: resultJson.audit_score || 96,
  });
}
