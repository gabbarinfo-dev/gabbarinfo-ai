import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔒 THE GOLDEN RULE MAPPER
function mapObjectiveToODAX(obj) {
  const o = (obj || "").toString().toUpperCase();
  console.log(`[mapObjectiveToODAX] Input: "${obj}" -> Upper: "${o}"`);

  if (o.includes("TRAFFIC") || o.includes("LINK") || o.includes("CLICK") || o.includes("VISIT")) {
    console.log(`[mapObjectiveToODAX] Result: OUTCOME_TRAFFIC`);
    return "OUTCOME_TRAFFIC";
  }
  if (o.includes("LEAD") || o.includes("PROSPECT")) {
    console.log(`[mapObjectiveToODAX] Result: OUTCOME_LEADS`);
    return "OUTCOME_LEADS";
  }
  if (o.includes("SALE") || o.includes("CONVERSION") || o.includes("COMMERCE") || o.includes("SHOP")) {
    console.log(`[mapObjectiveToODAX] Result: OUTCOME_SALES`);
    return "OUTCOME_SALES";
  }
  if (o.includes("MESSAGES") || o.includes("ENGAGEMENT") || o.includes("INTERACTION")) {
    console.log(`[mapObjectiveToODAX] Result: OUTCOME_ENGAGEMENT`);
    return "OUTCOME_ENGAGEMENT";
  }
  if (o.includes("REACH") || o.includes("AWARENESS") || o.includes("VIEW")) {
    console.log(`[mapObjectiveToODAX] Result: OUTCOME_AWARENESS`);
    return "OUTCOME_AWARENESS";
  }

  console.log(`[mapObjectiveToODAX] Fallback Result: OUTCOME_TRAFFIC`);
  return "OUTCOME_TRAFFIC";
}

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

  const { platform, payload } = req.body || {};
  if (!payload || !payload.campaign_name) {
    return res.status(400).json({ ok: false, message: "Invalid payload: campaign_name required" });
  }

  const { data: meta, error } = await supabase
    .from("meta_connections")
    .select("fb_ad_account_id, system_user_token, fb_page_id")
    .eq("email", clientEmail)
    .single();

  if (error || !meta) {
    return res.status(400).json({ ok: false, message: "Meta connection not found" });
  }

  const AD_ACCOUNT_ID = (meta.fb_ad_account_id || "").toString().replace(/^act_/, "");
  const ACCESS_TOKEN = meta.system_user_token;
  const PAGE_ID = meta.fb_page_id;
  const API_VERSION = "v21.0";

  const createdAssets = { campaign_id: null, ad_sets: [], ads: [] };

  try {
    // 1. Map Objective
    const rawObjective = payload.objective || "";
    const finalObjective = mapObjectiveToODAX(rawObjective);

    console.log(`🚀 [Campaign Creator] Objective: ${finalObjective} (from raw: ${rawObjective})`);

    // 2. Create Campaign
    const campaignParams = new URLSearchParams();
    campaignParams.append("name", payload.campaign_name);
    campaignParams.append("objective", finalObjective);
    campaignParams.append("status", "PAUSED");
    campaignParams.append("buying_type", "AUCTION");
    campaignParams.append("special_ad_categories", "[]");
    campaignParams.append("access_token", ACCESS_TOKEN);

    const cRes = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/campaigns`, {
      method: "POST",
      body: campaignParams
    });
    const cJson = await cRes.json();

    if (!cRes.ok || !cJson.id) {
      const errorMsg = cJson.error?.message || `Unknown Meta Error (Status: ${cRes.status})`;
      throw new Error(`Campaign Create Failed: ${errorMsg} (AGENT_V2_OBJ: ${finalObjective})`);
    }

    const campaignId = cJson.id;
    createdAssets.campaign_id = campaignId;

    // 3. Create Ad Set(s)
    const adSets = payload.ad_sets || [{ name: "Ad Set 1" }];
    for (const adSet of adSets) {
      const budgetAmount = payload.budget?.amount || 500;
      const budgetType = (payload.budget?.type || "DAILY").toUpperCase() === "DAILY" ? "daily_budget" : "lifetime_budget";

      let optimizationGoal = "LINK_CLICKS";
      let billingEvent = "IMPRESSIONS";

      const pg = (payload.performance_goal || "").toUpperCase();
      if (pg.includes("LANDING_PAGE_VIEWS")) optimizationGoal = "LANDING_PAGE_VIEWS";
      else if (pg.includes("LINK_CLICKS")) optimizationGoal = "LINK_CLICKS";
      else if (pg.includes("CONVERSATIONS")) optimizationGoal = "CONVERSATIONS";
      else if (pg.includes("REACH")) optimizationGoal = "REACH";
      else if (pg.includes("CALLS")) optimizationGoal = "LINK_CLICKS";

      const adSetParams = new URLSearchParams();
      adSetParams.append("name", adSet.name || "Ad Set 1");
      adSetParams.append("campaign_id", campaignId);
      adSetParams.append(budgetType, String(Math.floor(Number(budgetAmount) * 100)));
      adSetParams.append("billing_event", billingEvent);
      adSetParams.append("optimization_goal", optimizationGoal);
      adSetParams.append("bid_strategy", "LOWEST_COST_WITHOUT_CAP");
      adSetParams.append("status", "PAUSED");
      adSetParams.append("targeting", JSON.stringify({ geo_locations: { countries: ["IN"] }, age_min: 18, age_max: 65 }));
      adSetParams.append("access_token", ACCESS_TOKEN);

      const asRes = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/adsets`, {
        method: "POST",
        body: adSetParams
      });
      const asJson = await asRes.json();
      if (!asRes.ok) throw new Error(`AdSet Create Failed: ${asJson.error?.message}`);

      const adSetId = asJson.id;
      createdAssets.ad_sets.push(adSetId);

      // 4. Create Creative
      const creative = adSet.ad_creative || {};
      if (!creative.image_hash) continue;

      const creativeSpec = {
        page_id: PAGE_ID,
        link_data: {
          image_hash: creative.image_hash,
          link: creative.destination_url || "https://gabbarinfo.com",
          message: creative.primary_text || "",
          name: creative.headline || "",
          call_to_action: { type: creative.call_to_action || "LEARN_MORE" }
        }
      };

      const crParams = new URLSearchParams();
      crParams.append("name", creative.headline || "Creative");
      crParams.append("object_story_spec", JSON.stringify(creativeSpec));
      crParams.append("access_token", ACCESS_TOKEN);

      const crRes = await fetch(`https://graph.facebook.com/${API_VERSION}/act_${AD_ACCOUNT_ID}/adcreatives`, {
        method: "POST",
        body: crParams
      });
      const crJson = await crRes.json();
      if (!crRes.ok) throw new Error(`Creative Create Failed: ${crJson.error?.message}`);

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
      if (!adRes.ok) throw new Error(`Ad Create Failed: ${adJson.error?.message}`);

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
