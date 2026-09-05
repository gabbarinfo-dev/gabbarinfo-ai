// pages/api/wordpress/suggest-keywords.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.body?.userEmail;

  const {
    topic = "",
    businessName = "GABBARinfo",
    city = "Ahmedabad",
    industry = "Digital Marketing, SEO & Web Development",
  } = req.body || {};

  if (!topic) {
    return res.status(400).json({ ok: false, error: "Topic is required" });
  }

  // 1. Resolve business city and location from agent_memory if available
  let resolvedCity = city || "Ahmedabad";
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
        if (answers.location || answers.city) {
          resolvedCity = answers.location || answers.city;
        }
        if (answers.service || answers.services) {
          businessServices = answers.service || answers.services;
        }
      }
    } catch (e) {
      console.warn("Could not load client memory for keywords:", e.message);
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Intelligent Fallback with Real City-Targeted Keywords
    const fallbackKws = [
      `seo service in ${resolvedCity}`,
      "google rankings optimization",
      `best seo agency in ${resolvedCity}`,
      `top digital marketing company ${resolvedCity}`,
      "roi driven seo strategy",
      "local business lead generation",
    ];
    return res.status(200).json({
      ok: true,
      keywords: fallbackKws,
      focus_keyword: `seo service in ${resolvedCity}`,
      source: "fallback",
    });
  }

  try {
    const openai = new OpenAI({ apiKey });

    const systemPrompt = `You are a Google SERP keyword research specialist and SEO growth strategist.
Your task is to generate 5 to 7 REAL, high-ranking, commercially valuable Google search keywords for a specific business, operating city, and blog topic.

STRICT RULES:
1. NEVER output single words, prepositions, or grammatical fragments like "with", "drives", "for", "the", "in".
2. EVERY keyword must be a complete, realistic search phrase (2 to 5 words) that a prospective client or buyer would actually type into Google Search.
3. Must include high-intent local search queries anchored to the target city/location (${resolvedCity}) (e.g. "seo service in ${resolvedCity}", "best digital marketing agency ${resolvedCity}").
4. Must include commercial intent keywords related to the topic and services (${businessServices}).
5. Output ONLY valid JSON matching this schema:
{
  "focus_keyword": "the primary target keyword (e.g. seo service in ${resolvedCity})",
  "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]
}`;

    const userPrompt = `Business Name: ${businessName}
Operating City / Location: ${resolvedCity}
Core Services: ${businessServices}
Blog Topic / Headline: ${topic}

Return 5 to 6 real, high-ranking keywords for this topic and location.`;

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
      keywords = [
        `seo service in ${resolvedCity}`,
        "google rankings optimization",
        `best seo agency in ${resolvedCity}`,
        `digital marketing company ${resolvedCity}`,
        "high converting business website",
      ];
    }

    return res.status(200).json({
      ok: true,
      keywords,
      focus_keyword: parsed.focus_keyword || keywords[0],
      city: resolvedCity,
    });
  } catch (err) {
    console.error("[SEO Keyword Engine Error]:", err);
    return res.status(200).json({
      ok: true,
      keywords: [
        `seo service in ${resolvedCity}`,
        "google rankings optimization",
        `best seo agency in ${resolvedCity}`,
        `digital marketing company ${resolvedCity}`,
        "roi driven seo strategy",
      ],
      focus_keyword: `seo service in ${resolvedCity}`,
      source: "error_fallback",
    });
  }
}
