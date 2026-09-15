// video-worker/lib/seo-autopilot.js
const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

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
  "cookie"
];

function isLegitimateService(serviceName) {
  if (!serviceName || typeof serviceName !== "string") return false;
  const s = serviceName.toLowerCase().trim();
  if (s.length < 3) return false;
  for (const term of BLACKLISTED_TERMS) {
    if (s.includes(term)) return false;
  }
  return true;
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

      // 3. Find connected WordPress credentials from agent_memory
      const { data: wpMemList } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", item.email)
        .or("memory_type.like.wp_conn_%,memory_type.like.wp_connection_%");

      let wpConn = null;
      for (const m of wpMemList || []) {
        try {
          const parsed = JSON.parse(m.content);
          if (parsed.siteUrl && (parsed.apiKey || parsed.applicationPassword)) {
            wpConn = parsed;
            break;
          }
        } catch (_) {}
      }

      if (!wpConn) {
        logger(`[SEO Autopilot] No active WordPress connection for ${item.email}. Skipping.`);
        results.push({ email: item.email, status: "skipped", reason: "no_wp_connection" });
        continue;
      }

      const siteUrl = wpConn.siteUrl.replace(/\/$/, "");
      const wpApiKey = wpConn.apiKey;

      // 4. Select Legitimate Service Topic
      let candidateServices = [];
      if (Array.isArray(config.discoveredServices)) candidateServices.push(...config.discoveredServices);
      if (Array.isArray(config.targetKeywords)) candidateServices.push(...config.targetKeywords);
      candidateServices = [...new Set(candidateServices)].filter(isLegitimateService);

      if (candidateServices.length === 0) {
        candidateServices = [
          "Website Design & High-Performance UI",
          "Search Engine Optimization (SEO) & Ranking",
          "Meta Ads & Instagram Performance Campaigns",
          "Google Ads Management & Search ROI",
          "Google Business Profile & Local Map Pack Dominance",
          "Full-Funnel Digital Marketing Strategy"
        ];
      }

      let nextIndex = (Number(config.lastServiceIndex) || 0) + 1;
      if (nextIndex >= candidateServices.length) nextIndex = 0;
      const activeService = candidateServices[nextIndex] || "Website Design & High-Performance UI";

      // 5. Generate Full SEO Article (1,500+ words) via OpenAI
      logger(`[SEO Autopilot] Generating 1,500+ word SEO blog for "${activeService}"...`);
      const articleCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an elite SEO strategist and tech journalist writing for ${businessName}.
Generate a comprehensive, actionable 1500+ word deep-dive SEO article about ${activeService}.
Format the output as a valid JSON object matching this schema:
{
  "title": "Clear High-CTR Title with Focus Keyword",
  "meta_title": "SEO Title (under 60 chars)",
  "meta_description": "Compelling meta description with call to action (under 160 chars)",
  "focus_keyword": "Primary keyword",
  "slug": "url-friendly-slug",
  "tags": ["Tag1", "Tag2", "Tag3"],
  "content_html": "Full 1500+ word article formatted in semantic HTML with <h2>, <h3>, <p>, <ul>, <li>, and <strong> elements."
}`
          },
          {
            role: "user",
            content: `Write the complete SEO article focused on "${activeService}" tailored to business owners and enterprise clients in 2026.`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const parsedArticle = JSON.parse(articleCompletion.choices[0]?.message?.content || "{}");
      if (!parsedArticle.title || !parsedArticle.content_html) {
        throw new Error("Failed to generate complete SEO article content.");
      }

      // 6. Generate Bespoke Featured Image via gpt-image-2 (ZERO STOCK PHOTOS)
      logger(`[SEO Autopilot] Generating featured blog image via gpt-image-2 for "${parsedArticle.title}"...`);
      let featuredImageUrl = null;
      try {
        const imgPrompt = `Award-winning commercial editorial hero illustration for blog article. Title: "${parsedArticle.title}". Subject: "${activeService}". Sleek modern studio lighting, 3D holographic digital accents, dark luxury slate aesthetics, high contrast, clean agency composition, pristine 4K quality, no text watermark.`;
        const imgRes = await openai.images.generate({
          model: "gpt-image-2",
          prompt: imgPrompt,
          size: "1024x1024",
        });

        let imgBuffer = null;
        if (imgRes.data?.[0]?.b64_json) {
          imgBuffer = Buffer.from(imgRes.data[0].b64_json, "base64");
        } else if (imgRes.data?.[0]?.url) {
          const fetchRes = await fetch(imgRes.data[0].url);
          imgBuffer = Buffer.from(await fetchRes.arrayBuffer());
        }

        if (imgBuffer) {
          const fileName = `wp_feat_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("instagram-creatives")
            .upload(fileName, imgBuffer, { contentType: "image/png", upsert: true });

          if (!uploadErr && uploadData) {
            const { data: pubUrlData } = supabase.storage.from("instagram-creatives").getPublicUrl(fileName);
            featuredImageUrl = pubUrlData.publicUrl;
            logger(`[SEO Autopilot] Featured image hosted: ${featuredImageUrl}`);
          }
        }
      } catch (imgErr) {
        logger("[SEO Autopilot] Featured image generation notice:", imgErr.message);
      }

      // 7. Publish Post to WordPress via Official Plugin Endpoint
      logger(`[SEO Autopilot] Publishing live post to ${siteUrl}/wp-json/gabbarinfo/v1/create-post...`);
      const wpPayload = {
        title: parsedArticle.title,
        content: parsedArticle.content_html,
        slug: parsedArticle.slug,
        status: "publish",
        post_type: "post",
        featured_image_url: featuredImageUrl,
        featured_image_alt: parsedArticle.title,
        meta_title: parsedArticle.meta_title,
        meta_description: parsedArticle.meta_description,
        focus_keyword: parsedArticle.focus_keyword,
        tags: parsedArticle.tags || ["SEO Optimization", "Digital Marketing", "Business Growth"],
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

      // 8. In-Process Social Media Syndication (Obeys user preferences)
      const socialShares = {};
      const { data: metaConn } = await supabase
        .from("meta_connections")
        .select("fb_page_id, fb_page_access_token, fb_user_access_token, ig_business_id, instagram_id")
        .ilike("email", item.email.trim())
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (metaConn) {
        let pageToken = metaConn.fb_page_access_token;
        const userToken = metaConn.fb_user_access_token;
        const pageId = metaConn.fb_page_id ? metaConn.fb_page_id.split(",")[0].trim() : null;
        const igId = metaConn.ig_business_id || metaConn.instagram_id;

        if (!pageToken && userToken && pageId) {
          try {
            const tokenResp = await fetch(`https://graph.facebook.com/v21.0/${pageId}?fields=access_token&access_token=${encodeURIComponent(userToken)}`);
            const tokenJson = await tokenResp.json();
            if (tokenJson?.access_token) pageToken = tokenJson.access_token;
          } catch (_) {}
        }
        const effectiveToken = pageToken || userToken;

        // FACEBOOK: Interactive Clickable Link Card (takes reader to blog page when clicked)
        const shouldShareFacebook = config.autoShareFacebook !== false && pageId && effectiveToken;
        if (shouldShareFacebook) {
          try {
            logger(`[SEO Autopilot] Syndicating Clickable Link Card to Facebook Page (${pageId})...`);
            const feedParams = new URLSearchParams();
            feedParams.append("link", publishedPostUrl);
            feedParams.append("message", `📢 ${parsedArticle.title}\n\n${parsedArticle.meta_description || ""}\n\nRead full article here 👇\n${publishedPostUrl}`);
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
              if (featuredImageUrl) {
                const photoParams = new URLSearchParams();
                photoParams.append("url", featuredImageUrl);
                photoParams.append("caption", `📢 ${parsedArticle.title}\n\n${parsedArticle.meta_description || ""}\n\nRead full article here 👇\n${publishedPostUrl}`);
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
              parsedArticle.meta_description || "",
              "",
              `🔗 Full article: ${publishedPostUrl}`,
              "",
              `#${activeService.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()} #SEO #ContentMarketing #BusinessGrowth #DigitalStrategy`
            ].join("\n");

            const containerParams = new URLSearchParams();
            containerParams.append("image_url", featuredImageUrl);
            containerParams.append("caption", igCaption);
            containerParams.append("access_token", effectiveToken);

            const igContainerRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media`, { method: "POST", body: containerParams });
            const containerData = await igContainerRes.json();

            if (containerData.id) {
              await new Promise((resolve) => setTimeout(resolve, 5000));
              const pubParams = new URLSearchParams();
              pubParams.append("creation_id", containerData.id);
              pubParams.append("access_token", effectiveToken);

              const igPubRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media_publish`, { method: "POST", body: pubParams });
              const pubData = await igPubRes.json();
              socialShares.instagram = { ok: !!pubData.id, id: pubData.id || null };
              logger(`[SEO Autopilot] Instagram post published: ${pubData.id}`);
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
