"use client"

import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { InfoTooltip } from "@/components/info-tooltip"
import { jsonFetcher, readStoredJson, usePersistentSWR, writeStoredJson } from "@/lib/client-persistence"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const WALLETS_STORAGE_KEY = "crypto:smart-wallets"
const ADDRESS = /^0x[0-9a-fA-F]{40}$/
const MAX_WALLETS = 10
const REFRESH_MS = 60 * 1000

interface WalletPosition {
  coin: string
  side: "long" | "short"
  size: number
  entryPx: number | null
  notional: number | null
  unrealizedPnl: number | null
  returnOnEquity: number | null
  liquidationPx: number | null
  leverage: number | null
}

interface WalletResponse {
  address: string
  equity: number | null
  withdrawable: number | null
  pnl: Record<string, { pnl: number | null; volume: number | null }>
  positions: WalletPosition[]
  updatedAt: number
}

const formatUsd = (value: number | null): string => {
  if (value === null) return "—"
  const abs = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`
  return `${sign}$${abs.toFixed(2)}`
}

const pnlTone = (value: number | null) =>
  value === null
    ? "text-muted-foreground"
    : value > 0
      ? "text-green-600 dark:text-green-400"
      : value < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground"

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

const PNL_TILES = [
  { period: "day", labelKey: "smartPage.wallet.pnl.day" },
  { period: "week", labelKey: "smartPage.wallet.pnl.week" },
  { period: "month", labelKey: "smartPage.wallet.pnl.month" },
  { period: "allTime", labelKey: "smartPage.wallet.pnl.allTime" },
] as const

function WalletCard({ address, onRemove }: { address: string; onRemove: () => void }) {
  const t = useT()
  const swr = usePersistentSWR<WalletResponse>(
    `crypto:smart-wallet:${address.toLowerCase()}`,
    `/api/crypto/smart-money/wallet?address=${address}`,
    jsonFetcher,
    { refreshInterval: REFRESH_MS },
  )
  const wallet = swr.data ?? null

  return (
    <div className="rounded-md border bg-background/60">
      <div className="flex items-center justify-between gap-2 border-b border-dashed px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`https://hypurrscan.io/address/${address}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs font-semibold underline-offset-2 hover:underline"
          >
            {shortAddress(address)}
          </a>
          {wallet && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {t("smartPage.wallet.equity")} {formatUsd(wallet.equity)} · {t("smartPage.wallet.withdrawable")}{" "}
              {formatUsd(wallet.withdrawable)}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={t("smartPage.wallet.remove")}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="px-3 py-2">
        {!wallet ? (
          <p className="py-2 text-xs text-muted-foreground">
            {swr.error ? t("smartPage.wallet.error") : t("smartPage.loading")}
          </p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PNL_TILES.map((tile) => {
                const value = wallet.pnl[tile.period]?.pnl ?? null
                return (
                  <div key={tile.period} className="rounded-md border bg-background/70 px-2 py-1.5">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{t(tile.labelKey)}</p>
                    <p className={cn("mt-0.5 text-xs font-semibold tabular-nums", pnlTone(value))}>{formatUsd(value)}</p>
                  </div>
                )
              })}
            </div>
            {wallet.positions.length === 0 ? (
              <p className="py-1 text-xs text-muted-foreground">{t("smartPage.wallet.noPositions")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-xs tabular-nums">
                  <thead>
                    <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-1.5 pr-2 text-left font-medium">{t("smartPage.col.coin")}</th>
                      <th className="py-1.5 pr-2 text-left font-medium">{t("smartPage.col.side")}</th>
                      <th className="py-1.5 pr-2 text-right font-medium">{t("smartPage.col.size")}</th>
                      <th className="py-1.5 pr-2 text-right font-medium">{t("smartPage.col.notional")}</th>
                      <th className="py-1.5 pr-2 text-right font-medium">{t("smartPage.col.open")}</th>
                      <th className="py-1.5 pr-2 text-right font-medium">{t("smartPage.col.liq")}</th>
                      <th className="py-1.5 pr-2 text-right font-medium">{t("smartPage.col.lever")}</th>
                      <th className="py-1.5 pr-2 text-right font-medium">{t("smartPage.col.upl")}</th>
                      <th className="py-1.5 text-right font-medium">{t("smartPage.col.roe")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallet.positions.map((position) => (
                      <tr key={position.coin} className="border-b border-dashed last:border-0">
                        <td className="py-1.5 pr-2 font-medium">{position.coin}</td>
                        <td className="py-1.5 pr-2">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                              position.side === "long"
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : "bg-red-500/10 text-red-600 dark:text-red-400",
                            )}
                          >
                            {t(position.side === "long" ? "smartPage.side.long" : "smartPage.side.short")}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 text-right">{position.size}</td>
                        <td className="py-1.5 pr-2 text-right">{formatUsd(position.notional)}</td>
                        <td className="py-1.5 pr-2 text-right">{position.entryPx ?? "—"}</td>
                        <td className="py-1.5 pr-2 text-right">{position.liquidationPx ?? "—"}</td>
                        <td className="py-1.5 pr-2 text-right">
                          {position.leverage !== null ? `${position.leverage}x` : "—"}
                        </td>
                        <td className={cn("py-1.5 pr-2 text-right", pnlTone(position.unrealizedPnl))}>
                          {formatUsd(position.unrealizedPnl)}
                        </td>
                        <td className={cn("py-1.5 text-right", pnlTone(position.returnOnEquity))}>
                          {position.returnOnEquity !== null ? `${(position.returnOnEquity * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function HyperliquidWalletTracker({ className }: { className?: string }) {
  const t = useT()
  const [wallets, setWallets] = useState<string[]>([])
  const [restored, setRestored] = useState(false)
  const [input, setInput] = useState("")
  const [inputError, setInputError] = useState<string | null>(null)

  useEffect(() => {
    const stored = readStoredJson<string[]>(WALLETS_STORAGE_KEY)
    if (Array.isArray(stored)) setWallets(stored.filter((entry) => ADDRESS.test(entry)).slice(0, MAX_WALLETS))
    setRestored(true)
  }, [])

  useEffect(() => {
    if (restored) writeStoredJson(WALLETS_STORAGE_KEY, wallets)
  }, [restored, wallets])

  const addWallet = () => {
    const candidate = input.trim()
    if (!ADDRESS.test(candidate)) {
      setInputError(t("smartPage.wallet.invalid"))
      return
    }
    if (wallets.some((entry) => entry.toLowerCase() === candidate.toLowerCase())) {
      setInputError(t("smartPage.wallet.duplicate"))
      return
    }
    setWallets((current) => [candidate, ...current].slice(0, MAX_WALLETS))
    setInput("")
    setInputError(null)
  }

  return (
    <Card className={cn("py-2.5", className)}>
      <CardHeader className="px-3 pb-1">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-sm">{t("smartPage.wallet.title")}</CardTitle>
          <InfoTooltip
            title={t("smartPage.wallet.title")}
            description={t("smartPage.wallet.info")}
            source="Hyperliquid public /info API"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pt-1">
        <div className="flex gap-1.5">
          <Input
            value={input}
            onChange={(event) => {
              setInput(event.target.value)
              setInputError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") addWallet()
            }}
            placeholder={t("smartPage.wallet.placeholder")}
            className="h-8 font-mono text-xs"
            spellCheck={false}
          />
          <Button size="sm" onClick={addWallet} className="h-8 text-xs">
            {t("smartPage.wallet.add")}
          </Button>
        </div>
        {inputError && <p className="text-[11px] text-destructive">{inputError}</p>}
        {restored && wallets.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">{t("smartPage.wallet.empty")}</p>
        ) : (
          <div className="space-y-2">
            {wallets.map((address) => (
              <WalletCard
                key={address}
                address={address}
                onRemove={() => setWallets((current) => current.filter((entry) => entry !== address))}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
