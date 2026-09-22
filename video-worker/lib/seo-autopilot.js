// video-worker/lib/seo-autopilot.js
const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");
const { ensureInstagramCompatibleJpeg } = require("./instagram-image-helper");

const BLACKLISTED_TERMS = [
  "shipping",
  "delivery",
  "privacy",
  "policy",
  "terms",
  "condition",
  "refund",
  "cancellation",
  "disclaimer",
  "return",
  "contact",
  "about",
  "login",
  "register",
  "cart",
  "checkout",
  "cookie",
  "test",
  "discreet"
];

function decodeHtmlEntities(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;/g, "-")
    .replace(/&#8217;/g, "'")
    .replace(/&quot;/g, '"');
}

function isLegitimateService(serviceName) {
  if (!serviceName || typeof serviceName !== "string") return false;
  const decoded = decodeHtmlEntities(serviceName).toLowerCase().trim();
  if (decoded.length < 3) return false;
  for (const term of BLACKLISTED_TERMS) {
    if (decoded.includes(term)) return false;
  }
  return true;
}

function detectBusinessIndustry(businessName = "", topic = "", services = "") {
  const combined = `${businessName} ${topic} ${services}`.toLowerCase();
  if (/astrolog|jyotish|vedic|horoscope|palmistry|tarot|kundali|spiritual|vastu|zodiac|numerolog/i.test(combined)) {
    return "ASTROLOGY_SPIRITUALITY";
  }
  if (/health|clinic|doctor|dental|dentist|medic|therap|hospital|pharma|wellness|fitness|physio/i.test(combined)) {
    return "HEALTHCARE_MEDICAL";
  }
  if (/cloth|apparel|dress|fashion|jewelry|jewel|boutique|wear|accessories|saree|ethnic|style/i.test(combined)) {
    return "FASHION_RETAIL";
  }
  if (/law|legal|attorney|lawyer|court|litigat|estate planning|divorce/i.test(combined)) {
    return "LEGAL_PROFESSIONAL";
  }
  if (/roof|plumb|contractor|construct|hvac|electric|paint|renovat|home improv|interior design/i.test(combined)) {
    return "HOME_SERVICES_TRADES";
  }
  if (/seo|digital marketing|google ads|meta ads|web design|software|saas|app develop|b2b tech/i.test(combined)) {
    return "DIGITAL_TECH_MARKETING";
  }
  return "GENERAL_BUSINESS";
}

function getIndustryAdaptiveVisualPrompts(industry, title, serviceOrTopic) {
  switch (industry) {
    case "ASTROLOGY_SPIRITUALITY":
      return {
        heroPrompt: `Award-winning artistic editorial hero illustration for "${title}". Traditional Vedic astrological wisdom, cosmic planetary alignments, antique palmistry scrolls and sacred charts on dark teakwood desk, warm glowing brass diya oil lamp light, celestial constellations in the midnight sky, rich gold and deep navy indigo aesthetic, masterwork fine art composition, 4K quality, absolutely no modern digital gadgets, no watermarks.`,
        midPrompt: `Stunning, museum-grade sacred geometric Vedic astrology cosmological diagram and traditional Kundli chart for "${title}". Intricate 12-house Vedic birth chart geometry, concentric celestial rings of the 27 lunar Nakshatras, glowing golden planetary orbits of the Navagrahas, ancient Indian astronomical motifs, deep cosmic midnight blue and warm radiating gold starlight, sacred geometry symmetry, fine art architectural detail, ultra-high resolution, absolutely NO modern tech, NO software architecture, NO marketing charts, NO flowcharts.`
      };

    case "HEALTHCARE_MEDICAL":
      return {
        heroPrompt: `Award-winning prestigious clinical medical editorial photography for "${title}". Subject: "${serviceOrTopic}". Compassionate healthcare setting, advanced clinical wellness, clean natural ambient lighting, medical professional, photorealistic 8K quality, crisp authentic composition, no watermarks.`,
        midPrompt: `A clean, highly educational clinical wellness flowchart and medical anatomical infographic illustrating "${title}". Professional healthcare process pathway, diagnostic stages, biological wellness diagram, calm clinical cyan and soft white lighting, authoritative medical aesthetic, pristine high resolution, no marketing charts.`
      };

    case "FASHION_RETAIL":
      return {
        heroPrompt: `High-fashion luxury editorial magazine photography for "${title}". Subject: "${serviceOrTopic}". Exquisite handcrafted garments, artisanal jewellery textures, couture silhouettes, warm dramatic studio lighting, rich fabrics, photorealistic 8K quality, high-end runway aesthetic, no watermarks.`,
        midPrompt: `A sophisticated, elegant visual styling and design palette framework for "${title}". Curated artisanal textile swatches, luxury craftsmanship steps, color theory palette, clean luxury boutique editorial layout, soft natural studio lighting, high resolution, no software or tech diagrams.`
      };

    case "LEGAL_PROFESSIONAL":
      return {
        heroPrompt: `Prestigious executive editorial photography for "${title}". Subject: "${serviceOrTopic}". High-end mahogany law library, balanced scales of justice, leather-bound legal tomes, warm architectural lighting, authoritative and dignified composition, 8K resolution, no watermarks.`,
        midPrompt: `An authoritative, elegant legal framework and statutory compliance flowchart for "${title}". Clean corporate governance roadmap, structured procedural milestones, dark executive mahogany and slate styling, crisp clean lines, professional resolution, no marketing jargon.`
      };

    case "HOME_SERVICES_TRADES":
      return {
        heroPrompt: `Professional editorial craftsmanship photography for "${title}". Subject: "${serviceOrTopic}". Skilled artisan at work, precision tools, premium architectural materials, crisp natural lighting, authentic trade craftsmanship, 8K quality, no watermarks.`,
        midPrompt: `A detailed architectural cross-section blueprint and craftsmanship inspection diagram for "${title}". Structural engineering cutaway, material layers, precision technical schematics, clean blueprint blue and white drafting lines, crisp professional detail.`
      };

    case "DIGITAL_TECH_MARKETING":
      return {
        heroPrompt: `Award-winning modern editorial hero illustration for blog article. Title: "${title}". Subject: "${serviceOrTopic}". Sleek modern studio lighting, 3D holographic digital accents, dark luxury slate aesthetics, high contrast, clean tech agency composition, pristine 4K quality, no text watermark.`,
        midPrompt: `Award-winning commercial editorial diagram graphic showing modern technical architecture, workflow flowcharts, and systems framework for "${serviceOrTopic}". Sleek dark luxury slate aesthetic, glowing cyan and warm amber accent lighting, clean geometric flow lines, 3D holographic panels, high contrast, clean agency composition, pristine 4K quality, no text gibberish.`
      };

    default: // GENERAL_BUSINESS
      return {
        heroPrompt: `Award-winning editorial commercial photography for "${title}". Subject: "${serviceOrTopic}". Modern executive workspace, collaborative strategy session, elegant architectural lighting, sleek professional aesthetics, 8K resolution, no watermarks.`,
        midPrompt: `An executive strategic framework and operational roadmap diagram for "${title}". Core organizational pillars, milestone progression timeline, clean business advisory layout, sleek dark slate and gold accents, crisp high resolution, no tech gibberish.`
      };
  }
}

function enforceSpatialLinkDistribution(contentHtml, catalogPosts = [], activeService = "Our Services", siteUrl = "") {
  if (!contentHtml) return contentHtml;
  let clean = contentHtml;

  // 0. Remove any duplicate hero image figures injected into content
  clean = clean.replace(/<figure[^>]*class=["'][^"']*featured-hero[^"']*["'][^>]*>[\s\S]*?<\/figure>/gi, "");

  // 1. Clean Section 10 / Final Paragraph from dumped links
  clean = clean.replace(/<p>[^<]*partner with\s*<a[^>]*href=["'][^"']*services[^"']*["'][^>]*>[\s\S]*?<\/p>/gi, () => {
    return `<p>Achieving lasting authority and real-world impact requires continuous adaptation, domain expertise, and dedicated execution.</p>`;
  });

  const lastSectionRegex = /<h2>10\.\s*Strategic Conclusion[\s\S]*$/i;
  const matchSection10 = clean.match(lastSectionRegex);
  if (matchSection10) {
    let section10Html = matchSection10[0];
    const strippedSection10 = section10Html.replace(/<a\s+[^>]*href=["'][^"']*(?:services|contact-us|packages)[^"']*["'][^>]*>(.*?)<\/a>/gi, '$1');
    clean = clean.replace(section10Html, strippedSection10);
  }

  // 2. Strict Cross-Domain & Hallucinated Link Sanitization:
  const approvedInternalUrls = new Set(
    (catalogPosts || [])
      .map(p => (p.link || "").toLowerCase().replace(/\/$/, ""))
      .filter(Boolean)
  );

  const cleanSiteUrl = (siteUrl || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const isAstrologyOrGeneral = /astrolog|vedic|jyotish|palmistry|horoscope|spirit|jewel|apparel|dent|clinic/i.test(activeService);

  // Inspect all <a ... href="URL">ANCHOR</a>
  clean = clean.replace(/<a\s+([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi, (fullMatch, preHref, href, postHref, anchorText) => {
    const rawHref = href.trim();
    const lowerHref = rawHref.toLowerCase();

    // RULE 1: Never leak gabbarinfo.com on a site that is NOT gabbarinfo.com!
    if (lowerHref.includes("gabbarinfo.com") && (!cleanSiteUrl || !cleanSiteUrl.includes("gabbarinfo.com"))) {
      return anchorText; // Strip the <a> tag, keep anchor text
    }

    // RULE 2: If the link is an internal link (points to this siteUrl or is relative path)
    const isInternal = cleanSiteUrl && (lowerHref.includes(cleanSiteUrl) || rawHref.startsWith("/"));
    if (isInternal) {
      const normalizedHref = lowerHref.replace(/\/$/, "");
      const isApproved = Array.from(approvedInternalUrls).some(u => normalizedHref === u || normalizedHref.endsWith(u.replace(/^https?:\/\/[^\/]+/, "")));
      if (!isApproved && approvedInternalUrls.size > 0) {
        return anchorText;
      }
      if (approvedInternalUrls.size === 0) {
        return anchorText;
      }
    }

    // RULE 3: Strip known digital marketing / tech publications from non-marketing sites
    if (isAstrologyOrGeneral) {
      if (/searchenginejournal\.com|hubspot\.com|contentmarketinginstitute\.com|forbes\.com|w3\.org|gartner\.com|mckinsey\.com|bain\.com/i.test(lowerHref)) {
        return anchorText; // Strip marketing publications from non-marketing sites
      }
    }

    return fullMatch;
  });

  return clean;
}

async function runSeoAutopilotCycle({ supabase, openai, force = false, logger = console.log }) {
  if (!supabase) throw new Error("Supabase client is required.");
  if (!openai) throw new Error("OpenAI client is required for blog & visual generation.");

  logger("[SEO Autopilot] Starting autonomous scheduled blog cycle on Railway...");

  // 1. Fetch active SEO Autopilot configurations
  const { data: configs, error } = await supabase
    .from("agent_memory")
    .select("email, memory_type, content")
    .like("memory_type", "wp_autopilot_%");

  if (error) {
    logger("[SEO Autopilot] Failed to fetch SEO autopilot configs:", error.message);
    throw error;
  }

  const results = [];

  for (const item of configs || []) {
    try {
      const config = JSON.parse(item.content);
      const isEnabled = config.enabled === undefined ? true : config.enabled;
      if (!isEnabled && !force) {
        logger(`[SEO Autopilot] Autopilot disabled for ${item.email}. Skipping.`);
        continue;
      }

      const businessName = config.businessName || "GABBARinfo";
      logger(`[SEO Autopilot] Processing cycle for ${item.email} (${businessName})...`);

      // 2. Check Cadence velocity (~12 hours for daily)
      const lastPublished = config.lastPublishedAt ? new Date(config.lastPublishedAt) : null;
      const now = new Date();
      const minIntervalMs = 12 * 60 * 60 * 1000;

      if (lastPublished && (now - lastPublished) < minIntervalMs && !force) {
        logger(`[SEO Autopilot] Cadence threshold not reached for ${item.email} (${businessName}). Skipping.`);
        continue;
      }

      // 3. Find connected WordPress credentials strictly for this specific business profile
      const targetBizKey = item.memory_type.replace(/^wp_autopilot_/, "");
      const normalizedBiz = (config.businessName || targetBizKey || "default")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, "_");
      const targetConnKey = `wp_conn_${normalizedBiz}`;
      const altConnKey = `wp_conn_${targetBizKey}`;

      const { data: wpMemList } = await supabase
        .from("agent_memory")
        .select("memory_type, content")
        .eq("email", item.email)
        .or(`memory_type.eq.${targetConnKey},memory_type.eq.${altConnKey},memory_type.like.wp_conn_%,memory_type.eq.wordpress_connection`);

      let wpConn = null;
      // 1. Try exact business match first (Zero cross-site contamination)
      const exactMatch = (wpMemList || []).find(
        (m) => m.memory_type === targetConnKey || m.memory_type === altConnKey
      );
      if (exactMatch?.content) {
        try {
          const parsed = JSON.parse(exactMatch.content);
          if (parsed.siteUrl && (parsed.apiKey || parsed.applicationPassword)) {
            wpConn = parsed;
          }
        } catch (_) {}
      }

      // 2. If no exact match and default/single-profile account, fallback safely
      if (!wpConn && (!targetBizKey || targetBizKey === "default")) {
        for (const m of wpMemList || []) {
          try {
            const parsed = JSON.parse(m.content);
            if (parsed.siteUrl && (parsed.apiKey || parsed.applicationPassword)) {
              wpConn = parsed;
              break;
            }
          } catch (_) {}
        }
      }

      if (!wpConn) {
        logger(`[SEO Autopilot] No active WordPress connection found for ${item.email} profile "${businessName}" (Key: ${targetConnKey}). Skipping.`);
        results.push({ email: item.email, status: "skipped", reason: "no_wp_connection", business: businessName });
        continue;
      }

      const siteUrl = wpConn.siteUrl.replace(/\/$/, "");
      const wpApiKey = wpConn.apiKey;

      // 4. Select Legitimate Service Topic for ANY Business Type
      let candidateServices = [];
      if (Array.isArray(config.discoveredServices)) candidateServices.push(...config.discoveredServices.map(decodeHtmlEntities));
      if (Array.isArray(config.targetKeywords)) candidateServices.push(...config.targetKeywords.map(decodeHtmlEntities));
      candidateServices = [...new Set(candidateServices)].filter(isLegitimateService);

      // If not yet discovered, check client onboarding memory for their exact business services
      if (candidateServices.length === 0) {
        try {
          const { data: clientMem } = await supabase
            .from("agent_memory")
            .select("content")
            .eq("email", item.email)
            .eq("memory_type", "client")
            .maybeSingle();
          if (clientMem?.content) {
            const parsedClient = typeof clientMem.content === "string" ? JSON.parse(clientMem.content) : clientMem.content;
            const bAnswers = parsedClient?.business_answers?.[businessName] || parsedClient?.business_answers?.["default_business"] || parsedClient || {};
            const clientServ = bAnswers.services || bAnswers.service || bAnswers.products || "";
            if (clientServ) {
              const splitted = String(clientServ).split(/[,|\n]+/).map((s) => s.trim()).filter((s) => s.length > 2);
              if (splitted.length > 0) candidateServices.push(...splitted.filter(isLegitimateService));
            }
          }
        } catch (_) {}
      }

      // If still empty, dynamically crawl their actual site's published pages
      if (candidateServices.length === 0 && siteUrl) {
        try {
          const pagesRes = await fetch(`${siteUrl}/wp-json/wp/v2/pages?per_page=20&_fields=title,slug`);
          if (pagesRes.ok) {
            const pages = await pagesRes.json();
            const skipSlugs = /^(home|about|contact|privacy|terms|faq|cart|checkout|my-account|sample-page)$/i;
            for (const p of pages || []) {
              const title = (p?.title?.rendered || p?.slug || "").replace(/<[^>]+>/g, "").trim();
              if (title && title.length > 2 && !skipSlugs.test((p.slug || "").toLowerCase())) {
                candidateServices.push(title);
              }
            }
          }
        } catch (_) {}
      }

      // If still empty, crawl homepage HTML to extract true brand identity and offerings
      if (candidateServices.length === 0 && siteUrl) {
        try {
          const homeRes = await fetch(siteUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          });
          if (homeRes.ok) {
            const html = await homeRes.text();
            const tMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (tMatch) {
              const tClean = tMatch[1].replace(/&#[0-9]+;|&[a-z]+;/gi, " ").trim();
              if (tClean.length > 3) candidateServices.push(tClean);
            }
            const hMatches = html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi);
            for (const m of hMatches) {
              const text = m[1].replace(/<[^>]+>/g, "").trim();
              if (text.length > 5 && text.length < 80 && !/^(home|about|contact|privacy|terms)/i.test(text)) {
                candidateServices.push(text);
              }
            }
          }
        } catch (_) {}
      }

      // Dynamic fallback based on the user's specific business name & industry
      if (candidateServices.length === 0) {
        const ind = config.discoveredNiche || config.industry || businessName || "Specialized Solutions";
        candidateServices = [
          `${ind} Core Concepts & Guide`,
          `Essential Best Practices in ${ind}`,
          `Practical Approaches & Solutions in ${ind}`,
          `Expert Analysis & Guidance for ${ind}`
        ];
      }

      // If topic queue or suggested topics exist, prioritize those
      let activeService = "";
      if (Array.isArray(config.topicQueue) && config.topicQueue.length > 0) {
        activeService = config.topicQueue[0];
      } else if (Array.isArray(config.suggestedTopics) && config.suggestedTopics.length > 0) {
        let topicIdx = (Number(config.lastServiceIndex) || 0) + 1;
        if (topicIdx >= config.suggestedTopics.length) topicIdx = 0;
        activeService = config.suggestedTopics[topicIdx];
      }

      if (!activeService) {
        let nextIndex = (Number(config.lastServiceIndex) || 0) + 1;
        if (nextIndex >= candidateServices.length) nextIndex = 0;
        activeService = candidateServices[nextIndex] || `${businessName} Solutions`;
      }
      const targetLocations = (config.targetLocations || config.targetMarket || "").trim();

      // 4.5 Fetch Existing Published WordPress Posts & Pages for Authentic Internal Linking
      let existingPublishedPosts = [];
      let existingPublishedPages = [];
      try {
        const [postsResp, pagesResp] = await Promise.all([
          fetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=15&_fields=id,title,slug,link`, { headers: { Accept: "application/json" } }),
          fetch(`${siteUrl}/wp-json/wp/v2/pages?per_page=10&_fields=id,title,slug,link`, { headers: { Accept: "application/json" } })
        ]);
        if (postsResp.ok) {
          const rawPosts = await postsResp.json();
          if (Array.isArray(rawPosts)) {
            existingPublishedPosts = rawPosts.map((p) => ({
              id: p.id,
              title: typeof p.title === "object" ? p.title.rendered : p.title,
              link: p.link,
              slug: p.slug,
            })).filter((p) => p.link && p.title);
          }
        }
        if (pagesResp.ok) {
          const rawPages = await pagesResp.json();
          if (Array.isArray(rawPages)) {
            existingPublishedPages = rawPages.map((p) => ({
              id: p.id,
              title: typeof p.title === "object" ? p.title.rendered : p.title,
              link: p.link,
              slug: p.slug,
            })).filter((p) => p.link && p.title);
          }
        }
      } catch (e) {
        logger(`[SEO Autopilot] Note: Could not fetch existing published content (${e.message}).`);
      }

      // Filter out off-topic / junk articles if any
      const offTopicFilter = /santa|christmas|herbal-beauty/i;
      const relevantPublishedPosts = existingPublishedPosts.filter(p => !offTopicFilter.test(p.slug || p.title));
      const selectedInternalPosts = relevantPublishedPosts.length > 0 ? relevantPublishedPosts.slice(0, 8) : existingPublishedPosts.slice(0, 8);

      // 5. Generate Full SEO Article (STRICT 1,650+ words, 10 structured sections) via GPT-4o
      logger(`[SEO Autopilot] Generating exhaustive 1,650+ word SEO guide for "${activeService}" (${businessName})...`);

      const industryType = detectBusinessIndustry(businessName, activeService, candidateServices.join(" "));
      const isAstrology = industryType === "ASTROLOGY_SPIRITUALITY";

      let sectionOutline = "";
      if (isAstrology) {
        sectionOutline = `   - <h2>1. Evolution, Background & Sacred Foundations of ${activeService}</h2> (At least 170 words explaining historical roots, philosophical context, and relevance in 2026)
   - <h2>2. Core Foundations, Sacred Principles & Classical Texts</h2> (At least 180 words on fundamental concepts, energetic mechanics, and classical Shastras)
   - <h2>3. Comprehensive In-Depth Guide to ${activeService}</h2> (At least 200 words detailing practical methods, interpretive frameworks, and analytical procedures)
   - <h2>4. Specialized Nuances, Planetary Influences & Subtle Considerations</h2> (At least 180 words exploring dimensional subtleties, Nakshatra/planetary dynamics, and individual chart variables)
   - <h2>5. Practical Benefits, Spiritual Guidance & Life Impact</h2> (At least 180 words on real-world life alignment, psychological self-awareness, and transformative value)
   - <h2>6. Real-World Case Study & Transformational Journey</h2> (At least 220 words detailing an individual consultation scenario, karmic challenges faced, remedial approaches, and life transformation)
   - <h2>7. Step-by-Step Actionable Daily Guidance & Remedial Playbook</h2> (At least 220 words with structured practical disciplines, mantras/mindfulness, and conscious daily actions)
   - <h2>8. Common Mistakes, Misconceptions & Critical Pitfalls to Avoid</h2> (At least 200 words on fatalism, superstitions, common interpretive errors, and ethical precautions)
   - <h2>9. Frequently Asked Questions (FAQ)</h2> (Provide 5 detailed, high-impact questions specifically about ${activeService}, each answered with comprehensive multi-paragraph explanations of 100+ words, totaling 500+ words for this section)
   - <h2>10. Conclusion and Spiritual Roadmap for 2026</h2> (At least 150 words summary with clear, empowering guidance for seekers at ${businessName})`;
      } else {
        sectionOutline = `   - <h2>1. Evolution, Background & Modern Context of ${activeService}</h2> (At least 170 words across 2 detailed paragraphs explaining the fundamentals, history/modern development, and significance)
   - <h2>2. Core Foundations, Essential Principles & Methodologies</h2> (At least 180 words detailing key foundations, terminology, and mechanisms)
   - <h2>3. Comprehensive In-Depth Guide to ${activeService}</h2> (At least 200 words with actionable frameworks, methods, or detailed step-by-step procedures)
   - <h2>4. Specialized Nuances, Techniques & Advanced Considerations</h2> (At least 180 words detailing specific scenarios, nuances, and technical/practical depth)
   - <h2>5. Practical Benefits, Value & Tangible Outcomes</h2> (At least 180 words on real advantages, customer/client benefits, and outcomes)
   - <h2>6. Real-World Applications & Practical Case Study</h2> (At least 220 words detailing a real or representative scenario, practical application, and results)
   - <h2>7. Step-by-Step Actionable Checklist & Practical Playbook</h2> (At least 220 words with structured practical guidance for immediate action)
   - <h2>8. Common Mistakes, Misconceptions & Critical Pitfalls to Avoid</h2> (At least 200 words detailing common errors, myths, and how to fix or avoid them)
   - <h2>9. Frequently Asked Questions (FAQ)</h2> (Provide 5 detailed, high-impact questions specifically about ${activeService}, each answered with comprehensive multi-paragraph explanations of 100+ words, totaling 500+ words for this section)
   - <h2>10. Conclusion and Expert Recommendations</h2> (At least 150 words summary with clear guidance and invitation to learn more at ${businessName})`;
      }

      let internalLinkingPrompt = "";
      if (selectedInternalPosts.length > 0) {
        internalLinkingPrompt = `
4. MANDATORY INTERNAL HYPERLINKS (STRICT SPATIAL DISTRIBUTION - ZERO LINK DUMPING):
   CRITICAL MANDATE: You MUST embed 2 to 3 distinct internal hyperlinks to existing published blog articles from the catalog below, smoothly integrated into informative, explanatory sentences.

   STRICT RULES:
   - You may ONLY link to URLs explicitly in the APPROVED CATALOG below. NEVER invent a URL, and NEVER link to any external domain as an internal link.
   - Anchor Text Mandate: Integrate into natural, flowing sentences describing the content. NEVER use generic anchors like "Click Here" or "Website".

   APPROVED CATALOG OF EXISTING PUBLISHED ARTICLES (ONLY LINK TO THESE):
${selectedInternalPosts.map((p) => `   * Title: "${p.title}" | Link: <a href="${p.link}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${p.title}</a>`).join("\n")}`;
      } else {
        internalLinkingPrompt = `
4. INTERNAL HYPERLINKS INSTRUCTION:
   CRITICAL MANDATE: This website has NO prior published blog articles in its catalog yet.
   It is STRICTLY FORBIDDEN to invent, fabricate, or embed ANY internal hyperlinks. Do NOT create links to non-existent articles. Zero internal links permitted.`;
      }

      let externalLinksPrompt = "";
      if (isAstrology) {
        externalLinksPrompt = `
5. MANDATORY 3 TO 4 TOPIC-RELEVANT EXTERNAL AUTHORITY CITATIONS:
   CRITICAL INDUSTRY RELEVANCE MANDATE: This website is in the VEDIC ASTROLOGY, HOROSCOPY & SPIRITUALITY domain.
   - All external citations MUST be authentic cultural, encyclopedic, historical, or astronomical authorities (e.g., Encyclopaedia Britannica [https://www.britannica.com], Stanford Encyclopedia of Philosophy [https://plato.stanford.edu], Library of Congress [https://www.loc.gov], or academic research papers on classical Sanskrit and celestial studies).
   - STRICTLY FORBIDDEN: NEVER cite Search Engine Journal, Forbes, HubSpot, McKinsey, Gartner, Bain, or any digital marketing / tech / business consulting publications! This is an astrology website, NOT a marketing agency.
   - ZERO B2B MARKETING JARGON: NEVER mention "customer acquisition costs", "omnichannel funnels", "conversion tracking", "attribution modeling", or "ROI scaling". Write with deep reverence, philosophical depth, and classical astrological precision.`;
      } else {
        externalLinksPrompt = `
5. MANDATORY 4+ SCATTERED EXTERNAL AUTHORITY LINKS (STRICT SPATIAL DISTRIBUTION & TOPIC RELEVANCE):
   You MUST embed AT LEAST 4 authoritative, topic-relevant, non-competing external links.
   CRITICAL RELEVANCE MANDATE: All 4 external links MUST be directly relevant to "${activeService}" and the specific industry of ${businessName} (e.g., for healthcare/medical: ADA, PubMed, WHO, WebMD; for real estate: NAR, Zillow Research; for legal/finance: ABA, Bloomberg, SEC; for eCommerce/retail: NRF, Statista). NEVER use generic tech/SEO links for a healthcare, retail, astrology, or real estate business.`;
      }

      const systemPrompt = `You are an elite subject matter expert and authoritative journalist writing for ${businessName} (${siteUrl}).
Write an exhaustive, authoritative, 100% human-grade master guide focused specifically on "${activeService}".
${targetLocations ? `
TARGET GEOGRAPHIC MARKET MANDATE:
The business is specifically targeting clients and audiences in: "${targetLocations}".
- Deeply localize the analysis, market dynamics, regulatory landscape, consumer purchasing behavior, and regional industry context to these target countries/cities (${targetLocations}).
- Incorporate specific regional references naturally within case examples, economic statistics, and strategic playbooks (e.g. contrasting market speeds, local compliance, or consumer search patterns in ${targetLocations}).
` : ""}
CRITICAL LENGTH & DEPTH MANDATES:
1. STRICT WORD COUNT: Body content MUST BE AT LEAST 1,650 WORDS (target: 1,700 to 2,200 words). Any shallow summaries under 1,500 words are strictly unacceptable.
2. MANDATORY 10 SECTIONS (You MUST include ALL 10 of these exact <h2> sections with 2 to 3 detailed <h3> subsections each, tailored 100% to the subject matter of "${activeService}"):
${sectionOutline}

3. MANDATORY 8 TO 12 TARGET KEYWORD CLUSTER & ORGANIC DENSITY:
   - Generate and target a rich semantic keyword cluster of 8 to 12 distinct keywords directly relevant to "${activeService}":
     * 1 Primary Focus Keyword
     * 3 to 4 Secondary Commercial Intent Keywords
     * 4 to 7 Semantic LSI Variations and long-tail query phrases
   - NATURAL HIGH DENSITY USAGE (1.5% - 2.5%):
     * The Primary Keyword MUST appear in the title, in the first 100 words of the opening paragraph (bolded as <strong>primary keyword</strong>), in at least two <h2> or <h3> subheadings, and naturally 4 to 6 times across the body.
     * Each of the 7 to 11 Secondary and LSI keywords MUST be woven organically throughout the article sections (at least 2 to 4 times each).
     * NEVER stuff keywords robotically. Every keyword MUST be integrated in natural, fluent, syntactically correct English.
${internalLinkingPrompt}
${externalLinksPrompt}
   
   CRITICAL SPATIAL DISTRIBUTION RULE: External links MUST BE SCATTERED across different parts of the article. It is STRICTLY FORBIDDEN to clump them together or put them only in the last 2 paragraphs or conclusion.
   
   External Link Styling:
   Every external link MUST have target="_blank" rel="noopener noreferrer" and be styled in theme amber:
   <a href="URL" target="_blank" rel="noopener noreferrer" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">Descriptive Anchor Text</a>

6. FORMATTING & THEME:
   - Semantic HTML: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>.
   - DO NOT include <h1>, <html>, or <body> tags.
   - DO NOT generate a Table of Contents (the WordPress ez-toc plugin handles it).
   - Use dark mode callout boxes:
     <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-left: 4px solid #f59e0b; padding: 18px 24px; margin: 24px 0; border-radius: 8px; color: #f1f5f9;"><strong>Key Insight:</strong> [Detailed tactical recommendation]</div>

Format output as valid JSON:
{
  "title": "Clear High-CTR Title with Focus Keyword",
  "meta_title": "SEO Title (under 60 chars)",
  "meta_description": "Compelling meta description with call to action (under 160 chars)",
  "focus_keyword": "Primary keyword",
  "target_keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6", "keyword 7", "keyword 8"],
  "slug": "url-friendly-slug",
  "tags": ["Tag 1", "Tag 2", "Tag 3", "Tag 4", "Tag 5"],
  "content_html": "Full 1650+ word article formatted in semantic HTML with all 10 sections"
}`;

      const articleCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write the complete 1,650+ word deep-dive guide focused specifically on "${activeService}" for ${businessName} in 2026.` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 4096,
      });

      const parsedArticle = JSON.parse(articleCompletion.choices[0]?.message?.content || "{}");
      if (!parsedArticle.title || !parsedArticle.content_html) {
        throw new Error("Failed to generate complete SEO article content.");
      }

      // 6. Generate Bespoke Dual Images via gpt-image-2 (Hero + Mid-Content Diagram)
      logger(`[SEO Autopilot] Generating dual bespoke visuals via gpt-image-2 for "${parsedArticle.title}"...`);
      let featuredImageUrl = null;
      let midImageUrl = null;

      // Image 1: Hero Featured Image (Hierarchy: gpt-image-2 -> gpt-image-2-2026-04-21 -> gpt-image-1.5)
      const imageModels = ["gpt-image-2", "gpt-image-2-2026-04-21", "gpt-image-1.5"];
      // Construct industry-tailored visual prompts (Sacred Vedic geometry for astrology, clinical for medical, couture for fashion, etc.)
      const visualPrompts = getIndustryAdaptiveVisualPrompts(industryType, parsedArticle.title, activeService);
      const heroPrompt = visualPrompts.heroPrompt;

      let heroBuffer = null;
      for (const modelName of imageModels) {
        try {
          logger(`[SEO Autopilot] Generating hero visual (${industryType}) with ${modelName}...`);
          const heroRes = await openai.images.generate({
            model: modelName,
            prompt: heroPrompt,
            size: "1024x1024",
          });

          if (heroRes.data?.[0]?.b64_json) {
            heroBuffer = Buffer.from(heroRes.data[0].b64_json, "base64");
          } else if (heroRes.data?.[0]?.url) {
            const fetchRes = await fetch(heroRes.data[0].url);
            heroBuffer = Buffer.from(await fetchRes.arrayBuffer());
          }

          if (heroBuffer && heroBuffer.length > 0) {
            logger(`[SEO Autopilot] Successfully generated hero image via ${modelName}`);
            break;
          }
        } catch (imgErr) {
          logger(`[SEO Autopilot] Hero image gen with ${modelName} failed (${imgErr.message}), trying next approved model...`);
        }
      }

      if (heroBuffer) {
        const fileName = `wp_feat_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("instagram-creatives")
          .upload(fileName, heroBuffer, { contentType: "image/png", upsert: true });

        if (!uploadErr && uploadData) {
          const { data: pubUrlData } = supabase.storage.from("instagram-creatives").getPublicUrl(fileName);
          featuredImageUrl = pubUrlData.publicUrl;
          logger(`[SEO Autopilot] Featured hero image hosted: ${featuredImageUrl}`);
        }
      }

      // Image 2: Secondary Mid-Article Architecture Diagram / Infographic
      const midPrompt = visualPrompts.midPrompt;

      let midBuffer = null;
      for (const modelName of imageModels) {
        try {
          logger(`[SEO Autopilot] Generating mid-article diagram with ${modelName}...`);
          const midRes = await openai.images.generate({
            model: modelName,
            prompt: midPrompt,
            size: "1024x1024",
          });

          if (midRes.data?.[0]?.b64_json) {
            midBuffer = Buffer.from(midRes.data[0].b64_json, "base64");
          } else if (midRes.data?.[0]?.url) {
            const fetchRes = await fetch(midRes.data[0].url);
            midBuffer = Buffer.from(await fetchRes.arrayBuffer());
          }

          if (midBuffer && midBuffer.length > 0) {
            logger(`[SEO Autopilot] Successfully generated mid-article diagram via ${modelName}`);
            break;
          }
        } catch (midErr) {
          logger(`[SEO Autopilot] Mid-article diagram gen with ${modelName} failed (${midErr.message}), trying next approved model...`);
        }
      }

      if (midBuffer) {
        const midFileName = `wp_mid_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("instagram-creatives")
          .upload(midFileName, midBuffer, { contentType: "image/png", upsert: true });

        if (!uploadErr && uploadData) {
          const { data: pubUrlData } = supabase.storage.from("instagram-creatives").getPublicUrl(midFileName);
          midImageUrl = pubUrlData.publicUrl;
          logger(`[SEO Autopilot] Secondary mid-article diagram hosted: ${midImageUrl}`);
        }
      }

      // Inject Secondary Mid-Article Diagram Image into HTML content after section 2
      let finalContentHtml = parsedArticle.content_html;
      if (midImageUrl) {
        const midFigureHtml = `\n<figure class="gabbarinfo-mid-image" style="margin: 36px 0; text-align: center;">\n  <img src="${midImageUrl}" alt="${activeService} Strategy and Architecture Blueprint 2026" style="max-width: 100%; height: auto; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.4);" />\n  <figcaption style="font-size: 13px; color: #94a3b8; margin-top: 10px; font-style: italic;">Figure 1: Strategic Architecture & Execution Blueprint for ${activeService}</figcaption>\n</figure>\n`;
        if (finalContentHtml.includes("</h2>")) {
          const parts = finalContentHtml.split("</h2>");
          if (parts.length > 2) {
            parts[2] = parts[2] + midFigureHtml;
            finalContentHtml = parts.join("</h2>");
          } else {
            finalContentHtml = parts[0] + "</h2>" + midFigureHtml + parts.slice(1).join("</h2>");
          }
        } else {
          finalContentHtml = midFigureHtml + finalContentHtml;
        }
      }

      // Enforce spatial internal link distribution & remove any final-paragraph link dumps or hallucinated links
      finalContentHtml = enforceSpatialLinkDistribution(finalContentHtml, selectedInternalPosts, activeService, siteUrl);

      // Strict Content Sanity Check: Never publish an empty or truncated article
      const plainTextContent = finalContentHtml.replace(/<[^>]+>/g, "").trim();
      if (!plainTextContent || plainTextContent.length < 500 || (finalContentHtml.match(/<p/g) || []).length < 3) {
        logger(`[SEO Autopilot] CRITICAL: Generated article for "${activeService}" has insufficient text content (${plainTextContent.length} chars). Aborting publish to prevent corrupt empty blog.`);
        results.push({ email: item.email, status: "skipped", reason: "insufficient_content_length" });
        continue;
      }

      // 7. Publish Post to WordPress via Official Plugin Endpoint
      logger(`[SEO Autopilot] Publishing live post to ${siteUrl}/wp-json/gabbarinfo/v1/create-post...`);
      const wpPayload = {
        title: parsedArticle.title,
        content: finalContentHtml,
        slug: parsedArticle.slug,
        status: "publish",
        post_type: "post",
        featured_image_url: featuredImageUrl,
        featured_image_alt: parsedArticle.title,
        meta_title: parsedArticle.meta_title,
        meta_description: parsedArticle.meta_description,
        focus_keyword: parsedArticle.focus_keyword,
        tags: (Array.isArray(parsedArticle.tags) && parsedArticle.tags.length > 0)
          ? parsedArticle.tags
          : [parsedArticle.focus_keyword, targetBizKey].filter(Boolean),
      };

      const wpResp = await fetch(`${siteUrl}/wp-json/gabbarinfo/v1/create-post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${wpApiKey}`,
        },
        body: JSON.stringify(wpPayload),
      });

      const wpResult = await wpResp.json();
      if (!wpResp.ok || !wpResult.ok) {
        throw new Error(wpResult.message || `WordPress publish failed with HTTP ${wpResp.status}`);
      }

      const publishedPostId = wpResult.post_id || wpResult.id;
      const publishedPostUrl = wpResult.post_url || `${siteUrl}/${parsedArticle.slug}/`;
      logger(`[SEO Autopilot] Post published successfully to WordPress! ID: ${publishedPostId}, URL: ${publishedPostUrl}`);

      // 8. In-Process Social Media Syndication (Strict Brand Isolation for Facebook & Instagram)
      const socialShares = {};
      let activeMeta = null;

      // 1. Fetch all meta connections and pairings for this user
      const [brandMemsRes, bundlePairRes] = await Promise.all([
        supabase
          .from("agent_memory")
          .select("memory_type, content")
          .eq("email", item.email.trim())
          .like("memory_type", "meta_conn_%"),
        supabase
          .from("agent_memory")
          .select("content")
          .eq("email", item.email.trim())
          .in("memory_type", ["bundle_pairings", "brand_asset_pairings"])
          .maybeSingle(),
      ]);

      const brandProfiles = [];
      (brandMemsRes.data || []).forEach((m) => {
        try {
          const parsed = JSON.parse(m.content);
          brandProfiles.push({ key: (m.memory_type || "").replace(/^meta_conn_/, ""), ...parsed });
        } catch (_) {}
      });

      if (bundlePairRes.data?.content) {
        try {
          const pairList = JSON.parse(bundlePairRes.data.content);
          if (Array.isArray(pairList)) {
            pairList.forEach((p) => {
              if (p.pageId && !brandProfiles.some((b) => b.pageId === p.pageId)) {
                brandProfiles.push(p);
              }
            });
          }
        } catch (_) {}
      }

      const cleanSite = siteUrl.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
      const normBiz = (targetBizKey || normalizedBiz || "").toLowerCase().replace(/[^a-z0-9]/g, "");

      const matchedBrand = brandProfiles.find((b) => {
        const bKey = String(b.key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const bUrl = String(b.websiteUrl || b.website || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
        const bName = String(b.businessName || b.pageName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        return (normBiz && bKey && (normBiz === bKey || normBiz.includes(bKey) || bKey.includes(normBiz))) ||
               (cleanSite && bUrl && (cleanSite === bUrl || cleanSite.includes(bUrl) || bUrl.includes(cleanSite))) ||
               (normBiz && bName && (normBiz === bName || normBiz.includes(bName) || bName.includes(normBiz)));
      });

      if (matchedBrand && (matchedBrand.pageId || matchedBrand.igId)) {
        activeMeta = {
          fb_page_id: matchedBrand.pageId,
          fb_page_access_token: matchedBrand.pageToken || matchedBrand.fb_page_access_token,
          fb_user_access_token: matchedBrand.userToken || matchedBrand.fb_user_access_token,
          ig_business_id: matchedBrand.igId || matchedBrand.ig_business_id,
          instagram_actor_id: matchedBrand.igId || matchedBrand.instagram_actor_id,
        };
      }

      // 2. Fallback to default meta_connections ONLY if user has only 1 website and 0 custom brand profiles
      if (!activeMeta && brandProfiles.length === 0) {
        const { data: allWpSites } = await supabase
          .from("agent_memory")
          .select("memory_type")
          .eq("email", item.email.trim())
          .like("memory_type", "wp_conn_%");

        if (!allWpSites || allWpSites.length <= 1) {
          const { data: metaConn, error: metaErr } = await supabase
            .from("meta_connections")
            .select("fb_page_id, fb_page_access_token, fb_user_access_token, ig_business_id, instagram_actor_id")
            .ilike("email", item.email.trim())
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (metaErr) {
            logger(`[SEO Autopilot] Error querying meta_connections for ${item.email}: ${metaErr.message}`);
          }
          activeMeta = metaConn;
        }
      }

      if (!activeMeta) {
        logger(`[SEO Autopilot] Social syndication skipped: Website "${siteUrl}" has no verified paired Meta assets.`);
      }

      const metaConn = activeMeta;

      if (metaConn) {
        let pageToken = metaConn.fb_page_access_token;
        const userToken = metaConn.fb_user_access_token;
        const pageId = metaConn.fb_page_id ? metaConn.fb_page_id.split(",")[0].trim() : null;
        const igId = metaConn.ig_business_id || metaConn.instagram_actor_id;

        if (!pageToken && userToken && pageId) {
          try {
            const tokenResp = await fetch(`https://graph.facebook.com/v21.0/${pageId}?fields=access_token&access_token=${encodeURIComponent(userToken)}`);
            const tokenJson = await tokenResp.json();
            if (tokenJson?.access_token) {
              pageToken = tokenJson.access_token;
              // Persist valid page access token
              await supabase
                .from("meta_connections")
                .update({ fb_page_access_token: pageToken, updated_at: new Date().toISOString() })
                .eq("email", item.email.trim());
            }
          } catch (_) {}
        }
        const effectiveToken = pageToken || userToken;
        const geoTagline = targetLocations ? `📍 Geo Target: ${targetLocations}\n\n` : "";
        const geoHashtags = targetLocations
          ? " " + targetLocations.split(",").map((l) => `#${l.trim().replace(/[^a-zA-Z0-9]/g, "")}`).filter((h) => h.length > 2).slice(0, 4).join(" ")
          : "";

        // FACEBOOK: Interactive Clickable Link Card with Photo Fallback
        const shouldShareFacebook = config.autoShareFacebook !== false && pageId && effectiveToken;
        if (shouldShareFacebook) {
          try {
            logger(`[SEO Autopilot] Syndicating Clickable Link Card to Facebook Page (${pageId})...`);
            const feedParams = new URLSearchParams();
            feedParams.append("link", publishedPostUrl);
            feedParams.append("message", `📢 ${parsedArticle.title}\n\n${geoTagline}${parsedArticle.meta_description || ""}\n\nRead full article here 👇\n${publishedPostUrl}\n\n#${activeService.replace(/[^a-zA-Z0-9]/g, "")} #SEO #DigitalMarketing${geoHashtags}`);
            feedParams.append("access_token", effectiveToken);

            const fbRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
              method: "POST",
              body: feedParams,
            });
            const fbData = await fbRes.json();
            if (fbData.id) {
              socialShares.facebook = { ok: true, id: fbData.id };
              logger(`[SEO Autopilot] Facebook Link Card published: ${fbData.id}`);
            } else {
              // Fallback to photo post if link feed failed
              const shareImg = featuredImageUrl || midImageUrl;
              if (shareImg) {
                const photoParams = new URLSearchParams();
                photoParams.append("url", shareImg);
                photoParams.append("caption", `📢 ${parsedArticle.title}\n\n${geoTagline}${parsedArticle.meta_description || ""}\n\nRead full article here 👇\n${publishedPostUrl}\n\n#${activeService.replace(/[^a-zA-Z0-9]/g, "")} #SEO #DigitalMarketing${geoHashtags}`);
                photoParams.append("access_token", effectiveToken);
                const fbPhotoRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, { method: "POST", body: photoParams });
                const fbPhotoData = await fbPhotoRes.json();
                socialShares.facebook = { ok: !!(fbPhotoData.id), id: fbPhotoData.id || null, error: fbData.error?.message };
              } else {
                socialShares.facebook = { ok: false, error: fbData.error?.message };
              }
            }
          } catch (fbErr) {
            socialShares.facebook = { ok: false, error: fbErr.message };
            logger("[SEO Autopilot] Facebook syndication network error:", fbErr.message);
          }
        }

        // INSTAGRAM: Featured image with title, description, link/bio, and hashtags
        const shouldShareInstagram = config.autoShareInstagram !== false && igId && effectiveToken && featuredImageUrl;
        if (shouldShareInstagram) {
          try {
            logger(`[SEO Autopilot] Syndicating Featured Image to Instagram (${igId})...`);
            const igCaption = [
              `📢 ${parsedArticle.title}`,
              "",
              geoTagline ? geoTagline.trim() : "",
              parsedArticle.meta_description || "",
              "",
              `🔗 Full article: ${publishedPostUrl}`,
              "",
              `#${activeService.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()} #SEO #ContentMarketing #BusinessGrowth #DigitalStrategy${geoHashtags}`
            ].filter(Boolean).join("\n");

            const verifiedIgUrl = await ensureInstagramCompatibleJpeg({
              imageUrl: featuredImageUrl,
              imageBuffer: featuredBuffer,
              supabase,
              logger,
            });

            const containerParams = new URLSearchParams();
            containerParams.append("image_url", verifiedIgUrl);
            containerParams.append("caption", igCaption);
            containerParams.append("access_token", effectiveToken);

            const igContainerRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media`, { method: "POST", body: containerParams });
            const containerData = await igContainerRes.json();

            if (containerData.id) {
              const creationId = containerData.id;
              let isReady = false;
              for (let attempt = 0; attempt < 12; attempt++) {
                await new Promise((resolve) => setTimeout(resolve, 2500));
                const statusRes = await fetch(`https://graph.facebook.com/v21.0/${creationId}?fields=status_code,status&access_token=${effectiveToken}`);
                const statusJson = await statusRes.json().catch(() => ({}));
                if (statusJson.status_code === "FINISHED") {
                  isReady = true;
                  break;
                }
                if (statusJson.status_code === "ERROR") {
                  logger(`[SEO Autopilot] Instagram media processing error: ${statusJson.status || "Unknown"}`);
                  break;
                }
              }

              if (isReady) {
                const pubParams = new URLSearchParams();
                pubParams.append("creation_id", creationId);
                pubParams.append("access_token", effectiveToken);

                const igPubRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media_publish`, { method: "POST", body: pubParams });
                const pubData = await igPubRes.json();
                socialShares.instagram = { ok: !!pubData.id, id: pubData.id || null };
                logger(`[SEO Autopilot] Instagram post published: ${pubData.id}`);
              } else {
                socialShares.instagram = { ok: false, error: "Instagram media container was not ready in time." };
                logger("[SEO Autopilot] Instagram container timed out or errored before publish.");
              }
            }
          } catch (igErr) {
            socialShares.instagram = { ok: false, error: igErr.message };
            logger("[SEO Autopilot] Instagram syndication error:", igErr.message);
          }
        }
      }

      // 9. Persist updated memory state to Supabase
      config.lastPublishedAt = now.toISOString();
      config.lastPublishedTitle = parsedArticle.title;
      config.lastPublishedUrl = publishedPostUrl;
      config.lastPublishedPostId = publishedPostId;
      config.lastServiceIndex = nextIndex;
      config.publishedCount = (Number(config.publishedCount) || 0) + 1;
      config.publishedTopics = config.publishedTopics || [];
      config.publishedTopics.push(parsedArticle.title);
      if (config.publishedTopics.length > 30) config.publishedTopics.shift();

      await supabase
        .from("agent_memory")
        .update({
          content: JSON.stringify(config),
          updated_at: now.toISOString(),
        })
        .eq("email", item.email)
        .eq("memory_type", item.memory_type);

      logger(`[SEO Autopilot] Memory updated for ${item.email}. Published count: ${config.publishedCount}`);

      results.push({
        email: item.email,
        business: businessName,
        title: parsedArticle.title,
        postUrl: publishedPostUrl,
        postId: publishedPostId,
        status: "published",
        socialShares,
      });
    } catch (userErr) {
      logger(`[SEO Autopilot] Error processing ${item.email}:`, userErr.message);
      results.push({ email: item.email, status: "error", error: userErr.message });
    }
  }

  logger(`[SEO Autopilot] Completed cycle. Processed ${results.length} accounts.`);
  return results;
}

module.exports = {
  runSeoAutopilotCycle,
  isLegitimateService,
};
