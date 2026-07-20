"use client"

import { Activity, DatabaseZap, Radar, Search, WalletCards } from "lucide-react"

import { CopyTradingLeaderboard } from "@/components/copy-trading-leaderboard"
import { HyperliquidWalletTracker } from "@/components/hyperliquid-wallet-tracker"
import { SmartMoneyDiscovery } from "@/components/smart-money-discovery"
import { SmartMoneyEvidenceTape } from "@/components/smart-money-evidence-tape"
import { SmartMoneyIntelligence } from "@/components/smart-money-intelligence"
import { SmartMoneyLiveFeed } from "@/components/smart-money-live-feed"
import { SmartMoneyPositioning } from "@/components/smart-money-positioning"
import { SmartMoneySourceHealth } from "@/components/smart-money-source-health"
import { SmartMoneyTracker } from "@/components/smart-money-tracker"
import { SmartMoneyVerification } from "@/components/smart-money-verification"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { jsonFetcher, usePersistentSWR } from "@/lib/client-persistence"
import { useT } from "@/lib/i18n"
import type { SmartMoneyActor, SmartMoneyConsensus, SmartMoneyEvent, SmartMoneySourceHealth as SourceHealth } from "@/lib/smart-money/types"
import type { TimeRangeId } from "@/lib/time-range"

interface FeedResponse {
  events: SmartMoneyEvent[]
  consensus: SmartMoneyConsensus
  sources: SourceHealth[]
  updatedAt: number
}

interface DiscoveryResponse {
  actors: SmartMoneyActor[]
  sources: SourceHealth[]
  updatedAt: number
}

interface HealthResponse {
  sources: SourceHealth[]
  updatedAt: number
}

export function SmartMoneyCommandCenter({ ccy, range }: { ccy: string; range: TimeRangeId }) {
  const t = useT()
  const feed = usePersistentSWR<FeedResponse>(
    `crypto:smart-money:feed:${ccy}`,
    `/api/crypto/smart-money/feed?ccy=${encodeURIComponent(ccy)}&limit=120`,
    jsonFetcher,
    { refreshInterval: 15_000 },
    { maxAgeMs: 5 * 60_000 },
  )
  const discovery = usePersistentSWR<DiscoveryResponse>(
    "crypto:smart-money:discovery",
    "/api/crypto/smart-money/discovery?limit=200",
    jsonFetcher,
    { refreshInterval: 60_000 },
    { maxAgeMs: 15 * 60_000 },
  )
  const health = usePersistentSWR<HealthResponse>(
    "crypto:smart-money:health",
    "/api/crypto/smart-money/health",
    jsonFetcher,
    { refreshInterval: 60_000 },
    { maxAgeMs: 5 * 60_000 },
  )

  const events = feed.data?.events ?? []
  const feedSources = feed.data?.sources ?? []
  const sourceHealth = health.data?.sources ?? discovery.data?.sources ?? feedSources
  const operational = sourceHealth.filter((source) => source.status === "operational").length

  return (
    <div className="space-y-2">
      <SmartMoneyEvidenceTape
        events={events}
        consensus={feed.data?.consensus ?? null}
        updatedAt={feed.data?.updatedAt ?? null}
        isRefreshing={feed.isRefreshing}
      />

      <Tabs defaultValue="pulse" className="gap-2">
        <div className="sticky top-0 z-20 -mx-1 flex items-center justify-between gap-2 border-y bg-background/95 px-1 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="min-w-0 overflow-x-auto">
            <TabsList className="h-8 w-max rounded-md">
              <TabsTrigger value="pulse" className="h-7 text-xs"><Radar className="h-3.5 w-3.5" />{t("smartPage.command.tab.pulse")}</TabsTrigger>
              <TabsTrigger value="feed" className="h-7 text-xs"><Activity className="h-3.5 w-3.5" />{t("smartPage.command.tab.feed")}</TabsTrigger>
              <TabsTrigger value="discover" className="h-7 text-xs"><Search className="h-3.5 w-3.5" />{t("smartPage.command.tab.discover")}</TabsTrigger>
              <TabsTrigger value="wallets" className="h-7 text-xs"><WalletCards className="h-3.5 w-3.5" />{t("smartPage.command.tab.wallets")}</TabsTrigger>
              <TabsTrigger value="sources" className="h-7 text-xs"><DatabaseZap className="h-3.5 w-3.5" />{t("smartPage.command.tab.sources")}</TabsTrigger>
            </TabsList>
          </div>
          <span className="hidden shrink-0 items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{operational}/{sourceHealth.length || "—"} {t("smartPage.command.sourcesLive")}
          </span>
        </div>

        <TabsContent value="pulse" className="space-y-3">
          <SmartMoneyIntelligence ccy={ccy} range={range} />
          <SmartMoneyPositioning ccy={ccy} range={range} />
          <SmartMoneyTracker ccy={ccy} range={range} variant="full" />
          <SmartMoneyVerification ccy={ccy} />
        </TabsContent>

        <TabsContent value="feed">
          <SmartMoneyLiveFeed events={events} sources={feedSources} isLoading={feed.isLoading} />
        </TabsContent>

        <TabsContent value="discover" className="space-y-3">
          <SmartMoneyDiscovery actors={discovery.data?.actors ?? []} isLoading={discovery.isLoading} />
          <CopyTradingLeaderboard range={range} />
        </TabsContent>

        <TabsContent value="wallets" className="space-y-2">
          <div className="rounded-md border border-dashed bg-muted/15 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
            {t("smartPage.command.walletGuestNote")}
          </div>
          <HyperliquidWalletTracker />
        </TabsContent>

        <TabsContent value="sources">
          <SmartMoneySourceHealth sources={sourceHealth} isLoading={health.isLoading && discovery.isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
