// pages/api/social/autopilot-cron.js
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { executeFacebookPost } from "../../../lib/execute-facebook-post";
import { executeInstagramPost } from "../../../lib/execute-instagram-post";

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
      const modelToUse = process.env.OPENAI_IMAGE_MODEL || "dall-e-3";
      console.log(`[Social Cron] Generating visual with OpenAI (${modelToUse})...`);

      let response;
      try {
        response = await openai.images.generate({
          model: modelToUse,
          prompt,
          size: "1024x1024",
        });
      } catch (err) {
        console.warn(`[Social Cron] Primary model failed, trying fallback:`, err.message);
        response = await openai.images.generate({
          model: "dall-e-2",
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
        const fileName = `social_ai_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("instagram-creatives")
          .upload(fileName, imgBuffer, { contentType: "image/png", upsert: true });

        if (!uploadErr && uploadData) {
          const { data: pubUrl } = supabase.storage.from("instagram-creatives").getPublicUrl(fileName);
          return pubUrl.publicUrl;
        }
      }
    } catch (e) {
      console.warn("[Social Cron] OpenAI visual generation error:", e.message);
    }
  }

  // Pollinations high-speed fallback
  try {
    const encoded = encodeURIComponent(prompt);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
    const pollRes = await fetch(pollinationsUrl);
    if (pollRes.ok) {
      const pollBuf = Buffer.from(await pollRes.arrayBuffer());
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
    return pollinationsUrl;
  } catch (pollErr) {
    console.warn("[Social Cron] Pollinations fallback error:", pollErr.message);
  }

  return "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1024&q=80";
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers["authorization"] !== `Bearer ${cronSecret}` && req.query?.secret !== cronSecret) {
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
        const config = JSON.parse(item.content);
        if (!config.enabled && !req.query?.force) continue;

        // Specific single-user trigger override
        if (req.query?.email && req.query.email.toLowerCase() !== item.email.toLowerCase()) {
          continue;
        }

        console.log(`[Social Autopilot Cron] Processing for ${item.email} (${config.businessName})...`);

        // Check Cadence Velocity
        const lastPublished = config.lastPublishedAt ? new Date(config.lastPublishedAt) : null;
        const now = new Date();
        const cadence = config.cadence || "daily";

        let minIntervalMs = 20 * 60 * 60 * 1000; // ~20 hours for daily
        if (cadence === "alternate" || cadence === "weekly_4") {
          minIntervalMs = 40 * 60 * 60 * 1000; // ~40 hours
        } else if (cadence === "weekly") {
          minIntervalMs = 6 * 24 * 60 * 60 * 1000; // ~6 days
        }

        if (lastPublished && now - lastPublished < minIntervalMs && !req.query?.force) {
          console.log(`[Social Autopilot Cron] Cadence threshold not reached for ${config.businessName}. Skipping.`);
          continue;
        }

        // Pick next topic from queue
        let nextItem = (config.queue || []).find((q) => q.status === "pending");
        if (!nextItem) {
          const s = (config.services && config.services[0]) || "Business Growth";
          nextItem = {
            day: (config.publishedCount || 0) + 1,
            pillar: "educational_tips",
            service: s,
            hook: "Essential Strategies for Fast Growth",
            topic: `How to scale your ${s} with modern marketing strategies in 2026`,
            status: "pending",
          };
        }

        const businessName = config.businessName || "GabbarInfo";
        const service = nextItem.service || "Services";
        const topic = nextItem.topic || "Practical tips for business growth";
        const hook = nextItem.hook || "Growth Insights";

        // Generate Graphic Art Prompt
        const imagePrompt = `Award-winning commercial graphic design poster for social media advertising. Subject: "${service}" for brand "${businessName}". Theme: "${hook}: ${topic}". Sleek modern commercial studio lighting, vibrant colors, 3D geometric accents, high contrast, clean agency composition, pristine 4K quality, no text watermark.`;

        const imageUrl = await generateSocialVisual(imagePrompt);
        if (!imageUrl) {
          throw new Error("Failed to synthesize graphic visual image.");
        }

        // Generate Persuasive Caption & Hashtags
        let caption = `📢 ${hook.toUpperCase()}\n\n${topic}\n\nRunning a business means staying ahead of the curve. At ${businessName}, we help you turn complex digital challenges into predictable revenue.\n\n👉 Send us a message or visit our website to learn more!\n\n#${service.replace(/[^a-zA-Z0-9]/g, "")} #BusinessGrowth #Marketing #Entrepreneurship #${businessName.replace(/[^a-zA-Z0-9]/g, "")}`;

        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
          try {
            const openai = new OpenAI({ apiKey });
            const capResp = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: "You are a master social media copywriter. Write a punchy, highly engaging caption for Instagram and Facebook with a strong hook, value explanation, bullet points, call to action, and 7-9 relevant hashtags.",
                },
                {
                  role: "user",
                  content: `Business: ${businessName}\nService: ${service}\nHook: ${hook}\nTopic: ${topic}`,
                },
              ],
            });
            if (capResp.choices[0]?.message?.content) {
              caption = capResp.choices[0].message.content.trim();
            }
          } catch (capErr) {
            console.warn("[Social Cron] AI caption generation failed, using structured copy:", capErr.message);
          }
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

        // Update queue item status & state in memory
        nextItem.status = "published";
        nextItem.publishedAt = now.toISOString();
        nextItem.publishedImageUrl = imageUrl;
        nextItem.publishedTo = publishedTo;

        config.lastPublishedAt = now.toISOString();
        config.publishedCount = (config.publishedCount || 0) + 1;

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

export const config = {
  maxDuration: 60,
};
