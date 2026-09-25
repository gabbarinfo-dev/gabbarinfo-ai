/**
 * video-worker/lib/brand-integrity-guard.js
 *
 * UNBREAKABLE MULTI-TENANT BRAND INTEGRITY & ZERO CROSS-CONTAMINATION DEFENSE
 */

const KNOWN_INDUSTRY_VOCABULARY = {
  ASTROLOGY_PALMISTRY: [
    "palm scan", "palmistry", "palm reading", "hast rekha", "shastra", "vedic astrology",
    "kundli", "kundali", "horoscope", "samudrika", "jyotish", "gemstone", "mantra",
    "planetary", "zodiac", "rekhagyan", "rekha gyan", "ephemeris", "sub-millimeter palm",
    "single scan", "pro vedic"
  ],
  JEWELLERY_FASHION: [
    "jewellery", "jewelry", "earring", "necklace", "polki", "kundan", "choker",
    "bridal jewellery", "bangle", "bracelet", "pendant", "ring", "couture", "apparel"
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

/**
 * Discovers all foreign brands belonging to the same user and compiles a strict negative keyword list.
 */
async function buildCrossBrandNegativeList({ supabase, userEmail, currentBusinessKey, currentSiteUrl }) {
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

  // Remove any term that matches the CURRENT business name or domain
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

/**
 * Filters out any candidate services that conflict with forbidden foreign brand terms.
 */
function filterCleanCandidateServices({ candidateServices = [], forbiddenTerms = [], logger = console.log }) {
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

/**
 * Validates that a generated topic does not contain cross-contaminated terms.
 */
function validateTopicRelevance({ topic, primaryKeyword = "", secondaryKeywords = [], forbiddenTerms = [], logger = console.log }) {
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
 * Generates negative visual constraints to prevent AI images from borrowing foreign motifs.
 */
function getVisualGuardDirectives({ businessName, industry, currentSiteUrl }) {
  const ind = normalizeText(industry);
  const isMarketing = ind.includes("marketing") || ind.includes("seo") || ind.includes("design") || ind.includes("digital");
  const isAstrology = ind.includes("astrolog") || ind.includes("palm") || ind.includes("vedic");
  const isJewellery = ind.includes("jewel") || ind.includes("fashion") || ind.includes("apparel");

  if (isMarketing) {
    return {
      domainTheme: "Modern Digital Agency & Performance Tech",
      requiredAesthetic: "Sleek dark luxury slate UI, 3D holographic panels, modern agency workspace, analytics dashboards, clean typography",
      negativeConstraints: "NO palmistry, NO astrology, NO mystical Sanskrit scrolls, NO religious deities, NO gemstones, NO jewellery, NO medical instruments, NO unrelated industry symbols",
    };
  }

  if (isAstrology) {
    return {
      domainTheme: "Classical Vedic Shastras & Sacred Astronomical Insights",
      requiredAesthetic: "Authentic classical astronomical charts, celestial constellations, parchment treatises, sacred warm oil lamp ambiance",
      negativeConstraints: "NO computer screens, NO modern corporate agency charts, NO marketing funnels, NO laptops, NO ecommerce shopping carts",
    };
  }

  if (isJewellery) {
    return {
      domainTheme: "High Luxury Artisanal Fine Jewellery",
      requiredAesthetic: "Exquisite couture textures, handcrafted fine gold/silver filigree, high-end editorial lighting, luxury boutique styling",
      negativeConstraints: "NO software code, NO marketing analytics, NO astrology charts, NO tech hardware",
    };
  }

  return {
    domainTheme: `${businessName} Commercial Solutions`,
    requiredAesthetic: "Professional modern business aesthetic, clean composition, crisp studio lighting",
    negativeConstraints: "NO unrelated industry symbols, NO out-of-context religious or mystical elements",
  };
}

module.exports = {
  buildCrossBrandNegativeList,
  filterCleanCandidateServices,
  validateTopicRelevance,
  getVisualGuardDirectives,
};
