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
  const s = service || "Professional Digital Services";
  const ind = industry || "Digital Marketing";

  return [
    {
      name: "HERO_COMMERCIAL_SHOWCASE",
      description: `
[VISUAL ARCHETYPE: HERO COMMERCIAL SHOWCASE & PEDESTAL]
- Ultra-premium, high-gloss commercial ad poster for "${s}".
- Features a striking, hyper-realistic focal subject representing "${s}" displayed with pride on a sleek modern pedestal or floating center-right with dramatic studio lighting.
- Materials & Atmosphere: Polished obsidian reflections, subtle ambient gold/cyan particle glow, and deep rich contrast.
- Color Palette: Sophisticated dark luxury palette (obsidian slate, deep charcoal) with vibrant color-matched rim lighting.
- Typography: Ultra-clean, bold modern display typography with high readability: "${s}".
`
    },
    {
      name: "DYNAMIC_MODERN_GRAPHIC",
      description: `
[VISUAL ARCHETYPE: DYNAMIC MODERN 3D AGENCY GRAPHIC]
- Cutting-edge agency commercial graphic design with dynamic depth and layered 3D accents.
- Features high-impact 3D visual icons, floating holographic dashboards, or stylized physical elements representing "${s}" with realistic materials and glossy finishes.
- Materials & Atmosphere: Sleek glassmorphism panels, energetic directional lighting, and crisp geometric accents.
- Color Palette: Bold high-contrast dark palette with vibrant glowing neon cyan and amber accents.
- Typography: High-impact powerhouse advertising typography: "${s}".
`
    },
    {
      name: "BRIGHT_MINIMALIST_STUDIO",
      description: `
[VISUAL ARCHETYPE: BRIGHT MINIMALIST & CONTEMPORARY STUDIO]
- Pristine, daylight-filled high-end commercial ad aesthetic with soft architectural shadows.
- Features clean, elegant composition showing modern workstation, analytics charts, and digital architecture representing "${s}".
- Materials & Atmosphere: Soft matte textures, bright airy space, smooth light travertine or clean off-white gradient backdrop.
- Color Palette: Crisp high-contrast dark typography and vibrant accent lines.
- Typography: Sophisticated contemporary sans-serif typography: "${s}".
`
    }
  ];
}

function buildGraphicPrompt(businessName, service, industry, hook, topic) {
  const archetypes = getCreativeArchetypes(service, industry);
  const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];

  return `You are an award-winning commercial graphic designer creating a finished agency-grade commercial ad poster for social media advertising.

[CLIENT BUSINESS CONTEXT]
- Brand Name: "${businessName}"
- Industry: "${industry || 'Digital Marketing & Growth'}"
- Specific Service: "${service}"
- Core Message / Hook: "${hook}: ${topic}"

[VISUAL DIRECTION]
${archetype.description}

[SUBJECT MATTER RULES - CRITICAL]
- Accurately depict high-tech digital marketing, website design, performance growth, and modern business tools.
- NEVER depict physical delivery trucks, unrelated street photos, or random stock scenes.
- Sleek studio lighting, 3D geometric accents, high contrast, clean agency composition, pristine 4K quality.
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

      if (candidateServices.length === 0) {
        candidateServices = [
          "Website Design & High-Performance UI",
          "Search Engine Optimization (SEO)",
          "Meta Social Media Ads",
          "Google Ads & PPC Campaigns",
          "Local Maps & Google Business Optimization",
          "Brand Strategy & Digital Growth"
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
        activeService = candidateServices[nextIndex] || "Website Design & High-Performance UI";
      }

      // 3. Generate Caption & Topic Hook via OpenAI / LLM
      const topicHooks = [
        "Is your website silently losing high-ticket clients?",
        "How to turn digital traffic into predictable paying customers",
        "Stop burning your ad budget without clear measurable ROI",
        "The modern growth framework every brand needs to dominate online",
        "Why standard templates fail and custom digital experiences win"
      ];
      const selectedHook = topicHooks[Math.floor(Math.random() * topicHooks.length)];
      const topicTitle = `${activeService}: Scaling Your Brand with High-Impact Results`;

      logger(`[Social Autopilot] Generating caption for "${activeService}"...`);
      let captionText = "";
      try {
        const chatRes = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are an elite direct-response social media copywriter for a high-end digital agency. Write compelling, concise, high-converting social media copy with clean formatting and strategic hashtags."
            },
            {
              role: "user",
              content: `Write an engaging commercial social media post promoting "${activeService}" for "${businessName}".\nHook: "${selectedHook}"\nInclude 3-4 bullet benefits, a strong call to action, and 5-6 relevant hashtags.`
            }
          ],
          temperature: 0.7,
        });
        captionText = chatRes.choices[0]?.message?.content?.trim();
      } catch (chatErr) {
        logger("[Social Autopilot] Caption generation fallback:", chatErr.message);
        captionText = `📢 ${selectedHook}\n\nRunning a business means staying ahead of the curve. At ${businessName}, our ${activeService} solutions turn complex digital challenges into predictable revenue.\n\n👉 Send us a DM or visit our website to learn more!\n\n#${activeService.replace(/[^a-zA-Z0-9]/g, "")} #BusinessGrowth #DigitalMarketing #${businessName.replace(/[^a-zA-Z0-9]/g, "")}`;
      }

      // 4. Generate Bespoke 3D Poster via gpt-image-2 (ZERO STOCK PHOTOS)
      logger(`[Social Autopilot] Invoking gpt-image-2 for "${activeService}"...`);
      const graphicPrompt = buildGraphicPrompt(businessName, activeService, "Digital Marketing", selectedHook, topicTitle);

      let imageBuffer = null;
      try {
        const imgRes = await openai.images.generate({
          model: "gpt-image-2",
          prompt: graphicPrompt,
          size: "1024x1024",
        });

        if (imgRes.data?.[0]?.b64_json) {
          imageBuffer = Buffer.from(imgRes.data[0].b64_json, "base64");
        } else if (imgRes.data?.[0]?.url) {
          const fetchRes = await fetch(imgRes.data[0].url);
          imageBuffer = Buffer.from(await fetchRes.arrayBuffer());
        }
        logger(`[Social Autopilot] Successfully generated image with gpt-image-2 (Buffer size: ${imageBuffer?.length} bytes)`);
      } catch (imgErr) {
        logger("[Social Autopilot] Primary gpt-image-2 image generation error:", imgErr.message);
      }

      if (!imageBuffer) {
        logger(`[Social Autopilot] CRITICAL: No image could be generated. Skipping post for ${item.email} to prevent low-quality fallback.`);
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

      // 6. Fetch User's Live Meta Connection
      const { data: metaConn } = await supabase
        .from("meta_connections")
        .select("fb_page_id, fb_page_access_token, fb_user_access_token, ig_business_id, instagram_id")
        .ilike("email", item.email.trim())
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const published = {};

      if (metaConn) {
        let pageToken = metaConn.fb_page_access_token;
        const userToken = metaConn.fb_user_access_token;
        const pageId = metaConn.fb_page_id ? metaConn.fb_page_id.split(",")[0].trim() : null;
        const igId = metaConn.ig_business_id || metaConn.instagram_id;

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
              // Wait 5 seconds for Instagram CDN processing
              await new Promise((resolve) => setTimeout(resolve, 5000));

              const pubParams = new URLSearchParams();
              pubParams.append("creation_id", containerData.id);
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
