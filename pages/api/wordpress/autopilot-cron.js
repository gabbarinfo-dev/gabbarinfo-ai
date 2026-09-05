// pages/api/wordpress/autopilot-cron.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Allow secret key verification for secure cron invocation
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers["authorization"] !== `Bearer ${cronSecret}` && req.query?.secret !== cronSecret) {
    // In production cron, verify secret; allow manual trigger if development
    if (process.env.NODE_ENV === "production" && !req.query?.force) {
      return res.status(401).json({ ok: false, error: "Unauthorized cron trigger" });
    }
  }

  console.log(`[Autopilot Cron] Triggered autonomous daily 6:00 AM publishing cycle...`);

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
        if (!config.enabled) continue;

        console.log(`[Autopilot Cron] Processing daily cycle for ${item.email} (${config.businessName})...`);

        // Check when last published (ensure once per day)
        const lastPublished = config.lastPublishedAt ? new Date(config.lastPublishedAt) : null;
        const now = new Date();
        if (lastPublished && now - lastPublished < 20 * 60 * 60 * 1000 && !req.query?.force) {
          console.log(`[Autopilot Cron] Already published today for ${config.businessName}. Skipping.`);
          continue;
        }

        // Pick next topic
        const keywords = config.targetKeywords || ["Digital Marketing Strategies", "SEO Growth"];
        const randomKw = keywords[Math.floor(Math.random() * keywords.length)] || "Business Growth";
        const generatedTopic = `The Essential Guide to ${randomKw}: Proven Strategies That Drive Revenue in 2026`;

        // Invoke blog generation internal API
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ai.gabbarinfo.com";
        const genRes = await fetch(`${baseUrl}/api/wordpress/generate-blog`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userEmail: item.email,
            businessName: config.businessName || "GABBARinfo",
            topic: generatedTopic,
            targetKeywords: keywords,
            wordCount: config.wordCount || 1200,
            brandVoice: config.brandVoice || "consultative and results-oriented",
            industry: config.industry || "Business",
            publishStatus: "publish",
          }),
        });

        const genData = await genRes.json();

        if (genData?.ok) {
          // Update lastPublishedAt
          config.lastPublishedAt = new Date().toISOString();
          config.publishedCount = (config.publishedCount || 0) + 1;
          await supabase.from("agent_memory").update({
            content: JSON.stringify(config),
            updated_at: new Date().toISOString(),
          }).eq("email", item.email).eq("memory_type", item.memory_type);

          results.push({
            email: item.email,
            business: config.businessName,
            status: "published",
            url: genData.post_url,
          });
        } else {
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
