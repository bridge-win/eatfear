import type { CryptoAsset, StockAsset, CrashAlert } from "./types"

interface PriceHistory {
  timestamp: number
  price: number
}

export class CrashDetector {
  private priceHistory: Map<string, PriceHistory[]> = new Map()
  private readonly FIFTEEN_MINUTES = 15 * 60 * 1000
  private readonly TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

  updatePrice(symbol: string, price: number) {
    const history = this.priceHistory.get(symbol) || []
    const now = Date.now()

    history.push({ timestamp: now, price })

    // Keep only last 24 hours of data
    const cutoff = now - this.TWENTY_FOUR_HOURS
    const filtered = history.filter((h) => h.timestamp > cutoff)

    this.priceHistory.set(symbol, filtered)
  }

  detectCrashes(asset: CryptoAsset | StockAsset, assetType: "crypto" | "stock"): CrashAlert[] {
    const crashes: CrashAlert[] = []
    const history = this.priceHistory.get(asset.symbol)

    if (!history || history.length < 2) return crashes

    const now = Date.now()
    const currentPrice = asset.price

    // Check 15-minute crash (>3% drop for crypto)
    if (assetType === "crypto") {
      const fifteenMinutesAgo = now - this.FIFTEEN_MINUTES
      const pricesInWindow = history.filter((h) => h.timestamp >= fifteenMinutesAgo)

      if (pricesInWindow.length > 0) {
        const highestPrice = Math.max(...pricesInWindow.map((p) => p.price))
        const dropPercent = ((highestPrice - currentPrice) / highestPrice) * 100

        if (dropPercent > 3) {
          crashes.push({
            symbol: asset.symbol,
            name: asset.name,
            assetType,
            dropPercentage: dropPercent,
            timeframe: "15 minutes",
            currentPrice,
          })
        }
      }
    }

    // Check 24-hour crash (>10% for crypto, >2% for stocks)
    const threshold = assetType === "crypto" ? 10 : 2
    const twentyFourHoursAgo = now - this.TWENTY_FOUR_HOURS
    const oldestPrice = history.find((h) => h.timestamp >= twentyFourHoursAgo)

    if (oldestPrice) {
      const dropPercent = ((oldestPrice.price - currentPrice) / oldestPrice.price) * 100

      if (dropPercent > threshold) {
        crashes.push({
          symbol: asset.symbol,
          name: asset.name,
          assetType,
          dropPercentage: dropPercent,
          timeframe: "24 hours",
          currentPrice,
        })
      }
    }

    return crashes
  }

  clearHistory(symbol?: string) {
    if (symbol) {
      this.priceHistory.delete(symbol)
    } else {
      this.priceHistory.clear()
    }
  }
}
