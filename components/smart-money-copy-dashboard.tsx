"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, BookOpenText } from "lucide-react"

import { CopyTradingLeaderboard } from "@/components/copy-trading-leaderboard"
import { HyperliquidWalletTracker } from "@/components/hyperliquid-wallet-tracker"
import { DashboardFrame } from "@/components/page-frame"
import { SmartMoneyIntelligence } from "@/components/smart-money-intelligence"
import { SmartMoneyPositioning } from "@/components/smart-money-positioning"
import { SmartMoneyTracker } from "@/components/smart-money-tracker"
import { SmartMoneyVerification } from "@/components/smart-money-verification"
import { SymbolSelector, type SymbolOption } from "@/components/symbol-selector"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TimeRangeSelector } from "@/components/time-range-selector"
import { usePersistentState } from "@/lib/client-persistence"
import { useT } from "@/lib/i18n"
import { isTimeRangeId, type TimeRangeId } from "@/lib/time-range"

const DEFAULT_RANGE: TimeRangeId = "1mo"

const CCY_OPTIONS = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE"] as const

const isCcy = (value: string): value is (typeof CCY_OPTIONS)[number] =>
  (CCY_OPTIONS as readonly string[]).includes(value)

const METHOD_ITEM_KEYS = [
  "smartPage.method.item1",
  "smartPage.method.item2",
  "smartPage.method.item3",
  "smartPage.method.item4",
  "smartPage.method.item5",
  "smartPage.method.item6",
  "smartPage.method.item7",
] as const

export function SmartMoneyCopyDashboard() {
  const t = useT()
  const [ccy, setCcy] = usePersistentState<(typeof CCY_OPTIONS)[number]>("crypto:smart-ccy", "BTC", isCcy)
  const [range, setRange] = usePersistentState("crypto:smart-range", DEFAULT_RANGE, isTimeRangeId)

  const symbolOptions: SymbolOption[] = useMemo(
    () =>
      CCY_OPTIONS.map((option) => ({
        id: option,
        label: `${option}-USDT`,
        hint: t("symbol.perpHint", { base: option, source: "Binance / OKX" }),
      })),
    [t],
  )

  return (
    <DashboardFrame>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            href="/crypto"
            prefetch={false}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            {t("smartPage.back")}
          </Link>
          <h1 className="mt-1 text-xl font-bold tracking-tight">{t("smartPage.title")}</h1>
          <p className="mt-0.5 max-w-2xl text-[11px] text-muted-foreground">{t("smartPage.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-start justify-end gap-1.5">
          <SymbolSelector value={ccy} options={symbolOptions} onChange={(next) => isCcy(next) && setCcy(next)} />
          <TimeRangeSelector value={range} onChange={setRange} />
        </div>
      </header>

      <SmartMoneyIntelligence ccy={ccy} range={range} />

      <SmartMoneyPositioning ccy={ccy} range={range} />

      <SmartMoneyTracker ccy={ccy} range={range} variant="full" />

      <SmartMoneyVerification ccy={ccy} />

      <CopyTradingLeaderboard range={range} />

      <HyperliquidWalletTracker />

      <Card className="py-2.5">
        <CardHeader className="px-3 pb-1">
          <div className="flex items-center gap-1.5">
            <BookOpenText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">{t("smartPage.method.title")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-3 pt-1">
          <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
            {METHOD_ITEM_KEYS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </DashboardFrame>
  )
}
