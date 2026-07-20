import {
  normalizeBinanceActor,
  normalizeHyperliquidActor,
  normalizeHyperliquidTrade,
  normalizeOkxActor,
  normalizePolymarketActor,
  normalizePolymarketTrade,
} from "./normalize"
import { scoreActorCohort } from "./scoring"
import type {
  ActorSourceResult,
  BinanceActorInput,
  EventSourceResult,
  HyperliquidActorInput,
  HyperliquidTradeInput,
  OkxActorInput,
  PolymarketActorInput,
  PolymarketTradeInput,
  SmartMoneySourceHealth,
} from "./types"

export interface SourceDefinition {
  id: "okx" | "binance" | "hyperliquid" | "polymarket"
  name: string
  sourceUrl: string
  successStatus?: SmartMoneySourceHealth["status"]
  successMessage: string
}

export const FIRST_PARTY_SOURCES: Record<SourceDefinition["id"], SourceDefinition> = {
  okx: {
    id: "okx",
    name: "OKX Copy Trading",
    sourceUrl: "https://www.okx.com/docs-v5/en/#order-book-trading-copy-trading-get-lead-traders",
    successMessage: "Official copy-trading leaderboard is responding",
  },
  binance: {
    id: "binance",
    name: "Binance Copy Trading",
    sourceUrl: "https://www.binance.com/en/copy-trading",
    successStatus: "degraded",
    successMessage: "Public web endpoint is responding; its contract is undocumented",
  },
  hyperliquid: {
    id: "hyperliquid",
    name: "Hyperliquid Stats",
    sourceUrl: "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard",
    successMessage: "Official public leaderboard is responding",
  },
  polymarket: {
    id: "polymarket",
    name: "Polymarket Data API",
    sourceUrl: "https://docs.polymarket.com/api-reference/core/get-trader-leaderboard-rankings",
    successMessage: "Official public leaderboard is responding",
  },
}

interface FetchResult<T> {
  data: T | null
  health: SmartMoneySourceHealth
}

async function fetchJsonObjectArrayPrefixWithHealth<T>(input: {
  source: SourceDefinition
  url: string
  property: string
  limit: number
  timeoutMs: number
}): Promise<FetchResult<T[]>> {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs)
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  try {
    const response = await fetch(input.url, { cache: "no-store", signal: controller.signal })
    if (!response.ok || response.body === null) {
      return {
        data: null,
        health: health(input.source, {
          status: "unavailable",
          latencyMs: Date.now() - startedAt,
          lastSuccessAt: null,
          message: response.ok ? "Upstream response was not streamable" : `Upstream returned HTTP ${response.status}`,
        }),
      }
    }

    reader = response.body.getReader()
    const decoder = new TextDecoder()
    const marker = `"${input.property}"`
    const rows: T[] = []
    let prefix = ""
    let locatedArray = false
    let current = ""
    let depth = 0
    let inString = false
    let escaped = false

    const consume = (text: string) => {
      let offset = 0
      if (!locatedArray) {
        prefix += text
        const markerIndex = prefix.indexOf(marker)
        const arrayIndex = markerIndex >= 0 ? prefix.indexOf("[", markerIndex + marker.length) : -1
        if (arrayIndex < 0) {
          prefix = prefix.slice(-Math.max(256, marker.length * 2))
          return
        }
        locatedArray = true
        text = prefix.slice(arrayIndex + 1)
        prefix = ""
      }

      for (; offset < text.length && rows.length < input.limit; offset += 1) {
        const character = text[offset]
        if (depth === 0) {
          if (character !== "{") continue
          current = "{"
          depth = 1
          inString = false
          escaped = false
          continue
        }

        current += character
        if (inString) {
          if (escaped) escaped = false
          else if (character === "\\") escaped = true
          else if (character === "\"") inString = false
          continue
        }
        if (character === "\"") inString = true
        else if (character === "{") depth += 1
        else if (character === "}") depth -= 1

        if (depth === 0) {
          rows.push(JSON.parse(current) as T)
          current = ""
        }
      }
    }

    while (rows.length < input.limit) {
      const chunk = await reader.read()
      if (chunk.done) break
      consume(decoder.decode(chunk.value, { stream: true }))
    }
    await reader.cancel()
    const completedAt = Date.now()
    if (rows.length === 0) throw new Error("Array property was empty or missing")
    return {
      data: rows,
      health: health(input.source, {
        status: input.source.successStatus ?? "operational",
        latencyMs: completedAt - startedAt,
        lastSuccessAt: completedAt,
        message: `${input.source.successMessage}; streamed ${rows.length} leading rows`,
      }),
    }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError"
    return {
      data: null,
      health: health(input.source, {
        status: "unavailable",
        latencyMs: Date.now() - startedAt,
        lastSuccessAt: null,
        message: timedOut ? `Timed out after ${input.timeoutMs} ms` : "Upstream stream could not be parsed",
      }),
    }
  } finally {
    clearTimeout(timeout)
    if (reader !== null) void reader.cancel().catch(() => undefined)
  }
}

function health(source: SourceDefinition, input: {
  status: SmartMoneySourceHealth["status"]
  latencyMs: number | null
  lastSuccessAt: number | null
  message: string
}): SmartMoneySourceHealth {
  return {
    sourceId: source.id,
    name: source.name,
    status: input.status,
    latencyMs: input.latencyMs,
    lastSuccessAt: input.lastSuccessAt,
    message: input.message,
    sourceUrl: source.sourceUrl,
  }
}

export async function fetchJsonWithHealth<T>(input: {
  source: SourceDefinition
  url: string
  init?: RequestInit
  timeoutMs: number
}): Promise<FetchResult<T>> {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs)
  try {
    const response = await fetch(input.url, {
      ...input.init,
      cache: input.init?.cache ?? "no-store",
      signal: controller.signal,
    })
    const latencyMs = Date.now() - startedAt
    if (!response.ok) {
      return {
        data: null,
        health: health(input.source, {
          status: "unavailable",
          latencyMs,
          lastSuccessAt: null,
          message: `Upstream returned HTTP ${response.status}`,
        }),
      }
    }
    const data = await response.json() as T
    const completedAt = Date.now()
    return {
      data,
      health: health(input.source, {
        status: input.source.successStatus ?? "operational",
        latencyMs: completedAt - startedAt,
        lastSuccessAt: completedAt,
        message: input.source.successMessage,
      }),
    }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError"
    return {
      data: null,
      health: health(input.source, {
        status: "unavailable",
        latencyMs: Date.now() - startedAt,
        lastSuccessAt: null,
        message: timedOut ? `Timed out after ${input.timeoutMs} ms` : "Upstream request failed",
      }),
    }
  } finally {
    clearTimeout(timeout)
  }
}

interface OkxPayload {
  code?: string
  data?: { ranks?: OkxActorInput[] }[]
}

async function fetchOkxActors(): Promise<ActorSourceResult> {
  const source = FIRST_PARTY_SOURCES.okx
  const result = await fetchJsonWithHealth<OkxPayload>({
    source,
    url: "https://www.okx.com/api/v5/copytrading/public-lead-traders?instType=SWAP&sortType=overview&page=1&limit=20",
    init: { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } },
    timeoutMs: 6_000,
  })
  const rows = result.data?.code === "0" ? result.data.data?.[0]?.ranks : null
  const actors = Array.isArray(rows)
    ? rows.filter((row) => Boolean(row.uniqueCode)).map((row) => normalizeOkxActor(row))
    : []
  return withPayloadValidation(source.id, actors, result.health)
}

interface BinancePayload {
  code?: string
  data?: { list?: BinanceActorInput[] }
}

async function fetchBinanceActors(): Promise<ActorSourceResult> {
  const source = FIRST_PARTY_SOURCES.binance
  const result = await fetchJsonWithHealth<BinancePayload>({
    source,
    url: "https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/home-page/query-list",
    init: {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
      body: JSON.stringify({
        dataType: "ROI",
        favoriteFilter: false,
        hideFull: false,
        nickname: "",
        order: "DESC",
        pageNumber: 1,
        pageSize: 50,
        periodType: "90D",
        portfolioType: "PORTFOLIO_TYPE_ALL",
        sortType: "PNL",
        timeRange: "90D",
      }),
    },
    timeoutMs: 7_000,
  })
  const rows = result.data?.data?.list
  const actors = Array.isArray(rows)
    ? rows.filter((row) => row.leadPortfolioId !== null && row.leadPortfolioId !== undefined).map((row) => normalizeBinanceActor(row))
    : []
  return withPayloadValidation(source.id, actors, result.health)
}

async function fetchPolymarketActors(): Promise<ActorSourceResult> {
  const source = FIRST_PARTY_SOURCES.polymarket
  const result = await fetchJsonWithHealth<PolymarketActorInput[]>({
    source,
    url: "https://data-api.polymarket.com/v1/leaderboard?category=OVERALL&timePeriod=MONTH&orderBy=PNL&limit=50&offset=0",
    timeoutMs: 6_000,
  })
  const actors = Array.isArray(result.data)
    ? result.data.filter((row) => Boolean(row.proxyWallet)).map((row) => normalizePolymarketActor(row))
    : []
  return withPayloadValidation(source.id, actors, result.health)
}

async function fetchHyperliquidActors(): Promise<ActorSourceResult> {
  const source = FIRST_PARTY_SOURCES.hyperliquid
  const result = await fetchJsonObjectArrayPrefixWithHealth<HyperliquidActorInput>({
    source,
    url: "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard",
    property: "leaderboardRows",
    limit: 100,
    timeoutMs: 8_000,
  })
  const rows = result.data
  const actors = Array.isArray(rows)
    ? rows.filter((row) => Boolean(row.ethAddress)).map((row) => normalizeHyperliquidActor(row))
    : []
  return withPayloadValidation(source.id, actors, result.health)
}

function withPayloadValidation(
  sourceId: SourceDefinition["id"],
  actors: ActorSourceResult["actors"],
  sourceHealth: SmartMoneySourceHealth,
): ActorSourceResult {
  if (actors.length > 0) return { sourceId, actors: scoreActorCohort(actors), health: sourceHealth }
  if (sourceHealth.status === "unavailable") return { sourceId, actors, health: sourceHealth }
  return {
    sourceId,
    actors,
    health: {
      ...sourceHealth,
      status: "degraded",
      message: "Upstream responded but its leaderboard payload was empty or incompatible",
    },
  }
}

export async function fetchActorSources(
  venues: ReadonlySet<SourceDefinition["id"]> = new Set(Object.keys(FIRST_PARTY_SOURCES) as SourceDefinition["id"][]),
): Promise<ActorSourceResult[]> {
  const adapters: [SourceDefinition["id"], () => Promise<ActorSourceResult>][] = [
    ["okx", fetchOkxActors],
    ["binance", fetchBinanceActors],
    ["hyperliquid", fetchHyperliquidActors],
    ["polymarket", fetchPolymarketActors],
  ]
  return Promise.all(adapters.filter(([venue]) => venues.has(venue)).map(([, adapter]) => adapter()))
}

function deduplicateEvents(events: EventSourceResult["events"]): EventSourceResult["events"] {
  return [...new Map(events.map((event) => [event.id, event])).values()]
}

function qualifiedHealth(
  sourceHealth: SmartMoneySourceHealth,
  qualificationHealth: SmartMoneySourceHealth | undefined,
  rankedActorCount: number,
): SmartMoneySourceHealth {
  if (sourceHealth.status === "unavailable") return sourceHealth
  if (qualificationHealth?.status === "unavailable") {
    return {
      ...sourceHealth,
      status: "degraded",
      message: `${sourceHealth.message}; leaderboard qualification unavailable`,
    }
  }
  return {
    ...sourceHealth,
    message: `${sourceHealth.message}; matched against ${rankedActorCount} ranked actors`,
  }
}

export async function fetchEventSources(ccy: string): Promise<EventSourceResult[]> {
  const rankingResults = await fetchActorSources(new Set(["hyperliquid", "polymarket"]))
  const hyperliquidRanking = rankingResults.find((result) => result.sourceId === "hyperliquid")
  const polymarketRanking = rankingResults.find((result) => result.sourceId === "polymarket")
  const hyperliquidRanked = new Set(hyperliquidRanking?.actors.flatMap((actor) => actor.address ? [actor.address] : []) ?? [])
  const polymarketRanked = new Set(polymarketRanking?.actors.flatMap((actor) => actor.address ? [actor.address] : []) ?? [])
  const polymarketTradeSource: SourceDefinition = {
    ...FIRST_PARTY_SOURCES.polymarket,
    successMessage: "Official public trade feed is responding",
  }
  const hyperliquidTradeSource: SourceDefinition = {
    ...FIRST_PARTY_SOURCES.hyperliquid,
    successMessage: "Official recent-trades feed is responding",
  }

  const rankedPolymarketAddresses = [...polymarketRanked].slice(0, 8)
  const [polymarketGlobal, hyperliquidTrades, ...polymarketActorFeeds] = await Promise.all([
    fetchJsonWithHealth<PolymarketTradeInput[]>({
      source: polymarketTradeSource,
      url: "https://data-api.polymarket.com/trades?limit=200&takerOnly=true",
      timeoutMs: 5_000,
    }),
    fetchJsonWithHealth<HyperliquidTradeInput[]>({
      source: hyperliquidTradeSource,
      url: "https://api.hyperliquid.xyz/info",
      init: {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ type: "recentTrades", coin: ccy }),
      },
      timeoutMs: 5_000,
    }),
    ...rankedPolymarketAddresses.map((address) => fetchJsonWithHealth<PolymarketTradeInput[]>({
      source: polymarketTradeSource,
      url: `https://data-api.polymarket.com/trades?user=${encodeURIComponent(address)}&limit=10&takerOnly=true`,
      timeoutMs: 5_000,
    })),
  ])

  const polymarketRows = [polymarketGlobal, ...polymarketActorFeeds].flatMap((result) => Array.isArray(result.data) ? result.data : [])
  const polymarketEvents = deduplicateEvents(polymarketRows
    .map((row) => normalizePolymarketTrade(row, polymarketRanked))
    .filter((event) => event.qualification === "ranked" || (event.amountUsd ?? 0) >= 5_000))
  const hyperliquidEvents = deduplicateEvents((Array.isArray(hyperliquidTrades.data) ? hyperliquidTrades.data : [])
    .flatMap((row) => (row.users ?? []).map((address) => normalizeHyperliquidTrade(row, address, hyperliquidRanked)))
    .filter((event) => event.qualification === "ranked" || (event.amountUsd ?? 0) >= 100_000))
  const polymarketHealth = polymarketGlobal.data !== null
    ? polymarketGlobal.health
    : polymarketActorFeeds.find((result) => result.data !== null)?.health ?? polymarketGlobal.health

  return [
    {
      sourceId: "hyperliquid",
      events: hyperliquidEvents,
      health: qualifiedHealth(hyperliquidTrades.health, hyperliquidRanking?.health, hyperliquidRanked.size),
    },
    {
      sourceId: "polymarket",
      events: polymarketEvents,
      health: qualifiedHealth(polymarketHealth, polymarketRanking?.health, polymarketRanked.size),
    },
  ]
}
