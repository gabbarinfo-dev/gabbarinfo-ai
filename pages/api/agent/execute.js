// pages/api/agent/execute.js

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

let genAI = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
} else {
  console.warn("⚠ GEMINI_API_KEY is not set. /api/agent/execute will not work for agent mode.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed." });
  }

  try {
    const body = req.body || {};

    // ---------------------------
    // 0) REQUIRE SESSION (for everything)
    // ---------------------------
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }

    // ============================================================
    // 1) LEGACY ROUTER MODE (your existing behaviour)
    // ============================================================
    //
    // If the caller sends a "type" field (your old design),
    // we keep that behaviour exactly so nothing breaks.
    //
    // type: "google_ads_campaign"  -> forwards to /api/google-ads/create-simple-campaign
    // type: "meta_ads_creative"    -> forwards to /api/ads/create-creative
    //
    if (body.type) {
      // old behaviour path
      if (body.type === "google_ads_campaign") {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        if (!baseUrl) {
          return res.status(500).json({
            ok: false,
            message:
              "NEXT_PUBLIC_BASE_URL is not set. Cannot forward to google-ads endpoint.",
          });
        }

        const gaRes = await fetch(
          `${baseUrl}/api/google-ads/create-simple-campaign`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body.data || {}),
          }
        );

        let gaJson = {};
        try {
          gaJson = await gaRes.json();
        } catch (_) {
          gaJson = { raw: await gaRes.text() };
        }

        return res.status(200).json({
          ok: true,
          mode: "router_legacy",
          forwardedTo: "google_ads",
          status: gaRes.status,
          response: gaJson,
        });
      }

      if (body.type === "meta_ads_creative") {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        if (!baseUrl) {
          return res.status(500).json({
            ok: false,
            message:
              "NEXT_PUBLIC_BASE_URL is not set. Cannot forward to ads/create-creative.",
          });
        }

        const metaRes = await fetch(`${baseUrl}/api/ads/create-creative`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body.data || {}),
        });

        let metaJson = {};
        try {
          metaJson = await metaRes.json();
        } catch (_) {
          metaJson = { raw: await metaRes.text() };
        }

        return res.status(200).json({
          ok: true,
          mode: "router_legacy",
          forwardedTo: "creative_service",
          status: metaRes.status,
          response: metaJson,
        });
      }

      return res.status(400).json({
        ok: false,
        message:
          "Unknown type in legacy mode. Expected google_ads_campaign or meta_ads_creative.",
      });
    }

    // ============================================================
    // 2) NEW "AGENT MODE" – THINKING + JSON GENERATION VIA GEMINI
    // ============================================================

    if (!genAI) {
      return res.status(500).json({
        ok: false,
        message: "GEMINI_API_KEY not configured for agent mode.",
      });
    }

    const {
      instruction,          // main natural language instruction
      mode = "generic",     // "google_ads_plan" | "meta_ads_plan" | "social_plan" | "seo_blog" | "generic"
      includeJson = false,  // whether caller expects clean JSON-only when asked
      chatHistory = [],     // optional history from chat.js (array of { role, text })
      extraContext = "",    // place for RAG / client profile later
    } = body;

    if (!instruction || typeof instruction !== "string") {
      return res.status(400).json({
        ok: false,
        message: "Missing 'instruction' (string) for agent mode.",
      });
    }

    // Build compact history string
    const historyText = Array.isArray(chatHistory)
      ? chatHistory
          .slice(-20)
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
          .join("\n\n")
      : "";

    // ---------- MODE-SPECIFIC FOCUS ----------
    let modeFocus = "";

    if (mode === "google_ads_plan") {
      modeFocus = `
You are in GOOGLE ADS AGENT MODE.

- Focus on campaign structures, ad groups, keywords, match types, budgets.
- When the user clearly asks for "JSON" or "backend JSON" for a Google Ads campaign,
  you MUST output ONLY the JSON using this exact schema:

{
  "customerId": "1234567890",
  "campaign": {
    "name": "GabbarInfo - Leads - CityName",
    "status": "PAUSED",
    "objective": "LEAD_GENERATION",
    "network": "SEARCH",
    "dailyBudgetMicros": 50000000,
    "startDate": "2025-12-10",
    "endDate": null,
    "finalUrl": "https://client-website.com"
  },
  "adGroups": [
    {
      "name": "Ad Group Name",
      "cpcBidMicros": 2000000,
      "keywords": [
        "keyword one",
        "keyword two"
      ],
      "ads": [
        {
          "headline1": "Headline 1",
          "headline2": "Headline 2",
          "headline3": "Headline 3",
          "description1": "Description line 1",
          "description2": "Description line 2",
          "path1": "path-one",
          "path2": "path-two"
        }
      ]
    }
  ]
}

- When you output JSON-only, do NOT wrap it in backticks, and add no extra text.
`;
    } else if (mode === "meta_ads_plan") {
      modeFocus = `
You are in META ADS / CREATIVE AGENT MODE.

- Focus on Meta (Facebook + Instagram) campaign structure and creatives.
- When the user clearly asks for "creative JSON" or "backend creative JSON",
  you MUST output ONLY the JSON using this exact schema:

{
  "channel": "meta_ads",
  "platform": "facebook",
  "format": "feed_image",
  "objective": "LEAD_GENERATION",
  "creative": {
    "imagePrompt": "a modern clinic exterior at dusk, vibrant lighting, professional photographer, high resolution",
    "headline": "Best Dental Clinic in Mumbai – Book Now",
    "primaryText": "Trusted by 5000+ patients. Painless treatments and easy online booking.",
    "callToAction": "Book Now",
    "landingPage": "https://client-website.com"
  },
  "metadata": {
    "targetCountry": "IN",
    "targetLanguages": ["en", "hi"],
    "adAccountId": "1234567890",
    "campaignName": "Dentist Clinic – Mumbai – Jan 2026"
  }
}

- When you output JSON-only, do NOT wrap it in backticks, and add no extra text.
`;
    } else if (mode === "social_plan") {
      modeFocus = `
You are in SOCIAL MEDIA PLANNER MODE.

- Focus on Instagram, Facebook, LinkedIn, YouTube content calendars.
- Give hooks, caption ideas, posting frequency and content pillars.
- Tie everything back to leads, sales or brand-building.
`;
    } else if (mode === "seo_blog") {
      modeFocus = `
You are in SEO / BLOG AGENT MODE.

- Focus on keyword ideas, blog topics, outlines and SEO-optimised articles.
- Use simple, clear language and structure the blog logically for humans + Google.
`;
    } else {
      modeFocus = `
You are in GENERIC DIGITAL MARKETING AGENT MODE.

- You can combine Google Ads, Meta Ads, SEO, content and social together.
- If the user explicitly asks for backend JSON, follow the exact schemas:
  - Google Ads JSON for campaigns.
  - Creative JSON for Meta/social creatives.
`;
    }

    const systemPrompt = `
You are GabbarInfo AI – a senior digital marketing strategist and backend AGENT.

Your job:
- Understand the user's instruction.
- Decide what they actually need (Google Ads plan, Meta ads creative, social calendar, SEO/blog, or a mix).
- Produce either:
  - A clear, step-by-step strategy/plan, OR
  - Valid backend JSON payloads (ONLY when the user explicitly asks for JSON).

Rules:
- NEVER claim that you already executed actions in Google Ads, Meta, LinkedIn or WordPress.
- When you give JSON, strictly follow the schemas described.
- When you give a plan, be complete and practical (no half-finished steps).
- Assume the user is in India by default unless location is specified.

${modeFocus}

Extra context (may be empty, can be used later for RAG / client profile):
${extraContext || "(none)"}
`.trim();

    const finalPrompt = `
SYSTEM:
${systemPrompt}

HISTORY (optional, last turns):
${historyText || "(no prior messages)"}

USER INSTRUCTION:
${instruction}

Caller hint:
- includeJson = ${includeJson}

If the user clearly asked for BACKEND JSON ONLY
(and includeJson is true), respond with JSON only (no backticks, no explanation).
Otherwise, respond with a full, clear explanation, and include example JSON only if helpful.
`.trim();

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: finalPrompt }],
        },
      ],
    });

    const text =
      (result &&
        result.response &&
        typeof result.response.text === "function" &&
        result.response.text()) ||
      "";

    return res.status(200).json({
      ok: true,
      mode,
      text,
    });
  } catch (err) {
    console.error("Agent execution error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error in /api/agent/execute",
      error: err.message || String(err),
    });
  }
}
