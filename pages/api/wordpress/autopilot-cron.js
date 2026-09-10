import { createClient } from "@supabase/supabase-js";
import { verifyEntitlementByEmail } from "../../../lib/auth/entitlements.js";
import { checkActionEntitlement } from "../../../lib/billing/quota-service.js";
import { executeBlogGeneration } from "./generate-blog.js";
import { executeFacebookPost } from "../../../lib/execute-facebook-post.js";

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
        if (!config.enabled && !req.query?.force) continue;

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

        // Pick next topic
        const keywords = config.targetKeywords || ["Digital Marketing Strategies", "SEO Growth"];
        const randomKw = keywords[Math.floor(Math.random() * keywords.length)] || "Business Growth";
        const generatedTopic = `The Essential Guide to ${randomKw}: Proven Strategies That Drive Revenue in 2026`;

        // Direct In-Process Autonomous Blog Engine Execution (No external HTTP fetch overhead)
        console.log(`[Autopilot Cron] Invoking in-process blog generation for ${config.businessName}...`);
        const genData = await executeBlogGeneration({
          userEmail: item.email,
          businessName: config.businessName || "GABBARinfo",
          topic: generatedTopic,
          targetKeywords: keywords,
          wordCount: Math.max(Number(config.wordCount) || 1500, 1500),
          brandVoice: config.brandVoice || "consultative and results-oriented",
          industry: config.industry || "Business",
          publishStatus: "publish",
          isAutopilot: true,
        });

        if (genData?.ok) {
          // Immediately update lastPublishedAt & publishedCount in Supabase
          config.lastPublishedAt = new Date().toISOString();
          config.publishedCount = (config.publishedCount || 0) + 1;
          await supabase
            .from("agent_memory")
            .update({
              content: JSON.stringify(config),
              updated_at: new Date().toISOString(),
            })
            .eq("email", item.email)
            .eq("memory_type", item.memory_type);

          console.log(`[Autopilot Cron] Memory state updated for ${item.email}. Published count: ${config.publishedCount}`);

          // In-Process Direct Facebook Syndication (Zero HTTP overhead)
          const socialShares = {};
          if (config.autoShareFacebook && genData.featured_image) {
            try {
              console.log(`[Autopilot Cron] In-process Facebook post for ${config.businessName}...`);
              const fullCaption = `📢 ${genData.title}\n\n${genData.meta_description}\n\nRead full article here 👇\n${genData.post_url}\n\n#DigitalMarketing #SEO #BusinessGrowth #GABBARinfo`;
              const fbRes = await executeFacebookPost({
                userEmail: item.email,
                imageUrl: genData.featured_image,
                caption: fullCaption,
              });
              socialShares.facebook = { ok: true, id: fbRes?.postId || fbRes?.id };
              console.log(`[Autopilot Cron] Facebook syndication successful: ${fbRes?.postId || fbRes?.id}`);
            } catch (fbErr) {
              console.warn("[Autopilot Cron] In-process Facebook share warning:", fbErr.message);
              socialShares.facebook = { ok: false, error: fbErr.message };
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

export const maxDuration = 60;

export const config = {
  maxDuration: 60,
};
