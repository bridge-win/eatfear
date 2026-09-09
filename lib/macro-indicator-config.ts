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
  "EM:US_CN_10Y_SPREAD": 91,
  "EM:CN10Y": 88,
  "EM:CN2Y": 80,
  "EM:CN10Y2Y": 76,
  "EM:LPR1Y": 84,
  "EM:LPR5Y": 86,
  "EM:RRR": 82,
  "FRED:DEXCHUS": 74,
  "FRED:RBCNBIS": 85,
  "FRED:NBCNBIS": 83,
  "EURCNY=X": 70,
  "CNYJPY=X": 68,
  "FRED:TRESEGCNM052N": 78,
  "EM:CN_FX_RESERVES": 87,
  "EM:CN_GOLD_RESERVES": 72,
  "EM:CN_FX_DEPOSITS": 86,
  "EM:CN_FX_LOANS": 77,
  "EM:CN_M2": 84,
  "EM:CN_M2_YOY": 88,
  "EM:CN_M1_YOY": 89,
  "EM:CN_M0_YOY": 70,
  "EM:CN_NEW_LOANS": 85,
  "EM:CN_CPI_YOY": 88,
  "EM:CN_PPI_YOY": 86,
  "FRED:CHNCPIALLMINMEI": 72,
  "EM:CN_PMI_MFG": 89,
  "EM:CN_PMI_NONMFG": 80,
  "EM:CN_GDP_YOY": 82,
  "EM:CN_INDUSTRIAL_YOY": 79,
  "EM:CN_FAI_YOY": 77,
  "EM:CN_RETAIL_YOY": 81,
  "EM:CN_CONSUMER_CONFIDENCE": 74,
  "EM:CN_EXPORTS": 84,
  "EM:CN_IMPORTS": 80,
  "EM:CN_TRADE_BALANCE": 87,
  "EM:CN_EXPORTS_YOY": 82,
  "EM:CN_IMPORTS_YOY": 78,
  "FRED:XTNTVA01CNM667S": 70,
  "EM:CN_MARKET_CAP": 79,
  "EM:CN_TURNOVER": 76,
  "EM:CN_FISCAL_REVENUE": 70,
  "CN:annual:income": 76,
  "CN:annual:urban_income": 70,
  "CN:annual:income_median": 72,
  "CN:annual:deposits": 80,
  "CN:annual:urban_population": 66,
  "CN:mortgage_rate": 78,
  "CN:hpi:CN": 80,
  "CN:annual:sales": 76,
  "CN:annual:investment": 74,
  "CN:annual:starts": 72,
  "CN:annual:completions": 66,
  "CN:annual:inventory": 70,
  "CN:annual:mortgage_flow": 68,
  "CN:hpi:US": 66,
  "CN:hpi:JP": 70,
  "CN:hpi:DE": 60,
  "CN:hpi:UK": 60,
  "CN:hpi:AU": 60,
}

// Edit this file to control Macro indicator visibility, order, refresh cadence,
// and copy. Unlisted symbols remain enabled and keep their metadata priority.
export const MACRO_INDICATOR_CONFIG: readonly MacroIndicatorDisplayConfig[] = [
  { symbol: "FRED:DFF", order: 10 },
  { symbol: "FRED:DGS10", order: 20 },
  { symbol: "FRED:DGS2", order: 30 },
  { symbol: "EM:CN10Y", order: 32 },
  { symbol: "EM:LPR1Y", order: 34 },
  { symbol: "EM:LPR5Y", order: 35 },
  { symbol: "EM:RRR", order: 36 },
  { symbol: "EM:CN2Y", order: 37 },
  { symbol: "EM:CN10Y2Y", order: 38 },
  { symbol: "FRED:CPIAUCSL", order: 40 },
  { symbol: "EM:CN_CPI_YOY", order: 45 },
  { symbol: "FRED:CPILFESL", order: 50 },
  { symbol: "FRED:PCEPI", order: 60 },
  { symbol: "FRED:PCEPILFE", order: 70 },
  { symbol: "FRED:PPIACO", order: 80 },
  { symbol: "EM:CN_PPI_YOY", order: 85 },
  { symbol: "FRED:CHNCPIALLMINMEI", order: 86 },
  { symbol: "FRED:M2SL", order: 90 },
  { symbol: "FRED:M1SL", order: 100 },
  { symbol: "FRED:M2REAL", order: 110 },
  { symbol: "FRED:M2V", order: 120 },
  { symbol: "EM:CN_M2", order: 130 },
  { symbol: "EM:CN_M2_YOY", order: 131 },
  { symbol: "EM:CN_M1_YOY", order: 132 },
  { symbol: "EM:CN_M0_YOY", order: 133 },
  { symbol: "EM:CN_NEW_LOANS", order: 134 },
  { symbol: "CN:annual:deposits", order: 135 },
  { symbol: "FRED:MYAGM2CNM189N", order: 138 },
  { symbol: "FRED:MYAGM1CNM189N", order: 139 },
  { symbol: "FRED:TOTLL", order: 150 },
  { symbol: "FRED:IPMAN", order: 160 },
  { symbol: "EM:CN_PMI_MFG", order: 162 },
  { symbol: "EM:CN_PMI_NONMFG", order: 163 },
  { symbol: "FRED:GDPC1", order: 170 },
  { symbol: "EM:CN_GDP_YOY", order: 175 },
  { symbol: "FRED:GDP", order: 180 },
  { symbol: "FRED:UNRATE", order: 190 },
  { symbol: "FRED:PAYEMS", order: 200 },
  { symbol: "FRED:ICSA", order: 210 },
  { symbol: "DX-Y.NYB", order: 220, refreshMs: FAST_MACRO_INDICATOR_REFRESH_MS },
  { symbol: "CNY=X", order: 230, refreshMs: FAST_MACRO_INDICATOR_REFRESH_MS },
  { symbol: "USDCNH=X", order: 240, refreshMs: FAST_MACRO_INDICATOR_REFRESH_MS },
  { symbol: "EM:US_CN_10Y_SPREAD", order: 241 },
  { symbol: "FRED:RBCNBIS", order: 242 },
  { symbol: "FRED:NBCNBIS", order: 243 },
  { symbol: "EM:CN_FX_RESERVES", order: 244 },
  { symbol: "FRED:TRESEGCNM052N", order: 245 },
  { symbol: "EM:CN_FX_DEPOSITS", order: 246 },
  { symbol: "EM:CN_FX_LOANS", order: 247 },
  { symbol: "EM:CN_GOLD_RESERVES", order: 248 },
  { symbol: "FRED:DEXCHUS", order: 249 },
  { symbol: "EURCNY=X", order: 249.1, refreshMs: FAST_MACRO_INDICATOR_REFRESH_MS },
  { symbol: "CNYJPY=X", order: 249.2, refreshMs: FAST_MACRO_INDICATOR_REFRESH_MS },
  { symbol: "FRED:MORTGAGE30US", order: 250 },
  { symbol: "CN:mortgage_rate", order: 251 },
  { symbol: "CN:hpi:CN", order: 252 },
  { symbol: "CN:annual:sales", order: 253 },
  { symbol: "CN:annual:investment", order: 254 },
  { symbol: "CN:annual:starts", order: 255 },
  { symbol: "CN:annual:completions", order: 256 },
  { symbol: "CN:annual:inventory", order: 257 },
  { symbol: "CN:annual:mortgage_flow", order: 258 },
  { symbol: "FRED:HSN1F", order: 260 },
  { symbol: "CN:hpi:JP", order: 261 },
  { symbol: "CN:hpi:US", order: 262 },
  { symbol: "CN:hpi:DE", order: 263 },
  { symbol: "CN:hpi:UK", order: 264 },
  { symbol: "CN:hpi:AU", order: 265 },
  { symbol: "FRED:RSAFS", order: 270 },
  { symbol: "EM:CN_RETAIL_YOY", order: 271 },
  { symbol: "EM:CN_CONSUMER_CONFIDENCE", order: 272 },
  { symbol: "CN:annual:income", order: 273 },
  { symbol: "CN:annual:income_median", order: 274 },
  { symbol: "CN:annual:urban_income", order: 275 },
  { symbol: "CN:annual:urban_population", order: 276 },
  { symbol: "FRED:INDPRO", order: 280 },
  { symbol: "EM:CN_INDUSTRIAL_YOY", order: 281 },
  { symbol: "FRED:GPDI", order: 290 },
  { symbol: "EM:CN_FAI_YOY", order: 291 },
  { symbol: "FRED:CP", order: 300 },
  { symbol: "^FTW5000", order: 310, refreshMs: FAST_MACRO_INDICATOR_REFRESH_MS },
  { symbol: "EM:CN_MARKET_CAP", order: 311 },
  { symbol: "EM:CN_TURNOVER", order: 312 },
  { symbol: "FRED:DDDM01USA156NWDB", order: 320 },
  { symbol: "FRED:DDDM01CNA156NWDB", order: 330 },
  { symbol: "FRED:DDDM02USA156NWDB", order: 340 },
  { symbol: "FRED:DDDM02CNA156NWDB", order: 350 },
  { symbol: "EM:CN_EXPORTS", order: 360 },
  { symbol: "EM:CN_IMPORTS", order: 361 },
  { symbol: "EM:CN_TRADE_BALANCE", order: 362 },
  { symbol: "EM:CN_EXPORTS_YOY", order: 363 },
  { symbol: "EM:CN_IMPORTS_YOY", order: 364 },
  { symbol: "FRED:XTNTVA01CNM667S", order: 365 },
  { symbol: "EM:CN_FISCAL_REVENUE", order: 370 },
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
