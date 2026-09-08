-- ====================================================================
-- GABBARINFO AI: SECURITY, MULTI-TENANCY & ATOMIC BILLING MIGRATION
-- ====================================================================

-- 1. BUSINESS TENANTS TABLE
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    industry TEXT DEFAULT 'Business',
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'suspended', 'archived'
    created_by TEXT NOT NULL,              -- User email or ID of the creator
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by status and creator
CREATE INDEX IF NOT EXISTS idx_businesses_created_by ON public.businesses(created_by);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON public.businesses(status);

-- 2. BUSINESS MEMBERSHIP (M:N User to Business Relationship)
CREATE TABLE IF NOT EXISTS public.business_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',   -- 'owner', 'admin', 'member'
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(business_id, user_email)
);

CREATE INDEX IF NOT EXISTS idx_business_members_email ON public.business_members(user_email);
CREATE INDEX IF NOT EXISTS idx_business_members_biz ON public.business_members(business_id);

-- 3. SUBSCRIPTIONS & ENTITLEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'transition_full', -- 'starter', 'pro', 'agency', 'transition_full'
    status TEXT NOT NULL DEFAULT 'active',        -- 'active', 'past_due', 'canceled', 'trialing'
    features JSONB NOT NULL DEFAULT '["SEO", "SOCIAL", "SOCIAL_PLANNER", "META_ADS", "GOOGLE_ADS", "AI_CHAT", "IMAGE_GENERATION"]'::jsonb,
    monthly_credit_allowance INT NOT NULL DEFAULT 1000,
    current_period_start TIMESTAMPTZ DEFAULT now(),
    current_period_end TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CREDIT WALLETS TABLE (Atomic Balances)
CREATE TABLE IF NOT EXISTS public.credit_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
    balance INT NOT NULL DEFAULT 1000 CHECK (balance >= 0),
    reserved INT NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. IMMUTABLE CREDIT LEDGER (Audit Trail)
CREATE TABLE IF NOT EXISTS public.credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'SEO_BLOG', 'SOCIAL_POST', 'META_CAMPAIGN', 'GOOGLE_CAMPAIGN', 'IMAGE_GENERATION', 'AI_QUERY'
    reference_id TEXT,
    idempotency_key TEXT,
    amount INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'committed', -- 'reserved', 'committed', 'released'
    provider TEXT,
    model TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_biz ON public.credit_ledger(business_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_idempotency ON public.credit_ledger(idempotency_key);

-- 6. ATOMIC STORED PROCEDURE: DEBIT WALLET (Prevents Race Conditions via Row Locking)
CREATE OR REPLACE FUNCTION public.debit_business_wallet(
    p_business_id UUID,
    p_amount INT,
    p_action TEXT,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet RECORD;
    v_existing_tx RECORD;
    v_tx_id UUID;
    v_new_balance INT;
BEGIN
    -- Idempotency Check: Return existing transaction if already processed
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, amount, status INTO v_existing_tx
        FROM public.credit_ledger
        WHERE idempotency_key = p_idempotency_key
        LIMIT 1;

        IF FOUND THEN
            SELECT balance INTO v_new_balance FROM public.credit_wallets WHERE business_id = p_business_id;
            RETURN jsonb_build_object(
                'ok', true,
                'already_processed', true,
                'transaction_id', v_existing_tx.id,
                'new_balance', v_new_balance
            );
        END IF;
    END IF;

    -- Row Lock: SELECT ... FOR UPDATE halts concurrent requests until this transaction commits
    SELECT * INTO v_wallet
    FROM public.credit_wallets
    WHERE business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Auto-provision wallet with initial 1000 credits if missing
        INSERT INTO public.credit_wallets (business_id, balance, reserved)
        VALUES (p_business_id, 1000, 0)
        RETURNING * INTO v_wallet;
    END IF;

    -- Balance Verification
    IF v_wallet.balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient credits. Balance: %, Required: %', v_wallet.balance, p_amount;
    END IF;

    -- Deduct atomically
    v_new_balance := v_wallet.balance - p_amount;
    UPDATE public.credit_wallets
    SET balance = v_new_balance,
        updated_at = now()
    WHERE business_id = p_business_id;

    -- Record in Immutable Ledger
    INSERT INTO public.credit_ledger (
        business_id,
        user_email,
        action_type,
        idempotency_key,
        amount,
        status
    )
    VALUES (
        p_business_id,
        current_user,
        p_action,
        p_idempotency_key,
        p_amount,
        'committed'
    )
    RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object(
        'ok', true,
        'transaction_id', v_tx_id,
        'new_balance', v_new_balance,
        'debited', p_amount
    );
END;
$$;

-- 7. ROW LEVEL SECURITY (RLS) LOCKDOWN
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view only businesses they belong to
CREATE POLICY "Members can view own businesses"
ON public.businesses
FOR SELECT
TO authenticated
USING (
    id IN (
        SELECT business_id FROM public.business_members
        WHERE user_email = auth.jwt()->>'email'
    )
);

-- Allow authenticated users to view own memberships
CREATE POLICY "Members can view own membership"
ON public.business_members
FOR SELECT
TO authenticated
USING (
    user_email = auth.jwt()->>'email'
);

-- Allow authenticated members to view own subscription
CREATE POLICY "Members can view own subscription"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
    business_id IN (
        SELECT business_id FROM public.business_members
        WHERE user_email = auth.jwt()->>'email'
    )
);

-- Allow authenticated members to view own wallet balance
CREATE POLICY "Members can view own wallet"
ON public.credit_wallets
FOR SELECT
TO authenticated
USING (
    business_id IN (
        SELECT business_id FROM public.business_members
        WHERE user_email = auth.jwt()->>'email'
    )
);

-- Allow authenticated members to view own credit ledger
CREATE POLICY "Members can view own ledger"
ON public.credit_ledger
FOR SELECT
TO authenticated
USING (
    business_id IN (
        SELECT business_id FROM public.business_members
        WHERE user_email = auth.jwt()->>'email'
    )
);

-- 6. USER ACCOUNT LIMITS & PLATFORM GOVERNANCE
CREATE TABLE IF NOT EXISTS public.user_account_limits (
    user_email TEXT PRIMARY KEY,
    max_businesses INT NOT NULL DEFAULT 1,
    is_suspended BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Service Role Key retains full access for server-side operations
GRANT ALL ON public.businesses TO service_role;
GRANT ALL ON public.business_members TO service_role;
GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.credit_wallets TO service_role;
GRANT ALL ON public.credit_ledger TO service_role;
GRANT ALL ON public.user_account_limits TO service_role;

ALTER TABLE public.user_account_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own account limits"
ON public.user_account_limits
FOR SELECT
TO authenticated
USING (
    user_email = auth.jwt()->>'email'
);
