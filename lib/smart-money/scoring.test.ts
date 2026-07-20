import assert from "node:assert/strict"
import test from "node:test"

import { calculateMarketConsensus, scoreActorCohort } from "./scoring.ts"
import type { SmartMoneyActor, SmartMoneyActorMetrics, SmartMoneyEvent, SmartMoneyVenue } from "./types.ts"

const NOW = 1_750_000_000_000

function actor(id: string, metrics: Partial<SmartMoneyActorMetrics>): SmartMoneyActor {
  return {
    id: `okx:${id}`,
    venue: "okx",
    name: id,
    address: null,
    avatarUrl: null,
    profileUrl: `https://example.com/${id}`,
    categories: ["copy_trader"],
    metrics: {
      rank: null,
      pnlUsd: null,
      roiPct: null,
      winRatePct: null,
      maxDrawdownPct: null,
      accountValueUsd: null,
      volumeUsd: null,
      followers: null,
      maxFollowers: null,
      capacityUsedPct: null,
      activeDays: null,
      ...metrics,
    },
    quality: {
      version: "actor-quality-v1",
      score: 0,
      copyabilityScore: 0,
      category: "unranked",
      confidence: "low",
      coverage: 0,
      components: [],
      flags: [],
    },
    provenance: {
      sourceId: "okx",
      sourceName: "OKX",
      sourceType: "first_party",
      sourceUrl: "https://example.com",
      eventAt: null,
      observedAt: NOW,
      freshness: "live",
      freshnessMs: 0,
      verification: "reported",
      confidence: 0.9,
      limitations: [],
    },
  }
}

test("scores stronger risk-adjusted evidence above one-off ROI", () => {
  const consistent = actor("consistent", {
    pnlUsd: 240_000,
    roiPct: 82,
    winRatePct: 71,
    maxDrawdownPct: 8,
    activeDays: 420,
    accountValueUsd: 1_100_000,
    followers: 48,
    maxFollowers: 200,
    capacityUsedPct: 24,
  })
  const lottery = actor("lottery", {
    pnlUsd: 45_000,
    roiPct: 2_400,
    winRatePct: 34,
    maxDrawdownPct: 68,
    activeDays: 7,
    accountValueUsd: 8_000,
    followers: 200,
    maxFollowers: 200,
    capacityUsedPct: 100,
  })

  const scored = scoreActorCohort([consistent, lottery])
  const consistentScore = scored.find((entry) => entry.id === consistent.id)?.quality
  const lotteryScore = scored.find((entry) => entry.id === lottery.id)?.quality

  assert.ok(consistentScore)
  assert.ok(lotteryScore)
  assert.ok(consistentScore.score > lotteryScore.score)
  assert.ok(consistentScore.copyabilityScore > lotteryScore.copyabilityScore)
  assert.ok(lotteryScore.flags.includes("extreme_roi_low_evidence"))
})

test("never marks low-coverage actors proven", () => {
  const [scored] = scoreActorCohort([actor("minimal", { roiPct: 9_999 })])

  assert.equal(scored.quality.confidence, "low")
  assert.equal(scored.quality.category, "unranked")
  assert.ok(scored.quality.coverage < 50)
})

test("excludes impossible metrics and explains score coverage", () => {
  const [scored] = scoreActorCohort([actor("invalid", {
    pnlUsd: 100,
    roiPct: Number.POSITIVE_INFINITY,
    winRatePct: 140,
    maxDrawdownPct: -2,
    activeDays: -1,
    accountValueUsd: -10,
  })])

  assert.deepEqual(scored.quality.components.map((component) => component.key), ["pnl", "completeness"])
  assert.ok(scored.quality.flags.includes("invalid_win_rate"))
  assert.ok(scored.quality.flags.includes("invalid_drawdown"))
  assert.ok(scored.quality.flags.includes("invalid_account_value"))
})

function event(venue: SmartMoneyVenue, actorId: string, action: "buy" | "sell", amountUsd: number, eventAt: number): SmartMoneyEvent {
  return {
    id: `${venue}:${actorId}:${eventAt}`,
    actorId,
    actorName: actorId,
    address: actorId,
    venue,
    action,
    asset: "BTC",
    market: "BTC-PERP",
    amountUsd,
    priceUsd: 65_000,
    pnlUsd: null,
    transactionId: `tx-${actorId}-${eventAt}`,
    verificationUrl: "https://example.com/tx",
    qualification: "ranked",
    provenance: {
      sourceId: venue,
      sourceName: venue,
      sourceType: "first_party",
      sourceUrl: "https://example.com",
      eventAt,
      observedAt: NOW,
      freshness: "live",
      freshnessMs: NOW - eventAt,
      verification: "settled",
      confidence: 0.95,
      limitations: [],
    },
  }
}

test("requires actor and venue diversity before directional consensus", () => {
  const singleVenue = [
    event("hyperliquid", "buyer-1", "buy", 100_000, NOW - 1_000),
    event("hyperliquid", "buyer-2", "buy", 80_000, NOW - 2_000),
    event("hyperliquid", "seller-1", "sell", 10_000, NOW - 3_000),
  ]
  const diverse = [
    ...singleVenue,
    event("polymarket", "buyer-3", "buy", 20_000, NOW - 4_000),
    event("hyperliquid", "buyer-1", "buy", 150_000, NOW - 500),
  ]

  assert.equal(calculateMarketConsensus(singleVenue).direction, "insufficient")
  const consensus = calculateMarketConsensus(diverse)
  assert.equal(consensus.direction, "buying")
  assert.equal(consensus.buyers, 3)
  assert.equal(consensus.sellers, 1)
  assert.equal(consensus.actorCount, 4)
  assert.equal(consensus.venueCount, 2)
  assert.equal(consensus.buyUsd, 250_000)
})
