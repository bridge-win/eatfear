"use client"

import { Star } from "lucide-react"

import { useWatchlist, type AssetClass } from "@/hooks/use-watchlist"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/**
 * Star toggle to follow/unfollow a symbol. Renders nothing until auth resolves
 * to signed-in, so signed-out dashboards are unchanged.
 */
export function WatchlistStar({
  symbol,
  assetClass,
  className,
}: {
  symbol: string
  assetClass: AssetClass
  className?: string
}) {
  const { locale } = useI18n()
  const { signedIn, isWatched, toggle } = useWatchlist()
  if (!signedIn) return null

  const watched = isWatched(symbol, assetClass)
  const label = watched
    ? locale === "zh"
      ? `取消关注 ${symbol}`
      : `Unfollow ${symbol}`
    : locale === "zh"
      ? `关注 ${symbol}`
      : `Follow ${symbol}`

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void toggle(symbol, assetClass)
      }}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted/60",
        watched ? "text-amber-500" : "text-muted-foreground/50 hover:text-muted-foreground",
        className,
      )}
    >
      <Star className={cn("h-4 w-4", watched && "fill-current")} />
    </button>
  )
}
