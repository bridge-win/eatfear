"use client"

import Link from "next/link"
import { Coins, LineChart, Star } from "lucide-react"

import { DashboardFrame } from "@/components/page-frame"
import { WatchlistStar } from "@/components/watchlist-star"
import { useWatchlist, type WatchlistItem } from "@/hooks/use-watchlist"
import { useI18n } from "@/lib/i18n"

function dashboardHref(item: WatchlistItem): string {
  return item.asset_class === "crypto"
    ? `/crypto?symbol=${encodeURIComponent(item.symbol)}`
    : `/stock?symbol=${encodeURIComponent(item.symbol)}`
}

export function WatchlistView() {
  const { locale } = useI18n()
  const { items, loading, signedIn } = useWatchlist()

  return (
    <DashboardFrame>
      <header>
        <h1 className="text-xl font-bold tracking-tight">{locale === "zh" ? "自选追踪" : "Watchlist"}</h1>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {locale === "zh"
            ? "关注的标的会自动追踪量化信号与新闻;触发超跌/超涨信号时通过邮件、站内和 Telegram 通知你。"
            : "Followed symbols are tracked for quant signals and news; you're alerted by email, in-app, and Telegram when an oversold/overbought signal triggers."}
        </p>
      </header>

      {loading && (
        <p className="text-[11px] text-muted-foreground">{locale === "zh" ? "加载中…" : "Loading…"}</p>
      )}

      {!loading && signedIn === false && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-6 text-center">
          <Star className="mx-auto h-6 w-6 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium">{locale === "zh" ? "登录后使用自选" : "Sign in to use your watchlist"}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {locale === "zh" ? "自选与告警需要账户。" : "Watchlist and alerts require an account."}
          </p>
          <Link
            href="/auth/login"
            className="mt-3 inline-flex items-center rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background"
          >
            {locale === "zh" ? "登录" : "Log in"}
          </Link>
        </div>
      )}

      {!loading && signedIn && items.length === 0 && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-6 text-center">
          <Star className="mx-auto h-6 w-6 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium">{locale === "zh" ? "还没有关注的标的" : "No symbols followed yet"}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {locale === "zh"
              ? "在加密或股票面板的标的卡上点击 ☆ 即可关注。"
              : "Tap the ☆ on any symbol card in the Crypto or Stock dashboard to follow it."}
          </p>
        </div>
      )}

      {!loading && signedIn && items.length > 0 && (
        <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
            >
              <Link href={dashboardHref(item)} className="flex min-w-0 items-center gap-2">
                {item.asset_class === "crypto" ? (
                  <Coins className="h-4 w-4 shrink-0 text-amber-500" />
                ) : (
                  <LineChart className="h-4 w-4 shrink-0 text-sky-500" />
                )}
                <span className="truncate text-sm font-semibold">{item.symbol}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {item.asset_class}
                </span>
              </Link>
              <WatchlistStar symbol={item.symbol} assetClass={item.asset_class} />
            </li>
          ))}
        </ul>
      )}
    </DashboardFrame>
  )
}
