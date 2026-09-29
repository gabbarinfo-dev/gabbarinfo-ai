// lib/meta/brand-intelligence.js
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { crawlWebsiteHomepage } from "../wordpress/site-intelligence.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const THIRTY_DAY_ANGLES = [
  { pillar: "educational_tips", hook: "The Step-by-Step Blueprint", template: "The Exact Roadmap to Get Maximum Value from {service}" },
  { pillar: "service_spotlight", hook: "Spotlight On Quality", template: "Behind the Scenes: How We Deliver High-Impact {service}" },
  { pillar: "myth_busting", hook: "Costly Misconception Exposed", template: "The #1 Lie People Believe About {service} (And the Reality)" },
  { pillar: "problem_solution", hook: "Overcoming Major Roadblocks", template: "Struggling with Slow Results in {service}? Here is the Fix" },
  { pillar: "interactive_poll", hook: "We Want Your Input", template: "Quick Question: What is Your Single Biggest Challenge in {service}?" },
  { pillar: "educational_tips", hook: "Insider Strategy", template: "3 Critical Principles That Elevate {service} to Elite Standards" },
  { pillar: "service_spotlight", hook: "Why Execution Matters", template: "Ordinary Providers vs. Agency-Grade Execution in {service}" },
  { pillar: "myth_busting", hook: "Fact Check & Truth", template: "Myth vs Reality: What Really Drives Measurable Growth in {service}" },
  { pillar: "problem_solution", hook: "Solving Common Bottlenecks", template: "How to Avoid the Costly Mistakes Most Businesses Make with {service}" },
  { pillar: "interactive_poll", hook: "Community Debate", template: "Which Approach to {service} Aligns Best with Your Brand Goals?" },
  { pillar: "educational_tips", hook: "5-Point Quality Audit", template: "The Essential Checklist Before You Invest in {service}" },
  { pillar: "service_spotlight", hook: "Proven Client Wins", template: "How Strategic {service} Unlocks Predictable Customer Loyalty" },
  { pillar: "myth_busting", hook: "The Hard Truth", template: "Why Cheap Shortcuts in {service} Always End Up Costing You 3x More" },
  { pillar: "problem_solution", hook: "The Practical Fix", template: "How to Optimize Your Existing {service} Pipeline for 2026" },
  { pillar: "interactive_poll", hook: "Tell Us Below", template: "What Feature or Quality Do You Value Most When Evaluating {service}?" },
  { pillar: "educational_tips", hook: "High-ROI Playbook", template: "The 3 Fast Tweaks to Multiply Your Return on {service}" },
  { pillar: "service_spotlight", hook: "Exclusive Standards", template: "What True Professional Craftsmanship in {service} Looks Like" },
  { pillar: "myth_busting", hook: "Common Industry Fallacy", template: "Think {service} is One-Size-Fits-All? Here Is Why That Fails" },
  { pillar: "problem_solution", hook: "Case Study Breakdown", template: "From Frustration to Clarity: A Real-World Breakthrough with {service}" },
  { pillar: "interactive_poll", hook: "Audience Perspective", template: "If You Could Solve One Problem with Your {service} Today, What Would It Be?" },
  { pillar: "educational_tips", hook: "Advanced Masterclass", template: "The Nuanced Strategy Behind Long-Term Success with {service}" },
  { pillar: "service_spotlight", hook: "Core Competency", template: "Why Leading Brands Refuse to Settle for Basic {service}" },
  { pillar: "myth_busting", hook: "Unmasking the Hype", template: "What Actually Moves the Needle in {service} vs. What Is Just Vanity" },
  { pillar: "problem_solution", hook: "Diagnostic Checklist", template: "Is Your Current {service} Actually Generating Real Bottom-Line Impact?" },
  { pillar: "interactive_poll", hook: "Your Thoughts", template: "What Has Been Your Personal Experience When Implementing {service}?" },
  { pillar: "educational_tips", hook: "Actionable Efficiency", template: "How Automation and Modern Workflows Accelerate {service} Speed" },
  { pillar: "service_spotlight", hook: "Brand Transformation", template: "The Direct Connection Between Premium {service} and Market Authority" },
  { pillar: "myth_busting", hook: "Debunking Outdated Advice", template: "Old-School Myths About {service} That You Must Unlearn in 2026" },
  { pillar: "problem_solution", hook: "Sustainable Scaling", template: "A Bulletproof Framework to Scale Your Operations with {service}" },
  { pillar: "interactive_poll", hook: "The 2026 Vision", template: "Where Do You See {service} Heading Over the Next 12 Months?" }
];

export function buildFallbackQueue(services = [], businessName = "Our Business", count = 30, suggestedTopics = [], richQueue = []) {
  if (Array.isArray(richQueue) && richQueue.length >= count) {
    const now = new Date();
    return richQueue.slice(0, count).map((item, idx) => ({
      day: idx + 1,
      pillar: item.pillar || "educational_tips",
      service: item.service || (services[idx % (services.length || 1)] || "Core Offerings"),
      hook: item.hook || "Expert Insight",
      topic: item.topic || "Practical guidance for your needs",
      status: "pending",
      scheduledDate: new Date(now.getTime() + (idx + 1) * 24 * 60 * 60 * 1000).toISOString(),
    }));
  }

  const cleanServices = services.length > 0 ? services : [
    "Core Capabilities",
    "Customer Support",
    "Specialized Execution",
    "Quality Solutions"
  ];
  const queue = [];
  const now = new Date();

  // If real pre-generated domain topics are available, prioritize them without duplication
  if (Array.isArray(suggestedTopics) && suggestedTopics.length > 0) {
    for (let i = 0; i < count; i++) {
      const topicText = suggestedTopics[i % suggestedTopics.length];
      const angle = THIRTY_DAY_ANGLES[i % THIRTY_DAY_ANGLES.length];
      const s = cleanServices[i % cleanServices.length];
      const scheduled = new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000);

      queue.push({
        day: i + 1,
        pillar: angle.pillar,
        service: s,
        hook: angle.hook,
        topic: topicText,
        status: "pending",
        scheduledDate: scheduled.toISOString()
      });
    }
    return queue;
  }

  for (let i = 0; i < count; i++) {
    const s = cleanServices[i % cleanServices.length];
    const angle = THIRTY_DAY_ANGLES[i % THIRTY_DAY_ANGLES.length];
    const scheduled = new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000);

    queue.push({
      day: i + 1,
      pillar: angle.pillar,
      service: s,
      hook: angle.hook,
      topic: angle.template.replace("{service}", s),
      status: "pending",
      scheduledDate: scheduled.toISOString()
    });
  }

  return queue;
}

/**
 * Extracts any website URL from brand payload, bio, or description.
 */
export function extractWebsiteUrl(payload = {}) {
  const direct = payload.website || payload.websiteUrl || payload.igWebsite;
  if (direct && typeof direct === "string" && direct.trim().length > 3) {
    let clean = direct.trim();
    if (!/^https?:\/\//i.test(clean)) clean = "https://" + clean;
    return clean;
  }

  const combinedText = [
    payload.about,
    payload.bio,
    payload.description,
    payload.igBiography,
  ].filter(Boolean).join(" ");

  const match = combinedText.match(/(?:https?:\/\/|www\.)[a-z0-9\-]+(?:\.[a-z]{2,})+[^\s,]*/i);
  if (match) {
    let clean = match[0].trim().replace(/[.,;)]+$/, "");
    if (!/^https?:\/\//i.test(clean)) clean = "https://" + clean;
    return clean;
  }

  return null;
}

/**
 * Comprehensive brand intelligence discovery for Meta (Facebook & Instagram) connections.
 * 1. Inspects Page bio, category, description, and Instagram bio.
 * 2. If any website is mentioned, crawls the live website.
 * 3. Uses GPT-4o-mini to extract authentic industry, services, and 30 high-converting social topics.
 * 4. Caches to agent_memory and initializes Social Autopilot queue.
 */
export async function discoverAndCacheMetaBrandIntelligence({
  email,
  normBusiness,
  brandPayload = {},
  forceRefresh = false,
}) {
  if (!email || !normBusiness) return null;

  const intelKey = `brand_intel_${normBusiness}`;
  const CACHE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  // Check cached intelligence unless forceRefresh is requested
  if (!forceRefresh) {
    try {
      const { data: cachedRow } = await supabase
        .from("agent_memory")
        .select("content, updated_at")
        .eq("email", email.toLowerCase())
        .eq("memory_type", intelKey)
        .maybeSingle();

      if (cachedRow?.content) {
        const parsed = JSON.parse(cachedRow.content);
        const age = Date.now() - new Date(cachedRow.updated_at).getTime();
        if (
          age < CACHE_MS &&
          Array.isArray(parsed.services) &&
          parsed.services.length >= 4 &&
          Array.isArray(parsed.suggestedTopics) &&
          parsed.suggestedTopics.length >= 10 &&
          !parsed.services.includes("Featured Products")
        ) {
          console.log(`[MetaBrandIntel] Returning cached intelligence for ${normBusiness} (${parsed.industry})`);
          return { ...parsed, fromCache: true };
        }
      }
    } catch (e) {
      console.warn("[MetaBrandIntel] Memory lookup error:", e.message);
    }
  }

  const businessName = brandPayload.businessName || brandPayload.pageName || "My Business";
  const category = brandPayload.category || (brandPayload.categoryList?.[0]?.name) || "";
  const about = [
    brandPayload.about,
    brandPayload.bio,
    brandPayload.description,
  ].filter(Boolean).join(". ").trim();
  const igBio = brandPayload.igBiography || "";
  const detectedWebsite = extractWebsiteUrl(brandPayload);

  console.log(`[MetaBrandIntel] Discovering intelligence for "${businessName}" (Cat: "${category}", Site: "${detectedWebsite || "None"}")`);

  // Step 1: Crawl website if present
  let crawledData = null;
  if (detectedWebsite) {
    try {
      crawledData = await crawlWebsiteHomepage(detectedWebsite);
    } catch (crawlErr) {
      console.warn(`[MetaBrandIntel] Crawl warning for ${detectedWebsite}:`, crawlErr.message);
    }
  }

  // Step 2: Formulate AI Synthesis Prompt
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[MetaBrandIntel] Missing OPENAI_API_KEY. Using heuristic fallback.");
    return null;
  }

  try {
    const openai = new OpenAI({ apiKey });

    const prompt = `You are a Principal Brand Strategist and Commercial Creative Director.
Analyze this real business profile obtained from their connected Facebook Page, Instagram account, and live crawled website:

BUSINESS PROFILE SIGNALS:
- Business / Brand Name: "${businessName}"
- Facebook Category / Industry: "${category || "Specialized Professional Services"}"
- Facebook Page Bio / About: "${about || "Professional business provider"}"
- Instagram Profile Bio: "${igBio || "None"}"
- Detected Website URL: "${detectedWebsite || "None"}"
${crawledData ? `
CRAWLED LIVE WEBSITE INTELLIGENCE:
- Website Page Title: "${crawledData.pageTitle || ""}"
- Meta Description: "${crawledData.metaDesc || ""}"
- Headings Found on Site: ${JSON.stringify(crawledData.headings || [])}
- Clean Content Excerpt:
"""${crawledData.bodyExcerpt || ""}"""
` : ""}

CRITICAL FIRST IMPRESSION & DOMAIN INTEGRITY MANDATES:
1. 100% FAITHFUL TO THE CLIENT'S ACTUAL BUSINESS:
   - Determine their exact, authentic industry (e.g. "Artisanal Custom Bakery & Confectionery", "AI Vedic Astrology & Horoscope SaaS", "Luxury Bridal Jewellery & Polki Accessories", "Pediatric Dental Care & Orthodontics", "Handcrafted Italian Leather Goods", "Automotive Detailing & Ceramic Coating", etc.).
2. ZERO GENERIC MARKETING AGENCY FILLER:
   - NEVER generate generic marketing agency advice like "boost your sales by 300%", "SEO ranking secrets", "B2B lead generation funnels", "conversion rate tips" UNLESS the business is literally a marketing agency!
   - NEVER generate generic e-commerce placeholders like "Featured Products", "Customer Favorites", "New Arrivals", or "Special Offers" unless they are explicitly an apparel or general retail catalog store.
3. EXTRACT 8 TO 12 REAL SERVICES / OFFERINGS:
   - Specific offerings, specialties, products, or signature services they provide.
4. GENERATE 30 HIGH-CONVERTING SOCIAL MEDIA CONTENT TOPICS:
   - Engaging, curiosity-inducing, educational, and problem-solving topics that prospective customers in their exact niche want to read, save, and share.
   - Tailored directly to their products, tips, styling, troubleshooting, customer wins, and FAQs.
5. GENERATE A 30-DAY RICH QUEUE:
   - Rotate across the 5 pillars: "educational_tips", "service_spotlight", "myth_busting", "problem_solution", "interactive_poll".
   - Each item has: "day" (1-30), "pillar", "service" (one of the extracted services), "hook" (punchy 4-7 word headline), "topic" (deeply specific topic angle).

Return STRICTLY valid JSON:
{
  "industry": "Exact authentic industry",
  "nicheSummary": "1-2 sentences summarizing what this business does and who it serves",
  "services": ["Service 1", "Service 2", ...],
  "suggestedTopics": [
    "Topic 1",
    "Topic 2",
    ... (30 items)
  ],
  "richQueue": [
    {
      "day": 1,
      "pillar": "educational_tips",
      "service": "Service Name",
      "hook": "Punchy 4-7 Word Headline",
      "topic": "Specific topic angle for social post"
    },
    ... (30 items)
  ],
  "brandVoice": "Engaging, authoritative, chic, and customer-centric",
  "targetAudience": "Description of target customers",
  "targetLocations": "Primary geographic market or global"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an elite brand intelligence strategist. Output strictly valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.65,
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");

    if (parsed.services && Array.isArray(parsed.services) && parsed.services.length > 0) {
      const intelligencePayload = {
        businessName,
        industry: parsed.industry || category || "Specialized Professional Services",
        nicheSummary: parsed.nicheSummary || `High-quality professional solutions from ${businessName}.`,
        services: parsed.services,
        suggestedTopics: Array.isArray(parsed.suggestedTopics) ? parsed.suggestedTopics : [],
        richQueue: Array.isArray(parsed.richQueue) ? parsed.richQueue : [],
        brandVoice: parsed.brandVoice || "Engaging, authoritative, and customer-centric",
        targetAudience: parsed.targetAudience || "Valued clients and community",
        targetLocations: parsed.targetLocations || "Global",
        crawledWebsite: detectedWebsite || null,
        discoveredBio: about || igBio || null,
        crawledAt: new Date().toISOString(),
      };

      // 1. Cache to agent_memory as brand_intel_${normBusiness}
      await supabase.from("agent_memory").upsert(
        {
          email: email.toLowerCase(),
          memory_type: intelKey,
          content: JSON.stringify(intelligencePayload),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,memory_type" }
      );

      // 2. Cross-sync into social_autopilot_${email}_${normBusiness}
      const autoMemoryKey = `social_autopilot_${email.toLowerCase()}_${normBusiness}`;
      const { data: currentAutoRow } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", email.toLowerCase())
        .eq("memory_type", autoMemoryKey)
        .maybeSingle();

      let autoConfig = {};
      if (currentAutoRow?.content) {
        try { autoConfig = JSON.parse(currentAutoRow.content); } catch (_) {}
      }

      const hasEmptyOrDirtyQueue =
        !autoConfig.queue ||
        !Array.isArray(autoConfig.queue) ||
        autoConfig.queue.length === 0 ||
        autoConfig.queue.some((q) => /google ads|seo optimization|website design for growth/i.test(q.topic || "") && !normBusiness.includes("gabbarinfo"));

      const builtQueue = buildFallbackQueue(
        intelligencePayload.services,
        businessName,
        30,
        intelligencePayload.suggestedTopics,
        intelligencePayload.richQueue
      );

      const mergedAutoConfig = {
        ...autoConfig,
        businessName,
        industry: intelligencePayload.industry,
        services: intelligencePayload.services,
        suggestedTopics: intelligencePayload.suggestedTopics,
        brandVoice: intelligencePayload.brandVoice,
        targetAudience: intelligencePayload.targetAudience,
        targetLocations: intelligencePayload.targetLocations,
        queue: hasEmptyOrDirtyQueue ? builtQueue : autoConfig.queue,
        lastIntelligenceSync: new Date().toISOString(),
      };

      await supabase.from("agent_memory").upsert(
        {
          email: email.toLowerCase(),
          memory_type: autoMemoryKey,
          content: JSON.stringify(mergedAutoConfig),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,memory_type" }
      );

      console.log(`[MetaBrandIntel] Successfully synthesized & cached intelligence for ${businessName} (${intelligencePayload.industry}, ${intelligencePayload.services.length} services, ${intelligencePayload.suggestedTopics.length} topics)`);
      return intelligencePayload;
    }
  } catch (err) {
    console.error("[MetaBrandIntel] Error during intelligence synthesis:", err);
  }

  return null;
}
