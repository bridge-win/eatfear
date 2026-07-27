import { get as httpsGet } from "node:https"

import { fetchYahooSeries } from "@/lib/data-sources/yahoo"
import {
  DISCOVER_MIN_ANNUALIZED_YIELD_PCT,
  DISCOVER_TARGET_DAYS_TO_EXPIRATION,
  DISCOVER_UNIVERSE,
  STABLE_YIELD_ASSET_UNIVERSE,
} from "@/lib/discover/universe"
import {
  buildCandidate,
  buildStableYieldAsset,
  buildStableYieldIdeas,
  type CandidateOptionQuote,
  type PriceHistoryPoint,
} from "@/lib/discover/scoring"
import type { DiscoverCandidate, DiscoverResponse, DiscoverUniverseEntry } from "@/lib/discover/types"
import { getTimeRange } from "@/lib/time-range"

const DISCOVER_REVALIDATE_SECONDS = 15 * 60
const CHART_TIMEOUT_MS = 6_000
const CBOE_BASE_URL = "https://cdn.cboe.com/api/global/delayed_quotes/options"

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[]
  }
}

interface YahooChartResult {
  meta?: {
    regularMarketPrice?: number
    previousClose?: number
    chartPreviousClose?: number
    regularMarketTime?: number
  }
  timestamp?: number[]
  indicators?: {
    quote?: Array<{
      close?: Array<number | null>
      volume?: Array<number | null>
    }>
  }
}

interface Snapshot {
  history: PriceHistoryPoint[]
  price: number
  previousClose: number
  asOf: number
}

interface CboeOptionRow {
  option?: string
  bid?: number
  ask?: number
  volume?: number
  open_interest?: number
}

interface CboeOptionChainResponse {
  timestamp?: string
  data?: {
    options?: CboeOptionRow[]
  }
}

interface ParsedOptionSymbol {
  expirationDate: string
  type: "C" | "P"
  strike: number
}

async function fetchYahooChart(symbol: string): Promise<YahooChartResponse | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CHART_TIMEOUT_MS)
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
      next: { revalidate: DISCOVER_REVALIDATE_SECONDS },
    })
    if (!response.ok) return null
    return (await response.json()) as YahooChartResponse
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function fetchSymbolSnapshot(symbol: string): Promise<Snapshot | null> {
  const payload = await fetchYahooChart(symbol)
  const result = payload?.chart?.result?.[0]
  const timestamps = result?.timestamp ?? []
  const quotes = result?.indicators?.quote?.[0]
  const closes = quotes?.close ?? []
  const volumes = quotes?.volume ?? []
  const history: PriceHistoryPoint[] = []

  for (let index = 0; index < timestamps.length; index += 1) {
    const timestamp = timestamps[index]
    const close = closes[index]
    if (timestamp === undefined || close === null || close === undefined || !Number.isFinite(close)) continue
    const volume = volumes[index]
    history.push({
      timestamp: timestamp * 1000,
      close,
      volume: volume === null || volume === undefined || !Number.isFinite(volume) ? 0 : volume,
    })
  }

  const last = history.at(-1)
  if (!last) return null
  const price = result?.meta?.regularMarketPrice ?? last.close
  const previousClose = result?.meta?.previousClose ?? result?.meta?.chartPreviousClose ?? history.at(-2)?.close ?? price
  const asOf = (result?.meta?.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000
  return { history, price, previousClose, asOf }
}

async function fetchSnapshot(entry: DiscoverUniverseEntry): Promise<Snapshot | null> {
  return fetchSymbolSnapshot(entry.symbol)
}

function parseCboeTimestamp(value: string | undefined): number {
  if (!value) return Date.now()
  const parsed = Date.parse(`${value.replace(" ", "T")}Z`)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

function parseOptionSymbol(value: string | undefined): ParsedOptionSymbol | null {
  if (!value) return null
  const match = value.match(/^.+?(\d{6})([CP])(\d{8})$/)
  if (!match) return null
  const rawDate = match[1]
  const type = match[2] as "C" | "P"
  const rawStrike = match[3]
  const year = `20${rawDate.slice(0, 2)}`
  const month = rawDate.slice(2, 4)
  const day = rawDate.slice(4, 6)
  return {
    expirationDate: `${year}-${month}-${day}`,
    type,
    strike: Number(rawStrike) / 1000,
  }
}

async function fetchCboeOptionChain(symbol: string): Promise<CboeOptionChainResponse | null> {
  const url = `${CBOE_BASE_URL}/${encodeURIComponent(symbol)}.json`
  return fetchNodeHttpsJson<CboeOptionChainResponse>(url)
}

async function fetchNodeHttpsJson<T>(url: string): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: T | null) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    const request = httpsGet(
      url,
      {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        timeout: CHART_TIMEOUT_MS,
      },
      (response) => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          response.resume()
          finish(null)
          return
        }

        let body = ""
        response.setEncoding("utf8")
        response.on("data", (chunk: string) => {
          body += chunk
        })
        response.on("end", () => {
          try {
            finish(JSON.parse(body) as T)
          } catch {
            finish(null)
          }
        })
      },
    )

    request.on("timeout", () => {
      request.destroy()
      finish(null)
    })
    request.on("error", () => finish(null))
  })
}

function selectCboeOptionQuote({
  chain,
  symbol,
  strategy,
  spot,
  targetStrike,
}: {
  chain: CboeOptionChainResponse | null
  symbol: string
  strategy: "cash_secured_put" | "covered_call"
  spot: number
  targetStrike: number
}): CandidateOptionQuote | null {
  const rows = chain?.data?.options ?? []
  const quoteTime = parseCboeTimestamp(chain?.timestamp)
  const now = Date.now()
  const targetExpirationTime = now + DISCOVER_TARGET_DAYS_TO_EXPIRATION * 86_400_000
  const optionType = strategy === "cash_secured_put" ? "P" : "C"
  const sourceUrl = `${CBOE_BASE_URL}/${encodeURIComponent(symbol)}.json`

  const candidates = rows.flatMap((row): CandidateOptionQuote[] => {
    const parsed = parseOptionSymbol(row.option)
    if (!parsed || parsed.type !== optionType) return []
    const expirationTime = Date.parse(`${parsed.expirationDate}T20:00:00Z`)
    if (!Number.isFinite(expirationTime) || expirationTime <= now) return []
    const daysToExpiration = Math.max(1, Math.round((expirationTime - now) / 86_400_000))
    const bid = row.bid ?? 0
    const ask = row.ask ?? 0
    const isOutOfTheMoney = strategy === "cash_secured_put"
      ? parsed.strike < spot * 0.995
      : parsed.strike > spot * 1.005
    if (!isOutOfTheMoney) return []
    if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask < bid) return []
    return [{
      optionSymbol: row.option ?? "",
      expirationDate: parsed.expirationDate,
      daysToExpiration,
      strike: parsed.strike,
      bid,
      ask,
      volume: row.volume ?? 0,
      openInterest: row.open_interest ?? 0,
      quoteTime,
      sourceUrl,
    }]
  })

  if (candidates.length === 0) return null

  return candidates.sort((left, right) => {
    const leftSpread = (left.ask - left.bid) / Math.max(0.01, (left.ask + left.bid) / 2)
    const rightSpread = (right.ask - right.bid) / Math.max(0.01, (right.ask + right.bid) / 2)
    const leftScore =
      Math.abs(Date.parse(`${left.expirationDate}T20:00:00Z`) - targetExpirationTime) / 86_400_000 +
      Math.abs(left.strike - targetStrike) / Math.max(1, targetStrike) * 20 +
      leftSpread * 8 -
      Math.min(left.openInterest, 2_000) / 2_000
    const rightScore =
      Math.abs(Date.parse(`${right.expirationDate}T20:00:00Z`) - targetExpirationTime) / 86_400_000 +
      Math.abs(right.strike - targetStrike) / Math.max(1, targetStrike) * 20 +
      rightSpread * 8 -
      Math.min(right.openInterest, 2_000) / 2_000
    return leftScore - rightScore
  })[0] ?? null
}

async function fetchTreasuryBillProxyRatePct(): Promise<number | null> {
  const range = getTimeRange("1mo")
  const result = await fetchYahooSeries("^IRX", range, "1d", DISCOVER_REVALIDATE_SECONDS)
  const raw = result?.currentValue ?? result?.history.at(-1)?.value
  if (raw === undefined || !Number.isFinite(raw) || raw <= 0) return null
  return raw > 20 ? Math.round((raw / 10) * 100) / 100 : Math.round(raw * 100) / 100
}

function rankCandidates(candidates: DiscoverCandidate[]): DiscoverCandidate[] {
  return candidates
    .filter((candidate) => (
      candidate.annualizedYieldPct >= DISCOVER_MIN_ANNUALIZED_YIELD_PCT &&
      candidate.riskScore >= 55 &&
      candidate.realizedVolatilityPct <= 75 &&
      candidate.maxDrawdownPct <= 65
    ))
    .sort((left, right) => {
      const leftScore = left.annualizedYieldPct * 0.45 + left.riskScore * 0.55
      const rightScore = right.annualizedYieldPct * 0.45 + right.riskScore * 0.55
      return rightScore - leftScore
    })
    .slice(0, 12)
}

export async function buildDiscoverResponse(): Promise<DiscoverResponse> {
  const updatedAt = Date.now()
  const treasuryBillProxyRatePct = await fetchTreasuryBillProxyRatePct()
  const riskFreeRatePct = treasuryBillProxyRatePct ?? 4
  const rows = await Promise.all(
    DISCOVER_UNIVERSE.map(async (entry) => {
      const [snapshot, optionChain] = await Promise.all([
        fetchSnapshot(entry),
        fetchCboeOptionChain(entry.symbol),
      ])
      if (!snapshot) return []
      const putTargetStrike = snapshot.price * 0.92
      const callTargetStrike = snapshot.price * 1.08
      return [
        buildCandidate({
          entry,
          ...snapshot,
          riskFreeRatePct,
          optionQuote: selectCboeOptionQuote({
            chain: optionChain,
            symbol: entry.symbol,
            strategy: "cash_secured_put",
            spot: snapshot.price,
            targetStrike: putTargetStrike,
          }),
        }, "cash_secured_put"),
        buildCandidate({
          entry,
          ...snapshot,
          riskFreeRatePct,
          optionQuote: selectCboeOptionQuote({
            chain: optionChain,
            symbol: entry.symbol,
            strategy: "covered_call",
            spot: snapshot.price,
            targetStrike: callTargetStrike,
          }),
        }, "covered_call"),
      ].filter((candidate): candidate is DiscoverCandidate => candidate !== null)
    }),
  )
  const candidates = rankCandidates(rows.flat())
  const stableAssets = (await Promise.all(
    STABLE_YIELD_ASSET_UNIVERSE.map(async (entry) => {
      const snapshot = await fetchSymbolSnapshot(entry.symbol)
      if (!snapshot) return null
      return buildStableYieldAsset({
        entry,
        ...snapshot,
        treasuryBillProxyRatePct: riskFreeRatePct,
      })
    }),
  ))
    .filter((asset) => asset !== null)
    .sort((left, right) => right.riskScore - left.riskScore)

  return {
    updatedAt,
    nextUpdateAt: updatedAt + DISCOVER_REVALIDATE_SECONDS * 1000,
    minAnnualizedYieldPct: DISCOVER_MIN_ANNUALIZED_YIELD_PCT,
    riskPolicy: "Liquid ETF and large-cap underlyings only; risk score must be at least 55/100 and premium alone cannot qualify a candidate.",
    treasuryBillProxyRatePct,
    candidates,
    stableYieldAssets: stableAssets,
    stableYieldIdeas: buildStableYieldIdeas(treasuryBillProxyRatePct),
    sources: [
      {
        id: "yahoo-chart",
        name: "Yahoo Finance chart",
        status: "operational",
        url: "https://query1.finance.yahoo.com/v8/finance/chart/SPY",
        note: "Used for current price snapshots and one-year realized volatility.",
      },
      {
        id: "cboe-delayed-options",
        name: "Cboe delayed option chain",
        status: candidates.some((candidate) => candidate.data.premiumSource === "live_chain") ? "operational" : "degraded",
        url: "https://www.cboe.com/delayed_quotes/spx/quote_table/",
        note: "Primary source for delayed option bid/ask, volume, and open interest when a liquid target contract is available.",
      },
      {
        id: "option-premium-model",
        name: "Modeled option premium fallback",
        status: candidates.some((candidate) => candidate.data.premiumSource === "model_estimate") ? "degraded" : "operational",
        url: "https://www.optionseducation.org/strategies/all-strategies/cash-secured-put",
        note: "Used only when delayed bid/ask is missing, stale, too wide, or too illiquid.",
      },
      {
        id: "treasury-bills",
        name: "U.S. Treasury bill rates",
        status: treasuryBillProxyRatePct === null ? "degraded" : "operational",
        url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?field_tdr_date_value=2026&type=daily_treasury_bill_rates",
        note: "Used as the baseline for stable-yield ideas and option pricing.",
      },
      {
        id: "fund-issuer-pages",
        name: "ETF issuer pages",
        status: stableAssets.length > 0 ? "operational" : "degraded",
        url: "https://www.ishares.com/us/products/314116/ishares-0-3-month-treasury-bond-etf",
        note: "Linked on each stable-asset card for fund objective, fee, holdings, and issuer risk disclosures.",
      },
    ],
    limitations: [
      `Option candidates target about ${DISCOVER_TARGET_DAYS_TO_EXPIRATION} days to expiration; the scanner selects the nearest liquid delayed Cboe contract when available.`,
      "Delayed option quotes can still differ from executable broker prices, especially around earnings, dividends, market stress, and wide spreads.",
      "Stable-yield ideas are method screens. Insurance, tax treatment, liquidity, and account eligibility depend on the user's institution and account structure.",
      "The Discover API refreshes every 15 minutes, but several upstream sources are delayed or daily-updated. Broker execution checks still come last.",
    ],
  }
}
