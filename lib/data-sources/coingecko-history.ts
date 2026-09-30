import { fetchJson } from "@/lib/data-sources/_fetch"

interface CoinGeckoMarketChart {
  prices?: [number, number][]
  market_caps?: [number, number][]
}

export interface CoinGeckoHistoryPoint {
  timestamp: number
  value: number
}

const COINGECKO_IDS: Readonly<Record<string, string>> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  BNB: "binancecoin",
  DOGE: "dogecoin",
  ADA: "cardano",
  TRX: "tron",
  TON: "the-open-network",
  LINK: "chainlink",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  BCH: "bitcoin-cash",
  LTC: "litecoin",
  NEAR: "near",
  APT: "aptos",
  SUI: "sui",
  ICP: "internet-computer",
  ETC: "ethereum-classic",
  UNI: "uniswap",
  MATIC: "polygon-ecosystem-token",
  ATOM: "cosmos",
  OP: "optimism",
  ARB: "arbitrum",
  FIL: "filecoin",
  AAVE: "aave",
  INJ: "injective-protocol",
  ORDI: "ordinals",
  PEPE: "pepe",
  WIF: "dogwifcoin",
}

function toUtcDay(timestamp: number): number {
  return Math.floor(timestamp / 86_400_000) * 86_400_000
}

export async function fetchCoinGeckoCirculatingSupplyHistory({
  symbol,
  startMs,
  endMs,
  revalidate = 3600,
}: {
  symbol: string
  startMs: number
  endMs: number
  revalidate?: number
}): Promise<CoinGeckoHistoryPoint[]> {
  const coinId = COINGECKO_IDS[symbol.toUpperCase()]
  if (!coinId) return []

  const apiKey = process.env.COINGECKO_API_KEY
  const baseUrl = apiKey ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3"
  const query = new URLSearchParams({
    vs_currency: "usd",
    from: String(Math.floor(startMs / 1000)),
    to: String(Math.ceil(endMs / 1000)),
  })
  const headers = apiKey ? { "x-cg-pro-api-key": apiKey } : undefined
  const chart = await fetchJson<CoinGeckoMarketChart>(
    `${baseUrl}/coins/${coinId}/market_chart/range?${query.toString()}`,
    { revalidate, timeoutMs: 8_000, headers },
  )
  if (!chart?.prices?.length || !chart.market_caps?.length) return []

  const priceByDay = new Map<number, number>()
  for (const [timestamp, price] of chart.prices) {
    if (Number.isFinite(timestamp) && Number.isFinite(price) && price > 0) {
      priceByDay.set(toUtcDay(timestamp), price)
    }
  }

  return chart.market_caps
    .map(([timestamp, marketCap]) => {
      const price = priceByDay.get(toUtcDay(timestamp))
      if (!price || !Number.isFinite(marketCap) || marketCap <= 0) return null
      const value = marketCap / price
      return Number.isFinite(value) && value > 0 ? { timestamp, value } : null
    })
    .filter((point): point is CoinGeckoHistoryPoint => point !== null)
}
