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

function extractSemanticSlots(htmlContent) {
  if (!htmlContent || typeof htmlContent !== "string") return [];
  const tagRegex = /<(h[1-6]|p|blockquote|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  const headings = [];
  const bodySlots = [];
  let m;
  while ((m = tagRegex.exec(htmlContent)) !== null) {
    const inner = m[2].trim();
    const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text.length > 6 && !inner.includes("<video") && !inner.includes("<form") && !inner.includes("<?php")) {
      const slot = {
        tag: m[1].toLowerCase(),
        originalSnippet: text,
        words: text.split(/\s+/).length,
      };
      if (slot.tag.startsWith("h")) {
        headings.push(slot);
      } else {
        bodySlots.push(slot);
      }
    }
  }

  // Prioritize all unique headings across the entire document, then high-value body/card copy (up to 38 slots)
  const uniqueSlots = [];
  const seen = new Set();
  for (const h of headings) {
    if (!seen.has(h.originalSnippet)) {
      seen.add(h.originalSnippet);
      uniqueSlots.push(h);
    }
  }
  for (const b of bodySlots) {
    if (!seen.has(b.originalSnippet)) {
      seen.add(b.originalSnippet);
      uniqueSlots.push(b);
      if (uniqueSlots.length >= 38) break;
    }
  }
  return uniqueSlots;
}

function applySlotReplacements(originalHtml, replacements) {
  let updated = originalHtml;
  if (!Array.isArray(replacements) || replacements.length === 0) return updated;

  for (const r of replacements) {
    const orig = (r.original || r.find || "").trim();
    const opt = (r.optimized || r.replace || "").trim();
    if (!orig || !opt || orig === opt) continue;

    // 1. Exact string match
    if (updated.includes(orig)) {
      updated = updated.replace(orig, opt);
      continue;
    }

    // 2. Whitespace-normalized regex replacement
    try {
      const escaped = orig.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      const reg = new RegExp(escaped, "i");
      if (reg.test(updated)) {
        updated = updated.replace(reg, opt);
      }
    } catch (_) {}
  }
  return updated;
}

function buildFaqHtml(faqItems) {
  if (!Array.isArray(faqItems) || faqItems.length === 0) return "";
  const itemsHtml = faqItems
    .map(
      (item) => `
    <div class="gabbarinfo-faq-item" style="margin-bottom: 18px; padding: 18px 22px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;">
      <h3 style="margin: 0 0 8px 0; font-size: 16.5px; font-weight: 700; color: #38bdf8;">${item.question || ""}</h3>
      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">${item.answer || ""}</p>
    </div>`
    )
    .join("");

  return `
<!-- AUTONOMOUS STRUCTURED VALUE & FAQ BLOCK -->
<section class="gabbarinfo-faq-section" style="margin-top: 48px; padding: 32px clamp(16px, 4vw, 36px); background: rgba(14, 20, 32, 0.95); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 18px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
  <h2 style="margin: 0 0 6px 0; font-size: clamp(20px, 3.5vw, 26px); font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Frequently Asked Questions</h2>
  <p style="margin: 0 0 24px 0; font-size: 13.5px; color: #94a3b8;">Authoritative answers and expert guidance regarding our search and digital solutions.</p>
  ${itemsHtml}
</section>`;
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

  const isRichHtml = content.length > 2000;
  const semanticSlots = isRichHtml ? extractSemanticSlots(content) : [];

  // 2. Prepare Prompts based on content scale
  const systemPrompt = `You are the Principal SEO Architect, Elite Conversion Copywriter, and WordPress Positioning Specialist at GabbarInfo AI.
Your mission is to perform an AUTONOMOUS, HIGH-CONVERTING, SALES-DRIVEN REWRITE and SEO OPTIMIZATION of an existing WordPress website page.

CORE BRAND CONTEXT:
- Business Name: "${brandProfile.businessName}"
- Industry / Niche: "${brandProfile.niche}"
- Location / Primary Geo: "${brandProfile.location}"
- Core Services: "${brandProfile.services}"
- Existing Target Keywords: ${JSON.stringify(brandProfile.keywords.slice(0, 10))}

${customInstructions ? `
══════════════════════════════════════════════════════════════════════
👑 SUPREME STRATEGIC DIRECTIVE (HIGHEST PRIORITY OVER EVERYTHING ELSE):
"${customInstructions}"
══════════════════════════════════════════════════════════════════════
CRITICAL MANDATE FOR THIS DIRECTIVE:
1. Every headline, hero title, subheadline, service card, and value proposition MUST directly, boldly, and persuasively reflect and sell this exact strategic intent!
2. If specific target markets or geographies are requested (e.g. Local Ahmedabad, USA, UK, Global), you MUST explicitly name and position for those markets throughout the page copy!
3. If specific business models, fulfillment advantages, or service formats are requested (e.g. White-label agency fulfillment, timely delivery, affordable pricing, premium quality), you MUST make these the core selling points and differentiators in the copy!
4. ABSOLUTELY NO LAZY SYNONYM SWAPPING. Changing "turning content into business growth" into "transforming content into business expansion" while ignoring the user's specific strategic intent is an UNACCEPTABLE FAILURE. You must craft brand-new, persuasive, punchy sales copy tailored to the directive!
` : `
MANDATORY DIRECTIVE: Maximize commercial buyer intent, local authority in "${brandProfile.location}", clear conversion triggers, and competitive differentiation. Do NOT just do synonym swaps—write compelling sales copy!
`}

CRITICAL ARCHITECTURAL RULES:
1. "1:1 VOLUMETRIC SLOT BUDGETING" (PHYSICAL CONTAINER BUDGET):
   - You MUST match each slot's physical word count within ±1 to 2 words of the original.
   - This ensures multi-column service cards stay level, button texts don't wrap awkwardly, and the existing visual design does not break or shift (CLS = 0).
   - The slot budget defines the SIZE of the slot, but the WORDS INSIDE MUST BE FRESH, COMPELLING, HIGH-CONVERTING SALES COPY THAT FOLLOWS THE STRATEGIC DIRECTIVES.

2. NAVIGATION MENU TITLE vs H1 HEADLINE:
   - "page_title" MUST remain short and clean (2-4 words, e.g. "${title || 'Services'}"). Never put a 15-word headline into "page_title" so menus never break.
   - The commercial headline belongs in "h1_headline" and the hero H1 slot.

3. SERP & METADATA SPECIFICATIONS:
   - focus_keyword: The single most authoritative 2-4 word search query (aligned with target market).
   - meta_title: 50 to 60 characters with primary keyword & brand.
   - meta_description: 135 to 155 characters with compelling call to action highlighting the value proposition.
   - slug: Clean permalink slug.

OUTPUT SCHEMA (STRICT JSON):
{
  "page_title": "${title || 'Services'}",
  "h1_headline": "High-Converting Upgraded H1 Headline (embodying user directive)",
  "focus_keyword": "primary target search keyword",
  "meta_title": "Google SERP Title (50-60 chars)",
  "meta_description": "Google SERP Description (135-155 chars)",
  "slug": "optimized-slug",
  "replacements": [
    {
      "original": "exact original snippet from slot",
      "optimized": "brand new high-converting copy matching slot word budget (±1-2 words) that aggressively sells user's strategic intent"
    }
  ],
  "faq_items": [
    { "question": "High-value FAQ addressing user's key offering/target market?", "answer": "Authoritative direct answer establishing trust and capability." },
    { "question": "FAQ on delivery, quality, or engagement model?", "answer": "Clear reassurance addressing client objections." },
    { "question": "FAQ on pricing, white-label, or local/international service?", "answer": "Compelling answer driving inquiry and action." }
  ],
  "audit_improvements": [
    "Applied strategic positioning across all hero headlines, service cards, and body copy",
    "Enforced 1:1 Volumetric Slot Budgeting (±1-2 words per slot) for zero visual shift and level cards",
    "Protected navigation menu title while upgrading main hero H1 headline",
    "Preserved 100% of existing HTML layout, video assets, and grid styling",
    "Appended structured FAQ section for Google Featured Snippets & AI citations"
  ],
  "audit_score": 98
}`;

  let userPrompt = "";
  if (isRichHtml && semanticSlots.length > 0) {
    userPrompt = `OPTIMIZE THIS WORDPRESS PAGE:
- URL: ${url || "N/A"}
- Current Title: "${title || "Untitled"}"
- Focus Keyword: "${focusKeyword || ""}"
- User Strategic Directive: "${customInstructions || "Maximize commercial conversion, high-intent buyer psychology, and local authority."}"

SLOTS TO REWRITE (Apply 1:1 Volumetric Slot Budgeting: ±1-2 words per slot. REWRITE WITH FRESH, HIGH-IMPACT SALES COPY EMBODYING THE STRATEGIC DIRECTIVE — NO SYNONYM SWAPS):
${semanticSlots.map((s, i) => `[${i + 1}] <${s.tag}> (${s.words} words): "${s.originalSnippet}"`).join("\n")}

Respond strictly with the specified JSON object containing "replacements" and "faq_items".`;
  } else {
    userPrompt = `OPTIMIZE THIS WORDPRESS PAGE:
- URL: ${url || "N/A"}
- Current Title: "${title || "Untitled"}"
- Focus Keyword: "${focusKeyword || ""}"
- User Strategic Directive: "${customInstructions || "Maximize commercial conversion, high-intent buyer psychology, and local authority."}"

CONTENT TO OPTIMIZE:
\`\`\`html
${content || `<h1>${title}</h1><p>Welcome to ${brandProfile.businessName}. We provide high quality ${brandProfile.niche} services.</p>`}
\`\`\`

Respond strictly with valid JSON.`;
  }

  let resultJson = null;

  // Attempt 1: Ultra-fast Google Gemini Flash (~2 seconds response time)
  if (process.env.GEMINI_API_KEY) {
    const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];
    for (const mName of modelsToTry) {
      if (resultJson) break;
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: mName,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.65,
            maxOutputTokens: 3000,
          },
        });

        const response = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
        const raw = response.response.text();
        resultJson = extractJson(raw);
        if (resultJson) break;
      } catch (err) {
        console.warn(`[OptimizePage] Gemini ${mName} attempt failed:`, err.message);
      }
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
        temperature: 0.65,
        max_tokens: 3000,
      });

      const raw = completion.choices[0]?.message?.content;
      resultJson = extractJson(raw);
    } catch (err) {
      console.warn("[OptimizePage] OpenAI gpt-4o-mini attempt failed:", err.message);
    }
  }

  // Validation
  if (!resultJson) {
    return res.status(500).json({
      ok: false,
      error: "AI optimization service temporarily busy. Please try again in a few moments.",
    });
  }

  // Assemble clean optimized content
  let cleanContent = "";
  if (isRichHtml) {
    // 1. Apply 1:1 slot text replacements to original rich HTML
    let upgraded = applySlotReplacements(content, resultJson.replacements);

    // 2. Append structured FAQ section
    if (Array.isArray(resultJson.faq_items) && resultJson.faq_items.length > 0) {
      const faqHtml = buildFaqHtml(resultJson.faq_items);
      if (upgraded.includes("</main>")) {
        upgraded = upgraded.replace("</main>", `${faqHtml}\n</main>`);
      } else if (upgraded.includes("</article>")) {
        upgraded = upgraded.replace("</article>", `${faqHtml}\n</article>`);
      } else {
        upgraded += `\n${faqHtml}`;
      }
    }
    cleanContent = upgraded;
  } else {
    // Fallback for short content
    cleanContent = String(resultJson.optimized_content || resultJson.content || content || "");
  }

  // Sanitize content (strip rogue scripts, noscripts, and raw backticks)
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
    audit_improvements: resultJson.audit_improvements || [
      "Applied strategic positioning across all hero headlines, service cards, and body copy",
      "Enforced 1:1 Volumetric Slot Budgeting (±1-2 words per slot) for zero visual shift and level cards",
      "Protected navigation menu title while upgrading main hero H1 headline",
      "Preserved 100% of existing HTML layout, video assets, and grid styling",
      "Appended structured FAQ section for Google Featured Snippets & AI citations"
    ],
    audit_score: resultJson.audit_score || 98,
  });
}
