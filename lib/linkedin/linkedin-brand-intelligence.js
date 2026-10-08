// lib/linkedin/linkedin-brand-intelligence.js
import { crawlWebsiteHomepage } from "../wordpress/site-intelligence.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseServer } from "../supabaseServer.js";

export const LINKEDIN_CONTENT_PILLARS = [
  { id: "thought_leadership", label: "Thought Leadership & Vision", icon: "💡" },
  { id: "service_spotlight", label: "Service Spotlight & Execution", icon: "🔍" },
  { id: "case_study_win", label: "Problem-Solution & Case Breakdown", icon: "📈" },
  { id: "myth_busting", label: "Industry Myth-Busting & Hard Truths", icon: "⚡" },
  { id: "actionable_playbook", label: "Actionable Frameworks & Playbooks", icon: "🛠️" },
  { id: "community_discussion", label: "B2B Perspective & Debate", icon: "💬" },
];

/**
 * Deep crawls a business website and formulates authentic services,
 * target audience profiles, and 30 unique, non-repeating LinkedIn editorial topics.
 */
export async function extractAndStoreLinkedInBrandIntel({ email, websiteUrl, brandName = "Business" }) {
  if (!email) throw new Error("Email is required for brand intelligence.");

  let siteData = null;
  if (websiteUrl && typeof websiteUrl === "string" && websiteUrl.startsWith("http")) {
    try {
      siteData = await crawlWebsiteHomepage(websiteUrl);
    } catch (e) {
      console.warn("[LinkedIn Brand Intel] Crawl error:", e.message);
    }
  }

  const rawContext = siteData
    ? `Site Title: ${siteData.title}\nMeta Description: ${siteData.metaDescription}\nHeadings: ${(siteData.headings || []).slice(0, 10).join(" | ")}\nContent Snippet: ${(siteData.bodyText || "").slice(0, 1800)}`
    : `Brand Name: ${brandName}\nWebsite: ${websiteUrl || "Not specified"}`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key is not configured.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const extractionPrompt = `You are GabbarInfo AI's Senior B2B Intelligence Architect.
Analyze the following company data and produce a comprehensive, structured profile for their LinkedIn B2B Presence:
${rawContext}

You MUST return a strictly valid JSON object (no markdown code blocks, no other text) with the following exact keys:
{
  "brandName": "Exact Brand / Company Name",
  "industry": "Industry / Niche (e.g. IT Consulting, Legal, SaaS, Digital Agency)",
  "tagline": "A punchy, professional 1-sentence value proposition",
  "targetAudience": "Specific B2B decision makers they target (e.g. CTOs, SMB Founders, CMOs)",
  "services": ["Service 1", "Service 2", "Service 3", "Service 4", "Service 5"],
  "topics": [
    {
      "id": 1,
      "pillar": "thought_leadership",
      "hook": "Strong 1-line hook",
      "topic": "Comprehensive topic description tailored to their specific services",
      "targetService": "Specific service from above list"
    }
    // EXACTLY 30 unique, high-value non-repeating topics. Rotate across the 6 pillars (thought_leadership, service_spotlight, case_study_win, myth_busting, actionable_playbook, community_discussion). Ensure ZERO repetition in topic angles.
  ]
}`;

  const aiRes = await model.generateContent(extractionPrompt);
  const rawText = aiRes?.response?.text()?.trim() || "";

  let cleanedJson = rawText;
  if (cleanedJson.startsWith("```")) {
    cleanedJson = cleanedJson.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/, "").trim();
  }

  let parsed = null;
  try {
    parsed = JSON.parse(cleanedJson);
  } catch (err) {
    console.error("[LinkedIn Brand Intel JSON Parse Error]:", rawText.slice(0, 300));
    throw new Error("Failed to parse structured intelligence from AI.");
  }

  // Enrich topics with status and timestamps
  const now = Date.now();
  const enrichedTopics = (parsed.topics || []).map((t, idx) => ({
    id: idx + 1,
    pillar: t.pillar || "thought_leadership",
    hook: t.hook || "Key B2B Insight",
    topic: t.topic || `Strategic insights on ${parsed.brandName}`,
    targetService: t.targetService || (parsed.services?.[0] || "Core Service"),
    status: idx === 0 ? "next" : "queued", // 'next' | 'queued' | 'published'
    scheduledDay: idx + 1,
  }));

  const brandIntelRecord = {
    brandName: parsed.brandName || brandName,
    websiteUrl: websiteUrl || siteData?.siteUrl || null,
    industry: parsed.industry || "B2B Business",
    tagline: parsed.tagline || "",
    targetAudience: parsed.targetAudience || "Business Leaders & Decision Makers",
    services: parsed.services || ["Core Professional Services"],
    topicsQueue: enrichedTopics,
    crawledAt: new Date(now).toISOString(),
    publishedTopicCount: 0,
  };

  // Upsert to Supabase agent_memory
  await supabaseServer.from("agent_memory").upsert(
    {
      email: email.toLowerCase(),
      memory_type: "linkedin_brand_intel",
      content: JSON.stringify(brandIntelRecord),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email,memory_type" }
  );

  return brandIntelRecord;
}
