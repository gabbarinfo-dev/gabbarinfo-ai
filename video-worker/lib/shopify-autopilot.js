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

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return connection.access_token;
  }

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
      // 5. Fetch Store Products for Dynamic Catalog Intelligence
      logger(`[Shopify Autopilot] Fetching catalog products for ${shop}...`);
      let products = [];
      try {
        const prodRes = await fetch(`https://${shop}/admin/api/2024-01/products.json?limit=50`, {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        });
        if (prodRes.ok) {
          const pData = await prodRes.json();
          products = pData.products || [];
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

      // 8. Generate High-Converting Topic & SEO Strategy
      const sampleProducts = products.slice(0, 10).map((p) => ({
        title: p.title,
        tags: p.tags,
        product_type: p.product_type,
        handle: p.handle,
      }));

      const targetLocations = (config.targetLocations || config.targetMarket || conn.country || "").trim();

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

      let strategicTopic = {
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

      // 9. Generate Full 1,500+ Word Authoritative Article Body
      logger(`[Shopify Autopilot] Generating 1,500+ word article: "${strategicTopic.topic}"...`);
      const fullArticlePrompt = `You are a world-class eCommerce SEO copywriter and lifestyle content strategist for "${brandName}".
Write an in-depth, authoritative, and engaging 1,500+ word eCommerce blog article optimized for Google rank and product conversion.

TOPIC: ${strategicTopic.topic}
PRIMARY KEYWORD: ${strategicTopic.primaryKeyword}
SECONDARY KEYWORDS: ${(strategicTopic.secondaryKeywords || []).join(", ")}
BRAND NAME: ${brandName}
STORE DOMAIN: ${conn.domain || shop}
${targetLocations ? `
TARGET GEOGRAPHIC MARKET MANDATE (COUNTRIES & CITIES):
The store is actively targeting shoppers and clients in: "${targetLocations}".
- Deeply tailor the styling guides, climate/seasonal factors, consumer preferences, lifestyle references, and local context specifically for shoppers in (${targetLocations}).
- Naturally incorporate localized references, regional terminology, and city or country mentions of ${targetLocations} within subheadings, styling tips, case scenarios, and FAQ sections.
` : ""}

ARTICLE REQUIREMENTS:
1. Compelling H1 Title incorporating primary keywords.
2. Hook paragraph capturing attention and addressing shopper desires or problems.
3. 5-6 detailed sections with clear <h2> and <h3> subheadings providing practical guides, styling advice, or solutions.
4. Curated shopping tips and recommendations linking value directly back to the store's catalog.
5. <h3>Frequently Asked Questions</h3> with 3 clear, schema-ready Q&As.
6. Engaging conclusion with a strong Call to Action (CTA).
7. Pure semantic HTML formatting (<h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>).
8. Provide calibrated SEO Meta Title (50-60 characters) and Meta Description (145-155 characters).

Respond ONLY with a valid JSON object matching this schema:
{
  "title": "Full Article Title",
  "seoTitle": "Calibrated SEO Title under 60 characters",
  "seoDescription": "Compelling Meta Description between 145-155 chars",
  "bodyHtml": "<p>Article HTML content...</p>",
  "tags": ["tag1", "tag2", "tag3"]
}`;

      // 10. Run Text Generation and Image Generation Concurrently
      const articlePromise = (async () => {
        const comp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: fullArticlePrompt }],
          response_format: { type: "json_object" },
          temperature: 0.7,
        });
        return JSON.parse(comp.choices[0]?.message?.content || "{}");
      })();

      const imagePromise = (async () => {
        try {
          const imagePrompt = `Ultra-realistic cinematic editorial lifestyle commercial photograph for eCommerce article titled "${strategicTopic.topic}". High fashion luxury aesthetic, 8k professional studio lighting, depth of field, award-winning commercial shot, clean product styling.`;
          logger(`[Shopify Autopilot] Generating ultra-HD hero image via gpt-image-2 for ${shop}...`);
          const imgGen = await openai.images.generate({
            model: "gpt-image-2",
            prompt: imagePrompt,
            size: "1024x1024",
          });
          return {
            imageBase64: imgGen.data?.[0]?.b64_json || null,
            imageUrl: imgGen.data?.[0]?.url || null,
          };
        } catch (imgErr) {
          logger(`[Shopify Autopilot] Image generation note: ${imgErr.message}`);
          return { imageBase64: null, imageUrl: null };
        }
      })();

      const [articleSettled, imageSettled] = await Promise.allSettled([articlePromise, imagePromise]);
      const articleData = articleSettled.status === "fulfilled" && articleSettled.value ? articleSettled.value : null;
      const imageData = imageSettled.status === "fulfilled" && imageSettled.value ? imageSettled.value : { imageBase64: null, imageUrl: null };

      if (!articleData || !articleData.title || !articleData.bodyHtml) {
        throw new Error("AI failed to generate valid article HTML content.");
      }

      // 11. Post Article with Featured Image Directly to Shopify
      logger(`[Shopify Autopilot] Publishing article to Shopify Blog (${blogHandle})...`);
      const articlePayload = {
        title: articleData.title,
        body_html: articleData.bodyHtml,
        author: "GabbarInfo AI",
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

      // 12. Save Updated Autopilot State & History
      const updatedRecent = [
        {
          id: articleObj.id,
          title: articleObj.title || articleData.title,
          url: finalUrl,
          isDraft: !!config.isDraft,
          publishedAt: new Date().toISOString(),
        },
        ...(config.recentArticles || []).slice(0, 9),
      ];

      const updatedConfig = {
        ...config,
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

  const blogPrompt = `You are a world-class eCommerce SEO copywriter and lifestyle content strategist for "${brandName}".
Write an in-depth, authoritative, and engaging 1,500+ word eCommerce blog article optimized for Google rank and product conversion.

TOPIC: ${topic}
TARGET KEYWORDS: ${keywords || topic}
BRAND NAME: ${brandName}
TONE: ${tone}
${targetLocations ? `
TARGET GEOGRAPHIC MARKET MANDATE (COUNTRIES & CITIES):
The store is actively targeting shoppers and clients in: "${targetLocations}".
- Deeply tailor recommendations, regional climate and styling factors, seasonal context, and shopping habits specifically to audiences in (${targetLocations}).
- Naturally incorporate localized references, regional terminology, and city or country mentions of ${targetLocations} within styling tips, subheadings, and FAQ sections.
` : ""}

ARTICLE REQUIREMENTS:
1. Compelling H1 Title incorporating primary keywords.
2. Hook paragraph capturing attention and addressing shopper desires or problems.
3. 5-6 detailed sections with clear <h2> and <h3> subheadings providing practical guides, styling advice, or solutions.
4. Curated shopping tips and recommendations linking value directly back to the store's catalog.
5. <h3>Frequently Asked Questions</h3> with 3 clear, schema-ready Q&As.
6. Engaging conclusion with a strong Call to Action (CTA).
7. Pure semantic HTML formatting (<h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>).
8. Provide calibrated SEO Meta Title (50-60 characters) and Meta Description (145-155 characters).

Respond ONLY with a valid JSON object matching this schema:
{
  "title": "Full Article Title",
  "seoTitle": "Calibrated SEO Title under 60 characters",
  "seoDescription": "Compelling Meta Description between 145-155 chars",
  "bodyHtml": "<p>Article HTML content...</p>",
  "tags": ["keyword1", "keyword2", "keyword3"]
}`;

  const textPromise = (async () => {
    const comp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: blogPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });
    return JSON.parse(comp.choices[0]?.message?.content || "{}");
  })();

  const imagePromise = (async () => {
    try {
      const imagePrompt = `Ultra-realistic cinematic editorial lifestyle commercial photograph for eCommerce article about "${topic}". High fashion luxury aesthetic, 8k professional studio lighting, depth of field, award-winning shot, clean product styling.`;
      const imgGen = await openai.images.generate({
        model: "gpt-image-2",
        prompt: imagePrompt,
        size: "1024x1024",
      });
      return {
        imageBase64: imgGen.data?.[0]?.b64_json || null,
        imageUrl: imgGen.data?.[0]?.url || null,
      };
    } catch (imgErr) {
      console.warn("[Shopify Autopilot] On-demand image gen failed:", imgErr.message);
      return { imageBase64: null, imageUrl: null };
    }
  })();

  const [textSettled, imageSettled] = await Promise.allSettled([textPromise, imagePromise]);
  const textResult = textSettled.status === "fulfilled" && textSettled.value ? textSettled.value : null;
  const imgResult = imageSettled.status === "fulfilled" && imageSettled.value ? imageSettled.value : { imageBase64: null, imageUrl: null };

  if (!textResult || !textResult.title) {
    throw new Error("AI failed to generate article content.");
  }

  return {
    ...textResult,
    imageBase64: imgResult.imageBase64,
    imageUrl: imgResult.imageUrl,
  };
}

module.exports = {
  runShopifyAutopilotCycle,
  generateShopifyArticleOnDemand,
  getValidShopifyAccessToken,
};
