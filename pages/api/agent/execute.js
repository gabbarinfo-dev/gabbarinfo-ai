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

async function saveAnswerMemory(baseUrl, business_id, answers) {
  try {
    if (baseUrl) {
      const resp = await fetch(`${baseUrl}/api/agent/answer-memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id,
          answers,
        }),
      });
      if (resp.ok) return;
    }
  } catch {}
  if (!__currentEmail) return;
  const { data: existing } = await supabase
    .from("agent_memory")
    .select("content")
    .eq("email", __currentEmail)
    .eq("memory_type", "client")
    .maybeSingle();
  let content = {};
  try {
    content = existing?.content ? JSON.parse(existing.content) : {};
  } catch {
    content = {};
  }
  content.business_answers = content.business_answers || {};
  content.business_answers[business_id] = {
    ...(content.business_answers[business_id] || {}),
    ...answers,
    updated_at: new Date().toISOString(),
  };
  await supabase.from("agent_memory").upsert(
    {
      email: __currentEmail,
      memory_type: "client",
      content: JSON.stringify(content),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email,memory_type" }
  );
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
    __currentEmail = session.user.email.toLowerCase();
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
    // FIXED: We allow history but we instruct the model to prioritize verified assets.
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
  "campaign_name": "Dentist Clinic – Mumbai – Jan 2026",
  "objective": "OUTCOME_TRAFFIC",
  "budget": {
    "amount": 500,
    "currency": "INR",
    "type": "DAILY"
  },
  "targeting": {
    "geo_locations": { "countries": ["IN"], "cities": [{"name": "Mumbai"}] },
    "age_min": 25,
    "age_max": 55
  },
  "ad_sets": [
    {
      "name": "Ad Set 1",
      "status": "PAUSED",
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
      try {
        // DIRECT DB READ (Reliable State) instead of RAG
        const { data: memData } = await supabase
          .from("agent_memory")
          .select("content")
          .eq("email", session.user.email.toLowerCase())
          .eq("memory_type", "client")
          .maybeSingle();

        if (memData?.content) {
          const content = JSON.parse(memData.content);
          if (content.business_answers?.[activeBusinessId]?.campaign_state) {
            lockedCampaignState = content.business_answers[activeBusinessId].campaign_state;
          }
        }
      } catch (e) {
        console.warn("Campaign state read failed:", e.message);
      }
    }

    let selectedService = null;
    let selectedLocation = null;

    // ============================================================
    // 🚀 DIRECT USER JSON → AUTO EXECUTE (Plan → Image → Launch)
    // ============================================================
    if (mode === "meta_ads_plan" && activeBusinessId && typeof instruction === "string") {
      let userJsonString = null;
      const cbMatch = instruction.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (cbMatch) {
        userJsonString = cbMatch[1];
      } else {
        const sIdx = instruction.indexOf("{");
        const eIdx = instruction.lastIndexOf("}");
        if (sIdx !== -1 && eIdx !== -1 && eIdx > sIdx) {
          userJsonString = instruction.substring(sIdx, eIdx + 1);
        }
      }
      if (userJsonString) {
        try {
          let userPlan = JSON.parse(userJsonString);
          // Normalize Variation 5: { campaign_details, ad_sets: [{ ads: [{ creative: {...} }]}]}
          if (userPlan.campaign_details && Array.isArray(userPlan.ad_sets)) {
            const cd = userPlan.campaign_details;
            const adset0 = userPlan.ad_sets[0] || {};
            const ads0 = Array.isArray(adset0.ads) ? adset0.ads[0] || {} : {};
            const creative = ads0.creative || {};
            const tgt = adset0.targeting || {};
            const geo = Array.isArray(tgt.geo_locations) ? tgt.geo_locations[0] || {} : {};
            const countries = [];
            const cities = [];
            if (geo.country) countries.push(geo.country);
            if (Array.isArray(geo.cities)) {
              for (const c of geo.cities) {
                if (typeof c === "string") cities.push({ name: c });
                else if (c?.name) cities.push({ name: c.name });
              }
            }
            const urlCandidate = (ads0.landing_page_url || creative.landing_page || creative.destination_url || "").toString();
            const cleanUrl = urlCandidate.replace(/[`]/g, "").trim() || "https://gabbarinfo.com";
            const primaryText = Array.isArray(creative.primaryText) ? creative.primaryText[0] : (creative.primary_text || "");
            const headline = Array.isArray(creative.headlines) ? creative.headlines[0] : (creative.headline || "");
            const call_to_action = ads0.call_to_action || creative.call_to_action || "LEARN_MORE";
            const budgetAmount = adset0.daily_budget?.amount || userPlan.budget?.amount || 500;
            userPlan = {
              campaign_name: cd.name || "New Campaign",
              objective: cd.objective && cd.objective.includes("CLICK") ? "OUTCOME_TRAFFIC" : (cd.objective || "OUTCOME_TRAFFIC"),
              budget: {
                amount: budgetAmount,
                currency: adset0.daily_budget?.currency || "INR",
                type: "DAILY"
              },
              targeting: {
                geo_locations: { countries: countries.length ? countries : ["IN"], cities },
                age_min: tgt.age_min || 18,
                age_max: tgt.age_max || 65
              },
              ad_sets: [
                {
                  name: adset0.name || "Ad Set 1",
                  status: cd.status || "PAUSED",
                  ad_creative: {
                    imagePrompt: creative.imagePrompt || creative.image_prompt || "Ad Image",
                    primary_text: primaryText || "",
                    headline: headline || "",
                    call_to_action,
                    destination_url: cleanUrl
                  }
                }
              ]
            };
          }
          // If normalized to our schema, auto-run the pipeline now
          if (userPlan.campaign_name && userPlan.ad_sets?.length) {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
            const proposedState = {
              ...lockedCampaignState,
              stage: "PLAN_PROPOSED",
              plan: userPlan
            };
            await saveAnswerMemory(baseUrl, activeBusinessId, { campaign_state: proposedState });
            lockedCampaignState = proposedState;
            // Generate image
            const creative = userPlan.ad_sets[0].ad_creative || {};
            const imagePrompt = creative.imagePrompt || creative.primary_text || `${userPlan.campaign_name} ad image`;
            const imgRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/images/generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: imagePrompt })
            });
            const imgJson = await parseResponseSafe(imgRes);
            if (!imgJson?.imageBase64) {
              return res.status(200).json({ ok: false, message: "Image generation failed for provided JSON." });
            }
            const newCreative = { ...creative, imageBase64: imgJson.imageBase64, imageUrl: `data:image/png;base64,${imgJson.imageBase64}` };
            const imageState = { ...lockedCampaignState, stage: "IMAGE_GENERATED", creative: newCreative };
            await saveAnswerMemory(baseUrl, activeBusinessId, { campaign_state: imageState });
            lockedCampaignState = imageState;
            // Upload image to Meta
            const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/upload-image`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Client-Email": __currentEmail || "" },
              body: JSON.stringify({ imageBase64: newCreative.imageBase64 })
            });
            const uploadJson = await parseResponseSafe(uploadRes);
            const imageHash = uploadJson.imageHash || uploadJson.image_hash;
            if (!uploadJson?.ok || !imageHash) {
              return res.status(200).json({ ok: false, message: "Image upload failed for provided JSON.", details: uploadJson });
            }
            const readyState = { ...lockedCampaignState, stage: "READY_TO_LAUNCH", image_hash: imageHash };
            await saveAnswerMemory(baseUrl, activeBusinessId, { campaign_state: readyState });
            lockedCampaignState = readyState;
            // Execute paused campaign
            const finalPayload = {
              ...userPlan,
              ad_sets: userPlan.ad_sets.map((adset) => ({
                ...adset,
                ad_creative: { ...adset.ad_creative, image_hash: imageHash }
              }))
            };
            const execRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/execute-campaign`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Client-Email": __currentEmail || "" },
              body: JSON.stringify({ platform: "meta", payload: finalPayload })
            });
            let execJson = {};
            try { execJson = await execRes.json(); } catch (_) { execJson = { raw: await execRes.text() }; }
            if (execJson?.ok) {
              await saveAnswerMemory(baseUrl, activeBusinessId, { campaign_state: { stage: "COMPLETED", final_result: execJson } });
              return res.status(200).json({
                ok: true,
                text: `Campaign created (PAUSED).\nCampaign: ${userPlan.campaign_name}\nImageHash: ${imageHash}\nStatus: ${execJson.status || "PAUSED"}\nID: ${execJson.id || "N/A"}`,
                result: execJson
              });
            } else {
              return res.status(200).json({ ok: false, message: `Execution failed: ${execJson?.message || "Unknown error"}`, details: execJson });
            }
          }
        } catch (e) {
          // If user JSON fails to parse, continue with normal agent flow.
        }
      }
    }

    // ============================================================
    // 🤖 STATE MACHINE: EXECUTION FLOW (Plan -> Image -> Launch)
    // ============================================================
    if (lockedCampaignState) {
      const stage = lockedCampaignState.stage || "PLANNING";
      const userSaysYes =
        instruction.toLowerCase().includes("yes") ||
        instruction.toLowerCase().includes("approve") ||
        instruction.toLowerCase().includes("confirm") ||
        instruction.toLowerCase().includes("proceed") ||
        instruction.toLowerCase().includes("launch"); // Added LAUNCH

      // 1️⃣ TRANSITION: PLAN_PROPOSED -> IMAGE_GENERATION
      // Relaxed condition: If we have a plan but no image yet, and user says YES/LAUNCH
      const hasPlan = lockedCampaignState.plan && lockedCampaignState.plan.campaign_name;
      const hasImage = lockedCampaignState.creative && lockedCampaignState.creative.imageBase64;

      if ((stage === "PLAN_PROPOSED" || (hasPlan && !hasImage)) && userSaysYes) {
        // User accepted the JSON plan. Now generate image.
        const plan = lockedCampaignState.plan;
        
        console.log("🚀 Starting Image Generation...");

        // Safety check: Is plan valid?
        if (!plan || !plan.campaign_name) {
             console.warn("Invalid plan in state, resetting...");
             // Allow fall-through to re-generate plan
        } else {

            // Synthesize a prompt for the image generator (based on plan)
            const creative = plan.ad_sets?.[0]?.ad_creative || {};
            const imagePrompt =
            creative.imagePrompt ||
            creative.primary_text ||
            `${plan.campaign_name} ad image`;

            // Call Image Gen API
        const imgRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/images/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: imagePrompt }),
            });
            const imgJson = await parseResponseSafe(imgRes);

            if (imgJson.imageBase64) {
            const newCreative = {
                ...creative,
                imageBase64: imgJson.imageBase64,
                imageUrl: `data:image/png;base64,${imgJson.imageBase64}` // For UI display
            };

            // Update State
            const newState = {
                ...lockedCampaignState,
                stage: "IMAGE_GENERATED",
                creative: newCreative
            };

            await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, activeBusinessId, {
                campaign_state: newState
            });

            return res.status(200).json({
                ok: true,
                text: `I've generated an image for your ad based on the plan.\n\nHere it is:\n\n[Image Generated]\n\nDo you want to use this image and launch the campaign? Reply YES to confirm.`,
                imageUrl: newCreative.imageUrl
            });
            } else {
               // Image gen failed
               return res.status(200).json({
                   ok: true,
                   text: "I tried to generate the image, but the image service is not responding. Please try again."
               });
            }
        }
      }

      // 2️⃣ TRANSITION: IMAGE_GENERATED -> READY_TO_LAUNCH
      const hasImageHash = lockedCampaignState.image_hash;
      
      if ((stage === "IMAGE_GENERATED" || (hasImage && !hasImageHash)) && userSaysYes) {
        // Upload image to Meta
        const creative = lockedCampaignState.creative;

        const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/upload-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Client-Email": __currentEmail || "" },
          body: JSON.stringify({ imageBase64: creative.imageBase64 })
        });

        const uploadJson = await parseResponseSafe(uploadRes);

        if (uploadJson.ok && uploadJson.imageHash) {
          // Ready to launch
          const newState = {
            ...lockedCampaignState,
            stage: "READY_TO_LAUNCH",
            image_hash: uploadJson.imageHash
          };

          await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, activeBusinessId, {
            campaign_state: newState
          });

          const plan = lockedCampaignState.plan;
          return res.status(200).json({
            ok: true,
            text: `Image uploaded successfully (Hash: ${uploadJson.imageHash}).\n\n**Final Confirmation in a paused state**:\n- Campaign: ${plan.campaign_name}\n- Budget: ${plan.budget_amount} ${plan.budget_currency}\n\nReply YES to publish this campaign to Meta.`
          });
        }
      }

      // 3️⃣ TRANSITION: READY_TO_LAUNCH -> LAUNCHED
      if (stage === "READY_TO_LAUNCH" && userSaysYes) {
        // Execute!
        const plan = lockedCampaignState.plan;
        const finalPayload = {
          ...plan,
          ad_sets: plan.ad_sets.map(adset => ({
            ...adset,
            ad_creative: {
              ...adset.ad_creative,
              image_hash: lockedCampaignState.image_hash
            }
          }))
        };

        const execRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/execute-campaign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: "meta",  // or derive from plan
            payload: finalPayload
          })
        });

        const execJson = await execRes.json();

        if (execJson.ok) {
          // Clear State (or mark complete)
          await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, activeBusinessId, {
            campaign_state: { stage: "COMPLETED", final_result: execJson }
          });

          return res.status(200).json({
            ok: true,
            text: `🎉 Campaign Published Successfully!\n\nStatus: ${execJson.status || "PAUSED"}\nID: ${execJson.id || "N/A"}`
          });
        } else {
          return res.status(200).json({
            ok: true,
            text: `❌ Execution Failed: ${execJson.message || "Unknown error"}`
          });
        }
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
      
      // 🛠️ CLEAR LOCKED OBJECTIVE IN DB
      if (activeBusinessId && lockedCampaignState) {
         const newState = {
           ...lockedCampaignState,
           objective: null,
           destination: null,
           stage: "reset_objective" 
         };
         const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
         await saveAnswerMemory(baseUrl, activeBusinessId, {
           campaign_state: newState
         });
         lockedCampaignState = newState; // Update local
      }
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

    let landingPageConfirmed = !!lockedCampaignState?.landing_page;

    // Detect confirmation from user reply
    if (
      !landingPageConfirmed &&
      (instruction.toLowerCase().includes("yes") ||
        instruction.toLowerCase().includes("use this") ||
        instruction.toLowerCase().includes("correct"))
    ) {
      landingPageConfirmed = true;
      // 💾 Save to state immediately
      if (activeBusinessId && detectedLandingPage) {
        lockedCampaignState = {
          ...lockedCampaignState,
          landing_page: detectedLandingPage,
          locked_at: new Date().toISOString()
        };
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        await saveAnswerMemory(baseUrl, activeBusinessId, {
          campaign_state: lockedCampaignState
        });
      }
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
    // 🧾 SERVICE DETECTION (FROM BUSINESS INTAKE)
    // ============================================================

    const availableServices =
      autoBusinessContext?.detected_services || [];

    // ============================================================
    // ❓ SERVICE CONFIRMATION (BEFORE BUDGET / LOCATION)
    // ============================================================

    // Logic: If Service is NOT locked, preventing moving forward
    if (
      mode === "meta_ads_plan" &&
      !lockedCampaignState?.service
    ) {
      // Check if user is confirming a service just now
      const serviceIndex = parseInt(lowerInstruction, 10);

      if (
        !isNaN(serviceIndex) &&
        availableServices[serviceIndex - 1]
      ) {
        selectedService = availableServices[serviceIndex - 1];
        // Will be saved by the lock logic below
      } else {
        // Gate is CLOSED -> Ask question
        return res.status(200).json({
          ok: true,
          gated: true,
          text:
            "Which service do you want to promote in this campaign?\n\n" +
            (availableServices.length
              ? availableServices.map((s, i) => `${i + 1}. ${s}`).join("\n")
              : "- General Business Promotion\n- Specific Offer") +
            "\n\nReply with the option number or type the service name.",
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
      activeBusinessId
    ) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

      const newState = {
        ...lockedCampaignState,
        service: selectedService,
        stage: "service_selected",
        locked_at: new Date().toISOString(),
      };

      await saveAnswerMemory(baseUrl, activeBusinessId, {
        campaign_state: newState,
      });

      // Update local state so subsequent logic works in THIS turn
      lockedCampaignState = newState;
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
      mode === "meta_ads_plan" &&
      !lockedCampaignState?.location
    ) {
      if (detectedLocation) {
        return res.status(200).json({
          ok: true,
          gated: true,
          text:
            `I detected this location for your business:\n\n📍 ${detectedLocation}\n\n` +
            `Should I run ads for this location?\n\n` +
            `Reply YES to confirm, or type a different city / area.`,
        });
      } else {
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
      activeBusinessId
    ) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

      const newState = {
        ...lockedCampaignState,
        location: selectedLocation,
        stage: "location_selected",
        locked_at: new Date().toISOString(),
      };

      await saveAnswerMemory(baseUrl, activeBusinessId, {
        campaign_state: newState,
      });

      // Update local state so subsequent logic works in THIS turn
      lockedCampaignState = newState;

      // OPTIONAL: immediate continue signal?
      // For now, let the user see the confirmation or next gate
    }

    // ============================================================
    // 💰 BUDGET & TARGETING GATE (STRICT)
    // ============================================================
    if (
      mode === "meta_ads_plan" &&
      lockedCampaignState?.service &&
      lockedCampaignState?.location
    ) {
      // If we are here, we have Service + Location locked.
      // We must check if we have a PLAN proposed yet.

      if (!lockedCampaignState.plan) {
        // We need to propose a plan, BUT we want Gemini to have clear instructions
        // The systemPrompt "should" handle it, but let's force a specific "Planning Phase" call
        // The existing logic falls through to Gemini below.

        // We add a specific instruction to the context:
        // "User has confirmed Service + Location. NOW generating detailed plan."
      }
    }


    // ============================================================
    // 🔒 LOCK CAMPAIGN STATE — OBJECTIVE & DESTINATION FINAL
    // ============================================================

    if (mode === "meta_ads_plan" && selectedMetaObjective && activeBusinessId) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

      const newState = {
        ...lockedCampaignState, // Preserve existing state (service/location if any)
        stage: "objective_selected",
        objective: selectedMetaObjective,
        destination: selectedDestination,
        locked_at: new Date().toISOString(),
      };

      await saveAnswerMemory(baseUrl, activeBusinessId, {
        campaign_state: newState,
      });

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
    // ============================================================
    // 🔒 INJECT LOCKED CAMPAIGN STATE INTO GEMINI CONTEXT (AUTHORITATIVE)
    // ============================================================

    const lockedContext = lockedCampaignState
      ? `
LOCKED CAMPAIGN STATE (DO NOT CHANGE OR RE-ASK):
- Objective: ${lockedCampaignState.objective || "N/A"}
- Destination: ${lockedCampaignState.destination || "N/A"}
- Service: ${lockedCampaignState.service || "N/A"}
- Location: ${lockedCampaignState.location || "N/A"}

RULES:
- You MUST NOT ask again for objective, destination, service, or location.
- You MUST use these as FINAL.
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
3.  Objective Confirmation (Traffic/Leads etc.)
4.  Objective Details (Destination URL / WhatsApp Number)
5.  Safety Gate (Budget/Approval)
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

${lockedContext ? "✅ LOCKED CONTEXT DETECTED (Steps 3-7 Complete)" : "⚠️ NO LOCKED CONTEXT (Steps 1-7 In Progress)"}

IF LOCKED CONTEXT EXISTS (Service + Location + Objective):
- You are at STEP 8 (Strategy Proposal).
- You MUST generate the "Backend JSON" for the campaign plan immediately.
- Do NOT ask more questions.
- Use the JSON schema defined in your Mode Focus.
- The plan MUST include:
  - Campaign Name (Creative & Descriptive)
  - Budget (Daily, INR)
  - Targeting (Location from Locked Context)
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
- For Step 12 (Execution), NEVER simulate the output. The system will detect your "YES" confirmation and run the API.

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
    if (mode === "meta_ads_plan" && (!lockedCampaignState?.service || !lockedCampaignState?.location)) {
      // Technically unreachable if gates are working, but safe fallback
      return res.status(200).json({ ok: true, text: "waiting for details..." });
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
    if (activeBusinessId) {
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
             // Verify it looks like our JSON (has campaign_name or EXECUTE)
             const candidate = rawText.substring(start, end + 1);
             if (candidate.includes("campaign_") || candidate.includes("EXECUTE")) {
                 jsonString = candidate;
             }
        }
      }

      if (jsonString) {
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
              objective: s.objective || "OUTCOME_TRAFFIC",
              budget: {
                amount: s.daily_budget_inr || 500,
                currency: "INR",
                type: "DAILY"
              },
              targeting: {
                geo_locations: { countries: ["IN"], cities: t.locations?.map(l => ({ name: l })) || [] },
                age_min: parseInt(t.age_range?.split("-")[0]) || 18,
                age_max: parseInt(t.age_range?.split("-")[1]) || 65
              },
              ad_sets: [
                {
                  name: c.creative_set_name || "Ad Set 1",
                  status: "PAUSED",
                  ad_creative: {
                    imagePrompt: c.image_prompt || "Ad Image",
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
             const ads = planJson.ad_set_details || {};
             const c = planJson.creative_details || {};

             planJson = {
               campaign_name: d.name || "New Campaign",
               objective: d.objective || "OUTCOME_TRAFFIC",
               budget: {
                 amount: d.budget_daily_inr || 500,
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
                     imagePrompt: c.image_prompt || "Ad Image",
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
             const d = planJson.campaign_plan;
             const ads = d.ad_set_details || {};
             const c = d.creative_details || {};

             planJson = {
               campaign_name: d.name || "New Campaign",
               objective: d.objective || "OUTCOME_TRAFFIC",
               budget: {
                 amount: d.budget_daily_inr || 500,
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
                     imagePrompt: c.image_prompt || "Ad Image",
                     primary_text: c.primary_text || "",
                     headline: c.headline || "",
                     call_to_action: c.call_to_action || "LEARN_MORE",
                     destination_url: d.destination || c.landing_page || "https://gabbarinfo.com"
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
               objective: (d.objective && d.objective.includes("CLICK")) ? "OUTCOME_TRAFFIC" : (d.objective || "OUTCOME_TRAFFIC"),
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
            const newState = {
              ...lockedCampaignState, // Preserve verified assets
              stage: "PLAN_PROPOSED",
              plan: planJson,
              // Objective/Dest might be redundant if in lockedCampaignState, but safe to keep
              objective: lockedCampaignState?.objective || selectedMetaObjective,
              destination: lockedCampaignState?.destination || selectedDestination
            };
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
            await saveAnswerMemory(baseUrl, activeBusinessId, {
              campaign_state: newState
            });
            lockedCampaignState = newState;
            console.log("✅ Saved Proposed Plan to State");

            // 📝 Overwrite the response text with a clean summary
            const creative = planJson.ad_sets?.[0]?.ad_creative || planJson.ad_sets?.[0]?.ads?.[0]?.creative || {};
            // Handle Budget Variance (Object vs Flat)
            const bAmount = planJson.budget?.amount || planJson.budget_value || "N/A";
            const bCurrency = planJson.budget?.currency || "INR";
            const bType = planJson.budget?.type || planJson.budget_type || "DAILY";

            const creativeTitle = creative.headline || creative.title || "Headline";
            const creativeBody = creative.primary_text || creative.body || "Body Text";

            text = `
**Plan Proposed: ${planJson.campaign_name}**

**Targeting**: ${planJson.targeting?.geo_locations?.countries?.join(", ") || "India"} (${planJson.targeting?.age_min || 18}-${planJson.targeting?.age_max || 65}+)
**Budget**: ${bAmount} ${bCurrency} (${bType})

**Creative Idea**: 
"${creativeTitle}"
_${creativeBody}_

**Call to Action**: ${creative.call_to_action || "Learn More"}

Reply **YES** to generate this image and launch the campaign.
`.trim();
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

    // ===============================
    // 🧠 STEP-1 / STEP-2 NORMAL AGENT RESPONSE
    // ===============================
    return res.status(200).json({
      ok: true,
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
