// pages/api/wordpress/suggest-topics.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import { getOrDiscoverSiteIntelligence } from "../../../lib/wordpress/site-intelligence.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userEmail = session?.user?.email || req.body?.userEmail;

  if (!userEmail) {
    return res.status(401).json({ ok: false, error: "Unauthorized: User session required" });
  }

  const {
    businessName = "",
    siteUrl: rawSiteUrl = "",
    targetMarket = "",
    keywords = [],
    existingTitles = [],
    refresh = false,
  } = req.body || {};

  let siteUrl = rawSiteUrl;
  let effectiveBusiness = businessName;

  // If siteUrl not provided, look up in agent_memory for this business
  if (!siteUrl) {
    const normBiz = (businessName || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "_");
    const memKey = normBiz ? `wp_conn_${normBiz}` : null;

    let targetMem = null;
    if (memKey) {
      const { data: mem } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", userEmail.toLowerCase())
        .eq("memory_type", memKey)
        .maybeSingle();
      targetMem = mem;
    }

    if (!targetMem?.content) {
      const { data: fallbackMem } = await supabase
        .from("agent_memory")
        .select("content, memory_type")
        .eq("email", userEmail.toLowerCase())
        .like("memory_type", "wp_conn_%")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      targetMem = fallbackMem;
    }

    if (targetMem?.content) {
      try {
        const parsed = JSON.parse(targetMem.content);
        siteUrl = parsed.siteUrl || "";
        if (!effectiveBusiness) {
          effectiveBusiness = parsed.businessName || parsed.siteName || "";
        }
      } catch (_) {}
    }
  }

  if (!siteUrl) {
    return res.status(400).json({
      ok: false,
      error: "No website URL provided or found. Please connect your WordPress website first.",
    });
  }

  try {
    const intelligence = await getOrDiscoverSiteIntelligence({
      userEmail,
      businessName: effectiveBusiness,
      siteUrl,
      forceRefresh: Boolean(refresh),
      targetMarket,
      targetKeywords: Array.isArray(keywords) ? keywords : (typeof keywords === "string" ? keywords.split(/[,;\n]+/) : []),
      existingTitles: Array.isArray(existingTitles) ? existingTitles : [],
    });

    return res.status(200).json({
      ok: true,
      brandName: intelligence.brandName,
      industry: intelligence.industry,
      nicheSummary: intelligence.nicheSummary,
      targetKeywords: intelligence.targetKeywords || [],
      services: intelligence.coreOfferings || [],
      topics: intelligence.suggestedTopics || [],
      fromCache: intelligence.fromCache,
    });
  } catch (err) {
    console.error("[SuggestTopics Error]:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
