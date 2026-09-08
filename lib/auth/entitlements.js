// lib/auth/entitlements.js
/**
 * Central Server-Side Entitlement & Permission Gateway for GabbarInfo AI
 *
 * Ensures that the active business subscription permits the requested feature.
 * The frontend NEVER decides access; this server-side gateway is the authoritative boundary.
 *
 * Super Admin (ndantare@gmail.com / owner) has platform-wide bypass with unlimited access.
 * Tenants are governed by per-business subscription features toggled by Admin or their plan.
 */

import { supabaseServer } from "../supabaseServer.js";
import { resolveActiveBusiness } from "./business-context.js";

export const FEATURES = {
  SEO: "SEO",
  SOCIAL: "SOCIAL",
  SOCIAL_PLANNER: "SOCIAL_PLANNER",
  META_ADS: "META_ADS",
  GOOGLE_ADS: "GOOGLE_ADS",
  IMAGE_GENERATION: "IMAGE_GENERATION",
  AI_CHAT: "AI_CHAT",
};

export const ALL_FEATURES = Object.values(FEATURES);

/**
 * Verifies whether the authenticated user's active business is entitled to use a feature.
 * @param {object} session - NextAuth session
 * @param {string|null} explicitBusinessId - Optional business_id
 * @param {string} featureKey - Key from FEATURES
 * @returns {Promise<{ allowed: boolean, businessId: string, businessName: string, isUnlimited?: boolean, error?: string }>}
 */
export async function verifyEntitlement(session, explicitBusinessId, featureKey) {
  if (!session?.user?.email) {
    return {
      allowed: false,
      businessId: null,
      businessName: null,
      error: "Authentication required.",
    };
  }

  const userEmail = session.user.email.toLowerCase().trim();

  // 1. Super Admin Authority Bypass:
  // ndantare@gmail.com or role: 'owner' has unlimited, unrestricted access to all services
  const isSuperAdmin =
    userEmail === "ndantare@gmail.com" ||
    userEmail === process.env.OWNER_EMAIL?.toLowerCase() ||
    session.user.role === "owner";

  // 2. Resolve business context
  let context;
  try {
    context = await resolveActiveBusiness(session, explicitBusinessId);
  } catch (bizErr) {
    return {
      allowed: false,
      businessId: null,
      businessName: null,
      error: bizErr.message,
    };
  }

  const { businessId, businessName } = context;

  if (isSuperAdmin) {
    return { allowed: true, isUnlimited: true, businessId, businessName };
  }

  // 3. Check Account-Level Suspension
  try {
    const { data: userLimit } = await supabaseServer
      .from("user_account_limits")
      .select("is_suspended")
      .eq("user_email", userEmail)
      .maybeSingle();

    if (userLimit?.is_suspended) {
      return {
        allowed: false,
        businessId,
        businessName,
        error: "Your account has been suspended by the platform administrator.",
      };
    }
  } catch (_) {}

  // 4. Query native Postgres 'subscriptions' table
  try {
    const { data: sub, error: subErr } = await supabaseServer
      .from("subscriptions")
      .select("status, features, tier, current_period_end")
      .eq("business_id", businessId)
      .maybeSingle();

    if (!subErr && sub) {
      if (sub.status === "suspended") {
        return {
          allowed: false,
          businessId,
          businessName,
          error: `The business workspace "${businessName}" has been suspended by administrator.`,
        };
      }

      if (sub.status === "canceled" || sub.status === "past_due") {
        return {
          allowed: false,
          businessId,
          businessName,
          error: `Subscription for "${businessName}" is ${sub.status}. Please renew your plan.`,
        };
      }

      const enabledFeatures = Array.isArray(sub.features) ? sub.features : ALL_FEATURES;
      if (!enabledFeatures.includes(featureKey)) {
        return {
          allowed: false,
          businessId,
          businessName,
          error: `The feature "${featureKey}" is disabled for this business. Please contact support or upgrade.`,
        };
      }

      return { allowed: true, businessId, businessName };
    }
  } catch (err) {
    console.warn("[Entitlements] Subscriptions table query fallback:", err.message);
  }

  // 5. Default Universal Transition Access for active users:
  // Features are enabled unless explicitly toggled off
  return { allowed: true, businessId, businessName };
}
