import type { CryptoHistorySeries } from "@/components/crypto-history-compare"
import { withRelevanceScore } from "@/lib/indicator-score"

type Translate = (key: string, vars?: Record<string, string | number>) => string

export function getCryptoSeriesBaseLabel(
  t: Translate,
  series: Pick<CryptoHistorySeries, "i18nKey" | "labelVars">,
): string {
  return t(series.i18nKey, series.labelVars)
}

export function getCryptoSeriesLabel(
  t: Translate,
  series: Pick<CryptoHistorySeries, "i18nKey" | "labelVars" | "relevanceScore">,
): string {
  return withRelevanceScore(getCryptoSeriesBaseLabel(t, series), series.relevanceScore)
}
