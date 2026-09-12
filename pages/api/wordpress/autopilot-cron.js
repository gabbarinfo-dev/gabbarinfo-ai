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

        // 1. Fetch user's business profile for universal domain intelligence (Zero hardcoding)
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

        config.publishedTopics = Array.isArray(config.publishedTopics) ? config.publishedTopics : [];
        let generatedTopic = "";

        // 2. Dynamic AI Topic Synthesis tailored to this specific business
        const openAiKey = process.env.OPENAI_API_KEY;
        if (openAiKey) {
          try {
            const OpenAI = (await import("openai")).default;
            const openai = new OpenAI({ apiKey: openAiKey });

            const recentTopics = config.publishedTopics.slice(-15).join(" | ");
            const prompt = `You are a Principal Content Strategist for "${config.businessName || 'Enterprise'}", operating in the "${clientIndustry || 'Commercial Solutions'}" industry, providing: "${clientServices || 'High-value services and products'}". Target market: "${clientMarket || 'Global B2B/B2C'}".
Generate a single, compelling, authoritative blog headline/topic for today that addresses a real customer pain point, buying consideration, or technical problem in this domain.
DO NOT repeat or closely mimic any of these previously published topics: [${recentTopics}].
Return ONLY the single title, with no quotes or preamble.`;

            const aiResp = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.75,
              max_tokens: 60,
            });

            const aiTitle = aiResp.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "");
            if (aiTitle && !config.publishedTopics.includes(aiTitle)) {
              generatedTopic = aiTitle;
            }
          } catch (aiErr) {
            console.warn("[Autopilot Cron] AI topic synthesis fallback:", aiErr.message);
          }
        }

        // Fallback: Intelligent Round-Robin keyword topic generator if AI synthesis unavailable
        if (!generatedTopic) {
          const keywords = Array.isArray(config.targetKeywords) && config.targetKeywords.length > 0
            ? config.targetKeywords
            : (clientServices ? clientServices.split(",").map(s => s.trim()) : ["Business Growth", "Operations", "Market Leadership"]);

          const templates = [
            "The Comprehensive Guide to %KW%: Actionable Tactics for Sustainable Growth",
            "Mastering %KW%: Best Practices for Maximizing Quality and ROI",
            "High-Impact %KW% Strategies That Modern Industry Leaders Swear By",
            "The Practical Playbook for %KW%: Overcoming Common Pitfalls",
            "Advanced %KW% Optimization: Core Frameworks and Proven Solutions",
            "How Leading Enterprises Elevate Results with %KW%: Deep-Dive Analysis"
          ];

          // True Round-Robin: Pick keyword based on publishedCount modulo keywords length
          const kwIndex = (config.publishedCount || 0) % keywords.length;
          const selectedKw = keywords[kwIndex] || keywords[0];

          for (const tpl of templates) {
            const candidate = tpl.replace("%KW%", selectedKw);
            if (!config.publishedTopics.includes(candidate)) {
              generatedTopic = candidate;
              break;
            }
          }

          if (!generatedTopic) {
            generatedTopic = `${selectedKw}: Critical Industry Insights and Practical Solutions`;
          }
        }

        // Direct In-Process Autonomous Blog Engine Execution (No external HTTP fetch overhead)
        console.log(`[Autopilot Cron] Invoking in-process blog generation for ${config.businessName}... Topic: "${generatedTopic}"`);
        const genData = await executeBlogGeneration({
          userEmail: item.email,
          businessName: config.businessName || "GABBARinfo",
          topic: generatedTopic,
          targetKeywords: [generatedTopic.slice(0, 30)],
          wordCount: Math.max(Number(config.wordCount) || 1500, 1500),
          brandVoice: config.brandVoice || "consultative and results-oriented",
          industry: clientIndustry || config.industry || "Business",
          publishStatus: "publish",
          isAutopilot: true,
        });

        if (genData?.ok) {
          // Immediately update lastPublishedAt, publishedCount & publishedTopics in Supabase
          config.publishedTopics = config.publishedTopics || [];
          if (!config.publishedTopics.includes(generatedTopic)) {
            config.publishedTopics.push(generatedTopic);
          }
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

          // In-Process Direct Facebook Syndication (Clickable Link Card - Screenshot 3 style)
          const socialShares = {};
          if (config.autoShareFacebook && (genData.post_url || genData.featured_image)) {
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
