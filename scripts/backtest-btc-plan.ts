import { readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { cleanTradeBars, buildPlanFeatures, planDecision, HORIZONS, PLAN_POLICY, PLAN_VERSION, type Horizon } from "../lib/crypto-trade-plan.ts"
import { runPlanBacktest, buyHoldReturn, type PlanPerformance } from "../lib/crypto-plan-backtest.ts"

const input = process.argv[2]
const output = process.argv[3] ?? "public/research/btc-plan-validation.json"
if (!input) throw new Error("Usage: node scripts/backtest-btc-plan.ts DATA_DIRECTORY [OUTPUT_JSON]")
const compact = ({ equity, ledger, ...stats }: PlanPerformance) => ({ ...stats, exitReasons: ledger.reduce<Record<string, number>>((counts, t) => ({ ...counts, [t.reason]: (counts[t.reason] ?? 0) + 1 }), {}) })
const results = Object.entries(HORIZONS).map(([key, cfg]) => {
  const horizon = key as Horizon
  const raw = readFileSync(`${input}/${key}.json`)
  const meta = JSON.parse(readFileSync(`${input}/${key}.meta.json`, "utf8"))
  if (createHash("sha256").update(raw.toString("utf8")).digest("hex") !== meta.sha256) throw new Error(`data checksum mismatch: ${key}`)
  const bars = cleanTradeBars(JSON.parse(raw.toString()).map((r: (string | number)[]) => ({ time: +r[0], open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5], quoteVolume: +r[7], takerBuyQuote: r[10] === undefined ? null : +r[10] })), cfg.stepMs, meta.asOf)
  if (bars.length < 500) throw new Error(`insufficient ${key} history: ${bars.length}`)
  const split = Math.max(201, Math.floor(bars.length * 0.6))
  const standard = runPlanBacktest(bars, horizon, { startIndex: split })
  const stress = runPlanBacktest(bars, horizon, { startIndex: split, costMultiplier: 2 })
  const baseline = runPlanBacktest(bars, horizon, { startIndex: split, baseline: "ema" })
  const windows = Array.from({ length: 3 }, (_, i) => {
    const startIndex = split + Math.floor((bars.length - split) * i / 3)
    const endIndex = split + Math.floor((bars.length - split) * (i + 1) / 3)
    return { start: bars[startIndex].time, end: bars[endIndex - 1].time + cfg.stepMs, ...compact(runPlanBacktest(bars, horizon, { startIndex, endIndex })) }
  })
  const last = buildPlanFeatures(bars, horizon).at(-1)!
  const gaps = bars.slice(1).filter((b, i) => b.time - bars[i].time !== cfg.stepMs).length
  const enoughSpan = (bars.at(-1)!.time - bars[0].time) / 86_400_000 >= (key === "2d" ? 180 : key === "2w" ? 730 : 1825)
  const issues = [standard.trades < 20 ? "fewer_than_20_holdout_trades" : null, stress.netReturn <= 0 ? "nonpositive_after_cost_stress" : null, windows.some((w) => w.netReturn <= 0) ? "inconsistent_forward_windows" : null, gaps ? "history_gaps" : null, !enoughSpan ? "insufficient_span" : null].filter(Boolean)
  return { horizon, source: meta, window: { first: bars[0].time, holdoutStart: bars[split].time, lastClose: bars.at(-1)!.time + cfg.stepMs, bars: bars.length, gaps }, weights: cfg.weights, standard: compact(standard), doubleCost: compact(stress), emaBaseline: compact(baseline), buyHoldFullExposure: buyHoldReturn(bars, split), forwardWindows: windows, verdict: issues.length ? "not_validated" : "paper_trade_only", issues, latest: { ...last, ...planDecision(last, horizon, meta.asOf) } }
})
const report = { schema: PLAN_VERSION, generatedAt: new Date().toISOString(), policy: PLAN_POLICY, mode: "spot_long_cash", selection: "Weights frozen before test; no holdout optimization. Retrospective evaluation is not prospective validation.", results }
writeFileSync(output, JSON.stringify(report, null, 2) + "\n")
console.log(JSON.stringify(results.map((r) => ({ horizon: r.horizon, bars: r.window.bars, net: r.standard.netReturn, stress: r.doubleCost.netReturn, trades: r.standard.trades, drawdown: r.standard.maxDrawdown, buyHold: r.buyHoldFullExposure, verdict: r.verdict, issues: r.issues, latest: r.latest.action })), null, 2))
