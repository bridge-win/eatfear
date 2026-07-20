import assert from "node:assert/strict"
import { test } from "node:test"

import {
  freshnessFrom,
  normalizeBinanceActor,
  normalizeHyperliquidActor,
  normalizeOkxActor,
  normalizePolymarketActor,
  ratioToPercentagePoints,
  toFiniteNumber,
} from "./normalize.ts"

const NOW = Date.UTC(2026, 6, 20, 12)

test("normalizes OKX ratios and Binance percentages to percentage points", () => {
  const okx = normalizeOkxActor({
    uniqueCode: "F6476365DB0D09A3",
    nickName: "maomao12345",
    pnl: "943709.83",
    pnlRatio: "0.3341",
    winRatio: "0.7037",
    aum: "3507.12",
    leadDays: "1023",
    copyTraderNum: "32",
    maxCopyTraderNum: "300",
    traderInsts: ["BTC-USDT-SWAP"],
  }, NOW)
  const binance = normalizeBinanceActor({
    leadPortfolioId: "5108371059752839168",
    nickname: "Lead trader",
    roi: 5301.99005542,
    pnl: 212079.60221682,
    aum: 349040.50145467,
    mdd: 42.16587,
    winRate: 60,
    currentCopyCount: 500,
    maxCopyCount: 500,
    startTime: Date.UTC(2026, 5, 26),
  }, NOW)

  assert.equal(okx.metrics.roiPct, 33.41)
  assert.equal(okx.metrics.winRatePct, 70.37)
  assert.equal(binance.metrics.roiPct, 5301.99005542)
  assert.equal(binance.metrics.winRatePct, 60)
  assert.equal(binance.metrics.maxDrawdownPct, 42.16587)
  assert.equal(binance.metrics.accountValueUsd, 349040.50145467)
  assert.equal(binance.metrics.capacityUsedPct, 100)
})

test("keeps absent and invalid numeric fields null", () => {
  const actor = normalizeBinanceActor({
    leadPortfolioId: "1",
    roi: "",
    aum: "NaN",
    winRate: null,
  }, NOW)

  assert.equal(actor.metrics.roiPct, null)
  assert.equal(actor.metrics.accountValueUsd, null)
  assert.equal(actor.metrics.winRatePct, null)
  assert.equal(toFiniteNumber(null), null)
  assert.equal(toFiniteNumber(""), null)
  assert.equal(toFiniteNumber("Infinity"), null)
  assert.equal(ratioToPercentagePoints(undefined), null)
})

test("normalizes Polymarket and Hyperliquid performance windows", () => {
  const polymarket = normalizePolymarketActor({
    rank: "1",
    proxyWallet: "0x204f72f35326db932158cba6adff0b9a1da95e14",
    userName: "swisstony",
    verifiedBadge: false,
    vol: 372287621.52,
    pnl: 8652404.03,
  }, NOW)
  const hyperliquid = normalizeHyperliquidActor({
    ethAddress: "0x1111111111111111111111111111111111111111",
    accountValue: "125000",
    windowPerformances: [
      ["day", { pnl: "500", roi: "0.01", vlm: "10000" }],
      ["month", { pnl: "12000", roi: "0.24", vlm: "900000" }],
      ["allTime", { pnl: "80000", roi: "1.6", vlm: "5000000" }],
    ],
  }, NOW)

  assert.equal(polymarket.metrics.pnlUsd, 8652404.03)
  assert.equal(polymarket.metrics.volumeUsd, 372287621.52)
  assert.equal(hyperliquid.metrics.pnlUsd, 12000)
  assert.equal(hyperliquid.metrics.roiPct, 24)
  assert.equal(hyperliquid.metrics.accountValueUsd, 125000)
})

test("classifies freshness from the actual observation age", () => {
  assert.equal(freshnessFrom(NOW - 5_000, NOW), "live")
  assert.equal(freshnessFrom(NOW - 2 * 60_000, NOW), "fresh")
  assert.equal(freshnessFrom(NOW - 20 * 60_000, NOW), "delayed")
  assert.equal(freshnessFrom(NOW - 2 * 60 * 60_000, NOW), "stale")
  assert.equal(freshnessFrom(null, NOW), "unavailable")
})
