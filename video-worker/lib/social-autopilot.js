// video-worker/lib/social-autopilot.js
const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");
const { ensureInstagramCompatibleJpeg } = require("./instagram-image-helper");
const {
  buildCrossBrandNegativeList,
  filterCleanCandidateServices,
  validateTopicRelevance,
  getVisualGuardDirectives,
  getBusinessLimitationProfile,
  validateContentLimitations,
} = require("./brand-integrity-guard");

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
  "discreet",
  "home",
  "blogs",
  "single scan",
  "scan trial",
  "virtual scan",
  "scan to try",
  "virtual trial",
  "virtual try-on",
  "ar try on",
  "scanner",
  "sample page"
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
  if (decoded === "services" || decoded === "our services") return false;
  for (const term of BLACKLISTED_TERMS) {
    if (decoded.includes(term)) return false;
  }
  return true;
}

function sanitizeAndInterpolateSocialCaption(rawCaption, { website = "", phone = "", businessName = "" } = {}) {
  if (!rawCaption) return "";
  let text = rawCaption;

  // 1. Replace website placeholders
  const cleanWebsite = (website || "").trim().replace(/\/$/, "");
  const websiteRegex = /\[(?:Insert\s+|Your\s+)?Website(?:\s+Link)?\]|\[(?:Insert\s+)?(?:Shop|Store|Product)\s+Link\]|\[(?:Insert\s+)?Link\]|\[Website\s+URL\]/gi;
  if (cleanWebsite) {
    text = text.replace(websiteRegex, cleanWebsite);
  } else {
    text = text.replace(websiteRegex, "our official website");
  }

  // 2. Replace contact info / phone placeholders
  const cleanPhone = (phone || "").trim();
  const phoneRegex = /\[(?:Insert\s+|Your\s+)?Contact(?:\s+Info)?\]|\[(?:Insert\s+|Your\s+)?Phone(?:\s+Number)?\]|\[Phone\]|\[Contact\]/gi;
  if (cleanPhone) {
    text = text.replace(phoneRegex, cleanPhone);
  } else {
    // If no phone available, replace "📞 [Your Contact Info]" or similar with a DM invitation
    text = text.replace(/(?:📞|☎️|📱)\s*\[(?:Insert\s+|Your\s+)?(?:Contact|Phone)[^\]]*\]/gi, "💬 Send us a DM to connect!");
    text = text.replace(phoneRegex, "DM us directly");
  }

  // 3. Replace business name / brand placeholders
  text = text.replace(/\[(?:Business\s+Name|Brand\s+Name|Company\s+Name)\]/gi, businessName || "");

  // 4. Final safety sweep: remove any lingering bracketed tokens [ ... ]
  text = text.replace(/\[[A-Za-z0-9\s_–—\-:]{2,50}\]/g, "");

  // 5. Clean up any trailing empty lines or dangling emojis left behind
  text = text
    .split("\n")
    .map(line => line.trimEnd())
    .filter((line) => {
      // Don't keep a line that only has an emoji/colon with no content
      if (/^(?:📞|☎️|🌐|🔗|👉)\s*[:\-–]?\s*$/.test(line.trim())) return false;
      return true;
    })
    .join("\n");

  return text.trim();
}

function getCreativeArchetypes(service, industry, limitationProfile) {
  const s = service || "Professional Services";
  const ind = industry || "Commercial Solutions";
  const domain = limitationProfile?.domainCategory || "GENERAL_BUSINESS";

  if (domain === "PHYSICAL_JEWELLERY_FASHION") {
    return [
      {
        name: "LUXURY_JEWELLERY_STUDIO_PEDESTAL",
        description: `
[VISUAL ARCHETYPE: LUXURY ARTISANAL FINE JEWELLERY PEDESTAL]
- Ultra-premium, high-gloss commercial ad poster for "${s}" (${ind}).
- Features a striking, hyper-realistic physical jewellery focal piece representing "${s}" displayed with pride on an elegant black obsidian or cream travertine pedestal.
- Materials & Atmosphere: Exquisite metallic sheen (gold, silver, polki, kundan), sparkling gemstone facets, dramatic rim lighting, luxury velvet backdrop with soft architectural shadows.
- STRICT ANTI-FICTION RULE: NEVER depict smartphone app mockups, phone screens, glowing scanner interfaces, QR codes, scan frames, virtual trial UI, or digital dashboards. This is a physical luxury jewellery brand. Show ONLY the real physical jewellery piece and luxury styling.
- Typography: Sophisticated, clean modern luxury typography: "${s}".
`
      },
      {
        name: "EDITORIAL_LUXURY_SHOWCASE",
        description: `
[VISUAL ARCHETYPE: EDITORIAL HIGH-FASHION ACCESSORY SHOWCASE]
- Editorial luxury magazine campaign aesthetic showcasing "${s}".
- Features an elegant neck bust or luxury studio presentation of authentic physical "${s}" with couture details and refined styling.
- Materials & Atmosphere: Soft daylight studio ambiance, warm metallic reflections, pristine editorial composition.
- STRICT ANTI-FICTION RULE: Show ONLY the tangible physical jewellery. Absolutely NO phone scanners, NO apps, NO QR codes, NO virtual fitting overlays.
- Typography: Refined high-fashion serif/sans-serif typography: "${s}".
`
      }
    ];
  }

  if (domain === "TWO_WHEELER_MECHANIC") {
    return [
      {
        name: "PROFESSIONAL_BIKE_WORKSHOP",
        description: `
[VISUAL ARCHETYPE: PROFESSIONAL TWO-WHEELER WORKSHOP & TUNING]
- Clean, high-end commercial workshop photograph representing "${s}".
- Features authentic two-wheeler motorcycle or scooter mechanics, specialized bike tools, precision components, and an organized service bay.
- Materials & Atmosphere: Crisp industrial workshop lighting, polished metallic motorcycle parts, clean service floor, dynamic depth of field.
- STRICT ANTI-FICTION RULE: Depict ONLY two-wheelers, motorcycles, and scooters. STRICTLY NO cars, NO four-wheelers, NO trucks, NO digital scanning apps.
- Typography: Bold, powerhouse automotive typography: "${s}".
`
      }
    ];
  }

  if (domain === "WELLNESS_SPA_MASSAGE") {
    return [
      {
        name: "SERENE_WELLNESS_SANCTUARY",
        description: `
[VISUAL ARCHETYPE: SERENE WELLNESS SPA SANCTUARY]
- Tranquil luxury spa retreat aesthetic representing "${s}".
- Features warm ambient candle glow, aromatic essential oil bottles, smooth basalt massage stones, plush clean towels, and soothing bamboo or orchid accents.
- Materials & Atmosphere: Warm golden glow, soft natural shadows, deeply relaxing peaceful atmosphere.
- STRICT ANTI-FICTION RULE: Depict ONLY peaceful physical massage therapy and relaxation. STRICTLY NO computer screens, NO marketing dashboards, NO laptops, NO clinical surgery tools.
- Typography: Elegant calming typography: "${s}".
`
      }
    ];
  }

  if (domain === "DIGITAL_AGENCY_MARKETING") {
    return [
      {
        name: "DYNAMIC_AGENCY_POWERHOUSE",
        description: `
[VISUAL ARCHETYPE: DYNAMIC MODERN 3D COMMERCIAL GRAPHIC]
- Cutting-edge commercial graphic design with dynamic depth and layered 3D accents representing "${s}".
- Features high-impact 3D visual icons, sleek creative workspace, polished dark slate materials, and vibrant glowing ambient lighting.
- Typography: High-impact powerhouse advertising typography: "${s}".
`
      },
      {
        name: "BRIGHT_CONTEMPORARY_STUDIO",
        description: `
[VISUAL ARCHETYPE: BRIGHT MINIMALIST & CONTEMPORARY STUDIO]
- Pristine, daylight-filled high-end commercial ad aesthetic with soft architectural shadows.
- Features clean, elegant composition showing modern creative workspace and presentation elements representing "${s}".
- Typography: Sophisticated contemporary sans-serif typography: "${s}".
`
      }
    ];
  }

  // Default clean commercial showcase
  return [
    {
      name: "HERO_COMMERCIAL_SHOWCASE",
      description: `
[VISUAL ARCHETYPE: HERO COMMERCIAL SHOWCASE & PEDESTAL]
- Ultra-premium, high-gloss commercial ad poster for "${s}" (${ind}).
- Features a striking, hyper-realistic focal subject representing "${s}" displayed with pride on a sleek modern pedestal with dramatic studio lighting.
- Materials & Atmosphere: Polished reflections, subtle ambient glow, and deep rich contrast.
- STRICT ANTI-FICTION RULE: NEVER depict smartphone app mockups, phone screens, QR codes, or virtual scan frames unless this is explicitly a mobile software company.
- Typography: Ultra-clean, bold modern display typography: "${s}".
`
    },
    {
      name: "BRIGHT_MINIMALIST_STUDIO",
      description: `
[VISUAL ARCHETYPE: BRIGHT MINIMALIST & CONTEMPORARY STUDIO]
- Pristine, daylight-filled high-end commercial ad aesthetic with soft architectural shadows.
- Features clean, elegant composition showing authentic workspace, key equipment, and refined presentation representing "${s}".
- Typography: Sophisticated contemporary sans-serif typography: "${s}".
`
    }
  ];
}

function buildGraphicPrompt(businessName, service, industry, hook, topic, limitationProfile) {
  const userIndustry = industry || businessName || "Professional Services";
  const profile = limitationProfile || getBusinessLimitationProfile({ businessName, industry: userIndustry, services: [service] });
  const archetypes = getCreativeArchetypes(service, userIndustry, profile);
  const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];

  return `You are an award-winning commercial graphic designer creating a finished agency-grade commercial ad poster for social media advertising.

[CLIENT BUSINESS CONTEXT]
- Brand Name: "${businessName}"
- Industry: "${userIndustry}"
- Specific Offering: "${service}"
- Core Message / Hook: "${hook}: ${topic}"

[VISUAL DIRECTION]
${archetype.description}

[SUBJECT MATTER RULES - CRITICAL]
- Accurately depict premium, professional visual elements directly relevant to "${service}" and "${userIndustry}".
- Accurately honor verified service scope: ${profile.allowedCapabilities}
- NEVER depict random unrelated stock scenes or physical delivery trucks unless specifically requested.
- Sleek studio lighting, high contrast, clean commercial composition, pristine 4K quality.
- Absolutely NO text watermarks or random gibberish letters.
- ${profile.visualDirectives.negativeConstraints}`;
}

async function runSocialAutopilotCycle({ supabase, openai, force = false, email = null, targetBrand = null, logger = console.log }) {
  if (!supabase) throw new Error("Supabase client is required.");
  if (!openai) throw new Error("OpenAI client is required for gpt-image-2 visual generation.");

  logger("[Social Autopilot] Starting autonomous scheduled cycle on Railway...");

  let query = supabase
    .from("agent_memory")
    .select("email, memory_type, content")
    .like("memory_type", "social_autopilot_%");

  if (email) {
    query = query.ilike("email", email.trim());
  }

  const { data: configs, error } = await query;

  if (error) {
    logger("[Social Autopilot] Failed to fetch social autopilot configs:", error.message);
    throw error;
  }

  const results = [];

  for (const item of configs || []) {
    try {
      const config = JSON.parse(item.content);
      // Hard Rule 1: Strict Opt-in. Never run unless explicitly enabled === true.
      const isEnabled = config.enabled === true || force === true;
      if (!isEnabled) {
        logger(`[Social Autopilot] Autopilot not active for ${item.email} (${config.businessName || item.memory_type}). Skipping.`);
        continue;
      }

      const businessName = config.businessName || "GABBARinfo";

      // Hard Rule 1.2: If a targetBrand filter was passed, isolate strictly
      const rawBizKey = item.memory_type.replace(/^social_autopilot_/, "");
      let cleanBizKey = rawBizKey;
      if (cleanBizKey.toLowerCase().startsWith(item.email.toLowerCase())) {
        cleanBizKey = cleanBizKey.slice(item.email.length).replace(/^[_:]/, "");
      }
      const sanitizedEmail = item.email.toLowerCase().replace(/[^a-z0-9]/g, "_");
      if (cleanBizKey.toLowerCase().startsWith(sanitizedEmail)) {
        cleanBizKey = cleanBizKey.slice(sanitizedEmail.length).replace(/^[_:]/, "");
      }
      const normalizedBiz = (config.businessName || cleanBizKey || "default")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, "_");

      if (targetBrand) {
        const normTarget = targetBrand.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");
        if (cleanBizKey !== normTarget && normalizedBiz !== normTarget && !businessName.toLowerCase().includes(targetBrand.toLowerCase())) {
          continue;
        }
      }

      // Hard Rule 1.3: Verify connected Meta channels FIRST before burning any LLM or image generation credits
      const [brandMemsRes, bundlePairRes] = await Promise.all([
        supabase
          .from("agent_memory")
          .select("memory_type, content")
          .eq("email", item.email.trim().toLowerCase())
          .like("memory_type", "meta_conn_%"),
        supabase
          .from("agent_memory")
          .select("content")
          .eq("email", item.email.trim().toLowerCase())
          .in("memory_type", ["bundle_pairings", "brand_asset_pairings"])
          .maybeSingle(),
      ]);

      const brandProfiles = [];
      (brandMemsRes.data || []).forEach((m) => {
        try {
          const parsed = JSON.parse(m.content);
          brandProfiles.push({ key: m.memory_type.replace("meta_conn_", ""), ...parsed });
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

      let activeMeta = null;
      const matchedBrand = brandProfiles.find((b) => {
        const bKey = String(b.key || "").toLowerCase();
        const bName = String(b.businessName || b.pageName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const targetName = String(config.businessName || cleanBizKey || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const targetKey = String(cleanBizKey || "").toLowerCase();
        const normKey = String(normalizedBiz || "").toLowerCase();
        return (targetKey.length > 2 && bKey && (bKey === targetKey || (normKey && bKey === normKey) || bKey.includes(targetKey) || targetKey.includes(bKey))) ||
               (targetName.length > 2 && bName && (bName === targetName || bName.includes(targetName) || targetName.includes(bName)));
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

      if (!activeMeta && brandProfiles.length === 0) {
        const { data: metaConn, error: metaErr } = await supabase
          .from("meta_connections")
          .select("fb_page_id, fb_page_access_token, fb_user_access_token, ig_business_id, instagram_actor_id, business_website, business_phone, website_url, email, business_name")
          .ilike("email", item.email.trim())
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (metaErr) {
          logger(`[Social Autopilot] Error fetching meta_connections for ${item.email}: ${metaErr.message}`);
        }
        activeMeta = metaConn;
      }

      if (!activeMeta || (!activeMeta.fb_page_id && !activeMeta.ig_business_id)) {
        logger(`[Social Autopilot] No verified Meta assets (Facebook Page / Instagram ID) connected for ${item.email} (${businessName}). Skipping cycle.`);
        results.push({ email: item.email, status: "skipped", reason: "no_meta_connection", business: businessName });
        continue;
      }

      logger(`[Social Autopilot] Processing ${item.email} (${businessName})...`);

      // 1. Check Cadence velocity (default: daily = ~12 hours interval)
      const lastPublished = config.lastPublishedAt ? new Date(config.lastPublishedAt) : null;
      const now = new Date();
      const minIntervalMs = 12 * 60 * 60 * 1000;

      if (lastPublished && (now - lastPublished) < minIntervalMs && !force) {
        logger(`[Social Autopilot] Cadence threshold not reached for ${item.email} (${businessName}). Skipping.`);
        continue;
      }

      // 1.5 Strict Multi-Tenant Brand Isolation: Map all foreign brands into negative blacklist
      const brandKey = (item.memory_type || "").replace(/^social_autopilot_[^_]+_?/, "") || (businessName || "").toLowerCase().replace(/[^a-z0-9]/g, "_");

      // Discover siteUrl if available in config or from connected WordPress strictly matching this brand
      let siteUrl = (config.siteUrl || config.website || "").replace(/\/$/, "");
      if (!siteUrl) {
        try {
          const { data: wpMemList } = await supabase
            .from("agent_memory")
            .select("memory_type, content")
            .eq("email", item.email)
            .or("memory_type.like.wp_conn_%,memory_type.like.wp_connection_%");
          const normBrand = String(brandKey || businessName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          for (const m of wpMemList || []) {
            try {
              const parsed = JSON.parse(m.content);
              const wpName = (parsed.siteName || parsed.businessName || m.memory_type || "").toLowerCase().replace(/[^a-z0-9]/g, "");
              const wpDomain = (parsed.siteUrl || "").toLowerCase();
              if (parsed.siteUrl && normBrand && (wpName.includes(normBrand) || normBrand.includes(wpName) || wpDomain.includes(normBrand))) {
                siteUrl = parsed.siteUrl.replace(/\/$/, "");
                break;
              }
            } catch (_) {}
          }
        } catch (_) {}
      }

      const { forbiddenTerms: crossBrandForbidden, foreignBrands } = await buildCrossBrandNegativeList({
        supabase,
        userEmail: item.email,
        currentBusinessKey: brandKey || businessName,
        currentSiteUrl: siteUrl,
      });
      if (crossBrandForbidden.length > 0) {
        logger(`[Social Autopilot] Brand Integrity Guard: Activated ${crossBrandForbidden.length} negative exclusion terms from ${foreignBrands.length} foreign brands under ${item.email}.`);
      }

      const businessIndustry = config.industry || businessName || "Commercial Services";
      const limitationProfile = getBusinessLimitationProfile({
        businessName,
        industry: businessIndustry,
        currentSiteUrl: siteUrl,
        services: config.services || []
      });
      logger(`[Social Autopilot] Limitation Profile: Domain "${limitationProfile.domainCategory}" active for ${businessName}.`);

      // 2. Discover / Filter legitimate services
      // CRITICAL RULE: If config.services has verified items, it is the AUTHORITATIVE, CLOSED roster.
      // Never crawl external web pages or pull dirty historical queue items into candidate services!
      let candidateServices = [];
      if (Array.isArray(config.services) && config.services.length > 0) {
        candidateServices = config.services.map(decodeHtmlEntities).filter(isLegitimateService);
      }

      // If not yet discovered in config, check client onboarding memory for their exact business services
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

      // Dynamically crawl their actual site's published pages ONLY if candidate services not yet configured
      // and ONLY if siteUrl is confirmed to belong strictly to this brand (NEVER crawl for eCommerce/Shopify stores)
      const isShopifyBrand = Boolean(
        limitationProfile.domainCategory === "PHYSICAL_JEWELLERY_FASHION" ||
        (item.memory_type || "").toLowerCase().includes("bella") ||
        (businessName || "").toLowerCase().includes("bella")
      );
      if (siteUrl && candidateServices.length === 0 && !isShopifyBrand) {
        try {
          const pagesRes = await fetch(`${siteUrl}/wp-json/wp/v2/pages?per_page=50&_fields=title,slug`);
          if (pagesRes.ok) {
            const pages = await pagesRes.json();
            const utilitySlugs = /^(home.*|about.*|contact.*|privacy.*|terms.*|faq.*|cart.*|checkout.*|my-account.*|sample-page.*|disclaimer.*|shipping.*|refund.*|cancellation.*|test.*|blogs.*|services|shop|account)$/i;
            const utilityTitles = /^(home|about(\s+us)?|contact(\s+us)?|privacy(\s+policy)?|terms(\s+(&|and|&#038;)\s+conditions)?|disclaimer|shipping.*|refund.*|cancellation.*|blogs?|services?|sample\s+page|my\s+account|cart|checkout|test.*)$/i;
            for (const p of pages || []) {
              const slug = (p.slug || "").toLowerCase();
              const title = decodeHtmlEntities((p?.title?.rendered || p?.slug || "").replace(/<[^>]+>/g, "").trim());
              if (title && title.length > 2 && !utilitySlugs.test(slug) && !utilityTitles.test(title) && isLegitimateService(title)) {
                candidateServices.push(title);
              }
            }
          }
        } catch (_) {}
      }

      // Filter against foreign brands
      candidateServices = [...new Set(candidateServices)].filter(isLegitimateService);
      candidateServices = filterCleanCandidateServices({
        candidateServices,
        forbiddenTerms: crossBrandForbidden,
        logger,
      });

      // Filter against domain limitation forbidden capabilities (e.g. no "scan" for jewelry, no "car" for bike mechanic, no "seo" for massage)
      candidateServices = candidateServices.filter(s => {
        const check = validateContentLimitations({ text: s, limitationProfile, logger });
        if (!check.ok) {
          logger(`[Social Autopilot] Discarded candidate service "${s}": violates domain limitation "${check.violation}".`);
          return false;
        }
        return true;
      });

      // Domain-tailored clean fallback based on business limitation profile
      if (candidateServices.length === 0) {
        if (limitationProfile.domainCategory === "PHYSICAL_JEWELLERY_FASHION") {
          candidateServices = [
            "Designer Jewellery",
            "Bridal Accessories",
            "Earrings & Rings",
            "Anti-Tarnish Jewellery",
            "Statement Necklaces"
          ];
        } else if (limitationProfile.domainCategory === "TWO_WHEELER_MECHANIC") {
          candidateServices = [
            "Two-Wheeler Servicing",
            "Motorcycle Engine Tuning",
            "Brake & Suspension Check",
            "Scooter Maintenance",
            "Genuine Bike Parts"
          ];
        } else if (limitationProfile.domainCategory === "WELLNESS_SPA_MASSAGE") {
          candidateServices = [
            "Woman Deep Massage",
            "Aromatherapy Therapy",
            "Swedish Massage",
            "Full Body Relaxation",
            "Stress Relief Therapy"
          ];
        } else if (limitationProfile.domainCategory === "ASTROLOGY_PALMISTRY") {
          candidateServices = [
            "Vedic Astrology Reading",
            "Palmistry Insights",
            "Kundali Matchmaking",
            "Planetary Transit Guidance"
          ];
        } else if (limitationProfile.domainCategory === "DIGITAL_AGENCY_MARKETING") {
          candidateServices = [
            "Performance Marketing",
            "Meta Social Ads",
            "Google Ads Strategy",
            "Website Design",
            "Video Editing"
          ];
        } else {
          candidateServices = [
            `${businessIndustry} Core Solutions`,
            `Professional High-Quality ${businessIndustry}`,
            `Strategic Client Delivery in ${businessIndustry}`,
            `Trusted Industry Standards in ${businessIndustry}`
          ];
        }
      }

      // 30-Day Social History & Anti-Repetition Ranking
      const past30SocialPosts = [
        ...(Array.isArray(config.history) ? config.history : []),
        ...(Array.isArray(config.publishedTopics) ? config.publishedTopics.map(t => ({ topic: t, hook: t, service: "" })) : [])
      ].slice(0, 30);

      const serviceStats = candidateServices.map((s) => {
        const sLower = s.toLowerCase();
        const count = past30SocialPosts.filter((p) => {
          const pServ = (p.service || "").toLowerCase();
          const pHook = (p.hook || "").toLowerCase();
          const pTopic = (p.topic || "").toLowerCase();
          return pServ === sLower || (sLower.length > 4 && pServ.includes(sLower)) || pHook.includes(sLower) || pTopic.includes(sLower);
        }).length;
        const recencyIndex = past30SocialPosts.findIndex((p) => {
          const pServ = (p.service || "").toLowerCase();
          const pHook = (p.hook || "").toLowerCase();
          const pTopic = (p.topic || "").toLowerCase();
          return pServ === sLower || (sLower.length > 4 && pServ.includes(sLower)) || pHook.includes(sLower) || pTopic.includes(sLower);
        });
        return {
          service: s,
          count,
          recency: recencyIndex === -1 ? 999 : recencyIndex,
        };
      });

      // Sort: lowest count first, then furthest recency
      serviceStats.sort((a, b) => {
        if (a.count !== b.count) return a.count - b.count;
        return b.recency - a.recency;
      });

      const minCount = serviceStats[0]?.count ?? 0;
      const eligibleServices = serviceStats.filter((ss) => ss.count === minCount).map((ss) => ss.service);

      // Check if queue has a pending item for today
      let activeService = null;
      let activeQueueItem = null;
      if (Array.isArray(config.queue)) {
        activeQueueItem = config.queue.find(q => q.status === "pending" && isLegitimateService(q.service));
        if (activeQueueItem) {
          const queueServ = decodeHtmlEntities(activeQueueItem.service);
          // Check if queue item itself was corrupted by a past bug with a forbidden term
          const qCheck = validateContentLimitations({
            text: `${queueServ} ${activeQueueItem.topic || ""} ${activeQueueItem.hook || ""}`,
            limitationProfile,
            logger
          });
          if (!qCheck.ok) {
            logger(`[Social Autopilot] 🚨 Queue item "${queueServ}" violates domain limitations (${qCheck.violation}). Auto-correcting to verified service.`);
            activeService = candidateServices[0] || `${businessName} Core Offerings`;
            activeQueueItem.service = activeService;
            activeQueueItem.topic = `${activeService}: Premium Craftsmanship & Style`;
            activeQueueItem.hook = `Essential Guide & Insider Tips`;
          } else {
            // Sacred rule: Keep the planned queue service! Never overwrite it with a foreign/crawled item!
            activeService = queueServ;
          }
        }
      }

      // If no pending queue item or no queue, use round-robin rotation over eligible pool
      let nextIndex = (Number(config.lastServiceIndex) || 0) + 1;
      if (nextIndex >= eligibleServices.length) nextIndex = 0;
      if (!activeService) {
        activeService = eligibleServices[nextIndex] || candidateServices[0] || `${businessName} Core Services`;
        logger(`[Social Autopilot] 30-Day Anti-Duplication: Selected active service "${activeService}" (used ${minCount} times in last 30 posts; eligible pool: ${eligibleServices.length}).`);
      }

      // DECONFLICTION: Check if WordPress SEO blog published an article in the last 24 hours
      let recentBlogTitleOrTopic = "";
      try {
        const { data: blogMemList } = await supabase
          .from("agent_memory")
          .select("content")
          .eq("email", item.email.trim().toLowerCase())
          .like("memory_type", "wp_autopilot_%");
        for (const bm of blogMemList || []) {
          try {
            const parsedBlog = JSON.parse(bm.content);
            if (parsedBlog.lastPublishedAt) {
              const blogDate = new Date(parsedBlog.lastPublishedAt);
              if (now - blogDate < 24 * 60 * 60 * 1000) {
                recentBlogTitleOrTopic = (parsedBlog.lastPublishedTitle || "").toLowerCase();
                break;
              }
            }
          } catch (_) {}
        }
      } catch (_) {}

      if (recentBlogTitleOrTopic && activeService && candidateServices.length > 1) {
        const actLower = activeService.toLowerCase();
        if (recentBlogTitleOrTopic.includes(actLower) || (actLower.length > 5 && recentBlogTitleOrTopic.includes(actLower.slice(0, -2)))) {
          logger(`[Social Autopilot] Deconfliction: Blog recently published on "${activeService}". Rotating social post to avoid same-day duplication.`);
          nextIndex = (nextIndex + 1) % candidateServices.length;
          activeService = candidateServices[nextIndex] || activeService;
          activeQueueItem = null; // Do not consume conflicting queue item today
        }
      }

      // 3. Multi-Brand Meta Assets already verified and activeMeta resolved upfront

      // Resolve actual business details to avoid placeholder tokens
      const resolvedWebsite = (
        matchedBrand?.websiteUrl ||
        matchedBrand?.website ||
        config.websiteUrl ||
        config.website ||
        config.siteUrl ||
        activeMeta?.business_website ||
        activeMeta?.website_url ||
        siteUrl ||
        ""
      ).replace(/\/$/, "");

      const resolvedPhone = (
        matchedBrand?.phone ||
        matchedBrand?.business_phone ||
        config.phone ||
        config.contactNumber ||
        activeMeta?.business_phone ||
        ""
      ).trim();

      const resolvedBrandName = matchedBrand?.businessName || config.businessName || businessName || "GABBARinfo";

      // 4. Generate Caption & Topic Hook via OpenAI / LLM
      let selectedHook = activeQueueItem?.hook || "";
      let topicTitle = activeQueueItem?.topic || "";

      // Check if selectedHook is missing, repetitive, or from the old generic 5-template pool
      const pastHooks = past30SocialPosts.map(p => p.hook || p.topic).filter(Boolean);
      const isGenericOrRepeated = !selectedHook || 
        selectedHook.includes("Are you getting the full commercial return") ||
        selectedHook.includes("How premier") ||
        selectedHook.includes("The difference between ordinary providers") ||
        selectedHook.includes("3 proven principles that elevate") ||
        selectedHook.includes("Why excellence and consistency") ||
        pastHooks.some(ph => ph.toLowerCase() === selectedHook.toLowerCase() || (selectedHook.length > 15 && ph.toLowerCase().includes(selectedHook.toLowerCase())));

      if (isGenericOrRepeated || !topicTitle) {
        try {
          const hookRes = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are an elite viral commercial copywriter and creative director for "${resolvedBrandName}" (${businessIndustry}). You create high-converting, attention-grabbing hooks and topics that stop scrollers in their tracks.`
              },
              {
                role: "user",
                content: `Create 1 completely unique, high-converting social media hook and topic title promoting "${activeService}" for "${resolvedBrandName}".
Core Offering: "${activeService}"
Industry: "${businessIndustry}"
${targetLocations ? `Target Markets: "${targetLocations}"` : ""}

PREVIOUS 30 SOCIAL HOOKS (DO NOT REPEAT ANY OF THESE HOOKS, PATTERNS, OR PHRASING):
${pastHooks.slice(0, 30).map((h, i) => `[Post ${i + 1}] "${h}"`).join("\n")}

${limitationProfile.promptLimitationsDirective}

STRICT INSTRUCTIONS:
- The hook must be completely original, punchy, curiosity-inducing, and commercially compelling.
- NEVER reuse any phrasing, sentence structure, or angle from the past 30 posts above.
- Select a fresh framework (e.g., provocative contrarian insight, costly mistake diagnostic, high-ROI transformation, insider secret, client outcome spotlight, or direct challenge).
- Format response strictly as JSON:
{
  "hook": "Punchy 1-sentence viral hook (under 12 words)",
  "topic": "Strategic topic title"
}`
              }
            ],
            response_format: { type: "json_object" },
            temperature: 0.85,
          });
          const parsedHook = JSON.parse(hookRes.choices[0]?.message?.content || "{}");
          if (parsedHook.hook) selectedHook = parsedHook.hook;
          if (parsedHook.topic) topicTitle = parsedHook.topic;
        } catch (_) {}
      }

      if (!topicTitle) {
        topicTitle = `${activeService}: 2026 High-Impact Strategies & Execution`;
      }
      if (!selectedHook) {
        selectedHook = `Transform your business with high-performance ${activeService}`;
      }

      logger(`[Social Autopilot] Generating caption for "${activeService}" (${resolvedBrandName})...`);
      const targetLocations = (config.targetLocations || config.targetMarket || "").trim();
      let captionText = "";
      try {
        const ctaDirectives = [
          resolvedWebsite ? `- Exact Business Website URL to include in the CTA: ${resolvedWebsite}` : "",
          resolvedPhone ? `- Exact Phone / Contact number to include: ${resolvedPhone}` : "",
          !resolvedPhone ? `- No phone number provided: Direct audience to "Send us a direct message", "DM us", or "Visit ${resolvedWebsite || 'our website'}" (NEVER ask them to call or invent phone placeholders).` : "",
          `- STRICT ANTI-PLACEHOLDER INSTRUCTION: NEVER write bracketed placeholder tokens like [Your Contact Info], [Your Website Link], [Insert Website Link], [Insert Link], [Phone], [Website], etc. Under NO circumstance should any square brackets [] appear anywhere in the output!`,
          resolvedWebsite ? `- When writing the call to action, provide the real URL: ${resolvedWebsite}` : `- When writing the call to action, invite them to send a direct message.`
        ].filter(Boolean).join("\n");

        const chatRes = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an elite direct-response commercial copywriter representing "${resolvedBrandName}", an industry leader in ${businessIndustry}. Write compelling, authoritative, high-converting social media copy with clean formatting and strategic hashtags.${targetLocations ? ` You are specifically targeting clients and decision-makers in: ${targetLocations}. Reflect the regional business tone, commercial context, and market speed of these locations.` : ""}`
            },
            {
              role: "user",
              content: `Write an engaging commercial social media post promoting "${activeService}" for "${resolvedBrandName}".
Industry: "${businessIndustry}"
Hook: "${selectedHook}"
${targetLocations ? `Target Geographic Markets: "${targetLocations}" (Tailor the hook and message to resonate strongly with customers and decision-makers in ${targetLocations})` : ""}
Include 3-4 bullet benefits, a strong call to action, and 6-8 relevant hashtags${targetLocations ? ` (including geo-targeted hashtags for ${targetLocations})` : ""}.

${limitationProfile.promptLimitationsDirective}

CALL TO ACTION & CONTACT MANDATES:
${ctaDirectives}`
            }
          ],
          temperature: 0.7,
        });
        captionText = chatRes.choices[0]?.message?.content?.trim();
      } catch (chatErr) {
        logger("[Social Autopilot] Caption generation fallback:", chatErr.message);
        const geoHashtags = targetLocations
          ? " " + targetLocations.split(",").map((l) => `#${l.trim().replace(/[^a-zA-Z0-9]/g, "")}`).filter(h => h.length > 2).slice(0, 3).join(" ")
          : "";
        const fallbackCta = resolvedWebsite ? `Visit our website at ${resolvedWebsite} to get started!` : "Send us a direct message to get started!";
        captionText = `📢 ${selectedHook}\n\nAt ${resolvedBrandName}, our ${activeService} solutions are built to deliver uncompromised quality, measurable outcomes, and lasting peace of mind.${targetLocations ? ` Proudly serving clients across ${targetLocations}.` : ""}\n\n👉 ${fallbackCta}\n\n#${activeService.replace(/[^a-zA-Z0-9]/g, "")} #${businessIndustry.replace(/[^a-zA-Z0-9]/g, "")} #${resolvedBrandName.replace(/[^a-zA-Z0-9]/g, "")}${geoHashtags}`;
      }

      // Guarantee ZERO bracket placeholders appear on live posts
      captionText = sanitizeAndInterpolateSocialCaption(captionText, {
        website: resolvedWebsite,
        phone: resolvedPhone,
        businessName: resolvedBrandName,
      });

      // Strict Validation Gate: Check topic, hook, and caption against limitation profile
      const topicCheck = validateContentLimitations({ text: topicTitle, limitationProfile, logger });
      const hookCheck = validateContentLimitations({ text: selectedHook, limitationProfile, logger });
      const captionCheck = validateContentLimitations({ text: captionText, limitationProfile, logger });

      if (!topicCheck.ok || !hookCheck.ok || !captionCheck.ok) {
        const violation = topicCheck.violation || hookCheck.violation || captionCheck.violation;
        logger(`[Social Autopilot] 🚨 Content breached domain limitation rules ("${violation}"). Sanitizing content...`);
        const rx = new RegExp(violation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        topicTitle = topicTitle.replace(rx, "").trim() || `${activeService} Spotlight`;
        selectedHook = selectedHook.replace(rx, "").trim() || `Discover High-Quality ${activeService}`;
        captionText = captionText.replace(rx, "").trim();
      }

      // 5. Generate Bespoke Visual via gpt-image-2 (ZERO STOCK PHOTOS, Hardened with Brand Integrity Guard)
      logger(`[Social Autopilot] Generating commercial ad visual for "${activeService}"...`);
      let graphicPrompt = buildGraphicPrompt(
        resolvedBrandName,
        activeService,
        businessIndustry,
        selectedHook,
        topicTitle,
        limitationProfile
      );

      const imgPromptCheck = validateContentLimitations({ text: graphicPrompt, limitationProfile, logger });
      if (!imgPromptCheck.ok) {
        logger(`[Social Autopilot] 🚨 Graphic prompt contained forbidden term ("${imgPromptCheck.violation}"). Sanitizing graphic prompt...`);
        const rx = new RegExp(imgPromptCheck.violation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        graphicPrompt = graphicPrompt.replace(rx, "").trim();
      }

      const candidateModels = ["gpt-image-2", "gpt-image-2-2026-04-21", "gpt-image-1.5"];
      let imageBuffer = null;
      let modelUsed = null;

      for (const modelName of candidateModels) {
        try {
          logger(`[Social Autopilot] Attempting visual generation with ${modelName}...`);
          const imgRes = await openai.images.generate({
            model: modelName,
            prompt: graphicPrompt,
            size: "1024x1024",
          });

          if (imgRes.data?.[0]?.b64_json) {
            imageBuffer = Buffer.from(imgRes.data[0].b64_json, "base64");
          } else if (imgRes.data?.[0]?.url) {
            const fetchRes = await fetch(imgRes.data[0].url);
            imageBuffer = Buffer.from(await fetchRes.arrayBuffer());
          }

          if (imageBuffer && imageBuffer.length > 0) {
            modelUsed = modelName;
            logger(`[Social Autopilot] Successfully generated visual via ${modelName} (${imageBuffer.length} bytes)`);
            break;
          }
        } catch (imgErr) {
          logger(`[Social Autopilot] ${modelName} generation failed (${imgErr.message}), trying next approved model...`);
        }
      }

      if (!imageBuffer) {
        logger(`[Social Autopilot] CRITICAL: All approved gpt-image models failed. Aborting post for ${item.email} rather than using degraded models.`);
        results.push({ email: item.email, status: "skipped", reason: "image_generation_failed" });
        continue;
      }

      // 6. Upload image to Supabase storage ('instagram-creatives')
      const fileName = `social_ai_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("instagram-creatives")
        .upload(fileName, imageBuffer, { contentType: "image/png", upsert: true });

      if (uploadErr || !uploadData) {
        throw new Error(`Failed to upload image to Supabase storage: ${uploadErr?.message}`);
      }

      const { data: pubUrlData } = supabase.storage
        .from("instagram-creatives")
        .getPublicUrl(fileName);
      const publicImageUrl = pubUrlData.publicUrl;
      logger(`[Social Autopilot] Public image URL ready: ${publicImageUrl}`);

      // 7. Publish to Facebook and Instagram with Verified Meta Connection
      if (!activeMeta) {
        logger(`[Social Autopilot] Social syndication skipped: Brand "${resolvedBrandName || cleanBizKey}" has no verified paired Meta assets.`);
      }

      const published = {};
      const metaConn = activeMeta;

      if (metaConn) {
        let pageToken = metaConn.fb_page_access_token;
        const userToken = metaConn.fb_user_access_token;
        const pageId = metaConn.fb_page_id ? metaConn.fb_page_id.split(",")[0].trim() : null;
        let igId = metaConn.ig_business_id || metaConn.instagram_actor_id;

        // If pageToken is missing or needs refresh, exchange from userToken
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
          } catch (tokErr) {
            logger("[Social Autopilot] Failed to fetch Page token from userToken:", tokErr.message);
          }
        }

        const effectiveToken = pageToken || userToken;

        // Auto-resolve Instagram Business ID from Facebook Page if missing
        if (!igId && pageId && effectiveToken) {
          try {
            const igLookupResp = await fetch(`https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account&access_token=${encodeURIComponent(effectiveToken)}`);
            const igLookupJson = await igLookupResp.json();
            if (igLookupJson?.instagram_business_account?.id) {
              igId = igLookupJson.instagram_business_account.id;
              logger(`[Social Autopilot] Auto-resolved connected Instagram Business ID from Facebook Page: ${igId}`);
            }
          } catch (_) {}
        }

        // Publish to Facebook Page
        const destination = config.destination || "BOTH";
        if ((destination === "BOTH" || destination === "FACEBOOK_ONLY") && pageId && effectiveToken) {
          try {
            logger(`[Social Autopilot] Publishing photo post to Facebook Page (${pageId})...`);
            const photoParams = new URLSearchParams();
            photoParams.append("url", publicImageUrl);
            photoParams.append("caption", captionText);
            photoParams.append("access_token", effectiveToken);

            const fbRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
              method: "POST",
              body: photoParams,
            });
            const fbData = await fbRes.json();
            if (fbData.id || fbData.post_id) {
              published.facebook = { ok: true, id: fbData.id || fbData.post_id };
              logger(`[Social Autopilot] Facebook post published: ${fbData.id || fbData.post_id}`);
            } else {
              published.facebook = { ok: false, error: fbData.error?.message };
              logger("[Social Autopilot] Facebook post error:", fbData.error);
            }
          } catch (fbErr) {
            published.facebook = { ok: false, error: fbErr.message };
            logger("[Social Autopilot] Facebook publish network error:", fbErr.message);
          }
        }

        // Publish to Instagram Profile
        if ((destination === "BOTH" || destination === "INSTAGRAM_ONLY") && igId && effectiveToken) {
          try {
            logger(`[Social Autopilot] Publishing container to Instagram Profile (${igId})...`);
            const verifiedIgUrl = await ensureInstagramCompatibleJpeg({
              imageUrl: publicImageUrl,
              imageBuffer,
              supabase,
              logger,
            });
            const containerParams = new URLSearchParams();
            containerParams.append("image_url", verifiedIgUrl);
            containerParams.append("caption", captionText);
            containerParams.append("access_token", effectiveToken);

            const igContainerRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media`, {
              method: "POST",
              body: containerParams,
            });
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
                  logger(`[Social Autopilot] Instagram media processing error: ${statusJson.status || "Unknown"}`);
                  break;
                }
              }

              if (isReady) {
                const pubParams = new URLSearchParams();
                pubParams.append("creation_id", creationId);
                pubParams.append("access_token", effectiveToken);

                const igPubRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media_publish`, {
                  method: "POST",
                  body: pubParams,
                });
                const pubData = await igPubRes.json();
                if (pubData.id) {
                  published.instagram = { ok: true, id: pubData.id };
                  logger(`[Social Autopilot] Instagram post published: ${pubData.id}`);
                } else {
                  published.instagram = { ok: false, error: pubData.error?.message };
                }
              } else {
                published.instagram = { ok: false, error: "Instagram media container was not ready in time." };
                logger("[Social Autopilot] Instagram container timed out or errored before publish.");
              }
            } else {
              published.instagram = { ok: false, error: containerData.error?.message };
            }
          } catch (igErr) {
            published.instagram = { ok: false, error: igErr.message };
            logger("[Social Autopilot] Instagram publish error:", igErr.message);
          }
        }
      }

      // 7. Persist updated state to Supabase agent_memory ONLY IF POST SUCCEEDED
      const didPublishSuccessfully = Boolean(published.facebook?.ok || published.instagram?.ok);

      if (didPublishSuccessfully) {
        config.lastPublishedAt = now.toISOString();
        config.lastServiceIndex = nextIndex;
        config.publishedCount = (Number(config.publishedCount) || 0) + 1;
        config.publishedTopics = config.publishedTopics || [];
        config.history = config.history || [];

        config.history.unshift({
          date: now.toISOString(),
          service: activeService,
          hook: selectedHook,
          topic: topicTitle || activeService,
          imageUrl: publicImageUrl,
          publishedTo: published,
        });
        if (config.history.length > 30) config.history = config.history.slice(0, 30);

        if (activeQueueItem) {
          activeQueueItem.status = "published";
          activeQueueItem.publishedAt = now.toISOString();
        }
        if (config.publishedTopics.length > 30) config.publishedTopics.shift();

        await supabase
          .from("agent_memory")
          .update({
            content: JSON.stringify(config),
            updated_at: now.toISOString(),
          })
          .eq("email", item.email)
          .eq("memory_type", item.memory_type);

        logger(`[Social Autopilot] Successfully published and updated memory for ${item.email}. Published count: ${config.publishedCount}`);
      } else {
        logger(`[Social Autopilot] Post could not be confirmed published for ${item.email}. NOT locking cadence.`);
      }

      results.push({
        email: item.email,
        business: businessName,
        service: activeService,
        status: didPublishSuccessfully ? "published" : "failed",
        imageUrl: publicImageUrl,
        socialShares: published,
      });
    } catch (userErr) {
      logger(`[Social Autopilot] Error processing ${item.email}:`, userErr.message);
      results.push({ email: item.email, status: "error", error: userErr.message });
    }
  }

  logger(`[Social Autopilot] Completed cycle. Processed ${results.length} accounts.`);
  return results;
}

module.exports = {
  runSocialAutopilotCycle,
  isLegitimateService,
};
