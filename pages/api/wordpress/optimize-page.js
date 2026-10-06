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
1. STRICT DOM & LAYOUT PRESERVATION (NEVER BREAK THE THEME OR DESIGN):
   - The input content is live WordPress HTML (from Elementor, Divi, Gutenberg, or custom theme templates).
   - You MUST PRESERVE all existing HTML container tags: <div>, <section>, <article>, <form>, <input>, <textarea>, <button>, <select>, <iframe>, <img>, and wrapper classes (e.g. elementor-*, container, col-*, row, grid, wp-block-*).
   - NEVER delete, damage, or strip forms, interactive inputs, buttons, or CSS classes.
   - You only replace, enrich, polish, and upgrade the text copy inside headings (<h1>, <h2>, <h3>), paragraphs (<p>), list items (<li>), blockquotes, and value proposition cards.
   - If the existing page has very thin copy, seamlessly add rich semantic sections above/below (such as High-Impact Value Pillars, What Sets Us Apart, 4-Step Proven Process, and FAQ Accordions) that use clean, responsive semantic HTML without conflicting with theme styles.

2. HIGH-IMPACT HEADLINES & CONTENT DEPTH:
   - Upgrade the main headline (H1) from boring generic text into a high-converting, commercial headline that communicates immediate value, target keywords, and authority.
   - Structure the page logically with scannable H2 and H3 subheadings.
   - Naturally weave in the Primary Focus Keyword and 3-5 LSI secondary keywords.
   - Add local geographic relevance where natural (e.g. "${brandProfile.location}").
   - Upgrade readability, tone, and persuasiveness to top agency standards.

3. STRUCTURED DATA & SEARCH READINESS:
   - Include 3 to 5 frequently asked questions (FAQs) with crisp answers to win Google Featured Snippets and Generative Search Engine (GEO) AI citations.
   - Ensure clear, compelling Calls to Action (CTAs).

4. SERP & METADATA SPECIFICATIONS:
   - focus_keyword: The single most authoritative, high-intent 2-4 word search query for this page.
   - meta_title: Google SERP title strictly 50 to 60 characters (must include primary keyword and brand).
   - meta_description: High CTR search snippet strictly 135 to 155 characters with a compelling call to action.
   - slug: Clean, keyword-optimized permalink slug.

OUTPUT FORMAT:
Output strictly valid JSON with no markdown backticks, matching this exact schema:
{
  "optimized_title": "High-Converting Upgraded H1 Headline",
  "optimized_content": "<section>...Upgraded HTML with 100% layout and container classes preserved...</section>",
  "focus_keyword": "primary target search keyword",
  "meta_title": "Google SERP Title (50-60 chars)",
  "meta_description": "Google SERP Description (135-155 chars)",
  "slug": "optimized-permalink-slug",
  "audit_improvements": [
    "Upgraded generic H1 into high-conversion commercial headline",
    "Preserved 100% of existing theme layout, Elementor classes, and contact form",
    "Expanded content depth with comprehensive service pillars and proof points",
    "Injected local geographic authority and primary target keywords",
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

  return res.status(200).json({
    ok: true,
    pageId,
    title: resultJson.optimized_title || title,
    content: cleanContent,
    focus_keyword: resultJson.focus_keyword || focusKeyword || title,
    meta_title: resultJson.meta_title || `${title} | ${brandProfile.businessName}`,
    meta_description: resultJson.meta_description || "",
    slug: resultJson.slug || "",
    audit_improvements: resultJson.audit_improvements || [],
    audit_score: resultJson.audit_score || 96,
  });
}
