-- =============================================================================
-- 004 — Trade journal (P4) and paper-trading positions (P5a)
-- Run in the Supabase SQL editor after 003.
-- =============================================================================

-- Trade journal: signal → decision → outcome, for per-signal-family personal
-- win-rate ("which setups make money in your hands").
CREATE TABLE IF NOT EXISTS public.trades_journal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.signal_events(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK (asset_class IN ('crypto', 'stock')),
  signal_id TEXT,                        -- signal family this trade acted on
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  entry NUMERIC(20,8),
  exit NUMERIC(20,8),
  size NUMERIC(20,8),
  checklist JSONB,                       -- pre-trade checklist snapshot
  note TEXT,
  pnl_pct NUMERIC(10,4),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Paper-trading positions: simulated entries from a signal, market + SL/TP.
CREATE TABLE IF NOT EXISTS public.paper_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK (asset_class IN ('crypto', 'stock')),
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  entry NUMERIC(20,8) NOT NULL,
  size NUMERIC(20,8) NOT NULL,
  stop_loss NUMERIC(20,8),
  take_profit NUMERIC(20,8),
  exit NUMERIC(20,8),
  close_reason TEXT CHECK (close_reason IN ('stop_loss','take_profit','manual')),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

ALTER TABLE public.trades_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_positions ENABLE ROW LEVEL SECURITY;

-- trades_journal: owner full access
CREATE POLICY "own journal select" ON public.trades_journal FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own journal insert" ON public.trades_journal FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own journal update" ON public.trades_journal FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own journal delete" ON public.trades_journal FOR DELETE USING (auth.uid() = user_id);

-- paper_positions: owner full access
CREATE POLICY "own paper select" ON public.paper_positions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own paper insert" ON public.paper_positions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own paper update" ON public.paper_positions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own paper delete" ON public.paper_positions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_journal_user ON public.trades_journal(user_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_signal ON public.trades_journal(user_id, signal_id);
CREATE INDEX IF NOT EXISTS idx_paper_user_open ON public.paper_positions(user_id) WHERE closed_at IS NULL;
