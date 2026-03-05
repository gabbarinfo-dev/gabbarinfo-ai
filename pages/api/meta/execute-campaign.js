// pages/api/meta/execute-campaign.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
function normalizePhoneNumber(number) {
  if (!number) return null;

  const cleaned = number.replace(/\D/g, "");

  // Force India country code with +
  if (cleaned.startsWith("91")) {
    return "+" + cleaned;
  }

  // If number is 10 digits, assume India
  if (cleaned.length === 10) {
    return "+91" + cleaned;
  }

  return "+" + cleaned;
}
// THE GOLDEN RULE MAPPER (ODAX / Outcome-Based) 
function mapObjectiveToODAX(obj) {
  const o = (obj || "").toString().toUpperCase();
  console.log(`[mapObjectiveToODAX] Input: "${obj}" -> Upper: "${o}"`);

  // Explicit ODAX Matches 
  if (o === "OUTCOME_TRAFFIC" || o === "TRAFFIC") return "OUTCOME_TRAFFIC";
  if (o === "OUTCOME_LEADS" || o === "LEAD_GENERATION" || o ===
    "LEADS") return "OUTCOME_LEADS";
  if (o === "OUTCOME_SALES" || o === "SALES" || o === "CONVERSIONS")
    return "OUTCOME_SALES";
  if (o === "OUTCOME_ENGAGEMENT" || o === "MESSAGES" || o ===
    "ENGAGEMENT") return "OUTCOME_ENGAGEMENT";
  if (o === "OUTCOME_AWARENESS" || o === "AWARENESS" || o === "REACH")
    return "OUTCOME_AWARENESS";
  if (o === "OUTCOME_APP_PROMOTION" || o === "APP_INSTALLS") return
  "OUTCOME_APP_PROMOTION";

  // Fuzzy Matches 
  if (o.includes("TRAFFIC") || o.includes("LINK") ||
    o.includes("CLICK") || o.includes("VISIT")) return "OUTCOME_TRAFFIC";
  if (o.includes("LEAD") || o.includes("PROSPECT") ||
    o.includes("FORM")) return "OUTCOME_LEADS";
  if (o.includes("SALE") || o.includes("CONVERSION") ||
    o.includes("PURCHASE")) return "OUTCOME_SALES";
  if (o.includes("MESSAGE") || o.includes("CHAT") ||
    o.includes("WHATSAPP")) return "OUTCOME_ENGAGEMENT";
  if (o.includes("AWARENESS") || o.includes("BRAND")) return
  "OUTCOME_AWARENESS";

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
    return res.status(401).json({
      ok: false, message: "Unauthorized"
    });
  }

  const { platform, payload } = req.body || {};
  console.log("🔥 FINAL PAYLOAD RECEIVED:", JSON.stringify(payload, null, 2));
  console.log("🔥 FINAL conversion_location:", payload.conversion_location);
  if (!payload || !payload.campaign_name) {
    return res.status(400).json({ ok: false, message: "Invalid payload: campaign_name required" });
  }

  let placements = [];

  if (Array.isArray(platform)) {
    placements = platform;
  } else if (typeof platform === "string") {
    placements = [platform];
  }

  // 🔥 Sanitize allowed values only
  placements = placements.filter(p =>
    ["facebook", "instagram", "messenger", "audience_network"].includes(p)
  );

  // Default fallback
  if (placements.length === 0) {
    placements = ["facebook"];
  }

  console.log("✅ FINAL SANITIZED PLACEMENTS:", placements);

  const { data: meta, error } = await supabase
    .from("meta_connections")
    .select("fb_ad_account_id, fb_page_id, ig_business_id, instagram_actor_id, business_website, business_phone, fb_user_access_token, fb_pixel_id")
    .eq("email", clientEmail)
    .single();

  if (error || !meta) {
    return res.status(400).json({ ok: false, message: "Meta connection not found" });
  }

  const AD_ACCOUNT_ID = (meta.fb_ad_account_id ||
    "").toString().replace(/^act_/, "");
  const ACCESS_TOKEN = meta.fb_user_access_token;

  if (!ACCESS_TOKEN) {
    return res.status(400).json({
      ok: false,
      message: "Missing Facebook user access token"
    });
  }
  const PAGE_ID = meta.fb_page_id;
  const API_VERSION = "v21.0";

  // 1b. Identity Identification 
  let validatedInstagramActorId = null;
  const storedActorId = meta.instagram_actor_id;

  if (storedActorId) {
    try {
      console.log(`
🔎
 [Meta API] Checking if Ad Account 
act_${AD_ACCOUNT_ID} is authorized for Instagram Actor 
${storedActorId}...`);
      const igAuthRes = await
        fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/i
nstagram_accounts?access_token=${ACCESS_TOKEN}`);
      const igAuthJson = await igAuthRes.json();

      const isAuthorized = igAuthJson?.data?.some(acc => acc.id ===
        storedActorId);

      if (isAuthorized) {
        validatedInstagramActorId = storedActorId;
        console.log(`
✅
 [Meta API] Instagram Actor ${storedActorId} is 
authorized for this Ad Account.`);
      } else {
        console.warn(`
⚠
 [Meta API] Actor ${storedActorId} NOT 
authorized for Ad Account act_${AD_ACCOUNT_ID}. Removing instagram from 
placements.`);
        // Remove instagram from placements if IG actor isn't authorized
        placements = placements.filter(p => p !== "instagram");
        if (placements.length === 0) placements = ["facebook"];
      }
    } catch (e) {
      console.error(`
⚠
 [Meta API] Instagram Authorization check 
failed: ${e.message}`);
    }
  }

  // 2⃣ Compute final Instagram usage flag 
  const shouldUseInstagramActor =
    validatedInstagramActorId &&
    placements.includes("instagram");

  // 1c. PREFLIGHT SECURITY CHECK: Verify Ad Account Access 
  // This ensures the token actually has permissions for the target ad account ID. 
  try {
    console.log(`
🛡
 [Security Check] Verifying access to Ad Account: 
${AD_ACCOUNT_ID}...`);
    const verifyRes = await
      fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}?f
ields=account_id,name&access_token=${ACCESS_TOKEN}`);
    const verifyJson = await verifyRes.json();

    if (!verifyRes.ok || verifyJson.error) {
      console.error(`
⛔
 [Security Block] Access Denied: 
${verifyJson.error?.message}`);
      return res.status(403).json({
        ok: false,
        message: "Connected Meta account does not own or have access to this ad account."
      });
    }
    console.log(`
✅
 [Security Check] Access Verified for Account: 
${verifyJson.account_id} (${verifyJson.name})`);
  } catch (e) {
    console.error(`
⛔
 [Security Block] Validation Error: 
${e.message}`);
    // If we already sent a response (unlikely but safe), don't send another.
    if (!res.headersSent) {
      return res.status(500).json({
        ok: false, message: `Preflight Auth 
Check Failed: ${e.message}`
      });
    }
  }

  const createdAssets = { campaign_id: null, ad_sets: [], ads: [] };

  try {
    // 1. Map Objective 
    const rawObjective = payload.objective || "";
    let finalObjective = mapObjectiveToODAX(rawObjective);
    // FIX: LEADS + CALLS is not allowed under ODAX
    if (
      finalObjective === "OUTCOME_LEADS" &&
      (payload.conversion_location || "").toUpperCase() === "CALLS"
    ) {
      finalObjective = "OUTCOME_TRAFFIC";
    }

    // FIX: TRAFFIC + MESSAGES must use ENGAGEMENT objective
    if (
      finalObjective === "OUTCOME_TRAFFIC" &&
      (
        (payload.conversion_location || "").toUpperCase() === "MESSAGES" ||
        (payload.conversion_location || "").toUpperCase() === "MESSAGING_APPS" ||
        (payload.conversion_location || "").toUpperCase() === "WHATSAPP"
      )
    ) {
      finalObjective = "OUTCOME_ENGAGEMENT";
    }

    // NEW FIX: LEADS + WHATSAPP is not allowed under ODAX
    if (
      finalObjective === "OUTCOME_LEADS" &&
      (payload.conversion_location || "").toUpperCase() === "WHATSAPP"
    ) {
      console.log("🔄 Re-mapping LEADS + WHATSAPP to OUTCOME_ENGAGEMENT for ODAX compliance");
      finalObjective = "OUTCOME_ENGAGEMENT";
    }
    console.log(`
🚀
 [Campaign Creator] Objective: ${finalObjective} 
(from raw: ${rawObjective})`);

    // 2. Create Campaign (Multi-Stage Safe Fallback) 
    let campaignId = null;

    // Fallback Chain: Requested -> Traffic -> Awareness -> Engagement 
    let objectivesToTry = [finalObjective, "OUTCOME_TRAFFIC",
      "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT"];
    // Remove duplicates 
    objectivesToTry = [...new Set(objectivesToTry)];

    console.log(`
🛡
 [Fallback Strategy] Will attempt objectives in 
order: ${objectivesToTry.join(" -> ")}`);

    let lastError = null;

    for (let i = 0; i < objectivesToTry.length; i++) {
      const objParam = objectivesToTry[i];
      const attemptLabel = `Attempt ${i +
        1}/${objectivesToTry.length}`;

      try {
        const campaignParams = new URLSearchParams();
        campaignParams.append("name", payload.campaign_name);
        campaignParams.append("objective", objParam);
        campaignParams.append("status", "ACTIVE");

        // FORCE-INJECT ODAX FLAGS (Strict Enforcement)
        if (objParam && objParam.startsWith("OUTCOME_")) {
          console.log(`
🔒
 [ODAX Enforcement] Injecting flags for 
${objParam}`);
          campaignParams.append("buying_type", "AUCTION");
          campaignParams.append("special_ad_categories", "[]");
          campaignParams.append("is_odax", "true");
          campaignParams.append("objective_config[objective_type]",
            objParam);
          campaignParams.append("smart_promotion_type",
            "GUIDED_CREATION");

          // ODAX Safety Default 
          const dofSpec = {
            "creative_features_spec": {
              "standard_enhancements": { "enroll_status": "OPT_OUT" }
            }
          };
          campaignParams.append("degrees_of_freedom_spec",
            JSON.stringify(dofSpec));
        }

        campaignParams.append("access_token", ACCESS_TOKEN);

        console.log(`
🚀
 [Meta API] Creating Campaign (${attemptLabel}): 
${objParam}`);
        const cRes = await
          fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/c
ampaigns`, {
            method: "POST",
            body: campaignParams
          });
        const cJson = await cRes.json();

        if (!cRes.ok || !cJson.id) {
          const errorMsg = cJson.error?.message || `Unknown Meta Error 
(Status: ${cRes.status})`;
          throw new Error(errorMsg);
        }

        campaignId = cJson.id;
        finalObjective = objParam; // Sync for downstream AdSet logic 
        console.log(`
✅
 Campaign Created Successfully: ${campaignId} 
(${objParam})`);
        break; // Success! 

      } catch (err) {
        console.warn(`
⚠
 ${attemptLabel} failed: ${err.message}`);
        lastError = err;

        const isObjError =
          err.message.includes("AGENT_V2_OBJ") ||
          err.message.includes("Invalid parameter") ||
          err.message.includes("Param") ||
          err.message.includes("objective") ||
          err.message.includes("Messages is not defined");

        if (isObjError) {
          console.log(`
🔄
 [Fallback] Objective ${objParam} rejected. 
Checking next option...`);
          continue; // Try next objective 
        }

        throw new Error(`Campaign Create Failed (Fatal): 
${err.message}`);
      }
    }

    if (!campaignId) {
      throw new Error(`Campaign Creation Failed after 
${objectivesToTry.length} attempts (Account: ${AD_ACCOUNT_ID}). Last 
Error: ${lastError?.message}`);
    }

    createdAssets.campaign_id = campaignId;
    // --- PIXEL DISCOVERY START ---
    let activePixelId = meta.fb_pixel_id;

    // If it's a Sales campaign and we don't have a Pixel ID, find it automatically
    if (!activePixelId && finalObjective === "OUTCOME_SALES") {
      activePixelId = await getAutoPixelId(AD_ACCOUNT_ID, ACCESS_TOKEN, API_VERSION);

      // Save it to Supabase so we have it for next time
      if (activePixelId) {
        await supabase
          .from("meta_connections")
          .update({ fb_pixel_id: activePixelId })
          .eq("email", clientEmail);
      }
    }
    // --- PIXEL DISCOVERY END ---
    // 3. Create Ad Set(s) 
    const adSets = payload.ad_sets || [{ name: "Ad Set 1" }];
    for (const adSet of adSets) {
      // Prepare budget config 
      const budgetAmount = payload.budget?.amount || 500;
      const budgetType = (payload.budget?.type ||
        "DAILY").toUpperCase() === "DAILY" ? "daily_budget" :
        "lifetime_budget";

      // Build AdSet Payload 
      adSet.conversion_location = payload.conversion_location;
      adSet.message_channel = payload.message_channel;
      adSet.phone_number = payload.phone_number || meta.business_phone;
      const p = await buildAdSetPayload(finalObjective, adSet, campaignId, ACCESS_TOKEN, placements, PAGE_ID, activePixelId, payload);

      // Append Budget 
      p.append(budgetType, String(Math.floor(Number(budgetAmount) *
        100)));

      if (budgetType === "lifetime_budget" && !adSet.end_time) {
        // Default to 7 days if missing for lifetime 
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7);
        p.append("end_time", endDate.toISOString());
      }

      console.log(`📋 [AdSet] Full params being sent:`, p.toString());
      const asRes = await
        fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/a
dsets`, {
          method: "POST",
          body: p
        });
      const asJson = await asRes.json();
      if (!asRes.ok) {
        const errDetail = asJson.error || {};
        console.error(`❌ [AdSet] Full Meta Error:`, JSON.stringify(asJson.error, null, 2));
        throw new Error(`AdSet Create Failed: ${errDetail.message || 'Unknown'} | SubCode: ${errDetail.error_subcode || 'N/A'} | Detail: ${errDetail.error_user_msg || errDetail.error_user_title || 'N/A'} (Account: ${AD_ACCOUNT_ID})`);
      }
      // 4. Create Creative with Fallbacks
      const creative = adSet.ad_creative || {};

      // Website Destination URL Resolution (Strict - Website Only)
      const isWebsiteConversion = adSet.destination_type === "WEBSITE"
        || payload.conversion_location === "WEBSITE";
      const requiresDestinationUrl =
        isWebsiteConversion &&
        (finalObjective === "OUTCOME_TRAFFIC" ||
          finalObjective === "OUTCOME_SALES" ||
          finalObjective === "OUTCOME_LEADS");

      if (requiresDestinationUrl) {
        creative.destination_url =
          creative.landing_page_url ||
          creative.destination_url ||
          payload.landing_page_url ||
          payload.website ||
          meta.business_website;

        if (!creative.destination_url) {
          throw new Error("Please provide a website or landing page for website traffic campaigns.");
        }
      }
      const fallbackStrategies = [
        {
          name: "Primary", placements: placements, igActor:
            shouldUseInstagramActor ? validatedInstagramActorId : null, forcePhoto:
            false
        },
        {
          name: "Fallback 1 (No Actor)", placements: placements,
          igActor: null, forcePhoto: false
        },
        {
          name: "Fallback 2 (FB Only)", placements: ["facebook"],
          igActor: null, forcePhoto: false
        }
      ];

      // Special Awareness Fallback 
      if (finalObjective === "OUTCOME_AWARENESS") {
        fallbackStrategies.push({
          name: "Fallback 3 (Photo Only)",
          placements: ["facebook"], igActor: null, forcePhoto: true
        });
      }

      let creativeId = null;
      let lastCreativeError = null;
      let finalAdSetId = asJson.id; // Initialize with the first one  

      // Track AdSets by their placement signature to avoid redundant 

      const adSetsByPlacements = {
        [JSON.stringify(placements)]:
          asJson.id
      };

      for (const strat of fallbackStrategies) {
        try {
          console.log(`
🎨
 [Creative] ${strat.name}: Attempting 
creation...`);

          const platKey = JSON.stringify(strat.placements);
          let currentAdSetId = adSetsByPlacements[platKey];

          // If placements changed and we don't have an AdSet for it, create a NEW one
          if (!currentAdSetId) {
            console.log(`
🛠
 [AdSet] Creating NEW Ad Set for fallback 
with placements ${platKey}...`);
            adSet.conversion_location = payload.conversion_location;
            const p = await buildAdSetPayload(finalObjective, adSet, campaignId, ACCESS_TOKEN, strat.placements, PAGE_ID, activePixelId, payload);
            // Append budget (same as primary AdSet)
            const fbBudgetAmount = payload.budget?.amount || 500;
            const fbBudgetType = (payload.budget?.type || "DAILY").toUpperCase() === "DAILY" ? "daily_budget" : "lifetime_budget";
            p.append(fbBudgetType, String(Math.floor(Number(fbBudgetAmount) * 100)));
            const asRes = await
              fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/a
dsets`, {
                method: "POST",
                body: p
              });
            const asJson = await asRes.json();
            if (!asRes.ok) {
              console.warn(`\n⚠\n [AdSet] New AdSet failed:`, JSON.stringify(asJson.error, null, 2));
              continue; // Skip this strategy if we can't create the 
              AdSet
            }
            currentAdSetId = asJson.id;
            adSetsByPlacements[platKey] = currentAdSetId;
            createdAssets.ad_sets.push(currentAdSetId);
          }

          // Compute creative mode from objective 
          const isMessagingOrCall =
            adSet.destination_type === "MESSAGING_APPS" ||
            ["WHATSAPP", "MESSENGER", "INSTAGRAM_DIRECT",
              "CALLS"].includes(payload.conversion_location);

          const requiresPhotoOnly =
            finalObjective === "OUTCOME_AWARENESS" ||
            (finalObjective === "OUTCOME_ENGAGEMENT" &&
              !isMessagingOrCall);

          // Override creative format BEFORE building payload 
          const finalForcePhoto = strat.forcePhoto ||
            requiresPhotoOnly;

          creative.conversion_location = payload.conversion_location;
          creative.message_channel = payload.message_channel;
          creative.phone_number = payload.phone_number || meta.business_phone;
          const crParams = buildCreativePayload(finalObjective, creative, PAGE_ID, strat.igActor, ACCESS_TOKEN, finalForcePhoto, strat.placements);
          const crRes = await
            fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/a
dcreatives?debug=all`, {
              method: "POST",
              body: crParams
            });
          const crJson = await crRes.json();

          if (crRes.ok && crJson.id) {
            creativeId = crJson.id;
            finalAdSetId = currentAdSetId;
            console.log(`
✅
 [Creative] ${strat.name} Succeeded: 
${creativeId} (AdSet: ${finalAdSetId})`);
            break;
          }
          lastCreativeError = {
            message: crJson.error?.message,
            code: crJson.error?.code,
            subcode: crJson.error?.error_subcode,
            user_title: crJson.error?.error_user_title,
            user_message: crJson.error?.error_user_msg,
            error_data: crJson.error?.error_data,
            fbtrace_id: crJson.error?.fbtrace_id
          };
          console.warn(`
⚠
 [Creative] ${strat.name} Rejected:`,
            JSON.stringify(lastCreativeError, null, 2));
        } catch (e) {
          console.warn(`
⚠
 [Creative] ${strat.name} Error: 
${e.message}`);
          lastCreativeError = e.message;
        }
      }

      if (!creativeId) {
        throw new Error(`Creative Creation Failed after all fallbacks: 
${JSON.stringify(lastCreativeError, null, 2)}`);
      }

      // 5. Create Ad 
      const adBody = {
        name: creative.headline || "Ad",
        adset_id: finalAdSetId,
        creative: {
          creative_id: creativeId
        },
        status: "ACTIVE",
        ...(payload.message_channel === "INSTAGRAM_MESSAGES" &&
          validatedInstagramActorId
          ? { instagram_actor_id: validatedInstagramActorId }
          : {})
      };

      const adRes = await fetch(
        `https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/ads?access_token=${ACCESS_TOKEN}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(adBody)
        }
      );

      const adJson = await adRes.json();

      if (!adRes.ok) {
        throw new Error(
          `Ad Create Failed: ${JSON.stringify(adJson.error)} (Account: ${AD_ACCOUNT_ID})`
        );
      }

      createdAssets.ads.push(adJson.id);
    }

    return res.status(200).json({
      ok: true,
      id: campaignId,
      status: "ACTIVE",
      details: createdAssets
    });

  } catch (err) {
    console.error("[Campaign Executor] Error:", err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
}

// UNIVERSAL AD SET BUILDER (Strict ODAX Compliance)
async function buildAdSetPayload(objective, adSet, campaignId, accessToken, placements, pageId, metaPixelId, payload) {
  const params = new URLSearchParams();

  params.append("name", adSet.name || "Ad Set 1");
  params.append("campaign_id", campaignId);
  params.append("status", "ACTIVE");
  params.append("access_token", accessToken);
  params.append("bid_strategy", "LOWEST_COST_WITHOUT_CAP");

  const startTime = new Date(Date.now() + 5 * 60 * 1000);
  params.append("start_time", startTime.toISOString());

  let optimization_goal = "LINK_CLICKS";
  let billing_event = "IMPRESSIONS";
  let destination_type = "WEBSITE";
  let promoted_object = null;

  let conversionLocation = (adSet.conversion_location || "").toUpperCase();

  // MESSAGING_APPS Normalization: When conversion_location is generic "MESSAGING_APPS",
  // try to determine the specific channel from message_channel or creative CTA
  if (conversionLocation === "MESSAGING_APPS" || conversionLocation === "MESSAGES") {
    const channel = (adSet.message_channel || "").toUpperCase();
    const creativeCTA = (adSet.ad_creative?.call_to_action || "").toUpperCase();

    if (channel === "WHATSAPP" || channel === "WHATSAPP_MESSAGES" || creativeCTA === "WHATSAPP_MESSAGE") {
      conversionLocation = "WHATSAPP";
      console.log("📍 [AdSet] Normalized MESSAGING_APPS → WHATSAPP (from channel/CTA)");
    } else if (channel === "INSTAGRAM_MESSAGES" || creativeCTA === "INSTAGRAM_MESSAGE") {
      conversionLocation = "INSTAGRAM_DIRECT";
      console.log("📍 [AdSet] Normalized MESSAGING_APPS → INSTAGRAM_DIRECT");
    } else if (channel === "FACEBOOK_MESSENGER" || creativeCTA === "MESSAGE_PAGE") {
      conversionLocation = "MESSENGER";
      console.log("📍 [AdSet] Normalized MESSAGING_APPS → MESSENGER");
    }
    // If still MESSAGING_APPS after normalization, channel-based routing in switch will handle it
  }

  switch (objective) {

    case "OUTCOME_TRAFFIC":

      if (conversionLocation === "WHATSAPP") {
        destination_type = "WHATSAPP";
        optimization_goal = "CONVERSATIONS";
        billing_event = "IMPRESSIONS";
        promoted_object = {
          page_id: pageId
        };
      }

      else if (conversionLocation === "MESSAGES" || conversionLocation === "MESSAGING_APPS") {
        const channel = (adSet.message_channel || "").toUpperCase();
        if (channel === "WHATSAPP" || channel === "WHATSAPP_MESSAGES") {
          destination_type = "WHATSAPP";
        } else if (channel === "INSTAGRAM_MESSAGES") {
          destination_type = "INSTAGRAM_DIRECT";
        } else if (channel === "FACEBOOK_MESSENGER") {
          destination_type = "MESSENGER";
        } else {
          destination_type = "MESSENGER";
        }
        optimization_goal = "CONVERSATIONS";
        billing_event = "IMPRESSIONS";
        promoted_object = { page_id: pageId };
      }

      else if (conversionLocation === "CALLS") {
        destination_type = "WEBSITE";
        optimization_goal = "LINK_CLICKS";
        billing_event = "IMPRESSIONS";
      }

      else {
        destination_type = "WEBSITE";
        optimization_goal = "LINK_CLICKS";
        billing_event = "IMPRESSIONS";
      }

      break;
    case "OUTCOME_LEADS":

      if (conversionLocation === "WHATSAPP") {

        destination_type = "WHATSAPP";
        optimization_goal = "LEAD_GENERATION";
        billing_event = "IMPRESSIONS";

        promoted_object = {
          page_id: pageId
        };

      }

      else if (conversionLocation === "MESSAGING_APPS" || conversionLocation === "MESSAGES" || conversionLocation === "MESSENGER" || conversionLocation === "INSTAGRAM_DIRECT") {
        const channel = (adSet.message_channel || "").toUpperCase();
        if (channel === "WHATSAPP" || channel === "WHATSAPP_MESSAGES") {
          destination_type = "WHATSAPP";
        } else if (channel === "INSTAGRAM_MESSAGES") {
          destination_type = "INSTAGRAM_DIRECT";
        } else {
          destination_type = "MESSENGER";
        }
        optimization_goal = "LEAD_GENERATION";
        billing_event = "IMPRESSIONS";
        promoted_object = { page_id: pageId };
      }

      else if (conversionLocation === "CALLS") {

        destination_type = "WEBSITE";
        optimization_goal = "LINK_CLICKS";
        billing_event = "IMPRESSIONS";

      }

      else {

        optimization_goal = "LEAD_GENERATION";
        billing_event = "IMPRESSIONS";

        promoted_object = {
          page_id: pageId
        };

      }

      break;

    case "OUTCOME_AWARENESS":
      optimization_goal = "REACH";
      billing_event = "IMPRESSIONS";
      destination_type = undefined;
      break;

    case "OUTCOME_ENGAGEMENT":

      optimization_goal = "CONVERSATIONS";
      billing_event = "IMPRESSIONS";

      if (conversionLocation === "WHATSAPP") {
        destination_type = "WHATSAPP";

        promoted_object = {
          page_id: pageId
        };
      }

      else if (conversionLocation === "MESSAGING_APPS" || conversionLocation === "MESSAGES" || conversionLocation === "WHATSAPP") {
        const channel = (adSet.message_channel || "").toUpperCase();

        if (channel === "INSTAGRAM_MESSAGES") {
          destination_type = "INSTAGRAM_DIRECT";
        } else if (channel === "FACEBOOK_MESSENGER") {
          destination_type = "MESSENGER";
        } else if (channel === "WHATSAPP_MESSAGES" || channel === "WHATSAPP" || conversionLocation === "WHATSAPP") {
          destination_type = "WHATSAPP";
        } else if (channel === "ALL_MESSAGES" || !channel) {
          // This targets Instagram, Messenger, and WhatsApp all at once
          destination_type = "MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP";
        }
      }

      if (!promoted_object) {
        promoted_object = {
          page_id: pageId
        };
      }

      break;

    case "OUTCOME_SALES":
      optimization_goal = "OFFSITE_CONVERSIONS";
      billing_event = "IMPRESSIONS";
      destination_type = "WEBSITE";

      // Use the Pixel ID from the payload OR fallback to a meta variable 
      // (You'll need to pass the pixel_id into this function from the main handler)
      const pixelId = adSet.promoted_object?.pixel_id || metaPixelId;

      if (!pixelId) {
        throw new Error("OUTCOME_SALES requires a Meta Pixel. Please ensure your Pixel is connected in Settings.");
      }

      promoted_object = {
        pixel_id: pixelId,
        custom_event_type: adSet.promoted_object?.custom_event_type || "PURCHASE"
      };
      break;

    case "OUTCOME_APP_PROMOTION":
      optimization_goal = "APP_INSTALLS";
      billing_event = "IMPRESSIONS";
      destination_type = undefined;

      if (!adSet.promoted_object || !adSet.promoted_object.application_id) {
        throw new Error("OUTCOME_APP_PROMOTION requires an Application ID.");
      }

      promoted_object = adSet.promoted_object;
      break;

    default:
      break;
  }

  params.append("optimization_goal", optimization_goal);
  params.append("billing_event", billing_event);
  if (destination_type) params.append("destination_type", destination_type);
  if (promoted_object) params.append("promoted_object", JSON.stringify(promoted_object));

  // 🌍 UNIVERSAL LOCATION RESOLVER
  let geo_locations = {};

  // Check if execute.js sent us a list of locations
  const locationQuery = payload.targeting?.universal_locations || [];

  if (locationQuery.length > 0) {
    console.log("🔍 Universal Search for:", locationQuery);

    const resolvedCities = [];
    const resolvedRegions = [];
    const resolvedCountries = [];

    for (const locName of locationQuery) {
      try {
        const searchRes = await fetch(
          `https://graph.facebook.com/v21.0/search?type=adgeolocation&q=${encodeURIComponent(locName)}&access_token=${accessToken}`
        );
        const searchJson = await searchRes.json();

        if (searchJson.data && searchJson.data.length > 0) {
          // Priority: city > region/state > country > neighborhood/subcity > zip > geo_market
          // Scan all results for the best match instead of just using [0]
          const priorityOrder = ['city', 'region', 'state', 'country', 'subcity', 'neighborhood', 'zip', 'geo_market'];
          let bestMatch = searchJson.data[0]; // fallback to first result

          for (const preferredType of priorityOrder) {
            const found = searchJson.data.find(r => r.type === preferredType);
            if (found) { bestMatch = found; break; }
          }

          const match = bestMatch;
          console.log(`✅ Meta Match: ${locName} -> ${match.name} (${match.type}, key: ${match.key})`);

          if (match.type === 'city' || match.type === 'subcity' || match.type === 'neighborhood') {
            // All city-like types use the same format with key + radius
            resolvedCities.push({ key: match.key, radius: 20, distance_unit: 'kilometer' });
          } else if (match.type === 'region' || match.type === 'state') {
            resolvedRegions.push({ key: match.key });
          } else if (match.type === 'country') {
            resolvedCountries.push(match.key);
          } else if (match.type === 'zip') {
            // Zip/postal codes go into their own array
            if (!geo_locations.zips) geo_locations.zips = [];
            geo_locations.zips.push({ key: match.key });
          } else if (match.type === 'geo_market') {
            if (!geo_locations.geo_markets) geo_locations.geo_markets = [];
            geo_locations.geo_markets.push({ key: match.key });
          } else {
            // Unknown type — treat like a city as safe fallback
            console.warn(`⚠️ Unknown geo type "${match.type}" for "${locName}" — treating as city`);
            resolvedCities.push({ key: match.key, radius: 20, distance_unit: 'kilometer' });
          }
        } else {
          console.warn(`⚠️ No Meta results for location: ${locName}`);
        }
      } catch (err) {
        console.error(`❌ Search failed for ${locName}:`, err);
      }
    }

    if (resolvedCities.length > 0) geo_locations.cities = resolvedCities;
    if (resolvedRegions.length > 0) geo_locations.regions = resolvedRegions;
    if (resolvedCountries.length > 0) geo_locations.countries = resolvedCountries;
  }

  // If no locations were resolved, throw a clear error instead of defaulting to India
  if (Object.keys(geo_locations).length === 0) {
    throw new Error("No valid locations found. Please specify a city, state, or country for targeting.");
  }

  // The final targeting object Meta actually receives
  const targeting = {
    geo_locations: geo_locations,
    age_min: parseInt(payload.targeting?.age_min?.toString().replace(/\D/g, '') || "18"),
    age_max: parseInt(payload.targeting?.age_max?.toString().replace(/\D/g, '') || "65"),
    publisher_platforms: placements,
    device_platforms: ["mobile", "desktop"]
  };

  // Gender Targeting (Meta API: 1=Male, 2=Female, omit=All)
  const genderStr = (payload.targeting?.genders || "all").toString().toLowerCase();
  if (genderStr === "women" || genderStr === "female") {
    targeting.genders = [2];
  } else if (genderStr === "men" || genderStr === "male") {
    targeting.genders = [1];
  }
  // "all" → omit genders key entirely (Meta default = all genders)

  // Advantage Audience (Required by Meta ODAX API — 0 = use exact targeting, 1 = let Meta expand)
  targeting.targeting_automation = { advantage_audience: 0 };

  console.log("✅ UNIVERSAL TARGETING:", JSON.stringify(targeting));
  params.append("targeting", JSON.stringify(targeting));

  return params;
}

// UNIVERSAL CREATIVE BUILDER (Placement Safe & Strict Types)
function buildCreativePayload(objective, creative, pageId, instagramActorId, accessToken, forcePhoto = false, placements = []) {
  if (!pageId) throw new Error("Page ID is required for Creative");
  if (!creative || !creative.image_hash) {
    throw new Error("Image upload failed. Creative execution stopped.");
  }

  // URL Sanitization — Gemini sometimes outputs "N/A" or invalid URLs
  if (creative.destination_url && (creative.destination_url === "N/A" || creative.destination_url === "n/a" || !creative.destination_url.startsWith("http"))) {
    console.log(`⚠️ [Creative] Invalid destination_url "${creative.destination_url}" — clearing to null`);
    creative.destination_url = null;
  }

  let conversionLocation = (creative.conversion_location || "").toUpperCase();

  // MESSAGING_APPS Normalization — same logic as buildAdSetPayload
  if (conversionLocation === "MESSAGING_APPS" || conversionLocation === "MESSAGES") {
    const channel = (creative.message_channel || "").toUpperCase();
    const creativeCTA = (creative.call_to_action || "").toUpperCase();

    if (channel === "WHATSAPP" || channel === "WHATSAPP_MESSAGES" || creativeCTA === "WHATSAPP_MESSAGE") {
      conversionLocation = "WHATSAPP";
    } else if (channel === "INSTAGRAM_MESSAGES" || creativeCTA === "INSTAGRAM_MESSAGE") {
      conversionLocation = "INSTAGRAM_DIRECT";
    }
    // else stays as MESSAGES/MESSAGING_APPS → will route to MESSAGE_PAGE CTA
  }

  const isInstagramPlacement = placements.includes("instagram");

  // CRITICAL: If Instagram is selected, we MUST have an actor ID
  const finalInstagramActor = isInstagramPlacement ? instagramActorId : null;

  const objectStorySpec = {
    page_id: pageId,
    // This tells FB which IG account to show the ad as
    ...(finalInstagramActor ? { instagram_actor_id: finalInstagramActor } : {})
  };

  // ===========================
  // CALL ADS LOGIC
  // ===========================
  if (conversionLocation === "CALLS") {
    const rawPhone = creative.phone_number || "";
    const validPhone = normalizePhoneNumber(rawPhone);

    if (!validPhone) {
      throw new Error("A valid phone number is required for Call Ads.");
    }

    objectStorySpec.link_data = {
      image_hash: creative.image_hash,
      // For Call Ads, the link MUST be the Page URL or a valid Website
      link: creative.destination_url || `https://www.facebook.com/${pageId}`,
      message: creative.primary_text || "",
      name: creative.headline || "Call Us",
      call_to_action: {
        type: "CALL_NOW",
        value: {
          link: `tel:${validPhone}`
        }
      }
    };
  } else {

    // ===================================================================
    // ODAX CREATIVE ROUTING — Messaging vs Website
    // ===================================================================
    const isMessagingDestination =
      conversionLocation === "WHATSAPP" ||
      conversionLocation === "MESSAGES" ||
      conversionLocation === "MESSAGING_APPS";

    const pageUrl = `https://www.facebook.com/${pageId}`;
    const channel = (creative.message_channel || "").toUpperCase();

    // ==============================
    // MESSAGING DESTINATIONS (WhatsApp / Messenger / IG / All)
    // ODAX Rule: link MUST be Page URL, CTA MUST match destination
    // ==============================
    if (!forcePhoto && isMessagingDestination) {

      // Determine the correct CTA for the messaging channel
      let ctaType = "MESSAGE_PAGE"; // default for Messenger

      if (conversionLocation === "WHATSAPP" || channel === "WHATSAPP" || channel === "WHATSAPP_MESSAGES") {
        ctaType = "WHATSAPP_MESSAGE";
      } else if (channel === "INSTAGRAM_MESSAGES") {
        ctaType = "INSTAGRAM_MESSAGE";
      } else if (channel === "FACEBOOK_MESSENGER") {
        ctaType = "MESSAGE_PAGE";
      } else if (channel === "ALL_MESSAGES" || !channel) {
        ctaType = "MESSAGE_PAGE";
      }

      objectStorySpec.link_data = {
        image_hash: creative.image_hash,
        link: pageUrl, // ALWAYS Page URL for messaging — never a website URL
        message: creative.primary_text || "",
        name: creative.headline || "Chat with us",
        call_to_action: {
          type: ctaType
        }
      };

      console.log(`📨 [Creative] Messaging mode: CTA=${ctaType}, link=${pageUrl}`);
    }

    // ==============================
    // WEBSITE DESTINATIONS (Traffic / Sales / Leads with website)
    // ==============================
    else if (
      !forcePhoto &&
      (
        objective === "OUTCOME_TRAFFIC" ||
        objective === "OUTCOME_SALES" ||
        objective === "OUTCOME_LEADS" ||
        objective === "OUTCOME_ENGAGEMENT"
      )
    ) {
      objectStorySpec.link_data = {
        image_hash: creative.image_hash,
        link: creative.destination_url || pageUrl,
        message: creative.primary_text || "",
        name: creative.headline || "Learn more",
        call_to_action: {
          type: creative.call_to_action || "LEARN_MORE"
        }
      };
    }

    // ==============================
    // PHOTO ONLY (Fallback — Awareness etc.)
    // ==============================
    else {

      objectStorySpec.photo_data = {
        image_hash: creative.image_hash,
        caption: creative.primary_text || creative.headline || ""
      };
    }
  }
  const params = new URLSearchParams();
  params.append("name", creative.headline || "Creative");
  params.append("object_story_spec", JSON.stringify(objectStorySpec));
  params.append("access_token", accessToken);

  return params;
}
// HELPER: Auto-discover Pixel if missing from DB
async function getAutoPixelId(adAccountId, accessToken, apiVersion) {
  try {
    console.log(`🔍 [Pixel Discovery] Searching for pixels in act_${adAccountId}...`);
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/act_${adAccountId}/adspixels?access_token=${accessToken}`
    );
    const json = await res.json();

    if (json.data && json.data.length > 0) {
      const foundId = json.data[0].id;
      console.log(`✅ [Pixel Discovery] Found Pixel ID: ${foundId}`);
      return foundId;
    }
    return null;
  } catch (e) {
    console.error("❌ [Pixel Discovery] Failed:", e.message);
    return null;
  }
}
// getCityKey removed — superseded by Universal Location Resolver in buildAdSetPayload
