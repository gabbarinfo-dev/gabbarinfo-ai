// pages/api/agent/execute.js

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import { executeInstagramPost } from "../../../lib/execute-instagram-post";
import { normalizeImageUrl } from "../../../lib/normalize-image-url";
import { creativeEntry } from "../../../lib/instagram/creative-entry";
import { clearCreativeState } from "../../../lib/instagram/creative-memory";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ---------------- HELPERS (INPUT NORMALIZATION) ---------------- */


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

async function generateMetaCampaignPlan({ lockedCampaignState, autoBusinessContext, verifiedMetaAssets, detectedLandingPage, instruction, text }) {
  const extract = (src, key) => {
    const regex = new RegExp(`${key}[:\-]?\\s*(.*?)(?:\\n|$)`, "i");
    const match = (src || "").match(regex);
    return match ? match[1].trim() : null;
  };

  const serviceName = lockedCampaignState?.service || autoBusinessContext?.business_name || "Digital Marketing";
  const location = lockedCampaignState?.location || "India";
  const objective = lockedCampaignState?.objective || "OUTCOME_TRAFFIC";
  const performance_goal = lockedCampaignState?.performance_goal || "MAXIMIZE_LINK_CLICKS";

  const titleMatch = (text || "").match(/\*\*Plan Proposed:?\s*(.*?)\*\*/i);
  const campaign_name = titleMatch ? titleMatch[1].trim() : (extract(instruction, "Campaign Name") || `${serviceName} Campaign`);

  const rawBudget = extract(instruction, "Budget");
  const budgetVal = rawBudget ? parseInt(rawBudget.replace(/[^\d]/g, "")) : (lockedCampaignState?.plan?.budget?.amount || 500);

  const isWebsiteConversion = lockedCampaignState?.destination === "website";
  const destination_url = isWebsiteConversion ? (
    lockedCampaignState?.landing_page ||
    detectedLandingPage ||
    null
  ) : null;

  const primary_text =
    extract(instruction, "Creative Idea") ||
    extract(instruction, "Services") ||
    `Looking for best ${serviceName}? We provide top-notch services to help you grow.`;

  const headline =
    extract(instruction, "Headline") || (extract(instruction, "Services") ? `Expert ${extract(instruction, "Services")}` : `Expert ${serviceName}`);

  const imagePrompt =
    extract(instruction, "Image Concept") || `${serviceName} professional service advertisement high quality`;

  return {
    campaign_name,
    objective,
    performance_goal,
    budget: { amount: budgetVal || 500, currency: "INR", type: "DAILY" },
    targeting: {
      geo_locations: {
        countries: ["IN"],
        cities: location !== "India" && location ? [{ name: location }] : []
      },
      age_min: 18,
      age_max: 65
    },
    ad_sets: [
      {
        name: `${serviceName} Ad Set`,
        status: "PAUSED",
        optimization_goal: performance_goal === "MAXIMIZE_LEADS" ? "LEADS" : "LINK_CLICKS",
        destination_type: objective === "OUTCOME_LEADS" ? "ON_AD" : "WEBSITE",
        billing_event: "IMPRESSIONS",
        ad_creative: {
          primary_text,
          headline,
          call_to_action: "LEARN_MORE",
          imagePrompt,
          imageUrl: extract(instruction, "Image URL") || extract(text, "Image URL") || null,
          destination_url
        }
      }
    ]
  };
}


// ============================================================
// 🔒 INTERNAL HANDLERS (Isolate Mode Pipelines)
// ============================================================

async function handleInstagramPostOnly(req, res, session, body) {
  const { instruction = "", mode: bodyMode } = body;
  console.log("📸 [Instagram] Isolated Terminal Flow");

  // 1. FRESH ASSET DETECTION
  const urlMatch = instruction.match(/https?:\/\/[^\s]+/i);
  const urlInInstruction = urlMatch ? urlMatch[0] : null;

  let captionInInstruction = null;
  const captionMatch = instruction.match(/Caption:\s*(.*)/i);
  if (captionMatch) {
    captionInInstruction = captionMatch[1].trim();
  } else if (urlInInstruction) {
    captionInInstruction = instruction.replace(urlInInstruction, "").trim();
  }

  // Identify business (needed for state management)
  let activeBusinessId = null;
  let metaRow = null;
  try {
    const { data: row } = await supabase
      .from("meta_connections")
      .select("*")
      .eq("email", session.user.email.toLowerCase())
      .maybeSingle();
    metaRow = row;
    if (metaRow) {
      activeBusinessId = metaRow.fb_business_id || metaRow.fb_page_id || metaRow.ig_business_id || null;
    }
  } catch (e) {
    console.warn("Meta connection lookup failed:", e.message);
  }
  const effectiveBusinessId = activeBusinessId || "default_business";

  // 🚀 PATH A: Publishing ONLY if current instruction has fresh assets
  const hasBothAssets = !!(urlInInstruction && (captionInInstruction || instruction.length > 50));

  if (hasBothAssets) {
    console.log("🚀 [Instagram] Path A Triggered (Fresh Assets Detected)");
    await clearCreativeState(supabase, session.user.email.toLowerCase());

    try {
      if (!metaRow) throw new Error("Meta connection missing. Please connect your accounts.");
      const accessToken = metaRow.fb_user_access_token;
      const instagramId = metaRow.instagram_actor_id || metaRow.ig_business_id;
      if (!instagramId || !accessToken) throw new Error("Instagram configuration missing.");

      const finalImage = await normalizeImageUrl(urlInInstruction);
      const finalCaption = captionInInstruction;

      console.log(`📸 [Instagram] Publishing Path A...`);
      const result = await executeInstagramPost({
        userEmail: session.user.email.toLowerCase(),
        imageUrl: finalImage,
        caption: finalCaption,
      });

      // 🔒 FIX: Store with flow: "instagram_publish" instead of objective
      await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, {
        campaign_state: { stage: "COMPLETED", flow: "instagram_publish", final_result: result }
      }, session.user.email.toLowerCase());

      return res.json({
        ok: true,
        text: `🎉 **Instagram Post Published Successfully!**\n\n- **Post ID**: \`${result.id}\`\n\nYour content is now live!`
      });
    } catch (e) {
      console.error("❌ Instagram execution error:", e.message);
      return res.json({ ok: false, text: `❌ **Instagram Post Failed**: ${e.message}` });
    }
  }

  // 🛡️ PATH B: DELEGATE TO CREATIVE MODE
  const creativeResult = await creativeEntry({
    supabase,
    session,
    instruction,
    metaRow,
    effectiveBusinessId
  });

  if (creativeResult.intent === "PUBLISH_INSTAGRAM_POST") {
    console.log("📬 [Instagram] Received intent from Creative Mode");
    const { imageUrl, caption } = creativeResult.payload;

    try {
      const result = await executeInstagramPost({
        userEmail: session.user.email.toLowerCase(),
        imageUrl,
        caption
      });

      await clearCreativeState(supabase, session.user.email.toLowerCase());

      // 🔒 FIX: Store with flow: "instagram_publish"
      await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, {
        campaign_state: { stage: "COMPLETED", flow: "instagram_publish", final_result: result }
      }, session.user.email.toLowerCase());

      return res.json({
        ok: true,
        text: `🎉 **Instagram Post Published Successfully!**\n\n- **Post ID**: \`${result.id}\`\n\nYour generated content is now live!`
      });
    } catch (e) {
      return res.json({ ok: false, text: `❌ **Publish Failed**: ${e.message}` });
    }
  }

  // Return standard FSM response (questions, preview)
  if (creativeResult.response) {
    return res.json(creativeResult.response);
  }

  return res.json({ ok: true, text: "Wait, I need some more details for your Instagram post." });
}


async function handleMetaAdsOnly(req, res, session, body) {
  let { instruction = "", includeJson = false, chatHistory = [], extraContext = "" } = body;
  let mode = body.mode || "meta_ads_plan";
  const __currentEmail = session.user.email.toLowerCase();

  // ============================================================
  // 🔍 STEP 1: LOAD STATE & ASSETS
  // ============================================================
  let metaConnected = false;
  let activeBusinessId = null;
  let metaRow = null;
  let verifiedMetaAssets = null;

  try {
    const { data: row } = await supabase
      .from("meta_connections")
      .select("*")
      .eq("email", __currentEmail)
      .maybeSingle();
    metaRow = row;
    if (metaRow) {
      metaConnected = true;
      activeBusinessId = metaRow.fb_business_id || metaRow.fb_page_id || metaRow.ig_business_id || null;
    }
  } catch (e) {
    console.warn("Meta connection lookup failed:", e.message);
  }

  const effectiveBusinessId = activeBusinessId || "default_business";
  let lockedCampaignState = null;

  if (effectiveBusinessId) {
    try {
      const { data: memData } = await supabase
        .from("agent_memory")
        .select("content")
        .eq("email", __currentEmail)
        .eq("memory_type", "client")
        .maybeSingle();

      if (memData?.content) {
        const content = JSON.parse(memData.content);
        const answers = content.business_answers || {};
        const possibleKeys = [effectiveBusinessId, activeBusinessId, metaRow?.fb_business_id, metaRow?.fb_page_id, metaRow?.ig_business_id, "default_business"].filter(Boolean);
        let bestMatch = null;
        for (const key of possibleKeys) {
          const state = answers[key]?.campaign_state;
          if (!state) continue;
          if (state.plan && !bestMatch) bestMatch = state;
          if (!bestMatch) bestMatch = state;
        }
        lockedCampaignState = bestMatch;
      }
    } catch (e) {
      console.warn("Campaign state read failed early:", e.message);
    }
  }

  // 🔒 SAFETY: Never allow Instagram flow memory to affect Meta Ads
  if (lockedCampaignState?.flow === "instagram_publish") {
    lockedCampaignState = null;
  }

  // Asset Discovery
  const { data: cachedAssets } = await supabase
    .from("agent_meta_assets")
    .select("*")
    .eq("email", __currentEmail)
    .maybeSingle();

  if (cachedAssets) {
    verifiedMetaAssets = cachedAssets;
  } else if (metaRow?.fb_ad_account_id) {
    const token = process.env.META_SYSTEM_USER_TOKEN;
    const fbPageRes = await fetch(`https://graph.facebook.com/v19.0/${metaRow.fb_page_id}?fields=name,category,about&access_token=${token}`);
    const fbPage = await fbPageRes.json();
    let igAccount = null;
    if (metaRow.ig_business_id) {
      const igRes = await fetch(`https://graph.facebook.com/v19.0/${metaRow.ig_business_id}?fields=name,biography,category&access_token=${token}`);
      igAccount = await igRes.json();
    }
    const normalizedAdId = (metaRow.fb_ad_account_id || "").toString().replace(/^act_/, "");
    const adRes = await fetch(`https://graph.facebook.com/v19.0/act_${normalizedAdId}?fields=account_status,currency,timezone_name&access_token=${token}`);
    const adAccount = await adRes.json();

    verifiedMetaAssets = {
      email: __currentEmail,
      fb_page: fbPage,
      ig_account: igAccount,
      ad_account: adAccount,
      verified_at: new Date().toISOString(),
    };
    await supabase.from("agent_meta_assets").upsert(verifiedMetaAssets);
  }

  if (!verifiedMetaAssets && metaRow) {
    return res.json({ ok: true, gated: true, text: "I don’t have access to your Meta ad account yet. Please connect your Facebook Business first." });
  }

  // ============================================================
  // 🧠 BUSINESS CONTEXT
  // ============================================================
  let autoBusinessContext = null;
  try {
    const intakeRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/agent/intake-business`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" }
    });
    const intakeJson = await intakeRes.json();
    if (intakeJson?.ok && intakeJson?.intake) autoBusinessContext = intakeJson.intake;
  } catch (e) {
    console.warn("Auto business intake failed:", e.message);
  }

  const detectedLandingPage = autoBusinessContext?.business_website || autoBusinessContext?.instagram_website || null;

  // ============================================================
  // 🤖 3-LOGIC HIERARCHY (GATES)
  // ============================================================
  const isPlanProposed = lockedCampaignState?.stage === "PLAN_PROPOSED" && lockedCampaignState?.plan;

  // Extraction logic (Pro Logic)
  const lowerInstruction = instruction.toLowerCase();
  const extractedData = {
    objective: null, destination: null, performance_goal: null, website_url: null, phone: null, location: null, budget: null, service: null
  };

  if (lowerInstruction.includes("traffic")) extractedData.objective = "OUTCOME_TRAFFIC";
  else if (lowerInstruction.includes("lead")) extractedData.objective = "OUTCOME_LEADS";
  else if (lowerInstruction.includes("sale") || lowerInstruction.includes("conversion")) extractedData.objective = "OUTCOME_SALES";

  if (lowerInstruction.includes("website")) extractedData.destination = "website";
  else if (lowerInstruction.includes("call")) extractedData.destination = "call";
  else if (lowerInstruction.includes("whatsapp")) extractedData.destination = "whatsapp";

  const urlExtract = instruction.match(/https?:\/\/[^\s]+/i);
  if (urlExtract) extractedData.website_url = urlExtract[0];

  const locMatch = instruction.match(/location[s]?:\s*([^\n]+)/i);
  if (locMatch) extractedData.location = locMatch[1].trim();

  // Merge extracted data into state
  if (!isPlanProposed) {
    let stateChanged = false;
    const nextState = { ...lockedCampaignState };
    if (extractedData.objective && !nextState.objective) { nextState.objective = extractedData.objective; stateChanged = true; }
    if (extractedData.destination && !nextState.destination) { nextState.destination = extractedData.destination; stateChanged = true; }
    if (extractedData.website_url && !nextState.landing_page) { nextState.landing_page = extractedData.website_url; nextState.landing_page_confirmed = true; stateChanged = true; }
    if (extractedData.location && !nextState.location) { nextState.location = extractedData.location; nextState.location_confirmed = true; stateChanged = true; }

    if (stateChanged) {
      nextState.locked_at = new Date().toISOString();
      await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: nextState }, __currentEmail);
      lockedCampaignState = nextState;
    }
  }

  // Interactive Gates (Simplified)
  if (!isPlanProposed && !lockedCampaignState?.objective) {
    return res.json({ ok: true, gated: true, text: "Let's build your Meta Campaign. What is your primary objective?\n\n1. **Traffic**\n2. **Leads**\n3. **Sales**" });
  }
  if (!isPlanProposed && !lockedCampaignState?.destination) {
    return res.json({ ok: true, gated: true, text: "Where should we drive this? (Website, WhatsApp, or Calls?)" });
  }
  if (!isPlanProposed && !lockedCampaignState?.service) {
    return res.json({ ok: true, gated: true, text: "Which service or product do you want to promote?" });
  }
  if (!isPlanProposed && !lockedCampaignState?.location) {
    return res.json({ ok: true, gated: true, text: "Where should this ad run? (e.g. Mumbai, Delhi, or India)" });
  }

  // ============================================================
  // ⚡ CONFIRMATION SHORT-CIRCUIT (YES -> WATERFALL)
  // ============================================================
  const userSaysYes = /yes|approve|confirm|proceed|launch|generate|image/i.test(lowerInstruction);

  if (isPlanProposed && userSaysYes) {
    console.log("🚀 [CONFIRM] User said YES. Entering Execution Waterfall.");

    let currentState = { ...lockedCampaignState, locked_at: new Date().toISOString() };
    let waterfallLog = [];
    let errorOcurred = false;
    let stopReason = null;

    // --- STEP 9: IMAGE GENERATION ---
    const hasImage = currentState.creative && (currentState.creative.imageBase64 || currentState.creative.imageUrl);
    if (!hasImage) {
      console.log("🚀 Waterfall: Starting Image Generation...");
      const plan = currentState.plan || {};
      const adSet0 = (Array.isArray(plan.ad_sets) ? plan.ad_sets[0] : (plan.ad_sets || {}));
      const creativeResult = adSet0.ad_creative || adSet0.creative || adSet0.ads?.[0]?.creative || {};
      const imagePrompt = creativeResult.image_prompt || creativeResult.imagePrompt || creativeResult.primary_text || `${plan.campaign_name} ad image`;

      try {
        const imgRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/images/generate`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: imagePrompt })
        });
        const imgJson = await parseResponseSafe(imgRes);
        if (imgJson.imageBase64) {
          currentState = { ...currentState, stage: "IMAGE_GENERATED", creative: { ...creativeResult, imageBase64: imgJson.imageBase64, imageUrl: `data:image/png;base64,${imgJson.imageBase64}` } };
          waterfallLog.push("✅ Step 9: Image Generated");
        } else { errorOcurred = true; stopReason = "Image Generation Failed"; }
      } catch (e) { errorOcurred = true; stopReason = `Image Gen Error: ${e.message}`; }
    }

    // --- STEP 10: IMAGE UPLOAD ---
    if (!errorOcurred && currentState.creative?.imageBase64 && !currentState.image_hash) {
      console.log("🚀 Waterfall: Uploading Image to Meta...");
      try {
        const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/upload-image`, {
          method: "POST", headers: { "Content-Type": "application/json", "X-Client-Email": __currentEmail },
          body: JSON.stringify({ imageBase64: currentState.creative.imageBase64 })
        });
        const uploadJson = await parseResponseSafe(uploadRes);
        if (uploadJson.ok && uploadJson.image_hash) {
          currentState = { ...currentState, stage: "READY_TO_LAUNCH", image_hash: uploadJson.image_hash };
          waterfallLog.push("✅ Step 10: Image Uploaded");
        } else { errorOcurred = true; stopReason = "Meta Upload Failed"; }
      } catch (e) { errorOcurred = true; stopReason = `Upload Error: ${e.message}`; }
    }

    // --- STEP 12: EXECUTION ---
    if (!errorOcurred && currentState.image_hash) {
      console.log("🚀 Waterfall: Executing Campaign...");
      try {
        const finalPayload = {
          ...currentState.plan,
          ad_sets: currentState.plan.ad_sets.map(adset => ({
            ...adset, ad_creative: { ...adset.ad_creative, image_hash: currentState.image_hash }
          }))
        };
        const execRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/execute-campaign`, {
          method: "POST", headers: { "Content-Type": "application/json", "X-Client-Email": __currentEmail },
          body: JSON.stringify({ platform: "meta", payload: finalPayload })
        });
        const execJson = await execRes.json();
        if (execJson.ok) {
          await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: { stage: "COMPLETED", final_result: execJson } }, __currentEmail);
          return res.json({ ok: true, text: `🎉 **Campaign Published Successfully!**\n\n**Pipeline Status**:\n${waterfallLog.join("\n")}\n✅ Step 12: Campaign Created (PAUSED)\n\nID: \`${execJson.id || "N/A"}\`` });
        } else { errorOcurred = true; stopReason = "Execution Failed"; }
      } catch (e) { errorOcurred = true; stopReason = `Execution Error: ${e.message}`; }
    }

    if (errorOcurred) return res.json({ ok: false, text: `❌ **Loop Interrupted**: ${stopReason}` });

    // Save progress if waiting
    await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: currentState }, __currentEmail);
    return res.json({ ok: true, text: `Progress: ${waterfallLog.join(", ")}. Reply YES to continue.` });
  }

  // ============================================================
  // 🧠 GEMINI PLANNING (STEP 8)
  // ============================================================
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const systemPrompt = `You are a Meta Ads Strategist. Propose a plan for ${lockedCampaignState.service} in ${lockedCampaignState.location}. 
  Output the plan and then the JSON schema.`;

  const result = await model.generateContent(systemPrompt + "\nUser instruction: " + instruction);
  const rawText = result.response.text();

  // Extract JSON and Save as PLAN_PROPOSED
  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const planJson = JSON.parse(jsonMatch[0].includes("```") ? jsonMatch[1] : jsonMatch[0]);
      // Normalize planJson (omitting full normalization code for brevity in this block)
      const newState = {
        ...lockedCampaignState,
        stage: "PLAN_PROPOSED",
        plan: planJson,
        locked_at: new Date().toISOString()
      };
      await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, { campaign_state: newState }, __currentEmail);

      return res.json({
        ok: true,
        text: `${rawText.split("```")[0].trim()}\n\n**Do you want me to proceed?**\nReply YES to generate the image and launch this campaign.`,
        campaignJson: planJson
      });
    } catch (e) {
      console.warn("JSON parse failed");
    }
  }

  return res.json({ ok: true, text: rawText });
}


async function handleGenericStrategy(req, res, session, body) {
  const { instruction = "", mode = "generic" } = body;
  console.log(`🧠 [Strategy] Mode: ${mode}`);

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent(`You are a Digital Marketing Strategist. Mode: ${mode}. Instruction: ${instruction}`);
  const text = result.response.text();

  return res.json({ ok: true, text });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed." });
  }

  try {
    const body = req.body || {};
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }
    __currentEmail = session.user.email.toLowerCase();

    const bodyMode = body.mode || "generic";
    const instruction = body.instruction || "";

    console.log("🔥 REQUEST START");
    console.log("EMAIL:", __currentEmail);
    console.log("INSTRUCTION:", instruction.substring(0, 50));
    console.log("MODE:", bodyMode);

    // 🔒 MODE IS THE SINGLE SOURCE OF TRUTH (GOLDEN RULE)
    switch (bodyMode) {
      case "instagram_post":
        return handleInstagramPostOnly(req, res, session, body);

      case "meta_ads_plan":
      case "generic":
        return handleMetaAdsOnly(req, res, session, body);

      case "google_ads_plan":
      case "seo_blog":
      case "social_calendar":
      case "social_plan":
      case "strategy":
        return handleGenericStrategy(req, res, session, body);

      default:
        return res.json({
          ok: false,
          text: "Unknown agent mode selected. Please choose a valid mode from the agent panel.",
        });
    }

  } catch (err) {
    console.error("❌ API ERROR:", err);
    return res.status(500).json({ ok: false, text: `Internal server error: ${err.message}` });
  }
}
