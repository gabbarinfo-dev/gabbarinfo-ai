// video-worker/lib/meta-campaign-service.js
/**
 * Dedicated Meta Ads Campaign & Creative Orchestration Service for Railway Worker.
 * Handles heavy image generation, Sharp overlay rendering, and Meta Graph API publishing
 * without serverless timeouts.
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

/**
 * Composites a clean marketing overlay (service name, offer badge, business name)
 * onto an image buffer using Sharp's built-in SVG compositor.
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
  const candidateModels = ["gpt-image-2-2026-04-21", "gpt-image-2", "dall-e-3"];
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

  // Apply Sharp overlay with offer and service
  const overlaidBuffer = await applyMetaAdOverlay({
    imageBuffer: rawBuffer,
    service,
    offer,
    tagline,
    businessName,
  });

  // Staging in Supabase Storage (instagram-creatives)
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
    bufferToUpload = Buffer.from(await fRes.arrayBuffer());
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

  // Meta returns { images: { "ad_creative.jpg": { hash: "..." } } }
  const images = json.images || {};
  const firstKey = Object.keys(images)[0];
  const imageHash = images[firstKey]?.hash;

  if (!imageHash) {
    throw new Error("Meta image upload succeeded but returned no image_hash.");
  }

  logger(`[MetaCampaignService] Image uploaded successfully. Hash: ${imageHash}`);
  return imageHash;
}

/**
 * Orchestrates full Meta Ads campaign creation via Graph API v21.0
 */
async function executeMetaCampaign({
  adAccountId,
  accessToken,
  pageId,
  payload,
  imageHash,
  logger = console.log,
}) {
  const cleanAdId = (adAccountId || "").toString().replace(/^act_/, "");
  const API_VERSION = "v21.0";
  const baseUrl = `https://graph.facebook.com/${API_VERSION}`;

  logger(`[MetaCampaignService] Creating Campaign on act_${cleanAdId}...`);

  // 1. Create Campaign
  const campaignBody = new URLSearchParams({
    name: payload.campaign_name || `AI Campaign - ${new Date().toISOString().slice(0, 10)}`,
    objective: payload.objective || "OUTCOME_TRAFFIC",
    status: "PAUSED",
    special_ad_categories: "NONE",
    access_token: accessToken,
  });

  const campRes = await fetch(`${baseUrl}/act_${cleanAdId}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: campaignBody.toString(),
  });
  const campJson = await campRes.json();

  if (campJson.error || !campJson.id) {
    throw new Error(`Failed to create Meta Campaign: ${campJson.error?.message || JSON.stringify(campJson)}`);
  }

  const campaignId = campJson.id;
  logger(`[MetaCampaignService] ✅ Campaign created: ${campaignId}`);

  // 2. Create Ad Set
  const budgetINR = payload.budget?.daily_budget || payload.budget_per_day || 200;
  // Meta daily budget in smallest currency unit (e.g. paisa for INR = multiply by 100)
  const dailyBudgetUnits = Math.round(Number(budgetINR) * 100);

  const adSetBody = new URLSearchParams({
    name: `${payload.campaign_name} - Ad Set`,
    campaign_id: campaignId,
    daily_budget: String(dailyBudgetUnits),
    billing_event: "IMPRESSIONS",
    optimization_goal: payload.performance_goal || "LINK_CLICKS",
    status: "PAUSED",
    access_token: accessToken,
    targeting: JSON.stringify({
      geo_locations: {
        countries: ["IN"],
      },
      age_min: payload.targeting?.age_min || 18,
      age_max: payload.targeting?.age_max || 65,
    }),
  });

  const adSetRes = await fetch(`${baseUrl}/act_${cleanAdId}/adsets`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: adSetBody.toString(),
  });
  const adSetJson = await adSetRes.json();

  if (adSetJson.error || !adSetJson.id) {
    throw new Error(`Failed to create Meta Ad Set: ${adSetJson.error?.message || JSON.stringify(adSetJson)}`);
  }

  const adSetId = adSetJson.id;
  logger(`[MetaCampaignService] ✅ Ad Set created: ${adSetId}`);

  // 3. Create Ad Creative
  const adCreativeData = payload.ad_sets?.[0]?.ad_creative || {};
  const destinationUrl = adCreativeData.destination_url || payload.destination_url || "https://gabbarinfo.com";
  const primaryText = adCreativeData.primary_text || "Boost your business with intelligent marketing.";
  const headline = adCreativeData.headline || payload.campaign_name || "Special Offer";
  const ctaType = adCreativeData.call_to_action || "LEARN_MORE";

  const creativeBody = new URLSearchParams({
    name: `${payload.campaign_name} - Creative`,
    object_story_spec: JSON.stringify({
      page_id: pageId,
      link_data: {
        link: destinationUrl,
        message: primaryText,
        name: headline,
        image_hash: imageHash,
        call_to_action: {
          type: ctaType,
          value: { link: destinationUrl },
        },
      },
    }),
    access_token: accessToken,
  });

  const creativeRes = await fetch(`${baseUrl}/act_${cleanAdId}/adcreatives`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: creativeBody.toString(),
  });
  const creativeJson = await creativeRes.json();

  if (creativeJson.error || !creativeJson.id) {
    throw new Error(`Failed to create Meta Ad Creative: ${creativeJson.error?.message || JSON.stringify(creativeJson)}`);
  }

  const creativeId = creativeJson.id;
  logger(`[MetaCampaignService] ✅ Ad Creative created: ${creativeId}`);

  // 4. Create Ad
  const adBody = new URLSearchParams({
    name: `${payload.campaign_name} - Ad`,
    adset_id: adSetId,
    creative: JSON.stringify({ creative_id: creativeId }),
    status: "PAUSED",
    access_token: accessToken,
  });

  const adRes = await fetch(`${baseUrl}/act_${cleanAdId}/ads`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: adBody.toString(),
  });
  const adJson = await adRes.json();

  if (adJson.error || !adJson.id) {
    throw new Error(`Failed to create Meta Ad: ${adJson.error?.message || JSON.stringify(adJson)}`);
  }

  const adId = adJson.id;
  logger(`[MetaCampaignService] 🎉 Ad created successfully: ${adId}`);

  return {
    campaignId,
    adSetId,
    creativeId,
    adId,
    status: "PAUSED",
  };
}

module.exports = {
  applyMetaAdOverlay,
  generateAdGraphic,
  uploadImageToMeta,
  executeMetaCampaign,
};
