// pages/api/wordpress/suggest-keywords.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateSmartFallbackKeywords(topic = "", businessName = "GABBARinfo", industry = "", marketScope = "") {
  const cleanTopic = topic.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  const basePhrases = [];

  if (/seo|rankings?|serp/i.test(topic)) {
    basePhrases.push("strategic seo services", "google search ranking optimization", "organic search lead generation", "roi driven seo strategy", "technical seo audit");
  } else if (/web design|website|ux|ui/i.test(topic)) {
    basePhrases.push("conversion rate optimization", "high converting business website", "modern web design trends", "responsive website development", "b2b website architecture");
  } else if (/lead generation|growth|marketing|advertising/i.test(topic)) {
    basePhrases.push("b2b lead generation strategies", "digital marketing roi optimization", "customer acquisition strategies", "performance marketing campaigns", "organic inbound marketing");
  } else {
    const words = cleanTopic.split(/\s+/).slice(0, 3).join(" ");
    basePhrases.push(`${words} strategies`, "business growth optimization", "high intent search solutions", "enterprise digital strategy");
  }

  // If user provided a specific market or city, weave it in naturally
  if (marketScope && marketScope !== "National & Global Commercial") {
    basePhrases.unshift(`top digital solutions in ${marketScope}`);
  }

  return basePhrases.slice(0, 6);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.body?.userEmail;

  const {
    topic = "",
    businessName = "GABBARinfo",
    targetMarket = "",
    city = "",
    industry = "Digital Marketing, SEO & Web Development",
  } = req.body || {};

  if (!topic) {
    return res.status(400).json({ ok: false, error: "Topic is required" });
  }

  // 1. Resolve business target market / location / services from memory if not explicitly provided
  let marketScope = (targetMarket || city || "").trim();
  let businessServices = industry;

  if (userEmail) {
    try {
      const { data: clientMem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail)
        .eq("memory_type", "client")
        .maybeSingle();

      if (clientMem?.content) {
        const parsed = JSON.parse(clientMem.content);
        const answers = parsed?.business_answers?.[businessName] || parsed?.business_answers?.["default_business"] || parsed || {};
        if (!marketScope) {
          marketScope = answers.target_market || answers.location || answers.country || answers.city || "";
        }
        if (answers.service || answers.services) {
          businessServices = answers.service || answers.services;
        }
      }
    } catch (e) {
      console.warn("Could not load client memory for keywords:", e.message);
    }
  }

  const resolvedScope = marketScope || "National & Global Commercial";

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const fallbackKws = generateSmartFallbackKeywords(topic, businessName, businessServices, marketScope);
    return res.status(200).json({
      ok: true,
      keywords: fallbackKws,
      focus_keyword: fallbackKws[0],
      market_scope: resolvedScope,
      source: "fallback",
    });
  }

  try {
    const openai = new OpenAI({ apiKey });

    const systemPrompt = `You are a Principal Google SERP Keyword Strategist and Search Intent Architect.
Your mission is to perform deep keyword research and return 5 to 7 high-impact, high-volume Google search phrases tailored for this specific business, industry, blog topic, and target market scope.

TARGET MARKET / GEOGRAPHIC SCOPE: "${resolvedScope}"
- If the market is a specific city, state, or country (e.g. "India", "USA", "Mumbai", "Texas"), include 1-2 top geographic search queries alongside primary industry terms.
- If the market is "National & Global Commercial", unconstrained, or broad digital/SaaS, focus on high-volume commercial, technical, and industry authority queries. DO NOT force any city name if none was requested.

CRITICAL KEYWORD RESEARCH ARCHITECTURE:
1. Focus Keyword: The single most authoritative primary search phrase (2 to 4 words) matching the headline's core topic.
2. Commercial Intent Keywords: High-conversion phrases that decision-makers and prospective clients actually search for when looking for services/solutions in this niche.
3. Topical Authority / LSI Keywords: Semantic search phrases that Google algorithms look for to rank content at position #1.
4. Long-Tail Search Queries: 3 to 5 word specific phrases answering high-intent search needs.

STRICT NEGATIVE FILTERS:
- NEVER output single words, prepositions, or grammatical fragments (e.g. "with", "drives", "for", "the", "in", "and").
- NEVER output internal database identifiers, table names, or underscore strings (e.g. "gabbarinfo_digital_solutions").
- EVERY keyword must be an authentic, multi-word search phrase (2 to 5 words) that real human beings type into Google Search.

Output strictly valid JSON matching this schema:
{
  "focus_keyword": "primary target search query",
  "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6"],
  "market_scope": "${resolvedScope}"
}`;

    const userPrompt = `Business: ${businessName}
Core Services / Industry: ${businessServices}
Blog Topic / Headline: ${topic}
Target Market / Scope: ${resolvedScope}

Generate 5 to 7 real, high-ranking Google search keywords for this exact topic and business context.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    let keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
    
    // Safety filter: strip any single words or words with underscores or fragments
    keywords = keywords.filter((k) => typeof k === "string" && k.trim().split(/\s+/).length >= 2 && !k.includes("_"));

    if (keywords.length === 0) {
      keywords = generateSmartFallbackKeywords(topic, businessName, businessServices, marketScope);
    }

    return res.status(200).json({
      ok: true,
      keywords,
      focus_keyword: parsed.focus_keyword || keywords[0],
      market_scope: resolvedScope,
    });
  } catch (err) {
    console.error("[SEO Keyword Engine Error]:", err);
    const fallbackKws = generateSmartFallbackKeywords(topic, businessName, businessServices, marketScope);
    return res.status(200).json({
      ok: true,
      keywords: fallbackKws,
      focus_keyword: fallbackKws[0],
      market_scope: resolvedScope,
      source: "error_fallback",
    });
  }
}
