// pages/api/social/autopilot-config.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseServer } from "../../../lib/supabaseServer.js";
import { executeFacebookPost } from "../../../lib/execute-facebook-post.js";
import { executeInstagramPost } from "../../../lib/execute-instagram-post.js";
import { generateImage } from "../../../lib/instagram/generate-image.js";
import { generateCaption } from "../../../lib/instagram/generate-caption.js";
import OpenAI from "openai";

const supabase = supabaseServer;

async function generateSocialVisual(prompt, label = "social") {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const openai = new OpenAI({ apiKey });
      const modelToUse = process.env.OPENAI_IMAGE_MODEL || "dall-e-3";
      console.log(`[Social Autopilot] Generating visual with OpenAI (${modelToUse})...`);

      let response;
      try {
        response = await openai.images.generate({
          model: modelToUse,
          prompt,
          size: "1024x1024",
        });
      } catch (err) {
        console.warn(`[Social Autopilot] Primary model failed, trying dall-e-2:`, err.message);
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
      console.warn("[Social Autopilot] OpenAI visual generation error:", e.message);
    }
  }

  // Pollinations reliable high-speed fallback
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
    console.warn("[Social Autopilot] Pollinations fallback error:", pollErr.message);
  }

  return "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1024&q=80";
}

// 5 Core Marketing Pillars for high engagement & conversion
const CONTENT_PILLARS = [
  { id: "educational_tips", name: "Actionable Tips & How-To", badge: "💡 Expert Tip" },
  { id: "service_spotlight", name: "Service Spotlight & Direct Offer", badge: "🎯 Special Offer" },
  { id: "myth_busting", name: "Myth-Busting & Authority Secrets", badge: "🔍 Myth vs Fact" },
  { id: "problem_solution", name: "Problem-Solution & Quick Case Story", badge: "📈 Growth Win" },
  { id: "interactive_poll", name: "Interactive & Engagement Hook", badge: "💬 Community Question" }
];

function buildFallbackQueue(services = [], businessName = "Our Business", count = 30) {
  const cleanServices = services.length > 0 ? services : ["Digital Growth", "Online Visibility", "Client Acquisition", "Brand Authority"];
  const queue = [];

  const baseTemplates = [
    { pillar: "educational_tips", hook: "3 Essential Strategies Most Businesses Miss", template: "How to Optimize Your {service} for Maximum ROI" },
    { pillar: "service_spotlight", hook: "Ready to Scale Your Growth?", template: "Why Our {service} Delivers 3x Better Results for Clients" },
    { pillar: "myth_busting", hook: "The Biggest Lie in the Industry", template: "Myth vs Reality: What Really Drives Success in {service}" },
    { pillar: "problem_solution", hook: "Stop Losing Inquiries to Competitors", template: "How We Solved Common Bottlenecks in {service} for Growth" },
    { pillar: "interactive_poll", hook: "We Want to Hear From You", template: "What Is Your #1 Biggest Hurdle in {service} Right Now?" }
  ];

  const now = new Date();
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

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.body?.userEmail || req.query?.userEmail;

  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const normalizedEmail = userEmail.toLowerCase().trim();
  const autoMemoryKey = `social_autopilot_${normalizedEmail}`;

  // ================================================================
  // GET: Fetch Autopilot Config, Queue, and Meta Connection Info
  // ================================================================
  if (req.method === "GET") {
    try {
      // 1. Check Meta Connection using exact robust query matching status.js
      const { data: meta, error: metaErr } = await supabase
        .from("meta_connections")
        .select("*")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (metaErr) {
        console.warn("[Social Autopilot] meta_connections query warning:", metaErr.message);
      }

      // Check Facebook connection (page ID or business ID present)
      const hasFacebook = Boolean(meta?.fb_page_id || meta?.fb_business_id);
      // Check Instagram connection (ig_business_id or instagram_actor_id present)
      const hasInstagram = Boolean(meta?.ig_business_id || meta?.instagram_actor_id);

      // 2. Fetch Autopilot Config from agent_memory
      const { data: mem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", normalizedEmail)
        .eq("memory_type", autoMemoryKey)
        .maybeSingle();

      const isOwner = normalizedEmail === "ndantare@gmail.com" || session?.user?.role === "owner" || session?.user?.role === "admin";

      let config = {
        enabled: false,
        destination: hasFacebook && !hasInstagram ? "FACEBOOK_ONLY" : "BOTH", // sensible default based on connection
        cadence: "daily", // "daily" | "weekly_4" | "alternate" | "weekly"
        businessName: meta?.business_name || "GabbarInfo",
        industry: meta?.business_category || "Digital Marketing & Business Growth",
        services: ["SEO Optimization", "Google Ads Management", "Meta Social Ads", "Website Design"],
        brandVoice: "Bold, authoritative, and consultative",
        targetAudience: "Business owners, entrepreneurs, and eCommerce brands",
        queue: [],
        publishedCount: 0,
        testPostsUsed: 0,
        lastPublishedAt: null,
        history: []
      };

      if (mem?.content) {
        try {
          const parsed = JSON.parse(mem.content);
          config = { ...config, ...parsed };
        } catch (e) {
          console.warn("[Social Autopilot] Failed to parse existing memory:", e.message);
        }
      }

      // If queue is empty, initialize fallback queue
      if (!config.queue || config.queue.length === 0) {
        config.queue = buildFallbackQueue(config.services, config.businessName, 30);
      }

      // Resolve Instagram username via Graph API (matching Instagram Insights)
      let igUsername = null;
      if (hasInstagram && meta?.ig_business_id) {
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
        igUsername = meta?.business_name ? meta.business_name.toLowerCase().replace(/[^a-z0-9_.]/g, "") : `ID: ${meta?.ig_business_id || meta?.instagram_actor_id}`;
      }

      return res.status(200).json({
        ok: true,
        config,
        isOwner,
        hasFacebook,
        hasInstagram,
        fbPageName: meta?.business_name || (meta?.fb_page_id ? `Page ID: ${meta.fb_page_id}` : null),
        igUsername,
        metaInfo: {
          businessId: meta?.fb_business_id || null,
          pageId: meta?.fb_page_id || null,
          adAccountId: meta?.fb_ad_account_id || null,
          igBusinessId: meta?.ig_business_id || null,
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
        const merged = {
          ...current,
          ...updatedConfig,
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

        return res.status(200).json({ ok: true, message: "Autopilot configuration saved.", config: merged });
      }

      // ── ACTION: GENERATE FULL 30-DAY QUEUE (AI SYNTHESIS) ──
      if (action === "generate-queue") {
        const businessName = updatedConfig?.businessName || current.businessName || "Our Business";
        const industry = updatedConfig?.industry || current.industry || "Professional Business";
        const services = updatedConfig?.services || current.services || ["Core Services", "Client Solutions"];
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
- Core Services: ${services.join(", ")}

CONTENT PILLARS TO CYCLE (Rotate through these 5 pillars strictly):
1. "educational_tips": High-value, actionable "How-To" tip or secret that saves/shares.
2. "service_spotlight": Compelling benefit-driven spotlight on one specific service with a clear CTA/offer.
3. "myth_busting": Bold myth vs reality breaking industry misconceptions.
4. "problem_solution": Real problem clients face and the smart solution framework.
5. "interactive_poll": Engaging question or debate prompt that drives comments.

RULES:
- Zero repetition! Every topic must have a distinct angle and hook.
- Create exactly ${count} posts.
- Output ONLY valid JSON array matching this schema:
[
  {
    "day": 1,
    "pillar": "educational_tips",
    "service": "Service Name",
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
                  hook: item.hook || "Growth Insights",
                  topic: item.topic || "Practical strategies for scale",
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
          aiQueue = buildFallbackQueue(services, businessName, count);
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
        const services = current.services || ["Digital Solutions"];
        const s = target.service || services[Math.floor(Math.random() * services.length)];
        const pillar = target.pillar || "educational_tips";

        let newTopic = `Fresh strategies and masterclass insights for ${s} that drive results`;
        let newHook = `Proven Tips for ${s}`;

        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
          try {
            const openai = new OpenAI({ apiKey });
            const prompt = `Generate 1 fresh, highly viral social media topic for "${current.businessName || "Our Business"}".
Service: "${s}"
Pillar: "${pillar}"
Respond ONLY in JSON: { "hook": "short catchy hook (4-7 words)", "topic": "specific topic angle" }`;

            const resp = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              response_format: { type: "json_object" }
            });
            const p = JSON.parse(resp.choices[0]?.message?.content || "{}");
            if (p.topic) newTopic = p.topic;
            if (p.hook) newHook = p.hook;
          } catch (e) {}
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

        // Free Test Post Limitation Check
        const isOwner = normalizedEmail === "ndantare@gmail.com" || session?.user?.role === "owner" || session?.user?.role === "admin";
        const testPostsUsed = current.testPostsUsed || 0;

        if (!isOwner && testPostsUsed >= 1) {
          return res.status(403).json({
            ok: false,
            error: "You have already used your 1 free test post. Please turn ON Autopilot for scheduled daily automated publishing!",
            limitReached: true,
          });
        }

        // Check Meta Connection
        const { data: meta } = await supabase
          .from("meta_connections")
          .select("*")
          .ilike("email", normalizedEmail)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const hasFacebook = Boolean(meta?.fb_page_id || meta?.fb_business_id || process.env.FB_PAGE_ID);
        const hasInstagram = Boolean(meta?.ig_business_id || meta?.instagram_actor_id);

        // Ensure queue exists
        let queue = Array.isArray(current.queue) && current.queue.length > 0
          ? current.queue
          : buildFallbackQueue(current.services || ["Business Growth"], current.businessName || meta?.business_name || "GabbarInfo", 30);

        // Pick next pending item or first item
        let nextIndex = queue.findIndex(q => q.status === "pending");
        if (nextIndex === -1) nextIndex = 0;
        const targetItem = { ...queue[nextIndex] };

        const businessName = current.businessName || meta?.business_name || "GabbarInfo";
        const service = targetItem.service || (current.services && current.services[0]) || "Business Growth";
        const topic = targetItem.topic || "Practical tips for business growth";
        const hook = targetItem.hook || "Growth Insights";

        // Build Agent State for Agency-Grade Creative Generation (Matches Dropdown Facebook/Instagram Quality)
        const agentState = {
          businessName,
          businessCategory: current.industry || meta?.business_category || "Digital Marketing & Business Growth",
          context: {
            service,
            serviceLocked: true,
            offer: targetItem.hook || "Special Offer",
          },
          assets: {
            contactMethod: "dm",
            websiteUrl: meta?.business_website || "gabbarinfo.com",
            phone: meta?.business_phone || "+91 97239 27645",
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
          return res.status(400).json({ ok: false, error: errors || "Publishing to designated destination failed." });
        }

        // ── AUTOMATIC STORAGE CLEANUP ──
        // Once successfully published to Meta CDN, delete temporary image from Supabase storage
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
