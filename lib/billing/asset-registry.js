// lib/billing/asset-registry.js
/**
 * Global Anti-Abuse Asset Identity Registry
 * 
 * Prevents multi-email exploitation by fingerprinting and locking underlying digital assets
 * (WordPress website domains, Facebook Page IDs, Google Business Profile location IDs).
 * 
 * Ensures that a client cannot create a new Gmail account to repeatedly claim free trials
 * or ₹99 trial packs for the same business website or social page.
 */

import { supabaseServer } from "../supabaseServer";

/**
 * Normalizes any website URL or domain string into an authoritative root domain.
 * e.g. "https://www.example.com:443/blog/post?id=1#frag" -> "example.com"
 */
export function normalizeDomain(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  let domain = rawUrl.trim().toLowerCase();

  // Strip protocol
  domain = domain.replace(/^https?:\/\//, "");

  // Strip credentials or port if present
  domain = domain.replace(/^[^\/]+@/, "");

  // Extract hostname before any path or query
  domain = domain.split("/")[0].split("?")[0].split("#")[0];

  // Strip port
  domain = domain.split(":")[0];

  // Strip www. prefix
  domain = domain.replace(/^www\./, "");

  return domain.trim();
}

/**
 * Normalizes asset identifier according to asset type.
 */
export function normalizeAssetIdentifier(assetType, rawId) {
  if (!rawId) return "";
  const type = String(assetType).toLowerCase().trim();

  if (type === "wordpress_domain" || type === "wordpress_site" || type === "website") {
    return normalizeDomain(rawId);
  }

  if (type === "facebook_page" || type === "meta_page" || type === "social_brand") {
    return String(rawId).trim();
  }

  if (type === "gmb_location" || type === "gmb") {
    return String(rawId).replace(/^locations\//i, "").trim();
  }

  return String(rawId).trim().toLowerCase();
}

/**
 * Checks whether an asset is eligible for trial actions or if it has already been claimed
 * under another user email address.
 */
export async function checkAssetTrialEligibility({ assetType, identifier, userEmail }) {
  const normEmail = (userEmail || "").toLowerCase().trim();
  const cleanId = normalizeAssetIdentifier(assetType, identifier);

  if (!cleanId) {
    return { eligible: true, cleanId: "" };
  }

  const humanType = {
    wordpress_domain: "WordPress website",
    wordpress_site: "WordPress website",
    facebook_page: "Facebook Page",
    gmb_location: "Google Business Profile",
  }[assetType] || "business asset";

  try {
    // 1. Check primary global_asset_registry table in Supabase
    const { data: existingAsset, error: queryError } = await supabaseServer
      .from("global_asset_registry")
      .select("*")
      .eq("asset_type", assetType)
      .eq("normalized_identifier", cleanId)
      .maybeSingle();

    if (!queryError && existingAsset) {
      const isSameOwner = existingAsset.first_claimed_by_email?.toLowerCase() === normEmail;
      
      // If claimed by another email under a trial
      if (!isSameOwner && existingAsset.trial_claimed) {
        return {
          eligible: false,
          code: "DUPLICATE_TRIAL_ASSET",
          cleanId,
          error: `This ${humanType} (${cleanId}) has already claimed a trial pack under another account. To connect this business, please activate a standard subscription (Solo Growth Suite or higher).`,
        };
      }

      return {
        eligible: true,
        cleanId,
        isExisting: true,
        claimedBySelf: isSameOwner,
        record: existingAsset,
      };
    }
  } catch (err) {
    console.warn("[AssetRegistry] Supabase table check note:", err.message);
  }

  // 2. Fallback secondary check: Inspect existing agent_memory / meta_connections across other accounts
  try {
    if (assetType === "wordpress_domain" || assetType === "wordpress_site") {
      const { data: memoryRows } = await supabaseServer
        .from("agent_memory")
        .select("email, memory_value")
        .like("memory_type", "wp_conn_%")
        .neq("email", normEmail);

      if (memoryRows && memoryRows.length > 0) {
        for (const row of memoryRows) {
          const val = typeof row.memory_value === "string" ? JSON.parse(row.memory_value || "{}") : row.memory_value;
          const otherDomain = normalizeDomain(val?.siteUrl || val?.url || "");
          if (otherDomain && otherDomain === cleanId) {
            // Check other user's subscription
            const { data: otherSub } = await supabaseServer
              .from("subscriptions")
              .select("plan_id")
              .eq("business_id", `biz_${row.email.replace(/[^a-zA-Z0-9]/g, "_")}`)
              .maybeSingle();

            const otherPlan = (otherSub?.plan_id || "").toLowerCase();
            const isOtherTrial = otherPlan === "trial_99" || otherPlan === "none" || otherPlan === "try" || otherPlan === "";

            if (isOtherTrial) {
              return {
                eligible: false,
                code: "DUPLICATE_TRIAL_ASSET",
                cleanId,
                error: `This ${humanType} (${cleanId}) was previously registered for a trial under another account. Please subscribe to an official Growth Suite to connect this domain.`,
              };
            }
          }
        }
      }
    } else if (assetType === "facebook_page") {
      const { data: otherMeta } = await supabaseServer
        .from("meta_connections")
        .select("email, fb_page_id")
        .eq("fb_page_id", cleanId)
        .neq("email", normEmail)
        .maybeSingle();

      if (otherMeta) {
        return {
          eligible: false,
          code: "DUPLICATE_TRIAL_ASSET",
          cleanId,
          error: `This Facebook Page (ID: ${cleanId}) is already connected to another user account.`,
        };
      }
    }
  } catch (fallbackErr) {
    console.warn("[AssetRegistry] Fallback check note:", fallbackErr.message);
  }

  return { eligible: true, cleanId, isNew: true };
}

/**
 * Registers an asset claim when a user connects it or runs an action.
 */
export async function registerAssetClaim({ assetType, identifier, userEmail, planId, isTrial = false }) {
  const normEmail = (userEmail || "").toLowerCase().trim();
  const cleanId = normalizeAssetIdentifier(assetType, identifier);
  if (!cleanId || !normEmail) return null;

  const now = new Date().toISOString();
  const record = {
    asset_type: assetType,
    normalized_identifier: cleanId,
    first_claimed_by_email: normEmail,
    first_claimed_plan_id: planId || "none",
    trial_claimed: Boolean(isTrial),
    trial_claimed_at: isTrial ? now : null,
    last_active_at: now,
  };

  try {
    await supabaseServer
      .from("global_asset_registry")
      .upsert(record, { onConflict: "asset_type,normalized_identifier" });
  } catch (err) {
    // If the table doesn't exist yet, save as a global memory record in agent_memory
    try {
      await supabaseServer.from("agent_memory").upsert({
        email: "system@gabbarinfo.com",
        memory_type: `global_asset_${assetType}_${cleanId.replace(/[^a-zA-Z0-9]/g, "_")}`,
        memory_value: record,
        updated_at: now,
      }, { onConflict: "email,memory_type" });
    } catch (_) {}
  }

  return record;
}
