// lib/billing/plans.js
/**
 * Authoritative Plan Configuration for GabbarInfo AI
 * 
 * Defines the official modular subscription tiers, pricing in INR,
 * asset-slot limits, per-asset isolated quotas, and feature entitlements.
 * 
 * SERVER-SIDE SOURCE OF TRUTH.
 * The frontend and all backend services MUST consume this configuration.
 */

export const SUBSCRIPTION_PLANS = {
  // ==========================================
  // 1. ALL-IN-ONE GROWTH SUITES
  // ==========================================
  suite_1: {
    id: "suite_1",
    category: "suite",
    name: "Solo Growth Suite (1 Business)",
    priceINR: 2499,
    billingCycle: "monthly",
    description: "Full AI marketing power for 1 business: 1 Website, 1 Social Brand (FB+IG), and 1 Ad Unit.",
    limits: {
      maxWordPressSites: 1,
      maxSocialBrands: 1,
      maxAdAccounts: 1,
      maxBusinesses: 1,
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
    perAssetQuotas: {
      blogsPerSite: 30,
      postsPerBrand: 30,
      googleAdsPerAccount: 2,
      metaAdsPerAccount: 2,
    },
    quotas: {
      SEO_ARTICLE: 30,
      SOCIAL_POST: 30,
      GOOGLE_CAMPAIGN: 2,
      META_CAMPAIGN: 2,
      IMAGE_GENERATION: 30,
      AI_QUERY: 150,
    },
    supportedCadences: {
      seo: ["daily", "weekly", "monthly", "custom"],
      social: ["daily", "alternate", "weekly_4", "weekly", "custom"],
    },
  },

  suite_2: {
    id: "suite_2",
    category: "suite",
    name: "Duo Growth Suite (2 Businesses)",
    priceINR: 4499,
    billingCycle: "monthly",
    description: "Complete AI marketing for 2 businesses: 2 Websites (30 blogs each), 2 Social Brands (30 posts each), 2 Ad Units (4 Google + 4 Meta Ads).",
    limits: {
      maxWordPressSites: 2,
      maxSocialBrands: 2,
      maxAdAccounts: 2,
      maxBusinesses: 2,
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
    perAssetQuotas: {
      blogsPerSite: 30,
      postsPerBrand: 30,
      googleAdsPerAccount: 2,
      metaAdsPerAccount: 2,
    },
    quotas: {
      SEO_ARTICLE: 60,
      SOCIAL_POST: 60,
      GOOGLE_CAMPAIGN: 4,
      META_CAMPAIGN: 4,
      IMAGE_GENERATION: 60,
      AI_QUERY: 300,
    },
    supportedCadences: {
      seo: ["daily", "weekly", "monthly", "custom"],
      social: ["daily", "alternate", "weekly_4", "weekly", "custom"],
    },
  },

  suite_3: {
    id: "suite_3",
    category: "suite",
    name: "Trio Growth Suite (3 Businesses)",
    priceINR: 6499,
    billingCycle: "monthly",
    description: "Complete AI marketing for 3 businesses: 3 Websites (30 blogs each), 3 Social Brands (30 posts each), 3 Ad Units (6 Google + 6 Meta Ads).",
    limits: {
      maxWordPressSites: 3,
      maxSocialBrands: 3,
      maxAdAccounts: 3,
      maxBusinesses: 3,
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
    perAssetQuotas: {
      blogsPerSite: 30,
      postsPerBrand: 30,
      googleAdsPerAccount: 2,
      metaAdsPerAccount: 2,
    },
    quotas: {
      SEO_ARTICLE: 90,
      SOCIAL_POST: 90,
      GOOGLE_CAMPAIGN: 6,
      META_CAMPAIGN: 6,
      IMAGE_GENERATION: 90,
      AI_QUERY: 450,
    },
    supportedCadences: {
      seo: ["daily", "weekly", "monthly", "custom"],
      social: ["daily", "alternate", "weekly_4", "weekly", "custom"],
    },
  },

  // ==========================================
  // 2. STANDALONE SEO SUITE (WORDPRESS AUTOPILOT)
  // ==========================================
  seo_1: {
    id: "seo_1",
    category: "seo",
    name: "SEO Solo (1 Website)",
    priceINR: 1299,
    billingCycle: "monthly",
    description: "Dedicated autonomous WordPress SEO suite for 1 website: 30 daily long-form blogs with AI visuals.",
    limits: {
      maxWordPressSites: 1,
      maxSocialBrands: 0,
      maxAdAccounts: 0,
      maxBusinesses: 1,
    },
    features: {
      SEO: true,
      SEO_AUTOPILOT: true,
      SOCIAL: false,
      SOCIAL_AUTOPILOT: false,
      META_ADS: false,
      GOOGLE_ADS: false,
      IMAGE_GENERATION: true,
      AI_CHAT: true,
      AGENT_EXECUTION: true,
    },
    perAssetQuotas: {
      blogsPerSite: 30,
    },
    quotas: {
      SEO_ARTICLE: 30,
      SOCIAL_POST: 0,
      GOOGLE_CAMPAIGN: 0,
      META_CAMPAIGN: 0,
      IMAGE_GENERATION: 30,
      AI_QUERY: 100,
    },
    supportedCadences: {
      seo: ["daily", "weekly", "monthly", "custom"],
      social: [],
    },
  },

  seo_2: {
    id: "seo_2",
    category: "seo",
    name: "SEO Duo (2 Websites)",
    priceINR: 2299,
    billingCycle: "monthly",
    description: "Autonomous WordPress SEO suite for 2 websites: 30 blogs each (60 blogs total per month).",
    limits: {
      maxWordPressSites: 2,
      maxSocialBrands: 0,
      maxAdAccounts: 0,
      maxBusinesses: 2,
    },
    features: {
      SEO: true,
      SEO_AUTOPILOT: true,
      SOCIAL: false,
      SOCIAL_AUTOPILOT: false,
      META_ADS: false,
      GOOGLE_ADS: false,
      IMAGE_GENERATION: true,
      AI_CHAT: true,
      AGENT_EXECUTION: true,
    },
    perAssetQuotas: {
      blogsPerSite: 30,
    },
    quotas: {
      SEO_ARTICLE: 60,
      SOCIAL_POST: 0,
      GOOGLE_CAMPAIGN: 0,
      META_CAMPAIGN: 0,
      IMAGE_GENERATION: 60,
      AI_QUERY: 200,
    },
    supportedCadences: {
      seo: ["daily", "weekly", "monthly", "custom"],
      social: [],
    },
  },

  seo_3: {
    id: "seo_3",
    category: "seo",
    name: "SEO Trio (3 Websites)",
    priceINR: 3199,
    billingCycle: "monthly",
    description: "Autonomous WordPress SEO suite for 3 websites: 30 blogs each (90 blogs total per month).",
    limits: {
      maxWordPressSites: 3,
      maxSocialBrands: 0,
      maxAdAccounts: 0,
      maxBusinesses: 3,
    },
    features: {
      SEO: true,
      SEO_AUTOPILOT: true,
      SOCIAL: false,
      SOCIAL_AUTOPILOT: false,
      META_ADS: false,
      GOOGLE_ADS: false,
      IMAGE_GENERATION: true,
      AI_CHAT: true,
      AGENT_EXECUTION: true,
    },
    perAssetQuotas: {
      blogsPerSite: 30,
    },
    quotas: {
      SEO_ARTICLE: 90,
      SOCIAL_POST: 0,
      GOOGLE_CAMPAIGN: 0,
      META_CAMPAIGN: 0,
      IMAGE_GENERATION: 90,
      AI_QUERY: 300,
    },
    supportedCadences: {
      seo: ["daily", "weekly", "monthly", "custom"],
      social: [],
    },
  },

  // ==========================================
  // 3. STANDALONE SOCIAL MEDIA PLANNER (FB + IG)
  // ==========================================
  social_1: {
    id: "social_1",
    category: "social",
    name: "Social Solo (1 Brand)",
    priceINR: 1299,
    billingCycle: "monthly",
    description: "Autonomous social media publishing and visual calendar for 1 brand (1 FB Page + 1 IG Account, 30 posts/mo).",
    limits: {
      maxWordPressSites: 0,
      maxSocialBrands: 1,
      maxAdAccounts: 0,
      maxBusinesses: 1,
    },
    features: {
      SEO: false,
      SEO_AUTOPILOT: false,
      SOCIAL: true,
      SOCIAL_AUTOPILOT: true,
      META_ADS: false,
      GOOGLE_ADS: false,
      IMAGE_GENERATION: true,
      AI_CHAT: true,
      AGENT_EXECUTION: true,
    },
    perAssetQuotas: {
      postsPerBrand: 30,
    },
    quotas: {
      SEO_ARTICLE: 0,
      SOCIAL_POST: 30,
      GOOGLE_CAMPAIGN: 0,
      META_CAMPAIGN: 0,
      IMAGE_GENERATION: 30,
      AI_QUERY: 100,
    },
    supportedCadences: {
      seo: [],
      social: ["daily", "alternate", "weekly_4", "weekly", "custom"],
    },
  },

  social_2: {
    id: "social_2",
    category: "social",
    name: "Social Duo (2 Brands)",
    priceINR: 2299,
    billingCycle: "monthly",
    description: "Autonomous social media publishing for 2 brands (2 FB Pages + 2 IG Accounts): 30 posts each (60 posts total/mo).",
    limits: {
      maxWordPressSites: 0,
      maxSocialBrands: 2,
      maxAdAccounts: 0,
      maxBusinesses: 2,
    },
    features: {
      SEO: false,
      SEO_AUTOPILOT: false,
      SOCIAL: true,
      SOCIAL_AUTOPILOT: true,
      META_ADS: false,
      GOOGLE_ADS: false,
      IMAGE_GENERATION: true,
      AI_CHAT: true,
      AGENT_EXECUTION: true,
    },
    perAssetQuotas: {
      postsPerBrand: 30,
    },
    quotas: {
      SEO_ARTICLE: 0,
      SOCIAL_POST: 60,
      GOOGLE_CAMPAIGN: 0,
      META_CAMPAIGN: 0,
      IMAGE_GENERATION: 60,
      AI_QUERY: 200,
    },
    supportedCadences: {
      seo: [],
      social: ["daily", "alternate", "weekly_4", "weekly", "custom"],
    },
  },

  social_3: {
    id: "social_3",
    category: "social",
    name: "Social Trio (3 Brands)",
    priceINR: 3199,
    billingCycle: "monthly",
    description: "Autonomous social media publishing for 3 brands (3 FB Pages + 3 IG Accounts): 30 posts each (90 posts total/mo).",
    limits: {
      maxWordPressSites: 0,
      maxSocialBrands: 3,
      maxAdAccounts: 0,
      maxBusinesses: 3,
    },
    features: {
      SEO: false,
      SEO_AUTOPILOT: false,
      SOCIAL: true,
      SOCIAL_AUTOPILOT: true,
      META_ADS: false,
      GOOGLE_ADS: false,
      IMAGE_GENERATION: true,
      AI_CHAT: true,
      AGENT_EXECUTION: true,
    },
    perAssetQuotas: {
      postsPerBrand: 30,
    },
    quotas: {
      SEO_ARTICLE: 0,
      SOCIAL_POST: 90,
      GOOGLE_CAMPAIGN: 0,
      META_CAMPAIGN: 0,
      IMAGE_GENERATION: 90,
      AI_QUERY: 300,
    },
    supportedCadences: {
      seo: [],
      social: ["daily", "alternate", "weekly_4", "weekly", "custom"],
    },
  },

  // ==========================================
  // 4. STANDALONE ADS ENGINE (META + GOOGLE)
  // ==========================================
  ads_1: {
    id: "ads_1",
    category: "ads",
    name: "Ads Solo (1 Business)",
    priceINR: 1099,
    billingCycle: "monthly",
    description: "Autonomous campaign creation engine: 2 Google Ads + 2 Meta Ads campaigns per month for 1 ad account.",
    limits: {
      maxWordPressSites: 0,
      maxSocialBrands: 0,
      maxAdAccounts: 1,
      maxBusinesses: 1,
    },
    features: {
      SEO: false,
      SEO_AUTOPILOT: false,
      SOCIAL: false,
      SOCIAL_AUTOPILOT: false,
      META_ADS: true,
      GOOGLE_ADS: true,
      IMAGE_GENERATION: true,
      AI_CHAT: true,
      AGENT_EXECUTION: true,
    },
    perAssetQuotas: {
      googleAdsPerAccount: 2,
      metaAdsPerAccount: 2,
    },
    quotas: {
      SEO_ARTICLE: 0,
      SOCIAL_POST: 0,
      GOOGLE_CAMPAIGN: 2,
      META_CAMPAIGN: 2,
      IMAGE_GENERATION: 10,
      AI_QUERY: 80,
    },
    supportedCadences: {
      seo: [],
      social: [],
    },
  },

  ads_2: {
    id: "ads_2",
    category: "ads",
    name: "Ads Duo (2 Businesses)",
    priceINR: 1999,
    billingCycle: "monthly",
    description: "Autonomous campaign creation engine for 2 businesses: 4 Google Ads + 4 Meta Ads campaigns (2 each per account).",
    limits: {
      maxWordPressSites: 0,
      maxSocialBrands: 0,
      maxAdAccounts: 2,
      maxBusinesses: 2,
    },
    features: {
      SEO: false,
      SEO_AUTOPILOT: false,
      SOCIAL: false,
      SOCIAL_AUTOPILOT: false,
      META_ADS: true,
      GOOGLE_ADS: true,
      IMAGE_GENERATION: true,
      AI_CHAT: true,
      AGENT_EXECUTION: true,
    },
    perAssetQuotas: {
      googleAdsPerAccount: 2,
      metaAdsPerAccount: 2,
    },
    quotas: {
      SEO_ARTICLE: 0,
      SOCIAL_POST: 0,
      GOOGLE_CAMPAIGN: 4,
      META_CAMPAIGN: 4,
      IMAGE_GENERATION: 20,
      AI_QUERY: 150,
    },
    supportedCadences: {
      seo: [],
      social: [],
    },
  },

  ads_3: {
    id: "ads_3",
    category: "ads",
    name: "Ads Trio (3 Businesses)",
    priceINR: 2799,
    billingCycle: "monthly",
    description: "Autonomous campaign creation engine for 3 businesses: 6 Google Ads + 6 Meta Ads campaigns (2 each per account).",
    limits: {
      maxWordPressSites: 0,
      maxSocialBrands: 0,
      maxAdAccounts: 3,
      maxBusinesses: 3,
    },
    features: {
      SEO: false,
      SEO_AUTOPILOT: false,
      SOCIAL: false,
      SOCIAL_AUTOPILOT: false,
      META_ADS: true,
      GOOGLE_ADS: true,
      IMAGE_GENERATION: true,
      AI_CHAT: true,
      AGENT_EXECUTION: true,
    },
    perAssetQuotas: {
      googleAdsPerAccount: 2,
      metaAdsPerAccount: 2,
    },
    quotas: {
      SEO_ARTICLE: 0,
      SOCIAL_POST: 0,
      GOOGLE_CAMPAIGN: 6,
      META_CAMPAIGN: 6,
      IMAGE_GENERATION: 30,
      AI_QUERY: 220,
    },
    supportedCadences: {
      seo: [],
      social: [],
    },
  },

  // ==========================================
  // 5. AGENCY SCALE ENTERPRISE TIER
  // ==========================================
  agency_scale: {
    id: "agency_scale",
    category: "agency",
    name: "Agency Scale (Up to 15 Clients)",
    priceINR: 14999,
    billingCycle: "monthly",
    description: "Comprehensive agency infrastructure: up to 15 Websites (450 blogs), 8 Social Brands (240 posts), 8 Ad Units (16 Google + 16 Meta Ads).",
    limits: {
      maxWordPressSites: 15,
      maxSocialBrands: 8,
      maxAdAccounts: 8,
      maxBusinesses: 15,
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
    perAssetQuotas: {
      blogsPerSite: 30,
      postsPerBrand: 30,
      googleAdsPerAccount: 2,
      metaAdsPerAccount: 2,
    },
    quotas: {
      SEO_ARTICLE: 450,
      SOCIAL_POST: 240,
      GOOGLE_CAMPAIGN: 16,
      META_CAMPAIGN: 16,
      IMAGE_GENERATION: 300,
      AI_QUERY: 1000,
    },
    supportedCadences: {
      seo: ["daily", "weekly", "monthly", "custom"],
      social: ["daily", "alternate", "weekly_4", "weekly", "custom"],
    },
  },

  none: {
    id: "none",
    category: "trial",
    name: "Free Trial (No Active Plan)",
    priceINR: 0,
    billingCycle: "none",
    description: "Free trial mode: 1 blog, 1 social post, 1 AI image, and 1 AI query.",
    limits: {
      maxWordPressSites: 1,
      maxSocialBrands: 1,
      maxAdAccounts: 0,
      maxBusinesses: 1,
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
      AGENT_EXECUTION: false,
    },
    perAssetQuotas: {
      blogsPerSite: 1,
      postsPerBrand: 1,
      googleAdsPerAccount: 0,
      metaAdsPerAccount: 0,
    },
    quotas: {
      SEO_ARTICLE: 1,
      SOCIAL_POST: 1,
      GOOGLE_CAMPAIGN: 0,
      META_CAMPAIGN: 0,
      IMAGE_GENERATION: 1,
      AI_QUERY: 1,
    },
    supportedCadences: {
      seo: ["monthly"],
      social: [],
    },
  },

  // ==========================================
  // 6. BACKWARD COMPATIBILITY ALIASES
  // ==========================================
  try: {
    id: "try",
    category: "trial",
    name: "Free Trial (No Active Plan)",
    priceINR: 0,
    billingCycle: "none",
    description: "Free trial mode: 1 blog, 1 social post, 1 AI image, and 1 AI query.",
    limits: {
      maxWordPressSites: 1,
      maxSocialBrands: 1,
      maxAdAccounts: 0,
      maxBusinesses: 1,
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
      AGENT_EXECUTION: false,
    },
    perAssetQuotas: {
      blogsPerSite: 1,
      postsPerBrand: 1,
      googleAdsPerAccount: 0,
      metaAdsPerAccount: 0,
    },
    quotas: {
      SEO_ARTICLE: 1,
      SOCIAL_POST: 1,
      GOOGLE_CAMPAIGN: 0,
      META_CAMPAIGN: 0,
      IMAGE_GENERATION: 1,
      AI_QUERY: 1,
    },
    supportedCadences: {
      seo: ["monthly"],
      social: [],
    },
  },
};

// Aliases for legacy plan IDs
SUBSCRIPTION_PLANS.starter = SUBSCRIPTION_PLANS.suite_1;
SUBSCRIPTION_PLANS.growth = SUBSCRIPTION_PLANS.suite_2;
SUBSCRIPTION_PLANS.business = SUBSCRIPTION_PLANS.suite_3;
SUBSCRIPTION_PLANS.agency = SUBSCRIPTION_PLANS.agency_scale;
SUBSCRIPTION_PLANS.pro_30d = SUBSCRIPTION_PLANS.none;

export const DEFAULT_PLAN_ID = "none";

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
