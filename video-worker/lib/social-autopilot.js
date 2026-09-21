// video-worker/lib/social-autopilot.js
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
  "cookie",
  "test",
  "discreet",
  "horoscope"
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
  for (const term of BLACKLISTED_TERMS) {
    if (decoded.includes(term)) return false;
  }
  return true;
}

function getCreativeArchetypes(service, industry) {
  const s = service || "Professional Services";
  const ind = industry || "Commercial Solutions";

  return [
    {
      name: "HERO_COMMERCIAL_SHOWCASE",
      description: `
[VISUAL ARCHETYPE: HERO COMMERCIAL SHOWCASE & PEDESTAL]
- Ultra-premium, high-gloss commercial ad poster for "${s}" (${ind}).
- Features a striking, hyper-realistic focal subject representing "${s}" displayed with pride on a sleek modern pedestal or floating center-right with dramatic studio lighting.
- Materials & Atmosphere: Polished obsidian reflections, subtle ambient particle glow, and deep rich contrast.
- Color Palette: Sophisticated luxury palette with vibrant color-matched rim lighting.
- Typography: Ultra-clean, bold modern display typography with high readability: "${s}".
`
    },
    {
      name: "DYNAMIC_MODERN_GRAPHIC",
      description: `
[VISUAL ARCHETYPE: DYNAMIC MODERN 3D COMMERCIAL GRAPHIC]
- Cutting-edge commercial graphic design with dynamic depth and layered 3D accents.
- Features high-impact 3D visual icons, floating contextual dashboards, or stylized physical elements representing "${s}" with realistic materials and glossy finishes.
- Materials & Atmosphere: Sleek glassmorphism panels, energetic directional lighting, and crisp geometric accents.
- Color Palette: Bold high-contrast dark palette with vibrant glowing ambient accents.
- Typography: High-impact powerhouse advertising typography: "${s}".
`
    },
    {
      name: "BRIGHT_MINIMALIST_STUDIO",
      description: `
[VISUAL ARCHETYPE: BRIGHT MINIMALIST & CONTEMPORARY STUDIO]
- Pristine, daylight-filled high-end commercial ad aesthetic with soft architectural shadows.
- Features clean, elegant composition showing modern workspace, key equipment, refined architecture, and presentation elements representing "${s}".
- Materials & Atmosphere: Soft matte textures, bright airy space, smooth light travertine or clean off-white gradient backdrop.
- Color Palette: Crisp high-contrast dark typography and vibrant accent lines.
- Typography: Sophisticated contemporary sans-serif typography: "${s}".
`
    }
  ];
}

function buildGraphicPrompt(businessName, service, industry, hook, topic) {
  const userIndustry = industry || businessName || "Professional Services";
  const archetypes = getCreativeArchetypes(service, userIndustry);
  const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];

  return `You are an award-winning commercial graphic designer creating a finished agency-grade commercial ad poster for social media advertising.

[CLIENT BUSINESS CONTEXT]
- Brand Name: "${businessName}"
- Industry: "${userIndustry}"
- Specific Service: "${service}"
- Core Message / Hook: "${hook}: ${topic}"

[VISUAL DIRECTION]
${archetype.description}

[SUBJECT MATTER RULES - CRITICAL]
- Accurately depict premium, professional visual elements and commercial atmosphere directly relevant to "${service}" and "${userIndustry}".
- NEVER depict random unrelated stock scenes or physical delivery trucks unless specifically requested.
- Sleek studio lighting, 3D geometric accents, high contrast, clean commercial composition, pristine 4K quality.
- Absolutely NO text watermarks or random gibberish letters.`;
}

async function runSocialAutopilotCycle({ supabase, openai, force = false, logger = console.log }) {
  if (!supabase) throw new Error("Supabase client is required.");
  if (!openai) throw new Error("OpenAI client is required for gpt-image-2 visual generation.");

  logger("[Social Autopilot] Starting autonomous scheduled cycle on Railway...");

  const { data: configs, error } = await supabase
    .from("agent_memory")
    .select("email, memory_type, content")
    .like("memory_type", "social_autopilot_%");

  if (error) {
    logger("[Social Autopilot] Failed to fetch social autopilot configs:", error.message);
    throw error;
  }

  const results = [];

  for (const item of configs || []) {
    try {
      const config = JSON.parse(item.content);
      const isEnabled = config.enabled === undefined ? true : config.enabled;
      if (!isEnabled && !force) {
        logger(`[Social Autopilot] Autopilot disabled for ${item.email}. Skipping.`);
        continue;
      }

      const businessName = config.businessName || "GABBARinfo";
      logger(`[Social Autopilot] Processing ${item.email} (${businessName})...`);

      // 1. Check Cadence velocity (default: daily = ~12 hours interval)
      const lastPublished = config.lastPublishedAt ? new Date(config.lastPublishedAt) : null;
      const now = new Date();
      const minIntervalMs = 12 * 60 * 60 * 1000;

      if (lastPublished && (now - lastPublished) < minIntervalMs && !force) {
        logger(`[Social Autopilot] Cadence threshold not reached for ${item.email} (${businessName}). Skipping.`);
        continue;
      }

      // Discover siteUrl if available in config or from connected WordPress
      let siteUrl = (config.siteUrl || config.website || "").replace(/\/$/, "");
      if (!siteUrl) {
        try {
          const { data: wpMemList } = await supabase
            .from("agent_memory")
            .select("content")
            .eq("email", item.email)
            .or("memory_type.like.wp_conn_%,memory_type.like.wp_connection_%");
          for (const m of wpMemList || []) {
            try {
              const parsed = JSON.parse(m.content);
              if (parsed.siteUrl) {
                siteUrl = parsed.siteUrl.replace(/\/$/, "");
                break;
              }
            } catch (_) {}
          }
        } catch (_) {}
      }

      // 2. Discover / Filter legitimate services
      let candidateServices = [];
      if (Array.isArray(config.services)) candidateServices.push(...config.services.map(decodeHtmlEntities));
      if (Array.isArray(config.discoveredServices)) candidateServices.push(...config.discoveredServices.map(decodeHtmlEntities));
      if (Array.isArray(config.queue)) {
        config.queue.forEach(q => {
          if (q?.service) candidateServices.push(decodeHtmlEntities(q.service));
        });
      }
      candidateServices = [...new Set(candidateServices)].filter(isLegitimateService);

      // If not yet discovered, check client onboarding memory for their exact business services
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

      // If still empty, dynamically crawl their actual site's published pages
      if (candidateServices.length === 0 && siteUrl) {
        try {
          const pagesRes = await fetch(`${siteUrl}/wp-json/wp/v2/pages?per_page=20&_fields=title,slug`);
          if (pagesRes.ok) {
            const pages = await pagesRes.json();
            const skipSlugs = /^(home|about|contact|privacy|terms|faq|cart|checkout|my-account|sample-page)$/i;
            for (const p of pages || []) {
              const title = (p?.title?.rendered || p?.slug || "").replace(/<[^>]+>/g, "").trim();
              if (title && title.length > 2 && !skipSlugs.test((p.slug || "").toLowerCase())) {
                candidateServices.push(title);
              }
            }
          }
        } catch (_) {}
      }

      // Dynamic fallback based on the user's specific business name & industry
      if (candidateServices.length === 0) {
        const ind = config.industry || businessName || "Commercial Services";
        candidateServices = [
          `${ind} Core Solutions`,
          `Professional High-Quality ${ind}`,
          `Strategic Client Delivery in ${ind}`,
          `Trusted Industry Standards in ${ind}`
        ];
      }

      // Check if queue has a pending item for today
      let activeService = null;
      let activeQueueItem = null;
      if (Array.isArray(config.queue)) {
        activeQueueItem = config.queue.find(q => q.status === "pending" && isLegitimateService(q.service));
        if (activeQueueItem) {
          activeService = decodeHtmlEntities(activeQueueItem.service);
        }
      }

      // If no pending queue item or no queue, use round-robin rotation
      let nextIndex = (Number(config.lastServiceIndex) || 0) + 1;
      if (nextIndex >= candidateServices.length) nextIndex = 0;
      if (!activeService) {
        activeService = candidateServices[nextIndex] || `${businessName} Core Services`;
      }

      const businessIndustry = config.industry || businessName || "Commercial Services";

      // 3. Generate Caption & Topic Hook via OpenAI / LLM
      const topicHooks = [
        `Are you getting the full commercial return you deserve from your ${activeService}?`,
        `How premier ${businessIndustry} standards unlock greater reliability and growth`,
        `The difference between ordinary providers and industry leaders in ${activeService}`,
        `3 proven principles that elevate ${activeService} to the highest professional standard`,
        `Why excellence and consistency in ${activeService} create lasting customer loyalty`
      ];
      const selectedHook = topicHooks[Math.floor(Math.random() * topicHooks.length)];
      const topicTitle = `${activeService}: Elevating Your Brand with Industry Excellence`;

      logger(`[Social Autopilot] Generating caption for "${activeService}"...`);
      const targetLocations = (config.targetLocations || config.targetMarket || "").trim();
      let captionText = "";
      try {
        const chatRes = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an elite direct-response commercial copywriter representing "${businessName}", an industry leader in ${businessIndustry}. Write compelling, authoritative, high-converting social media copy with clean formatting and strategic hashtags.${targetLocations ? ` You are specifically targeting clients and decision-makers in: ${targetLocations}. Reflect the regional business tone, commercial context, and market speed of these locations.` : ""}`
            },
            {
              role: "user",
              content: `Write an engaging commercial social media post promoting "${activeService}" for "${businessName}".
Industry: "${businessIndustry}"
Hook: "${selectedHook}"
${targetLocations ? `Target Geographic Markets: "${targetLocations}" (Tailor the hook and message to resonate strongly with customers and decision-makers in ${targetLocations})` : ""}
Include 3-4 bullet benefits, a strong call to action, and 6-8 relevant hashtags${targetLocations ? ` (including geo-targeted hashtags for ${targetLocations})` : ""}.`
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
        captionText = `📢 ${selectedHook}\n\nAt ${businessName}, our ${activeService} solutions are built to deliver uncompromised quality, measurable outcomes, and lasting peace of mind.${targetLocations ? ` Proudly serving clients across ${targetLocations}.` : ""}\n\n👉 Send us a message or visit our website to get started!\n\n#${activeService.replace(/[^a-zA-Z0-9]/g, "")} #${businessIndustry.replace(/[^a-zA-Z0-9]/g, "")} #${businessName.replace(/[^a-zA-Z0-9]/g, "")}${geoHashtags}`;
      }

      // 4. Generate Bespoke 3D Poster via gpt-image-2 (ZERO STOCK PHOTOS)
      logger(`[Social Autopilot] Generating commercial ad visual for "${activeService}"...`);
      const graphicPrompt = buildGraphicPrompt(businessName, activeService, businessIndustry, selectedHook, topicTitle);

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

      // 5. Upload image to Supabase storage ('instagram-creatives')
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

      // 6. Fetch User's Live Meta Connection strictly for this specific brand profile
      const rawBizKey = item.memory_type.replace(/^social_autopilot_/, "");
      const cleanBizKey = rawBizKey.replace(new RegExp(`^${item.email.toLowerCase().replace(/[^a-z0-9]/g, "_")}_?`, "i"), "");
      const normalizedBiz = (config.businessName || cleanBizKey || "default")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, "_");

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

      // Match target brand strictly
      let activeMeta = null;
      const matchedBrand = brandProfiles.find((b) => {
        const bKey = String(b.key || "").toLowerCase();
        const bName = String(b.businessName || b.pageName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const targetName = String(config.businessName || cleanBizKey || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const targetKey = String(cleanBizKey || "").toLowerCase();
        const normKey = String(normalizedBiz || "").toLowerCase();
        return (bKey && (bKey === targetKey || bKey === normKey || bKey.includes(targetKey) || targetKey.includes(bKey))) ||
               (bName && targetName && (bName === targetName || bName.includes(targetName) || targetName.includes(bName)));
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

      // Strict Isolation: Fallback to meta_connections ONLY if user has 0 custom brand profiles
      if (!activeMeta && brandProfiles.length === 0) {
        const { data: metaConn, error: metaErr } = await supabase
          .from("meta_connections")
          .select("fb_page_id, fb_page_access_token, fb_user_access_token, ig_business_id, instagram_actor_id")
          .ilike("email", item.email.trim())
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (metaErr) {
          logger(`[Social Autopilot] Error fetching meta_connections for ${item.email}: ${metaErr.message}`);
        }
        activeMeta = metaConn;
      }

      if (!activeMeta) {
        logger(`[Social Autopilot] Social syndication skipped: Brand "${businessName || cleanBizKey}" has no verified paired Meta assets.`);
      }

      const published = {};
      const metaConn = activeMeta;

      if (metaConn) {
        let pageToken = metaConn.fb_page_access_token;
        const userToken = metaConn.fb_user_access_token;
        const pageId = metaConn.fb_page_id ? metaConn.fb_page_id.split(",")[0].trim() : null;
        const igId = metaConn.ig_business_id || metaConn.instagram_actor_id;

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
            const containerParams = new URLSearchParams();
            containerParams.append("image_url", publicImageUrl);
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
