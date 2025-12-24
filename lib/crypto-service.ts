import type { CryptoAsset, FearGreedIndex, MarketStats } from "./types"

// Top cryptocurrencies to monitor
export const TOP_CRYPTOS = [
  { symbol: "BTCUSDT", name: "Bitcoin" },
  { symbol: "ETHUSDT", name: "Ethereum" },
  { symbol: "BNBUSDT", name: "BNB" },
  { symbol: "SOLUSDT", name: "Solana" },
  { symbol: "XRPUSDT", name: "XRP" },
  { symbol: "ADAUSDT", name: "Cardano" },
  { symbol: "DOGEUSDT", name: "Dogecoin" },
  { symbol: "MATICUSDT", name: "Polygon" },
  { symbol: "DOTUSDT", name: "Polkadot" },
  { symbol: "LTCUSDT", name: "Litecoin" },
  { symbol: "AVAXUSDT", name: "Avalanche" },
  { symbol: "LINKUSDT", name: "Chainlink" },
]

export class BinanceWebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000
  private onPriceUpdate: ((data: CryptoAsset) => void) | null = null

  connect(onPriceUpdate: (data: CryptoAsset) => void) {
    this.onPriceUpdate = onPriceUpdate

    const streams = TOP_CRYPTOS.map((crypto) => `${crypto.symbol.toLowerCase()}@ticker`).join("/")
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`

    try {
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log("[v0] Binance WebSocket connected")
        this.reconnectAttempts = 0
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.data) {
            const ticker = message.data
            const cryptoInfo = TOP_CRYPTOS.find((c) => c.symbol === ticker.s)

            if (cryptoInfo && this.onPriceUpdate) {
              const asset: CryptoAsset = {
                symbol: ticker.s,
                name: cryptoInfo.name,
                price: Number.parseFloat(ticker.c),
                change24h: Number.parseFloat(ticker.p),
                changePercent24h: Number.parseFloat(ticker.P),
                lastUpdate: Date.now(),
              }
              this.onPriceUpdate(asset)
            }
          }
        } catch (error) {
          console.error("[v0] Error parsing WebSocket message:", error)
        }
      }

      this.ws.onerror = (error) => {
        console.error("[v0] WebSocket error:", error)
      }

      this.ws.onclose = () => {
        console.log("[v0] WebSocket closed")
        this.attemptReconnect()
      }
    } catch (error) {
      console.error("[v0] Error creating WebSocket:", error)
      this.attemptReconnect()
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.onPriceUpdate) {
      this.reconnectAttempts++
      console.log(`[v0] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
      setTimeout(() => {
        if (this.onPriceUpdate) {
          this.connect(this.onPriceUpdate)
        }
      }, this.reconnectDelay)
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.onPriceUpdate = null
  }
}

// Fetch Fear & Greed Index from Alternative.me API
export async function fetchFearGreedIndex(): Promise<FearGreedIndex | null> {
  try {
    const response = await fetch("https://api.alternative.me/fng/?limit=1")
    const data = await response.json()

    if (data.data && data.data.length > 0) {
      const fng = data.data[0]
      const value = Number.parseInt(fng.value)

      let classification: FearGreedIndex["classification"]
      if (value <= 24) classification = "Extreme Fear"
      else if (value <= 49) classification = "Fear"
      else if (value === 50) classification = "Neutral"
      else if (value <= 74) classification = "Greed"
      else classification = "Extreme Greed"

      return {
        value,
        classification,
        timestamp: Number.parseInt(fng.timestamp) * 1000,
      }
    }
    return null
  } catch (error) {
    console.error("Error fetching Fear & Greed Index:", error)
    return null
  }
}

// Fetch global market statistics from CoinGecko API
export async function fetchMarketStats(): Promise<MarketStats | null> {
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/global")
    const data = await response.json()

    if (data.data) {
      return {
        totalMarketCap: data.data.total_market_cap.usd,
        marketCapChange24h: data.data.market_cap_change_percentage_24h_usd,
        volume24h: data.data.total_volume.usd,
        btcDominance: data.data.market_cap_percentage.btc,
        activeCryptos: data.data.active_cryptocurrencies,
      }
    }
    return null
  } catch (error) {
    console.error("Error fetching market stats:", error)
    return null
  }
}
