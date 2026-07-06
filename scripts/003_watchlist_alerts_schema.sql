-- =============================================================================
-- 003 — Watchlist, signal events, alert rules, delivery log, Telegram links
-- Run in the Supabase SQL editor after 001 and 002.
-- Powers: per-symbol watchlist, threshold-cross signal events, multi-channel
-- alert rules, delivery log (in-app center), and Telegram chat binding.
-- =============================================================================

-- Symbols a user follows.
CREATE TABLE IF NOT EXISTS public.watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK (asset_class IN ('crypto', 'stock')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol, asset_class)
);

-- Threshold-cross events emitted by lib/signal-state.ts. Global (not per-user);
-- alert fan-out joins these against alert_rules. Written by the server role only.
CREATE TABLE IF NOT EXISTS public.signal_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK (asset_class IN ('crypto', 'stock')),
  signal_id TEXT NOT NULL,               -- e.g. 'black_swan', 'euphoria'
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  event_kind TEXT NOT NULL CHECK (event_kind IN ('zone_entered','triggered','invalidated','resolved','rearmed')),
  state TEXT NOT NULL,
  score NUMERIC(6,2) NOT NULL,
  evidence JSONB,                        -- active signals + factor lines snapshot
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, signal_id, event_kind, triggered_at)
);

-- Per-user alert rules: which signal on which symbol, over which channels.
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL DEFAULT '*',      -- '*' = any followed symbol
  asset_class TEXT CHECK (asset_class IN ('crypto', 'stock')),
  signal_id TEXT NOT NULL DEFAULT 'composite',
  min_event_kind TEXT NOT NULL DEFAULT 'triggered'
    CHECK (min_event_kind IN ('zone_entered','triggered')),
  channels TEXT[] NOT NULL DEFAULT ARRAY['inapp','email']::TEXT[],
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery log — one row per (user, event, channel). Backs the in-app alert
-- center (read/unread) and dedupes re-sends.
CREATE TABLE IF NOT EXISTS public.alerts_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.signal_events(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('inapp','email','telegram','webpush')),
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Telegram chat binding. Established when a user runs /start <link_token>.
CREATE TABLE IF NOT EXISTS public.telegram_links (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL,
  username TEXT,
  link_token TEXT,                       -- one-time deep-link token, cleared on verify
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chat_id)
);

-- Enable Row Level Security
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

-- watchlist: owner full access
CREATE POLICY "own watchlist select" ON public.watchlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own watchlist insert" ON public.watchlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own watchlist delete" ON public.watchlist FOR DELETE USING (auth.uid() = user_id);

-- signal_events: any authenticated user may read the shared event stream; writes
-- come from the service role, which bypasses RLS (no INSERT policy on purpose).
CREATE POLICY "authenticated read signal_events" ON public.signal_events FOR SELECT
  USING (auth.role() = 'authenticated');

-- alert_rules: owner full access
CREATE POLICY "own rules select" ON public.alert_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own rules insert" ON public.alert_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rules update" ON public.alert_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own rules delete" ON public.alert_rules FOR DELETE USING (auth.uid() = user_id);

-- alerts_log: owner may read and mark read; inserts come from the service role.
CREATE POLICY "own alerts select" ON public.alerts_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own alerts update" ON public.alerts_log FOR UPDATE USING (auth.uid() = user_id);

-- telegram_links: owner may read/manage their binding; the webhook writes via the
-- service role.
CREATE POLICY "own telegram select" ON public.telegram_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own telegram update" ON public.telegram_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own telegram delete" ON public.telegram_links FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON public.watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_signal_events_symbol ON public.signal_events(symbol, signal_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_events_recent ON public.signal_events(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_rules_user ON public.alert_rules(user_id) WHERE enabled;
CREATE INDEX IF NOT EXISTS idx_alerts_log_user ON public.alerts_log(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_log_unread ON public.alerts_log(user_id) WHERE read_at IS NULL;
