import { NextResponse } from "next/server"

export const revalidate = 300

const DERIBIT_BOOK_SUMMARY = "https://www.deribit.com/api/v2/public/get_book_summary_by_currency"

interface DeribitBookSummaryEntry {
  instrument_name: string
  open_interest: number
  underlying_price: number | null
}

interface DeribitBookSummaryResponse {
  result?: DeribitBookSummaryEntry[]
}

const INSTRUMENT_PATTERN = /^([A-Z]+)-(\d{1,2}[A-Z]{3}\d{2})-(\d+(?:\.\d+)?)-([CP])$/

function parseExpiryDate(expiryKey: string): number {
  const match = /^(\d{1,2})([A-Z]{3})(\d{2})$/.exec(expiryKey)
  if (!match) return 0
  const [, day, mon, yy] = match
  const months: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  }
  const month = months[mon]
  if (month === undefined) return 0
  return Date.UTC(2000 + Number(yy), month, Number(day), 8, 0, 0)
}

export interface OptionsOiStrike {
  strike: number
  callOi: number
  putOi: number
}

export interface OptionsOiPayload {
  currency: string
  expiry: string
  expiryTime: number
  underlyingPrice: number
  maxPain: number | null
  callWall: number | null
  putWall: number | null
  totalCallOi: number
  totalPutOi: number
  strikes: OptionsOiStrike[]
  updatedAt: number
  error?: string
}

function computeMaxPain(strikes: OptionsOiStrike[]): number | null {
  if (strikes.length === 0) return null
  let bestStrike: number | null = null
  let bestPain = Number.POSITIVE_INFINITY
  for (const candidate of strikes) {
    let pain = 0
    for (const row of strikes) {
      pain += row.callOi * Math.max(0, candidate.strike - row.strike)
      pain += row.putOi * Math.max(0, row.strike - candidate.strike)
    }
    if (pain < bestPain) {
      bestPain = pain
      bestStrike = candidate.strike
    }
  }
  return bestStrike
}

async function fetchOptionsOi(currency: "BTC" | "ETH"): Promise<OptionsOiPayload> {
  const empty: OptionsOiPayload = {
    currency,
    expiry: "",
    expiryTime: 0,
    underlyingPrice: 0,
    maxPain: null,
    callWall: null,
    putWall: null,
    totalCallOi: 0,
    totalPutOi: 0,
    strikes: [],
    updatedAt: Date.now(),
  }

  const res = await fetch(`${DERIBIT_BOOK_SUMMARY}?currency=${currency}&kind=option`, {
    headers: { Accept: "application/json" },
    next: { revalidate },
  })
  if (!res.ok) return { ...empty, error: `Deribit ${res.status}` }
  const json = (await res.json()) as DeribitBookSummaryResponse
  const entries = json.result ?? []
  if (entries.length === 0) return { ...empty, error: "No options data" }

  const oiByExpiry = new Map<string, number>()
  const parsed: Array<{ expiryKey: string; strike: number; type: "C" | "P"; oi: number; underlying: number }> = []

  for (const entry of entries) {
    const match = INSTRUMENT_PATTERN.exec(entry.instrument_name)
    if (!match) continue
    const [, , expiryKey, strikeStr, typeStr] = match
    const oi = Number(entry.open_interest) || 0
    if (oi <= 0) continue
    parsed.push({
      expiryKey,
      strike: Number(strikeStr),
      type: typeStr as "C" | "P",
      oi,
      underlying: Number(entry.underlying_price) || 0,
    })
    oiByExpiry.set(expiryKey, (oiByExpiry.get(expiryKey) ?? 0) + oi)
  }

  if (parsed.length === 0) return { ...empty, error: "No active open interest" }

  let dominantExpiry = ""
  let dominantOi = -1
  for (const [expiryKey, oi] of oiByExpiry) {
    if (oi > dominantOi) {
      dominantOi = oi
      dominantExpiry = expiryKey
    }
  }

  const strikeMap = new Map<number, OptionsOiStrike>()
  let underlyingPrice = 0
  for (const row of parsed) {
    if (row.expiryKey !== dominantExpiry) continue
    if (!underlyingPrice && row.underlying > 0) underlyingPrice = row.underlying
    const existing = strikeMap.get(row.strike) ?? { strike: row.strike, callOi: 0, putOi: 0 }
    if (row.type === "C") existing.callOi += row.oi
    else existing.putOi += row.oi
    strikeMap.set(row.strike, existing)
  }

  const strikes = Array.from(strikeMap.values()).sort((a, b) => a.strike - b.strike)
  const totalCallOi = strikes.reduce((sum, s) => sum + s.callOi, 0)
  const totalPutOi = strikes.reduce((sum, s) => sum + s.putOi, 0)
  const callWall = strikes.length > 0 ? strikes.reduce((a, b) => (b.callOi > a.callOi ? b : a)).strike : null
  const putWall = strikes.length > 0 ? strikes.reduce((a, b) => (b.putOi > a.putOi ? b : a)).strike : null

  return {
    currency,
    expiry: dominantExpiry,
    expiryTime: parseExpiryDate(dominantExpiry),
    underlyingPrice,
    maxPain: computeMaxPain(strikes),
    callWall,
    putWall,
    totalCallOi,
    totalPutOi,
    strikes,
    updatedAt: Date.now(),
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const currencyParam = (searchParams.get("currency") ?? "BTC").toUpperCase()
  const currency = currencyParam === "ETH" ? "ETH" : "BTC"

  try {
    const payload = await fetchOptionsOi(currency)
    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        currency,
        expiry: "",
        expiryTime: 0,
        underlyingPrice: 0,
        maxPain: null,
        callWall: null,
        putWall: null,
        totalCallOi: 0,
        totalPutOi: 0,
        strikes: [],
        updatedAt: Date.now(),
        error: error instanceof Error ? error.message : "Options OI unavailable",
      } satisfies OptionsOiPayload,
      { status: 200 },
    )
  }
}
