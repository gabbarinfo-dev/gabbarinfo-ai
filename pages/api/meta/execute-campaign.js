import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Only POST allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const headerEmail = req.headers["x-client-email"];
  const clientEmail =
    (session?.user?.email && session.user.email.toLowerCase()) ||
    (typeof headerEmail === "string" ? headerEmail.toLowerCase() : null);
  if (!clientEmail) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }

  // 1. Parse Payload
  const { platform, payload } = req.body || {};
  
  if (!payload || !payload.campaign_name) {
    return res.status(400).json({
      ok: false,
      message: "Invalid payload. 'campaign_name' is required.",
    });
  }

  // 2. Get Meta Connection
  const { data: meta, error } = await supabase
    .from("meta_connections")
    .select("fb_ad_account_id, system_user_token, fb_page_id")
    .eq("email", clientEmail)
    .single();

  if (error || !meta) {
    return res.status(400).json({
      ok: false,
      message: "Meta connection not found",
    });
  }

  const AD_ACCOUNT_ID = (meta.fb_ad_account_id || "").toString().replace(/^act_/, "");
  const ACCESS_TOKEN = meta.system_user_token;
  const PAGE_ID = meta.fb_page_id;
  const API_VERSIONS = ["v24.0", "v21.0"];
  const baseFor = (ver) => `https://graph.facebook.com/${ver}/act_${AD_ACCOUNT_ID}`;

  // Track created assets for rollback/reporting
  const createdAssets = {
    campaign_id: null,
    ad_sets: [],
    ads: []
  };

  try {
    // =================================================================
    // STEP 1: CREATE CAMPAIGN
    // =================================================================
    function mapObjective(obj) {
      const o = (obj || "").toUpperCase();
      if (o.includes("OUTCOME_TRAFFIC")) return "OUTCOME_TRAFFIC";
      if (o === "TRAFFIC") return "OUTCOME_TRAFFIC";
      if (o.includes("LINK_CLICKS")) return "OUTCOME_TRAFFIC";
      if (o.includes("LEAD")) return "OUTCOME_LEADS";
      if (o.includes("CONVERSION")) return "OUTCOME_SALES";
      if (o.includes("MESSAGES")) return "MESSAGES";
      if (o.includes("REACH")) return "REACH";
      return "OUTCOME_TRAFFIC";
    }

    async function tryCreateCampaign(objective) {
      const params = new URLSearchParams();
      params.append("name", payload.campaign_name);
      params.append("objective", mapObjective(objective));
      params.append("status", "PAUSED");
      params.append("buying_type", "AUCTION");
      params.append("special_ad_categories", JSON.stringify([]));
      let res = null;
      let json = null;
      let lastErr = null;
      let lastVer = null;
      for (const ver of API_VERSIONS) {
        const url = `${baseFor(ver)}/campaigns?access_token=${ACCESS_TOKEN}`;
        res = await fetch(url, { method: "POST", body: params });
        try { json = await res.json(); } catch (_) { json = { raw: await res.text() }; }
        if (res.ok && json?.id) {
          return { res, json, ver };
        } else {
          lastErr = json?.error?.message || JSON.stringify(json || {});
          lastVer = ver;
        }
      }
      // Final return with last error (return last response/json parsed above)
      return { res, json, lastErr, lastVer };
    }

    let objectiveCandidates = ["OUTCOME_TRAFFIC"];
    const requestedObj = (payload.objective || "").toString().toUpperCase();
    const mappedRequested = mapObjective(requestedObj);
    if (mappedRequested) {
      objectiveCandidates = [mappedRequested];
      // Add sensible fallbacks based on requested category
      if (mappedRequested === "OUTCOME_TRAFFIC") {
        objectiveCandidates.push("TRAFFIC", "LINK_CLICKS");
      } else if (mappedRequested === "OUTCOME_LEADS") {
        objectiveCandidates.push("LEAD_GENERATION");
      } else if (mappedRequested === "OUTCOME_SALES") {
        objectiveCandidates.push("CONVERSIONS");
      }
    }

    let campaignId = null;
    let lastErr = null;
    let lastTried = null;
    for (const obj of objectiveCandidates) {
      const attempt = await tryCreateCampaign(obj);
      if (attempt.res.ok && attempt.json?.id) {
        campaignId = attempt.json.id;
        break;
      } else {
        lastErr = attempt.lastErr || attempt.json?.error?.message || JSON.stringify(attempt.json || {});
        lastTried = obj;
      }
    }

    if (!campaignId) {
      throw new Error(`Campaign Create Failed: ${lastErr || "Unknown error"} (objective tried: ${lastTried})`);
    }

    createdAssets.campaign_id = campaignId;

    // =================================================================
    // STEP 2: CREATE AD SETS & ADS
    // =================================================================
    const adSets = payload.ad_sets || [];
    
    for (const adSet of adSets) {
      // --- A. Create Ad Set ---
      const budgetAmount = payload.budget?.amount || 500; // Default 500
      
      const defaultTargeting = payload.targeting || { geo_locations: { countries: ["IN"] } };
      let optimizationGoal = "LINK_CLICKS";

      // Adjust Optimization Goal based on Objective
      if (payload.objective === "OUTCOME_LEADS") {
        optimizationGoal = "LEAD_GENERATION";
      }

      const adSetParams = new URLSearchParams();
      adSetParams.append("name", adSet.name || "Ad Set 1");
      adSetParams.append("campaign_id", campaignId);
      adSetParams.append("daily_budget", String(Math.floor(Number(budgetAmount) * 100)));
      adSetParams.append("billing_event", "IMPRESSIONS");
      adSetParams.append("optimization_goal", optimizationGoal);
      if (optimizationGoal === "LEAD_GENERATION") {
        adSetParams.append("destination_type", "ON_AD");
      }
      adSetParams.append("bid_strategy", "LOWEST_COST_WITHOUT_CAP");
      adSetParams.append("status", "PAUSED");
      adSetParams.append("targeting", JSON.stringify(defaultTargeting));
      adSetParams.append("access_token", ACCESS_TOKEN);

      const adSetRes = await fetch(`${base}/adsets`, {
        method: "POST",
        body: adSetParams,
      });

      const adSetJson = await adSetRes.json();
      if (!adSetRes.ok) {
        // Retry with safe targeting if likely targeting error
        if (JSON.stringify(adSetJson).includes("targeting")) {
            const safeParams = new URLSearchParams(adSetParams);
            safeParams.set("targeting", JSON.stringify({ geo_locations: { countries: ["IN"] } }));
            const retryRes = await fetch(`${base}/adsets`, {
                method: "POST",
                body: safeParams,
            });
            const retryJson = await retryRes.json();
            if (!retryRes.ok) throw new Error(`AdSet Create Failed (Retry): ${retryJson.error?.message}`);
            
            adSetJson.id = retryJson.id; // Update ID
        } else {
            throw new Error(`AdSet Create Failed: ${adSetJson.error?.message}`);
        }
      }

      const adSetId = adSetJson.id;
      createdAssets.ad_sets.push(adSetId);

      // --- B. Create Creative ---
      const creative = adSet.ad_creative || {};
      const imageHash = creative.image_hash;
      
      if (!imageHash) {
        console.warn(`Skipping Ad Creation for AdSet ${adSetId}: No image_hash provided.`);
        continue;
      }

      const creativeSpec = {
        page_id: PAGE_ID,
        link_data: {
          image_hash: imageHash,
          link: (creative.destination_url && /^https?:\/\//.test(creative.destination_url)) ? creative.destination_url : "https://facebook.com",
          message: creative.primary_text || "",
          name: creative.headline || "",
          call_to_action: {
            type: creative.call_to_action || "LEARN_MORE"
          }
        }
      };

      const creativeParams = new URLSearchParams();
      creativeParams.append("name", creative.headline || "Creative 1");
      creativeParams.append("object_story_spec", JSON.stringify(creativeSpec));
      creativeParams.append("access_token", ACCESS_TOKEN);

      const creativeRes = await fetch(`${base}/adcreatives`, {
        method: "POST",
        body: creativeParams,
      });

      const creativeJson = await creativeRes.json();
      if (!creativeRes.ok) {
        throw new Error(`Creative Create Failed: ${creativeJson.error?.message}`);
      }

      const creativeId = creativeJson.id;

      // --- C. Create Ad ---
      const adParams = new URLSearchParams();
      adParams.append("name", creative.headline || "Ad 1");
      adParams.append("adset_id", adSetId);
      adParams.append("creative", JSON.stringify({ creative_id: creativeId }));
      adParams.append("status", "PAUSED");
      adParams.append("access_token", ACCESS_TOKEN);

      const adRes = await fetch(`${base}/ads`, {
        method: "POST",
        body: adParams,
      });

      const adJson = await adRes.json();
      if (!adRes.ok) {
        throw new Error(`Ad Create Failed: ${adJson.error?.message}`);
      }

      createdAssets.ads.push(adJson.id);
    }

    return res.status(200).json({
      ok: true,
      message: "Campaign executed successfully",
      id: createdAssets.campaign_id,
      status: "PAUSED",
      ad_account_id: `act_${AD_ACCOUNT_ID}`,
      details: createdAssets
    });

  } catch (err) {
    console.error("EXECUTION ERROR:", err.message);
    return res.status(500).json({
      ok: false,
      message: err.message,
      ad_account_id: `act_${AD_ACCOUNT_ID}`,
      created_partial: createdAssets
    });
  }
}
