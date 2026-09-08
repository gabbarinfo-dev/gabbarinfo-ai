// lib/billing/plans.js
/**
 * Authoritative Plan Configuration for GabbarInfo AI
 * 
 * Defines the 5 official subscription tiers, pricing, resource limits,
 * feature entitlements, and monthly service allowances.
 * 
 * SERVER-SIDE SOURCE OF TRUTH.
 * The frontend and all backend services MUST consume this configuration.
 */

export const SUBSCRIPTION_PLANS = {
  try: {
    id: "try",
    name: "TRY",
    priceINR: 499,
    billingCycle: "monthly",
    description: "Ideal for testing autonomous AI marketing and single-topic pilots.",
    limits: {
      maxBusinesses: 1,
      maxWordPressSites: 1,
      maxFacebookPages: 1,
      maxInstagramAccounts: 1,
    },
    features: {
      SEO: true,
      SEO_AUTOPILOT: false,
      SOCIAL: true,
      SOCIAL_AUTOPILOT: false,
      META_ADS: false,
      GOOGLE_ADS: false,
      IMAGE_GENERATION: true,
      AI_CHAT: true,
      AGENT_EXECUTION: false, // basic AI/query only, cannot execute restricted actions
    },
    quotas: {
      SEO_ARTICLE: 1,
      SOCIAL_POST: 4,
      META_CAMPAIGN: 0,
      GOOGLE_CAMPAIGN: 0,
      IMAGE_GENERATION: 2,
      AI_QUERY: 20,
    },
    supportedCadences: {
      seo: ["monthly"], // Flagship/Pillar only
      social: [], // No autopilot
    }
  },

  starter: {
    id: "starter",
    name: "STARTER",
    priceINR: 999,
    billingCycle: "monthly",
    description: "For small businesses building weekly authority and organic momentum.",
    limits: {
      maxBusinesses: 1,
      maxWordPressSites: 1,
      maxFacebookPages: 1,
      maxInstagramAccounts: 1,
    },
    features: {
      SEO: true,
      SEO_AUTOPILOT: true,
      SOCIAL: true,
      SOCIAL_AUTOPILOT: true,
      META_ADS: false,
      GOOGLE_ADS: false,
      IMAGE_GENERATION: true,
      AI_CHAT: true,
      AGENT_EXECUTION: true, // within starter features
    },
    quotas: {
      SEO_ARTICLE: 4,
      SOCIAL_POST: 4,
      META_CAMPAIGN: 0,
      GOOGLE_CAMPAIGN: 0,
      IMAGE_GENERATION: 5,
      AI_QUERY: 50,
    },
    supportedCadences: {
      seo: ["weekly", "monthly", "custom"], // max 4/mo
      social: ["weekly", "custom"], // max 4/mo
    }
  },

  growth: {
    id: "growth",
    name: "GROWTH",
    priceINR: 2499,
    billingCycle: "monthly",
    description: "High-velocity organic growth, ads automation, and comprehensive multi-channel campaigns.",
    limits: {
      maxBusinesses: 1,
      maxWordPressSites: 2,
      maxFacebookPages: 2,
      maxInstagramAccounts: 2,
    },
    features: {
      SEO: true,
      SEO_AUTOPILOT: true,
      SOCIAL: true,
      SOCIAL_AUTOPILOT: true,
      META_ADS: true,
      GOOGLE_ADS: true,
      IMAGE_GENERATION: true,
      AI_CHAT: true,
      AGENT_EXECUTION: true,
    },
    quotas: {
      SEO_ARTICLE: 30,
      SOCIAL_POST: 30,
      META_CAMPAIGN: 2,
      GOOGLE_CAMPAIGN: 2,
      IMAGE_GENERATION: 10,
      AI_QUERY: 150,
    },
    supportedCadences: {
      seo: ["daily", "weekly", "monthly", "custom"], // max 30/mo
      social: ["daily", "alternate", "weekly_4", "weekly", "custom"], // max 30/mo
    }
  },

  business: {
    id: "business",
    name: "BUSINESS",
    priceINR: 4999,
    billingCycle: "monthly",
    description: "Multi-brand automation supporting up to 2 completely isolated business workspaces.",
    limits: {
      maxBusinesses: 2,
      maxWordPressSites: 3, // per business
      maxFacebookPages: 3, // per business
      maxInstagramAccounts: 3, // per business
    },
    features: {
      SEO: true,
      SEO_AUTOPILOT: true,
      SOCIAL: true,
      SOCIAL_AUTOPILOT: true,
      META_ADS: true,
      GOOGLE_ADS: true,
      IMAGE_GENERATION: true,
      AI_CHAT: true,
      AGENT_EXECUTION: true,
    },
    quotas: {
      SEO_ARTICLE: 30, // per business
      SOCIAL_POST: 30, // per business
      META_CAMPAIGN: 5, // per business
      GOOGLE_CAMPAIGN: 5, // per business
      IMAGE_GENERATION: 20, // per business
      AI_QUERY: 300, // per business
    },
    supportedCadences: {
      seo: ["daily", "weekly", "monthly", "custom"],
      social: ["daily", "alternate", "weekly_4", "weekly", "custom"],
    }
  },

  agency: {
    id: "agency",
    name: "AGENCY",
    priceINR: 9999,
    billingCycle: "monthly",
    description: "Enterprise multi-client management supporting up to 5 fully isolated business workspaces.",
    limits: {
      maxBusinesses: 5,
      maxWordPressSites: 3, // per business
      maxFacebookPages: 3, // per business
      maxInstagramAccounts: 3, // per business
    },
    features: {
      SEO: true,
      SEO_AUTOPILOT: true,
      SOCIAL: true,
      SOCIAL_AUTOPILOT: true,
      META_ADS: true,
      GOOGLE_ADS: true,
      IMAGE_GENERATION: true,
      AI_CHAT: true,
      AGENT_EXECUTION: true,
    },
    quotas: {
      SEO_ARTICLE: 30, // per business
      SOCIAL_POST: 30, // per business
      META_CAMPAIGN: 5, // per business
      GOOGLE_CAMPAIGN: 5, // per business
      IMAGE_GENERATION: 20, // per business
      AI_QUERY: 300, // per business
    },
    supportedCadences: {
      seo: ["daily", "weekly", "monthly", "custom"],
      social: ["daily", "alternate", "weekly_4", "weekly", "custom"],
    }
  },
};

export const DEFAULT_PLAN_ID = "try";

/**
 * Returns plan configuration by ID or falls back to 'try'.
 */
export function getPlanConfig(planId) {
  const normId = (planId || "").toLowerCase().trim();
  return SUBSCRIPTION_PLANS[normId] || SUBSCRIPTION_PLANS[DEFAULT_PLAN_ID];
}

/**
 * Error codes mandated by specification
 */
export const ENTITLEMENT_ERROR_CODES = {
  FEATURE_NOT_INCLUDED: "FEATURE_NOT_INCLUDED",
  MONTHLY_QUOTA_EXHAUSTED: "MONTHLY_QUOTA_EXHAUSTED",
  RESOURCE_LIMIT_REACHED: "RESOURCE_LIMIT_REACHED",
  SUBSCRIPTION_INACTIVE: "SUBSCRIPTION_INACTIVE",
  BUSINESS_ACCESS_DENIED: "BUSINESS_ACCESS_DENIED",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  RATE_LIMITED: "RATE_LIMITED",
  EXECUTION_ALREADY_IN_PROGRESS: "EXECUTION_ALREADY_IN_PROGRESS",
  PROVIDER_EXECUTION_FAILED: "PROVIDER_EXECUTION_FAILED",
  INSUFFICIENT_INTERNAL_CREDIT: "INSUFFICIENT_INTERNAL_CREDIT",
};
