// pages/api/agent/execute.js

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import { executeInstagramPost } from "../../../lib/execute-instagram-post";
import { normalizeImageUrl } from "../../../lib/normalize-image-url";
import { creativeEntry } from "../../../lib/instagram/creative-entry";
import { clearCreativeState } from "../../../lib/instagram/creative-memory";

const Messages = {
  META_EXECUTION_FAILED: "Meta Execution Failed",
};


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);


const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

let genAI = null;
let __currentEmail = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
} else {
  console.warn("⚠ GEMINI_API_KEY is not set. /api/agent/execute will not work for agent mode.");
}

async function parseResponseSafe(resp) {
  try {
    return await resp.json();
  } catch (_) {
    try {
      const t = await resp.text();
      return { ok: false, text: t };
    } catch {
      return { ok: false };
    }
  }
}

async function saveAnswerMemory(baseUrl, business_id, answers, emailOverride = null) {
  const targetEmail = emailOverride || __currentEmail;
  if (!targetEmail) {
    console.error("❌ saveAnswerMemory: No target email available!");
    return;
  }

  console.log(`💾 saveAnswerMemory: Saving for ${business_id} (Email: ${targetEmail})`);

  // Direct Supabase Write (Robust & Faster than internal fetch)
  try {
    const { data: existing } = await supabase
      .from("agent_memory")
      .select("content")
      .eq("email", targetEmail)
      .eq("memory_type", "client")
      .maybeSingle();

    let content = {};
    try {
      content = existing?.content ? JSON.parse(existing.content) : {};
    } catch {
      content = {};
    }

    content.business_answers = content.business_answers || {};
    content.business_answers = content.business_answers || {};

    // 🔒 DEEP MERGE CAMPAIGN STATE (Prevent Data Loss)
    const existingAnswers = content.business_answers[business_id] || {};
    let finalAnswers = { ...existingAnswers, ...answers, updated_at: new Date().toISOString() };

    if (answers.campaign_state && existingAnswers.campaign_state) {
      console.log(`🧠 [Deep Merge] Merging campaign_state for ${business_id}...`);
      finalAnswers.campaign_state = {
        ...existingAnswers.campaign_state,
        ...answers.campaign_state,
        plan: answers.campaign_state.plan || existingAnswers.campaign_state.plan, // Explicitly preserve plan
        stage: answers.campaign_state.stage || existingAnswers.campaign_state.stage
      };
    }

    content.business_answers[business_id] = finalAnswers;

    const { error } = await supabase.from("agent_memory").upsert(
      {
        email: targetEmail,
        memory_type: "client",
        content: JSON.stringify(content),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,memory_type" }
    );

    if (error) {
      console.error("❌ saveAnswerMemory Supabase Error:", error.message);
    } else {
      console.log(`✅ Memory saved successfully for ${business_id}`);
    }
  } catch (err) {
    console.error("❌ saveAnswerMemory Fatal Error:", err.message);
  }
}

function isMetaPlanComplete(plan) {
  return !!(
    plan &&
    plan.campaign_name &&
    plan.objective &&
    plan.performance_goal &&
    plan.ad_sets?.[0]?.ad_creative?.destination_url &&
    plan.ad_sets?.[0]?.ad_creative?.headline &&
    plan.ad_sets?.[0]?.ad_creative?.primary_text
  );
}

export default async function handler(req, res) {
  let currentState = null; // Default until loaded

  if (req.method !== "POST") {
    console.log("TRACE: ENTER EXECUTE");
    console.log("TRACE: MODE =", req.body?.mode);
    console.log("TRACE: INSTRUCTION =", req.body?.instruction);
    console.log("TRACE: RETURNING RESPONSE — STAGE = undefined");
    return res.status(405).json({ ok: false, message: "Only POST allowed." });
  }

  try {
    const body = req.body || {};

    // ---------------------------
    // 0) REQUIRE SESSION (for everything)
    // ---------------------------
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }
    __currentEmail = session.user.email.toLowerCase();
    console.log("TRACE: SESSION OK =", session.user.email);

    // 🔒 MODE AUTHORITY GATE — INSTAGRAM ISOLATION
    if (body.mode === "instagram_post") {
      return handleInstagramPostOnly(req, res, session, body);
    }

    // 🔥 DEBUG LOGS FOR CONTEXT MISMATCH
    let { instruction = "", mode: bodyMode = body.mode } = body;
    const lowerInstruction = instruction.toLowerCase();
    console.log("🔥 REQUEST START");
    console.log("EMAIL:", __currentEmail);
    console.log("INSTRUCTION:", instruction.substring(0, 50));
    console.log("MODE:", bodyMode);
    console.log("COOKIES:", req.headers.cookie ? "Present" : "Missing");
    console.log("TRACE: META ADS LOGIC ENTRY");
    let verifiedMetaAssets = null;

    // 1️⃣ Check cache first
    const { data: cachedAssets } = await supabase
      .from("agent_meta_assets")
      .select("*")
      .eq("email", session.user.email.toLowerCase())
      .maybeSingle();

    if (cachedAssets) {
      verifiedMetaAssets = cachedAssets;
    } else {
      // 2️⃣ No cache → verify using Meta Graph API
      console.log("TRACE: FETCHING META CONNECTION FROM SUPABASE");
      const { data: meta } = await supabase
        .from("meta_connections")
        .select("*")
        .eq("email", session.user.email.toLowerCase())
        .single();

      console.log("TRACE: META CONNECTION RESULT =", meta);
      console.log("TRACE: RESOLVED AD ACCOUNT ID =", meta?.fb_ad_account_id);

      if (!meta?.system_user_token || !meta?.fb_ad_account_id) {
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.json({
          ok: true,
          gated: true,
          text:
            "I don’t have access to your Meta ad account yet. Please connect your Facebook Business first.",
        });
      }

      const token = meta.system_user_token;

      // Facebook Page
      const fbPageRes = await fetch(
        `https://graph.facebook.com/v19.0/${meta.fb_page_id}?fields=name,category,about&access_token=${token}`
      );
      const fbPage = await fbPageRes.json();

      // Instagram
      let igAccount = null;
      if (meta.ig_business_id) {
        const igRes = await fetch(
          `https://graph.facebook.com/v19.0/${meta.ig_business_id}?fields=name,biography,category&access_token=${token}`
        );
        igAccount = await igRes.json();
      }

      // Ad Account (normalize id to numeric for 'act_<id>' pattern)
      const normalizedAdId = (meta.fb_ad_account_id || "").toString().replace(/^act_/, "");
      const adRes = await fetch(
        `https://graph.facebook.com/v19.0/act_${normalizedAdId}?fields=account_status,currency,timezone_name&access_token=${token}`
      );
      const adAccount = await adRes.json();

      verifiedMetaAssets = {
        email: session.user.email.toLowerCase(),
        fb_page: fbPage,
        ig_account: igAccount,
        ad_account: adAccount,
        verified_at: new Date().toISOString(),
      };

      // 3️⃣ Save to cache
      await supabase.from("agent_meta_assets").upsert(verifiedMetaAssets);
    }

    // ============================================================
    // 🔗 META CONNECTION CHECK (Supabase)
    // ============================================================
    let metaConnected = false;
    let activeBusinessId = null;
    let metaRow = null;

    try {
      const { data: row } = await supabase
        .from("meta_connections")
        .select("*")
        .eq("email", session.user.email.toLowerCase())
        .maybeSingle();

      metaRow = row;

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

    // 🛡️ FALLBACK: Use "default_business" if no Meta connection exists yet.
    // This ensures plans can be saved/retrieved even before connection.
    const effectiveBusinessId = activeBusinessId || "default_business";
    console.log(`🏢 Effective Business ID: ${effectiveBusinessId} (Active: ${activeBusinessId})`);

    let forcedBusinessContext = null;

    if (metaConnected && activeBusinessId) {
      forcedBusinessContext = {
        source: "meta_connection",
        business_id: activeBusinessId,
        note: "User has exactly ONE Meta business connected. This is the active business.",
      };
    }

    let lockedCampaignState = null;

    // 🔍 READ LOCKED CAMPAIGN STATE (AUTHORITATIVE — SINGLE SOURCE)
    // 🛡️ PATCH: PREVENT INSTAGRAM MODE FROM READING META ADS MEMORY
    if (body.mode !== "instagram_post") {
      if (effectiveBusinessId) {
        try {
          const { data: memData } = await supabase
            .from("agent_memory")
            .select("content")
            .eq("email", session.user.email.toLowerCase())
            .eq("memory_type", "client")
            .maybeSingle();

          if (memData?.content) {
            const content = JSON.parse(memData.content);
            const answers = content.business_answers || {};

            // 🛡️ MODIFIED ROBUST MULTI-KEY LOOKUP
            // We search through all possible identity keys and pick the FIRST one that HAS a plan.
            // This prevents picking up a "blank" state from a newly discovered business ID if a plan exists in "default_business".
            const possibleKeys = [
              effectiveBusinessId,
              activeBusinessId,
              metaRow?.fb_business_id,
              metaRow?.fb_page_id,
              metaRow?.ig_business_id,
              "default_business"
            ].filter(Boolean);

            let bestMatch = null;
            let sourceKey = null;

            for (const key of possibleKeys) {
              const state = answers[key]?.campaign_state;
              if (state?.plan) {
                bestMatch = state;
                sourceKey = key;
                break;
              }
              if (!bestMatch && state) {
                bestMatch = state;
                sourceKey = key;
              }
            }

            lockedCampaignState = bestMatch;
            if (lockedCampaignState) {
              console.log(`✅ Loaded lockedCampaignState from key: ${sourceKey} ${lockedCampaignState.plan ? "(Plan FOUND)" : "(No Plan)"}`);
            }
          }
        } catch (e) {
          console.warn("Campaign state read failed early:", e.message);
        }
      }
    }

    console.log("🏢 EFFECTIVE BUSINESS ID:", effectiveBusinessId);
    console.log("🔒 HAS LOCKED STATE:", !!lockedCampaignState);
    if (lockedCampaignState) {
      console.log("📍 LOCKED STAGE:", lockedCampaignState.stage);
      console.log("📍 HAS PLAN:", !!lockedCampaignState.plan);
    }

    // 🔒 CRITICAL: FLAG FOR BYPASSING INTERACTIVE GATES
    const isPlanProposed =
      lockedCampaignState?.stage === "PLAN_PROPOSED" &&
      isMetaPlanComplete(lockedCampaignState?.plan);
    console.log("📍 isPlanProposed:", isPlanProposed);
    // ============================================================
    // 📣 PLATFORM RESOLUTION (FACEBOOK / INSTAGRAM) — SOURCE OF TRUTH
    // ============================================================

    // Step 1: Detect connected platforms from VERIFIED assets
    const hasFacebook =
      !!verifiedMetaAssets?.fb_page;

    const hasInstagram =
      !!verifiedMetaAssets?.ig_account;

    // Step 2: Decide default platforms
    let resolvedPlatforms = [];

    if (hasFacebook && hasInstagram) {
      resolvedPlatforms = ["facebook", "instagram"];
    } else if (hasFacebook) {
      resolvedPlatforms = ["facebook"];
    } else if (hasInstagram) {
      resolvedPlatforms = ["instagram"];
    }

    // Step 3: If nothing is connected, hard stop
    if (resolvedPlatforms.length === 0) {
      return res.status(200).json({
        ok: false,
        message:
          "No Facebook Page or Instagram Business is connected. Please connect at least one platform.",
      });
    }

    // Step 4: User override (ONLY if explicitly mentioned)
    const instructionText = (body.instruction || "").toLowerCase();

    // 🛡️ PATCH: PLATFORM OVERRIDE GUARD
    // Only allow manual platform selection in Instagram Post mode.
    // Meta Ads mode must determine platforms based on connected assets and campaign rules.
    if (body.mode === "instagram_post") {
      if (instructionText.includes("only instagram")) {
        if (!hasInstagram) {
          return res.status(200).json({
            ok: false,
            message:
              "Instagram is not connected. Please connect your Instagram Business account or run ads on Facebook.",
          });
        }
        resolvedPlatforms = ["instagram"];
      }

      if (instructionText.includes("only facebook")) {
        if (!hasFacebook) {
          return res.status(200).json({
            ok: false,
            message:
              "Facebook Page is not connected. Please connect your Facebook Page or run ads on Instagram.",
          });
        }
        resolvedPlatforms = ["facebook"];
      }
    }

    // ============================================================
    // 🧠 AUTO BUSINESS INTAKE (READ + INJECT CONTEXT)
    let autoBusinessContext = null;

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
      if (baseUrl) {
        const intakeRes = await fetch(
          `${baseUrl}/api/agent/intake-business`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              cookie: req.headers.cookie || "",
            },
          }
        );

        const intakeJson = await intakeRes.json();

        if (intakeJson?.ok && intakeJson?.intake) {
          autoBusinessContext = intakeJson.intake;
        }
      }

    } catch (e) {
      console.warn("Auto business intake failed:", e.message);
    }
    // 🌐 LANDING PAGE DETECTION (AUTHORITATIVE — SYNCED DATA)
    let detectedLandingPage = null;

    // Priority 1: Synced business website
    if (autoBusinessContext?.business_website) {
      detectedLandingPage = autoBusinessContext.business_website;
    }

    // Priority 2: Instagram website (synced)
    else if (autoBusinessContext?.instagram_website) {
      detectedLandingPage = autoBusinessContext.instagram_website;
    }

    // ============================================================
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
          throw new Error(Messages.META_EXECUTION_FAILED);
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
          throw new Error(Messages.META_EXECUTION_FAILED);
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

    let {
      includeJson = false,
      chatHistory = [],
      extraContext = "",
    } = body;
    let mode = body.mode || "generic";

    if (mode === "meta_ads_plan") {
      console.log("TRACE: ENTER META ADS HANDLER");
      console.log("TRACE: MODE =", mode);
      console.log("TRACE: INSTRUCTION =", instruction);
      console.log("TRACE: STAGE (initial) =", lockedCampaignState?.stage);
    }
    // We strictly respect body.mode. We do NOT force meta_ads_plan anymore.
    // If lockedCampaignState exists, it will be used ONLY if we are naturally in meta_ads_plan mode.


    if (!instruction || typeof instruction !== "string") {
      return res.status(400).json({
        ok: false,
        message: "Missing 'instruction' (string) for agent mode.",
      });
    }

    // 🔒 Do NOT allow old chat history to override verified Meta assets
    // FIXED: We allow history but we instruct the model to prioritize verified assets.
    const historyText = Array.isArray(chatHistory)
      ? chatHistory
        .slice(-20)
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
        .join("\n\n")
      : "";


    // ============================================================
    // 🛡️ PATCH 2: Dedicated Confirmation Gate
    // ============================================================
    if (lockedCampaignState && mode === "meta_ads_plan") {
      console.log("TRACE: ENTER SHORT-CIRCUIT EXECUTION PATH");
      console.log("TRACE: USER SAID YES =", lowerInstruction.includes("yes"));
      console.log("TRACE: STAGE (before confirm) =", lockedCampaignState?.stage);

      if (lockedCampaignState.stage === "PLAN_PROPOSED") {
        if (!lowerInstruction.includes("yes")) {
          console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
          return res.status(200).json({
            ok: true,
            mode,
            text: "Please review the plan above and reply YES to confirm."
          });
        }

        // User confirmed
        console.log("✅ User Confirmed Plan. Transitioning: PLAN_PROPOSED -> PLAN_CONFIRMED");
        lockedCampaignState.stage = "PLAN_CONFIRMED";
        lockedCampaignState.auto_run = false;
        lockedCampaignState.locked_at = new Date().toISOString();

        await saveAnswerMemory(
          process.env.NEXT_PUBLIC_BASE_URL,
          effectiveBusinessId,
          { campaign_state: lockedCampaignState },
          session.user.email.toLowerCase()
        );

        return res.status(200).json({
          ok: true,
          mode,
          text: "Plan confirmed. Starting campaign setup…"
        });
      }
    }

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

*** CRITICAL: FOLLOW THIS 3-STEP DECISION HIERARCHY ***
1. **CAMPAIGN OBJECTIVE** (Broad Goal):
   - "Traffic" -> OUTCOME_TRAFFIC
   - "Leads" -> OUTCOME_LEADS
   - "Sales" -> OUTCOME_SALES
   - "Awareness" -> OUTCOME_AWARENESS
   - "App Promotion" -> OUTCOME_APP_PROMOTION
   - "Engagement" -> OUTCOME_ENGAGEMENT

   *NEVER* use "TRAFFIC" or "LEAD_GENERATION" (Legacy). Always use "OUTCOME_" prefix.

2. **CONVERSION LOCATION** (Where it happens):
   - "Website" (Most Common)
   - "Messaging Apps" (WhatsApp/Messenger)
   - "Instant Forms" (Lead Forms)
   - "Calls"

3. **PERFORMANCE GOAL** (Optimization):
   - If Objective = OUTCOME_TRAFFIC:
     - "Maximize Link Clicks" (Goal: LINK_CLICKS)
     - "Maximize Landing Page Views" (Goal: LANDING_PAGE_VIEWS)
   - If Objective = OUTCOME_LEADS:
     - "Maximize Leads" (Goal: LEADS)
   - If Objective = OUTCOME_SALES:
     - "Maximize Conversions" (Goal: CONVERSIONS)

*** REQUIRED JSON SCHEMA ***
You MUST ALWAYS output BOTH a human-readable summary AND the JSON using this exact schema whenever you propose a campaign plan:

{
  "campaign_name": "Dentist Clinic – Mumbai – Jan 2026",
  "objective": "OUTCOME_TRAFFIC",
  "performance_goal": "MAXIMIZE_LINK_CLICKS",
  "conversion_location": "WEBSITE",
  "budget": {
    "amount": 500,
    "currency": "INR",
    "type": "DAILY"
  },
  "targeting": {
    "geo_locations": { "countries": ["IN"], "cities": [{"name": "Mumbai"}] },
    "age_min": 25,
    "age_max": 55,
    "targeting_suggestions": {
      "interests": ["Dentistry", "Oral Hygiene"],
      "demographics": ["Parents"]
    }
  },
  "ad_sets": [
    {
      "name": "Ad Set 1",
      "status": "PAUSED",
      "optimization_goal": "LINK_CLICKS",
      "destination_type": "WEBSITE",
      "ad_creative": {
        "imagePrompt": "a modern clinic exterior at dusk, vibrant lighting, professional photographer",
        "primary_text": "Trusted by 5000+ patients. Painless treatments.",
        "headline": "Best Dental Clinic in Mumbai",
        "call_to_action": "LEARN_MORE",
        "destination_url": "https://client-website.com"
      }
    }
  ]
}

- Meta Objectives must be one of: OUTCOME_TRAFFIC, OUTCOME_LEADS, OUTCOME_SALES, OUTCOME_AWARENESS, OUTCOME_ENGAGEMENT, OUTCOME_APP_PROMOTION.
- optimization_goal must match the performance goal (e.g., LINK_CLICKS, LANDING_PAGE_VIEWS).
- destination_type should be set (e.g., WEBSITE, MESSAGING_APPS).
- When you output JSON, wrap it in a proper JSON code block. Do NOT add extra text inside the JSON block.
- ALWAYS propose a plan if you have enough info (objective, location, service, budget).
`;
    } else if (mode === "social_plan") {
      modeFocus = `
You are in SOCIAL MEDIA PLANNER MODE.

- Focus on Instagram, Facebook, LinkedIn, YouTube content calendars.
- Give hooks, caption ideas, posting frequency and content pillars.
- Tie everything back to leads, sales or brand - building.
`;
    } else if (mode === "seo_blog") {
      modeFocus = `
You are in SEO / BLOG AGENT MODE.

- Focus on keyword ideas, blog topics, outlines and SEO - optimised articles.
- Use simple, clear language and structure the blog logically for humans + Google.
`;
    } else {
      modeFocus = `
You are in GENERIC DIGITAL MARKETING AGENT MODE.

- You can combine Google Ads, Meta Ads, SEO, content and social together.
- If the user explicitly asks for backend JSON, follow the exact schemas:
  - Google Ads JSON for campaigns.
  - Creative JSON for Meta / social creatives.
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
        if (!forcedBusinessContext && profiles.length > 1) {
          safetyGateMessage =
            "You have multiple businesses connected. Please tell me which one to use.";
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

    // For Meta Ads, only run this global safety gate AFTER objective and destination are known.
    const canApplySafetyGate =
      mode !== "meta_ads_plan" ||
      !!(lockedCampaignState?.objective && lockedCampaignState?.destination);

    if (!isPlanProposed && safetyGateMessage && canApplySafetyGate) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

      const qRes = await fetch(`${baseUrl}/api/agent/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: mode === "meta_ads_plan" ? "meta" : mode,
          objective: "campaign_creation",
          missing: ["budget", "location", "objective"],
          context: autoBusinessContext || forcedBusinessContext || {},
        }),
      });

      const qJson = await qRes.json();

      return res.status(200).json({
        ok: true,
        mode,
        gated: true,
        text:
          "Before I proceed, I need a few quick details:\n\n" +
          qJson.questions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
      });
    }
    // ============================================================
    // 🔍 READ LOCKED CAMPAIGN STATE (AUTHORITATIVE — SINGLE SOURCE)
    // ============================================================


    let selectedService = null;
    let selectedLocation = null;



    // WATERFALL REMOVED FROM TOP - MOVED TO BOTTOM



    // ============================================================
    // 🎯 META OBJECTIVE PARSING (USER SELECTION)
    // ============================================================

    // ============================================================
    // 🧠 PRO LOGIC: PARSING HELPERS (NO AUTO-GUESSING)
    // ============================================================

    const extractedData = {
      website_url: null,
      phone: null,
      budget: null,
      duration: null,
      whatsapp: null
    };

    // Website & Phone Extraction (parsing only)
    const urlMatch = instruction.match(/(?:https?:\/\/)?(?:www\.)[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/i) || instruction.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      let url = urlMatch[0];
      if (!url.startsWith("http")) url = "https://" + url;
      extractedData.website_url = url;
    }
    const phoneMatch = instruction.match(/phone[^\d]*(\+?\d[\d\s-]{8,15})/i) || instruction.match(/(\+?\d[\d\s-]{8,15})/);
    if (phoneMatch) extractedData.phone = phoneMatch[1];
    const waMatch = instruction.match(/whatsapp[^\d]*(\+?\d[\d\s-]{8,15})/i);
    if (waMatch) extractedData.whatsapp = waMatch[1];

    // Budget & Duration (parsing only)
    const budgetMatch = instruction.match(/(?:budget|amount|day):\s*(\d+)/i) || instruction.match(/(?:₹|rs\.?)\s*(\d+)/i);
    if (budgetMatch) extractedData.budget = budgetMatch[1];
    const durationMatch = instruction.match(/(\d+)\s*days?/i);
    if (durationMatch) extractedData.duration = durationMatch[1];

    // ============================================================
    // 🎯 META OBJECTIVE PARSING (USER SELECTION / HIERARCHY)
    // ============================================================

    let selectedMetaObjective = lockedCampaignState?.objective || null;
    let selectedDestination = lockedCampaignState?.destination || null;
    let selectedPerformanceGoal = lockedCampaignState?.performance_goal || null;

    // 🧑‍💬 Interactive Sequence: Objective -> Destination -> Goal

    // Step 1: Objective
    if (!isPlanProposed && mode === "meta_ads_plan" && !selectedMetaObjective) {
      // (Keep existing interactive selection logic but refine it)
      if (lowerInstruction.includes("traffic")) selectedMetaObjective = "OUTCOME_TRAFFIC";
      else if (lowerInstruction.includes("lead")) selectedMetaObjective = "OUTCOME_LEADS";
      else if (lowerInstruction.includes("sale") || lowerInstruction.includes("conversion")) selectedMetaObjective = "OUTCOME_SALES";

      if (selectedMetaObjective) {
        lockedCampaignState = { ...lockedCampaignState, objective: selectedMetaObjective, stage: "objective_selected" };
        currentState = lockedCampaignState;
        await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: lockedCampaignState }, session.user.email.toLowerCase());
        console.log("TRACE: ENTER META INTAKE FLOW");
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({
          ok: true,
          mode,
          gated: true,
          text: "Got it. I’ve locked your campaign objective.",
        });
      } else {
        console.log("TRACE: ENTER META INTAKE FLOW");
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({
          ok: true, mode, gated: true,
          text: "Let's build your Meta Campaign. What is your primary objective?\n\n1. **Traffic** (Get visits to website, page, or profile)\n2. **Leads** (Get calls, WhatsApp messages, or form fills)\n3. **Sales** (Drive conversions on your website)"
        });
      }
    }

    // Step 2: Conversion Location
    if (!isPlanProposed && mode === "meta_ads_plan" && selectedMetaObjective && !selectedDestination) {
      let options = [];
      if (selectedMetaObjective === "OUTCOME_TRAFFIC") {
        options = ["Website", "Instagram Profile", "Facebook Page"];
      } else if (selectedMetaObjective === "OUTCOME_LEADS") {
        options = ["WhatsApp", "Calls", "Messenger/Instagram Direct"];
      } else {
        options = ["Website"];
      }

      // Detection
      const input = lowerInstruction;
      if (input.includes("1") || input.includes("website")) selectedDestination = "website";
      else if (input.includes("2") || input.includes("instagram") || input.includes("call")) selectedDestination = selectedMetaObjective === "OUTCOME_TRAFFIC" ? "instagram_profile" : "call";
      else if (input.includes("3") || input.includes("facebook") || input.includes("whatsapp")) selectedDestination = selectedMetaObjective === "OUTCOME_TRAFFIC" ? "facebook_page" : "whatsapp";
      else if (input.includes("message")) selectedDestination = "messages";

      if (selectedDestination) {
        lockedCampaignState = { ...lockedCampaignState, destination: selectedDestination, stage: "destination_selected" };
        currentState = lockedCampaignState;
        await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: lockedCampaignState }, session.user.email.toLowerCase());
        console.log("TRACE: ENTER META INTAKE FLOW");
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({
          ok: true,
          mode,
          gated: true,
          text: "Conversion location saved.",
        });
      } else {
        console.log("TRACE: ENTER META INTAKE FLOW");
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({
          ok: true, mode, gated: true,
          text: `Where should we drive this ${selectedMetaObjective.toLowerCase()}?\n\n` + options.map((o, i) => `${i + 1}. ${o}`).join("\n")
        });
      }
    }

    // Step 3: Performance Goal
    if (!isPlanProposed && mode === "meta_ads_plan" && selectedMetaObjective && selectedDestination && !selectedPerformanceGoal) {
      let goals = [];
      if (selectedDestination === "website") {
        goals = ["Maximize Number of Link Clicks", "Maximize Number of Landing Page Views"];
      } else if (selectedDestination === "call") {
        goals = ["Maximize Number of Calls"];
      } else if (selectedDestination === "whatsapp" || selectedDestination === "messages") {
        goals = ["Maximize Number of Conversations"];
      } else {
        goals = ["Maximize Reach / Visits"];
      }

      const input = lowerInstruction;
      if (input.includes("link click")) selectedPerformanceGoal = "MAXIMIZE_LINK_CLICKS";
      else if (input.includes("landing page view")) selectedPerformanceGoal = "MAXIMIZE_LANDING_PAGE_VIEWS";
      else if (input.includes("conversation")) selectedPerformanceGoal = "MAXIMIZE_CONVERSATIONS";
      else if (input.includes("call")) selectedPerformanceGoal = "MAXIMIZE_CALLS";
      else if (input === "1") selectedPerformanceGoal = goals[0].toUpperCase().replace(/ /g, "_");
      else if (input === "2" && goals[1]) selectedPerformanceGoal = goals[1].toUpperCase().replace(/ /g, "_");

      if (selectedPerformanceGoal) {
        lockedCampaignState = { ...lockedCampaignState, performance_goal: selectedPerformanceGoal, stage: "goal_selected" };
        currentState = lockedCampaignState;
        await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: lockedCampaignState }, session.user.email.toLowerCase());
        console.log("TRACE: ENTER META INTAKE FLOW");
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({
          ok: true,
          mode,
          gated: true,
          text: "Performance goal locked.",
        });
      } else {
        console.log("TRACE: ENTER META INTAKE FLOW");
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({
          ok: true, mode, gated: true,
          text: `What is your performance goal for these ads?\n\n` + goals.map((g, i) => `${i + 1}. ${g}`).join("\n")
        });
      }
    }

    // ============================================================
    // 🔁 OBJECTIVE OVERRIDE (EXPLICIT USER INTENT ONLY)
    // ============================================================

    const objectiveOverrideKeywords = [
      "change objective",
      "switch objective",
      "use objective",
      "make it",
      "instead of",
    ];

    const wantsObjectiveChange =
      objectiveOverrideKeywords.some((k) =>
        instruction.toLowerCase().includes(k)
      ) &&
      (
        instruction.toLowerCase().includes("website") ||
        instruction.toLowerCase().includes("call") ||
        instruction.toLowerCase().includes("whatsapp") ||
        instruction.toLowerCase().includes("message") ||
        instruction.toLowerCase().includes("traffic")
      );

    if (mode === "meta_ads_plan" && wantsObjectiveChange) {
      selectedMetaObjective = null;
      selectedDestination = null;

      // 🛠️ CLEAR LOCKED OBJECTIVE IN DB
      if (lockedCampaignState) {
        const newState = {
          ...lockedCampaignState,
          objective: null,
          destination: null,
          stage: "reset_objective"
        };
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        await saveAnswerMemory(baseUrl, effectiveBusinessId, {
          campaign_state: newState
        }, session.user.email.toLowerCase());
        lockedCampaignState = newState; // Update local
      }
    }

    // ============================================================
    // 🎯 META OBJECTIVE SELECTION — HARD BLOCK (STATE AWARE)
    // ============================================================

    if (
      !isPlanProposed &&
      mode === "meta_ads_plan" &&
      !selectedMetaObjective
    ) {
      console.log("TRACE: ENTER META INTAKE FLOW");
      console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);

      return res.status(200).json({
        ok: true,
        mode,
        gated: true,
        text:
          "What do you want people to do after seeing your ad?\n\n" +
          "Please choose ONE option:\n\n" +
          "1. Visit your website\n" +
          "2. Visit your Instagram profile\n" +
          "3. Visit your Facebook page\n" +
          "4. Call you\n" +
          "5. WhatsApp you\n" +
          "6. Send you messages on Facebook or Instagram",
      });
    }

    let detectedPhoneNumber = null;

    if (autoBusinessContext?.business_phone) {
      detectedPhoneNumber = autoBusinessContext.business_phone;
    }

    if (!detectedPhoneNumber && ragContext) {
      const phoneMatch = ragContext.match(/(\+?\d[\d\s-]{8,15})/);
      if (phoneMatch) {
        detectedPhoneNumber = phoneMatch[1];
      }
    }

    if (
      !isPlanProposed &&
      selectedDestination === "call" &&
      detectedPhoneNumber &&
      lowerInstruction.includes("yes") &&
      !lockedCampaignState?.phone_confirmed
    ) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
      const nextState = {
        ...lockedCampaignState,
        phone: detectedPhoneNumber,
        phone_confirmed: true,
        locked_at: new Date().toISOString()
      };
      await saveAnswerMemory(baseUrl, effectiveBusinessId, { campaign_state: nextState }, session.user.email.toLowerCase());
      lockedCampaignState = nextState;
      console.log("TRACE: ENTER META INTAKE FLOW");
      console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
      return res.status(200).json({
        ok: true,
        mode,
        gated: true,
        text: "Phone number confirmed for Call Ads.",
      });
    }

    if (
      !isPlanProposed &&
      selectedDestination === "call" &&
      extractedData.phone &&
      !lockedCampaignState?.phone_confirmed &&
      false
    ) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
      const nextState = {
        ...lockedCampaignState,
        phone: extractedData.phone,
        phone_confirmed: true,
        locked_at: new Date().toISOString()
      };
      await saveAnswerMemory(baseUrl, effectiveBusinessId, { campaign_state: nextState }, session.user.email.toLowerCase());
      lockedCampaignState = nextState;
    }

    if (
      !isPlanProposed &&
      selectedDestination === "call" &&
      !lockedCampaignState?.phone_confirmed
    ) {
      if (!detectedPhoneNumber) {
        console.log("TRACE: ENTER META INTAKE FLOW");
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({
          ok: true,
          mode,
          gated: true,
          text:
            "I couldn’t find a phone number on your Facebook Page or saved business memory.\n\n" +
            "Please type the exact phone number you want people to call (with country code).",
        });
      }

      console.log("TRACE: ENTER META INTAKE FLOW");
      console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
      return res.status(200).json({
        ok: true,
        mode,
        gated: true,
        text:
          `I found this phone number:\n\n📞 ${detectedPhoneNumber}\n\n` +
          "Should I use this number for your Call Ads?\n\nReply YES to confirm or paste a different number.",
      });
    }

    let detectedWhatsappNumber = null;

    if (autoBusinessContext?.business_phone) {
      detectedWhatsappNumber = autoBusinessContext.business_phone;
    }

    if (
      !isPlanProposed &&
      selectedDestination === "whatsapp" &&
      extractedData.whatsapp &&
      !lockedCampaignState?.whatsapp_confirmed &&
      false
    ) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
      const nextState = {
        ...lockedCampaignState,
        whatsapp: extractedData.whatsapp,
        whatsapp_confirmed: true,
        locked_at: new Date().toISOString()
      };
      await saveAnswerMemory(baseUrl, effectiveBusinessId, { campaign_state: nextState }, session.user.email.toLowerCase());
      lockedCampaignState = nextState;
    }

    if (
      !isPlanProposed &&
      selectedDestination === "whatsapp" &&
      !lockedCampaignState?.whatsapp_confirmed
    ) {
      console.log("TRACE: ENTER META INTAKE FLOW");
      const suggestionText = detectedWhatsappNumber
        ? `\n\nI found this number on your Facebook Page:\n📱 ${detectedWhatsappNumber}`
        : "";

      console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
      return res.status(200).json({
        ok: true,
        mode,
        gated: true,
        text:
          "WhatsApp ads require an explicit WhatsApp-enabled number." +
          suggestionText +
          "\n\nPlease reply with the exact WhatsApp number you want to use (with country code).\n" +
          "Example: +91XXXXXXXXXX",
      });
    }

    // ============================================================
    // 🌐 LANDING PAGE CONFIRMATION GATE (TRAFFIC ONLY)
    // ============================================================

    let landingPageConfirmed = !!lockedCampaignState?.landing_page_confirmed;

    // Detect confirmation from user reply
    if (
      !landingPageConfirmed &&
      (instruction.toLowerCase().includes("yes") ||
        instruction.toLowerCase().includes("use this") ||
        instruction.toLowerCase().includes("correct"))
    ) {
      landingPageConfirmed = true;
      if (effectiveBusinessId && detectedLandingPage) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        const nextState = {
          ...lockedCampaignState,
          landing_page: detectedLandingPage,
          landing_page_confirmed: true,
          locked_at: new Date().toISOString()
        };
        await saveAnswerMemory(baseUrl, effectiveBusinessId, { campaign_state: nextState }, session.user.email.toLowerCase());
        lockedCampaignState = nextState;
        console.log("TRACE: ENTER META INTAKE FLOW");
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({
          ok: true,
          mode,
          gated: true,
          text: "Website confirmed as your landing page.",
        });
      }
    }

    if (
      !landingPageConfirmed &&
      selectedDestination === "website" &&
      extractedData.website_url &&
      false
    ) {
      if (effectiveBusinessId) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        const nextState = {
          ...lockedCampaignState,
          landing_page: extractedData.website_url,
          landing_page_confirmed: true,
          locked_at: new Date().toISOString()
        };
        await saveAnswerMemory(baseUrl, effectiveBusinessId, { campaign_state: nextState }, session.user.email.toLowerCase());
        lockedCampaignState = nextState;
        landingPageConfirmed = true;
      }
    }

    // If objective is website traffic and landing page exists but not confirmed
    if (
      !isPlanProposed &&
      selectedDestination === "website" &&
      detectedLandingPage &&
      !landingPageConfirmed &&
      !lockedCampaignState?.landing_page_confirmed
    ) {
      console.log("TRACE: ENTER META INTAKE FLOW");
      console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
      return res.status(200).json({
        ok: true,
        mode,
        gated: true,
        text:
          `I found this website from your connected assets:\n\n` +
          `${detectedLandingPage}\n\n` +
          `Is this the page you want people to visit?\n\n` +
          `Reply YES to confirm, or paste a different URL.`,
      });
    }
    // ============================================================
    // 🧾 SERVICE DETECTION (FROM BUSINESS INTAKE)
    // ============================================================

    const availableServices =
      autoBusinessContext?.detected_services || [];

    // ============================================================
    // ❓ SERVICE CONFIRMATION (BEFORE BUDGET / LOCATION)
    // ============================================================

    // Logic: If Service is NOT locked, preventing moving forward
    if (
      !isPlanProposed &&
      mode === "meta_ads_plan" &&
      !lockedCampaignState?.service
    ) {
      // Check if user is confirming a service just now (no guessing)
      const serviceIdx = parseInt(lowerInstruction, 10);
      if (!isNaN(serviceIdx) && availableServices[serviceIdx - 1]) {
        selectedService = availableServices[serviceIdx - 1];
      } else if (lowerInstruction.length > 3 && !lowerInstruction.match(/^\d+$/)) {
        selectedService = instruction.trim();
      } else {
        console.log("TRACE: ENTER META INTAKE FLOW");
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({
          ok: true, gated: true,
          text: "Which service do you want to promote?\n\n" +
            (availableServices.length ? availableServices.map((s, i) => `${i + 1}. ${s}`).join("\n") : "- Type your service name")
        });
      }
    }
    // ============================================================
    // 🔒 LOCK SELECTED SERVICE
    // ============================================================

    const serviceIndex = parseInt(lowerInstruction, 10);

    if (
      !isNaN(serviceIndex) &&
      availableServices[serviceIndex - 1]
    ) {
      selectedService = availableServices[serviceIndex - 1];
    }

    if (
      selectedService &&
      effectiveBusinessId
    ) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

      const newState = {
        ...lockedCampaignState,
        service: selectedService,
        service_confirmed: true,
        stage: "service_selected",
        locked_at: new Date().toISOString(),
      };

      await saveAnswerMemory(baseUrl, effectiveBusinessId, {
        campaign_state: newState,
      }, session.user.email.toLowerCase());

      // Update local state so subsequent logic works in THIS turn
      lockedCampaignState = newState;
      console.log("TRACE: ENTER META INTAKE FLOW");
      console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
      return res.status(200).json({
        ok: true,
        mode,
        gated: true,
        text: "Service locked for this campaign.",
      });
    }

    // ============================================================
    // 📍 LOCATION DETECTION (FROM BUSINESS INTAKE ONLY)
    // ============================================================

    let detectedLocation =
      autoBusinessContext?.business_city ||
      autoBusinessContext?.business_location ||
      null;

    // ============================================================
    // ❓ LOCATION CONFIRMATION (ONCE ONLY)
    // ============================================================

    if (
      !isPlanProposed &&
      mode === "meta_ads_plan" &&
      !lockedCampaignState?.location &&
      !lockedCampaignState?.location_confirmed
    ) {
      if (detectedLocation) {
        console.log("TRACE: ENTER META INTAKE FLOW");
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({
          ok: true,
          gated: true,
          text:
            `I detected this location for your business:\n\n📍 ${detectedLocation}\n\n` +
            `Should I run ads for this location?\n\n` +
            `Reply YES to confirm, or type a different city / area.`,
        });
      } else {
        console.log("TRACE: ENTER META INTAKE FLOW");
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({
          ok: true,
          gated: true,
          text: `Where should this ad run? (e.g. Mumbai, New York, or 'Online')`
        });
      }
    }

    // ============================================================
    // 🔒 LOCK LOCATION (CONFIRMED OR USER-PROVIDED)
    // ============================================================

    // Case 1️⃣ User confirmed detected location
    if (
      detectedLocation &&
      instruction.toLowerCase().includes("yes")
    ) {
      selectedLocation = detectedLocation;
    }

    // Case 2️⃣ User typed a new location
    if (
      !instruction.toLowerCase().includes("yes") &&
      instruction.length > 2 &&
      !instruction.match(/^\d+$/)
    ) {
      selectedLocation = instruction.trim();
    }

    if (
      selectedLocation &&
      effectiveBusinessId
    ) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

      const newState = {
        ...lockedCampaignState,
        location: selectedLocation,
        location_confirmed: true,
        stage: "location_selected",
        locked_at: new Date().toISOString(),
      };

      await saveAnswerMemory(baseUrl, effectiveBusinessId, {
        campaign_state: newState,
      }, session.user.email.toLowerCase());

      // Update local state so subsequent logic works in THIS turn
      lockedCampaignState = newState;
      console.log("TRACE: ENTER META INTAKE FLOW");
      console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
      return res.status(200).json({
        ok: true,
        mode,
        gated: true,
        text: "Location locked for this campaign.",
      });
    }

    // ============================================================
    // 💰 BUDGET & DURATION GATE (STRICT FSM)
    // ============================================================
    if (
      mode === "meta_ads_plan" &&
      lockedCampaignState?.service &&
      lockedCampaignState?.location &&
      lockedCampaignState?.performance_goal
    ) {
      const hasObjective = !!lockedCampaignState?.objective;
      const hasDestination = !!lockedCampaignState?.destination;
      const hasPerformanceGoal = !!lockedCampaignState?.performance_goal;
      const hasService = !!lockedCampaignState?.service;
      const hasLocation = !!lockedCampaignState?.location;

      let hasAsset = true;
      if (lockedCampaignState?.destination === "website") {
        hasAsset =
          !!lockedCampaignState?.landing_page &&
          !!lockedCampaignState?.landing_page_confirmed;
      } else if (lockedCampaignState?.destination === "call") {
        hasAsset =
          !!lockedCampaignState?.phone &&
          !!lockedCampaignState?.phone_confirmed;
      } else if (lockedCampaignState?.destination === "whatsapp") {
        hasAsset =
          !!lockedCampaignState?.whatsapp &&
          !!lockedCampaignState?.whatsapp_confirmed;
      }

      const prerequisitesMet =
        hasObjective &&
        hasDestination &&
        hasPerformanceGoal &&
        hasService &&
        hasLocation &&
        hasAsset;

      if (!isPlanProposed && prerequisitesMet) {
        let budgetPerDay = lockedCampaignState?.budget_per_day || null;
        let totalDays = lockedCampaignState?.total_days || null;

        // STEP A — Budget (explicit confirmation required)
        if (!budgetPerDay) {
          const budgetAnswerMatch = instruction.match(
            /^\s*(?:₹\s*)?(\d+)\s*(?:inr)?\s*$/i
          );

          if (budgetAnswerMatch) {
            const numericBudget = parseInt(budgetAnswerMatch[1], 10);
            if (!Number.isNaN(numericBudget) && numericBudget > 0) {
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
              const newState = {
                ...lockedCampaignState,
                budget_per_day: numericBudget,
                locked_at: new Date().toISOString(),
              };
              await saveAnswerMemory(
                baseUrl,
                effectiveBusinessId,
                { campaign_state: newState },
                session.user.email.toLowerCase()
              );
              lockedCampaignState = newState;
              budgetPerDay = numericBudget;
              console.log("TRACE: ENTER META INTAKE FLOW");
              console.log(
                "TRACE: RETURNING RESPONSE — STAGE =",
                currentState?.stage
              );
              return res.status(200).json({
                ok: true,
                mode,
                gated: true,
                text: `Daily budget locked at ₹${numericBudget}.`,
              });
            }
          }

          if (!budgetPerDay) {
            const suggestionText = extractedData.budget
              ? `\n\nI detected a possible daily budget of ₹${extractedData.budget}. If this is correct, please type that amount again.`
              : "";
            console.log("TRACE: ENTER META INTAKE FLOW");
            console.log(
              "TRACE: RETURNING RESPONSE — STAGE =",
              currentState?.stage
            );
            return res.status(200).json({
              ok: true,
              mode,
              gated: true,
              text: `What is your DAILY budget in INR?${suggestionText}`,
            });
          }
        }

        // STEP B — Duration (explicit confirmation required)
        if (!totalDays) {
          const daysAnswerMatch = instruction.match(
            /^\s*(\d+)\s*(?:day|days)?\s*$/i
          );

          if (daysAnswerMatch) {
            const numericDays = parseInt(daysAnswerMatch[1], 10);
            if (!Number.isNaN(numericDays) && numericDays > 0) {
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
              const newState = {
                ...lockedCampaignState,
                total_days: numericDays,
                locked_at: new Date().toISOString(),
              };
              await saveAnswerMemory(
                baseUrl,
                effectiveBusinessId,
                { campaign_state: newState },
                session.user.email.toLowerCase()
              );
              lockedCampaignState = newState;
              totalDays = numericDays;
              console.log("TRACE: ENTER META INTAKE FLOW");
              console.log(
                "TRACE: RETURNING RESPONSE — STAGE =",
                currentState?.stage
              );
              return res.status(200).json({
                ok: true,
                mode,
                gated: true,
                text: `Campaign duration locked for ${numericDays} days.`,
              });
            }
          }

          if (!totalDays) {
            const suggestionText = extractedData.duration
              ? `\n\nI detected a possible duration of ${extractedData.duration} days. If this is correct, please type that number again.`
              : "";
            console.log("TRACE: ENTER META INTAKE FLOW");
            console.log(
              "TRACE: RETURNING RESPONSE — STAGE =",
              currentState?.stage
            );
            return res.status(200).json({
              ok: true,
              mode,
              gated: true,
              text: `For how many days should this campaign run?${suggestionText}`,
            });
          }
        }
      }
    }


    // ============================================================
    // 🔒 LOCK CAMPAIGN STATE — OBJECTIVE & DESTINATION FINAL
    // ============================================================

    if (mode === "meta_ads_plan" && selectedMetaObjective && effectiveBusinessId) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

      const newState = {
        ...lockedCampaignState, // Preserve existing state (service/location if any)
        stage: "objective_selected",
        objective: selectedMetaObjective,
        destination: selectedDestination,
        locked_at: new Date().toISOString(),
      };

      await saveAnswerMemory(baseUrl, effectiveBusinessId, {
        campaign_state: newState,
      }, session.user.email.toLowerCase());

      // Update local state
      lockedCampaignState = newState;
    }

    // ============================================================
    // 🔘 META CTA RESOLUTION — FORCED MODE
    // ============================================================

    let resolvedCTA = null;

    // FORCE CTA based on destination
    if (selectedDestination === "call") {
      resolvedCTA = "CALL_NOW";
    }

    if (
      selectedDestination === "whatsapp" ||
      selectedDestination === "messages"
    ) {
      resolvedCTA = "SEND_MESSAGE";
    }

    // Traffic / profile visits handled separately (NOT forced)

    // ============================================================
    // 💬 MESSAGE DESTINATION SELECTION (USER MUST CHOOSE)
    // ============================================================

    let selectedMessageChannel = null;

    // If user chose "messages", we must ask WHERE
    if (!isPlanProposed && selectedDestination === "messages" && !lockedCampaignState?.message_channel) {
      const msg = `
Where do you want people to message you?

Please choose ONE option:

1. Instagram messages
2. Facebook Messenger
3. WhatsApp
4. All available
`.trim();

      console.log("TRACE: ENTER META INTAKE FLOW");
      console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
      return res.status(200).json({
        ok: true,
        mode,
        gated: true,
        text: msg,
      });
    }

    // Handle follow-up selection
    if (selectedDestination === "messages") {
      if (lowerInstruction === "1" || lowerInstruction.includes("instagram")) {
        selectedMessageChannel = ["instagram"];
      }

      if (lowerInstruction === "2" || lowerInstruction.includes("facebook")) {
        selectedMessageChannel = ["facebook"];
      }

      if (lowerInstruction === "3" || lowerInstruction.includes("whatsapp")) {
        selectedMessageChannel = ["whatsapp"];
      }

      if (lowerInstruction === "4" || lowerInstruction.includes("all")) {
        selectedMessageChannel = ["instagram", "facebook", "whatsapp"];
      }
    }
    // ============================================================
    // ✏️ CTA OVERRIDE (USER CORRECTION MODE)
    // ============================================================

    let overriddenCTA = null;

    if (lowerInstruction.includes("change cta")) {
      if (lowerInstruction.includes("sign up")) {
        overriddenCTA = "SIGN_UP";
      }
      if (lowerInstruction.includes("learn more")) {
        overriddenCTA = "LEARN_MORE";
      }
      if (lowerInstruction.includes("call")) {
        overriddenCTA = "CALL_NOW";
      }
      if (lowerInstruction.includes("message")) {
        overriddenCTA = "SEND_MESSAGE";
      }
    }

    if (overriddenCTA) {
      resolvedCTA = overriddenCTA;
    }

    // ============================================================
    // 🔘 META CTA SELECTION — OBJECTIVE AWARE (HARD BLOCK)
    // ============================================================

    // Meta-approved CTA options per objective
    const META_CTA_MAP = {
      TRAFFIC: {
        options: ["LEARN_MORE", "SIGN_UP", "VIEW_MORE"],
        recommended: "LEARN_MORE",
      },
      LEAD_GENERATION: {
        options: ["SIGN_UP", "APPLY_NOW", "GET_QUOTE"],
        recommended: "SIGN_UP",
      },
      MESSAGES: {
        options: ["SEND_MESSAGE"],
        recommended: "SEND_MESSAGE",
      },
      CALLS: {
        options: ["CALL_NOW"],
        recommended: "CALL_NOW",
      },
      WHATSAPP: {
        options: ["WHATSAPP"],
        recommended: "WHATSAPP",
      },
    };

    // Check if CTA already stored in memory (simple heuristic)
    const lowerText = instruction.toLowerCase();
    const ctaKeywords = [
      "learn more",
      "sign up",
      "apply",
      "call",
      "message",
      "whatsapp",
    ];

    const hasCTA =
      ctaKeywords.some((k) => lowerText.includes(k)) ||
      lowerText.includes("cta");

    // ============================================================
    // 🔘 META CTA SELECTION — DISABLED (Let Gemini Propose Strategy)
    // ============================================================
    /*
    if (
      mode === "meta_ads_plan" &&
      selectedMetaObjective &&
      (
        selectedMetaObjective !== "TRAFFIC" ||
        (selectedMetaObjective === "TRAFFIC" && detectedLandingPage)
      ) &&
      !resolvedCTA &&
      !hasCTA
    ) {
    
      const ctaConfig =
        META_CTA_MAP[selectedMetaObjective] ||
        META_CTA_MAP.TRAFFIC;
    
      return res.status(200).json({
        ok: true,
        mode,
        gated: true,
        text:
          `Which Call-To-Action button do you want on your ad?\n\n` +
          `Based on your objective, Meta allows these options:\n\n` +
          ctaConfig.options.map((c, i) => `${i + 1}. ${c}`).join("\n") +
          `\n\nRecommended: ${ctaConfig.recommended}\n\n` +
          `Reply with the option number or CTA name.`,
      });
    }
    */


    // ============================================================
    // 🎯 META ADS FULL FLOW (AUTO → CONFIRM → CREATE PAUSED)
    // [REMOVED DUPLICATE LOGIC - NOW HANDLED BY STATE MACHINE ABOVE]
    // ============================================================

    // ============================================================
    // 💾 STORE META OBJECTIVE IN MEMORY (ONCE USER SELECTS)
    // ============================================================

    if (
      mode === "meta_ads_plan" &&
      selectedMetaObjective &&
      selectedDestination &&
      effectiveBusinessId
    ) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

      await saveAnswerMemory(baseUrl, effectiveBusinessId, {
        meta_objective: selectedMetaObjective,
        meta_destination: selectedDestination,
      }, session.user.email.toLowerCase());
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
    if (Object.keys(detectedAnswers).length > 0) {
      await saveAnswerMemory(baseUrl, effectiveBusinessId, detectedAnswers, session.user.email.toLowerCase());
    }
    // ============================================================
    // 🔒 INJECT LOCKED CAMPAIGN STATE INTO GEMINI CONTEXT (AUTHORITATIVE)
    // ============================================================

    const lockedContext = lockedCampaignState
      ? `
LOCKED CAMPAIGN STATE (DO NOT CHANGE OR RE-ASK):
- Objective: ${lockedCampaignState.objective || "N/A"} (Auction)
- Conversion Location: ${lockedCampaignState.destination || "N/A"}
- Performance Goal: ${lockedCampaignState.performance_goal || "N/A"}
- Service: ${lockedCampaignState.service || "N/A"}
- Location: ${lockedCampaignState.location || "N/A"}
- Daily Budget (INR): ${lockedCampaignState.budget_per_day || "N/A"}
- Duration (days): ${lockedCampaignState.total_days || "N/A"}

RULES:
- You MUST NOT ask again for these locked fields.
- You MUST use these as FINAL.
- All campaigns are created as **PAUSED** (Off) by default.
- Only suggest: budget, targeting, creatives, duration.
`
      : "";

    const systemPrompt = `
You are GabbarInfo AI – a senior digital marketing strategist and backend AGENT.

YOUR CORE JOB:
- Follow the STRICT 12-STEP CAMPAIGN CREATION FLOW.
- Do NOT skip steps.
- Do NOT hallucinate assets (images/URLs).

====================================================
STRICT 12-STEP META CAMPAIGN FLOW
====================================================
1.  User Request (Start)
2.  Context Check (Business Intake / Meta Connection)
3.  Objective Confirmation (OUTCOME_TRAFFIC/OUTCOME_LEADS etc. -> Auction)
4.  Conversion Location (Website/Call/WhatsApp etc.)
5.  Performance Goal (Link Clicks/Landing Page Views etc.)
6.  Service Confirmation (Product/Service to promote) -> [LOCKED]
7.  Location Confirmation (City/Area) -> [LOCKED]
8.  Strategy Proposal (Generate JSON Plan) -> [LOCKED]
9.  Image Generation (OpenAI) -> [AUTOMATED]
10. Image Upload (Meta) -> [AUTOMATED]
11. Final Confirmation (Paused Campaign)
12. Execution (Create on Meta) -> [SYSTEM AUTOMATED]

====================================================
CURRENT STATUS & INSTRUCTIONS
====================================================

${lockedContext ? "✅ LOCKED CONTEXT DETECTED (Core steps complete)" : "⚠️ NO LOCKED CONTEXT (Steps 1-7 In Progress)"}

IF LOCKED CONTEXT EXISTS (Service + Location + Objective):
- You are at STEP 8 (Strategy Proposal).
- You MUST generate the "Backend JSON" for the campaign plan immediately.
- Do NOT ask more questions.
- Use the JSON schema defined in your Mode Focus.
- The plan MUST include:
  - Campaign Name (Creative & Descriptive)
  - Budget (Daily, INR)
  - Targeting (Location from Locked Context)
  - Targeting Suggestions (interests, demographics)
  - Creative (Headline, Primary Text, Image Prompt)

IF NO LOCKED CONTEXT:
- You are likely in Steps 1-7.
- Ask ONE clear question at a time to get the missing info (Objective, Service, Location).
- Do NOT generate JSON yet.

====================================================
CRITICAL BUSINESS RULES
====================================================
- If "Forced Meta Business Context" is present, use it.
- NEVER invent URLs. Use verified landing pages only.
- Assume India/INR defaults.
- For Step 8 (Strategy), output JSON ONLY if you have all details.
- For Step 12 (Execution), NEVER simulate the output or say it is completed unless you see the REAL API output with a Campaign ID. If the pipeline is processing, tell the user to wait or that "Execution is handled by the system".
- IMPORTANT: If a user says "YES" or "LAUNCH", the backend code handles the execution. You should NOT hallucinate a success message with fake IDs.

====================================================
PLATFORM MODE GUIDANCE
====================================================
${modeFocus}
${lockedContext}
====================================================
CLIENT CONTEXT
====================================================
Verified Meta Assets:
${verifiedMetaAssets ? JSON.stringify(verifiedMetaAssets, null, 2) : "(none)"}

Forced Meta Business Context:
${forcedBusinessContext ? JSON.stringify(forcedBusinessContext, null, 2) : "(none)"}

Auto-Detected Business Intake:
${autoBusinessContext ? JSON.stringify(autoBusinessContext, null, 2) : "(none)"}

RAG / Memory Context:
${ragContext || "(none)"}
`.trim();
    // ============================================================
    // 🚫 HARD STOP — PREVENT URL HALLUCINATION (META TRAFFIC)
    // ============================================================

    let finalLandingPage = null;

    if (selectedDestination === "website") {
      if (!detectedLandingPage) {
        return res.status(200).json({
          ok: true,
          gated: true,
          text:
            "I could not find a website URL from your connected assets.\n\n" +
            "Please paste the exact URL you want people to visit.",
        });
      }

      finalLandingPage = detectedLandingPage;
    }

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

    // 🛑 BLOCK GEMINI IF GATES ARE NOT PASSED (Double Safety)
    if (
      !isPlanProposed &&
      mode === "meta_ads_plan" &&
      (
        !lockedCampaignState?.objective ||
        !lockedCampaignState?.destination ||
        !lockedCampaignState?.performance_goal ||
        !lockedCampaignState?.service ||
        !lockedCampaignState?.location ||
        !lockedCampaignState?.budget_per_day ||
        !lockedCampaignState?.total_days
      )
    ) {
      // Technically unreachable if gates are working, but safe fallback
      return res.status(200).json({ ok: true, text: "waiting for details..." });
    }

    // ⚡ CRITICAL SHORT-CIRCUIT: Skip Gemini if plan exists and user confirms
    if (
      (lockedCampaignState?.stage === "PLAN_CONFIRMED" || lockedCampaignState?.stage === "IMAGE_GENERATED" || lockedCampaignState?.stage === "READY_TO_LAUNCH") &&
      lockedCampaignState?.plan &&
      (lowerInstruction.includes("yes") ||
        lowerInstruction.includes("approve") ||
        lowerInstruction.includes("confirm") ||
        lowerInstruction.includes("proceed") ||
        lowerInstruction.includes("launch") ||
        lowerInstruction.includes("generate") ||
        lowerInstruction.includes("image"))
    ) {
      // 🛡️ IDEMPOTENCY PROTECTION
      const now = Date.now();
      const lastUpdate = lockedCampaignState.locked_at ? new Date(lockedCampaignState.locked_at).getTime() : 0;
      if (now - lastUpdate < 10000 && lockedCampaignState.stage !== "PLAN_PROPOSED") {
        console.warn(`[IDEMPOTENCY] Short-circuit blocked duplicate request for ${effectiveBusinessId}`);
        return res.status(200).json({ ok: true, mode, text: "I'm already working on that! One moment..." });
      }

      console.log(`[PROD_LOG] 🚀 SHORT-CIRCUIT: Transitioning Started | User: ${session.user.email} | ID: ${effectiveBusinessId} | From: ${lockedCampaignState.stage}`);

      let currentState = { ...lockedCampaignState, locked_at: new Date().toISOString() };
      // 🔒 SINGLE SOURCE OF TRUTH — waterfall must ONLY use currentState (mutated as state)
      let state = currentState;

      // 🛡️ Safety Check: Ensure plan is valid
      if (!state.plan || !state.plan.campaign_name) {
        console.warn("Plan missing at confirmation. Recreating automatically.");

        const regeneratedPlan = await generateMetaCampaignPlan({
          lockedCampaignState,
          autoBusinessContext,
          verifiedMetaAssets,
          detectedLandingPage,
        });

        const repairedState = {
          ...state,
          stage: "PLAN_PROPOSED",
          plan: regeneratedPlan,
          locked_at: new Date().toISOString()
        };

        console.log("TRACE: PLAN PROPOSED");
        console.log("TRACE: STAGE (plan) =", state?.stage);
        console.log("TRACE: PLAN OBJECT =", repairedState.plan);

        await saveAnswerMemory(
          process.env.NEXT_PUBLIC_BASE_URL,
          effectiveBusinessId,
          { campaign_state: repairedState },
          session.user.email.toLowerCase()
        );

        state = repairedState;
        currentState = repairedState; // Keep alias in sync

        // 🛡️ PATCH 1: HARD STOP AT PLAN_PROPOSED (Regeneration path)
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({
          ok: true,
          mode,
          text: `**Plan Proposed: ${repairedState.plan.campaign_name}**\nReply **YES** to confirm and proceed.`
        });
      }

      // 🛡️ PATCH 3: WATERFALL ENTRY RULE
      if (mode === "meta_ads_plan") {
        console.log("TRACE: ENTER META WATERFALL");
        console.log("TRACE: CURRENT STAGE =", currentState?.stage);

        if (!lockedCampaignState || (lockedCampaignState.stage !== "PLAN_CONFIRMED" && lockedCampaignState.stage !== "IMAGE_GENERATED" && lockedCampaignState.stage !== "READY_TO_LAUNCH")) {
          console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
          return res.status(200).json({
            ok: true,
            mode,
            text: "Please review the proposed plan and reply YES to confirm before I proceed."
          });
        }
      }
      let waterfallLog = [];
      let errorOcurred = false;
      let stopReason = null;

      const stage = state.stage;
      console.log("📍 Waterfall Check - Stage:", stage);
      console.log("📍 Waterfall Check - Plan Name:", state.plan.campaign_name);

      // --- STEP 9: IMAGE GENERATION ---
      const isImageGenerated = !!state.creative?.imageBase64 || !!state.creative?.imageUrl;
      const isImageUploaded = !!state.meta?.uploadedImageHash || !!state.meta?.imageMediaId;

      if (!isImageGenerated && (stage === "PLAN_CONFIRMED")) {
        console.log("TRACE: IMAGE GENERATION ATTEMPT");
        console.log("TRACE: IMAGE EXISTS =", !!state.creative);

        console.log("🚀 Waterfall: Starting Image Generation...");
        const plan = state.plan || {};
        const adSet0 = (Array.isArray(plan.ad_sets) ? plan.ad_sets[0] : (plan.ad_sets || {}));
        const creativeResult = adSet0.ad_creative || adSet0.creative || adSet0.ads?.[0]?.creative || {};

        const imagePrompt = creativeResult.image_prompt || creativeResult.image_generation_prompt || creativeResult.imagePrompt || creativeResult.primary_text || `${plan.campaign_name || "New Campaign"} ad image`;

        try {
          const imgRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/images/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: imagePrompt }),
          });
          const imgJson = await parseResponseSafe(imgRes);

          if (imgJson.imageBase64) {
            const newCreative = {
              ...creativeResult,
              imageBase64: imgJson.imageBase64,
              imageUrl: `data:image/png;base64,${imgJson.imageBase64}`
            };

            // 🔒 UPDATE STATE
            state = { ...state, stage: "IMAGE_GENERATED", creative: newCreative };
            currentState = state; // Sync

            // 💾 PERSIST IMMEDIATELY
            await saveAnswerMemory(
              process.env.NEXT_PUBLIC_BASE_URL,
              effectiveBusinessId,
              { campaign_state: state },
              session.user.email.toLowerCase()
            );

            console.log("TRACE: PIPELINE STEP REPORT");
            console.log("TRACE: STAGE (pipeline) =", state.stage);
            console.log("TRACE: IMAGE EXISTS =", !!state.creative);
            console.log("TRACE: IMAGE UPLOADED =", !!state.meta?.uploadedImageHash);

            waterfallLog.push("✅ Step 9: Image Generated");
          } else {
            errorOcurred = true;
            stopReason = "Image Generation Failed (No Base64 returned)";
          }
        } catch (e) {
          errorOcurred = true;
          stopReason = `Image Generation Error: ${e.message}`;
        }
      } else {
        console.log("TRACE: PIPELINE STEP REPORT");
        console.log("TRACE: STAGE (pipeline) =", state.stage);
        console.log("TRACE: IMAGE EXISTS =", !!state.creative);
        console.log("TRACE: IMAGE UPLOADED =", !!state.meta?.uploadedImageHash);

        waterfallLog.push("⏭️ Step 9: Image Already Exists");
      }

      // --- STEP 10: IMAGE UPLOAD ---
      if (!errorOcurred) {
        // 🔒 PATCH: Use strict upload check
        if (state.creative?.imageBase64 && !isImageUploaded) {
          console.log("TRACE: IMAGE UPLOAD ATTEMPT");
          console.log("TRACE: IMAGE HASH =", state.meta?.uploadedImageHash);

          console.log("TRACE: UPLOADING IMAGE TO META");
          console.log("🚀 Waterfall: Uploading Image to Meta...");
          try {
            const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/upload-image`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Client-Email": __currentEmail || "" },
              body: JSON.stringify({ imageBase64: state.creative.imageBase64 })
            });
            const uploadJson = await parseResponseSafe(uploadRes);
            console.log("TRACE: IMAGE UPLOAD RESPONSE =", uploadJson);
            const iHash = uploadJson.imageHash || uploadJson.image_hash;

            if (uploadJson.ok && iHash) {
              // 🔒 PATCH: Persist Upload Hash Immediately using STATE
              const metaUpdate = {
                ...state.meta,
                uploadedImageHash: iHash,
                imageMediaId: uploadJson.image_id || null
              };

              state = {
                ...state,
                image_hash: iHash,
                meta: metaUpdate
              };
              currentState = state; // Sync

              await saveAnswerMemory(
                process.env.NEXT_PUBLIC_BASE_URL,
                effectiveBusinessId,
                { campaign_state: currentState },
                session.user.email.toLowerCase()
              );

              waterfallLog.push("✅ Step 10: Image Uploaded to Meta");
            } else {
              errorOcurred = true;
              stopReason = `Meta Upload Failed: ${uploadJson.message || "Unknown error"}`;
            }
          } catch (e) {
            errorOcurred = true;
            stopReason = `Meta Upload Error: ${e.message}`;
          }
        } else if (isImageUploaded) {
          console.log("TRACE: PIPELINE STEP REPORT");
          console.log("TRACE: STAGE (pipeline) =", state.stage);
          console.log("TRACE: IMAGE EXISTS =", !!state.creative);
          console.log("TRACE: IMAGE UPLOADED =", !!state.meta?.uploadedImageHash);

          waterfallLog.push("⏭️ Step 10: Image Already Uploaded");
        }
      }

      // 🔒 MICRO PATCH: FORCE STAGE ADVANCEMENT AFTER VERIFIED IMAGE UPLOAD
      if (
        state.stage === "PLAN_PROPOSED" &&
        (state.meta?.uploadedImageHash || state.meta?.imageMediaId)
      ) {
        state = {
          ...state,
          stage: "READY_TO_LAUNCH",
          locked_at: new Date().toISOString()
        };
        currentState = state; // Sync

        await saveAnswerMemory(
          process.env.NEXT_PUBLIC_BASE_URL,
          effectiveBusinessId,
          { campaign_state: state },
          session.user.email.toLowerCase()
        );
      }

      // --- STEP 12: EXECUTION (Final Step) ---
      if (!errorOcurred) {
        // 🔒 PATCH: Execution requires READY_TO_LAUNCH strict
        const isReady = state.stage === "READY_TO_LAUNCH" && state.image_hash;
        const wantsLaunch = lowerInstruction.includes("launch") || lowerInstruction.includes("execute") || lowerInstruction.includes("run") || lowerInstruction.includes("publish") || lowerInstruction.includes("yes") || lowerInstruction.includes("ok");

        if (isReady && (wantsLaunch || state.objective === "TRAFFIC")) {
          console.log("🚀 Waterfall: Executing Campaign on Meta...");
          try {
            const plan = state.plan;
            const finalPayload = {
              ...plan,
              ad_sets: plan.ad_sets.map(adset => ({
                ...adset,
                ad_creative: { ...adset.ad_creative, image_hash: state.image_hash }
              }))
            };

            const execRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/execute-campaign`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Client-Email": __currentEmail || "" },
              body: JSON.stringify({ platform: "meta", payload: finalPayload })
            });
            const execJson = await execRes.json();

            if (execJson.ok) {
              await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, {
                campaign_state: { stage: "COMPLETED", final_result: execJson }
              }, session.user.email.toLowerCase());
              return res.status(200).json({
                ok: true,
                text: `🎉 **Campaign Published Successfully!**\n\n**Pipeline Status**:\n${waterfallLog.join("\n")}\n✅ Step 12: Campaign Created (PAUSED)\n\n**Meta Details**:\n- **Campaign Name**: ${plan.campaign_name}\n- **Campaign ID**: \`${execJson.id || "N/A"}\`\n- **Ad Account ID**: \`${verifiedMetaAssets?.ad_account?.id || "N/A"}\`\n- **Status**: PAUSED\n\nYour campaign is now waiting in your Meta Ads Manager for final review.`
              });
            } else {
              errorOcurred = true;
              stopReason = `Meta Execution Failed: ${execJson.message || "Unknown error"}`;
            }
          } catch (e) {
            errorOcurred = true;
            stopReason = `Meta Execution Error: ${e.message}`;
          }
        }
      }

      // Save progress reached
      if (effectiveBusinessId) {
        console.log(`[PROD_LOG] ✅ SHORT-CIRCUIT: Transition Finished | ID: ${effectiveBusinessId} | FinalStage: ${state.stage}`);
        await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: state }, session.user.email.toLowerCase());
      }

      // If we stopped due to error or waiting
      let feedbackText = "";
      if (errorOcurred) {
        feedbackText = `❌ **Automation Interrupted**:\n\n**Error**: ${stopReason}\n\n**Pipeline Progress**:\n${waterfallLog.join("\n")}\n\nI've saved the progress so far. Please check the error above and reply to try again.`;
      } else if (state.stage === "IMAGE_GENERATED") {
        feedbackText = `✅ **Image Generated Successfully**\n\n[Image Generated]\n\n**Next Steps**:\n1. Upload image to Meta Assets\n2. Create paused campaign on Facebook/Instagram\n\nReply **LAUNCH** to complete these steps automatically.`;
      } else if (state.stage === "READY_TO_LAUNCH") {
        feedbackText = `✅ **Image Uploaded & Ready**\n\nEverything is set for campaign launch.\n\n**Details**:\n- Campaign: ${state.plan.campaign_name}\n- Budget: ${state.plan.budget?.amount || "500"} INR\n\nReply **LAUNCH** to publish the campaign to Meta.`;
      } else {
        feedbackText = `**Current Pipeline Progress**:\n${waterfallLog.join("\n") || "No steps completed in this turn."}\n\n(Debug: Stage=${state.stage}, Plan=${state.plan ? "Yes" : "No"}, Image=${state.creative?.imageBase64 ? "Yes" : "No"}, Hash=${state.image_hash || "No"})\n\nWaiting for your confirmation...`;
      }

      return res.status(200).json({ ok: true, text: feedbackText, imageUrl: state.creative?.imageUrl, mode });
    }

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: finalPrompt }],
        },
      ],
    });

    const rawText =
      (result &&
        result.response &&
        typeof result.response.text === "function" &&
        result.response.text()) ||
      "";

    let text = rawText;

    // 🧹 CLEANUP: If Gemini outputs JSON, hide it from the user flow (User complaint: "Jumps to JSON").
    // We only want to show the JSON *Summary* text if passing a proposed plan.
    /*
    if (activeBusinessId && text.includes("```json")) {
      // We will strip the JSON block for the display text
      text = text.replace(/```json[\s\S]*?```/g, "").trim();
      if (!text) text = "I have drafted a plan based on your requirements. Please check it internally.";
    }
    */

    // 🕵️ DETECT AND SAVE JSON PLAN (FROM GEMINI)
    // Supports: ```json ... ```, ``` ... ```, or plain JSON starting with {
    if (effectiveBusinessId) {
      let jsonString = null;

      // 1. Try code blocks
      const strictMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (strictMatch) {
        jsonString = strictMatch[1];
      } else {
        // 2. Try finding the outermost JSON object (Robust Fallback)
        // Look for the first '{' and the last '}'
        const start = rawText.indexOf('{');
        const end = rawText.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          // Verify it looks like our JSON (has campaign_name or EXECUTE or campaign OR objective)
          const candidate = rawText.substring(start, end + 1);
          if (
            candidate.includes("campaign") ||
            candidate.includes("objective") ||
            candidate.includes("EXECUTE") ||
            candidate.includes("ad_sets") ||
            candidate.includes("budget")
          ) {
            jsonString = candidate;
          }
        }
      }

      if (jsonString) {
        console.log("TRACE: DIRECT JSON DETECTED — USER PROVIDED PLAN");
        try {
          let planJson = JSON.parse(jsonString);

          // 🔄 NORMALIZE JSON: If Gemini gave the "Nested" structure, flatten it to our Standard Schema
          if (planJson.campaign_data) {
            console.log("🔄 Normalizing Gemini Nested JSON Plan...");
            const d = planJson.campaign_data;
            const s = d.campaign_settings || {};
            const t = d.targeting_plan || {};
            const c = d.creative_plan?.[0] || {};

            planJson = {
              campaign_name: s.campaign_name || "New Campaign",
              objective: (s.objective && (s.objective.includes("LEAD") || s.objective.includes("PROSPECT"))) ? "OUTCOME_LEADS" : (s.objective?.includes("SALE") || s.objective?.includes("CONVERSION") ? "OUTCOME_SALES" : "OUTCOME_TRAFFIC"),
              performance_goal: s.performance_goal || d.performance_goal || lockedCampaignState?.performance_goal || "MAXIMIZE_LINK_CLICKS",
              budget: {
                amount: s.daily_budget_inr || s.budget?.amount || 500,
                currency: "INR",
                type: "DAILY"
              },
              targeting: {
                geo_locations: { countries: ["IN"], cities: t.locations?.map(l => ({ name: l })) || [] },
                age_min: parseInt(t.age_range?.split("-")[0]) || 18,
                age_max: parseInt(t.age_range?.split("-")[1]) || 65,
                targeting_suggestions: t.targeting_suggestions || {}
              },
              ad_sets: [
                {
                  name: c.creative_set_name || "Ad Set 1",
                  status: "PAUSED",
                  ad_creative: {
                    imagePrompt: c.image_prompt || c.image_generation_prompt || c.imagePrompt || "Ad Image",
                    primary_text: c.primary_text || "",
                    headline: c.headline || "",
                    call_to_action: s.call_to_action || "LEARN_MORE",
                    destination_url: s.destination_url || "https://gabbarinfo.com"
                  }
                }
              ]
            };
          }

          // 🔄 NORMALIZE JSON: Variation 2 (Step/Details structure)
          if (planJson.campaign_details) {
            console.log("🔄 Normalizing Gemini JSON Variation 2...");
            const d = planJson.campaign_details;
            const ads = Array.isArray(planJson.ad_sets) ? planJson.ad_sets[0] : (planJson.ad_sets || {});
            const c = ads.ad_creative || ads.creative || {};

            planJson = {
              campaign_name: d.name || "New Campaign",
              objective: (d.objective && (d.objective.includes("LEAD") || d.objective.includes("PROSPECT"))) ? "OUTCOME_LEADS" : (d.objective?.includes("SALE") || d.objective?.includes("CONVERSION") ? "OUTCOME_SALES" : "OUTCOME_TRAFFIC"),
              performance_goal: d.performance_goal || ads.performance_goal || lockedCampaignState?.performance_goal || "MAXIMIZE_LINK_CLICKS",
              budget: {
                amount: d.budget_daily_inr || ads.daily_budget?.amount || 500,
                currency: "INR",
                type: "DAILY"
              },
              targeting: {
                geo_locations: {
                  countries: d.targeting?.location === "India" ? ["IN"] : ["IN"],
                  cities: []
                },
                age_min: d.targeting?.age_min || 18,
                age_max: d.targeting?.age_max || 65
              },
              ad_sets: [
                {
                  name: ads.name || "Ad Set 1",
                  status: "PAUSED",
                  ad_creative: {
                    imagePrompt: c.image_prompt || c.image_generation_prompt || c.imagePrompt || "Ad Image",
                    primary_text: c.primary_text || "",
                    headline: c.headline || "",
                    call_to_action: c.call_to_action || "LEARN_MORE",
                    destination_url: d.destination || c.landing_page || "https://gabbarinfo.com"
                  }
                }
              ]
            };
          }

          // 🔄 NORMALIZE JSON: Variation 3 (EXECUTE: true structure)
          if (planJson.EXECUTE && planJson.campaign_plan) {
            console.log("🔄 Normalizing Gemini JSON Variation 3 (EXECUTE: true)...");
            const cp = planJson.campaign_plan;
            const d = cp.details || cp;
            const ads = Array.isArray(cp.ad_sets) ? cp.ad_sets[0] : (cp.ad_sets || {});
            const c = ads.ad_creative || ads.creative || {};

            planJson = {
              campaign_name: d.name || d.campaign_name || "New Campaign",
              objective: (d.objective && (d.objective.includes("LEAD") || d.objective.includes("PROSPECT"))) ? "OUTCOME_LEADS" : (d.objective?.includes("SALE") || d.objective?.includes("CONVERSION") ? "OUTCOME_SALES" : "OUTCOME_TRAFFIC"),
              performance_goal: d.performance_goal || ads.performance_goal || lockedCampaignState?.performance_goal || "MAXIMIZE_LINK_CLICKS",
              budget: {
                amount: d.budget_daily_inr || d.budget?.amount || 500,
                currency: "INR",
                type: "DAILY"
              },
              targeting: {
                geo_locations: {
                  countries: d.targeting?.location === "India" ? ["IN"] : ["IN"],
                  cities: []
                },
                age_min: d.targeting?.age_min || 18,
                age_max: d.targeting?.age_max || 65
              },
              ad_sets: [
                {
                  name: ads.name || "Ad Set 1",
                  status: "PAUSED",
                  ad_creative: {
                    imagePrompt: c.image_prompt || c.image_generation_prompt || c.imagePrompt || "Ad Image",
                    primary_text: c.primary_text || "",
                    headline: c.headline || "",
                    call_to_action: c.call_to_action || "LEARN_MORE",
                    destination_url: d.destination || c.landing_page || "https://gabbarinfo.com"
                  }
                }
              ]
            };
          }

          // 🔄 NORMALIZE JSON: Variation 5 (campaigns array structure)
          if (planJson.campaigns && Array.isArray(planJson.campaigns)) {
            console.log("🔄 Normalizing Gemini JSON Variation 5 (campaigns array)...");
            const c = planJson.campaigns[0];
            const adSet = c.adSets?.[0] || {};
            const creative = adSet.adCreatives?.[0]?.creative || {};
            const tgt = adSet.targeting || {};

            // Map Objective
            let rawObj = c.objective || "OUTCOME_TRAFFIC";
            let objective = (rawObj.includes("LEAD") || rawObj.includes("PROSPECT")) ? "OUTCOME_LEADS" : (rawObj.includes("SALE") || rawObj.includes("CONVERSION") ? "OUTCOME_SALES" : "OUTCOME_TRAFFIC");

            planJson = {
              campaign_name: c.name || "New Campaign",
              objective: objective,
              performance_goal: c.performance_goal || adSet.performance_goal || lockedCampaignState?.performance_goal || "MAXIMIZE_LINK_CLICKS",
              budget: {
                amount: adSet.daily_budget || 500,
                currency: adSet.currency || "INR",
                type: "DAILY"
              },
              targeting: {
                geo_locations: {
                  countries: ["IN"],
                  cities: tgt.geo_locations?.cities?.map(city => ({ name: city.name })) || []
                },
                age_min: tgt.age_min || 18,
                age_max: tgt.age_max || 65
              },
              ad_sets: [
                {
                  name: adSet.name || "Ad Set 1",
                  status: c.status || "PAUSED",
                  ad_creative: {
                    imagePrompt: creative.image_prompt || creative.imagePrompt || "Ad Image",
                    primary_text: creative.primaryText_options?.[0] || "",
                    headline: creative.headline_options?.[0] || "",
                    call_to_action: creative.call_to_action || "LEARN_MORE",
                    destination_url: creative.destination_url || "https://gabbarinfo.com"
                  }
                }
              ]
            };
          }

          // 🔄 NORMALIZE JSON: Variation 8 (User Reported meta_campaign_plan)
          if (planJson.meta_campaign_plan || planJson.campaign_creation_flow_step) {
            console.log("🔄 Normalizing reported Meta Campaign Plan structure...");
            const mcp = planJson.meta_campaign_plan || {};
            const adSetInput = mcp.ad_set || {};
            const creativeInput = mcp.creative || {};
            const tgt = adSetInput.targeting || {};
            const budget = mcp.budget || {};

            planJson = {
              campaign_name: mcp.campaign_name || "New Campaign",
              objective: (mcp.campaign_objective === "TRAFFIC" || (mcp.campaign_objective && mcp.campaign_objective.includes("CLICK"))) ? "OUTCOME_TRAFFIC" : (mcp.campaign_objective || "OUTCOME_TRAFFIC"),
              performance_goal: adSetInput.performance_goal || "MAXIMIZE_LINK_CLICKS",
              budget: {
                amount: budget.amount || 500,
                currency: budget.currency || "INR",
                type: budget.type || "DAILY"
              },
              targeting: {
                geo_locations: {
                  countries: ["IN"],
                  cities: tgt.geo_locations?.map(c => {
                    if (typeof c === "string") {
                      const parts = c.split(",");
                      return { name: parts[0].trim() };
                    }
                    return null;
                  }).filter(Boolean) || []
                },
                age_min: parseInt(tgt.age_range?.split("-")[0]) || 18,
                age_max: parseInt(tgt.age_range?.split("-")[1]?.replace("+", "")) || 65,
                targeting_suggestions: {
                  interests: tgt.detailed_targeting_suggestions || []
                }
              },
              ad_sets: [
                {
                  name: "Ad Set 1",
                  status: "PAUSED",
                  ad_creative: {
                    imagePrompt: creativeInput.imagePrompt || creativeInput.image_prompt || "Ad Image",
                    primary_text: creativeInput.primary_text || "",
                    headline: creativeInput.headline || "",
                    call_to_action: creativeInput.call_to_action || "LEARN_MORE",
                    destination_url: creativeInput.destination_url || "https://gabbarinfo.com"
                  }
                }
              ]
            };
          }

          // 🔄 NORMALIZE JSON: Variation 6 (campaign + adSets + ads structure)
          if (planJson.campaign && planJson.adSets && Array.isArray(planJson.adSets)) {
            console.log("🔄 Normalizing Gemini JSON Variation 6 (campaign/adSets/ads)...");
            const c = planJson.campaign;
            const adSet = planJson.adSets[0] || {};
            // Try to find creative in ads array or adSet
            let creative = {};
            if (planJson.ads && Array.isArray(planJson.ads)) {
              creative = planJson.ads[0]?.creative_spec || planJson.ads[0]?.creative || {};
            }

            // Map Objective
            let rawObj = c.objective || "OUTCOME_TRAFFIC";
            let objective = (rawObj.includes("LEAD") || rawObj.includes("PROSPECT")) ? "OUTCOME_LEADS" : (rawObj.includes("SALE") || rawObj.includes("CONVERSION") ? "OUTCOME_SALES" : "OUTCOME_TRAFFIC");

            // Map Budget
            const budgetAmount = adSet.daily_budget || c.budget?.amount || 500;

            // Map Targeting
            const geo = adSet.targeting?.geo_locations || {};
            const countries = ["IN"]; // Default
            const cities = [];
            if (geo.cities) {
              geo.cities.forEach(city => {
                if (typeof city === "string") cities.push({ name: city });
                else if (city.name) cities.push({ name: city.name });
              });
            }

            // Map Creative Assets
            const assets = creative.assets || {};
            const primaryText = Array.isArray(assets.primaryTextVariations) ? assets.primaryTextVariations[0] : (assets.primaryText || "");
            const headline = Array.isArray(assets.headlines) ? assets.headlines[0] : (assets.headline || "");

            planJson = {
              campaign_name: c.name || "New Campaign",
              objective: objective,
              performance_goal: c.performance_goal || adSet.performance_goal || lockedCampaignState?.performance_goal || "MAXIMIZE_LINK_CLICKS",
              budget: {
                amount: budgetAmount,
                currency: adSet.currency || "INR",
                type: "DAILY"
              },
              targeting: {
                geo_locations: {
                  countries: countries,
                  cities: cities
                },
                age_min: adSet.targeting?.age_min || 18,
                age_max: adSet.targeting?.age_max || 65
              },
              ad_sets: [
                {
                  name: adSet.name || "Ad Set 1",
                  status: c.status || "PAUSED",
                  ad_creative: {
                    imagePrompt: assets.imagePrompt || "Ad Image",
                    primary_text: primaryText,
                    headline: headline,
                    call_to_action: creative.call_to_action_type || "LEARN_MORE",
                    destination_url: creative.link_url || "https://gabbarinfo.com"
                  }
                }
              ]
            };
          }

          // 🔄 NORMALIZE JSON: Variation 7 (Step 8 Flow - "campaign_plan" object)
          if (planJson.campaign_plan || (planJson.step === 8)) {
            console.log("🔄 Normalizing Gemini JSON Variation 7 (Campaign Plan / Step 8)...");

            const cp = planJson.campaign_plan || planJson;
            const adSetsStr = planJson.ad_set_strategy || planJson.ad_sets || [];
            const creativesStr = planJson.creative_strategy || planJson.ad_creatives || [];

            // Extract first items
            const adSetItem = Array.isArray(adSetsStr) ? adSetsStr[0] : (adSetsStr || {});
            const creativeItem = Array.isArray(creativesStr) ? creativesStr[0] : (creativesStr || {});

            const cName = cp.campaign_name || "New Campaign";
            // Map Objective
            let obj = cp.objective || "OUTCOME_TRAFFIC";
            if (obj.includes("LINK") || obj.includes("TRAFFIC")) obj = "OUTCOME_TRAFFIC";
            else if (obj.includes("LEAD")) obj = "OUTCOME_LEADS";
            else obj = "OUTCOME_TRAFFIC";

            const budgetAmount = cp.budget_daily_inr || cp.budget?.amount || 500;

            // Map Location
            const geo = adSetItem.geo_targeting || {};
            const cities = Array.isArray(geo.cities)
              ? geo.cities.map(c => ({ name: c }))
              : (geo.cities ? [{ name: geo.cities }] : [{ name: "India" }]);

            planJson = {
              campaign_name: cName,
              objective: obj,
              performance_goal: cp.performance_goal || adSetItem.performance_goal || lockedCampaignState?.performance_goal || "MAXIMIZE_LINK_CLICKS",
              budget: {
                amount: budgetAmount,
                currency: "INR",
                type: "DAILY"
              },
              targeting: {
                geo_locations: {
                  countries: ["IN"],
                  cities: cities
                },
                age_min: 18,
                age_max: 65
              },
              ad_sets: [
                {
                  name: adSetItem.ad_set_name || "Ad Set 1",
                  status: "PAUSED",
                  ad_creative: {
                    imagePrompt: creativeItem.image_prompt || "Ad Image",
                    primary_text: creativeItem.primary_text || "",
                    headline: creativeItem.headline || "",
                    call_to_action: creativeItem.call_to_action || "LEARN_MORE",
                    destination_url: creativeItem.destination_url || "https://gabbarinfo.com"
                  }
                }
              ]
            };
          }

          // 🔄 NORMALIZE JSON: Variation 4 (Flat META plan shape)
          if (!planJson.campaign_name && (planJson.name || planJson.objective || planJson.ad_creative)) {
            const d = planJson;
            const tgt = d.targeting || {};
            const dest = d.destination || {};
            const cr = d.ad_creative || {};
            const urlCandidate = (dest.url || cr.landing_page || "https://gabbarinfo.com").toString();
            const cleanUrl = urlCandidate.replace(/[`]/g, "").trim();
            const cities = Array.isArray(tgt.geo_locations)
              ? tgt.geo_locations.map((g) => (g.location_name ? { name: g.location_name } : null)).filter(Boolean)
              : [];
            planJson = {
              campaign_name: d.name || "New Campaign",
              objective: (d.objective && (d.objective.includes("CLICK") || d.objective.includes("TRAFFIC"))) ? "OUTCOME_TRAFFIC" : (d.objective?.includes("LEAD") ? "OUTCOME_LEADS" : (d.objective || "OUTCOME_TRAFFIC")),
              performance_goal: d.performance_goal || cr.performance_goal || lockedCampaignState?.performance_goal || "MAXIMIZE_LINK_CLICKS",
              budget: {
                amount: d.budget?.daily_budget_inr || d.budget_daily_inr || 500,
                currency: "INR",
                type: "DAILY"
              },
              targeting: {
                geo_locations: { countries: ["IN"], cities },
                age_min: 18,
                age_max: 65
              },
              ad_sets: [
                {
                  name: "Ad Set 1",
                  status: "PAUSED",
                  ad_creative: {
                    imagePrompt: cr.image_prompt || "Ad Image",
                    primary_text: cr.primary_text || "",
                    headline: cr.headline || "",
                    call_to_action: dest.call_to_action || cr.call_to_action || "LEARN_MORE",
                    destination_url: cleanUrl || "https://gabbarinfo.com"
                  }
                }
              ]
            };
          }

          // Basic validation (is it a campaign plan?)
          if (planJson.campaign_name && planJson.ad_sets) {

            // 🛡️ SECURITY: Enforce strict Objective & Optimization Mapping (User Golden Rule)
            // Rule: Objective = Campaign Level (OUTCOME_TRAFFIC), Performance Goal = Ad Set Level (LINK_CLICKS)
            const rawObj = (planJson.objective || "").toString().toUpperCase();
            let cleanObjective = "OUTCOME_TRAFFIC"; // Default

            if (rawObj.includes("LEAD") || rawObj.includes("PROSPECT")) cleanObjective = "OUTCOME_LEADS";
            else if (rawObj.includes("SALE") || rawObj.includes("CONVERSION")) cleanObjective = "OUTCOME_SALES";
            else if (rawObj.includes("AWARENESS") || rawObj.includes("REACH")) cleanObjective = "OUTCOME_AWARENESS";
            else if (rawObj.includes("ENGAGE")) cleanObjective = "OUTCOME_ENGAGEMENT";
            else if (rawObj.includes("APP")) cleanObjective = "OUTCOME_APP_PROMOTION";
            // Else default to OUTCOME_TRAFFIC (catches "LINK_CLICKS", "TRAFFIC", etc.)

            console.log(`🛡️ Sanitized Objective: ${planJson.objective} -> ${cleanObjective}`);
            planJson.objective = cleanObjective;

            // Ensure Ad Sets have correct structure
            planJson.ad_sets = planJson.ad_sets.map(adset => {
              // Map Performance Goal -> Optimization Goal
              const perfGoal = (planJson.performance_goal || adset.performance_goal || "LINK_CLICKS").toString().toUpperCase();
              let optGoal = "LINK_CLICKS";

              if (cleanObjective === "OUTCOME_TRAFFIC") {
                optGoal = perfGoal.includes("LANDING") ? "LANDING_PAGE_VIEWS" : "LINK_CLICKS";
              } else if (cleanObjective === "OUTCOME_LEADS") {
                optGoal = "LEADS"; // Simplified
              } else if (cleanObjective === "OUTCOME_SALES") {
                optGoal = "CONVERSIONS"; // Simplified
              }

              return {
                ...adset,
                optimization_goal: adset.optimization_goal || optGoal,
                destination_type: adset.destination_type || "WEBSITE", // Default to Website
                billing_event: "IMPRESSIONS" // Safe default
              };
            });

            const newState = {
              ...lockedCampaignState, // Preserve verified assets
              stage: "PLAN_PROPOSED",
              plan: planJson,
              // Objective/Dest might be redundant if in lockedCampaignState, but safe to keep
              objective: lockedCampaignState?.objective || selectedMetaObjective,
              destination: lockedCampaignState?.destination || selectedDestination,
              // 🔒 FIX: Sync plan details to state to prevent re-gating
              service: lockedCampaignState?.service || planJson.campaign_name || "Digital Marketing",
              location: lockedCampaignState?.location || (planJson.targeting?.geo_locations?.cities?.[0]?.name) || "India",
              landing_page: lockedCampaignState?.landing_page || planJson.ad_sets?.[0]?.ad_creative?.destination_url,
              landing_page_confirmed: true,
              location_confirmed: true,
              service_confirmed: true,
              auto_run: false,
              locked_at: new Date().toISOString()
            };
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
            console.log("💾 Saving Proposed Plan to Agent Memory...");
            await saveAnswerMemory(baseUrl, effectiveBusinessId, {
              campaign_state: newState
            }, session.user.email.toLowerCase());

            lockedCampaignState = newState;
            console.log("✅ Saved Proposed Plan to State");

            console.log("TRACE: PLAN PROPOSED");
            console.log("TRACE: STAGE (plan) =", lockedCampaignState?.stage);
            console.log("TRACE: PLAN OBJECT =", lockedCampaignState?.plan);

            // 📝 Overwrite the response text with a clean summary
            const creative = planJson.ad_sets?.[0]?.ad_creative || planJson.ad_sets?.[0]?.ads?.[0]?.creative || {};
            // Handle Budget Variance (Object vs Flat)
            const bAmount = planJson.budget?.amount || planJson.budget_value || "N/A";
            const bCurrency = planJson.budget?.currency || "INR";
            const bType = planJson.budget?.type || planJson.budget_type || "DAILY";

            const creativeTitle = creative.headline || creative.title || "Headline";
            const creativeBody = creative.primary_text || creative.body || "Body Text";

            const tStr = planJson.targeting?.targeting_suggestions
              ? `\n**Suggestions**: ${planJson.targeting.targeting_suggestions.interests?.join(", ") || ""} (${planJson.targeting.targeting_suggestions.demographics?.join(", ") || ""})`
              : "";

            text = `
**Plan Proposed: ${planJson.campaign_name}**

**Targeting**: ${planJson.targeting?.geo_locations?.countries?.join(", ") || "India"} (${planJson.targeting?.age_min || 18}-${planJson.targeting?.age_max || 65}+)${tStr}
**Budget**: ${bAmount} ${bCurrency} (${bType})

**Creative Idea**: 
"${creativeTitle}"
_${creativeBody}_

**Image Concept**: 
_${creative.image_prompt || creative.imagePrompt || "Standard ad creative based on service"}_

**Call to Action**: ${creative.call_to_action || "Learn More"}

Reply **YES** to confirm this plan and proceed.
`.trim();

            return res.status(200).json({ ok: true, mode, text });
          } else {
            // It's JSON, but not a plan we recognize. 
            // Maybe it's just normal JSON output. Let's keep the raw text so user can see it.
          }
        } catch (e) {
          console.warn("Failed to parse/save detected JSON plan:", e);
          // Fallback: If we thought it was JSON but failed to parse,
          // we should probably leave 'text' as 'rawText' so the user sees the error or content.
        }
      }
    }

    // 🚨 FALLBACK: FORCE SAVE PLAN IF TEXT LOOKS LIKE A PROPOSAL BUT NO JSON WAS FOUND
    // This catches the case where Gemini returns a nice text plan but forgets the JSON block.
    // We construct a minimal plan from the User's Instruction + Gemini's output.
    const isPlanText = /Plan Proposed|Proposed Plan|Campaign Plan|Creative Idea|Strategy Proposal|Campaign Name/i.test(text);

    // AND Only if we haven't already saved a JSON plan (planJson would handle that path above)
    // AND if effectiveBusinessId is valid
    if ((mode === "meta_ads_plan" || isPlanText) && (!lockedCampaignState || !lockedCampaignState.plan) && effectiveBusinessId) {
      console.log("TRACE: FALLBACK META ADS PATH HIT");
      const looksLikePlan = isPlanText || text.includes("Budget") || text.includes("Creative Idea") || text.includes("Targeting") || text.includes("Creative Idea:");

      if (looksLikePlan) {
        console.log("⚠️ No JSON plan detected, but text looks like a plan. Attempting aggressive fallback extraction...");

        // Helper to extract from both Instruction (Input) and Text (Output)
        const extractFrom = (source, key) => {
          // Robust regex to handle **Plan Proposed**, Plan Proposed:, etc.
          const regex = new RegExp(`(?:\\*\\*|#)?${key}(?:\\*\\*|#)?[:\\-]?\\s*(.*?)(?:\\n|$)`, "i");
          const match = source.match(regex);
          return match ? match[1].trim() : null;
        };

        // Extraction Priority: Output Text (Gemini) > Input Instruction (User)
        const extractedTitle = extractFrom(text, "Plan Proposed") || extractFrom(text, "Campaign Name") || extractFrom(instruction, "Campaign Name") || "New Meta Campaign";
        const rawBudget = extractFrom(text, "Budget") || extractFrom(instruction, "Budget");
        const budgetVal = rawBudget ? parseInt(rawBudget.replace(/[^\d]/g, "")) : 500;

        const extractedLocation = extractFrom(text, "Location") || extractFrom(instruction, "Location") || "India";
        const extractedWebsite = extractFrom(text, "Website") || extractFrom(instruction, "Website") || "https://gabbarinfo.com";

        const minimalPlan = {
          campaign_name: extractedTitle.replace(/\*\*?$/, "").trim(),
          objective: "OUTCOME_TRAFFIC",
          performance_goal: "MAXIMIZE_LINK_CLICKS",
          budget: {
            amount: budgetVal || 500,
            currency: "INR",
            type: "DAILY",
          },
          targeting: {
            geo_locations: {
              countries: ["IN"],
              cities: extractedLocation.includes(",") ? extractedLocation.split(",").map(c => ({ name: c.trim() })) : [{ name: extractedLocation }]
            },
            age_min: 18,
            age_max: 65
          },
          ad_sets: [
            {
              name: "Ad Set 1",
              status: "PAUSED",
              ad_creative: {
                primary_text: extractFrom(text, "Creative Idea") || extractFrom(instruction, "Creative Idea") || "Best Digital Marketing Services",
                headline: extractFrom(text, "Headline") || extractFrom(text, "Plan Proposed") || "Grow Your Business",
                call_to_action: extractFrom(text, "Call to Action") || "LEARN_MORE",
                destination_url: extractedWebsite,
                image_prompt: extractFrom(text, "Image Concept") || extractFrom(instruction, "Image Concept") || "Professional business service ad"
              },
            },
          ],
        };

        const newState = {
          ...lockedCampaignState,
          stage: "PLAN_PROPOSED",
          plan: minimalPlan,
          auto_run: false,
          // 🔒 SYNC PLAN DETAILS TO STATE to ensure Turn 2 (YES) finds everything
          service: minimalPlan.campaign_name,
          location: extractedLocation,
          landing_page: extractedWebsite,
          landing_page_confirmed: true,
          location_confirmed: true,
          service_confirmed: true,
          locked_at: new Date().toISOString(),
        };

        // SAVE IT!
        console.log("💾 Persisting text-based fallback plan to memory...");
        await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, {
          campaign_state: newState
        }, session.user.email.toLowerCase());

        // Update local state and mode to ensure current turn response reflects the change
        lockedCampaignState = newState;
        mode = "meta_ads_plan";
        console.log("✅ Fallback Plan Persisted Successfully.");

        console.log("TRACE: PLAN PROPOSED");
        console.log("TRACE: STAGE (plan) =", lockedCampaignState?.stage);
        console.log("TRACE: PLAN OBJECT =", lockedCampaignState?.plan);

        // 🛡️ PATCH 1: HARD STOP AT PLAN_PROPOSED (Fallback path)
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({
          ok: true,
          mode,
          text: `**Plan Proposed: ${newState.plan.campaign_name}**\nReply **YES** to confirm and proceed.`
        });
      }
    }


    // ============================================================
    // 🤖 STATE MACHINE: EXECUTION FLOW (Plan -> Image -> Launch)
    // ============================================================

    // 🛡️ GUARD: If user says YES (or force_continue) but we have no state, warn them.
    // This prevents the "Generic Agent Response" fallback which confuses the user.
    const isConfirmation =
      instruction.toLowerCase().includes("yes") ||
      instruction.toLowerCase().includes("approve") ||
      instruction.toLowerCase().includes("confirm") ||
      body.force_continue;

    if (!lockedCampaignState && isConfirmation && mode === "meta_ads_plan") {
      console.warn("⚠️ User said YES but no lockedCampaignState found.");
      return res.status(200).json({
        ok: true,
        text: "❌ **No Active Plan Found**\n\nI received your confirmation, but I don't have a saved plan to execute.\n\nThis can happen if:\n1. The plan wasn't saved correctly.\n2. You are trying to confirm a plan from a previous session.\n\nPlease ask me to **'create the plan again'**."
      });
    }

    if (lockedCampaignState) {
      const stage = lockedCampaignState.stage || "PLANNING";
      // Auto-trigger if Logic 2 flag set or user says YES
      const userSaysYes =
        instruction.toLowerCase().includes("yes") ||
        instruction.toLowerCase().includes("approve") ||
        instruction.toLowerCase().includes("confirm") ||
        instruction.toLowerCase().includes("proceed") ||
        instruction.toLowerCase().includes("launch") ||
        instruction.toLowerCase().includes("generate") ||
        instruction.toLowerCase().includes("image");

      // 🚀 CONSOLIDATED EXECUTION WATERFALL (Step 9 -> 10 -> 12)
      if (stage !== "COMPLETED" && userSaysYes) {
        let currentState = { ...lockedCampaignState, locked_at: new Date().toISOString() };

        // 🛡️ PATCH 3: WATERFALL ENTRY RULE
        if (mode === "meta_ads_plan") {
          console.log("TRACE: ENTER META WATERFALL");
          console.log("TRACE: CURRENT STAGE =", currentState?.stage);

          if (!lockedCampaignState || (lockedCampaignState.stage !== "PLAN_CONFIRMED" && lockedCampaignState.stage !== "IMAGE_GENERATED" && lockedCampaignState.stage !== "READY_TO_LAUNCH")) {
            console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
            return res.status(200).json({
              ok: true,
              mode,
              text: "Please review the proposed plan and reply YES to confirm before I proceed."
            });
          }
        }
        // 🛡️ IDEMPOTENCY PROTECTION: Avoid double-processing if request arrives too fast
        const now = Date.now();
        const lastUpdate = lockedCampaignState.locked_at ? new Date(lockedCampaignState.locked_at).getTime() : 0;
        const isTooFast = (now - lastUpdate < 10000); // 10s window

        // We allow "PLAN_PROPOSED" to be re-run, but once it moves to Gen/Upload/Launch, we lock it.
        if (isTooFast && (stage === "IMAGE_GENERATED" || stage === "READY_TO_LAUNCH" || stage === "EXECUTING")) {
          console.warn(`[IDEMPOTENCY] Blocked duplicate request for ${effectiveBusinessId} (Stage: ${stage})`);
          console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
          return res.status(200).json({ ok: true, mode, text: "I'm already working on that! One moment please..." });
        }

        console.log(`[PROD_LOG] 📶 State Transition Started | User: ${session.user.email} | ID: ${effectiveBusinessId} | CurrentStage: ${stage}`);

        // let currentState = { ...lockedCampaignState, locked_at: new Date().toISOString() }; // Moved up

        // 🛡️ DEFENSIVE CHECK: If user says YES but we have no plan, FALLBACK TO PLANNING.
        // Rule: NEVER execute without a plan. Implicitly regenerate it.
        // 🛡️ HARD RULE: Never proceed to confirmation/execution without a saved plan
        if (!currentState.plan || !currentState.plan.campaign_name) {
          console.warn("⚠️ Plan missing at confirmation. Recreating plan immediately.");

          const regeneratedPlan = await generateMetaCampaignPlan({
            lockedCampaignState,
            autoBusinessContext,
            verifiedMetaAssets,
            detectedLandingPage,
          });

          const repairedState = {
            ...currentState,
            stage: "PLAN_PROPOSED",
            plan: regeneratedPlan,
            locked_at: new Date().toISOString()
          };

          await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, {
            campaign_state: repairedState
          }, session.user.email.toLowerCase());

          currentState = repairedState;

          console.log("TRACE: PLAN PROPOSED");
          console.log("TRACE: STAGE (plan) =", repairedState.stage);
          console.log("TRACE: PLAN OBJECT =", repairedState.plan);

          // 🛡️ PATCH 1: HARD STOP AT PLAN_PROPOSED (Regeneration path - global)
          console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
          return res.status(200).json({
            ok: true,
            mode,
            text: `**Plan Proposed: ${repairedState.plan.campaign_name}**\nReply **YES** to confirm and proceed.`
          });
        }

        let waterfallLog = [];
        let errorOcurred = false;
        let stopReason = null;

        // --- STEP 9: IMAGE GENERATION ---
        const hasPlan = !!currentState.plan;

        // 🛡️ PATCH: Differentiate Generated vs Uploaded (Strict)
        const isImageGenerated = !!currentState.creative?.imageBase64 || !!currentState.creative?.imageUrl;
        // 🛡️ PATCH 1: SINGLE SOURCE OF TRUTH (Require confirmed hash or ID)
        const isImageUploaded = !!currentState.meta?.uploadedImageHash || !!currentState.meta?.imageMediaId || !!currentState.image_hash;

        if (hasPlan && !isImageGenerated && (currentState.stage === "PLAN_CONFIRMED")) {
          console.log("TRACE: IMAGE GENERATION ATTEMPT");
          console.log("TRACE: IMAGE EXISTS =", !!currentState.creative);

          console.log("🚀 Waterfall: Starting Image Generation...");
          const plan = currentState.plan;
          const creativeResult = plan.ad_sets?.[0]?.ad_creative || plan.ad_sets?.[0]?.ads?.[0]?.creative || {};
          const imagePrompt = creativeResult.image_prompt || creativeResult.imagePrompt || creativeResult.primary_text || `${plan.campaign_name} ad image`;

          try {
            const imgRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/images/generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: imagePrompt }),
            });
            const imgJson = await parseResponseSafe(imgRes);

            if (imgJson.imageBase64) {
              const newCreative = {
                ...creativeResult,
                imageBase64: imgJson.imageBase64,
                imageUrl: `data:image/png;base64,${imgJson.imageBase64}`
              };
              currentState = { ...currentState, stage: "IMAGE_GENERATED", creative: newCreative };

              console.log("TRACE: PIPELINE STEP REPORT");
              console.log("TRACE: STAGE (pipeline) =", currentState.stage);
              console.log("TRACE: IMAGE EXISTS =", !!currentState.creative);
              console.log("TRACE: IMAGE UPLOADED =", !!currentState.meta?.uploadedImageHash);

              waterfallLog.push("✅ Step 9: Image Generated");
            } else {
              errorOcurred = true;
              stopReason = "Image Generation Failed (No Base64 returned)";
            }
          } catch (e) {
            errorOcurred = true;
            stopReason = `Image Generation Error: ${e.message}`;
          }
        } else if (isImageGenerated) {
          console.log("TRACE: PIPELINE STEP REPORT");
          console.log("TRACE: STAGE (pipeline) =", currentState.stage);
          console.log("TRACE: IMAGE EXISTS =", !!currentState.creative);
          console.log("TRACE: IMAGE UPLOADED =", !!currentState.meta?.uploadedImageHash);

          waterfallLog.push("⏭️ Step 9: Image Already Exists");
        }

        // --- STEP 10: IMAGE UPLOAD (STRICT CHECK) ---
        if (!errorOcurred) {
          const hasImageContent = currentState.creative && currentState.creative.imageBase64;

          if (hasImageContent && !isImageUploaded) {
            console.log("TRACE: UPLOADING IMAGE TO META");
            console.log("🚀 Waterfall: Uploading Image to Meta...");
            try {
              const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/upload-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-client-email": __currentEmail || "" },
                body: JSON.stringify({ imageBase64: currentState.creative.imageBase64 })
              });
              const uploadJson = await parseResponseSafe(uploadRes);
              console.log("TRACE: IMAGE UPLOAD RESPONSE =", uploadJson);
              const iHash = uploadJson.imageHash || uploadJson.image_hash;

              if (uploadJson.ok && iHash) {
                // 🛡️ FINAL INVARIANT PATCH: PERSIST STAGE ADVANCE
                currentState = {
                  ...currentState,
                  stage: "READY_TO_LAUNCH",
                  image_hash: iHash, // Keep for backward compatibility
                  meta: {
                    ...currentState.meta,
                    uploadedImageHash: iHash,
                    uploadedAt: new Date().toISOString(),
                  },
                  locked_at: new Date().toISOString(),
                };

                await saveAnswerMemory(
                  process.env.NEXT_PUBLIC_BASE_URL,
                  effectiveBusinessId,
                  { campaign_state: currentState },
                  session.user.email.toLowerCase()
                );

                console.log("TRACE: PIPELINE STEP REPORT");
                console.log("TRACE: STAGE (pipeline) =", currentState.stage);
                console.log("TRACE: IMAGE EXISTS =", !!currentState.creative);
                console.log("TRACE: IMAGE UPLOADED =", !!currentState.meta?.uploadedImageHash);

                waterfallLog.push("✅ Step 10: Image Uploaded to Meta");
              } else {
                errorOcurred = true;
                stopReason = `Meta Upload Failed: ${uploadJson.message || "Unknown error"}`;
              }
            } catch (e) {
              errorOcurred = true;
              stopReason = `Meta Upload Error: ${e.message}`;
            }
          } else if (isImageUploaded) {
            console.log("TRACE: PIPELINE STEP REPORT");
            console.log("TRACE: STAGE (pipeline) =", currentState.stage);
            console.log("TRACE: IMAGE EXISTS =", !!currentState.creative);
            console.log("TRACE: IMAGE UPLOADED =", !!currentState.meta?.uploadedImageHash);

            waterfallLog.push("⏭️ Step 10: Image Already Uploaded");
          }
        }

        // 🛡️ PATCH: FORCE STAGE ADVANCE AFTER CONFIRMED IMAGE UPLOAD
        if (
          currentState.stage === "PLAN_PROPOSED" &&
          (currentState.meta?.uploadedImageHash || currentState.meta?.imageMediaId)
        ) {
          console.log("✅ Advancing stage from PLAN_PROPOSED → READY_TO_LAUNCH");
          currentState = {
            ...currentState,
            stage: "READY_TO_LAUNCH",
            locked_at: new Date().toISOString(),
          };

          await saveAnswerMemory(
            process.env.NEXT_PUBLIC_BASE_URL,
            effectiveBusinessId,
            { campaign_state: currentState },
            session.user.email.toLowerCase()
          );
        }

        // --- STEP 12: EXECUTION (Final Step) ---
        if (!errorOcurred) {
          const isReady = (currentState.stage === "READY_TO_LAUNCH" || currentState.stage === "IMAGE_UPLOADED") && currentState.image_hash;
          // For auto_run, we don't need explicit 'launch' keyword
          const wantsLaunch = instruction.toLowerCase().includes("launch") || instruction.toLowerCase().includes("execute") || instruction.toLowerCase().includes("run") || instruction.toLowerCase().includes("publish") || instruction.toLowerCase().includes("yes") || instruction.toLowerCase().includes("ok");

          if (isReady && (wantsLaunch || currentState.objective === "TRAFFIC")) {
            // 🛡️ PATCH 3: EXECUTION MUST REQUIRE READY_TO_LAUNCH
            if (currentState.stage !== "READY_TO_LAUNCH") {
              console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
              return res.json({
                ok: true,
                text: "Preparing campaign assets. Please wait a moment..."
              });
            }

            console.log("🚀 Waterfall: Executing Campaign on Meta...");
            try {
              const plan = currentState.plan;
              const finalPayload = {
                ...plan,
                ad_sets: plan.ad_sets.map(adset => ({
                  ...adset,
                  // 🛡️ PATCH 4: PAYLOAD IMAGE GUARANTEE (HARD STOP IF MISSING)
                  ad_creative: {
                    ...adset.ad_creative,
                    image_hash: currentState.meta?.uploadedImageHash || currentState.image_hash || (() => { throw new Error(Messages.META_EXECUTION_FAILED); })()
                  }
                }))
              };

              console.log("TRACE: EXECUTING META CAMPAIGN");
              const execRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/execute-campaign`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-client-email": __currentEmail || "" },
                body: JSON.stringify({ platform: "meta", payload: finalPayload })
              });
              const execJson = await execRes.json();

              if (execJson.ok) {
                await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, {
                  campaign_state: { stage: "COMPLETED", final_result: execJson }
                });
                currentState.stage = "COMPLETED"; // Explicit sync for log
                console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
                return res.status(200).json({
                  ok: true,
                  text: `🎉 **Campaign Published Successfully!**\n\n**Pipeline Status**:\n${waterfallLog.join("\n")}\n✅ Step 12: Campaign Created (PAUSED)\n\n**Meta Details**:\n- **Campaign Name**: ${plan.campaign_name}\n- **Campaign ID**: \`${execJson.id || "N/A"}\`\n- **Ad Account ID**: \`${verifiedMetaAssets?.ad_account?.id || "N/A"}\`\n- **Status**: PAUSED\n\nYour campaign is now waiting in your Meta Ads Manager for final review.`
                });
              } else {
                errorOcurred = true;
                stopReason = `Meta Execution Failed: ${execJson.message || "Unknown error"}`;
              }
            } catch (e) {
              errorOcurred = true;
              stopReason = `Meta Execution Error: ${e.message}`;
            }
          }
        }

        // Save progress reached
        console.log(`[PROD_LOG] ✅ State Transition Finished | ID: ${effectiveBusinessId} | FinalStage: ${currentState.stage}`);
        await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: currentState }, session.user.email.toLowerCase());

        // If we stopped due to error or waiting
        let feedbackText = "";
        if (errorOcurred) {
          console.log("TRACE: PIPELINE STEP REPORT");
          console.log("TRACE: STAGE (pipeline) =", currentState.stage);

          feedbackText = `❌ **Automation Interrupted**:\n\n**Error**: ${stopReason}\n\n**Pipeline Progress**:\n${waterfallLog.join("\n")}\n\nI've saved the progress so far. Please check the error above and reply to try again.`;
        } else if (currentState.stage === "IMAGE_GENERATED") {
          console.log("TRACE: PIPELINE STEP REPORT");
          console.log("TRACE: STAGE (pipeline) =", currentState.stage);

          // 🛡️ PATCH: Verify Image actually exists
          if (currentState.creative?.imageBase64 || currentState.creative?.imageUrl) {
            feedbackText = `✅ **Image Generated Successfully**\n\n[Image Generated]\n\n**Next Steps**:\n1. Upload image to Meta Assets\n2. Create paused campaign on Facebook/Instagram\n\nReply **LAUNCH** to complete these steps automatically.`;
          } else {
            feedbackText = `❌ **Image Generation Failed**\n\nThe image could not be generated. Please try again.`;
          }
        } else if (currentState.stage === "READY_TO_LAUNCH") {
          console.log("TRACE: PIPELINE STEP REPORT");
          console.log("TRACE: STAGE (pipeline) =", currentState.stage);

          // 🛡️ PATCH: Verify Hash actually exists
          if (currentState.creative?.imageHash) {
            feedbackText = `✅ **Image Uploaded & Ready**\n\nEverything is set for campaign launch.\n\n**Details**:\n- Campaign: ${currentState.plan.campaign_name}\n- Budget: ${currentState.plan.budget?.amount || "500"} INR\n\nReply **LAUNCH** to publish the campaign to Meta.`;
          } else {
            feedbackText = `❌ **Image Upload Failed**\n\nThe image was generated but could not be uploaded to Meta. Please check your connection and try again.`;
          }
        } else {
          console.log("TRACE: PIPELINE STEP REPORT");
          console.log("TRACE: STAGE (pipeline) =", currentState.stage);

          feedbackText = `**Current Pipeline Progress**:\n${waterfallLog.join("\n") || "No steps completed in this turn."}\n\n(Debug: Stage=${currentState.stage}, Plan=${currentState.plan ? "Yes" : "No"})\n\nWaiting for your confirmation...`;
        }

        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({ ok: true, text: feedbackText, imageUrl: currentState.creative?.imageUrl, mode });

      }

      // ===============================
      // 🧠 STEP-1 / STEP-2 NORMAL AGENT RESPONSE
      // ===============================
      console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
      return res.status(200).json({
        ok: true,
        text,
        mode,
      });

    } // End of if (lockedCampaignState)

  } catch (err) {
    console.error("Agent execution error:", err);
    console.log("TRACE: RETURNING RESPONSE — STAGE = ERROR");
    return res.status(500).json({
      ok: false,
      message: "Server error in /api/agent/execute",
      error: err.message || String(err),
    });
  }
}


// 🛠️ HELPER: PROACTIVE PLAN REGENERATION (SELF-HEALING)
async function generateMetaCampaignPlan({ lockedCampaignState, autoBusinessContext, verifiedMetaAssets, detectedLandingPage }) {
  console.log("🔄 [Self-Healing] Regenerating Meta Campaign Plan from Context...");

  const serviceName = lockedCampaignState?.service || autoBusinessContext?.business_name || "Digital Marketing";
  const objective = lockedCampaignState?.objective || "OUTCOME_TRAFFIC";
  const performanceGoal = lockedCampaignState?.performance_goal || "MAXIMIZE_LINK_CLICKS";
  const landingPage = lockedCampaignState?.landing_page || detectedLandingPage || "https://gabbarinfo.com";
  const location = lockedCampaignState?.location || "India";

  // Deterministic Default Plan
  return {
    campaign_name: `${serviceName} Campaign`,
    objective: objective,
    performance_goal: performanceGoal,
    budget: {
      amount: 500,
      currency: "INR",
      type: "DAILY"
    },
    targeting: {
      geo_locations: {
        countries: ["IN"],
        cities: location !== "India" ? [{ name: location }] : []
      },
      age_min: 18,
      age_max: 65,
      excluded_custom_audiences: [],
      flexible_spec: []
    },
    ad_sets: [
      {
        name: `${serviceName} Ad Set`,
        status: "PAUSED",
        optimization_goal: performanceGoal === "MAXIMIZE_LEADS" ? "LEADS" : "LINK_CLICKS",
        billing_event: "IMPRESSIONS",
        destination_type: objective === "OUTCOME_LEADS" ? "ON_AD" : "WEBSITE",
        ad_creative: {
          imagePrompt: `${serviceName} professional service advertisement high quality`,
          primary_text: `Looking for best ${serviceName}? We provide top-notch services to help you grow.`,
          headline: `Expert ${serviceName}`,
          call_to_action: "LEARN_MORE",
          destination_url: landingPage
        }
      }
    ]
  };
}


async function handleInstagramPostOnly(req, res, session, body) {
  console.log("TRACE: ENTER INSTAGRAM MODE");
  let currentState = null; // Default for returns
  const { instruction = "" } = body;

  // Resolve Meta connection (do NOT reuse Ads logic)
  const { data: metaRow } = await supabase
    .from("meta_connections")
    .select("*")
    .eq("email", session.user.email.toLowerCase())
    .maybeSingle();

  const activeBusinessId =
    metaRow?.fb_business_id ||
    metaRow?.fb_page_id ||
    metaRow?.ig_business_id ||
    "default_business";

  // -------------------------------
  // PATH A — Direct URL + Caption
  // -------------------------------
  const urlMatch = instruction.match(/https?:\/\/[^\s]+/i);
  const imageUrl = urlMatch ? urlMatch[0] : null;

  let caption = null;
  const captionMatch = instruction.match(/Caption:\s*(.*)/i);
  if (captionMatch) {
    caption = captionMatch[1].trim();
  } else if (imageUrl) {
    caption = instruction.replace(imageUrl, "").trim();
  }

  if (imageUrl && caption && caption.length > 5) {
    await clearCreativeState(supabase, session.user.email.toLowerCase());

    const normalizedImage = await normalizeImageUrl(imageUrl);

    const result = await executeInstagramPost({
      userEmail: session.user.email.toLowerCase(),
      imageUrl: normalizedImage,
      caption,
    });

    await saveAnswerMemory(
      process.env.NEXT_PUBLIC_BASE_URL,
      activeBusinessId,
      {
        campaign_state: {
          stage: "COMPLETED",
          flow: "instagram_publish",
          final_result: result,
        },
      },
      session.user.email.toLowerCase()
    );

    console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
    return res.json({
      ok: true,
      text: `🎉 **Instagram Post Published Successfully!**\n\n- **Post ID**: \`${result.id}\``,
    });
  }

  // -------------------------------
  // PATH B — Creative Entry FSM
  // -------------------------------
  const creativeResult = await creativeEntry({
    supabase,
    session,
    instruction,
    metaRow,
    effectiveBusinessId: activeBusinessId,
  });

  // 1️⃣ HIGHEST PRIORITY: PUBLISH WHEN CONFIRMATION IS GIVEN
  if (
    creativeResult.intent === "PUBLISH_INSTAGRAM_POST" &&
    creativeResult.payload?.imageUrl &&
    creativeResult.payload?.caption
  ) {
    const { imageUrl, caption } = creativeResult.payload;

    try {
      const publishResult = await executeInstagramPost({
        userEmail: session.user.email.toLowerCase(),
        imageUrl,
        caption,
      });

      await clearCreativeState(supabase, session.user.email.toLowerCase());

      // IMMEDIATELY return to prevent double-response
      console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
      return res.status(200).json({
        ok: true,
        mode: "instagram_post",
        text: "🎉 Instagram Post Published Successfully!",
        result: publishResult
      });
    } catch (publishError) {
      console.error("❌ Instagram Publish Error:", publishError);

      // Clear state even on error to allow retry
      await clearCreativeState(supabase, session.user.email.toLowerCase());

      console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
      return res.status(200).json({
        ok: false,
        mode: "instagram_post",
        text: `Failed to publish Instagram post: ${publishError.message || "Unknown error"}. Please try again.`
      });
    }
  }

  // 2️⃣ SECOND: RETURN PREVIEW OR QUESTIONS (NON-TERMINAL)
  if (creativeResult.response) {
    console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
    return res.json(creativeResult.response);
  }

  // 3️⃣ FALLBACK: Request more information (should rarely be reached)
  console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
  return res.json({
    ok: true,
    text: "I need a bit more information to create your Instagram post.",
  });
}
