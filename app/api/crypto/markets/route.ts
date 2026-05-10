import { NextResponse } from "next/server"
import { TOP_CRYPTOS } from "@/lib/crypto-service"
import type { CryptoAsset } from "@/lib/types"

export const revalidate = 15

interface OkxTicker {
  instId: string
  last: string
  open24h: string
  volCcy24h: string
  ts: string
}

interface OkxTickersResponse {
  code: string
  data?: OkxTicker[]
  msg?: string
}

const toOkxInstId = (symbol: string) => symbol.replace("USDT", "-USDT")

export async function GET() {
  const response = await fetch("https://www.okx.com/api/v5/market/tickers?instType=SPOT", {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
    next: { revalidate },
  })

  if (!response.ok) {
    return NextResponse.json({ assets: [], error: "Failed to fetch OKX spot tickers" }, { status: 502 })
  }

  const payload = (await response.json()) as OkxTickersResponse

  if (payload.code !== "0") {
    return NextResponse.json({ assets: [], error: payload.msg ?? "Invalid OKX ticker response" }, { status: 502 })
  }

  const tickerByInstId = new Map((payload.data ?? []).map((ticker) => [ticker.instId, ticker]))
  const assets: CryptoAsset[] = TOP_CRYPTOS.flatMap((crypto) => {
    const ticker = tickerByInstId.get(toOkxInstId(crypto.symbol))
    if (!ticker) return []

    const price = Number(ticker.last)
    const open24h = Number(ticker.open24h)
    const change24h = price - open24h
    const changePercent24h = open24h === 0 ? 0 : (change24h / open24h) * 100

    if (!Number.isFinite(price)) return []

    return [
      {
        symbol: crypto.symbol,
        name: crypto.name,
        price,
        change24h,
        changePercent24h,
        volume24h: Number(ticker.volCcy24h),
        lastUpdate: Number(ticker.ts) || Date.now(),
      },
    ]
  })

  return NextResponse.json({
    source: "OKX Spot Public API",
    updatedAt: Date.now(),
    assets,
  })
}
