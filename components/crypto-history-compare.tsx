"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { Check, Plus, Search, X } from "lucide-react"

import {
  AlignedHistoryCompare,
  type AlignedHistoryData,
  type AlignedHistoryGroup,
  type AlignedHistorySeries,
  type AlignedHistoryUnit,
} from "@/components/aligned-history-compare"
import { getCryptoSeriesLabel } from "@/components/crypto-series-label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { jsonFetcher, usePersistentSWR, writeStoredJson } from "@/lib/client-persistence"
import { useDelayedIdleRender } from "@/lib/client-performance"
import { DEFAULT_CRYPTO_HISTORY_REFRESH_MS, getEnabledCryptoIndicators } from "@/lib/crypto-indicator-config"
import {
  getCryptoSeriesScope,
  getCryptoWorkspaceIndicators,
  getCryptoWorkspaceSelectionId,
  normalizeCryptoHistorySeries,
  type CryptoComparisonMode,
  type CryptoWorkspaceSelection,
} from "@/lib/crypto-series-workspace"
import { useT } from "@/lib/i18n"
import { type CryptoHistoryInterval, type TimeRangeId } from "@/lib/time-range"

const CRYPTO_INITIAL_HISTORY_LIMIT = 12

const CROSS_SECTION_PRICE_KEY_BY_CCY: Readonly<Record<string, string>> = {
  ETH: "ethPrice",
  SOL: "solPrice",
  XRP: "xrpPrice",
  BNB: "bnbPrice",
  DOGE: "dogePrice",
}

export interface CryptoHistorySeries {
  key: string
  i18nKey: string
  infoI18nKey: string
  labelVars?: Record<string, string | number>
  order: number
  paneIndex: number
  group?: string
  tier?: "core" | "secondary"
  color: string
  source: string
  unit: AlignedHistoryUnit
  relevanceScore?: number
  nativeInterval?: string
  coverage?: "complete" | "partial"
  freshness?: "live" | "collected" | "historical"
  data: { time: number; value: number | null }[]
}

export interface CryptoHistorySelection {
  interval: CryptoHistoryInterval
  startMs?: number | null
  endMs?: number | null
}

export interface CryptoHistoryCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  quoteVolume: number
}

export interface CryptoQuantSignals {
  crowdingScore: number | null
  extensionScore: number | null
  trendScore: number | null
  cascadeScore: number | null
  cascadeInProgress: boolean
  exhaustionScore: number | null
}

export interface CryptoHistoryPayload {
  range: string
  ccy: string
  selection?: {
    range: string
    custom: boolean
    interval: CryptoHistoryInterval
    okxBar: string
    start: number
    end: number
    maxPoints: number
  }
  candles?: CryptoHistoryCandle[]
  signals?: CryptoQuantSignals
  timeline: number[]
  series: CryptoHistorySeries[]
  refreshMs: number
  paneCount: number
  updatedAt: number
}

function buildCryptoHistoryUrl(
  ccy: string,
  range: TimeRangeId,
  selection: CryptoHistorySelection,
  params: { limit?: number; offset?: number; keys?: string[] } = {},
): string {
  const searchParams = new URLSearchParams({ ccy, range, interval: selection.interval })
  if (selection.startMs && selection.endMs && selection.endMs > selection.startMs) {
    searchParams.set("start", String(selection.startMs))
    searchParams.set("end", String(selection.endMs))
  }
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit))
  if (params.offset !== undefined) searchParams.set("offset", String(params.offset))
  if (params.keys?.length) searchParams.set("keys", params.keys.join(","))
  return `/api/crypto/history-compare?${searchParams.toString()}`
}

function mergeCryptoHistoryPayloads(
  priority: CryptoHistoryPayload | undefined,
  rest: CryptoHistoryPayload | undefined,
): CryptoHistoryPayload | null {
  if (!priority && !rest) return null
  const base = priority ?? rest
  if (!base) return null

  const seriesByKey = new Map<string, CryptoHistorySeries>()
  for (const payload of [priority, rest]) {
    for (const series of payload?.series ?? []) {
      seriesByKey.set(series.key, series)
    }
  }

  const series = Array.from(seriesByKey.values())
    .sort((a, b) => a.order - b.order)
    .map((seriesItem, index) => ({
      ...seriesItem,
      order: index + 1,
      paneIndex: Math.floor(index / 2),
    }))
  const timeline =
    (priority?.timeline.length ?? 0) >= (rest?.timeline.length ?? 0)
      ? priority?.timeline ?? base.timeline
      : rest?.timeline ?? base.timeline
  const refreshMs = Math.max(
    30_000,
    Math.min(priority?.refreshMs ?? DEFAULT_CRYPTO_HISTORY_REFRESH_MS, rest?.refreshMs ?? DEFAULT_CRYPTO_HISTORY_REFRESH_MS),
  )

  return {
    ...base,
    timeline,
    selection: priority?.selection ?? rest?.selection ?? base.selection,
    candles: priority?.candles && priority.candles.length > 0 ? priority.candles : rest?.candles ?? base.candles,
    signals: priority?.signals ?? rest?.signals ?? base.signals,
    series,
    refreshMs,
    paneCount: series.length === 0 ? 0 : Math.max(...series.map((item) => item.paneIndex)) + 1,
    updatedAt: Math.max(priority?.updatedAt ?? 0, rest?.updatedAt ?? 0, base.updatedAt),
  }
}

export interface CryptoHistoryCompareProps {
  instId?: string
  availableAssets?: string[]
  range: TimeRangeId
  selection: CryptoHistorySelection
  payload?: CryptoHistoryPayload | null
  loading?: boolean
  error?: string | null
  className?: string
}

export function useCryptoHistoryPayload(
  instId = "BTC-USDT-SWAP",
  range: TimeRangeId,
  selection: CryptoHistorySelection,
  enabled = true,
  initialLimit = CRYPTO_INITIAL_HISTORY_LIMIT,
): {
  payload: CryptoHistoryPayload | null
  loading: boolean
  error: string | null
} {
  const ccy = instId.split("-")[0] ?? "BTC"
  const selectionKey = `${selection.interval}:${selection.startMs ?? "preset"}:${selection.endMs ?? "now"}`
  const fullStorageKey = `crypto-history:${ccy}:${range}:${selectionKey}:full`
  const priorityUrl = enabled && initialLimit > 0 ? buildCryptoHistoryUrl(ccy, range, selection, { limit: initialLimit }) : null
  const restUrl = enabled ? buildCryptoHistoryUrl(ccy, range, selection, { offset: initialLimit }) : null
  const priority = usePersistentSWR<CryptoHistoryPayload>(
    `crypto-history:${ccy}:${range}:${selectionKey}:priority:${initialLimit}`,
    priorityUrl,
    jsonFetcher,
    { revalidateIfStale: true },
  )
  const rest = usePersistentSWR<CryptoHistoryPayload>(
    `crypto-history:${ccy}:${range}:${selectionKey}:rest:${initialLimit}`,
    restUrl,
    jsonFetcher,
    {
      refreshInterval: (payload) => payload?.refreshMs ?? DEFAULT_CRYPTO_HISTORY_REFRESH_MS,
    },
  )
  const fullCache = usePersistentSWR<CryptoHistoryPayload>(fullStorageKey, null, jsonFetcher)
  const mergedPayload = useMemo(() => mergeCryptoHistoryPayloads(priority.data, rest.data), [priority.data, rest.data])
  const hasCompleteNetworkPayload = priority.data !== undefined && rest.data !== undefined
  const networkPayload = hasCompleteNetworkPayload ? mergedPayload : null
  const payload = networkPayload ?? fullCache.data ?? priority.data ?? null

  useEffect(() => {
    if (mergedPayload && hasCompleteNetworkPayload) writeStoredJson(fullStorageKey, mergedPayload)
  }, [fullStorageKey, hasCompleteNetworkPayload, mergedPayload])

  const loading = payload
    ? priority.isValidating || rest.isValidating || (!mergedPayload && !fullCache.data && rest.isLoading)
    : fullCache.isLoading || priority.isLoading || rest.isLoading
  const error = payload ? null : priority.error?.message ?? rest.error?.message ?? fullCache.error?.message ?? null

  return { payload, loading, error }
}

export function getExpectedCryptoHistorySeriesCount(instId: string): number {
  const ccy = (instId.split("-")[0] ?? "BTC").toUpperCase()
  const omittedKey = CROSS_SECTION_PRICE_KEY_BY_CCY[ccy]
  return getEnabledCryptoIndicators().filter((indicator) => indicator.key !== omittedKey).length
}

const WORKSPACE_COLORS = [
  "rgb(99 102 241)",
  "rgb(168 85 247)",
  "rgb(14 165 233)",
  "rgb(20 184 166)",
  "rgb(245 158 11)",
  "rgb(244 63 94)",
  "rgb(34 197 94)",
  "rgb(234 88 12)",
] as const
const WORKSPACE_CONFIG_BY_KEY = new Map(
  getEnabledCryptoIndicators().map((indicator) => [indicator.key, indicator]),
)

function defaultWorkspaceSelections(asset: string): CryptoWorkspaceSelection[] {
  return [
    { asset, key: "btcPrice", scope: "instrument" },
    { asset, key: "oi", scope: "instrument" },
    { asset, key: "circulatingSupply", scope: "instrument" },
    { asset: "GLOBAL", key: "dxy", scope: "global" },
  ]
}

function CurveCatalogPanel({
  assets,
  activeAsset,
  onActiveAsset,
  selections,
  onAdd,
  onRemove,
  onClear,
  t,
}: {
  assets: string[]
  activeAsset: string
  onActiveAsset: (asset: string) => void
  selections: CryptoWorkspaceSelection[]
  onAdd: (selection: CryptoWorkspaceSelection) => void
  onRemove: (id: string) => void
  onClear: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  const [query, setQuery] = useState("")
  const indicators = useMemo(() => getCryptoWorkspaceIndicators(activeAsset), [activeAsset])
  const selectedIds = useMemo(
    () => new Set(selections.map(getCryptoWorkspaceSelectionId)),
    [selections],
  )
  const catalog = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return indicators.filter((indicator) => {
      if (!normalizedQuery) return true
      const label = t(
        indicator.i18nKey,
        activeAsset === "GLOBAL" ? undefined : { ccy: activeAsset },
      )
      const groupLabel = t(`compare.group.${indicator.group ?? "secondary"}`)
      return `${label} ${groupLabel} ${indicator.key} ${indicator.group ?? ""} ${indicator.source}`
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    })
  }, [activeAsset, indicators, query, t])

  return (
    <Card className="h-fit min-w-0 gap-2 py-2 lg:sticky lg:top-32 lg:w-[19rem] lg:shrink-0">
      <CardHeader className="px-3 pb-0">
        <CardTitle className="text-sm">{t("compare.workspace.catalog")}</CardTitle>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t("compare.workspace.help")}</p>
      </CardHeader>
      <CardContent className="space-y-2 px-3">
        <label className="block space-y-1 text-[11px] text-muted-foreground">
          <span>{t("compare.workspace.asset")}</span>
          <select
            value={activeAsset}
            onChange={(event) => onActiveAsset(event.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            {assets.map((asset) => (
              <option key={asset} value={asset}>
                {asset === "GLOBAL" ? t("compare.workspace.global") : `${asset}-USDT`}
              </option>
            ))}
          </select>
        </label>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("compare.workspace.search")}
            className="h-8 pl-7 text-xs"
          />
        </div>

        <div className="max-h-[20rem] overflow-y-auto rounded-md border border-border/60">
          {catalog.map((indicator) => {
            const scope = getCryptoSeriesScope(indicator.key)
            const selection: CryptoWorkspaceSelection = {
              asset: scope === "global" ? "GLOBAL" : scope === "bitcoin" ? "BTC" : activeAsset,
              key: indicator.key,
              scope,
            }
            const id = getCryptoWorkspaceSelectionId(selection)
            const selected = selectedIds.has(id)
            const label = t(
              indicator.i18nKey,
              activeAsset === "GLOBAL" ? undefined : { ccy: activeAsset },
            )
            return (
              <button
                key={id}
                type="button"
                onClick={() => (selected ? onRemove(id) : onAdd(selection))}
                className="flex w-full items-center gap-2 border-b border-border/40 px-2 py-1.5 text-left last:border-0 hover:bg-muted/50"
                title={`${label} · ${indicator.source}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium">{label}</span>
                  <span className="block truncate text-[9px] text-muted-foreground">
                    {t(`compare.group.${indicator.group ?? "secondary"}`)} · {indicator.source}
                  </span>
                </span>
                {selected ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : (
                  <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium">{t("compare.workspace.selected")} · {selections.length}</span>
          <button type="button" onClick={onClear} className="text-muted-foreground hover:text-foreground">
            {t("compare.workspace.clear")}
          </button>
        </div>
        <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
          {selections.map((selection) => {
            const config = WORKSPACE_CONFIG_BY_KEY.get(selection.key)
            const id = getCryptoWorkspaceSelectionId(selection)
            const label = config
              ? t(config.i18nKey, selection.asset === "GLOBAL" ? undefined : { ccy: selection.asset })
              : selection.key
            return (
              <button
                key={id}
                type="button"
                onClick={() => onRemove(id)}
                className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/40 px-2 py-1 text-[10px] hover:border-destructive/50"
                aria-label={`${t("compare.workspace.remove")} ${label}`}
              >
                <span className="truncate">{label}</span>
                <X className="h-3 w-3 shrink-0" />
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function CryptoHistoryCompare({
  instId = "BTC-USDT-SWAP",
  availableAssets,
  range,
  selection,
  payload: controlledPayload,
  loading: controlledLoading,
  error: controlledError,
  className,
}: CryptoHistoryCompareProps) {
  const t = useT()
  const currentAsset = (instId.split("-")[0] ?? "BTC").toUpperCase()
  const assetOptions = useMemo(
    () => Array.from(new Set(["GLOBAL", currentAsset, ...(availableAssets ?? ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE"])])),
    [availableAssets, currentAsset],
  )
  const [activeAsset, setActiveAsset] = useState(currentAsset)
  const [comparisonMode, setComparisonMode] = useState<CryptoComparisonMode>("indexed")
  const [selections, setSelections] = useState<CryptoWorkspaceSelection[]>(() => defaultWorkspaceSelections(currentAsset))
  const fetched = useCryptoHistoryPayload(instId, range, selection, controlledPayload === undefined)
  const payload = controlledPayload === undefined ? fetched.payload : controlledPayload
  const loading = controlledLoading ?? fetched.loading
  const error = controlledError ?? fetched.error
  const canRenderCharts = useDelayedIdleRender(`${instId}:${range}:${payload ? "ready" : "empty"}`, 1_000, 500)

  useEffect(() => {
    setActiveAsset(currentAsset)
    setSelections((previous) => {
      const currentPriceId = getCryptoWorkspaceSelectionId({ asset: currentAsset, key: "btcPrice", scope: "instrument" })
      return previous.some((item) => getCryptoWorkspaceSelectionId(item) === currentPriceId)
        ? previous
        : [{ asset: currentAsset, key: "btcPrice", scope: "instrument" }, ...previous]
    })
  }, [currentAsset])

  const remoteRequests = useMemo(() => {
    const keysByAsset = new Map<string, Set<string>>()
    for (const item of selections) {
      if (item.asset === "GLOBAL" || item.asset === currentAsset) continue
      const keys = keysByAsset.get(item.asset) ?? new Set<string>()
      keys.add(item.key)
      keysByAsset.set(item.asset, keys)
    }
    return Array.from(keysByAsset.entries()).map(([asset, keys]) => ({
      asset,
      url: buildCryptoHistoryUrl(asset, range, selection, { keys: Array.from(keys) }),
    }))
  }, [currentAsset, range, selection, selections])
  const remoteKey = remoteRequests.length > 0
    ? `crypto-cross-asset:${remoteRequests.map((request) => request.url).join("|")}`
    : null
  const remote = useSWR<CryptoHistoryPayload[]>(
    remoteKey,
    () => Promise.all(remoteRequests.map((request) => jsonFetcher<CryptoHistoryPayload>(request.url))),
    { refreshInterval: DEFAULT_CRYPTO_HISTORY_REFRESH_MS },
  )

  const data: AlignedHistoryData | null = useMemo(() => {
    if (!canRenderCharts || !payload) return null
    const payloadByAsset = new Map<string, CryptoHistoryPayload>([[currentAsset, payload]])
    remoteRequests.forEach((request, index) => {
      const remotePayload = remote.data?.[index]
      if (remotePayload) payloadByAsset.set(request.asset, remotePayload)
    })

    const selectedSeries: AlignedHistorySeries[] = selections.flatMap((item, index) => {
      const sourcePayload = payloadByAsset.get(item.asset === "GLOBAL" ? currentAsset : item.asset)
      const spec = sourcePayload?.series.find((candidate) => candidate.key === item.key)
      if (!spec) return []
      const labelVars = item.asset === "GLOBAL" ? spec.labelVars : { ccy: item.asset }
      const label = getCryptoSeriesLabel(t, { ...spec, labelVars })
      const normalized = normalizeCryptoHistorySeries(
        {
          ...spec,
          key: getCryptoWorkspaceSelectionId(item),
          labelVars,
          color: WORKSPACE_COLORS[index % WORKSPACE_COLORS.length],
          order: index + 1,
          group: "customComparison",
        },
        comparisonMode,
      )
      const series: AlignedHistorySeries = {
        key: normalized.key,
        order: index + 1,
        importance: spec.relevanceScore,
        tier: spec.tier,
        label,
        color: normalized.color,
        unit: normalized.unit,
        data: normalized.data,
        info: {
          title: label,
          description: t(spec.infoI18nKey, spec.labelVars),
          source: spec.source,
        },
      }
      return [series]
    })

    const groups: AlignedHistoryGroup[] = [{
      key: "customComparison",
      label: t("compare.group.customComparison"),
      series: selectedSeries,
    }]

    return {
      timeline: Array.from(
        new Set(selectedSeries.flatMap((series) => series.data.map((point) => point.time))),
      ).sort((left, right) => left - right),
      groups,
    }
  }, [canRenderCharts, comparisonMode, currentAsset, payload, remote.data, remoteRequests, selections, t])

  const referenceKey = selections.find((item) => item.key === "btcPrice")
  const activeReferenceKey = referenceKey ? getCryptoWorkspaceSelectionId(referenceKey) : undefined
  const workspaceLoading = loading || remote.isLoading || remote.isValidating
  const workspaceError = data?.groups[0]?.series.length ? null : error ?? remote.error?.message ?? null

  return (
    <div className="flex min-w-0 flex-col gap-2 lg:flex-row">
      <CurveCatalogPanel
        assets={assetOptions}
        activeAsset={activeAsset}
        onActiveAsset={setActiveAsset}
        selections={selections}
        onAdd={(next) => setSelections((previous) => (
          previous.some((item) => getCryptoWorkspaceSelectionId(item) === getCryptoWorkspaceSelectionId(next))
            ? previous
            : [...previous, next]
        ))}
        onRemove={(id) => setSelections((previous) => previous.filter((item) => getCryptoWorkspaceSelectionId(item) !== id))}
        onClear={() => setSelections([])}
        t={t}
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-xs">
          <span className="font-medium">{t("compare.workspace.title")}</span>
          <label className="flex items-center gap-2 text-muted-foreground">
            <span>{t("compare.workspace.mode")}</span>
            <select
              value={comparisonMode}
              onChange={(event) => setComparisonMode(event.target.value as CryptoComparisonMode)}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            >
              <option value="indexed">{t("compare.workspace.mode.indexed")}</option>
              <option value="raw">{t("compare.workspace.mode.raw")}</option>
              <option value="zscore">{t("compare.workspace.mode.zscore")}</option>
            </select>
          </label>
        </div>
        <AlignedHistoryCompare
          data={data}
          referenceKey={activeReferenceKey}
          title={t("compare.workspace.title")}
          infoDescription={t("compare.workspace.help")}
          infoSource="OKX · CoinGecko · blockchain.info · DefiLlama · alternative.me · Deribit · Yahoo Finance · TradingView Lightweight Charts"
          loading={workspaceLoading || !canRenderCharts}
          error={workspaceError}
          loadingLabel={t("compare.loading")}
          noDataLabel={t("chart.noData")}
          seriesCountLabel={t("compare.seriesCount")}
          expectedSeriesCount={selections.length}
          maxSeriesPerPane={8}
          showFilterPanel={false}
          className={className}
        />
      </div>
    </div>
  )
}
