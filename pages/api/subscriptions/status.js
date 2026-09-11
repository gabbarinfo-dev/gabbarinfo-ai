// pages/api/subscriptions/status.js
/**
 * Authoritative Server-Side Subscription Status & Usage API
 * 
 * Returns the active business subscription, plan metadata, monthly service quotas,
 * real-time usage counters, remaining allowances, and simultaneous resource usage.
 * 
 * NO RAW INTERNAL CREDITS EXPOSED TO CUSTOMER.
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { resolveActiveBusiness } from "../../../lib/auth/business-context";
import { getBusinessSubscriptionState, getBusinessMonthlyUsage } from "../../../lib/billing/quota-service";
import { supabaseServer } from "../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userEmail = session.user.email.toLowerCase().trim();
    const isOwner =
      session.user.role === "owner" ||
      userEmail === "ndantare@gmail.com" ||
      userEmail === process.env.OWNER_EMAIL?.toLowerCase();

    // 1. Resolve active business context
    const requestedBizId = req.query?.businessId || null;
    let businessContext = null;
    try {
      businessContext = await resolveActiveBusiness(session, requestedBizId);
    } catch (_) {
      businessContext = {
        businessId: `biz_${userEmail.replace(/[^a-zA-Z0-9]/g, "_")}`,
        businessName: "Primary Workspace",
        isSuperAdmin: isOwner,
      };
    }

    const businessId = businessContext.businessId;

    // 2. Fetch subscription & plan configuration
    const subState = await getBusinessSubscriptionState(businessId, userEmail);
    const plan = subState.plan;

    // 3. Fetch monthly usage counters for current cycle
    const usage = await getBusinessMonthlyUsage(businessId, subState.cycleStart);

    // 4. Fetch simultaneous resource connections
    // Count WordPress connections
    const { data: wpRows } = await supabaseServer
      .from("agent_memory")
      .select("memory_type")
      .eq("email", userEmail)
      .like("memory_type", "wp_conn_%");
    const wpCount = (wpRows || []).length;

    // Count Facebook / Instagram connection
    const { data: metaConn } = await supabaseServer
      .from("meta_connections")
      .select("fb_page_id, ig_business_id, instagram_actor_id")
      .ilike("email", userEmail)
      .maybeSingle();

    const fbCount = metaConn?.fb_page_id ? 1 : 0;
    const igCount = (metaConn?.ig_business_id || metaConn?.instagram_actor_id) ? 1 : 0;

    // Construct response
    const statusPayload = {
      ok: true,
      business: {
        id: businessId,
        name: businessContext.businessName,
      },
      subscription: {
        status: subState.status,
        planId: subState.planId,
        planName: plan.name,
        priceINR: plan.priceINR,
        billingCycle: plan.billingCycle,
        cycleStart: subState.cycleStart,
        cycleEnd: subState.cycleEnd,
        nextResetDate: subState.nextResetDate,
        isUnlimited: subState.isUnlimited || isOwner,
      },
      quotas: {
        seoArticles: {
          label: "SEO Articles",
          used: isOwner ? usage.SEO_ARTICLE : Math.min(usage.SEO_ARTICLE, plan.quotas.SEO_ARTICLE),
          limit: isOwner ? "Unlimited" : plan.quotas.SEO_ARTICLE,
          remaining: isOwner ? 9999 : Math.max(0, plan.quotas.SEO_ARTICLE - usage.SEO_ARTICLE),
          included: plan.quotas.SEO_ARTICLE > 0,
        },
        socialPosts: {
          label: "Social Posts",
          used: isOwner ? usage.SOCIAL_POST : Math.min(usage.SOCIAL_POST, plan.quotas.SOCIAL_POST),
          limit: isOwner ? "Unlimited" : plan.quotas.SOCIAL_POST,
          remaining: isOwner ? 9999 : Math.max(0, plan.quotas.SOCIAL_POST - usage.SOCIAL_POST),
          included: plan.quotas.SOCIAL_POST > 0,
        },
        metaCampaigns: {
          label: "Meta Ads Campaigns",
          used: isOwner ? usage.META_CAMPAIGN : Math.min(usage.META_CAMPAIGN, plan.quotas.META_CAMPAIGN),
          limit: isOwner ? "Unlimited" : plan.quotas.META_CAMPAIGN,
          remaining: isOwner ? 9999 : Math.max(0, plan.quotas.META_CAMPAIGN - usage.META_CAMPAIGN),
          included: plan.quotas.META_CAMPAIGN > 0,
        },
        googleCampaigns: {
          label: "Google Ads Campaigns",
          used: isOwner ? usage.GOOGLE_CAMPAIGN : Math.min(usage.GOOGLE_CAMPAIGN, plan.quotas.GOOGLE_CAMPAIGN),
          limit: isOwner ? "Unlimited" : plan.quotas.GOOGLE_CAMPAIGN,
          remaining: isOwner ? 9999 : Math.max(0, plan.quotas.GOOGLE_CAMPAIGN - usage.GOOGLE_CAMPAIGN),
          included: plan.quotas.GOOGLE_CAMPAIGN > 0,
        },
        images: {
          label: "AI Images",
          used: isOwner ? usage.IMAGE_GENERATION : Math.min(usage.IMAGE_GENERATION, plan.quotas.IMAGE_GENERATION),
          limit: isOwner ? "Unlimited" : plan.quotas.IMAGE_GENERATION,
          remaining: isOwner ? 9999 : Math.max(0, plan.quotas.IMAGE_GENERATION - usage.IMAGE_GENERATION),
          included: plan.quotas.IMAGE_GENERATION > 0,
        },
        aiQueries: {
          label: "AI Queries",
          used: isOwner ? usage.AI_QUERY : Math.min(usage.AI_QUERY, plan.quotas.AI_QUERY),
          limit: isOwner ? "Unlimited" : plan.quotas.AI_QUERY,
          remaining: isOwner ? 9999 : Math.max(0, plan.quotas.AI_QUERY - usage.AI_QUERY),
          included: plan.quotas.AI_QUERY > 0,
        },
      },
      resources: {
        businesses: {
          used: 1,
          limit: isOwner ? 999 : plan.limits.maxBusinesses,
        },
        wordpressSites: {
          used: wpCount,
          limit: isOwner ? 999 : plan.limits.maxWordPressSites,
        },
        facebookPages: {
          used: fbCount,
          limit: isOwner ? 999 : plan.limits.maxFacebookPages,
        },
        instagramAccounts: {
          used: igCount,
          limit: isOwner ? 999 : plan.limits.maxInstagramAccounts,
        },
        gmbLocations: {
          used: 0,
          limit: isOwner ? 999 : (plan.limits?.maxGmbLocations || 0),
        },
      },
      features: plan.features,
    };

    return res.status(200).json(statusPayload);
  } catch (err) {
    console.error("[API/Subscriptions/Status] Error:", err);
    return res.status(500).json({ error: "Failed to load subscription status", details: err.message });
  }
}
