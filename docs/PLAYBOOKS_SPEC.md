# eatfear Playbooks Spec — Executable Trade Methods

Status: **specification** (v1, 2026-07). Companion to `ROADMAP.md`.

## Why this spec exists

The platform today outputs *conditions*: composite scores (Black Swan 0–100,
Euphoria 0–100), bands, factor evidence, and forward-return backtests. That is a
reading, not a method. A professional product must close the last mile: a user
seeing "Black Swan 74 · strong" must be able to answer **what do I do, how much,
where am I wrong, and when do I leave** — without improvising.

This spec defines **playbooks**: named, versioned, machine-checkable trade
methods. Every playbook binds only to signals the codebase already computes
(no new data vendors), and every rule is expressed against a concrete field so
it can be evaluated by the worker, backtested by `/api/crypto/signal-backtest`-
style endpoints, dry-run through `paper_positions`, and journaled per-method in
`trades_journal`.

**Honesty contract (inherits ROADMAP guardrails):** playbooks are rules-based
probability methods, not top/bottom prediction. Every playbook must publish its
historical sample size, hit rate, median forward return, median max adverse
excursion, and at least one named failure case. A playbook without computed
history ships as `status: "candidate"` and cannot fire real alerts.

---

## 1. Playbook schema

Every playbook is a typed record (`lib/playbooks.ts`, to be implemented):

```ts
interface Playbook {
  id: string                    // stable slug, e.g. "capitulation-reversal-long"
  version: number               // bump on any rule change; journal rows pin version
  market: "crypto" | "us_equity"
  direction: "long" | "short" | "trim" | "program"
  horizon: { minDays: number; maxDays: number }
  status: "active" | "candidate" | "retired"

  // Machine-checkable clauses. Every clause names an engine field + comparator,
  // so the worker can evaluate it and the UI can render pass/fail per clause.
  setup: RuleClause[]           // regime filter: is this playbook even relevant now
  trigger: RuleClause[]         // ALL must pass at one observation → signal event
  confirmation?: RuleClause[]   // optional next-bar confirmation gate
  invalidation: InvalidationRule // hard exit: price level or condition
  sizing: SizingRule            // vol-target formula, never a fixed notional
  exits: ExitRule[]             // profit ladder + time stop; ALL playbooks have a time stop

  evidence: {                   // computed, not asserted
    backtestEndpoint: string    // route that reproduces the stats
    minSampleSize: number       // below this → stays "candidate"
    failureCases: string[]      // named historical failures, shown in UI + alerts
  }
}
```

`RuleClause` references real payload fields, e.g.
`{ source: "black-swan", field: "summary.opportunityScore", op: ">=", value: 70 }`
or `{ source: "black-swan", field: "activeSignals[].code", op: "includes", value: "FUNDING_NEGATIVE" }`.

**Non-negotiable invariants** (enforced by unit test over the catalog):
- every playbook has an `invalidation` and a time-stop exit;
- `sizing` is risk-based (`riskPct / stopDistance`), never "all in";
- `status: "active"` requires backtest sample ≥ `minSampleSize`;
- short-direction playbooks must include a crowding/funding confirmation clause
  (never short strength on price extension alone).

---

## 2. The v1 catalog — seven executable methods

Thresholds below bind to shipped code: Black Swan bands 85/70/50/30
(`lib/black-swan-detector.ts`), Euphoria bands 82/68/52/34
(`lib/euphoria-detector.ts`), state machine enter/trigger/invalidate/resolve
(`lib/signal-state.ts`), stock panic ladder VIX 30/40 · HY OAS 550/800 bps ·
SPX drawdown 20/30% (`/api/stock/panic-signal`).

### PB-01 · Capitulation Reversal Long（恐慌插针反转做多）
- **Market/direction:** crypto majors (BTC/ETH first) · long · horizon 7–30d.
- **Setup:** Black Swan score ≥ 50 (band ≥ building).
- **Trigger (all):** score ≥ 70; AND ≥ 2 alert-tier signals active; AND at least
  one of `WICK_EXTREME` / `LIQUIDATION_FLUSH` (forced-flush evidence, not just
  slow bleed).
- **Confirmation:** next daily close above the capitulation candle's midpoint.
  No confirmation → no entry; setups that never confirm are logged as skipped.
- **Entry:** market at confirmation close (paper: recorded close).
- **Invalidation:** daily close below the capitulation candle's low. Hard stop.
- **Sizing:** risk 1.0% of equity; size = risk ÷ (entry − stop)/entry.
- **Exits:** ½ at +1R; trail remainder at SMA20; time stop 30 daily bars.
- **Evidence:** `/api/crypto/signal-backtest?signal=black-swan` (7/30/90d
  median, hit rate, MAE). Failure case to display: 2018-11 and 2022-06 — first
  capitulation prints preceded another −30–50%; that is *why* the confirmation
  gate and the hard stop exist.

### PB-02 · Euphoria Trim Ladder（亢奋止盈阶梯 · 非做空）
- **Market/direction:** crypto majors · trim (reduce existing longs) · program.
- **Trigger ladder:** Euphoria ≥ 68 → trim 25% of position; ≥ 82 → trim to
  ≤ 50% of original; Mayer ≥ 2.4 while Euphoria ≥ 68 → trim to core (≤ 25%).
- **Reset:** ladder re-arms only after Euphoria < 34 (state-machine `resolve`).
- **Invalidation:** none — trimming needs no stop; the method's risk is
  opportunity cost, and the UI must say so.
- **Evidence:** euphoria backtest short-side forward returns; honest framing:
  overbought persists — this is why the default method is *trim*, not short.

### PB-03 · Euphoria Blow-off Short（吹顶做空 · 严格门槛）
- **Market/direction:** crypto majors · short · horizon 3–14d. Status:
  **candidate until backtest sample ≥ 30** — shorts do not fire alerts before that.
- **Trigger (all):** Euphoria ≥ 82; AND upper-wick exhaustion factor ≥ 70 (a
  rejection candle actually printed); AND funding ≥ 0.10%/8h (crowded longs pay
  you to wait); AND OI 7-print change > +10% (fresh leverage, not spot demand).
- **Entry:** on the close of the rejection candle, or a retest of its midpoint.
- **Invalidation:** daily close above the rejection candle's high. Hard stop.
- **Sizing:** risk 0.5% of equity (half of PB-01 — asymmetric by design).
- **Exits:** ½ at +1R; rest at SMA20 touch; time stop 14 bars; **funding flip
  negative = exit immediately** (the crowd you were fading is gone).
- **Failure case:** every 2020–2021 leg where Euphoria stayed > 80 for weeks.

### PB-04 · Funding-Flush Mean Reversion（资金费率清洗回归）
- **Market/direction:** crypto majors · long scalp · horizon 3–7d.
- **Trigger (all):** funding flipped from > +0.03% to < 0 within 6 prints; AND
  OI 24-print change ≤ −8% (`LIQUIDATION_FLUSH` evidence); AND price above its
  90d low (this is a positioning reset, not a knife catch — PB-01 owns knives).
- **Invalidation:** close below the flush candle low; sizing 0.75% risk.
- **Exits:** funding back > +0.02% (repricing done) or time stop 7 bars.

### PB-05 · Mayer Value Program（Mayer 区间定投程序）
- **Market/direction:** BTC · program (DCA), the "investor" counterpart to PB-01.
- **Rules:** Mayer < 0.8 → weekly buy of 1 unit; < 0.6 → 2 units; ≥ 1.2 → halt
  buys; exit ladder mirrors PB-02 (Mayer 2.4 trim schedule). Unit = a fixed %
  of investable cash decided once, in the checklist, not per week.
- **Invalidation:** none (program). Displayed risk: in 2018/2022 the < 0.8 zone
  deepened another 30–50%; the program's defense is schedule + unit cap, and
  the UI must show cumulative deployed % at all times.

### PB-06 · VIX Panic Staged Entry（VIX 恐慌分批入场 · 美股指数）
- **Market/direction:** US equity index (SPY/QQQ proxies) · long · horizon 3–12mo.
- **Trigger:** VIX daily close ≥ 40; or VIX ≥ 30 AND HY OAS ≥ 550 bps.
- **Entry program:** 3 tranches (40/30/30%) over 10 sessions; a further SPX leg
  −5% accelerates the next tranche.
- **Invalidation:** none price-based; program guard = tranche cap. The known
  failure case ships with the card: 2008 — VIX held > 40 for ~8 months while
  SPX fell another ~50%; tranche capping is the survival mechanism.
- **Evidence:** since 1990, SPX higher 12m after a > 40 VIX close ~90% of the
  time (already cited in README); needs a reproducing endpoint before `active`.

### PB-07 · Drawdown Ladder Add（回撤阶梯加仓 · 美股指数）
- **Trigger ladder:** SPX −20% from 52w high → deploy unit 1; −30% → unit 2
  (2×). Halt: HY OAS > 800 bps pauses the ladder (credit stress regime, wait
  for OAS < 700 re-arm).
- Program rules otherwise as PB-05 (unit defined once; cumulative % visible).

---

## 3. Engineering plan (maps to existing infra, in order)

1. **`lib/playbooks.ts`** — typed catalog of the seven records above + a pure
   `evaluatePlaybook(playbook, snapshot)` returning per-clause pass/fail and an
   overall `setup/triggered/confirmed` verdict. Unit-test the invariants in §1.
2. **`/playbooks` page** — one card per method: live clause checklist (green/
   red per rule), current verdict, the backtest stats block, failure cases, and
   two buttons: *Paper trade this* (pre-fills `paper_positions` with entry/
   `sl`/`tp`/`size` from the sizing rule) and *Alert me* (creates an
   `alert_rules` row: `signal_id = playbook id`, `threshold` = trigger score).
3. **Worker integration** — the ROADMAP's 5-minute worker evaluates playbooks
   (not just raw scores) per watchlist symbol and writes `signal_events` with
   `signal_id = playbook id`; `/api/alerts/dispatch` then delivers them with
   the full clause evidence. Alert body = clause list + stats + invalidation +
   risk line (guardrail already mandated in ROADMAP).
4. **Journal binding** — `trades_journal.signal_id` stores playbook id +
   version (`"pb-01@1"`); journal page adds a per-playbook personal win-rate
   table: *the platform's* stats vs *your* execution of the same method — the
   learning loop's payoff.
5. **Per-playbook backtest routes** — extend `signal-backtest` to accept
   `playbook=pb-01` and replay the actual clause set (trigger + confirmation +
   invalidation exit), not just wick/z occurrences, so displayed stats match
   the executable rules exactly. This is the gate that flips a playbook from
   `candidate` to `active`.
6. **Paper mark-to-market worker** (ROADMAP item 6) — settles open
   `paper_positions` against daily bars using stop-first convention (already
   the convention in `lib/paper-trading.ts`).

Acceptance per phase: catalog invariant tests green; `/playbooks` renders all
seven with live clause evaluation for BTC; a triggered PB-01 produces one
alert (email + in-app + Telegram when bound) whose body contains every clause,
the stats, and the invalidation; a paper trade opened from PB-01 settles
correctly on a stop-hit bar; journal shows per-playbook win rate after 3
logged trades.

## 4. Professionalization checklist (beyond playbooks)

- **Determinism & tests:** the catalog, `evaluatePlaybook`, sizing math, and
  settlement rules get unit tests in CI (currently the repo has none — add a
  minimal `node --test` or vitest lane and a GitHub Actions workflow running
  `tsc --noEmit` + tests + `next build` on PRs).
- **Payload contracts:** freeze the black-swan/euphoria/backtest response
  shapes as exported TS types; playbook clauses import those types so a payload
  change breaks compile, not production.
- **Versioning discipline:** any threshold change bumps `version`; journal and
  `signal_events` rows pin the version they fired under, so historical stats
  are never silently re-based.
- **Compliance surface:** every playbook card, alert, and the `/playbooks`
  page carry the standing disclaimer; short and program methods additionally
  state their named failure case inline, not behind a tooltip.
