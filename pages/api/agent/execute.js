// pages/api/agent/execute.js 
import { GoogleGenerativeAI } from "@google/generative-ai"; 
import { getServerSession } from "next-auth/next"; 
import { authOptions } from "../auth/[...nextauth]"; 
import { createClient } from "@supabase/supabase-js"; 
import { executeInstagramPost } from 
"../../../lib/execute-instagram-post"; 
import { normalizeImageUrl } from "../../../lib/normalize-image-url"; 
import { creativeEntry } from "../../../lib/instagram/creative-entry"; 
import { loadCreativeState } from 
"../../../lib/instagram/creative-memory"; 
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
console.warn("⚠ GEMINI_API_KEY is not set. /api/agent/execute will 
not work for agent mode."); 
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
async function saveAnswerMemory(baseUrl, business_id, answers, 
emailOverride = null) { 
const targetEmail = emailOverride || __currentEmail; 
if (!targetEmail) { 
console.error("
❌
 saveAnswerMemory: No target email available!"); 
    return; 
  } 
 
  console.log(`
💾
 saveAnswerMemory: Saving for ${business_id} (Email: 
${targetEmail})`); 
 
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
 
    // 
�
�
 DEEP MERGE CAMPAIGN STATE (Prevent Data Loss) 
    const existingAnswers = content.business_answers[business_id] || 
{}; 
    let finalAnswers = { ...existingAnswers, ...answers, updated_at: 
new Date().toISOString() }; 
 
    if (answers.campaign_state && existingAnswers.campaign_state) { 
      console.log(`
🧠
 [Deep Merge] Merging campaign_state for 
${business_id}...`); 
      finalAnswers.campaign_state = { 
        ...existingAnswers.campaign_state, 
        ...answers.campaign_state, 
        plan: answers.campaign_state.plan || 
existingAnswers.campaign_state.plan, // Explicitly preserve plan 
        stage: answers.campaign_state.stage || 
existingAnswers.campaign_state.stage 
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
console.error("
❌
 saveAnswerMemory Supabase Error:", 
error.message); 
} else { 
} 
console.log(`
✅
 Memory saved successfully for ${business_id}`); 
} catch (err) { 
} 
} 
console.error("
❌
 saveAnswerMemory Fatal Error:", err.message); 
async function generateMetaCampaignPlan({ lockedCampaignState, 
autoBusinessContext, verifiedMetaAssets, detectedLandingPage, 
instruction, text }) { 
const extract = (src, key) => { 
const regex = new RegExp(`${key}[:\-]?\\s*(.*?)(?:\\n|$)`, "i"); 
const match = (src || "").match(regex); 
return match ? match[1].trim() : null; 
}; 
const serviceName = lockedCampaignState?.service || 
autoBusinessContext?.business_name || "Digital Marketing"; 
const location = lockedCampaignState?.location || "India"; 
const objective = lockedCampaignState?.objective || 
"OUTCOME_TRAFFIC"; 
const performance_goal = lockedCampaignState?.performance_goal || 
"MAXIMIZE_LINK_CLICKS"; 
const titleMatch = (text || "").match(/\*\*Plan 
Proposed:?\s*(.*?)\*\*/i); 
const campaign_name = titleMatch ? titleMatch[1].trim() : 
(extract(instruction, "Campaign Name") || `${serviceName} Campaign`); 
const rawBudget = extract(instruction, "Budget"); 
const budgetVal = rawBudget ? parseInt(rawBudget.replace(/[^\d]/g, 
"")) : (lockedCampaignState?.plan?.budget?.amount || 500); 
const isWebsiteConversion = lockedCampaignState?.destination === 
"website"; 
const destination_url = isWebsiteConversion ? ( 
lockedCampaignState?.landing_page || 
detectedLandingPage || 
null 
) : null; 
const primary_text = 
    extract(instruction, "Creative Idea") || 
    extract(instruction, "Services") || 
    `Looking for best ${serviceName}? We provide top-notch services to 
help you grow.`; 
 
  const headline = 
    extract(instruction, "Headline") || (extract(instruction, 
"Services") ? `Expert ${extract(instruction, "Services")}` : `Expert 
${serviceName}`); 
 
  const imagePrompt = 
    extract(instruction, "Image Concept") || `${serviceName} 
professional service advertisement high quality`; 
 
  return { 
    campaign_name, 
    objective, 
    performance_goal, 
    budget: { amount: budgetVal || 500, currency: "INR", type: "DAILY" 
}, 
    targeting: { 
      geo_locations: { 
        countries: ["IN"], 
        cities: location !== "India" && location ? [{ name: location }] 
: [] 
      }, 
      age_min: 18, 
      age_max: 65 
    }, 
    ad_sets: [ 
      { 
        name: `${serviceName} Ad Set`, 
        status: "PAUSED", 
        optimization_goal: performance_goal === "MAXIMIZE_LEADS" ? 
"LEADS" : "LINK_CLICKS", 
        destination_type: objective === "OUTCOME_LEADS" ? "ON_AD" : 
"WEBSITE", 
        billing_event: "IMPRESSIONS", 
        ad_creative: { 
          primary_text, 
          headline, 
          call_to_action: "LEARN_MORE", 
          imagePrompt, 
          imageUrl: extract(instruction, "Image URL") || extract(text, 
"Image URL") || null, 
          destination_url 
        } 
      } 
    ] 
  }; 
} 
export default async function handler(req, res) { 
if (req.method !== "POST") { 
return res.status(405).json({ ok: false, message: "Only POST 
allowed." }); 
} 
try { 
const body = req.body || {}; 
// --------------------------- 
// 0) REQUIRE SESSION (for everything) 
// --------------------------- 
const session = await getServerSession(req, res, authOptions); 
if (!session) { 
return res.status(401).json({ ok: false, message: "Not 
authenticated" }); 
} 
__currentEmail = session.user.email.toLowerCase(); 
// 
�
�
 DEBUG LOGS FOR CONTEXT MISMATCH 
let { instruction = "", mode: bodyMode = body.mode } = body; 
const rawUserMessage = body.instruction || body.message || ""; // 
Capture raw user message for Creative Mode 
let mode = body.mode || "generic"; // Moved up to avoid TDZ errors 
// 
�
�
 INPUT NORMALIZATION and Assets handled in terminal branch 
below 
console.log("
🔥
 REQUEST START"); 
console.log("EMAIL:", __currentEmail); 
console.log("INSTRUCTION:", instruction.substring(0, 50)); 
console.log("MODE:", bodyMode); 
console.log("COOKIES:", req.headers.cookie ? "Present" : 
"Missing"); 
// 
�
�
 0.1) RESOLVE BUSINESS & LOAD STATE (EARLY) 
let metaConnected = false; 
let activeBusinessId = null; 
let metaRow = null; 
let verifiedMetaAssets = null; 
let forcedBusinessContext = null; 
try { 
const { data: row } = await supabase 
.from("meta_connections") 
.select("*") 
.eq("email", session.user.email.toLowerCase()) 
.maybeSingle(); 
metaRow = row; 
if (metaRow) { 
        metaConnected = true; 
        activeBusinessId = metaRow.fb_business_id || metaRow.fb_page_id 
|| metaRow.ig_business_id || null; 
      } 
    } catch (e) { 
      console.warn("Meta connection lookup failed:", e.message); 
    } 
 
    const effectiveBusinessId = activeBusinessId || "default_business"; 
 
    // --------------------------- 
    // 0.2) CHECK ACTIVE CREATIVE SESSION (STICKY MODE) 
    // --------------------------- 
    try { 
        const creativeState = await loadCreativeState(supabase, 
session.user.email.toLowerCase()); 
         
        // CHECK 1: DB State (Primary) 
        let isActive = creativeState?.creativeSessionId && 
creativeState.stage !== "COMPLETED"; 
         
        // CHECK 2: Conversation Context (Latency Fallback) 
        // If DB hasn't caught up, check if the last assistant message 
was from Creative Mode. 
        if (!isActive) { 
            const history = body.history || []; 
            const lastAssistantMsg = history.filter(m => m.role === 
"assistant").pop(); 
            // Check for explicit mode flag OR creative signature in 
metadata 
            if (lastAssistantMsg?.mode === "instagram_post" || 
lastAssistantMsg?.mode === "creative_mode") { 
                console.log("
🎨
 [Sticky Mode] Detected via Conversation 
History (Latency Fallback)"); 
                isActive = true; 
            } 
        } 
 
        // If we have an active session that isn't completed, capture 
it. 
        if (isActive) { 
            console.log("
🎨
 [Sticky Mode] Routing to Creative Mode 
Session"); 
            const result = await creativeEntry({ 
                supabase, 
                session, 
                instruction: rawUserMessage, // Use raw message 
strictly 
                metaRow, 
                effectiveBusinessId 
            }); 
// Map internal result to API response 
if (result.response) { 
// Ensure mode is stamped for next turn's sticky check 
return res.status(200).json({ ...result.response, 
mode: "instagram_post" }); 
} 
return res.status(200).json({ ...result, mode: 
"instagram_post" }); 
} 
} catch (e) { 
console.warn("Sticky session check failed:", e); 
} 
let lockedCampaignState = null; 
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
const possibleKeys = [effectiveBusinessId, activeBusinessId, 
metaRow?.fb_business_id, metaRow?.fb_page_id, metaRow?.ig_business_id, 
"default_business"].filter(Boolean); 
let bestMatch = null; 
// 
�
�
 DEBUG: Log all keys we are checking 
console.log("
🔍
 Checking campaign keys:", possibleKeys); 
for (const key of possibleKeys) { 
const state = answers[key]?.campaign_state; 
if (!state) continue; 
// 
�
�
 PRIORITY 1: Organic Instagram Post (STRICT WINNER) 
if (state.objective === "INSTAGRAM_POST") { 
bestMatch = state; 
console.log(`
✅
 Found INSTAGRAM_POST in key: ${key}`); 
break; // Found Instagram state? Stop immediately. It 
wins. 
yet) 
} 
// PRIORITY 2: Ads Plan (Only if no Instagram state found 
if (state.plan && !bestMatch) { 
              bestMatch = state; 
            } 
 
            // Fallback 
            if (!bestMatch) bestMatch = state; 
          } 
          lockedCampaignState = bestMatch; 
        } 
      } catch (e) { 
        console.warn("Campaign state read failed early:", e.message); 
      } 
    } 
 
    // 
�
�
 TERMINAL BRANCH: Organic Instagram Post Isolation (STRICT 
SEPARATION) 
    // We catch explicit mode, locked state, OR clear organic intent to 
prevent fall-through. 
    const isOrganicIntent = 
instruction.toLowerCase().includes("instagram") && 
      !instruction.toLowerCase().includes("ad") && 
      !instruction.toLowerCase().includes("sponsored"); 
 
    // 
�
�
 TERMINAL BRANCH: Organic Instagram Isolation 
    if (bodyMode === "instagram_post" || lockedCampaignState?.objective 
=== "INSTAGRAM_POST" || isOrganicIntent) { 
      console.log("
📸
 [Instagram] Isolated Terminal Flow"); 
 
      const isConfirmation = /^\s*(yes|ok|publish|go ahead|do 
it|confirm)\s*$/i.test(instruction); 
 
      if (!isConfirmation) { 
        const urlMatch = instruction.match(/https?:\/\/[^\s]+/i); 
        const url = urlMatch ? urlMatch[0] : null; 
 
        let caption = null; 
        const captionMatch = instruction.match(/Caption:\s*(.*)/i); 
        if (captionMatch) { 
          caption = captionMatch[1].trim(); 
        } else if (url) { 
          caption = instruction.replace(url, "").trim(); 
        } 
 
        if (url || caption) { 
          let normalizedUrl = url; 
          if (url) { 
            try { 
              normalizedUrl = await normalizeImageUrl(url); 
            } catch (e) { 
              return res.json({ ok: false, text: `
❌
 **Invalid Image**: 
${e.message}` }); 
            } 
} 
const existing = lockedCampaignState?.creative || {}; 
const newCreative = { 
...existing, 
imageUrl: normalizedUrl || existing.imageUrl, 
primary_text: caption || existing.primary_text 
}; 
await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, 
effectiveBusinessId, { 
campaign_state: { objective: "INSTAGRAM_POST", creative: 
newCreative, stage: "READY_TO_LAUNCH" } 
}, session.user.email.toLowerCase()); 
lockedCampaignState = { ...lockedCampaignState, creative: 
newCreative }; 
} 
} 
const creative = lockedCampaignState?.creative || {}; 
let finalImage = creative.imageUrl; 
let finalCaption = creative.primary_text; 
// 
�
�
 CONFIRMATION GUARD: Targeted re-hydration if assets missing 
on 'Yes' turn 
if (isConfirmation && (!finalImage || !finalCaption)) { 
try { 
memory..."); 
console.log("
💧
 [Instagram] Re-hydrating state from 
const { data: mem } = await 
supabase.from("agent_memory").select("content").eq("email", 
session.user.email.toLowerCase()).eq("memory_type", 
"client").maybeSingle(); 
if (mem?.content) { 
const parsedContent = JSON.parse(mem.content); 
const answers = parsedContent.business_answers || {}; 
keys 
// 
�
�
 SUPER GREEDY SEARCH: Look everywhere, not just known 
let bestState = null; 
const allKeys = Object.keys(answers); 
console.log("
💧
 Checking ALL memory keys:", allKeys); 
for (const key of allKeys) { 
const s = answers[key]?.campaign_state; 
if (s?.objective === "INSTAGRAM_POST") { 
console.log(`
💧
 Found candidate in ${key}:`, { 
hasImage: !!s.creative?.imageUrl, hasText: !!s.creative?.primary_text 
}); 
                 // 1. Prioritize state with BOTH assets 
                 if (s.creative?.imageUrl && s.creative?.primary_text) 
{ 
                    bestState = s; 
                    break; // Found perfect match, stop looking 
                 } 
                 // 2. Keep partial match if we don't have a better one 
yet 
                 if (!bestState && (s.creative?.imageUrl || 
s.creative?.primary_text)) { 
                    bestState = s; 
                 } 
              } 
            } 
 
            if (bestState) { 
               if (!finalImage && bestState.creative?.imageUrl) 
finalImage = bestState.creative.imageUrl; 
               if (!finalCaption && bestState.creative?.primary_text) 
finalCaption = bestState.creative.primary_text; 
               console.log("
💧
 [Instagram] Re-hydration successful:", { 
finalImage: !!finalImage, finalCaption: !!finalCaption }); 
            } else { 
               console.warn("
💧
 [Instagram] No valid INSTAGRAM_POST 
state found in memory."); 
            } 
          } 
        } catch (e) { console.warn("targeted re-hydration failed", e); 
} 
      } 
 
      // ------------------------------------------------------------ 
      // 
�
�
 FIX: SERVER-SIDE IMAGE REHOSTING REMOVED (Strict Rejection) 
      // ------------------------------------------------------------ 
      // Logic removed as per user instruction.  
      // Drive URLs are now rejected in normalize-image-url.js 
      // ------------------------------------------------------------ 
       
      const wantsLaunch = 
instruction.match(/\b(yes|ok|publish|confirm)\b/i); 
      let forceLaunch = false; 
 
      // 
�
�
 CREATIVE MODE ROUTER 
      // If Path A (explicit assets) didn't populate 
finalImage/finalCaption, 
      // and we haven't re-hydrated them from memory, we try Creative 
Mode. 
      if (!finalImage || !finalCaption) { 
          console.log("
🎨
 [Instagram] Delegating to Creative Mode..."); 
          try { 
            const creativeResult = await creativeEntry({ 
supabase, 
session, 
instruction, 
metaRow, 
effectiveBusinessId 
}); 
if (creativeResult.assets) { 
console.log("
🎨
 [Instagram] Assets returned from 
Creative Mode. Launching..."); 
finalImage = creativeResult.assets.imageUrl; 
finalCaption = creativeResult.assets.caption; 
forceLaunch = true;  
} else if (creativeResult.response) { 
return res.json(creativeResult.response); 
} 
} catch (e) { 
console.error("Creative Mode Fatal:", e); 
return res.json({ ok: false, text: "Creative Mode Failed: 
" + e.message }); 
} 
} 
if (finalImage && finalCaption) { 
if (wantsLaunch || forceLaunch) { 
try { 
if (!metaRow) throw new Error("Meta connection missing. 
Please connect your accounts."); 
// 
�
�
 HARD IMAGE VALIDATION (User Requirement 1) 
// Must run inside Instagram organic block only. 
if (!finalImage || typeof finalImage !== "string" || 
finalImage.length < 5) { 
finalImage); 
console.warn("
❌
 [Instagram] Invalid finalImage:", 
return res.json({  
ok: false,  
valid public image link."  
});  
} 
text: "
⚠
 **Invalid Image URL**: Please provide a 
// 
�
�
 TOKEN SAFETY: Explicitly use fb_user_access_token (NO 
System Token fallback) 
const accessToken = metaRow.fb_user_access_token; 
const instagramId = metaRow.instagram_actor_id || 
metaRow.ig_business_id; 
if (!instagramId || !accessToken) throw new 
Error("Instagram configuration missing. Please re-sync your assets."); 
// Step 1: Create Media Container 
const cUrl = 
`https://graph.facebook.com/v21.0/${instagramId}/media`; 
const cRes = await fetch(cUrl, { 
method: "POST", 
body: new URLSearchParams({ image_url: finalImage, 
caption: finalCaption, access_token: accessToken }) 
}); 
const cJson = await cRes.json(); 
const creationId = cJson.id; 
console.log("
📸
 [Instagram] Container Response:", 
JSON.stringify(cJson)); 
if (!creationId) throw new Error(cJson.error?.message || 
"Container creation failed."); 
// 
�
�
 WAIT: Short delay to ensure media is processed 
(prevents "Media ID not available") 
await new Promise(r => setTimeout(r, 1000)); 
// Step 2: Publish Media 
console.log(`
📸
 [Instagram] Publishing media (ID: 
${creationId})...`); 
const pUrl = 
`https://graph.facebook.com/v21.0/${instagramId}/media_publish`; 
const pRes = await fetch(pUrl, { 
method: "POST", 
body: new URLSearchParams({ creation_id: creationId, 
access_token: accessToken }) 
}); 
const pJson = await pRes.json(); 
if (!pRes.ok) throw new Error(pJson.error?.message || 
"Publishing failed."); 
// 7⃣ CLEANUP (MANDATORY) - REMOVED (No server-side 
rehosting) 
// No temp files created, so no cleanup needed. 
await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, 
effectiveBusinessId, { 
campaign_state: { stage: "COMPLETED", final_result: { id: 
pJson.id, organic: true } } 
}, session.user.email.toLowerCase()); 
return res.json({ 
ok: true, 
text: `
🎉
 **Instagram Post Published Successfully!**\n\n- 
**Post ID**: \`${pJson.id}\`\n\nYour content is now live!` 
}); 
} catch (e) { 
console.error("
❌
 Instagram execution error:", e.message); 
return res.json({ ok: false, text: `
❌
 **Instagram Post 
Failed**: ${e.message}` }); 
} 
} else { 
confirmation 
// 
�
�
 MANDATORY PERSISTENCE: Ensure assets survive Turn 2 
await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, 
effectiveBusinessId, { 
campaign_state: { 
objective: "INSTAGRAM_POST", 
creative: { 
imageUrl: finalImage, 
primary_text: finalCaption, 
...(creative.hashtags ? { hashtags: creative.hashtags } 
: {}) 
}, 
stage: "READY_TO_LAUNCH" 
} 
}, session.user.email.toLowerCase()); 
return res.json({ ok: true, text: "I have your post ready. 
**Ready to publish?**", mode: "instagram_post" }); 
} 
} 
return res.json({ ok: false, text: "
⚠
 **Missing Assets**: Please 
provide an Image URL and Caption." }); 
} 
// 
�
�
 HARD SAFETY STOP (ABSOLUTE ADS BLOCK) 
// This must run BEFORE any Ads logic (Asset Discovery, Plan 
Generation, etc.) 
if (bodyMode === "instagram_post" || lockedCampaignState?.objective 
=== "INSTAGRAM_POST") { 
console.log("
🛑
 [Instagram] Hard Stop - Preventing Ads Logic 
Fall-through"); 
return res.end(); 
} 
// ============================================================ 
// 
�
�
 STEP 1: AGENT META ASSET DISCOVERY (ADS ONLY) 
// ============================================================ 
// (This block only runs if NOT organic Instagram) 
if (bodyMode === "instagram_post" || mode === "instagram_post" || 
lockedCampaignState?.objective === "INSTAGRAM_POST") { 
Fall-through (Redundant Check)"); 
return res.end(); 
} 
console.log("
🛑
 [Instagram] Hard Stop - Preventing Ads Logic 
// 1⃣ Check cache first 
const { data: cachedAssets } = await supabase 
.from("agent_meta_assets") 
.select("*") 
.eq("email", session.user.email.toLowerCase()) 
.maybeSingle(); 
if (cachedAssets) { 
verifiedMetaAssets = cachedAssets; 
} else { 
// 2⃣ No cache → verify using Meta Graph API 
const { data: meta } = await supabase 
.from("meta_connections") 
.select("*") 
.eq("email", session.user.email.toLowerCase()) 
.single(); 
if (!meta?.fb_ad_account_id) { 
return res.json({ 
ok: true, 
gated: true, 
text: "I don’t have access to your Meta ad account yet. 
Please connect your Facebook Business first.", 
}); 
} 
const token = process.env.META_SYSTEM_USER_TOKEN; 
// Facebook Page 
const fbPageRes = await 
fetch(`https://graph.facebook.com/v19.0/${meta.fb_page_id}?fields=name,
category,about&access_token=${token}`); 
const fbPage = await fbPageRes.json(); 
// Instagram 
let igAccount = null; 
if (meta.ig_business_id) { 
const igRes = await 
fetch(`https://graph.facebook.com/v19.0/${meta.ig_business_id}?fields=n
ame,biography,category&access_token=${token}`); 
igAccount = await igRes.json(); 
} 
// Ad Account (normalize id to numeric for 'act_<id>' pattern) 
const normalizedAdId = (meta.fb_ad_account_id || 
"").toString().replace(/^act_/, ""); 
const adRes = await 
fetch(`https://graph.facebook.com/v19.0/act_${normalizedAdId}?fields=ac
count_status,currency,timezone_name&access_token=${token}`); 
const adAccount = await adRes.json(); 
 
      verifiedMetaAssets = { 
        email: session.user.email.toLowerCase(), 
        fb_page: fbPage, 
        ig_account: igAccount, 
        ad_account: adAccount, 
        verified_at: new Date().toISOString(), 
      }; 
 
      // 3⃣ Save to cache 
      await 
supabase.from("agent_meta_assets").upsert(verifiedMetaAssets); 
    } 
 
    console.log(`
🏢
 Effective Business ID: ${effectiveBusinessId} 
(Active: ${activeBusinessId})`); 
 
    if (metaConnected && activeBusinessId) { 
      forcedBusinessContext = { 
        source: "meta_connection", 
        business_id: activeBusinessId, 
        note: "User has exactly ONE Meta business connected. This is 
the active business.", 
      }; 
    } 
 
    console.log("
🏢
 EFFECTIVE BUSINESS ID:", effectiveBusinessId); 
    console.log("
🔒
 HAS LOCKED STATE:", !!lockedCampaignState); 
    if (lockedCampaignState) { 
      console.log("
📍
 LOCKED STAGE:", lockedCampaignState.stage); 
      console.log("
📍
 HAS PLAN:", !!lockedCampaignState.plan); 
    } 
 
    // 
�
�
 CRITICAL: FLAG FOR BYPASSING INTERACTIVE GATES 
    const isPlanProposed = lockedCampaignState?.stage === 
"PLAN_PROPOSED" && lockedCampaignState?.plan; 
    console.log("
📍
 isPlanProposed:", isPlanProposed); 
    // Close the discovery exclusion block 
    // (End of discovery exclusion block) 
 
    // ============================================================ 
    // 
�
�
 AUTO BUSINESS INTAKE (READ + INJECT CONTEXT) 
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
    // 
�
�
 LANDING PAGE DETECTION (AUTHORITATIVE — SYNCED DATA) 
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
    // type: "google_ads_campaign"  -> forwards to 
/api/google-ads/create-simple-campaign 
    // type: "meta_ads_creative"    -> forwards to 
/api/ads/create-creative 
    // 
    if (body.type) { 
      if (bodyMode === "instagram_post" || mode === "instagram_post" || 
lockedCampaignState?.objective === "INSTAGRAM_POST") { 
        throw new Error("INTERNAL_ERROR: Ads pipeline executed during 
Instagram post"); 
      } 
      // old behaviour path 
      if (body.type === "google_ads_campaign") { 
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL; 
        if (!baseUrl) { 
          return res.status(500).json({ 
            ok: false, 
            message: 
              "NEXT_PUBLIC_BASE_URL is not set. Cannot forward to 
google-ads endpoint.", 
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
              "NEXT_PUBLIC_BASE_URL is not set. Cannot forward to 
ads/create-creative.", 
          }); 
        } 
        // ============================================================ 
        // 
�
�
 CREATIVE GENERATION (AFTER COPY CONFIRMATION) 
        // ============================================================ 
 
        let imageHash = null; 
 
        // 1⃣ Generate image via OpenAI 
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
 
        // 2⃣ Upload image directly to Meta 
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
 
        const metaRes = await 
fetch(`${baseUrl}/api/ads/create-creative`, { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ 
            ...body.data, 
            creative: { 
              ...body.data.creative, 
              imageHash, // 
�
�
 THIS IS WHERE IT GOES 
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
          "Unknown type in legacy mode. Expected google_ads_campaign or 
meta_ads_creative.", 
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
    // let mode = body.mode || "generic"; // Moved to top of file 
 
 
    // 
�
�
 CRITICAL: FORCE MODE FROM LOCKED STATE (MUST BE FIRST) 
    // If a lockedCampaignState exists → mode MUST be its original mode 
or meta_ads_plan 
    if (lockedCampaignState) { 
      if (lockedCampaignState.objective === "INSTAGRAM_POST") { 
        mode = "instagram_post"; 
} else { 
mode = "meta_ads_plan"; 
} 
console.log(`
🔒
 MODE FORCED: ${mode} (locked campaign state 
exists)`); 
} 
// 
�
�
 AUTO-ROUTE TO META MODE (fallback for new campaigns) 
else if ( 
(mode === "generic" || mode === "strategy") && 
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
const lowerInstruction = instruction.toLowerCase(); 
// 
�
�
 Do NOT allow old chat history to override verified Meta 
assets 
// FIXED: We allow history but we instruct the model to prioritize 
verified assets. 
const historyText = Array.isArray(chatHistory) 
? chatHistory 
.slice(-20) 
.map((m) => `${m.role === "user" ? "User" : "Assistant"}: 
${m.text}`) 
.join("\n\n") 
: ""; 
// ---------- MODE-SPECIFIC FOCUS ---------- 
let modeFocus = ""; 
if (mode === "google_ads_plan") { 
modeFocus = ` 
You are in GOOGLE ADS AGENT MODE. - Focus on campaign structures, ad groups, keywords, match types, 
budgets. - When the user clearly asks for "JSON" or "backend JSON" for a Google 
Ads campaign, 
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
 - When you output JSON-only, do NOT wrap it in backticks, and add no 
extra text. 
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
 
   *NEVER* use "TRAFFIC" or "LEAD_GENERATION" (Legacy). Always use 
"OUTCOME_" prefix. 
2. **CONVERSION LOCATION** (Where it happens): - "Website" (Most Common) - "Messaging Apps" (WhatsApp/Messenger) - "Instant Forms" (Lead Forms) - "Calls" 
3. **PERFORMANCE GOAL** (Optimization): - If Objective = OUTCOME_TRAFFIC: - "Maximize Link Clicks" (Goal: LINK_CLICKS) - "Maximize Landing Page Views" (Goal: LANDING_PAGE_VIEWS) - If Objective = OUTCOME_LEADS: - "Maximize Leads" (Goal: LEADS) - If Objective = OUTCOME_SALES: - "Maximize Conversions" (Goal: CONVERSIONS) 
*** REQUIRED JSON SCHEMA *** 
You MUST ALWAYS output BOTH a human-readable summary AND the JSON using 
this exact schema whenever you propose a campaign plan: 
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
"geo_locations": { "countries": ["IN"], "cities": [{"name": 
"Mumbai"}] }, 
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
"imagePrompt": "a modern clinic exterior at dusk, vibrant 
lighting, professional photographer", 
"imageUrl": "https://client-hosted-image.com/photo.jpg", 
"primary_text": "Trusted by 5000+ patients. Painless 
treatments.", 
"headline": "Best Dental Clinic in Mumbai", 
"call_to_action": "LEARN_MORE", 
"destination_url": "https://client-website.com" 
} 
} 
] 
} - **Organic Instagram Posts**: If the user wants an organic post (not 
an ad), use the objective "INSTAGRAM_POST". You MUST include a caption 
(primary_text) and an image (either imagePrompt or imageUrl).  - **Image URLs**: If the user provides a direct image link or Google 
Drive link, include it in the "imageUrl" field. - Meta Objectives must be one of: OUTCOME_TRAFFIC, OUTCOME_LEADS, 
OUTCOME_SALES, OUTCOME_AWARENESS, OUTCOME_ENGAGEMENT, 
OUTCOME_APP_PROMOTION, INSTAGRAM_POST. - optimization_goal must match the performance goal (e.g., LINK_CLICKS, 
LANDING_PAGE_VIEWS). - destination_type should be set (e.g., WEBSITE, MESSAGING_APPS). - When you output JSON, wrap it in a proper JSON code block. Do NOT add 
extra text inside the JSON block. - ALWAYS propose a plan if you have enough info (objective, location, 
service, budget). 
`; 
} else if (mode === "instagram_post") { 
modeFocus = ` 
You are in INSTAGRAM ORGANIC POST MODE. - Your ONLY goal is to prepare an organic Instagram post. - You MUST NOT ask about ad objectives, budgets, conversion locations, 
or targeting. - You MUST directly propose a post plan. - Use the objective "INSTAGRAM_POST". - The plan MUST include: - primary_text (The caption for the post) - imagePrompt (A prompt to generate the post image) - imageUrl (If the user provided a link to an image) 
*** REQUIRED JSON SCHEMA *** 
{ 
"objective": "INSTAGRAM_POST", 
"primary_text": "Your engaging caption here including #hashtags", 
"imagePrompt": "a creative and high-quality image concept", 
"imageUrl": "https://link-to-image.com (optional)" 
} - Output the JSON in a code block. 
`; 
} else if (mode === "social_plan") { 
modeFocus = ` 
You are in SOCIAL MEDIA PLANNER MODE. - Focus on Instagram, Facebook, LinkedIn, YouTube content calendars. - Give hooks, caption ideas, posting frequency and content pillars. - Tie everything back to leads, sales or brand - building. 
`; 
} else if (mode === "seo_blog") { 
modeFocus = ` 
You are in SEO / BLOG AGENT MODE. - Focus on keyword ideas, blog topics, outlines and SEO - optimised 
articles. - Use simple, clear language and structure the blog logically for 
humans + Google. 
`; 
} else { 
modeFocus = ` 
You are in GENERIC DIGITAL MARKETING AGENT MODE. - You can combine Google Ads, Meta Ads, SEO, content and social 
together. - If the user explicitly asks for backend JSON, follow the exact 
schemas: - Google Ads JSON for campaigns. - Creative JSON for Meta / social creatives. 
`; 
} 
let ragContext = ""; 
// =============================== 
// 
�
�
 RAG FETCH (CLIENT MEMORY) 
// =============================== 
try { 
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL; 
if (baseUrl) { 
const ragRes = await fetch(`${baseUrl}/api/rag/query`, { 
method: "POST", 
headers: { "Content-Type": "application/json" }, 
body: JSON.stringify({ 
query: instruction, 
memory_type: session.user?.role === "client" ? "client" : 
"global", 
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
    // 
�
�
 SAFETY GATE — BUSINESS + BUDGET CONFIRMATION 
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
 
        // 
�
�
 No business at all (RAG OR META) 
        // Admin / Owner bypass 
        if (!isAdmin && !metaConnected && !profiles.length) { 
          safetyGateMessage = 
            "I cannot proceed because no business is connected yet. 
Please connect a Facebook Business or Page first."; 
        } 
        // 
⚠
 Multiple businesses detected 
        if (!forcedBusinessContext && profiles.length > 1) { 
          safetyGateMessage = 
            "You have multiple businesses connected. Please tell me 
which one to use."; 
        } 
 
 
        // 
�
�
 Budget / approval guard 
        if ( 
          instruction.toLowerCase().includes("run") && 
          !instruction.toLowerCase().includes("approve") && 
          !instruction.toLowerCase().includes("yes") && 
          !instruction.toLowerCase().includes("paused") 
        ) { 
          safetyGateMessage = 
            "Before I can prepare execution-ready campaign steps, I 
need your explicit confirmation..."; 
        } 
      } 
    } catch (e) { 
      console.warn("Safety gate check skipped:", e.message); 
    } 
    if (!isPlanProposed && safetyGateMessage) { 
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
    // 
�
�
 READ LOCKED CAMPAIGN STATE (AUTHORITATIVE — SINGLE SOURCE) 
    // ============================================================ 
 
 
    let selectedService = null; 
let selectedLocation = null; 
// ============================================================ 
// 
�
�
 DIRECT USER JSON → AUTO EXECUTE (Plan → Image → Launch) 
// ============================================================ 
if (mode === "meta_ads_plan" && typeof instruction === "string") { 
let userJsonString = null; 
const cbMatch = 
instruction.match(/```(?:json)?\s*([\s\S]*?)\s*```/); 
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
// Normalize Variation 5: { campaign_details, ad_sets: [{ 
ads: [{ creative: {...} }]}]} 
if (userPlan.campaign_details && 
Array.isArray(userPlan.ad_sets)) { 
const cd = userPlan.campaign_details; 
const adset0 = userPlan.ad_sets[0] || {}; 
const ads0 = Array.isArray(adset0.ads) ? adset0.ads[0] || 
{} : {}; 
const creative = ads0.creative || {}; 
const tgt = adset0.targeting || {}; 
const geo = Array.isArray(tgt.geo_locations) ? 
tgt.geo_locations[0] || {} : {}; 
const countries = []; 
const cities = []; 
if (geo.country) countries.push(geo.country); 
if (Array.isArray(geo.cities)) { 
for (const c of geo.cities) { 
if (typeof c === "string") cities.push({ name: c }); 
else if (c?.name) cities.push({ name: c.name }); 
} 
} 
const urlCandidate = (ads0.landing_page_url || 
creative.landing_page || creative.destination_url || 
detectedLandingPage || "").toString(); 
const cleanUrl = urlCandidate.replace(/[`]/g, "").trim() || 
null; 
const primaryText = Array.isArray(creative.primaryText) ? 
creative.primaryText[0] : (creative.primary_text || ""); 
const headline = Array.isArray(creative.headlines) ? 
creative.headlines[0] : (creative.headline || ""); 
const call_to_action = ads0.call_to_action || 
creative.call_to_action || "LEARN_MORE"; 
const budgetAmount = adset0.daily_budget?.amount || 
userPlan.budget?.amount || 500; 
const performance_goal = adset0.performance_goal || 
userPlan.performance_goal || cd.performance_goal || null; 
userPlan = { 
campaign_name: cd.name || "New Campaign", 
objective: (cd.objective && 
(cd.objective.includes("CLICK") || cd.objective.includes("TRAFFIC"))) ? 
"OUTCOME_TRAFFIC" : (cd.objective?.includes("LEAD") ? "OUTCOME_LEADS" : 
(cd.objective || "OUTCOME_TRAFFIC")), 
performance_goal: performance_goal, 
budget: { 
amount: budgetAmount, 
currency: adset0.daily_budget?.currency || "INR", 
type: "DAILY" 
}, 
targeting: { 
geo_locations: { countries: countries.length ? 
countries : ["IN"], cities }, 
age_min: tgt.age_min || 18, 
age_max: tgt.age_max || 65 
}, 
ad_sets: [ 
{ 
name: adset0.name || "Ad Set 1", 
status: cd.status || "PAUSED", 
ad_creative: { 
imagePrompt: creative.imagePrompt || 
creative.image_prompt || "Ad Image", 
primary_text: primaryText || "", 
headline: headline || "", 
call_to_action, 
destination_url: cleanUrl 
} 
} 
] 
}; 
} 
// Normalize Variation 6: Nested JSON { campaign, ad_set, 
ad_creative } 
if (userPlan.campaign && (userPlan.ad_set || 
userPlan.ad_sets)) { 
console.log("
🔄
 Normalizing Nested JSON 
(Campaign/AdSet)..."); 
const c = userPlan.campaign; 
// Handle array or object for ad_set 
const adSetInput = Array.isArray(userPlan.ad_sets) ? 
userPlan.ad_sets[0] : (userPlan.ad_set || {}); 
const creativeInput = userPlan.ad_creative || 
adSetInput.ad_creative || {}; 
// Map Objective 
let objective = "OUTCOME_TRAFFIC"; 
if (c.objective) { 
const o = c.objective.toUpperCase(); 
if (o.includes("LEAD")) objective = "OUTCOME_LEADS"; 
else if (o.includes("SALE") || o.includes("CONVERSION")) 
objective = "OUTCOME_SALES"; 
} 
// 
�
�
 Website Destination Guard (Strict Only) 
const isWebsiteMode = lockedCampaignState?.destination === 
"website"; 
const finalDestUrl = isWebsiteMode ? 
(creativeInput.destination_url || lockedCampaignState?.landing_page || 
detectedLandingPage || null) : null; 
userPlan = { 
campaign_name: c.campaign_name || c.name || "New 
Campaign", 
objective: objective, 
performance_goal: userPlan.performance_goal || 
adSetInput.performance_goal || null, 
budget: { 
amount: adSetInput.budget?.amount || 500, 
currency: "INR", 
type: "DAILY" 
}, 
targeting: adSetInput.targeting || { geo_locations: { 
countries: ["IN"] } }, 
ad_sets: [{ 
name: adSetInput.ad_set_name || adSetInput.name || "Ad 
Set 1", 
Image", 
status: "PAUSED", 
ad_creative: { 
imagePrompt: creativeInput.image_prompt || "Ad 
primary_text: 
Array.isArray(creativeInput.primary_texts) ? 
creativeInput.primary_texts[0] : (creativeInput.primary_text || ""), 
headline: Array.isArray(creativeInput.headlines) ? 
creativeInput.headlines[0] : (creativeInput.headline || ""), 
call_to_action: creativeInput.call_to_action || 
"LEARN_MORE", 
destination_url: finalDestUrl 
} 
}] 
}; 
} 
// If normalized to our schema, auto-run the pipeline now 
if (userPlan.campaign_name && userPlan.ad_sets?.length) { 
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL; 
const proposedState = { 
...lockedCampaignState, 
stage: "PLAN_PROPOSED", 
plan: userPlan, 
objective: userPlan.objective, 
Logic 
auto_run: true // 
⚡
 Trigger Auto-Waterfall for High 
}; 
await saveAnswerMemory(baseUrl, effectiveBusinessId, { 
campaign_state: proposedState }); 
lockedCampaignState = proposedState; 
// Generate image 
const creative = userPlan.ad_sets[0].ad_creative || {}; 
let destUrl = creative.destination_url || ""; 
const isWebsiteConversion = 
lockedCampaignState?.destination === "website"; 
if (isWebsiteConversion && destUrl) { 
try { 
const head = await fetch(destUrl, { method: "HEAD" }); 
if (!head.ok) { 
// Fallback to authoritative detected landing page if 
current fails 
destUrl = detectedLandingPage || null; 
} 
} catch { 
destUrl = detectedLandingPage || null; 
} 
} else if (!isWebsiteConversion) { 
destUrl = null; 
} 
creative.destination_url = destUrl; 
const imagePrompt = creative.imagePrompt || 
creative.primary_text || `${userPlan.campaign_name} ad image`; 
const imgRes = await 
fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/images/generate`, { 
method: "POST", 
headers: { "Content-Type": "application/json" }, 
body: JSON.stringify({ prompt: imagePrompt }) 
}); 
const imgJson = await parseResponseSafe(imgRes); 
if (!imgJson?.imageBase64) { 
return res.status(200).json({ ok: false, message: "Image 
generation failed for provided JSON." }); 
} 
const newCreative = { ...creative, imageBase64: 
imgJson.imageBase64, imageUrl: 
`data:image/png;base64,${imgJson.imageBase64}` }; 
const imageState = { ...lockedCampaignState, stage: 
"IMAGE_GENERATED", creative: newCreative }; 
await saveAnswerMemory(baseUrl, effectiveBusinessId, { 
campaign_state: imageState }, session.user.email.toLowerCase()); 
lockedCampaignState = imageState; 
// Upload image to Meta 
const uploadRes = await 
fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/upload-image`, { 
method: "POST", 
headers: { "Content-Type": "application/json", 
"X-Client-Email": __currentEmail || "" }, 
body: JSON.stringify({ imageBase64: 
newCreative.imageBase64 }) 
}); 
const uploadJson = await parseResponseSafe(uploadRes); 
const imageHash = uploadJson.imageHash || 
uploadJson.image_hash; 
if (!uploadJson?.ok || !imageHash) { 
return res.status(200).json({ ok: false, message: "Image 
upload failed for provided JSON.", details: uploadJson }); 
} 
const readyState = { ...lockedCampaignState, stage: 
"READY_TO_LAUNCH", image_hash: imageHash }; 
await saveAnswerMemory(baseUrl, effectiveBusinessId, { 
campaign_state: readyState }, session.user.email.toLowerCase()); 
lockedCampaignState = readyState; 
// Execute paused campaign 
const finalPayload = { 
...userPlan, 
ad_sets: userPlan.ad_sets.map((adset) => ({ 
...adset, 
ad_creative: { ...adset.ad_creative, image_hash: 
imageHash } 
})) 
}; 
const execRes = await 
fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/execute-campaign`, 
{ 
method: "POST", 
headers: { "Content-Type": "application/json", 
"X-Client-Email": __currentEmail || "" }, 
body: JSON.stringify({ platform: "meta", payload: 
finalPayload }) 
}); 
let execJson = {}; 
try { execJson = await execRes.json(); } catch (_) { 
execJson = { raw: await execRes.text() }; } 
if (execJson?.ok) { 
await saveAnswerMemory(baseUrl, effectiveBusinessId, { 
campaign_state: { stage: "COMPLETED", final_result: execJson } }, 
session.user.email.toLowerCase()); 
return res.status(200).json({ 
ok: true, 
text: `Campaign created (PAUSED).\nCampaign: 
${userPlan.campaign_name}\nImageHash: ${imageHash}\nStatus: 
${execJson.status || "PAUSED"}\nID: ${execJson.id || "N/A"}`, 
result: execJson 
}); 
} else { 
return res.status(200).json({ ok: false, message: 
`Execution failed: ${execJson?.message || "Unknown error"}`, details: 
execJson }); 
} 
} 
} catch (e) { 
// If user JSON fails to parse, continue with normal agent 
flow. 
} 
} 
} 
// WATERFALL REMOVED FROM TOP - MOVED TO BOTTOM 
// ============================================================ 
// 
�
�
 META OBJECTIVE PARSING (USER SELECTION) 
// ============================================================ 
// ============================================================ 
// 
�
�
 PRO LOGIC: MULTI-PARAMETER EXTRACTION (ALL-IN-ONE) 
// ============================================================ 
// We try to extract as much as possible if the user provided a 
block of text 
const extractedData = { 
objective: null, 
destination: null, 
performance_goal: null, 
website_url: null, 
phone: null, 
location: null, 
budget: null, 
duration: null, 
whatsapp: null 
}; 
// Objective & Destination Extraction 
const objLower = lowerInstruction; 
if (objLower.includes("traffic")) extractedData.objective = 
"OUTCOME_TRAFFIC"; 
else if (objLower.includes("lead")) extractedData.objective = 
"OUTCOME_LEADS"; 
else if (objLower.includes("sale") || 
objLower.includes("conversion")) extractedData.objective = 
"OUTCOME_SALES"; 
if (objLower.includes("website")) extractedData.destination = 
"website"; 
else if (objLower.includes("call")) extractedData.destination = 
"call"; 
else if (objLower.includes("whatsapp")) extractedData.destination = 
"whatsapp"; 
else if (objLower.includes("instagram profile")) 
extractedData.destination = "instagram_profile"; 
else if (objLower.includes("facebook page")) 
extractedData.destination = "facebook_page"; 
else if (objLower.includes("message")) extractedData.destination = 
"messages"; 
// Performance Goal Extraction 
if (objLower.includes("landing page view")) 
extractedData.performance_goal = "MAXIMIZE_LANDING_PAGE_VIEWS"; 
else if (objLower.includes("link click")) 
extractedData.performance_goal = "MAXIMIZE_LINK_CLICKS"; 
else if (objLower.includes("conversation")) 
extractedData.performance_goal = "MAXIMIZE_CONVERSATIONS"; 
else if (objLower.includes("call")) extractedData.performance_goal 
= "MAXIMIZE_CALLS"; 
// Website & Phone Extraction 
const urlMatch = 
instruction.match(/(?:https?:\/\/)?(?:www\.)[a-zA-Z0-9-]+\.[a-zA-Z0-9-.
]+/i) || instruction.match(/https?:\/\/[^\s]+/i); 
if (urlMatch) { 
let url = urlMatch[0]; 
if (!url.startsWith("http")) url = "https://" + url; 
extractedData.website_url = url; 
} 
const phoneMatch = 
instruction.match(/phone[^\d]*(\+?\d[\d\s-]{8,15})/i) || 
instruction.match(/(\+?\d[\d\s-]{8,15})/); 
if (phoneMatch) extractedData.phone = phoneMatch[1]; 
const waMatch = 
instruction.match(/whatsapp[^\d]*(\+?\d[\d\s-]{8,15})/i); 
if (waMatch) extractedData.whatsapp = waMatch[1]; 
// Budget & Duration 
const budgetMatch = 
instruction.match(/(?:budget|amount|day):\s*(\d+)/i) || 
instruction.match(/(?:₹|rs\.?)\s*(\d+)/i); 
if (budgetMatch) extractedData.budget = budgetMatch[1]; 
const durationMatch = instruction.match(/(\d+)\s*days?/i); 
if (durationMatch) extractedData.duration = durationMatch[1]; 
// Service & Location (Simple heuristic for Pro Logic) 
const serviceMatch = 
instruction.match(/service[s]?:\s*([^\n,]+)/i); 
if (serviceMatch) extractedData.service = serviceMatch[1].trim(); 
const locationMatch = 
instruction.match(/location[s]?:\s*([^\n]+)/i); 
if (locationMatch) extractedData.location = 
locationMatch[1].trim(); 
// 
�
�
 Apply Extracted Data to State if not already locked 
if (mode === "meta_ads_plan") { 
let stateChanged = false; 
const nextState = { ...lockedCampaignState }; 
if (extractedData.objective && !nextState.objective) { 
nextState.objective = extractedData.objective; stateChanged = true; } 
if (extractedData.destination && !nextState.destination) { 
nextState.destination = extractedData.destination; stateChanged = true; 
} 
if (extractedData.performance_goal && 
!nextState.performance_goal) { nextState.performance_goal = 
extractedData.performance_goal; stateChanged = true; } 
if (extractedData.website_url && !nextState.landing_page) { 
nextState.landing_page = extractedData.website_url; stateChanged = 
true; } 
if (extractedData.phone && !nextState.phone) { nextState.phone = 
extractedData.phone; stateChanged = true; } 
if (extractedData.location && !nextState.location) { 
nextState.location = extractedData.location; stateChanged = true; } 
if (extractedData.service && !nextState.service) { 
nextState.service = extractedData.service; stateChanged = true; } 
if (extractedData.budget && !nextState.budget) { nextState.budget 
= { amount: extractedData.budget, currency: "INR", type: "DAILY" }; 
stateChanged = true; } 
if (extractedData.duration && !nextState.duration) { 
nextState.duration = extractedData.duration; stateChanged = true; } 
if (stateChanged) { 
console.log("
🧠
 Pro Logic: Merged extracted data into state"); 
if (extractedData.website_url) nextState.landing_page_confirmed 
= true; 
true; 
if (extractedData.location) nextState.location_confirmed = 
if (extractedData.phone) nextState.phone_confirmed = true; 
if (extractedData.whatsapp) { nextState.whatsapp = 
extractedData.whatsapp; nextState.whatsapp_confirmed = true; } 
nextState.locked_at = new Date().toISOString(); 
await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, 
effectiveBusinessId, { campaign_state: nextState }, 
session.user.email.toLowerCase()); 
lockedCampaignState = nextState; 
} 
} 
// ============================================================ 
// 
�
�
 META OBJECTIVE PARSING (USER SELECTION / HIERARCHY) 
// ============================================================ 
let selectedMetaObjective = lockedCampaignState?.objective || null; 
let selectedDestination = lockedCampaignState?.destination || null; 
let selectedPerformanceGoal = lockedCampaignState?.performance_goal 
|| null; 
// 
�
�
 
�
�
 Interactive Sequence: Objective -> Destination -> Goal 
// Step 1: Objective 
if (!isPlanProposed && mode === "meta_ads_plan" && 
!selectedMetaObjective) { 
// (Keep existing interactive selection logic but refine it) 
if (lowerInstruction.includes("traffic")) selectedMetaObjective = 
"OUTCOME_TRAFFIC"; 
else if (lowerInstruction.includes("lead")) selectedMetaObjective 
= "OUTCOME_LEADS"; 
else if (lowerInstruction.includes("sale") || 
lowerInstruction.includes("conversion")) selectedMetaObjective = 
"OUTCOME_SALES"; 
if (selectedMetaObjective) { 
// Save and continue loop or wait? For now, we continue in this 
turn if possible 
lockedCampaignState = { ...lockedCampaignState, objective: 
selectedMetaObjective, stage: "objective_selected" }; 
await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, 
effectiveBusinessId, { campaign_state: lockedCampaignState }, 
session.user.email.toLowerCase()); 
} else { 
return res.status(200).json({ 
ok: true, mode, gated: true, 
text: "Let's build your Meta Campaign. What is your primary 
objective?\n\n1. **Traffic** (Get visits to website, page, or 
profile)\n2. **Leads** (Get calls, WhatsApp messages, or form 
fills)\n3. **Sales** (Drive conversions on your website)" 
}); 
} 
} 
// Step 2: Conversion Location 
if (!isPlanProposed && mode === "meta_ads_plan" && 
selectedMetaObjective && !selectedDestination) { 
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
if (input.includes("1") || input.includes("website")) 
selectedDestination = "website"; 
else if (input.includes("2") || input.includes("instagram") || 
input.includes("call")) selectedDestination = selectedMetaObjective === 
"OUTCOME_TRAFFIC" ? "instagram_profile" : "call"; 
else if (input.includes("3") || input.includes("facebook") || 
input.includes("whatsapp")) selectedDestination = selectedMetaObjective 
=== "OUTCOME_TRAFFIC" ? "facebook_page" : "whatsapp"; 
else if (input.includes("message")) selectedDestination = 
"messages"; 
if (selectedDestination) { 
lockedCampaignState = { ...lockedCampaignState, destination: 
selectedDestination, stage: "destination_selected" }; 
await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, 
effectiveBusinessId, { campaign_state: lockedCampaignState }, 
session.user.email.toLowerCase()); 
} else { 
return res.status(200).json({ 
ok: true, mode, gated: true, 
text: `Where should we drive this 
${selectedMetaObjective.toLowerCase()}?\n\n` + options.map((o, i) => 
`${i + 1}. ${o}`).join("\n") 
}); 
} 
} 
// Step 3: Performance Goal 
if (!isPlanProposed && mode === "meta_ads_plan" && 
selectedMetaObjective && selectedDestination && 
!selectedPerformanceGoal) { 
let goals = []; 
if (selectedDestination === "website") { 
goals = ["Maximize Number of Link Clicks", "Maximize Number of 
Landing Page Views"]; 
} else if (selectedDestination === "call") { 
goals = ["Maximize Number of Calls"]; 
} else if (selectedDestination === "whatsapp" || 
selectedDestination === "messages") { 
goals = ["Maximize Number of Conversations"]; 
} else { 
goals = ["Maximize Reach / Visits"]; 
} 
const input = lowerInstruction; 
if (input.includes("link click")) selectedPerformanceGoal = 
"MAXIMIZE_LINK_CLICKS"; 
else if (input.includes("landing page view")) 
selectedPerformanceGoal = "MAXIMIZE_LANDING_PAGE_VIEWS"; 
else if (input.includes("conversation")) selectedPerformanceGoal 
= "MAXIMIZE_CONVERSATIONS"; 
else if (input.includes("call")) selectedPerformanceGoal = 
"MAXIMIZE_CALLS"; 
else if (input === "1") selectedPerformanceGoal = 
goals[0].toUpperCase().replace(/ /g, "_"); 
else if (input === "2" && goals[1]) selectedPerformanceGoal = 
goals[1].toUpperCase().replace(/ /g, "_"); 
if (selectedPerformanceGoal) { 
lockedCampaignState = { ...lockedCampaignState, 
performance_goal: selectedPerformanceGoal, stage: "goal_selected" }; 
await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, 
effectiveBusinessId, { campaign_state: lockedCampaignState }, 
session.user.email.toLowerCase()); 
} else { 
return res.status(200).json({ 
ok: true, mode, gated: true, 
text: `What is your performance goal for these ads?\n\n` + 
goals.map((g, i) => `${i + 1}. ${g}`).join("\n") 
}); 
} 
} 
// ============================================================ 
// 
�
�
 OBJECTIVE OVERRIDE (EXPLICIT USER INTENT ONLY) 
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
 
      // 
�
�
 CLEAR LOCKED OBJECTIVE IN DB 
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
    // 
�
�
 META OBJECTIVE SELECTION — HARD BLOCK (STATE AWARE) 
    // ============================================================ 
 
    if ( 
      !isPlanProposed && 
      (mode === "meta_ads_plan") && 
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
    // 
�
�
 CALL DESTINATION CONFIRMATION (NO ASSUMPTIONS) 
    // ============================================================ 
 
    let detectedPhoneNumber = null; 
 
    // 1⃣ Synced business phone (AUTHORITATIVE) 
    if (autoBusinessContext?.business_phone) { 
      detectedPhoneNumber = autoBusinessContext.business_phone; 
    } 
 
    // 2⃣ RAG fallback (only if FB phone not found) 
    if (!detectedPhoneNumber && ragContext) { 
      const phoneMatch = ragContext.match(/(\+?\d[\d\s-]{8,15})/); 
      if (phoneMatch) { 
        detectedPhoneNumber = phoneMatch[1]; 
      } 
    } 
 
    // 3⃣ If CALL objective selected but no number → STOP & ASK 
    if (!isPlanProposed && selectedDestination === "call" && 
!detectedPhoneNumber) { 
      return res.status(200).json({ 
        ok: true, 
        mode, 
        gated: true, 
        text: 
          "I couldn’t find a phone number on your Facebook Page or 
saved business memory.\n\n" + 
          "Please type the exact phone number you want people to call 
(with country code).", 
      }); 
    } 
 
    // 4⃣ Ask confirmation if number found 
    if ( 
      !isPlanProposed && 
      selectedDestination === "call" && 
      detectedPhoneNumber && 
      !lowerInstruction.includes("yes") && 
      !lockedCampaignState?.phone_confirmed 
    ) { 
      return res.status(200).json({ 
        ok: true, 
        mode, 
        gated: true, 
        text: 
`I found this phone number:\n\n
📞
 ${detectedPhoneNumber}\n\n` 
+ 
"Should I use this number for your Call Ads?\n\nReply YES to 
confirm or paste a different number.", 
}); 
} 
// ============================================================ 
// 
�
�
 WHATSAPP DESTINATION CONFIRMATION (ALWAYS ASK) 
// ============================================================ 
let detectedWhatsappNumber = null; 
// 1⃣ Suggest synced business phone (DO NOT auto-use) 
if (autoBusinessContext?.business_phone) { 
detectedWhatsappNumber = autoBusinessContext.business_phone; 
} 
// 2⃣ If WhatsApp selected → ALWAYS confirm (unless already in 
state/confirmed) 
if (!isPlanProposed && selectedDestination === "whatsapp" && 
!lockedCampaignState?.whatsapp_confirmed) { 
const suggestionText = detectedWhatsappNumber 
? `\n\nI found this number on your Facebook Page:\n
📱
 
${detectedWhatsappNumber}` 
: ""; 
return res.status(200).json({ 
ok: true, 
mode, 
gated: true, 
text: 
"WhatsApp ads require an explicit WhatsApp-enabled number." + 
suggestionText + 
"\n\nPlease reply with the exact WhatsApp number you want to 
use (with country code).\n" + 
"Example: +91XXXXXXXXXX", 
}); 
} 
// ============================================================ 
// 
�
�
 LANDING PAGE CONFIRMATION GATE (TRAFFIC ONLY) 
// ============================================================ 
let landingPageConfirmed = !!lockedCampaignState?.landing_page; 
// Detect confirmation from user reply 
if ( 
!landingPageConfirmed && 
(instruction.toLowerCase().includes("yes") || 
instruction.toLowerCase().includes("use this") || 
        instruction.toLowerCase().includes("correct") || 
        instruction.toLowerCase().includes("use my main website")) 
    ) { 
      landingPageConfirmed = true; 
      const targetUrl = detectedLandingPage || null; 
 
      // 
�
�
 Save to state immediately 
      if (effectiveBusinessId) { 
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL; 
        await saveAnswerMemory(baseUrl, effectiveBusinessId, { 
          campaign_state: { 
            ...lockedCampaignState, 
            landing_page: targetUrl, 
            landing_page_confirmed: true, 
            locked_at: new Date().toISOString() 
          } 
        }, session.user.email.toLowerCase()); 
        // Update local state 
        lockedCampaignState = { 
          ...lockedCampaignState, 
          landing_page: targetUrl, 
          landing_page_confirmed: true, 
          locked_at: new Date().toISOString() 
        }; 
      } 
    } else if (!landingPageConfirmed && extractedData.website_url && 
selectedDestination === "website") { 
      // Direct URL Provided 
      landingPageConfirmed = true; 
      if (effectiveBusinessId) { 
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL; 
        await saveAnswerMemory(baseUrl, effectiveBusinessId, { 
          campaign_state: { 
            ...lockedCampaignState, 
            landing_page: extractedData.website_url, 
            landing_page_confirmed: true, 
            locked_at: new Date().toISOString() 
          } 
        }, session.user.email.toLowerCase()); 
        lockedCampaignState = { 
          ...lockedCampaignState, 
          landing_page: extractedData.website_url, 
          landing_page_confirmed: true, 
          locked_at: new Date().toISOString() 
        }; 
      } 
    } 
 
    // If objective is website traffic and landing page exists but not 
confirmed 
    if ( 
      !isPlanProposed && 
      selectedDestination === "website" && 
      detectedLandingPage && 
      !landingPageConfirmed && 
      !lockedCampaignState?.landing_page_confirmed 
    ) { 
      return res.status(200).json({ 
        ok: true, 
        mode, 
        gated: true, 
        text: 
          `To create your campaign, I need to know where you want 
people to go after clicking the ad.\n\n` + 
          `You can choose one of the following:\n\n` + 
          `1⃣ **A specific landing page** (recommended for offers or 
services)\n` + 
          `Example: https://yourwebsite.com/seo-service\n\n` + 
          `2⃣ **Your main website**\n` + 
          `If you don’t provide a specific page, I’ll automatically use 
the website already linked to your business.\n\n` + 
          `
👉
 If you share any URL here, it will override everything 
else.\n\n` + 
          `Please reply with:\n` + 
          `**A landing page URL** OR **"Use my main website"**`, 
      }); 
    } 
    // ============================================================ 
    // 
�
�
 SERVICE DETECTION (FROM BUSINESS INTAKE) 
    // ============================================================ 
 
    const availableServices = 
      autoBusinessContext?.detected_services || []; 
 
    // ============================================================ 
    // 
❓
 SERVICE CONFIRMATION (BEFORE BUDGET / LOCATION) 
    // ============================================================ 
 
    // Logic: If Service is NOT locked, preventing moving forward 
    if ( 
      !isPlanProposed && 
      mode === "meta_ads_plan" && 
      !lockedCampaignState?.service 
    ) { 
      if (extractedData.service) { 
        selectedService = extractedData.service; 
      } else { 
        // Check if user is confirming a service just now 
        const serviceIdx = parseInt(lowerInstruction, 10); 
        if (!isNaN(serviceIdx) && availableServices[serviceIdx - 1]) { 
          selectedService = availableServices[serviceIdx - 1]; 
        } else if (lowerInstruction.length > 3 && 
!lowerInstruction.match(/^\d+$/)) { 
          selectedService = instruction.trim(); 
        } else { 
          return res.status(200).json({ 
            ok: true, gated: true, 
            text: "Which service do you want to promote?\n\n" + 
              (availableServices.length ? availableServices.map((s, i) 
=> `${i + 1}. ${s}`).join("\n") : "- Type your service name") 
          }); 
        } 
      } 
    } 
    // ============================================================ 
    // 
�
�
 LOCK SELECTED SERVICE 
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
    } 
 
    // ============================================================ 
    // 
�
�
 LOCATION DETECTION (FROM BUSINESS INTAKE ONLY) 
    // ============================================================ 
 
    let detectedLocation = 
      autoBusinessContext?.business_city || 
      autoBusinessContext?.business_location || 
      null; 
 
    // ============================================================ 
    // 
❓
 LOCATION CONFIRMATION (ONCE ONLY) 
    // ============================================================ 
 
    if ( 
      !isPlanProposed && 
      mode === "meta_ads_plan" && 
      !lockedCampaignState?.location && 
      !lockedCampaignState?.location_confirmed 
    ) { 
      if (detectedLocation) { 
        return res.status(200).json({ 
          ok: true, 
          gated: true, 
          text: 
            `I detected this location for your business:\n\n
📍
 
${detectedLocation}\n\n` + 
            `Should I run ads for this location?\n\n` + 
            `Reply YES to confirm, or type a different city / area.`, 
        }); 
      } else { 
        return res.status(200).json({ 
          ok: true, 
          gated: true, 
          text: `Where should this ad run? (e.g. Mumbai, New York, or 
'Online')` 
        }); 
      } 
    } 
 
    // ============================================================ 
    // 
�
�
 LOCK LOCATION (CONFIRMED OR USER-PROVIDED) 
    // ============================================================ 
 
    // Case 1⃣ User confirmed detected location 
    if ( 
      detectedLocation && 
      instruction.toLowerCase().includes("yes") 
    ) { 
      selectedLocation = detectedLocation; 
    } 
 
    // Case 2⃣ User typed a new location 
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
 
      // OPTIONAL: immediate continue signal? 
      // For now, let the user see the confirmation or next gate 
    } 
 
    // ============================================================ 
    // 
�
�
 BUDGET & TARGETING GATE (STRICT) 
    // ============================================================ 
    if ( 
      mode === "meta_ads_plan" && 
      lockedCampaignState?.service && 
      lockedCampaignState?.location && 
      lockedCampaignState?.performance_goal 
    ) { 
      // All prerequisites met for Strategy Proposal 
    } 
 
 
    // ============================================================ 
    // 
�
�
 LOCK CAMPAIGN STATE — OBJECTIVE & DESTINATION FINAL 
    // ============================================================ 
 
    if (mode === "meta_ads_plan" && selectedMetaObjective && 
effectiveBusinessId) { 
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL; 
 
      const newState = { 
        ...lockedCampaignState, // Preserve existing state 
(service/location if any) 
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
    // 
�
�
 META CTA RESOLUTION — FORCED MODE 
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
    // 
�
�
 MESSAGE DESTINATION SELECTION (USER MUST CHOOSE) 
    // ============================================================ 
 
    let selectedMessageChannel = null; 
 
    // If user chose "messages", we must ask WHERE 
    if (!isPlanProposed && selectedDestination === "messages" && 
!lockedCampaignState?.message_channel) { 
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
if (lowerInstruction === "1" || 
lowerInstruction.includes("instagram")) { 
selectedMessageChannel = ["instagram"]; 
} 
if (lowerInstruction === "2" || 
lowerInstruction.includes("facebook")) { 
selectedMessageChannel = ["facebook"]; 
} 
if (lowerInstruction === "3" || 
lowerInstruction.includes("whatsapp")) { 
selectedMessageChannel = ["whatsapp"]; 
} 
if (lowerInstruction === "4" || lowerInstruction.includes("all")) 
{ 
selectedMessageChannel = ["instagram", "facebook", "whatsapp"]; 
} 
} 
// ============================================================ 
// 
✏
 CTA OVERRIDE (USER CORRECTION MODE) 
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
    // 
�
�
 META CTA SELECTION — OBJECTIVE AWARE (HARD BLOCK) 
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
    // 
�
�
 META CTA SELECTION — DISABLED (Let Gemini Propose Strategy) 
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
          ctaConfig.options.map((c, i) => `${i + 1}. ${c}`).join("\n") 
+ 
          `\n\nRecommended: ${ctaConfig.recommended}\n\n` + 
          `Reply with the option number or CTA name.`, 
      }); 
    } 
    */ 
 
 
    // ============================================================ 
    // 
�
�
 META ADS FULL FLOW (AUTO → CONFIRM → CREATE PAUSED) 
    // [REMOVED DUPLICATE LOGIC - NOW HANDLED BY STATE MACHINE ABOVE] 
    // ============================================================ 
 
    // ============================================================ 
    // 
�
�
 STORE META OBJECTIVE IN MEMORY (ONCE USER SELECTS) 
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
// 
�
�
 ANSWER MEMORY WIRING 
// =============================== 
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL; 
const detectedAnswers = {}; 
// Simple extraction (safe, heuristic — Gemini already guided the 
question) 
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
await saveAnswerMemory(baseUrl, effectiveBusinessId, 
detectedAnswers, session.user.email.toLowerCase()); 
} 
// ============================================================ 
// 
�
�
 INJECT LOCKED CAMPAIGN STATE INTO GEMINI CONTEXT 
(AUTHORITATIVE) 
// ============================================================ 
const lockedContext = lockedCampaignState 
? ` 
LOCKED CAMPAIGN STATE (DO NOT CHANGE OR RE-ASK): - Objective: ${lockedCampaignState.objective || "N/A"} (Auction) - Conversion Location: ${lockedCampaignState.destination || "N/A"} - Performance Goal: ${lockedCampaignState.performance_goal || "N/A"} - Service: ${lockedCampaignState.service || "N/A"} - Location: ${lockedCampaignState.location || "N/A"} 
RULES: - You MUST NOT ask again for these locked fields. - You MUST use these as FINAL. - All campaigns are created as **PAUSED** (Off) by default. - Only suggest: budget, targeting, creatives, duration. 
` 
: ""; 
const systemPrompt = ` 
You are GabbarInfo AI – a senior digital marketing strategist and 
backend AGENT. 
YOUR CORE JOB: - Follow the STRICT 12-STEP CAMPAIGN CREATION FLOW. - Do NOT skip steps. - Do NOT hallucinate assets (images/URLs). 
==================================================== 
STRICT 12-STEP META CAMPAIGN FLOW 
==================================================== 
1.  User Request (Start) 
2.  Context Check (Business Intake / Meta Connection) 
3.  Objective Confirmation (OUTCOME_TRAFFIC/OUTCOME_LEADS etc. -> 
Auction) 
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
${lockedContext ? "
✅
 LOCKED CONTEXT DETECTED (Steps 3-7 Complete)" : 
"
⚠
 NO LOCKED CONTEXT (Steps 1-7 In Progress)"} 
IF LOCKED CONTEXT EXISTS (Service + Location + Objective): - You are at STEP 8 (Strategy Proposal). - You MUST generate the "Backend JSON" for the campaign plan 
immediately. - Do NOT ask more questions. - Use the JSON schema defined in your Mode Focus. - The plan MUST include: - Campaign Name (Creative & Descriptive) - Budget (Daily, INR) - Targeting (Location from Locked Context) 
- Targeting Suggestions (interests, demographics) - Creative (Headline, Primary Text, Image Prompt) 
IF NO LOCKED CONTEXT: - You are likely in Steps 1-7. - Ask ONE clear question at a time to get the missing info (Objective, 
Service, Location). - Do NOT generate JSON yet. 
==================================================== 
CRITICAL BUSINESS RULES 
==================================================== - If "Forced Meta Business Context" is present, use it. - NEVER invent URLs. Use verified landing pages only. - Assume India/INR defaults. - For Step 8 (Strategy), output JSON ONLY if you have all details. - For Step 12 (Execution), NEVER simulate the output or say it is 
completed unless you see the REAL API output with a Campaign ID. If the 
pipeline is processing, tell the user to wait or that "Execution is 
handled by the system". - IMPORTANT: If a user says "YES" or "LAUNCH", the backend code handles 
the execution. You should NOT hallucinate a success message with fake 
IDs. 
==================================================== 
PLATFORM MODE GUIDANCE 
==================================================== 
${modeFocus} 
${lockedContext} 
==================================================== 
CLIENT CONTEXT 
==================================================== 
Verified Meta Assets: 
${verifiedMetaAssets ? JSON.stringify(verifiedMetaAssets, null, 2) : 
"(none)"} 
Forced Meta Business Context: 
${forcedBusinessContext ? JSON.stringify(forcedBusinessContext, null, 
2) : "(none)"} 
Auto-Detected Business Intake: 
${autoBusinessContext ? JSON.stringify(autoBusinessContext, null, 2) : 
"(none)"} 
RAG / Memory Context: 
${ragContext || "(none)"} 
`.trim(); 
// ============================================================ 
// 
�
�
 HARD STOP — PREVENT URL HALLUCINATION (META TRAFFIC) 
// ============================================================ 
let finalLandingPage = null; 
if (selectedDestination === "website") { 
if (!detectedLandingPage) { 
return res.status(200).json({ 
ok: true, 
gated: true, 
text: 
"I could not find a website URL from your connected 
assets.\n\n" + 
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
Caller hint: - includeJson = ${includeJson} 
If the user clearly asked for BACKEND JSON ONLY 
(and includeJson is true), respond with JSON only (no backticks, no 
explanation). 
Otherwise, respond with a full, clear explanation, and include example 
JSON only if helpful. 
`.trim(); 
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL }); 
// 
�
�
 BLOCK GEMINI IF GATES ARE NOT PASSED (Double Safety) 
if (!isPlanProposed && mode === "meta_ads_plan" && 
(!lockedCampaignState?.service || !lockedCampaignState?.location)) { 
// Technically unreachable if gates are working, but safe 
fallback 
return res.status(200).json({ ok: true, text: "waiting for 
details..." }); 
} 
// 
⚡
 CRITICAL SHORT-CIRCUIT: Skip Gemini if plan exists and user 
confirms 
if ( 
lockedCampaignState?.stage === "PLAN_PROPOSED" && 
lockedCampaignState?.plan && 
(lowerInstruction.includes("yes") || 
lowerInstruction.includes("approve") || 
lowerInstruction.includes("confirm") || 
lowerInstruction.includes("proceed") || 
lowerInstruction.includes("launch") || 
lowerInstruction.includes("generate") || 
lowerInstruction.includes("image")) 
) { 
// 
�
�
 IDEMPOTENCY PROTECTION 
const now = Date.now(); 
const lastUpdate = lockedCampaignState.locked_at ? new 
Date(lockedCampaignState.locked_at).getTime() : 0; 
if (now - lastUpdate < 10000 && lockedCampaignState.stage !== 
"PLAN_PROPOSED") { 
console.warn(`[IDEMPOTENCY] Short-circuit blocked duplicate 
request for ${effectiveBusinessId}`); 
return res.status(200).json({ ok: true, mode, text: "I'm 
already working on that! One moment..." }); 
} 
console.log(`[PROD_LOG] 
�
�
 SHORT-CIRCUIT: Transitioning Started | 
User: ${session.user.email} | ID: ${effectiveBusinessId} | From: 
${lockedCampaignState.stage}`); 
let currentState = { ...lockedCampaignState, locked_at: new 
Date().toISOString() }; 
// 
�
�
 Safety Check: Ensure plan is valid 
// 
�
�
 HARD RULE: Never proceed to confirmation/execution without 
a saved plan 
if (!currentState.plan || !currentState.plan.campaign_name) { 
console.warn("Plan missing at confirmation. Recreating 
automatically."); 
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
await saveAnswerMemory( 
baseUrl, 
effectiveBusinessId, 
{ campaign_state: repairedState }, 
session.user.email.toLowerCase() 
); 
currentState = repairedState; 
} 
const stage = lockedCampaignState.stage; 
let waterfallLog = []; 
let errorOcurred = false; 
let stopReason = null; 
console.log("
📍
 Waterfall Check - Stage:", stage); 
console.log("
📍
 Waterfall Check - Plan Name:", 
currentState.plan.campaign_name); 
// --- STEP 9: IMAGE GENERATION --- 
// Logic: If we have a plan but NO image yet -> Generate Image 
const hasImage = currentState.creative && 
(currentState.creative.imageBase64 || currentState.creative.imageUrl); 
if (!hasImage) { 
console.log("
🚀
 Waterfall: Starting Image Generation..."); 
const plan = currentState.plan || {}; 
const adSet0 = (Array.isArray(plan.ad_sets) ? plan.ad_sets[0] : 
(plan.ad_sets || {})); 
const creativeResult = adSet0.ad_creative || adSet0.creative || 
adSet0.ads?.[0]?.creative || {}; 
const imagePrompt = creativeResult.image_prompt || 
creativeResult.image_generation_prompt || creativeResult.imagePrompt || 
creativeResult.primary_text || `${plan.campaign_name || "New Campaign"} 
ad image`; 
try { 
const imgRes = await 
fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/images/generate`, { 
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
            currentState = { ...currentState, stage: "IMAGE_GENERATED", 
creative: newCreative }; 
            waterfallLog.push("
✅
 Step 9: Image Generated"); 
          } else { 
            errorOcurred = true; 
            stopReason = "Image Generation Failed (No Base64 
returned)"; 
          } 
        } catch (e) { 
          errorOcurred = true; 
          stopReason = `Image Generation Error: ${e.message}`; 
        } 
      } else { 
        waterfallLog.push("
⏭
 Step 9: Image Already Exists"); 
      } 
 
      // --- STEP 10: IMAGE UPLOAD --- 
      if (!errorOcurred) { 
        const hasImageReady = currentState.creative && 
currentState.creative.imageBase64; 
        const hasHash = currentState.image_hash; 
 
        if (hasImageReady && !hasHash) { 
          console.log("
🚀
 Waterfall: Uploading Image to Meta..."); 
          try { 
            const uploadRes = await 
fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/upload-image`, { 
              method: "POST", 
              headers: { "Content-Type": "application/json", 
"X-Client-Email": __currentEmail || "" }, 
              body: JSON.stringify({ imageBase64: 
currentState.creative.imageBase64 }) 
            }); 
            const uploadJson = await parseResponseSafe(uploadRes); 
            const iHash = uploadJson.imageHash || 
uploadJson.image_hash; 
 
            if (uploadJson.ok && iHash) { 
              currentState = { ...currentState, stage: 
"READY_TO_LAUNCH", image_hash: iHash }; 
              waterfallLog.push("
✅
 Step 10: Image Uploaded to Meta"); 
            } else { 
              errorOcurred = true; 
              stopReason = `Meta Upload Failed: ${uploadJson.message || 
"Unknown error"}`; 
            } 
          } catch (e) { 
            errorOcurred = true; 
            stopReason = `Meta Upload Error: ${e.message}`; 
          } 
        } else if (hasHash) { 
waterfallLog.push("
⏭
 Step 10: Image Already Uploaded"); 
} 
} 
// --- STEP 12: EXECUTION (Final Step) --- 
if (!errorOcurred) { 
const isReady = (currentState.stage === "READY_TO_LAUNCH" || 
currentState.stage === "IMAGE_UPLOADED") && currentState.image_hash; 
const wantsLaunch = lowerInstruction.includes("launch") || 
lowerInstruction.includes("execute") || 
lowerInstruction.includes("run") || 
lowerInstruction.includes("publish") || 
lowerInstruction.includes("yes") || lowerInstruction.includes("ok") || 
currentState.auto_run; 
if (isReady && (wantsLaunch || currentState.objective === 
"TRAFFIC")) { 
console.log("
🚀
 Waterfall: Executing Campaign on Meta..."); 
try { 
const plan = currentState.plan; 
const finalPayload = { 
...plan, 
ad_sets: plan.ad_sets.map(adset => ({ 
...adset, 
ad_creative: { ...adset.ad_creative, image_hash: 
currentState.image_hash } 
})) 
}; 
const execRes = await 
fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/execute-campaign`, 
{ 
method: "POST", 
headers: { "Content-Type": "application/json", 
"X-Client-Email": __currentEmail || "" }, 
body: JSON.stringify({ platform: "meta", payload: 
finalPayload }) 
}); 
const execJson = await execRes.json(); 
if (execJson.ok) { 
await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, 
effectiveBusinessId, { 
campaign_state: { stage: "COMPLETED", final_result: 
execJson } 
}, session.user.email.toLowerCase()); 
return res.status(200).json({ 
ok: true, 
text: `
🎉
 **Campaign Published 
Successfully!**\n\n**Pipeline Status**:\n${waterfallLog.join("\n")}\n
✅
 
Step 12: Campaign Created (PAUSED)\n\n**Meta Details**:\n- **Campaign 
Name**: ${plan.campaign_name}\n- **Campaign ID**: \`${execJson.id || 
"N/A"}\`\n- **Ad Account ID**: \`${verifiedMetaAssets?.ad_account?.id 
|| "N/A"}\`\n- **Status**: PAUSED\n\nYour campaign is now waiting in 
your Meta Ads Manager for final review.` 
}); 
} else { 
errorOcurred = true; 
stopReason = `Meta Execution Failed: ${execJson.message 
|| "Unknown error"}`; 
} 
} catch (e) { 
errorOcurred = true; 
stopReason = `Meta Execution Error: ${e.message}`; 
} 
} 
} 
// Save progress reached 
if (effectiveBusinessId) { 
console.log(`[PROD_LOG] 
✅
 SHORT-CIRCUIT: Transition Finished | 
ID: ${effectiveBusinessId} | FinalStage: ${currentState.stage}`); 
await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, 
effectiveBusinessId, { campaign_state: currentState }, 
session.user.email.toLowerCase()); 
} 
// If we stopped due to error or waiting 
let feedbackText = ""; 
if (errorOcurred) { 
feedbackText = `
❌
 **Automation Interrupted**:\n\n**Error**: 
${stopReason}\n\n**Pipeline 
Progress**:\n${waterfallLog.join("\n")}\n\nI've saved the progress so 
far. Please check the error above and reply to try again.`; 
} else if (currentState.stage === "IMAGE_GENERATED") { 
feedbackText = `
✅
 **Image Generated Successfully**\n\n[Image 
Generated]\n\n**Next Steps**:\n1. Upload image to Meta Assets\n2. 
Create paused campaign on Facebook/Instagram\n\nReply **LAUNCH** to 
complete these steps automatically.`; 
} else if (currentState.stage === "READY_TO_LAUNCH") { 
feedbackText = `
✅
 **Image Uploaded & Ready**\n\nEverything is 
set for campaign launch.\n\n**Details**:\n- Campaign: 
${currentState.plan.campaign_name}\n- Budget: 
${currentState.plan.budget?.amount || "500"} INR\n\nReply **LAUNCH** to 
publish the campaign to Meta.`; 
} else { 
feedbackText = `**Current Pipeline 
Progress**:\n${waterfallLog.join("\n") || "No steps completed in this 
turn."}\n\n(Debug: Stage=${currentState.stage}, 
Plan=${currentState.plan ? "Yes" : "No"}, 
Image=${currentState.creative?.imageBase64 ? "Yes" : "No"}, 
Hash=${currentState.image_hash || "No"})\n\nWaiting for your 
confirmation...`; 
      } 
 
      return res.status(200).json({ ok: true, text: feedbackText, 
imageUrl: currentState.creative?.imageUrl, mode }); 
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
 
    // 
�
�
 CLEANUP: If Gemini outputs JSON, hide it from the user flow 
(User complaint: "Jumps to JSON"). 
    // We only want to show the JSON *Summary* text if passing a 
proposed plan. 
    /* 
    if (activeBusinessId && text.includes("```json")) { 
      // We will strip the JSON block for the display text 
      text = text.replace(/```json[\s\S]*?```/g, "").trim(); 
      if (!text) text = "I have drafted a plan based on your 
requirements. Please check it internally."; 
    } 
    */ 
 
    // 
�
�
 DETECT AND SAVE JSON PLAN (FROM GEMINI) 
    // Supports: ```json ... ```, ``` ... ```, or plain JSON starting 
with { 
    if (effectiveBusinessId) { 
      let jsonString = null; 
 
      // 1. Try code blocks 
      const strictMatch = 
rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/); 
      if (strictMatch) { 
        jsonString = strictMatch[1]; 
      } else { 
// 2. Try finding the outermost JSON object (Robust Fallback) 
// Look for the first '{' and the last '}' 
const start = rawText.indexOf('{'); 
const end = rawText.lastIndexOf('}'); 
if (start !== -1 && end !== -1 && end > start) { 
// Verify it looks like our JSON (has campaign_name or 
EXECUTE or campaign OR objective) 
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
try { 
let planJson = JSON.parse(jsonString); 
// 
�
�
 NORMALIZE JSON: If Gemini gave the "Nested" structure, 
flatten it to our Standard Schema 
if (planJson.campaign_data) { 
console.log("
🔄
 Normalizing Gemini Nested JSON Plan..."); 
const d = planJson.campaign_data; 
const s = d.campaign_settings || {}; 
const t = d.targeting_plan || {}; 
const c = d.creative_plan?.[0] || {}; 
planJson = { 
campaign_name: s.campaign_name || "New Campaign", 
objective: (s.objective && (s.objective.includes("LEAD") 
|| s.objective.includes("PROSPECT"))) ? "OUTCOME_LEADS" : 
(s.objective?.includes("SALE") || s.objective?.includes("CONVERSION") ? 
"OUTCOME_SALES" : "OUTCOME_TRAFFIC"), 
performance_goal: s.performance_goal || 
d.performance_goal || lockedCampaignState?.performance_goal || 
"MAXIMIZE_LINK_CLICKS", 
budget: { 
amount: s.daily_budget_inr || s.budget?.amount || 500, 
currency: "INR", 
type: "DAILY" 
}, 
targeting: { 
geo_locations: { countries: ["IN"], cities: 
t.locations?.map(l => ({ name: l })) || [] }, 
age_min: parseInt(t.age_range?.split("-")[0]) || 18, 
age_max: parseInt(t.age_range?.split("-")[1]) || 65, 
targeting_suggestions: t.targeting_suggestions || {} 
}, 
ad_sets: [ 
{ 
name: c.creative_set_name || "Ad Set 1", 
status: "PAUSED", 
ad_creative: { 
imagePrompt: c.image_prompt || 
c.image_generation_prompt || c.imagePrompt || "Ad Image", 
imageUrl: normalizeGoogleDriveUrls(c.image_url || 
c.imageUrl || null), 
primary_text: c.primary_text || "", 
headline: c.headline || "", 
call_to_action: s.call_to_action || "LEARN_MORE", 
destination_url: s.destination_url || 
detectedLandingPage || null 
} 
} 
] 
}; 
} 
// 
�
�
 NORMALIZE JSON: Variation 2 (Step/Details structure) 
if (planJson.campaign_details) { 
console.log("
🔄
 Normalizing Gemini JSON Variation 2..."); 
const d = planJson.campaign_details; 
const ads = Array.isArray(planJson.ad_sets) ? 
planJson.ad_sets[0] : (planJson.ad_sets || {}); 
const c = ads.ad_creative || ads.creative || {}; 
planJson = { 
campaign_name: d.name || "New Campaign", 
objective: (d.objective && (d.objective.includes("LEAD") 
|| d.objective.includes("PROSPECT"))) ? "OUTCOME_LEADS" : 
(d.objective?.includes("SALE") || d.objective?.includes("CONVERSION") ? 
"OUTCOME_SALES" : "OUTCOME_TRAFFIC"), 
performance_goal: d.performance_goal || 
ads.performance_goal || lockedCampaignState?.performance_goal || 
"MAXIMIZE_LINK_CLICKS", 
budget: { 
amount: d.budget_daily_inr || ads.daily_budget?.amount 
|| 500, 
currency: "INR", 
type: "DAILY" 
}, 
targeting: { 
geo_locations: { 
countries: d.targeting?.location === "India" ? ["IN"] 
: ["IN"], 
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
imagePrompt: c.image_prompt || 
c.image_generation_prompt || c.imagePrompt || "Ad Image", 
imageUrl: normalizeGoogleDriveUrls(c.image_url || 
c.imageUrl || null), 
primary_text: c.primary_text || "", 
headline: c.headline || "", 
call_to_action: c.call_to_action || "LEARN_MORE", 
destination_url: (d.destination || c.landing_page 
|| detectedLandingPage || null) 
} 
} 
] 
}; 
} 
// 
�
�
 NORMALIZE JSON: Variation 3 (EXECUTE: true structure) 
if (planJson.EXECUTE && planJson.campaign_plan) { 
console.log("
🔄
 Normalizing Gemini JSON Variation 3 
(EXECUTE: true)..."); 
const cp = planJson.campaign_plan; 
const d = cp.details || cp; 
const ads = Array.isArray(cp.ad_sets) ? cp.ad_sets[0] : 
(cp.ad_sets || {}); 
const c = ads.ad_creative || ads.creative || {}; 
planJson = { 
campaign_name: d.name || d.campaign_name || "New 
Campaign", 
objective: (d.objective && (d.objective.includes("LEAD") 
|| d.objective.includes("PROSPECT"))) ? "OUTCOME_LEADS" : 
(d.objective?.includes("SALE") || d.objective?.includes("CONVERSION") ? 
"OUTCOME_SALES" : "OUTCOME_TRAFFIC"), 
performance_goal: d.performance_goal || 
ads.performance_goal || lockedCampaignState?.performance_goal || 
"MAXIMIZE_LINK_CLICKS", 
budget: { 
amount: d.budget_daily_inr || d.budget?.amount || 500, 
currency: "INR", 
type: "DAILY" 
}, 
targeting: { 
geo_locations: { 
countries: d.targeting?.location === "India" ? ["IN"] 
: ["IN"], 
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
imagePrompt: c.image_prompt || 
c.image_generation_prompt || c.imagePrompt || "Ad Image", 
imageUrl: normalizeGoogleDriveUrls(c.image_url || 
c.imageUrl || null), 
primary_text: c.primary_text || "", 
headline: c.headline || "", 
call_to_action: c.call_to_action || "LEARN_MORE", 
destination_url: (d.destination || c.landing_page 
|| detectedLandingPage || null) 
} 
} 
] 
}; 
} 
// 
�
�
 NORMALIZE JSON: Variation 5 (campaigns array structure) 
if (planJson.campaigns && Array.isArray(planJson.campaigns)) 
{ 
console.log("
🔄
 Normalizing Gemini JSON Variation 5 
(campaigns array)..."); 
const c = planJson.campaigns[0]; 
const adSet = c.adSets?.[0] || {}; 
const creative = adSet.adCreatives?.[0]?.creative || {}; 
const tgt = adSet.targeting || {}; 
// Map Objective 
let rawObj = c.objective || "OUTCOME_TRAFFIC"; 
let objective = (rawObj.includes("LEAD") || 
rawObj.includes("PROSPECT")) ? "OUTCOME_LEADS" : 
(rawObj.includes("SALE") || rawObj.includes("CONVERSION") ? 
"OUTCOME_SALES" : "OUTCOME_TRAFFIC"); 
planJson = { 
campaign_name: c.name || "New Campaign", 
objective: objective, 
performance_goal: c.performance_goal || 
adSet.performance_goal || lockedCampaignState?.performance_goal || 
"MAXIMIZE_LINK_CLICKS", 
budget: { 
amount: adSet.daily_budget || 500, 
currency: adSet.currency || "INR", 
type: "DAILY" 
}, 
targeting: { 
geo_locations: { 
countries: ["IN"], 
cities: tgt.geo_locations?.cities?.map(city => ({ 
name: city.name })) || [] 
}, 
age_min: tgt.age_min || 18, 
age_max: tgt.age_max || 65 
}, 
ad_sets: [ 
{ 
name: adSet.name || "Ad Set 1", 
status: c.status || "PAUSED", 
ad_creative: { 
imagePrompt: creative.image_prompt || 
creative.imagePrompt || "Ad Image", 
imageUrl: 
normalizeGoogleDriveUrls(creative.image_url || creative.imageUrl || 
null), 
primary_text: creative.primaryText_options?.[0] || 
"", 
headline: creative.headline_options?.[0] || "", 
call_to_action: creative.call_to_action || 
"LEARN_MORE", 
destination_url: (creative.destination_url || 
detectedLandingPage || null) 
} 
} 
] 
}; 
} 
// 
�
�
 NORMALIZE JSON: Variation 8 (User Reported 
meta_campaign_plan) 
if (planJson.meta_campaign_plan || 
planJson.campaign_creation_flow_step) { 
structure..."); 
console.log("
🔄
 Normalizing reported Meta Campaign Plan 
const mcp = planJson.meta_campaign_plan || {}; 
const adSetInput = mcp.ad_set || {}; 
const creativeInput = mcp.creative || {}; 
const tgt = adSetInput.targeting || {}; 
const budget = mcp.budget || {}; 
planJson = { 
campaign_name: mcp.campaign_name || "New Campaign", 
objective: (mcp.campaign_objective === "TRAFFIC" || 
(mcp.campaign_objective && mcp.campaign_objective.includes("CLICK"))) ? 
"OUTCOME_TRAFFIC" : (mcp.campaign_objective || "OUTCOME_TRAFFIC"), 
performance_goal: adSetInput.performance_goal || 
"MAXIMIZE_LINK_CLICKS", 
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
age_max: 
parseInt(tgt.age_range?.split("-")[1]?.replace("+", "")) || 65, 
targeting_suggestions: { 
interests: tgt.detailed_targeting_suggestions || [] 
} 
}, 
ad_sets: [ 
{ 
name: "Ad Set 1", 
status: "PAUSED", 
ad_creative: { 
imagePrompt: creativeInput.imagePrompt || 
creativeInput.image_prompt || "Ad Image", 
imageUrl: 
normalizeGoogleDriveUrls(creativeInput.image_url || 
creativeInput.imageUrl || null), 
primary_text: creativeInput.primary_text || "", 
headline: creativeInput.headline || "", 
call_to_action: creativeInput.call_to_action || 
"LEARN_MORE", 
destination_url: (creativeInput.destination_url || 
detectedLandingPage || null) 
} 
} 
] 
}; 
} 
// 
�
�
 NORMALIZE JSON: Variation 6 (campaign + adSets + ads 
structure) 
if (planJson.campaign && planJson.adSets && 
Array.isArray(planJson.adSets)) { 
console.log("
🔄
 Normalizing Gemini JSON Variation 6 
(campaign/adSets/ads)..."); 
const c = planJson.campaign; 
const adSet = planJson.adSets[0] || {}; 
// Try to find creative in ads array or adSet 
let creative = {}; 
if (planJson.ads && Array.isArray(planJson.ads)) { 
creative = planJson.ads[0]?.creative_spec || 
planJson.ads[0]?.creative || {}; 
} 
// Map Objective 
let rawObj = c.objective || "OUTCOME_TRAFFIC"; 
let objective = (rawObj.includes("LEAD") || 
rawObj.includes("PROSPECT")) ? "OUTCOME_LEADS" : 
(rawObj.includes("SALE") || rawObj.includes("CONVERSION") ? 
"OUTCOME_SALES" : "OUTCOME_TRAFFIC"); 
// Map Budget 
const budgetAmount = adSet.daily_budget || c.budget?.amount 
|| 500; 
}); 
// Map Targeting 
const geo = adSet.targeting?.geo_locations || {}; 
const countries = ["IN"]; // Default 
const cities = []; 
if (geo.cities) { 
geo.cities.forEach(city => { 
if (typeof city === "string") cities.push({ name: city 
else if (city.name) cities.push({ name: city.name }); 
}); 
} 
// Map Creative Assets 
const assets = creative.assets || {}; 
const primaryText = 
Array.isArray(assets.primaryTextVariations) ? 
assets.primaryTextVariations[0] : (assets.primaryText || ""); 
const headline = Array.isArray(assets.headlines) ? 
assets.headlines[0] : (assets.headline || ""); 
planJson = { 
campaign_name: c.name || "New Campaign", 
objective: objective, 
performance_goal: c.performance_goal || 
adSet.performance_goal || lockedCampaignState?.performance_goal || 
"MAXIMIZE_LINK_CLICKS", 
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
imageUrl: normalizeGoogleDriveUrls(assets.image_url 
|| assets.imageUrl || null), 
primary_text: primaryText, 
headline: headline, 
call_to_action: creative.call_to_action_type || 
"LEARN_MORE", 
destination_url: (creative.link_url || 
detectedLandingPage || null) 
} 
} 
] 
}; 
} 
// 
�
�
 NORMALIZE JSON: Variation 7 (Step 8 Flow - 
"campaign_plan" object) 
if (planJson.campaign_plan || (planJson.step === 8)) { 
console.log("
🔄
 Normalizing Gemini JSON Variation 7 
(Campaign Plan / Step 8)..."); 
const cp = planJson.campaign_plan || planJson; 
const adSetsStr = planJson.ad_set_strategy || 
planJson.ad_sets || []; 
const creativesStr = planJson.creative_strategy || 
planJson.ad_creatives || []; 
// Extract first items 
const adSetItem = Array.isArray(adSetsStr) ? adSetsStr[0] : 
(adSetsStr || {}); 
const creativeItem = Array.isArray(creativesStr) ? 
creativesStr[0] : (creativesStr || {}); 
const cName = cp.campaign_name || "New Campaign"; 
// Map Objective 
let obj = cp.objective || "OUTCOME_TRAFFIC"; 
if (obj.includes("LINK") || obj.includes("TRAFFIC")) obj = 
"OUTCOME_TRAFFIC"; 
else if (obj.includes("LEAD")) obj = "OUTCOME_LEADS"; 
else obj = "OUTCOME_TRAFFIC"; 
const budgetAmount = cp.budget_daily_inr || 
cp.budget?.amount || 500; 
// Map Location 
const geo = adSetItem.geo_targeting || {}; 
const cities = Array.isArray(geo.cities) 
? geo.cities.map(c => ({ name: c })) 
: (geo.cities ? [{ name: geo.cities }] : [{ name: "India" 
}]); 
planJson = { 
campaign_name: cName, 
objective: obj, 
performance_goal: cp.performance_goal || 
adSetItem.performance_goal || lockedCampaignState?.performance_goal || 
"MAXIMIZE_LINK_CLICKS", 
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
imagePrompt: creativeItem.image_prompt || "Ad 
Image", 
imageUrl: 
normalizeGoogleDriveUrls(creativeItem.image_url || 
creativeItem.imageUrl || null), 
primary_text: creativeItem.primary_text || "", 
headline: creativeItem.headline || "", 
call_to_action: creativeItem.call_to_action || 
"LEARN_MORE", 
destination_url: (creativeItem.destination_url || 
detectedLandingPage || null) 
} 
} 
] 
}; 
} 
// 
�
�
 NORMALIZE JSON: Variation 4 (Flat META plan shape) 
if (!planJson.campaign_name && (planJson.name || 
planJson.objective || planJson.ad_creative)) { 
const d = planJson; 
const tgt = d.targeting || {}; 
const dest = d.destination || {}; 
const cr = d.ad_creative || {}; 
const urlCandidate = (dest.url || cr.landing_page || 
detectedLandingPage || "").toString(); 
const cleanUrl = urlCandidate.replace(/[`]/g, "").trim(); 
const cities = Array.isArray(tgt.geo_locations) 
? tgt.geo_locations.map((g) => (g.location_name ? { name: 
g.location_name } : null)).filter(Boolean) 
: []; 
planJson = { 
campaign_name: d.name || "New Campaign", 
objective: (d.objective && (d.objective.includes("CLICK") 
|| d.objective.includes("TRAFFIC"))) ? "OUTCOME_TRAFFIC" : 
(d.objective?.includes("LEAD") ? "OUTCOME_LEADS" : (d.objective || 
"OUTCOME_TRAFFIC")), 
performance_goal: d.performance_goal || 
cr.performance_goal || lockedCampaignState?.performance_goal || 
"MAXIMIZE_LINK_CLICKS", 
budget: { 
amount: d.budget?.daily_budget_inr || 
d.budget_daily_inr || 500, 
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
imagePrompt: cr.image_prompt || cr.imagePrompt || 
"Ad Image", 
imageUrl: normalizeGoogleDriveUrls(cr.image_url || 
cr.imageUrl || null), 
primary_text: cr.primary_text || "", 
headline: cr.headline || "", 
call_to_action: dest.call_to_action || 
cr.call_to_action || "LEARN_MORE", 
destination_url: (cleanUrl || detectedLandingPage 
|| null) 
} 
} 
] 
}; 
} 
// Basic validation (is it a campaign plan?) 
if (planJson.campaign_name && planJson.ad_sets) { 
// 
�
�
 SECURITY: Enforce strict Objective & Optimization 
Mapping (User Golden Rule) 
// Rule: Objective = Campaign Level (OUTCOME_TRAFFIC), 
Performance Goal = Ad Set Level (LINK_CLICKS) 
const rawObj = (planJson.objective || 
"").toString().toUpperCase(); 
let cleanObjective = "OUTCOME_TRAFFIC"; // Default 
if (rawObj.includes("LEAD") || rawObj.includes("PROSPECT")) 
cleanObjective = "OUTCOME_LEADS"; 
else if (rawObj.includes("SALE") || 
rawObj.includes("CONVERSION")) cleanObjective = "OUTCOME_SALES"; 
else if (rawObj.includes("AWARENESS") || 
rawObj.includes("REACH")) cleanObjective = "OUTCOME_AWARENESS"; 
else if (rawObj.includes("ENGAGE")) cleanObjective = 
"OUTCOME_ENGAGEMENT"; 
else if (rawObj.includes("APP")) cleanObjective = 
"OUTCOME_APP_PROMOTION"; 
// Else default to OUTCOME_TRAFFIC (catches "LINK_CLICKS", 
"TRAFFIC", etc.) 
console.log(`
🛡
 Sanitized Objective: ${planJson.objective} -> ${cleanObjective}`); 
planJson.objective = cleanObjective; 
// Ensure Ad Sets have correct structure 
planJson.ad_sets = planJson.ad_sets.map(adset => { 
// Map Performance Goal -> Optimization Goal 
const perfGoal = (planJson.performance_goal || 
adset.performance_goal || "LINK_CLICKS").toString().toUpperCase(); 
let optGoal = "LINK_CLICKS"; 
if (cleanObjective === "OUTCOME_TRAFFIC") { 
optGoal = perfGoal.includes("LANDING") ? 
"LANDING_PAGE_VIEWS" : "LINK_CLICKS"; 
} else if (cleanObjective === "OUTCOME_LEADS") { 
optGoal = "LEADS"; // Simplified 
} else if (cleanObjective === "OUTCOME_SALES") { 
optGoal = "CONVERSIONS"; // Simplified 
} 
return { 
...adset, 
optimization_goal: adset.optimization_goal || optGoal, 
destination_type: adset.destination_type || "WEBSITE", 
// Default to Website 
billing_event: "IMPRESSIONS" // Safe default 
}; 
}); 
const newState = { 
...lockedCampaignState, // Preserve verified assets 
stage: "PLAN_PROPOSED", 
plan: planJson, 
// Objective/Dest might be redundant if in 
lockedCampaignState, but safe to keep 
objective: lockedCampaignState?.objective || 
selectedMetaObjective, 
destination: lockedCampaignState?.destination || 
selectedDestination, 
re-gating 
// 
�
�
 FIX: Sync plan details to state to prevent 
service: lockedCampaignState?.service || 
planJson.campaign_name || "Digital Marketing", 
location: lockedCampaignState?.location || 
(planJson.targeting?.geo_locations?.cities?.[0]?.name) || "India", 
landing_page: lockedCampaignState?.landing_page || 
planJson.ad_sets?.[0]?.ad_creative?.destination_url, 
landing_page_confirmed: true, 
location_confirmed: true, 
service_confirmed: true, 
locked_at: new Date().toISOString() 
}; 
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL; 
console.log("
💾
 Saving Proposed Plan to Agent Memory..."); 
await saveAnswerMemory(baseUrl, effectiveBusinessId, { 
campaign_state: newState 
}, session.user.email.toLowerCase()); 
lockedCampaignState = newState; 
console.log("
✅
 Saved Proposed Plan to State"); 
// 
�
�
 Overwrite the response text with a clean summary 
const creative = planJson.ad_sets?.[0]?.ad_creative || 
planJson.ad_sets?.[0]?.ads?.[0]?.creative || {}; 
// Handle Budget Variance (Object vs Flat) 
const bAmount = planJson.budget?.amount || 
planJson.budget_value || "N/A"; 
const bCurrency = planJson.budget?.currency || "INR"; 
const bType = planJson.budget?.type || planJson.budget_type 
|| "DAILY"; 
const creativeTitle = creative.headline || creative.title 
|| "Headline"; 
const creativeBody = creative.primary_text || creative.body 
|| "Body Text"; 
const tStr = planJson.targeting?.targeting_suggestions 
? `\n**Suggestions**: 
${planJson.targeting.targeting_suggestions.interests?.join(", ") || ""} 
(${planJson.targeting.targeting_suggestions.demographics?.join(", ") || 
""})` 
: ""; 
text = ` 
**Plan Proposed: ${planJson.campaign_name}** 
**Targeting**: ${planJson.targeting?.geo_locations?.countries?.join(", 
") || "India"} (${planJson.targeting?.age_min || 
18}-${planJson.targeting?.age_max || 65}+)${tStr} 
**Budget**: ${bAmount} ${bCurrency} (${bType}) 
**Creative Idea**:  
"${creativeTitle}" 
_${creativeBody}_ 
**Image Concept**:  
_${creative.image_prompt || creative.imagePrompt || "Standard ad 
creative based on service"}_ 
**Call to Action**: ${creative.call_to_action || "Learn More"} 
Reply **YES** to generate this image and launch the campaign. 
`.trim(); 
} else { 
// It's JSON, but not a plan we recognize.  
// Maybe it's just normal JSON output. Let's keep the raw 
text so user can see it. 
} 
} catch (e) { 
console.warn("Failed to parse/save detected JSON plan:", e); 
// Fallback: If we thought it was JSON but failed to parse, 
// we should probably leave 'text' as 'rawText' so the user 
sees the error or content. 
} 
} 
} 
// 
�
�
 FALLBACK: FORCE SAVE PLAN IF TEXT LOOKS LIKE A PROPOSAL BUT 
NO JSON WAS FOUND 
// This catches the case where Gemini returns a nice text plan but 
forgets the JSON block. 
// We construct a minimal plan from the User's Instruction + 
Gemini's output. 
const isPlanText = /Plan Proposed|Proposed Plan|Campaign 
Plan|Creative Idea|Strategy Proposal|Campaign Name/i.test(text); 
// 
�
�
 FIX: Allow saving if state exists but HAS NO PLAN (e.g. just 
stage=PLANNING) 
// AND Only if we haven't already saved a JSON plan (planJson would 
handle that path above) 
// AND if effectiveBusinessId is valid 
if ((mode === "meta_ads_plan" || isPlanText) && 
(!lockedCampaignState || !lockedCampaignState.plan) && 
effectiveBusinessId) { 
const looksLikePlan = isPlanText || text.includes("Budget") || 
text.includes("Creative Idea") || text.includes("Targeting") || 
text.includes("Creative Idea:"); 
if (looksLikePlan) { 
console.log("
⚠
 No JSON plan detected, but text looks like a 
plan. Attempting aggressive fallback extraction..."); 
// Helper to extract from both Instruction (Input) and Text 
(Output) 
etc. 
const extractFrom = (source, key) => { 
// Robust regex to handle **Plan Proposed**, Plan Proposed:, 
const regex = new 
RegExp(`(?:\\*\\*|#)?${key}(?:\\*\\*|#)?[:\\-]?\\s*(.*?)(?:\\n|$)`, 
"i"); 
const match = source.match(regex); 
return match ? match[1].trim() : null; 
}; 
// Extraction Priority: Output Text (Gemini) > Input 
Instruction (User) 
const extractedTitle = extractFrom(text, "Plan Proposed") || 
extractFrom(text, "Campaign Name") || extractFrom(instruction, 
"Campaign Name") || "New Meta Campaign"; 
const rawBudget = extractFrom(text, "Budget") || 
extractFrom(instruction, "Budget"); 
const budgetVal = rawBudget ? 
parseInt(rawBudget.replace(/[^\d]/g, "")) : 500; 
const extractedLocation = extractFrom(text, "Location") || 
extractFrom(instruction, "Location") || "India"; 
const extractedWebsite = extractFrom(text, "Website") || 
extractFrom(instruction, "Website") || detectedLandingPage || null; 
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
cities: extractedLocation.includes(",") ? 
extractedLocation.split(",").map(c => ({ name: c.trim() })) : [{ name: 
extractedLocation }] 
}, 
age_min: 18, 
age_max: 65 
}, 
ad_sets: [ 
{ 
name: "Ad Set 1", 
status: "PAUSED", 
ad_creative: { 
primary_text: extractFrom(text, "Creative Idea") || 
extractFrom(instruction, "Creative Idea") || "Best Digital Marketing 
Services", 
headline: extractFrom(text, "Headline") || 
extractFrom(text, "Plan Proposed") || "Grow Your Business", 
call_to_action: extractFrom(text, "Call to Action") || 
"LEARN_MORE", 
destination_url: extractedWebsite, 
imageUrl: normalizeGoogleDriveUrls(extractFrom(text, 
"Image URL") || extractFrom(instruction, "Image URL")), 
image_prompt: extractFrom(text, "Image Concept") || 
extractFrom(instruction, "Image Concept") || "Professional business 
service ad" 
}, 
}, 
], 
}; 
const newState = { 
...lockedCampaignState, 
stage: "PLAN_PROPOSED", 
plan: minimalPlan, 
          // 
�
�
 SYNC PLAN DETAILS TO STATE to ensure Turn 2 (YES) finds 
everything 
          service: minimalPlan.campaign_name, 
          location: extractedLocation, 
          landing_page: extractedWebsite, 
          landing_page_confirmed: true, 
          location_confirmed: true, 
          service_confirmed: true, 
          locked_at: new Date().toISOString(), 
        }; 
 
        // SAVE IT! 
        console.log("
💾
 Persisting text-based fallback plan to 
memory..."); 
        await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, 
effectiveBusinessId, { 
          campaign_state: newState 
        }, session.user.email.toLowerCase()); 
 
        // Update local state and mode to ensure current turn response 
reflects the change 
        lockedCampaignState = newState; 
        mode = "meta_ads_plan"; 
        console.log("
✅
 Fallback Plan Persisted Successfully."); 
      } 
    } 
 
 
    // ============================================================ 
    // 
�
�
 STATE MACHINE: EXECUTION FLOW (Plan -> Image -> Launch) 
    // ============================================================ 
 
    // 
�
�
 GUARD: If user says YES (or force_continue) but we have no 
state, warn them. 
    // This prevents the "Generic Agent Response" fallback which 
confuses the user. 
    const isConfirmation = 
      instruction.toLowerCase().includes("yes") || 
      instruction.toLowerCase().includes("approve") || 
      instruction.toLowerCase().includes("confirm") || 
      body.force_continue; 
 
    if (!lockedCampaignState && isConfirmation && mode === 
"meta_ads_plan") { 
      const regeneratedPlan = await generateMetaCampaignPlan({ 
        lockedCampaignState, 
        autoBusinessContext, 
        verifiedMetaAssets, 
        detectedLandingPage, 
        instruction, 
        text 
}); 
const newState = { 
stage: "PLAN_PROPOSED", 
plan: regeneratedPlan, 
locked_at: new Date().toISOString() 
}; 
await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, 
effectiveBusinessId, { 
campaign_state: newState 
}, session.user.email.toLowerCase()); 
lockedCampaignState = newState; 
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
instruction.toLowerCase().includes("image") || 
lockedCampaignState.auto_run; 
// 
�
�
 CONSOLIDATED EXECUTION WATERFALL (Step 9 -> 10 -> 12) 
if (stage !== "COMPLETED" && userSaysYes) { 
// 
�
�
 IDEMPOTENCY PROTECTION: Avoid double-processing if 
request arrives too fast 
const now = Date.now(); 
const lastUpdate = lockedCampaignState.locked_at ? new 
Date(lockedCampaignState.locked_at).getTime() : 0; 
const isTooFast = (now - lastUpdate < 10000); // 10s window 
// We allow "PLAN_PROPOSED" to be re-run, but once it moves to 
Gen/Upload/Launch, we lock it. 
if (isTooFast && (stage === "IMAGE_GENERATED" || stage === 
"READY_TO_LAUNCH" || stage === "EXECUTING")) { 
console.warn(`[IDEMPOTENCY] Blocked duplicate request for 
${effectiveBusinessId} (Stage: ${stage})`); 
return res.status(200).json({ ok: true, mode, text: "I'm 
already working on that! One moment please..." }); 
} 
console.log(`[PROD_LOG] 
�
�
 State Transition Started | User: 
${session.user.email} | ID: ${effectiveBusinessId} | CurrentStage: 
${stage}`); 
let currentState = { ...lockedCampaignState, locked_at: new 
Date().toISOString() }; 
// 
�
�
 DEFENSIVE CHECK: If user says YES but we have no plan, 
FALLBACK TO PLANNING. 
// Rule: NEVER execute without a plan. Implicitly regenerate 
it. 
// 
�
�
 HARD RULE: Never proceed to confirmation/execution 
without a saved plan 
if (!currentState.plan || !currentState.plan.campaign_name) { 
console.warn("
⚠
 Plan missing at confirmation. Recreating 
plan immediately."); 
const regeneratedPlan = await generateMetaCampaignPlan({ 
lockedCampaignState, 
autoBusinessContext, 
verifiedMetaAssets, 
detectedLandingPage, 
instruction, 
text 
}); 
const repairedState = { 
...currentState, 
stage: "PLAN_PROPOSED", 
plan: regeneratedPlan, 
locked_at: new Date().toISOString() 
}; 
await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, 
effectiveBusinessId, { 
campaign_state: repairedState 
}, session.user.email.toLowerCase()); 
currentState = repairedState; 
} 
let waterfallLog = []; 
let errorOcurred = false; 
let stopReason = null; 
// --- STEP 9: IMAGE GENERATION --- 
const hasPlan = !!currentState.plan; 
const hasImage = currentState.creative && 
(currentState.creative.imageBase64 || currentState.creative.imageUrl); 
if (hasPlan && !hasImage) { 
console.log("
🚀
 Waterfall: Starting Image Generation..."); 
const plan = currentState.plan; 
const creativeResult = plan.ad_sets?.[0]?.ad_creative || 
plan.ad_sets?.[0]?.ads?.[0]?.creative || {}; 
          const imagePrompt = creativeResult.image_prompt || 
creativeResult.imagePrompt || creativeResult.primary_text || 
`${plan.campaign_name} ad image`; 
 
          try { 
            const imgRes = await 
fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/images/generate`, { 
              method: "POST", 
              headers: { "Content-Type": "application/json" }, 
              body: JSON.stringify({ prompt: imagePrompt }), 
            }); 
            const imgJson = await parseResponseSafe(imgRes); 
 
            if (imgJson.imageBase64) { 
              const newCreative = { 
                ...creativeResult, 
                imageBase64: imgJson.imageBase64, 
                imageUrl: 
`data:image/png;base64,${imgJson.imageBase64}` 
              }; 
              currentState = { ...currentState, stage: 
"IMAGE_GENERATED", creative: newCreative }; 
              waterfallLog.push("
✅
 Step 9: Image Generated"); 
            } else { 
              errorOcurred = true; 
              stopReason = "Image Generation Failed (No Base64 
returned)"; 
            } 
          } catch (e) { 
            errorOcurred = true; 
            stopReason = `Image Generation Error: ${e.message}`; 
          } 
        } else if (hasImage) { 
          waterfallLog.push("
⏭
 Step 9: Image Already Exists"); 
        } 
 
        // --- STEP 10: IMAGE UPLOAD --- 
        if (!errorOcurred) { 
          const hasImageReady = currentState.creative && 
currentState.creative.imageBase64; 
          const hasHash = currentState.image_hash; 
 
          if (hasImageReady && !hasHash) { 
            console.log("
🚀
 Waterfall: Uploading Image to Meta..."); 
            try { 
              const uploadRes = await 
fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/upload-image`, { 
                method: "POST", 
                headers: { "Content-Type": "application/json", 
"x-client-email": __currentEmail || "" }, 
body: JSON.stringify({ imageBase64: 
currentState.creative.imageBase64 }) 
}); 
const uploadJson = await parseResponseSafe(uploadRes); 
const iHash = uploadJson.imageHash || 
uploadJson.image_hash; 
if (uploadJson.ok && iHash) { 
const iUrl = uploadJson.raw?.images?.[iHash]?.url; 
currentState = { ...currentState, stage: 
"READY_TO_LAUNCH", image_hash: iHash, fb_image_url: iUrl }; 
Meta"); 
waterfallLog.push("
✅
 Step 10: Image Uploaded to 
} else { 
errorOcurred = true; 
stopReason = `Meta Upload Failed: ${uploadJson.message 
|| "Unknown error"}`; 
} 
} catch (e) { 
errorOcurred = true; 
stopReason = `Meta Upload Error: ${e.message}`; 
} 
} else if (hasHash) { 
} 
} 
waterfallLog.push("
⏭
 Step 10: Image Already Uploaded"); 
// --- STEP 12: EXECUTION (Final Step) --- 
if (!errorOcurred) { 
const isReady = (currentState.stage === "READY_TO_LAUNCH" || 
currentState.stage === "IMAGE_UPLOADED") && currentState.image_hash; 
// For auto_run, we don't need explicit 'launch' keyword 
const wantsLaunch = 
instruction.toLowerCase().includes("launch") || 
instruction.toLowerCase().includes("execute") || 
instruction.toLowerCase().includes("run") || 
instruction.toLowerCase().includes("publish") || 
instruction.toLowerCase().includes("yes") || 
instruction.toLowerCase().includes("ok") || currentState.auto_run; 
if (isReady && (wantsLaunch || currentState.objective === 
"TRAFFIC")) { 
console.log("
🚀
 Waterfall: Executing Campaign on Meta..."); 
try { 
const plan = currentState.plan; 
const finalPayload = { 
...plan, 
ad_sets: plan.ad_sets.map(adset => ({ 
...adset, 
ad_creative: { ...adset.ad_creative, image_hash: 
currentState.image_hash } 
})) 
}; 
const execRes = await 
fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/meta/execute-campaign`, 
{ 
method: "POST", 
headers: { "Content-Type": "application/json", 
"x-client-email": __currentEmail || "" }, 
body: JSON.stringify({ platform: "meta", payload: 
finalPayload }) 
}); 
const execJson = await execRes.json(); 
if (execJson.ok) { 
await 
saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, effectiveBusinessId, 
{ 
campaign_state: { stage: "COMPLETED", final_result: 
execJson } 
}); 
return res.status(200).json({ 
ok: true, 
text: `
🎉
 **Campaign Published 
Successfully!**\n\n**Pipeline Status**:\n${waterfallLog.join("\n")}\n
✅
 
Step 12: Campaign Created (PAUSED)\n\n**Meta Details**:\n- **Campaign 
Name**: ${plan.campaign_name}\n- **Campaign ID**: \`${execJson.id || 
"N/A"}\`\n- **Ad Account ID**: \`${verifiedMetaAssets?.ad_account?.id 
|| "N/A"}\`\n- **Status**: PAUSED\n\nYour campaign is now waiting in 
your Meta Ads Manager for final review.` 
}); 
} else { 
errorOcurred = true; 
stopReason = `Meta Execution Failed: ${execJson.message 
|| "Unknown error"}`; 
} 
} catch (e) { 
errorOcurred = true; 
stopReason = `Meta Execution Error: ${e.message}`; 
} 
} 
} 
// Save progress reached 
console.log(`[PROD_LOG] 
✅
 State Transition Finished | ID: 
${effectiveBusinessId} | FinalStage: ${currentState.stage}`); 
await saveAnswerMemory(process.env.NEXT_PUBLIC_BASE_URL, 
effectiveBusinessId, { campaign_state: currentState }, 
session.user.email.toLowerCase()); 
// If we stopped due to error or waiting 
let feedbackText = ""; 
if (errorOcurred) { 
feedbackText = `
❌
 **Automation Interrupted**:\n\n**Error**: 
${stopReason}\n\n**Pipeline 
Progress**:\n${waterfallLog.join("\n")}\n\nI've saved the progress so 
far. Please check the error above and reply to try again.`; 
} else if (currentState.stage === "IMAGE_GENERATED") { 
feedbackText = `
✅
 **Image Generated Successfully**\n\n[Image 
Generated]\n\n**Next Steps**:\n1. Upload image to Meta Assets\n2. 
Create paused campaign on Facebook/Instagram\n\nReply **LAUNCH** to 
complete these steps automatically.`; 
} else if (currentState.stage === "READY_TO_LAUNCH") { 
feedbackText = `
✅
 **Image Uploaded & Ready**\n\nEverything 
is set for campaign launch.\n\n**Details**:\n- Campaign: 
${currentState.plan.campaign_name}\n- Budget: 
${currentState.plan.budget?.amount || "500"} INR\n\nReply **LAUNCH** to 
publish the campaign to Meta.`; 
} else { 
feedbackText = `**Current Pipeline 
Progress**:\n${waterfallLog.join("\n") || "No steps completed in this 
turn."}\n\n(Debug: Stage=${currentState.stage}, 
Plan=${currentState.plan ? "Yes" : "No"})\n\nWaiting for your 
confirmation...`; 
} 
return res.status(200).json({ ok: true, text: feedbackText, 
imageUrl: currentState.creative?.imageUrl, mode }); 
} 
// =============================== 
// 
�
�
 STEP-1 / STEP-2 NORMAL AGENT RESPONSE 
// =============================== 
return res.status(200).json({ 
ok: true, 
text, 
mode, 
}); 
} // End of if (lockedCampaignState) 
} catch (err) { 
console.error("Agent execution error:", err); 
return res.status(500).json({ 
ok: false, 
message: "Server error in /api/agent/execute", 
error: err.message || String(err), 
}); 
} 
} 
 
 
 
 
 
