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

async function saveAnswerMemory(baseUrl, business_id, answers) {
  await fetch(`${baseUrl}/api/agent/answer-memory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      business_id,
      answers,
    }),
  });
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
// 🔗 META CONNECTION CHECK (Supabase)
// ============================================================
let metaConnected = false;
let activeBusinessId = null;

try {
  const { data: metaRow } = await supabase
    .from("meta_connections")
    .select("*")
    .eq("email", session.user.email.toLowerCase())
    .single();

  if (metaRow && metaRow.system_user_token) {
    metaConnected = true;
    activeBusinessId =
      metaRow.fb_business_id ||
      metaRow.fb_page_id ||
      metaRow.ig_business_id ||
      null;
  }
} catch (e) {
  console.warn("Meta connection lookup failed:", e.message);
}
    // ============================================================
// 🧠 AUTO BUSINESS INTAKE (RUN EVERY TIME)
// ============================================================
try {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (baseUrl) {
    await fetch(`${baseUrl}/api/agent/intake-business`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  }
} catch (e) {
  console.warn("Auto business intake failed:", e.message);
}

 // ✅ ADD HERE (THIS IS THE RIGHT PLACE)
    const ADMIN_EMAILS = ["ndantare@gmail.com"];
    const isAdmin = ADMIN_EMAILS.includes(
      (session.user.email || "").toLowerCase()
    );
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
// ============================================================
// 🎨 CREATIVE GENERATION (AFTER COPY CONFIRMATION)
// ============================================================

let imageHash = null;

// 1️⃣ Generate image via OpenAI
const imageResp = await fetch(
  `${process.env.NEXT_PUBLIC_BASE_URL}/api/images/generate`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: body.data?.creative?.imagePrompt,
    }),
  }
);

const imageJson = await imageResp.json();
if (!imageJson?.ok || !imageJson.imageBase64) {
  throw new Error("Image generation failed");
}

// 2️⃣ Upload image directly to Meta
const uploadResp = await fetch(
  `${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/upload-image`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64: imageJson.imageBase64,
    }),
  }
);

const uploadJson = await uploadResp.json();
if (!uploadJson?.ok || !uploadJson.image_hash) {
  throw new Error("Meta image upload failed");
}

imageHash = uploadJson.image_hash;

        const metaRes = await fetch(`${baseUrl}/api/ads/create-creative`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
  ...body.data,
  creative: {
    ...body.data.creative,
    imageHash, // 👈 THIS IS WHERE IT GOES
  },
}),
}); // ✅ THIS WAS MISSING
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
    let ragContext = "";
// ===============================
// 🔗 RAG FETCH (CLIENT MEMORY)
// ===============================
try {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (baseUrl) {
    const ragRes = await fetch(`${baseUrl}/api/rag/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: instruction,
        memory_type: session.user?.role === "client" ? "client" : "global",
        client_email: session.user?.email || null,
        top_k: 5,
      }),
    });

    const ragJson = await ragRes.json();

    if (ragJson?.chunks?.length) {
      ragContext = ragJson.chunks
        .map((c, i) => `(${i + 1}) ${c.content}`)
        .join("\n\n");
    }
  }
} catch (e) {
  console.warn("RAG fetch failed:", e.message);
}
// ===============================
// 🔐 SAFETY GATE — BUSINESS + BUDGET CONFIRMATION
// ===============================
let safetyGateMessage = null;

try {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (baseUrl) {
    const memRes = await fetch(`${baseUrl}/api/rag/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "business_profile",
        memory_type: "client",
        client_email: session.user.email,
        top_k: 3,
      }),
    });

    const memJson = await memRes.json();

    const profiles = (memJson?.chunks || [])
      .map((c) => {
        try {
          return JSON.parse(c.content)?.business_profile;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

  // 🚫 No business at all (RAG OR META)
// Admin / Owner bypass
if (!isAdmin && !metaConnected && !profiles.length) {
  safetyGateMessage =
    "I cannot proceed because no business is connected yet. Please connect a Facebook Business or Page first.";
}
    // ⚠️ Multiple businesses detected
    if (profiles.length > 1 && !instruction.toLowerCase().includes("use")) {
      safetyGateMessage =
        "You have multiple businesses/pages connected. Please explicitly tell me which ONE business or page to use before I proceed.";
    }

    // 🛑 Budget / approval guard
    if (
  instruction.toLowerCase().includes("run") &&
  !instruction.toLowerCase().includes("approve") &&
  !instruction.toLowerCase().includes("yes") &&
  !instruction.toLowerCase().includes("paused")
) {
  safetyGateMessage =
    "Before I can prepare execution-ready campaign steps, I need your explicit confirmation...";
}
  }
} catch (e) {
  console.warn("Safety gate check skipped:", e.message);
}

if (safetyGateMessage) {
  return res.status(200).json({
    ok: true,
    mode,
    gated: true,
    text: safetyGateMessage,
  });
}

    // ============================================================
// 🎯 META ADS FULL FLOW (AUTO → CONFIRM → CREATE PAUSED)
// ============================================================

if (
  mode === "meta_ads_plan" &&
  instruction.trim().toLowerCase() === "yes"
) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  // 1️⃣ Get business intake from memory
  const intakeRes = await fetch(`${baseUrl}/api/agent/intake-business`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const intakeJson = await intakeRes.json();
  if (!intakeJson?.ok || !intakeJson.intake) {
    return res.json({
      ok: false,
      message: "Business intake not found.",
    });
  }

  // 2️⃣ Generate creative via Gemini
  const creativeRes = await fetch(
    `${baseUrl}/api/agent/generate-creative`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intake: intakeJson.intake,
        objective: "Traffic",
      }),
    }
  );

  const creativeJson = await creativeRes.json();
  if (!creativeJson?.ok) {
    return res.json({
      ok: false,
      message: "Creative generation failed",
    });
  }

  const { image_prompt, headlines, primary_texts, cta } =
    creativeJson.creative;

  // 3️⃣ Generate image (OpenAI)
  const imgGen = await fetch(`${baseUrl}/api/images/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: image_prompt }),
  });

  const imgJson = await imgGen.json();
  if (!imgJson?.ok || !imgJson.imageBase64) {
    return res.json({ ok: false, message: "Image generation failed" });
  }

  // 4️⃣ Upload image to Meta
  const upload = await fetch(`${baseUrl}/api/meta/upload-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: imgJson.imageBase64 }),
  });

  const uploadJson = await upload.json();
  if (!uploadJson?.ok || !uploadJson.image_hash) {
    return res.json({ ok: false, message: "Image upload failed" });
  }

  // 5️⃣ Execute paused campaign
  const execRes = await fetch(
    `${baseUrl}/api/meta/execute-campaign`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign: {
          objective: "TRAFFIC",
          status: "PAUSED",
          daily_budget: 200,
        },
        adset: {
          optimization_goal: "LINK_CLICKS",
          targeting_country: "IN",
        },
        creative: {
          headline: headlines[0],
          body_text: primary_texts[0],
          call_to_action: cta,
          image_hash: uploadJson.image_hash,
          destination_url: intakeJson.intake.website || intakeJson.intake.page_url,
        },
      }),
    }
  );

  const execJson = await execRes.json();

  return res.json({
    ok: true,
    message: "Paused Meta campaign created successfully.",
    meta_response: execJson,
  });
}

    
    // ===============================
// 🚀 FINAL META EXECUTION (MANUAL CONFIRMATION)
// ===============================
if (
  mode === "meta_ads_plan" &&
  instruction.toLowerCase().includes("yes")
) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const execRes = await fetch(
    `${baseUrl}/api/meta/execute-campaign`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign: body.campaign,
        adset: body.adset,
        creative: body.creative,
      }),
    }
  );

  const execJson = await execRes.json();

  return res.status(200).json({
    ok: true,
    executed: true,
    platform: "meta",
    paused: true,
    result: execJson,
  });
}
// ===============================
// 💾 ANSWER MEMORY WIRING
// ===============================
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

const detectedAnswers = {};

// Simple extraction (safe, heuristic — Gemini already guided the question)
if (instruction.match(/₹|\d+/)) {
  detectedAnswers.budget_per_day = instruction;
}
if (instruction.toLowerCase().includes("day")) {
  detectedAnswers.total_days = instruction;
}
if (
  instruction.toLowerCase().includes("yes") ||
  instruction.toLowerCase().includes("confirm")
) {
  detectedAnswers.approval = "YES";
}

// business_id should already be known from intake or selection
if (activeBusinessId && Object.keys(detectedAnswers).length > 0) {
  await saveAnswerMemory(baseUrl, activeBusinessId, detectedAnswers);
}

    const systemPrompt = `
You are GabbarInfo AI – a senior digital marketing strategist and backend AGENT.
Your job:
- Understand the user's instruction.
- Decide what they actually need (Google Ads plan, Meta ads creative, social calendar, SEO/blog, or a mix).
- Produce either:
  - A clear, step-by-step strategy/plan, OR
  - Valid backend JSON payloads (ONLY when the user explicitly asks for JSON).

CRITICAL AGENT SAFETY RULE — ACTIVE BUSINESS CONTEXT:

- Client memory may contain multiple businesses.
- You MUST NOT assume which business is active.
- If more than one business exists in CLIENT CONTEXT:
  - You MUST ask the user to explicitly choose ONE business
  - OR ask them to set the “active company” for this session.
- You are STRICTLY FORBIDDEN from designing campaigns, accessing ad accounts,
  publishing content, or generating execution JSON until ONE business is confirmed.

Rules:
- NEVER claim that you already executed actions in Google Ads, Meta, LinkedIn or WordPress.
- When you give JSON, strictly follow the schemas described.
- When you give a plan, be complete and practical (no half-finished steps).
- Assume the user is in India by default unless location is specified.
${modeFocus}

CLIENT CONTEXT (authoritative, from saved client knowledge — MUST be used if present):
${ragContext || "(none)"}
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

let parsed;
try {
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("No JSON object found in agent output");
  }

  const cleanJson = text.slice(jsonStart, jsonEnd + 1);
  parsed = JSON.parse(cleanJson);
} catch (e) {
  return res.status(400).json({
    ok: false,
    message: "Agent output is not valid JSON",
    raw: text,
  });
}

const campaign_settings = parsed.campaign_settings;
const ad_sets = parsed.ad_sets;

if (!campaign_settings || !ad_sets) {
  return res.status(400).json({
    ok: false,
    message: "campaign_settings or ad_sets missing from agent output",
    parsed,
  });
}

return res.status(200).json({
  ok: true,
  campaign_settings,
  ad_sets,
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
