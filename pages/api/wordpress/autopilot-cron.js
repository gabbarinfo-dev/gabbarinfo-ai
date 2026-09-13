import { createClient } from "@supabase/supabase-js";
import { verifyEntitlementByEmail } from "../../../lib/auth/entitlements.js";
import { checkActionEntitlement } from "../../../lib/billing/quota-service.js";
import { executeBlogGeneration } from "./generate-blog.js";
import { executeFacebookPost } from "../../../lib/execute-facebook-post.js";
import { executeInstagramPost } from "../../../lib/execute-instagram-post.js";

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

        // Universal Service Roster: Extract distinct business services for ANY user business
        const rawServices = [];
        if (Array.isArray(config.targetKeywords)) rawServices.push(...config.targetKeywords);
        if (Array.isArray(config.services)) rawServices.push(...config.services);
        if (typeof clientServices === "string" && clientServices.trim()) {
          rawServices.push(...clientServices.split(/[,;\n|]/).map(s => s.trim()));
        }

        // Deduplicate and sanitize
        const seenServices = new Set();
        const serviceRoster = [];
        for (const s of rawServices) {
          const clean = s.trim().replace(/^[-•*]\s*/, "");
          if (clean.length > 2 && !seenServices.has(clean.toLowerCase())) {
            seenServices.add(clean.toLowerCase());
            serviceRoster.push(clean);
          }
        }

        if (serviceRoster.length <= 1) {
          // Universal Multi-Tenant Service Expansion: Dynamically synthesize distinct service offerings
          // tailored specifically to THIS user's actual business, industry, and niche (e.g. laundry, real estate, legal, medical, etc.)
          try {
            if (process.env.OPENAI_API_KEY) {
              const OpenAI = (await import("openai")).default;
              const expAi = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
              const expRes = await expAi.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                  {
                    role: "system",
                    content: "You are an enterprise business analyst. Return ONLY a valid JSON array of 5 to 6 distinct commercial service, product, or solution offerings that this specific business provides to its paying clients. No markdown, no code blocks, no preamble, just a pure JSON array of strings: [\"Service 1\", \"Service 2\", ...]."
                  },
                  {
                    role: "user",
                    content: `Business Name: "${config.businessName || 'Enterprise'}"\nIndustry / Category: "${clientIndustry || 'Commercial Services'}"\nExisting services: "${serviceRoster.join(', ') || 'None'}"\nSynthesize 5 to 6 distinct core offerings for this business.`
                  }
                ],
                temperature: 0.3,
                max_tokens: 150
              });
              const rawExp = expRes.choices?.[0]?.message?.content?.trim() || "";
              const parsedExp = JSON.parse(rawExp.replace(/^```json|^```|```$/g, "").trim());
              if (Array.isArray(parsedExp) && parsedExp.length > 0) {
                for (const item of parsedExp) {
                  const clean = String(item).trim();
                  if (clean.length > 2 && !seenServices.has(clean.toLowerCase())) {
                    seenServices.add(clean.toLowerCase());
                    serviceRoster.push(clean);
                  }
                }
              }
            }
          } catch (expErr) {
            console.warn("[Autopilot Cron] Dynamic service expansion failed, using business-aligned fallback:", expErr.message);
          }

          // Fallback if AI offline: Universal business-aligned operational pillars (NEVER hardcoded marketing agency services)
          if (serviceRoster.length <= 1) {
            const genericPillars = [
              `${config.businessName || 'Core'} Primary Offerings`,
              `${clientIndustry || 'Professional'} Client Solutions`,
              "Specialized Services & Packages",
              "Consultation & Implementation",
              "Client Support & Service Delivery"
            ];
            for (const gp of genericPillars) {
              if (!seenServices.has(gp.toLowerCase())) {
                seenServices.add(gp.toLowerCase());
                serviceRoster.push(gp);
              }
            }
          }
        }

        // Deterministic Universal Service Round-Robin: Advances to the next distinct service on each publication
        const serviceIndex = (config.publishedCount || 0) % serviceRoster.length;
        const activeService = serviceRoster[serviceIndex] || serviceRoster[0];

        config.publishedTopics = Array.isArray(config.publishedTopics) ? config.publishedTopics : [];
        let generatedTopic = "";

        // 2. Dynamic Multi-Model AI Topic Synthesis (OpenAI -> Google Gemini Failover)
        const recentTopics = config.publishedTopics.slice(-15).join(" | ");
        const isSeoActive = /seo|search engine/i.test(activeService);
        const topicPrompt = `You are a Principal Content Strategist for "${config.businessName || 'Enterprise'}", operating in the "${clientIndustry || 'Commercial Solutions'}" industry.
Today's designated core service / product focus is: "${activeService}".
Target market / audience: "${clientMarket || 'Global B2B/B2C'}".
Complete service roster: "${serviceRoster.join(', ')}".
${!isSeoActive ? `CRITICAL NEGATIVE CONSTRAINT: DO NOT use the word "SEO" or mention search engine optimization anywhere in the title. Focus 100% strictly on "${activeService}".` : ""}

Generate a complete, high-impact, authoritative blog headline (8 to 14 words) for today that focuses specifically on "${activeService}". Address a real customer pain point, strategic decision, or practical high-value solution in this domain.
NEVER return a single word. Return ONLY the complete headline title, with no quotes or preamble.`;

        // Attempt 1: OpenAI (gpt-4o-mini)
        const openAiKey = process.env.OPENAI_API_KEY;
        if (openAiKey) {
          try {
            const OpenAI = (await import("openai")).default;
            const openai = new OpenAI({ apiKey: openAiKey });

            const aiResp = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: topicPrompt }],
              temperature: 0.75,
              max_tokens: 60,
            });

            const aiTitle = aiResp.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "");
            if (aiTitle && aiTitle.length > 15 && !config.publishedTopics.includes(aiTitle)) {
              generatedTopic = aiTitle;
              console.log(`[Autopilot Cron] OpenAI topic synthesized: "${generatedTopic}" for service "${activeService}"`);
            }
          } catch (aiErr) {
            console.warn("[Autopilot Cron] OpenAI topic synthesis error (falling back to Gemini):", aiErr.message);
          }
        }

        // Attempt 2: Google Gemini Fallback (gemini-2.5-flash) if OpenAI quota exhausted or failed
        if (!generatedTopic && process.env.GEMINI_API_KEY) {
          try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
            const geminiResp = await fetch(geminiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: topicPrompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 100 },
              }),
            });
            if (geminiResp.ok) {
              const geminiData = await geminiResp.json();
              const geminiTitle = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim().replace(/^["']|["']$/g, "");
              if (geminiTitle && geminiTitle.length > 15 && !config.publishedTopics.includes(geminiTitle)) {
                generatedTopic = geminiTitle;
                console.log(`[Autopilot Cron] Gemini topic synthesized: "${generatedTopic}" for service "${activeService}"`);
              }
            }
          } catch (geminiErr) {
            console.warn("[Autopilot Cron] Gemini topic synthesis fallback warning:", geminiErr.message);
          }
        }

        // Attempt 3: Template-Based Diversifier using activeService
        if (!generatedTopic) {
          const templates = [
            `The Comprehensive Guide to ${activeService}: Actionable Tactics for Sustainable Growth`,
            `Mastering ${activeService}: Best Practices for Maximizing Quality and ROI`,
            `High-Impact ${activeService} Strategies That Modern Industry Leaders Swear By`,
            `The Practical Playbook for ${activeService}: Overcoming Common Pitfalls`,
            `Advanced ${activeService} Optimization: Core Frameworks and Proven Solutions`,
            `How Leading Enterprises Elevate Results with ${activeService}: Deep-Dive Analysis`
          ];

          for (const tpl of templates) {
            if (!config.publishedTopics.includes(tpl)) {
              generatedTopic = tpl;
              break;
            }
          }

          if (!generatedTopic) {
            generatedTopic = `${activeService}: Critical Industry Insights and Practical Solutions for ${new Date().getFullYear()}`;
          }
        }

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

          // In-Process Direct Social Media Syndication (Strictly obeys user preferences)
          const socialShares = {};

          // 1. Facebook Page Publish (Clickable Link Card - Screenshot 3 style)
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

          // 2. Instagram Profile Publish (if user preferred Instagram)
          if (config.autoShareInstagram && genData.featured_image) {
            try {
              console.log(`[Autopilot Cron] In-process Instagram post for ${config.businessName}...`);
              const igCaption = `📢 ${genData.title}\n\n${genData.meta_description || ""}\n\n🔗 Link in bio to read full breakdown!\n\n#${activeService.replace(/[^a-zA-Z0-9]/g, "")} #BusinessGrowth #${(config.businessName || "Gabbarinfo").replace(/[^a-zA-Z0-9]/g, "")}`;
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
