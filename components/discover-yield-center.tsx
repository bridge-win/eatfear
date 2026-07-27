"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Filter,
  Landmark,
  LineChart,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { jsonFetcher, usePersistentSWR } from "@/lib/client-persistence"
import type {
  DiscoverCandidate,
  DiscoverResponse,
  DiscoverRiskBand,
  DiscoverStrategy,
  StableYieldAsset,
  StableYieldIdea,
} from "@/lib/discover/types"
import { cn } from "@/lib/utils"

type StrategyFilter = "all" | DiscoverStrategy

const DISCOVER_REFRESH_MS = 15 * 60 * 1000
const DISCOVER_MAX_CACHE_AGE_MS = 2 * 60 * 60 * 1000

const strategyFilters: Array<{ value: StrategyFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "cash_secured_put", label: "Cash-secured puts" },
  { value: "covered_call", label: "Covered calls" },
]

const emptyDiscoverResponse: DiscoverResponse = {
  updatedAt: 0,
  nextUpdateAt: 0,
  minAnnualizedYieldPct: 10,
  riskPolicy: "Loading risk policy...",
  treasuryBillProxyRatePct: null,
  candidates: [],
  stableYieldAssets: [],
  stableYieldIdeas: [],
  sources: [],
  limitations: [],
}

function formatTime(timestamp: number | null | undefined): string {
  if (!timestamp) return "Unavailable"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp)
}

function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-"
  return `${value.toFixed(digits)}%`
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value)
}

function riskClass(riskBand: DiscoverRiskBand): string {
  switch (riskBand) {
    case "low":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    case "moderate":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
    case "elevated":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  }
}

function StrategyIcon({ strategy }: { strategy: DiscoverStrategy }) {
  if (strategy === "cash_secured_put") return <ArrowDownToLine className="h-4 w-4" />
  return <ArrowUpRight className="h-4 w-4" />
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-background/70 px-2.5 py-2">
      <div className="truncate text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={cn("mt-1 truncate text-sm font-semibold", tone)}>{value}</div>
    </div>
  )
}

function CandidateCard({ candidate }: { candidate: DiscoverCandidate }) {
  return (
    <article className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold">{candidate.symbol}</span>
            <Badge variant="outline">{candidate.assetType}</Badge>
            <Badge className={riskClass(candidate.riskBand)} variant="outline">
              {candidate.riskBand} risk
            </Badge>
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground">{candidate.name} · {candidate.sector}</div>
        </div>
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-sm font-semibold">
          <StrategyIcon strategy={candidate.strategy} />
          {candidate.strategyLabel}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Annualized yield" value={formatPct(candidate.annualizedYieldPct)} tone="text-emerald-600 dark:text-emerald-300" />
        <Metric label="Risk score" value={`${candidate.riskScore}/100`} />
        <Metric label="Price / strike" value={`${formatUsd(candidate.price)} / ${formatUsd(candidate.strike)}`} />
        <Metric label="Premium est." value={formatUsd(candidate.premiumEstimate)} />
        <Metric label="Buffer" value={formatPct(candidate.bufferPct)} />
        <Metric label="Breakeven" value={formatUsd(candidate.breakeven)} />
        <Metric label="Realized vol" value={formatPct(candidate.realizedVolatilityPct)} />
        <Metric label="Max drawdown" value={formatPct(candidate.maxDrawdownPct)} />
      </div>

      {candidate.data.premiumSource === "live_chain" && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Option bid / ask" value={`${formatUsd(candidate.data.optionBid ?? 0)} / ${formatUsd(candidate.data.optionAsk ?? 0)}`} />
          <Metric label="Open interest" value={`${candidate.data.optionOpenInterest ?? 0}`} />
          <Metric label="Volume" value={`${candidate.data.optionVolume ?? 0}`} />
          <Metric label="Spread" value={formatPct(candidate.data.optionSpreadPct)} />
        </div>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_0.85fr]">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Why it made the cut
          </div>
          <ul className="space-y-1.5 text-[12px] leading-relaxed">
            {candidate.reasons.slice(0, 4).map((reason) => (
              <li key={reason} className="rounded-md bg-muted/30 px-2 py-1.5">{reason}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Check before trading
          </div>
          <ul className="space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
            {candidate.cautions.slice(0, 3).map((caution) => (
              <li key={caution} className="rounded-md border border-dashed px-2 py-1.5">{caution}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground">
        <span>
          {candidate.data.optionSymbol ? `${candidate.data.optionSymbol} · ` : ""}
          Expiration target {candidate.expirationDate} · {candidate.daysToExpiration} DTE · {candidate.data.premiumSourceLabel}
        </span>
        {candidate.data.optionSourceUrl ? (
          <a
            href={candidate.data.optionSourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            Option quote {formatTime(candidate.data.optionQuoteTime)}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span>Price as of {formatTime(candidate.data.asOf)}</span>
        )}
      </div>
    </article>
  )
}

function StableYieldCard({ idea }: { idea: StableYieldIdea }) {
  return (
    <article className="rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">{idea.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{idea.category}</div>
        </div>
        <Badge className={riskClass(idea.riskBand)} variant="outline">{idea.riskBand}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="Yield guide" value={formatPct(idea.estimatedAnnualYieldPct, 2)} tone="text-emerald-600 dark:text-emerald-300" />
        <Metric label="Liquidity" value={idea.liquidity} />
      </div>
      <div className="mt-3 space-y-2 text-[12px] leading-relaxed">
        <p><span className="font-semibold">Principal risk:</span> {idea.principalRisk}</p>
        <p><span className="font-semibold">Access:</span> {idea.access}</p>
        <p><span className="font-semibold">Tax:</span> {idea.taxNotes}</p>
      </div>
      <div className="mt-3 space-y-1.5">
        {idea.whyItBelongs.map((reason) => (
          <div key={reason} className="rounded-md bg-muted/30 px-2 py-1.5 text-[12px]">{reason}</div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2">
        <span className="text-[11px] text-muted-foreground">{idea.watchouts[0]}</span>
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <a href={idea.sourceUrl} target="_blank" rel="noreferrer">
            Source <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </article>
  )
}

function StableAssetCard({ asset }: { asset: StableYieldAsset }) {
  return (
    <article className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold">{asset.symbol}</span>
            <Badge className={riskClass(asset.riskBand)} variant="outline">{asset.riskBand}</Badge>
            <Badge variant="outline">{asset.issuer}</Badge>
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground">{asset.name} · {asset.category}</div>
        </div>
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <a href={asset.sourceUrl} target="_blank" rel="noreferrer">
            Issuer <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Yield guide" value={formatPct(asset.estimatedAnnualYieldPct, 2)} tone="text-emerald-600 dark:text-emerald-300" />
        <Metric label="Price / day" value={`${formatUsd(asset.price)} / ${formatPct(asset.changePct, 2)}`} />
        <Metric label="Risk score" value={`${asset.riskScore}/100`} />
        <Metric label="1y vol / DD" value={`${formatPct(asset.realizedVolatilityPct, 2)} / ${formatPct(asset.maxDrawdownPct, 2)}`} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="space-y-1.5">
          {asset.reasons.map((reason) => (
            <div key={reason} className="rounded-md bg-muted/30 px-2 py-1.5 text-[12px] leading-relaxed">{reason}</div>
          ))}
        </div>
        <div className="space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
          <div className="rounded-md border border-dashed px-2 py-1.5">{asset.liquidity}</div>
          {asset.cautions.slice(0, 2).map((caution) => (
            <div key={caution} className="rounded-md border border-dashed px-2 py-1.5">{caution}</div>
          ))}
        </div>
      </div>

      <div className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">
        {asset.data.priceSource} · issuer source linked · price as of {formatTime(asset.data.asOf)}
      </div>
    </article>
  )
}

function EmptyState({ error }: { error?: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
      <h2 className="mt-3 text-lg font-semibold">Discover data is not available</h2>
      <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
        {error ?? "The scanner could not load candidate data. The page will retry on refresh and keep cached data when available."}
      </p>
    </div>
  )
}

export function DiscoverYieldCenter() {
  const [strategy, setStrategy] = React.useState<StrategyFilter>("all")
  const [minYield, setMinYield] = React.useState(10)
  const discover = usePersistentSWR<DiscoverResponse>(
    "discover:yield-center:v1",
    "/api/discover",
    jsonFetcher,
    { fallbackData: emptyDiscoverResponse, refreshInterval: DISCOVER_REFRESH_MS },
    { maxAgeMs: DISCOVER_MAX_CACHE_AGE_MS },
  )

  const candidates = React.useMemo(() => {
    return (discover.data?.candidates ?? []).filter((candidate) => {
      return (strategy === "all" || candidate.strategy === strategy) && candidate.annualizedYieldPct >= minYield
    })
  }, [discover.data?.candidates, minYield, strategy])

  const topYield = candidates.length > 0
    ? Math.max(...candidates.map((candidate) => candidate.annualizedYieldPct))
    : null
  const lowModerateCount = candidates.filter((candidate) => candidate.riskBand !== "elevated").length

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto space-y-4 px-4 py-5">
        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="grid gap-4 p-4 lg:grid-cols-[1.1fr_0.9fr] lg:p-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
                  15-minute income map
                </Badge>
                <Badge variant="outline">Not personalized advice</Badge>
              </div>
              <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight md:text-5xl">
                Discover lower-risk income setups before premium becomes the trap.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Screen liquid ETFs and quality large caps for cash-secured put or covered-call income above 10% annualized, then compare them with stable cash-yield methods.
              </p>
            </div>

            <div className="grid content-start gap-2 sm:grid-cols-2">
              <Metric label="Top screened yield" value={formatPct(topYield)} tone="text-emerald-600 dark:text-emerald-300" />
              <Metric label="Low/moderate rows" value={`${lowModerateCount}`} />
              <Metric label="Treasury proxy" value={formatPct(discover.data?.treasuryBillProxyRatePct, 2)} />
              <Metric label="Next refresh" value={formatTime(discover.data?.nextUpdateAt)} />
            </div>
          </div>

          <div className="border-t bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground lg:px-5">
            Updated {formatTime(discover.data?.updatedAt)} · {discover.data?.riskPolicy ?? "Loading risk policy..."}
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {strategyFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStrategy(filter.value)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted",
                  strategy === filter.value && "border-foreground bg-foreground text-background hover:bg-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <label className="flex min-w-[240px] items-center gap-3 text-xs text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            Min yield
            <input
              type="range"
              min={8}
              max={25}
              step={1}
              value={minYield}
              onChange={(event) => setMinYield(Number(event.target.value))}
              className="w-28 accent-foreground"
            />
            <span className="w-10 font-semibold text-foreground">{minYield}%</span>
          </label>
        </section>

        {discover.error && !discover.data ? (
          <EmptyState error={discover.error.message} />
        ) : (
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold">Option-income candidates</h2>
                <p className="text-sm text-muted-foreground">
                  Delayed option-chain bid when available, current price snapshots, and explicit assignment risk.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {discover.isRefreshing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
                15-minute server cache
              </div>
            </div>

            {discover.isLoading ? (
              <div className="grid gap-3">
                <div className="h-64 animate-pulse rounded-lg border bg-muted/30" />
                <div className="h-64 animate-pulse rounded-lg border bg-muted/30" />
              </div>
            ) : candidates.length > 0 ? (
              <div className="grid gap-3">
                {candidates.map((candidate) => (
                  <CandidateCard key={`${candidate.symbol}:${candidate.strategy}`} candidate={candidate} />
                ))}
              </div>
            ) : (
              <EmptyState error="No candidate currently clears this filter. Lower the minimum yield or switch strategy." />
            )}
          </section>
        )}

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold">Stable assets and funds</h2>
              <p className="text-sm text-muted-foreground">
                Concrete cash-like ETFs with live price history, issuer sources, and risk metrics.
              </p>
            </div>
            <Badge variant="outline" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Real assets
            </Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {(discover.data?.stableYieldAssets ?? []).map((asset) => (
              <StableAssetCard key={asset.symbol} asset={asset} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold">Stable-yield information center</h2>
              <p className="text-sm text-muted-foreground">
                A practical map for cash buckets, collateral, lending programs, and ETF rails.
              </p>
            </div>
            <Badge variant="outline" className="gap-1.5">
              <Landmark className="h-3.5 w-3.5" />
              Treasury baseline
            </Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {(discover.data?.stableYieldIdeas ?? []).map((idea) => (
              <StableYieldCard key={idea.id} idea={idea} />
            ))}
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Source status
            </div>
            <div className="mt-3 space-y-2">
              {(discover.data?.sources ?? []).map((source) => (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start justify-between gap-3 rounded-md border px-2.5 py-2 text-sm transition-colors hover:bg-muted/40"
                >
                  <span>
                    <span className="block font-medium">{source.name}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{source.note}</span>
                  </span>
                  <Badge className={source.status === "operational" ? riskClass("low") : riskClass("elevated")} variant="outline">
                    {source.status}
                  </Badge>
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="h-4 w-4 text-cyan-500" />
              Model boundaries
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Metric label="Universe" value="Liquid ETFs + quality large caps" />
              <Metric label="Premium source" value="Cboe delayed, model fallback" />
              <Metric label="Risk gate" value="55/100 minimum" />
            </div>
            <ul className="mt-3 space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
              {(discover.data?.limitations ?? []).map((limitation) => (
                <li key={limitation} className="rounded-md bg-muted/30 px-2 py-1.5">{limitation}</li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/stock">
                  <LineChart className="h-4 w-4" />
                  Stock dashboard
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/methodology">
                  <BadgeDollarSign className="h-4 w-4" />
                  Methodology
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
