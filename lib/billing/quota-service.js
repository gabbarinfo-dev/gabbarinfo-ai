// lib/billing/quota-service.js
/**
 * Central Server-Side Monthly Service Quota & Usage Ledger Engine
 * 
 * Manages:
 * 1. Current billing cycle determination (cycle_start to cycle_end).
 * 2. Pre-execution quota verification and atomic reservation.
 * 3. Commit on successful execution; Release/rollback on failure.
 * 4. Distinct machine-readable error codes (FEATURE_NOT_INCLUDED vs MONTHLY_QUOTA_EXHAUSTED).
 * 5. Isolation per business_id.
 * 6. Super Admin (ndantare@gmail.com / owner) unlimited bypass.
 */

import { supabaseServer } from "../supabaseServer.js";
import { getPlanConfig, ENTITLEMENT_ERROR_CODES } from "./plans.js";
import { resolveActiveBusiness } from "../auth/business-context.js";
import { getTenantRegistry } from "../services/tenant-service.js";

// In-memory atomic reservation lock map to prevent race conditions during async operations
const activeReservations = new Map();
const activeReservationRecords = new Map();
const fallbackUsageStore = new Map();
const fallbackAssetUsageStore = new Map(); // key: `${businessId}:${cycleStart}:${assetType}` -> Map of assetId -> count

/**
 * Resolves active subscription state and cycle window for a business.
 */
export async function getBusinessSubscriptionState(businessId, userEmail = null) {
  const normEmail = (userEmail || "").toLowerCase().trim();
  const isSuperAdmin =
    normEmail === "ndantare@gmail.com" ||
    normEmail === process.env.OWNER_EMAIL?.toLowerCase();

  if (isSuperAdmin) {
    const plan = getPlanConfig("agency");
    const now = new Date();
    const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    return {
      status: "active",
      planId: "agency",
      plan,
      isUnlimited: true,
      cycleStart,
      cycleEnd,
      nextResetDate: cycleEnd,
    };
  }

  // 1. Try Supabase subscriptions table (Database as source of truth)
  try {
    const { data: sub, error } = await supabaseServer
      .from("subscriptions")
      .select("plan_id, status, cycle_start, cycle_end, current_period_end")
      .eq("business_id", businessId)
      .maybeSingle();

    if (!error && sub) {
      const planId = (sub.plan_id || "try").toLowerCase();
      const plan = getPlanConfig(planId);
      const now = new Date();
      const cycleStart = sub.cycle_start || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const cycleEnd = sub.cycle_end || sub.current_period_end || new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

      return {
        status: sub.status || "active",
        planId,
        plan,
        isUnlimited: false,
        cycleStart,
        cycleEnd,
        nextResetDate: cycleEnd,
      };
    }
  } catch (err) {
    console.warn("[QuotaService] Supabase subscription lookup warning:", err.message);
  }

  // 2. Fallback to Tenant Registry (Multi-tenant config)
  if (normEmail) {
    try {
      const registry = await getTenantRegistry();
      const tenant = registry[normEmail];
      if (tenant?.subscription) {
        const planId = (tenant.subscription.plan || "none").toLowerCase();
        const plan = getPlanConfig(planId);
        const cycleStart = tenant.subscription.startDate || new Date().toISOString();
        const cycleEnd = tenant.subscription.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        return {
          status: tenant.subscription.status || (planId === "none" ? "inactive" : (tenant.isSuspended ? "suspended" : "active")),
          planId,
          plan,
          isUnlimited: false,
          cycleStart,
          cycleEnd,
          nextResetDate: cycleEnd,
        };
      }
    } catch (regErr) {
      console.warn("[QuotaService] Tenant registry fallback warning:", regErr.message);
    }
  }

  // 3. Sensible default: NONE (Free Trial mode) for unconfigured businesses
  const defaultPlan = getPlanConfig("none");
  const now = new Date();
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  return {
    status: "inactive",
    planId: "none",
    plan: defaultPlan,
    isUnlimited: false,
    cycleStart,
    cycleEnd,
    nextResetDate: cycleEnd,
  };
}

/**
 * Retrieves current cycle usage summary across all actions for a business.
 */
export async function getBusinessMonthlyUsage(businessIdOrOpts, maybeCycleStart) {
  const businessId = typeof businessIdOrOpts === "object" ? businessIdOrOpts.businessId : businessIdOrOpts;
  let cycleStart = typeof businessIdOrOpts === "object" ? businessIdOrOpts.cycleStart : maybeCycleStart;

  if (!cycleStart) {
    const now = new Date();
    cycleStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }

  const usage = {
    SEO_ARTICLE: 0,
    SOCIAL_POST: 0,
    META_CAMPAIGN: 0,
    GOOGLE_CAMPAIGN: 0,
    IMAGE_GENERATION: 0,
    AI_QUERY: 0,
    seoArticlesUsed: 0,
    socialPostsUsed: 0,
    metaCampaignsUsed: 0,
    googleCampaignsUsed: 0,
    imagesUsed: 0,
    aiQueriesUsed: 0,
  };

  try {
    const { data: rows, error } = await supabaseServer
      .from("monthly_service_usage")
      .select("action_type, used_count")
      .eq("business_id", businessId)
      .eq("cycle_start", cycleStart);

    if (!error && Array.isArray(rows)) {
      rows.forEach((r) => {
        if (usage.hasOwnProperty(r.action_type)) {
          usage[r.action_type] = Number(r.used_count) || 0;
        }
      });
    }
  } catch (err) {
    // If table doesn't exist yet, query fallback
    console.warn("[QuotaService] Monthly usage query warning:", err.message);
  }

  // Merge fallback in-memory usage
  for (const act of ["SEO_ARTICLE", "SOCIAL_POST", "META_CAMPAIGN", "GOOGLE_CAMPAIGN", "IMAGE_GENERATION", "AI_QUERY"]) {
    const memKey = `${businessId}:${cycleStart}:${act}`;
    const memVal = fallbackUsageStore.get(memKey) || 0;
    if (memVal > usage[act]) {
      usage[act] = memVal;
    }
  }

  usage.seoArticlesUsed = usage.SEO_ARTICLE;
  usage.socialPostsUsed = usage.SOCIAL_POST;
  usage.metaCampaignsUsed = usage.META_CAMPAIGN;
  usage.googleCampaignsUsed = usage.GOOGLE_CAMPAIGN;
  usage.imagesUsed = usage.IMAGE_GENERATION;
  usage.aiQueriesUsed = usage.AI_QUERY;

  return usage;
}

/**
 * Retrieves per-asset usage for a given business, cycle, and asset type.
 */
export async function getAssetSlotUsage(businessId, cycleStart, assetType) {
  const assetMap = new Map();
  try {
    const { data: rows } = await supabaseServer
      .from("monthly_asset_usage")
      .select("asset_id, used_count")
      .eq("business_id", businessId)
      .eq("cycle_start", cycleStart)
      .eq("asset_type", assetType);

    if (Array.isArray(rows)) {
      rows.forEach((r) => {
        assetMap.set(String(r.asset_id).trim().toLowerCase(), Number(r.used_count) || 0);
      });
    }
  } catch (_) {}

  // Also query durable monthly_service_usage with ASSET:: prefix
  try {
    const assetPrefix = `ASSET::${assetType}::`;
    const { data: svcRows } = await supabaseServer
      .from("monthly_service_usage")
      .select("action_type, used_count")
      .eq("business_id", businessId)
      .eq("cycle_start", cycleStart)
      .like("action_type", `${assetPrefix}%`);

    if (Array.isArray(svcRows)) {
      svcRows.forEach((r) => {
        const id = r.action_type.slice(assetPrefix.length).trim().toLowerCase();
        if (id && !assetMap.has(id)) {
          assetMap.set(id, Number(r.used_count) || 0);
        }
      });
    }
  } catch (_) {}

  // Merge fallback in-memory asset store
  const memKey = `${businessId}:${cycleStart}:${assetType}`;
  const memMap = fallbackAssetUsageStore.get(memKey);
  if (memMap) {
    for (const [id, count] of memMap.entries()) {
      const existing = assetMap.get(id) || 0;
      if (count > existing) assetMap.set(id, count);
    }
  }
  return assetMap;
}

/**
 * Validates whether an asset (website, social page, ad account) can perform an action,
 * locking the slot upon first non-test use and enforcing per-asset limits (no mixed pools).
 */
export async function checkAssetSlotQuota({ businessId, cycleStart, assetType, assetId, plan }) {
  if (!assetId || !plan) return { allowed: true };
  const cleanAssetId = String(assetId).trim().toLowerCase();

  const maxSlotsMap = {
    social_brand: plan.limits?.maxSocialBrands ?? 1,
    wordpress_site: plan.limits?.maxWordPressSites ?? 1,
    google_ads: plan.limits?.maxAdAccounts ?? 1,
    meta_ads: plan.limits?.maxAdAccounts ?? 1,
    gmb_location: plan.limits?.maxGmbLocations ?? 0,
  };

  const perAssetMaxMap = {
    social_brand: plan.perAssetQuotas?.postsPerBrand ?? 30,
    wordpress_site: plan.perAssetQuotas?.blogsPerSite ?? 30,
    google_ads: plan.perAssetQuotas?.googleAdsPerAccount ?? 2,
    meta_ads: plan.perAssetQuotas?.metaAdsPerAccount ?? 2,
    gmb_location: plan.perAssetQuotas?.gmbLocations ?? 1,
  };

  const maxSlots = maxSlotsMap[assetType] ?? 1;
  const perAssetMax = perAssetMaxMap[assetType] ?? 30;

  const assetUsageMap = await getAssetSlotUsage(businessId, cycleStart, assetType);
  const isAlreadyLocked = assetUsageMap.has(cleanAssetId);

  // If already locked, check this specific asset's isolated counter
  if (isAlreadyLocked) {
    const currentAssetUsage = assetUsageMap.get(cleanAssetId) || 0;
    if (currentAssetUsage >= perAssetMax) {
      const labelMap = {
        social_brand: "social posts",
        wordpress_site: "blog posts",
        google_ads: "Google Ads campaigns",
        meta_ads: "Meta Ads campaigns",
      };
      return {
        allowed: false,
        code: ENTITLEMENT_ERROR_CODES.MONTHLY_QUOTA_EXHAUSTED,
        reasonCode: ENTITLEMENT_ERROR_CODES.MONTHLY_QUOTA_EXHAUSTED,
        error: `This specific ${assetType.replace("_", " ")} (${assetId}) has reached its monthly allowance of ${perAssetMax} ${labelMap[assetType] || "actions"} on the ${plan.name} plan.`,
        assetId,
        used: currentAssetUsage,
        quota: perAssetMax,
      };
    }
    return { allowed: true, isNewSlot: false, currentAssetUsage };
  }

  // If not yet locked, check if there is an open slot allowed
  const currentLockedCount = assetUsageMap.size;
  if (currentLockedCount >= maxSlots) {
    const lockedNames = Array.from(assetUsageMap.keys()).join(", ");
    return {
      allowed: false,
      code: ENTITLEMENT_ERROR_CODES.RESOURCE_LIMIT_REACHED,
      reasonCode: ENTITLEMENT_ERROR_CODES.RESOURCE_LIMIT_REACHED,
      error: `You have reached your limit of ${maxSlots} active ${assetType.replace("_", " ")}(s) for this plan (Currently locked: ${lockedNames || "max reached"}). Please upgrade your plan to unlock more slots.`,
      maxSlots,
      currentLockedCount,
    };
  }

  return { allowed: true, isNewSlot: true, currentAssetUsage: 0 };
}

/**
 * Checks if an action is entitled and whether quota remains.
 * DOES NOT reserve or mutate state.
 */
export async function checkActionEntitlement({
  session,
  userEmail,
  businessId,
  actionType,
  action,
  assetId = null,
  isTestPost = false,
  subscriptionOverride,
}) {
  const act = actionType || action;
  const normEmail = (userEmail || session?.user?.email || "").toLowerCase().trim();
  const isSuperAdmin =
    normEmail === "ndantare@gmail.com" ||
    normEmail === process.env.OWNER_EMAIL?.toLowerCase() ||
    session?.user?.role === "owner";

  if (isSuperAdmin) {
    return {
      allowed: true,
      isUnlimited: true,
      planId: "owner",
      quota: 999999,
      used: 0,
      remaining: 999999,
    };
  }

  // 1. Resolve business ID if needed
  let effectiveBizId = businessId;
  if (!effectiveBizId && session) {
    try {
      const bizContext = await resolveActiveBusiness(session);
      effectiveBizId = bizContext.businessId;
    } catch (_) {
      effectiveBizId = `biz_${normEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
    }
  }

  if (!effectiveBizId) {
    effectiveBizId = `biz_${normEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
  }

  // 2. Fetch subscription & plan configuration
  let subState;
  if (subscriptionOverride) {
    const pId = (subscriptionOverride.planId || "try").toLowerCase();
    const p = getPlanConfig(pId);
    const now = new Date();
    subState = {
      status: subscriptionOverride.status || "active",
      planId: pId,
      plan: p,
      isUnlimited: false,
      cycleStart: subscriptionOverride.cycleStart || new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      cycleEnd: subscriptionOverride.cycleEnd || new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
      nextResetDate: subscriptionOverride.cycleEnd || new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
    };
  } else {
    subState = await getBusinessSubscriptionState(effectiveBizId, normEmail);
  }

  if (subState.status === "suspended" || subState.status === "canceled" || subState.status === "expired") {
    return {
      allowed: false,
      code: ENTITLEMENT_ERROR_CODES.SUBSCRIPTION_INACTIVE,
      reasonCode: ENTITLEMENT_ERROR_CODES.SUBSCRIPTION_INACTIVE,
      error: `Your subscription is currently ${subState.status}. Please renew your plan.`,
      planId: subState.planId,
    };
  }

  // Check expiration
  if (subState.cycleEnd) {
    const expTime = new Date(subState.cycleEnd).getTime();
    if (!isNaN(expTime) && Date.now() > expTime) {
      return {
        allowed: false,
        code: ENTITLEMENT_ERROR_CODES.SUBSCRIPTION_INACTIVE,
        reasonCode: ENTITLEMENT_ERROR_CODES.SUBSCRIPTION_INACTIVE,
        error: "Your subscription period has ended. Please renew to continue.",
        planId: subState.planId,
      };
    }
  }

  // 3. Check Feature Inclusion
  const plan = subState.plan;
  const featureKeyMap = {
    SEO_ARTICLE: "SEO",
    SEO_AUTOPILOT: "SEO_AUTOPILOT",
    SOCIAL_POST: "SOCIAL",
    SOCIAL_AUTOPILOT: "SOCIAL_AUTOPILOT",
    META_CAMPAIGN: "META_ADS",
    GOOGLE_CAMPAIGN: "GOOGLE_ADS",
    GMB: "GMB",
    GMB_AUTOPILOT: "GMB_AUTOPILOT",
    IMAGE_GENERATION: "IMAGE_GENERATION",
    AI_QUERY: "AI_CHAT",
  };

  const requiredFeature = featureKeyMap[act];
  if (requiredFeature && !plan.features[requiredFeature]) {
    const featureLabels = {
      META_ADS: "Meta Ads Campaigns",
      GOOGLE_ADS: "Google Ads Campaigns",
      SEO_AUTOPILOT: "SEO Autopilot",
      SOCIAL_AUTOPILOT: "Social Planner Autopilot",
      GMB: "Google Business Profile (GMB)",
      GMB_AUTOPILOT: "GMB Review & Maps Autopilot",
    };
    return {
      allowed: false,
      code: ENTITLEMENT_ERROR_CODES.FEATURE_NOT_INCLUDED,
      reasonCode: ENTITLEMENT_ERROR_CODES.FEATURE_NOT_INCLUDED,
      error: `${featureLabels[requiredFeature] || requiredFeature} is not included in the ${plan.name} plan. Upgrade to unlock this feature.`,
      planId: subState.planId,
      requiredPlan: "growth",
    };
  }

  // 4. Check Monthly Quota Allowance
  const quotaLimit = plan.quotas[act] ?? (act === "SEO_AUTOPILOT" || act === "SOCIAL_AUTOPILOT" ? 999 : 0);
  if (quotaLimit <= 0) {
    return {
      allowed: false,
      code: ENTITLEMENT_ERROR_CODES.FEATURE_NOT_INCLUDED,
      reasonCode: ENTITLEMENT_ERROR_CODES.FEATURE_NOT_INCLUDED,
      error: `This action is not available on your current plan.`,
      planId: subState.planId,
    };
  }

  // 5. Query current usage
  const usage = await getBusinessMonthlyUsage(effectiveBizId, subState.cycleStart);
  const currentUsed = usage[act] || 0;

  // Include in-flight active reservations
  const inFlightKey = `${effectiveBizId}:${subState.cycleStart}:${act}`;
  const inFlightCount = activeReservations.get(inFlightKey) || 0;
  const totalReservedAndUsed = currentUsed + inFlightCount;

  if (totalReservedAndUsed >= quotaLimit) {
    const actionLabels = {
      SEO_ARTICLE: "free test SEO blog",
      SOCIAL_POST: "free test social post",
      META_CAMPAIGN: "Meta Ads campaigns",
      GOOGLE_CAMPAIGN: "Google Ads campaigns",
      IMAGE_GENERATION: "free AI image",
      AI_QUERY: "free AI query",
    };
    const isTrial = (subState.planId || "").toLowerCase() === "none" || (subState.planId || "").toLowerCase() === "try";
    const label = actionLabels[act] || act;
    const errorMsg = isTrial
      ? `You have already used your 1 ${label} included in the Free Trial. Please subscribe to a plan to continue.`
      : `You have reached your monthly allowance of ${quotaLimit} ${label} on the ${plan.name} plan. Usage resets on ${new Date(subState.nextResetDate).toLocaleDateString()}, or you can upgrade your plan.`;

    return {
      allowed: false,
      code: ENTITLEMENT_ERROR_CODES.MONTHLY_QUOTA_EXHAUSTED,
      reasonCode: ENTITLEMENT_ERROR_CODES.MONTHLY_QUOTA_EXHAUSTED,
      error: errorMsg,
      planId: subState.planId,
      quota: quotaLimit,
      used: currentUsed,
      remaining: 0,
      nextResetDate: subState.nextResetDate,
      requiresSubscription: isTrial,
    };
  }

  // 6. Check Asset-Level Slot Locking & Per-Asset Allowance (Strict Per-Asset Isolation)
  if (assetId && !isTestPost) {
    const assetTypeMap = {
      SOCIAL_POST: "social_brand",
      SEO_ARTICLE: "wordpress_site",
      GOOGLE_CAMPAIGN: "google_ads",
      META_CAMPAIGN: "meta_ads",
    };
    const mappedAssetType = assetTypeMap[act];
    if (mappedAssetType) {
      const assetCheck = await checkAssetSlotQuota({
        businessId: effectiveBizId,
        cycleStart: subState.cycleStart,
        assetType: mappedAssetType,
        assetId,
        plan,
      });
      if (!assetCheck.allowed) {
        return {
          ...assetCheck,
          planId: subState.planId,
          nextResetDate: subState.nextResetDate,
        };
      }
    }
  }

  return {
    allowed: true,
    planId: subState.planId,
    planName: plan.name,
    businessId: effectiveBizId,
    cycleStart: subState.cycleStart,
    cycleEnd: subState.cycleEnd,
    quota: quotaLimit,
    used: currentUsed,
    remaining: Math.max(0, quotaLimit - totalReservedAndUsed),
    nextResetDate: subState.nextResetDate,
  };
}

/**
 * Atomically reserves a slot before executing an operation.
 * RESERVE -> EXECUTE -> COMMIT / RELEASE.
 */
export async function reserveQuota({
  session,
  userEmail,
  businessId,
  actionType,
  action,
  assetId = null,
  isTestPost = false,
  idempotencyKey = null,
  subscriptionOverride,
}) {
  const act = actionType || action;
  const normEmail = (userEmail || session?.user?.email || "").toLowerCase().trim();
  const isSuperAdmin =
    normEmail === "ndantare@gmail.com" ||
    normEmail === process.env.OWNER_EMAIL?.toLowerCase() ||
    session?.user?.role === "owner";

  if (isSuperAdmin) {
    const adminResId = `admin_res_${Date.now()}`;
    return {
      ok: true,
      success: true,
      reservationId: adminResId,
      isUnlimited: true,
      businessId: businessId || "admin_workspace",
    };
  }

  // Pre-flight check
  const check = await checkActionEntitlement({
    session,
    userEmail,
    businessId,
    actionType: act,
    assetId,
    isTestPost,
    subscriptionOverride,
  });

  if (!check.allowed) {
    return {
      ok: false,
      success: false,
      code: check.code,
      reasonCode: check.reasonCode || check.code,
      error: check.error,
      planId: check.planId,
      requiredPlan: check.requiredPlan,
      nextResetDate: check.nextResetDate,
      requiresSubscription: Boolean(check.requiresSubscription),
    };
  }

  const effectiveBizId = check.businessId;
  const cycleStart = check.cycleStart;
  const inFlightKey = `${effectiveBizId}:${cycleStart}:${act}`;

  // Atomic in-memory increment to prevent race conditions during parallel requests
  const currentInFlight = activeReservations.get(inFlightKey) || 0;
  if (check.used + currentInFlight >= check.quota) {
    return {
      ok: false,
      success: false,
      code: ENTITLEMENT_ERROR_CODES.MONTHLY_QUOTA_EXHAUSTED,
      reasonCode: ENTITLEMENT_ERROR_CODES.MONTHLY_QUOTA_EXHAUSTED,
      error: `All available slots are currently in use or exhausted. Please wait or upgrade.`,
    };
  }

  activeReservations.set(inFlightKey, currentInFlight + 1);

  const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  activeReservationRecords.set(reservationId, {
    businessId: effectiveBizId,
    cycleStart,
    actionType: act,
    assetId: assetId || null,
    isTestPost: Boolean(isTestPost),
  });

  return {
    ok: true,
    success: true,
    reservationId,
    businessId: effectiveBizId,
    cycleStart,
    actionType: act,
    quota: check.quota,
    remaining: Math.max(0, check.remaining - 1),
  };
}

/**
 * Commits the reserved quota into persistent database storage after successful execution.
 */
export async function commitQuota({
  reservationId,
  businessId,
  cycleStart,
  actionType,
  action,
  assetId = null,
  isTestPost = false,
  userEmail,
  idempotencyKey = null,
}) {
  let effectiveBizId = businessId;
  let effectiveCycleStart = cycleStart;
  let effectiveAction = actionType || action;
  let effectiveAssetId = assetId;
  let effectiveIsTestPost = isTestPost;

  if (reservationId && activeReservationRecords.has(reservationId)) {
    const rec = activeReservationRecords.get(reservationId);
    effectiveBizId = effectiveBizId || rec.businessId;
    effectiveCycleStart = effectiveCycleStart || rec.cycleStart;
    effectiveAction = effectiveAction || rec.actionType;
    effectiveAssetId = effectiveAssetId || rec.assetId;
    if (rec.isTestPost !== undefined) effectiveIsTestPost = rec.isTestPost;
    activeReservationRecords.delete(reservationId);
  }

  if (!effectiveBizId || !effectiveAction) return;
  const inFlightKey = `${effectiveBizId}:${effectiveCycleStart}:${effectiveAction}`;

  // Decrement in-flight count
  const currentInFlight = activeReservations.get(inFlightKey) || 1;
  activeReservations.set(inFlightKey, Math.max(0, currentInFlight - 1));

  // If this is a free test post, do not increment usage counters or lock slot
  if (effectiveIsTestPost) {
    return;
  }

  // Update fallback in-memory usage
  const memKey = `${effectiveBizId}:${effectiveCycleStart}:${effectiveAction}`;
  const prevMem = fallbackUsageStore.get(memKey) || 0;
  fallbackUsageStore.set(memKey, prevMem + 1);

  // Update per-asset usage & slot lock
  if (effectiveAssetId) {
    const assetTypeMap = {
      SOCIAL_POST: "social_brand",
      SEO_ARTICLE: "wordpress_site",
      GOOGLE_CAMPAIGN: "google_ads",
      META_CAMPAIGN: "meta_ads",
    };
    const mappedAssetType = assetTypeMap[effectiveAction];
    if (mappedAssetType) {
      const cleanId = String(effectiveAssetId).trim().toLowerCase();
      const assetMemKey = `${effectiveBizId}:${effectiveCycleStart}:${mappedAssetType}`;
      if (!fallbackAssetUsageStore.has(assetMemKey)) {
        fallbackAssetUsageStore.set(assetMemKey, new Map());
      }
      const m = fallbackAssetUsageStore.get(assetMemKey);
      m.set(cleanId, (m.get(cleanId) || 0) + 1);

      try {
        const { data: existingAsset } = await supabaseServer
          .from("monthly_asset_usage")
          .select("id, used_count")
          .eq("business_id", effectiveBizId)
          .eq("cycle_start", effectiveCycleStart)
          .eq("asset_type", mappedAssetType)
          .eq("asset_id", cleanId)
          .maybeSingle();

        if (existingAsset) {
          await supabaseServer
            .from("monthly_asset_usage")
            .update({
              used_count: (existingAsset.used_count || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingAsset.id);
        } else {
          await supabaseServer.from("monthly_asset_usage").insert({
            business_id: effectiveBizId,
            cycle_start: effectiveCycleStart,
            asset_type: mappedAssetType,
            asset_id: cleanId,
            used_count: 1,
            created_at: new Date().toISOString(),
          });
        }
      } catch (_) {}

      // Dual write to monthly_service_usage with ASSET:: prefix for guaranteed persistence
      try {
        const assetActionType = `ASSET::${mappedAssetType}::${cleanId}`;
        const { data: existingSvcAsset } = await supabaseServer
          .from("monthly_service_usage")
          .select("id, used_count")
          .eq("business_id", effectiveBizId)
          .eq("cycle_start", effectiveCycleStart)
          .eq("action_type", assetActionType)
          .maybeSingle();

        if (existingSvcAsset) {
          await supabaseServer
            .from("monthly_service_usage")
            .update({
              used_count: (existingSvcAsset.used_count || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingSvcAsset.id);
        } else {
          await supabaseServer.from("monthly_service_usage").insert({
            business_id: effectiveBizId,
            cycle_start: effectiveCycleStart,
            action_type: assetActionType,
            used_count: 1,
            created_at: new Date().toISOString(),
          });
        }
      } catch (_) {}
    }
  }

  try {
    // 1. Increment usage row in monthly_service_usage
    const { data: existing } = await supabaseServer
      .from("monthly_service_usage")
      .select("id, used_count")
      .eq("business_id", effectiveBizId)
      .eq("cycle_start", effectiveCycleStart)
      .eq("action_type", effectiveAction)
      .maybeSingle();

    if (existing) {
      await supabaseServer
        .from("monthly_service_usage")
        .update({
          used_count: (existing.used_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabaseServer.from("monthly_service_usage").insert({
        business_id: effectiveBizId,
        cycle_start: effectiveCycleStart,
        action_type: effectiveAction,
        used_count: 1,
        created_at: new Date().toISOString(),
      });
    }

    // 2. Record immutable audit ledger entry
    await supabaseServer.from("usage_ledger").insert({
      business_id: effectiveBizId,
      user_email: userEmail || "system",
      action_type: effectiveAction,
      cycle_start: effectiveCycleStart,
      idempotency_key: idempotencyKey,
      status: "committed",
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[QuotaService] Commit persistent recording warning:", err.message);
  }
}

/**
 * Releases the reserved quota if external AI generation or publishing fails.
 */
export async function releaseQuota({
  reservationId,
  businessId,
  cycleStart,
  actionType,
  action,
  reason = "Operation failed",
}) {
  let effectiveBizId = businessId;
  let effectiveCycleStart = cycleStart;
  let effectiveAction = actionType || action;

  if (reservationId && activeReservationRecords.has(reservationId)) {
    const rec = activeReservationRecords.get(reservationId);
    effectiveBizId = effectiveBizId || rec.businessId;
    effectiveCycleStart = effectiveCycleStart || rec.cycleStart;
    effectiveAction = effectiveAction || rec.actionType;
    activeReservationRecords.delete(reservationId);
  }

  if (!effectiveBizId || !effectiveAction) return;
  const inFlightKey = `${effectiveBizId}:${effectiveCycleStart}:${effectiveAction}`;

  // Decrement in-flight count immediately
  const currentInFlight = activeReservations.get(inFlightKey) || 1;
  activeReservations.set(inFlightKey, Math.max(0, currentInFlight - 1));

  console.log(`[QuotaService] Released quota reservation ${reservationId || "direct"} for ${effectiveAction} (${reason}).`);
}
