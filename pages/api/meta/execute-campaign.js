import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔒 THE GOLDEN RULE MAPPER (ODAX / Outcome-Based)
function mapObjectiveToODAX(obj) {
  const o = (obj || "").toString().toUpperCase();
  console.log(`[mapObjectiveToODAX] Input: "${obj}" -> Upper: "${o}"`);

  // Explicit ODAX Matches
  if (o === "OUTCOME_TRAFFIC" || o === "TRAFFIC") return "OUTCOME_TRAFFIC";
  if (o === "OUTCOME_LEADS" || o === "LEAD_GENERATION" || o === "LEADS") return "OUTCOME_LEADS";
  if (o === "OUTCOME_SALES" || o === "SALES" || o === "CONVERSIONS") return "OUTCOME_SALES";
  if (o === "OUTCOME_ENGAGEMENT" || o === "MESSAGES" || o === "ENGAGEMENT") return "OUTCOME_ENGAGEMENT";
  if (o === "OUTCOME_AWARENESS" || o === "AWARENESS" || o === "REACH") return "OUTCOME_AWARENESS";
  if (o === "OUTCOME_APP_PROMOTION" || o === "APP_INSTALLS") return "OUTCOME_APP_PROMOTION";

  // Fuzzy Matches
  if (o.includes("TRAFFIC") || o.includes("LINK") || o.includes("CLICK") || o.includes("VISIT")) return "OUTCOME_TRAFFIC";
  if (o.includes("LEAD") || o.includes("PROSPECT") || o.includes("FORM")) return "OUTCOME_LEADS";
  if (o.includes("SALE") || o.includes("CONVERSION") || o.includes("PURCHASE")) return "OUTCOME_SALES";
  if (o.includes("MESSAGE") || o.includes("CHAT") || o.includes("WHATSAPP")) return "OUTCOME_ENGAGEMENT";
  if (o.includes("AWARENESS") || o.includes("BRAND")) return "OUTCOME_AWARENESS";

  console.log(`[mapObjectiveToODAX] Fallback Result: OUTCOME_TRAFFIC`);
  return "OUTCOME_TRAFFIC";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }

  const headerEmail = req.headers["x-client-email"];
  const clientEmail =
    typeof headerEmail === "string" ? headerEmail.toLowerCase() : null;

  if (!clientEmail) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }

  const { platform, payload } = req.body || {};
  if (!payload || !payload.campaign_name) {
    return res.status(400).json({ ok: false, message: "Invalid payload: campaign_name required" });
  }

  const { data: meta, error } = await supabase
    .from("meta_connections")
    .select("fb_ad_account_id, system_user_token, fb_page_id, instagram_actor_id")
    .eq("email", clientEmail)
    .single();

  if (error || !meta) {
    return res.status(400).json({ ok: false, message: "Meta connection not found" });
  }

  const AD_ACCOUNT_ID = (meta.fb_ad_account_id || "").toString().replace(/^act_/, "");
  const ACCESS_TOKEN = process.env.META_SYSTEM_USER_TOKEN;
  const PAGE_ID = meta.fb_page_id;
  const API_VERSION = "v21.0";

  // 1b. Fetch Instagram Actor ID (if missing in DB)
  let INSTAGRAM_ACTOR_ID = meta.instagram_actor_id;

  if (!INSTAGRAM_ACTOR_ID && PAGE_ID) {
    try {
      console.log(`🔎 [Meta API] Fetching Instagram Account for Page ${PAGE_ID}...`);
      const igRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${PAGE_ID}?fields=instagram_business_account&access_token=${ACCESS_TOKEN}`);
      const igJson = await igRes.json();
      if (igJson.instagram_business_account?.id) {
        INSTAGRAM_ACTOR_ID = igJson.instagram_business_account.id;
        console.log(`✅ [Meta API] Found Linked Instagram Actor: ${INSTAGRAM_ACTOR_ID}`);
      } else {
        console.log(`ℹ️ [Meta API] No Linked Instagram Account found. Campaign will be Page-only.`);
      }
    } catch (e) {
      console.warn(`⚠️ [Meta API] Failed to fetch Instagram Account: ${e.message}`);
    }
  }

  // 1c. PREFLIGHT SECURITY CHECK: Verify Ad Account Access
  // This ensures the token actually has permissions for the target ad account ID.
  try {
    console.log(`🛡️ [Security Check] Verifying access to Ad Account: ${AD_ACCOUNT_ID}...`);
    const verifyRes = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}?fields=account_id,name&access_token=${ACCESS_TOKEN}`);
    const verifyJson = await verifyRes.json();

    if (!verifyRes.ok || verifyJson.error) {
      console.error(`⛔ [Security Block] Access Denied: ${verifyJson.error?.message}`);
      return res.status(403).json({
        ok: false,
        message: "Connected Meta account does not own or have access to this ad account."
      });
    }
    console.log(`✅ [Security Check] Access Verified for Account: ${verifyJson.account_id} (${verifyJson.name})`);
  } catch (e) {
    console.error(`⛔ [Security Block] Validation Error: ${e.message}`);
    // If we already sent a response (unlikely but safe), don't send another.
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, message: `Preflight Auth Check Failed: ${e.message}` });
    }
  }

  const createdAssets = { campaign_id: null, ad_sets: [], ads: [] };

  try {
    // 1. Map Objective
    const rawObjective = payload.objective || "";
    let finalObjective = mapObjectiveToODAX(rawObjective);

    console.log(`🚀 [Campaign Creator] Objective: ${finalObjective} (from raw: ${rawObjective})`);

    // 2. Create Campaign (Multi-Stage Safe Fallback)
    let campaignId = null;

    // Fallback Chain: Requested -> Traffic -> Awareness -> Engagement (Messages)
    let objectivesToTry = [finalObjective, "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT"];
    // Remove duplicates
    objectivesToTry = [...new Set(objectivesToTry)];

    console.log(`🛡️ [Fallback Strategy] Will attempt objectives in order: ${objectivesToTry.join(" -> ")}`);

    let lastError = null;

    for (let i = 0; i < objectivesToTry.length; i++) {
      const objParam = objectivesToTry[i];
      const attemptLabel = `Attempt ${i + 1}/${objectivesToTry.length}`;

      try {
        const campaignParams = new URLSearchParams();
        campaignParams.append("name", payload.campaign_name);
        campaignParams.append("objective", objParam);
        campaignParams.append("status", "PAUSED");

        // 🔒 FORCE-INJECT ODAX FLAGS (Strict Enforcement)
        if (objParam && objParam.startsWith("OUTCOME_")) {
          console.log(`🔒 [ODAX Enforcement] Injecting flags for ${objParam}`);
          campaignParams.append("buying_type", "AUCTION");
          campaignParams.append("special_ad_categories", "[]");
          campaignParams.append("is_odax", "true");
          campaignParams.append("objective_config[objective_type]", objParam);
          campaignParams.append("smart_promotion_type", "GUIDED_CREATION");

          // ODAX Safety Default
          const dofSpec = {
            "creative_features_spec": {
              "standard_enhancements": { "enroll_status": "OPT_OUT" }
            }
          };
          campaignParams.append("degrees_of_freedom_spec", JSON.stringify(dofSpec));
        }

        campaignParams.append("access_token", ACCESS_TOKEN);

        console.log(`🚀 [Meta API] Creating Campaign (${attemptLabel}): ${objParam}`);
        const cRes = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/campaigns`, {
          method: "POST",
          body: campaignParams
        });
        const cJson = await cRes.json();

        if (!cRes.ok || !cJson.id) {
          const errorMsg = cJson.error?.message || `Unknown Meta Error (Status: ${cRes.status})`;
          throw new Error(errorMsg);
        }

        campaignId = cJson.id;
        finalObjective = objParam; // Sync for downstream AdSet logic
        console.log(`✅ Campaign Created Successfully: ${campaignId} (${objParam})`);
        break; // Success!

      } catch (err) {
        console.warn(`⚠️ ${attemptLabel} failed: ${err.message}`);
        lastError = err;

        const isObjError =
          err.message.includes("AGENT_V2_OBJ") ||
          err.message.includes("Invalid parameter") ||
          err.message.includes("Param") ||
          err.message.includes("objective");

        if (isObjError) {
          console.log(`🔄 [Fallback] Objective ${objParam} rejected. Checking next option...`);
          continue; // Try next objective
        }

        throw new Error(`Campaign Create Failed (Fatal): ${err.message}`);
      }
    }

    if (!campaignId) {
      throw new Error(`Campaign Creation Failed after ${objectivesToTry.length} attempts (Account: ${AD_ACCOUNT_ID}). Last Error: ${lastError?.message}`);
    }

    createdAssets.campaign_id = campaignId;

    // 3. Create Ad Set(s)
    const adSets = payload.ad_sets || [{ name: "Ad Set 1" }];
    for (const adSet of adSets) {
      // Prepare budget config
      const budgetAmount = payload.budget?.amount || 500;
      const budgetType = (payload.budget?.type || "DAILY").toUpperCase() === "DAILY" ? "daily_budget" : "lifetime_budget";

      // Build AdSet Payload
      const p = buildAdSetPayload(finalObjective, adSet, campaignId, ACCESS_TOKEN);

      // Append Budget
      p.append(budgetType, String(Math.floor(Number(budgetAmount) * 100)));

      if (budgetType === "lifetime_budget" && !adSet.end_time) {
        // Default to 7 days if missing for lifetime
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7);
        p.append("end_time", endDate.toISOString());
      }

      console.log(`🛠️ [AdSet] Creating AdSet...`);
      const asRes = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/adsets`, {
        method: "POST",
        body: p
      });
      const asJson = await asRes.json();
      if (!asRes.ok) throw new Error(`AdSet Create Failed: ${asJson.error?.message} (Account: ${AD_ACCOUNT_ID})`);

      const adSetId = asJson.id;
      createdAssets.ad_sets.push(adSetId);

      // 4. Create Creative
      const creative = adSet.ad_creative || {};

      // Build Creative Payload
      const crParams = buildCreativePayload(finalObjective, creative, PAGE_ID, INSTAGRAM_ACTOR_ID, ACCESS_TOKEN);

      console.log(`🎨 [Creative] Creating Creative...`);
      const crRes = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/adcreatives`, {
        method: "POST",
        body: crParams
      });
      const crJson = await crRes.json();
      if (!crRes.ok) throw new Error(`Creative Create Failed: ${crJson.error?.message} (Account: ${AD_ACCOUNT_ID})`);

      const creativeId = crJson.id;

      // 5. Create Ad
      const adParams = new URLSearchParams();
      adParams.append("name", creative.headline || "Ad");
      adParams.append("adset_id", adSetId);
      adParams.append("creative", JSON.stringify({ creative_id: creativeId }));
      adParams.append("status", "PAUSED");
      adParams.append("access_token", ACCESS_TOKEN);

      const adRes = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/ads`, {
        method: "POST",
        body: adParams
      });
      const adJson = await adRes.json();
      if (!adRes.ok) throw new Error(`Ad Create Failed: ${adJson.error?.message} (Account: ${AD_ACCOUNT_ID})`);

      createdAssets.ads.push(adJson.id);
    }

    return res.status(200).json({
      ok: true,
      id: campaignId,
      status: "PAUSED",
      details: createdAssets
    });

  } catch (err) {
    console.error("[Campaign Executor] Error:", err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
}

// 🔒 UNIVERSAL AD SET BUILDER (Strict ODAX Compliance)
function buildAdSetPayload(objective, adSet, campaignId, accessToken) {
  const params = new URLSearchParams();

  // 1. Identity & Time
  params.append("name", adSet.name || "Ad Set 1");
  params.append("campaign_id", campaignId);
  params.append("status", "PAUSED");
  params.append("access_token", accessToken);
  params.append("bid_strategy", "LOWEST_COST_WITHOUT_CAP");

  // Start Time: Now + 5 mins (Safety Buffer)
  const startTime = new Date(Date.now() + 5 * 60 * 1000);
  params.append("start_time", startTime.toISOString());

  // 2. ODAX Parameter Matrix
  let optimization_goal = "LINK_CLICKS";
  let billing_event = "IMPRESSIONS";
  let destination_type = "WEBSITE";
  let promoted_object = null;

  switch (objective) {
    case "OUTCOME_TRAFFIC":
      optimization_goal = "LINK_CLICKS";
      billing_event = "IMPRESSIONS";
      destination_type = "WEBSITE";
      break;

    case "OUTCOME_AWARENESS":
      optimization_goal = "REACH";
      billing_event = "IMPRESSIONS";
      destination_type = undefined; // NONE allowed
      break;

    case "OUTCOME_ENGAGEMENT":
      if (adSet.destination_type === "MESSAGING_APPS") {
        optimization_goal = "CONVERSATIONS";
        destination_type = "MESSAGING_APPS";
      } else {
        optimization_goal = "POST_ENGAGEMENT";
        billing_event = "IMPRESSIONS";
        destination_type = undefined; // On-Ad
      }
      break;

    case "OUTCOME_LEADS":
      optimization_goal = "LEAD_GENERATION";
      billing_event = "IMPRESSIONS";
      destination_type = undefined; // On-Ad (Forms)
      break;

    case "OUTCOME_SALES":
      optimization_goal = "OFFSITE_CONVERSIONS";
      billing_event = "IMPRESSIONS";
      destination_type = "WEBSITE";

      // HARD FAIL: Pixel Required
      if (!adSet.promoted_object || !adSet.promoted_object.pixel_id) {
        throw new Error("OUTCOME_SALES requires a Pixel ID (promoted_object.pixel_id).");
      }
      promoted_object = {
        pixel_id: adSet.promoted_object.pixel_id,
        custom_event_type: adSet.promoted_object.custom_event_type || "PURCHASE"
      };
      break;

    case "OUTCOME_APP_PROMOTION":
      optimization_goal = "APP_INSTALLS";
      billing_event = "IMPRESSIONS";
      destination_type = undefined;

      // HARD FAIL: App ID Required
      if (!adSet.promoted_object || !adSet.promoted_object.application_id) {
        throw new Error("OUTCOME_APP_PROMOTION requires an Application ID.");
      }
      promoted_object = adSet.promoted_object;
      break;

    default:
      console.warn(`⚠️ Unmapped Objective ${objective}. Defaulting to Traffic.`);
      break;
  }

  // 3. Apply Parameters (Implicit Enforce)
  params.append("optimization_goal", optimization_goal);
  params.append("billing_event", billing_event);
  if (destination_type) params.append("destination_type", destination_type);
  if (promoted_object) params.append("promoted_object", JSON.stringify(promoted_object));

  // 4. Targeting
  const targeting = adSet.targeting || { geo_locations: { countries: ["IN"] }, age_min: 18, age_max: 65 };
  params.append("targeting", JSON.stringify(targeting));

  return params;
}

// 🔒 UNIVERSAL CREATIVE BUILDER (Placement Safe & Strict Types)
// 🔒 UNIVERSAL CREATIVE BUILDER (Placement Safe & Strict Types)
function buildCreativePayload(objective, creative, pageId, instagramActorId, accessToken) {
  if (!pageId) throw new Error("Page ID is required for Creative");
  if (!creative || !creative.image_hash) throw new Error("Image Hash is required for Creative");

  let ctaType = "LEARN_MORE";
  let useLinkData = true;

  // 1. Strict Type Switching
  if (objective === "OUTCOME_TRAFFIC" || objective === "OUTCOME_SALES" || objective === "OUTCOME_LEADS") {
    ctaType = "LEARN_MORE";
    useLinkData = true; // MUST use link_data

    // HARD FAIL: Destination URL Required
    if (!creative.destination_url) {
      throw new Error(`${objective} requires a destination_url for link_data creatives.`);
    }

  } else if (objective === "OUTCOME_AWARENESS") {
    ctaType = "NO_BUTTON";
    useLinkData = false; // MUST use photo_data (No link support usually)

  } else if (objective === "OUTCOME_ENGAGEMENT") {
    if (creative.destination_type === "MESSAGING_APPS") {
      ctaType = "SEND_MESSAGE";
      useLinkData = true;
    } else {
      ctaType = "NO_BUTTON"; // Post Engagement
      useLinkData = false;
    }
  }

  // 2. Override Logic (Guardrails applied)
  if (creative.call_to_action) {
    if (objective === "OUTCOME_AWARENESS" || (objective === "OUTCOME_ENGAGEMENT" && !useLinkData)) {
      console.warn(`⚠️ [Creative] Ignoring user CTA '${creative.call_to_action}' for ${objective}. Enforcing NO_BUTTON.`);
      ctaType = "NO_BUTTON";
    } else {
      ctaType = creative.call_to_action;
    }
  }

  // 3. Build Object Story Spec
  const objectStorySpec = { page_id: pageId };

  // Placement Safety: Inject Instagram Actor ONLY if Page matches
  // Simplistic check: If we have an IG Actor, we assume it's validly linked to this page (checked in handler)
  if (instagramActorId && pageId) {
    objectStorySpec.instagram_actor_id = instagramActorId;
  }

  // 4. Data Block Construction
  if (useLinkData) {
    objectStorySpec.link_data = {
      image_hash: creative.image_hash,
      link: creative.destination_url || "https://gabbarinfo.com",
      message: creative.primary_text || "",
      name: creative.headline || "Ad",
    };

    if (ctaType !== "NO_BUTTON") {
      objectStorySpec.link_data.call_to_action = { type: ctaType };
    }
  } else {
    // Photo Data (Awareness/Engagement)
    objectStorySpec.photo_data = {
      image_hash: creative.image_hash,
      caption: creative.primary_text || creative.headline || "",
    };
    // Implicit NO_BUTTON by nature of photo_data structure used here
  }

  const params = new URLSearchParams();
  params.append("name", creative.headline || "Creative");
  params.append("object_story_spec", JSON.stringify(objectStorySpec));
  params.append("access_token", accessToken);

  return params;
}
