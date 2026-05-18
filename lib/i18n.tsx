"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

export type Locale = "zh" | "en"

const STORAGE_KEY = "eatfear.locale"
const DEFAULT_LOCALE: Locale = "zh"

type Dict = Record<string, { zh: string; en: string }>

const DICT: Dict = {
  // Site header
  "nav.home": { zh: "首页", en: "Home" },
  "nav.crypto": { zh: "加密", en: "Crypto" },
  "nav.stock": { zh: "股票", en: "Stock" },
  "nav.macro": { zh: "宏观", en: "Macro" },
  "nav.news": { zh: "资讯", en: "News" },
  "lang.toggle": { zh: "切换语言", en: "Switch language" },

  // Crypto dashboard chrome
  "crypto.title": { zh: "加密看板", en: "Crypto Dashboard" },
  "crypto.subtitle": {
    zh: "现货 + 永续衍生品（{source}）。右侧为宏观多因子评分；数据源与时间周期在中间切换。",
    en: "Spot + perpetuals ({source}). Right: macro multi-factor score. Switch data source / range in the middle.",
  },
  "crypto.tab.volatility": { zh: "极端波动监控", en: "Volatility Watch" },
  "crypto.tab.markets": { zh: "现货行情", en: "Spot Markets" },
  "crypto.tab.compare": { zh: "历史对比", en: "History Compare" },
  "crypto.markets.heading": { zh: "Top 加密资产（现货）", en: "Top Cryptocurrencies (Spot)" },
  "crypto.markets.loading": { zh: "正在加载现货行情快照…", en: "Loading spot market snapshot…" },
  "crypto.markets.empty": { zh: "暂无现货行情数据。", en: "No crypto market data available." },

  // Watchlist
  "watchlist.heading": { zh: "核心指标清单（30）", en: "Core Watchlist (30)" },
  "watchlist.subtitle": {
    zh: "衍生品、链上、情绪与宏观监视项。右上角 i 查看定义、用途及与 BTC 价格关系的解读。未接 API 的条目保留为投研检查表。",
    en: "Derivatives, on-chain, sentiment & macro watchlist. Hover the (i) icons for definitions, use cases and BTC-price relationships. Items without an API stay as a research checklist.",
  },
  "watchlist.badge.dashboard": { zh: "本页已接入", en: "Wired" },
  "watchlist.badge.partial": { zh: "部分覆盖", en: "Partial" },
  "watchlist.badge.pending": { zh: "待数据源", en: "Pending" },
  "watchlist.cta.macro": { zh: "在宏观页查看 DXY / 美债 / 利率", en: "Open Macro page for DXY / UST / rates" },

  // Regime score card
  "regime.label": { zh: "BTC 多时框架", en: "BTC Multi-TF Score" },
  "regime.aria.loading": { zh: "BTC 多时框架指数载入中", en: "BTC multi-timeframe score loading" },
  "regime.aria.error": {
    zh: "BTC 多时框架指数不可用，悬停旁侧信息图标查看原因",
    en: "BTC multi-timeframe score unavailable. Hover the info icon for details.",
  },
  "regime.aria.value": { zh: "BTC 多时框架指数 {value}", en: "BTC multi-timeframe score {value}" },
  "regime.aria.idle": { zh: "BTC 多时框架指数", en: "BTC multi-timeframe score" },
  "regime.hover.aria": {
    zh: "悬停或聚焦查看：更新时间、加权分与评分模型说明",
    en: "Hover or focus for update time, weighted score, and model notes",
  },
  "regime.hover.refreshHint": { zh: "每 60 秒自动刷新", en: "Auto-refresh every 60s" },
  "regime.hover.loading": { zh: "载入中…", en: "Loading…" },
  "regime.hover.scoreSuffix": { zh: " / 100", en: " / 100" },
  "regime.hover.weighted": { zh: "加权原始分 {value}", en: "Weighted raw score {value}" },
  "regime.hover.modelTitle": { zh: "评分模型说明", en: "Scoring model notes" },
  "regime.hover.sources": {
    zh: "数据源：OKX / DefiLlama / CoinGlass / Blockchain.info / mempool.space · CoinGecko · Deribit",
    en: "Sources: OKX / DefiLlama / CoinGlass / Blockchain.info / mempool.space · CoinGecko · Deribit",
  },
  "regime.hover.factorsTitle": { zh: "分项实时值与权重", en: "Live factor values & weights" },
  "regime.hover.factorScore": { zh: "分 {score} · 权重 {weight}% · 加权 {weighted}", en: "Score {score} · weight {weight}% · weighted {weighted}" },
  "regime.hover.penalties": { zh: "扣分项", en: "Penalties" },
  "regime.hover.boosts": { zh: "加分项", en: "Boosts" },
  "regime.factor.capitalFlows": { zh: "资金流", en: "Capital Flows" },
  "regime.factor.leverage": { zh: "杠杆情绪", en: "Leverage / Sentiment" },
  "regime.factor.onchainCycle": { zh: "链上周期", en: "On-chain Cycle" },
  "regime.factor.marketStructure": { zh: "市场结构", en: "Market Structure" },
  "regime.factor.options": { zh: "期权风险", en: "Options Risk" },

  // Fear & Greed score card
  "fng.label": { zh: "恐慌贪婪指数", en: "Fear & Greed" },
  "fng.hover.aria": {
    zh: "悬停或聚焦查看：更新时间与算法说明",
    en: "Hover or focus for update time and model notes",
  },
  "fng.hover.refreshHint": { zh: "alternative.me 约每日刷新", en: "alternative.me refreshes ~daily" },
  "fng.hover.modelTitle": { zh: "评分模型说明", en: "Scoring model notes" },
  "fng.hover.sources": { zh: "数据源：alternative.me", en: "Source: alternative.me" },
  "fng.aria.value": { zh: "恐慌贪婪指数 {value}", en: "Fear & Greed index {value}" },
  "fng.aria.idle": { zh: "恐慌贪婪指数", en: "Fear & Greed index" },
  "fng.band.extremeFear": { zh: "极度恐慌", en: "Extreme Fear" },
  "fng.band.fear": { zh: "恐慌", en: "Fear" },
  "fng.band.neutral": { zh: "中性", en: "Neutral" },
  "fng.band.greed": { zh: "贪婪", en: "Greed" },
  "fng.band.extremeGreed": { zh: "极度贪婪", en: "Extreme Greed" },

  // KPI labels
  "kpi.btc": { zh: "BTC 现货", en: "BTC Spot" },
  "kpi.eth": { zh: "ETH 现货", en: "ETH Spot" },
  "kpi.ethBtc": { zh: "ETH/BTC 强弱", en: "ETH/BTC Strength" },
  "kpi.ethBtc.helper": { zh: "ETH 相对 BTC", en: "ETH relative to BTC" },
  "kpi.sol": { zh: "SOL 现货", en: "SOL Spot" },
  "kpi.mcap": { zh: "总市值", en: "Total Market Cap" },
  "kpi.btcd": { zh: "BTC 占比", en: "BTC Dominance" },
  "kpi.vol": { zh: "24h 成交额", en: "24h Volume" },
  "kpi.fgi": { zh: "恐慌贪婪", en: "Fear & Greed" },

  // Stock dashboard
  "stock.title": { zh: "股票看板", en: "Stock Dashboard" },
  "stock.subtitle": {
    zh: "美股、港股和越南概念股公开行情；顶部优先展示股指期货、波动率、利率、信用、美元和商品等量化交易核心因子。",
    en: "US, HK and Vietnam-themed equity quotes; top KPIs prioritize index futures, volatility, rates, credit, dollar and commodity factors for quant trading.",
  },
  "stock.tab.us": { zh: "美股 Top 50", en: "US Top 50" },
  "stock.tab.hk": { zh: "港股 Top 20", en: "HK Top 20" },
  "stock.tab.vietnam": { zh: "越南概念股", en: "Vietnam-themed" },
  "stock.us.desc": {
    zh: "包含 S&P 500、NASDAQ 100、Dow Jones ETF 与主流大市值公司。",
    en: "S&P 500, NASDAQ 100 and Dow Jones ETFs plus large-cap leaders.",
  },
  "stock.hk.desc": {
    zh: "覆盖港股核心权重和大型互联网、金融、能源公司。",
    en: "HK core weights plus large-cap internet, finance and energy names.",
  },
  "stock.vietnam.desc": {
    zh: "包含 VNM ETF 及具备亚洲成长资产暴露的相关股票。",
    en: "VNM ETF plus Asian growth-exposure names.",
  },
  "stock.loading": { zh: "正在加载股票数据…", en: "Loading stock data…" },
  "stock.empty": { zh: "暂无股票数据。", en: "No stock data available." },

  // Macro dashboard
  "macro.title": { zh: "宏观看板", en: "Macro Dashboard" },
  "macro.subtitle": {
    zh: "跨资产金融与宏观指标，优先展示利率、流动性、信用、股指、波动率、外汇和商品，再进入通胀、就业和增长。每条指标右上角提供来源 + 含义解释。",
    en: "Cross-asset financial and macro indicators: rates, liquidity, credit, equity, volatility, FX and commodities first, then inflation, employment and growth. Each tile has a source + interpretation.",
  },
  "macro.tab.realtime": { zh: "实时", en: "Realtime" },
  "macro.tab.history": { zh: "历史曲线", en: "History" },
  "macro.historyCompare.title": { zh: "宏观历史对比 · 统一时间轴", en: "Macro History Compare · Unified time axis" },
  "macro.historyCompare.info": {
    zh: "将所有宏观与金融指标按类型分组绘制在同一套时间轴上。每个面板共享左右时间边界，悬停任意面板会同步到同一天；点击图例可显示 / 隐藏单条曲线，用于对齐查看历史趋势。",
    en: "Groups every macro and financial indicator onto one shared time axis. Panes use the same left/right bounds, hover syncs all panes to the same date, and legend clicks show/hide individual lines for aligned trend review.",
  },
  "macro.indicators": { zh: "{returned}/{requested} 指标", en: "{returned}/{requested} indicators" },
  "macro.loading": { zh: "正在加载宏观指标…", en: "Loading macro indicators…" },
  "macro.updated": { zh: "更新于 {time}", en: "Updated {time}" },

  // Macro group labels
  "macro.group.Rates": { zh: "利率", en: "Rates & Treasury" },
  "macro.group.Inflation": { zh: "通胀", en: "Inflation" },
  "macro.group.Employment": { zh: "就业", en: "Employment" },
  "macro.group.Liquidity": { zh: "流动性", en: "Liquidity & Money" },
  "macro.group.Credit": { zh: "信用利差", en: "Credit Spreads" },
  "macro.group.Equity": { zh: "股指", en: "Equity" },
  "macro.group.Volatility": { zh: "波动率", en: "Volatility" },
  "macro.group.FX": { zh: "外汇", en: "FX" },
  "macro.group.Commodity": { zh: "商品", en: "Commodities & Ag" },
  "macro.group.Growth": { zh: "增长", en: "Growth & Activity" },
  "macro.group.RealEstate": { zh: "房地产", en: "Real Estate" },
  "macro.group.Crypto": { zh: "加密", en: "Crypto" },
  "macro.group.OnChain": { zh: "链上", en: "On-chain" },
  "macro.group.Sentiment": { zh: "情绪", en: "Sentiment" },
  "macro.group.CrossAsset": { zh: "跨资产", en: "Cross-Asset" },

  // Macro FRED hint
  "macro.fredHint.title": { zh: "FRED 数据未启用", en: "FRED data not enabled" },
  "macro.fredHint.body": {
    zh: "美联储利率 / 通胀 / 就业 / 流动性 / 信用 等约 30 项指标需要 FRED 免费 API key。前往 fred.stlouisfed.org 注册后在 .env.local 添加 FRED_API_KEY=YOUR_KEY，重启服务即可生效。",
    en: "About 30 indicators (Fed rates, inflation, employment, liquidity, credit, etc.) need a free FRED API key. Sign up at fred.stlouisfed.org, then add FRED_API_KEY=YOUR_KEY to .env.local and restart the service.",
  },

  // Series chart
  "chart.noData": { zh: "无数据", en: "No data" },

  // Data source selector
  "dataSource.title": { zh: "数据源", en: "Data Source" },
  "dataSource.tier.basic": { zh: "基础", en: "Basic" },
  "dataSource.tier.full": { zh: "完整", en: "Full" },
  "dataSource.okx.desc": {
    zh: "完整衍生品数据，订单簿深度，无需 API Key",
    en: "Full derivatives + book depth, no API key required",
  },
  "dataSource.binance.desc": {
    zh: "全球最大交易所，完整期货数据，无需 API Key",
    en: "World's largest exchange, full futures data, no API key required",
  },
  "dataSource.coingecko.desc": {
    zh: "聚合市场数据（仅价格/市值），无衍生品数据",
    en: "Aggregated market data (price/market cap only), no derivatives",
  },
  "dataSource.feature.kline": { zh: "K线", en: "Klines" },
  "dataSource.feature.book": { zh: "订单簿", en: "Order Book" },
  "dataSource.feature.funding": { zh: "Funding", en: "Funding" },
  "dataSource.feature.oi": { zh: "OI", en: "OI" },
  "dataSource.feature.longshort": { zh: "多空比", en: "Long/Short" },
  "dataSource.feature.cvd": { zh: "CVD", en: "CVD" },
  "dataSource.feature.toptraders": { zh: "大户仓位", en: "Top Traders" },
  "dataSource.feature.taker": { zh: "Taker Volume", en: "Taker Volume" },
  "dataSource.feature.price": { zh: "价格", en: "Price" },
  "dataSource.feature.mcap": { zh: "市值", en: "Market Cap" },
  "dataSource.feature.volume": { zh: "成交量", en: "Volume" },
  "dataSource.feature.ath": { zh: "ATH/ATL", en: "ATH/ATL" },

  // Symbol selector hint
  "symbol.perpHint": { zh: "{base} 永续合约 · {source}", en: "{base} Perpetual · {source}" },

  // Crypto KPI info text
  "kpi.btc.info": { zh: "Bitcoin 现货报价（OKX）。加密市场总市值的核心锚。", en: "Bitcoin spot price (OKX). Anchor for total crypto market cap." },
  "kpi.eth.info": { zh: "Ethereum 现货。DeFi/L2 生态主导链。", en: "Ethereum spot. Leading DeFi / L2 chain." },
  "kpi.ethBtc.info": {
    zh: "ETH/BTC 衡量 ETH 相对 BTC 的风险偏好。上行通常表示资金愿意承担更高 Beta；下行表示资金回到 BTC 或现金。",
    en: "ETH/BTC measures ETH risk appetite versus BTC. Rising usually means capital is accepting higher beta; falling means rotation back to BTC or cash.",
  },
  "kpi.sol.info": {
    zh: "Solana 现货。高吞吐公链，风险偏好高时与 BTC 同向波动常放大。",
    en: "Solana spot. High-throughput chain; tends to amplify BTC moves in risk-on regimes.",
  },
  "kpi.mcap.info": { zh: "全部加密货币 24h 总市值。", en: "Total 24h crypto market cap." },
  "kpi.btcd.helper": { zh: "BTC 占总市值", en: "Share of total market cap" },
  "kpi.btcd.info": {
    zh: "BTC 市值 / 加密总市值。下降 = 山寨季；上升 = 资金回归 BTC。",
    en: "BTC market cap / total crypto cap. Falling = altseason; rising = rotation back to BTC.",
  },
  "kpi.vol.helper": { zh: "全市场成交额", en: "Total market volume" },
  "kpi.vol.info": {
    zh: "全市场 24h 成交总额。用途：衡量换手与投机热度。\n与 BTC：放量上涨/下跌通常强化趋势可信度；缩量盘整则等待方向选择。",
    en: "Total 24h crypto volume. Use: gauges turnover and speculative heat.\nvs BTC: high-volume moves reinforce trend confidence; thin chop waits for direction.",
  },
  "kpi.fgi.info": {
    zh: "Alternative.me 综合波动率、动量、社交、调查等多维度的恐慌贪婪指数（0-100）。\n< 25 极度恐慌；> 75 极度贪婪。",
    en: "Alternative.me Crypto Fear & Greed Index (0–100): volatility, momentum, social, surveys, etc.\n< 25 Extreme Fear · > 75 Extreme Greed.",
  },

  // News page
  "news.title": { zh: "市场资讯", en: "Market News" },
  "news.subtitle": {
    zh: "聚合公开 RSS：Yahoo Finance、CNBC、MarketWatch、Investing、Fed、CoinDesk、Cointelegraph、Decrypt、CryptoSlate。",
    en: "Aggregated public RSS: Yahoo Finance, CNBC, MarketWatch, Investing, Fed, CoinDesk, Cointelegraph, Decrypt, CryptoSlate.",
  },
  "news.updated": { zh: "更新于 {time}", en: "Updated {time}" },
  "news.loading": { zh: "正在加载资讯…", en: "Loading market news…" },
  "news.empty": { zh: "暂无资讯。", en: "No market news available." },
  "news.feedSummary": { zh: "资讯摘要", en: "Feed Summary" },
  "news.topSources": { zh: "主要来源", en: "Top Sources" },
  "news.row.source": { zh: "来源", en: "Source" },
  "news.row.articles": { zh: "条数", en: "Articles" },
  "news.row.crypto": { zh: "加密资讯", en: "Crypto News" },
  "news.row.refresh": { zh: "刷新", en: "Refresh" },
  "news.toneTitle": { zh: "Tone 含义", en: "About Tone" },
  "news.toneDesc": {
    zh: "Tone 估值（如有）：> 2 偏 Risk-on；< -2 偏 Risk-off；其余 Neutral。\n本页聚合 Yahoo Finance、CNBC、MarketWatch、Investing、Fed、CoinDesk、Cointelegraph、Decrypt、CryptoSlate 等公开 RSS 源。",
    en: "Tone score (when available): > 2 = Risk-on; < -2 = Risk-off; otherwise Neutral.\nThis page aggregates Yahoo Finance, CNBC, MarketWatch, Investing, Fed, CoinDesk, Cointelegraph, Decrypt, CryptoSlate, etc.",
  },
  "news.noSourceData": { zh: "暂无来源数据。", en: "No source data yet." },
  "news.tone.riskOn": { zh: "Risk-on", en: "Risk-on" },
  "news.tone.riskOff": { zh: "Risk-off", en: "Risk-off" },
  "news.tone.neutral": { zh: "中性", en: "Neutral" },

  // API key warnings
  "apiKey.invalid.title": { zh: "{source} API Key 无效", en: "{source} API key invalid" },
  "apiKey.invalid.msg": {
    zh: "API Key 已过期或无效，请检查并更新。",
    en: "API key expired or invalid — please check and update.",
  },
  "apiKey.rateLimited.title": { zh: "{source} 请求频率受限", en: "{source} rate limited" },
  "apiKey.rateLimited.msg.missing": {
    zh: "已达到免费 API 速率限制。添加 API Key 可获得更高的请求配额。",
    en: "Hit the free-tier rate limit. Add an API key for a higher quota.",
  },
  "apiKey.rateLimited.msg.has": {
    zh: "已达到 API 速率限制，请稍后重试。",
    en: "API rate limit reached, please retry shortly.",
  },
  "apiKey.freeTier.title": { zh: "{source} 使用免费 API", en: "{source} using free API" },
  "apiKey.freeTier.msg": {
    zh: "当前使用免费 API（10-30 次/分钟）。如需更高频率，可添加 API Key。",
    en: "Currently using the free API (10–30 req/min). Add an API key for higher throughput.",
  },
  "apiKey.missing.title": { zh: "{source} API Key 未设置", en: "{source} API key not set" },
  "apiKey.missing.msg": {
    zh: "某些功能可能受限。添加 API Key 可解锁完整功能。",
    en: "Some features may be limited. Add an API key to unlock full functionality.",
  },
  "apiKey.envVar": { zh: "环境变量", en: "environment variable" },
  "apiKey.retry": { zh: "重试", en: "Retry" },
  "apiKey.dismiss": { zh: "关闭", en: "Dismiss" },

  // BTC volatility system
  "vol.title": { zh: "{base} 极端波动监控", en: "{base} Extreme Volatility Watch" },
  "vol.subtitle": {
    zh: "价格 / K 线 / OI 历史 / 资金费率 / 多空比 / 订单簿失衡 全部使用 OKX 公开接口拉取。",
    en: "Price / klines / OI history / funding / long-short / book imbalance — all from public OKX endpoints.",
  },
  "vol.waitKline": { zh: "等待 K 线数据...", en: "Waiting for kline data…" },
  "vol.triggerReasons": { zh: "触发原因", en: "Triggers" },
  "vol.invalidationRules": { zh: "失效条件", en: "Invalidation" },
  "vol.priceTitle": { zh: "{base} 价格 — {label} ({bar})", en: "{base} Price — {label} ({bar})" },
  "vol.priceInfo": {
    zh: "基于 OKX 永续合约 {bar} K 线收盘价。切换右上角时间周期可看到不同颗粒度（默认 1 月 / 1H 线）。",
    en: "Based on OKX perp {bar} kline close. Switch the time range top-right for different granularities (default 1mo / 1H).",
  },
  "vol.candles": { zh: "{n} 根 K 线", en: "{n} candles" },
  "vol.candlesAndVolume": { zh: "实时 K 线与成交量", en: "Realtime klines & volume" },
  "vol.candlesAndVolumeInfo": {
    zh: "左：1 分钟 K 线（信号触发的基础颗粒度）；右：5 分钟 K 线（用于 5m 涨跌 Z-Score 与影线判断）；下：1m 成交量。",
    en: "Left: 1m kline (signal base granularity); Right: 5m kline (used for 5m return Z-score / wick checks); Bottom: 1m volume.",
  },
  "vol.kline.1m": { zh: "1m K 线", en: "1m kline" },
  "vol.kline.5m": { zh: "5m K 线", en: "5m kline" },
  "vol.kline.1m.info": { zh: "高频颗粒度，监控 1 分钟级别的瞬时动量。", en: "High-frequency granularity — watching 1m momentum." },
  "vol.kline.5m.info": { zh: "5 分钟颗粒度，配合插针比例判断暴涨暴跌。", en: "5m granularity, used with wick ratios to spot flash moves." },
  "vol.volumeChart": { zh: "成交量图", en: "Volume Chart" },
  "vol.volumeChart.info": { zh: "1m 成交量柱状图。Volume Z-Score 高时通常对应资金大幅进出。", en: "1m volume bars. High Volume Z-score often coincides with sharp inflows/outflows." },
  "vol.metric.5mZ.label": { zh: "5m 涨跌 Z-Score", en: "5m Return Z-Score" },
  "vol.metric.5mZ.title": { zh: "5 分钟收益率 Z-Score", en: "5-minute Return Z-Score" },
  "vol.metric.5mZ.info": {
    zh: "用最近 30 根 5m K 线的涨跌幅算均值/方差，与最新一根做标准化。\n|Z| > 2.5 表示当前 5m 行情超过 99% 历史样本的极端值，常作为暴涨/暴跌的一个量化触发器。",
    en: "Last 30 5m kline returns → mean/var, then z-score the latest bar.\n|Z| > 2.5 = beyond 99% of historical samples, a common flash-move trigger.",
  },
  "vol.metric.5mZ.helper": { zh: "最新 5m {pct}", en: "Latest 5m {pct}" },
  "vol.metric.wick.label": { zh: "插针比例", en: "Wick Ratio" },
  "vol.metric.wick.helper": { zh: "基于当前 5m K 线高低点和实体", en: "Based on current 5m kline high/low and body" },
  "vol.metric.wick.info": {
    zh: "上/下影线占整根 K 线的比例，越大说明长上下影针越明显，常对应快速冲高回落或闪崩反弹。",
    en: "Upper/lower wick share of the candle range — larger = longer wicks, often after spike-and-reverse or flash crashes.",
  },
  "vol.metric.volZ.label": { zh: "Volume Z-Score", en: "Volume Z-Score" },
  "vol.metric.volZ.helper": { zh: "1m 成交量 {vol}K {base}", en: "1m volume {vol}K {base}" },
  "vol.metric.volZ.info": { zh: "1 分钟成交量相对最近 30 根的标准化分数。> 2.5 表示放量，越大越极端。", en: "1m volume z-scored against last 30 bars. > 2.5 = volume spike; larger = more extreme." },
  "vol.metric.oi.label": { zh: "OI / Funding", en: "OI / Funding" },
  "vol.metric.oi.info": {
    zh: "OI（未平仓合约）短期变化率 + 当前永续资金费率。\nOI 急降配合价格止跌 = 杠杆清洗；资金费率高且持续为正 = 多头拥挤。",
    en: "OI (open interest) short-term change + current perp funding.\nOI drop + price stabilizing = leverage flush; high persistent positive funding = crowded longs.",
  },
  "vol.metric.basis.label": { zh: "永续溢价", en: "Perp Premium" },
  "vol.metric.basis.helper": { zh: "现货 {spot}", en: "Spot {spot}" },
  "vol.metric.basis.info": {
    zh: "永续合约价格相对现货的溢价率 = (永续 - 现货) / 现货 × 100%。\n正溢价 = 多头情绪占优；负溢价 = 恐慌或套利机会。",
    en: "Perp premium = (perp − spot) / spot × 100%.\nPositive = bullish bias; negative = panic or basis-arb opportunity.",
  },
  "vol.metric.topAcct.label": { zh: "大户账户比", en: "Top Trader Acct L/S" },
  "vol.metric.topAcct.info": {
    zh: "OKX 大户账户多空比。> 1 = 大户偏多；< 1 = 大户偏空。\n大户与散户方向分歧时常有反向行情。",
    en: "OKX top-trader account long/short ratio. > 1 = bias long; < 1 = bias short.\nDivergence with retail often precedes reversals.",
  },
  "vol.metric.topPos.label": { zh: "大户持仓比", en: "Top Trader Position L/S" },
  "vol.metric.topPos.info": {
    zh: "OKX 大户持仓量多空比。反映大户实际持仓规模的多空分布，比账户数更能体现资金方向。",
    en: "OKX top-trader position long/short ratio. Reflects size-weighted positioning — more revealing than account counts.",
  },
  "vol.metric.cvd.label": { zh: "CVD", en: "CVD" },
  "vol.metric.cvd.helper": { zh: "累计成交量差", en: "Cumulative volume delta" },
  "vol.metric.cvd.info": {
    zh: "主动买入量 - 主动卖出量的累计值。\nCVD 上升 = 买方主导；CVD 下降 = 卖方主导。\n价格新低但 CVD 不新低 = 可能有吸收；价格新高但 CVD 背离 = 上涨乏力。",
    en: "Cumulative aggressive buy − aggressive sell.\nRising = buyer-led; falling = seller-led.\nLower price but no lower CVD = possible absorption; higher price but CVD divergence = exhaustion.",
  },
  "vol.section.oiFundingLs": { zh: "OI / Funding / 多空比", en: "OI / Funding / Long-Short" },
  "vol.metric.oiTitle.label": { zh: "Open Interest", en: "Open Interest" },
  "vol.metric.oiTitle.info": { zh: "未平仓合约价值（USD）。OI 上升 = 新仓涌入，下降 = 仓位平仓或被强平。", en: "Open-interest value (USD). Rising = new positions; falling = closes or liquidations." },
  "vol.metric.funding.label": { zh: "资金费率", en: "Funding Rate" },
  "vol.metric.funding.helper": { zh: "当前预测/结算费率", en: "Current predicted / settled rate" },
  "vol.metric.funding.info": {
    zh: "永续合约多空之间的周期性资金交换。正 = 多头给空头付费（多头拥挤），负 = 空头给多头付费（空头拥挤）。",
    en: "Periodic payment between perp longs and shorts. Positive = longs pay shorts (crowded longs); negative = shorts pay longs (crowded shorts).",
  },
  "vol.metric.lsAcct.label": { zh: "多空账户比", en: "Long/Short Acct" },
  "vol.metric.lsAcct.helper": { zh: "合约账户 {ratio}", en: "Contract acct {ratio}" },
  "vol.metric.lsAcct.info": {
    zh: "OKX Rubik：多空账户数比 / 多空合约持仓比。> 1 多头占优；< 1 空头占优。极端值常对应反向行情。",
    en: "OKX Rubik: long/short account-count ratio and long/short contract-position ratio. > 1 = long-skewed; < 1 = short-skewed. Extremes often precede reversals.",
  },
  "vol.oiHistory": { zh: "Open Interest 历史", en: "Open Interest history" },
  "vol.fundingHistory": { zh: "资金费率历史", en: "Funding-rate history" },
  "vol.lsHistory": { zh: "多空比历史", en: "Long/Short history" },
  "vol.topLsHistory": { zh: "大户多空比历史", en: "Top trader L/S history" },
  "vol.topLsHistory.info": {
    zh: "OKX Top Trader 的账户数多空比和持仓量多空比。大户方向与散户分歧时常有反向行情。",
    en: "OKX Top Trader account L/S and position L/S. Divergence with retail often precedes reversals.",
  },
  "vol.cvdSection": { zh: "CVD 累计成交量差", en: "CVD (Cumulative Volume Delta)" },
  "vol.cvdSection.info": {
    zh: "Cumulative Volume Delta = 主动买入量 - 主动卖出量的累计值。CVD 与价格背离时需要警惕反向。",
    en: "Cumulative Volume Delta = aggressive buys − aggressive sells. Divergence with price warns of reversal.",
  },
  "vol.book.title": { zh: "订单簿状态", en: "Order Book" },
  "vol.book.info": {
    zh: "OKX 现货深度 Top 20。Bid/Ask Ratio > 1.2 买盘明显占优；< 0.8 卖盘明显占优。",
    en: "OKX top-20 book depth. Bid/Ask > 1.2 = strong bids; < 0.8 = strong asks.",
  },
  "vol.book.bid": { zh: "买盘深度", en: "Bid depth" },
  "vol.book.ask": { zh: "卖盘深度", en: "Ask depth" },
  "vol.book.imbalance": { zh: "失衡 {pct}%", en: "Imbalance {pct}%" },
  "vol.book.waiting": { zh: "等待订单簿数据...", en: "Waiting for order book…" },
  "vol.thresholds": { zh: "安全阈值", en: "Thresholds" },
  "vol.threshold.5mZ": { zh: "5m z-score", en: "5m z-score" },
  "vol.threshold.wick": { zh: "上/下影线比例", en: "Wick ratio" },
  "vol.threshold.volZ": { zh: "成交量 z-score", en: "Volume z-score" },
  "vol.threshold.oi": { zh: "OI 5m 清洗", en: "OI 5m flush" },
  "vol.threshold.book": { zh: "订单簿恢复", en: "Book recovery" },
  "vol.history.title": { zh: "历史信号列表", en: "Signal History" },
  "vol.history.empty": { zh: "暂无 Buy Watch、Sell Watch 或 High Risk 信号。", en: "No Buy Watch, Sell Watch or High Risk signals yet." },
  "vol.risk.title": { zh: "风险提示", en: "Risk notice" },
  "vol.risk.body": {
    zh: "本系统仅用于监控与观察，不构成交易建议。极端行情中数据推送可能延迟或缺失。",
    en: "Monitoring tool only — not trading advice. During extreme moves, feeds may be delayed or partial.",
  },

  // Volatility signal narrative — High Risk
  "vol.sig.highRisk.headline.down": {
    zh: "下跌延续且 OI 回升，暂不接针",
    en: "Downside continues with OI rising — do not catch the knife",
  },
  "vol.sig.highRisk.headline.up": {
    zh: "上涨延续且 OI 回升，暂不追空",
    en: "Upside continues with OI rising — do not chase shorts",
  },
  "vol.sig.highRisk.trigger.newLow": { zh: "价格继续刷新 5m 新低", en: "Price keeps printing new 5m lows" },
  "vol.sig.highRisk.trigger.newHigh": { zh: "价格继续刷新 5m 新高", en: "Price keeps printing new 5m highs" },
  "vol.sig.highRisk.trigger.oiRate": {
    zh: "OI 5m 变化率 {pct}，杠杆仓位仍在增加",
    en: "OI 5m change {pct} — leverage still rising",
  },
  "vol.sig.highRisk.trigger.downSync": {
    zh: "价格下跌与 OI 上升同步，存在继续踩踏风险",
    en: "Falling price + rising OI — risk of further cascade",
  },
  "vol.sig.highRisk.trigger.upSync": {
    zh: "价格上涨与 OI 上升同步，存在继续逼空风险",
    en: "Rising price + rising OI — risk of further short squeeze",
  },
  "vol.sig.highRisk.invalid.oiTurn": { zh: "OI 5m 变化率转为下降并低于 -2%", en: "OI 5m change turns negative below −2%" },
  "vol.sig.highRisk.invalid.priceReclaim": {
    zh: "价格重新站回上一根 5m K 线实体区间",
    en: "Price reclaims the prior 5m candle body",
  },
  "vol.sig.highRisk.invalid.bookEq": {
    zh: "订单簿 Bid / Ask Ratio 回到 0.9 - 1.1 的均衡区间",
    en: "Book bid/ask ratio returns to 0.9 – 1.1 equilibrium",
  },

  // Buy Watch
  "vol.sig.buy.headline": { zh: "{base} 暴跌插针后的反弹观察", en: "{base} — watching for rebound after capitulation wick" },
  "vol.sig.buy.trigger.priceZ": {
    zh: "5m 跌幅 z-score {z} < -{th}",
    en: "5m drop z-score {z} < −{th}",
  },
  "vol.sig.buy.trigger.lowerWick": {
    zh: "下影线比例 {pct}% > 55%",
    en: "Lower-wick ratio {pct}% > 55%",
  },
  "vol.sig.buy.trigger.volZ": {
    zh: "成交量 z-score {z} > {th}",
    en: "Volume z-score {z} > {th}",
  },
  "vol.sig.buy.trigger.longLiq": {
    zh: "5m 多头爆仓 {usd} 明显放大",
    en: "5m long liquidations {usd} expanding sharply",
  },
  "vol.sig.buy.trigger.noLiq": {
    zh: "公开源未返回逐笔爆仓，信号以 OI 清洗、盘口恢复和放量确认",
    en: "Per-trade liquidations not exposed publicly — signal confirmed via OI flush, book recovery and volume",
  },
  "vol.sig.buy.trigger.oiFlush": { zh: "OI 5m 变化率 {pct} < -2%", en: "OI 5m change {pct} < −2%" },
  "vol.sig.buy.trigger.bidRecovery": {
    zh: "Bid / Ask Ratio {r} > 1.20，买盘深度恢复",
    en: "Bid/Ask {r} > 1.20 — bid depth recovering",
  },
  "vol.sig.buy.invalid.newLow": { zh: "价格跌破插针低点并持续创新低", en: "Price breaks the wick low and keeps printing lows" },
  "vol.sig.buy.invalid.oiUp": { zh: "OI 转为上升且价格继续下跌", en: "OI turns up while price keeps falling" },
  "vol.sig.buy.invalid.bidFail": {
    zh: "Bid / Ask Ratio 跌回 1.0 以下或成交量扩张消失",
    en: "Bid/Ask falls back below 1.0 or volume expansion fades",
  },

  // Sell Watch
  "vol.sig.sell.headline": { zh: "{base} 暴涨插针后的回落观察", en: "{base} — watching for pullback after upside wick" },
  "vol.sig.sell.trigger.priceZ": {
    zh: "5m 涨幅 z-score {z} > {th}",
    en: "5m gain z-score {z} > {th}",
  },
  "vol.sig.sell.trigger.upperWick": {
    zh: "上影线比例 {pct}% > 55%",
    en: "Upper-wick ratio {pct}% > 55%",
  },
  "vol.sig.sell.trigger.volZ": { zh: "成交量 z-score {z} > {th}", en: "Volume z-score {z} > {th}" },
  "vol.sig.sell.trigger.shortLiq": {
    zh: "5m 空头爆仓 {usd} 明显放大",
    en: "5m short liquidations {usd} expanding sharply",
  },
  "vol.sig.sell.trigger.askRecovery": {
    zh: "Bid / Ask Ratio {r} < 0.80，卖盘深度恢复",
    en: "Bid/Ask {r} < 0.80 — ask depth recovering",
  },
  "vol.sig.sell.invalid.newHigh": { zh: "价格突破插针高点并持续创新高", en: "Price breaks the wick high and keeps printing highs" },
  "vol.sig.sell.invalid.oiUp": { zh: "OI 转为上升且价格继续上涨", en: "OI turns up while price keeps rising" },
  "vol.sig.sell.invalid.askFail": {
    zh: "Bid / Ask Ratio 回到 1.0 以上或成交量扩张消失",
    en: "Bid/Ask returns above 1.0 or volume expansion fades",
  },

  // Neutral
  "vol.sig.neutral.headline": { zh: "阈值未形成单边观察信号", en: "Thresholds not yet forming a one-sided watch signal" },
  "vol.sig.neutral.trigger.zscores": {
    zh: "5m return z-score {pz}，成交量 z-score {vz}",
    en: "5m return z-score {pz}, volume z-score {vz}",
  },
  "vol.sig.neutral.trigger.wicks": {
    zh: "上影线 {up}%，下影线 {dn}%",
    en: "Upper wick {up}%, lower wick {dn}%",
  },
  "vol.sig.neutral.trigger.bookOi": {
    zh: "Bid / Ask Ratio {r}，OI 5m {pct}",
    en: "Bid/Ask {r}, OI 5m {pct}",
  },
  "vol.sig.neutral.invalid.fullCombo": {
    zh: "任一方向满足价格 z-score、插针、放量、爆仓、OI 清洗和订单簿恢复的完整组合",
    en: "Either side completes the full combo: price z-score, wick, volume, liquidation, OI flush, book recovery",
  },
  "vol.sig.neutral.invalid.highRiskSwitch": {
    zh: "价格继续创新高/新低且 OI 同步上升时切换为 High Risk",
    en: "Switches to High Risk if price keeps printing new highs/lows with OI rising",
  },

  // Volatility — Z-score history
  "vol.zHistory.title": { zh: "Z-Score 历史曲线", en: "Z-Score history" },
  "vol.zHistory.info": {
    zh: "沿当前时间范围用 {window} 根 K 线作为滚动样本，把每根 {bar} K 线的收益率/成交量与样本均值标准差对比。± 2.5 为常见的「极端值」阈值。",
    en: "Rolling z-score with a {window}-bar window over the selected range. Each {bar} bar's return / volume is normalized against the trailing sample. ±2.5 is the typical extreme threshold.",
  },
  "vol.zHistory.return": { zh: "收益率 Z", en: "Return Z" },
  "vol.zHistory.volume": { zh: "成交量 Z", en: "Volume Z" },

  // Smart Money tracker
  "smart.title": { zh: "聪明钱 ({ccy}) 主动买卖", en: "Smart Money — {ccy} aggressive flow" },
  "smart.info": {
    zh: "聚合 OKX 永续合约 + 现货的 taker 主动买入与主动卖出名义量（按当前时间范围分桶汇总）。\n买入总额 / 卖出总额分别绘制为两条曲线；下方面积图为累计净买入。\n背景：被动挂单在长周期会基本互抵，因此 taker 净流量是观察大额/机构方向的常用代理。",
    en: "Aggregates OKX perp + spot taker buy / sell notional bucketed by the current time range.\nTwo lines = total buys vs sells; area below = cumulative net buy.\nPassive flow nets out over time, so taker imbalance is a common proxy for large-trader / institutional positioning.",
  },
  "smart.loading": { zh: "正在加载聪明钱流向…", en: "Loading smart-money flow…" },
  "smart.kpi.buy": { zh: "主动买入", en: "Aggressive Buy" },
  "smart.kpi.sell": { zh: "主动卖出", en: "Aggressive Sell" },
  "smart.kpi.net": { zh: "净流量", en: "Net" },
  "smart.kpi.ratio": { zh: "买卖比", en: "Buy/Sell" },
  "smart.kpi.cumNet": { zh: "累计净买入", en: "Cumulative net buy" },

  // Mining cost / electricity curve
  "mining.title": { zh: "BTC 挖矿成本 / 电费曲线", en: "BTC Mining Cost / Electricity Curve" },
  "mining.info": {
    zh: "用 mempool.space 全网算力 × ASIC 能效（{eff} J/TH）× 电价（${rate}/kWh）× 区块奖励（{reward}）估算每枚 BTC 的电力成本。叠加 blockchain.info 的现价用于观察「现价 vs 成本」的矿工边际。\n用途：现价跌入或接近成本曲线时往往触发矿工资本支出收缩或停机；反之，溢价扩大代表行业盈利。",
    en: "Cost-of-production proxy: mempool.space network hashrate × ASIC efficiency ({eff} J/TH) × electricity rate (${rate}/kWh) × block reward ({reward}) → USD per BTC. Overlaid with blockchain.info BTC price.\nWhen price approaches the cost curve, miners typically curtail; widening premium signals industry profitability.",
  },
  "mining.info.fallback": {
    zh: "用 mempool.space 全网算力 × ASIC 能效 × 电价估算每枚 BTC 的电力成本。",
    en: "Cost-of-production proxy from network hashrate × ASIC efficiency × electricity rate.",
  },
  "mining.loading": { zh: "正在加载挖矿成本曲线…", en: "Loading mining-cost curve…" },
  "mining.kpi.hashrate": { zh: "算力", en: "Hashrate" },
  "mining.kpi.cost": { zh: "电力成本/枚", en: "Cost / BTC" },
  "mining.kpi.price": { zh: "现价", en: "Price" },
  "mining.kpi.margin": { zh: "毛利", en: "Margin" },

  // History Compare (TradingView-style multi-pane)
  "compare.title": { zh: "历史对比 · 多指标统一时间轴", en: "History Compare · Unified time axis" },
  "compare.info": {
    zh: "按指标类型把 BTC / 加密 / 宏观时间序列聚合到纵向图表中；每个图表都显示同一套 X 时间轴，并用统一的左右时间边界保持对齐。只展示能完整覆盖当前时间周期的真实数据线；覆盖不足的数据源不会在该周期展示。悬停任一图表，其余图表会同步到同一时间点；点击图例可独立显示 / 隐藏曲线。",
    en: "Groups BTC / crypto / macro time series by metric type into a vertical chart stack. Every chart shows the same X time axis and uses the same left / right time bounds, so all panes stay aligned. Only real series that fully cover the selected time range are shown; sources with insufficient coverage are omitted for that range. Hover any chart to sync the rest to the same date; click legend items to hide / show lines.",
  },
  "compare.loading": { zh: "正在加载多指标历史…", en: "Loading multi-indicator history…" },
  "compare.s.price": { zh: "BTC 价格", en: "BTC Price" },
  "compare.s.miningCost": { zh: "挖矿成本/枚", en: "Mining Cost / BTC" },
  "compare.s.oi": { zh: "未平仓 OI (USD)", en: "Open Interest (USD)" },
  "compare.s.funding": { zh: "资金费率 (%)", en: "Funding Rate (%)" },
  "compare.s.ls": { zh: "多空账户比", en: "Long/Short Acct Ratio" },
  "compare.s.cvd": { zh: "CVD 累计差量", en: "Cumulative Volume Delta" },
  "compare.s.smartCum": { zh: "聪明钱累计净买", en: "Smart Money Cum. Net" },
  "compare.s.smartBuy": { zh: "聪明钱买入", en: "Smart Money Buy" },
  "compare.s.smartSell": { zh: "聪明钱卖出", en: "Smart Money Sell" },
  "compare.seriesCount": { zh: "条曲线显示中", en: "series visible" },
  "compare.paneCount": { zh: "个面板", en: "panes" },
  "compare.legendHint": {
    zh: "点击图例可隐藏 / 显示曲线；图例数值为悬停时间点的原始读数和相对起点的 % 变动。",
    en: "Click legend items to hide / show lines. Legend values show the hovered raw reading and % change since the start of the window.",
  },
  "compare.s.ethPrice": { zh: "ETH 价格", en: "ETH Price" },
  "compare.s.stablecoin": { zh: "稳定币总市值", en: "Stablecoin Mcap" },
  "compare.s.defiTvl": { zh: "DeFi TVL", en: "DeFi TVL" },
  "compare.s.fng": { zh: "恐慌贪婪指数", en: "Fear & Greed" },
  "compare.s.dvol": { zh: "BTC DVOL 隐含波动率", en: "BTC DVOL (IV)" },
  "compare.s.hashRate": { zh: "全网算力 (EH/s)", en: "Network Hashrate (EH/s)" },
  "compare.s.difficulty": { zh: "挖矿难度 (T)", en: "Mining Difficulty (T)" },
  "compare.s.nTxs": { zh: "每日交易笔数", en: "Daily Transactions" },
  "compare.s.activeAddrs": { zh: "活跃地址数", en: "Active Addresses" },
  "compare.s.mempool": { zh: "Mempool 大小 (MB)", en: "Mempool Size (MB)" },
  "compare.s.txFeesUsd": { zh: "交易费 (USD)", en: "Transaction Fees (USD)" },
  "compare.s.avgBlockSize": { zh: "平均区块大小 (MB)", en: "Avg Block Size (MB)" },
  "compare.s.dxy": { zh: "美元指数 DXY", en: "USD Index (DXY)" },
  "compare.s.us10y": { zh: "美债 10Y 收益率", en: "US 10Y Yield" },
  "compare.s.us2y": { zh: "美债短端 13W", en: "US 13W Short Rate" },
  "compare.s.vix": { zh: "VIX 恐慌指数", en: "VIX Volatility" },
  "compare.s.sp500": { zh: "标普 500", en: "S&P 500" },
  "compare.s.nasdaq": { zh: "纳斯达克 100", en: "NASDAQ" },
  "compare.s.russell": { zh: "罗素 2000", en: "Russell 2000" },
  "compare.s.gold": { zh: "黄金期货", en: "Gold Futures" },
  "compare.s.silver": { zh: "白银期货", en: "Silver Futures" },
  "compare.s.copper": { zh: "铜期货", en: "Copper Futures" },
  "compare.s.oil": { zh: "WTI 原油", en: "WTI Crude" },
  "compare.s.natgas": { zh: "天然气", en: "Natural Gas" },
  "compare.s.nikkei": { zh: "日经 225", en: "Nikkei 225" },
  "compare.s.hangseng": { zh: "恒生指数", en: "Hang Seng" },
}

interface I18nState {
  locale: Locale
  setLocale: (next: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nState | null>(null)

function formatTemplate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : `{${name}}`))
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null
      if (stored === "zh" || stored === "en") setLocaleState(stored)
    } catch {
      // ignore
    }
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
    if (typeof document !== "undefined") document.documentElement.lang = next === "zh" ? "zh-CN" : "en"
  }, [])

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = locale === "zh" ? "zh-CN" : "en"
  }, [locale])

  const value = useMemo<I18nState>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => {
        const entry = DICT[key]
        if (!entry) return key
        return formatTemplate(entry[locale], vars)
      },
    }),
    [locale, setLocale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    // Safe fallback so components don't crash if used outside the provider.
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => undefined,
      t: (key, vars) => {
        const entry = DICT[key]
        return entry ? formatTemplate(entry[DEFAULT_LOCALE], vars) : key
      },
    }
  }
  return ctx
}

export function useT() {
  return useI18n().t
}
