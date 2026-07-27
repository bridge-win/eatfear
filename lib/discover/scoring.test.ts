import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCandidate,
  buildStableYieldAsset,
  buildStableYieldIdeas,
  calculateAnnualizedVolatility,
  calculateMaxDrawdownPct,
  type PriceHistoryPoint,
} from "./scoring.ts"
import type { DiscoverUniverseEntry, StableYieldAssetEntry } from "./types.ts"

function historyFromPrices(prices: number[]): PriceHistoryPoint[] {
  return prices.map((close, index) => ({
    timestamp: 1_700_000_000_000 + index * 86_400_000,
    close,
    volume: 10_000_000,
  }))
}

const entry: DiscoverUniverseEntry = {
  symbol: "TEST",
  name: "Test Quality Stock",
  assetType: "Stock",
  sector: "Software",
  quality: "mega_cap",
}

test("calculates volatility and drawdown from price history", () => {
  const history = historyFromPrices([100, 110, 105, 90, 120])
  assert.ok(calculateAnnualizedVolatility(history) === 0)
  assert.equal(calculateMaxDrawdownPct(history), 18.181818181818183)
})

test("builds modeled option candidates with explicit estimate source", () => {
  const prices = Array.from({ length: 220 }, (_, index) => 100 + index * 0.08 + Math.sin(index / 3) * 5)
  const history = historyFromPrices(prices)
  const candidate = buildCandidate({
    entry,
    history,
    price: prices.at(-1) ?? 118,
    previousClose: prices.at(-2) ?? 117,
    asOf: 1_800_000_000_000,
    riskFreeRatePct: 4,
  }, "cash_secured_put")

  assert.ok(candidate)
  assert.equal(candidate.data.premiumSource, "model_estimate")
  assert.equal(candidate.strategy, "cash_secured_put")
  assert.ok(candidate.annualizedYieldPct > 0)
  assert.ok(candidate.reasons.some((reason) => reason.includes("modeled annualized")))
  assert.ok(candidate.cautions.some((caution) => caution.includes("not a live option-chain")))
})

test("prefers liquid delayed option-chain bid over model premium", () => {
  const prices = Array.from({ length: 220 }, (_, index) => 100 + index * 0.08 + Math.sin(index / 3) * 5)
  const history = historyFromPrices(prices)
  const candidate = buildCandidate({
    entry,
    history,
    price: prices.at(-1) ?? 118,
    previousClose: prices.at(-2) ?? 117,
    asOf: 1_800_000_000_000,
    riskFreeRatePct: 4,
    optionQuote: {
      optionSymbol: "TEST260918P00105000",
      expirationDate: "2026-09-18",
      daysToExpiration: 45,
      strike: 105,
      bid: 2.5,
      ask: 2.7,
      volume: 120,
      openInterest: 900,
      quoteTime: 1_800_000_000_000,
      sourceUrl: "https://cdn.cboe.com/api/global/delayed_quotes/options/TEST.json",
    },
  }, "cash_secured_put")

  assert.ok(candidate)
  assert.equal(candidate.data.premiumSource, "live_chain")
  assert.equal(candidate.data.optionSymbol, "TEST260918P00105000")
  assert.equal(candidate.premiumEstimate, 2.5)
  assert.equal(candidate.strike, 105)
  assert.equal(candidate.data.optionOpenInterest, 900)
  assert.ok(candidate.strike < candidate.price)
})

test("stable-yield ideas derive estimated yields from Treasury proxy", () => {
  const ideas = buildStableYieldIdeas(4.75)
  const tBill = ideas.find((idea) => idea.id === "t-bill-ladder")
  const deposits = ideas.find((idea) => idea.id === "insured-deposit")

  assert.equal(tBill?.estimatedAnnualYieldPct, 4.75)
  assert.equal(deposits?.riskBand, "low")
  assert.ok(ideas.every((idea) => idea.sourceUrl.startsWith("https://")))
})

test("builds concrete stable-yield asset rows from live-style history", () => {
  const stableEntry: StableYieldAssetEntry = {
    symbol: "SGOV",
    name: "iShares 0-3 Month Treasury Bond ETF",
    category: "Treasury bill ETF",
    issuer: "iShares",
    sourceUrl: "https://www.ishares.com/us/products/314116/ishares-0-3-month-treasury-bond-etf",
    yieldOffsetPct: -0.08,
    liquidity: "Intraday ETF liquidity.",
    principalRisk: "ETF shares are not bank deposits.",
    issuerObjective: "Tracks U.S. Treasury bills with maturities of 0-3 months.",
    riskClass: "treasury_cash",
  }
  const prices = Array.from({ length: 90 }, (_, index) => 100 + index * 0.002 + Math.sin(index / 9) * 0.015)
  const asset = buildStableYieldAsset({
    entry: stableEntry,
    history: historyFromPrices(prices),
    price: prices.at(-1) ?? 100.18,
    previousClose: prices.at(-2) ?? 100.16,
    asOf: 1_800_000_000_000,
    treasuryBillProxyRatePct: 4.75,
  })

  assert.ok(asset)
  assert.equal(asset.symbol, "SGOV")
  assert.equal(asset.estimatedAnnualYieldPct, 4.67)
  assert.ok(asset.riskScore >= 80)
  assert.ok(asset.reasons.some((reason) => reason.includes("Treasury-bill proxy")))
  assert.ok(asset.sourceUrl.startsWith("https://www.ishares.com"))
})
