/**
 * lib/autopilot/service-intelligence.js
 *
 * Shared service-intelligence engine for BOTH SEO Suite Autopilot and Social Planner Autopilot.
 *
 * Solves the "SEO SEO SEO" repetition problem by:
 *  1. Crawling the client's actual WP site (pages, categories, tags) for REAL services
 *  2. Using AI synthesis (OpenAI -> Gemini) when crawl is thin
 *  3. Strict round-robin via lastServiceIndex (NOT publishedCount) so every service
 *     is covered before ANY repeats - regardless of how many posts have been made
 *  4. Fuzzy topic deduplication across last 30 posts (65% word overlap = duplicate)
 *  5. Angle rotation (10 content angles) so posts don't all feel the same stylistically
 *
 * Zero hardcoding - works for ANY industry: digital marketing, laundry, real estate,
 * legal, medical, restaurant, e-commerce, etc.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── INTERNAL HELPERS ─────────────────────────────────────────────────────────

async function safeFetch(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    return await r.json();
  } catch (_) {
    return null;
  }
}

function deduplicateServices(services) {
  const seen = new Set();
  return services
    .filter((s) => {
      const k = String(s || "").toLowerCase().trim();
      if (k.length < 3 || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((s) => String(s).trim());
}

function isTopicDuplicate(topic, recentTopics) {
  if (!topic) return false;
  const sig = (t) =>
    t.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 3);
  const topicWords = new Set(sig(topic));
  for (const prev of recentTopics) {
    const prevWords = sig(prev);
    if (!prevWords.length) continue;
    const overlap = prevWords.filter((w) => topicWords.has(w)).length;
    if (overlap / Math.max(prevWords.length, topicWords.size) > 0.65) return true;
  }
  return false;
}

// ─── 1. WP SITE CRAWLER ───────────────────────────────────────────────────────

async function crawlSiteServices(siteUrl) {
  if (!siteUrl) return [];
  const clean = siteUrl.replace(/\/+$/, "");
  const services = new Set();

  const skipSlugs = /^(home|about|contact|privacy|terms|faq|blog|news|gallery|testimonials|portfolio|sitemap|404|uncategorized|sample-page|cart|checkout|shop|my-account)$/i;

  // Pages
  const pages = await safeFetch(`${clean}/wp-json/wp/v2/pages?per_page=50&_fields=title,slug,status&status=publish`);
  if (Array.isArray(pages)) {
    for (const p of pages) {
      const title = (p?.title?.rendered || p?.slug || "").replace(/<[^>]+>/g, "").trim();
      if (title && title.length > 2 && !skipSlugs.test((p.slug || "").toLowerCase())) {
        services.add(title);
      }
    }
  }

  // Categories
  const skipCats = /^(uncategorized|general|news|blog|posts|miscellaneous)$/i;
  const cats = await safeFetch(`${clean}/wp-json/wp/v2/categories?per_page=50&_fields=name,slug&hide_empty=true`);
  if (Array.isArray(cats)) {
    for (const c of cats) {
      if (c?.name && !skipCats.test((c.slug || "").toLowerCase())) services.add(c.name.trim());
    }
  }

  // Tags (count >= 2 only)
  const tags = await safeFetch(`${clean}/wp-json/wp/v2/tags?per_page=30&_fields=name,count&orderby=count&order=desc`);
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (t?.name && (t.count || 0) >= 2) services.add(t.name.trim());
    }
  }

  // GabbarInfo plugin native services (if exposed)
  const plug = await safeFetch(`${clean}/wp-json/gabbarinfo/v1/services`);
  if (Array.isArray(plug?.services)) {
    for (const s of plug.services) {
      const str = typeof s === "string" ? s : s?.name || "";
      if (str.trim()) services.add(str.trim());
    }
  }

  // Homepage HTML extraction if WP REST pages/categories were empty or thin
  if (services.size < 3) {
    try {
      const homeRes = await fetch(clean, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      if (homeRes.ok) {
        const html = await homeRes.text();
        const tMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (tMatch) {
          const tClean = tMatch[1].replace(/&#[0-9]+;|&[a-z]+;/gi, " ").trim();
          if (tClean.length > 3) services.add(tClean);
        }
        const hMatches = html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi);
        for (const m of hMatches) {
          const text = m[1].replace(/<[^>]+>/g, "").trim();
          if (text.length > 5 && text.length < 80 && !skipSlugs.test(text.toLowerCase())) {
            services.add(text);
          }
        }
      }
    } catch (_) {}
  }

  const arr = Array.from(services).filter((s) => s.length > 2).slice(0, 30);
  if (arr.length) console.log(`[ServiceIntelligence] Crawled ${arr.length} services from ${clean}: ${arr.slice(0, 5).join(", ")}...`);
  return arr;
}

// ─── 2. AI SYNTHESIZER ────────────────────────────────────────────────────────

async function synthesizeServicesWithAI(businessName, industry, existing, siteUrl) {
  const services = [...existing];
  const prompt = `You are an expert business analyst specializing in service identification.

Business Name: "${businessName || "Enterprise"}"
Industry / Niche: "${industry || "Professional Services"}"
Website: "${siteUrl || "unknown"}"
Already known services: ${services.length ? `"${services.join('", "')}"` : "None"}

TASK: Identify 6–10 SPECIFIC, DISTINCT services this exact business offers to its paying clients.

Examples of correct specificity (follow the pattern, don't copy literally):
- Labour law firm -> "Employment Dispute Representation", "Wrongful Termination Claims", "Workplace Harassment Defence", "Employment Contract Review"
- Laundry service -> "Dry Cleaning", "Wash & Fold", "Ironing & Pressing", "Stain Removal", "Pickup & Delivery"
- Digital marketing agency -> "Google Ads Management", "Meta Ads Campaigns", "SEO Optimization", "Social Media Marketing", "Email Marketing", "Website Design"
- Real estate -> "Residential Sales", "Commercial Leasing", "Property Management", "Investment Consulting"

RULES:
- Be SPECIFIC to the actual business type and niche
- Do NOT use generic terms like "Consultation" or "Client Support" unless truly no other services apply
- Do NOT repeat similar services with slightly different wording

Return ONLY a valid JSON array of strings, no markdown, no explanation:
["Service 1", "Service 2"]`;

  // OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
      });
      const raw = resp.choices?.[0]?.message?.content?.trim() || "";
      const parsed = JSON.parse(raw.replace(/^```json|^```|```$/g, "").trim());
      if (Array.isArray(parsed) && parsed.length > 0) {
        return deduplicateServices([...services, ...parsed.map(String)]);
      }
    } catch (err) {
      console.warn("[ServiceIntelligence] OpenAI synthesis failed:", err.message);
    }
  }

  // Gemini fallback
  if (process.env.GEMINI_API_KEY) {
    try {
      const gResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
          }),
        }
      );
      if (gResp.ok) {
        const gData = await gResp.json();
        const raw = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        const parsed = JSON.parse(raw.replace(/^```json|^```|```$/g, "").trim());
        if (Array.isArray(parsed) && parsed.length > 0) {
          return deduplicateServices([...services, ...parsed.map(String)]);
        }
      }
    } catch (err) {
      console.warn("[ServiceIntelligence] Gemini synthesis failed:", err.message);
    }
  }

  return deduplicateServices(services);
}

// ─── PUBLIC: BUILD SERVICE ROSTER ─────────────────────────────────────────────

/**
 * Builds the full deduplicated service roster for a user.
 * Caches in config.discoveredServices for 7 days to avoid re-crawling daily.
 *
 * Order of trust: WP site crawl > manual config > AI synthesis > generic fallback
 */
export async function buildServiceRoster({ config, userEmail, businessName, industry, clientServices, siteUrl }) {
  const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (
    Array.isArray(config.discoveredServices) &&
    config.discoveredServices.length >= 3 &&
    config.discoveredServicesAt &&
    now - new Date(config.discoveredServicesAt).getTime() < CACHE_TTL_MS
  ) {
    console.log(`[ServiceIntelligence] Using ${config.discoveredServices.length}-item cached roster`);
    return config.discoveredServices;
  }

  console.log(`[ServiceIntelligence] Building fresh roster for ${businessName || userEmail}...`);

  // Step 1: manual config sources
  const rawServices = [];
  if (Array.isArray(config.services)) rawServices.push(...config.services);
  if (Array.isArray(config.targetKeywords)) rawServices.push(...config.targetKeywords);
  if (typeof clientServices === "string" && clientServices.trim()) {
    rawServices.push(...clientServices.split(/[,;\n|]/).map((s) => s.trim()));
  }
  let roster = deduplicateServices(rawServices);

  // Step 2: crawl actual website (ground truth - this is the KEY fix)
  if (siteUrl) {
    const crawled = await crawlSiteServices(siteUrl);
    roster = deduplicateServices([...crawled, ...roster]); // crawled goes first (more trustworthy)
  }

  // Step 3: AI synthesis if still thin
  if (roster.length < 4) {
    console.log(`[ServiceIntelligence] Only ${roster.length} services — invoking AI synthesis...`);
    roster = await synthesizeServicesWithAI(businessName, industry, roster, siteUrl);
  }

  // Step 4: hard fallback (never marketing-specific)
  if (roster.length < 3) {
    roster = deduplicateServices([
      ...roster,
      `${businessName || "Business"} Core Services`,
      `${industry || "Professional"} Solutions`,
      "Client Consultation & Delivery",
    ]);
  }

  console.log(`[ServiceIntelligence] Final roster (${roster.length}): ${roster.slice(0, 6).join(" | ")}${roster.length > 6 ? "..." : ""}`);
  return roster;
}

// ─── PUBLIC: ROUND-ROBIN PICKER ───────────────────────────────────────────────

/**
 * Picks the NEXT service using lastServiceIndex (NOT publishedCount).
 * This guarantees every service gets one turn before any repeats.
 */
export function pickNextService(config, serviceRoster) {
  if (!serviceRoster || serviceRoster.length === 0) {
    return { activeService: "Business Growth", nextServiceIndex: 0 };
  }
  const currentIndex = typeof config.lastServiceIndex === "number" ? config.lastServiceIndex : -1;
  const nextIndex = (currentIndex + 1) % serviceRoster.length;
  const activeService = serviceRoster[nextIndex];
  console.log(`[ServiceIntelligence] Round-robin [${nextIndex + 1}/${serviceRoster.length}]: "${activeService}"`);
  return { activeService, nextServiceIndex: nextIndex };
}

// ─── PUBLIC: TOPIC GENERATOR ──────────────────────────────────────────────────

const CONTENT_ANGLES = [
  "how-to guide with step-by-step tactics",
  "common mistakes clients make and how to avoid them",
  "industry trends and what they mean for customers",
  "cost vs value analysis for the client",
  "real-world success story or case study format",
  "beginner's complete guide",
  "advanced strategies for experienced clients",
  "myths debunked and the real truth revealed",
  "actionable checklist or decision framework",
  "how to choose the right provider or approach",
];

/**
 * Generates a unique, high-quality topic for a given service.
 * Ensures no stylistic or semantic repetition across recent posts.
 * contentType: "blog" | "social"
 */
export async function generateUniqueTopic({ config, activeService, serviceRoster, businessName, industry, targetMarket, contentType = "blog" }) {
  const recentTopics = Array.isArray(config.publishedTopics) ? config.publishedTopics.slice(-30) : [];
  const angleHint = CONTENT_ANGLES[(config.publishedCount || 0) % CONTENT_ANGLES.length];
  const isSeoService = /\bseo\b/i.test(activeService);
  const otherServices = (serviceRoster || []).filter((s) => s !== activeService).slice(0, 5).join('", "');

  const prompt = `You are a ${contentType === "blog" ? "Principal SEO Content Strategist" : "Social Media Content Expert"}.

Business: "${businessName || "Business"}"
Industry: "${industry || "Professional Services"}"
Target Audience: "${targetMarket || "General consumers and businesses"}"
SERVICE TO COVER TODAY: "${activeService}"
Other services this business offers (DO NOT MIX INTO THIS TOPIC): "${otherServices}"
Content angle for this post: "${angleHint}"

STRICT RULES:
1. The ${contentType === "blog" ? "blog headline" : "social hook"} MUST focus specifically on "${activeService}" only
2. ${!isSeoService ? `CRITICAL: DO NOT use the word "SEO" or any search-engine/digital-marketing terminology — this post is strictly about "${activeService}"` : ""}
3. Must NOT be similar to these recently published topics:
${recentTopics.slice(-10).map((t, i) => `   ${i + 1}. ${t}`).join("\n") || "   (none yet — this is the first post)"}
4. Format: ${contentType === "blog" ? "8–14 word authoritative headline addressing a real client pain point" : "5–10 word punchy hook or question that makes someone stop scrolling"}
5. Return ONLY the title/hook — no quotes, no preamble, no explanation

Generate now:`;

  // OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.85,
        max_tokens: 80,
      });
      const title = resp.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "");
      if (title && title.length > 10 && !isTopicDuplicate(title, recentTopics)) {
        console.log(`[ServiceIntelligence] OpenAI topic for "${activeService}": "${title}"`);
        return title;
      }
    } catch (err) {
      console.warn("[ServiceIntelligence] OpenAI topic gen failed:", err.message);
    }
  }

  // Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const gResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: 100 },
          }),
        }
      );
      if (gResp.ok) {
        const gData = await gResp.json();
        const title = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim().replace(/^["']|["']$/g, "");
        if (title && title.length > 10 && !isTopicDuplicate(title, recentTopics)) {
          console.log(`[ServiceIntelligence] Gemini topic for "${activeService}": "${title}"`);
          return title;
        }
      }
    } catch (err) {
      console.warn("[ServiceIntelligence] Gemini topic gen failed:", err.message);
    }
  }

  // Angle-aware template fallback (10 distinct templates, one per angle)
  const templateMap = {
    "how-to guide with step-by-step tactics": `How to Get the Best Results from ${activeService}: A Practical Step-by-Step Guide`,
    "common mistakes clients make and how to avoid them": `${activeService}: The Costly Mistakes Most People Make and How to Avoid Them`,
    "industry trends and what they mean for customers": `${activeService} in ${new Date().getFullYear()}: Key Trends Every Client Should Know`,
    "cost vs value analysis for the client": `Is ${activeService} Worth the Investment? An Honest Cost-Value Breakdown`,
    "real-world success story or case study format": `How Clients Are Achieving Exceptional Results with ${activeService}`,
    "beginner's complete guide": `The Complete Beginner's Guide to ${activeService}: Everything You Need to Know`,
    "advanced strategies for experienced clients": `Advanced ${activeService} Strategies to Maximise Results in ${new Date().getFullYear()}`,
    "myths debunked and the real truth revealed": `${activeService} Myths Debunked: What You Have Been Getting Wrong`,
    "actionable checklist or decision framework": `The Ultimate ${activeService} Checklist: Are You Covering All the Bases?`,
    "how to choose the right provider or approach": `How to Choose the Right ${activeService}: What to Look for in ${new Date().getFullYear()}`,
  };

  const tpl = templateMap[angleHint] || `${activeService}: Essential Insights for ${new Date().getFullYear()}`;
  if (!isTopicDuplicate(tpl, recentTopics)) return tpl;

  // Guaranteed unique last resort
  return `${activeService}: ${angleHint.charAt(0).toUpperCase() + angleHint.slice(1)} — ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
}

// ─── PUBLIC: FETCH USER WP SITE URL ──────────────────────────────────────────

export async function fetchUserSiteUrl(userEmail, businessName) {
  try {
    if (businessName) {
      const key = businessName.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");
      const { data } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail)
        .eq("memory_type", `wp_conn_${key}`)
        .maybeSingle();
      if (data?.content) {
        const p = JSON.parse(data.content);
        if (p?.siteUrl) return p.siteUrl;
      }
    }
    // Fallback: only if no specific business was provided and user has exactly ONE connection
    if (!businessName || businessName === "default") {
      const { data: allWp } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail)
        .like("memory_type", "wp_conn_%");

      if (allWp && allWp.length === 1) {
        const p = JSON.parse(allWp[0].content);
        if (p?.siteUrl) return p.siteUrl;
      }
    }
  } catch (err) {
    console.warn("[ServiceIntelligence] fetchUserSiteUrl error:", err.message);
  }
  return null;
}
