import { NextResponse } from "next/server"
import type { CryptoInstrument } from "@/lib/types"

export const revalidate = 3600

interface OkxInstrument {
  instId: string
  instType: string
  state: string
  ctValCcy?: string
  settleCcy?: string
  baseCcy?: string
  quoteCcy?: string
  uly?: string
}

interface OkxResponse<T> {
  code: string
  msg?: string
  data?: T[]
}

const OKX_BASE_URL = "https://www.okx.com"

const PRIORITY_BASES = [
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "BNB",
  "DOGE",
  "ADA",
  "TRX",
  "TON",
  "LINK",
  "AVAX",
  "DOT",
  "BCH",
  "LTC",
  "MATIC",
  "NEAR",
  "APT",
  "SUI",
  "ATOM",
  "OP",
  "ARB",
  "FIL",
  "ETC",
  "UNI",
  "ICP",
  "AAVE",
  "INJ",
  "ORDI",
  "PEPE",
  "WIF",
]

export async function GET() {
  try {
    const response = await fetch(`${OKX_BASE_URL}/api/v5/public/instruments?instType=SWAP`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
      next: { revalidate },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch OKX instruments")
    }

    const payload = (await response.json()) as OkxResponse<OkxInstrument>

    if (payload.code !== "0") {
      throw new Error(payload.msg ?? "OKX instruments request failed")
    }

    const seen = new Set<string>()
    const instruments: CryptoInstrument[] = []

    for (const item of payload.data ?? []) {
      if (item.state !== "live") continue
      if (!item.instId.endsWith("-USDT-SWAP")) continue
      if (seen.has(item.instId)) continue
      seen.add(item.instId)

      const [base, quote] = item.instId.split("-")
      instruments.push({
        instId: item.instId,
        base: base ?? "",
        quote: quote ?? "USDT",
        label: `${base}-${quote}-PERP`,
      })
    }

    instruments.sort((a, b) => {
      const aPriority = PRIORITY_BASES.indexOf(a.base)
      const bPriority = PRIORITY_BASES.indexOf(b.base)
      const aRank = aPriority === -1 ? Number.MAX_SAFE_INTEGER : aPriority
      const bRank = bPriority === -1 ? Number.MAX_SAFE_INTEGER : bPriority
      if (aRank !== bRank) return aRank - bRank
      return a.base.localeCompare(b.base)
    })

    return NextResponse.json({
      updatedAt: Date.now(),
      instruments,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load OKX instruments",
        instruments: [],
      },
      { status: 502 },
    )
  }
}
