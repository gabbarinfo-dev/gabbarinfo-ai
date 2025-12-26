// pages/api/agent/execute.js

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);


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
// 🔍 STEP 1: AGENT META ASSET DISCOVERY (CACHED)
// ============================================================

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
  const { data: meta } = await supabase
    .from("meta_connections")
    .select("*")
    .eq("email", session.user.email.toLowerCase())
    .single();

  if (!meta?.system_user_token || !meta?.fb_ad_account_id) {
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

  // Ad Account
  const adRes = await fetch(
    `https://graph.facebook.com/v19.0/act_${meta.fb_ad_account_id}?fields=account_status,currency,timezone_name&access_token=${token}`
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
let forcedBusinessContext = null;

if (metaConnected && activeBusinessId) {
  forcedBusinessContext = {
    source: "meta_connection",
    business_id: activeBusinessId,
    note: "User has exactly ONE Meta business connected. This is the active business.",
  };
}
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

   let {
  instruction,
  mode = "generic",
  includeJson = false,
  chatHistory = [],
  extraContext = "",
} = body;

// 🔁 AUTO-ROUTE TO META MODE
if (
  mode === "generic" &&
  instruction &&
  /(meta|facebook|instagram|fb|ig)/i.test(instruction)
) {
  mode = "meta_ads_plan";
}

    if (!instruction || typeof instruction !== "string") {
      return res.status(400).json({
        ok: false,
        message: "Missing 'instruction' (string) for agent mode.",
      });
    }

   // 🔒 Do NOT allow old chat history to override verified Meta assets
const historyText =
  mode === "meta_ads_plan"
    ? ""
    : Array.isArray(chatHistory)
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
  "platform": [],
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
    if (safetyGateMessage) {
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

let lockedCampaignState = null;

if (mode === "meta_ads_plan" && activeBusinessId) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  try {
    const memRes = await fetch(`${baseUrl}/api/rag/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "campaign_state",
        memory_type: "client",
        client_email: session.user.email,
        top_k: 1,
      }),
    });

    const memJson = await memRes.json();

    if (memJson?.chunks?.length) {
      try {
        lockedCampaignState = JSON.parse(
          memJson.chunks[0].content
        )?.campaign_state;
      } catch (_) {}
    }
  } catch (e) {
    console.warn("Campaign state read failed:", e.message);
  }
}

// ============================================================
// 🎯 META OBJECTIVE PARSING (USER SELECTION)
// ============================================================

let selectedMetaObjective = null;
let selectedDestination = null;

const lowerInstruction = instruction.toLowerCase().trim();

// 🔐 APPLY LOCKED OBJECTIVE FIRST (IF EXISTS)
if (
  mode === "meta_ads_plan" &&
  lockedCampaignState?.objective &&
  lockedCampaignState?.destination
) {
  selectedMetaObjective = lockedCampaignState.objective;
  selectedDestination = lockedCampaignState.destination;
}

// 🧑‍💬 Parse ONLY if not already locked
if (!selectedMetaObjective) {
  // Option 1 — Website traffic
  if (lowerInstruction === "1" || lowerInstruction.includes("website")) {
    selectedMetaObjective = "TRAFFIC";
    selectedDestination = "website";
  }

  // Option 2 — Instagram profile
  if (
    lowerInstruction === "2" ||
    lowerInstruction.includes("instagram profile")
  ) {
    selectedMetaObjective = "TRAFFIC";
    selectedDestination = "instagram_profile";
  }

  // Option 3 — Facebook page
  if (
    lowerInstruction === "3" ||
    lowerInstruction.includes("facebook page")
  ) {
    selectedMetaObjective = "TRAFFIC";
    selectedDestination = "facebook_page";
  }

  // Option 4 — Call
  if (lowerInstruction === "4" || lowerInstruction.includes("call")) {
    selectedMetaObjective = "LEAD_GENERATION";
    selectedDestination = "call";
  }

  // Option 5 — WhatsApp
  if (lowerInstruction === "5" || lowerInstruction.includes("whatsapp")) {
    selectedMetaObjective = "LEAD_GENERATION";
    selectedDestination = "whatsapp";
  }

  // Option 6 — Messages
  if (lowerInstruction === "6" || lowerInstruction.includes("message")) {
    selectedMetaObjective = "LEAD_GENERATION";
    selectedDestination = "messages";
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
}

// ============================================================
// 🎯 META OBJECTIVE SELECTION — HARD BLOCK (STATE AWARE)
// ============================================================

if (
  mode === "meta_ads_plan" &&
  !selectedMetaObjective
) {
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

// ============================================================
// 📞 CALL DESTINATION CONFIRMATION (NO ASSUMPTIONS)
// ============================================================

let detectedPhoneNumber = null;

// 1️⃣ Synced business phone (AUTHORITATIVE)
if (autoBusinessContext?.business_phone) {
  detectedPhoneNumber = autoBusinessContext.business_phone;
}

// 2️⃣ RAG fallback (only if FB phone not found)
if (!detectedPhoneNumber && ragContext) {
  const phoneMatch = ragContext.match(/(\+?\d[\d\s-]{8,15})/);
  if (phoneMatch) {
    detectedPhoneNumber = phoneMatch[1];
  }
}

// 3️⃣ If CALL objective selected but no number → STOP & ASK
if (selectedDestination === "call" && !detectedPhoneNumber) {
  return res.status(200).json({
    ok: true,
    mode,
    gated: true,
    text:
      "I couldn’t find a phone number on your Facebook Page or saved business memory.\n\n" +
      "Please type the exact phone number you want people to call (with country code).",
  });
}

// 4️⃣ Ask confirmation if number found
if (
  selectedDestination === "call" &&
  detectedPhoneNumber &&
  !lowerInstruction.includes("yes")
) {
  return res.status(200).json({
    ok: true,
    mode,
    gated: true,
    text:
      `I found this phone number:\n\n📞 ${detectedPhoneNumber}\n\n` +
      "Should I use this number for your Call Ads?\n\nReply YES to confirm or paste a different number.",
  });
}

// ============================================================
// 💬 WHATSAPP DESTINATION CONFIRMATION (ALWAYS ASK)
// ============================================================

let detectedWhatsappNumber = null;

// 1️⃣ Suggest synced business phone (DO NOT auto-use)
if (autoBusinessContext?.business_phone) {
  detectedWhatsappNumber = autoBusinessContext.business_phone;
}

// 2️⃣ If WhatsApp selected → ALWAYS confirm
if (selectedDestination === "whatsapp") {
  const suggestionText = detectedWhatsappNumber
    ? `\n\nI found this number on your Facebook Page:\n📱 ${detectedWhatsappNumber}`
    : "";

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

let landingPageConfirmed = false;

// Detect confirmation from user reply
if (
  instruction.toLowerCase().includes("yes") ||
  instruction.toLowerCase().includes("use this") ||
  instruction.toLowerCase().includes("correct")
) {
  landingPageConfirmed = true;
}

// If objective is website traffic and landing page exists but not confirmed
if (
  selectedDestination === "website" &&
  detectedLandingPage &&
  !landingPageConfirmed
) {
  return res.status(200).json({
    ok: true,
    gated: true,
    text:
      `I found this website from your connected assets:\n\n` +
      `${detectedLandingPage}\n\n` +
      `Is this the page you want people to visit?\n\n` +
      `Reply YES to confirm, or paste a different URL.`,
  });
}

// ============================================================
// 🔒 LOCK CAMPAIGN STATE — OBJECTIVE & DESTINATION FINAL
// ============================================================

if (mode === "meta_ads_plan" && selectedMetaObjective && activeBusinessId) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  await saveAnswerMemory(baseUrl, activeBusinessId, {
    campaign_state: {
      stage: "objective_selected",
      objective: selectedMetaObjective,
      destination: selectedDestination,
      locked_at: new Date().toISOString(),
    },
  });
}

    // ============================================================
// 🧾 SERVICE CONFIRMATION (FROM BUSINESS INTAKE ONLY)
// ============================================================

let selectedService = null;

// If already stored in campaign_state, reuse it
if (lockedCampaignState?.service) {
  selectedService = lockedCampaignState.service;
}

// Otherwise, ask user to confirm
if (
  mode === "meta_ads_plan" &&
  !selectedService &&
  autoBusinessContext?.detected_services?.length
) {
  const servicesList = autoBusinessContext.detected_services
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n");

  return res.status(200).json({
    ok: true,
    mode,
    gated: true,
    text:
      "Which service do you want to promote in this campaign?\n\n" +
      servicesList +
      "\n\nReply with the option number or paste the service name.",
  });
}

// Capture user selection
if (
  mode === "meta_ads_plan" &&
  !selectedService &&
  autoBusinessContext?.detected_services?.length
) {
  const index = parseInt(lowerInstruction, 10);
  if (!isNaN(index)) {
    selectedService =
      autoBusinessContext.detected_services[index - 1] || null;
  } else {
    selectedService = lowerInstruction;
  }
}

// Save service in campaign_state
if (
  mode === "meta_ads_plan" &&
  selectedService &&
  activeBusinessId
) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  await saveAnswerMemory(baseUrl, activeBusinessId, {
    campaign_state: {
      ...(lockedCampaignState || {}),
      service: selectedService,
    },
  });
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
if (selectedDestination === "messages") {
  const msg = `
Where do you want people to message you?

Please choose ONE option:

1. Instagram messages
2. Facebook Messenger
3. WhatsApp
4. All available
`.trim();

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

 // ===============================
// 🖼️ IMAGE SOURCE DECISION (SAFE)
// ===============================

let imageHash = null;

// CASE 1️⃣: Client provided an image URL
if (body.image_url) {
  const upload = await fetch(`${baseUrl}/api/meta/upload-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageUrl: body.image_url,
    }),
  });

  const uploadJson = await upload.json();

  if (!uploadJson?.ok || !uploadJson.imageHash) {
    return res.json({
      ok: false,
      message: "Image upload failed (client image).",
    });
  }

  imageHash = uploadJson.imageHash;
}

// CASE 2️⃣: No image given → generate using AI
else {
  // Generate image using OpenAI
  const imgGen = await fetch(`${baseUrl}/api/images/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: image_prompt }),
  });

  const imgJson = await imgGen.json();

  if (!imgJson?.ok || !imgJson.imageBase64) {
    return res.json({
      ok: false,
      message: "Image generation failed",
    });
  }

  // Upload AI image to Meta
  const upload = await fetch(`${baseUrl}/api/meta/upload-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64: imgJson.imageBase64,
    }),
  });

  const uploadJson = await upload.json();

  if (!uploadJson?.ok || !uploadJson.imageHash) {
    return res.json({
      ok: false,
      message: "Image upload failed",
    });
  }

  imageHash = uploadJson.imageHash;
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
          image_hash: imageHash,
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
    // ============================================================
// 💾 STORE META OBJECTIVE IN MEMORY (ONCE USER SELECTS)
// ============================================================

if (
  mode === "meta_ads_plan" &&
  selectedMetaObjective &&
  selectedDestination &&
  activeBusinessId
) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  await saveAnswerMemory(baseUrl, activeBusinessId, {
    meta_objective: selectedMetaObjective,
    meta_destination: selectedDestination,
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

YOUR CORE JOB:
- Understand the user's instruction.
- Decide what they actually need:
  - Google Ads plan / campaign JSON
  - Meta (Facebook/Instagram) ads plan / creative JSON
  - Social media plan
  - SEO / blog
  - Or a mixed strategy
- Produce either:
  - A clear, step-by-step actionable plan, OR
  - Valid backend JSON payloads (ONLY when the user explicitly asks for JSON).

====================================================
CRITICAL AGENT SAFETY & BUSINESS CONTEXT RULES
====================================================

GENERAL (APPLIES TO ALL PLATFORMS):
- You MUST NEVER claim that you already executed actions in Google Ads, Meta, LinkedIn, or WordPress.
- You MUST NOT publish, spend money, or activate campaigns without explicit confirmation.
- When JSON is requested, follow the exact schemas provided.
- Assume India as default geography unless specified otherwise.

----------------------------------------------------
META (FACEBOOK / INSTAGRAM) BUSINESS RULES
----------------------------------------------------
- If "Forced Meta Business Context" is present:
  - That business is the ACTIVE business.
  - Assets (Page / IG / Ad Account) are already connected and authorized.
  - You are STRICTLY FORBIDDEN from asking:
    - business name
    - active company
    - which page/account to use
- Proceed directly with:
  - campaign planning
  - creative generation
  - Meta JSON payloads
- Ask ONLY campaign-level questions if genuinely missing:
  - objective
  - budget
  - location (if not inferable)
- You are STRICTLY FORBIDDEN from inventing or guessing URLs.
  - For website traffic campaigns:
  - Use ONLY the confirmed landing page provided in CONTEXT.
  - If no landing page is provided, STOP and ask the user.
- NEVER use example.com, placeholder URLs, or assumed paths.


----------------------------------------------------
GOOGLE ADS BUSINESS RULES
----------------------------------------------------
- Google Ads does NOT rely on Meta business context.
- If the task is Google Ads:
  - You may proceed even if Forced Meta Business Context exists.
  - You MUST rely on:
    - Client memory (RAG)
    - Auto-detected business intake
    - Or user-provided details
- If NO business info exists at all:
  - Ask ONLY the MINIMUM required Google Ads details:
    - what is being advertised
    - goal (leads / traffic / sales)
    - landing page (if needed)
- NEVER block Google Ads flow due to Meta business rules.

----------------------------------------------------
MULTIPLE BUSINESS SAFETY
----------------------------------------------------
- If MULTIPLE businesses are detected in CLIENT CONTEXT:
  - You MUST ask the user to explicitly choose ONE business
  - UNLESS Forced Meta Business Context is present
- Forced Meta Business Context ALWAYS overrides ambiguity.

====================================================
PLATFORM MODE GUIDANCE
====================================================
${modeFocus}

====================================================
CLIENT CONTEXT (AUTHORITATIVE — MUST BE USED)
====================================================
Verified Meta Assets:
${verifiedMetaAssets ? JSON.stringify(verifiedMetaAssets, null, 2) : "(none)"}

Verified Meta Ad Account ID (MUST be used in all Meta JSON):
${verifiedMetaAssets?.ad_account?.id || verifiedMetaAssets?.ad_account?.account_id || "(missing)"}

Forced Meta Business Context:
${forcedBusinessContext ? JSON.stringify(forcedBusinessContext, null, 2) : "(none)"}

Auto-Detected Business Intake (from connected assets):
${autoBusinessContext ? JSON.stringify(autoBusinessContext, null, 2) : "(none)"}

RAG / Memory Context:
${ragContext || "(none)"}

Resolved Platforms (AUTHORITATIVE — MUST BE USED EXACTLY IN JSON):
${JSON.stringify(resolvedPlatforms)}

====================================================
QUESTION GENERATION CONTEXT (MUST BE USED)
====================================================

context:
${JSON.stringify(autoBusinessContext || forcedBusinessContext || {}, null, 2)}

====================================================
FINAL OVERRIDE RULE
====================================================
If Forced Meta Business Context is present:
- The business is already selected
- The assets are already connected
- You MUST proceed
- You MUST NOT ask for business name or active company
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


// ===============================
// 🧠 STEP-1 / STEP-2 NORMAL AGENT RESPONSE
// ===============================
return res.status(200).json({
  ok: true,
  mode,
  text, // 👈 plain English reply allowed
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
