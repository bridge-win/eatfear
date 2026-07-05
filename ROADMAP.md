# eatfear Product Roadmap

eatfear is moving from a panic-conditions dashboard into a structured trading signal workspace:

1. discover oversold and overbought extremes,
2. explain the evidence chain,
3. turn readings into explicit trigger events,
4. track user symbols with news and quantitative signals,
5. notify users when rules fire,
6. let users learn through checklist, journal, and paper-trade feedback,
7. add broker execution only after trust and safety controls are mature.

The honest product promise is not exact tops or bottoms. "Precise timing" means a rules-based trigger moment, a visible evidence chain, historical forward-return statistics, and an invalidation/risk rule.

## Difficulty Review

| Area | Difficulty | Free/no-paid-API status | Notes |
| --- | --- | --- | --- |
| History completeness | Medium | Shipped | OKX daily candle consumers now paginate instead of using fixed 300-row caps. |
| Oversold long-side scoring | Existing | Shipped | Black Swan score remains the long-side capitulation model. |
| Overbought short-side scoring | Medium | Shipped | Added euphoria detector and `/api/crypto/euphoria` using OKX, alternative.me, Yahoo VIX, blockchain.info. |
| Trigger state machine | Medium | Shipped as library | `lib/signal-state.ts` defines neutral -> zone_entered -> triggered -> invalidated/resolved transitions. Persistence is schema-ready. |
| Historical evidence | Medium | Shipped MVP | `/api/crypto/signal-backtest` computes forward 7/30/90 day outcomes from free OKX daily candles. |
| Watchlist | Medium | Shipped local-first + schema | `/watchlist` stores symbols locally and `scripts/003_trading_loop_schema.sql` adds durable Supabase tables. |
| Symbol news tracking | Low | Shipped | `/api/news?symbols=BTC,NVDA` filters RSS and adds Yahoo ticker RSS where available. |
| Email subscription creation | Low | Shipped | Profile now supports insert, update, delete for crash-alert subscriptions. |
| In-app alerts | Medium | Schema-ready | `alerts_log` exists; production fan-out worker/UI read status is next. |
| Telegram | Medium | Integration-ready | Schema reserves `telegram_links`; bot token/webhook setup is external. |
| Learning checklist + journal | Low | Shipped local-first + schema | `/journal` records decisions, checklist discipline, PnL, and win rate locally. |
| Paper trading | Medium | Schema-ready, journal MVP shipped | `paper_positions` exists; automatic mark-to-market worker remains next. |
| Broker execution | High | Not shipped | Requires exchange/broker account, encrypted key management, kill switch, audit logs, legal disclaimers. |
| Paid/pro data | High | Not required now | Glassnode/CoinGlass paid depth, Kaiko, Laevitas, and broker APIs stay out of the no-paid-API scope. |

## Shipped No-Paid-API Scope

### Phase 0: Foundation

- Fixed the `limit=300` class of OKX daily candle truncation for:
  - `/api/crypto/buy-window`
  - `/api/crypto/cycle-position`
  - `/api/crypto/black-swan`
- Added shared `lib/okx-history.ts`.
- Added range-aware response metadata where the current APIs can accept `range`.

### Phase 1: Symmetric Signal Engine

- Long side: existing Black Swan Opportunity score.
- Short/take-profit side:
  - `lib/euphoria-detector.ts`
  - `/api/crypto/euphoria`
  - dashboard card `EuphoriaOpportunityCard`
- The crypto dashboard now shows both long and short pressure in the first signal row.

### Phase 2: Watchlist + News + Alert Creation

- `/watchlist`:
  - local symbol list,
  - crypto long/short scores,
  - symbol-matched RSS headlines,
  - quick backtest links,
  - alert readiness markers.
- `/api/news?symbols=...`:
  - ticker/alias matching,
  - Yahoo Finance per-ticker RSS for stock symbols,
  - crypto/source RSS filtering.
- Profile:
  - create subscription,
  - edit subscription,
  - delete subscription,
  - send test alert.

### Phase 3: Historical Evidence MVP

- `/api/crypto/signal-backtest`:
  - uses free OKX daily candles,
  - derives long/short wick + return-z events without lookahead,
  - returns 7/30/90 day median forward return, hit rate, and median adverse excursion.

### Phase 4: Learning Loop MVP

- `/journal`:
  - structured pre-trade checklist,
  - long/short decision log,
  - entry/exit/size/PnL,
  - total PnL and win rate.
- Supabase schema supports durable `trades_journal`.

### Data Model

Run `scripts/003_trading_loop_schema.sql` after the existing Supabase scripts. It adds:

- `watchlist`
- `signal_events`
- `alert_rules`
- `alerts_log`
- `telegram_links`
- `trades_journal`
- `paper_positions`

## Next Integration Work

1. Persist watchlist and journal through Supabase when the user is logged in, while retaining local fallback.
2. Add a worker that evaluates watchlist symbols every 5 minutes through Supabase Edge Functions, pg_cron, or QStash.
3. Write `signal_events` and `alerts_log` from the worker.
4. Add a bell dropdown backed by `alerts_log`.
5. Add Telegram bot binding after a bot token exists.
6. Turn `paper_positions` into true mark-to-market paper trading.
7. Only then evaluate real broker/exchange execution.

## Product Language Guardrails

- Say "rules-based trigger" instead of "predict exact top/bottom."
- Every notification must include: evidence, historical stats, invalidation, and risk reminder.
- Paid vendor integrations must be marked as planned or research until keys/contracts exist.
- Broker execution must remain opt-in, confirmed, audited, and separate from signal generation.
