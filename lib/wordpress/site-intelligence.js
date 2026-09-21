// lib/wordpress/site-intelligence.js
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Robust, universal website crawler that analyzes ANY live website (WordPress, Shopify, or Custom HTML).
 * Extracts: Title, Meta Description, OpenGraph tags, Headings, and clean Homepage Text.
 */
export async function crawlWebsiteHomepage(siteUrl) {
  if (!siteUrl) return null;
  const cleanUrl = siteUrl.trim().replace(/\/+$/, "");

  let pageTitle = "";
  let metaDesc = "";
  let siteName = "";
  const headings = [];
  let bodyText = "";

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 9000);

    const res = await fetch(cleanUrl, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const html = await res.text();

      // Title
      const tMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (tMatch) pageTitle = tMatch[1].replace(/&#[0-9]+;|&[a-z]+;/gi, " ").trim();

      // Meta Description
      const mMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                     html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
      if (mMatch) metaDesc = mMatch[1].trim();

      // OpenGraph Site Name
      const sMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
      if (sMatch) siteName = sMatch[1].trim();

      // Headings
      const hMatches = html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi);
      for (const m of hMatches) {
        const text = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        if (text && text.length > 3 && text.length < 150) headings.push(text);
      }

      // Clean Body Text (strip scripts, styles, navigations, footers, SVGs)
      bodyText = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
        .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
        .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
        .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
        .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&[a-z]+;|&#[0-9]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000);
    }
  } catch (err) {
    console.warn(`[SiteCrawler] Failed to crawl ${cleanUrl}:`, err.message);
  }

  // Also query WordPress REST API if available
  let wpPages = [];
  let wpCategories = [];
  let wpSiteInfo = {};
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);

    const [rootRes, pagesRes, catsRes] = await Promise.all([
      fetch(`${cleanUrl}/wp-json`, { signal: ctrl.signal }).catch(() => null),
      fetch(`${cleanUrl}/wp-json/wp/v2/pages?per_page=15&_fields=title,slug`, { signal: ctrl.signal }).catch(() => null),
      fetch(`${cleanUrl}/wp-json/wp/v2/categories?per_page=15&_fields=name,slug`, { signal: ctrl.signal }).catch(() => null),
    ]);
    clearTimeout(timeout);

    if (rootRes && rootRes.ok) {
      const rootData = await rootRes.json().catch(() => ({}));
      wpSiteInfo = { name: rootData.name || "", description: rootData.description || "" };
    }
    if (pagesRes && pagesRes.ok) {
      const pData = await pagesRes.json().catch(() => []);
      if (Array.isArray(pData)) {
        wpPages = pData.map((p) => (p?.title?.rendered || p?.slug || "").replace(/<[^>]+>/g, "").trim()).filter(Boolean);
      }
    }
    if (catsRes && catsRes.ok) {
      const cData = await catsRes.json().catch(() => []);
      if (Array.isArray(cData)) {
        wpCategories = cData.map((c) => (c?.name || "").trim()).filter((n) => n && !/uncategorized|general/i.test(n));
      }
    }
  } catch (_) {}

  return {
    url: cleanUrl,
    pageTitle,
    metaDesc,
    siteName: siteName || wpSiteInfo.name || "",
    wpDescription: wpSiteInfo.description || "",
    headings: Array.from(new Set(headings)).slice(0, 15),
    bodyExcerpt: bodyText,
    wpPages,
    wpCategories,
  };
}

/**
 * Uses OpenAI (or Gemini fallback) to synthesize the crawled website data into:
 *  - Accurate Brand Name
 *  - Real Industry / Niche
 *  - Clear Business Summary
 *  - 8-12 Core Offerings & Services
 *  - 30 High-Intent, Tailored SEO Topics (strictly forbidding generic marketing agency filler)
 */
export async function synthesizeSiteIntelligence({
  crawledData,
  businessName = "",
  siteUrl = "",
  targetMarket = "",
  targetKeywords = [],
  existingTitles = [],
}) {
  const url = siteUrl || crawledData?.url || "";
  const title = crawledData?.pageTitle || "";
  const metaDesc = crawledData?.metaDesc || "";
  const headings = crawledData?.headings || [];
  const bodyText = crawledData?.bodyExcerpt || "";
  const pages = crawledData?.wpPages || [];
  const categories = crawledData?.wpCategories || [];

  const prompt = `You are a Principal Website Intelligence and Search Intent Extraction Engine.

We crawled the client's live business website:
- URL: "${url}"
- Declared Business Name: "${businessName || "Unknown"}"
- Website Title: "${title}"
- Meta Description: "${metaDesc}"
- WordPress Site Description: "${crawledData?.wpDescription || ""}"
- Key Headings Found on Site: ${JSON.stringify(headings.slice(0, 15))}
- Pages / Navigation Found: ${JSON.stringify(pages)}
- Categories: ${JSON.stringify(categories)}
- Excerpt of Actual Live Content:
"""${bodyText}"""
${targetMarket ? `- Target Geographic Territory / Market: "${targetMarket}"` : ""}
${targetKeywords.length ? `- Existing Keywords: "${targetKeywords.join(", ")}"` : ""}
${existingTitles.length ? `- Already Published Titles (DO NOT DUPLICATE): ${JSON.stringify(existingTitles.slice(0, 20))}` : ""}

YOUR MISSION:
Deeply analyze what this exact entity actually does, sells, or offers based solely on the crawled text above.
DO NOT assume the business is an SEO agency, marketing firm, or software company unless the crawled text explicitly says so.
Base 100% of your extraction strictly on the crawled text, titles, headings, and offerings provided above.

Return valid JSON with:
1. "brandName": The authentic business or brand name derived directly from the website.
2. "industry": The exact domain industry of this business, based purely on what is described in the text (e.g. whatever specific sector, niche, trade, or profession this website represents).
3. "nicheSummary": 1-2 concise, clear sentences explaining what this business sells, offers, or provides to its audience.
4. "targetKeywords": 10 to 15 high-ranking, high-intent focus keywords and phrases directly extracted from this website's actual content (specific products, services, technical terms, pain points, and queries people search for).
5. "coreOfferings": 8 to 12 specific services, products, or core specializations they offer to users.
6. "suggestedTopics": Exactly 30 high-ranking, search-intent, educational, and problem-solving SEO blog topic titles derived strictly from the targetKeywords and coreOfferings above.

CRITICAL RULES (UNIVERSAL DOMAIN INTEGRITY):
- 100% FAITHFUL TO CRAWLED CONTENT: Extract topics and keywords exclusively matching the actual domain, services, and products found in the crawled website text.
- ZERO MARKETING AGENCY FILLER: Never generate digital marketing agency topics, "300% ROI", "B2B lead generation", "conversion rate optimization", or technical SEO agency advice unless the crawled website is literally an SEO/digital marketing firm.
- Real search queries that real prospective customers, clients, or seekers type into Google to find what this website offers.

Format output as valid JSON:
{
  "brandName": "...",
  "industry": "...",
  "nicheSummary": "...",
  "targetKeywords": ["keyword 1", "keyword 2", ...],
  "coreOfferings": ["...", "..."],
  "suggestedTopics": [
    "Topic 1",
    "Topic 2",
    ... (30 items)
  ]
}`;

  // 1. Try OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.65,
      });
      const parsed = JSON.parse(resp.choices[0]?.message?.content || "{}");
      if (Array.isArray(parsed.suggestedTopics) && parsed.suggestedTopics.length >= 10) {
        return parsed;
      }
    } catch (err) {
      console.warn("[SiteIntelligence] OpenAI synthesis error:", err.message);
    }
  }

  // 2. Try Gemini Fallback
  if (process.env.GEMINI_API_KEY) {
    try {
      const gResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${prompt}\nRespond ONLY in valid JSON.` }] }],
            generationConfig: { temperature: 0.65, maxOutputTokens: 2048 },
          }),
        }
      );
      if (gResp.ok) {
        const gData = await gResp.json();
        const raw = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        const clean = raw.replace(/^```json|^```|```$/g, "").trim();
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed.suggestedTopics) && parsed.suggestedTopics.length >= 10) {
          return parsed;
        }
      }
    } catch (gErr) {
      console.warn("[SiteIntelligence] Gemini synthesis error:", gErr.message);
    }
  }

  // 3. Fallback if AI fails completely: Use Title and Headings
  const inferredName = businessName || crawledData?.siteName || "Our Brand";
  const inferredIndustry = title || "Specialized Services";
  return {
    brandName: inferredName,
    industry: inferredIndustry,
    nicheSummary: metaDesc || `Comprehensive professional solutions from ${inferredName}.`,
    coreOfferings: headings.slice(0, 8),
    suggestedTopics: headings.length >= 5
      ? headings.map((h) => `The Complete Guide to ${h}`)
      : [
          `Essential Guide to ${inferredName} Solutions & Services`,
          `How to Choose the Right Solution for Your Needs`,
          `Common Mistakes and How to Avoid Them`,
        ],
  };
}

/**
 * End-to-end site discovery orchestrator with persistent Supabase agent_memory caching.
 */
export async function getOrDiscoverSiteIntelligence({
  userEmail,
  businessName,
  siteUrl,
  forceRefresh = false,
  targetMarket = "",
  targetKeywords = [],
  existingTitles = [],
}) {
  const normBiz = (businessName || "default").toLowerCase().trim().replace(/[^a-z0-9]/g, "_");
  const memKey = `wp_intel_${normBiz}`;
  const CACHE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  // Check cached memory if not forcing refresh
  if (!forceRefresh && userEmail) {
    try {
      const { data: cachedMem } = await supabase
        .from("agent_memory")
        .select("content, updated_at")
        .eq("email", userEmail.toLowerCase())
        .eq("memory_type", memKey)
        .maybeSingle();

      if (cachedMem?.content) {
        const parsed = JSON.parse(cachedMem.content);
        const age = Date.now() - new Date(cachedMem.updated_at).getTime();
        if (age < CACHE_MS && Array.isArray(parsed.suggestedTopics) && parsed.suggestedTopics.length >= 15) {
          console.log(`[SiteIntelligence] Returning cached intelligence for ${businessName} (${parsed.industry})`);
          return { ...parsed, fromCache: true };
        }
      }
    } catch (e) {
      console.warn("[SiteIntelligence] Memory lookup error:", e.message);
    }
  }

  console.log(`[SiteIntelligence] Performing live crawl & AI synthesis for ${businessName || siteUrl}...`);
  const crawledData = await crawlWebsiteHomepage(siteUrl);

  const intelligence = await synthesizeSiteIntelligence({
    crawledData,
    businessName,
    siteUrl,
    targetMarket,
    targetKeywords,
    existingTitles,
  });

  // Persist to Supabase memory
  if (userEmail) {
    try {
      const payload = {
        ...intelligence,
        siteUrl,
        businessName,
        crawledAt: new Date().toISOString(),
      };

      await supabase.from("agent_memory").upsert(
        {
          email: userEmail.toLowerCase(),
          memory_type: memKey,
          content: JSON.stringify(payload),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,memory_type" }
      );

      // Also cross-sync discoveredServices and suggestedTopics into the active wp_autopilot config
      const autoKey = `wp_autopilot_${normBiz}`;
      const { data: currentAuto } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail.toLowerCase())
        .eq("memory_type", autoKey)
        .maybeSingle();

      let autoConfig = {};
      if (currentAuto?.content) {
        try { autoConfig = JSON.parse(currentAuto.content); } catch (_) {}
      }

      autoConfig.discoveredNiche = intelligence.industry;
      autoConfig.nicheSummary = intelligence.nicheSummary;
      autoConfig.discoveredServices = intelligence.coreOfferings;
      autoConfig.suggestedTopics = intelligence.suggestedTopics;
      if (Array.isArray(intelligence.targetKeywords) && intelligence.targetKeywords.length > 0) {
        autoConfig.targetKeywords = intelligence.targetKeywords;
      }
      autoConfig.lastCrawledAt = new Date().toISOString();

      await supabase.from("agent_memory").upsert(
        {
          email: userEmail.toLowerCase(),
          memory_type: autoKey,
          content: JSON.stringify(autoConfig),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,memory_type" }
      );
      console.log(`[SiteIntelligence] Successfully cached and synced intelligence for ${businessName}!`);
    } catch (persistErr) {
      console.warn("[SiteIntelligence] Failed to persist memory:", persistErr.message);
    }
  }

  return { ...intelligence, fromCache: false };
}
