-- ==============================================================================
-- MIGRATION: 20260912_global_asset_registry.sql
-- PURPOSE: Global Anti-Abuse Asset Fingerprint Registry
-- PREVENTS: Multi-email trial exploitation across WordPress domains, FB pages & GMB locations
-- ==============================================================================

CREATE TABLE IF NOT EXISTS global_asset_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_type TEXT NOT NULL, -- 'wordpress_domain', 'facebook_page', 'gmb_location'
    normalized_identifier TEXT NOT NULL, -- 'example.com', '100857708465879', '1092837465'
    first_claimed_by_email TEXT NOT NULL,
    first_claimed_plan_id TEXT NOT NULL,
    trial_claimed BOOLEAN DEFAULT FALSE,
    trial_claimed_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_asset_identity UNIQUE (asset_type, normalized_identifier)
);

CREATE INDEX IF NOT EXISTS idx_global_asset_lookup 
ON global_asset_registry (asset_type, normalized_identifier);

CREATE INDEX IF NOT EXISTS idx_global_asset_email 
ON global_asset_registry (first_claimed_by_email);
