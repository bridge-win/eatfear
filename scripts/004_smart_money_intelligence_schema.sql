CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.smart_money_actors (
  id TEXT PRIMARY KEY,
  venue TEXT NOT NULL,
  address TEXT,
  name TEXT NOT NULL,
  profile_url TEXT NOT NULL,
  categories TEXT[] NOT NULL DEFAULT '{}',
  metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
  quality JSONB NOT NULL DEFAULT '{}'::JSONB,
  provenance JSONB NOT NULL DEFAULT '{}'::JSONB,
  observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.smart_money_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  venue TEXT NOT NULL,
  address TEXT,
  action TEXT NOT NULL CHECK (action IN ('buy', 'sell', 'long', 'short', 'close', 'transfer', 'deposit', 'withdraw')),
  asset TEXT NOT NULL,
  market TEXT NOT NULL,
  amount_usd NUMERIC(28, 8),
  price_usd NUMERIC(28, 12),
  pnl_usd NUMERIC(28, 8),
  transaction_id TEXT,
  verification_url TEXT NOT NULL,
  qualification TEXT NOT NULL CHECK (qualification IN ('ranked', 'observed_large_trade')),
  provenance JSONB NOT NULL DEFAULT '{}'::JSONB,
  event_at TIMESTAMPTZ,
  observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.smart_money_source_health (
  source_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('operational', 'degraded', 'unavailable', 'not_configured')),
  latency_ms INTEGER,
  last_success_at TIMESTAMPTZ,
  message TEXT NOT NULL,
  source_url TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.smart_money_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue TEXT NOT NULL,
  address TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, venue, address)
);

CREATE TABLE IF NOT EXISTS public.smart_money_alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue TEXT NOT NULL,
  address TEXT NOT NULL,
  asset TEXT NOT NULL DEFAULT '*',
  action TEXT NOT NULL DEFAULT '*' CHECK (action IN ('*', 'buy', 'sell', 'long', 'short', 'close', 'transfer', 'deposit', 'withdraw')),
  minimum_usd NUMERIC(28, 8) NOT NULL DEFAULT 0 CHECK (minimum_usd >= 0),
  channels TEXT[] NOT NULL DEFAULT ARRAY['in_app'],
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.smart_money_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_money_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_money_source_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_money_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_money_alert_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Smart money actors are publicly readable" ON public.smart_money_actors;
CREATE POLICY "Smart money actors are publicly readable"
  ON public.smart_money_actors FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Smart money events are publicly readable" ON public.smart_money_events;
CREATE POLICY "Smart money events are publicly readable"
  ON public.smart_money_events FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Smart money source health is publicly readable" ON public.smart_money_source_health;
CREATE POLICY "Smart money source health is publicly readable"
  ON public.smart_money_source_health FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Users manage their own smart money wallets" ON public.smart_money_wallets;
CREATE POLICY "Users manage their own smart money wallets"
  ON public.smart_money_wallets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage their own smart money alert rules" ON public.smart_money_alert_rules;
CREATE POLICY "Users manage their own smart money alert rules"
  ON public.smart_money_alert_rules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON public.smart_money_actors, public.smart_money_events, public.smart_money_source_health TO anon, authenticated;
GRANT ALL ON public.smart_money_actors, public.smart_money_events, public.smart_money_source_health TO service_role;
GRANT ALL ON public.smart_money_wallets, public.smart_money_alert_rules TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_smart_money_actors_venue_quality
  ON public.smart_money_actors(venue, ((quality->>'score')::NUMERIC) DESC);
CREATE INDEX IF NOT EXISTS idx_smart_money_actors_address
  ON public.smart_money_actors(address) WHERE address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_smart_money_events_asset_time
  ON public.smart_money_events(asset, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_money_events_actor_time
  ON public.smart_money_events(actor_id, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_money_source_health_status
  ON public.smart_money_source_health(status, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_money_wallets_user
  ON public.smart_money_wallets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_money_alert_rules_user_enabled
  ON public.smart_money_alert_rules(user_id, enabled, updated_at DESC);
