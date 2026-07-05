# eatfear — Product Positioning & Roadmap

## Vision

eatfear ("be greedy when others are fearful") is evolving from a **panic-conditions dashboard**
into an **all-in-one structured signal workspace for individual traders** across crypto, US
equities, and macro. The closed loop:

> Detect extremes (both directions) → explain *why* (evidence chain + historical stats) →
> teach structured thinking → track *your* watchlist (news + quant signals) → alert you when it
> matters (email / in-app / Telegram) → help you act safely (paper → live) → journal so you improve.

### What "precise timing" honestly means

No system predicts the exact bottom or top. "Precise" here means a **rule-based, unambiguous
trigger moment** (e.g. the instant Mayer < 0.8 *and* F&G < 20 *and* funding turns negative), paired
with that rule's **historical hit-rate / forward-return distribution** and **mandatory risk rules**
(position size, invalidation level). Selling certainty is a scam; selling *verifiable probability +
discipline* is the moat. The codebase's existing honesty (contradictions arrays, failure-mode
caveats) is an asset, not a liability.

## How individual quant traders work today (why this product)

The 2026 retail quant stack is a fragmented five-piece kit costing $50–150+/mo:

1. **Signals** — TradingView (charts + Pine alerts), Coinglass (funding / liquidations / OI),
   Glassnode (MVRV Z-Score and other on-chain over/undervaluation).
2. **Bridge** — TradingView webhook → JSON alert (`action`/`symbol`/`qty`/`SL`/`TP`).
3. **Execution** — bot framework + CCXT (100+ exchanges); equities via Alpaca (commission-free,
   paper trading) or webhook→broker layers (TradersPost, Autoview).
4. **Notifications** — **Telegram is the de-facto standard**: every entry/exit, SL/TP, PnL, and
   bot-health event is pushed to Telegram.
5. **Learning / discipline** — trade journals (TradeZella, Edgewonk): named strategies, a pre-trade
   checklist, per-strategy win-rate stats, weekly review.

**Pain = opportunity:** the tools are fragmented, the signals are black boxes (unverifiable Telegram
signal groups), education and execution are disconnected, and there is a "buy/sell" without a "why".
eatfear's differentiated niche is **explainable + learnable + cross-asset** extreme capture.

## Gap matrix (current vs. new goal)

| New requirement | Current state |
|---|---|
| Oversold detection | ✅ Strong — `black-swan-detector` (10-factor), `buy-window`, `panic-signal` |
| **Overbought / short side** | ❌ Missing — engine is long-biased, no euphoria/top detection |
| Precise entry/exit timing | ❌ Only "conditions read", no threshold-cross trigger events |
| Explain the logic | ✅ Strong (evidence / contradictions / info popovers) — but no *historical* stats (zero backtest) |
| Learning / skill-building | ◐ Methodology page + 200-entry research corpus; no learning path, checklist, or journal loop |
| Watchlist | ❌ `crypto-watchlist-panel` is a static metric catalog, not user-selectable symbols |
| Per-symbol news tracking | ◐ `/api/news` is a global RSS stream, no symbol filtering |
| Per-symbol quant signals | ◐ BTC-centric global compute, no per-user per-symbol |
| Notifications (email / in-app / Telegram) | ◐ Resend email path exists; no subscription-create UI, cron runs daily, no in-app center, no Telegram |
| Order placement | ❌ None |
| Credibility | ❌ "research-validated" framing but zero computational validation |

## Phased roadmap

Each phase is independently shippable. Shortest value path: **P0 → P1 → P2**, delivering the north
star: *"Follow a symbol; when it hits an oversold/overbought trigger, receive one Telegram/email with
the evidence and historical stats."*

### P0 — Foundations & honesty
- Copy alignment: mark `planned`/`research` sources in Radar / analysis-framework clearly as "not yet
  wired" so the UI doesn't over-promise unwired data categories.
- Remove dead code (orphaned `lib/client-alert-checker.ts`) and stray `[v0]` scaffolding logs.
- Commit this `ROADMAP.md`.
- Note: audit-flagged `limit=300` routes (`buy-window`/`black-swan`/`cycle-position`) return
  point-in-time snapshots, not range time-series — no pagination fix needed. `paperCount` (136) is a
  deliberate "reviewed papers" constant, distinct from `detailedPaperCount` (100).

### P1 — Symmetric signal engine + trigger state machine *(core of the new goal)*
- **Overbought / short side:** new `lib/euphoria-detector.ts` mirroring the 10-factor structure of
  `black-swan-detector.ts` — Mayer > 2.4, Puell > 4, F&G > 80, funding > 0.10%/8h, upper-wick
  z-score, OI froth, hot basis, VIX < 14 complacency (equities), SPX stretch above 200d. Outputs a
  0–100 euphoria score + `short`/`take-profit` direction. Fill in the short-side thesis builder in
  `opportunity-engine.ts` (`directionFromScore` already has the long/short skeleton).
- **Trigger state machine:** new `lib/signal-state.ts` — each (symbol × signal) carries state
  `neutral → zone_entered → triggered → invalidated/resolved`; threshold crossings emit events
  persisted to a `signal_events` table. Migrate hardcoded thresholds toward rolling percentiles
  (reuse `getStats` percentile/z-score in `opportunity-engine.ts`).
- Validate by replaying 2020-03, 2021-04/11 tops, 2022-06/11 bottoms, and the 2024 halving cycle.

### P2 — Watchlist + multi-channel notifications *(most direct user value)*
- **Watchlist:** `watchlist(user_id, symbol, asset_class)` table; star toggles on dashboard cards +
  a `/watchlist` aggregate page (per symbol: price, active signals, oversold/overbought score, latest
  news). Parameterize the black-swan/euphoria engines by symbol (currently BTC-centric).
- **Per-symbol news:** add ticker matching to `/api/news` and per-ticker Yahoo RSS; attach the latest
  3 headlines per symbol to the watchlist page and alert emails.
- **Notification pipeline:** add the missing subscription-create UI (`subscription-card.tsx` only
  edits/deletes today); drive `check-alerts` every ~5 min via Supabase pg_cron / Upstash QStash
  (Vercel Hobby cron is daily-only); channels = Email (Resend), in-app alert center
  (`alerts_log` + bell), and a **Telegram bot** (grammY webhook, `/start` deep-link binding
  `user_id → chat_id`). Every notification carries the trigger evidence, historical stats,
  invalidation condition, and a risk note — *the notification is the lesson*.

### P3 — Backtest validation engine *(root of trust; ammunition for notifications)*
- New `lib/backtest/`: given a signal-event series + price series → forward 7/30/90-day return
  distribution, hit-rate vs. an unconditional baseline, and max adverse excursion; walk-forward,
  no lookahead (turn `getValidationChecklist()` from prose into enforced code).
- Surface on each signal card / notification: "this condition occurred *n* times; 90-day median
  return *X*%, hit-rate *Y*%, deepest drawdown *Z*%."
- Wire high-value free sources along the way (Farside ETF flows, MVRV); flip `SOURCE_ROADMAP`
  statuses `planned → wired` as they land.

### P4 — Learning loop
- Restructure the methodology page into a progressive course (market structure → signal families →
  risk management), linked to the corpus `takeaway`/`failureMode` entries.
- One-click **pre-trade checklist** generated from a triggered signal (trend aligned? contradictions?
  event days? size = vol-target? invalidation price?) — first code implementation of the risk layer.
- **Trade journal MVP** (`trades_journal`): signal → decision → outcome, with per-signal-family
  *personal* win-rate — closing the learning loop.
- Each opportunity thesis outputs a vol-target size and invalidation price.

### P5 — Order execution *(strictly staged)*
- **5a Paper trading first** (no regulatory risk, highest teaching value): `paper_positions`,
  one-click simulated entry (market + SL/TP) from a signal card, auto-settlement, "signal vs. your
  timing" performance.
- **5b Crypto live** (OKX first — already deeply integrated; extensible via CCXT): user API keys
  (**trade-only, withdrawals disabled**) AES-encrypted in Supabase (key in server env); order
  confirmation modal shows size/SL/TP/slippage; global kill-switch; audit log.
- **5c Equities:** deep-link to broker first; Alpaca API live later — securities execution carries
  regulatory weight and should not lead.
- Disclaimers throughout: not investment advice; use at your own risk.

### P6 — Monetization *(optional, after trust is established)*
- Free: dashboards + delayed signals + 3 watchlist slots. Paid ($15–25/mo, below the cost of
  assembling the five-piece kit): unlimited watchlist, real-time multi-channel alerts, backtest
  stats, Telegram, execution. Comparable: 3Commas $22–75/mo, TradeZella $29/mo.

## New data model (Supabase, `scripts/003_*.sql` onward)

```
watchlist(user_id, symbol, asset_class, created_at)
signal_events(id, symbol, signal_id, state, score, evidence_json, triggered_at)
alert_rules(user_id, symbol|'*', signal_id|'composite', threshold, channels[], enabled)
alerts_log(user_id, event_id, channel, sent_at, read_at)
telegram_links(user_id, chat_id, verified_at)
trades_journal(user_id, event_id?, symbol, direction, entry, exit, size, checklist_json, note, pnl)
paper_positions(user_id, symbol, direction, entry, sl, tp, size, opened_at, closed_at, pnl)
exchange_keys(user_id, venue, key_encrypted, perms, created_at)   -- P5b
```

## Key technical decisions
- Scheduling: Supabase pg_cron / QStash at ~5-min granularity (bypasses Vercel Hobby daily limit).
- Telegram: grammY + a Next.js webhook route, deep-link binding.
- Per-symbol signal compute: the engine functions are already pure; mostly parameterize inputs by
  symbol + cache to avoid `watchlist × signals` API fan-out hammering free-tier rate limits.
- Execution safety: server-side encryption, trade-only permissions, confirmation modal, kill-switch,
  audit log.

## Key files
- Engines: `lib/{opportunity-engine,black-swan-detector,crypto-regime-score,indicator-score,research-corpus}.ts`
- Pagination reference: `app/api/crypto/history-compare/route.ts`
- Notification pieces: `components/subscription-card.tsx`, `app/api/check-alerts/route.ts`,
  `lib/email-templates.tsx`, `vercel.json`
- News: `app/api/news/route.ts`; DB: `scripts/001_002_*.sql`
