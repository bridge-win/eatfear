export type OpportunityAssetClass = "crypto" | "stock" | "macro"

export type OpportunityDirection = "long" | "short" | "risk_off" | "neutral" | "watch"

export type OpportunityConfidence = "high" | "medium" | "low"

export type SignalMethodId =
  | "trend"
  | "momentum"
  | "carry"
  | "value"
  | "quality"
  | "liquidity"
  | "volatility"
  | "positioning"
  | "macro_regime"
  | "fundamental_surprise"
  | "sentiment"
  | "event_risk"
  | "onchain_cycle"

export type DataCategoryId =
  | "price"
  | "derivatives"
  | "macro"
  | "futures_fundamental"
  | "equity_fundamental"
  | "crypto_native"
  | "text_sentiment"

export interface LocalizedText {
  zh: string
  en: string
}

export interface OpportunityPoint {
  time: number
  value: number | null
}

export interface OpportunityInputSeries {
  key: string
  label: string
  source: string
  description: string
  value: number | null
  changePercent: number | null
  timestamp: number | null
  data: OpportunityPoint[]
  relevanceScore?: number
}

export interface OpportunityEvidence {
  label: LocalizedText
  value: string
  tone: "positive" | "negative" | "neutral" | "warning"
}

export interface ResearchReference {
  title: string
  url: string
  note: LocalizedText
}

export interface TradingOpportunity {
  id: string
  title: LocalizedText
  thesis: LocalizedText
  assetClass: OpportunityAssetClass
  direction: OpportunityDirection
  confidence: OpportunityConfidence
  score: number
  horizon: LocalizedText
  methods: SignalMethodId[]
  dataCategories: DataCategoryId[]
  evidence: OpportunityEvidence[]
  contradictions: OpportunityEvidence[]
  sourceCoverage: string
  updatedAt: number | null
  references: ResearchReference[]
}

export interface DataCategoryDefinition {
  id: DataCategoryId
  title: LocalizedText
  purpose: LocalizedText
  examples: readonly string[]
  methods: readonly SignalMethodId[]
  sourceUrls: readonly string[]
}

export interface SignalMethodDefinition {
  id: SignalMethodId
  title: LocalizedText
  purpose: LocalizedText
  implementation: LocalizedText
  horizon: LocalizedText
  references: readonly ResearchReference[]
}

export interface SourceRoadmapItem {
  id: string
  title: string
  category: DataCategoryId
  status: "wired" | "planned" | "research"
  url: string
  useCase: LocalizedText
}

interface NumericPoint {
  time: number
  value: number
}

interface SeriesStats {
  latest: number | null
  latestTime: number | null
  first: number | null
  totalReturnPct: number | null
  return30Pct: number | null
  return90Pct: number | null
  return180Pct: number | null
  volatility30Pct: number | null
  percentile: number | null
  zScore: number | null
}

const DAY_MS = 86_400_000

const REFERENCE_TIME_SERIES_MOMENTUM: ResearchReference = {
  title: "Moskowitz, Ooi, Pedersen - Time Series Momentum",
  url: "https://www.aqr.com/insights/research/journal-article/time-series-momentum",
  note: {
    zh: "跨期货和远期市场验证自身趋势延续，是 CTA 趋势跟随的基础证据。",
    en: "Cross-market evidence that an asset's own trend can persist; core basis for CTA trend following.",
  },
}

const REFERENCE_VALUE_MOMENTUM: ResearchReference = {
  title: "Asness, Moskowitz, Pedersen - Value and Momentum Everywhere",
  url: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1363476",
  note: {
    zh: "价值与动量跨资产存在，适合做股票、ETF 与跨资产相对强弱框架。",
    en: "Value and momentum appear across asset classes, supporting relative-strength and rotation frameworks.",
  },
}

const REFERENCE_CARRY: ResearchReference = {
  title: "Koijen, Moskowitz, Pedersen, Vrugt - Carry",
  url: "https://www.nber.org/papers/w19325",
  note: {
    zh: "Carry 对股票、债券、商品、信用、期权等资产的预期收益有解释力。",
    en: "Carry helps explain expected returns across equities, bonds, commodities, credit, and options.",
  },
}

const REFERENCE_CRYPTO_RISK: ResearchReference = {
  title: "Liu, Tsyvinski - Risks and Returns of Cryptocurrency",
  url: "https://www.nber.org/papers/w25882",
  note: {
    zh: "加密资产收益与动量、投资者关注度等因素相关，不能只看传统宏观。",
    en: "Crypto returns relate to momentum and investor attention, not only traditional macro factors.",
  },
}

const REFERENCE_FACTOR_MINING: ResearchReference = {
  title: "Harvey, Liu, Zhu - ... and the Cross-Section of Expected Returns",
  url: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2249314",
  note: {
    zh: "提醒因子挖掘存在多重检验风险，平台信号必须标注验证状态。",
    en: "Warns about multiple-testing risk in factor discovery; signals need validation metadata.",
  },
}

const REFERENCE_BACKTESTING: ResearchReference = {
  title: "Bailey, Lopez de Prado - The Deflated Sharpe Ratio",
  url: "https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf",
  note: {
    zh: "用于识别回测选择偏差和过拟合后的夏普率幻觉。",
    en: "Used to flag selection bias and inflated Sharpe ratios after multiple trials.",
  },
}

const REFERENCE_CRYPTO_FUNDING: ResearchReference = {
  title: "BIS Working Paper 1087 — Crypto carry and funding rate dynamics",
  url: "https://www.bis.org/publ/work1087.htm",
  note: {
    zh: "BIS 证实永续资金费率平均年化 ~7-8%，>0.1%/8h 标志拥挤；backwardation 是罕见底部信号。",
    en: "BIS confirms perp funding averages ~7-8% APY; >0.1%/8h marks crowding; backwardation is a rare bottom signal.",
  },
}

const REFERENCE_CRYPTO_FACTORS: ResearchReference = {
  title: "Chi et al — Basis-Momentum Factor in Crypto Futures (JFM 2023)",
  url: "https://doi.org/10.1002/fut.22457",
  note: {
    zh: "高 basis-momentum 做多做空组合年化 ~222%，是加密期货最强的横截面因子之一。",
    en: "High-basis-momentum long-short portfolio achieved ~222% annualized — strongest cross-sectional factor in crypto futures.",
  },
}

const REFERENCE_ETF_FLOWS: ResearchReference = {
  title: "K33 Research — Bitcoin ETF flows and price correlation",
  url: "https://k33.com/research",
  note: {
    zh: "比特币 ETF 日流量与 BTC 价格相关性约 0.73；多日累计流量信号强于单日。",
    en: "BTC ETF daily flows correlate ~0.73 with BTC price; multi-day cumulative signal stronger than single-day.",
  },
}

const REFERENCE_CROSS_ASSET: ResearchReference = {
  title: "Bianchi, Babiak — Bitcoin and macro cross-asset correlations",
  url: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3938855",
  note: {
    zh: "BTC 与纳指相关性最高峰 0.87，与 DXY 滚动相关 -0.72；ETF 获批后与黄金转为负相关。",
    en: "BTC-Nasdaq correlation peaked at 0.87; rolling DXY correlation -0.72; post-ETF BTC-gold turned near-record negative.",
  },
}

const REFERENCE_ONCHAIN_PEER: ResearchReference = {
  title: "Grobys, Näsman, Sandretto — Using on-chain data to predict Bitcoin cycles",
  url: "https://doi.org/10.1016/j.ribaf.2026.103486",
  note: {
    zh: "RIBF 2026 对 NUPL、MVRV Z-Score、CVDD 做同行评审验证；链上阈值仍需按分位和周期衰减解读。",
    en: "RIBF 2026 peer-reviewed evidence on NUPL, MVRV Z-Score, and CVDD; thresholds still need percentile and cycle-decay treatment.",
  },
}

const REFERENCE_LTW_FACTORS: ResearchReference = {
  title: "Liu, Tsyvinski, Wu — Common Risk Factors in Cryptocurrency",
  url: "https://doi.org/10.1111/jofi.13119",
  note: {
    zh: "JoF 2022 三因子模型 CMKT、CSMB、CMOM 解释加密横截面收益。",
    en: "JoF 2022 three-factor model where CMKT, CSMB, and CMOM capture crypto cross-sectional returns.",
  },
}

const REFERENCE_DVOL: ResearchReference = {
  title: "Deribit — DVOL implied volatility index methodology",
  url: "https://insights.deribit.com/exchange-updates/dvol-deribit-implied-volatility-index/",
  note: {
    zh: "DVOL 是 30 日前瞻年化隐含波动率；高 DVOL 表示波动幅度，不表示方向。",
    en: "DVOL is 30-day forward annualized implied volatility; high DVOL signals magnitude, not direction.",
  },
}

const REFERENCE_SKEW: ResearchReference = {
  title: "Block Scholes — SVI crypto options volatility surfaces",
  url: "https://www.blockscholes.com/data",
  note: {
    zh: "用 SVI 曲面跟踪 25-delta skew；更适合作为恐慌确认而非提前预测。",
    en: "Uses SVI surfaces for 25-delta skew; better as reactive fear confirmation than a leading signal.",
  },
}

export const SIGNAL_METHOD_CATALOG: readonly SignalMethodDefinition[] = [
  {
    id: "trend",
    title: { zh: "趋势 / 时间序列动量", en: "Trend / Time-Series Momentum" },
    purpose: {
      zh: "判断资产自身趋势是否延续，适合 1 周到 12 月的持仓与风控。",
      en: "Detects whether an asset's own trend is persisting across weekly to annual horizons.",
    },
    implementation: {
      zh: "使用 30/90/180 日收益、均线距离、回撤恢复和波动率调整后的趋势分。",
      en: "Uses 30/90/180-day returns, moving-average gaps, drawdown recovery, and volatility-adjusted trend.",
    },
    horizon: { zh: "1 周 - 12 月", en: "1 week - 12 months" },
    references: [REFERENCE_TIME_SERIES_MOMENTUM],
  },
  {
    id: "momentum",
    title: { zh: "横截面动量 / 相对强弱", en: "Cross-Sectional Momentum" },
    purpose: {
      zh: "比较资产、行业、风格因子谁在获得增量资金。",
      en: "Compares which assets, sectors, or factors are receiving incremental capital.",
    },
    implementation: {
      zh: "比较同一资产池 1/3/6 月收益和最新变化率，生成轮动候选。",
      en: "Ranks 1/3/6-month returns and recent changes inside the same investable universe.",
    },
    horizon: { zh: "2 周 - 6 月", en: "2 weeks - 6 months" },
    references: [REFERENCE_VALUE_MOMENTUM, REFERENCE_LTW_FACTORS],
  },
  {
    id: "carry",
    title: { zh: "Carry / 期限结构", en: "Carry / Term Structure" },
    purpose: {
      zh: "捕捉远近期价格、资金费率或利差带来的持仓补偿；资金费率 carry 在 2025 拥挤后年化转负，不能当作稳定收益。",
      en: "Captures compensation embedded in futures curves, funding rates, and spread carry; funding carry turned negative annualized in 2025 as arbitrage crowded.",
    },
    implementation: {
      zh: "使用永续 basis、资金费率、期货曲线、信用利差和利率曲线斜率。",
      en: "Uses perp basis, funding, futures curves, credit spreads, and yield-curve slopes.",
    },
    horizon: { zh: "1 周 - 3 月", en: "1 week - 3 months" },
    references: [REFERENCE_CARRY, REFERENCE_CRYPTO_FUNDING, REFERENCE_CRYPTO_FACTORS],
  },
  {
    id: "volatility",
    title: { zh: "波动率 / 压缩突破", en: "Volatility / Compression Breakout" },
    purpose: {
      zh: "识别风险溢价扩大、极端波动和低波动后的方向选择。",
      en: "Finds risk-premium expansion, extreme moves, and post-compression breakouts.",
    },
    implementation: {
      zh: "使用实现波动率、VIX/DVOL、收益 Z-score、影线和成交量尖峰。",
      en: "Uses realized volatility, VIX/DVOL, return z-scores, candle wicks, and volume spikes.",
    },
    horizon: { zh: "日内 - 1 月", en: "Intraday - 1 month" },
    references: [REFERENCE_BACKTESTING, REFERENCE_DVOL],
  },
  {
    id: "positioning",
    title: { zh: "仓位拥挤 / 杠杆", en: "Crowding / Leverage" },
    purpose: {
      zh: "判断上涨是否由健康资金推动，还是由拥挤杠杆驱动；OI 方向不唯一，爆仓热力图多为估算。",
      en: "Separates healthy participation from crowded leveraged positioning; OI is directionally ambiguous and liquidation heatmaps are estimates.",
    },
    implementation: {
      zh: "组合 OI、资金费率、大户多空比、COT、期权偏度和爆仓代理指标。",
      en: "Combines OI, funding, top-trader ratios, COT, options skew, and liquidation proxies.",
    },
    horizon: { zh: "日内 - 6 周", en: "Intraday - 6 weeks" },
    references: [REFERENCE_CARRY, REFERENCE_CRYPTO_RISK, REFERENCE_SKEW],
  },
  {
    id: "macro_regime",
    title: { zh: "宏观 Regime", en: "Macro Regime" },
    purpose: {
      zh: "用利率、通胀、信用、美元和流动性判断风险资产顺风或逆风。",
      en: "Uses rates, inflation, credit, USD, and liquidity to judge risk-asset tailwinds.",
    },
    implementation: {
      zh: "组合政策利率、2Y/10Y、美债实际利率、信用利差、M2、DXY 和 VIX。",
      en: "Combines policy rates, 2Y/10Y yields, real yields, credit spreads, M2, DXY, and VIX.",
    },
    horizon: { zh: "1 月 - 12 月", en: "1 month - 12 months" },
    references: [REFERENCE_FACTOR_MINING],
  },
  {
    id: "value",
    title: { zh: "价值 / 估值", en: "Value / Valuation" },
    purpose: {
      zh: "衡量价格相对盈利、现金流、账面价值、成本曲线或历史区间是否便宜；BTC 链上峰值阈值逐周期下降，应使用历史分位。",
      en: "Measures whether price is cheap versus earnings, cash flow, book value, cost curves, or history; BTC on-chain peak thresholds decline each cycle, so use percentiles.",
    },
    implementation: {
      zh: "股票使用估值和盈利修正；加密使用矿工成本、MVRV 类代理和历史分位。",
      en: "Uses valuation and revisions for stocks; miner cost, MVRV-like proxies, and percentiles for crypto.",
    },
    horizon: { zh: "3 月 - 3 年", en: "3 months - 3 years" },
    references: [REFERENCE_VALUE_MOMENTUM, REFERENCE_ONCHAIN_PEER],
  },
  {
    id: "liquidity",
    title: { zh: "流动性 / 资金流", en: "Liquidity / Flow" },
    purpose: {
      zh: "确认趋势背后是否有稳定币、ETF、成交量、信用和货币供应支持。",
      en: "Checks whether stablecoins, ETFs, volume, credit, and money supply support the trend.",
    },
    implementation: {
      zh: "使用稳定币市值、成交量 Z-score、M2、信用利差、ETF/基金流和链上流量。",
      en: "Uses stablecoin market cap, volume z-score, M2, credit spreads, ETF/fund flows, and on-chain flow.",
    },
    horizon: { zh: "1 周 - 6 月", en: "1 week - 6 months" },
    references: [REFERENCE_CRYPTO_RISK],
  },
  {
    id: "quality",
    title: { zh: "质量 / 防御性", en: "Quality / Defensive" },
    purpose: {
      zh: "在风险预算收缩时筛选现金流、盈利能力和低波动更强的资产。",
      en: "Screens for cash-flow, profitability, and low-volatility resilience when risk budgets tighten.",
    },
    implementation: {
      zh: "使用 QUAL、USMV、SPLV、利润率、杠杆率、自由现金流和信用压力代理。",
      en: "Uses QUAL, USMV, SPLV, margins, leverage, free cash flow, and credit-stress proxies.",
    },
    horizon: { zh: "1 月 - 12 月", en: "1 month - 12 months" },
    references: [REFERENCE_VALUE_MOMENTUM],
  },
  {
    id: "fundamental_surprise",
    title: { zh: "基本面 Surprise", en: "Fundamental Surprise" },
    purpose: {
      zh: "捕捉财报、库存、产量、供需和政策发布后的预期差。",
      en: "Captures expectation gaps after earnings, inventory, production, supply-demand, or policy releases.",
    },
    implementation: {
      zh: "对 SEC、EIA、COT、BLS、FRED 发布值计算 surprise、修正方向和滞后风险。",
      en: "Computes surprise, revision direction, and reporting lag across SEC, EIA, COT, BLS, and FRED releases.",
    },
    horizon: { zh: "1 天 - 3 月", en: "1 day - 3 months" },
    references: [REFERENCE_BACKTESTING],
  },
  {
    id: "sentiment",
    title: { zh: "情绪 / 关注度", en: "Sentiment / Attention" },
    purpose: {
      zh: "衡量新闻、社交、恐慌贪婪和投资者关注度是否过热或恐慌。",
      en: "Measures whether news, social attention, fear-greed, and investor attention are overheated or panicked.",
    },
    implementation: {
      zh: "使用资讯 tone、恐慌贪婪、搜索/社交关注代理和事件标题聚类。",
      en: "Uses news tone, fear-greed, search/social proxies, and event-title clustering.",
    },
    horizon: { zh: "日内 - 1 月", en: "Intraday - 1 month" },
    references: [REFERENCE_CRYPTO_RISK],
  },
  {
    id: "event_risk",
    title: { zh: "事件风险", en: "Event Risk" },
    purpose: {
      zh: "跟踪央行、财报、库存、监管和链上解锁等离散风险。",
      en: "Tracks discrete risks such as central banks, earnings, inventories, regulation, and token unlocks.",
    },
    implementation: {
      zh: "给每个事件绑定资产、预期方向、发布时间、历史波动和失效条件。",
      en: "Maps each event to assets, expected direction, release time, historical volatility, and invalidation.",
    },
    horizon: { zh: "日内 - 2 周", en: "Intraday - 2 weeks" },
    references: [REFERENCE_FACTOR_MINING],
  },
  {
    id: "onchain_cycle",
    title: { zh: "链上周期 / 矿工成本", en: "On-Chain Cycle / Miner Cost" },
    purpose: {
      zh: "用矿工成本、MVRV、SOPR 和已实现价格判断 BTC 周期阶段；所有顶部阈值逐周期下降，固定触发位只能做 regime 背景。",
      en: "Uses miner cost, MVRV, SOPR, and realized price to place BTC within its market cycle; all top thresholds decay by cycle, so fixed levels are regime context only.",
    },
    implementation: {
      zh: "价格 / 矿工成本比值；MVRV Z-Score Z<0 底部、Z>7 旧顶部但需分位；SOPR 1.0 是盈亏枢轴。",
      en: "Price/miner-cost ratio; MVRV Z-Score Z<0 bottoms, legacy Z>7 tops with percentile adjustment; SOPR 1.0 profit/loss pivot.",
    },
    horizon: { zh: "1 月 - 24 月", en: "1 month - 24 months" },
    references: [REFERENCE_ONCHAIN_PEER, REFERENCE_CRYPTO_FUNDING, REFERENCE_CRYPTO_FACTORS],
  },
] as const

export const DATA_CATEGORY_CATALOG: readonly DataCategoryDefinition[] = [
  {
    id: "price",
    title: { zh: "行情价格", en: "Market Price" },
    purpose: {
      zh: "所有机会判断的第一层：趋势、动量、回撤、波动率、成交量和广度。",
      en: "First layer for every setup: trend, momentum, drawdown, volatility, volume, and breadth.",
    },
    examples: ["OHLCV", "returns", "drawdown", "realized volatility", "breadth", "correlation"],
    methods: ["trend", "momentum", "volatility"],
    sourceUrls: ["https://finance.yahoo.com/", "https://www.okx.com/docs-v5/en/"],
  },
  {
    id: "derivatives",
    title: { zh: "衍生品与杠杆", en: "Derivatives & Leverage" },
    purpose: {
      zh: "识别拥挤、强平、逼空、carry 和波动率定价。",
      en: "Detects crowding, liquidations, squeezes, carry, and volatility pricing.",
    },
    examples: ["funding", "basis", "open interest", "liquidations", "IV/RV", "skew", "put/call"],
    methods: ["carry", "positioning", "volatility"],
    sourceUrls: ["https://www.okx.com/docs-v5/en/", "https://www.deribit.com/"],
  },
  {
    id: "macro",
    title: { zh: "跨资产宏观", en: "Cross-Asset Macro" },
    purpose: {
      zh: "解释风险资产的顺风/逆风背景，避免只看单一市场信号。",
      en: "Explains risk-asset tailwinds/headwinds so signals are not read in one-market isolation.",
    },
    examples: ["policy rates", "2Y/10Y", "real yields", "DXY", "credit spreads", "VIX", "M2"],
    methods: ["macro_regime", "liquidity", "volatility"],
    sourceUrls: ["https://fred.stlouisfed.org/docs/api/fred/series_observations.html"],
  },
  {
    id: "futures_fundamental",
    title: { zh: "期货基本面", en: "Futures Fundamentals" },
    purpose: {
      zh: "把商品、利率和金融期货从价格信号扩展到库存、供需和仓位。",
      en: "Extends futures analysis from price into inventories, supply-demand, and trader positioning.",
    },
    examples: ["CFTC COT", "EIA inventories", "curve carry", "calendar spreads", "seasonality"],
    methods: ["carry", "positioning", "fundamental_surprise", "event_risk"],
    sourceUrls: [
      "https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm",
      "https://www.eia.gov/opendata/browser/petroleum/stoc",
    ],
  },
  {
    id: "equity_fundamental",
    title: { zh: "股票基本面", en: "Equity Fundamentals" },
    purpose: {
      zh: "让股票机会不只依赖价格，加入估值、盈利、现金流、内部人和机构持仓。",
      en: "Makes equity setups depend on valuation, earnings, cash flow, insiders, and ownership, not only price.",
    },
    examples: ["10-K", "10-Q", "8-K", "Form 4", "13F", "earnings revisions", "buybacks"],
    methods: ["value", "quality", "fundamental_surprise", "event_risk"],
    sourceUrls: ["https://data.sec.gov/", "https://www.sec.gov/edgar/sec-api-documentation"],
  },
  {
    id: "crypto_native",
    title: { zh: "加密原生数据", en: "Crypto-Native Data" },
    purpose: {
      zh: "补足链上活动、稳定币流动性、矿工成本、DeFi TVL 和交易所库存。",
      en: "Adds on-chain activity, stablecoin liquidity, miner cost, DeFi TVL, and exchange inventories.",
    },
    examples: ["stablecoin supply", "active addresses", "fees", "hashrate", "miner cost", "DeFi TVL"],
    methods: ["liquidity", "value", "sentiment", "positioning"],
    sourceUrls: ["https://defillama.com/", "https://www.blockchain.com/explorer/api/charts_api"],
  },
  {
    id: "text_sentiment",
    title: { zh: "文本与情绪", en: "Text & Sentiment" },
    purpose: {
      zh: "把新闻、公告、央行发言、财报电话会和社交关注度转成事件与情绪信号。",
      en: "Turns news, filings, central-bank speeches, calls, and social attention into event and sentiment signals.",
    },
    examples: ["RSS news", "filing text", "earnings calls", "Fed speeches", "fear-greed", "social attention"],
    methods: ["sentiment", "event_risk", "fundamental_surprise"],
    sourceUrls: ["https://www.sec.gov/search-filings", "https://alternative.me/crypto/fear-and-greed-index/"],
  },
] as const

export const SOURCE_ROADMAP: readonly SourceRoadmapItem[] = [
  {
    id: "fred",
    title: "FRED series observations",
    category: "macro",
    status: "wired",
    url: "https://fred.stlouisfed.org/docs/api/fred/series_observations.html",
    useCase: {
      zh: "宏观 regime、利率、通胀、信用、流动性和增长数据。",
      en: "Macro regime data for rates, inflation, credit, liquidity, and growth.",
    },
  },
  {
    id: "cftc-cot",
    title: "CFTC COT historical compressed",
    category: "futures_fundamental",
    status: "planned",
    url: "https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm",
    useCase: {
      zh: "商业套保与 managed money 仓位分位，用于商品和金融期货拥挤判断。",
      en: "Commercial and managed-money positioning percentiles for futures crowding.",
    },
  },
  {
    id: "eia-stocks",
    title: "EIA petroleum stocks",
    category: "futures_fundamental",
    status: "planned",
    url: "https://www.eia.gov/opendata/browser/petroleum/stoc",
    useCase: {
      zh: "原油、汽油、馏分油库存 surprise 与曲线结构组合。",
      en: "Crude, gasoline, and distillate inventory surprise combined with curve structure.",
    },
  },
  {
    id: "sec-edgar",
    title: "SEC EDGAR data APIs",
    category: "equity_fundamental",
    status: "planned",
    url: "https://data.sec.gov/",
    useCase: {
      zh: "10-K/10-Q/8-K、Form 4 和 company facts，用于财报与事件风险。",
      en: "10-K/10-Q/8-K, Form 4, and company facts for earnings and event risk.",
    },
  },
  {
    id: "okx-derivatives",
    title: "OKX public market and Rubik data",
    category: "derivatives",
    status: "wired",
    url: "https://www.okx.com/docs-v5/en/",
    useCase: {
      zh: "加密永续价格、OI、资金费率、basis、大户多空和主动成交。",
      en: "Crypto perp price, OI, funding, basis, top-trader ratios, and taker flow.",
    },
  },
  {
    id: "glassnode-onchain",
    title: "Glassnode on-chain metric guides",
    category: "crypto_native",
    status: "planned",
    url: "https://docs.glassnode.com/",
    useCase: {
      zh: "MVRV、SOPR、NUPL、Puell、HODL waves 和 Accumulation Trend Score。",
      en: "MVRV, SOPR, NUPL, Puell, HODL waves, and Accumulation Trend Score.",
    },
  },
  {
    id: "cryptoquant-flow",
    title: "CryptoQuant exchange flow and premium metrics",
    category: "crypto_native",
    status: "planned",
    url: "https://cryptoquant.com/asset/btc/summary",
    useCase: {
      zh: "交易所储备、净流入、Coinbase Premium、矿工储备、SSR 和 cohort 指标。",
      en: "Exchange reserves, netflows, Coinbase premium, miner reserves, SSR, and cohort metrics.",
    },
  },
  {
    id: "coinmetrics-network",
    title: "Coin Metrics network and stablecoin metrics",
    category: "crypto_native",
    status: "planned",
    url: "https://docs.coinmetrics.io/",
    useCase: {
      zh: "实现市值、稳定币供给、网络活动和资产参考利率的高质量备选源。",
      en: "High-quality alternate source for realized cap, stablecoins, network activity, and reference rates.",
    },
  },
  {
    id: "kaiko-liquidity",
    title: "Kaiko market depth and liquidity feeds",
    category: "derivatives",
    status: "research",
    url: "https://docs.kaiko.com/",
    useCase: {
      zh: "盘口深度、买卖价差、滑点和交易所流动性质量，用于仓位和执行约束。",
      en: "Depth, spreads, slippage, and venue liquidity quality for sizing and execution constraints.",
    },
  },
  {
    id: "farside-etf",
    title: "Farside BTC ETF flows",
    category: "crypto_native",
    status: "research",
    url: "https://farside.co.uk/btc/",
    useCase: {
      zh: "美国现货 BTC ETF 单日净流入、发行商广度、GBTC 拖累和累计资金流。",
      en: "US spot BTC ETF daily net flows, issuer breadth, GBTC drag, and cumulative flow.",
    },
  },
  {
    id: "coinshares-funds",
    title: "CoinShares digital asset fund flows",
    category: "text_sentiment",
    status: "research",
    url: "https://coinshares.com/insights/research-data/",
    useCase: {
      zh: "周频机构资金流，按资产和地区确认风险偏好。",
      en: "Weekly institutional fund flows by asset and region for risk-appetite confirmation.",
    },
  },
  {
    id: "deribit-options",
    title: "Deribit options and volatility data",
    category: "derivatives",
    status: "wired",
    url: "https://docs.deribit.com/",
    useCase: {
      zh: "DVOL、期权持仓墙、最大痛点、隐含波动率和期限结构。",
      en: "DVOL, options OI walls, max pain, implied volatility, and term structure.",
    },
  },
  {
    id: "sec-news",
    title: "RSS and filing text",
    category: "text_sentiment",
    status: "research",
    url: "https://www.sec.gov/search-filings",
    useCase: {
      zh: "公告、新闻和监管文本做 tone、事件聚类和影响资产映射。",
      en: "Filings, news, and regulation text for tone, event clustering, and asset mapping.",
    },
  },
  {
    id: "glassnode",
    title: "Glassnode on-chain metrics",
    category: "crypto_native",
    status: "planned",
    url: "https://glassnode.com/",
    useCase: {
      zh: "MVRV Z-Score、Puell Multiple、SOPR、活跃地址、交易所库存和矿工净仓位。",
      en: "MVRV Z-Score, Puell Multiple, SOPR, active addresses, exchange reserves, and miner net position.",
    },
  },
  {
    id: "coinglass",
    title: "CoinGlass derivatives data",
    category: "derivatives",
    status: "planned",
    url: "https://www.coinglass.com/",
    useCase: {
      zh: "多交易所 OI、强平数据、多空比、资金费率历史和期权最大痛苦点。",
      en: "Cross-exchange OI, liquidations, long/short ratio, funding rate history, and options max pain.",
    },
  },
  {
    id: "laevitas",
    title: "Laevitas options analytics",
    category: "derivatives",
    status: "planned",
    url: "https://app.laevitas.ch/",
    useCase: {
      zh: "多交易所期权 IV、skew、期限结构和波动率指标；优先评估免费层可用字段。",
      en: "Multi-venue options IV, skew, term structure, and volatility analytics; evaluate free-tier fields first.",
    },
  },
  {
    id: "deribit-metrics",
    title: "Deribit metrics via proxy",
    category: "derivatives",
    status: "wired",
    url: "https://docs.deribit.com/",
    useCase: {
      zh: "通过代理接入 DVOL、skew、put/call、最大痛点和期权持仓墙。",
      en: "Proxy-wired DVOL, skew, put/call, max pain, and options OI walls.",
    },
  },
  {
    id: "k33-research",
    title: "K33 Research market intelligence",
    category: "crypto_native",
    status: "research",
    url: "https://k33.com/research",
    useCase: {
      zh: "机构资金流、ETF 持仓跟踪、期货 basis 和 BTC 周期定位研究。",
      en: "Institutional flow, ETF holdings tracking, futures basis, and BTC cycle positioning research.",
    },
  },
  {
    id: "block-scholes",
    title: "Block Scholes crypto options analytics",
    category: "derivatives",
    status: "research",
    url: "https://www.blockscholes.com/",
    useCase: {
      zh: "加密期权 IV 曲面、偏度、波动率微笑和 RV/IV 比率分析。",
      en: "Crypto options IV surface, skew, volatility smile, and RV/IV ratio analytics.",
    },
  },
  {
    id: "coin-metrics",
    title: "Coin Metrics Network Data",
    category: "crypto_native",
    status: "planned",
    url: "https://coinmetrics.io/",
    useCase: {
      zh: "链上经济指标：已实现市值、矿工收入、交易量、供应分布和安全指标。",
      en: "On-chain economics: realized cap, miner revenue, transaction volume, supply distribution, and security metrics.",
    },
  },
] as const

const METHOD_BY_ID = new Map(SIGNAL_METHOD_CATALOG.map((method) => [method.id, method]))

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function safeRound(value: number, digits = 0): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function formatSignedPct(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "n/a"
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`
}

function formatScore(value: number): string {
  return `${Math.round(value)}/100`
}

function cleanPoints(series: OpportunityInputSeries | undefined): NumericPoint[] {
  if (!series) return []
  return series.data
    .filter((point): point is NumericPoint => point.value !== null && Number.isFinite(point.value) && Number.isFinite(point.time))
    .sort((a, b) => a.time - b.time)
}

function getStats(series: OpportunityInputSeries | undefined): SeriesStats {
  const points = cleanPoints(series)
  if (points.length === 0) {
    return {
      latest: series?.value ?? null,
      latestTime: series?.timestamp ?? null,
      first: null,
      totalReturnPct: null,
      return30Pct: series?.changePercent ?? null,
      return90Pct: null,
      return180Pct: null,
      volatility30Pct: null,
      percentile: null,
      zScore: null,
    }
  }

  const latestPoint = points[points.length - 1]
  const firstPoint = points[0]
  const latest = latestPoint.value
  const pctFromDays = (days: number): number | null => {
    const target = latestPoint.time - days * DAY_MS
    const candidate = [...points].reverse().find((point) => point.time <= target)
    if (!candidate || candidate.value === 0) return null
    return (latest / candidate.value - 1) * 100
  }

  const values = points.map((point) => point.value)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  const std = Math.sqrt(variance)
  const percentile = values.filter((value) => value <= latest).length / values.length
  const recent = points.slice(-31)
  const returns = recent.flatMap((point, index) => {
    const previous = recent[index - 1]
    if (!previous || previous.value <= 0 || point.value <= 0) return []
    return [Math.log(point.value / previous.value)]
  })
  const vol =
    returns.length < 2
      ? null
      : Math.sqrt(
          returns.reduce((sum, value) => {
            const avg = returns.reduce((innerSum, inner) => innerSum + inner, 0) / returns.length
            return sum + (value - avg) ** 2
          }, 0) / (returns.length - 1),
        ) *
        Math.sqrt(365) *
        100

  return {
    latest,
    latestTime: latestPoint.time,
    first: firstPoint.value,
    totalReturnPct: firstPoint.value === 0 ? null : (latest / firstPoint.value - 1) * 100,
    return30Pct: pctFromDays(30) ?? series?.changePercent ?? null,
    return90Pct: pctFromDays(90),
    return180Pct: pctFromDays(180),
    volatility30Pct: vol,
    percentile,
    zScore: std === 0 ? null : (latest - mean) / std,
  }
}

function scoreFromCenteredPct(value: number | null, low: number, high: number): number {
  if (value === null || !Number.isFinite(value)) return 50
  return clamp(((value - low) / (high - low)) * 100, 0, 100)
}

function scoreInverse(value: number | null, low: number, high: number): number {
  return 100 - scoreFromCenteredPct(value, low, high)
}

function averageScores(scores: readonly number[]): number {
  if (scores.length === 0) return 50
  return clamp(scores.reduce((sum, score) => sum + score, 0) / scores.length, 0, 100)
}

function confidenceFromInputs(score: number, evidenceCount: number, contradictionCount: number): OpportunityConfidence {
  if (evidenceCount >= 4 && contradictionCount <= 1 && (score >= 68 || score <= 32)) return "high"
  if (evidenceCount >= 3 && contradictionCount <= 2) return "medium"
  return "low"
}

function directionFromScore(score: number): OpportunityDirection {
  if (score >= 68) return "long"
  if (score <= 32) return "short"
  return "watch"
}

function maxTimestamp(series: readonly OpportunityInputSeries[]): number | null {
  const timestamps = series
    .map((item) => item.timestamp)
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0)
  if (timestamps.length === 0) return null
  return Math.max(...timestamps)
}

function compactCoverage(series: readonly (OpportunityInputSeries | undefined)[]): string {
  const sources = Array.from(
    new Set(series.flatMap((item) => (item?.source ? [item.source.split(" · ")[0].trim()] : []))),
  ).slice(0, 4)
  return sources.length === 0 ? "Existing dashboard series" : sources.join(" · ")
}

function seriesByKey(series: readonly OpportunityInputSeries[], key: string): OpportunityInputSeries | undefined {
  return series.find((item) => item.key === key)
}

function seriesBySymbol(series: readonly OpportunityInputSeries[], symbols: readonly string[]): OpportunityInputSeries | undefined {
  const lowerSymbols = symbols.map((symbol) => symbol.toLowerCase())
  return series.find((item) => {
    const haystack = `${item.key} ${item.label}`.toLowerCase()
    return lowerSymbols.some((symbol) => haystack.includes(symbol))
  })
}

function evidence(
  label: LocalizedText,
  value: string,
  tone: OpportunityEvidence["tone"] = "neutral",
): OpportunityEvidence {
  return { label, value, tone }
}

function referencesFor(methods: readonly SignalMethodId[]): ResearchReference[] {
  const refs = methods.flatMap((method) => METHOD_BY_ID.get(method)?.references ?? [])
  return Array.from(new Map(refs.map((ref) => [ref.url, ref])).values()).slice(0, 3)
}

function buildCryptoTrendOpportunity(series: readonly OpportunityInputSeries[], marketName: string): TradingOpportunity {
  const price = seriesByKey(series, "btcPrice") ?? seriesBySymbol(series, [marketName, "price"])
  const momentum30 = seriesByKey(series, "btcMomentum30d")
  const momentum90 = seriesByKey(series, "btcMomentum90d")
  const stablecoins = seriesByKey(series, "stablecoinMcap")
  const nasdaq = seriesByKey(series, "nasdaq")
  const dxy = seriesByKey(series, "dxy")
  const vix = seriesByKey(series, "vix")
  const priceStats = getStats(price)
  const m30 = getStats(momentum30)
  const m90 = getStats(momentum90)
  const stableStats = getStats(stablecoins)
  const nasdaqStats = getStats(nasdaq)
  const dxyStats = getStats(dxy)
  const vixStats = getStats(vix)

  const score = averageScores([
    scoreFromCenteredPct(m30.latest ?? priceStats.return30Pct, -18, 22),
    scoreFromCenteredPct(m90.latest ?? priceStats.return90Pct, -30, 45),
    scoreFromCenteredPct(stableStats.return30Pct, -1.5, 2.5),
    scoreFromCenteredPct(nasdaqStats.return30Pct, -8, 10),
    scoreInverse(dxyStats.return30Pct, -3, 3),
    scoreInverse(vixStats.return30Pct, -20, 35),
  ])
  const evidenceItems = [
    evidence({ zh: "30 日趋势", en: "30D trend" }, formatSignedPct(m30.latest ?? priceStats.return30Pct), score >= 50 ? "positive" : "negative"),
    evidence({ zh: "90 日趋势", en: "90D trend" }, formatSignedPct(m90.latest ?? priceStats.return90Pct), score >= 55 ? "positive" : "neutral"),
    evidence({ zh: "稳定币流动性", en: "Stablecoin liquidity" }, formatSignedPct(stableStats.return30Pct), (stableStats.return30Pct ?? 0) >= 0 ? "positive" : "negative"),
    evidence({ zh: "纳指确认", en: "Nasdaq confirmation" }, formatSignedPct(nasdaqStats.return30Pct), (nasdaqStats.return30Pct ?? 0) >= 0 ? "positive" : "warning"),
  ]
  const contradictions = [
    ...(dxyStats.return30Pct !== null && dxyStats.return30Pct > 1.5
      ? [evidence({ zh: "美元走强", en: "USD strength" }, formatSignedPct(dxyStats.return30Pct), "warning")]
      : []),
    ...(vixStats.return30Pct !== null && vixStats.return30Pct > 20
      ? [evidence({ zh: "波动率升温", en: "Volatility rising" }, formatSignedPct(vixStats.return30Pct), "warning")]
      : []),
  ]
  const methods: SignalMethodId[] = ["trend", "momentum", "liquidity", "macro_regime"]
  return {
    id: "crypto-trend-liquidity",
    title: { zh: `${marketName} 趋势 + 流动性共振`, en: `${marketName} Trend + Liquidity Alignment` },
    thesis: {
      zh: score >= 60 ? "趋势、流动性和风险资产确认偏顺风，回调更适合按趋势处理。" : "趋势共振不足，等待价格、稳定币或宏观风险重新对齐。",
      en: score >= 60 ? "Trend, liquidity, and risk-asset confirmation are broadly aligned; dips can be read with trend bias." : "Trend alignment is incomplete; wait for price, stablecoins, or macro risk to realign.",
    },
    assetClass: "crypto",
    direction: directionFromScore(score),
    confidence: confidenceFromInputs(score, evidenceItems.length, contradictions.length),
    score: Math.round(score),
    horizon: { zh: "1 周 - 3 月", en: "1 week - 3 months" },
    methods,
    dataCategories: ["price", "crypto_native", "macro"],
    evidence: evidenceItems,
    contradictions,
    sourceCoverage: compactCoverage([price, momentum30, momentum90, stablecoins, nasdaq, dxy, vix]),
    updatedAt: maxTimestamp([price, momentum30, momentum90, stablecoins, nasdaq, dxy, vix].filter((item): item is OpportunityInputSeries => Boolean(item))),
    references: referencesFor(methods),
  }
}

function buildCryptoCrowdingOpportunity(series: readonly OpportunityInputSeries[], marketName: string): TradingOpportunity {
  const funding = seriesByKey(series, "funding")
  const oiChange = seriesByKey(series, "oiChangePct")
  const oiZ = seriesByKey(series, "oiReturnZ")
  const basis = seriesByKey(series, "basis")
  const dvol = seriesByKey(series, "dvol")
  const returnZ = seriesByKey(series, "btcReturnZ")
  const ls = seriesByKey(series, "ls")
  const fundingStats = getStats(funding)
  const oiStats = getStats(oiChange)
  const oiZStats = getStats(oiZ)
  const basisStats = getStats(basis)
  const dvolStats = getStats(dvol)
  const returnStats = getStats(returnZ)
  const lsStats = getStats(ls)
  const fundingAbs = fundingStats.latest === null ? null : Math.abs(fundingStats.latest)
  const crowdingScore = averageScores([
    scoreFromCenteredPct(fundingAbs, 0.01, 0.09),
    scoreFromCenteredPct(oiStats.latest, -3, 8),
    scoreFromCenteredPct(oiZStats.latest, -1, 2.5),
    scoreFromCenteredPct(basisStats.latest, -0.2, 1.2),
    scoreFromCenteredPct(dvolStats.percentile, 0.35, 0.85),
    scoreFromCenteredPct(Math.abs(returnStats.latest ?? 0), 0.5, 3),
    scoreFromCenteredPct(Math.abs((lsStats.latest ?? 1) - 1), 0.05, 0.45),
  ])
  const evidenceItems = [
    evidence({ zh: "资金费率极端度", en: "Funding extremity" }, fundingStats.latest === null ? "n/a" : `${fundingStats.latest.toFixed(3)}%`, crowdingScore > 62 ? "warning" : "neutral"),
    evidence({ zh: "OI 日变化", en: "OI daily change" }, formatSignedPct(oiStats.latest), (oiStats.latest ?? 0) > 4 ? "warning" : "neutral"),
    evidence({ zh: "Basis", en: "Basis" }, formatSignedPct(basisStats.latest), (basisStats.latest ?? 0) > 0.8 ? "warning" : "neutral"),
    evidence({ zh: "收益 Z-score", en: "Return z-score" }, returnStats.latest === null ? "n/a" : returnStats.latest.toFixed(2), Math.abs(returnStats.latest ?? 0) > 2 ? "warning" : "neutral"),
  ]
  const contradictions = [
    ...(crowdingScore < 45
      ? [evidence({ zh: "杠杆压力较低", en: "Leverage pressure low" }, formatScore(100 - crowdingScore), "positive")]
      : []),
  ]
  const methods: SignalMethodId[] = ["carry", "positioning", "volatility"]
  return {
    id: "crypto-crowding-risk",
    title: { zh: `${marketName} 杠杆拥挤雷达`, en: `${marketName} Leverage Crowding Radar` },
    thesis: {
      zh: crowdingScore >= 68 ? "杠杆、basis 或波动率显示拥挤，趋势信号需要降低仓位或等待清洗。" : "杠杆拥挤度不高，趋势信号更可能由现货和流动性驱动。",
      en: crowdingScore >= 68 ? "Leverage, basis, or volatility look crowded; trend signals need smaller sizing or a flush first." : "Crowding is contained; trend signals are more likely driven by spot demand and liquidity.",
    },
    assetClass: "crypto",
    direction: crowdingScore >= 68 ? "risk_off" : "watch",
    confidence: confidenceFromInputs(crowdingScore, evidenceItems.length, contradictions.length),
    score: Math.round(crowdingScore),
    horizon: { zh: "日内 - 6 周", en: "Intraday - 6 weeks" },
    methods,
    dataCategories: ["derivatives", "price"],
    evidence: evidenceItems,
    contradictions,
    sourceCoverage: compactCoverage([funding, oiChange, oiZ, basis, dvol, returnZ, ls]),
    updatedAt: maxTimestamp([funding, oiChange, oiZ, basis, dvol, returnZ, ls].filter((item): item is OpportunityInputSeries => Boolean(item))),
    references: referencesFor(methods),
  }
}

function buildCryptoDipOpportunity(series: readonly OpportunityInputSeries[], marketName: string): TradingOpportunity {
  const drawdown = seriesByKey(series, "btcDrawdown")
  const buyScore = seriesByKey(series, "signalBuyScore")
  const lowerWick = seriesByKey(series, "lowerWick")
  const fng = seriesByKey(series, "fng")
  const realizedVol = seriesByKey(series, "btcRealizedVol30d")
  const miningCost = seriesByKey(series, "miningComprehensiveCost")
  const price = seriesByKey(series, "btcPrice")
  const drawdownStats = getStats(drawdown)
  const buyStats = getStats(buyScore)
  const wickStats = getStats(lowerWick)
  const fngStats = getStats(fng)
  const volStats = getStats(realizedVol)
  const miningStats = getStats(miningCost)
  const priceStats = getStats(price)
  const miningGap =
    priceStats.latest !== null && miningStats.latest !== null && miningStats.latest !== 0
      ? (priceStats.latest / miningStats.latest - 1) * 100
      : null
  const score = averageScores([
    scoreInverse(drawdownStats.latest, -58, -5),
    scoreFromCenteredPct(buyStats.latest, 25, 85),
    scoreFromCenteredPct(wickStats.latest, 15, 65),
    scoreInverse(fngStats.latest, 12, 65),
    scoreFromCenteredPct(volStats.percentile, 0.45, 0.92),
    scoreInverse(miningGap, -15, 80),
  ])
  const evidenceItems = [
    evidence({ zh: "回撤", en: "Drawdown" }, formatSignedPct(drawdownStats.latest), (drawdownStats.latest ?? 0) < -20 ? "positive" : "neutral"),
    evidence({ zh: "买入观察分", en: "Buy-watch score" }, buyStats.latest === null ? "n/a" : formatScore(buyStats.latest), (buyStats.latest ?? 0) >= 60 ? "positive" : "neutral"),
    evidence({ zh: "下影线", en: "Lower wick" }, formatSignedPct(wickStats.latest), (wickStats.latest ?? 0) >= 40 ? "positive" : "neutral"),
    evidence({ zh: "恐慌贪婪", en: "Fear-greed" }, fngStats.latest === null ? "n/a" : fngStats.latest.toFixed(0), (fngStats.latest ?? 100) <= 25 ? "positive" : "warning"),
  ]
  const contradictions = [
    ...(miningGap !== null && miningGap > 70
      ? [evidence({ zh: "仍高于矿工成本", en: "Still above miner cost" }, formatSignedPct(miningGap), "warning")]
      : []),
  ]
  const methods: SignalMethodId[] = ["value", "sentiment", "volatility", "liquidity"]
  return {
    id: "crypto-capitulation-dip",
    title: { zh: `${marketName} 恐慌反转候选`, en: `${marketName} Capitulation Reversal Candidate` },
    thesis: {
      zh: score >= 62 ? "恐慌、回撤和插针条件开始聚合，适合进入观察和分批验证框架。" : "反转条件还不完整，暂时更像普通波动而非高质量恐慌机会。",
      en: score >= 62 ? "Panic, drawdown, and wick conditions are clustering; suitable for watchlist and staged confirmation." : "Reversal conditions are incomplete; this still looks like ordinary volatility rather than a high-quality panic setup.",
    },
    assetClass: "crypto",
    direction: score >= 62 ? "long" : "watch",
    confidence: confidenceFromInputs(score, evidenceItems.length, contradictions.length),
    score: Math.round(score),
    horizon: { zh: "1 天 - 6 周", en: "1 day - 6 weeks" },
    methods,
    dataCategories: ["price", "crypto_native", "text_sentiment"],
    evidence: evidenceItems,
    contradictions,
    sourceCoverage: compactCoverage([drawdown, buyScore, lowerWick, fng, realizedVol, miningCost, price]),
    updatedAt: maxTimestamp([drawdown, buyScore, lowerWick, fng, realizedVol, miningCost, price].filter((item): item is OpportunityInputSeries => Boolean(item))),
    references: referencesFor(methods),
  }
}

function buildStockBreadthOpportunity(series: readonly OpportunityInputSeries[]): TradingOpportunity {
  const spy = seriesBySymbol(series, ["stock:spy", "s&p", "gspc", "es=f"])
  const qqq = seriesBySymbol(series, ["stock:qqq", "nasdaq", "nq=f", "ndx"])
  const mtum = seriesBySymbol(series, ["mtum"])
  const rsp = seriesBySymbol(series, ["rsp", "equal weight"])
  const iwm = seriesBySymbol(series, ["iwm", "russell", "rut"])
  const vix = seriesBySymbol(series, ["vix"])
  const spyStats = getStats(spy)
  const qqqStats = getStats(qqq)
  const mtumStats = getStats(mtum)
  const rspStats = getStats(rsp)
  const iwmStats = getStats(iwm)
  const vixStats = getStats(vix)
  const score = averageScores([
    scoreFromCenteredPct(spyStats.return30Pct, -6, 8),
    scoreFromCenteredPct(qqqStats.return30Pct, -8, 10),
    scoreFromCenteredPct(mtumStats.return30Pct, -5, 8),
    scoreFromCenteredPct(rspStats.return30Pct, -5, 7),
    scoreFromCenteredPct(iwmStats.return30Pct, -7, 9),
    scoreInverse(vixStats.return30Pct, -20, 35),
  ])
  const evidenceItems = [
    evidence({ zh: "大盘趋势", en: "Broad index trend" }, formatSignedPct(spyStats.return30Pct), (spyStats.return30Pct ?? 0) >= 0 ? "positive" : "negative"),
    evidence({ zh: "成长动量", en: "Growth momentum" }, formatSignedPct(qqqStats.return30Pct), (qqqStats.return30Pct ?? 0) >= 0 ? "positive" : "negative"),
    evidence({ zh: "Momentum 因子", en: "Momentum factor" }, formatSignedPct(mtumStats.return30Pct), (mtumStats.return30Pct ?? 0) >= 0 ? "positive" : "neutral"),
    evidence({ zh: "广度 / 小盘", en: "Breadth / small cap" }, formatSignedPct(averageScores([(rspStats.return30Pct ?? 0) + 50, (iwmStats.return30Pct ?? 0) + 50]) - 50), "neutral"),
  ]
  const contradictions = [
    ...(vixStats.return30Pct !== null && vixStats.return30Pct > 25
      ? [evidence({ zh: "VIX 快速上行", en: "VIX rising fast" }, formatSignedPct(vixStats.return30Pct), "warning")]
      : []),
  ]
  const methods: SignalMethodId[] = ["trend", "momentum", "quality", "volatility"]
  return {
    id: "stock-factor-breadth",
    title: { zh: "股票因子动量与广度", en: "Equity Factor Momentum & Breadth" },
    thesis: {
      zh: score >= 60 ? "指数、动量和广度更像健康 risk-on，可优先关注趋势延续。" : "指数上涨若缺少广度或动量确认，机会质量下降。",
      en: score >= 60 ? "Index, momentum, and breadth look like healthier risk-on; trend continuation gets priority." : "If index strength lacks breadth or momentum confirmation, opportunity quality is lower.",
    },
    assetClass: "stock",
    direction: directionFromScore(score),
    confidence: confidenceFromInputs(score, evidenceItems.length, contradictions.length),
    score: Math.round(score),
    horizon: { zh: "2 周 - 6 月", en: "2 weeks - 6 months" },
    methods,
    dataCategories: ["price", "macro"],
    evidence: evidenceItems,
    contradictions,
    sourceCoverage: compactCoverage([spy, qqq, mtum, rsp, iwm, vix]),
    updatedAt: maxTimestamp([spy, qqq, mtum, rsp, iwm, vix].filter((item): item is OpportunityInputSeries => Boolean(item))),
    references: referencesFor(methods),
  }
}

function buildStockDefensiveOpportunity(series: readonly OpportunityInputSeries[]): TradingOpportunity {
  const usmv = seriesBySymbol(series, ["usmv", "minimum volatility"])
  const splv = seriesBySymbol(series, ["splv", "low volatility"])
  const qual = seriesBySymbol(series, ["qual", "quality"])
  const hyg = seriesBySymbol(series, ["hyg"])
  const lqd = seriesBySymbol(series, ["lqd"])
  const credit = seriesBySymbol(series, ["bamlh0a0hym2", "high yield"])
  const dxy = seriesBySymbol(series, ["dxy", "dx-y"])
  const usmvStats = getStats(usmv)
  const splvStats = getStats(splv)
  const qualStats = getStats(qual)
  const hygStats = getStats(hyg)
  const lqdStats = getStats(lqd)
  const creditStats = getStats(credit)
  const dxyStats = getStats(dxy)
  const defensiveLeadership = averageScores([
    scoreFromCenteredPct(usmvStats.return30Pct, -3, 6),
    scoreFromCenteredPct(splvStats.return30Pct, -3, 6),
    scoreFromCenteredPct(qualStats.return30Pct, -4, 7),
  ])
  const stressScore = averageScores([
    scoreInverse(hygStats.return30Pct, -6, 4),
    scoreInverse(lqdStats.return30Pct, -5, 4),
    scoreFromCenteredPct(creditStats.return30Pct ?? creditStats.latest, -8, 18),
    scoreFromCenteredPct(dxyStats.return30Pct, -2, 4),
  ])
  const score = averageScores([defensiveLeadership, stressScore])
  const evidenceItems = [
    evidence({ zh: "低波因子", en: "Low-vol factor" }, formatSignedPct(usmvStats.return30Pct ?? splvStats.return30Pct), defensiveLeadership > 58 ? "positive" : "neutral"),
    evidence({ zh: "质量因子", en: "Quality factor" }, formatSignedPct(qualStats.return30Pct), (qualStats.return30Pct ?? 0) >= 0 ? "positive" : "neutral"),
    evidence({ zh: "信用风险", en: "Credit risk" }, formatSignedPct(creditStats.return30Pct ?? creditStats.latest), stressScore > 60 ? "warning" : "neutral"),
    evidence({ zh: "美元压力", en: "Dollar pressure" }, formatSignedPct(dxyStats.return30Pct), (dxyStats.return30Pct ?? 0) > 2 ? "warning" : "neutral"),
  ]
  const contradictions = [
    ...(hygStats.return30Pct !== null && hygStats.return30Pct > 2
      ? [evidence({ zh: "高收益债仍强", en: "High yield still firm" }, formatSignedPct(hygStats.return30Pct), "positive")]
      : []),
  ]
  const methods: SignalMethodId[] = ["quality", "volatility", "macro_regime"]
  return {
    id: "stock-defensive-rotation",
    title: { zh: "股票防御轮动 / 信用压力", en: "Defensive Rotation / Credit Stress" },
    thesis: {
      zh: score >= 62 ? "低波、质量和信用压力提示风险预算收缩，仓位应偏防御或降低 beta。" : "防御轮动证据一般，股票风险预算尚未明显收缩。",
      en: score >= 62 ? "Low-vol, quality, and credit stress suggest tighter risk budgets; prefer defensive exposure or lower beta." : "Defensive-rotation evidence is moderate; equity risk budgets are not clearly contracting.",
    },
    assetClass: "stock",
    direction: score >= 62 ? "risk_off" : "watch",
    confidence: confidenceFromInputs(score, evidenceItems.length, contradictions.length),
    score: Math.round(score),
    horizon: { zh: "1 月 - 12 月", en: "1 month - 12 months" },
    methods,
    dataCategories: ["price", "macro", "equity_fundamental"],
    evidence: evidenceItems,
    contradictions,
    sourceCoverage: compactCoverage([usmv, splv, qual, hyg, lqd, credit, dxy]),
    updatedAt: maxTimestamp([usmv, splv, qual, hyg, lqd, credit, dxy].filter((item): item is OpportunityInputSeries => Boolean(item))),
    references: referencesFor(methods),
  }
}

function buildMacroLiquidityOpportunity(series: readonly OpportunityInputSeries[]): TradingOpportunity {
  const dff = seriesBySymbol(series, ["dff", "fed funds"])
  const dgs2 = seriesBySymbol(series, ["dgs2", "2y"])
  const dgs10 = seriesBySymbol(series, ["dgs10", "10y"])
  const m2 = seriesBySymbol(series, ["m2sl", "m2"])
  const dxy = seriesBySymbol(series, ["dxy", "dx-y"])
  const vix = seriesBySymbol(series, ["vix"])
  const credit = seriesBySymbol(series, ["bamlh0a0hym2", "credit"])
  const dffStats = getStats(dff)
  const dgs2Stats = getStats(dgs2)
  const dgs10Stats = getStats(dgs10)
  const m2Stats = getStats(m2)
  const dxyStats = getStats(dxy)
  const vixStats = getStats(vix)
  const creditStats = getStats(credit)
  const ratePressure = averageScores([
    scoreInverse(dffStats.return90Pct ?? dffStats.return30Pct, -5, 20),
    scoreInverse(dgs2Stats.return30Pct, -10, 20),
    scoreInverse(dgs10Stats.return30Pct, -10, 18),
  ])
  const liquidity = averageScores([
    scoreFromCenteredPct(m2Stats.return90Pct ?? m2Stats.return30Pct, -2, 4),
    scoreInverse(dxyStats.return30Pct, -3, 4),
    scoreInverse(vixStats.return30Pct, -20, 35),
    scoreInverse(creditStats.return30Pct ?? creditStats.latest, -5, 16),
  ])
  const score = averageScores([ratePressure, liquidity])
  const evidenceItems = [
    evidence({ zh: "利率压力缓和", en: "Rate pressure easing" }, formatScore(ratePressure), ratePressure >= 55 ? "positive" : "negative"),
    evidence({ zh: "M2 / 流动性", en: "M2 / liquidity" }, formatSignedPct(m2Stats.return90Pct ?? m2Stats.return30Pct), (m2Stats.return90Pct ?? m2Stats.return30Pct ?? 0) >= 0 ? "positive" : "neutral"),
    evidence({ zh: "美元", en: "USD" }, formatSignedPct(dxyStats.return30Pct), (dxyStats.return30Pct ?? 0) <= 0 ? "positive" : "warning"),
    evidence({ zh: "信用 / 波动率", en: "Credit / volatility" }, formatScore(100 - averageScores([scoreFromCenteredPct(creditStats.return30Pct ?? creditStats.latest, -5, 16), scoreFromCenteredPct(vixStats.return30Pct, -20, 35)])), score >= 55 ? "positive" : "warning"),
  ]
  const contradictions = [
    ...(dgs2Stats.return30Pct !== null && dgs2Stats.return30Pct > 10
      ? [evidence({ zh: "短端利率上行", en: "Front-end yields rising" }, formatSignedPct(dgs2Stats.return30Pct), "warning")]
      : []),
  ]
  const methods: SignalMethodId[] = ["macro_regime", "liquidity", "volatility"]
  return {
    id: "macro-liquidity-regime",
    title: { zh: "宏观流动性 Regime", en: "Macro Liquidity Regime" },
    thesis: {
      zh: score >= 60 ? "利率、美元、波动率和流动性组合对风险资产偏顺风。" : "宏观组合仍偏逆风，风险资产机会需要更强的价格确认。",
      en: score >= 60 ? "Rates, USD, volatility, and liquidity are a tailwind for risk assets." : "The macro mix remains a headwind; risk-asset setups need stronger price confirmation.",
    },
    assetClass: "macro",
    direction: directionFromScore(score),
    confidence: confidenceFromInputs(score, evidenceItems.length, contradictions.length),
    score: Math.round(score),
    horizon: { zh: "1 月 - 12 月", en: "1 month - 12 months" },
    methods,
    dataCategories: ["macro"],
    evidence: evidenceItems,
    contradictions,
    sourceCoverage: compactCoverage([dff, dgs2, dgs10, m2, dxy, vix, credit]),
    updatedAt: maxTimestamp([dff, dgs2, dgs10, m2, dxy, vix, credit].filter((item): item is OpportunityInputSeries => Boolean(item))),
    references: referencesFor(methods),
  }
}

function buildMacroGrowthInflationOpportunity(series: readonly OpportunityInputSeries[]): TradingOpportunity {
  const cpi = seriesBySymbol(series, ["cpiaucsl", "cpi"])
  const coreCpi = seriesBySymbol(series, ["cpilfesl", "core cpi"])
  const ppi = seriesBySymbol(series, ["ppiaco", "ppi"])
  const unemployment = seriesBySymbol(series, ["unrate", "unemployment"])
  const claims = seriesBySymbol(series, ["icsa", "claims"])
  const oil = seriesBySymbol(series, ["oil", "cl=f", "wti"])
  const copper = seriesBySymbol(series, ["copper", "hg=f"])
  const cpiStats = getStats(cpi)
  const coreStats = getStats(coreCpi)
  const ppiStats = getStats(ppi)
  const unemploymentStats = getStats(unemployment)
  const claimsStats = getStats(claims)
  const oilStats = getStats(oil)
  const copperStats = getStats(copper)
  const inflationPressure = averageScores([
    scoreFromCenteredPct(cpiStats.return180Pct ?? cpiStats.return90Pct, 0, 4),
    scoreFromCenteredPct(coreStats.return180Pct ?? coreStats.return90Pct, 0, 4),
    scoreFromCenteredPct(ppiStats.return90Pct, -2, 5),
    scoreFromCenteredPct(oilStats.return30Pct, -8, 16),
  ])
  const growthPressure = averageScores([
    scoreInverse(copperStats.return90Pct ?? copperStats.return30Pct, -12, 16),
    scoreFromCenteredPct(unemploymentStats.return90Pct ?? unemploymentStats.return30Pct, -3, 8),
    scoreFromCenteredPct(claimsStats.return90Pct ?? claimsStats.return30Pct, -10, 35),
  ])
  const score = averageScores([inflationPressure, growthPressure])
  const evidenceItems = [
    evidence({ zh: "通胀压力", en: "Inflation pressure" }, formatScore(inflationPressure), inflationPressure > 60 ? "warning" : "neutral"),
    evidence({ zh: "油价脉冲", en: "Oil impulse" }, formatSignedPct(oilStats.return30Pct), (oilStats.return30Pct ?? 0) > 10 ? "warning" : "neutral"),
    evidence({ zh: "就业压力", en: "Labor pressure" }, formatScore(growthPressure), growthPressure > 60 ? "warning" : "neutral"),
    evidence({ zh: "铜周期", en: "Copper cycle" }, formatSignedPct(copperStats.return90Pct ?? copperStats.return30Pct), (copperStats.return90Pct ?? copperStats.return30Pct ?? 0) >= 0 ? "positive" : "warning"),
  ]
  const contradictions = [
    ...(inflationPressure > 65 && growthPressure < 45
      ? [evidence({ zh: "滞胀式分化", en: "Stagflation split" }, `${Math.round(inflationPressure)} / ${Math.round(growthPressure)}`, "warning")]
      : []),
  ]
  const methods: SignalMethodId[] = ["macro_regime", "fundamental_surprise", "event_risk"]
  return {
    id: "macro-growth-inflation",
    title: { zh: "增长 / 通胀冲击", en: "Growth / Inflation Shock" },
    thesis: {
      zh: score >= 62 ? "通胀或就业压力升温，风险资产需要警惕利率重新定价。" : "增长与通胀压力相对温和，宏观冲击不是当前主导矛盾。",
      en: score >= 62 ? "Inflation or labor pressure is rising; risk assets should watch rate repricing." : "Growth and inflation pressure is moderate; macro shock is not the dominant issue now.",
    },
    assetClass: "macro",
    direction: score >= 62 ? "risk_off" : "watch",
    confidence: confidenceFromInputs(score, evidenceItems.length, contradictions.length),
    score: Math.round(score),
    horizon: { zh: "1 月 - 9 月", en: "1 month - 9 months" },
    methods,
    dataCategories: ["macro", "futures_fundamental"],
    evidence: evidenceItems,
    contradictions,
    sourceCoverage: compactCoverage([cpi, coreCpi, ppi, unemployment, claims, oil, copper]),
    updatedAt: maxTimestamp([cpi, coreCpi, ppi, unemployment, claims, oil, copper].filter((item): item is OpportunityInputSeries => Boolean(item))),
    references: referencesFor(methods),
  }
}

export function buildTradingOpportunities({
  assetClass,
  marketName,
  series,
  maxItems = 3,
}: {
  assetClass: OpportunityAssetClass
  marketName: string
  series: readonly OpportunityInputSeries[]
  maxItems?: number
}): TradingOpportunity[] {
  if (series.length === 0) return []

  const opportunities =
    assetClass === "crypto"
      ? [
          buildCryptoTrendOpportunity(series, marketName),
          buildCryptoCrowdingOpportunity(series, marketName),
          buildCryptoDipOpportunity(series, marketName),
        ]
      : assetClass === "stock"
        ? [buildStockBreadthOpportunity(series), buildStockDefensiveOpportunity(series)]
        : [buildMacroLiquidityOpportunity(series), buildMacroGrowthInflationOpportunity(series)]

  return opportunities
    .map((opportunity) => ({ ...opportunity, score: clamp(opportunity.score, 0, 100) }))
    .sort((left, right) => {
      const leftPriority = left.direction === "risk_off" ? Math.max(left.score, 100 - left.score) : left.score
      const rightPriority = right.direction === "risk_off" ? Math.max(right.score, 100 - right.score) : right.score
      return rightPriority - leftPriority
    })
    .slice(0, maxItems)
}

export function getMethodDefinition(method: SignalMethodId): SignalMethodDefinition | undefined {
  return METHOD_BY_ID.get(method)
}

export function getDataCategoriesForAssetClass(assetClass: OpportunityAssetClass): DataCategoryDefinition[] {
  const categoryIds: readonly DataCategoryId[] =
    assetClass === "crypto"
      ? ["price", "derivatives", "macro", "crypto_native", "text_sentiment"]
      : assetClass === "stock"
        ? ["price", "macro", "equity_fundamental", "text_sentiment"]
        : ["macro", "futures_fundamental", "price", "text_sentiment"]
  return categoryIds
    .map((id) => DATA_CATEGORY_CATALOG.find((category) => category.id === id))
    .filter((category): category is DataCategoryDefinition => Boolean(category))
}

export function getValidationChecklist(): readonly LocalizedText[] {
  return [
    {
      zh: "每个信号必须记录数据源、更新时间、lookback、换仓频率和适用市场。",
      en: "Every signal must record source, freshness, lookback, rebalance frequency, and applicable market.",
    },
    {
      zh: "回测必须避免未来函数，使用 walk-forward / out-of-sample 验证并显式扣除交易成本。",
      en: "Backtests must avoid lookahead, use walk-forward / out-of-sample validation, and include transaction costs.",
    },
    {
      zh: "新增因子默认标记为 experimental，只有跨周期稳定后才进入 research-backed。",
      en: "New factors start as experimental and graduate to research-backed only after stable cross-regime evidence.",
    },
    {
      zh: "同方向信号必须展示反证项，例如美元走强、信用恶化、仓位拥挤或数据过期。",
      en: "Directional signals must show contradictions such as USD strength, credit stress, crowding, or stale data.",
    },
  ] as const
}
