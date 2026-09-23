// pages/api/wordpress/generate-blog.js
import { getServerSession } from "next-auth/next";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { verifyEntitlement, verifyEntitlementByEmail, FEATURES } from "../../../lib/auth/entitlements.js";
import { reserveCredits, releaseCredits } from "../../../lib/billing/credit-meter.js";
import { checkRateLimit } from "../../../lib/middleware/rate-limiter.js";
import { generatePlatformGraphic } from "../../../lib/services/image-service.js";
import { reserveQuota, commitQuota, releaseQuota } from "../../../lib/billing/quota-service.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function detectBusinessIndustry(businessName = "", topic = "", services = "", industry = "") {
  const combined = `${businessName} ${topic} ${services} ${industry}`.toLowerCase();
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

function sanitizeBlogHtmlAndLinks(contentHtml, catalogPosts = [], activeService = "Our Services", siteUrl = "") {
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
      const isApproved = approvedInternalUrls.size === 0 || Array.from(approvedInternalUrls).some(u => normalizedHref === u || normalizedHref.endsWith(u.replace(/^https?:\/\/[^\/]+/, "")) || u.includes(normalizedHref));
      if (!isApproved && approvedInternalUrls.size > 0) {
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

function ensureRichLinks(contentHtml, {
  siteUrl = "",
  catalogPosts = [],
  industryType = "GENERAL_BUSINESS",
  activeService = "Our Services",
  businessName = "Our Company"
} = {}) {
  if (!contentHtml) return contentHtml;
  let html = contentHtml;

  const cleanSiteUrl = (siteUrl || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

  // 1. Detect existing internal & external links
  const linkMatches = html.match(/<a\s+[^>]*href=["'](?:https?:\/\/[^"']*|\/[^"']*)["'][^>]*>[\s\S]*?<\/a>/gi) || [];
  let existingInternalCount = 0;
  let existingExternalCount = 0;

  linkMatches.forEach((tag) => {
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (hrefMatch && hrefMatch[1]) {
      const href = hrefMatch[1].toLowerCase();
      if ((cleanSiteUrl && href.includes(cleanSiteUrl)) || href.startsWith("/")) {
        existingInternalCount++;
      } else if (href.startsWith("http")) {
        existingExternalCount++;
      }
    }
  });

  // 2. Target: 2-3 Internal Links
  const targetInternal = 3;
  let targets = (Array.isArray(catalogPosts) ? catalogPosts : []).filter(p => p && p.link && p.title);
  if (targets.length === 0 && siteUrl) {
    targets = [
      { title: `${businessName} Homepage`, link: `${siteUrl}/`, slug: "" },
      { title: `${businessName} Services & Guidance`, link: `${siteUrl}/services/`, slug: "services" },
      { title: `Contact ${businessName}`, link: `${siteUrl}/contact/`, slug: "contact" }
    ];
  }

  if (existingInternalCount < targetInternal && targets.length > 0) {
    const pMatches = [...html.matchAll(/<p>([\s\S]*?)<\/p>/gi)];
    let injected = existingInternalCount;

    let internalTemplates;
    if (industryType === "ASTROLOGY_SPIRITUALITY") {
      internalTemplates = [
        (url, title) => ` For deeper guidance and cosmic insights, explore our comprehensive reading on <a href="${url}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${title}</a>.`,
        (url, title) => ` Seekers exploring related energetic dynamics should also consult our detailed analysis on <a href="${url}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${title}</a>.`,
        (url, title) => ` To further understand your life path and classical planetary influences, review our guide on <a href="${url}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${title}</a>.`
      ];
    } else if (industryType === "FASHION_RETAIL") {
      internalTemplates = [
        (url, title) => ` To discover complementary style recommendations and trend analysis, explore our feature on <a href="${url}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${title}</a>.`,
        (url, title) => ` Explore related design aesthetics and seasonal collections in our guide on <a href="${url}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${title}</a>.`,
        (url, title) => ` For complete bridal and wardrobe curation, review our spotlight on <a href="${url}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${title}</a>.`
      ];
    } else if (industryType === "HEALTHCARE_WELLNESS") {
      internalTemplates = [
        (url, title) => ` For additional clinical context and patient wellness guidance, read our detailed overview on <a href="${url}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${title}</a>.`,
        (url, title) => ` Explore related health protocols and therapeutic approaches in our article on <a href="${url}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${title}</a>.`,
        (url, title) => ` Learn more about proactive treatment regimens by consulting our guide on <a href="${url}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${title}</a>.`
      ];
    } else {
      internalTemplates = [
        (url, title) => ` For an in-depth perspective on related strategic execution, explore our comprehensive guide on <a href="${url}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${title}</a>.`,
        (url, title) => ` To discover complementary frameworks and practical approaches, review our analysis on <a href="${url}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${title}</a>.`,
        (url, title) => ` Organizations seeking sustained competitive performance should also examine our guide on <a href="${url}" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">${title}</a>.`
      ];
    }

    const candidatePIndexes = [2, 6, 11, 4, 8, 14];
    for (const pIdx of candidatePIndexes) {
      if (injected >= targetInternal) break;
      if (pIdx < pMatches.length) {
        const fullP = pMatches[pIdx][0];
        const innerP = pMatches[pIdx][1];
        if (!innerP.includes("<a ") && innerP.length > 100 && !innerP.includes("Disclaimer")) {
          const targetItem = targets[injected % targets.length];
          const anchorPhrase = targetItem.title.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
          const template = internalTemplates[injected % internalTemplates.length];
          const linkHtml = template(targetItem.link, anchorPhrase);
          html = html.replace(fullP, `<p>${innerP.trim()}${linkHtml}</p>`);
          injected++;
        }
      }
    }
  }

  // 3. Target: 3-4 External Authority Citations
  const targetExternal = 4;
  const authorityLibrary = {
    DIGITAL_TECH_MARKETING: [
      { name: "Google Search Central documentation", url: "https://developers.google.com/search/docs" },
      { name: "Search Engine Journal best practices", url: "https://www.searchenginejournal.com" },
      { name: "Moz SEO Learning Center", url: "https://moz.com/learn/seo" },
      { name: "W3C Web Standards", url: "https://www.w3.org" }
    ],
    ASTROLOGY_SPIRITUALITY: [
      { name: "Encyclopaedia Britannica historical research", url: "https://www.britannica.com/topic/astrology" },
      { name: "Stanford Encyclopedia of Philosophy", url: "https://plato.stanford.edu" },
      { name: "Library of Congress archival collections", url: "https://www.loc.gov" },
      { name: "Oxford Reference classical studies", url: "https://www.oxfordreference.com" }
    ],
    FASHION_RETAIL: [
      { name: "National Retail Federation analysis", url: "https://nrf.com" },
      { name: "Vogue luxury fashion industry reporting", url: "https://www.vogue.com" },
      { name: "Brides editorial style guide", url: "https://www.brides.com" },
      { name: "Statista consumer market insights", url: "https://www.statista.com" }
    ],
    HEALTHCARE_WELLNESS: [
      { name: "World Health Organization standards", url: "https://www.who.int" },
      { name: "PubMed Central scientific studies", url: "https://pubmed.ncbi.nlm.nih.gov" },
      { name: "Mayo Clinic health and wellness guidance", url: "https://www.mayoclinic.org" },
      { name: "National Institutes of Health research", url: "https://www.nih.gov" }
    ],
    LEGAL_PROFESSIONAL: [
      { name: "American Bar Association legal frameworks", url: "https://www.americanbar.org" },
      { name: "Bloomberg Law business insights", url: "https://news.bloomberglaw.com" },
      { name: "Harvard Law School legal commentary", url: "https://hls.harvard.edu" },
      { name: "Legal Information Institute", url: "https://www.law.cornell.edu" }
    ],
    GENERAL_BUSINESS: [
      { name: "Harvard Business Review strategic analysis", url: "https://hbr.org" },
      { name: "Statista commercial intelligence", url: "https://www.statista.com" },
      { name: "MIT Sloan Management Review", url: "https://sloanreview.mit.edu" },
      { name: "World Economic Forum research", url: "https://www.weforum.org" }
    ]
  };

  const selectedAuthorities = authorityLibrary[industryType] || authorityLibrary.GENERAL_BUSINESS;

  if (existingExternalCount < targetExternal && selectedAuthorities.length > 0) {
    const pMatches = [...html.matchAll(/<p>([\s\S]*?)<\/p>/gi)];
    let extInjected = existingExternalCount;

    let externalTemplates;
    if (industryType === "ASTROLOGY_SPIRITUALITY") {
      externalTemplates = [
        (url, name) => ` Scholarly research and documented classical archives on this tradition are cataloged by <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">${name}</a>.`,
        (url, name) => ` Historical manuscripts and philosophical foundations are extensively referenced in <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">${name}</a>.`,
        (url, name) => ` For academic perspectives and cross-cultural lineage documentation, consult <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">${name}</a>.`,
        (url, name) => ` Comparative historical records and foundational treatises can be examined through <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">${name}</a>.`
      ];
    } else {
      externalTemplates = [
        (url, name) => ` Industry benchmark data and comparative frameworks from <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">${name}</a> reaffirm the critical value of systematic execution.`,
        (url, name) => ` Empirical studies and authoritative industry methodologies are documented extensively by <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">${name}</a>.`,
        (url, name) => ` For detailed global standards and foundational research, consult the comprehensive guidance published by <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">${name}</a>.`,
        (url, name) => ` Analytical data and long-term sector trend analysis can be further evaluated through <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">${name}</a>.`
      ];
    }

    const candidateExtIndexes = [1, 5, 9, 13, 3, 7];
    for (const pIdx of candidateExtIndexes) {
      if (extInjected >= targetExternal) break;
      if (pIdx < pMatches.length) {
        const fullP = pMatches[pIdx][0];
        const innerP = pMatches[pIdx][1];
        if (!innerP.includes("<a ") && innerP.length > 100 && !innerP.includes("Disclaimer")) {
          const auth = selectedAuthorities[extInjected % selectedAuthorities.length];
          const template = externalTemplates[extInjected % externalTemplates.length];
          const citationHtml = template(auth.url, auth.name);
          html = html.replace(fullP, `<p>${innerP.trim()}${citationHtml}</p>`);
          extInjected++;
        }
      }
    }
  }

  return html;
}

/**
 * High-performance, atomic blog generation and WordPress publishing function.
 * Designed for both interactive dashboard usage and in-process autonomous autopilot execution.
 */
export async function executeBlogGeneration({
  userEmail,
  session = null,
  businessName = "",
  businessId = null,
  topic,
  targetMarket,
  city,
  targetLocations,
  targetKeywords = [],
  brandVoice = "authoritative, engaging, and consultative",
  industry = "",
  publishStatus = "publish",
  crossPostSocial = false,
  wordCount: requestedWordCount = 1500,
  isAutopilot = false,
  model = null,
}) {
  if (!userEmail) {
    return { ok: false, status: 401, error: "Unauthorized: User email required" };
  }

  let quotaRes = null;
  let reservation = null;

  try {
    // 1. Rate Limiting Gate
    const rateCheck = checkRateLimit(userEmail, "BLOG_GEN", 10, 60000);
    if (!rateCheck.allowed && !isAutopilot) {
      return {
        ok: false,
        status: 429,
        error: `Too many blog requests. Please wait ${Math.ceil(rateCheck.resetInMs / 1000)} seconds.`,
      };
    }

    const wordCount = Math.max(Number(requestedWordCount) || 1500, 1500);

    if (!topic) {
      return { ok: false, status: 400, error: "Blog topic is required" };
    }
    const normalizedBusiness = (businessName || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "_");
    const memoryKey = normalizedBusiness ? `wp_conn_${normalizedBusiness}` : null;

    let targetMem = null;
    if (memoryKey) {
      const { data: mem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail)
        .in("memory_type", [memoryKey, "wordpress_connection"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      targetMem = mem;
    }

    if (!targetMem?.content) {
      const { data: fallbackMem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail)
        .or("memory_type.like.wp_conn_%,memory_type.eq.wordpress_connection")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      targetMem = fallbackMem;
    }

    if (!targetMem?.content) {
      return {
        ok: false,
        status: 400,
        error: businessName && businessName !== "GABBARinfo"
          ? `No connected WordPress website found for "${businessName}". Please connect your website in the WordPress Connector first.`
          : `No connected WordPress website found. Please connect your WordPress website in the WordPress Connector first.`,
      };
    }

    let conn = {};
    try {
      conn = JSON.parse(targetMem.content);
    } catch (_) {
      conn = {};
    }
    const siteUrl = conn.siteUrl;
    const wpApiKey = conn.apiKey;
    const effectiveBusiness = businessName || conn.businessName || conn.siteName || "Our Business";

    // 2. Parallel Pre-Flight: Entitlement & Service Quota Gate + Client Profile Memory Fetch
    const [quotaResResult, clientMemRes] = await Promise.all([
      reserveQuota({
        session,
        userEmail,
        businessId,
        actionType: "SEO_ARTICLE",
        assetId: siteUrl,
      }),
      (async () => {
        try {
          return await supabase
            .from("agent_memory")
            .select("content")
            .eq("email", userEmail)
            .eq("memory_type", "client")
            .maybeSingle();
        } catch (e) {
          return { data: null };
        }
      })(),
    ]);

    quotaRes = quotaResResult;

    if (!quotaRes.ok) {
      return {
        ok: false,
        status: quotaRes.code === "FEATURE_NOT_INCLUDED" ? 403 : 402,
        code: quotaRes.code,
        error: quotaRes.error,
        planId: quotaRes.planId,
        nextResetDate: quotaRes.nextResetDate,
      };
    }

    // 3. Server-Side Atomic Credit Reservation (Internal Accounting)
    reservation = await reserveCredits({
      businessId: quotaRes.businessId || businessId || "default_business",
      userEmail,
      actionType: "SEO_BLOG",
      referenceId: topic.substring(0, 40),
    });

    if (!reservation.ok) {
      await releaseQuota({
        reservationId: quotaRes.reservationId,
        businessId: quotaRes.businessId,
        cycleStart: quotaRes.cycleStart,
        actionType: "SEO_ARTICLE",
        reason: "Credit reservation failure",
      });
      return {
        ok: false,
        status: 402,
        error: reservation.error || "Insufficient internal credits to execute blog generation.",
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { ok: false, status: 500, error: "OpenAI API key missing in environment" };
    }

    const openai = new OpenAI({ apiKey });

    // 4. Resolve Target Market / Location / Services from Client Memory
    let businessLocation = (targetLocations || targetMarket || city || "").trim();
    let businessServices = "";
    if (clientMemRes?.data?.content) {
      try {
        const parsed = JSON.parse(clientMemRes.data.content);
        const answers = parsed?.business_answers?.[businessName] || parsed?.business_answers?.["default_business"] || parsed || {};
        if (!businessLocation) {
          businessLocation = answers.target_market || answers.location || answers.country || answers.city || "";
        }
        businessServices = answers.service || answers.services || "";
      } catch (e) {
        console.warn("Could not parse client location/service memory:", e.message);
      }
    }
    if (!businessLocation) {
      businessLocation = "National & Global Commercial";
    }

    // 5. Fetch existing published posts for Authentic Contextual Internal Linking (ALWAYS run, <200ms)
    let existingPublishedPosts = [];
    let existingPublishedPages = [];
    try {
      const wpReqHeaders = {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 GabbarInfo/1.0",
      };
      if (wpApiKey) {
        wpReqHeaders.Authorization = `Bearer ${wpApiKey}`;
      }

      const [postsResp, pagesResp] = await Promise.all([
        fetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=20&_fields=id,title,slug,link`, { headers: wpReqHeaders }),
        fetch(`${siteUrl}/wp-json/wp/v2/pages?per_page=15&_fields=id,title,slug,link`, { headers: wpReqHeaders })
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
      console.warn("Could not pre-fetch existing content for internal linking:", e.message);
    }

    const offTopicFilter = /santa|christmas|herbal-beauty/i;
    const relevantPublishedPosts = existingPublishedPosts.filter(p => !offTopicFilter.test(p.slug || p.title));
    const relevantPublishedPages = existingPublishedPages.filter(p => !/sample-page|privacy|terms|cart|checkout|my-account/i.test(p.slug || p.title));

    let candidateInternalLinks = [...relevantPublishedPosts, ...relevantPublishedPages];
    if (candidateInternalLinks.length === 0 && siteUrl) {
      candidateInternalLinks = [
        { title: `${effectiveBusiness} Core Services`, link: `${siteUrl}/services/`, slug: "services" },
        { title: `${effectiveBusiness} Official Homepage`, link: `${siteUrl}/`, slug: "" },
        { title: `Contact ${effectiveBusiness}`, link: `${siteUrl}/contact/`, slug: "contact" },
        { title: `About ${effectiveBusiness}`, link: `${siteUrl}/about/`, slug: "about" },
      ];
    }
    const selectedInternalPosts = candidateInternalLinks.slice(0, 10);

    const keywordList = Array.isArray(targetKeywords)
      ? targetKeywords.filter(Boolean).join(", ")
      : String(targetKeywords || "").trim();

    // 6. Generate High-Ranking Blog Content & SEO Payload with GPT
    console.log(`[SEO Engine] Generating full ${wordCount}-word authority guide on "${topic}" for ${effectiveBusiness}...`);

    const industryType = detectBusinessIndustry(effectiveBusiness, topic, businessServices, industry);
    const isAstrology = industryType === "ASTROLOGY_SPIRITUALITY";

    let sectionOutline = "";
    if (isAstrology) {
      sectionOutline = `   - <h2>1. Evolution, Background & Sacred Foundations of ${topic}</h2> (At least 170 words explaining historical roots, philosophical context, and relevance in 2026)
   - <h2>2. Core Foundations, Sacred Principles & Classical Texts</h2> (At least 180 words on fundamental concepts, energetic mechanics, and classical Shastras)
   - <h2>3. Comprehensive In-Depth Guide to ${topic}</h2> (At least 200 words detailing practical methods, interpretive frameworks, and analytical procedures)
   - <h2>4. Specialized Nuances, Planetary Influences & Subtle Considerations</h2> (At least 180 words exploring dimensional subtleties, Nakshatra/planetary dynamics, and individual chart variables)
   - <h2>5. Practical Benefits, Spiritual Guidance & Life Impact</h2> (At least 180 words on real-world life alignment, psychological self-awareness, and transformative value)
   - <h2>6. Real-World Case Study & Transformational Journey</h2> (At least 220 words detailing an individual consultation scenario, karmic challenges faced, remedial approaches, and life transformation)
   - <h2>7. Step-by-Step Actionable Daily Guidance & Remedial Playbook</h2> (At least 220 words with structured practical disciplines, mantras/mindfulness, and conscious daily actions)
   - <h2>8. Common Mistakes, Misconceptions & Critical Pitfalls to Avoid</h2> (At least 200 words on fatalism, superstitions, common interpretive errors, and ethical precautions)
   - <h2>9. Frequently Asked Questions (FAQ)</h2> (Provide 5 detailed, high-impact questions specifically about ${topic}, each answered with comprehensive multi-paragraph explanations of 100+ words, totaling 500+ words for this section)
   - <h2>10. Conclusion and Spiritual Roadmap for 2026</h2> (At least 150 words summary with clear, empowering guidance for seekers at ${effectiveBusiness})`;
    } else {
      sectionOutline = `   - <h2>1. The Strategic Evolution of ${topic} in 2026</h2> (At least 160 words across 2 detailed paragraphs exploring the modern landscape)
   - <h2>2. Core Foundations, Strategic Principles & Key Frameworks</h2> (At least 180 words detailing key methodologies, audience targeting, and fundamental mechanics)
   - <h2>3. Comprehensive Guide & Practical Procedures</h2> (At least 180 words with actionable structural frameworks and optimization formulas)
   - <h2>4. Technical Infrastructure & Operational Mastery</h2> (At least 160 words detailing measurement, best practices, and accuracy)
   - <h2>5. Practical Benefits, Growth & Customer Value</h2> (At least 180 words on synergy and real-world outcomes)
   - <h2>6. In-Depth Real-World Case Study & Application</h2> (At least 220 words detailing baseline metrics, implementation timeline, and gains)
   - <h2>7. Step-by-Step 90-Day Execution Playbook</h2> (At least 200 words with Month 1, Month 2, Month 3 actionable milestones)
   - <h2>8. 5 Critical Pitfalls & Costly Mistakes to Avoid</h2> (At least 180 words detailing common misconceptions and operational fixes in ${topic})
   - <h2>9. Frequently Asked Questions (FAQ)</h2> (Provide 5 high-impact questions specifically about ${topic}, each answered with comprehensive multi-paragraph explanations of 100+ words, totaling 500+ words for this section)
   - <h2>10. Strategic Conclusion and Actionable Roadmap for 2026</h2> (At least 140 words summary with a clear commercial call to action for ${effectiveBusiness})`;
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
   CRITICAL RELEVANCE MANDATE: All 4 external links MUST be directly relevant to "${topic}" and the specific industry of ${effectiveBusiness} (e.g., for healthcare/medical: ADA, PubMed, WHO, WebMD; for real estate: NAR, Zillow Research; for legal/finance: ABA, Bloomberg, SEC; for eCommerce/retail: NRF, Statista). NEVER use generic tech/SEO links for a healthcare, retail, astrology, or real estate business.`;
    }

    const systemPrompt = `You are an elite subject matter expert and authoritative journalist writing for ${effectiveBusiness} (${siteUrl}).
Write an exhaustive, authoritative, 100% human-grade master guide focused specifically on "${topic}".
${businessLocation && businessLocation !== "National & Global Commercial" ? `
TARGET GEOGRAPHIC MARKET MANDATE:
The business is specifically targeting clients and audiences in: "${businessLocation}".
- Deeply localize the analysis, market dynamics, regulatory landscape, consumer purchasing behavior, and regional industry context to these target countries/cities (${businessLocation}).
- Incorporate specific regional references naturally within case examples, economic statistics, and strategic playbooks (e.g. contrasting market speeds, local compliance, or consumer search patterns in ${businessLocation}).
` : ""}
CRITICAL TOPIC FIDELITY MANDATE:
- Focus 100% strictly and specifically on the nuances, mechanics, and strategies of "${topic}".
${!isTopicSeo ? `- DO NOT divert into generic SEO, search engine indexing, or Core Web Vitals. Address the actual domain of "${topic}" directly.` : ""}

CRITICAL LENGTH & DEPTH MANDATES:
1. STRICT WORD COUNT: Body content MUST exceed 1600 words (target: 1650 to 2000 words). Writing less than 1500 words is strictly unacceptable.
2. MANDATORY EXHAUSTIVE SECTIONS (You MUST include ALL 10 of these exact <h2> sections with 2 to 3 detailed <h3> subsections each):
${sectionOutline}

3. MANDATORY 8 TO 12 TARGET KEYWORD CLUSTER & ORGANIC DENSITY:
   - Generate and target a rich semantic keyword cluster of 8 to 12 distinct keywords directly relevant to "${topic}":
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

5. FORMATTING & BRAND THEME MANDATES:
   - Use semantic HTML: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>.
   - DO NOT include <h1>, <html>, or <body> tags.
   - STRICTLY DO NOT generate any Table of Contents (TOC), as the site's WordPress ez-toc plugin automatically creates it dynamically.
   - THEME COLORS: This site uses a sleek dark theme with signature gold/amber yellow accents (#f59e0b).
     - All embedded hyperlinks MUST use theme amber/yellow: <a href="URL" style="color: #f59e0b; font-weight: 700; text-decoration: underline;">anchor text</a>. NEVER use blue or #0284c7.
     - NEVER use light, white, or light gray backgrounds in any boxes or callouts!
     - Any callouts or takeaways must use dark mode styling: style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-left: 4px solid #f59e0b; padding: 18px 24px; margin: 24px 0; border-radius: 8px; color: #f1f5f9;"

6. OUTPUT FORMAT:
   - Output MUST be strictly valid JSON matching the schema:
   {
     "title": "Compelling, high-ranking blog title",
     "slug": "keyword-rich-url-slug",
     "meta_title": "SEO Meta Title (max 60 chars)",
     "meta_description": "SEO Meta Description (max 155 chars)",
     "focus_keyword": "Primary target keyword",
     "target_keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6", "keyword 7", "keyword 8"],
     "secondary_keywords": ["keyword 2", "keyword 3"],
     "tags": ["SEO Optimization", "Digital Marketing", "Business Growth"],
     "html_content": "Full HTML content strictly 1600+ words with all 10 sections"
   }`;

    const userPrompt = `Business: ${effectiveBusiness}
Target Market / Scope: ${businessLocation}
Core Services / Industry: ${businessServices || industry || "Commercial Services"}
Brand Voice: ${brandVoice}
Blog Topic / Headline: ${topic}
${keywordList ? `Target Ranked Keywords: ${keywordList}` : "Keywords: Automatically target high-volume commercial and topical ranking phrases."}
MANDATORY MINIMUM WORD COUNT: Strictly 1600+ Words across all 10 detailed sections.`;

    // Multi-model AI Image Generator Helper powered by central ImageService
    const generateAiVisual = async (promptText, label = "visual", imageSize = "1024x1024") => {
      try {
        const isWidescreen = imageSize === "1792x1024";
        const result = await generatePlatformGraphic({
          prompt: promptText,
          businessId: businessId || "default_business",
          userEmail,
          aspectRatio: isWidescreen ? "16:9" : "1:1",
          customSize: imageSize,
          actionType: label === "featured" ? "SEO_HERO" : "SEO_MID",
          meterCredits: false, // Credits already reserved at handler root
          persistInSupabase: true,
        });

        if (result?.ok && result.imageUrl) {
          console.log(`[SEO Engine] Successfully generated ${label} visual via central image service: ${result.imageUrl}`);
          return result.imageUrl;
        }
      } catch (imgErr) {
        console.warn(`[SEO Engine] Central image service failed for ${label}:`, imgErr.message);
      }

      // High-resolution commercial stock photography fallback (Pexels) - authentic, zero watermarks
      if (process.env.PEXELS_API_KEY) {
        try {
          const serviceTerm = focusKeyword || (targetKeywords && targetKeywords[0]) || "digital marketing analytics";
          const searchQuery = encodeURIComponent(`${serviceTerm} office analytics`.slice(0, 45));
          const pexRes = await fetch(`https://api.pexels.com/v1/search?query=${searchQuery}&per_page=5&orientation=${imageSize === "1792x1024" ? "landscape" : "square"}`, {
            headers: { Authorization: process.env.PEXELS_API_KEY }
          });
          if (pexRes.ok) {
            const pexData = await pexRes.json();
            const photo = pexData.photos?.[label === "featured" ? 0 : 1] || pexData.photos?.[0];
            if (photo?.src?.large2x || photo?.src?.large) {
              const photoUrl = photo.src.large2x || photo.src.large;
              console.log(`[SEO Engine] Pexels visual fallback acquired for ${label}: ${photoUrl}`);
              return photoUrl;
            }
          }
        } catch (pexErr) {
          console.warn("[SEO Engine] Pexels fallback warning:", pexErr.message);
        }
      }

      return null;
    };

    // For autonomous autopilot cycles, prioritize high-velocity model (gpt-4o-mini) to stay well within 60s Vercel limit
    const blogModel = model || (isAutopilot ? "gpt-4o-mini" : (process.env.AI_BLOG_MODEL || "gpt-4o-mini"));

    // Industry-tailored bespoke visual prompts constructed dynamically (Sacred geometry for astrology, clinical for medical, couture for fashion, etc.)
    const detectedInd = detectBusinessIndustry(effectiveBusiness, topic, businessServices, "");
    const visualPrompts = getIndustryAdaptiveVisualPrompts(detectedInd, topic, topic);
    const featuredPrompt = visualPrompts.heroPrompt;
    const midPrompt = visualPrompts.midPrompt;

    console.log(`[SEO Engine] Initiating concurrent parallel execution: ${blogModel} 1600+ word text + dual visuals simultaneously...`);

    // In autopilot mode, use 1024x1024 for high velocity (~16s generation) to ensure completion in <40s
    const heroSize = isAutopilot ? "1024x1024" : "1024x1024";

    const generateArticleText = async () => {
      // 1. Try OpenAI if configured
      if (apiKey) {
        try {
          const comp = await openai.chat.completions.create({
            model: blogModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            max_tokens: isAutopilot ? 4000 : 5000,
            temperature: 0.7,
          });
          const raw = comp?.choices?.[0]?.message?.content;
          if (raw) {
            return JSON.parse(raw);
          }
        } catch (openaiErr) {
          console.warn(`[SEO Engine] OpenAI generation failed (${openaiErr.message}), activating Google Gemini fallback...`);
        }
      }

      // 2. Google Gemini Fallback (Zero Downtime, Always Available)
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(geminiKey);
        const geminiModel = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
            maxOutputTokens: 16384,
          },
        });

        const combinedPrompt = `${systemPrompt}\n\nUSER SPECIFICATIONS:\n${userPrompt}\n\nSTRICT INSTRUCTION: Respond strictly with valid JSON. Ensure all double quotes inside html_content are properly escaped with backslashes.`;
        const gemRes = await geminiModel.generateContent(combinedPrompt);
        let rawText = gemRes.response.text().trim();
        if (rawText.startsWith("```json")) {
          rawText = rawText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (rawText.startsWith("```")) {
          rawText = rawText.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }

        try {
          return JSON.parse(rawText);
        } catch (parseErr) {
          console.warn("[SEO Engine] Direct JSON parse failed, attempting safe repair:", parseErr.message);
          // Safe extraction fallback if JSON was slightly malformed
          const titleMatch = rawText.match(/"title"\s*:\s*"([^"]+)"/);
          const slugMatch = rawText.match(/"slug"\s*:\s*"([^"]+)"/);
          const metaTitleMatch = rawText.match(/"meta_title"\s*:\s*"([^"]+)"/);
          const metaDescMatch = rawText.match(/"meta_description"\s*:\s*"([^"]+)"/);
          const focusKwMatch = rawText.match(/"focus_keyword"\s*:\s*"([^"]+)"/);
          
          let extractedHtml = "";
          const htmlStart = rawText.indexOf('"html_content"');
          if (htmlStart !== -1) {
            const afterKey = rawText.slice(htmlStart + 14);
            const firstQuote = afterKey.indexOf('"');
            if (firstQuote !== -1) {
              const htmlBody = afterKey.slice(firstQuote + 1);
              const lastQuote = htmlBody.lastIndexOf('"');
              if (lastQuote !== -1) {
                extractedHtml = htmlBody.slice(0, lastQuote).replace(/\\"/g, '"').replace(/\\n/g, "\n");
              }
            }
          }

          if (titleMatch && extractedHtml) {
            return {
              title: titleMatch[1],
              slug: slugMatch ? slugMatch[1] : topic.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              meta_title: metaTitleMatch ? metaTitleMatch[1] : titleMatch[1],
              meta_description: metaDescMatch ? metaDescMatch[1] : "",
              focus_keyword: focusKwMatch ? focusKwMatch[1] : (focusKeyword || topic),
              tags: [focusKeyword || "Digital Solutions", "Business Growth"],
              html_content: extractedHtml,
            };
          }
          throw parseErr;
        }
      }

      throw new Error("Both OpenAI and Google Gemini text generation providers are unavailable or depleted.");
    };

    const [parsedArticle, [featuredImageUrl, midImageUrl]] = await Promise.all([
      generateArticleText(),
      Promise.all([
        generateAiVisual(featuredPrompt, "featured", heroSize).catch((e) => {
          console.warn("Featured image generation error:", e.message);
          return null;
        }),
        new Promise((resolve) => setTimeout(resolve, 1500))
          .then(() => generateAiVisual(midPrompt, "mid", "1024x1024"))
          .catch((e) => {
            console.warn("Mid image generation error:", e.message);
            return null;
          }),
      ]),
    ]);

    // 7. Ensure In-Content Mid Visual is Injected and Verify Word Count
    let finalContent = parsedArticle.html_content || "";
    
    // Inject Mid-Article Visual Figure into HTML cleanly after Section 3 (optimal ~35-40% visual break)
    if (midImageUrl && !finalContent.includes(midImageUrl)) {
      const midAlt = `${parsedArticle.title} - Strategic Framework`;
      const midFigure = `\n<figure class="gabbarinfo-mid-image" style="margin: 36px 0; text-align: center;"><img src="${midImageUrl}" alt="${midAlt}" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 8px 28px rgba(0,0,0,0.35);" /><figcaption style="font-size: 14px; color: #94a3b8; margin-top: 10px; font-style: italic;">Figure 1: ${parsedArticle.title} Strategic Framework</figcaption></figure>\n`;
      
      const sec4Match = finalContent.search(/<h2[^>]*>\s*(?:4\.|Section 4)/i);
      if (sec4Match > 0) {
        finalContent = finalContent.slice(0, sec4Match) + midFigure + '\n' + finalContent.slice(sec4Match);
      } else {
        const pSplits = finalContent.split("</p>");
        const oneThird = Math.max(1, Math.floor(pSplits.length * 0.35));
        pSplits[oneThird] += midFigure;
        finalContent = pSplits.join("</p>");
      }
    }

    // 8. Sanitize HTML and links: zero cross-domain leakage, zero internal hallucination, industry-tailored links
    finalContent = sanitizeBlogHtmlAndLinks(finalContent, selectedInternalPosts, topic, siteUrl);

    // Guarantee presence of both authentic internal links and topic-relevant external authority citations
    finalContent = ensureRichLinks(finalContent, {
      siteUrl,
      catalogPosts: selectedInternalPosts,
      industryType,
      activeService: topic,
      businessName: effectiveBusiness,
    });

    // Final TOC and Color Scheme Sanitization Pass
    finalContent = finalContent.replace(/<nav[\s\S]*?<\/nav>/gi, "");
    finalContent = finalContent.replace(/<div id="ez-toc-container"[\s\S]*?<\/div>/gi, "");
    finalContent = finalContent.replace(/<ul class="ez-toc-list[\s\S]*?<\/ul>/gi, "");
    finalContent = finalContent.replace(/<p[^>]*>\s*<strong>\s*Table of Contents[\s\S]*?<\/ul>/gi, "");
    finalContent = finalContent.replaceAll("#0284c7", "#f59e0b");
    finalContent = finalContent.replaceAll("#f8fafc", "rgba(255, 255, 255, 0.04)");
    finalContent = finalContent.replaceAll("#f1f5f9", "#cbd5e1");

    // 8. Push Live Article to WordPress via Plugin
    console.log(`[SEO Engine] Pushing article to WordPress: ${siteUrl}/wp-json/gabbarinfo/v1/create-post`);
    const wpPublishPayload = {
      title: parsedArticle.title,
      content: finalContent,
      slug: parsedArticle.slug,
      status: publishStatus,
      post_type: "post",
      featured_image_url: featuredImageUrl,
      featured_image_alt: parsedArticle.title,
      // mid image is already embedded into finalContent above; set to null to avoid double injection
      mid_image_url: null,
      mid_image_alt: parsedArticle.title,
      meta_title: parsedArticle.meta_title,
      meta_description: parsedArticle.meta_description,
      focus_keyword: parsedArticle.focus_keyword,
      tags: parsedArticle.tags || parsedArticle.secondary_keywords || ["SEO Optimization", "Digital Marketing", "Business Growth"],
    };

    const wpPostResp = await fetch(`${siteUrl}/wp-json/gabbarinfo/v1/create-post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${wpApiKey}`,
      },
      body: JSON.stringify(wpPublishPayload),
    });

    const wpResult = await wpPostResp.json();

    if (!wpPostResp.ok || !wpResult?.ok) {
      console.error("WordPress publish error:", wpResult);
      return {
        ok: false,
        status: 500,
        error: wpResult?.message || "Failed to publish article on WordPress site.",
      };
    }

    console.log(`[SEO Engine] Successfully published! Post ID: ${wpResult.post_id}, URL: ${wpResult.post_url}`);

    // Commit successful SEO Article usage to persistent quota ledger
    await commitQuota({
      reservationId: quotaRes.reservationId,
      businessId: quotaRes.businessId,
      cycleStart: quotaRes.cycleStart,
      actionType: "SEO_ARTICLE",
      assetId: siteUrl,
      userEmail,
    });

    return {
      ok: true,
      status: 200,
      post_id: wpResult.post_id,
      post_url: wpResult.post_url,
      title: parsedArticle.title,
      content: finalContent,
      slug: parsedArticle.slug,
      meta_title: parsedArticle.meta_title,
      meta_description: parsedArticle.meta_description,
      focus_keyword: parsedArticle.focus_keyword,
      tags: parsedArticle.tags || parsedArticle.secondary_keywords || [],
      featured_image: featuredImageUrl,
      mid_image: midImageUrl,
      siteUrl,
    };
  } catch (err) {
    console.error("Generate blog error:", err);
    if (quotaRes?.reservationId) {
      await releaseQuota({
        reservationId: quotaRes.reservationId,
        businessId: quotaRes.businessId,
        cycleStart: quotaRes.cycleStart,
        actionType: "SEO_ARTICLE",
        reason: "Blog generation error: " + err.message,
      });
    }
    if (reservation?.transactionId && userEmail) {
      await releaseCredits({
        userEmail,
        transactionId: reservation.transactionId,
        cost: reservation.cost,
        reason: "Blog generation error: " + err.message,
      });
    }
    return { ok: false, status: 500, error: err.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  let userEmail = req.body?.userEmail;
  let session = null;
  if (!userEmail) {
    try {
      const { authOptions } = await import("../auth/[...nextauth]");
      session = await getServerSession(req, res, authOptions);
      userEmail = session?.user?.email;
    } catch (_) {}
  }

  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Unauthorized: Please log in" });
  }

  const result = await executeBlogGeneration({
    userEmail,
    session,
    businessName: req.body?.businessName,
    businessId: req.body?.businessId,
    topic: req.body?.topic,
    targetMarket: req.body?.targetMarket,
    city: req.body?.city,
    targetLocations: req.body?.targetLocations || req.body?.targetMarket || req.body?.city || "",
    targetKeywords: req.body?.targetKeywords,
    brandVoice: req.body?.brandVoice,
    industry: req.body?.industry,
    publishStatus: req.body?.publishStatus,
    crossPostSocial: req.body?.crossPostSocial,
    wordCount: req.body?.wordCount,
    isAutopilot: req.body?.isAutopilot,
    model: req.body?.model,
  });

  return res.status(result.status || (result.ok ? 200 : 400)).json(result);
}

export const maxDuration = 300;

export const config = {
  maxDuration: 300,
};
