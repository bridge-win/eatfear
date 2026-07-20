import assert from "node:assert/strict"
import { test } from "node:test"

import {
  freshnessFrom,
  normalizeBinanceActor,
  normalizeHyperliquidActor,
  normalizeHyperliquidTrade,
  normalizeOkxActor,
  normalizePolymarketActor,
  normalizePolymarketTrade,
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

test("builds stable event ids and preserves direct verification links", () => {
  const address = "0x79569c573fd62c0aa3be35f48ec282d185f3eba5"
  const trade = {
    proxyWallet: address,
    side: "BUY",
    asset: "106791278548747150343884234399469582300633057093599143671464563548029067901636",
    conditionId: "0x11746412cf15fec7d76c07a46bb6751da804c3c66a7b720aea44cc4a8c587fb5",
    size: 6.521738,
    price: 0.4599999264,
    timestamp: Math.floor((NOW - 5_000) / 1_000),
    title: "Will the lowest temperature be 27°C?",
    slug: "lowest-temperature-27c",
    outcome: "Yes",
    name: "trashMESH3",
    transactionHash: "0x7fb93510c31762bc67a24fa8a5b45a816abe43b4e3a0d3cc13aedc6b90602b3b",
  }

  const first = normalizePolymarketTrade(trade, new Set([address]), NOW)
  const second = normalizePolymarketTrade(trade, new Set([address]), NOW + 1_000)

  assert.equal(first.id, second.id)
  assert.equal(first.qualification, "ranked")
  assert.equal(first.amountUsd, 3)
  assert.match(first.verificationUrl, /^https:\/\/polymarket\.com\//)
  assert.equal(first.provenance.freshness, "live")
})

test("attributes Hyperliquid trade sides using the official buyer-seller ordering", () => {
  const buyer = "0x0fd468a73084daa6ea77a9261e40fdec3e67e0c7"
  const seller = "0x428049ba49a2e6747c860eaafa468f8e78212a6c"
  const trade = {
    coin: "BTC",
    side: "A",
    px: "65473.0",
    sz: "0.02606",
    time: NOW - 3_000,
    hash: "0x203b9fbb10f51dd721b504405be023020cd000a0abf83ca9c4044b0dcff8f7c1",
    tid: 770160123608623,
    users: [buyer, seller] as [string, string],
  }

  const buyerEvent = normalizeHyperliquidTrade(trade, buyer, new Set([buyer]), NOW)
  const sellerEvent = normalizeHyperliquidTrade(trade, seller, new Set([buyer]), NOW)

  assert.equal(buyerEvent.action, "buy")
  assert.equal(buyerEvent.qualification, "ranked")
  assert.equal(sellerEvent.action, "sell")
  assert.equal(sellerEvent.qualification, "observed_large_trade")
  assert.equal(buyerEvent.amountUsd, 1_706.23)
})
