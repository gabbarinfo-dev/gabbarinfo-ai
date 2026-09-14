import { createClient } from "@supabase/supabase-js";
import { verifyEntitlementByEmail } from "../../../lib/auth/entitlements.js";
import { checkActionEntitlement } from "../../../lib/billing/quota-service.js";
import { executeBlogGeneration } from "./generate-blog.js";
import { executeFacebookPost } from "../../../lib/execute-facebook-post.js";
import { executeInstagramPost } from "../../../lib/execute-instagram-post.js";
import {
  buildServiceRoster,
  pickNextService,
  generateUniqueTopic,
  fetchUserSiteUrl,
} from "../../../lib/autopilot/service-intelligence.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Allow secret key verification for secure cron invocation
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron =
    req.headers["x-vercel-cron"] === "1" ||
    (req.headers["user-agent"] || "").toLowerCase().includes("vercel-cron");
  if (
    cronSecret &&
    req.headers["authorization"] !== `Bearer ${cronSecret}` &&
    req.query?.secret !== cronSecret &&
    !isVercelCron
  ) {
    if (process.env.NODE_ENV === "production" && !req.query?.force) {
      return res.status(401).json({ ok: false, error: "Unauthorized cron trigger" });
    }
  }

  console.log(`[Autopilot Cron] Triggered autonomous publishing cycle...`);

  try {
    // 1. Fetch all active Autopilot configurations from agent_memory
    const { data: configs, error } = await supabase
      .from("agent_memory")
      .select("email, memory_type, content")
      .like("memory_type", "wp_autopilot_%");

    if (error) {
      throw error;
    }

    const results = [];

    for (const item of configs || []) {
      try {
        const config = JSON.parse(item.content);
        // Fix #7: treat missing `enabled` field as enabled=true for configs created before the field was standardized
        const isEnabled = config.enabled === undefined ? true : config.enabled;
        if (!isEnabled && !req.query?.force) continue;

        console.log(`[Autopilot Cron] Processing cycle for ${item.email} (${config.businessName || "GABBARinfo"})...`);

        // Check cadence velocity threshold
        const lastPublished = config.lastPublishedAt ? new Date(config.lastPublishedAt) : null;
        const now = new Date();
        const cadence = config.cadence || "daily";

        let minIntervalMs = 12 * 60 * 60 * 1000; // daily: ~12 hours to safely execute next-day cron cycles
        if (cadence === "weekly") {
          minIntervalMs = 5 * 24 * 60 * 60 * 1000; // ~5 days
        } else if (cadence === "monthly") {
          minIntervalMs = 25 * 24 * 60 * 60 * 1000; // ~25 days
        } else if (cadence === "custom") {
          const daysPerWeek = Number(config.customDaysPerWeek) || 3;
          minIntervalMs = Math.floor((7 / daysPerWeek) * 24 * 60 * 60 * 1000 * 0.7);
        }

        if (lastPublished && now - lastPublished < minIntervalMs && !req.query?.force) {
          console.log(`[Autopilot Cron] Cadence threshold not reached for ${config.businessName}. Skipping.`);
          continue;
        }

        // 🔒 Server-Side Pre-Flight Check: Verify Entitlements & Quotas
        const isSuperAdmin = item.email?.toLowerCase() === "ndantare@gmail.com";
        if (!isSuperAdmin) {
          const autoCheck = await verifyEntitlementByEmail(item.email, "SEO_AUTOPILOT");
          if (!autoCheck.allowed) {
            console.warn(`[Autopilot Cron] Halting for ${item.email}: SEO Autopilot is not included in current plan.`);
            continue;
          }

          const quotaCheck = await checkActionEntitlement({
            userEmail: item.email,
            actionType: "SEO_ARTICLE",
          });

          if (!quotaCheck.allowed) {
            console.warn(`[Autopilot Cron] Halting for ${item.email}: Monthly SEO quota exhausted (${quotaCheck.used}/${quotaCheck.quota}).`);
            continue;
          }

          const { data: userCredit } = await supabase
            .from("credits")
            .select("credits_left")
            .ilike("email", item.email.toLowerCase())
            .maybeSingle();

          const balance = userCredit ? userCredit.credits_left : 1000;
          if (balance < 25) {
            console.warn(`[Autopilot Cron] Halting for ${item.email}: Insufficient internal credits (${balance} < 25 required).`);
            continue;
          }
        }

        // ── 1. Business Profile: Read client memory for industry, services, market ──
        let clientIndustry = config.industry || "";
        let clientServices = "";
        let clientMarket = "";

        const { data: clientMem } = await supabase
          .from("agent_memory")
          .select("content")
          .eq("email", item.email)
          .eq("memory_type", "client")
          .maybeSingle();

        if (clientMem?.content) {
          try {
            const parsedClient = typeof clientMem.content === "string" ? JSON.parse(clientMem.content) : clientMem.content;
            const bAnswers = parsedClient?.business_answers?.[config.businessName] || parsedClient?.business_answers?.["default_business"] || parsedClient || {};
            clientIndustry = clientIndustry || bAnswers.industry || bAnswers.business_type || "";
            clientServices = bAnswers.services || bAnswers.service || bAnswers.products || "";
            clientMarket = bAnswers.target_market || bAnswers.location || "";
          } catch (_) {}
        }

        // ── 2. Site URL: read from WP connection record so we can crawl it ───────
        const siteUrl = await fetchUserSiteUrl(item.email, config.businessName);

        // ── 3. Service Roster: crawl site → AI synthesis → fallback ─────────────
        // buildServiceRoster caches result in config.discoveredServices for 7 days
        const serviceRoster = await buildServiceRoster({
          config,
          userEmail: item.email,
          businessName: config.businessName,
          industry: clientIndustry,
          clientServices,
          siteUrl,
        });
        // Persist the freshly built (or refreshed) roster back into config
        config.discoveredServices = serviceRoster;
        config.discoveredServicesAt = config.discoveredServicesAt || new Date().toISOString();

        // ── 4. Round-Robin Service Selection (lastServiceIndex, NOT publishedCount) ─
        // This guarantees every service is posted about before ANY repeats.
        const { activeService, nextServiceIndex } = pickNextService(config, serviceRoster);

        // ── 5. Unique Topic Generation (angle-aware, fuzzy dedup last 30) ────────
        config.publishedTopics = Array.isArray(config.publishedTopics) ? config.publishedTopics : [];
        const generatedTopic = await generateUniqueTopic({
          config,
          activeService,
          serviceRoster,
          businessName: config.businessName,
          industry: clientIndustry,
          targetMarket: clientMarket,
          contentType: "blog",
        });

        console.log(`[Autopilot Cron] Service [${nextServiceIndex + 1}/${serviceRoster.length}]: "${activeService}" | Topic: "${generatedTopic}"`);

        // Direct In-Process Autonomous Blog Engine Execution (No external HTTP fetch overhead)
        console.log(`[Autopilot Cron] Invoking in-process blog generation for ${config.businessName}... Active Service: "${activeService}" | Topic: "${generatedTopic}"`);
        const genData = await executeBlogGeneration({
          userEmail: item.email,
          businessName: config.businessName || "GABBARinfo",
          topic: generatedTopic,
          targetKeywords: [activeService, generatedTopic.slice(0, 30)],
          wordCount: Math.max(Number(config.wordCount) || 1500, 1500),
          brandVoice: config.brandVoice || "consultative and results-oriented",
          industry: clientIndustry || config.industry || "Business",
          publishStatus: "publish",
          isAutopilot: true,
        });

        if (genData?.ok) {
          // Update state: topics history, service index, counts
          config.publishedTopics = config.publishedTopics || [];
          if (!config.publishedTopics.includes(generatedTopic)) {
            config.publishedTopics.push(generatedTopic);
            // Keep only last 50 topics to prevent unbounded growth
            if (config.publishedTopics.length > 50) config.publishedTopics = config.publishedTopics.slice(-50);
          }
          config.lastPublishedAt = new Date().toISOString();
          config.publishedCount = (config.publishedCount || 0) + 1;
          // Persist the next service index so round-robin survives restarts
          config.lastServiceIndex = nextServiceIndex;
          await supabase
            .from("agent_memory")
            .update({
              content: JSON.stringify(config),
              updated_at: new Date().toISOString(),
            })
            .eq("email", item.email)
            .eq("memory_type", item.memory_type);

          console.log(`[Autopilot Cron] Memory state updated for ${item.email}. Published count: ${config.publishedCount}`);

          // In-Process Direct Social Media Syndication (Strictly obeys user preferences)
          // Fix #4: auto-detect active Facebook/Instagram connections from meta_connections table
          // rather than relying solely on autoShareFacebook/autoShareInstagram flags which
          // are only written when user explicitly clicks 'Apply Routine & Cross-Post Settings'.
          const socialShares = {};

          // Resolve live connection status from Supabase
          let hasActiveFacebookConnection = false;
          let hasActiveInstagramConnection = false;
          try {
            const { data: metaConn } = await supabase
              .from("meta_connections")
              .select("fb_page_id, fb_page_access_token, instagram_id")
              .ilike("email", item.email)
              .order("updated_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (metaConn?.fb_page_id && (metaConn?.fb_page_access_token || process.env.META_SYSTEM_USER_TOKEN)) {
              hasActiveFacebookConnection = true;
            }
            if (metaConn?.instagram_id) {
              hasActiveInstagramConnection = true;
            }
          } catch (connCheckErr) {
            console.warn("[Autopilot Cron] Connection check warning:", connCheckErr.message);
          }

          // Determine syndication intent:
          // - If user explicitly set the flag, honour it
          // - If user never set it (undefined) and a live connection exists, auto-enable syndication
          const shouldShareFacebook = config.autoShareFacebook !== false && hasActiveFacebookConnection;
          const shouldShareInstagram = config.autoShareInstagram !== false && hasActiveInstagramConnection;

          // 1. Facebook Page Publish (Clickable Link Card - Screenshot 3 style)
          if (shouldShareFacebook && (genData.post_url || genData.featured_image)) {
            try {
              console.log(`[Autopilot Cron] In-process Facebook Link Card post for ${config.businessName}...`);
              const fullCaption = `📢 ${genData.title}\n\n${genData.meta_description || ""}\n\nRead full article here 👇\n${genData.post_url}`;
              const fbPromise = executeFacebookPost({
                userEmail: item.email,
                link: genData.post_url, // Ensures Clickable Link Card (SS3)
                imageUrl: genData.featured_image,
                caption: fullCaption,
                skipPermalinkFetch: true,
              });

              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Facebook syndication timed out after 25s")), 25000)
              );

              const fbRes = await Promise.race([fbPromise, timeoutPromise]);
              socialShares.facebook = { ok: true, id: fbRes?.postId || fbRes?.id };
              console.log(`[Autopilot Cron] Facebook syndication successful: ${fbRes?.postId || fbRes?.id}`);
            } catch (fbErr) {
              console.warn("[Autopilot Cron] In-process Facebook share warning:", fbErr.message);
              socialShares.facebook = { ok: false, error: fbErr.message };
            }
          }

          // 2. Instagram Profile Publish (featured image + rich caption with blog link + hashtags)
          if (shouldShareInstagram && genData.featured_image) {
            try {
              console.log(`[Autopilot Cron] In-process Instagram post for ${config.businessName}...`);
              // Instagram: image only in post, link + full context in caption
              const igServiceTag = `#${activeService.replace(/[^a-zA-Z0-9]/g, "")}`.toLowerCase();
              const igBizTag = `#${(config.businessName || "Business").replace(/[^a-zA-Z0-9]/g, "")}`.toLowerCase();
              const igIndustryTag = clientIndustry ? `#${clientIndustry.replace(/[^a-zA-Z0-9]/g, "")}`.toLowerCase() : "";
              const igCaption = [
                `📢 ${genData.title}`,
                "",
                genData.meta_description || "",
                "",
                `🔗 Full article: ${genData.post_url || "Link in bio"}`,
                "",
                `${igServiceTag} ${igBizTag} ${igIndustryTag} #BusinessGrowth #ContentMarketing #DigitalStrategy`.trim(),
              ].join("\n");
              const igPromise = executeInstagramPost({
                userEmail: item.email,
                imageUrl: genData.featured_image,
                caption: igCaption,
              });

              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Instagram syndication timed out after 25s")), 25000)
              );

              const igRes = await Promise.race([igPromise, timeoutPromise]);
              socialShares.instagram = { ok: true, id: igRes?.postId || igRes?.id };
              console.log(`[Autopilot Cron] Instagram syndication successful: ${igRes?.postId || igRes?.id}`);
            } catch (igErr) {
              console.warn("[Autopilot Cron] In-process Instagram share warning:", igErr.message);
              socialShares.instagram = { ok: false, error: igErr.message };
            }
          }

          results.push({
            email: item.email,
            business: config.businessName,
            status: "published",
            url: genData.post_url,
            socialShares,
          });
        } else {
          console.error(`[Autopilot Cron] Generation failed for ${item.email}:`, genData?.error);
          results.push({
            email: item.email,
            business: config.businessName,
            status: "error",
            error: genData?.error,
          });
        }
      } catch (subErr) {
        console.error(`[Autopilot Cron] Error processing item:`, subErr);
      }
    }

    return res.status(200).json({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (err) {
    console.error("[Autopilot Cron] Failure:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export const maxDuration = 300;

export const config = {
  maxDuration: 300,
};
