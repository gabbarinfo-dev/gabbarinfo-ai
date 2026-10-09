// lib/shopify/trial-guard.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const SHOPIFY_PLANS = {
  "free-trial": {
    name: "Free Trial",
    priceUSD: 0,
    blogLimit: 2,
    productOptLimit: 2,
    isTrial: true,
  },
  "starter-plan": {
    name: "Starter Plan",
    priceUSD: 5.99,
    blogLimit: 9,
    productOptLimit: 30,
    isTrial: false,
  },
  "growth-plan": {
    name: "Growth Plan",
    priceUSD: 8.99,
    blogLimit: 15,
    productOptLimit: 50,
    isTrial: false,
  },
  "pro-autopilot": {
    name: "Pro Autopilot",
    priceUSD: 10.99,
    blogLimit: 30,
    productOptLimit: 70,
    isTrial: false,
  },
};

/**
 * Normalizes shop domain to a safe database key string.
 */
export function normalizeShop(shop) {
  if (!shop) return "";
  return shop.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");
}

/**
 * Retrieves the store's current active Shopify subscription or Free Trial status.
 */
export async function getShopifyPlanState(shop) {
  const normShop = normalizeShop(shop);
  if (!normShop) {
    return {
      planId: "free-trial",
      plan: SHOPIFY_PLANS["free-trial"],
      trialExhausted: true,
      blogsUsed: 0,
      productOptsUsed: 0,
      isActive: false,
    };
  }

  // 1. Check if paid active subscription exists
  const { data: subRow } = await supabase
    .from("agent_memory")
    .select("content")
    .eq("memory_type", `shopify_sub_${normShop}`)
    .maybeSingle();

  if (subRow?.content) {
    try {
      const sub = JSON.parse(subRow.content);
      if (sub.status === "ACTIVE" && sub.planId && SHOPIFY_PLANS[sub.planId]) {
        // Active paid plan
        const plan = SHOPIFY_PLANS[sub.planId];
        const { data: usageRow } = await supabase
          .from("agent_memory")
          .select("content")
          .eq("memory_type", `shopify_usage_${normShop}_${sub.billingCycleId || "current"}`)
          .maybeSingle();

        const usage = usageRow?.content ? JSON.parse(usageRow.content) : { blogsUsed: 0, productOptsUsed: 0 };

        return {
          planId: sub.planId,
          plan,
          isPaid: true,
          isActive: true,
          trialExhausted: true, // Trial already bypassed
          subscriptionId: sub.subscriptionId,
          billingCycleId: sub.billingCycleId || "current",
          blogsUsed: usage.blogsUsed || 0,
          productOptsUsed: usage.productOptsUsed || 0,
          blogsRemaining: Math.max(0, plan.blogLimit - (usage.blogsUsed || 0)),
          productOptsRemaining: Math.max(0, plan.productOptLimit - (usage.productOptsUsed || 0)),
        };
      }
    } catch (e) {
      console.error("[trial-guard] Error parsing subscription JSON:", e);
    }
  }

  // 2. Fallback to Free Trial - Check lifetime trial usage
  const { data: trialRow } = await supabase
    .from("agent_memory")
    .select("content")
    .eq("memory_type", `shopify_trial_lifetime_${normShop}`)
    .maybeSingle();

  let trialUsage = { blogsUsed: 0, productOptsUsed: 0, trialExhausted: false };
  if (trialRow?.content) {
    try {
      trialUsage = JSON.parse(trialRow.content);
    } catch (e) {
      console.error("[trial-guard] Error parsing trial row:", e);
    }
  }

  const trialPlan = SHOPIFY_PLANS["free-trial"];
  const blogsUsed = trialUsage.blogsUsed || 0;
  const productOptsUsed = trialUsage.productOptsUsed || 0;

  // Strict lifetime lock: If 2 blogs AND 2 product optimizations used, or trialExhausted flag set
  const trialExhausted = Boolean(
    trialUsage.trialExhausted || (blogsUsed >= trialPlan.blogLimit && productOptsUsed >= trialPlan.productOptLimit)
  );

  return {
    planId: "free-trial",
    plan: trialPlan,
    isPaid: false,
    isActive: !trialExhausted,
    trialExhausted,
    blogsUsed,
    productOptsUsed,
    blogsRemaining: Math.max(0, trialPlan.blogLimit - blogsUsed),
    productOptsRemaining: Math.max(0, trialPlan.productOptLimit - productOptsUsed),
  };
}

/**
 * Checks if the store has quota to perform a blog post or product description optimization.
 */
export async function checkShopifyQuota(shop, actionType = "blog") {
  const state = await getShopifyPlanState(shop);

  if (actionType === "blog") {
    if (state.blogsRemaining <= 0) {
      return {
        allowed: false,
        reason: state.isPaid
          ? `You have reached your monthly limit of ${state.plan.blogLimit} blogs for the ${state.plan.name}. Please upgrade to publish more blogs.`
          : `Your one-time Free Trial of 2 blogs has been completed. Upgrade via your Shopify Bill to continue publishing blogs.`,
        state,
      };
    }
    return { allowed: true, state };
  }

  if (actionType === "product_opt") {
    if (state.productOptsRemaining <= 0) {
      return {
        allowed: false,
        reason: state.isPaid
          ? `You have reached your monthly limit of ${state.plan.productOptLimit} product optimizations for the ${state.plan.name}. Please upgrade to optimize more products.`
          : `Your one-time Free Trial of 2 product optimizations has been completed. Upgrade via your Shopify Bill to continue.`,
        state,
      };
    }
    return { allowed: true, state };
  }

  return { allowed: true, state };
}

/**
 * Increments the store's blog or product optimization usage count.
 * Enforces permanent lifetime lock once free trial allowances are met.
 */
export async function incrementShopifyUsage(shop, actionType = "blog") {
  const normShop = normalizeShop(shop);
  const state = await getShopifyPlanState(shop);

  if (state.isPaid) {
    // Paid subscription usage key
    const cycleKey = `shopify_usage_${normShop}_${state.billingCycleId || "current"}`;
    const newBlogsUsed = actionType === "blog" ? state.blogsUsed + 1 : state.blogsUsed;
    const newProductOptsUsed = actionType === "product_opt" ? state.productOptsUsed + 1 : state.productOptsUsed;

    await supabase.from("agent_memory").upsert(
      {
        email: `shop_${normShop}@gabbarinfo.internal`,
        memory_type: cycleKey,
        content: JSON.stringify({
          blogsUsed: newBlogsUsed,
          productOptsUsed: newProductOptsUsed,
          updatedAt: new Date().toISOString(),
        }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,memory_type" }
    );

    return {
      blogsUsed: newBlogsUsed,
      productOptsUsed: newProductOptsUsed,
      blogsRemaining: Math.max(0, state.plan.blogLimit - newBlogsUsed),
      productOptsRemaining: Math.max(0, state.plan.productOptLimit - newProductOptsUsed),
    };
  }

  // Free trial usage increment & lifetime lock
  const trialKey = `shopify_trial_lifetime_${normShop}`;
  const newBlogsUsed = actionType === "blog" ? state.blogsUsed + 1 : state.blogsUsed;
  const newProductOptsUsed = actionType === "product_opt" ? state.productOptsUsed + 1 : state.productOptsUsed;

  const trialExhausted = Boolean(
    newBlogsUsed >= SHOPIFY_PLANS["free-trial"].blogLimit &&
    newProductOptsUsed >= SHOPIFY_PLANS["free-trial"].productOptLimit
  );

  await supabase.from("agent_memory").upsert(
    {
      email: `shop_${normShop}@gabbarinfo.internal`,
      memory_type: trialKey,
      content: JSON.stringify({
        blogsUsed: newBlogsUsed,
        productOptsUsed: newProductOptsUsed,
        trialExhausted,
        lockedAt: trialExhausted ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email,memory_type" }
  );

  return {
    blogsUsed: newBlogsUsed,
    productOptsUsed: newProductOptsUsed,
    trialExhausted,
    blogsRemaining: Math.max(0, SHOPIFY_PLANS["free-trial"].blogLimit - newBlogsUsed),
    productOptsRemaining: Math.max(0, SHOPIFY_PLANS["free-trial"].productOptLimit - newProductOptsUsed),
  };
}
