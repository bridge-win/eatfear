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
    zh: "现货 + 永续衍生品（{source}）。实时与历史曲线合并展示，默认进入历史对比；数据源与时间周期在右侧切换。",
    en: "Spot + perpetuals ({source}). Realtime and history curves are unified, history opens by default, and source / range switch on the right.",
  },
  "crypto.tab.realtime": { zh: "实时", en: "Realtime" },
  "crypto.tab.history": { zh: "历史曲线", en: "History" },
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
    zh: "美股、港股和越南概念股公开行情；实时行情与历史曲线合并展示，默认进入历史对比，覆盖股指、波动率、利率、信用、美元和商品等核心因子。",
    en: "US, HK and Vietnam-themed equity quotes; realtime quotes and history curves are unified with history as the default, covering index, volatility, rates, credit, dollar and commodity factors.",
  },
  "stock.tab.realtime": { zh: "实时", en: "Realtime" },
  "stock.tab.history": { zh: "历史曲线", en: "History" },
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
  "stock.historyCompare.title": { zh: "股票历史对比 · 统一时间轴", en: "Stock History Compare · Unified time axis" },
  "stock.historyCompare.info": {
    zh: "把股票/ETF、股指、波动率、利率、信用、美元和商品因子合并到同一套历史曲线中。每个面板共享时间轴，悬停同步日期；图例右侧 i 展示数据源、意义和影响方向。",
    en: "Combines stocks/ETFs, indices, volatility, rates, credit, dollar and commodity factors into one historical comparison surface. Panes share a time axis, hover syncs dates, and legend info icons explain source, meaning and direction.",
  },

  // Macro dashboard
  "macro.title": { zh: "宏观看板", en: "Macro Dashboard" },
  "macro.subtitle": {
    zh: "按普通投资者最常用的宏观顺序展示：利率/央行政策、10年期国债、通胀、社融/M2/信贷、PMI、GDP、就业、汇率、房地产、消费，再展开工业、投资、盈利、资金流、成交、商品、贸易、财政、行业与政策信号。每个指标右上角说明数据源、意义和影响方向。",
    en: "Ordered by the macro checklist ordinary investors use most: policy rates, 10Y yields, inflation, M2/credit, PMI, GDP, jobs, FX, real estate, consumption, then industrial activity, investment, earnings, flows, turnover, commodities, trade, fiscal impulse, sectors and policy proxies. Each indicator tooltip explains source, meaning and market direction.",
  },
  "macro.tab.realtime": { zh: "实时", en: "Realtime" },
  "macro.tab.history": { zh: "历史曲线", en: "History" },
  "macro.historyCompare.title": { zh: "宏观历史对比 · 统一时间轴", en: "Macro History Compare · Unified time axis" },
  "macro.historyCompare.info": {
    zh: "默认按 1-20 个宏观优先级分组绘制历史对比。每个面板共享左右时间边界，悬停任意面板会同步到同一天；点击图例可显示 / 隐藏单条曲线，图例右侧 i 可查看数据源、意义和影响方向。",
    en: "Defaults to historical comparison grouped by the 1-20 macro priority checklist. Panes use the same left/right bounds, hover syncs all panes to the same date, legend clicks show/hide lines, and each legend info icon explains source, meaning and market direction.",
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
  "macro.group.Sentiment": { zh: "情绪", en: "Sentiment" },
  "macro.group.CrossAsset": { zh: "跨资产", en: "Cross-Asset" },

  // Macro FRED hint
  "macro.fredHint.title": { zh: "FRED 数据未启用", en: "FRED data not enabled" },
  "macro.fredHint.body": {
    zh: "美联储利率 / 通胀 / 就业 / 流动性 / M1/M2 / PMI / GDP / 房地产 / 消费 / 工业 / 投资 / 企业盈利 / 贸易 / 财政 / World Bank 市值与成交等指标需要 FRED 免费 API key。前往 fred.stlouisfed.org 注册后在 .env.local 添加 FRED_API_KEY=YOUR_KEY，重启服务即可生效。",
    en: "Fed rates, inflation, employment, liquidity, M1/M2, PMI, GDP, housing, consumption, industrial activity, investment, corporate profits, trade, fiscal and World Bank market-cap/turnover indicators need a free FRED API key. Sign up at fred.stlouisfed.org, then add FRED_API_KEY=YOUR_KEY to .env.local and restart the service.",
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
  "mining.title": { zh: "BTC 挖矿成本曲线", en: "BTC Mining Cost Curves" },
  "mining.info": {
    zh: "用 mempool.space 全网算力 × ASIC 能效（{eff} J/TH）× 电价（${rate}/kWh）× 区块奖励（{reward}）估算每枚 BTC 的电力成本；综合成本按电力成本 × {multiplier} 估算，用于覆盖机器折旧、托管、矿池费和其他运营成本。叠加 blockchain.info 的现价用于观察矿工边际。\n用途：现价跌入或接近综合成本曲线时往往触发资本支出收缩或停机；电力成本是更底层的关机线。",
    en: "Electricity cost uses mempool.space network hashrate × ASIC efficiency ({eff} J/TH) × electricity rate (${rate}/kWh) × block reward ({reward}). Comprehensive cost applies a {multiplier}× multiplier for hardware depreciation, hosting, pool fees, and operating overhead. BTC price comes from blockchain.info.\nWhen price approaches comprehensive cost, miners often cut capex or curtail; electricity cost is the lower shutdown line.",
  },
  "mining.info.fallback": {
    zh: "用 mempool.space 全网算力 × ASIC 能效 × 电价估算电力成本，并用倍率估算综合成本。",
    en: "Electricity cost comes from network hashrate × ASIC efficiency × electricity rate, with a multiplier for comprehensive cost.",
  },
  "mining.loading": { zh: "正在加载挖矿成本曲线…", en: "Loading mining-cost curve…" },
  "mining.kpi.hashrate": { zh: "算力", en: "Hashrate" },
  "mining.kpi.cost": { zh: "电力成本/枚", en: "Electricity / BTC" },
  "mining.kpi.electricityCost": { zh: "电力成本/枚", en: "Electricity / BTC" },
  "mining.kpi.comprehensiveCost": { zh: "综合成本/枚", en: "Comprehensive / BTC" },
  "mining.kpi.price": { zh: "现价", en: "Price" },
  "mining.kpi.margin": { zh: "毛利", en: "Margin" },
  "mining.kpi.comprehensiveMargin": { zh: "综合毛利", en: "Full margin" },

  // History Compare (TradingView-style multi-pane)
  "compare.title": { zh: "历史对比 · 多指标统一时间轴", en: "History Compare · Unified time axis" },
  "compare.info": {
    zh: "按指标类型把 BTC / 加密 / 宏观时间序列聚合到纵向图表中；每个图表都显示同一套 X 时间轴，并用统一的左右时间边界保持对齐。实时卡片里的指标会尽量同步进入历史曲线；公开源覆盖不足时保留可用区间。悬停任一图表，其余图表会同步到同一时间点；点击图例可独立显示 / 隐藏曲线。",
    en: "Groups BTC / crypto / macro time series by metric type into a vertical chart stack. Every chart shows the same X time axis and uses the same left / right time bounds, so all panes stay aligned. Realtime-card metrics are carried into history whenever the public source has usable data; sparse sources keep their available window. Hover any chart to sync the rest to the same date; click legend items to hide / show lines.",
  },
  "compare.info.default": {
    zh: "意义：{label} 的最新读数和历史曲线。\n影响方向：结合相邻指标看趋势、拥挤度和风险偏好。",
    en: "Meaning: latest reading and history for {label}.\nImpact: combine with nearby indicators to judge trend, crowding and risk appetite.",
  },
  "compare.info.btcPrice": { zh: "意义：BTC 现货价格是整张加密看板的核心锚。\n影响方向：上行通常改善风险偏好；跌破关键成本或均线时风险升高。", en: "Meaning: BTC spot is the core anchor for the crypto dashboard.\nImpact: rising price usually supports risk appetite; breaks below key costs or averages raise risk." },
  "compare.info.miningElectricityCost": { zh: "意义：按全网算力、ASIC 能效和电价估算每枚 BTC 的电力成本。\n影响方向：价格接近电力成本时，矿机关机和算力出清风险上升。", en: "Meaning: estimated electricity cost per BTC from hashrate, ASIC efficiency and power price.\nImpact: price near this line raises miner shutdown and hashrate capitulation risk." },
  "compare.info.miningComprehensiveCost": { zh: "意义：电力成本乘以综合成本系数，覆盖机器折旧、托管和运营费用。\n影响方向：价格跌破综合成本通常压缩矿工利润和新增资本开支。", en: "Meaning: electricity cost multiplied by the comprehensive cost factor for depreciation, hosting and operations.\nImpact: price below this line usually squeezes miner margins and capex." },
  "compare.info.ethPrice": { zh: "意义：ETH 价格代表智能合约和链上风险偏好。\n影响方向：强于 BTC 常意味着资金愿意承担更高 Beta。", en: "Meaning: ETH price proxies smart-contract and on-chain risk appetite.\nImpact: ETH strength versus BTC often means capital is accepting higher beta." },
  "compare.info.solPrice": { zh: "意义：SOL 是高 Beta 公链风险偏好的代理。\n影响方向：强势通常对应山寨风险偏好改善；急跌容易放大市场压力。", en: "Meaning: SOL is a high-beta L1 risk proxy.\nImpact: strength often signals better altcoin risk appetite; sharp drops can amplify stress." },
  "compare.info.xrpPrice": { zh: "意义：XRP 是大型支付叙事资产的价格代理。\n影响方向：强势反映大盘外的主题资金活跃，弱势则提示风险偏好收缩。", en: "Meaning: XRP proxies large-cap payment-token appetite.\nImpact: strength shows active thematic flows; weakness points to reduced risk appetite." },
  "compare.info.bnbPrice": { zh: "意义：BNB 反映交易所生态和平台币风险偏好。\n影响方向：上行通常表示交易活跃度和平台生态情绪改善。", en: "Meaning: BNB reflects exchange-ecosystem and platform-token appetite.\nImpact: rising BNB usually points to stronger trading activity and ecosystem sentiment." },
  "compare.info.dogePrice": { zh: "意义：DOGE 是散户投机和 Meme 风险偏好的代理。\n影响方向：异常强势常表示投机升温；急跌提示情绪退潮。", en: "Meaning: DOGE proxies retail speculation and meme risk appetite.\nImpact: unusual strength suggests speculative heat; sharp drops warn sentiment is fading." },
  "compare.info.btcReturnZ": { zh: "意义：BTC 日收益相对近期波动的标准化偏离。\n影响方向：极端正值偏过热，极端负值偏恐慌或清算压力。", en: "Meaning: BTC daily return standardized against recent volatility.\nImpact: extreme positive readings imply overheating; extreme negative readings imply panic or liquidation pressure." },
  "compare.info.btcVolumeZ": { zh: "意义：BTC 成交量相对近期均值的异常程度。\n影响方向：放量配合趋势会强化方向；放量反转常提示清算或吸筹。", en: "Meaning: abnormality of BTC volume versus recent history.\nImpact: volume confirms trend when aligned; volume on reversal may signal liquidations or accumulation." },
  "compare.info.btcVolumeUsd": { zh: "意义：BTC 永续日成交额。\n影响方向：成交放大说明换手和博弈升温；缩量说明方向信号不足。", en: "Meaning: BTC perpetual daily traded value.\nImpact: higher turnover shows hotter positioning; thin volume weakens directional signals." },
  "compare.info.basis": { zh: "意义：永续价格相对现货的溢价。\n影响方向：正溢价扩大偏多头拥挤；负溢价提示避险或空头压力。", en: "Meaning: perpetual premium versus spot.\nImpact: wider positive basis suggests crowded longs; negative basis signals risk-off or short pressure." },
  "compare.info.upperWick": { zh: "意义：日 K 上影线占振幅比例。\n影响方向：高上影常表示上方抛压或追多失败。", en: "Meaning: upper wick share of daily range.\nImpact: high upper wick often shows overhead supply or failed long chasing." },
  "compare.info.lowerWick": { zh: "意义：日 K 下影线占振幅比例。\n影响方向：高下影常表示下方承接或空头回补。", en: "Meaning: lower wick share of daily range.\nImpact: high lower wick often shows demand below or short covering." },
  "compare.info.signalBuyScore": { zh: "意义：基于跌幅、下影、放量、OI、费率和多空比合成的买入压力分。\n影响方向：高分表示恐慌后反弹条件更充分。", en: "Meaning: buy-pressure score from drawdown, lower wick, volume, OI, funding and long/short ratio.\nImpact: high score means better rebound conditions after stress." },
  "compare.info.signalSellScore": { zh: "意义：基于涨幅、上影、放量、OI、费率和多空比合成的卖出压力分。\n影响方向：高分表示过热回落风险上升。", en: "Meaning: sell-pressure score from upside move, upper wick, volume, OI, funding and long/short ratio.\nImpact: high score means rising pullback risk after overheating." },
  "compare.info.signalRiskScore": { zh: "意义：极端波动、放量、OI 变化、费率和多空偏离的综合风险分。\n影响方向：高分优先代表风险升高，而不是单边方向。", en: "Meaning: composite risk score from volatility, volume, OI change, funding and long/short imbalance.\nImpact: high score means higher risk first, not a one-way direction call." },
  "compare.info.signalDirection": { zh: "意义：Current Signal 的方向码，1 偏买、-1 偏卖、2 偏风险、0 中性。\n影响方向：用于快速识别当前信号属于买入、卖出还是风险状态。", en: "Meaning: Current Signal direction code: 1 buy, -1 sell, 2 risk, 0 neutral.\nImpact: quickly separates buy, sell and risk regimes." },
  "compare.info.stablecoinMcap": { zh: "意义：稳定币总市值代表加密场内美元流动性。\n影响方向：持续上升通常利好风险资产；下降提示资金撤出。", en: "Meaning: stablecoin market cap proxies on-venue crypto dollar liquidity.\nImpact: sustained growth supports risk assets; contraction warns of capital leaving." },
  "compare.info.defiTvl": { zh: "意义：DeFi 总锁仓量反映链上资本沉淀。\n影响方向：TVL 扩张通常对应风险偏好改善；收缩代表去杠杆。", en: "Meaning: DeFi TVL reflects capital committed on-chain.\nImpact: expansion usually means stronger risk appetite; contraction means deleveraging." },
  "compare.info.oi": { zh: "意义：未平仓合约价值衡量杠杆仓位规模。\n影响方向：OI 快速上升增加清算风险；价格同向才代表趋势确认。", en: "Meaning: open interest measures leveraged position size.\nImpact: fast OI growth raises liquidation risk; price alignment is needed for trend confirmation." },
  "compare.info.oiReturnZ": { zh: "意义：OI 日变化的标准化异常程度。\n影响方向：极端值提示杠杆快速进入或退出，容易放大波动。", en: "Meaning: standardized abnormality of daily OI change.\nImpact: extremes show leverage entering or exiting quickly, often amplifying volatility." },
  "compare.info.funding": { zh: "意义：永续资金费率代表多空支付方向和杠杆拥挤度。\n影响方向：过高偏多头拥挤，过低或负值偏空头拥挤。", en: "Meaning: perpetual funding shows payment direction and leverage crowding.\nImpact: very high funding means crowded longs; low or negative funding means crowded shorts." },
  "compare.info.ls": { zh: "意义：全市场多空账户比。\n影响方向：过高表示散户或账户端偏多拥挤，过低表示偏空拥挤。", en: "Meaning: market-wide long/short account ratio.\nImpact: very high means crowded long accounts; very low means crowded shorts." },
  "compare.info.contractLs": { zh: "意义：当前合约的多空账户比。\n影响方向：用于确认该交易对的局部仓位是否过度单边。", en: "Meaning: contract-specific long/short account ratio.\nImpact: confirms whether positioning in this pair is one-sided." },
  "compare.info.topTraderAccount": { zh: "意义：大户账户维度的多空比。\n影响方向：大户账户偏多通常支持风险偏好，但过度拥挤也会增加反向波动。", en: "Meaning: top-trader long/short ratio by accounts.\nImpact: top-trader long bias can support risk appetite, but crowding raises reversal risk." },
  "compare.info.topTraderPosition": { zh: "意义：大户仓位维度的多空比。\n影响方向：仓位比账户比更接近资金权重，极端值提示大资金拥挤。", en: "Meaning: top-trader long/short ratio by positions.\nImpact: position ratio is closer to capital weight; extremes show large-money crowding." },
  "compare.info.smartBuy": { zh: "意义：主动买入成交额，近似聪明钱买盘强度。\n影响方向：持续上升说明主动买盘增强。", en: "Meaning: taker buy volume, a proxy for smart-money buy pressure.\nImpact: sustained growth shows stronger active buying." },
  "compare.info.smartSell": { zh: "意义：主动卖出成交额，近似聪明钱卖盘强度。\n影响方向：持续上升说明主动卖盘增强。", en: "Meaning: taker sell volume, a proxy for smart-money sell pressure.\nImpact: sustained growth shows stronger active selling." },
  "compare.info.smartNet": { zh: "意义：主动买入减主动卖出的净额。\n影响方向：正值偏主动买盘占优，负值偏主动卖盘占优。", en: "Meaning: taker buy volume minus taker sell volume.\nImpact: positive favors active buyers; negative favors active sellers." },
  "compare.info.smartCum": { zh: "意义：主动净买入的累计值。\n影响方向：持续上行代表一段时间内主动资金净流入，持续下行相反。", en: "Meaning: cumulative taker net buy volume.\nImpact: rising trend means active net inflow over time; falling trend means the opposite." },
  "compare.info.fng": { zh: "意义：恐慌贪婪指数衡量加密市场情绪。\n影响方向：极度恐慌可作逆向观察，极度贪婪提示波动和回撤风险。", en: "Meaning: Fear & Greed measures broad crypto sentiment.\nImpact: extreme fear can be contrarian; extreme greed warns of volatility and pullback risk." },
  "compare.info.dvol": { zh: "意义：BTC 隐含波动率指数。\n影响方向：上升表示期权市场预期波动加大，下降表示风险溢价回落。", en: "Meaning: BTC implied-volatility index.\nImpact: rising DVOL means options expect more volatility; falling DVOL means risk premium is cooling." },
  "compare.info.hashRate": { zh: "意义：全网算力衡量矿工投入和网络安全预算。\n影响方向：算力趋势上升代表矿工扩张；急跌提示矿工压力。", en: "Meaning: network hashrate measures miner commitment and security budget.\nImpact: rising trend shows miner expansion; sharp drops warn miner stress." },
  "compare.info.difficulty": { zh: "意义：挖矿难度反映全网竞争强度。\n影响方向：难度上行提高矿工成本压力，难度下行说明算力出清。", en: "Meaning: mining difficulty reflects network competition.\nImpact: rising difficulty lifts miner cost pressure; falling difficulty shows hashrate clearing." },
  "compare.info.nTxs": { zh: "意义：每日链上交易笔数衡量网络使用量。\n影响方向：趋势上升支持采用和活跃度，单日尖峰需结合费用判断。", en: "Meaning: daily transactions measure network usage.\nImpact: rising trend supports adoption/activity; one-day spikes need fee confirmation." },
  "compare.info.activeAddrs": { zh: "意义：活跃地址数衡量链上参与度。\n影响方向：持续上升说明用户或转账活动增加；下降说明活跃度转弱。", en: "Meaning: active addresses measure on-chain participation.\nImpact: sustained growth means more users or transfers; declines show weaker activity." },
  "compare.info.mempool": { zh: "意义：Mempool 大小衡量待确认交易拥堵。\n影响方向：拥堵上升通常推高费用，也可能反映链上热度或压力。", en: "Meaning: mempool size measures pending transaction congestion.\nImpact: rising congestion usually lifts fees and can reflect activity or stress." },
  "compare.info.txFeesUsd": { zh: "意义：链上交易费总额代表区块空间需求。\n影响方向：费用上升说明需求增强，但极端上升也可能来自拥堵。", en: "Meaning: total transaction fees measure blockspace demand.\nImpact: rising fees show stronger demand, though extremes can mean congestion." },
  "compare.info.avgBlockSize": { zh: "意义：平均区块大小代表区块空间利用率。\n影响方向：上升说明链上使用更满，下降表示使用度走弱。", en: "Meaning: average block size proxies blockspace utilization.\nImpact: rising values mean fuller blocks; falling values mean weaker usage." },
  "compare.info.dxy": { zh: "意义：美元指数衡量全球美元强弱。\n影响方向：美元走强通常压制风险资产和商品，走弱则改善流动性背景。", en: "Meaning: DXY measures broad USD strength.\nImpact: stronger USD usually pressures risk assets and commodities; weaker USD improves liquidity backdrop." },
  "compare.info.us10y": { zh: "意义：美债 10 年期收益率是全球折现率核心。\n影响方向：收益率上行压制估值，回落利好长久期资产。", en: "Meaning: US 10Y yield is the global discount-rate anchor.\nImpact: rising yields pressure valuations; falling yields support duration assets." },
  "compare.info.us2y": { zh: "意义：短端利率代理市场政策利率预期。\n影响方向：短端上行代表降息预期降温，短端下行代表宽松预期升温。", en: "Meaning: short-rate proxy for market policy-rate expectations.\nImpact: rising short rates cool easing expectations; falling rates bring easing forward." },
  "compare.info.vix": { zh: "意义：VIX 衡量美股隐含波动率和风险情绪。\n影响方向：上升代表避险升温，下降代表风险偏好改善。", en: "Meaning: VIX measures equity implied volatility and risk sentiment.\nImpact: rising VIX means risk-off; falling VIX means improving risk appetite." },
  "compare.info.sp500": { zh: "意义：标普 500 代表美股大盘风险偏好。\n影响方向：上行通常利好跨资产风险情绪，下行反映避险。", en: "Meaning: S&P 500 represents broad US equity risk appetite.\nImpact: rising index supports cross-asset risk sentiment; falling index reflects risk-off." },
  "compare.info.nasdaq": { zh: "意义：纳斯达克代表科技和高久期成长资产。\n影响方向：强势通常对应流动性友好，弱势提示估值压力。", en: "Meaning: Nasdaq proxies tech and long-duration growth assets.\nImpact: strength usually means liquidity-friendly conditions; weakness signals valuation pressure." },
  "compare.info.russell": { zh: "意义：罗素 2000 代表小盘和融资敏感资产。\n影响方向：强势说明风险扩散，弱势提示信用或增长压力。", en: "Meaning: Russell 2000 proxies small caps and financing-sensitive assets.\nImpact: strength shows broader risk-taking; weakness warns of credit or growth pressure." },
  "compare.info.gold": { zh: "意义：黄金反映实际利率、美元和避险需求。\n影响方向：上行可能来自避险或实际利率下行，需结合 DXY 和收益率。", en: "Meaning: gold reflects real rates, USD and safe-haven demand.\nImpact: rising gold may mean risk hedging or lower real rates; compare with DXY and yields." },
  "compare.info.silver": { zh: "意义：白银兼具贵金属和工业属性。\n影响方向：上行可反映通胀、工业需求或风险偏好改善。", en: "Meaning: silver has both precious-metal and industrial exposure.\nImpact: upside can reflect inflation, industrial demand or stronger risk appetite." },
  "compare.info.copper": { zh: "意义：铜是全球制造业和需求周期代理。\n影响方向：上行通常利好周期资产，但也可能推升通胀预期。", en: "Meaning: copper proxies global manufacturing and demand cycle.\nImpact: rising copper supports cyclicals but can lift inflation expectations." },
  "compare.info.oil": { zh: "意义：WTI 原油衡量能源供需和通胀压力。\n影响方向：上行利好能源但抬高通胀，下行可能反映需求走弱。", en: "Meaning: WTI crude measures energy supply/demand and inflation pressure.\nImpact: rising oil helps energy but lifts inflation; falling oil may signal weaker demand." },
  "compare.info.natgas": { zh: "意义：天然气反映能源边际供需和季节性压力。\n影响方向：大幅上行会推高能源成本，下行缓解通胀压力。", en: "Meaning: natural gas reflects marginal energy demand/supply and seasonality.\nImpact: sharp rises lift energy costs; declines ease inflation pressure." },
  "compare.info.nikkei": { zh: "意义：日经 225 反映日本和亚洲风险偏好。\n影响方向：强势支持区域风险情绪，弱势提示全球资金避险。", en: "Meaning: Nikkei 225 reflects Japan and Asia risk appetite.\nImpact: strength supports regional risk sentiment; weakness warns global de-risking." },
  "compare.info.hangseng": { zh: "意义：恒生指数反映港股、中国资产和外资风险偏好。\n影响方向：上行代表中国/HK 风险偏好改善，下行提示政策或增长压力。", en: "Meaning: Hang Seng reflects Hong Kong, China assets and foreign risk appetite.\nImpact: rising index shows better China/HK risk appetite; falling index signals policy or growth stress." },
  "compare.loading": { zh: "正在加载多指标历史…", en: "Loading multi-indicator history…" },
  "compare.s.price": { zh: "BTC 价格", en: "BTC Price" },
  "compare.s.miningCost": { zh: "电力成本/枚", en: "Electricity Cost / BTC" },
  "compare.s.miningElectricityCost": { zh: "电力成本/枚", en: "Electricity Cost / BTC" },
  "compare.s.miningComprehensiveCost": { zh: "综合成本/枚", en: "Comprehensive Cost / BTC" },
  "compare.s.oi": { zh: "未平仓 OI (USD)", en: "Open Interest (USD)" },
  "compare.s.funding": { zh: "资金费率 (%)", en: "Funding Rate (%)" },
  "compare.s.ls": { zh: "多空账户比", en: "Long/Short Acct Ratio" },
  "compare.s.contractLs": { zh: "合约多空比", en: "Contract Long/Short Ratio" },
  "compare.s.topTraderAccount": { zh: "大户账户多空比", en: "Top Trader Account L/S" },
  "compare.s.topTraderPosition": { zh: "大户仓位多空比", en: "Top Trader Position L/S" },
  "compare.s.cvd": { zh: "CVD 累计差量", en: "Cumulative Volume Delta" },
  "compare.s.smartCum": { zh: "聪明钱累计净买", en: "Smart Money Cum. Net" },
  "compare.s.smartNet": { zh: "聪明钱净买入", en: "Smart Money Net" },
  "compare.s.smartBuy": { zh: "聪明钱买入", en: "Smart Money Buy" },
  "compare.s.smartSell": { zh: "聪明钱卖出", en: "Smart Money Sell" },
  "compare.seriesCount": { zh: "条曲线显示中", en: "series visible" },
  "compare.paneCount": { zh: "个面板", en: "panes" },
  "compare.legendHint": {
    zh: "点击图例可隐藏 / 显示曲线；图例数值为悬停时间点的原始读数和相对起点的 % 变动。",
    en: "Click legend items to hide / show lines. Legend values show the hovered raw reading and % change since the start of the window.",
  },
  "compare.s.ethPrice": { zh: "ETH 价格", en: "ETH Price" },
  "compare.s.solPrice": { zh: "SOL 价格", en: "SOL Price" },
  "compare.s.xrpPrice": { zh: "XRP 价格", en: "XRP Price" },
  "compare.s.bnbPrice": { zh: "BNB 价格", en: "BNB Price" },
  "compare.s.dogePrice": { zh: "DOGE 价格", en: "DOGE Price" },
  "compare.s.returnZ": { zh: "BTC 日收益 Z-Score", en: "BTC Daily Return Z-Score" },
  "compare.s.volumeUsd": { zh: "BTC 成交量 (USD)", en: "BTC Volume (USD)" },
  "compare.s.volumeZ": { zh: "BTC 成交量 Z-Score", en: "BTC Volume Z-Score" },
  "compare.s.upperWick": { zh: "上影线比例", en: "Upper Wick Ratio" },
  "compare.s.lowerWick": { zh: "下影线比例", en: "Lower Wick Ratio" },
  "compare.s.basis": { zh: "永续溢价 / Basis", en: "Perp Premium / Basis" },
  "compare.s.signalBuy": { zh: "Current Signal 买入分", en: "Current Signal Buy Score" },
  "compare.s.signalSell": { zh: "Current Signal 卖出分", en: "Current Signal Sell Score" },
  "compare.s.signalRisk": { zh: "Current Signal 风险分", en: "Current Signal Risk Score" },
  "compare.s.signalDirection": { zh: "Current Signal 方向码", en: "Current Signal Direction Code" },
  "compare.s.oiZ": { zh: "OI 日变化 Z-Score", en: "OI Daily Change Z-Score" },
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
