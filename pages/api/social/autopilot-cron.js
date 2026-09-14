// pages/api/social/autopilot-cron.js
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { executeFacebookPost } from "../../../lib/execute-facebook-post.js";
import { executeInstagramPost } from "../../../lib/execute-instagram-post.js";
import { generateImage } from "../../../lib/instagram/generate-image.js";
import { generateCaption } from "../../../lib/instagram/generate-caption.js";
import { verifyEntitlementByEmail, FEATURES } from "../../../lib/auth/entitlements.js";
import { checkActionEntitlement, reserveQuota, commitQuota, releaseQuota } from "../../../lib/billing/quota-service.js";
import { uploadToMediaBridge, purgeFromMediaBridge } from "../../../lib/wordpress/media-bridge.js";
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

// Fallback high-speed graphic generator
async function generateSocialVisual(prompt, label = "social") {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const openai = new OpenAI({ apiKey });
      const modelToUse = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
      console.log(`[Social Cron] Generating visual with OpenAI (${modelToUse})...`);

      let response;
      try {
        response = await openai.images.generate({
          model: modelToUse,
          prompt,
          size: "1024x1024",
        });
      } catch (err) {
        console.warn(`[Social Cron] Primary model ${modelToUse} failed, trying gpt-image-1.5:`, err.message);
        response = await openai.images.generate({
          model: "gpt-image-1.5",
          prompt,
          size: "1024x1024",
        });
      }

      let imgBuffer = null;
      if (response.data?.[0]?.b64_json) {
        imgBuffer = Buffer.from(response.data[0].b64_json, "base64");
      } else if (response.data?.[0]?.url) {
        const fetchRes = await fetch(response.data[0].url);
        imgBuffer = Buffer.from(await fetchRes.arrayBuffer());
      }

      if (imgBuffer) {
        try {
          const mb = await uploadToMediaBridge({
            filename: `social_ai_${Date.now()}.png`,
            buffer: imgBuffer,
          });
          return mb.url;
        } catch (mbErr) {
          console.warn("[Social Cron] Media bridge upload fallback:", mbErr.message);
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
      console.warn("[Social Cron] OpenAI visual generation error:", e.message);
    }
  }

  // Pexels commercial stock photography fallback (authentic high-res commercial imagery with zero watermarks)
  if (process.env.PEXELS_API_KEY) {
    try {
      const query = encodeURIComponent((label || "business commercial marketing").trim());
      const pexRes = await fetch(`https://api.pexels.com/v1/search?query=${query}&per_page=5&orientation=square`, {
        headers: { Authorization: process.env.PEXELS_API_KEY }
      });
      if (pexRes.ok) {
        const pexData = await pexRes.json();
        const photo = pexData.photos?.[0] || pexData.photos?.[1];
        if (photo?.src?.large2x || photo?.src?.large) {
          const photoUrl = photo.src.large2x || photo.src.large;
          const photoFetch = await fetch(photoUrl);
          if (photoFetch.ok) {
            const buf = Buffer.from(await photoFetch.arrayBuffer());
            try {
              const mb = await uploadToMediaBridge({
                filename: `social_pex_${Date.now()}.png`,
                buffer: buf,
              });
              return mb.url;
            } catch (mbErr) {
              const fileName = `social_pex_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
              const { data: uploadData, error: uploadErr } = await supabase.storage
                .from("instagram-creatives")
                .upload(fileName, buf, { contentType: "image/png", upsert: true });
              if (!uploadErr && uploadData) {
                const { data: pubUrl } = supabase.storage.from("instagram-creatives").getPublicUrl(fileName);
                return pubUrl.publicUrl;
              }
              return photoUrl;
            }
          }
        }
      }
    } catch (pexErr) {
      console.warn("[Social Cron] Pexels visual fallback warning:", pexErr.message);
    }
  }

  // Pollinations high-speed fallback
  try {
    const cleanPrompt = encodeURIComponent(`Award-winning commercial advertising poster for ${label}. Sleek modern commercial studio lighting, 8k render, high contrast, masterpiece.`);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
    const pollRes = await fetch(pollinationsUrl);
    if (pollRes.ok) {
      const pollBuf = Buffer.from(await pollRes.arrayBuffer());
      try {
        const mb = await uploadToMediaBridge({
          filename: `social_poll_${Date.now()}.png`,
          buffer: pollBuf,
        });
        return mb.url;
      } catch (mbErr) {
        console.warn("[Social Cron] Media bridge fallback for poll image:", mbErr.message);
        const fileName = `social_poll_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("instagram-creatives")
          .upload(fileName, pollBuf, { contentType: "image/png", upsert: true });

        if (!uploadErr && uploadData) {
          const { data: pubUrl } = supabase.storage.from("instagram-creatives").getPublicUrl(fileName);
          return pubUrl.publicUrl;
        }
        return pollinationsUrl;
      }
    }
    return pollinationsUrl;
  } catch (pollErr) {
    console.warn("[Social Cron] Pollinations fallback error:", pollErr.message);
  }

  return null; // No image available — let caller decide whether to skip
}

export default async function handler(req, res) {
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

  console.log(`[Social Autopilot Cron] Checking social posting schedule...`);

  try {
    // 1. Fetch all active Social Autopilot configurations
    const { data: configs, error } = await supabase
      .from("agent_memory")
      .select("email, memory_type, content")
      .like("memory_type", "social_autopilot_%");

    if (error) throw error;

    const results = [];

    for (const item of configs || []) {
      try {
        const now = new Date();
        const config = JSON.parse(item.content);
        if (!config.enabled && !req.query?.force) continue;

        // Specific single-user trigger override
        if (req.query?.email && req.query.email.toLowerCase() !== item.email.toLowerCase()) {
          continue;
        }

        // ⏱️ Cadence Frequency Gate (mirrors WP autopilot logic)
        // Prevents burning credits by re-posting before the configured interval has elapsed
        const lastPublished = config.lastPublishedAt ? new Date(config.lastPublishedAt) : null;
        const cadence = config.cadence || config.frequency || "daily";
        const publishedPerMonth = config.postsPerMonth || 30;

        let minIntervalMs;
        if (cadence === "daily" || publishedPerMonth >= 28) {
          minIntervalMs = 12 * 60 * 60 * 1000;       // 12h — safe window for daily cron
        } else if (cadence === "weekly" || publishedPerMonth <= 5) {
          minIntervalMs = 5 * 24 * 60 * 60 * 1000;   // 5 days
        } else if (cadence === "biweekly" || publishedPerMonth <= 14) {
          minIntervalMs = Math.floor((7 / (publishedPerMonth / 4)) * 24 * 60 * 60 * 1000 * 0.7);
        } else {
          // Fallback: calculate from postsPerMonth
          minIntervalMs = Math.floor((30 / publishedPerMonth) * 24 * 60 * 60 * 1000 * 0.75);
        }

        if (lastPublished && now - lastPublished < minIntervalMs && !req.query?.force) {
          console.log(`[Social Autopilot Cron] Cadence threshold not reached for ${item.email} (cadence: ${cadence}, last: ${config.lastPublishedAt}). Skipping.`);
          continue;
        }
        // 🔒 Server-Side Pre-Flight Check: Verify Entitlements, Autopilot Inclusion & Monthly Quota
        const isSuperAdmin = item.email?.toLowerCase() === "ndantare@gmail.com";
        if (!isSuperAdmin) {
          // Check if plan includes Social Autopilot
          const autoCheck = await verifyEntitlementByEmail(item.email, "SOCIAL_AUTOPILOT");
          if (!autoCheck.allowed) {
            console.log(`[Social Autopilot Cron] Tenant ${item.email} has Social Autopilot disabled or not in plan. Skipping.`);
            continue;
          }

          // Check remaining monthly social post quota
          const quotaCheck = await checkActionEntitlement({
            userEmail: item.email,
            actionType: "SOCIAL_POST",
          });

          if (!quotaCheck.allowed) {
            console.log(`[Social Autopilot Cron] Tenant ${item.email} has exhausted monthly social posts (${quotaCheck.used}/${quotaCheck.quota}). Skipping.`);
            continue;
          }

          const { data: userCredit } = await supabase
            .from("credits")
            .select("credits_left")
            .ilike("email", item.email.toLowerCase())
            .maybeSingle();

          const balance = userCredit ? userCredit.credits_left : 1000;
          if (balance < 10) {
            console.warn(`[Social Autopilot Cron] Halting for ${item.email}: Insufficient internal credits (${balance} < 10 required).`);
            continue;
          }
        }

        // Fetch user's business profile for universal domain intelligence (Zero hardcoding)
        let clientIndustry = config.industry || "";
        let clientServices = "";
        let clientWebsite = "";
        let clientPhone = "";
        let clientContactMethod = "dm";

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
            clientWebsite = bAnswers.website || bAnswers.websiteUrl || parsedClient?.business_website || "";
            clientPhone = bAnswers.phone || bAnswers.business_phone || parsedClient?.business_phone || "";
            clientContactMethod = bAnswers.contact_method || (clientWebsite ? "website" : (clientPhone ? "phone" : "dm"));
          } catch (_) {}
        }

        // ── Service Roster: crawl actual WP site → AI synthesis → fallback ─────
        // Social planner has its OWN service roster, independent from SEO cron.
        // We look up the user's connected WP site URL to crawl for real services.
        const siteUrl = await fetchUserSiteUrl(item.email, config.businessName);
        const serviceRoster = await buildServiceRoster({
          config,
          userEmail: item.email,
          businessName: config.businessName || "Enterprise",
          industry: clientIndustry,
          clientServices,
          siteUrl,
        });
        // Cache roster into config (saved on publish)
        config.discoveredServices = serviceRoster;
        config.discoveredServicesAt = config.discoveredServicesAt || new Date().toISOString();

        // ── Strict Round-Robin (lastServiceIndex, NOT publishedCount) ───────────
        const { activeService, nextServiceIndex } = pickNextService(config, serviceRoster);

        // ── Pick next queued item OR generate a fresh unique topic ──────────────
        let nextItem = (config.queue || []).find((q) => q.status === "pending");
        let topic, hook;
        if (nextItem) {
          topic = nextItem.topic || `Practical insights for ${activeService}`;
          hook = nextItem.hook || `Excellence in ${activeService}`;
        } else {
          // Generate a truly unique, angle-aware social topic
          config.publishedTopics = Array.isArray(config.publishedTopics) ? config.publishedTopics : [];
          topic = await generateUniqueTopic({
            config,
            activeService,
            serviceRoster,
            businessName: config.businessName || "Enterprise",
            industry: clientIndustry,
            targetMarket: clientWebsite || "",
            contentType: "social",
          });
          hook = topic.length > 60 ? topic.slice(0, 57) + "..." : topic;
        }

        const businessName = config.businessName || "Enterprise";
        const service = activeService;

        // Build Agent State for Agency-Grade Creative Generation (Matches Dropdown Facebook/Instagram Quality)
        const agentState = {
          businessName,
          businessCategory: clientIndustry || config.industry || "Professional Business Solutions",
          context: {
            service,
            serviceLocked: true,
            offer: hook || "Special Consultation",
          },
          assets: {
            contactMethod: clientContactMethod,
            websiteUrl: clientWebsite,
            phone: clientPhone,
          },
        };

        // 1. Generate masterclass caption & visual mood
        let caption = "";
        let visualMood = "";
        let tagline = "";
        try {
          const captionData = await generateCaption(agentState);
          const fullHashtags = Array.isArray(captionData.hashtags) ? captionData.hashtags.join(" ") : "";
          caption = `${captionData.caption}\n\n${fullHashtags}`;
          visualMood = captionData.visualMood;
          tagline = captionData.tagline;
        } catch (capErr) {
          console.warn("[Social Cron] Gemini caption failed, fallback:", capErr.message);
          caption = `📢 ${hook.toUpperCase()}\n\n${topic}\n\nRunning a business means staying ahead of the curve. At ${businessName}, we help you turn complex digital challenges into predictable revenue.\n\n👉 Send us a message or visit our website to learn more!\n\n#${service.replace(/[^a-zA-Z0-9]/g, "")} #BusinessGrowth #Marketing #${businessName.replace(/[^a-zA-Z0-9]/g, "")}`;
        }

        // 2. Generate bespoke commercial 3D poster using gpt-image-2 (Agency Style)
        let imageUrl = "";
        let storageFileName = null;
        try {
          const imgRes = await generateImage(agentState, visualMood, tagline);
          imageUrl = imgRes.imageUrl;
          storageFileName = imgRes.storageFileName || null;
        } catch (imgErr) {
          console.warn("[Social Cron] generateImage failed, fallback to visual generator:", imgErr.message);
          const imagePrompt = `Award-winning commercial graphic design poster for social media advertising. Subject: "${service}" for brand "${businessName}". Theme: "${hook}: ${topic}". Sleek modern commercial studio lighting, vibrant colors, 3D geometric accents, high contrast, clean agency composition, pristine 4K quality, no text watermark.`;
          imageUrl = await generateSocialVisual(imagePrompt, service);
        }

        // 🛡️ Safety gate: if no image could be obtained from any source, skip publishing
        // (avoids false-positive history writes where post appears "published" but was never live)
        if (!imageUrl) {
          console.warn(`[Social Cron] All image sources exhausted for ${item.email}. Skipping this cycle to avoid silent failure.`);
          results.push({ email: item.email, business: businessName, status: "skipped", reason: "no_image" });
          continue;
        }

        // Execute Publishing based on destination: "BOTH" | "FACEBOOK_ONLY" | "INSTAGRAM_ONLY"
        const destination = config.destination || "BOTH";
        const publishedTo = {};

        // 1. Facebook Page Publish
        if (destination === "BOTH" || destination === "FACEBOOK_ONLY") {
          try {
            console.log(`[Social Cron] Publishing to Facebook for ${item.email}...`);
            const fbResult = await executeFacebookPost({
              userEmail: item.email,
              imageUrl,
              caption,
            });
            publishedTo.facebook = { ok: true, id: fbResult?.id || "posted" };
          } catch (fbErr) {
            console.error(`[Social Cron] Facebook publish error:`, fbErr.message);
            publishedTo.facebook = { ok: false, error: fbErr.message };
          }
        }

        // 2. Instagram Profile Publish
        if (destination === "BOTH" || destination === "INSTAGRAM_ONLY") {
          try {
            console.log(`[Social Cron] Publishing to Instagram for ${item.email}...`);
            const igResult = await executeInstagramPost({
              userEmail: item.email,
              imageUrl,
              caption,
            });
            publishedTo.instagram = { ok: true, id: igResult?.id || "posted" };
          } catch (igErr) {
            console.error(`[Social Cron] Instagram publish error:`, igErr.message);
            publishedTo.instagram = { ok: false, error: igErr.message };
          }
        }

        // ── STORAGE CLEANUP (Hosting Media Bridge & Supabase) ──
        if (imageUrl && imageUrl.includes("media_bridge/")) {
          try {
            await purgeFromMediaBridge({ url: imageUrl, userEmail: item.email });
            console.log(`[Social Cron] Automatically purged hosting Media Bridge image: ${imageUrl}`);
          } catch (mbCleanErr) {
            console.warn("[Social Cron] Media Bridge cleanup warning:", mbCleanErr.message);
          }
        }
        if (storageFileName) {
          try {
            await supabase.storage.from("instagram-creatives").remove([storageFileName]);
            console.log(`[Social Cron] Automatically cleaned up storage file: ${storageFileName}`);
          } catch (cleanErr) {
            console.warn("[Social Cron] Storage cleanup warning:", cleanErr.message);
          }
        }

        // 💳 Server-Side Atomic Credit Consumption: 10 credits for Social Post
        if (!isSuperAdmin) {
          try {
            const { data: cRow } = await supabase
              .from("credits")
              .select("credits_left")
              .ilike("email", item.email.toLowerCase())
              .maybeSingle();

            if (cRow) {
              const updatedCredits = Math.max(0, (cRow.credits_left || 0) - 10);
              await supabase
                .from("credits")
                .update({ credits_left: updatedCredits, updated_at: now.toISOString() })
                .ilike("email", item.email.toLowerCase());
              console.log(`[Social Cron] Debited 10 credits for ${item.email}. Balance: ${updatedCredits}`);
            }
          } catch (credDeductErr) {
            console.warn("[Social Cron] Credit deduction warning:", credDeductErr.message);
          }
        }

        // Update queue item status if this run came from the queue
        if (nextItem) {
          nextItem.status = "published";
          nextItem.publishedAt = now.toISOString();
          nextItem.publishedImageUrl = imageUrl;
          nextItem.publishedTo = publishedTo;
        }

        config.lastPublishedAt = now.toISOString();
        config.publishedCount = (config.publishedCount || 0) + 1;
        // Persist round-robin pointer so next run continues from next service
        config.lastServiceIndex = nextServiceIndex;
        // Track published topics for deduplication
        if (!Array.isArray(config.publishedTopics)) config.publishedTopics = [];
        if (!config.publishedTopics.includes(topic)) {
          config.publishedTopics.push(topic);
          if (config.publishedTopics.length > 50) config.publishedTopics = config.publishedTopics.slice(-50);
        }

        if (!Array.isArray(config.history)) config.history = [];
        config.history.unshift({
          date: now.toISOString(),
          topic,
          hook,
          service,
          imageUrl,
          destination,
          publishedTo,
        });

        // Keep last 50 history entries
        if (config.history.length > 50) config.history = config.history.slice(0, 50);

        await supabase
          .from("agent_memory")
          .update({
            content: JSON.stringify(config),
            updated_at: now.toISOString(),
          })
          .eq("email", item.email)
          .eq("memory_type", item.memory_type);

        results.push({
          email: item.email,
          business: businessName,
          status: "published",
          destination,
          imageUrl,
          publishedTo,
        });
      } catch (userErr) {
        console.error(`[Social Autopilot Cron] Error for ${item.email}:`, userErr.message);
        results.push({ email: item.email, status: "error", error: userErr.message });
      }
    }

    if (req.query?.force && results.length === 0) {
      return res.status(400).json({ ok: false, error: "No matching social configuration found to publish. Please open the planner to configure your settings." });
    }

    return res.status(200).json({ ok: true, executedCount: results.length, results });
  } catch (cronErr) {
    console.error("[Social Autopilot Cron] Fatal error:", cronErr);
    return res.status(500).json({ ok: false, error: cronErr.message });
  }
}

export const maxDuration = 300;

export const config = {
  maxDuration: 300,
};
