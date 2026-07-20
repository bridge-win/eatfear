"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { DashboardFrame } from "@/components/page-frame"
import { SmartMoneyCommandCenter } from "@/components/smart-money-command-center"
import { SymbolSelector, type SymbolOption } from "@/components/symbol-selector"
import { TimeRangeSelector } from "@/components/time-range-selector"
import { usePersistentState } from "@/lib/client-persistence"
import { useT } from "@/lib/i18n"
import { isTimeRangeId, type TimeRangeId } from "@/lib/time-range"

const DEFAULT_RANGE: TimeRangeId = "1mo"

const CCY_OPTIONS = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE"] as const

const isCcy = (value: string): value is (typeof CCY_OPTIONS)[number] =>
  (CCY_OPTIONS as readonly string[]).includes(value)

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

      <SmartMoneyCommandCenter ccy={ccy} range={range} />
    </DashboardFrame>
  )
}
