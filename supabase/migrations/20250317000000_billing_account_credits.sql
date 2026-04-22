-- Billing: account credits and transactions. account_id = profiles.id (user id).
-- One row per account in account_credits; credits granted via webhook or consumed on site creation.

CREATE TABLE IF NOT EXISTS public.account_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_credits_balance integer NOT NULL DEFAULT 0,
  free_site_used boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (account_id)
);

CREATE INDEX IF NOT EXISTS idx_account_credits_account_id ON public.account_credits(account_id);

ALTER TABLE public.account_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own account_credits"
  ON public.account_credits FOR SELECT
  USING (account_id = auth.uid());

-- No INSERT/UPDATE for authenticated users; only service role (webhook, create-project API) can modify.

COMMENT ON TABLE public.account_credits IS 'Per-account site credits and free-site usage. Balance updated server-side only (webhook, project creation).';

-- credit_transactions: audit trail for grants and consumption
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('free_grant', 'purchase', 'site_created', 'adjustment')),
  quantity integer NOT NULL,
  source text,
  stripe_session_id text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_account_id ON public.credit_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(account_id, created_at DESC);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own credit_transactions"
  ON public.credit_transactions FOR SELECT
  USING (account_id = auth.uid());

-- No INSERT for users; only service role (webhook, create-project API) inserts.

COMMENT ON TABLE public.credit_transactions IS 'Audit log for credit changes: purchase, free_grant, site_created, adjustment.';

-- stripe_customer_id on profiles for Stripe Checkout
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'Stripe Customer ID; set after first Checkout or via webhook.';
