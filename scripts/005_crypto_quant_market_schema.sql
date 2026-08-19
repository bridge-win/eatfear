create table if not exists public.crypto_candles (
  inst_id text not null,
  bar text not null,
  timestamp timestamptz not null,
  open double precision not null,
  high double precision not null,
  low double precision not null,
  close double precision not null,
  volume double precision not null default 0,
  quote_volume double precision not null default 0,
  source text not null default 'OKX',
  created_at timestamptz not null default now(),
  primary key (inst_id, bar, timestamp)
);

create index if not exists crypto_candles_lookup_idx
  on public.crypto_candles (inst_id, bar, timestamp desc);

create table if not exists public.crypto_market_snapshots (
  inst_id text not null,
  timestamp timestamptz not null,
  best_bid double precision not null,
  best_ask double precision not null,
  spread_pct double precision not null,
  bid_depth_01_usd double precision not null default 0,
  ask_depth_01_usd double precision not null default 0,
  bid_depth_05_usd double precision not null default 0,
  ask_depth_05_usd double precision not null default 0,
  bid_depth_1_usd double precision not null default 0,
  ask_depth_1_usd double precision not null default 0,
  orderbook_imbalance_pct double precision not null default 0,
  open_interest_usd double precision,
  funding_rate_pct double precision,
  buy_volume double precision,
  sell_volume double precision,
  volume_delta double precision,
  long_liquidation_usd double precision,
  short_liquidation_usd double precision,
  source text not null default 'OKX',
  created_at timestamptz not null default now(),
  primary key (inst_id, timestamp)
);

create index if not exists crypto_market_snapshots_lookup_idx
  on public.crypto_market_snapshots (inst_id, timestamp desc);

create table if not exists public.crypto_quant_features (
  inst_id text not null,
  bar text not null,
  timestamp timestamptz not null,
  features jsonb not null,
  source text not null default 'computed',
  created_at timestamptz not null default now(),
  primary key (inst_id, bar, timestamp)
);

create index if not exists crypto_quant_features_lookup_idx
  on public.crypto_quant_features (inst_id, bar, timestamp desc);

alter table public.crypto_candles enable row level security;
alter table public.crypto_market_snapshots enable row level security;
alter table public.crypto_quant_features enable row level security;

drop policy if exists "Public read crypto candles" on public.crypto_candles;
create policy "Public read crypto candles"
  on public.crypto_candles
  for select
  using (true);

drop policy if exists "Public read crypto market snapshots" on public.crypto_market_snapshots;
create policy "Public read crypto market snapshots"
  on public.crypto_market_snapshots
  for select
  using (true);

drop policy if exists "Public read crypto quant features" on public.crypto_quant_features;
create policy "Public read crypto quant features"
  on public.crypto_quant_features
  for select
  using (true);
