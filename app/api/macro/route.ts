import { NextResponse } from "next/server"

import { fetchFredSeries } from "@/lib/data-sources/fred"
import { fetchYahooSeries } from "@/lib/data-sources/yahoo"
import { MACRO_INDICATORS, type MacroIndicatorMeta } from "@/lib/macro-metadata"
import { DEFAULT_TIME_RANGE, getTimeRange, type TimeRangeOption } from "@/lib/time-range"
import type { MacroIndicator, MacroSeriesPoint } from "@/lib/types"

export const revalidate = 300

interface FetchOutcome {
  history: MacroSeriesPoint[]
  currentValue?: number
  previousValue?: number
  lastUpdate: number
}

const applyTransform = (value: number, meta: MacroIndicatorMeta) => meta.transform?.(value) ?? value

const applyTransformToHistory = (history: MacroSeriesPoint[], meta: MacroIndicatorMeta): MacroSeriesPoint[] => {
  if (!meta.transform) return history
  return history.map((point) => ({ ...point, value: meta.transform!(point.value) }))
}

const getIndicatorSortRank = (indicator: MacroIndicator) => indicator.macroRank ?? 100 + (indicator.priority ?? 999)

async function fetchByMeta(meta: MacroIndicatorMeta, range: TimeRangeOption): Promise<FetchOutcome | null> {
  const symbol = meta.providerSymbol ?? meta.symbol

  switch (meta.source) {
    case "Yahoo Finance": {
      return fetchYahooSeries(symbol, range)
    }
    case "FRED": {
      return fetchFredSeries(symbol, range)
    }
    default:
      return null
  }
}

async function buildIndicator(
  meta: MacroIndicatorMeta,
  range: TimeRangeOption,
): Promise<MacroIndicator | null> {
  const outcome = await fetchByMeta(meta, range)
  if (!outcome) return null

  const history = applyTransformToHistory(outcome.history, meta)
  const latestPoint = history.at(-1)
  const previousPoint = history.at(-2)

  const rawCurrent = outcome.currentValue
  const rawPrevious = outcome.previousValue
  const value = rawCurrent === undefined ? latestPoint?.value ?? 0 : applyTransform(rawCurrent, meta)
  const previousValue =
    rawPrevious === undefined ? previousPoint?.value ?? value : applyTransform(rawPrevious, meta)
  const change = value - previousValue
  const changePercent = previousValue === 0 ? 0 : (change / previousValue) * 100

  if (history.length === 0 && value === 0) return null

  return {
    symbol: meta.symbol,
    name: meta.name,
    group: meta.group,
    unit: meta.unit,
    source: meta.source,
    value,
    change,
    changePercent,
    lastUpdate: outcome.lastUpdate,
    history,
    description: meta.description,
    audience: meta.audience,
    priority: meta.priority,
    macroRank: meta.macroRank,
    macroCategory: meta.macroCategory,
    meaning: meta.meaning,
    impact: meta.impact,
    sourceNote: meta.sourceNote,
    frequency: meta.frequency,
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const rangeParam = url.searchParams.get("range") ?? DEFAULT_TIME_RANGE
  const range = getTimeRange(rangeParam)

  const results = await Promise.allSettled(MACRO_INDICATORS.map((meta) => buildIndicator(meta, range)))

  const indicators: MacroIndicator[] = []
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      indicators.push(result.value)
    }
  }

  indicators.sort((a, b) => {
    const rankDelta = getIndicatorSortRank(a) - getIndicatorSortRank(b)
    if (rankDelta !== 0) return rankDelta
    return (a.priority ?? 999) - (b.priority ?? 999)
  })

  return NextResponse.json(
    {
      updatedAt: Date.now(),
      range: range.id,
      interval: range.yahooInterval,
      fredEnabled: Boolean(process.env.FRED_API_KEY ?? process.env.NEXT_PUBLIC_FRED_API_KEY),
      indicators,
      requested: MACRO_INDICATORS.length,
      returned: indicators.length,
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  )
}
