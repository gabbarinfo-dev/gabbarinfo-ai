/**
 * lib/autopilot/brand-integrity-guard.js
 *
 * UNBREAKABLE MULTI-TENANT BRAND INTEGRITY & ZERO CROSS-CONTAMINATION DEFENSE
 */

const KNOWN_INDUSTRY_VOCABULARY = {
  ASTROLOGY_PALMISTRY: [
    "palm scan", "palmistry", "palm reading", "hast rekha", "shastra", "vedic astrology",
    "kundli", "kundali", "horoscope", "samudrika", "jyotish", "gemstone", "mantra",
    "planetary", "zodiac", "rekhagyan", "rekha gyan", "ephemeris", "sub-millimeter palm"
  ],
  JEWELLERY_FASHION: [
    "jewellery", "jewelry", "earring", "necklace", "polki", "kundan", "choker",
    "bridal jewellery", "bangle", "bracelet", "pendant", "ring", "couture", "apparel",
    "anti-tarnish", "statement necklace"
  ],
  AUTOMOTIVE_TWO_WHEELER: [
    "two wheeler", "two-wheeler", "motorcycle", "bike repair", "bike mechanic", "scooter repair",
    "scooter mechanic", "moped", "bike servicing", "honda activa", "bullet repair", "royal enfield"
  ],
  AUTOMOTIVE_FOUR_WHEELER: [
    "car repair", "car mechanic", "four wheeler", "four-wheeler", "auto collision",
    "sedan", "suv", "truck", "automobile repair", "car diagnostics", "car maintenance"
  ],
  WELLNESS_SPA_MASSAGE: [
    "massage", "deep tissue massage", "spa therapy", "swedish massage", "body massage",
    "aromatherapy", "relaxation therapy", "wellness massage", "head massage"
  ],
  DIGITAL_MARKETING_TECH: [
    "digital marketing", "seo agency", "google ads management", "meta ads agency",
    "performance marketing", "video editing service", "website design agency",
    "conversion rate optimization", "e-commerce sales acceleration"
  ],
  HEALTH_CLINICAL: [
    "dental clinic", "physiotherapy", "pathology", "clinical diagnosis", "patient care",
    "surgery", "prescription", "medical appointment"
  ],
};

function normalizeText(str) {
  return String(str || "").toLowerCase().trim();
}

function extractDomainHostname(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch (_) {
    return "";
  }
}

export async function buildCrossBrandNegativeList({ supabase, userEmail, currentBusinessKey, currentSiteUrl }) {
  const currentKey = normalizeText(currentBusinessKey).replace(/[^a-z0-9]/g, "_");
  const currentHost = extractDomainHostname(currentSiteUrl);

  const forbiddenTerms = new Set();
  const foreignBrands = [];

  if (!supabase || !userEmail) {
    return { forbiddenTerms: [], foreignBrands: [] };
  }

  try {
    const { data: mems } = await supabase
      .from("agent_memory")
      .select("memory_type, content")
      .eq("email", userEmail.trim().toLowerCase())
      .or("memory_type.like.wp_conn_%,memory_type.like.wp_intel_%,memory_type.like.shopify_%,memory_type.like.meta_conn_%");

    for (const m of mems || []) {
      const mType = m.memory_type || "";
      let parsed = {};
      try {
        parsed = typeof m.content === "string" ? JSON.parse(m.content) : m.content || {};
      } catch (_) {
        continue;
      }

      const mKey = mType
        .replace(/^wp_conn_|^wp_intel_|^shopify_|^meta_conn_/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_");

      const itemSiteUrl = parsed.siteUrl || parsed.websiteUrl || parsed.shop || "";
      const itemHost = extractDomainHostname(itemSiteUrl);

      const isCurrentBrand = Boolean(
        (currentKey && mKey && (mKey === currentKey || mKey.includes(currentKey) || currentKey.includes(mKey))) ||
        (currentHost && itemHost && currentHost === itemHost)
      );

      if (isCurrentBrand) {
        continue;
      }

      const bName = parsed.brandName || parsed.businessName || parsed.pageName || mKey;
      foreignBrands.push({
        key: mKey,
        businessName: bName,
        siteHost: itemHost,
        industry: parsed.industry || "",
      });

      if (bName && bName.length > 2) {
        forbiddenTerms.add(normalizeText(bName));
        bName.split(/[\s_-]+/).forEach((word) => {
          if (word.length > 3 && !["solutions", "digital", "company", "services", "global", "online"].includes(normalizeText(word))) {
            forbiddenTerms.add(normalizeText(word));
          }
        });
      }

      if (itemHost) {
        const hostParts = itemHost.split(".")[0];
        if (hostParts && hostParts.length > 3) {
          forbiddenTerms.add(normalizeText(hostParts));
        }
      }

      if (Array.isArray(parsed.coreOfferings)) {
        parsed.coreOfferings.forEach((offering) => {
          const off = normalizeText(offering);
          if (off.length > 2) forbiddenTerms.add(off);
        });
      }

      if (Array.isArray(parsed.targetKeywords)) {
        parsed.targetKeywords.forEach((kw) => {
          const k = normalizeText(kw);
          if (k.length > 2) forbiddenTerms.add(k);
        });
      }

      const industryNorm = normalizeText(parsed.industry);
      const combinedForeignText = `${mKey} ${normalizeText(bName)} ${industryNorm}`;

      if (
        combinedForeignText.includes("astrolog") ||
        combinedForeignText.includes("palm") ||
        combinedForeignText.includes("vedic") ||
        combinedForeignText.includes("rekha") ||
        combinedForeignText.includes("gyan")
      ) {
        KNOWN_INDUSTRY_VOCABULARY.ASTROLOGY_PALMISTRY.forEach((term) => forbiddenTerms.add(term));
      }

      if (
        combinedForeignText.includes("jewel") ||
        combinedForeignText.includes("fashion") ||
        combinedForeignText.includes("apparel") ||
        combinedForeignText.includes("bella") ||
        combinedForeignText.includes("diva")
      ) {
        KNOWN_INDUSTRY_VOCABULARY.JEWELLERY_FASHION.forEach((term) => forbiddenTerms.add(term));
      }

      if (
        combinedForeignText.includes("digital") ||
        combinedForeignText.includes("marketing") ||
        combinedForeignText.includes("seo") ||
        combinedForeignText.includes("gabbar")
      ) {
        KNOWN_INDUSTRY_VOCABULARY.DIGITAL_MARKETING_TECH.forEach((term) => forbiddenTerms.add(term));
      }
    }
  } catch (err) {
    console.warn("[BrandIntegrityGuard] Warning: Failed to scan foreign brand profiles:", err.message);
  }

  if (currentHost) {
    const hostPrefix = currentHost.split(".")[0];
    forbiddenTerms.delete(normalizeText(hostPrefix));
  }
  if (currentKey) {
    currentKey.split("_").forEach((k) => forbiddenTerms.delete(normalizeText(k)));
  }

  const forbiddenList = Array.from(forbiddenTerms).filter((t) => t.length > 2);
  return { forbiddenTerms: forbiddenList, foreignBrands };
}

function matchesForbiddenTerm(text, term) {
  const tNorm = normalizeText(text);
  const termNorm = normalizeText(term);
  if (!tNorm || !termNorm) return false;

  // For multi-word phrases (e.g. "single scan trial", "ai palm scan"), substring match
  if (termNorm.includes(" ")) {
    return tNorm.includes(termNorm);
  }

  // For single words (e.g. "ring", "rekha", "kundli"), enforce word boundary match so "Mastering" is not falsely matched by "ring"
  const escaped = termNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i");
  return regex.test(tNorm);
}

export function filterCleanCandidateServices({ candidateServices = [], forbiddenTerms = [], logger = console.log }) {
  if (!Array.isArray(candidateServices) || forbiddenTerms.length === 0) {
    return candidateServices;
  }

  const clean = [];
  for (const s of candidateServices) {
    const sLower = normalizeText(s);
    let isViolating = false;
    let matchedViolation = "";

    for (const term of forbiddenTerms) {
      if (matchesForbiddenTerm(sLower, term)) {
        isViolating = true;
        matchedViolation = term;
        break;
      }
    }

    if (isViolating) {
      logger(`[BrandIntegrityGuard] 🛑 Cross-Contamination BLOCKED: Filtered out "${s}" (matched foreign brand term: "${matchedViolation}").`);
    } else {
      clean.push(s);
    }
  }

  return clean;
}

export function validateTopicRelevance({ topic, primaryKeyword = "", secondaryKeywords = [], forbiddenTerms = [], logger = console.log }) {
  if (forbiddenTerms.length === 0) return { ok: true };

  const fullTopicText = `${normalizeText(topic)} ${normalizeText(primaryKeyword)} ${Array.isArray(secondaryKeywords) ? secondaryKeywords.join(" ").toLowerCase() : ""}`;

  for (const term of forbiddenTerms) {
    if (matchesForbiddenTerm(fullTopicText, term)) {
      logger(`[BrandIntegrityGuard] 🚨 TOPIC REJECTED: Topic contains foreign brand violation "${term}": "${topic}".`);
      return { ok: false, violation: term };
    }
  }

  return { ok: true };
}

/**
 * Analyzes the business domain and returns strict service limitations, capability boundaries,
 * copywriter prompt mandates, and visual constraints.
 */
export function getBusinessLimitationProfile({ businessName = "", industry = "", currentSiteUrl = "", services = [] } = {}) {
  const combined = `${normalizeText(businessName)} ${normalizeText(industry)} ${(services || []).join(" ").toLowerCase()}`;

  const isTwoWheeler = (combined.includes("two wheeler") || combined.includes("two-wheeler") || combined.includes("motorcycle") || combined.includes("bike repair") || combined.includes("bike mechanic") || combined.includes("scooter")) && !combined.includes("car repair") && !combined.includes("auto collision");
  const isFourWheeler = (combined.includes("car repair") || combined.includes("car mechanic") || combined.includes("auto repair") || combined.includes("automobile repair") || combined.includes("four wheeler")) && !isTwoWheeler;
  const isJewellery = combined.includes("jewel") || combined.includes("fashion accessories") || combined.includes("necklace") || combined.includes("earring") || combined.includes("kundan") || combined.includes("polki") || combined.includes("bella");
  const isMassageSpa = combined.includes("massage") || combined.includes("spa") || combined.includes("wellness");
  const isAstrology = combined.includes("astrolog") || combined.includes("palm") || combined.includes("vedic") || combined.includes("rekha") || combined.includes("kundli");
  const isMarketingAgency = combined.includes("marketing") || combined.includes("seo") || combined.includes("google ads") || combined.includes("meta ads") || combined.includes("video editing") || combined.includes("agency");

  if (isJewellery) {
    return {
      domainCategory: "PHYSICAL_JEWELLERY_FASHION",
      allowedCapabilities: "Physical handcrafted fine jewellery, necklaces, earrings, rings, bridal sets, anti-tarnish jewelry, styling tips, material craftsmanship.",
      forbiddenCapabilities: [
        "scan", "single scan", "scan trial", "virtual scan", "virtual trial", "virtual try-on",
        "ar try-on", "ar try on", "virtual fitting", "phone scanner", "qr scan", "3d scan",
        "mobile app", "software", "ai scan", "digital diagnostic", "seo agency", "google ads",
        "marketing agency", "palm reading", "horoscope", "car repair", "bike repair"
      ],
      promptLimitationsDirective: `STRICT CAPABILITY & SERVICE BOUNDARY MANDATE:
- This business is an EXCLUSIVELY physical luxury designer jewellery and fashion accessories brand.
- They sell physical jewellery only.
- They have ZERO virtual trial services, ZERO scanning apps, ZERO mobile applications, ZERO AR tools, and ZERO digital diagnostics.
- NEVER mention, promise, or imply "scan to try", "virtual trials", "single scan", "scan now", "app preview", or digital scanning features under ANY circumstances!
- Focus 100% strictly on physical craftsmanship, elegant real-world styling, material quality (gold, polki, kundan, anti-tarnish), and tangible products.`,
      visualDirectives: {
        domainTheme: "High Luxury Artisanal Fine Jewellery",
        requiredAesthetic: "Exquisite couture textures, handcrafted fine gold/silver filigree, high-end editorial lighting, luxury boutique styling, physical marble/travertine pedestals, human model or luxury neck bust display",
        negativeConstraints: "NO smartphone app mockups, NO phone screens, NO QR codes, NO scanning frames, NO digital UI dashboards, NO virtual trial overlays, NO holographic tech, NO software code, NO marketing analytics, NO cars, NO astrology charts",
      }
    };
  }

  if (isTwoWheeler) {
    return {
      domainCategory: "TWO_WHEELER_MECHANIC",
      allowedCapabilities: "Two-wheeler, motorcycle, and scooter maintenance, engine tuning, brake repairs, oil changes, tire replacement, genuine bike spare parts.",
      forbiddenCapabilities: [
        "car", "cars", "four wheeler", "four-wheeler", "sedan", "suv", "truck", "van",
        "automobile repair", "virtual scan", "seo", "digital marketing", "astrology", "jewellery"
      ],
      promptLimitationsDirective: `STRICT CAPABILITY & SERVICE BOUNDARY MANDATE:
- This business is EXCLUSIVELY a Two-Wheeler / Motorcycle / Scooter mechanic and service center.
- They do NOT service cars, 4-wheelers, sedans, SUVs, or trucks.
- NEVER mention or promise car repairs, automobile maintenance, or four-wheeler servicing!
- Focus 100% strictly on motorcycles, bikes, scooters, and authentic two-wheeler workshop services.`,
      visualDirectives: {
        domainTheme: "Professional Two-Wheeler & Motorcycle Workshop",
        requiredAesthetic: "Authentic motorcycle/scooter workshop, specialized two-wheeler mechanic tools, precision bike components, clean organized service bay",
        negativeConstraints: "NO cars, NO four-wheelers, NO sedans, NO SUVs, NO trucks, NO smartphone app mockups, NO QR codes, NO digital tech dashboards",
      }
    };
  }

  if (isFourWheeler) {
    return {
      domainCategory: "FOUR_WHEELER_MECHANIC",
      allowedCapabilities: "Car repair, automobile maintenance, engine diagnostics, brake servicing, automotive detailing, oil change.",
      forbiddenCapabilities: [
        "motorcycle", "bike repair", "scooter", "two wheeler", "two-wheeler", "moped",
        "astrology", "jewellery", "seo agency"
      ],
      promptLimitationsDirective: `STRICT CAPABILITY & SERVICE BOUNDARY MANDATE:
- This business is an Automotive Car Mechanic and repair garage.
- They service cars and passenger automobiles.
- NEVER promote motorcycle or two-wheeler services unless explicitly requested.`,
      visualDirectives: {
        domainTheme: "Automotive Car Service & Repair Bay",
        requiredAesthetic: "Modern auto service garage, automotive lift, genuine car maintenance tools, clean professional workshop",
        negativeConstraints: "NO motorcycles, NO scooters, NO two-wheelers, NO jewellery, NO astrology",
      }
    };
  }

  if (isMassageSpa) {
    return {
      domainCategory: "WELLNESS_SPA_MASSAGE",
      allowedCapabilities: "Physical therapeutic massage, deep tissue massage, Swedish massage, aromatherapy, body relaxation, stress relief, wellness treatments.",
      forbiddenCapabilities: [
        "seo", "google ads", "meta ads", "marketing", "website design", "video editing",
        "digital marketing", "surgery", "prescription", "diagnostic scan", "car repair", "bike repair", "jewellery retail"
      ],
      promptLimitationsDirective: `STRICT CAPABILITY & SERVICE BOUNDARY MANDATE:
- This business is an EXCLUSIVELY physical massage, spa, and wellness therapy center.
- They provide in-person physical relaxation, massage therapies, and stress relief.
- They do NOT provide digital marketing, SEO, website design, or medical surgery.
- NEVER mention digital marketing, SEO, Google ads, or clinical medical operations!
- Focus 100% strictly on physical relaxation, professional massage techniques, and peaceful wellness.`,
      visualDirectives: {
        domainTheme: "Serene Wellness & Spa Sanctuary",
        requiredAesthetic: "Serene wellness spa ambiance, warm aromatic candles, essential oils, plush luxury towels, natural bamboo and stone textures",
        negativeConstraints: "NO computer screens, NO laptops, NO marketing graphs, NO medical surgery tools, NO cars, NO jewellery, NO software dashboards",
      }
    };
  }

  if (isAstrology) {
    return {
      domainCategory: "ASTROLOGY_PALMISTRY",
      allowedCapabilities: "Vedic astrology analysis, traditional palmistry principles, horoscope insights, kundali matchmaking, celestial guidance.",
      forbiddenCapabilities: [
        "jewellery retail", "earring", "necklace", "car repair", "bike repair", "seo agency",
        "software development", "surgery", "medical cure guarantee"
      ],
      promptLimitationsDirective: `STRICT CAPABILITY & SERVICE BOUNDARY MANDATE:
- This business provides traditional Vedic astrology and palmistry insights.
- Focus 100% strictly on authentic astrological wisdom, birth chart guidance, and ethical life direction.
- NEVER guarantee medical cures, legal outcomes, or jackpot wins.`,
      visualDirectives: {
        domainTheme: "Classical Vedic Shastras & Sacred Astronomical Insights",
        requiredAesthetic: "Authentic classical astronomical charts, celestial constellations, parchment treatises, sacred warm oil lamp ambiance",
        negativeConstraints: "NO computer screens, NO modern corporate agency charts, NO marketing funnels, NO laptops, NO ecommerce shopping carts, NO jewellery retail",
      }
    };
  }

  if (isMarketingAgency) {
    return {
      domainCategory: "DIGITAL_AGENCY_MARKETING",
      allowedCapabilities: "High-performance digital marketing, Meta and Google ad campaigns, video editing, SEO optimization, brand identity, website design.",
      forbiddenCapabilities: [
        "palmistry", "astrology", "jewellery retail", "car mechanic", "bike repair",
        "massage therapy", "medical surgery"
      ],
      promptLimitationsDirective: `STRICT CAPABILITY & SERVICE BOUNDARY MANDATE:
- This business is a premier digital marketing agency.
- Focus 100% strictly on commercial growth, lead generation, creative production, ad performance, and measurable ROI.`,
      visualDirectives: {
        domainTheme: "Modern Digital Agency & Performance Tech",
        requiredAesthetic: "Sleek dark luxury slate UI, 3D holographic panels, modern agency workspace, analytics dashboards, clean typography",
        negativeConstraints: "NO palmistry, NO astrology, NO mystical Sanskrit scrolls, NO religious deities, NO gemstones, NO jewellery, NO medical instruments, NO unrelated industry symbols",
      }
    };
  }

  // General Business Fallback
  return {
    domainCategory: "GENERAL_BUSINESS",
    allowedCapabilities: `Verified commercial services and offerings for ${businessName}.`,
    forbiddenCapabilities: [
      "virtual scan", "single scan", "scan trial", "palmistry", "horoscope"
    ],
    promptLimitationsDirective: `STRICT CAPABILITY & SERVICE BOUNDARY MANDATE:
- Promote ONLY real, tangible services and products explicitly offered by ${businessName}.
- NEVER invent, assume, or promise non-existent features, software, virtual trial scans, digital apps, or capabilities outside the exact verified scope.`,
    visualDirectives: {
      domainTheme: `${businessName} Commercial Solutions`,
      requiredAesthetic: "Professional modern business aesthetic, clean composition, crisp studio lighting",
      negativeConstraints: "NO unrelated industry symbols, NO out-of-context religious or mystical elements, NO fictional scanning apps",
    }
  };
}

/**
 * Validates text content (caption, hook, topic, graphicPrompt) against business limitation rules.
 */
export function validateContentLimitations({ text = "", limitationProfile, logger = console.log } = {}) {
  if (!text || !limitationProfile || !Array.isArray(limitationProfile.forbiddenCapabilities)) {
    return { ok: true };
  }

  const norm = normalizeText(text);

  for (const forbidden of limitationProfile.forbiddenCapabilities) {
    if (matchesForbiddenTerm(norm, forbidden)) {
      logger(`[BrandIntegrityGuard] 🚨 LIMITATION BREACH: Content contains forbidden capability "${forbidden}" for domain "${limitationProfile.domainCategory}".`);
      return { ok: false, violation: forbidden, domain: limitationProfile.domainCategory };
    }
  }

  return { ok: true };
}

/**
 * Generates negative visual constraints to prevent AI images from borrowing foreign motifs.
 */
export function getVisualGuardDirectives({ businessName, industry, currentSiteUrl, services = [] }) {
  const profile = getBusinessLimitationProfile({ businessName, industry, currentSiteUrl, services });
  return profile.visualDirectives;
}
