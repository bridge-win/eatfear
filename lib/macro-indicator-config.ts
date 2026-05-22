import { MACRO_INDICATORS, type MacroIndicatorMeta } from "@/lib/macro-metadata"

export interface MacroIndicatorDisplayConfig {
  /** Stable symbol from `MACRO_INDICATORS`, e.g. `FRED:DGS10` or `DX-Y.NYB`. */
  symbol: string
  /** Set to false to hide the indicator from Macro realtime cards and history charts. */
  enabled?: boolean
  /** Lower numbers display first. Realtime cards and history charts share this order. */
  order?: number
  /** Client polling interval when this indicator is visible. */
  refreshMs?: number
  /** Optional visible name override. */
  name?: string
  /** Optional base description override shown in info popovers. */
  description?: string
  /** Optional meaning override shown in info popovers. */
  meaning?: string
  /** Optional impact-direction override shown in info popovers. */
  impact?: string
  /** Optional source note override shown in info popovers. */
  sourceNote?: string
  /** Optional chart/card color override. */
  color?: string
  /** 0-100 relevance score from macro priority + market-practitioner usage. */
  relevanceScore?: number
}

export interface ConfiguredMacroIndicatorMeta extends MacroIndicatorMeta {
  displayOrder: number
  refreshMs: number
  color?: string
  relevanceScore: number
}

export const DEFAULT_MACRO_INDICATOR_REFRESH_MS = 300_000
export const FAST_MACRO_INDICATOR_REFRESH_MS = 60_000

const MACRO_RELEVANCE_SCORES: Record<string, number> = {
  "FRED:DFF": 100,
  "FRED:DGS10": 98,
  "FRED:DGS2": 93,
  "FRED:CPIAUCSL": 94,
  "FRED:CPILFESL": 93,
  "FRED:PCEPI": 92,
  "FRED:PCEPILFE": 91,
  "FRED:PPIACO": 88,
  "FRED:M2SL": 90,
  "FRED:M1SL": 84,
  "FRED:M2REAL": 86,
  "FRED:M2V": 82,
  "FRED:MYAGM2CNM189N": 80,
  "FRED:MYAGM1CNM189N": 78,
  "FRED:TOTLL": 85,
  "FRED:IPMAN": 83,
  "FRED:GDPC1": 82,
  "FRED:GDP": 79,
  "FRED:UNRATE": 86,
  "FRED:PAYEMS": 85,
  "FRED:ICSA": 84,
  "DX-Y.NYB": 87,
  "CNY=X": 82,
  "USDCNH=X": 82,
  "FRED:MORTGAGE30US": 76,
  "FRED:HSN1F": 74,
  "FRED:RSAFS": 77,
  "FRED:INDPRO": 76,
  "FRED:GPDI": 73,
  "FRED:CP": 72,
  "^FTW5000": 81,
  "FRED:DDDM01USA156NWDB": 75,
  "FRED:DDDM01CNA156NWDB": 73,
  "FRED:DDDM02USA156NWDB": 70,
  "FRED:DDDM02CNA156NWDB": 68,
}

// Edit this file to control Macro indicator visibility, order, refresh cadence,
// and copy. Unlisted symbols remain enabled and keep their metadata priority.
export const MACRO_INDICATOR_CONFIG: readonly MacroIndicatorDisplayConfig[] = [
  { symbol: "FRED:DFF", order: 10 },
  { symbol: "FRED:DGS10", order: 20 },
  { symbol: "FRED:DGS2", order: 30 },
  { symbol: "FRED:CPIAUCSL", order: 40 },
  { symbol: "FRED:CPILFESL", order: 50 },
  { symbol: "FRED:PCEPI", order: 60 },
  { symbol: "FRED:PCEPILFE", order: 70 },
  { symbol: "FRED:PPIACO", order: 80 },
  { symbol: "FRED:M2SL", order: 90 },
  { symbol: "FRED:M1SL", order: 100 },
  { symbol: "FRED:M2REAL", order: 110 },
  { symbol: "FRED:M2V", order: 120 },
  { symbol: "FRED:MYAGM2CNM189N", order: 130 },
  { symbol: "FRED:MYAGM1CNM189N", order: 140 },
  { symbol: "FRED:TOTLL", order: 150 },
  { symbol: "FRED:IPMAN", order: 160 },
  { symbol: "FRED:GDPC1", order: 170 },
  { symbol: "FRED:GDP", order: 180 },
  { symbol: "FRED:UNRATE", order: 190 },
  { symbol: "FRED:PAYEMS", order: 200 },
  { symbol: "FRED:ICSA", order: 210 },
  { symbol: "DX-Y.NYB", order: 220, refreshMs: FAST_MACRO_INDICATOR_REFRESH_MS },
  { symbol: "CNY=X", order: 230, refreshMs: FAST_MACRO_INDICATOR_REFRESH_MS },
  { symbol: "USDCNH=X", order: 240, refreshMs: FAST_MACRO_INDICATOR_REFRESH_MS },
  { symbol: "FRED:MORTGAGE30US", order: 250 },
  { symbol: "FRED:HSN1F", order: 260 },
  { symbol: "FRED:RSAFS", order: 270 },
  { symbol: "FRED:INDPRO", order: 280 },
  { symbol: "FRED:GPDI", order: 290 },
  { symbol: "FRED:CP", order: 300 },
  { symbol: "^FTW5000", order: 310, refreshMs: FAST_MACRO_INDICATOR_REFRESH_MS },
  { symbol: "FRED:DDDM01USA156NWDB", order: 320 },
  { symbol: "FRED:DDDM01CNA156NWDB", order: 330 },
  { symbol: "FRED:DDDM02USA156NWDB", order: 340 },
  { symbol: "FRED:DDDM02CNA156NWDB", order: 350 },
]

const CONFIG_BY_SYMBOL = new Map(MACRO_INDICATOR_CONFIG.map((entry) => [entry.symbol, entry]))

function getDefaultDisplayOrder(meta: MacroIndicatorMeta): number {
  if (meta.macroRank !== undefined) return meta.macroRank * 1_000 + meta.priority
  return 100_000 + meta.priority
}

function getDefaultRefreshMs(meta: MacroIndicatorMeta): number {
  return meta.frequency === "Realtime" ? FAST_MACRO_INDICATOR_REFRESH_MS : DEFAULT_MACRO_INDICATOR_REFRESH_MS
}

function getDefaultRelevanceScore(meta: MacroIndicatorMeta): number {
  const rankScore = meta.macroRank === undefined ? 58 : 103 - meta.macroRank * 3
  const priorityScore = 100 - Math.min(70, Math.floor(meta.priority))
  return Math.max(30, Math.min(100, Math.round(rankScore * 0.7 + priorityScore * 0.3)))
}

export function getConfiguredMacroIndicatorMetas(): ConfiguredMacroIndicatorMeta[] {
  return MACRO_INDICATORS.flatMap((meta) => {
    const config = CONFIG_BY_SYMBOL.get(meta.symbol)
    if (config?.enabled === false) return []
    return [
      {
        ...meta,
        name: config?.name ?? meta.name,
        description: config?.description ?? meta.description,
        meaning: config?.meaning ?? meta.meaning,
        impact: config?.impact ?? meta.impact,
        sourceNote: config?.sourceNote ?? meta.sourceNote,
        displayOrder: config?.order ?? getDefaultDisplayOrder(meta),
        refreshMs: config?.refreshMs ?? getDefaultRefreshMs(meta),
        color: config?.color,
        relevanceScore: config?.relevanceScore ?? MACRO_RELEVANCE_SCORES[meta.symbol] ?? getDefaultRelevanceScore(meta),
      },
    ]
  }).sort((a, b) => {
    const orderDelta = a.displayOrder - b.displayOrder
    if (orderDelta !== 0) return orderDelta
    return a.symbol.localeCompare(b.symbol)
  })
}
