
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

      // 🛡️ CRITICAL FIX: Ensure PLAN is never lost during merge
      const newPlan = answers.campaign_state.plan;
      const oldPlan = existingAnswers.campaign_state.plan;
      const finalPlan = newPlan || oldPlan;

      finalAnswers.campaign_state = {
        ...existingAnswers.campaign_state,
        ...answers.campaign_state,
        plan: finalPlan,
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

function normalizeServiceOptions(services, landingPage) {
  if (!Array.isArray(services)) return [];
  const base = landingPage ? landingPage.replace(/\/$/, "") : null;
  const seen = new Set();
  const result = [];

  for (const raw of services) {
    if (!raw) continue;
    let label = raw;

    try {
      const parsed = new URL(raw);
      const normalized = parsed.origin + parsed.pathname.replace(/\/$/, "");
      if (base && normalized === base) continue;

      const path = parsed.pathname || "/";
      if (path && path !== "/") {
        const segments = path.split("/").filter(Boolean);
        if (segments.length) {
          const last = segments[segments.length - 1];
          if (last) {
            label = last.replace(/[-_]+/g, " ").trim();
            if (label.length) {
              label = label.charAt(0).toUpperCase() + label.slice(1);
            }
          }
        }
      }
    } catch (_) { }

    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }

  return result;
}

export default async function handler(req, res) {
  let currentState = null; // Default until loaded
  let planGeneratedThisTurn = false; // 🔒 Request-scoped flag for plan ownership
  let imageUploadedThisTurn = false; // 🔒 Request-scoped flag for upload verification
  let campaignExecutedThisTurn = false; // 🔒 Request-scoped flag for execution verification
  let imageHash = null;
  if (req.method !== "POST") {
    console.log("TRACE: ENTER EXECUTE");
    console.log("TRACE: MODE =", req.body?.mode);
    console.log("TRACE: INSTRUCTION =", req.body?.instruction);
    console.log("TRACE: RETURNING RESPONSE — STAGE = undefined");
    return res.status(405).json({ ok: false, message: "Only POST allowed." });
  }

  try {
    const body = req.body || {};
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }

    __currentEmail = session.user.email.toLowerCase();
    const { instruction = "", chatHistory = [] } = body;
    let mode = body.mode || "generic";
    const lowerInstruction = instruction.toLowerCase();

    // 💡 INTENT DETECTION: If in generic mode, check if user wants Meta Ads
    if (mode === "generic") {
      const historyTextForIntent = Array.isArray(chatHistory)
        ? chatHistory.slice(-10).map(m => m?.text?.toLowerCase() || "").join(" ")
        : "";
      const intentSource = `${lowerInstruction} ${historyTextForIntent}`;
      const isMetaIntent =
        intentSource.includes("meta ads") || intentSource.includes("meta campaign") ||
        intentSource.includes("facebook ads") || intentSource.includes("instagram ads") ||
        intentSource.includes("facebook campaign") || intentSource.includes("instagram campaign") ||
        intentSource.includes("run ads") || intentSource.includes("start ads");

      if (isMetaIntent) {
        mode = "meta_ads_plan";
      }
    }

    // 🔒 MODE AUTHORITY GATE — INSTAGRAM ISOLATION
    if (mode === "instagram_post") {
      return handleInstagramPostOnly(req, res, session, body);
    }

    // ============================================================
    // 🔗 META CONNECTION & BUSINESS ID RESOLUTION
    // ============================================================
    let metaConnected = false;
    let activeBusinessId = null;
    let metaRow = null;

    try {
      const { data: row } = await supabase
        .from("meta_connections")
        .select("*")
        .eq("email", __currentEmail)
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
    const effectiveBusinessId = activeBusinessId || "default_business";

    // 1️⃣ HARD RESET MUST HAPPEN BEFORE MEMORY LOAD
    // Rule: If instruction intent matches “create / run / start ads campaign”
    // Then: Ignore any existing campaign_state, Force a fresh state, Do NOT load old plans

    const isNewMetaCampaignRequest =
      (mode === "meta_ads_plan" || mode === "generic") &&
      (
        lowerInstruction.includes("create a meta ads campaign") ||
        lowerInstruction.includes("create meta ads campaign") ||
        lowerInstruction.includes("create an ad campaign") ||
        lowerInstruction.includes("create an ads campaign") ||
        lowerInstruction.includes("create a campaign for my business") ||
        lowerInstruction.includes("create a meta campaign") ||
        lowerInstruction.includes("run an ad") ||
        lowerInstruction.includes("run ads for my business") ||
        lowerInstruction.includes("ad run") ||
        lowerInstruction.includes("start ads campaign")
      );

    let lockedCampaignState = null;

    if (isNewMetaCampaignRequest) {
      console.log("TRACE: HARD RESET TRIGGERED - IGNORING MEMORY");
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
      const resetState = {
        objective: null,
        destination: null,
        performance_goal: null,
        service: null,
        service_confirmed: false,
        location: null,
        location_confirmed: false,
        budget_per_day: null,
        total_days: null,
        budget_confirmed: false,
        duration_confirmed: false,
        landing_page: null,
        landing_page_confirmed: false,
        phone: null,
        phone_confirmed: false,
        whatsapp: null,
        whatsapp_confirmed: false,
        message_channel: null,
        location_question_asked: false,
        plan: null,
        stage: null,
        locked_at: new Date().toISOString(),
      };

      // 🔒 RESET IS PERSISTED TO MEMORY (Mandatory Fix 1)
      lockedCampaignState = resetState;
      currentState = resetState;

      // 💾 Save reset state to BOTH current ID and default_business to purge old plans
      if (session.user.email) {
        const resetPayload = { campaign_state: resetState };
        await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, resetPayload, session.user.email.toLowerCase());
        if (effectiveBusinessId !== "default_business") {
          await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, "default_business", resetPayload, session.user.email.toLowerCase());
        }
      }
    }

    console.log("🔥 REQUEST START");
    console.log("EMAIL:", __currentEmail);
    console.log("INSTRUCTION:", instruction.substring(0, 50));
    console.log("MODE:", mode);
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
console.log("DEBUG META ROW:", meta);
      if (!meta?.fb_ad_account_id || (!meta?.system_user_token && !meta?.fb_user_access_token)) {
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
        ad_account: { ...adAccount, id: normalizedAdId },
        verified_at: new Date().toISOString(),
      };

      // 3️⃣ Save to cache
      await supabase.from("agent_meta_assets").upsert(verifiedMetaAssets);
    }

    console.log(`🏢 Effective Business ID: ${effectiveBusinessId} (Active: ${activeBusinessId})`);

    let forcedBusinessContext = null;

    if (metaConnected && activeBusinessId) {
      forcedBusinessContext = {
        source: "meta_connection",
        business_id: activeBusinessId,
        note: "User has exactly ONE Meta business connected. This is the active business.",
      };
    }

    // 🔍 READ LOCKED CAMPAIGN STATE (AUTHORITATIVE — SINGLE SOURCE)
    // 🛡️ PATCH: PREVENT INSTAGRAM MODE FROM READING META ADS MEMORY
    if (body.mode !== "instagram_post" && !lockedCampaignState) { // Only read if NOT already reset
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

            // 🛡️ REFACTORED LOOKUP: Priority Sequential Search (No Plan-Preferring Loop)
            // We search keys in order of specificity. We use the FIRST one that has ANY campaign_state.
            // This prevents an empty state in a specific ID from being 'outvoted' by an old plan in default_business.
            for (const key of possibleKeys) {
              const state = answers[key]?.campaign_state;
              if (state) {
                bestMatch = state;
                sourceKey = key;
                break; // Found the most specific state available
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

    const isPlanProposed =
      !!lockedCampaignState &&
      ["PLAN_PROPOSED", "PLAN_CONFIRMED", "IMAGE_GENERATED", "READY_TO_LAUNCH"].includes(lockedCampaignState.stage) &&
      isMetaPlanComplete(lockedCampaignState.plan) &&
      !!lockedCampaignState.objective &&
      !!lockedCampaignState.destination;
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
    if (body.mode === "instagram_post" && mode === "instagram_post") {
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

    if (body.type === "meta_ads_creative") {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

      if (!baseUrl) {
        return res.status(500).json({
          ok: false,
          message:
            "NEXT_PUBLIC_BASE_URL is not set. Cannot forward to ads/create-creative.",
        });
      }
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
      extraContext = "",
    } = body;
    includeJson = false;
    if (
      mode === "generic" &&
      lockedCampaignState &&
      lockedCampaignState.objective &&
      lockedCampaignState.stage &&
      lockedCampaignState.stage !== "COMPLETED" &&
      !isNewMetaCampaignRequest // NEVER switch on new request
    ) {
      mode = "meta_ads_plan";
    }

    if (mode === "meta_ads_plan") {
      console.log("TRACE: ENTER META ADS HANDLER");
      console.log("TRACE: MODE =", mode);
      console.log("TRACE: INSTRUCTION =", instruction);
      console.log("TRACE: STAGE (initial) =", lockedCampaignState?.stage);
    }

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


    // 🛡️ PATCH 2: Dedicated Confirmation Gate (Mandatory Fix 3)
    // 🔒 MODIFIED: Removed planGeneratedThisTurn requirement to allow confirming memory plans
    if (lockedCampaignState && lockedCampaignState.plan && mode === "meta_ads_plan") {
      console.log("TRACE: ENTER SHORT-CIRCUIT EXECUTION PATH");
      console.log("TRACE: USER SAID YES =", lowerInstruction.includes("yes"));
      console.log("TRACE: STAGE (before confirm) =", lockedCampaignState?.stage);

      if (lockedCampaignState.stage === "PLAN_PROPOSED") {
        const isConfirm =
          lowerInstruction.includes("yes") ||
          lowerInstruction.includes("proceed") ||
          lowerInstruction.includes("continue") ||
          lowerInstruction.includes("ok");

        if (isConfirm) {
          if (!lockedCampaignState.plan) {
            return res.status(200).json({
              ok: true,
              mode,
              text: "Plan missing. Regenerating. Reply YES again."
            });
          }

          const nextState = {
            ...lockedCampaignState,
            stage: "PLAN_CONFIRMED",
            auto_run: true,
            locked_at: new Date().toISOString()
          };

          await saveAnswerMemory(
            process.env.NEXT_PUBLIC_BASE_URL,
            effectiveBusinessId,
            { campaign_state: nextState },
            session.user.email.toLowerCase()
          );

          lockedCampaignState = nextState;
          currentState = nextState;
          planGeneratedThisTurn = true;

          // ✅ PURPOSE: signal execution path
          console.log("🚀 Immediate Fallthrough to Waterfall...");
        } else {
          // ✅ PURPOSE: allow Gemini to continue reasoning
          console.log("TRACE: Plan proposed but not confirmed. Falling through to model...");
        }
      }
    }
    // ============================================================
    // 4️⃣ IMAGE GENERATION MUST BE EXPLICIT (Force Waterfall)
    // ============================================================
    // If we are in PLAN_CONFIRMED, we MUST generate image.
    // The legacy "waterfall" below handles this if lockedCampaignState.stage === "PLAN_CONFIRMED".
    // We just need to ensure nothing blocks it.

    // ============================================================
    // 6️⃣ GUARANTEE: FIRST USER MESSAGE CAN NEVER SHOW A PLAN
    // ============================================================
    if (
      isNewMetaCampaignRequest &&
      lockedCampaignState?.stage &&
      lockedCampaignState.stage !== "PLAN_CONFIRMED"
    ) {
      lockedCampaignState = null;
    }

    // ---------- MODE-SPECIFIC FOCUS ----------
    let modeFocus = "";

    if (mode === "meta_ads_plan") {
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

    console.log("=== DEBUG SAFETY ===");
console.log("mode:", mode);
console.log("stage:", lockedCampaignState?.stage);
console.log("objective:", lockedCampaignState?.objective);
console.log("destination:", lockedCampaignState?.destination);
console.log("performance_goal:", lockedCampaignState?.performance_goal);
console.log("isPlanProposed:", isPlanProposed);
console.log("safetyGateMessage:", safetyGateMessage);
console.log("canApplySafetyGate:", canApplySafetyGate);
console.log("====================");
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
    if (waMatch) extractedData.whatsapp = phoneMatch[1];

    // Budget & Duration (parsing only)
    const budgetMatch = instruction.match(/(?:budget|amount|day):\s*(\d+)/i) || instruction.match(/(?:₹|rs\.?)\s*(\d+)/i);
    if (budgetMatch) extractedData.budget = budgetMatch[1];
    const durationMatch = instruction.match(/(\d+)\s*days?/i);
    if (durationMatch) extractedData.duration = durationMatch[1];

    if (!isPlanProposed && mode === "meta_ads_plan") {
      const lines = instruction.split(/\n+/).map((l) => l.trim()).filter(Boolean);

      const candidate = {
        objective: null,
        destination: null,
        performance_goal: null,
        website: null,
        phone: null,
        whatsapp: null,
        service: null,
        location: null,
        budget_per_day: null,
        total_days: null,
      };

      for (const line of lines) {
        const idx = line.indexOf(":");
        if (idx === -1) continue;
        const rawKey = line.slice(0, idx).trim().toLowerCase();
        const value = line.slice(idx + 1).trim();
        if (!value) continue;

        if (rawKey === "objective") {
          const v = value.toLowerCase();
          if (v.includes("traffic")) candidate.objective = "OUTCOME_TRAFFIC";
          else if (v.includes("lead")) candidate.objective = "OUTCOME_LEADS";
          else if (v.includes("sale") || v.includes("conversion")) candidate.objective = "OUTCOME_SALES";
        } else if (rawKey === "conversion location" || rawKey === "conversion_location" || rawKey === "destination") {
          const v = value.toLowerCase();
          if (v.includes("website")) candidate.destination = "website";
          else if (v.includes("instagram")) candidate.destination = "instagram_profile";
          else if (v.includes("facebook")) candidate.destination = "facebook_page";
          else if (v.includes("call") || v.includes("phone")) candidate.destination = "call";
          else if (v.includes("whatsapp")) candidate.destination = "whatsapp";
          else if (v.includes("message")) candidate.destination = "messages";
        } else if (rawKey === "performance goal" || rawKey === "performance_goal") {
          const v = value.toLowerCase();
          if (v.includes("link") && v.includes("click")) candidate.performance_goal = "MAXIMIZE_LINK_CLICKS";
          else if (v.includes("landing") && v.includes("page")) candidate.performance_goal = "MAXIMIZE_LANDING_PAGE_VIEWS";
          else if (v.includes("conversation")) candidate.performance_goal = "MAXIMIZE_CONVERSATIONS";
          else if (v.includes("call")) candidate.performance_goal = "MAXIMIZE_CALLS";
        } else if (rawKey === "website") {
          let urlVal = value.trim();
          if (urlVal && !urlVal.startsWith("http")) urlVal = "https://" + urlVal;
          candidate.website = urlVal;
        } else if (rawKey === "phone") {
          candidate.phone = value.trim();
        } else if (rawKey === "whatsapp") {
          candidate.whatsapp = value.trim();
        } else if (rawKey === "service") {
          candidate.service = value.trim();
        } else if (rawKey === "location") {
          candidate.location = value.trim();
        } else if (rawKey === "daily budget" || rawKey === "budget" || rawKey === "daily_budget") {
          const num = parseInt(value.replace(/[^\d]/g, ""), 10);
          if (!Number.isNaN(num) && num > 0) candidate.budget_per_day = num;
        } else if (rawKey === "duration") {
          const num = parseInt(value.replace(/[^\d]/g, ""), 10);
          if (!Number.isNaN(num) && num > 0) candidate.total_days = num;
        }
      }

      const hasObjective = !!candidate.objective;
      const hasDestination = !!candidate.destination;
      const hasPerformanceGoal = !!candidate.performance_goal;
      const hasService = !!candidate.service;
      const hasLocation = !!candidate.location;
      const hasBudget = candidate.budget_per_day != null;
      const hasDuration = candidate.total_days != null;

      let hasAsset = true;
      if (candidate.destination === "website") {
        hasAsset = !!candidate.website;
      } else if (candidate.destination === "call") {
        hasAsset = !!candidate.phone;
      } else if (candidate.destination === "whatsapp") {
        hasAsset = !!candidate.whatsapp;
      }

      const expertComplete =
        hasObjective &&
        hasDestination &&
        hasPerformanceGoal &&
        hasService &&
        hasLocation &&
        hasBudget &&
        hasDuration &&
        hasAsset;

      const isFreshIntake =
        !lockedCampaignState ||
        (
          !lockedCampaignState.objective &&
          !lockedCampaignState.destination &&
          !lockedCampaignState.performance_goal &&
          !lockedCampaignState.service &&
          !lockedCampaignState.location &&
          !lockedCampaignState.budget_per_day &&
          !lockedCampaignState.total_days
        );

      if (expertComplete && isFreshIntake && effectiveBusinessId) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        const newState = {
          ...lockedCampaignState,
          objective: candidate.objective,
          destination: candidate.destination,
          performance_goal: candidate.performance_goal,
          service: candidate.service,
          service_confirmed: true,
          location: candidate.location,
          location_confirmed: true,
          budget_per_day: candidate.budget_per_day,
          total_days: candidate.total_days,
          budget_confirmed: true,
          duration_confirmed: true,
          locked_at: new Date().toISOString(),
          stage: "intake_complete",
        };

        if (candidate.destination === "website") {
          newState.landing_page = candidate.website;
          newState.landing_page_confirmed = true;
        } else if (candidate.destination === "call") {
          newState.phone = candidate.phone;
          newState.phone_confirmed = true;
        } else if (candidate.destination === "whatsapp") {
          newState.whatsapp = candidate.whatsapp;
          newState.whatsapp_confirmed = true;
        }

        await saveAnswerMemory(
          baseUrl,
          effectiveBusinessId,
          { campaign_state: newState },
          session.user.email.toLowerCase()
        );

        lockedCampaignState = newState;

        return res.status(200).json({
          ok: true,
          mode,
          gated: true,
          text: "All required Meta campaign details have been received and locked. I will now use these to draft your Meta ads plan. Reply again to continue.",
        });
      }
    }

    // ============================================================
    // 🎯 META OBJECTIVE PARSING (USER SELECTION / HIERARCHY)
    // ============================================================

    let selectedMetaObjective = null;
    let selectedDestination = null;
    let selectedPerformanceGoal = null;

    if (lockedCampaignState) {
      const stage = lockedCampaignState.stage;
      const isCompletedCycle =
        stage === "COMPLETED" || stage === "READY_TO_LAUNCH";
      if (!isCompletedCycle && !isNewMetaCampaignRequest) {
        selectedMetaObjective = lockedCampaignState.objective || null;
        selectedDestination = lockedCampaignState.destination || null;
        selectedPerformanceGoal = lockedCampaignState.performance_goal || null;
      }
    }

    // 🧑‍💬 Interactive Sequence: Objective -> Destination -> Goal

    // Step 1: Objective
    if (!isPlanProposed && mode === "meta_ads_plan" && !selectedMetaObjective) {
      const input = lowerInstruction.trim();

      if (input === "1" || input.includes("traffic")) {
        selectedMetaObjective = "OUTCOME_TRAFFIC";
      } else if (input === "2" || input.includes("lead")) {
        selectedMetaObjective = "OUTCOME_LEADS";
      } else if (input === "3" || input.includes("sale") || input.includes("conversion")) {
        selectedMetaObjective = "OUTCOME_SALES";
      } else if (input === "4" || input.includes("engagement") || input.includes("engage")) {
        selectedMetaObjective = "OUTCOME_ENGAGEMENT";
      }

      if (!isPlanProposed && selectedMetaObjective) {
        lockedCampaignState = { ...lockedCampaignState, objective: selectedMetaObjective, stage: "objective_selected" };
        currentState = lockedCampaignState;
        await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: lockedCampaignState }, session.user.email.toLowerCase());
        console.log("TRACE: ENTER META INTAKE FLOW");
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);

        let nextQuestion = "";
        if (selectedMetaObjective === "OUTCOME_TRAFFIC") {
          nextQuestion =
            "Now, where should we direct the users who click on the ad?\n\n" +
            "1. Website\n" +
            "2. Calls\n" +
            "3. Messages (WhatsApp / Messenger / Instagram)";
        } else if (selectedMetaObjective === "OUTCOME_LEADS") {
          nextQuestion =
            "Now, where should people contact you to become leads?\n\n" +
            "1. WhatsApp\n" +
            "2. Calls\n" +
            "3. Messenger / Instagram Direct";
        } else {
          nextQuestion =
            "Now, where should people complete this action?\n\n" +
            "1. Website";
        }

        return res.status(200).json({
          ok: true,
          mode,
          gated: true,
          text:
            "Got it. I’ve locked your campaign objective.\n\n" +
            nextQuestion,
        });
      } else {
        console.log("TRACE: ENTER META INTAKE FLOW");
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({
          ok: true,
          mode,
          gated: true,
          text:
            "What is the primary objective of this campaign?\n\n" +
            "Please choose ONE option:\n\n" +
            "1. Traffic – Get more people to visit your website or profile\n" +
            "2. Leads – Get more enquiries via WhatsApp, calls, or forms\n" +
            "3. Sales – Drive purchases or conversions on your website\n" +
            "4. Engagement – Get more messages, profile visits, or interactions",
        });
      }
    }

    // Step 2: Conversion Location
    if (!isPlanProposed && mode === "meta_ads_plan" && selectedMetaObjective && !selectedDestination) {
      let options = [];
      if (selectedMetaObjective === "OUTCOME_TRAFFIC") {
        options = ["Website", "Calls", "Messages (WhatsApp / Messenger / Instagram)"];
      } else if (selectedMetaObjective === "OUTCOME_LEADS") {
        options = ["WhatsApp", "Calls", "Messenger/Instagram Direct"];
      } else {
        options = ["Website"];
      }

      const input = lowerInstruction;
      if (input.includes("1") || input.includes("website") || input.includes("site")) {
        selectedDestination = "website";
      } else if (input.includes("2") || input.includes("call") || input.includes("phone")) {
        selectedDestination = "call";
      } else if (input.includes("3") || input.includes("whatsapp") || input.includes("message") || input.includes("messages") || input.includes("chat") || input.includes("dm")) {
        selectedDestination = "messages";
      } else if (selectedMetaObjective === "OUTCOME_LEADS") {
        if (input.includes("whatsapp")) selectedDestination = "whatsapp";
        else if (input.includes("call") || input.includes("phone")) selectedDestination = "call";
        else if (input.includes("messenger") || input.includes("instagram")) selectedDestination = "messages";
      }

      if (!isPlanProposed && selectedDestination) {
        lockedCampaignState = { ...lockedCampaignState, destination: selectedDestination, stage: "destination_selected" };
        currentState = lockedCampaignState;
        await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: lockedCampaignState }, session.user.email.toLowerCase());
        console.log("TRACE: ENTER META INTAKE FLOW");
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);

        let followupText = "Conversion location saved.";

        if (!lockedCampaignState.performance_goal) {
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

          followupText +=
            "\n\nWhat is your performance goal for these ads?\n\n" +
            goals.map((g, i) => `${i + 1}. ${g}`).join("\n");
        }

        return res.status(200).json({
          ok: true,
          mode,
          gated: true,
          text: followupText,
        });
      } else {
        console.log("TRACE: ENTER META INTAKE FLOW");
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({
          ok: true,
          mode,
          gated: true,
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

      if (!isPlanProposed && selectedPerformanceGoal) {
        lockedCampaignState = { ...lockedCampaignState, performance_goal: selectedPerformanceGoal, stage: "goal_selected" };
        currentState = lockedCampaignState;
        await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: lockedCampaignState }, session.user.email.toLowerCase());
        console.log("TRACE: ENTER META INTAKE FLOW");
        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({
          ok: true,
          mode,
          gated: true,
          text: "Performance goal locked.\n\nNow, what is the specific **Service** or **Product** you want to promote with this campaign?",
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

    // Step 4: Service Confirmation
    if (!isPlanProposed && mode === "meta_ads_plan" && selectedPerformanceGoal && !lockedCampaignState?.service) {
      const input = instruction.trim();
      if (input.length > 2 && !input.includes("1") && !input.includes("2")) {
        lockedCampaignState = { ...lockedCampaignState, service: input, service_confirmed: true, stage: "service_selected" };
        currentState = lockedCampaignState;
        await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: lockedCampaignState }, session.user.email.toLowerCase());
        return res.status(200).json({
          ok: true, mode, gated: true,
          text: `Got it. Promoting: **${input}**.\n\nNext, what is the **Target Location** (City or Area) for these ads?`
        });
      } else {
        return res.status(200).json({
          ok: true, mode, gated: true,
          text: "What is the specific **Service** or **Product** you want to promote? (e.g., 'Real Estate Consulting' or 'iPhone Repairs')"
        });
      }
    }

    // Step 5: Location Confirmation
    if (!isPlanProposed && mode === "meta_ads_plan" && lockedCampaignState?.service && !lockedCampaignState?.location && !lockedCampaignState?.location_confirmed) {
      const input = instruction.trim();
      // Ensure input isn't a budget number (digits) if we are mistakenly here
      const looksLikeBudget = /^\d+$/.test(input);

      if (input.length > 2 && !looksLikeBudget) {
        lockedCampaignState = { ...lockedCampaignState, location: input, location_confirmed: true, stage: "location_selected" };
        currentState = lockedCampaignState;
        await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: lockedCampaignState }, session.user.email.toLowerCase());
        return res.status(200).json({
          ok: true, mode, gated: true,
          text: `Target Location: **${input}**.\n\nAlmost done! What is your **DAILY budget** for this campaign in INR? (e.g., 500)`
        });
      } else {
        return res.status(200).json({
          ok: true, mode, gated: true,
          text: "What is the **Target Location** (City or Area) for these ads?"
        });
      }
    }

    // Step 6: Budget Confirmation
    if (!isPlanProposed && mode === "meta_ads_plan" && lockedCampaignState?.location && !lockedCampaignState?.budget_per_day) {
      const budgetMatch = instruction.match(/(\d+)/);
      if (budgetMatch) {
        const amount = parseInt(budgetMatch[1], 10);
        lockedCampaignState = { ...lockedCampaignState, budget_per_day: amount, budget_confirmed: true, stage: "budget_selected" };
        currentState = lockedCampaignState;
        await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: lockedCampaignState }, session.user.email.toLowerCase());
        return res.status(200).json({
          ok: true, mode, gated: true,
          text: `Daily Budget: **₹${amount}**.\n\nFinally, for **how many days** should this campaign run? (e.g., 7)`
        });
      } else {
        return res.status(200).json({
          ok: true, mode, gated: true,
          text: "What is your **DAILY budget** for this campaign in INR?"
        });
      }
    }

    // Step 7: Duration Confirmation
    if (!isPlanProposed && mode === "meta_ads_plan" && lockedCampaignState?.budget_per_day && !lockedCampaignState?.total_days) {
      const durationMatch = instruction.match(/(\d+)/);
      if (durationMatch) {
        const days = parseInt(durationMatch[1], 10);
        lockedCampaignState = { ...lockedCampaignState, total_days: days, duration_confirmed: true, stage: "intake_complete" };
        currentState = lockedCampaignState;
        await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: lockedCampaignState }, session.user.email.toLowerCase());
        return res.status(200).json({
          ok: true, mode, gated: true,
          text: `Duration: **${days} days**.\n\nAll details received! I am now generating your custom Meta Ads plan. Please reply with anything or just wait.`
        });
      } else {
        return res.status(200).json({
          ok: true, mode, gated: true,
          text: "For **how many days** should this campaign run?"
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

    // Detect confirmation from user reply (only during intake, before plan proposal)
    if (
      !isPlanProposed &&
      mode === "meta_ads_plan" &&
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
        let nextText = "Website confirmed as your landing page.";

        if (!lockedCampaignState?.service) {
          const rawServices =
            autoBusinessContext?.detected_services || [];
          const normalizedServices = normalizeServiceOptions(
            rawServices,
            detectedLandingPage ||
            autoBusinessContext?.business_website ||
            autoBusinessContext?.instagram_website ||
            null
          );
          const serviceOptions = normalizedServices.length
            ? normalizedServices
              .map((s, i) => `${i + 1}. ${s}`)
              .join("\n")
            : "- Type your service name";

          nextText +=
            "\n\nWhich service do you want to promote?\n\n" +
            serviceOptions;
        }

        return res.status(200).json({
          ok: true,
          mode,
          gated: true,
          text: nextText,
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

    const availableServices = normalizeServiceOptions(
      autoBusinessContext?.detected_services || [],
      detectedLandingPage ||
      autoBusinessContext?.business_website ||
      autoBusinessContext?.instagram_website ||
      null
    );

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
      !isPlanProposed &&
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
      let nextText = `Got it. I will promote "${selectedService}" in this campaign.`;

      if (!newState.location && !newState.location_confirmed) {
        nextText +=
          "\n\nWhere should this ad run? (e.g. Mumbai, New York, or 'Online')";
      } else {
        nextText +=
          "\n\nI will now ask about your budget and duration. Please answer the next question directly.";
      }

      return res.status(200).json({
        ok: true,
        mode,
        gated: true,
        text: nextText,
      });
    }

    // ============================================================
    // 📍 LOCATION DETECTION (FROM BUSINESS INTAKE ONLY)
    // ============================================================

    let detectedLocation =
      autoBusinessContext?.business_city ||
      autoBusinessContext?.business_location ||
      null;

    const hasLocation =
      !!lockedCampaignState?.location || !!lockedCampaignState?.location_confirmed;
    const alreadyAskedLocation = !!lockedCampaignState?.location_question_asked;
    const inputLooksLikeLocation =
      instruction.length > 2 &&
      !instruction.toLowerCase().includes("yes") &&
      !instruction.match(/^\d+$/);

    // ============================================================
    // ❓ LOCATION CONFIRMATION (ASK ONLY WHEN NEEDED)
    // ============================================================

    if (
      !isPlanProposed &&
      mode === "meta_ads_plan" &&
      !hasLocation &&
      !alreadyAskedLocation &&
      !inputLooksLikeLocation
    ) {
      if (effectiveBusinessId) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        const questionState = {
          ...lockedCampaignState,
          location_question_asked: true,
          locked_at: new Date().toISOString(),
        };
        await saveAnswerMemory(
          baseUrl,
          effectiveBusinessId,
          { campaign_state: questionState },
          session.user.email.toLowerCase()
        );
        lockedCampaignState = questionState;
      }
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
      instruction.toLowerCase().includes("yes") &&
      !lockedCampaignState?.location_confirmed
    ) {
      selectedLocation = detectedLocation;
    }

    // Case 2️⃣ User typed a new location (only when we are in the location stage)
    const stageForLocation = lockedCampaignState?.stage || "";
    const isInLocationStage =
      !lockedCampaignState?.location_confirmed &&
      (lockedCampaignState?.location_question_asked ||
        stageForLocation === "service_selected" ||
        stageForLocation === "goal_selected" ||
        stageForLocation === "location_selected");

    if (
      isInLocationStage &&
      !instruction.toLowerCase().includes("yes") &&
      instruction.length > 2 &&
      !instruction.match(/^\d+$/)
    ) {
      selectedLocation = instruction.trim();
    }

    if (
      !isPlanProposed &&
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
        text: `Location locked as "${selectedLocation}". I will now ask about your budget and campaign duration. Please answer the next question directly.`,
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
                budget_confirmed: true,
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
                duration_confirmed: true,
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

    if (!isPlanProposed && mode === "meta_ads_plan" && selectedMetaObjective && effectiveBusinessId) {
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

    let lockedContext = "";

    if (mode === "meta_ads_plan" && lockedCampaignState) {
      const stage = lockedCampaignState.stage;
      const isCompletedCycle =
        stage === "COMPLETED" || stage === "READY_TO_LAUNCH";
      const hasCoreLock =
        !!lockedCampaignState.objective &&
        !!lockedCampaignState.destination &&
        !!lockedCampaignState.performance_goal &&
        !!lockedCampaignState.service &&
        !!lockedCampaignState.location &&
        !!lockedCampaignState.budget_per_day &&
        !!lockedCampaignState.total_days &&
        !!lockedCampaignState.budget_confirmed &&
        !!lockedCampaignState.duration_confirmed;
      if (!isCompletedCycle && hasCoreLock) {
        lockedContext = `
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
`;
      }
    }

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
      !lockedCampaignState?.plan &&
      !isPlanProposed &&
      mode === "meta_ads_plan" &&
      (
        !lockedCampaignState?.objective ||
        !lockedCampaignState?.destination ||
        !lockedCampaignState?.performance_goal ||
        !lockedCampaignState?.service ||
        !lockedCampaignState?.location ||
        !lockedCampaignState?.budget_per_day ||
        !lockedCampaignState?.total_days ||
        !lockedCampaignState?.budget_confirmed ||
        !lockedCampaignState?.duration_confirmed
      )
    ) {
      // Technically unreachable if gates are working, but safe fallback
      let fallbackText = "Before I can draft your Meta campaign plan, I still need your daily budget and total duration in days.";
      if (!lockedCampaignState?.budget_per_day || !lockedCampaignState?.budget_confirmed) {
        fallbackText = "Before I draft the Meta campaign plan, what is your DAILY budget in INR?";
      } else if (!lockedCampaignState?.total_days || !lockedCampaignState?.duration_confirmed) {
        fallbackText = "Before I draft the Meta campaign plan, for how many days should this campaign run?";
      }
      return res.status(200).json({ ok: true, mode, gated: true, text: fallbackText });
    }

    // ⚡ CRITICAL SHORT-CIRCUIT: Skip Gemini if plan exists and user confirms (Mandatory Fix 1 & 3)
    if (
      (lockedCampaignState?.stage === "PLAN_CONFIRMED" || lockedCampaignState?.stage === "IMAGE_GENERATED" || lockedCampaignState?.stage === "READY_TO_LAUNCH") &&
      lockedCampaignState?.plan &&
      planGeneratedThisTurn === true && // 🔒 HARD GATE
      (lowerInstruction.includes("yes") ||
        lowerInstruction.includes("approve") ||
        lowerInstruction.includes("confirm") ||
        lowerInstruction.includes("proceed") ||
        lowerInstruction.includes("launch") ||
        lowerInstruction.includes("generate") ||
        lowerInstruction.includes("image") ||
        lowerInstruction.includes("ok"))
    ) {

      console.log(`[PROD_LOG] 🚀 SHORT-CIRCUIT: Transitioning Started | User: ${session.user.email} | ID: ${effectiveBusinessId} | From: ${lockedCampaignState.stage}`);

      let currentState = { ...lockedCampaignState, locked_at: new Date().toISOString() };
      // 🔒 SINGLE SOURCE OF TRUTH — waterfall must ONLY use currentState (mutated as state)
      let state = currentState;

      // 🛡️ SANITY CHECK: Detect Internal MD5 hashes masquerading as Meta Hashes (MUST RUN FIRST)
      if (typeof state.image_hash === "string" && state.image_hash.length === 32) {
        console.log("⚠️ Internal MD5 detected in image_hash. Clearing to force re-upload.");
        state.image_hash = null;
        currentState.image_hash = null;
        if (state.meta) state.meta.uploadedImageHash = null;
        if (currentState.meta) currentState.meta.uploadedImageHash = null;
      }

      if (!state.plan || !state.plan.campaign_name) {
        const hasLockedBudgetForRegen =
          !!lockedCampaignState?.budget_per_day &&
          !!lockedCampaignState?.total_days &&
          !!lockedCampaignState?.budget_confirmed &&
          !!lockedCampaignState?.duration_confirmed;

        if (mode === "meta_ads_plan" && !hasLockedBudgetForRegen) {
          if (!lockedCampaignState?.budget_per_day) {
            return res.status(200).json({
              ok: true,
              mode,
              gated: true,
              text: "Before I draft the Meta campaign plan, what is your DAILY budget in INR?"
            });
          }

          return res.status(200).json({
            ok: true,
            mode,
            gated: true,
            text: "Before I draft the Meta campaign plan, for how many days should this campaign run?"
          });
        }

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
          plan_visible: true,
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
        currentState = repairedState;

        const adAccountIdForPlan =
          (verifiedMetaAssets?.ad_account && (verifiedMetaAssets.ad_account.id || verifiedMetaAssets.ad_account.account_id)) ||
          (metaRow?.fb_ad_account_id || null);

        console.log("TRACE: RETURNING RESPONSE — STAGE =", currentState?.stage);
        return res.status(200).json({
          ok: true,
          mode,
          text: `**Plan Proposed: ${repairedState.plan.campaign_name}**\n**Ad Account ID**: \`${adAccountIdForPlan || "N/A"}\`\n\nReply **YES** to confirm and proceed.`
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

      // 🛡️ SANITY CHECK: Detect Internal MD5 hashes masquerading as Meta Hashes
      if (typeof state.image_hash === "string" && state.image_hash.length === 32) {
        console.log("⚠️ Internal MD5 detected in image_hash. Clearing to force re-upload.");
        state.image_hash = null;
        if (state.meta) state.meta.uploadedImageHash = null;
      }

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
              headers: { "Content-Type": "application/json", "x-client-email": __currentEmail || "" },
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
              imageUploadedThisTurn = true;
            } else {
              errorOcurred = true;
              stopReason = `Meta Upload Failed: ${uploadJson.message || "Unknown error"}`;
            }
          } catch (e) {
            errorOcurred = true;
            stopReason = `Meta Upload Error: ${e.message}`;
          }
        }
      }

      // --- STEP 12: EXECUTION (Final Step) ---
      if (!errorOcurred) {
        // 🔒 PATCH: Execution requires READY_TO_LAUNCH strict
        const isReady = state.stage === "READY_TO_LAUNCH" && state.image_hash;
        const wantsLaunch = lowerInstruction.includes("launch") || lowerInstruction.includes("execute") || lowerInstruction.includes("run") || lowerInstruction.includes("publish") || lowerInstruction.includes("yes") || lowerInstruction.includes("ok") || lowerInstruction.includes("proceed") || lowerInstruction.includes("confirm") || lowerInstruction.includes("go");

        if (isReady && wantsLaunch) {
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
              headers: { "Content-Type": "application/json", "x-client-email": __currentEmail || "" },
              body: JSON.stringify({ platform: "meta", payload: finalPayload })
            });
            const execJson = await execRes.json();

            if (execJson.ok) {
              campaignExecutedThisTurn = true;
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
      } else if (state.stage === "READY_TO_LAUNCH" && state.image_hash) {
        if (imageUploadedThisTurn) {
          feedbackText = `✅ **Image Uploaded & Ready**\n\nEverything is set for campaign launch.\n\n**Details**:\n- Campaign: ${state.plan.campaign_name}\n`;
        } else {
          feedbackText = `⏳ **Uploading image to Meta. Please wait...**\n\n(Debug: Stage=${state.stage}, Hash=Yes)\n\nWaiting for upload to complete...`;
        }
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

    // 🧹 CLEANUP: If Gemini outputs a JSON code block, hide it from the user flow (Meta Ads).
    // We only want to show the human-readable summary, never the raw JSON.
    if (mode === "meta_ads_plan" && text.includes("```")) {
      text = text.replace(/```(?:json)?[\s\S]*?```/g, "").trim();
      if (!text) text = "I have drafted a plan based on your requirements. Please check it internally.";
    }

    // 🔒 ABSOLUTE RULE — NO PLAN ON FIRST MESSAGE (Mandatory Fix 2)
    if (isNewMetaCampaignRequest === true && mode === "meta_ads_plan") {
      text = text.replace(/plan proposed/gi, "").replace(/proposed plan/gi, "").replace(/review the plan/gi, "").trim();
      if (text.includes("Confirm") || text.includes("YES")) {
        text = "I've started setting up your campaign. What is the primary objective of this campaign?";
      }
    }

    // 🕵️ DETECT AND SAVE JSON PLAN (FROM GEMINI)
    // Supports: ```json ... ```, ``` ... ```, or plain JSON starting with {
    // 🔒 ABSOLUTE RULE: No plan generation on first message or when user confirms
    if (effectiveBusinessId && !isNewMetaCampaignRequest && !lowerInstruction.includes("yes")) {
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
        console.log("TRACE: DIRECT JSON DETECTED — MODEL PROVIDED PLAN");

        // 🔒 REQUEST-BOUND OWNERSHIP (Mandatory Fix 1)
        planGeneratedThisTurn = true;

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

          // 🔄 NORMALIZE JSON: Variation 9 (Step 8 flat shape: step_flow + creative_assets)
          if (planJson.step_flow && planJson.campaign_name && planJson.creative_assets) {
            console.log("🔄 Normalizing Gemini JSON Variation 9 (step_flow + creative_assets)...");

            const tgt = planJson.targeting || {};
            const rawLoc = tgt.location || [];
            const locArray = Array.isArray(rawLoc) ? rawLoc : [rawLoc].filter(Boolean);
            const cities = locArray.map((l) => {
              if (typeof l === "string") {
                return { name: l };
              }
              return null;
            }).filter(Boolean);

            const creativeInput = planJson.creative_assets || {};

            const rawObj = (planJson.campaign_objective || "").toString().toUpperCase();
            let objective = "OUTCOME_TRAFFIC";
            if (rawObj.includes("LEAD")) objective = "OUTCOME_LEADS";
            else if (rawObj.includes("SALE") || rawObj.includes("CONVERSION")) objective = "OUTCOME_SALES";

            const perfGoalRaw = (planJson.optimization_goal || "").toString().toUpperCase();

            let destUrl = planJson.destination_url || "";
            if (typeof destUrl === "string") {
              destUrl = destUrl.toString().replace(/[`]/g, "").trim();
            } else {
              destUrl = "https://gabbarinfo.com";
            }

            planJson = {
              campaign_name: planJson.campaign_name || "New Campaign",
              objective,
              performance_goal: perfGoalRaw || lockedCampaignState?.performance_goal || "MAXIMIZE_LINK_CLICKS",
              budget: {
                amount: planJson.budget_daily_inr || 500,
                currency: "INR",
                type: "DAILY"
              },
              targeting: {
                geo_locations: {
                  countries: ["IN"],
                  cities: cities
                },
                age_min: 25,
                age_max: 55
              },
              ad_sets: [
                {
                  name: "Ad Set 1",
                  status: "PAUSED",
                  ad_creative: {
                    imagePrompt: creativeInput.image_prompt || creativeInput.imagePrompt || "Ad Image",
                    primary_text: creativeInput.primary_text || "",
                    headline: creativeInput.headline || "",
                    call_to_action: creativeInput.call_to_action || "LEARN_MORE",
                    destination_url: destUrl || "https://gabbarinfo.com"
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

            const hasLockedBudget =
              !!lockedCampaignState?.budget_per_day &&
              !!lockedCampaignState?.total_days &&
              !!lockedCampaignState?.budget_confirmed &&
              !!lockedCampaignState?.duration_confirmed;

            if (mode === "meta_ads_plan" && !hasLockedBudget) {
              console.log("⛔ Ignoring JSON plan because budget/duration are not locked in state.");

              // Ask for the missing field explicitly, instead of adopting a model-invented budget/duration
              if (!lockedCampaignState?.budget_per_day) {
                return res.status(200).json({
                  ok: true,
                  mode,
                  gated: true,
                  text: "Before I draft the Meta campaign plan, what is your DAILY budget in INR?"
                });
              }

              return res.status(200).json({
                ok: true,
                mode,
                gated: true,
                text: "Before I draft the Meta campaign plan, for how many days should this campaign run?"
              });
            }

            // 🔐 Enforce user-locked budget as the single source of truth
            if (lockedCampaignState?.budget_per_day) {
              planJson.budget = {
                ...(planJson.budget || {}),
                amount: lockedCampaignState.budget_per_day,
                currency: (planJson.budget && planJson.budget.currency) || "INR",
                type: (planJson.budget && planJson.budget.type) || "DAILY"
              };
            }

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
              plan_visible: true,
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

**Ad Account ID**: \`${(verifiedMetaAssets?.ad_account && (verifiedMetaAssets.ad_account.id || verifiedMetaAssets.ad_account.account_id)) || metaRow?.fb_ad_account_id || "N/A"}\`

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
            if (mode === "meta_ads_plan") {
              text = "I have drafted a campaign plan internally based on your inputs. Please ask me again to create or review the Meta ads plan if you did not see a summary.";
            }
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

    // 🔒 SINGLE PROPOSER RULE (Mandatory Fix 4)
    // Disable ALL fallback/self-healing if plan exists or stage is not null
    const canProposePlan =
      !isNewMetaCampaignRequest &&
      !lockedCampaignState?.plan &&
      !lockedCampaignState?.stage &&
      effectiveBusinessId &&
      !lowerInstruction.includes("yes");

    if ((mode === "meta_ads_plan" || isPlanText) && canProposePlan) {
      console.log("TRACE: FALLBACK META ADS PATH HIT");
      const looksLikePlan = isPlanText || text.includes("Budget") || text.includes("Creative Idea") || text.includes("Targeting") || text.includes("Creative Idea:");

      if (looksLikePlan) {
        const hasLockedBudgetFallback =
          !!lockedCampaignState?.budget_per_day &&
          !!lockedCampaignState?.total_days &&
          !!lockedCampaignState?.budget_confirmed &&
          !!lockedCampaignState?.duration_confirmed;

        if (mode === "meta_ads_plan" && !hasLockedBudgetFallback) {
          if (!lockedCampaignState?.budget_per_day) {
            return res.status(200).json({
              ok: true,
              mode,
              gated: true,
              text: "Before I draft the Meta campaign plan, what is your DAILY budget in INR?"
            });
          }

          return res.status(200).json({
            ok: true,
            mode,
            gated: true,
            text: "Before I draft the Meta campaign plan, for how many days should this campaign run?"
          });
        }
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

        if (lockedCampaignState?.budget_per_day) {
          minimalPlan.budget.amount = lockedCampaignState.budget_per_day;
        }

        // 🔒 REQUEST-BOUND OWNERSHIP (Mandatory Fix 1)
        planGeneratedThisTurn = true;

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

    if (lockedCampaignState && mode === "meta_ads_plan") {
      const stage = lockedCampaignState.stage || "PLANNING";
      const userSaysYes = lowerInstruction.includes("yes") || lowerInstruction.includes("approve") || lowerInstruction.includes("launch") || lowerInstruction.includes("ok");

      // 🔒 HARD GATE: Memory plans are READ-ONLY (Mandatory Fix 1 & 3)
      if (stage !== "COMPLETED" && userSaysYes) {



        let currentState = { ...lockedCampaignState, locked_at: new Date().toISOString() };

        // 🛡️ SANITY CHECK: Detect Internal MD5 hashes masquerading as Meta Hashes (MUST RUN FIRST)
        if (typeof currentState.image_hash === "string" && currentState.image_hash.length === 32) {
          console.log("⚠️ Internal MD5 detected in image_hash. Clearing to force re-upload.");
          currentState.image_hash = null;
          if (currentState.meta) currentState.meta.uploadedImageHash = null;
        }

        // 🛡️ DEFENSIVE: Ensure plan exists before proceeding
        if (!currentState.plan || !currentState.plan.campaign_name) {
          console.warn("⚠️ Plan missing at confirmation. Recreating plan.");
          const regeneratedPlan = await generateMetaCampaignPlan({
            lockedCampaignState,
            autoBusinessContext,
            verifiedMetaAssets,
            detectedLandingPage,
          });
          currentState.plan = regeneratedPlan;
          currentState.stage = "PLAN_PROPOSED";
          await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: currentState }, session.user.email.toLowerCase());
          return res.status(200).json({
            ok: true,
            mode,
            text: `**Plan Proposed: ${currentState.plan.campaign_name}**\n\nReply **YES** to confirm and proceed.`
          });
        }

        let waterfallLog = [];
        let errorOcurred = false;
        let stopReason = null;

        // 🛡️ SANITY CHECK: Detect Internal MD5 hashes masquerading as Meta Hashes
        if (typeof currentState.image_hash === "string" && currentState.image_hash.length === 32) {
          console.log("⚠️ Internal MD5 detected in image_hash. Clearing to force re-upload.");
          currentState.image_hash = null;
          if (currentState.meta) currentState.meta.uploadedImageHash = null;
        }

        // ===============================
        // AGENT MODE IMAGE GENERATION + UPLOAD
        // ===============================
        if (!imageUploadedThisTurn) {

          console.log(
            "🧪 IMAGE PROMPT VALUE:",
            lockedCampaignState?.plan?.image_concept
          );
          const imagePrompt =
            lockedCampaignState?.plan?.ad_sets?.[0]?.ad_creative?.imagePrompt;

          console.log("🧪 FINAL IMAGE PROMPT:", imagePrompt);

          if (!imagePrompt) {
            throw new Error("Image prompt missing in campaign plan");
          }
          const imageResp = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/images/generate`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-client-email": session.user.email,
              },
              body: JSON.stringify({
                prompt: imagePrompt,
              }),
            }
          );

          const imageJson = await imageResp.json();

          console.log("🧪 IMAGE GENERATE STATUS:", imageResp.status);
          console.log("🧪 IMAGE GENERATE RAW:", imageJson);
          console.log("🧪 IMAGE GENERATE KEYS:", Object.keys(imageJson || {}));
          if (!imageResp.ok || !imageJson?.imageBase64) {
            throw new Error("Agent image generation failed");
          }


          // 2. Upload image to Meta using EXISTING uploader
          console.log("UPLOAD IMAGE API HIT");
          const uploadResp = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/upload-image`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-client-email": session.user.email,
            },
            body: JSON.stringify({
              imageBase64: imageJson.imageBase64,
            }),
          });


          const uploadJson = await uploadResp.json();


          if (!uploadResp.ok || !uploadJson?.imageHash) {
            throw new Error("Agent image upload to Meta failed");
          }


          // 3. Persist truth
          lockedCampaignState.imageHash = uploadJson.imageHash;
          imageUploadedThisTurn = true;

          // Sync with local waterfall state
          currentState.image_hash = uploadJson.imageHash;
          currentState.stage = "READY_TO_LAUNCH";
        }


        // --- STEP 12: EXECUTION ---
        if (!errorOcurred && currentState.stage === "READY_TO_LAUNCH" && currentState.image_hash) {
          const wantsLaunch = lowerInstruction.includes("launch") || lowerInstruction.includes("execute") || lowerInstruction.includes("run") || lowerInstruction.includes("publish") || lowerInstruction.includes("yes") || lowerInstruction.includes("confirm") || lowerInstruction.includes("proceed");

          if (wantsLaunch) {
            console.log("🚀 Waterfall: Executing Campaign on Meta...");
            try {
              const plan = currentState.plan;
              const finalPayload = {
                ...plan,
                ad_sets: plan.ad_sets.map(adset => ({
                  ...adset,
                  ad_creative: { ...adset.ad_creative, image_hash: currentState.image_hash }
                }))
              };
              const execRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/execute-campaign`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-client-email": __currentEmail || "" },
                body: JSON.stringify({ platform: "meta", payload: finalPayload })
              });
              const execJson = await execRes.json();

              if (execJson.ok) {
                currentState.stage = "COMPLETED";
                currentState.final_result = execJson;
                campaignExecutedThisTurn = true;
                await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: currentState }, session.user.email.toLowerCase());
                return res.status(200).json({
                  ok: true,
                  text: `🎉 **Campaign Published Successfully!**\n\n**Meta Details**:\n- **Campaign Name**: ${plan.campaign_name}\n- **Campaign ID**: \`${execJson.id || "N/A"}\`\n\nYour campaign is now waiting in Meta Ads Manager (PAUSED).`
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

        // Save progress reached in this turn
        if (effectiveBusinessId && currentState) {
          console.log(`[PROD_LOG] ✅ State Transition Finished | ID: ${effectiveBusinessId} | FinalStage: ${currentState.stage}`);
          await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: currentState }, session.user.email.toLowerCase());
        }

        // If we stopped due to error or waiting for next step
        let feedbackText = "";
        if (errorOcurred) {
          feedbackText = `❌ **Automation Interrupted**:\n\n**Error**: ${stopReason}\n\n**Pipeline Progress**:\n${waterfallLog.join("\n")}\n\nI've saved the progress so far. Please check the error above and reply to try again.`;
        } else if (currentState?.stage === "IMAGE_GENERATED") {
          feedbackText = `✅ **Image Generated Successfully**\n\n[Image Generated]\n\n**Next Steps**:\n1. Upload image to Meta Assets\n2. Create paused campaign on Facebook/Instagram\n\nReply **LAUNCH** to complete these steps automatically.`;
        } else if (
          currentState.stage === "READY_TO_LAUNCH" &&
          currentState.image_hash
        ) {
          if (imageUploadedThisTurn) {
            feedbackText = `✅ **Image Uploaded & Ready**\n\nEverything is set for campaign launch.\n\n**Details**:\n- Campaign: ${currentState.plan.campaign_name}`;
          } else {
            feedbackText = `⏳ **Uploading image to Meta. Please wait...**\n\n(Debug: Stage=${currentState.stage}, Hash=Yes)\n\nWaiting for upload to complete...`;
          }
        } else {
          feedbackText = `**Current Pipeline Progress**:\n${waterfallLog.join("\n") || "No steps completed in this turn."}\n\n(Debug: Stage=${currentState?.stage})\n\nWaiting for your confirmation...`;
        }

        return res.status(200).json({ ok: true, text: feedbackText, imageUrl: currentState?.creative?.imageUrl, mode });
      }
    }

    if ((mode === "meta_ads_plan" || mode === "generic") && typeof text === "string") {
      const trimmed = text.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        text = "I have processed your request based on the details provided. Please ask me in plain language if you want a summary of the plan.";
      }
    }

    return res.status(200).json({ ok: true, text, mode });

  } catch (err) {
    console.error("Agent execution error:", err);
    return res.status(500).json({ ok: false, message: "Server error", error: err.message });
  }
}

async function generateMetaCampaignPlan({ lockedCampaignState, autoBusinessContext, verifiedMetaAssets, detectedLandingPage }) {
  console.log("🔄 Regenerating Meta Campaign Plan...");

  const coreReady = !!lockedCampaignState?.objective && !!lockedCampaignState?.service && !!lockedCampaignState?.location;
  if (!coreReady) {
    console.error("❌ generateMetaCampaignPlan: Mission Core Fields Missing!", {
      objective: !!lockedCampaignState?.objective,
      service: !!lockedCampaignState?.service,
      location: !!lockedCampaignState?.location
    });
    return null;
  }

  const serviceName = lockedCampaignState?.service || "Digital Marketing";
  const targetLocation = lockedCampaignState?.location || "India";
  const dailyBudget = lockedCampaignState?.budget_per_day || 500;
  const duration = lockedCampaignState?.total_days || 7;

  return {
    campaign_name: `${serviceName} - ${targetLocation} - ${new Date().toLocaleDateString()}`,
    objective: lockedCampaignState.objective || "OUTCOME_TRAFFIC",
    performance_goal: lockedCampaignState.performance_goal || "MAXIMIZE_LINK_CLICKS",
    budget: { amount: dailyBudget, currency: "INR", type: "DAILY" },
    duration: duration,
    targeting: { geo_locations: { countries: ["IN"], cities: [{ name: targetLocation }] }, age_min: 18, age_max: 65 },
    ad_sets: [{
      name: "Ad Set 1", status: "PAUSED", optimization_goal: "LINK_CLICKS", billing_event: "IMPRESSIONS", destination_type: "WEBSITE",
      ad_creative: {
        imagePrompt: `professional high-quality photography of ${serviceName} in ${targetLocation}, modern lighting, cinematic`,
        primary_text: `Looking for ${serviceName}? We provide the best solutions for your needs.`,
        headline: `Best ${serviceName} in ${targetLocation}`,
        call_to_action: "LEARN_MORE",
        destination_url: detectedLandingPage || "https://gabbarinfo.com"
      }
    }]
  };
}

async function handleInstagramPostOnly(req, res, session, body) {
  const { instruction = "" } = body;
  const { data: metaRow } = await supabase.from("meta_connections").select("*").eq("email", session.user.email.toLowerCase()).maybeSingle();
  const activeBusinessId = metaRow?.fb_business_id || "default_business";

  // Helper for retrying publication (handles "Media ID not available" latency)
  const safePublish = async (params, retries = 1) => {
    try {
      return await executeInstagramPost(params);
    } catch (e) {
      if (retries > 0 && e.message.includes("Media ID")) {
        console.warn(`[Instagram Retry] Media ID not ready. Waiting 5s... (${retries} retries left)`);
        await new Promise(r => setTimeout(r, 5000));
        return await executeInstagramPost(params);
      }
      throw e;
    }
  };

  // 📝 Path A: Direct Asset Detection (Image URL + Caption/Hashtags)
  const urlMatch = instruction.match(/https?:\/\/[^\s]+/i);
  const imageUrl = urlMatch ? urlMatch[0] : null;

  if (imageUrl) {
    try {
      // Extraction Priority: Regex for "Caption:" and "Hashtags:"
      const captionMatch = instruction.match(/Caption:\s*(.*?)(?=\s*Hashtags:|$)/is);
      const hashtagMatch = instruction.match(/Hashtags:\s*(.*)/is);

      const rawCaption = captionMatch ? captionMatch[1].trim() : "";
      const rawHashtags = hashtagMatch ? hashtagMatch[1].trim() : "";
      const combinedCaption = `${rawCaption}\n\n${rawHashtags}`.trim() || "New Post from GabbarInfo Agent";

      console.log(`[Path A] Direct Instagram Publish detected. URL: ${imageUrl}`);

      if (body.mode === "instagram_post") {
        await clearCreativeState(supabase, session.user.email.toLowerCase());
      }

      const result = await safePublish({
        userEmail: session.user.email.toLowerCase(),
        imageUrl,
        caption: combinedCaption
      });

      const containerId = result.mediaResponseJson?.id;
      const publishId = result.publishResponseJson?.id;

      return res.status(200).json({
        ok: true,
        text: "🎉 Instagram Post Published!",
        container_id: containerId,
        publish_id: publishId,
        graph_status: "200 OK"
      });
    } catch (e) {
      console.error("[Path A] Direct Publish Error:", e);
      return res.status(200).json({ ok: false, text: `Instagram publication failed: ${e.message}` });
    }
  }

  // 🗣️ Path B: Interactive Creative Mode
  const creativeResult = await creativeEntry({ supabase, session, instruction, metaRow, effectiveBusinessId: activeBusinessId });
  if (creativeResult.response) return res.json(creativeResult.response);

  // Path B: Success Publication
  if (creativeResult.assets) {
    try {
      const postResult = await safePublish({
        userEmail: session.user.email.toLowerCase(),
        imageUrl: creativeResult.assets.imageUrl,
        caption: creativeResult.assets.caption
      });

      const containerId = postResult.mediaResponseJson?.id;
      const publishId = postResult.publishResponseJson?.id;

      return res.status(200).json({
        ok: true,
        text: "🎉 Instagram Post Published!",
        container_id: containerId,
        publish_id: publishId,
        graph_status: "200 OK"
      });
    } catch (e) {
      console.error("[Path B] Publication Error:", e);
      return res.status(200).json({ ok: false, text: `Instagram publication failed: ${e.message}` });
    }
  }

  return res.json({ ok: true, text: "Thinking..." });
}

