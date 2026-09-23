// video-worker/lib/meta-campaign-service.js
/**
 * Dedicated Meta Ads Campaign & Creative Orchestration Service for Railway Worker.
 * Handles the entire Meta Graph API campaign creation lifecycle without serverless timeouts:
 * - Preflight authentication & identity verification
 * - Instagram actor authorization & profile resolution
 * - Universal location search & resolution (adgeolocation)
 * - Strict ODAX objective mapping & multi-stage safe fallback
 * - Dynamic currency, Pixel & Catalog discovery
 * - Ad Set creation with automated budget calculation & WhatsApp wa.me fallback
 * - Creative creation with self-healing image upload, fast SVG banner fallback, and DOF specs
 * - Ad publishing and verification
 */

const OpenAI = require("openai");
const sharp = require("sharp");

const ACCENT_COLORS = ["#FFD700", "#FF6B6B", "#00D4FF", "#00E5A0", "#FF9F43", "#C77DFF"];

function escapeXml(unsafe) {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizePhoneNumber(number) {
  if (!number) return null;
  const cleaned = number.replace(/\D/g, "");
  if (cleaned.startsWith("91")) {
    return "+" + cleaned;
  }
  if (cleaned.length === 10) {
    return "+91" + cleaned;
  }
  return "+" + cleaned;
}

// THE GOLDEN RULE MAPPER (ODAX / Outcome-Based)
function mapObjectiveToODAX(obj, logger = console.log) {
  const o = (obj || "").toString().toUpperCase();
  logger(`[mapObjectiveToODAX] Input: "${obj}" -> Upper: "${o}"`);

  if (o === "OUTCOME_TRAFFIC" || o === "TRAFFIC") return "OUTCOME_TRAFFIC";
  if (o === "OUTCOME_LEADS" || o === "LEAD_GENERATION" || o === "LEADS") return "OUTCOME_LEADS";
  if (o === "OUTCOME_SALES" || o === "SALES" || o === "CONVERSIONS") return "OUTCOME_SALES";
  if (o === "OUTCOME_ENGAGEMENT" || o === "MESSAGES" || o === "ENGAGEMENT") return "OUTCOME_ENGAGEMENT";
  if (o === "OUTCOME_AWARENESS" || o === "AWARENESS" || o === "REACH") return "OUTCOME_AWARENESS";
  if (o === "OUTCOME_APP_PROMOTION" || o === "APP_INSTALLS") return "OUTCOME_APP_PROMOTION";

  // Fuzzy Matches
  if (o.includes("TRAFFIC") || o.includes("LINK") || o.includes("CLICK") || o.includes("VISIT")) return "OUTCOME_TRAFFIC";
  if (o.includes("LEAD") || o.includes("PROSPECT") || o.includes("FORM")) return "OUTCOME_LEADS";
  if (o.includes("SALE") || o.includes("CONVERSION") || o.includes("PURCHASE")) return "OUTCOME_SALES";
  if (o.includes("MESSAGE") || o.includes("CHAT") || o.includes("WHATSAPP")) return "OUTCOME_ENGAGEMENT";
  if (o.includes("AWARENESS") || o.includes("BRAND")) return "OUTCOME_AWARENESS";

  logger(`[mapObjectiveToODAX] Fallback Result: OUTCOME_TRAFFIC`);
  return "OUTCOME_TRAFFIC";
}

/**
 * Composites a clean marketing overlay onto an image buffer using Sharp's built-in SVG compositor.
 */
async function applyMetaAdOverlay({ imageBuffer, service = "", offer = "", tagline = "", businessName = "" }) {
  try {
    const accentColor = ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
    const cleanService = escapeXml((service || "").toUpperCase().slice(0, 50));
    const cleanOffer = escapeXml((offer || "").toUpperCase().slice(0, 45));
    const cleanTagline = escapeXml((tagline || "").slice(0, 60));
    const cleanBrand = escapeXml((businessName || "").toUpperCase().slice(0, 35));
    const hasOffer = cleanOffer && cleanOffer !== "NONE";

    const svgOverlay = `
      <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#000000" stop-opacity="0.0"/>
            <stop offset="35%" stop-color="#050811" stop-opacity="0.75"/>
            <stop offset="100%" stop-color="#020408" stop-opacity="0.95"/>
          </linearGradient>
          <linearGradient id="badgeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="${accentColor}"/>
            <stop offset="100%" stop-color="#FF9F43"/>
          </linearGradient>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" flood-opacity="0.6"/>
          </filter>
        </defs>

        <!-- Top-left Brand Badge -->
        ${cleanBrand ? `
          <g transform="translate(48, 48)">
            <rect x="0" y="0" width="${Math.max(160, cleanBrand.length * 14 + 40)}" height="46" rx="23" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
            <circle cx="23" cy="23" r="6" fill="${accentColor}"/>
            <text x="38" y="29" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="#FFFFFF" letter-spacing="1">${cleanBrand}</text>
          </g>
        ` : ""}

        <!-- Bottom Gradient Panel -->
        <rect x="0" y="580" width="1080" height="500" fill="url(#bottomFade)"/>

        <!-- Service / Product Name -->
        <text x="540" y="810" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" fill="#FFFFFF" letter-spacing="0.5" filter="url(#shadow)">
          ${cleanService}
        </text>

        <!-- Tagline -->
        ${cleanTagline ? `
          <text x="540" y="860" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="500" fill="#E2E8F0" letter-spacing="0.3">
            ${cleanTagline}
          </text>
        ` : ""}

        <!-- Promotional Offer Badge -->
        ${hasOffer ? `
          <g transform="translate(540, 930)">
            <rect x="-240" y="-30" width="480" height="60" rx="30" fill="url(#badgeGrad)" filter="url(#shadow)"/>
            <text x="0" y="9" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="900" fill="#000000" letter-spacing="1">
              🎁 ${cleanOffer}
            </text>
          </g>
        ` : ""}
      </svg>
    `;

    const processedBuffer = await sharp(imageBuffer)
      .resize(1080, 1080, { fit: "cover" })
      .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();

    return processedBuffer;
  } catch (err) {
    console.warn("[MetaCampaignService] Overlay generation warning:", err.message);
    return imageBuffer;
  }
}

/**
 * Generates an ad graphic using OpenAI and saves it to Supabase storage.
 */
async function generateAdGraphic({
  openaiClient,
  supabaseClient,
  prompt,
  service,
  offer,
  tagline,
  businessName,
  logger = console.log,
}) {
  logger(`[MetaCampaignService] Generating visual with prompt: "${prompt.slice(0, 70)}..."`);
  const candidateModels = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1"];
  let rawBuffer = null;

  for (const model of candidateModels) {
    try {
      logger(`[MetaCampaignService] Trying model: ${model}...`);
      const res = await openaiClient.images.generate({
        model,
        prompt,
        size: "1024x1024",
      });

      const url = res?.data?.[0]?.url;
      const b64 = res?.data?.[0]?.b64_json;

      if (b64) {
        rawBuffer = Buffer.from(b64, "base64");
        break;
      } else if (url) {
        const fetchRes = await fetch(url);
        rawBuffer = Buffer.from(await fetchRes.arrayBuffer());
        break;
      }
    } catch (err) {
      logger(`[MetaCampaignService] Model ${model} failed: ${err.message}`);
    }
  }

  if (!rawBuffer) {
    throw new Error("Failed to generate image across all approved AI models.");
  }

  const overlaidBuffer = await applyMetaAdOverlay({
    imageBuffer: rawBuffer,
    service,
    offer,
    tagline,
    businessName,
  });

  let publicUrl = null;
  const storageFileName = `meta_ad_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.storage
        .from("instagram-creatives")
        .upload(storageFileName, overlaidBuffer, { contentType: "image/jpeg", upsert: true });

      if (!error && data) {
        const { data: pub } = supabaseClient.storage.from("instagram-creatives").getPublicUrl(storageFileName);
        publicUrl = pub.publicUrl;
      }
    } catch (sErr) {
      logger(`[MetaCampaignService] Storage upload warning: ${sErr.message}`);
    }
  }

  return {
    imageBuffer: overlaidBuffer,
    imageUrl: publicUrl,
    storageFileName,
  };
}

/**
 * Uploads an image buffer or URL directly to Facebook Ad Account (/adimages)
 */
async function uploadImageToMeta({ adAccountId, accessToken, imageBuffer, imageUrl, logger = console.log }) {
  const cleanAdId = (adAccountId || "").toString().replace(/^act_/, "");
  const graphUrl = `https://graph.facebook.com/v21.0/act_${cleanAdId}/adimages`;

  logger(`[MetaCampaignService] Uploading image to act_${cleanAdId}...`);

  let bufferToUpload = imageBuffer;
  if (!bufferToUpload && imageUrl) {
    const fRes = await fetch(imageUrl);
    if (fRes.ok) {
      bufferToUpload = Buffer.from(await fRes.arrayBuffer());
    }
  }

  if (!bufferToUpload) {
    throw new Error("No image data available for Meta upload.");
  }

  const blob = new Blob([bufferToUpload], { type: "image/jpeg" });
  const form = new FormData();
  form.append("source", blob, "ad_creative.jpg");
  form.append("access_token", accessToken);

  const res = await fetch(graphUrl, { method: "POST", body: form });
  const json = await res.json();

  if (json.error) {
    throw new Error(`Meta image upload failed: ${json.error.message || JSON.stringify(json.error)}`);
  }

  const images = json.images || {};
  const firstKey = Object.keys(images)[0];
  const imageHash = images[firstKey]?.hash;

  if (!imageHash) {
    throw new Error("Meta image upload succeeded but returned no image_hash.");
  }

  logger(`[MetaCampaignService] Image uploaded successfully. Hash: ${imageHash}`);
  return imageHash;
}

// Auto-discover Pixel if missing from DB
async function getAutoPixelId(adAccountId, accessToken, apiVersion, logger = console.log) {
  try {
    logger(`🔍 [Pixel Discovery] Searching for pixels in act_${adAccountId}...`);
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/act_${adAccountId}/adspixels?access_token=${accessToken}`
    );
    const json = await res.json();

    if (json.data && json.data.length > 0) {
      const foundId = json.data[0].id;
      logger(`✅ [Pixel Discovery] Found Pixel ID: ${foundId}`);
      return foundId;
    }
    return null;
  } catch (e) {
    logger(`❌ [Pixel Discovery] Failed: ${e.message}`);
    return null;
  }
}

async function findCatalogs(endpoint, accessToken, logger = console.log) {
  try {
    const res = await fetch(endpoint);
    const json = await res.json();
    return json.data || [];
  } catch (e) {
    logger(`⚠️ [Catalogue Search] Failed endpoint ${endpoint}: ${e.message}`);
    return [];
  }
}

async function getProductCatalogAndSet(adAccountId, accessToken, apiVersion, businessId, pageId, manualCatalogId = null, manualProductSetId = null, logger = console.log) {
  try {
    if (manualCatalogId && manualCatalogId !== "default") {
      logger(`🛍️ [Catalogue Discovery] Using manual Catalog ID: ${manualCatalogId}`);
      let resolvedPS = (manualProductSetId && manualProductSetId !== "default") ? manualProductSetId : null;
      if (!resolvedPS) {
        try {
          const psRes = await fetch(`https://graph.facebook.com/${apiVersion}/${manualCatalogId}/product_sets?fields=id,name,product_count&access_token=${accessToken}`);
          const psJson = await psRes.json();
          if (psJson?.data?.length) {
            const bestPS = psJson.data.find(ps => ps.name?.toLowerCase().includes("all product")) || psJson.data[0];
            resolvedPS = bestPS.id;
            logger(`✅ [Catalogue Discovery] Auto-resolved Product Set from Catalog ${manualCatalogId}: "${bestPS.name}" (ID: ${resolvedPS})`);
          }
        } catch (e) {
          logger(`⚠️ [Catalogue Discovery] Product set fetch failed: ${e.message}`);
        }
      }
      return { catalogId: manualCatalogId, catalogName: "Manual/Synced Catalogue", productSetId: resolvedPS };
    }

    logger(`🔎 [Deep Discovery] Starting exhaustive search for act_${adAccountId}...`);
    const allCatalogs = [];

    const endpoints = [
      businessId ? `https://graph.facebook.com/${apiVersion}/${businessId}/owned_product_catalogs?fields=id,name,product_count&access_token=${accessToken}` : null,
      `https://graph.facebook.com/${apiVersion}/act_${adAccountId}/product_catalogs?fields=id,name,product_count&access_token=${accessToken}`,
      `https://graph.facebook.com/${apiVersion}/act_${adAccountId}/client_product_catalogs?fields=id,name,product_count&access_token=${accessToken}`,
      `https://graph.facebook.com/${apiVersion}/act_${adAccountId}/assigned_product_catalogs?fields=id,name,product_count&access_token=${accessToken}`,
      pageId ? `https://graph.facebook.com/${apiVersion}/${pageId}/product_catalogs?fields=id,name,product_count&access_token=${accessToken}` : null,
      businessId ? `https://graph.facebook.com/${apiVersion}/${businessId}/assigned_product_catalogs?fields=id,name,product_count&access_token=${accessToken}` : null,
      businessId ? `https://graph.facebook.com/${apiVersion}/${businessId}/client_product_catalogs?fields=id,name,product_count&access_token=${accessToken}` : null
    ].filter(Boolean);

    for (const url of endpoints) {
      const found = await findCatalogs(url, accessToken, logger);
      allCatalogs.push(...found);
    }

    const uniqueCatalogs = Array.from(new Map(allCatalogs.map(c => [c.id, c])).values());

    if (uniqueCatalogs.length === 0) {
      logger("ℹ️ [Deep Discovery] No catalogs found across any endpoint.");
      return null;
    }

    logger(`📊 [Deep Discovery] Found ${uniqueCatalogs.length} potential catalogs. Ranking...`);

    uniqueCatalogs.sort((a, b) => {
      const aCount = a.product_count || 0;
      const bCount = b.product_count || 0;
      const aBrand = (a.name || "").toLowerCase().includes("bella") || (a.name || "").toLowerCase().includes("diva");
      const bBrand = (b.name || "").toLowerCase().includes("bella") || (b.name || "").toLowerCase().includes("diva");

      if (aBrand && !bBrand) return -1;
      if (!aBrand && bBrand) return 1;
      if (aCount > 0 && bCount === 0) return -1;
      if (aCount === 0 && bCount > 0) return 1;
      return bCount - aCount;
    });

    const finalCatalog = uniqueCatalogs[0];
    logger(`✅ [Deep Discovery] Winner: "${finalCatalog.name}" (ID: ${finalCatalog.id}, Products: ${finalCatalog.product_count || 0})`);

    let productSetId = manualProductSetId || null;
    if (!productSetId || productSetId === "default") {
      try {
        const psRes = await fetch(`https://graph.facebook.com/${apiVersion}/${finalCatalog.id}/product_sets?fields=id,name,product_count&access_token=${accessToken}`);
        const psJson = await psRes.json();
        if (psJson.data && psJson.data.length > 0) {
          const bestPS = psJson.data.find(ps => ps.name?.toLowerCase().includes("all product")) || psJson.data[0];
          productSetId = bestPS.id;
          logger(`✅ [Deep Discovery] Product Set: "${bestPS.name}" (ID: ${productSetId})`);
        }
      } catch (e) {
        logger(`⚠️ [Deep Discovery] Product set fetch failed: ${e.message}`);
      }
    }

    return { catalogId: finalCatalog.id, catalogName: finalCatalog.name, productSetId };
  } catch (e) {
    logger(`❌ [Deep Discovery] Failed: ${e.message}`);
    return null;
  }
}

async function getAdAccountCurrency(adAccountId, accessToken, apiVersion, logger = console.log) {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/act_${adAccountId}?fields=currency&access_token=${accessToken}`
    );
    const json = await res.json();
    if (json.currency) {
      logger(`💱 [Currency] Ad Account currency: ${json.currency}`);
      return json.currency;
    }
    return "USD";
  } catch (e) {
    logger(`⚠️ [Currency] Could not detect currency: ${e.message}`);
    return "USD";
  }
}

// UNIVERSAL AD SET BUILDER (Strict ODAX Compliance)
async function buildAdSetPayload(objective, adSet, campaignId, accessToken, placements, pageId, metaPixelId, payload, instagramActorId, logger = console.log) {
  const params = new URLSearchParams();

  params.append("name", adSet.name || "Ad Set 1");
  params.append("campaign_id", campaignId);
  params.append("status", "ACTIVE");
  params.append("access_token", accessToken);
  params.append("bid_strategy", "LOWEST_COST_WITHOUT_CAP");

  const startTime = new Date(Date.now() + 5 * 60 * 1000);
  params.append("start_time", startTime.toISOString());

  let optimization_goal = "LINK_CLICKS";
  let billing_event = "IMPRESSIONS";
  let destination_type = "WEBSITE";
  let promoted_object = null;

  let conversionLocation = (adSet.conversion_location || "").toUpperCase();

  if (conversionLocation === "MESSAGING_APPS" || conversionLocation === "MESSAGES") {
    const channel = (adSet.message_channel || "").toUpperCase();
    const creativeCTA = (adSet.ad_creative?.call_to_action || "").toUpperCase();

    if (channel === "WHATSAPP" || channel === "WHATSAPP_MESSAGES" || creativeCTA === "WHATSAPP_MESSAGE") {
      conversionLocation = "WHATSAPP";
      logger("📍 [AdSet] Normalized MESSAGING_APPS → WHATSAPP (from channel/CTA)");
    } else if (channel === "INSTAGRAM_MESSAGES" || creativeCTA === "INSTAGRAM_MESSAGE") {
      conversionLocation = "INSTAGRAM_DIRECT";
      logger("📍 [AdSet] Normalized MESSAGING_APPS → INSTAGRAM_DIRECT");
    } else if (channel === "FACEBOOK_MESSENGER" || creativeCTA === "MESSAGE_PAGE") {
      conversionLocation = "MESSENGER";
      logger("📍 [AdSet] Normalized MESSAGING_APPS → MESSENGER");
    }
  }

  switch (objective) {
    case "OUTCOME_TRAFFIC":
      if (conversionLocation === "WHATSAPP") {
        destination_type = "WHATSAPP";
        optimization_goal = "CONVERSATIONS";
        billing_event = "IMPRESSIONS";
        promoted_object = { page_id: pageId };
        logger("📍 [AdSet] Using CONVERSATIONS for TRAFFIC + WhatsApp (correct ODAX rule).");
      } else if (conversionLocation === "MESSAGES" || conversionLocation === "MESSAGING_APPS" || conversionLocation === "INSTAGRAM_DIRECT" || conversionLocation === "MESSENGER") {
        const channel = (adSet.message_channel || "").toUpperCase();
        if (channel === "WHATSAPP" || channel === "WHATSAPP_MESSAGES") {
          destination_type = "WHATSAPP";
        } else if (channel === "INSTAGRAM_MESSAGES" || conversionLocation === "INSTAGRAM_DIRECT") {
          destination_type = "INSTAGRAM_DIRECT";
        } else if (channel === "FACEBOOK_MESSENGER" || conversionLocation === "MESSENGER") {
          destination_type = "MESSENGER";
        } else {
          destination_type = conversionLocation === "INSTAGRAM_DIRECT" ? "INSTAGRAM_DIRECT" : "MESSENGER";
        }
        optimization_goal = "CONVERSATIONS";
        billing_event = "IMPRESSIONS";
        promoted_object = { page_id: pageId };
      } else if (conversionLocation === "CALLS") {
        destination_type = "WEBSITE";
        optimization_goal = "LINK_CLICKS";
        billing_event = "IMPRESSIONS";
      } else if (conversionLocation === "INSTAGRAM_PROFILE") {
        if (!instagramActorId) {
          throw new Error("Instagram Profile Visits require a connected Instagram account. Please connect your Instagram profile to your Facebook Page first.");
        }
        destination_type = "INSTAGRAM_PROFILE";
        optimization_goal = "VISIT_INSTAGRAM_PROFILE";
        billing_event = "IMPRESSIONS";
        promoted_object = { page_id: pageId };
        logger("📍 [AdSet] Using INSTAGRAM_PROFILE destination and VISIT_INSTAGRAM_PROFILE goal.");
      } else if (conversionLocation === "FACEBOOK_PAGE") {
        destination_type = "FACEBOOK_PAGE";
        optimization_goal = "LINK_CLICKS";
        billing_event = "IMPRESSIONS";
        promoted_object = { page_id: pageId };
        logger("📍 [AdSet] Using FACEBOOK_PAGE destination.");
      } else {
        destination_type = "WEBSITE";
        optimization_goal = "LINK_CLICKS";
        billing_event = "IMPRESSIONS";
      }
      break;

    case "OUTCOME_LEADS":
      if (conversionLocation === "WHATSAPP") {
        destination_type = "WHATSAPP";
        optimization_goal = "CONVERSATIONS";
        billing_event = "IMPRESSIONS";
        promoted_object = { page_id: pageId };
        logger("📍 [AdSet] Using CONVERSATIONS goal for LEADS + WhatsApp destination.");
      } else if (conversionLocation === "MESSAGING_APPS" || conversionLocation === "MESSAGES" || conversionLocation === "MESSENGER" || conversionLocation === "INSTAGRAM_DIRECT") {
        const channel = (adSet.message_channel || "").toUpperCase();
        if (channel === "WHATSAPP" || channel === "WHATSAPP_MESSAGES") {
          destination_type = "WHATSAPP";
        } else if (channel === "INSTAGRAM_MESSAGES") {
          destination_type = "INSTAGRAM_DIRECT";
        } else {
          destination_type = "MESSENGER";
        }
        optimization_goal = "CONVERSATIONS";
        billing_event = "IMPRESSIONS";
        promoted_object = { page_id: pageId };
        logger(`📍 [AdSet] Using CONVERSATIONS goal for LEADS + ${destination_type} destination.`);
      } else if (conversionLocation === "CALLS") {
        destination_type = "WEBSITE";
        optimization_goal = "LINK_CLICKS";
        billing_event = "IMPRESSIONS";
      } else {
        optimization_goal = "LEAD_GENERATION";
        billing_event = "IMPRESSIONS";
        promoted_object = { page_id: pageId };
      }
      break;

    case "OUTCOME_AWARENESS":
      optimization_goal = "REACH";
      billing_event = "IMPRESSIONS";
      destination_type = undefined;
      break;

    case "OUTCOME_ENGAGEMENT":
      billing_event = "IMPRESSIONS";
      optimization_goal = "CONVERSATIONS";

      if (conversionLocation === "WHATSAPP") {
        destination_type = "WHATSAPP";
        promoted_object = { page_id: pageId };
        logger("📍 [AdSet] ENGAGEMENT + WhatsApp: CONVERSATIONS goal.");
      } else if (conversionLocation === "MESSAGING_APPS" || conversionLocation === "MESSAGES" || conversionLocation === "INSTAGRAM_DIRECT" || conversionLocation === "MESSENGER") {
        const channel = (adSet.message_channel || "").toUpperCase();
        if (channel === "INSTAGRAM_MESSAGES") {
          destination_type = "INSTAGRAM_DIRECT";
        } else if (channel === "FACEBOOK_MESSENGER") {
          destination_type = "MESSENGER";
        } else if (channel === "WHATSAPP_MESSAGES" || channel === "WHATSAPP") {
          destination_type = "WHATSAPP";
        } else if (channel === "ALL_MESSAGES" || !channel) {
          destination_type = "MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP";
        }
      }

      if (!promoted_object) {
        promoted_object = { page_id: pageId };
      }
      break;

    case "OUTCOME_SALES":
      optimization_goal = "OFFSITE_CONVERSIONS";
      billing_event = "IMPRESSIONS";

      const pixelId = adSet.promoted_object?.pixel_id || metaPixelId;
      const catInfo = adSet._catalogInfo;
      const isCatalogueMode = conversionLocation === "CATALOGUE" || (catInfo && catInfo.productSetId);

      if (isCatalogueMode && catInfo) {
        let productSetId = catInfo.productSetId;
        const catalogId = catInfo.catalogId;

        if (productSetId && productSetId !== "default") {
          optimization_goal = "OFFSITE_CONVERSIONS";
          billing_event = "IMPRESSIONS";
          destination_type = undefined;
          promoted_object = {
            product_set_id: productSetId,
            custom_event_type: "PURCHASE"
          };
          logger(`🛍️ [AdSet] Catalogue mode: product_set_id=${productSetId}`);
        } else {
          throw new Error(`Could not resolve a Product Set in Catalogue ${catalogId || 'active'}. Please ensure your Catalogue is active with products synced.`);
        }
      } else if (pixelId) {
        destination_type = "WEBSITE";
        promoted_object = {
          pixel_id: pixelId,
          custom_event_type: adSet.promoted_object?.custom_event_type || "PURCHASE"
        };
      } else {
        throw new Error("OUTCOME_SALES requires a Meta Pixel or Product Catalogue. Please ensure your Pixel is connected or a Catalogue is linked to your Ad Account.");
      }
      break;

    case "OUTCOME_APP_PROMOTION":
      optimization_goal = "APP_INSTALLS";
      billing_event = "IMPRESSIONS";
      destination_type = undefined;
      if (!adSet.promoted_object || !adSet.promoted_object.application_id) {
        throw new Error("OUTCOME_APP_PROMOTION requires an Application ID.");
      }
      promoted_object = adSet.promoted_object;
      break;

    default:
      break;
  }

  params.append("optimization_goal", optimization_goal);
  params.append("billing_event", billing_event);
  if (destination_type) params.append("destination_type", destination_type);
  if (promoted_object) params.append("promoted_object", JSON.stringify(promoted_object));

  // 🌍 UNIVERSAL LOCATION RESOLVER
  let geo_locations = {};
  const locationQuery = payload.targeting?.universal_locations || [];

  if (locationQuery.length > 0) {
    logger(`🔍 Universal Search for locations: ${JSON.stringify(locationQuery)}`);
    const resolvedCities = [];
    const resolvedRegions = [];
    const resolvedCountries = [];

    for (const locName of locationQuery) {
      try {
        let cityQuery = locName.trim();
        let countryFilter = null;

        if (cityQuery.includes('/')) {
          const parts = cityQuery.split('/').map(p => p.trim());
          cityQuery = parts[0];
          const countryHint = parts[1];

          try {
            const countryRes = await fetch(
              `https://graph.facebook.com/v21.0/search?type=adgeolocation&location_types=["country"]&q=${encodeURIComponent(countryHint)}&access_token=${accessToken}`
            );
            const countryJson = await countryRes.json();
            if (countryJson.data && countryJson.data.length > 0) {
              countryFilter = countryJson.data[0].country_code || countryJson.data[0].key;
              logger(`🌍 Country qualifier: "${countryHint}" → ${countryJson.data[0].name} (${countryFilter})`);
            }
          } catch (e) {
            logger(`⚠️ Could not resolve country qualifier "${countryHint}": ${e.message}`);
          }
        }

        let searchUrl = `https://graph.facebook.com/v21.0/search?type=adgeolocation&q=${encodeURIComponent(cityQuery)}&access_token=${accessToken}`;
        if (countryFilter) {
          searchUrl += `&country_code=${countryFilter}`;
        }

        const searchRes = await fetch(searchUrl);
        const searchJson = await searchRes.json();

        if (searchJson.data && searchJson.data.length > 0) {
          const priorityOrder = ['city', 'region', 'state', 'country', 'subcity', 'neighborhood', 'zip', 'geo_market'];
          let bestMatch = searchJson.data[0];

          for (const preferredType of priorityOrder) {
            const found = searchJson.data.find(r => r.type === preferredType);
            if (found) { bestMatch = found; break; }
          }

          const match = bestMatch;
          logger(`✅ Meta Match: ${locName} -> ${match.name} (${match.type}, key: ${match.key}${match.country_name ? ', ' + match.country_name : ''})`);

          if (match.type === 'city' || match.type === 'subcity' || match.type === 'neighborhood') {
            resolvedCities.push({ key: match.key, radius: 20, distance_unit: 'kilometer' });
          } else if (match.type === 'region' || match.type === 'state') {
            resolvedRegions.push({ key: match.key });
          } else if (match.type === 'country') {
            resolvedCountries.push(match.key);
          } else if (match.type === 'zip') {
            if (!geo_locations.zips) geo_locations.zips = [];
            geo_locations.zips.push({ key: match.key });
          } else if (match.type === 'geo_market') {
            if (!geo_locations.geo_markets) geo_locations.geo_markets = [];
            geo_locations.geo_markets.push({ key: match.key });
          } else {
            logger(`⚠️ Unknown geo type "${match.type}" for "${locName}" — treating as city`);
            resolvedCities.push({ key: match.key, radius: 20, distance_unit: 'kilometer' });
          }
        } else {
          logger(`⚠️ No Meta results for location: ${locName}`);
        }
      } catch (err) {
        logger(`❌ Search failed for ${locName}: ${err.message}`);
      }
    }

    if (resolvedCities.length > 0) geo_locations.cities = resolvedCities;
    if (resolvedRegions.length > 0) geo_locations.regions = resolvedRegions;
    if (resolvedCountries.length > 0) geo_locations.countries = resolvedCountries;
  }

  if (Object.keys(geo_locations).length === 0) {
    throw new Error("No valid locations found. Please specify a city, state, or country for targeting.");
  }

  const targeting = {
    geo_locations: geo_locations,
    age_min: parseInt(payload.targeting?.age_min?.toString().replace(/\D/g, '') || "18"),
    age_max: parseInt(payload.targeting?.age_max?.toString().replace(/\D/g, '') || "65"),
    publisher_platforms: placements,
    device_platforms: ["mobile", "desktop"]
  };

  const genderStr = (payload.targeting?.genders || "all").toString().toLowerCase();
  if (genderStr === "women" || genderStr === "female") {
    targeting.genders = [2];
  } else if (genderStr === "men" || genderStr === "male") {
    targeting.genders = [1];
  }

  targeting.targeting_automation = { advantage_audience: 0 };

  logger(`✅ UNIVERSAL TARGETING: ${JSON.stringify(targeting)}`);
  params.append("targeting", JSON.stringify(targeting));

  return params;
}

// UNIVERSAL CREATIVE BUILDER (Placement Safe & Strict Types)
function buildCreativePayload(creative, pageId, AD_ACCOUNT_ID, accessToken, placements, forcePhoto, objective, instagramActorId, instagramProfileUrl, logger = console.log) {
  if (!pageId) throw new Error("Page ID is required for Creative");

  const catInfo = creative._catalogInfo;
  if (catInfo && catInfo.productSetId && objective === "OUTCOME_SALES") {
    logger(`🛍️ [Creative] Catalogue mode — forcing Advantage+ Carousel format`);

    const params = new URLSearchParams();
    params.append("access_token", accessToken);

    const objectStorySpec = {
      page_id: pageId,
      ...(instagramActorId ? { instagram_actor_id: instagramActorId } : {}),
      template_data: {
        multi_share_optimized: true,
        multi_share_end_card: true,
        link: `https://www.facebook.com/${pageId}`,
        call_to_action: { type: "SHOP_NOW" }
      }
    };

    params.append("template_url_spec", JSON.stringify(objectStorySpec));
    params.append("product_set_id", catInfo.productSetId);
    params.append("name", `Catalog Creative - ${creative.headline || 'Products'}`);
    return params;
  }

  const isCatalogueMode = creative._isCatalogue || objective === "OUTCOME_SALES" || creative.destination_type === "CATALOGUE";

  if (!isCatalogueMode && (!creative || !creative.image_hash)) {
    throw new Error("Image upload failed. Creative execution stopped.");
  }

  if (creative.destination_url && (creative.destination_url === "N/A" || creative.destination_url === "n/a" || !creative.destination_url.startsWith("http"))) {
    logger(`⚠️ [Creative] Invalid destination_url "${creative.destination_url}" — clearing to null`);
    creative.destination_url = null;
  }

  let conversionLocation = (creative.conversion_location || "").toUpperCase();

  if (conversionLocation === "MESSAGING_APPS" || conversionLocation === "MESSAGES") {
    const channel = (creative.message_channel || "").toUpperCase();
    const creativeCTA = (creative.call_to_action || "").toUpperCase();

    if (channel === "WHATSAPP" || channel === "WHATSAPP_MESSAGES" || creativeCTA === "WHATSAPP_MESSAGE") {
      conversionLocation = "WHATSAPP";
    } else if (channel === "INSTAGRAM_MESSAGES" || creativeCTA === "INSTAGRAM_MESSAGE") {
      conversionLocation = "INSTAGRAM_DIRECT";
    }
  }

  const isMessagingDestination =
    conversionLocation === "WHATSAPP" ||
    conversionLocation === "MESSAGES" ||
    conversionLocation === "MESSAGING_APPS" ||
    conversionLocation === "INSTAGRAM_DIRECT" ||
    conversionLocation === "MESSENGER";

  const isProfileDestination =
    conversionLocation === "INSTAGRAM_PROFILE" ||
    conversionLocation === "FACEBOOK_PAGE";

  const channel = (creative.message_channel || "").toUpperCase();

  let finalPlacements = [...placements];
  if (conversionLocation === "INSTAGRAM_PROFILE") {
    finalPlacements = ["instagram"];
  }

  const isInstagramPlacement = finalPlacements.includes("instagram");
  const finalInstagramUser = isInstagramPlacement ? instagramActorId : null;

  const objectStorySpec = {
    page_id: pageId,
    ...(finalInstagramUser ? { instagram_user_id: finalInstagramUser } : {})
  };

  if (conversionLocation === "CALLS") {
    const rawPhone = creative.phone_number || "";
    const validPhone = normalizePhoneNumber(rawPhone);

    if (!validPhone) {
      throw new Error("A valid phone number is required for Call Ads.");
    }

    objectStorySpec.link_data = {
      image_hash: creative.image_hash,
      link: creative.destination_url || `https://www.facebook.com/${pageId}`,
      message: creative.primary_text || "",
      name: creative.headline || "Call Us",
      call_to_action: {
        type: "CALL_NOW",
        value: {
          link: `tel:${validPhone}`
        }
      }
    };
  } else {
    const pageUrl = `https://www.facebook.com/${pageId}`;

    if (!forcePhoto && isMessagingDestination) {
      let ctaType = "MESSAGE_PAGE";

      if (conversionLocation === "WHATSAPP" || channel === "WHATSAPP" || channel === "WHATSAPP_MESSAGES") {
        ctaType = "WHATSAPP_MESSAGE";
      } else if (channel === "INSTAGRAM_MESSAGES") {
        ctaType = "INSTAGRAM_MESSAGE";
      } else if (channel === "FACEBOOK_MESSENGER") {
        ctaType = "MESSAGE_PAGE";
      } else if (channel === "ALL_MESSAGES" || !channel) {
        ctaType = "MESSAGE_PAGE";
      }

      objectStorySpec.link_data = {
        image_hash: creative.image_hash,
        link: pageUrl,
        message: creative.primary_text || "",
        name: creative.headline || "Chat with us",
        call_to_action: {
          type: ctaType
        }
      };

      logger(`📨 [Creative] Messaging mode: CTA=${ctaType}, link=${pageUrl}`);
    } else if (!forcePhoto && isProfileDestination) {
      let ctaType = "LEARN_MORE";

      if (conversionLocation === "INSTAGRAM_PROFILE") {
        ctaType = "VIEW_INSTAGRAM_PROFILE";
      } else if (conversionLocation === "FACEBOOK_PAGE") {
        ctaType = (objective === "OUTCOME_ENGAGEMENT") ? "LIKE_PAGE" : "LEARN_MORE";
      }

      objectStorySpec.link_data = {
        image_hash: creative.image_hash,
        link: (conversionLocation === "INSTAGRAM_PROFILE" && instagramProfileUrl) ? instagramProfileUrl : pageUrl,
        message: creative.primary_text || "",
        name: creative.headline || (conversionLocation === "INSTAGRAM_PROFILE" ? "Visit profile" : "Visit page"),
        call_to_action: {
          type: ctaType
        }
      };

      const linkVal = (conversionLocation === "INSTAGRAM_PROFILE" && instagramProfileUrl) ? instagramProfileUrl : pageUrl;
      logger(`👤 [Creative] Profile mode: CTA=${ctaType}, link=${linkVal}`);
    } else if (
      !forcePhoto &&
      (
        objective === "OUTCOME_TRAFFIC" ||
        objective === "OUTCOME_SALES" ||
        objective === "OUTCOME_LEADS" ||
        objective === "OUTCOME_ENGAGEMENT"
      )
    ) {
      objectStorySpec.link_data = {
        image_hash: creative.image_hash,
        link: creative.destination_url || pageUrl,
        message: creative.primary_text || "",
        name: creative.headline || "Learn more",
        call_to_action: {
          type: creative.call_to_action || "LEARN_MORE"
        }
      };
    } else {
      objectStorySpec.photo_data = {
        image_hash: creative.image_hash,
        caption: creative.primary_text || creative.headline || ""
      };
    }
  }

  const params = new URLSearchParams();
  params.append("name", creative.headline || "Creative");
  params.append("object_story_spec", JSON.stringify(objectStorySpec));

  if (finalInstagramUser) {
    logger(`🛠️ [Creative] Injecting Root-level instagram_user_id: ${finalInstagramUser}`);
    params.append("instagram_user_id", finalInstagramUser);
  }

  const isMultiDestination =
    isMessagingDestination &&
    (conversionLocation === "MESSAGING_APPS" || conversionLocation === "MESSAGES") &&
    (!channel || channel === "ALL_MESSAGES");

  if (isMultiDestination) {
    logger("🛠️ [Creative] Multi-destination detected. Injecting mandatory DOF spec.");
    const dofSpec = {
      degrees_of_freedom_type: "USER_ENROLLED",
      creative_features_spec: {
        image_touchups: { enroll_status: "OPT_IN" },
        text_optimizations: { enroll_status: "OPT_IN" }
      }
    };
    params.append("degrees_of_freedom_spec", JSON.stringify(dofSpec));
  } else {
    logger(`🛠️ [Creative] Single-destination (${conversionLocation}) detected. Bypassing DOF spec to avoid ODAX errors.`);
  }

  params.append("access_token", accessToken);
  return params;
}

/**
 * Full Production Meta Ads Campaign Execution Engine for Railway Worker
 */
async function executeFullMetaCampaign({
  clientEmail,
  platform,
  payload,
  metaConnection,
  supabaseClient,
  logger = console.log,
}) {
  logger(`🚀 [Railway MetaEngine] Initiating full campaign execution for: ${clientEmail || "direct-runner"}`);

  let meta = metaConnection;
  if (!meta && supabaseClient && clientEmail) {
    logger(`🔍 [Railway MetaEngine] Fetching meta_connections for ${clientEmail}...`);
    const { data: dbMeta, error } = await supabaseClient
      .from("meta_connections")
      .select("fb_ad_account_id, fb_page_id, ig_business_id, instagram_actor_id, business_website, business_phone, fb_user_access_token, fb_pixel_id, fb_business_id, fb_catalog_id")
      .eq("email", clientEmail)
      .single();

    if (error || !dbMeta) {
      throw new Error(`Meta connection not found for user: ${clientEmail}`);
    }
    meta = dbMeta;
  }

  if (!meta) {
    meta = {
      fb_ad_account_id: payload?.adAccountId,
      fb_user_access_token: payload?.accessToken,
      fb_page_id: payload?.pageId,
    };
  }

  const AD_ACCOUNT_ID = (payload?.adAccountId || meta.fb_ad_account_id || "").toString().replace(/^act_/, "");
  const ACCESS_TOKEN = payload?.accessToken || meta.fb_user_access_token;
  const PAGE_ID = payload?.pageId || meta.fb_page_id;
  const API_VERSION = "v21.0";

  if (!AD_ACCOUNT_ID) throw new Error("Missing Facebook Ad Account ID");
  if (!ACCESS_TOKEN) throw new Error("Missing Facebook User Access Token");
  if (!PAGE_ID) throw new Error("Missing Facebook Page ID");

  // 1. Placements sanitization
  let placements = [];
  if (Array.isArray(platform)) {
    placements = platform;
  } else if (typeof platform === "string") {
    placements = [platform];
  }
  placements = placements.filter(p => ["facebook", "instagram", "messenger", "audience_network"].includes(p));
  if (placements.length === 0) placements = ["facebook"];

  const destLocation = (payload.conversion_location || "").toUpperCase();
  if (destLocation === "INSTAGRAM_PROFILE") {
    placements = ["instagram"];
  } else if (destLocation === "FACEBOOK_PAGE") {
    placements = ["facebook"];
  }
  logger(`✅ [Railway MetaEngine] Placements: ${JSON.stringify(placements)}`);

  // 2. Instagram Actor Authorization
  let validatedInstagramActorId = null;
  const storedActorId = meta.instagram_actor_id;

  if (storedActorId) {
    try {
      logger(`🔎 [Meta API] Checking if act_${AD_ACCOUNT_ID} is authorized for Instagram Actor ${storedActorId}...`);
      const igAuthRes = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/instagram_accounts?access_token=${ACCESS_TOKEN}`);
      const igAuthJson = await igAuthRes.json();
      const isAuthorized = igAuthJson?.data?.some(acc => acc.id === storedActorId);

      if (isAuthorized) {
        validatedInstagramActorId = storedActorId;
        logger(`✅ [Meta API] Instagram Actor ${storedActorId} is authorized.`);
      } else {
        logger(`⚠️ [Meta API] Actor ${storedActorId} NOT authorized for act_${AD_ACCOUNT_ID}. Removing instagram from placements.`);
        placements = placements.filter(p => p !== "instagram");
        if (placements.length === 0) placements = ["facebook"];
      }
    } catch (e) {
      logger(`⚠️ [Meta API] Instagram Authorization check failed: ${e.message}`);
    }
  }

  let instagramProfileUrl = null;
  if (validatedInstagramActorId) {
    try {
      const igInfoRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${validatedInstagramActorId}?fields=username&access_token=${ACCESS_TOKEN}`);
      const igInfo = await igInfoRes.json();
      if (igInfo.username) {
        instagramProfileUrl = `https://www.instagram.com/${igInfo.username}/`;
        logger(`📸 [Meta API] Resolved Instagram Profile URL: ${instagramProfileUrl}`);
      }
    } catch (e) {
      logger(`⚠️ [Meta API] Failed to fetch IG username: ${e.message}`);
    }
  }

  const shouldUseInstagramActor = validatedInstagramActorId && placements.includes("instagram");

  // 3. Preflight Security Check
  try {
    logger(`🛡️ [Security Check] Verifying access to Ad Account: ${AD_ACCOUNT_ID}...`);
    const verifyRes = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}?fields=account_id,name&access_token=${ACCESS_TOKEN}`);
    const verifyJson = await verifyRes.json();
    if (!verifyRes.ok || verifyJson.error) {
      throw new Error(verifyJson.error?.message || "Connected Meta account does not own or have access to this ad account.");
    }
    logger(`✅ [Security Check] Access Verified for Account: ${verifyJson.account_id} (${verifyJson.name})`);
  } catch (e) {
    logger(`⛔ [Security Block] Preflight Error: ${e.message}`);
    throw new Error(`Preflight Auth Check Failed: ${e.message}`);
  }

  const createdAssets = { campaign_id: null, ad_sets: [], ads: [] };

  // 4. WhatsApp Intent Hook
  const firstAdSet = payload.ad_sets?.[0] || {};
  const creative = firstAdSet.ad_creative || {};
  const destUrl = (creative.destination_url || "").toLowerCase();
  const isWhatsAppUrl = destUrl.includes("wa.me") || destUrl.includes("whatsapp.com");
  const campaignName = (payload.campaign_name || "").toLowerCase();
  const adSetName = (firstAdSet.name || "").toLowerCase();
  const primaryText = (creative.primary_text || "").toLowerCase();
  const headline = (creative.headline || "").toLowerCase();
  const hasWAIntent = [campaignName, adSetName, primaryText, headline].some(t => t.includes("whatsapp") || t.includes("wa.me"));
  const isWACTA = creative.call_to_action === "SEND_WHATSAPP_MESSAGE" || creative.call_to_action === "WHATSAPP_MESSAGE";

  if (creative.message_template_options?.whatsapp_number || creative.whatsapp_number || isWhatsAppUrl || hasWAIntent || isWACTA) {
    logger("📱 [Execution] Definitive WhatsApp intent detected. Forcing SINGLE-DESTINATION WHATSAPP campaign.");
    payload.conversion_location = "WHATSAPP";
    payload.message_channel = "WHATSAPP_MESSAGES";
  }

  // 5. Map Objective
  const rawObjective = payload.objective || "";
  let finalObjective = mapObjectiveToODAX(rawObjective, logger);

  const convLoc = (payload.conversion_location || "").toUpperCase();
  const msgChannel = (payload.message_channel || "").toUpperCase();
  const isWhatsAppDest = convLoc === "WHATSAPP" || msgChannel === "WHATSAPP" || msgChannel === "WHATSAPP_MESSAGES";

  if (finalObjective === "OUTCOME_LEADS" && convLoc === "CALLS") {
    finalObjective = "OUTCOME_TRAFFIC";
  }

  if (
    finalObjective === "OUTCOME_TRAFFIC" &&
    !isWhatsAppDest &&
    (convLoc === "MESSAGING_APPS" || convLoc === "MESSAGES" || convLoc === "MESSENGER" || convLoc === "INSTAGRAM_DIRECT")
  ) {
    logger("📩 Non-WhatsApp messaging + Traffic → forcing OUTCOME_ENGAGEMENT");
    finalObjective = "OUTCOME_ENGAGEMENT";
  }

  logger(`🚀 [Campaign Creator] Objective: ${finalObjective} (from raw: ${rawObjective})`);

  // 6. Create Campaign (Multi-Stage Safe Fallback)
  let campaignId = null;
  let objectivesToTry = [finalObjective, "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT"];
  objectivesToTry = [...new Set(objectivesToTry)];
  logger(`🛡️ [Fallback Strategy] Will attempt objectives in order: ${objectivesToTry.join(" -> ")}`);

  let lastError = null;

  for (let i = 0; i < objectivesToTry.length; i++) {
    const objParam = objectivesToTry[i];
    const attemptLabel = `Attempt ${i + 1}/${objectivesToTry.length}`;

    try {
      const campaignParams = new URLSearchParams();
      campaignParams.append("name", payload.campaign_name);
      campaignParams.append("objective", objParam);
      campaignParams.append("status", "ACTIVE");

      if (objParam && objParam.startsWith("OUTCOME_")) {
        logger(`🔒 [ODAX Enforcement] Injecting flags for ${objParam}`);
        campaignParams.append("buying_type", "AUCTION");
        campaignParams.append("special_ad_categories", "[]");
        campaignParams.append("is_odax", "true");
        campaignParams.append("objective_config[objective_type]", objParam);
        campaignParams.append("smart_promotion_type", "GUIDED_CREATION");

        const dofSpec = {
          degrees_of_freedom_type: "USER_ENROLLED",
          creative_features_spec: {
            image_touchups: { enroll_status: "OPT_IN" },
            text_optimizations: { enroll_status: "OPT_IN" }
          }
        };
        campaignParams.append("degrees_of_freedom_spec", JSON.stringify(dofSpec));
      }

      campaignParams.append("access_token", ACCESS_TOKEN);
      logger(`🚀 [Meta API] Creating Campaign (${attemptLabel}): ${objParam}`);

      const cRes = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/campaigns`, {
        method: "POST",
        body: campaignParams
      });
      const cJson = await cRes.json();

      if (!cRes.ok || !cJson.id) {
        throw new Error(cJson.error?.message || `Unknown Meta Error (Status: ${cRes.status})`);
      }

      campaignId = cJson.id;
      finalObjective = objParam;
      logger(`✅ Campaign Created Successfully: ${campaignId} (${objParam})`);
      break;
    } catch (err) {
      logger(`⚠️ ${attemptLabel} failed: ${err.message}`);
      lastError = err;

      const isObjError =
        err.message.includes("AGENT_V2_OBJ") ||
        err.message.includes("Invalid parameter") ||
        err.message.includes("Param") ||
        err.message.includes("objective") ||
        err.message.includes("Messages is not defined");

      if (isObjError) {
        logger(`🔄 [Fallback] Objective ${objParam} rejected. Checking next option...`);
        continue;
      }
      throw new Error(`Campaign Create Failed (Fatal): ${err.message}`);
    }
  }

  if (!campaignId) {
    throw new Error(`Campaign Creation Failed after ${objectivesToTry.length} attempts (Account: ${AD_ACCOUNT_ID}). Last Error: ${lastError?.message}`);
  }

  createdAssets.campaign_id = campaignId;

  // 7. Pixel & Catalog Discovery
  let activePixelId = meta.fb_pixel_id;
  if (!activePixelId && finalObjective === "OUTCOME_SALES") {
    activePixelId = await getAutoPixelId(AD_ACCOUNT_ID, ACCESS_TOKEN, API_VERSION, logger);
    if (activePixelId && supabaseClient && clientEmail) {
      await supabaseClient.from("meta_connections").update({ fb_pixel_id: activePixelId }).eq("email", clientEmail);
    }
  }

  let catalogInfo = null;
  if (finalObjective === "OUTCOME_SALES") {
    catalogInfo = await getProductCatalogAndSet(
      AD_ACCOUNT_ID,
      ACCESS_TOKEN,
      API_VERSION,
      meta.fb_business_id,
      PAGE_ID,
      firstAdSet.catalogId || firstAdSet._catalogInfo?.catalogId || meta.fb_catalog_id,
      firstAdSet.productSetId || firstAdSet._catalogInfo?.productSetId,
      logger
    );

    if (!catalogInfo && meta.fb_catalog_id) {
      logger(`🛍️ [Catalogue Fallback] Using synced catalogue from Supabase: ${meta.fb_catalog_id}`);
      catalogInfo = { catalogId: meta.fb_catalog_id, catalogName: "Synced Catalogue", productSetId: null };
      try {
        const psRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${meta.fb_catalog_id}/product_sets?fields=id,name,product_count&access_token=${ACCESS_TOKEN}`);
        const psJson = await psRes.json();
        if (psJson?.data?.length) {
          const bestPS = psJson.data.find(ps => ps.name?.toLowerCase().includes("all product")) || psJson.data[0];
          catalogInfo.productSetId = bestPS.id;
          logger(`✅ [Catalogue Fallback] Product Set: "${bestPS.name}" (ID: ${bestPS.id})`);
        }
      } catch (e) {
        logger(`⚠️ [Catalogue Fallback] Product set fetch failed: ${e.message}`);
      }
    }

    if (catalogInfo?.catalogId && !meta.fb_catalog_id && supabaseClient && clientEmail) {
      await supabaseClient
        .from("meta_connections")
        .update({ fb_catalog_id: catalogInfo.catalogId, catalog_last_synced_at: new Date().toISOString() })
        .eq("email", clientEmail);
    }
  }

  const accountCurrency = await getAdAccountCurrency(AD_ACCOUNT_ID, ACCESS_TOKEN, API_VERSION, logger);

  // 8. Create Ad Set(s)
  const adSets = payload.ad_sets || [{ name: "Ad Set 1" }];

  for (const adSet of adSets) {
    const budgetAmount = payload.budget?.amount || 500;
    const budgetType = (payload.budget?.type || "DAILY").toUpperCase() === "DAILY" ? "daily_budget" : "lifetime_budget";
    logger(`💰 [Budget] ${budgetAmount} ${accountCurrency} (${budgetType})`);

    adSet.conversion_location = payload.conversion_location;
    adSet.message_channel = payload.message_channel;
    adSet.phone_number = payload.phone_number || meta.business_phone;

    if (catalogInfo && !adSet._catalogInfo?.productSetId) {
      adSet._catalogInfo = catalogInfo;
    } else if (catalogInfo && adSet._catalogInfo) {
      adSet._catalogInfo.catalogId = adSet._catalogInfo.catalogId || catalogInfo.catalogId;
    }

    const p = await buildAdSetPayload(finalObjective, adSet, campaignId, ACCESS_TOKEN, placements, PAGE_ID, activePixelId, payload, validatedInstagramActorId, logger);
    p.append(budgetType, String(Math.floor(Number(budgetAmount) * 100)));

    if (budgetType === "lifetime_budget" && !adSet.end_time) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);
      p.append("end_time", endDate.toISOString());
    }

    logger(`📋 [AdSet] Sending params to act_${AD_ACCOUNT_ID}/adsets...`);
    const asRes = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/adsets`, {
      method: "POST",
      body: p
    });
    const asJson = await asRes.json();

    if (!asRes.ok) {
      const errDetail = asJson.error || {};
      logger(`❌ [AdSet] Full Meta Error: ${JSON.stringify(asJson.error, null, 2)}`);

      if (errDetail.error_subcode === 1815089) {
        throw new Error(`Meta Action Required: Lead Ads Terms Not Accepted. Please visit https://www.facebook.com/ads/leadgen/tos for Page ID: ${PAGE_ID}`);
      }

      if (errDetail.error_subcode === 2446885) {
        const rawPhone = adSet.phone_number || meta?.business_phone || "";
        const cleanPhone = rawPhone.replace(/\D/g, "");
        const waPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
        const waLink = `https://wa.me/${waPhone}`;
        logger(`⚠️ [AdSet] WABA not connected (2446885). Falling back to wa.me URL approach: ${waLink}`);

        const wameFallbackParams = new URLSearchParams();
        wameFallbackParams.append("name", adSet.name || "Ad Set 1");
        wameFallbackParams.append("campaign_id", campaignId);
        wameFallbackParams.append("status", "ACTIVE");
        wameFallbackParams.append("access_token", ACCESS_TOKEN);
        wameFallbackParams.append("bid_strategy", "LOWEST_COST_WITHOUT_CAP");
        const wameStart = new Date(Date.now() + 5 * 60 * 1000);
        wameFallbackParams.append("start_time", wameStart.toISOString());
        wameFallbackParams.append("optimization_goal", "LINK_CLICKS");
        wameFallbackParams.append("billing_event", "IMPRESSIONS");
        const budgetAmountF = payload.budget?.amount || 500;
        const budgetTypeF = (payload.budget?.type || "DAILY").toUpperCase() === "DAILY" ? "daily_budget" : "lifetime_budget";
        wameFallbackParams.append(budgetTypeF, String(Math.floor(Number(budgetAmountF) * 100)));

        const tempP = await buildAdSetPayload(finalObjective, adSet, campaignId, ACCESS_TOKEN, placements, PAGE_ID, activePixelId, payload, validatedInstagramActorId, logger);
        const targetingStr = tempP.get("targeting");
        if (targetingStr) wameFallbackParams.append("targeting", targetingStr);

        const wameRes = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/adsets`, { method: "POST", body: wameFallbackParams });
        const wameJson = await wameRes.json();
        if (wameRes.ok && wameJson.id) {
          logger(`✅ [AdSet] wa.me fallback adset created: ${wameJson.id}`);
          createdAssets.ad_sets.push(wameJson.id);
          asJson.id = wameJson.id;
          if (adSet.ad_creative) {
            adSet.ad_creative.destination_url = waLink;
            adSet.ad_creative.call_to_action = "LEARN_MORE";
          }
          payload._waFallback = true;
          payload.conversion_location = "WEBSITE";
        } else {
          throw new Error(`WhatsApp ads require a WhatsApp Business Account (WABA) connected to your Facebook Page via Meta Business Suite. Error: ${wameJson.error?.message || 'Unknown'}`);
        }
      } else {
        if (errDetail.error_subcode === 2490408) {
          throw new Error(`Meta Optimization Mismatch: The selected goal isn't available for this campaign type.`);
        }
        throw new Error(`AdSet Create Failed: ${errDetail.message || 'Unknown'} | SubCode: ${errDetail.error_subcode || 'N/A'}`);
      }
    } else {
      createdAssets.ad_sets.push(asJson.id);
    }

    // 9. Creative Creation with Self-Healing Image Pipeline
    const currentCreative = adSet.ad_creative || {};
    const isCatalogue = currentCreative._isCatalogue || finalObjective === "OUTCOME_SALES" || currentCreative.destination_type === "CATALOGUE";

    if (!isCatalogue && !currentCreative.image_hash) {
      logger(`🔍 [Creative] image_hash is missing. Auto-resolving and uploading image to Meta act_${AD_ACCOUNT_ID}`);

      let candidateUrl =
        currentCreative.imageUrl ||
        currentCreative.image_url ||
        currentCreative.userProvidedImageUrl ||
        currentCreative.user_provided_image_url ||
        payload.imageUrl ||
        payload.userProvidedImageUrl ||
        payload.user_provided_image_url;

      if (!candidateUrl && supabaseClient && clientEmail) {
        try {
          const { data: memData } = await supabaseClient
            .from("answer_memory")
            .select("memory")
            .eq("email", clientEmail)
            .order("updated_at", { ascending: false })
            .limit(1);

          const stateFromMem = memData?.[0]?.memory?.campaign_state;
          if (stateFromMem) {
            candidateUrl =
              stateFromMem.user_provided_image_url ||
              stateFromMem.creative?.imageUrl ||
              stateFromMem.creative?.userProvidedImageUrl;
            if (stateFromMem.image_hash) {
              currentCreative.image_hash = stateFromMem.image_hash;
              logger(`✅ [Creative] Restored image_hash from memory: ${currentCreative.image_hash}`);
            }
          }
        } catch (mErr) {
          logger(`⚠️ [Creative] Memory check failed: ${mErr.message}`);
        }
      }

      if (!currentCreative.image_hash && candidateUrl) {
        try {
          logger(`🖼️ [Creative] Uploading image from URL to act_${AD_ACCOUNT_ID}: ${candidateUrl}`);
          const fRes = await fetch(candidateUrl);
          if (fRes.ok) {
            const arrayBuf = await fRes.arrayBuffer();
            const imgBuf = Buffer.from(arrayBuf);
            if (imgBuf && imgBuf.length > 500) {
              const blob = new Blob([imgBuf], { type: "image/jpeg" });
              const form = new FormData();
              form.append("source", blob, "ad_creative.jpg");
              form.append("access_token", ACCESS_TOKEN);

              const upRes = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/adimages`, {
                method: "POST",
                body: form,
              });
              const upJson = await upRes.json();
              const images = upJson?.images || {};
              const firstK = Object.keys(images)[0];
              const resolvedHash = images[firstK]?.hash;
              if (resolvedHash) {
                currentCreative.image_hash = resolvedHash;
                logger(`✅ [Creative] Image uploaded successfully! Hash: ${resolvedHash}`);
              }
            }
          }
        } catch (upErr) {
          logger(`⚠️ [Creative] Failed to upload candidate image: ${upErr.message}`);
        }
      }

      // Branded SVG Banner fallback
      if (!currentCreative.image_hash) {
        try {
          logger("🎨 [Creative] Creating fallback ad banner...");
          const headlineText = (currentCreative.headline || payload.campaign_name || "Special Offer").slice(0, 50);
          const brandText = "GABBARINFO AI";
          const svgFallback = `
            <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#0f172a"/>
                  <stop offset="50%" stop-color="#1e1b4b"/>
                  <stop offset="100%" stop-color="#311042"/>
                </linearGradient>
              </defs>
              <rect width="1080" height="1080" fill="url(#bg)"/>
              <circle cx="540" cy="400" r="160" fill="rgba(99, 102, 241, 0.15)"/>
              <text x="540" y="320" text-anchor="middle" font-family="system-ui, sans-serif" font-size="28" font-weight="700" fill="#818CF8" letter-spacing="4">${brandText}</text>
              <text x="540" y="520" text-anchor="middle" font-family="system-ui, sans-serif" font-size="52" font-weight="900" fill="#FFFFFF">${headlineText}</text>
              <rect x="340" y="650" width="400" height="70" rx="35" fill="#6366F1"/>
              <text x="540" y="696" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" font-weight="700" fill="#FFFFFF">LEARN MORE</text>
            </svg>
          `;
          const fallbackBuf = await sharp(Buffer.from(svgFallback)).jpeg({ quality: 85 }).toBuffer();
          const blob = new Blob([fallbackBuf], { type: "image/jpeg" });
          const form = new FormData();
          form.append("source", blob, "fallback_creative.jpg");
          form.append("access_token", ACCESS_TOKEN);

          const fbRes = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/adimages`, {
            method: "POST",
            body: form,
          });
          const fbJson = await fbRes.json();
          const fbImages = fbJson?.images || {};
          const fbFirstK = Object.keys(fbImages)[0];
          currentCreative.image_hash = fbImages[fbFirstK]?.hash || null;
          logger(`✅ [Creative] Fallback image uploaded! Hash: ${currentCreative.image_hash}`);
        } catch (fbErr) {
          logger(`❌ [Creative] Fallback image generation failed: ${fbErr.message}`);
        }
      }
    }

    const isWebsiteConversion = adSet.destination_type === "WEBSITE" || payload.conversion_location === "WEBSITE";
    const requiresDestinationUrl =
      isWebsiteConversion &&
      (finalObjective === "OUTCOME_TRAFFIC" || finalObjective === "OUTCOME_SALES" || finalObjective === "OUTCOME_LEADS");

    if (requiresDestinationUrl) {
      currentCreative.destination_url =
        currentCreative.landing_page_url ||
        currentCreative.destination_url ||
        payload.landing_page_url ||
        payload.website ||
        meta.business_website;

      if (!currentCreative.destination_url) {
        throw new Error("Please provide a website or landing page for website traffic campaigns.");
      }
    }

    const fallbackStrategies = [
      { name: "Primary", placements: placements, igActor: shouldUseInstagramActor ? validatedInstagramActorId : null, forcePhoto: false },
      { name: "Fallback 1 (No Actor)", placements: placements, igActor: null, forcePhoto: false },
      { name: "Fallback 2 (FB Only)", placements: ["facebook"], igActor: null, forcePhoto: false }
    ];

    if (finalObjective === "OUTCOME_AWARENESS") {
      fallbackStrategies.push({ name: "Fallback 3 (Photo Only)", placements: ["facebook"], igActor: null, forcePhoto: true });
    }

    let creativeId = null;
    let lastCreativeError = null;
    let finalAdSetId = asJson.id;

    const adSetsByPlacements = {
      [JSON.stringify(placements)]: asJson.id
    };

    for (const strat of fallbackStrategies) {
      const isProfileDest = (payload.conversion_location === "INSTAGRAM_PROFILE" || payload.conversion_location === "FACEBOOK_PAGE");
      if (isProfileDest && strat.name.includes("Fallback")) {
        logger(`⏩ [Creative] Skipping ${strat.name} for Profile Destination.`);
        continue;
      }

      try {
        logger(`🎨 [Creative] ${strat.name}: Attempting creation...`);
        const platKey = JSON.stringify(strat.placements);
        let currentAdSetId = adSetsByPlacements[platKey];

        if (!currentAdSetId) {
          logger(`🛠️ [AdSet] Creating NEW Ad Set for fallback with placements ${platKey}...`);
          adSet.conversion_location = payload.conversion_location;
          const p = await buildAdSetPayload(finalObjective, adSet, campaignId, ACCESS_TOKEN, strat.placements, PAGE_ID, activePixelId, payload, validatedInstagramActorId, logger);
          const fbBudgetAmount = payload.budget?.amount || 500;
          const fbBudgetType = (payload.budget?.type || "DAILY").toUpperCase() === "DAILY" ? "daily_budget" : "lifetime_budget";
          p.append(fbBudgetType, String(Math.floor(Number(fbBudgetAmount) * 100)));

          const asRes2 = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/adsets`, {
            method: "POST",
            body: p
          });
          const asJson2 = await asRes2.json();
          if (!asRes2.ok) {
            logger(`⚠️ [AdSet] New AdSet failed: ${JSON.stringify(asJson2.error, null, 2)}`);
            continue;
          }
          currentAdSetId = asJson2.id;
          adSetsByPlacements[platKey] = currentAdSetId;
          createdAssets.ad_sets.push(currentAdSetId);
        }

        const isMessagingOrCall =
          adSet.destination_type === "MESSAGING_APPS" ||
          ["WHATSAPP", "MESSENGER", "INSTAGRAM_DIRECT", "CALLS"].includes(payload.conversion_location);

        const requiresPhotoOnly =
          finalObjective === "OUTCOME_AWARENESS" ||
          (finalObjective === "OUTCOME_ENGAGEMENT" && !isMessagingOrCall);

        const finalForcePhoto = strat.forcePhoto || requiresPhotoOnly;

        currentCreative.conversion_location = payload.conversion_location;
        currentCreative.message_channel = payload.message_channel;
        currentCreative.phone_number = payload.phone_number || meta.business_phone;
        if (adSet._catalogInfo || catalogInfo) currentCreative._catalogInfo = adSet._catalogInfo || catalogInfo;

        const crParams = buildCreativePayload(
          currentCreative,
          PAGE_ID,
          AD_ACCOUNT_ID,
          ACCESS_TOKEN,
          strat.placements,
          finalForcePhoto,
          finalObjective,
          strat.igActor,
          instagramProfileUrl,
          logger
        );

        const crRes = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/adcreatives?debug=all`, {
          method: "POST",
          body: crParams
        });
        const crJson = await crRes.json();

        if (crRes.ok && crJson.id) {
          creativeId = crJson.id;
          finalAdSetId = currentAdSetId;
          logger(`✅ [Creative] ${strat.name} Succeeded: ${creativeId} (AdSet: ${finalAdSetId})`);
          break;
        }

        lastCreativeError = crJson.error;
        const isProfileAd = (payload.conversion_location === "INSTAGRAM_PROFILE");
        if (!isProfileAd && crJson.error?.code === 100 && crJson.error?.message?.includes("instagram_actor_id")) {
          logger(`⚠️ [Creative] Identity Error. Retrying with No Actor fallback.`);
          continue;
        }
        logger(`⚠️ [Creative] ${strat.name} Rejected: ${JSON.stringify(lastCreativeError, null, 2)}`);
      } catch (e) {
        logger(`⚠️ [Creative] ${strat.name} Error: ${e.message}`);
        lastCreativeError = e.message;
      }
    }

    if (!creativeId) {
      throw new Error(`Creative Creation Failed after all fallbacks: ${JSON.stringify(lastCreativeError, null, 2)}`);
    }

    // 10. Create Ad
    const adBody = {
      name: currentCreative.headline || "Ad",
      adset_id: finalAdSetId,
      creative: {
        creative_id: creativeId
      },
      status: "ACTIVE",
      ...(
        (payload.message_channel === "INSTAGRAM_MESSAGES" || payload.conversion_location === "INSTAGRAM_PROFILE") &&
        validatedInstagramActorId
          ? { instagram_user_id: validatedInstagramActorId }
          : {})
    };

    const adRes = await fetch(
      `https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/ads?access_token=${ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adBody)
      }
    );

    const adJson = await adRes.json();

    if (!adRes.ok) {
      const adErr = adJson.error || {};
      if (adErr.error_subcode === 2446493) {
        logger("⚠️ [Ad] Missing DOF Spec error (2446493). Re-creating creative WITH degrees_of_freedom_spec and retrying Ad...");
        const dofFallbackParams = buildCreativePayload(
          currentCreative,
          PAGE_ID,
          AD_ACCOUNT_ID,
          ACCESS_TOKEN,
          placements,
          false,
          finalObjective,
          shouldUseInstagramActor ? validatedInstagramActorId : null,
          instagramProfileUrl,
          logger
        );
        const dofSpec = {
          degrees_of_freedom_type: "USER_ENROLLED",
          creative_features_spec: {
            image_touchups: { enroll_status: "OPT_IN" },
            text_optimizations: { enroll_status: "OPT_IN" }
          }
        };
        dofFallbackParams.set("degrees_of_freedom_spec", JSON.stringify(dofSpec));

        const retryCrRes = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/adcreatives?debug=all`, {
          method: "POST",
          body: dofFallbackParams,
        });
        const retryCrJson = await retryCrRes.json();
        if (retryCrRes.ok && retryCrJson.id) {
          logger(`✅ [Ad Creative] DOF Creative recreated: ${retryCrJson.id}`);
          adBody.creative.creative_id = retryCrJson.id;
          const retryAdRes = await fetch(
            `https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/ads?access_token=${ACCESS_TOKEN}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(adBody),
            }
          );
          const retryAdJson = await retryAdRes.json();
          if (retryAdRes.ok && retryAdJson.id) {
            logger(`✅ [Ad] Ad successfully created with DOF spec on retry: ${retryAdJson.id}`);
            createdAssets.ads.push(retryAdJson.id);
            continue;
          }
        }
      }
      throw new Error(`Ad Create Failed: ${JSON.stringify(adJson.error)} (Account: ${AD_ACCOUNT_ID})`);
    }

    createdAssets.ads.push(adJson.id);
  }

  logger(`🎉 [Railway MetaEngine] Campaign created successfully! ID: ${campaignId}`);
  return {
    ok: true,
    id: campaignId,
    status: "ACTIVE",
    details: createdAssets,
  };
}

module.exports = {
  applyMetaAdOverlay,
  generateAdGraphic,
  uploadImageToMeta,
  executeFullMetaCampaign,
  // Backward compatibility alias:
  executeMetaCampaign: executeFullMetaCampaign,
};
