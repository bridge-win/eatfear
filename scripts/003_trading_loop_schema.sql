CREATE TABLE IF NOT EXISTS public.watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK (asset_class IN ('crypto', 'stock', 'macro')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol, asset_class)
);

CREATE TABLE IF NOT EXISTS public.signal_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK (asset_class IN ('crypto', 'stock', 'macro')),
  signal_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short', 'risk_off')),
  state TEXT NOT NULL CHECK (state IN ('neutral', 'zone_entered', 'triggered', 'invalidated', 'resolved')),
  score DECIMAL(6,2) NOT NULL,
  evidence_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL DEFAULT '*',
  signal_id TEXT NOT NULL DEFAULT 'composite',
  threshold DECIMAL(6,2) NOT NULL DEFAULT 70,
  channels TEXT[] NOT NULL DEFAULT ARRAY['email'],
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alerts_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.signal_events(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'in_app', 'telegram', 'web_push')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.telegram_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(chat_id)
);

CREATE TABLE IF NOT EXISTS public.trades_journal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.signal_events(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  entry DECIMAL(20,8),
  exit DECIMAL(20,8),
  size DECIMAL(20,8),
  checklist_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  note TEXT,
  pnl DECIMAL(20,8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.paper_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.signal_events(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  entry DECIMAL(20,8) NOT NULL,
  sl DECIMAL(20,8),
  tp DECIMAL(20,8),
  size DECIMAL(20,8) NOT NULL,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  pnl DECIMAL(20,8)
);

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own watchlist"
  ON public.watchlist FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own signal events"
  ON public.signal_events FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own signal events"
  ON public.signal_events FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can manage their own alert rules"
  ON public.alert_rules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own alert log"
  ON public.alerts_log FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own telegram link"
  ON public.telegram_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own trade journal"
  ON public.trades_journal FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own paper positions"
  ON public.paper_positions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON public.watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_signal_events_symbol ON public.signal_events(symbol, signal_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_rules_user ON public.alert_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_log_user_read ON public.alerts_log(user_id, read_at, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_journal_user_symbol ON public.trades_journal(user_id, symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paper_positions_user_open ON public.paper_positions(user_id, closed_at, opened_at DESC);
