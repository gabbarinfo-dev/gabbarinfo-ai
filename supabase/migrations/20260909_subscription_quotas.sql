-- supabase/migrations/20260909_subscription_quotas.sql
-- ====================================================================
-- GABBARINFO AI: MONTHLY SUBSCRIPTION & SERVICE QUOTAS MIGRATION
-- ====================================================================

-- 1. SUBSCRIPTION PLANS CATALOG TABLE (Immutable System Reference)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_inr INT NOT NULL,
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    max_businesses INT NOT NULL DEFAULT 1,
    max_wordpress_sites INT NOT NULL DEFAULT 1,
    max_facebook_pages INT NOT NULL DEFAULT 1,
    max_instagram_accounts INT NOT NULL DEFAULT 1,
    quota_seo_articles INT NOT NULL DEFAULT 1,
    quota_social_posts INT NOT NULL DEFAULT 4,
    quota_meta_campaigns INT NOT NULL DEFAULT 0,
    quota_google_campaigns INT NOT NULL DEFAULT 0,
    quota_image_generations INT NOT NULL DEFAULT 2,
    quota_ai_queries INT NOT NULL DEFAULT 20,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Initial Plans (Modular Asset-Slot Catalog)
INSERT INTO public.subscription_plans (
    id, name, price_inr, max_businesses, max_wordpress_sites, max_facebook_pages, max_instagram_accounts,
    quota_seo_articles, quota_social_posts, quota_meta_campaigns, quota_google_campaigns,
    quota_image_generations, quota_ai_queries, features
) VALUES 
-- Growth Suites
('suite_1', 'Solo Growth Suite (1 Business)', 2499, 1, 1, 1, 1, 30, 30, 2, 2, 30, 150, '{"SEO": true, "SEO_AUTOPILOT": true, "SOCIAL": true, "SOCIAL_AUTOPILOT": true, "META_ADS": true, "GOOGLE_ADS": true, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb),
('suite_2', 'Duo Growth Suite (2 Businesses)', 4499, 2, 2, 2, 2, 60, 60, 4, 4, 60, 300, '{"SEO": true, "SEO_AUTOPILOT": true, "SOCIAL": true, "SOCIAL_AUTOPILOT": true, "META_ADS": true, "GOOGLE_ADS": true, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb),
('suite_3', 'Trio Growth Suite (3 Businesses)', 6499, 3, 3, 3, 3, 90, 90, 6, 6, 90, 450, '{"SEO": true, "SEO_AUTOPILOT": true, "SOCIAL": true, "SOCIAL_AUTOPILOT": true, "META_ADS": true, "GOOGLE_ADS": true, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb),
-- Standalone SEO
('seo_1', 'SEO Solo (1 Website)', 1299, 1, 1, 0, 0, 30, 0, 0, 0, 30, 100, '{"SEO": true, "SEO_AUTOPILOT": true, "SOCIAL": false, "SOCIAL_AUTOPILOT": false, "META_ADS": false, "GOOGLE_ADS": false, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb),
('seo_2', 'SEO Duo (2 Websites)', 2299, 2, 2, 0, 0, 60, 0, 0, 0, 60, 200, '{"SEO": true, "SEO_AUTOPILOT": true, "SOCIAL": false, "SOCIAL_AUTOPILOT": false, "META_ADS": false, "GOOGLE_ADS": false, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb),
('seo_3', 'SEO Trio (3 Websites)', 3199, 3, 3, 0, 0, 90, 0, 0, 0, 90, 300, '{"SEO": true, "SEO_AUTOPILOT": true, "SOCIAL": false, "SOCIAL_AUTOPILOT": false, "META_ADS": false, "GOOGLE_ADS": false, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb),
-- Standalone Social
('social_1', 'Social Solo (1 Brand)', 1299, 1, 0, 1, 1, 0, 30, 0, 0, 30, 100, '{"SEO": false, "SEO_AUTOPILOT": false, "SOCIAL": true, "SOCIAL_AUTOPILOT": true, "META_ADS": false, "GOOGLE_ADS": false, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb),
('social_2', 'Social Duo (2 Brands)', 2299, 2, 0, 2, 2, 0, 60, 0, 0, 60, 200, '{"SEO": false, "SEO_AUTOPILOT": false, "SOCIAL": true, "SOCIAL_AUTOPILOT": true, "META_ADS": false, "GOOGLE_ADS": false, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb),
('social_3', 'Social Trio (3 Brands)', 3199, 3, 0, 3, 3, 0, 90, 0, 0, 90, 300, '{"SEO": false, "SEO_AUTOPILOT": false, "SOCIAL": true, "SOCIAL_AUTOPILOT": true, "META_ADS": false, "GOOGLE_ADS": false, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb),
-- Standalone Ads
('ads_1', 'Ads Solo (1 Business)', 1099, 1, 0, 0, 0, 0, 0, 2, 2, 10, 80, '{"SEO": false, "SEO_AUTOPILOT": false, "SOCIAL": false, "SOCIAL_AUTOPILOT": false, "META_ADS": true, "GOOGLE_ADS": true, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb),
('ads_2', 'Ads Duo (2 Businesses)', 1999, 2, 0, 0, 0, 0, 0, 4, 4, 20, 150, '{"SEO": false, "SEO_AUTOPILOT": false, "SOCIAL": false, "SOCIAL_AUTOPILOT": false, "META_ADS": true, "GOOGLE_ADS": true, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb),
('ads_3', 'Ads Trio (3 Businesses)', 2799, 3, 0, 0, 0, 0, 0, 6, 6, 30, 220, '{"SEO": false, "SEO_AUTOPILOT": false, "SOCIAL": false, "SOCIAL_AUTOPILOT": false, "META_ADS": true, "GOOGLE_ADS": true, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb),
-- Agency Scale
('agency_scale', 'Agency Scale (Up to 15 Clients)', 14999, 15, 15, 8, 8, 450, 240, 16, 16, 300, 1000, '{"SEO": true, "SEO_AUTOPILOT": true, "SOCIAL": true, "SOCIAL_AUTOPILOT": true, "META_ADS": true, "GOOGLE_ADS": true, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb),
-- Legacy Aliases
('try', 'TRY', 0, 1, 1, 1, 1, 1, 1, 0, 0, 2, 20, '{"SEO": true, "SEO_AUTOPILOT": false, "SOCIAL": true, "SOCIAL_AUTOPILOT": false, "META_ADS": false, "GOOGLE_ADS": false, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb),
('starter', 'STARTER', 2499, 1, 1, 1, 1, 30, 30, 2, 2, 30, 150, '{"SEO": true, "SEO_AUTOPILOT": true, "SOCIAL": true, "SOCIAL_AUTOPILOT": true, "META_ADS": true, "GOOGLE_ADS": true, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb),
('growth', 'GROWTH', 4499, 2, 2, 2, 2, 60, 60, 4, 4, 60, 300, '{"SEO": true, "SEO_AUTOPILOT": true, "SOCIAL": true, "SOCIAL_AUTOPILOT": true, "META_ADS": true, "GOOGLE_ADS": true, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb),
('business', 'BUSINESS', 6499, 3, 3, 3, 3, 90, 90, 6, 6, 90, 450, '{"SEO": true, "SEO_AUTOPILOT": true, "SOCIAL": true, "SOCIAL_AUTOPILOT": true, "META_ADS": true, "GOOGLE_ADS": true, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb),
('agency', 'AGENCY', 14999, 15, 15, 8, 8, 450, 240, 16, 16, 300, 1000, '{"SEO": true, "SEO_AUTOPILOT": true, "SOCIAL": true, "SOCIAL_AUTOPILOT": true, "META_ADS": true, "GOOGLE_ADS": true, "IMAGE_GENERATION": true, "AI_CHAT": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    price_inr = EXCLUDED.price_inr,
    max_businesses = EXCLUDED.max_businesses,
    max_wordpress_sites = EXCLUDED.max_wordpress_sites,
    max_facebook_pages = EXCLUDED.max_facebook_pages,
    max_instagram_accounts = EXCLUDED.max_instagram_accounts,
    quota_seo_articles = EXCLUDED.quota_seo_articles,
    quota_social_posts = EXCLUDED.quota_social_posts,
    quota_meta_campaigns = EXCLUDED.quota_meta_campaigns,
    quota_google_campaigns = EXCLUDED.quota_google_campaigns,
    quota_image_generations = EXCLUDED.quota_image_generations,
    quota_ai_queries = EXCLUDED.quota_ai_queries,
    features = EXCLUDED.features;

-- 2. MONTHLY SERVICE USAGE COUNTERS (Per Business, Per Cycle, Per Action)
CREATE TABLE IF NOT EXISTS public.monthly_service_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id TEXT NOT NULL,
    cycle_start TIMESTAMPTZ NOT NULL,
    action_type TEXT NOT NULL,
    used_count INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(business_id, cycle_start, action_type)
);

CREATE INDEX IF NOT EXISTS idx_monthly_usage_lookup ON public.monthly_service_usage(business_id, cycle_start);

-- 2b. PER-ASSET USAGE & SLOT LOCKING (First Post Locks the Slot)
CREATE TABLE IF NOT EXISTS public.monthly_asset_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id TEXT NOT NULL,
    cycle_start TIMESTAMPTZ NOT NULL,
    asset_type TEXT NOT NULL, -- 'social_brand', 'wordpress_site', 'google_ads', 'meta_ads'
    asset_id TEXT NOT NULL,   -- fb_page_id, site_url, customer_id
    used_count INT NOT NULL DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(business_id, cycle_start, asset_type, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_monthly_asset_usage ON public.monthly_asset_usage(business_id, cycle_start, asset_type);

-- 3. SUBSCRIPTION PURCHASE ORDERS (Customer Plan Order Request & Admin Verification)
CREATE TABLE IF NOT EXISTS public.subscription_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id TEXT,
    user_email TEXT NOT NULL,
    plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id),
    amount_inr INT NOT NULL,
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    payment_reference TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'verified', 'rejected', 'canceled'
    verified_by TEXT,
    verified_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_orders_email ON public.subscription_orders(user_email);
CREATE INDEX IF NOT EXISTS idx_sub_orders_status ON public.subscription_orders(status);

-- 4. USAGE AUDIT LEDGER (Immutable Action Trace)
CREATE TABLE IF NOT EXISTS public.usage_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    action_type TEXT NOT NULL,
    cycle_start TIMESTAMPTZ NOT NULL,
    idempotency_key TEXT,
    status TEXT NOT NULL DEFAULT 'committed',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_biz ON public.usage_ledger(business_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_idempotency ON public.usage_ledger(idempotency_key);

-- 5. ROW LEVEL SECURITY
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_service_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view subscription plans"
ON public.subscription_plans FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Members can view own monthly usage"
ON public.monthly_service_usage FOR SELECT TO authenticated
USING (
    business_id IN (
        SELECT business_id::text FROM public.business_members
        WHERE user_email = auth.jwt()->>'email'
    )
);

CREATE POLICY "Users can view own subscription orders"
ON public.subscription_orders FOR SELECT TO authenticated
USING (user_email = auth.jwt()->>'email');

CREATE POLICY "Members can view own usage ledger"
ON public.usage_ledger FOR SELECT TO authenticated
USING (
    business_id IN (
        SELECT business_id::text FROM public.business_members
        WHERE user_email = auth.jwt()->>'email'
    )
);

-- Service role full access
GRANT ALL ON public.subscription_plans TO service_role;
GRANT ALL ON public.monthly_service_usage TO service_role;
GRANT ALL ON public.subscription_orders TO service_role;
GRANT ALL ON public.usage_ledger TO service_role;
