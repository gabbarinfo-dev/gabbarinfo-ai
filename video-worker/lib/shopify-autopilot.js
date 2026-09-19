// video-worker/lib/shopify-autopilot.js
const OpenAI = require("openai");

/**
 * Validates and refreshes offline Shopify access token if expiring or expired.
 */
async function getValidShopifyAccessToken(connection, email, supabase, logger = console.log) {
  if (!connection) return null;

  // Custom App tokens or legacy tokens without refresh token
  if (!connection.refresh_token) {
    return connection.access_token;
  }

  const isExpiringSoon = connection.expires_at && (Date.now() + 5 * 60 * 1000 > connection.expires_at);
  if (!isExpiringSoon && connection.access_token) {
    return connection.access_token;
  }

  const defaultSecret = Buffer.from("c2hwc3NfOWU2Mjc2NTI2OWIyNTNlYWEyMDk5ZWY5MDE1YWE1Mjc=", "base64").toString("utf8");
  const defaultClientId = Buffer.from("ODIxYmNiZmY4N2NlNWVmNjg1NjFkMTY0MDM5MjI5MWU=", "base64").toString("utf8");

  const clientId = process.env.SHOPIFY_CLIENT_ID || defaultClientId;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET || defaultSecret;

  try {
    logger(`[Shopify Autopilot] Refreshing expiring offline token for ${connection.shop}...`);
    const refreshRes = await fetch(`https://${connection.shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: connection.refresh_token,
      }),
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      const updatedConnection = {
        ...connection,
        access_token: data.access_token,
        refresh_token: data.refresh_token || connection.refresh_token,
        expires_at: Date.now() + ((data.expires_in || 3600) * 1000),
        updated_at: new Date().toISOString(),
      };

      if (supabase && email) {
        await supabase.from("agent_memory").upsert(
          {
            email,
            memory_type: "shopify_connection",
            content: JSON.stringify(updatedConnection),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email,memory_type" }
        );
      }

      logger(`[Shopify Autopilot] Token refreshed successfully for ${connection.shop}.`);
      return updatedConnection.access_token;
    } else {
      const errTxt = await refreshRes.text();
      logger(`[Shopify Autopilot] Token refresh HTTP error: ${errTxt}`);
    }
  } catch (e) {
    logger(`[Shopify Autopilot] Exception during token refresh: ${e.message}`);
  }

  return connection.access_token;
}

function getRelevantProductsForLinking(products = [], queryText = "", primaryDomain = "", maxCount = 8) {
  if (!Array.isArray(products) || products.length === 0) return [];

  const stopwords = new Set([
    "a", "an", "the", "and", "or", "but", "if", "because", "as", "what",
    "when", "where", "how", "all", "any", "both", "each", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "can", "will", "just", "should",
    "now", "in", "on", "at", "to", "for", "with", "by", "from", "about",
    "into", "through", "during", "before", "after", "above", "below",
    "of", "off", "over", "under", "again", "further", "then", "once",
    "here", "there", "why", "our", "your", "my", "their", "its", "is", "are"
  ]);

  const tokens = String(queryText || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));

  const scored = products.map((p) => {
    let score = 0;
    const titleLower = (p.title || "").toLowerCase();
    const tagsLower = (Array.isArray(p.tags) ? p.tags.join(" ") : String(p.tags || "")).toLowerCase();
    const typeLower = (p.product_type || "").toLowerCase();

    for (const token of tokens) {
      if (titleLower.includes(token)) score += 3;
      if (tagsLower.includes(token)) score += 2;
      if (typeLower.includes(token)) score += 2;
    }

    return {
      id: p.id,
      title: p.title,
      handle: p.handle,
      product_type: p.product_type,
      tags: p.tags,
      url: `https://${primaryDomain}/products/${p.handle}`,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  let selected = scored.filter((p) => p.score > 0).slice(0, maxCount);

  if (selected.length < 5) {
    const selectedIds = new Set(selected.map((p) => p.id));
    for (const p of scored) {
      if (!selectedIds.has(p.id)) {
        selected.push(p);
        selectedIds.add(p.id);
        if (selected.length >= 6) break;
      }
    }
  }

  return selected;
}

function isProductInStock(p) {
  if (!p) return false;
  if (p.status && p.status !== "active") return false;

  const variants = p.variants;
  if (!Array.isArray(variants) || variants.length === 0) return true;

  // Available if continue policy, unmanaged inventory, or quantity > 0
  return variants.some((v) => {
    if (!v.inventory_management) return true;
    if (v.inventory_policy === "continue") return true;
    return typeof v.inventory_quantity === "number" && v.inventory_quantity > 0;
  });
}

function sanitizeShopifyBodyHtml(bodyHtml, title) {
  if (!bodyHtml) return "";
  let clean = String(bodyHtml).trim();
  // Remove markdown code fences if present
  clean = clean.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

  // Strip any leading <h1>...</h1> tag completely
  clean = clean.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "");

  // If the body starts with an <h2> that is identical or near-identical to the title, strip it too
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

/**
 * Main autonomous Shopify publishing cycle on Railway worker.
 */
async function runShopifyAutopilotCycle({ supabase, openai, force = false, email = null, logger = console.log }) {
  if (!supabase) throw new Error("Supabase client is required.");
  if (!openai) {
    openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
  }
  if (!openai) throw new Error("OpenAI client is required for blog and image generation.");

  logger("[Shopify Autopilot] Starting autonomous eCommerce blog generation cycle on Railway...");

  // 1. Fetch connected Shopify stores
  let connQuery = supabase
    .from("agent_memory")
    .select("email, memory_type, content, updated_at")
    .eq("memory_type", "shopify_connection");

  if (email) {
    connQuery = connQuery.eq("email", email.trim().toLowerCase());
  }

  const { data: storeConns, error: connErr } = await connQuery;
  if (connErr) {
    logger(`[Shopify Autopilot] Failed to fetch Shopify connections: ${connErr.message}`);
    throw connErr;
  }

  if (!storeConns || storeConns.length === 0) {
    logger("[Shopify Autopilot] No connected Shopify stores found.");
    return [];
  }

  const results = [];

  for (const connRow of storeConns) {
    const userEmail = connRow.email;
    let conn = null;
    try {
      conn = typeof connRow.content === "string" ? JSON.parse(connRow.content) : connRow.content;
    } catch (_) {
      continue;
    }

    if (!conn || !conn.shop) continue;
    const shop = conn.shop;
    const brandName = conn.shopName || shop.split(".")[0] || "Our Store";

    logger(`[Shopify Autopilot] Evaluating store: ${shop} (${userEmail})...`);

    // 2. Fetch Autopilot Config for this store
    const autoMemoryKey = `shopify_autopilot_${shop}`;
    const { data: autoMemRow } = await supabase
      .from("agent_memory")
      .select("content")
      .eq("email", userEmail)
      .eq("memory_type", autoMemoryKey)
      .maybeSingle();

    let config = {
      enabled: false,
      cadence: "daily",
      blogId: null,
      blogHandle: "news",
      isDraft: false,
      targetKeywords: "",
      nicheFocus: "",
      recentArticles: [],
    };

    if (autoMemRow?.content) {
      try {
        config = { ...config, ...(typeof autoMemRow.content === "string" ? JSON.parse(autoMemRow.content) : autoMemRow.content) };
      } catch (_) {}
    }

    // If disabled and not forced, skip
    if (!config.enabled && !force) {
      logger(`[Shopify Autopilot] Autopilot paused for ${shop}. Skipping.`);
      results.push({ shop, email: userEmail, status: "skipped", reason: "autopilot_paused" });
      continue;
    }

    // 3. Cadence Check
    const lastPublished = config.lastPublishedAt ? new Date(config.lastPublishedAt) : null;
    const now = new Date();
    const cadence = config.cadence || "daily";

    let minIntervalMs = 12 * 60 * 60 * 1000; // daily: 12h
    if (cadence === "weekly") {
      minIntervalMs = 5 * 24 * 60 * 60 * 1000;
    } else if (cadence === "3x_week") {
      minIntervalMs = 2 * 24 * 60 * 60 * 1000;
    }

    if (lastPublished && (now - lastPublished) < minIntervalMs && !force) {
      logger(`[Shopify Autopilot] Cadence threshold not reached for ${shop}. Last run: ${config.lastPublishedAt}. Skipping.`);
      results.push({ shop, email: userEmail, status: "skipped", reason: "cadence_threshold_not_reached" });
      continue;
    }

    // 4. Token Resolution
    const accessToken = await getValidShopifyAccessToken(conn, userEmail, supabase, logger);
    if (!accessToken) {
      logger(`[Shopify Autopilot] No valid access token for ${shop}. Skipping.`);
      results.push({ shop, email: userEmail, status: "failed", reason: "missing_token" });
      continue;
    }

    try {
      // 5. Fetch Store Products for Dynamic Catalog Intelligence (Only In-Stock Products)
      logger(`[Shopify Autopilot] Fetching in-stock catalog products for ${shop}...`);
      let products = [];
      try {
        const prodRes = await fetch(
          `https://${shop}/admin/api/2024-01/products.json?limit=250&fields=id,title,handle,product_type,tags,variants,status`,
          {
            headers: {
              "X-Shopify-Access-Token": accessToken,
              "Content-Type": "application/json",
            },
          }
        );
        if (prodRes.ok) {
          const pData = await prodRes.json();
          // Filter out sold-out and inactive products so they are NEVER interlinked
          products = (pData.products || []).filter(isProductInStock);
        }
      } catch (pErr) {
        logger(`[Shopify Autopilot] Catalog fetch note: ${pErr.message}`);
      }

      // 6. Fetch Available Blogs to Determine Channel
      let blogId = config.blogId;
      let blogHandle = config.blogHandle || "news";

      try {
        const blogsRes = await fetch(`https://${shop}/admin/api/2024-01/blogs.json`, {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        });
        if (blogsRes.ok) {
          const bData = await blogsRes.json();
          const blogList = bData.blogs || [];
          if (blogList.length > 0) {
            let matchedBlog = null;
            if (blogId) {
              matchedBlog = blogList.find((b) => String(b.id) === String(blogId));
            }
            if (!matchedBlog) {
              matchedBlog = blogList[0];
            }
            blogId = matchedBlog.id;
            blogHandle = matchedBlog.handle || "news";
          }
        }
      } catch (bErr) {
        logger(`[Shopify Autopilot] Blog channel fetch note: ${bErr.message}`);
      }

      if (!blogId) {
        logger(`[Shopify Autopilot] No blog channel found for ${shop}. Skipping.`);
        results.push({ shop, email: userEmail, status: "failed", reason: "no_blog_channel_found" });
        continue;
      }

      // 7. Check Existing Published Articles to Avoid Topic Collision
      let existingTitles = [];
      try {
        const articlesRes = await fetch(`https://${shop}/admin/api/2024-01/blogs/${blogId}/articles.json?limit=25`, {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        });
        if (articlesRes.ok) {
          const aData = await articlesRes.json();
          existingTitles = (aData.articles || []).map((a) => a.title).filter(Boolean);
        }
      } catch (aErr) {
        logger(`[Shopify Autopilot] Recent articles fetch note: ${aErr.message}`);
      }

      // 8. Determine Strategic Topic (Priority 1: User-Selected Topic Lineup Queue)
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
        const sampleProducts = products.slice(0, 10).map((p) => ({
          title: p.title,
          tags: p.tags,
          product_type: p.product_type,
          handle: p.handle,
        }));

        const topicPlanningPrompt = `You are a chief eCommerce content strategist for store "${brandName}".
Catalog Snapshot:
${JSON.stringify(sampleProducts, null, 2)}

Target Keywords / Niche: "${config.targetKeywords || config.nicheFocus || "luxury lifestyle & trending apparel"}"
${targetLocations ? `Target Geographic Territory (Countries/Cities): "${targetLocations}"` : ""}
Previous Published Titles (Avoid Duplication):
${existingTitles.slice(0, 10).join("\n")}

Generate 1 fresh, highly attractive, search-intent driven eCommerce article topic for 2026.
${targetLocations ? `Tailor the topic and keyword angle specifically to appeal to shoppers in ${targetLocations}.` : ""}
Format response strictly as JSON:
{
  "topic": "Compelling Title with Primary Keyword",
  "primaryKeyword": "Primary Keyword",
  "secondaryKeywords": ["keyword 1", "keyword 2", "keyword 3"],
  "featuredProductHandle": "${sampleProducts[0]?.handle || ""}"
}`;

        strategicTopic = {
          topic: `Top Trending Styles and Curated Essentials for 2026: Elevate Your Wardrobe`,
          primaryKeyword: "luxury fashion trends 2026",
          secondaryKeywords: ["designer streetwear", "premium apparel", "winter style guide"],
        };

        try {
          const topicComp = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: topicPlanningPrompt }],
            response_format: { type: "json_object" },
            temperature: 0.8,
          });
          const parsedTopic = JSON.parse(topicComp.choices[0]?.message?.content || "{}");
          if (parsedTopic.topic) {
            strategicTopic = parsedTopic;
          }
        } catch (tErr) {
          logger(`[Shopify Autopilot] Fallback to default strategic topic: ${tErr.message}`);
        }
      }

      // 9. Generate Full 1,500+ Word Authoritative Article Body
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

      const fullArticlePrompt = `You are an elite, award-winning eCommerce lifestyle editor and senior SEO copywriter for "${brandName}".
Write an in-depth, authoritative, and deeply engaging 1,600 to 2,000+ word eCommerce blog guide optimized for high Google rankings, reader dwell time, and e-commerce product conversion.

TOPIC: ${strategicTopic.topic}
PRIMARY FOCUS KEYWORD: ${strategicTopic.primaryKeyword}
SECONDARY KEYWORDS: ${(strategicTopic.secondaryKeywords || []).join(", ")}
BRAND NAME: ${brandName}
STORE DOMAIN: ${primaryDomain}
${targetLocations ? `
TARGET GEOGRAPHIC MARKET (COUNTRIES & CITIES):
The store targets shoppers in: "${targetLocations}".
- Deeply tailor styling recommendations, lifestyle context, seasonal climate, and cultural nuances specifically to shoppers in ${targetLocations}.
- Naturally weave in city/regional terminology and local context into subheadings, styling scenarios, and FAQ answers.
` : ""}

${candidateProductsText ? `
MANDATORY INTERNAL PRODUCT LINKING (CONVERSION ENGINE):
You MUST naturally interlink AT LEAST 4 to 5 of these available in-stock products within the article body:
${candidateProductsText}

CRITICAL RULES FOR INTERNAL PRODUCT LINKS:
1. In-Text Mentions: Embed at least 3-4 clickable product links naturally within styling recommendations and outfit breakdowns using standard HTML:
   <a href="EXACT_PRODUCT_URL" title="Product Title" target="_blank" rel="noopener noreferrer">Descriptive Anchor Text or Product Name</a>
   (Never use generic "click here". Use natural descriptive phrasing, e.g. "...complement this look with an intricate <a href=\"EXACT_URL\">Product Title</a> for an effortless statement...")
2. Dedicated Featured Collection Block:
   Include an <h3>Curated Store Highlights / Featured Pieces</h3> section showcasing 4 to 5 products with direct links and 1-2 sentences on why each completes the look.
3. Strict URL Precision: Use ONLY the exact product URLs provided. Do NOT invent URLs.
` : ""}

CRITICAL FORMATTING & STRUCTURE RULES (AVOID DUPLICATE TITLES & ENSURE 1,800+ WORDS):
1. STRICTLY FORBIDDEN: DO NOT INCLUDE AN <h1> TAG ANYWHERE IN bodyHtml!
   Shopify's theme template automatically displays the article's title in an <h1> tag at the top of the page. Repeating an <h1> tag or repeating the title in bodyHtml causes an ugly duplicate title error on the live storefront!
2. Start bodyHtml directly with the captivating opening narrative paragraph. Do NOT repeat the exact title in the opening heading.
3. MINIMUM LENGTH: 1,800 to 2,400+ words. Do NOT write brief summaries. Write comprehensive, descriptive multi-paragraph content across 10 structured sections (each with at least 3 detailed paragraphs):
   - Section 1: Compelling Hook & Introduction (min 220 words, 3 detailed paragraphs. Bold the primary keyword in the first 100 words. Start directly with text, NO <h1>).
   - Section 2: Trend Evolution & Styling Heritage in ${targetLocations || "Modern Fashion"} (min 250 words, 3 detailed paragraphs).
   - Section 3: Craftsmanship, Metalwork & Design Artistry (min 250 words, detailing materials, oxidation finish, durability, and skin-friendly design).
   - Section 4: Day-to-Night Styling & Wardrobe Pairing Blueprint (min 320 words, detailing casual, workwear, festive, and evening looks).
   - Section 5: The Ergonomics of Adjustable Sizing & Versatile Styling (min 220 words, addressing size flexibility, thumb/index/midi ring versatility).
   - Section 6: Seasonal Wardrobe Harmony: From Chunky Knitwear to Summer Silks (min 240 words).
   - Section 7: Curated Store Highlights & Featured Pieces (min 280 words, organic product links with styling reasons).
   - Section 8: Longevity, Tarnish Prevention & Care Playbook (min 240 words, practical preservation tips).
   - Section 9: Frequently Asked Questions (min 650 words, at least 6 comprehensive, schema-ready Q&As with multi-paragraph detailed answers).
   - Section 10: The Final Verdict & Styling Inspiration (min 200 words, inspiring concluding thoughts with CTA).
4. Pure semantic HTML formatting: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>.
5. Calibrated SEO Title (50-60 characters) and Meta Description (145-155 characters).

Respond ONLY with a valid JSON object matching this schema:
{
  "title": "Full Article Title",
  "seoTitle": "Calibrated SEO Title under 60 characters",
  "seoDescription": "Compelling Meta Description between 145-155 chars",
  "bodyHtml": "<p>Direct opening paragraph...</p>",
  "tags": ["tag1", "tag2", "tag3"]
}`;

      // 10. Run Text Generation and Image Generation Concurrently
      const articlePromise = (async () => {
        const comp = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: fullArticlePrompt }],
          response_format: { type: "json_object" },
          max_tokens: 4096,
          temperature: 0.7,
        });
        return JSON.parse(comp.choices[0]?.message?.content || "{}");
      })();

      const imagePromise = (async () => {
        const imagePrompt = `Ultra-realistic cinematic editorial lifestyle commercial photograph for eCommerce article titled "${strategicTopic.topic}". High fashion luxury aesthetic, 8k professional studio lighting, depth of field, award-winning commercial shot, clean product styling.`;
        const candidateModels = ["gpt-image-2", "gpt-image-2-2026-04-21", "gpt-image-1.5"];
        for (const modelName of candidateModels) {
          try {
            logger(`[Shopify Autopilot] Generating hero image via ${modelName} for ${shop}...`);
            const imgGen = await openai.images.generate({
              model: modelName,
              prompt: imagePrompt,
              size: "1024x1024",
            });
            if (imgGen.data?.[0]?.b64_json || imgGen.data?.[0]?.url) {
              return {
                imageBase64: imgGen.data?.[0]?.b64_json || null,
                imageUrl: imgGen.data?.[0]?.url || null,
              };
            }
          } catch (imgErr) {
            logger(`[Shopify Autopilot] ${modelName} failed (${imgErr.message}), trying next candidate...`);
          }
        }
        logger(`[Shopify Autopilot] All approved gpt-image models failed. Aborting image attachment rather than using degraded models.`);
        return { imageBase64: null, imageUrl: null };
      })();

      const [articleSettled, imageSettled] = await Promise.allSettled([articlePromise, imagePromise]);
      const articleData = articleSettled.status === "fulfilled" && articleSettled.value ? articleSettled.value : null;
      const imageData = imageSettled.status === "fulfilled" && imageSettled.value ? imageSettled.value : { imageBase64: null, imageUrl: null };

      if (!articleData || !articleData.title || !articleData.bodyHtml) {
        throw new Error("AI failed to generate valid article HTML content.");
      }

      // Sanitize bodyHtml: strip any accidental <h1> or duplicate title headers
      const sanitizedBodyHtml = sanitizeShopifyBodyHtml(articleData.bodyHtml, articleData.title);

      // 11. Post Article with Featured Image Directly to Shopify
      logger(`[Shopify Autopilot] Publishing article to Shopify Blog (${blogHandle})...`);
      const articlePayload = {
        title: articleData.title,
        body_html: sanitizedBodyHtml,
        author: brandName || "Bella & Diva",
        tags: Array.isArray(articleData.tags) ? articleData.tags.join(", ") : (articleData.tags || strategicTopic.primaryKeyword),
        published: !config.isDraft,
      };

      if (articleData.seoDescription) {
        articlePayload.summary_html = articleData.seoDescription;
      }

      if (imageData.imageBase64) {
        articlePayload.image = {
          attachment: imageData.imageBase64,
          alt: articleData.title,
        };
      } else if (imageData.imageUrl) {
        articlePayload.image = {
          src: imageData.imageUrl,
          alt: articleData.title,
        };
      }

      const postRes = await fetch(`https://${shop}/admin/api/2024-01/blogs/${blogId}/articles.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ article: articlePayload }),
      });

      if (!postRes.ok) {
        const postErr = await postRes.text();
        throw new Error(`Shopify API rejected article: ${postErr}`);
      }

      const publishedData = await postRes.json();
      const articleObj = publishedData.article || {};
      const storeHandle = shop.replace(".myshopify.com", "");
      const adminUrl = `https://admin.shopify.com/store/${storeHandle}/articles/${articleObj.id}`;
      const publicUrl = `https://${conn.domain || shop}/blogs/${blogHandle}/${articleObj.handle}`;
      const finalUrl = config.isDraft ? adminUrl : publicUrl;

      logger(`[Shopify Autopilot] Successfully published article ID ${articleObj.id} for ${shop}: ${finalUrl}`);

      // 11.5 Autonomous Social Media Syndication (Facebook & Instagram)
      const socialShares = {};
      if (!config.isDraft) {
        try {
          const { data: meta } = await supabase
            .from("meta_connections")
            .select("fb_page_id, fb_page_access_token, fb_user_access_token, instagram_actor_id, ig_business_id")
            .eq("email", userEmail.toLowerCase())
            .maybeSingle();

          if (meta) {
            const pageId = meta.fb_page_id ? meta.fb_page_id.split(",")[0].trim() : null;
            const effectiveToken = meta.fb_page_access_token || meta.fb_user_access_token;
            const igId = meta.instagram_actor_id || meta.ig_business_id;

            // 11.5.1 Brand Integrity & Anti-Exploitation Cross-Check
            let isBrandMatched = false;
            let metaAssetTitle = "";
            try {
              if (pageId && effectiveToken) {
                const checkRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}?fields=name,website&access_token=${effectiveToken}`);
                if (checkRes.ok) {
                  const checkData = await checkRes.json();
                  metaAssetTitle = checkData.name || "";
                  const pWeb = checkData.website || "";

                  const normStore = String(brandName || primaryDomain || shop || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                  const normMeta = String(metaAssetTitle || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                  const normWeb = String(pWeb || "").toLowerCase().replace(/[^a-z0-9]/g, "");

                  if (normStore && normMeta && (normStore.includes(normMeta) || normMeta.includes(normStore))) {
                    isBrandMatched = true;
                  }
                  if (normStore && normWeb && (normStore.includes(normWeb) || normWeb.includes(normStore))) {
                    isBrandMatched = true;
                  }
                }
              }
            } catch (vErr) {
              logger(`[Shopify Autopilot] Brand validation warning: ${vErr.message}`);
            }

            if (!isBrandMatched) {
              logger(`[Shopify Autopilot 🛡️ Anti-Exploitation Shield] Social syndication BLOCKED: Store "${brandName}" (${primaryDomain}) does not match connected Meta channel "${metaAssetTitle || pageId}". Cross-business posting prevented.`);
            } else {
              // Facebook Page link preview / photo post
              if (config.autoShareFacebook === true && pageId && effectiveToken) {
                try {
                  logger(`[Shopify Autopilot] Syndicating article to Facebook Page (${pageId})...`);
                  const feedParams = new URLSearchParams();
                  feedParams.append("link", publicUrl);
                  feedParams.append(
                    "message",
                    `📢 ${articleData.title}\n\n${articleData.seoDescription || ""}\n\nRead full article & explore pieces 👇\n${publicUrl}\n\n#Shopify #OnlineShopping #TrendingStyles`
                  );
                  feedParams.append("access_token", effectiveToken);
                  const fbRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
                    method: "POST",
                    body: feedParams,
                  });
                  const fbData = await fbRes.json();
                  if (fbData.id) {
                    socialShares.facebook = { ok: true, id: fbData.id };
                    logger(`[Shopify Autopilot] Facebook post published: ${fbData.id}`);
                  }
                } catch (fbErr) {
                  logger(`[Shopify Autopilot] Facebook syndication error: ${fbErr.message}`);
                }
              }

              // Instagram Feed Photo post
              const shareImg = imageData.imageUrl;
              if (config.autoShareInstagram === true && igId && effectiveToken && shareImg) {
                try {
                  logger(`[Shopify Autopilot] Syndicating article to Instagram (${igId})...`);
                  const igCaption = `📢 ${articleData.title}\n\n${articleData.seoDescription || ""}\n\n🔗 Read full story & shop the pieces: ${publicUrl}\n\n#Shopify #OnlineShopping #TrendingStyles`;
                  const containerParams = new URLSearchParams();
                  containerParams.append("image_url", shareImg);
                  containerParams.append("caption", igCaption);
                  containerParams.append("access_token", effectiveToken);

                  const cRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media`, {
                    method: "POST",
                    body: containerParams,
                  });
                  const cData = await cRes.json();

                  if (cData.id) {
                    // Poll container status then publish
                    let ready = false;
                    for (let attempt = 0; attempt < 5; attempt++) {
                      await new Promise((r) => setTimeout(r, 3000));
                      const sRes = await fetch(`https://graph.facebook.com/v21.0/${cData.id}?fields=status_code&access_token=${effectiveToken}`);
                      const sData = await sRes.json();
                      if (sData.status_code === "FINISHED") {
                        ready = true;
                        break;
                      }
                    }

                    if (ready) {
                      const pubParams = new URLSearchParams();
                      pubParams.append("creation_id", cData.id);
                      pubParams.append("access_token", effectiveToken);
                      const pubRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media_publish`, {
                        method: "POST",
                        body: pubParams,
                      });
                      const pubData = await pubRes.json();
                      if (pubData.id) {
                        socialShares.instagram = { ok: true, id: pubData.id };
                        logger(`[Shopify Autopilot] Instagram post published: ${pubData.id}`);
                      }
                    }
                  }
                } catch (igErr) {
                  logger(`[Shopify Autopilot] Instagram syndication error: ${igErr.message}`);
                }
              }
            }
          }
        } catch (metaErr) {
          logger(`[Shopify Autopilot] Social syndication check note: ${metaErr.message}`);
        }
      }

      // 12. Save Updated Autopilot State & History
      const updatedRecent = [
        {
          id: articleObj.id,
          title: articleObj.title || articleData.title,
          url: finalUrl,
          isDraft: !!config.isDraft,
          publishedAt: new Date().toISOString(),
          socialShares,
        },
        ...(config.recentArticles || []).slice(0, 9),
      ];

      const updatedConfig = {
        ...config,
        topicQueue: config.topicQueue || [],
        lastPublishedAt: new Date().toISOString(),
        lastArticleTitle: articleObj.title || articleData.title,
        lastArticleUrl: finalUrl,
        lastArticleId: articleObj.id,
        recentArticles: updatedRecent,
        totalArticlesGenerated: (config.totalArticlesGenerated || 0) + 1,
        updatedAt: new Date().toISOString(),
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
        articleId: articleObj.id,
        title: articleObj.title,
        articleUrl: finalUrl,
        isDraft: !!config.isDraft,
        socialShares,
      });
    } catch (cycleErr) {
      logger(`[Shopify Autopilot] Error during generation for ${shop}: ${cycleErr.message}`);
      results.push({
        shop,
        email: userEmail,
        status: "failed",
        error: cycleErr.message,
      });
    }
  }

  logger(`[Shopify Autopilot] Cycle completed. Results: ${JSON.stringify(results)}`);
  return results;
}

/**
 * On-demand article generation function (offloads heavy computation from Vercel to Railway).
 */
async function generateShopifyArticleOnDemand({
  topic,
  keywords = "",
  targetLocations = "",
  tone = "engaging, authoritative, and conversion-focused",
  brandName = "Our Store",
  openai,
}) {
  if (!openai) {
    openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
  }
  if (!openai) throw new Error("OpenAI client is required.");

  const blogPrompt = `You are an elite, award-winning eCommerce lifestyle editor and senior SEO copywriter for "${brandName}".
Write an in-depth, authoritative, and deeply engaging 1,600 to 2,000+ word eCommerce blog guide optimized for high Google rankings, reader dwell time, and e-commerce product conversion.

TOPIC: ${topic}
TARGET KEYWORDS: ${keywords || topic}
BRAND NAME: ${brandName}
TONE: ${tone}
${targetLocations ? `
TARGET GEOGRAPHIC MARKET (COUNTRIES & CITIES):
The store targets shoppers in: "${targetLocations}".
- Deeply tailor styling recommendations, lifestyle context, seasonal climate, and cultural nuances specifically to shoppers in ${targetLocations}.
- Naturally weave in city/regional terminology and local context into subheadings, styling scenarios, and FAQ answers.
` : ""}

CRITICAL FORMATTING & STRUCTURE RULES (AVOID DUPLICATE TITLES & ENSURE 1,600+ WORDS):
1. STRICTLY FORBIDDEN: DO NOT INCLUDE AN <h1> TAG ANYWHERE IN bodyHtml!
   Shopify's theme template automatically displays the article's title in an <h1> tag at the top of the page. Repeating an <h1> tag or repeating the title in bodyHtml causes an ugly duplicate title error on the live storefront!
2. Start bodyHtml directly with the captivating opening narrative paragraph, or an engaging introductory <h2> that does NOT repeat the exact title.
3. MINIMUM LENGTH: 1,600 to 2,000+ words. Do NOT write brief summaries. Write comprehensive, descriptive paragraphs across 8 to 10 structured sections:
   - Section 1: Compelling Hook & Introduction (min 180 words, 2-3 paragraphs. Bold the primary keyword in the first 100 words. Start directly with text, NO <h1>).
   - Section 2: Trend Evolution & Styling Heritage in ${targetLocations || "Modern Fashion"} (min 200 words).
   - Section 3: Craftsmanship, Metalwork & Design Artistry (min 220 words, detailing materials, oxidation finish, durability, and skin-friendly design).
   - Section 4: Day-to-Night Styling & Wardrobe Pairing Blueprint (min 250 words, detailing casual, workwear, festive, and evening looks).
   - Section 5: The Ergonomics of Adjustable Sizing & Versatile Styling (min 200 words, addressing size flexibility, thumb/index/midi ring versatility).
   - Section 6: Longevity, Tarnish Prevention & Care Playbook (min 180 words, practical preservation tips).
   - Section 7: Curated Store Highlights & Featured Pieces (min 220 words, organic product recommendations with styling reasons).
   - Section 8: Frequently Asked Questions (min 300 words, at least 4 to 5 comprehensive, schema-ready Q&As with detailed answers).
   - Section 9: The Final Verdict & Styling Inspiration (min 150 words, inspiring concluding thoughts with CTA).
4. Pure semantic HTML formatting: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>.
5. Calibrated SEO Title (50-60 characters) and Meta Description (145-155 characters).

Respond ONLY with a valid JSON object matching this schema:
{
  "title": "Full Article Title",
  "seoTitle": "Calibrated SEO Title under 60 characters",
  "seoDescription": "Compelling Meta Description between 145-155 chars",
  "bodyHtml": "<p>Direct opening paragraph...</p>",
  "tags": ["keyword1", "keyword2", "keyword3"]
}`;

  const textPromise = (async () => {
    const comp = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: blogPrompt }],
      response_format: { type: "json_object" },
      max_tokens: 4096,
      temperature: 0.7,
    });
    return JSON.parse(comp.choices[0]?.message?.content || "{}");
  })();

  const imagePromise = (async () => {
    const imagePrompt = `Ultra-realistic cinematic editorial lifestyle commercial photograph for eCommerce article about "${topic}". High fashion luxury aesthetic, 8k professional studio lighting, depth of field, award-winning shot, clean product styling.`;
    const candidateModels = ["gpt-image-2", "gpt-image-2-2026-04-21", "gpt-image-1.5"];
    for (const modelName of candidateModels) {
      try {
        const imgGen = await openai.images.generate({
          model: modelName,
          prompt: imagePrompt,
          size: "1024x1024",
        });
        if (imgGen.data?.[0]?.b64_json || imgGen.data?.[0]?.url) {
          return {
            imageBase64: imgGen.data?.[0]?.b64_json || null,
            imageUrl: imgGen.data?.[0]?.url || null,
          };
        }
      } catch (imgErr) {
        console.warn(`[Shopify Autopilot] On-demand image gen with ${modelName} failed:`, imgErr.message);
      }
    }
    return { imageBase64: null, imageUrl: null };
  })();

  const [textSettled, imageSettled] = await Promise.allSettled([textPromise, imagePromise]);
  const textResult = textSettled.status === "fulfilled" && textSettled.value ? textSettled.value : null;
  const imgResult = imageSettled.status === "fulfilled" && imageSettled.value ? imageSettled.value : { imageBase64: null, imageUrl: null };

  if (!textResult || !textResult.title) {
    throw new Error("AI failed to generate article content.");
  }

  const sanitizedBodyHtml = sanitizeShopifyBodyHtml(textResult.bodyHtml, textResult.title);

  return {
    ...textResult,
    bodyHtml: sanitizedBodyHtml,
    imageBase64: imgResult.imageBase64,
    imageUrl: imgResult.imageUrl,
  };
}

module.exports = {
  runShopifyAutopilotCycle,
  generateShopifyArticleOnDemand,
  getValidShopifyAccessToken,
};
