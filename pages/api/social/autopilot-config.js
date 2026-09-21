// pages/api/social/autopilot-config.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer.js";
import { executeFacebookPost } from "../../../lib/execute-facebook-post.js";
import { executeInstagramPost } from "../../../lib/execute-instagram-post.js";
import { generateImage } from "../../../lib/instagram/generate-image.js";
import { generateCaption } from "../../../lib/instagram/generate-caption.js";
import { verifyEntitlement, FEATURES } from "../../../lib/auth/entitlements.js";
import { reserveCredits, releaseCredits } from "../../../lib/billing/credit-meter.js";
import { reserveQuota, commitQuota, releaseQuota, checkActionEntitlement, getBusinessSubscriptionState } from "../../../lib/billing/quota-service.js";
import { getPlanConfig } from "../../../lib/billing/plans.js";
import OpenAI from "openai";
import { uploadToMediaBridge, purgeFromMediaBridge } from "../../../lib/wordpress/media-bridge.js";

const supabase = supabaseServer;

async function generateSocialVisual(prompt, label = "social") {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const openai = new OpenAI({ apiKey });
      const candidateModels = ["gpt-image-2", "gpt-image-2-2026-04-21", "gpt-image-1.5"];
      let imgBuffer = null;
      let modelUsed = null;

      for (const modelName of candidateModels) {
        try {
          console.log(`[Social Autopilot] Generating visual with approved model ${modelName}...`);
          const response = await openai.images.generate({
            model: modelName,
            prompt,
            size: "1024x1024",
          });

          if (response.data?.[0]?.b64_json) {
            imgBuffer = Buffer.from(response.data[0].b64_json, "base64");
          } else if (response.data?.[0]?.url) {
            const fetchRes = await fetch(response.data[0].url);
            imgBuffer = Buffer.from(await fetchRes.arrayBuffer());
          }

          if (imgBuffer && imgBuffer.length > 0) {
            modelUsed = modelName;
            console.log(`[Social Autopilot] Successfully generated visual using ${modelName}`);
            break;
          }
        } catch (err) {
          console.warn(`[Social Autopilot] Model ${modelName} failed (${err.message}), trying next approved model...`);
        }
      }

      if (imgBuffer) {
        try {
          const mb = await uploadToMediaBridge({
            filename: `social_ai_${Date.now()}.png`,
            buffer: imgBuffer,
          });
          return mb.url;
        } catch (mbErr) {
          console.warn("[Social Autopilot] Media bridge upload fallback:", mbErr.message);
          const fileName = `social_ai_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("instagram-creatives")
            .upload(fileName, imgBuffer, { contentType: "image/png", upsert: true });

          if (!uploadErr && uploadData) {
            const { data: pubUrl } = supabase.storage.from("instagram-creatives").getPublicUrl(fileName);
            return pubUrl.publicUrl;
          }
        }
      }
    } catch (e) {
      console.warn("[Social Autopilot] OpenAI visual generation error:", e.message);
    }
  }

  console.warn("[Social Autopilot] All approved image models failed. Aborting image generation rather than using degraded visuals.");
  return null;
}

// 5 Core Marketing Pillars for high engagement & conversion
const CONTENT_PILLARS = [
  { id: "educational_tips", name: "Actionable Tips & How-To", badge: "💡 Expert Tip" },
  { id: "service_spotlight", name: "Service Spotlight & Direct Offer", badge: "🎯 Special Offer" },
  { id: "myth_busting", name: "Myth-Busting & Authority Secrets", badge: "🔍 Myth vs Fact" },
  { id: "problem_solution", name: "Problem-Solution & Quick Case Story", badge: "📈 Growth Win" },
  { id: "interactive_poll", name: "Interactive & Engagement Hook", badge: "💬 Community Question" }
];

function buildFallbackQueue(services = [], businessName = "Our Business", count = 30, suggestedTopics = []) {
  const cleanServices = services.length > 0 ? services : ["Featured Offerings", "Customer Favorites", "New Highlights", "Community Support"];
  const queue = [];
  const now = new Date();

  // If real domain topics are available (from crawled Shopify products or WordPress intel), prioritize them
  if (Array.isArray(suggestedTopics) && suggestedTopics.length > 0) {
    const pillars = [
      { pillar: "educational_tips", hook: "Essential Guide & Insider Tips" },
      { pillar: "service_spotlight", hook: "Spotlight On Quality" },
      { pillar: "myth_busting", hook: "Common Misconceptions Debunked" },
      { pillar: "problem_solution", hook: "Style, Care & Best Practices" },
      { pillar: "interactive_poll", hook: "We'd Love Your Opinion" }
    ];

    for (let i = 0; i < count; i++) {
      const topicText = suggestedTopics[i % suggestedTopics.length];
      const p = pillars[i % pillars.length];
      const s = cleanServices[i % cleanServices.length];
      const scheduled = new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000);

      queue.push({
        day: i + 1,
        pillar: p.pillar,
        service: s,
        hook: p.hook,
        topic: topicText,
        status: "pending",
        scheduledDate: scheduled.toISOString()
      });
    }
    return queue;
  }

  // Universal domain-adaptive templates (suits retail, ecommerce, fashion, local businesses, services)
  const baseTemplates = [
    { pillar: "educational_tips", hook: "Essential Guide & Insider Tips", template: "5 Key Things You Need to Know About {service}" },
    { pillar: "service_spotlight", hook: "Spotlight On Quality", template: "Discover What Makes Our {service} Exceptional" },
    { pillar: "myth_busting", hook: "Debunking Common Misconceptions", template: "Myth vs Reality: Finding the Best Approach to {service}" },
    { pillar: "problem_solution", hook: "Style, Care & Best Practices", template: "How to Get the Absolute Best Value & Longevity From Your {service}" },
    { pillar: "interactive_poll", hook: "We'd Love Your Opinion", template: "What Matters Most to You When Choosing {service}?" }
  ];

  for (let i = 0; i < count; i++) {
    const s = cleanServices[i % cleanServices.length];
    const t = baseTemplates[i % baseTemplates.length];
    const scheduled = new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000);

    queue.push({
      day: i + 1,
      pillar: t.pillar,
      service: s,
      hook: t.hook,
      topic: t.template.replace("{service}", s),
      status: "pending",
      scheduledDate: scheduled.toISOString()
    });
  }

  return queue;
}

export async function resolveBrandIntelligence({ email, normBusiness, matchedBrand, supabase }) {
  const isAgencyRoot = normBusiness === "gabbarinfo" || normBusiness === "gabbarinfo_digital_solutions";

  // 1. Check if linked to Shopify store
  try {
    const { data: shopConns } = await supabase
      .from("agent_memory")
      .select("memory_type, content")
      .eq("email", email)
      .eq("memory_type", "shopify_connection");

    let matchedShop = null;
    for (const sc of shopConns || []) {
      try {
        const parsed = JSON.parse(sc.content);
        const siteUrl = (matchedBrand?.websiteUrl || "").toLowerCase();
        const brandName = (matchedBrand?.businessName || "").toLowerCase();
        if (
          matchedBrand?.websiteType === "shopify" ||
          (parsed.domain && siteUrl.includes(parsed.domain.toLowerCase())) ||
          (parsed.shop && siteUrl.includes(parsed.shop.toLowerCase())) ||
          (brandName && parsed.shopName && (brandName.includes(parsed.shopName.toLowerCase()) || parsed.shopName.toLowerCase().includes(brandName))) ||
          (normBusiness && normBusiness.includes("bella")) ||
          (normBusiness && normBusiness.includes("shopify"))
        ) {
          matchedShop = parsed;
          break;
        }
      } catch (_) {}
    }

    if (matchedShop) {
      const { data: shopAuto } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", email)
        .eq("memory_type", `shopify_autopilot_${matchedShop.shop}`)
        .maybeSingle();

      let autoContent = null;
      if (shopAuto?.content) {
        try {
          autoContent = JSON.parse(shopAuto.content);
        } catch (_) {}
      }

      const shopTopics = autoContent?.suggestedTopics || autoContent?.topicQueue || [];
      const isJewellery = (matchedShop.shopName || matchedBrand?.businessName || "").toLowerCase().includes("bella") ||
        (matchedShop.domain || "").toLowerCase().includes("bella");
      const services = isJewellery
        ? ["Designer Jewellery", "Bridal Accessories", "Earrings & Rings", "Anti-Tarnish Jewellery", "Statement Necklaces"]
        : ["Featured Products", "Best Sellers", "Seasonal Collection", "Customer Favorites", "Special Offers"];

      return {
        type: "shopify",
        businessName: matchedBrand?.businessName || matchedShop.shopName || "Shopify Store",
        industry: isJewellery ? "Designer Jewellery & Fashion Accessories" : "E-Commerce & Retail Products",
        services,
        suggestedTopics: shopTopics,
        brandVoice: "Chic, premium, inspiring, and customer-centric",
        targetAudience: autoContent?.targetMarket || "Shoppers and fashion enthusiasts",
        targetLocations: autoContent?.targetLocations || autoContent?.targetMarket || "United Kingdom"
      };
    }
  } catch (err) {
    console.warn("[Social Autopilot] Error resolving Shopify intel:", err.message);
  }

  // 2. Check if linked to WordPress site intelligence
  try {
    const { data: wpIntels } = await supabase
      .from("agent_memory")
      .select("memory_type, content")
      .eq("email", email)
      .like("memory_type", "wp_intel_%");

    for (const row of wpIntels || []) {
      try {
        const parsed = JSON.parse(row.content);
        const intelKey = row.memory_type.replace("wp_intel_", "");
        const siteUrl = (matchedBrand?.websiteUrl || "").toLowerCase();
        if (
          (normBusiness && (intelKey.includes(normBusiness) || normBusiness.includes(intelKey))) ||
          (siteUrl && parsed.siteUrl && siteUrl.includes(parsed.siteUrl.toLowerCase().replace(/https?:\/\//, "")))
        ) {
          const coreServices = (parsed.coreOfferings && parsed.coreOfferings.length > 0)
            ? parsed.coreOfferings.slice(0, 5)
            : (parsed.targetKeywords && parsed.targetKeywords.length > 0)
            ? parsed.targetKeywords.slice(0, 5)
            : ["Core Offerings", "Consultation", "Solutions"];

          return {
            type: "wordpress",
            businessName: parsed.brandName || matchedBrand?.businessName || "WordPress Site",
            industry: parsed.industry || "Professional Services",
            services: coreServices,
            suggestedTopics: parsed.suggestedTopics || [],
            brandVoice: "Authoritative, insightful, and customer-centric",
            targetAudience: "Customers and community",
            targetLocations: "Global"
          };
        }
      } catch (_) {}
    }
  } catch (err) {
    console.warn("[Social Autopilot] Error resolving WordPress intel:", err.message);
  }

  // 3. Gabbarinfo agency
  if (isAgencyRoot) {
    return {
      type: "agency",
      businessName: "GABBARinfo",
      industry: "Digital Marketing & Growth",
      services: ["SEO Optimization", "Google Ads Management", "Meta Social Ads", "Website Design"],
      suggestedTopics: [],
      brandVoice: "Bold, authoritative, and consultative",
      targetAudience: "Business owners and founders",
      targetLocations: "Global"
    };
  }

  // 4. Standalone generic / Meta page fallback
  return {
    type: "generic",
    businessName: matchedBrand?.businessName || "My Business",
    industry: matchedBrand?.businessCategory || "Retail & Consumer Brand",
    services: ["Featured Products", "Customer Favorites", "New Arrivals", "Special Offers"],
    suggestedTopics: [],
    brandVoice: "Engaging, friendly, and authentic",
    targetAudience: "Valued customers and community",
    targetLocations: "Global"
  };
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.body?.userEmail || req.query?.userEmail;

  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const normalizedEmail = userEmail.toLowerCase().trim();
  const rawBusiness = req.query?.businessName || req.body?.businessName || req.body?.config?.businessName || "";
  const normBusiness = rawBusiness ? rawBusiness.toLowerCase().trim().replace(/[^a-z0-9]/g, "_") : null;
  const isOwner = normalizedEmail === "ndantare@gmail.com" || session?.user?.role === "owner" || session?.user?.role === "admin";

  // ================================================================
  // GET: Fetch Autopilot Config, Queue, and Meta Connection Info
  // ================================================================
  if (req.method === "GET") {
    try {
      // 1. Fetch all connected brand profiles from agent_memory
      const [{ data: meta }, { data: brandMems }] = await Promise.all([
        supabase
          .from("meta_connections")
          .select("*")
          .ilike("email", normalizedEmail)
          .maybeSingle(),
        supabase
          .from("agent_memory")
          .select("memory_type, content")
          .eq("email", normalizedEmail)
          .like("memory_type", "meta_conn_%"),
      ]);

      const availableBrands = (brandMems || []).map((m) => {
        try {
          const parsed = JSON.parse(m.content);
          const key = m.memory_type.replace("meta_conn_", "");
          return { key, ...parsed };
        } catch (_) {
          return null;
        }
      }).filter(Boolean);

      // Match target brand or default to first
      const matchedBrand = normBusiness
        ? availableBrands.find((b) => b.key === normBusiness || b.businessName?.toLowerCase().replace(/[^a-z0-9]/g, "_") === normBusiness)
        : (availableBrands[0] || null);

      const effectiveNormBiz = normBusiness || matchedBrand?.key || null;
      const targetMemoryKey = effectiveNormBiz ? `social_autopilot_${normalizedEmail}_${effectiveNormBiz}` : `social_autopilot_${normalizedEmail}`;

      const hasFacebook = Boolean(matchedBrand?.pageId || meta?.fb_page_id || meta?.fb_business_id);
      const hasInstagram = Boolean(matchedBrand?.igId || meta?.ig_business_id || meta?.instagram_actor_id);

      // Resolve intelligent brand context (Shopify store products, WordPress crawled intel, or generic)
      const intel = await resolveBrandIntelligence({
        email: normalizedEmail,
        normBusiness: effectiveNormBiz,
        matchedBrand,
        supabase
      });

      // Fetch saved memory for this specific brand
      const { data: mem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", normalizedEmail)
        .eq("memory_type", targetMemoryKey)
        .maybeSingle();

      let saved = null;
      if (mem?.content) {
        try {
          saved = JSON.parse(mem.content);
        } catch (_) {}
      }

      // Sanitize: If saved services/queue contain digital marketing agency terms but this brand is NOT Gabbarinfo, discard the wrong agency topics!
      const isAgency = effectiveNormBiz === "gabbarinfo" || effectiveNormBiz === "gabbarinfo_digital_solutions";
      const hasDirtyAgencyServices = !isAgency && saved?.services && saved.services.some(s => /seo|google ads|meta social ads|website design/i.test(s));
      const hasDirtyAgencyQueue = !isAgency && saved?.queue && saved.queue.some(q => /google ads|seo optimization|meta social ads|website design for growth/i.test(q.topic || "") || /google ads|seo optimization/i.test(q.service || ""));

      const finalServices = (!hasDirtyAgencyServices && saved?.services && saved.services.length > 0)
        ? saved.services
        : intel.services;

      const finalIndustry = (!hasDirtyAgencyServices && saved?.industry && !saved.industry.toLowerCase().includes("digital marketing"))
        ? saved.industry
        : intel.industry;

      let finalQueue = (!hasDirtyAgencyQueue && saved?.queue && saved.queue.length > 0)
        ? saved.queue
        : buildFallbackQueue(finalServices, matchedBrand?.businessName || intel.businessName, 30, intel.suggestedTopics);

      let config = {
        enabled: saved?.enabled || false,
        destination: saved?.destination || (hasFacebook && !hasInstagram ? "FACEBOOK_ONLY" : "BOTH"),
        cadence: saved?.cadence || "daily",
        businessName: matchedBrand?.businessName || saved?.businessName || intel.businessName,
        industry: finalIndustry,
        services: finalServices,
        brandVoice: saved?.brandVoice || intel.brandVoice,
        targetAudience: saved?.targetAudience || intel.targetAudience,
        targetMarket: saved?.targetMarket || intel.targetLocations || "",
        targetLocations: saved?.targetLocations || intel.targetLocations || "",
        queue: finalQueue,
        publishedCount: saved?.publishedCount || 0,
        testPostsUsed: saved?.testPostsUsed || 0,
        lastPublishedAt: saved?.lastPublishedAt || null,
        history: saved?.history || []
      };

      // Resolve Instagram username via Graph API (matching Instagram Insights)
      let igUsername = matchedBrand?.igUsername || null;
      if (!igUsername && hasInstagram && meta?.ig_business_id) {
        const token = meta.fb_user_access_token || process.env.META_SYSTEM_USER_TOKEN;
        if (token) {
          try {
            const igRes = await fetch(
              `https://graph.facebook.com/v21.0/${meta.ig_business_id}?fields=username&access_token=${token}`
            );
            const igJson = await igRes.json();
            if (igJson?.username) {
              igUsername = igJson.username;
            }
          } catch (e) {
            console.warn("[Social Autopilot] Failed to fetch IG username:", e.message);
          }
        }
      }
      if (!igUsername && hasInstagram) {
        igUsername = matchedBrand?.igUsername || (meta?.business_name ? meta.business_name.toLowerCase().replace(/[^a-z0-9_.]/g, "") : `ID: ${meta?.ig_business_id || meta?.instagram_actor_id}`);
      }

      const fbPageName = matchedBrand?.pageName || meta?.business_name || (meta?.fb_page_id ? `Page ID: ${meta.fb_page_id}` : null);

      // Entitlement check for Social Media feature
      const ent = await verifyEntitlement(session, config.businessId || meta?.fb_business_id, FEATURES.SOCIAL);

      return res.status(200).json({
        ok: true,
        config,
        isOwner,
        isRestricted: !ent.allowed,
        restrictionReason: ent.error || null,
        availableBrands,
        activeBrand: normBusiness || matchedBrand?.key || null,
        hasFacebook,
        hasInstagram,
        fbPageName,
        igUsername,
        targetPageId: matchedBrand?.pageId || meta?.fb_page_id || null,
        targetIgId: matchedBrand?.igId || meta?.ig_business_id || null,
        metaInfo: {
          businessId: matchedBrand?.businessId || meta?.fb_business_id || null,
          pageId: matchedBrand?.pageId || meta?.fb_page_id || null,
          adAccountId: matchedBrand?.adAccountId || meta?.fb_ad_account_id || null,
          igBusinessId: matchedBrand?.igId || meta?.ig_business_id || null,
        },
        contentPillars: CONTENT_PILLARS
      });
    } catch (err) {
      console.error("[Social Autopilot] GET error:", err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ================================================================
  // POST: Actions (save, generate-queue, regenerate-topic, update-topic)
  // ================================================================
  if (req.method === "POST") {
    const { action = "save", config: updatedConfig, dayIndex, customTopic, customHook } = req.body || {};

    try {
      // Fetch current config first
      const { data: mem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", normalizedEmail)
        .eq("memory_type", autoMemoryKey)
        .maybeSingle();

      let current = {};
      if (mem?.content) {
        try {
          current = JSON.parse(mem.content);
        } catch (e) {}
      }

      // ── ACTION: SAVE CONFIG ──
      if (action === "save") {
        // 🔒 Entitlement Gate: If enabling Autopilot, ensure plan permits SOCIAL_AUTOPILOT
        const subState = await getBusinessSubscriptionState(current.businessId, normalizedEmail);
        const plan = subState.plan;

        if (updatedConfig?.enabled) {
          if (!isOwner && !plan.features.SOCIAL_AUTOPILOT) {
            return res.status(403).json({
              ok: false,
              error: `Social Autopilot is not included in the ${plan.name} plan. Upgrade to Starter or above to activate.`,
            });
          }

          // Validate cadence against plan maximums
          const cadence = updatedConfig.cadence || "daily";
          const maxAllowed = plan.quotas.SOCIAL_POST || 4;

          if (plan.id === "starter") {
            if (cadence === "daily" || cadence === "alternate" || cadence === "weekly_4") {
              return res.status(400).json({
                ok: false,
                error: `The ${plan.name} plan includes up to 4 social posts/month (Weekly cadence). Daily or Alternate cadences require Growth or above.`,
              });
            }
          }
        }

        const merged = {
          ...current,
          ...updatedConfig,
          targetLocations: (updatedConfig?.targetLocations !== undefined ? updatedConfig.targetLocations : current?.targetLocations || current?.targetMarket || "").trim(),
          targetMarket: (updatedConfig?.targetLocations !== undefined ? updatedConfig.targetLocations : current?.targetLocations || current?.targetMarket || "").trim(),
          updatedAt: new Date().toISOString()
        };

        const { error: saveErr } = await supabase.from("agent_memory").upsert(
          {
            email: normalizedEmail,
            memory_type: autoMemoryKey,
            content: JSON.stringify(merged),
            updated_at: new Date().toISOString()
          },
          { onConflict: "email,memory_type" }
        );

        if (saveErr) {
          console.error("[Social Autopilot] Failed to save config:", saveErr.message);
          return res.status(500).json({ ok: false, error: saveErr.message });
        }

        // Cross-sync targetLocations to WordPress SEO Autopilot memory
        if (merged.targetLocations) {
          try {
            const { data: wpMems } = await supabase
              .from("agent_memory")
              .select("memory_type, content")
              .eq("email", normalizedEmail)
              .like("memory_type", "wp_autopilot_%");
            for (const wpM of wpMems || []) {
              try {
                const parsed = JSON.parse(wpM.content);
                parsed.targetLocations = merged.targetLocations;
                parsed.targetMarket = merged.targetLocations;
                await supabase.from("agent_memory").update({
                  content: JSON.stringify(parsed),
                  updated_at: new Date().toISOString(),
                }).eq("email", normalizedEmail).eq("memory_type", wpM.memory_type);
              } catch (_) {}
            }
          } catch (syncErr) {
            console.warn("[Social Autopilot] Could not cross-sync targetLocations to wp_autopilot:", syncErr.message);
          }
        }

        return res.status(200).json({ ok: true, message: "Autopilot configuration saved.", config: merged });
      }

      // ── ACTION: GENERATE FULL 30-DAY QUEUE (AI SYNTHESIS) ──
      if (action === "generate-queue") {
        // 🔒 Entitlement Gate
        const ent = await verifyEntitlement(session, current.businessId, FEATURES.SOCIAL_PLANNER);
        if (!ent.allowed) {
          return res.status(403).json({ ok: false, error: ent.error });
        }

        // 💳 Credit Reservation (5 credits)
        const resCred = await reserveCredits({
          businessId: ent.businessId,
          userEmail: normalizedEmail,
          actionType: "PLANNER_QUEUE",
        });
        if (!resCred.ok) {
          return res.status(402).json({ ok: false, error: resCred.error });
        }

        const effectiveNormBiz = normBusiness || updatedConfig?.businessName?.toLowerCase().replace(/[^a-z0-9]/g, "_") || null;
        const intel = await resolveBrandIntelligence({
          email: normalizedEmail,
          normBusiness: effectiveNormBiz,
          matchedBrand: { businessName: updatedConfig?.businessName || current.businessName },
          supabase
        });

        const isAgency = effectiveNormBiz === "gabbarinfo" || effectiveNormBiz === "gabbarinfo_digital_solutions";
        let services = updatedConfig?.services || current.services || intel.services;
        if (!isAgency && services.some(s => /seo|google ads|meta social ads|website design/i.test(s))) {
          services = intel.services;
        }

        let industry = updatedConfig?.industry || current.industry || intel.industry;
        if (!isAgency && industry.toLowerCase().includes("digital marketing")) {
          industry = intel.industry;
        }

        const businessName = updatedConfig?.businessName || current.businessName || intel.businessName;
        const count = updatedConfig?.cadence === "weekly" ? 4 : updatedConfig?.cadence === "alternate" ? 15 : updatedConfig?.cadence === "weekly_4" ? 16 : 30;

        let aiQueue = null;
        const apiKey = process.env.OPENAI_API_KEY;

        if (apiKey) {
          try {
            const openai = new OpenAI({ apiKey });
            const prompt = `You are a Chief Social Media Strategist planning a ${count}-post high-converting content calendar for Instagram and Facebook.

BUSINESS CONTEXT:
- Name: "${businessName}"
- Industry: "${industry}"
- Core Products / Offerings: ${services.join(", ")}
${intel.suggestedTopics && intel.suggestedTopics.length > 0 ? `- Relevant Domain Topics & Catalog Items:\n${intel.suggestedTopics.slice(0, 15).map(t => `  * ${t}`).join("\n")}` : ""}

CONTENT PILLARS TO CYCLE (Rotate through these 5 pillars strictly):
1. "educational_tips": High-value, actionable "How-To" tip, styling advice, or usage secret that saves/shares.
2. "service_spotlight": Compelling spotlight on one specific product or offering with an authentic value proposition.
3. "myth_busting": Breaking common consumer myths or misconceptions in ${industry}.
4. "problem_solution": Real problem/desire customers face and how to choose the ideal solution.
5. "interactive_poll": Engaging question or debate prompt that drives comments and community interaction.

STRICT RULES:
- All topics MUST be 100% relevant to ${industry} and "${businessName}". Never suggest digital marketing, SEO, or Google Ads unless the business is explicitly a digital marketing agency!
- Zero repetition! Every topic must have a distinct angle and hook.
- Create exactly ${count} posts.
- Output ONLY valid JSON array matching this schema:
[
  {
    "day": 1,
    "pillar": "educational_tips",
    "service": "Service or Product Name",
    "hook": "Punchy 4-7 word attention-grabbing headline",
    "topic": "Specific topic and angle for the graphic and caption"
  }
]`;

            const completion = await openai.chat.completions.create({
              model: process.env.OPENAI_MODEL || "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.8,
              response_format: { type: "json_object" }
            });

            const content = completion.choices[0]?.message?.content;
            if (content) {
              const parsed = JSON.parse(content);
              const items = Array.isArray(parsed) ? parsed : parsed.queue || parsed.posts || parsed.calendar || Object.values(parsed)[0];
              if (Array.isArray(items) && items.length > 0) {
                const now = new Date();
                aiQueue = items.map((item, idx) => ({
                  day: idx + 1,
                  pillar: item.pillar || "educational_tips",
                  service: item.service || services[idx % services.length],
                  hook: item.hook || "Pro Tips & Guide",
                  topic: item.topic || "Practical insights and styling advice",
                  status: "pending",
                  scheduledDate: new Date(now.getTime() + (idx + 1) * 24 * 60 * 60 * 1000).toISOString()
                }));
              }
            }
          } catch (aiErr) {
            console.warn("[Social Autopilot] AI queue generation error, falling back to smart matrix:", aiErr.message);
          }
        }

        if (!aiQueue || aiQueue.length === 0) {
          aiQueue = buildFallbackQueue(services, businessName, count, intel.suggestedTopics);
        }

        const merged = {
          ...current,
          ...updatedConfig,
          queue: aiQueue,
          updatedAt: new Date().toISOString()
        };

        const { error: qErr } = await supabase.from("agent_memory").upsert(
          {
            email: normalizedEmail,
            memory_type: autoMemoryKey,
            content: JSON.stringify(merged),
            updated_at: new Date().toISOString()
          },
          { onConflict: "email,memory_type" }
        );

        if (qErr) {
          console.error("[Social Autopilot] Failed to save queue:", qErr.message);
          return res.status(500).json({ ok: false, error: qErr.message });
        }

        return res.status(200).json({ ok: true, message: `Generated ${aiQueue.length} planned topics!`, queue: aiQueue, config: merged });
      }

      // ── ACTION: REGENERATE SINGLE TOPIC ──
      if (action === "regenerate-topic") {
        const queue = Array.isArray(current.queue) ? [...current.queue] : [];
        const index = typeof dayIndex === "number" ? dayIndex : -1;

        if (index < 0 || index >= queue.length) {
          return res.status(400).json({ ok: false, error: "Invalid dayIndex provided." });
        }

        const target = queue[index];
        const services = current.services || ["Featured Offerings"];
        const s = target.service || services[Math.floor(Math.random() * services.length)];
        const pillar = target.pillar || "educational_tips";

        let newTopic = `Essential guide and best practices for ${s}`;
        let newHook = `Expert Guide: ${s}`;

        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
          try {
            const openai = new OpenAI({ apiKey });
            const prompt = `Generate 1 fresh, highly viral social media topic for "${current.businessName || "Our Business"}" (${current.industry || "Business"}).
Service/Product: "${s}"
Pillar: "${pillar}"
STRICT: Tailor specifically to ${current.industry || "this industry"}. NEVER mention digital marketing, SEO, or Google Ads unless it is explicitly a digital marketing agency.
Respond ONLY in JSON: { "hook": "short catchy hook (4-7 words)", "topic": "specific topic angle" }`;

            const resp = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              response_format: { type: "json_object" }
            });
            const p = JSON.parse(resp.choices[0]?.message?.content || "{}");
            if (p.topic) newTopic = p.topic;
            if (p.hook) newHook = p.hook;
          } catch (aiErr) {
            console.warn("[Social Autopilot] AI regenerate-topic error:", aiErr.message);
          }
        }

        queue[index] = {
          ...target,
          topic: newTopic,
          hook: newHook
        };

        current.queue = queue;
        await supabase.from("agent_memory").upsert(
          {
            email: normalizedEmail,
            memory_type: autoMemoryKey,
            content: JSON.stringify(current),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email,memory_type" }
        );

        return res.status(200).json({ ok: true, updatedItem: queue[index], queue });
      }

      // ── ACTION: CUSTOM TOPIC OVERRIDE ──
      if (action === "update-topic") {
        const queue = Array.isArray(current.queue) ? [...current.queue] : [];
        const index = typeof dayIndex === "number" ? dayIndex : -1;

        if (index < 0 || index >= queue.length) {
          return res.status(400).json({ ok: false, error: "Invalid dayIndex provided." });
        }

        queue[index] = {
          ...queue[index],
          topic: customTopic || queue[index].topic,
          hook: customHook || queue[index].hook
        };

        current.queue = queue;
        await supabase.from("agent_memory").upsert(
          {
            email: normalizedEmail,
            memory_type: autoMemoryKey,
            content: JSON.stringify(current),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email,memory_type" }
        );

        return res.status(200).json({ ok: true, updatedItem: queue[index], queue });
      }

      // ── ACTION: TEST POST NOW (IMMEDIATE SINGLE POST ON-DEMAND) ──
      if (action === "test-post") {
        console.log(`[Social Autopilot] Executing immediate test post for ${normalizedEmail}...`);

        // 🔒 Server-Side Quota Gate: Reserve SOCIAL_POST quota
        const quotaRes = await reserveQuota({
          session,
          userEmail: normalizedEmail,
          businessId: current.businessId,
          actionType: "SOCIAL_POST",
        });

        if (!quotaRes.ok) {
          return res.status(quotaRes.code === "FEATURE_NOT_INCLUDED" ? 403 : 402).json({
            ok: false,
            code: quotaRes.code,
            error: quotaRes.error,
            planId: quotaRes.planId,
            nextResetDate: quotaRes.nextResetDate,
          });
        }

        // 💳 Server-Side Internal Accounting Credit Check (10 credits)
        let resCred = null;
        if (!isOwner) {
          resCred = await reserveCredits({
            businessId: quotaRes.businessId || current.businessId || "default_business",
            userEmail: normalizedEmail,
            actionType: "SOCIAL_POST",
          });

          if (!resCred.ok) {
            await releaseQuota({
              reservationId: quotaRes.reservationId,
              businessId: quotaRes.businessId,
              cycleStart: quotaRes.cycleStart,
              actionType: "SOCIAL_POST",
              reason: "Credit check failure",
            });
            return res.status(402).json({
              ok: false,
              error: resCred.error || "Insufficient internal credits. Publishing a post requires 10 credits.",
            });
          }
        }

        // Check Meta Connection & Brand Intelligence
        const effectiveNormBiz = normBusiness || current.businessName?.toLowerCase().replace(/[^a-z0-9]/g, "_") || null;
        let matchedBrand = null;
        if (effectiveNormBiz) {
          const { data: brandMetaMem } = await supabase
            .from("agent_memory")
            .select("content")
            .eq("email", normalizedEmail)
            .eq("memory_type", `meta_conn_${effectiveNormBiz}`)
            .maybeSingle();
          if (brandMetaMem?.content) {
            try { matchedBrand = JSON.parse(brandMetaMem.content); } catch (_) {}
          }
        }

        const intel = await resolveBrandIntelligence({
          email: normalizedEmail,
          normBusiness: effectiveNormBiz,
          matchedBrand,
          supabase
        });

        const isAgency = effectiveNormBiz === "gabbarinfo" || effectiveNormBiz === "gabbarinfo_digital_solutions";
        const businessName = matchedBrand?.businessName || current.businessName || intel.businessName;
        const businessCategory = (!isAgency && current.industry && !current.industry.includes("Digital Marketing"))
          ? current.industry
          : intel.industry;

        const { data: meta } = await supabase
          .from("meta_connections")
          .select("*")
          .ilike("email", normalizedEmail)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const hasFacebook = Boolean(matchedBrand?.pageId || meta?.fb_page_id || meta?.fb_business_id || process.env.FB_PAGE_ID);
        const hasInstagram = Boolean(matchedBrand?.igId || meta?.ig_business_id || meta?.instagram_actor_id);

        const clientWebsite = matchedBrand?.websiteUrl || meta?.business_website || "";
        const clientPhone = meta?.business_phone || "";

        // Ensure queue exists
        let queue = Array.isArray(current.queue) && current.queue.length > 0
          ? current.queue
          : buildFallbackQueue(current.services || intel.services, businessName, 30, intel.suggestedTopics);

        // Pick next pending item or first item
        let nextIndex = queue.findIndex(q => q.status === "pending");
        if (nextIndex === -1) nextIndex = 0;
        const targetItem = { ...queue[nextIndex] };

        const service = targetItem.service || (current.services && current.services[0]) || "Core Services";
        const topic = targetItem.topic || `Practical insights for ${service}`;
        const hook = targetItem.hook || `Excellence in ${service}`;

        // Build Agent State for Agency-Grade Creative Generation (Matches Dropdown Facebook/Instagram Quality)
        const agentState = {
          businessName,
          businessCategory,
          context: {
            service,
            serviceLocked: true,
            offer: targetItem.hook || "Special Offer",
          },
          assets: {
            contactMethod: clientWebsite ? "website" : (clientPhone ? "phone" : "dm"),
            websiteUrl: clientWebsite,
            phone: clientPhone,
          },
        };

        // 1. Generate masterclass caption (Gemini) & bespoke 3D commercial ad poster (gpt-image-2) in PARALLEL
        const tagline = targetItem.hook || "Dominate Growth with Smart Solutions";

        const captionTask = (async () => {
          try {
            const captionData = await generateCaption(agentState);
            const fullHashtags = Array.isArray(captionData.hashtags) ? captionData.hashtags.join(" ") : "";
            return {
              caption: `${captionData.caption}\n\n${fullHashtags}`,
              visualMood: captionData.visualMood,
              tagline: captionData.tagline || tagline,
            };
          } catch (capErr) {
            console.warn("[Social Autopilot] Gemini caption failed, fallback:", capErr.message);
            return {
              caption: `📢 ${hook.toUpperCase()}\n\n${topic}\n\nRunning a business means staying ahead of the curve. At ${businessName}, we help you turn complex digital challenges into predictable revenue.\n\n👉 Send us a message or visit our website to learn more!\n\n#${service.replace(/[^a-zA-Z0-9]/g, "")} #BusinessGrowth #Marketing #${businessName.replace(/[^a-zA-Z0-9]/g, "")}`,
              visualMood: "Dynamic 3D Commercial Agency Graphic",
              tagline,
            };
          }
        })();

        let storageFileName = null;
        const imageTask = (async () => {
          try {
            const imgRes = await generateImage(agentState, "Dynamic 3D Commercial Agency Graphic", tagline);
            storageFileName = imgRes.storageFileName || null;
            return imgRes.imageUrl;
          } catch (imgErr) {
            console.warn("[Social Autopilot] generateImage failed, fallback to visual generator:", imgErr.message);
            const imagePrompt = `Award-winning commercial graphic design poster for social media advertising. Subject: "${service}" for brand "${businessName}". Theme: "${hook}: ${topic}". Sleek modern commercial studio lighting, vibrant colors, 3D geometric accents, high contrast, clean agency composition, pristine 4K quality, no text watermark.`;
            return await generateSocialVisual(imagePrompt);
          }
        })();

        const [captionResult, imageUrl] = await Promise.all([captionTask, imageTask]);
        const caption = captionResult.caption;

        // Determine destination: respect current.destination, fallback to connection capability
        let destination = current.destination || (hasFacebook && !hasInstagram ? "FACEBOOK_ONLY" : "BOTH");
        if (destination === "BOTH" && !hasInstagram && hasFacebook) {
          destination = "FACEBOOK_ONLY";
        }

        const publishedTo = {};
        let fbPostUrl = null;
        let igPostUrl = null;

        // 1. Facebook
        if (destination === "BOTH" || destination === "FACEBOOK_ONLY") {
          try {
            const fbResult = await executeFacebookPost({
              userEmail: normalizedEmail,
              imageUrl,
              caption,
              targetPageId: matchedBrand?.pageId || null,
            });
            publishedTo.facebook = {
              ok: true,
              id: fbResult?.postId || fbResult?.photoId || "posted",
              postUrl: fbResult?.postUrl,
            };
            fbPostUrl = fbResult?.postUrl;
          } catch (fbErr) {
            console.error(`[Social Autopilot] Facebook publish error:`, fbErr.message);
            publishedTo.facebook = { ok: false, error: fbErr.message };
          }
        }

        // 2. Instagram
        if (destination === "BOTH" || destination === "INSTAGRAM_ONLY") {
          try {
            const igResult = await executeInstagramPost({
              userEmail: normalizedEmail,
              imageUrl,
              caption,
            });
            publishedTo.instagram = {
              ok: true,
              id: igResult?.id || "posted",
              postUrl: igResult?.postUrl || "https://www.instagram.com",
            };
            igPostUrl = igResult?.postUrl || "https://www.instagram.com";
          } catch (igErr) {
            console.error(`[Social Autopilot] Instagram publish error:`, igErr.message);
            publishedTo.instagram = { ok: false, error: igErr.message };
          }
        }

        // Check if publication succeeded for designated target
        const fbFailed = (destination === "BOTH" || destination === "FACEBOOK_ONLY") && !publishedTo.facebook?.ok;
        const igFailed = (destination === "BOTH" || destination === "INSTAGRAM_ONLY") && !publishedTo.instagram?.ok;

        if (fbFailed && (igFailed || destination === "FACEBOOK_ONLY")) {
          const errors = [
            publishedTo.facebook?.error ? `Facebook: ${publishedTo.facebook.error}` : null,
            publishedTo.instagram?.error ? `Instagram: ${publishedTo.instagram.error}` : null,
          ].filter(Boolean).join(" | ");

          await releaseQuota({
            reservationId: quotaRes.reservationId,
            businessId: quotaRes.businessId,
            cycleStart: quotaRes.cycleStart,
            actionType: "SOCIAL_POST",
            reason: "Publishing to social network failed",
          });

          if (resCred?.transactionId) {
            await releaseCredits({
              userEmail: normalizedEmail,
              transactionId: resCred.transactionId,
              cost: resCred.cost,
              reason: "Publishing failed",
            });
          }

          return res.status(400).json({ ok: false, error: errors || "Publishing to designated destination failed." });
        }

        // Commit successful post quota
        await commitQuota({
          reservationId: quotaRes.reservationId,
          businessId: quotaRes.businessId,
          cycleStart: quotaRes.cycleStart,
          actionType: "SOCIAL_POST",
          userEmail: normalizedEmail,
        });

        // ── AUTOMATIC STORAGE CLEANUP (Hosting Media Bridge & Supabase) ──
        if (targetItem?.image_url && targetItem.image_url.includes("media_bridge/")) {
          try {
            await purgeFromMediaBridge({ url: targetItem.image_url, userEmail: normalizedEmail });
            console.log(`[Social Autopilot] Automatically purged hosting Media Bridge image: ${targetItem.image_url}`);
          } catch (mbCleanErr) {
            console.warn("[Social Autopilot] Media Bridge cleanup warning:", mbCleanErr.message);
          }
        }
        if (storageFileName) {
          try {
            await supabase.storage.from("instagram-creatives").remove([storageFileName]);
            console.log(`[Social Autopilot] Cleaned up storage file: ${storageFileName}`);
          } catch (cleanErr) {
            console.warn("[Social Autopilot] Storage cleanup warning:", cleanErr.message);
          }
        }

        const now = new Date();
        targetItem.status = "published";
        targetItem.publishedAt = now.toISOString();
        targetItem.publishedImageUrl = imageUrl;
        targetItem.publishedTo = publishedTo;
        queue[nextIndex] = targetItem;

        current.queue = queue;
        current.lastPublishedAt = now.toISOString();
        current.publishedCount = (current.publishedCount || 0) + 1;
        current.testPostsUsed = (current.testPostsUsed || 0) + 1;
        current.destination = destination;

        if (!Array.isArray(current.history)) current.history = [];
        current.history.unshift({
          date: now.toISOString(),
          day: targetItem.day,
          topic,
          hook,
          service,
          imageUrl,
          destination,
          publishedTo,
          postUrl: fbPostUrl || igPostUrl || null,
        });

        if (current.history.length > 50) current.history = current.history.slice(0, 50);

        await supabase.from("agent_memory").upsert(
          {
            email: normalizedEmail,
            memory_type: autoMemoryKey,
            content: JSON.stringify(current),
            updated_at: now.toISOString(),
          },
          { onConflict: "email,memory_type" }
        );

        return res.status(200).json({
          ok: true,
          message: "Autonomous social post published successfully!",
          publishedItem: targetItem,
          postUrl: fbPostUrl || igPostUrl || null,
          publishedTo,
          destination,
          config: current,
        });
      }

      return res.status(400).json({ ok: false, error: "Unknown action" });
    } catch (err) {
      console.error("[Social Autopilot] POST error:", err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

export const maxDuration = 60;

export const config = {
  maxDuration: 60,
};
