"use client"

import Link from "next/link"

import { InfoTooltip } from "@/components/info-tooltip"
import { cn } from "@/lib/utils"
import {
  CRYPTO_WATCHLIST_METRICS,
  type CryptoWatchlistIntegration,
} from "@/lib/crypto-watchlist-metrics"

function integrationBadge(integration: CryptoWatchlistIntegration): { label: string; className: string } {
  switch (integration) {
    case "dashboard":
      return { label: "本页已接入", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" }
    case "partial":
      return { label: "部分覆盖", className: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300" }
    default:
      return { label: "待数据源", className: "border-muted-foreground/25 bg-muted/40 text-muted-foreground" }
  }
}

export interface CryptoWatchlistPanelProps {
  className?: string
  /** Live snippet for #27 Fear & Greed when available */
  fearGreedSnippet?: string | null
}

export function CryptoWatchlistPanel({ className, fearGreedSnippet }: CryptoWatchlistPanelProps) {
  return (
    <section className={cn("mb-3 space-y-2 rounded-lg border bg-card/40 p-3 shadow-sm", className)}>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">核心指标清单（30）</h2>
          <p className="mt-0.5 max-w-3xl text-[11px] text-muted-foreground">
            衍生品、链上、情绪与宏观监视项。右上角{" "}
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted-foreground/40 text-[9px]">
              i
            </span>{" "}
            查看定义、用途及与 BTC 价格关系的解读。未接 API 的条目保留为投研检查表。
          </p>
        </div>
      </div>
      <div className="max-h-[min(70vh,520px)] overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin">
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {CRYPTO_WATCHLIST_METRICS.map((metric) => {
            const badge = integrationBadge(metric.integration)
            const live = metric.id === "fear-greed" && fearGreedSnippet ? fearGreedSnippet : null

            return (
              <article
                key={metric.id}
                className="relative flex min-h-[5.5rem] flex-col gap-0.5 rounded-md border bg-card/70 px-2 py-1.5 pr-7 shadow-sm"
              >
                <div className="absolute right-1 top-1">
                  <InfoTooltip
                    title={metric.name}
                    description={metric.description}
                    source={metric.sources}
                    iconClassName="h-3.5 w-3.5"
                  />
                </div>
                <div className="flex items-start gap-1.5 pr-1">
                  <span className="shrink-0 rounded bg-muted px-1 py-0 text-[9px] font-semibold tabular-nums text-muted-foreground">
                    {metric.rank}
                  </span>
                  <h3 className="text-[11px] font-medium leading-snug text-foreground">{metric.name}</h3>
                </div>
                <p className="line-clamp-2 text-[9px] leading-tight text-muted-foreground">{metric.sources}</p>
                <div className="mt-auto flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="rounded-sm bg-primary/10 px-1 py-0 text-[9px] text-foreground/90">{metric.purpose}</span>
                  <span className={cn("rounded border px-1 py-0 text-[8px] font-medium", badge.className)}>
                    {badge.label}
                  </span>
                </div>
                {metric.integrationNote && (
                  <p className="line-clamp-2 text-[8px] leading-tight text-muted-foreground/90">{metric.integrationNote}</p>
                )}
                {live && (
                  <p className="truncate text-[9px] font-medium tabular-nums text-foreground">{live}</p>
                )}
                {metric.id === "macro-liquidity-dxy-us10y-fed" && (
                  <Link
                    href="/macro"
                    className="text-[9px] font-medium text-primary underline-offset-2 hover:underline"
                  >
                    在宏观页查看 DXY / 美债 / 利率
                  </Link>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
