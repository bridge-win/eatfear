import { NextResponse } from "next/server"

import { fetchFredSeries } from "@/lib/data-sources/fred"
import { fetchYahooSeries } from "@/lib/data-sources/yahoo"
import {
  DEFAULT_MACRO_INDICATOR_REFRESH_MS,
  getConfiguredMacroIndicatorMetas,
  type ConfiguredMacroIndicatorMeta,
} from "@/lib/macro-indicator-config"
import type { MacroIndicatorMeta } from "@/lib/macro-metadata"
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

const getIndicatorSortRank = (indicator: MacroIndicator) =>
  indicator.displayOrder ?? indicator.macroRank ?? 100 + (indicator.priority ?? 999)

function getPositiveInteger(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function getRequestedMetas(
  configuredIndicators: ConfiguredMacroIndicatorMeta[],
  searchParams: URLSearchParams,
): ConfiguredMacroIndicatorMeta[] {
  const symbolsParam = searchParams.get("symbols")
  const limit = getPositiveInteger(searchParams.get("limit"))
  const symbolSet = new Set(
    (symbolsParam ?? "")
      .split(",")
      .map((symbol) => symbol.trim())
      .filter(Boolean),
  )
  const selected =
    symbolSet.size > 0
      ? configuredIndicators.filter((meta) => symbolSet.has(meta.symbol))
      : configuredIndicators

  return limit === null ? selected : selected.slice(0, limit)
}

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
  meta: ConfiguredMacroIndicatorMeta,
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
    displayOrder: meta.displayOrder,
    refreshMs: meta.refreshMs,
    color: meta.color,
    relevanceScore: meta.relevanceScore,
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
  const configuredIndicators = getConfiguredMacroIndicatorMetas()
  const requestedMetas = getRequestedMetas(configuredIndicators, url.searchParams)

  const results = await Promise.allSettled(requestedMetas.map((meta) => buildIndicator(meta, range)))

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
  const refreshMs =
    indicators.length === 0
      ? DEFAULT_MACRO_INDICATOR_REFRESH_MS
      : Math.max(30_000, Math.min(...indicators.map((indicator) => indicator.refreshMs ?? DEFAULT_MACRO_INDICATOR_REFRESH_MS)))

  return NextResponse.json(
    {
      updatedAt: Date.now(),
      range: range.id,
      interval: range.yahooInterval,
      refreshMs,
      fredEnabled: Boolean(process.env.FRED_API_KEY ?? process.env.NEXT_PUBLIC_FRED_API_KEY),
      indicators,
      requested: requestedMetas.length,
      returned: indicators.length,
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  )
}
