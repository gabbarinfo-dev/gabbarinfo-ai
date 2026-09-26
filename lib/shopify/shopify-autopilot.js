// lib/shopify/shopify-autopilot.js
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { getValidShopifyAccessToken } from "./token-service.js";
import { ensureInstagramCompatibleJpeg } from "../instagram-image-helper.js";
import {
  buildCrossBrandNegativeList,
  validateTopicRelevance,
  getVisualGuardDirectives,
} from "../brand-integrity-guard.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function isProductInStock(p) {
  if (!p || p.status !== "active") return false;
  if (!Array.isArray(p.variants) || p.variants.length === 0) return true;
  return p.variants.some((v) => {
    if (!v.inventory_management) return true;
    if (v.inventory_policy === "continue") return true;
    return typeof v.inventory_quantity === "number" && v.inventory_quantity > 0;
  });
}

function getRelevantProductsForLinking(products = [], queryText = "", primaryDomain = "", maxCount = 8) {
  if (!Array.isArray(products) || products.length === 0) return [];
  const inStock = products.filter(isProductInStock);
  if (inStock.length === 0) return [];

  const stopwords = new Set([
    "a", "an", "the", "and", "or", "but", "if", "because", "as", "what",
    "when", "where", "how", "all", "any", "both", "each", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "can", "will", "just", "should",
    "now", "in", "on", "at", "to", "for", "with", "by", "from", "about",
    "into", "through", "during", "before", "after", "above", "below"
  ]);

  const tokens = String(queryText || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));

  const scored = inStock.map((p) => {
    let score = 0;
    const titleLower = (p.title || "").toLowerCase();
    const tagsLower = (Array.isArray(p.tags) ? p.tags.join(" ") : String(p.tags || "")).toLowerCase();
    const typeLower = (p.product_type || "").toLowerCase();

    for (const token of tokens) {
      if (titleLower.includes(token)) score += 3;
      if (tagsLower.includes(token)) score += 2;
      if (typeLower.includes(token)) score += 2;
    }

    const cleanDomain = primaryDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return {
      id: p.id,
      title: p.title,
      handle: p.handle,
      product_type: p.product_type,
      url: `https://${cleanDomain}/products/${p.handle}`,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxCount);
}

function sanitizeShopifyBodyHtml(bodyHtml, title) {
  if (!bodyHtml) return "";
  let clean = String(bodyHtml).trim();
  clean = clean.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  clean = clean.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "");
  if (title) {
    const normTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "");
    const leadingH2Match = clean.match(/^\s*<h2[^>]*>([\s\S]*?)<\/h2>\s*/i);
    if (leadingH2Match) {
      const normH2 = leadingH2Match[1].replace(/<[^>]+>/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normH2 === normTitle || (normH2.length > 15 && normTitle.includes(normH2))) {
        clean = clean.replace(/^\s*<h2[^>]*>[\s\S]*?<\/h2>\s*/i, "");
      }
    }
  }
  return clean.trim();
}

export async function runShopifyAutopilotCycle({ force = false, email = null, targetShop = null, logger = console.log } = {}) {
  logger("[Shopify Autopilot] Starting autonomous eCommerce blog generation cycle...");

  let query = supabase
    .from("agent_memory")
    .select("email, memory_type, content")
    .or("memory_type.like.shopify_conn_%,memory_type.eq.shopify_connection");
  if (email) {
    query = query.eq("email", email.toLowerCase());
  }

  const { data: rawConnections, error: connErr } = await query;
  if (connErr) {
    logger(`[Shopify Autopilot] Failed to fetch Shopify connections: ${connErr.message}`);
    return [];
  }

  if (!rawConnections || rawConnections.length === 0) {
    logger("[Shopify Autopilot] No connected Shopify stores found.");
    return [];
  }

  // Deduplicate stores by userEmail and shop domain
  const uniqueStoreMap = new Map();
  for (const item of rawConnections) {
    try {
      const parsed = typeof item.content === "string" ? JSON.parse(item.content) : item.content;
      if (parsed && parsed.shop) {
        const key = `${item.email.toLowerCase()}_${parsed.shop.toLowerCase()}`;
        if (!uniqueStoreMap.has(key) || item.memory_type.startsWith("shopify_conn_")) {
          uniqueStoreMap.set(key, { email: item.email, content: parsed });
        }
      }
    } catch (_) {}
  }

  const connections = Array.from(uniqueStoreMap.values());
  if (connections.length === 0) {
    logger("[Shopify Autopilot] No valid Shopify stores found.");
    return [];
  }

  const results = [];

  for (const connItem of connections) {
    const userEmail = connItem.email;
    const conn = connItem.content;
    const shop = conn.shop;
    if (!shop) continue;
    if (targetShop && shop.toLowerCase() !== targetShop.toLowerCase()) {
      continue;
    }

    const brandName = conn.shopName || conn.name || shop.split(".")[0] || "Our Store";
    const primaryDomain = conn.domain || conn.primary_domain || shop;

    logger(`[Shopify Autopilot] Evaluating store: ${shop} (${userEmail}) - Brand: "${brandName}"...`);
    const autoMemoryKey = `shopify_autopilot_${shop}`;
    const { data: autoMem } = await supabase
      .from("agent_memory")
      .select("content")
      .eq("email", userEmail)
      .eq("memory_type", autoMemoryKey)
      .maybeSingle();

    let config = {
      enabled: true,
      cadence: "daily",
      blogId: null,
      blogHandle: "news",
      isDraft: false,
      targetKeywords: "",
      targetLocations: conn.country || "",
      targetMarket: conn.country || "",
      nicheFocus: "",
      autoShareFacebook: false,
      autoShareInstagram: false,
      topicQueue: [],
      suggestedTopics: [],
      lastPublishedAt: null,
      recentArticles: [],
      publishedTopics: [],
    };

    if (autoMem?.content) {
      try {
        const parsed = typeof autoMem.content === "string" ? JSON.parse(autoMem.content) : autoMem.content;
        config = { ...config, ...parsed };
      } catch (_) {}
    }

    // Strict Multi-Store & Cross-Brand Isolation: Map foreign brands into negative blacklist
    const { forbiddenTerms: crossBrandForbidden, foreignBrands } = await buildCrossBrandNegativeList({
      supabase,
      userEmail,
      currentBusinessKey: shop,
      currentSiteUrl: primaryDomain,
    });
    if (crossBrandForbidden.length > 0) {
      logger(`[Shopify Autopilot] Brand Integrity Guard: Activated ${crossBrandForbidden.length} negative exclusion terms from ${foreignBrands.length} foreign brands under ${userEmail}.`);
    }

    if (!config.enabled && !force) {
      logger(`[Shopify Autopilot] Autopilot paused for ${shop}. Skipping.`);
      continue;
    }

    if (!force && config.lastPublishedAt) {
      const lastRun = new Date(config.lastPublishedAt).getTime();
      const now = Date.now();
      const hoursSince = (now - lastRun) / (1000 * 60 * 60);

      let requiredIntervalHours = 20;
      if (config.cadence === "3x_week") requiredIntervalHours = 48;
      if (config.cadence === "weekly") requiredIntervalHours = 144;

      if (hoursSince < requiredIntervalHours) {
        logger(`[Shopify Autopilot] Cadence threshold not reached for ${shop}. Last run: ${config.lastPublishedAt}. Skipping.`);
        continue;
      }
    }

    const accessToken = await getValidShopifyAccessToken(conn, userEmail, supabase);
    if (!accessToken) {
      logger(`[Shopify Autopilot] No valid access token for ${shop}. Skipping.`);
      continue;
    }

    try {
      // 1. Fetch products
      let products = [];
      try {
        const pResp = await fetch(
          `https://${shop}/admin/api/2024-01/products.json?limit=100&fields=id,title,handle,product_type,tags,variants,status`,
          { headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" } }
        );
        if (pResp.ok) {
          const pData = await pResp.json();
          products = pData.products || [];
        }
      } catch (pErr) {
        logger(`[Shopify Autopilot] Catalog fetch note: ${pErr.message}`);
      }

      // 2. Fetch blog channels
      let blogId = config.blogId;
      let blogHandle = config.blogHandle || "news";
      try {
        const bResp = await fetch(`https://${shop}/admin/api/2024-01/blogs.json`, {
          headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
        });
        if (bResp.ok) {
          const bData = await bResp.json();
          const blogs = bData.blogs || [];
          if (blogs.length > 0) {
            const matchedBlog = blogs.find((b) => String(b.id) === String(blogId)) || blogs[0];
            blogId = matchedBlog.id;
            blogHandle = matchedBlog.handle;
          }
        }
      } catch (bErr) {
        logger(`[Shopify Autopilot] Blog channel fetch note: ${bErr.message}`);
      }

      if (!blogId) {
        logger(`[Shopify Autopilot] No blog channel found for ${shop}. Skipping.`);
        continue;
      }

      // 3. Fetch recent titles & 30-day history (STRICT ZERO REPETITION & ANTI-SIMILARITY)
      let existingTitles = [];
      try {
        const aResp = await fetch(
          `https://${shop}/admin/api/2024-01/blogs/${blogId}/articles.json?limit=50&fields=id,title,handle`,
          { headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" } }
        );
        if (aResp.ok) {
          const aData = await aResp.json();
          existingTitles = (aData.articles || []).map((a) => a.title).filter(Boolean);
        }
      } catch (_) {}

      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const validRecentPublishedTopics = (Array.isArray(config.publishedTopics) ? config.publishedTopics : [])
        .filter((item) => {
          if (!item) return false;
          if (typeof item === "object" && item.publishedAt) {
            const pubTime = new Date(item.publishedAt).getTime();
            return !isNaN(pubTime) && (Date.now() - pubTime) <= THIRTY_DAYS_MS;
          }
          return true;
        });

      const memoryTopicTitles = validRecentPublishedTopics
        .map((item) => (typeof item === "string" ? item : item.title || ""))
        .filter(Boolean);

      const allPreviousTitles = [
        ...new Set([
          ...existingTitles,
          ...memoryTopicTitles,
          config.lastArticleTitle,
        ].filter(Boolean))
      ];

      const past30Titles = allPreviousTitles.slice(0, 30);

      // 4. Topic Selection (Priority: User Topic Lineup Queue)
      const targetLocations = (config.targetLocations || config.targetMarket || conn.country || "").trim();
      let strategicTopic = null;

      if (Array.isArray(config.topicQueue) && config.topicQueue.length > 0) {
        const nextQueued = config.topicQueue.shift();
        if (nextQueued && typeof nextQueued === "string" && nextQueued.trim()) {
          strategicTopic = {
            topic: nextQueued.trim(),
            primaryKeyword: nextQueued.trim(),
            secondaryKeywords: config.targetKeywords ? [config.targetKeywords] : [],
          };
          logger(`[Shopify Autopilot] Consuming topic from user topic lineup queue: "${strategicTopic.topic}". Remaining in queue: ${config.topicQueue.length}`);
        }
      }

      if (!strategicTopic) {
        const sampleProducts = products.slice(0, 15).map((p) => ({
          title: p.title,
          tags: p.tags,
          product_type: p.product_type,
          handle: p.handle,
        }));

        const topicPlanningPrompt = `You are a chief eCommerce content strategist for store "${brandName}" (${primaryDomain}).
Catalog Snapshot (In-Stock Featured Products):
${JSON.stringify(sampleProducts.slice(0, 10), null, 2)}

Target Keywords / Niche: "${config.targetKeywords || config.nicheFocus || "trending luxury style & accessories"}"
${targetLocations ? `Target Geographic Territory (Countries/Cities): "${targetLocations}"` : ""}

PREVIOUS 30 PUBLISHED BLOG TITLES (FULL MONTH HISTORY - STRICT ZERO REPETITION & ZERO SIMILARITY MANDATE):
${past30Titles.map((t, idx) => `[Day ${idx + 1}] "${t}"`).join("\n")}

CRITICAL INSTRUCTIONS:
Generate 1 fresh, highly attractive, search-intent driven eCommerce article topic for 2026.
- STRICT ZERO REPETITION: The topic MUST be completely distinct in title, angle, and search intent from all 30 previous titles listed above.
- STRICT ZERO SIMILARITY: NEVER reuse formulaic patterns or phrasing similar to any past title.
- Focus on a specific styling scenario, occasion pairing guide, material craftsmanship, gift curation, or 2026 trending aesthetic strictly relevant to this store's in-stock catalog.
${targetLocations ? `- Tailor the topic and keyword angle specifically to appeal to shoppers in ${targetLocations}.` : ""}
${crossBrandForbidden.length > 0 ? `- STRICT ZERO CROSS-BRAND LEAK: ABSOLUTELY NEVER use, mention, or borrow words, concepts, or motifs related to: ${crossBrandForbidden.slice(0, 15).join(", ")}. The topic MUST strictly be 100% about "${brandName}" (${primaryDomain}).` : ""}

Format response strictly as JSON:
{
  "topic": "Compelling Title with Primary Keyword",
  "primaryKeyword": "Primary Keyword",
  "secondaryKeywords": ["keyword 1", "keyword 2", "keyword 3"],
  "featuredProductHandle": "${sampleProducts[0]?.handle || ""}"
}`;

        try {
          const topicComp = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: topicPlanningPrompt }],
            response_format: { type: "json_object" },
            temperature: 0.8,
          });
          const parsedTopic = JSON.parse(topicComp.choices[0]?.message?.content || "{}");
          if (parsedTopic.topic) {
            const relCheck = validateTopicRelevance({
              topic: parsedTopic.topic,
              primaryKeyword: parsedTopic.primaryKeyword,
              secondaryKeywords: parsedTopic.secondaryKeywords,
              forbiddenTerms: crossBrandForbidden,
              pastTitles: past30Titles,
              logger,
            });
            if (!relCheck.ok) {
              logger(`[Shopify Autopilot] Discarding topic due to validation failure ("${relCheck.violation}"). Enforcing safe unique catalog angle.`);
              strategicTopic = null;
            } else {
              strategicTopic = parsedTopic;
              logger(`[Shopify Autopilot] Strategic topic planned & verified: "${strategicTopic.topic}" (Focus: "${strategicTopic.primaryKeyword}")`);
            }
          }
        } catch (tErr) {
          logger(`[Shopify Autopilot] Fallback to default strategic topic: ${tErr.message}`);
        }

        if (!strategicTopic) {
          const pickProd = sampleProducts[0] || { title: "Exclusive Artisan Collection", handle: "" };
          strategicTopic = {
            topic: `The Art of Elevating Your Style with ${pickProd.title}: 2026 Curated Guide`,
            primaryKeyword: `${pickProd.title} styling guide`,
            secondaryKeywords: ["handcrafted jewelry", "artisan styling", "2026 luxury trends"],
            featuredProductHandle: pickProd.handle || "",
          };
        }
      }

      // 5. Generate Full 1,500+ Word Article Body
      logger(`[Shopify Autopilot] Generating 1,500+ word article: "${strategicTopic.topic}"...`);
      const primaryDomain = conn.domain || shop;
      const candidateProducts = getRelevantProductsForLinking(
        products,
        `${strategicTopic.topic} ${strategicTopic.primaryKeyword} ${(strategicTopic.secondaryKeywords || []).join(" ")}`,
        primaryDomain,
        8
      );

      const candidateProductsText = candidateProducts.length > 0
        ? candidateProducts.map((p, idx) => `${idx + 1}. Title: "${p.title}" | Direct Link: "${p.url}"`).join("\n")
        : "";

      const fullArticlePrompt = `You are a world-class eCommerce SEO copywriter and lifestyle content strategist for "${brandName}".
Write an in-depth, authoritative, and engaging 1,500+ word eCommerce blog article optimized for Google rank and product conversion.

TOPIC: ${strategicTopic.topic}
PRIMARY KEYWORD: ${strategicTopic.primaryKeyword}
SECONDARY KEYWORDS: ${(strategicTopic.secondaryKeywords || []).join(", ")}
BRAND NAME: ${brandName}
STORE DOMAIN: ${primaryDomain}
${targetLocations ? `
TARGET GEOGRAPHIC MARKET MANDATE (COUNTRIES & CITIES):
The store is actively targeting shoppers and clients in: "${targetLocations}".
- Deeply tailor the styling guides, climate/seasonal factors, consumer preferences, lifestyle references, and local context specifically for shoppers in (${targetLocations}).
- Naturally incorporate localized references, regional terminology, and city or country mentions of ${targetLocations} within subheadings, styling tips, case scenarios, and FAQ sections.
` : ""}

${candidateProductsText ? `
MANDATORY INTERNAL PRODUCT LINKING REQUIREMENTS (ECOMMERCE CONVERSION ENGINE):
You MUST organically interlink AT LEAST 4 to 5 relevant products from this store into the article body HTML.
Available Store Products to Interlink:
${candidateProductsText}

CRITICAL RULES FOR INTERNAL PRODUCT LINKS:
1. Interlink at least 4 to 5 distinct products into the body text using natural anchor text.
2. Example: <a href="https://${primaryDomain}/products/sample-product" title="Sample Product">luxurious handmade piece</a>.
3. NEVER link sold-out products.
` : ""}

CRITICAL FORMATTING & STRUCTURE RULES (AVOID DUPLICATE TITLES & ENSURE 1,600+ WORDS):
1. STRICTLY FORBIDDEN: DO NOT INCLUDE AN <h1> TAG ANYWHERE IN html!
   Shopify's theme template automatically displays the article's title in an <h1> tag at the top of the page. Repeating an <h1> tag or repeating the title in html causes an ugly duplicate title error on the live storefront!
2. Start html directly with the captivating opening narrative paragraph, or an engaging introductory <h2> that does NOT repeat the exact title.
3. MINIMUM LENGTH: 1,600 to 2,000+ words. Do NOT write brief summaries. Write comprehensive, descriptive paragraphs across 8 to 10 structured sections:
   - Section 1: Compelling Hook & Introduction (min 180 words, 2-3 paragraphs. Bold the primary keyword in the first 100 words. Start directly with text, NO <h1>).
   - Section 2: Trend Evolution & Styling Heritage in ${targetLocations || "Modern Fashion"} (min 200 words).
   - Section 3: Craftsmanship, Metalwork & Design Artistry (min 220 words, detailing materials, oxidation finish, durability, and skin-friendly design).
   - Section 4: Day-to-Night Styling & Wardrobe Pairing Blueprint (min 250 words, detailing casual, workwear, festive, and evening looks).
   - Section 5: The Ergonomics of Adjustable Sizing & Versatile Styling (min 200 words, addressing size flexibility, thumb/index/midi ring versatility).
   - Section 6: Longevity, Tarnish Prevention & Care Playbook (min 180 words, practical preservation tips).
   - Section 7: Curated Store Highlights & Featured Pieces (min 220 words, organic product links with styling reasons).
   - Section 8: Frequently Asked Questions (min 300 words, at least 4 to 5 comprehensive, schema-ready Q&As with detailed answers).
   - Section 9: The Final Verdict & Styling Inspiration (min 150 words, inspiring concluding thoughts with CTA).
4. Pure semantic HTML formatting: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>.
5. Calibrated SEO Title (50-60 characters) and Meta Description (145-155 characters).

Format response strictly as JSON:
{
  "title": "Full Article Title",
  "html": "<p>Article HTML content...</p>",
  "seoTitle": "Optimized Meta Title under 60 chars",
  "seoDescription": "Engaging Meta Description 145-155 chars with CTA",
  "tags": ["Tag1", "Tag2", "Tag3", "Tag4"],
  "imagePrompt": "Detailed photographic prompt for featured image"
}`;

      const artComp = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: fullArticlePrompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 4096,
      });

      const articleData = JSON.parse(artComp.choices[0]?.message?.content || "{}");
      if (!articleData.title || !articleData.html) {
        throw new Error("OpenAI returned incomplete article content.");
      }

      // Sanitize bodyHtml: strip any accidental <h1> or duplicate title headers
      const sanitizedBodyHtml = sanitizeShopifyBodyHtml(articleData.html, articleData.title);

      // 6. Generate Ultra-HD Hero Image via Approved Models Cascade
      const visualGuard = getVisualGuardDirectives({
        businessName: brandName,
        industry: config.nicheFocus || "Jewellery & Lifestyle Fashion",
        currentSiteUrl: primaryDomain,
      });

      let imageData = { imageUrl: null, base64: null };
      const imagePrompt = `${articleData.imagePrompt || `Editorial high-end commercial hero image for "${articleData.title}"`}. ${visualGuard.requiredAesthetic}, 8k resolution, cinematic lighting, ultra-detailed textures. ${visualGuard.negativeConstraints}`;
      const candidateModels = ["gpt-image-2", "gpt-image-2-2026-04-21", "gpt-image-1.5"];

      for (const modelName of candidateModels) {
        try {
          logger(`[Shopify Autopilot] Generating hero image via ${modelName} for ${shop}...`);
          const imgRes = await openai.images.generate({
            model: modelName,
            prompt: imagePrompt.substring(0, 1000),
            size: "1024x1024",
          });

          if (imgRes.data?.[0]?.b64_json) {
            imageData.base64 = imgRes.data[0].b64_json;
            imageData.imageUrl = `data:image/png;base64,${imgRes.data[0].b64_json}`;
            logger(`[Shopify Autopilot] Successfully generated hero image via ${modelName}`);
            break;
          } else if (imgRes.data?.[0]?.url) {
            imageData.imageUrl = imgRes.data[0].url;
            logger(`[Shopify Autopilot] Successfully generated hero image via ${modelName}`);
            break;
          }
        } catch (imgErr) {
          logger(`[Shopify Autopilot] Model ${modelName} failed (${imgErr.message}), trying next candidate...`);
        }
      }

      if (!imageData.base64 && !imageData.imageUrl) {
        logger(`[Shopify Autopilot] All approved image models failed. Proceeding without degraded visual.`);
      }

      // 7. Publish to Shopify Store
      logger(`[Shopify Autopilot] Publishing article to Shopify Blog (${blogHandle})...`);
      const payloadArticle = {
        title: articleData.title,
        body_html: sanitizedBodyHtml,
        author: brandName,
        tags: Array.isArray(articleData.tags) ? articleData.tags.join(", ") : articleData.tags || "",
        published: !config.isDraft,
      };

      if (articleData.seoDescription) {
        payloadArticle.summary_html = `<p>${articleData.seoDescription}</p>`;
      }

      if (imageData.base64) {
        payloadArticle.image = {
          attachment: imageData.base64,
          alt: articleData.title,
        };
      }

      const createRes = await fetch(`https://${shop}/admin/api/2024-01/blogs/${blogId}/articles.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ article: payloadArticle }),
      });

      if (!createRes.ok) {
        const errTxt = await createRes.text();
        throw new Error(`Shopify Article Creation failed: ${errTxt}`);
      }

      const createdJson = await createRes.json();
      const createdArticle = createdJson.article || {};
      const articleHandle = createdArticle.handle || "";
      const cleanDomain = primaryDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const publicUrl = `https://${cleanDomain}/blogs/${blogHandle}/${articleHandle}`;

      logger(`[Shopify Autopilot] Successfully published article ID ${createdArticle.id} for ${shop}: ${publicUrl}`);

      // 7.5 Multichannel Social Syndication
      if (!config.isDraft && (config.autoShareFacebook || config.autoShareInstagram)) {
        try {
          const [brandMemsRes, bundlePairRes] = await Promise.all([
            supabase
              .from("agent_memory")
              .select("content")
              .eq("email", userEmail.toLowerCase())
              .like("memory_type", "meta_conn_%"),
            supabase
              .from("agent_memory")
              .select("content")
              .eq("email", userEmail.toLowerCase())
              .in("memory_type", ["bundle_pairings", "brand_asset_pairings"])
              .maybeSingle(),
          ]);

          const brandProfiles = [];
          (brandMemsRes.data || []).forEach((m) => {
            try { brandProfiles.push(JSON.parse(m.content)); } catch (_) {}
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

          const cleanDomainStr = (str) => String(str || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
          const normDomain = cleanDomainStr(conn.domain || conn.primary_domain || primaryDomain || shop);
          const bKey = (conn.businessName || conn.name || conn.shopName || brandName || "").toLowerCase().replace(/[^a-z0-9]/g, "");

          let matchedBrand = null;
          if (config.selectedMetaPageId) {
            matchedBrand = brandProfiles.find((b) => b.pageId === config.selectedMetaPageId);
          }
          if (!matchedBrand) {
            matchedBrand = brandProfiles.find((b) => {
              const bProfileKey = (b.businessName || b.pageName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
              const bUrl = cleanDomainStr(b.website || b.websiteUrl || "");
              const bIg = String(b.igUsername || "").toLowerCase().replace(/[^a-z0-9]/g, "");
              return (
                (bKey && bProfileKey && (bKey === bProfileKey || bProfileKey.includes(bKey) || bKey.includes(bProfileKey))) ||
                (bUrl && normDomain && (normDomain === bUrl || normDomain.includes(bUrl) || bUrl.includes(normDomain))) ||
                (bIg && bKey && (bIg.includes(bKey) || bKey.includes(bIg)))
              );
            });
          }

          if (!matchedBrand || !matchedBrand.pageId || !matchedBrand.pageToken) {
            logger(`[Shopify Autopilot 🛡️ Anti-Exploitation Shield] Social syndication BLOCKED: Store "${brandName}" (${primaryDomain}) does not have a verified matching Meta account. Cross-business posting prevented.`);
          } else {
            const API_VERSION = "v21.0";
            const shareTitle = articleData.title || "";
            const shareDesc = articleData.seoDescription || `Discover the latest insights from ${conn.name || "our store"}.`;
            const cleanTag = (conn.name || "OnlineStore").replace(/[^a-zA-Z0-9]/g, "");
            const shareMsg = `✨ ${shareTitle}\n\n${shareDesc}\n\nExplore our latest live article:\n${publicUrl}\n\n#${cleanTag} #Shopify #Trending`;

            // Share to Facebook Page (respects config: true or not explicitly disabled)
            const shouldShareFb = (config.autoShareFacebook === true || config.autoShareFacebook === undefined) && matchedBrand.pageId && matchedBrand.pageToken;
            if (shouldShareFb) {
              try {
                const feedUrl = `https://graph.facebook.com/${API_VERSION}/${matchedBrand.pageId}/feed`;
                const feedParams = new URLSearchParams();
                feedParams.append("link", publicUrl);
                feedParams.append("message", shareMsg);
                feedParams.append("access_token", matchedBrand.pageToken);

                const fRes = await fetch(feedUrl, { method: "POST", body: feedParams });
                const fData = await fRes.json();
                if (fData?.id) {
                  logger(`[Shopify Autopilot] Live blog successfully syndicated to Facebook Page '${matchedBrand.pageName}': ${fData.id}`);
                } else {
                  logger(`[Shopify Autopilot] Facebook syndication note: ${fData?.error?.message}`);
                }
              } catch (fbErr) {
                logger(`[Shopify Autopilot] Facebook syndication error: ${fbErr.message}`);
              }
            }

            // Share to Instagram (respects config: true or not explicitly disabled)
            const publicHeroImg = createdArticle.image?.src || imageData.imageUrl || null;
            const hasHeroImage = Boolean(publicHeroImg || imageData.base64);
            const shouldShareIg = (config.autoShareInstagram === true || config.autoShareInstagram === undefined) && matchedBrand.igId && matchedBrand.pageToken && hasHeroImage;
            if (shouldShareIg) {
              try {
                const cleanIgImgUrl = await ensureInstagramCompatibleJpeg({
                  imageUrl: publicHeroImg,
                  imageBuffer: imageData.base64 ? Buffer.from(imageData.base64, "base64") : null,
                  supabase,
                  bucket: "instagram-creatives",
                  logger: (msg) => logger(`[Shopify Autopilot] ${msg}`),
                });

                const igContainerUrl = `https://graph.facebook.com/${API_VERSION}/${matchedBrand.igId}/media`;
                const igCaption = `${shareTitle}\n\n${shareDesc}\n\n🔗 Link in bio to read full guide!\n\n#${cleanTag} #Trending`;
                const cParams = new URLSearchParams();
                cParams.append("image_url", cleanIgImgUrl);
                cParams.append("caption", igCaption);
                cParams.append("access_token", matchedBrand.pageToken);

                const cRes = await fetch(igContainerUrl, { method: "POST", body: cParams });
                const cData = await cRes.json();
                if (cData?.id) {
                  const creationId = cData.id;
                  // Poll for readiness
                  for (let attempt = 0; attempt < 10; attempt++) {
                    await new Promise((r) => setTimeout(r, 2000));
                    const statusRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${creationId}?fields=status_code&access_token=${matchedBrand.pageToken}`);
                    const statusJson = await statusRes.json().catch(() => ({}));
                    if (statusJson.status_code === "FINISHED") break;
                  }
                  const pubUrl = `https://graph.facebook.com/${API_VERSION}/${matchedBrand.igId}/media_publish`;
                  const pubParams = new URLSearchParams();
                  pubParams.append("creation_id", creationId);
                  pubParams.append("access_token", matchedBrand.pageToken);
                  const pRes = await fetch(pubUrl, { method: "POST", body: pubParams });
                  const pData = await pRes.json().catch(() => ({}));
                  logger(`[Shopify Autopilot] Live blog syndicated to Instagram @${matchedBrand.igUsername}: ${pData?.id || "submitted"}`);
                }
              } catch (igErr) {
                logger(`[Shopify Autopilot] Instagram syndication note: ${igErr.message}`);
              }
            }
          }
        } catch (socialErr) {
          logger(`[Shopify Autopilot] Social syndication bypass: ${socialErr.message}`);
        }
      }

      // 8. Update Memory State (Strict 30-Day Topic History)
      const THIRTY_DAYS_MS_SAVE = 30 * 24 * 60 * 60 * 1000;
      const updatedPublishedTopics = (Array.isArray(config.publishedTopics) ? config.publishedTopics : [])
        .filter((entry) => {
          if (!entry) return false;
          if (typeof entry === "object" && entry.publishedAt) {
            const pubTime = new Date(entry.publishedAt).getTime();
            return !isNaN(pubTime) && (Date.now() - pubTime) <= THIRTY_DAYS_MS_SAVE;
          }
          return true;
        });

      updatedPublishedTopics.push({
        title: articleData.title,
        publishedAt: new Date().toISOString(),
        articleId: createdArticle.id,
        handle: articleHandle,
      });
      if (updatedPublishedTopics.length > 80) updatedPublishedTopics.shift();

      const updatedConfig = {
        ...config,
        lastPublishedAt: new Date().toISOString(),
        lastArticleTitle: articleData.title,
        lastArticleUrl: publicUrl,
        topicQueue: config.topicQueue,
        publishedTopics: updatedPublishedTopics,
        recentArticles: [
          {
            id: createdArticle.id,
            title: articleData.title,
            url: publicUrl,
            publishedAt: new Date().toISOString(),
          },
          ...(config.recentArticles || []).slice(0, 9),
        ],
      };

      await supabase.from("agent_memory").upsert(
        {
          email: userEmail,
          memory_type: autoMemoryKey,
          content: JSON.stringify(updatedConfig),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,memory_type" }
      );

      results.push({
        shop,
        email: userEmail,
        status: "success",
        articleId: createdArticle.id,
        title: articleData.title,
        articleUrl: publicUrl,
        isDraft: config.isDraft,
      });
    } catch (err) {
      logger(`[Shopify Autopilot] Error during generation for ${shop}: ${err.message}`);
      results.push({
        shop,
        email: userEmail,
        status: "failed",
        error: err.message,
      });
    }
  }

  logger(`[Shopify Autopilot] Cycle completed. Results: ${JSON.stringify(results)}`);
  return results;
}
