"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { ScoreIndexCard } from "@/components/score-index-card"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { RegimeSignalBand } from "@/lib/crypto-regime-score"

const REFRESH_MS = 60 * 1000

const MODEL_INFO_DESCRIPTION_ZH = [
  "多因子 + 权重合成（总分 100）；所有分项均来自可追溯的公开市场 API（见 `/api/crypto/regime-score` 的 `upstream` 字段）。",
  "",
  "CoinGlass：`COINGLASS_API_KEY`（Header `CG-API-KEY`）——现货 BTC ETF 日度净流入；CEX BTC / USDT(ETH)+USDC 持仓加权 7 日变动。",
  "",
  "① 资金流（25%）：DefiLlama 稳定币总市值 7 日变动；CoinGlass ETF；CEX 稳定币库存。",
  "② 杠杆情绪（25%）：OKX BTC 永续费率、Rubik OI-USD（1h）、多空账户比及风险降权。",
  "③ 链上周期（20%）：Blockchain.info BTCUSD 日线 vs SMA200；CoinGecko 距 ATH%；CoinGlass CEX BTC；mempool.space 算力。",
  "④ 市场结构（15%）：OKX Taker、盘口失衡、4H 量比、24h 涨跌。",
  "⑤ 期权风险（15%）：Deribit DVOL + 期权 7 日 Put/Call。",
  "",
  "关键规则：Funding 极端、OI 暴拉时扣分；稳定币扩张且 ETF 周势能显著为正时可小幅加分。分数带：75–100 强多 … 0–30 强空。",
  "",
  "面板约每 60 秒刷新。不构成投资建议。",
].join("\n")

const MODEL_INFO_DESCRIPTION_EN = [
  "Multi-factor weighted composite (0–100); every factor traces back to a public market API (see `upstream` in `/api/crypto/regime-score`).",
  "",
  "CoinGlass: `COINGLASS_API_KEY` (`CG-API-KEY` header) — spot BTC ETF daily net flows; CEX BTC / USDT(ETH)+USDC inventory 7-day change.",
  "",
  "① Flows (25%): DefiLlama stablecoin mcap 7-day change; CoinGlass ETF; CEX stablecoin inventory.",
  "② Leverage / sentiment (25%): OKX BTC perp funding, Rubik OI-USD (1h), long/short account ratio with risk downweighting.",
  "③ On-chain cycle (20%): Blockchain.info BTCUSD daily vs SMA200; CoinGecko distance from ATH%; CoinGlass CEX BTC; mempool.space hashrate.",
  "④ Market structure (15%): OKX Taker, book imbalance, 4H volume ratio, 24h change.",
  "⑤ Options risk (15%): Deribit DVOL + 7-day options Put/Call.",
  "",
  "Rules: extreme funding / OI spikes deduct; expanding stablecoins with strong ETF weekly momentum can add slightly. Bands: 75–100 strong bull … 0–30 strong bear.",
  "",
  "Panel refreshes ~60s. Not investment advice.",
].join("\n")

const BAND_LABEL: Record<RegimeSignalBand, { zh: string; en: string }> = {
  strong_bull: { zh: "强多 · 可顺势加仓", en: "Strong Bull · Trend-follow OK" },
  bull: { zh: "偏多 · 回调买入", en: "Bull · Buy dips" },
  neutral: { zh: "中性 · 观望", en: "Neutral · Wait" },
  bear: { zh: "偏空 · 降低仓位", en: "Bear · Reduce risk" },
  strong_bear: { zh: "强空 · 防守或等极端反转", en: "Strong Bear · Defensive" },
}

interface RegimeSummary {
  total: number
  rawWeighted: number
  band: RegimeSignalBand
  signalZh: string
}

interface RegimeFactorRow {
  id: string
  label: string
  score: number
  weighted: number
  lines: string[]
}

interface RegimePayload {
  updatedAt: number
  summary: RegimeSummary
  penaltiesZh: string[]
  boostsZh: string[]
  factors: RegimeFactorRow[]
  error?: string
}

function bandStyles(band: RegimeSignalBand) {
  switch (band) {
    case "strong_bull":
      return "text-emerald-600 dark:text-emerald-400"
    case "bull":
      return "text-teal-600 dark:text-teal-400"
    case "neutral":
      return "text-amber-600 dark:text-amber-400"
    case "bear":
      return "text-orange-600 dark:text-orange-400"
    default:
      return "text-red-600 dark:text-red-400"
  }
}

async function fetchRegimePayload(): Promise<RegimePayload> {
  const response = await fetch("/api/crypto/regime-score")
  const json = (await response.json()) as RegimePayload & { error?: string }
  if (!response.ok || !json.summary) throw new Error(json.error ?? "Regime score unavailable")
  return json
}

const FACTOR_WEIGHT_PCT: Record<string, number> = {
  capitalFlows: 25,
  leverage: 25,
  onchainCycle: 20,
  marketStructure: 15,
  options: 15,
}

function RegimeInfoHover({
  loading,
  error,
  payload,
  updatedHint,
}: {
  loading: boolean
  error: string | null
  payload: RegimePayload | null
  updatedHint: string
}) {
  const { locale, t } = useI18n()
  const modelDescription = locale === "zh" ? MODEL_INFO_DESCRIPTION_ZH : MODEL_INFO_DESCRIPTION_EN

  return (
    <div className="space-y-3 px-3 py-2.5 text-left">
      {loading ? (
        <p className="text-[11px] text-muted-foreground">{t("regime.hover.loading")}</p>
      ) : error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : payload ? (
        <p className="text-[10px] text-muted-foreground">
          {updatedHint ? `${updatedHint} · ` : ""}
          {t("regime.hover.refreshHint")}
          {` · ${t("regime.hover.weighted", { value: payload.summary.rawWeighted.toFixed(1) })}`}
        </p>
      ) : null}

      {payload && payload.factors.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-foreground">{t("regime.hover.factorsTitle")}</p>
          <div className="space-y-2">
            {payload.factors.map((factor) => {
              const weightPct = FACTOR_WEIGHT_PCT[factor.id] ?? 0
              const label = t(`regime.factor.${factor.id}`)
              return (
                <div key={factor.id} className="rounded-md border border-border/55 bg-muted/20 px-2 py-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-semibold text-foreground">
                      {label === `regime.factor.${factor.id}` ? factor.label : label}
                    </p>
                    <p className="text-[10px] tabular-nums text-muted-foreground">
                      {t("regime.hover.factorScore", {
                        score: factor.score.toFixed(1),
                        weight: weightPct,
                        weighted: factor.weighted.toFixed(1),
                      })}
                    </p>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {factor.lines.map((line, idx) => (
                      <li key={idx} className="text-[10.5px] leading-relaxed text-muted-foreground">
                        · {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {payload && (payload.penaltiesZh.length > 0 || payload.boostsZh.length > 0) && (
        <section className="grid gap-2 sm:grid-cols-2">
          {payload.penaltiesZh.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">{t("regime.hover.penalties")}</p>
              <ul className="mt-0.5 space-y-0.5">
                {payload.penaltiesZh.map((p, idx) => (
                  <li key={idx} className="text-[10.5px] leading-relaxed text-muted-foreground">- {p}</li>
                ))}
              </ul>
            </div>
          )}
          {payload.boostsZh.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{t("regime.hover.boosts")}</p>
              <ul className="mt-0.5 space-y-0.5">
                {payload.boostsZh.map((b, idx) => (
                  <li key={idx} className="text-[10.5px] leading-relaxed text-muted-foreground">- {b}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="rounded-md border border-border/55 bg-muted/20 px-2 py-2">
        <p className="text-xs font-semibold text-foreground">{t("regime.hover.modelTitle")}</p>
        <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">{modelDescription}</p>
        <p className="mt-2 text-[10px] text-muted-foreground/80">{t("regime.hover.sources")}</p>
      </section>
    </div>
  )
}

export function CryptoRegimeScoreCard({ className }: { className?: string }) {
  const [payload, setPayload] = useState<RegimePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { locale, t } = useI18n()

  const load = useCallback(async () => {
    try {
      setError(null)
      const next = await fetchRegimePayload()
      setPayload(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const updatedHint = useMemo(() => {
    if (!payload?.updatedAt) return ""
    try {
      return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(payload.updatedAt)
    } catch {
      return ""
    }
  }, [payload?.updatedAt, locale])

  const valueAriaLabel = loading
    ? t("regime.aria.loading")
    : error
      ? t("regime.aria.error")
      : payload
        ? t("regime.aria.value", { value: Math.round(payload.summary.total) })
        : t("regime.aria.idle")

  const valueText = loading ? "…" : error ? "—" : payload ? Math.round(payload.summary.total) : "—"
  const toneClass = error
    ? "text-muted-foreground"
    : payload
      ? bandStyles(payload.summary.band)
      : "text-foreground"

  const signal = loading
    ? t("regime.hover.loading")
    : error
      ? error
      : payload
        ? BAND_LABEL[payload.summary.band][locale]
        : null

  return (
    <ScoreIndexCard
      className={cn(className)}
      label={t("regime.label")}
      value={valueText}
      valueSuffix={t("regime.hover.scoreSuffix")}
      signal={signal}
      toneClassName={toneClass}
      valueAriaLabel={valueAriaLabel}
      infoAriaLabel={t("regime.hover.aria")}
      infoContent={<RegimeInfoHover loading={loading} error={error} payload={payload} updatedHint={updatedHint} />}
    />
  )
}
