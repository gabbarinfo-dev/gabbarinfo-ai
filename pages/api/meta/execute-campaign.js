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
  const base = `https://graph.facebook.com/v24.0/act_${AD_ACCOUNT_ID}`;

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
      if (o.includes("LINK_CLICKS")) return "LINK_CLICKS";
      if (o.includes("LEAD")) return "OUTCOME_LEADS";
      if (o.includes("CONVERSION")) return "CONVERSIONS";
      if (o.includes("MESSAGES")) return "MESSAGES";
      if (o.includes("REACH")) return "REACH";
      return "OUTCOME_TRAFFIC";
    }

    async function tryCreateCampaign(objective) {
      const body = {
        name: payload.campaign_name,
        objective: mapObjective(objective),
        status: "PAUSED",
        special_ad_categories: ["NONE"],
        buying_type: "AUCTION",
      };
      const url = `${base}/campaigns?access_token=${ACCESS_TOKEN}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let json;
      try { json = await res.json(); } catch (_) { json = { raw: await res.text() }; }
      return { res, json };
    }

    const objectiveCandidates = ["LINK_CLICKS", payload.objective || "OUTCOME_TRAFFIC", "OUTCOME_TRAFFIC"];

    let campaignId = null;
    let lastErr = null;
    let lastTried = null;
    for (const obj of objectiveCandidates) {
      const attempt = await tryCreateCampaign(obj);
      if (attempt.res.ok && attempt.json?.id) {
        campaignId = attempt.json.id;
        break;
      } else {
        lastErr = attempt.json?.error?.message || JSON.stringify(attempt.json || {});
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
      
      const adSetBody = {
        name: adSet.name || "Ad Set 1",
        campaign_id: campaignId,
        daily_budget: Math.floor(Number(budgetAmount) * 100), // Convert to cents/paise
        billing_event: "IMPRESSIONS",
        optimization_goal: "LINK_CLICKS", // Default for traffic
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        status: "PAUSED",
        targeting: payload.targeting || { "geo_locations": { "countries": ["IN"] } },
        access_token: ACCESS_TOKEN,
      };

      // Adjust Optimization Goal based on Objective
      if (payload.objective === "OUTCOME_LEADS") {
        adSetBody.optimization_goal = "LEAD_GENERATION";
      }

      // Safe fallback for targeting if cities provided without keys (common AI error)
      // If targeting has cities with names but no keys, we might strip them to avoid errors
      // For now, we try as-is. If it fails, we could retry, but let's keep it simple.
      
      const adSetRes = await fetch(`${base}/adsets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adSetBody),
      });

      const adSetJson = await adSetRes.json();
      if (!adSetRes.ok) {
        // Retry with safe targeting if likely targeting error
        if (JSON.stringify(adSetJson).includes("targeting")) {
            console.warn("Targeting failed, retrying with Country only.");
            adSetBody.targeting = { "geo_locations": { "countries": ["IN"] } };
            const retryRes = await fetch(`${base}/adsets`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(adSetBody),
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

      const creativeBody = {
        name: creative.headline || "Creative 1",
        object_story_spec: {
          page_id: PAGE_ID,
          link_data: {
            image_hash: imageHash,
            link: creative.destination_url || "https://facebook.com",
            message: creative.primary_text || "",
            name: creative.headline || "",
            call_to_action: {
              type: creative.call_to_action || "LEARN_MORE"
            }
          }
        },
        access_token: ACCESS_TOKEN,
      };

      const creativeRes = await fetch(`${base}/adcreatives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creativeBody),
      });

      const creativeJson = await creativeRes.json();
      if (!creativeRes.ok) {
        throw new Error(`Creative Create Failed: ${creativeJson.error?.message}`);
      }

      const creativeId = creativeJson.id;

      // --- C. Create Ad ---
      const adBody = {
        name: creative.headline || "Ad 1",
        adset_id: adSetId,
        creative: { creative_id: creativeId },
        status: "PAUSED",
        access_token: ACCESS_TOKEN,
      };

      const adRes = await fetch(`${base}/ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adBody),
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
      details: createdAssets
    });

  } catch (err) {
    console.error("EXECUTION ERROR:", err.message);
    return res.status(500).json({
      ok: false,
      message: err.message,
      created_partial: createdAssets
    });
  }
}
