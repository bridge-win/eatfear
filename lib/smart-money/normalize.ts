import type {
  BinanceActorInput,
  DataFreshness,
  DataProvenance,
  HyperliquidActorInput,
  HyperliquidTradeInput,
  OkxActorInput,
  PolymarketActorInput,
  PolymarketTradeInput,
  SmartMoneyActor,
  SmartMoneyActorMetrics,
  SmartMoneyEvent,
  SmartMoneyQuality,
  SmartMoneyVenue,
} from "./types.ts"

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

const EMPTY_QUALITY: SmartMoneyQuality = {
  version: "actor-quality-v1",
  score: 0,
  copyabilityScore: 0,
  category: "unranked",
  confidence: "low",
  coverage: 0,
  components: [],
  flags: [],
}

export function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function ratioToPercentagePoints(value: unknown): number | null {
  const parsed = toFiniteNumber(value)
  return parsed === null ? null : Math.round(parsed * 1_000_000_000_000) / 10_000_000_000
}

export function percentagePoints(value: unknown): number | null {
  return toFiniteNumber(value)
}

export function freshnessFrom(timestamp: number | null, now = Date.now()): DataFreshness {
  if (timestamp === null || !Number.isFinite(timestamp) || timestamp > now + MINUTE_MS) return "unavailable"
  const age = Math.max(0, now - timestamp)
  if (age <= 15_000) return "live"
  if (age <= 5 * MINUTE_MS) return "fresh"
  if (age <= 60 * MINUTE_MS) return "delayed"
  return "stale"
}

function provenance(input: {
  sourceId: SmartMoneyVenue
  sourceName: string
  sourceUrl: string
  now: number
  confidence: number
  limitations: string[]
}): DataProvenance {
  return {
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    sourceType: "first_party",
    sourceUrl: input.sourceUrl,
    eventAt: null,
    observedAt: input.now,
    freshness: freshnessFrom(input.now, input.now),
    freshnessMs: 0,
    verification: "reported",
    confidence: input.confidence,
    limitations: input.limitations,
  }
}

function capacityUsedPct(followers: number | null, maximum: number | null): number | null {
  if (followers === null || maximum === null || maximum <= 0) return null
  return Math.max(0, Math.min(100, (followers / maximum) * 100))
}

function baseMetrics(overrides: Partial<SmartMoneyActorMetrics>): SmartMoneyActorMetrics {
  return {
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
    ...overrides,
  }
}

function safeName(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, 80) : fallback
}

export function normalizeOkxActor(raw: OkxActorInput, now = Date.now()): SmartMoneyActor {
  const code = raw.uniqueCode?.trim() || "unknown"
  const followers = toFiniteNumber(raw.copyTraderNum)
  const maxFollowers = toFiniteNumber(raw.maxCopyTraderNum)
  return {
    id: `okx:${code}`,
    venue: "okx",
    name: safeName(raw.nickName, `OKX ${code.slice(0, 8)}`),
    address: null,
    avatarUrl: raw.portLink?.trim() || null,
    profileUrl: `https://www.okx.com/copy-trading/account/${encodeURIComponent(code)}`,
    categories: ["copy_trader", ...(raw.traderInsts?.slice(0, 8) ?? [])],
    metrics: baseMetrics({
      pnlUsd: toFiniteNumber(raw.pnl),
      roiPct: ratioToPercentagePoints(raw.pnlRatio),
      winRatePct: ratioToPercentagePoints(raw.winRatio),
      accountValueUsd: toFiniteNumber(raw.aum),
      followers,
      maxFollowers,
      capacityUsedPct: capacityUsedPct(followers, maxFollowers),
      activeDays: toFiniteNumber(raw.leadDays),
    }),
    quality: { ...EMPTY_QUALITY },
    provenance: provenance({
      sourceId: "okx",
      sourceName: "OKX Copy Trading",
      sourceUrl: "https://www.okx.com/docs-v5/en/#order-book-trading-copy-trading-get-lead-traders",
      now,
      confidence: 0.92,
      limitations: ["Venue-reported performance window", "Identity is not independently verified"],
    }),
  }
}

export function normalizeBinanceActor(raw: BinanceActorInput, now = Date.now()): SmartMoneyActor {
  const code = raw.leadPortfolioId === null || raw.leadPortfolioId === undefined
    ? "unknown"
    : String(raw.leadPortfolioId)
  const followers = toFiniteNumber(raw.currentCopyCount)
  const maxFollowers = toFiniteNumber(raw.maxCopyCount)
  const startTime = toFiniteNumber(raw.startTime)
  const activeDays = startTime !== null && startTime <= now ? Math.floor((now - startTime) / DAY_MS) : null
  return {
    id: `binance:${code}`,
    venue: "binance",
    name: safeName(raw.nickname, `Binance ${code.slice(0, 8)}`),
    address: null,
    avatarUrl: raw.avatarUrl?.trim() || null,
    profileUrl: `https://www.binance.com/en/copy-trading/lead-details/${encodeURIComponent(code)}`,
    categories: ["copy_trader"],
    metrics: baseMetrics({
      pnlUsd: toFiniteNumber(raw.pnl),
      roiPct: percentagePoints(raw.roi),
      winRatePct: percentagePoints(raw.winRate),
      maxDrawdownPct: percentagePoints(raw.mdd),
      accountValueUsd: toFiniteNumber(raw.aum ?? raw.aumAmount),
      followers,
      maxFollowers,
      capacityUsedPct: capacityUsedPct(followers, maxFollowers),
      activeDays,
    }),
    quality: { ...EMPTY_QUALITY },
    provenance: provenance({
      sourceId: "binance",
      sourceName: "Binance Copy Trading",
      sourceUrl: "https://www.binance.com/en/copy-trading",
      now,
      confidence: 0.76,
      limitations: ["Undocumented web endpoint", "Venue-reported performance window", "Identity is not independently verified"],
    }),
  }
}

export function normalizePolymarketActor(raw: PolymarketActorInput, now = Date.now()): SmartMoneyActor {
  const address = raw.proxyWallet?.trim().toLowerCase() || "unknown"
  const categories = ["prediction_market_trader"]
  if (raw.verifiedBadge) categories.push("polymarket_verified_profile")
  return {
    id: `polymarket:${address}`,
    venue: "polymarket",
    name: safeName(raw.userName, `${address.slice(0, 6)}…${address.slice(-4)}`),
    address: address === "unknown" ? null : address,
    avatarUrl: raw.profileImage?.trim() || null,
    profileUrl: address === "unknown" ? "https://polymarket.com/leaderboard" : `https://polymarket.com/profile/${address}`,
    categories,
    metrics: baseMetrics({
      rank: toFiniteNumber(raw.rank),
      pnlUsd: toFiniteNumber(raw.pnl),
      volumeUsd: toFiniteNumber(raw.vol),
    }),
    quality: { ...EMPTY_QUALITY },
    provenance: provenance({
      sourceId: "polymarket",
      sourceName: "Polymarket Data API",
      sourceUrl: "https://docs.polymarket.com/api-reference/core/get-trader-leaderboard-rankings",
      now,
      confidence: 0.96,
      limitations: ["Leaderboard window is selected by the request", "Profile verification does not prove trading intent"],
    }),
  }
}

function hyperliquidWindow(raw: HyperliquidActorInput, preferred: string): { pnl: number | null; roi: number | null; volume: number | null } {
  const windows = Array.isArray(raw.windowPerformances) ? raw.windowPerformances : []
  const selected = windows.find(([name]) => name === preferred)?.[1]
    ?? windows.find(([name]) => name === "allTime")?.[1]
    ?? windows[0]?.[1]
  return {
    pnl: toFiniteNumber(selected?.pnl),
    roi: ratioToPercentagePoints(selected?.roi),
    volume: toFiniteNumber(selected?.vlm),
  }
}

export function normalizeHyperliquidActor(raw: HyperliquidActorInput, now = Date.now()): SmartMoneyActor {
  const address = raw.ethAddress?.trim().toLowerCase() || "unknown"
  const month = hyperliquidWindow(raw, "month")
  return {
    id: `hyperliquid:${address}`,
    venue: "hyperliquid",
    name: safeName(raw.displayName, `${address.slice(0, 6)}…${address.slice(-4)}`),
    address: address === "unknown" ? null : address,
    avatarUrl: null,
    profileUrl: address === "unknown" ? "https://app.hyperliquid.xyz/leaderboard" : `https://hypurrscan.io/address/${address}`,
    categories: ["perpetual_trader"],
    metrics: baseMetrics({
      pnlUsd: month.pnl,
      roiPct: month.roi,
      accountValueUsd: toFiniteNumber(raw.accountValue),
      volumeUsd: month.volume,
    }),
    quality: { ...EMPTY_QUALITY },
    provenance: provenance({
      sourceId: "hyperliquid",
      sourceName: "Hyperliquid Stats",
      sourceUrl: "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard",
      now,
      confidence: 0.97,
      limitations: ["Public opt-in leaderboard", "Address ownership and external hedges are unknown"],
    }),
  }
}

function eventTimestamp(value: unknown, now: number): number | null {
  const parsed = toFiniteNumber(value)
  if (parsed === null) return null
  const milliseconds = parsed < 10_000_000_000 ? parsed * 1_000 : parsed
  return milliseconds <= now + MINUTE_MS ? milliseconds : null
}

function money(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100
}

function eventProvenance(input: {
  sourceId: "polymarket" | "hyperliquid"
  sourceName: string
  sourceUrl: string
  eventAt: number | null
  now: number
  confidence: number
  limitations: string[]
}): DataProvenance {
  const freshnessMs = input.eventAt === null ? null : Math.max(0, input.now - input.eventAt)
  return {
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    sourceType: "first_party",
    sourceUrl: input.sourceUrl,
    eventAt: input.eventAt,
    observedAt: input.now,
    freshness: freshnessFrom(input.eventAt, input.now),
    freshnessMs,
    verification: "settled",
    confidence: input.confidence,
    limitations: input.limitations,
  }
}

function addressName(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

export function normalizePolymarketTrade(
  raw: PolymarketTradeInput,
  rankedAddresses: ReadonlySet<string> = new Set<string>(),
  now = Date.now(),
): SmartMoneyEvent {
  const address = raw.proxyWallet?.trim().toLowerCase() || "unknown"
  const side = raw.side?.toUpperCase() === "SELL" ? "sell" : "buy"
  const transactionId = raw.transactionHash?.trim() || null
  const slug = raw.slug?.trim() || ""
  const eventAt = eventTimestamp(raw.timestamp, now)
  const size = toFiniteNumber(raw.size)
  const price = toFiniteNumber(raw.price)
  const qualification = rankedAddresses.has(address) ? "ranked" : "observed_large_trade"
  const actorName = safeName(raw.name ?? raw.pseudonym, addressName(address))
  return {
    id: `polymarket:${transactionId ?? raw.conditionId ?? raw.asset ?? "unknown"}:${address}:${side}`,
    actorId: `polymarket:${address}`,
    actorName,
    address: address === "unknown" ? null : address,
    venue: "polymarket",
    action: side,
    asset: raw.outcome?.trim() || "MARKET",
    market: raw.title?.trim() || slug || raw.conditionId?.trim() || "Polymarket market",
    amountUsd: size !== null && price !== null ? money(size * price) : null,
    priceUsd: price,
    pnlUsd: null,
    transactionId,
    verificationUrl: slug ? `https://polymarket.com/event/${encodeURIComponent(slug)}` : "https://polymarket.com/activity",
    qualification,
    provenance: eventProvenance({
      sourceId: "polymarket",
      sourceName: "Polymarket Data API",
      sourceUrl: "https://docs.polymarket.com/api-reference/core/get-trades-for-a-user-or-markets",
      eventAt,
      now,
      confidence: qualification === "ranked" ? 0.96 : 0.62,
      limitations: [
        "The trade is observable but external hedges and intent are unknown",
        qualification === "ranked" ? "Actor qualified by the monthly leaderboard" : "Large trade is not a smart-actor classification",
      ],
    }),
  }
}

export function normalizeHyperliquidTrade(
  raw: HyperliquidTradeInput,
  participantAddress: string,
  rankedAddresses: ReadonlySet<string> = new Set<string>(),
  now = Date.now(),
): SmartMoneyEvent {
  const address = participantAddress.trim().toLowerCase() || "unknown"
  const buyer = raw.users?.[0]?.toLowerCase()
  const seller = raw.users?.[1]?.toLowerCase()
  const action = address === seller ? "sell" : "buy"
  const price = toFiniteNumber(raw.px)
  const size = toFiniteNumber(raw.sz)
  const eventAt = eventTimestamp(raw.time, now)
  const rawHash = raw.hash?.trim() || ""
  const validHash = /^0x[0-9a-fA-F]{64}$/.test(rawHash) && !/^0x0{64}$/.test(rawHash)
  const transactionId = validHash ? rawHash : raw.tid === undefined ? null : String(raw.tid)
  const qualification = rankedAddresses.has(address) ? "ranked" : "observed_large_trade"
  const asset = raw.coin?.trim().toUpperCase() || "UNKNOWN"
  return {
    id: `hyperliquid:${raw.time ?? "unknown"}:${asset}:${raw.tid ?? transactionId ?? "unknown"}:${address}:${action}`,
    actorId: `hyperliquid:${address}`,
    actorName: addressName(address),
    address: address === "unknown" ? null : address,
    venue: "hyperliquid",
    action,
    asset,
    market: `${asset}-PERP`,
    amountUsd: price !== null && size !== null ? money(price * size) : null,
    priceUsd: price,
    pnlUsd: null,
    transactionId,
    verificationUrl: validHash ? `https://hypurrscan.io/tx/${encodeURIComponent(rawHash)}` : "https://app.hyperliquid.xyz/trade",
    qualification,
    provenance: eventProvenance({
      sourceId: "hyperliquid",
      sourceName: "Hyperliquid",
      sourceUrl: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions",
      eventAt,
      now,
      confidence: qualification === "ranked" ? 0.97 : 0.64,
      limitations: [
        "Buyer and seller are settled counterparties; the fill does not reveal whether a position opened or closed",
        qualification === "ranked" ? "Actor qualified by the official public leaderboard" : "Large trade is not a smart-actor classification",
        buyer && seller ? "Official trade schema orders users as buyer then seller" : "Counterparty ordering was incomplete",
      ],
    }),
  }
}
