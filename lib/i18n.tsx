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
  "crypto.detail.back": { zh: "返回", en: "Back" },
  "crypto.detail.subtitle": { zh: "单指标历史详情，可添加多个对比指标并强制对齐时间轴。", en: "Single-indicator history detail with multi-indicator comparison on one aligned timeline." },
  "crypto.detail.search": { zh: "搜索对比指标", en: "Search comparison indicator" },
  "crypto.detail.empty": { zh: "没有可添加的指标。", en: "No indicators left to add." },
  "crypto.detail.addCompare": { zh: "添加对比", en: "Add compare" },
  "crypto.detail.chartTitle": { zh: "{label} · 详情对比", en: "{label} · Detail Compare" },
  "crypto.detail.chartInfo": { zh: "该详情图使用和总览完全相同的历史数据 payload。添加的对比指标会放在同一个图表里，X 时间轴强制使用同一组时间点。", en: "This detail chart uses the same history payload as the overview. Added comparison indicators are drawn in the same chart with a forced shared X timeline." },
  "macro.detail.back": { zh: "返回", en: "Back" },
  "macro.detail.subtitle": { zh: "单指标宏观历史详情，可添加多个对比指标并强制对齐时间轴。", en: "Single macro indicator detail with multi-indicator comparison on one aligned timeline." },
  "macro.detail.search": { zh: "搜索对比指标", en: "Search comparison indicator" },
  "macro.detail.empty": { zh: "没有可添加的指标。", en: "No indicators left to add." },
  "macro.detail.addCompare": { zh: "添加对比", en: "Add compare" },
  "macro.detail.chartTitle": { zh: "宏观指标 · 详情对比", en: "Macro Indicator · Detail Compare" },
  "macro.detail.chartInfo": { zh: "该详情图使用和宏观总览完全相同的数据合集。添加的对比指标会放在同一个图表里，X 时间轴强制使用同一组时间点。", en: "This detail chart uses the same macro indicator set as the overview. Added comparison indicators are drawn in the same chart with a forced shared X timeline." },
  "stock.detail.back": { zh: "返回", en: "Back" },
  "stock.detail.subtitle": { zh: "单指标股票/市场历史详情，可添加多个对比指标并强制对齐时间轴。", en: "Single stock or market indicator detail with multi-indicator comparison on one aligned timeline." },
  "stock.detail.search": { zh: "搜索对比指标", en: "Search comparison indicator" },
  "stock.detail.empty": { zh: "没有可添加的指标。", en: "No indicators left to add." },
  "stock.detail.addCompare": { zh: "添加对比", en: "Add compare" },
  "stock.detail.chartTitle": { zh: "股票指标 · 详情对比", en: "Stock Indicator · Detail Compare" },
  "stock.detail.chartInfo": { zh: "该详情图使用和股票总览完全相同的数据合集。添加的对比指标会放在同一个图表里，X 时间轴强制使用同一组时间点。", en: "This detail chart uses the same stock indicator set as the overview. Added comparison indicators are drawn in the same chart with a forced shared X timeline." },
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
  "regime.label": { zh: "{ccy} 多时框架", en: "{ccy} Multi-TF Score" },
  "regime.aria.loading": { zh: "{ccy} 多时框架指数载入中", en: "{ccy} multi-timeframe score loading" },
  "regime.aria.error": {
    zh: "{ccy} 多时框架指数不可用，悬停旁侧信息图标查看原因",
    en: "{ccy} multi-timeframe score unavailable. Hover the info icon for details.",
  },
  "regime.aria.value": { zh: "{ccy} 多时框架指数 {value}", en: "{ccy} multi-timeframe score {value}" },
  "regime.aria.idle": { zh: "{ccy} 多时框架指数", en: "{ccy} multi-timeframe score" },
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

  // Black Swan opportunity card
  "blackSwan.label": { zh: "{ccy} 黑天鹅机会", en: "{ccy} Black Swan Opportunity" },
  "blackSwan.aria.loading": { zh: "{ccy} 黑天鹅机会指数载入中", en: "{ccy} black-swan opportunity loading" },
  "blackSwan.aria.value": { zh: "{ccy} 黑天鹅机会指数 {value}", en: "{ccy} black-swan opportunity {value}" },
  "blackSwan.aria.idle": { zh: "{ccy} 黑天鹅机会指数", en: "{ccy} black-swan opportunity" },
  "blackSwan.hover.aria": {
    zh: "悬停查看：当前激活信号、分项权重与近期插针事件",
    en: "Hover for active signals, factor weights, and recent wick events",
  },
  "blackSwan.hover.loading": { zh: "载入中…", en: "Loading…" },
  "blackSwan.hover.refreshHint": { zh: "约 60 秒自动刷新", en: "Auto-refresh every 60s" },
  "blackSwan.hover.activeTitle": { zh: "当前触发信号", en: "Active signals" },
  "blackSwan.hover.factorsTitle": { zh: "分项实时值与权重", en: "Live factor values & weights" },
  "blackSwan.hover.wicksTitle": { zh: "近期下影线事件 + 24h 反弹", en: "Recent lower-wick events · 24h rebound" },
  "blackSwan.hover.modelTitle": { zh: "评分模型说明", en: "Scoring model notes" },

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
    zh: "按指标类型把 BTC / 加密 / 宏观时间序列聚合到纵向图表中；每个图表都显示同一套 X 时间轴，并用统一的左右时间边界保持对齐。OI / 多空等仓位指标只在公开源覆盖当前时间范围时展示，避免只显示局部区间。悬停任一图表，其余图表会同步到同一时间点；点击图例可独立显示 / 隐藏曲线。",
    en: "Groups BTC / crypto / macro time series by metric type into a vertical chart stack. Every chart shows the same X time axis and uses the same left / right time bounds, so all panes stay aligned. OI and long/short positioning lines are shown only when the public source covers the selected range, avoiding partial-window plots. Hover any chart to sync the rest to the same date; click legend items to hide / show lines.",
  },
  "compare.info.default": {
    zh: "优先级：辅助\n意义：{label} 的最新读数和历史曲线。\n与 BTC：建议用日/周收益率做相关，避免价格水平共趋势造成伪相关。\n影响方向：结合相邻指标看趋势、拥挤度和风险偏好。",
    en: "Priority: auxiliary\nMeaning: latest reading and history for {label}.\nVs BTC: correlate on daily/weekly returns, not price levels, to avoid spurious trend correlation.\nImpact: combine with nearby indicators to judge trend, crowding and risk appetite.",
  },
  "compare.info.btcPrice": { zh: "优先级：S 级（核心驱动）\n意义：{ccy} 现货/永续价格是当前资产看板的核心锚，一切判断从这里出发。\n与 {ccy}：基准序列本身。\n影响方向：趋势上行改善风险偏好；跌破关键支撑或均线时风险升高。\n实战：优先看价格结构 + 成交量确认，再叠加衍生品和宏观。", en: "Priority: S-tier (core driver)\nMeaning: {ccy} spot/perp price is the dashboard anchor for the selected asset.\nVs {ccy}: the baseline series.\nImpact: uptrends support risk appetite; breaks below key support or averages raise risk.\nPractice: start with price structure + volume, then add derivatives and macro." },
  "compare.info.btcMomentum7d": { zh: "优先级：S 级（量化动量）\n意义：{ccy} 7 日收益率，衡量短周期趋势加速。\n与 {ccy}：由价格收益率计算，适合观察短线动量和反转风险。\n影响方向：持续为正说明短线风险偏好强；极端过高后需警惕回吐。\n实战：与 30D/90D 动量同向时趋势质量更好，背离时降低权重。", en: "Priority: S-tier (quant momentum)\nMeaning: {ccy} 7-day return, a short-horizon trend acceleration gauge.\nVs {ccy}: derived from selected-asset returns; useful for short-term momentum/reversal risk.\nImpact: persistently positive = short-term risk appetite; extreme highs raise giveback risk.\nPractice: stronger when aligned with 30D/90D momentum; lower confidence on divergence." },
  "compare.info.btcMomentum30d": { zh: "优先级：S 级（量化动量）\n意义：{ccy} 30 日收益率，对应加密和传统市场研究中最常用的中短期趋势窗口之一。\n与 {ccy}：直接衡量时间序列动量。\n影响方向：上行表示趋势延续概率改善；下行或转负提示动量衰减。\n实战：优先与成交量、波动率和 funding 交叉验证。", en: "Priority: S-tier (quant momentum)\nMeaning: {ccy} 30-day return, one of the common short/medium trend windows in crypto and traditional market studies.\nVs {ccy}: direct time-series momentum measure.\nImpact: rising supports trend continuation; falling/negative warns momentum decay.\nPractice: confirm with volume, realized volatility and funding." },
  "compare.info.btcMomentum90d": { zh: "优先级：S 级（量化动量）\n意义：{ccy} 90 日收益率，衡量中期趋势和周期位置。\n与 {ccy}：比 7D/30D 更慢，适合过滤噪音。\n影响方向：中期动量转正有利于趋势跟随；转负说明风险周期转弱。\n实战：用于判断仓位方向的背景条件，而不是单独择时。", en: "Priority: S-tier (quant momentum)\nMeaning: {ccy} 90-day return, a medium-term trend/cycle gauge.\nVs {ccy}: slower than 7D/30D and filters noise.\nImpact: positive medium-term momentum supports trend following; negative warns a weaker risk cycle.\nPractice: use as position-bias context, not a standalone timing signal." },
  "compare.info.btcRealizedVol30d": { zh: "优先级：S 级（风险控制）\n意义：{ccy} 30 日实现波动率，按日对数收益率年化计算。\n与 {ccy}：与收益方向不固定，但与清算、仓位规模和风险预算高度相关。\n影响方向：波动率上升代表风险预算收缩和止损距离变大；下降代表趋势更容易承载仓位。\n实战：量化交易中用于仓位缩放、风险目标和趋势过滤。", en: "Priority: S-tier (risk control)\nMeaning: {ccy} 30-day realized volatility, annualized from daily log returns.\nVs {ccy}: not directional, but tightly linked to liquidation risk, sizing and risk budgets.\nImpact: rising vol means smaller risk budgets/wider stops; falling vol makes trends easier to size.\nPractice: core for volatility targeting, risk sizing and trend filters." },
  "compare.info.btcDrawdown": { zh: "优先级：S 级（风险控制）\n意义：{ccy} 从窗口内历史高点回撤百分比。\n与 {ccy}：直接衡量价格路径风险。\n影响方向：回撤加深表示趋势损伤和风险偏好下降；回撤修复说明风险偏好恢复。\n实战：结合动量判断是正常回撤还是趋势破坏。", en: "Priority: S-tier (risk control)\nMeaning: {ccy} percentage drawdown from the running high in the selected window.\nVs {ccy}: direct path-risk measure.\nImpact: deeper drawdown means trend damage and weaker risk appetite; recovery means risk appetite improving.\nPractice: pair with momentum to distinguish normal pullbacks from trend breaks." },
  "compare.info.miningElectricityCost": { zh: "优先级：B 级（中长期辅助）\n意义：按全网算力、ASIC 能效和电价估算每枚 BTC 的电力成本。\n与 BTC：与价格水平长期相关，日收益率相关弱，不适合短线择时。\n影响方向：价格接近或跌破电力成本时，矿机关机和算力出清风险上升。\n实战：用于判断长期安全边际和矿工 capitulation 区间，非核心交易信号。", en: "Priority: B-tier (medium/long-term)\nMeaning: estimated electricity cost per BTC from hashrate, ASIC efficiency and power price.\nVs BTC: correlates with price level over long horizons; weak on daily returns for timing.\nImpact: price near/below this line raises miner shutdown and hashrate capitulation risk.\nPractice: use for long-term floor zones, not core short-term signals." },
  "compare.info.miningComprehensiveCost": { zh: "优先级：B 级（中长期辅助）\n意义：电力成本乘以综合系数，覆盖折旧、托管和运营费用。\n与 BTC：与价格水平长期相关，日收益率相关弱。\n影响方向：价格跌破综合成本通常压缩矿工利润和新增资本开支。\n实战：判断矿工长期盈亏线和 capitulation 区域，配合 hashRate 看算力出清。", en: "Priority: B-tier (medium/long-term)\nMeaning: electricity cost × comprehensive factor for depreciation, hosting and ops.\nVs BTC: long-horizon price-level link; weak daily-return correlation.\nImpact: price below this line squeezes miner margins and capex.\nPractice: long-term miner P&L floor; pair with hashRate for capitulation reads." },
  "compare.info.ethPrice": { zh: "优先级：A 级\n意义：ETH 代表智能合约赛道和加密内部风险偏好。\n与 BTC：日/周收益率联动较强，ETH/BTC 走强常意味着资金愿意承担更高 Beta。\n影响方向：ETH 领涨支持牛市扩散；ETH 弱于 BTC 提示风险偏好退潮。\n实战：看 ETH 是否同步领涨，判断山寨和风险扩散阶段。", en: "Priority: A-tier\nMeaning: ETH proxies smart-contract beta and intra-crypto risk appetite.\nVs BTC: daily/weekly returns move together; ETH/BTC strength shows higher-beta appetite.\nImpact: ETH leadership supports alt expansion; ETH lag warns risk appetite fading.\nPractice: watch whether ETH leads BTC to gauge alt/risk-on diffusion." },
  "compare.info.solPrice": { zh: "优先级：C 级（环境变量，从 A 级下调）\n意义：SOL 是高 Beta 公链叙事代理，但对 BTC 收益率预测几乎无独立 alpha。研究依据：Bianchi-Tamoni (2022) 发现主流山寨币收益率主要由 BTC 共同 beta 驱动，独立于 BTC 的预测因子信号微弱；降为 C 级环境变量。\n与 BTC：日/周收益率联动中高，但方向几乎同步，不提供额外领先信号。\n影响方向：SOL 强势反映山寨风险偏好扩散，是 BTC 牛市扩散的结果而非原因。\n实战：观察 SOL/ETH/BTC 同步性，判断市场是否进入普涨阶段；不适合作为 BTC 领先信号。", en: "Priority: C-tier (environmental; demoted from A-tier)\nMeaning: SOL proxies high-beta L1 narrative flows, but carries almost no standalone alpha for BTC return prediction. Research: Bianchi-Tamoni (2022) finds major altcoin returns are primarily driven by shared BTC beta, with weak independent predictive factors.\nVs BTC: moderate-to-high daily/weekly return co-movement, but nearly synchronous—no meaningful lead.\nImpact: SOL strength reflects alt risk diffusion, a lagging consequence of BTC bull momentum rather than a cause.\nPractice: use SOL/ETH/BTC sync to gauge whether a broad alt season is underway—not as a BTC leading signal." },
  "compare.info.xrpPrice": { zh: "优先级：C 级（环境变量）\n意义：XRP 是大型支付叙事资产，反映主题资金活跃度。\n与 BTC：日收益率相关偏弱，更多受自身叙事驱动。\n影响方向：异常强势反映主题资金活跃；弱势提示大盘外资金收缩。\n实战：辅助观察，不宜作为 BTC 核心驱动。", en: "Priority: C-tier (environmental)\nMeaning: XRP proxies large-cap payment-token thematic flows.\nVs BTC: weak daily-return link; more narrative-driven.\nImpact: unusual strength shows thematic capital; weakness shows flow contraction.\nPractice: supplementary only—not a core BTC driver." },
  "compare.info.bnbPrice": { zh: "优先级：B 级\n意义：BNB 反映交易所生态和平台币风险偏好。\n与 BTC：日收益率中等相关，与交易活跃度关联更紧。\n影响方向：BNB 上行通常表示 CEX 交易活跃和生态情绪改善。\n实战：观察 BNB 是否同步，判断场内交易热度。", en: "Priority: B-tier\nMeaning: BNB reflects exchange-ecosystem and platform-token appetite.\nVs BTC: moderate daily-return correlation; tied to trading activity.\nImpact: rising BNB usually means hotter CEX activity and ecosystem sentiment.\nPractice: use BNB as a venue-activity cross-check." },
  "compare.info.dogePrice": { zh: "优先级：C 级（环境变量）\n意义：DOGE 是散户投机和 Meme 风险偏好的代理。\n与 BTC：日收益率相关偏弱，极端行情时波动更大。\n影响方向：异常强势常表示投机升温；急跌提示散户情绪退潮。\n实战：可作为散户 FOMO/退潮的辅助观察，非核心信号。", en: "Priority: C-tier (environmental)\nMeaning: DOGE proxies retail speculation and meme risk appetite.\nVs BTC: weak daily-return link; amplifies in extreme regimes.\nImpact: unusual strength suggests speculative heat; sharp drops warn retail fading.\nPractice: supplementary retail-sentiment gauge, not a core BTC driver." },
  "compare.info.btcReturnZ": { zh: "优先级：S 级（核心驱动）\n意义：{ccy} 日收益相对近期波动的 Z-Score，衡量价格冲击是否异常。\n与 {ccy}：由 {ccy} 收益率直接计算，是短线最有效的异常检测之一。\n影响方向：极端正值偏过热/追多；极端负值偏恐慌/清算。\n实战：底部组合看极低 returnZ + funding 转负 + OI 清洗 + FNG 极度恐惧。", en: "Priority: S-tier (core driver)\nMeaning: {ccy} daily-return Z-score vs recent volatility.\nVs {ccy}: derived from selected-asset returns, one of the best short-term anomaly detectors.\nImpact: extreme positive = overheating; extreme negative = panic/liquidation.\nPractice: bottom setup = very low returnZ + negative funding + OI flush + extreme fear." },
  "compare.info.btcVolumeZ": { zh: "优先级：S 级（核心驱动）\n意义：{ccy} 成交量相对近期均值的标准化异常程度。\n与 {ccy}：与 {ccy} 日收益率联动，放量突破/反转信号更可靠。\n影响方向：放量配合趋势强化方向；放量反转常提示清算或吸筹。\n实战：新高但 volumeZ 背离是顶部风险信号之一。", en: "Priority: S-tier (core driver)\nMeaning: standardized abnormality of {ccy} volume vs recent history.\nVs {ccy}: links to selected-asset daily returns; volume confirms breakouts/reversals.\nImpact: volume aligned with trend strengthens direction; volume on reversal may signal liqs/accumulation.\nPractice: new highs with falling volumeZ is a top-risk warning." },
  "compare.info.btcVolumeUsd": { zh: "优先级：S 级（核心驱动）\n意义：{ccy} 永续日成交额，衡量场内换手和博弈强度。\n与 {ccy}：与价格变动和波动同步，是趋势确认的基础指标。\n影响方向：成交放大说明博弈升温；缩量说明方向信号不足。\n实战：看涨需「放量上涨」；看跌警惕「放量下跌」或「缩量反弹」。", en: "Priority: S-tier (core driver)\nMeaning: {ccy} perpetual daily traded notional.\nVs {ccy}: moves with price action and volatility, core trend confirmation.\nImpact: higher turnover = hotter positioning; thin volume weakens signals.\nPractice: bullish = rising price + rising volume; bearish = rising volume on declines or weak bounces." },
  "compare.info.basis": { zh: "优先级：S 级（核心驱动）\n意义：{ccy} 永续价格相对现货的溢价（Basis）。\n与 {ccy}：与 {ccy} 日收益率和杠杆偏好高度相关。\n影响方向：正溢价扩大偏多头拥挤/风险偏好强；负溢价偏避险或空头压力。\n实战：顶部风险组合：新高 + basis 过热 + funding 极高 + OI 创高。", en: "Priority: S-tier (core driver)\nMeaning: {ccy} perpetual premium vs spot (basis).\nVs {ccy}: closely tied to selected-asset daily returns and leverage appetite.\nImpact: wider positive basis = crowded longs/strong risk appetite; negative = risk-off or short pressure.\nPractice: top-risk combo = new high + overheated basis + extreme funding + record OI." },
  "compare.info.upperWick": { zh: "优先级：S 级（价格结构）\n意义：{ccy} 日 K 上影线占振幅比例，衡量上方拒绝强度。\n与 {ccy}：与 {ccy} 日收益率结构直接相关。\n影响方向：高上影常表示上方抛压、追多失败或多头陷阱。\n实战：上涨后出现高上影 + 高 volumeZ + 高 funding，回落风险升高。", en: "Priority: S-tier (price structure)\nMeaning: {ccy} upper wick share of daily range.\nVs {ccy}: directly reflects selected-asset daily return structure.\nImpact: high upper wick = overhead supply, failed long chase or bull trap.\nPractice: high upper wick + high volumeZ + high funding after rally raises pullback risk." },
  "compare.info.lowerWick": { zh: "优先级：S 级（价格结构）\n意义：{ccy} 日 K 下影线占振幅比例，衡量下方承接强度。\n与 {ccy}：与 {ccy} 日收益率结构直接相关。\n影响方向：高下影常表示下方承接、空头回补或恐慌吸筹。\n实战：大跌后高下影 + 负 funding + OI 下降，底部区域信号更充分。", en: "Priority: S-tier (price structure)\nMeaning: {ccy} lower wick share of daily range.\nVs {ccy}: directly reflects selected-asset daily return structure.\nImpact: high lower wick = demand below, short covering or panic absorption.\nPractice: high lower wick + negative funding + falling OI after selloff improves bottom-zone read." },
  "compare.info.signalBuyScore": {
    zh: "优先级：自定义（需回测验证）\n自定义信号：Buy Score（0-100）\n\n数据源：OKX {ccy} 日 K 线、OKX {ccy} 永续 Open Interest、OKX {ccy} 资金费率、OKX {ccy} 多空账户比。\n\n输入数据：{ccy} 日收益 Z-Score 衡量价格跌幅是否极端；下影线比例衡量下方承接；成交量 Z-Score 衡量是否放量；OI 日变化衡量杠杆是否出清；Funding 衡量多空支付方向；多空账户比衡量仓位拥挤方向。\n\n计算方法：Buy = min(100, returnZ < -2.5 ? 24 : 0 + lowerWick > 55 ? 20 : 0 + volumeZ > 2.5 ? 18 : 0 + oiChange < -2% ? 20 : 0 + funding < 0 ? 8 : 0 + longShort < 0.85 ? 10 : 0)。\n\n参考方式：高分表示恐慌下跌、放量、下影线、杠杆出清和空头拥挤同时出现，反弹条件更充分；需样本外和牛熊分段验证，不是直接买入指令。",
    en: "Priority: custom (backtest required)\nCustom signal: Buy Score (0-100)\n\nSources: OKX {ccy} daily candles, OKX {ccy} perpetual open interest, OKX {ccy} funding rate, and OKX {ccy} long/short account ratio.\n\nInputs: {ccy} daily-return Z-score detects extreme downside; lower-wick ratio measures dip demand; volume Z-score measures abnormal activity; OI daily change tracks leverage clearing; funding measures payment direction; long/short ratio measures crowding.\n\nFormula: Buy = min(100, returnZ < -2.5 ? 24 : 0 + lowerWick > 55 ? 20 : 0 + volumeZ > 2.5 ? 18 : 0 + oiChange < -2% ? 20 : 0 + funding < 0 ? 8 : 0 + longShort < 0.85 ? 10 : 0).\n\nHow to use: high score means panic downside, volume, lower wick, leverage clearing and short crowding align. Validate out-of-sample across regimes—it is not a direct buy order.",
  },
  "compare.info.signalSellScore": {
    zh: "优先级：自定义（需回测验证）\n自定义信号：Sell Score（0-100）\n\n数据源：OKX {ccy} 日 K 线、OKX {ccy} 永续 Open Interest、OKX {ccy} 资金费率、OKX {ccy} 多空账户比。\n\n输入数据：{ccy} 日收益 Z-Score 衡量上涨是否极端；上影线比例衡量上方抛压；成交量 Z-Score 衡量是否放量；OI 日变化衡量杠杆是否快速变化；Funding 衡量多头付费拥挤；多空账户比衡量多头账户拥挤。\n\n计算方法：Sell = min(100, returnZ > 2.5 ? 24 : 0 + upperWick > 55 ? 20 : 0 + volumeZ > 2.5 ? 18 : 0 + oiChange < -2% ? 16 : 0 + funding > 0.05% ? 10 : 0 + longShort > 1.25 ? 12 : 0)。\n\n参考方式：高分表示上涨后出现放量、上影线、多头拥挤或杠杆波动，回落风险升高；需样本外验证，更适合做减仓/止盈提示。",
    en: "Priority: custom (backtest required)\nCustom signal: Sell Score (0-100)\n\nSources: OKX {ccy} daily candles, OKX {ccy} perpetual open interest, OKX {ccy} funding rate, and OKX {ccy} long/short account ratio.\n\nInputs: {ccy} daily-return Z-score detects extreme upside; upper-wick ratio measures overhead supply; volume Z-score measures abnormal activity; OI daily change tracks fast leverage movement; funding measures crowded long payments; long/short ratio measures long-account crowding.\n\nFormula: Sell = min(100, returnZ > 2.5 ? 24 : 0 + upperWick > 55 ? 20 : 0 + volumeZ > 2.5 ? 18 : 0 + oiChange < -2% ? 16 : 0 + funding > 0.05% ? 10 : 0 + longShort > 1.25 ? 12 : 0).\n\nHow to use: high score means upside vulnerability through volume, upper wick, long crowding or leverage movement. Validate out-of-sample; use for trimming/taking profit, not blind shorts.",
  },
  "compare.info.signalRiskScore": {
    zh: "优先级：自定义（需回测验证）\n自定义信号：Risk Score（0-100）\n\n数据源：OKX {ccy} 日 K 线、OKX {ccy} 永续 Open Interest、OKX {ccy} 资金费率、OKX {ccy} 多空账户比。\n\n输入数据：收益 Z-Score 代表价格冲击强度；成交量 Z-Score 代表成交异常；OI 日变化代表杠杆增减速度；Funding 代表资金费率极端程度；多空账户比偏离 1 的程度代表仓位方向拥挤。\n\n计算方法：Risk = min(100, abs(returnZ) * 10 + max(volumeZ, 0) * 5 + abs(oiChange%) * 3 + abs(funding%) * 100 + abs(longShort - 1) * 20)。\n\n参考方式：高分优先表示波动和清算风险升高，不代表方向。Risk 高于 Buy/Sell 时 Direction 优先显示风险状态。",
    en: "Priority: custom (backtest required)\nCustom signal: Risk Score (0-100)\n\nSources: OKX {ccy} daily candles, OKX {ccy} perpetual open interest, OKX {ccy} funding rate, and OKX {ccy} long/short account ratio.\n\nInputs: return Z-score captures price shock; volume Z-score captures abnormal activity; OI daily change captures leverage speed; funding captures extreme payment pressure; distance of long/short ratio from 1 captures directional crowding.\n\nFormula: Risk = min(100, abs(returnZ) * 10 + max(volumeZ, 0) * 5 + abs(oiChange%) * 3 + abs(funding%) * 100 + abs(longShort - 1) * 20).\n\nHow to use: high score means volatility and liquidation risk are elevated, not necessarily bullish or bearish. When Risk dominates Buy/Sell, Direction prioritizes risk state.",
  },
  "compare.info.signalDirection": {
    zh: "优先级：自定义（需回测验证）\n自定义信号：Direction Code\n\n数据源：来自同一套 Buy / Sell / Risk 三个自定义分数。\n\n计算方法：如果 Risk >= 70，则 Direction = 2（风险优先）；否则 Buy >= 70，则 Direction = 1（偏买）；否则 Sell >= 70，则 Direction = -1（偏卖）；否则 Direction = 0（中性）。\n\n参考方式：Direction 用于快速阅读状态，不应单独交易。2=先控风险；1=恐慌反弹条件较好；-1=过热回落风险较高；0=信号不够极端。",
    en: "Priority: custom (backtest required)\nCustom signal: Direction Code\n\nSources: the same Buy, Sell and Risk custom scores.\n\nFormula: if Risk >= 70, Direction = 2 (risk first); else if Buy >= 70, Direction = 1 (buy bias); else if Sell >= 70, Direction = -1 (sell bias); otherwise Direction = 0 (neutral).\n\nHow to use: Direction is a fast state label, not a standalone trade. 2 = control risk first; 1 = better rebound setup after panic; -1 = overheating/pullback risk; 0 = no extreme signal.",
  },
  "compare.info.stablecoinMcap": { zh: "优先级：S 级（核心驱动）\n意义：稳定币总市值，近似加密场内的「现金池」和潜在购买力。\n与 BTC：日/周收益率正相关，扩张期对 BTC 更友好。\n影响方向：持续上升通常利好风险资产；萎缩提示资金撤出或风险偏好下降。\n实战：看涨组合需 stablecoinMcap 同步上升；底部区域看稳定币未大幅流出。", en: "Priority: S-tier (core driver)\nMeaning: stablecoin market cap—the on-venue \"cash pool\" and latent buying power.\nVs BTC: positive daily/weekly return correlation; expansion supports BTC.\nImpact: sustained growth supports risk assets; contraction warns capital leaving or risk-off.\nPractice: bullish combo needs rising stablecoinMcap; bottom zone = no major stablecoin outflow." },
  "compare.info.defiTvl": { zh: "优先级：A 级\n意义：DeFi 总锁仓量，反映链上资本沉淀和杠杆规模。\n与 BTC：日收益率中等相关，更适合看中周期风险偏好。\n影响方向：TVL 扩张通常对应风险偏好改善；收缩代表去杠杆。\n实战：与 stablecoinMcap 一起看场内/链上流动性是否同步扩张。", en: "Priority: A-tier\nMeaning: DeFi TVL reflects on-chain capital commitment and leverage scale.\nVs BTC: moderate daily-return correlation; better for medium-term risk appetite.\nImpact: TVL expansion supports risk-on; contraction means deleveraging.\nPractice: pair with stablecoinMcap to see if venue + on-chain liquidity expand together." },
  "compare.info.oi": { zh: "优先级：S 级（核心驱动）\n意义：{ccy} 未平仓合约价值，衡量杠杆仓位总规模。\n与 {ccy}：与 {ccy} 日收益率和波动高度相关，合约市场常放大价格波动。\n影响方向：OI 快速上升增加清算风险；需与价格同向才确认趋势。\n实战：OI↑+价格↑+funding 温和=健康趋势；OI↑+价格↓=去杠杆/瀑布风险。", en: "Priority: S-tier (core driver)\nMeaning: {ccy} open interest measures total leveraged position size.\nVs {ccy}: closely tied to selected-asset daily returns and volatility; perps amplify moves.\nImpact: fast OI growth raises liquidation risk; needs price alignment for trend confirmation.\nPractice: OI↑ + price↑ + moderate funding = healthy trend; OI↑ + price↓ = deleveraging/cascade risk." },
  "compare.info.oiChangePct": { zh: "优先级：S 级（衍生品杠杆）\n意义：{ccy} OI 日变化率，直接衡量杠杆仓位扩张或出清速度。\n与 {ccy}：与波动和清算风险联动强，尤其在突破和瀑布行情中。\n影响方向：价格上涨且 OI 上升通常确认趋势；价格下跌且 OI 快速下降说明去杠杆。\n实战：与 funding、basis 和成交量一起判断趋势是否健康。", en: "Priority: S-tier (derivatives leverage)\nMeaning: {ccy} daily OI change rate, a direct speed gauge for leverage expansion/clearing.\nVs {ccy}: strongly linked to volatility and liquidation risk, especially breakouts/cascades.\nImpact: price up + OI up usually confirms trend; price down + OI down means deleveraging.\nPractice: read with funding, basis and volume to judge trend health." },
  "compare.info.oiReturnZ": { zh: "优先级：S 级（核心驱动）\n意义：{ccy} OI 日变化的标准化异常程度，捕捉杠杆快速进出。\n与 {ccy}：与 {ccy} 日收益率和波动联动，极端值常出现在清算前后。\n影响方向：极端正值=杠杆快速涌入；极端负值=杠杆清洗/去杠杆。\n实战：底部区域看 OI 被清洗（oiReturnZ 极低）；顶部警惕 OI 创高 + funding 极高。", en: "Priority: S-tier (core driver)\nMeaning: standardized abnormality of {ccy} daily OI change.\nVs {ccy}: links to selected-asset daily returns/volatility; extremes often around liquidations.\nImpact: extreme positive = fast leverage in; extreme negative = leverage flush.\nPractice: bottom zone = OI flushed (low oiReturnZ); top risk = record OI + extreme funding." },
  "compare.info.funding": { zh: "优先级：S 级（核心驱动）\n意义：{ccy} 永续资金费率，反映多空支付方向和杠杆拥挤度。\n与 {ccy}：与 {ccy} 日收益率和 OI 变化高度相关。\n影响方向：过高=多头拥挤/追多过热；过低或负值=空头拥挤。\n实战：顶部风险=funding 极高 + basis 过热 + FNG 极度贪婪；底部=funding 转负 + OI 清洗。", en: "Priority: S-tier (core driver)\nMeaning: {ccy} perpetual funding shows payment direction and leverage crowding.\nVs {ccy}: closely tied to selected-asset daily returns and OI changes.\nImpact: very high = crowded longs/overheated chase; low/negative = crowded shorts.\nPractice: top risk = extreme funding + overheated basis + extreme greed; bottom = negative funding + OI flush." },
  "compare.info.ls": { zh: "优先级：A 级\n意义：{ccy} 全市场多空账户比，反映账户端仓位方向拥挤。\n与 {ccy}：日收益率负相关常见（散户反向指标特征）。\n影响方向：过高=偏多拥挤；过低=偏空拥挤。\n实战：与 contractLs、topTraderPosition 交叉验证，避免单一比率误判。", en: "Priority: A-tier\nMeaning: {ccy} market-wide long/short account ratio.\nVs {ccy}: often negatively correlated on daily returns (retail contrarian trait).\nImpact: very high = crowded long accounts; very low = crowded shorts.\nPractice: cross-check with contractLs and topTraderPosition, do not rely on one ratio alone." },
  "compare.info.contractLs": { zh: "优先级：A 级\n意义：当前 {ccy} 合约的多空账户比，比全市场 ls 更聚焦。\n与 {ccy}：日收益率相关中高，极端值提示局部单边拥挤。\n影响方向：确认该交易对是否过度偏多或偏空。\n实战：OI 上升时配合 contractLs 极端值，判断逼空或瀑布风险。", en: "Priority: A-tier\nMeaning: {ccy} contract long/short account ratio, more focused than market-wide ls.\nVs {ccy}: moderate-to-high daily-return correlation; extremes show one-sided crowding.\nImpact: confirms whether this pair is overly long or short.\nPractice: with rising OI, extreme contractLs helps judge squeeze or cascade risk." },
  "compare.info.topTraderAccount": { zh: "优先级：A 级\n意义：{ccy} 大户账户维度的多空比。\n与 {ccy}：日收益率相关，但大户可反向布局，不宜机械跟随。\n影响方向：大户偏多支持风险偏好，但过度拥挤也增加反向波动。\n实战：与 topTraderPosition（仓位维度）对比，看账户数和资金是否一致。", en: "Priority: A-tier\nMeaning: {ccy} top-trader long/short ratio by account count.\nVs {ccy}: daily-return correlation; top traders can position counter-trend, do not follow blindly.\nImpact: top-trader long bias supports risk appetite; crowding raises reversal risk.\nPractice: compare with topTraderPosition (by size) to see if accounts and capital align." },
  "compare.info.topTraderPosition": { zh: "优先级：A 级\n意义：{ccy} 大户仓位维度的多空比，比账户比更接近真实资金权重。\n与 {ccy}：日收益率相关中高，是衍生品杠杆组核心指标之一。\n影响方向：极端值提示大资金方向拥挤，容易触发反向波动。\n实战：OI↑ + topTraderPosition 极端 + funding 高 = 逼空/瀑布双向风险。", en: "Priority: A-tier\nMeaning: {ccy} top-trader long/short ratio by position size, closer to capital weight.\nVs {ccy}: moderate-to-high daily-return correlation; core derivatives metric.\nImpact: extremes show large-money directional crowding and reversal risk.\nPractice: OI↑ + extreme topTraderPosition + high funding = squeeze/cascade two-way risk." },
  "compare.info.smartBuy": { zh: "优先级：自定义（需回测验证）\n意义：{ccy} 主动买入成交额（Taker Buy），近似聪明钱买盘强度。\n与 {ccy}：与 {ccy} 日收益率有一定联动，但需验证样本外有效性。\n影响方向：持续上升说明主动买盘增强。\n实战：配合 smartNet/smartCum 看方向，不宜单独作为交易依据。", en: "Priority: custom (backtest required)\nMeaning: {ccy} taker buy volume, a proxy for active buy pressure.\nVs {ccy}: some daily-return linkage; validate out-of-sample before trusting.\nImpact: sustained growth shows stronger active buying.\nPractice: pair with smartNet/smartCum for direction, do not trade on this alone." },
  "compare.info.smartSell": { zh: "优先级：自定义（需回测验证）\n意义：{ccy} 主动卖出成交额（Taker Sell），近似聪明钱卖盘强度。\n与 {ccy}：与 {ccy} 日收益率有一定联动，需回测验证。\n影响方向：持续上升说明主动卖盘增强。\n实战：配合 smartNet 看净方向，注意与价格背离时的含义。", en: "Priority: custom (backtest required)\nMeaning: {ccy} taker sell volume, a proxy for active sell pressure.\nVs {ccy}: some daily-return linkage; needs backtest validation.\nImpact: sustained growth shows stronger active selling.\nPractice: pair with smartNet; watch divergences vs price." },
  "compare.info.smartNet": { zh: "优先级：自定义（需回测验证）\n意义：{ccy} 主动买入减主动卖出的日净额。\n与 {ccy}：日收益率相关，正值偏主动买盘占优。\n影响方向：正值=主动买盘占优；负值=主动卖盘占优。\n实战：趋势中 smartNet 与价格同向更可靠；背离需警惕。", en: "Priority: custom (backtest required)\nMeaning: {ccy} daily taker buy minus taker sell.\nVs {ccy}: daily-return correlation; positive favors active buyers.\nImpact: positive = buyers dominate; negative = sellers dominate.\nPractice: in trends, smartNet aligned with price is more reliable; divergences warn." },
  "compare.info.smartCum": { zh: "优先级：自定义（需回测验证）\n意义：{ccy} 主动净买入的累计值，反映一段时间内的资金流向。\n与 {ccy}：与 {ccy} 周收益率相关更稳定，适合看中周期。\n影响方向：持续上行=主动资金净流入；持续下行=净流出。\n实战：看 cumulative 趋势拐点，而非单日读数。", en: "Priority: custom (backtest required)\nMeaning: {ccy} cumulative taker net buy, flow over time.\nVs {ccy}: weekly returns often correlate more stably than daily.\nImpact: rising = active net inflow; falling = net outflow.\nPractice: watch cumulative trend inflections, not single-day readings." },
  "compare.info.fng": { zh: "优先级：A 级\n意义：Crypto Fear & Greed Index，衡量市场整体情绪。\n与 BTC：日收益率正相关，更适合做反向/极端情绪指标。\n影响方向：极度恐惧=潜在底部区域观察；极度贪婪=波动和回撤风险升高。\n实战：底部组合=FNG 极度恐惧 + returnZ 极低 + funding 转负；顶部=FNG 极度贪婪 + funding 极高。", en: "Priority: A-tier\nMeaning: Crypto Fear & Greed Index—broad market sentiment.\nVs BTC: positive daily-return correlation; best as contrarian/extreme-sentiment gauge.\nImpact: extreme fear = watch for bottom zone; extreme greed = volatility/pullback risk.\nPractice: bottom = extreme fear + low returnZ + negative funding; top = extreme greed + high funding." },
  "compare.info.dvol": { zh: "优先级：S 级（波动率驱动）\n意义：Deribit BTC 30 天隐含波动率指数，反映期权市场对未来波动的定价预期。论文依据：Alexander-Baig (2020) 验证 DVOL 是 BTC 已实现波动率的领先预测指标；从 A 级提升至 S 级。\n与 BTC：与 BTC 波动率高度相关，不直接指示价格方向。\n影响方向：DVOL 上升=市场预期大波动（方向未定）；下降=风险溢价回落、波动窗口收缩。\n实战：顶部风险=价格新高 + DVOL 快速抬升 + 成交量背离；配合 funding 和 OI 判断「会不会引发清算级波动」。", en: "Priority: S-tier (volatility driver)\nMeaning: Deribit BTC 30-day implied vol index. Research basis: Alexander-Baig (2020) validates DVOL as a leading predictor of BTC realized volatility; elevated from A-tier to S-tier.\nVs BTC: highly correlated with BTC volatility, not price direction.\nImpact: rising DVOL = market prices in large moves (direction open); falling = risk premium cooling, narrowing vol window.\nPractice: top risk = new high + rising DVOL + volume divergence; combine with funding and OI to judge whether a liquidation-cascade move is forming." },
  "compare.info.hashRate": { zh: "优先级：B 级（中长期辅助）\n意义：全网算力，衡量矿工投入和网络安全预算。\n与 BTC：与价格水平长期相关，日收益率相关弱，不适合短线。\n影响方向：算力趋势上升=矿工扩张；急跌=矿工压力/出清。\n实战：配合 miningCost 看 capitulation，非核心交易信号。", en: "Priority: B-tier (medium/long-term)\nMeaning: network hashrate—miner commitment and security budget.\nVs BTC: long-horizon price-level link; weak daily-return correlation.\nImpact: rising trend = miner expansion; sharp drop = miner stress/capitulation.\nPractice: pair with mining costs for capitulation reads—not a core timing signal." },
  "compare.info.difficulty": { zh: "优先级：B 级（中长期辅助）\n意义：挖矿难度，反映全网竞争强度和矿工成本压力。\n与 BTC：日收益率相关弱，调整滞后于算力变化。\n影响方向：难度上行=矿工成本压力增加；难度下行=算力出清。\n实战：中长期安全边际参考，短线权重低。", en: "Priority: B-tier (medium/long-term)\nMeaning: mining difficulty—network competition and miner cost pressure.\nVs BTC: weak daily-return correlation; lags hashrate changes.\nImpact: rising difficulty = higher miner cost pressure; falling = hashrate clearing.\nPractice: medium/long-term floor reference—low weight for short-term timing." },
  "compare.info.nTxs": { zh: "优先级：B 级（链上活跃度）\n意义：每日链上交易笔数，衡量网络使用量。\n与 BTC：日收益率相关偏弱，更适合看中周期采用趋势。\n影响方向：趋势上升=采用/活跃度改善；单日尖峰需结合 txFeesUsd 判断。\n实战：底部区域看链上活跃度是否「没有崩」；不适合短线择时。", en: "Priority: B-tier (on-chain activity)\nMeaning: daily on-chain transaction count.\nVs BTC: weak daily-return correlation; better for medium-term adoption trends.\nImpact: rising trend = stronger usage; one-day spikes need txFeesUsd confirmation.\nPractice: in bottom zones, check activity hasn't collapsed—not for short-term timing." },
  "compare.info.activeAddrs": { zh: "优先级：B 级（链上活跃度）\n意义：日活跃地址数，衡量链上参与广度。\n与 BTC：日收益率相关偏弱，反映中长期网络需求。\n影响方向：持续上升=用户/转账活动增加；下降=活跃度转弱。\n实战：与 nTxs、txFeesUsd 组合看链上健康度，权重低于衍生品和宏观。", en: "Priority: B-tier (on-chain activity)\nMeaning: daily active addresses—breadth of on-chain participation.\nVs BTC: weak daily-return correlation; reflects medium-term network demand.\nImpact: sustained growth = more users/transfers; declines = weaker activity.\nPractice: combine with nTxs and txFeesUsd for on-chain health—lower weight than derivatives/macro." },
  "compare.info.mempool": { zh: "优先级：B 级（链上活跃度）\n意义：Mempool 待确认交易量，衡量链上拥堵程度。\n与 BTC：日收益率相关弱，更多反映短期链上压力。\n影响方向：拥堵上升通常推高 txFeesUsd，也可能反映链上热度。\n实战：辅助观察链上压力，非 BTC 价格核心驱动。", en: "Priority: B-tier (on-chain activity)\nMeaning: mempool size—pending transaction congestion.\nVs BTC: weak daily-return correlation; reflects short-term on-chain pressure.\nImpact: rising congestion lifts txFeesUsd; can reflect on-chain heat.\nPractice: supplementary on-chain pressure gauge—not a core BTC price driver." },
  "compare.info.txFeesUsd": { zh: "优先级：B 级（链上活跃度）\n意义：链上日交易费总额，代表区块空间需求。\n与 BTC：日收益率相关偏弱，极端拥堵时与波动同步。\n影响方向：费用上升=需求增强；极端上升可能来自拥堵而非基本面改善。\n实战：看中周期趋势，单日尖峰需结合 mempool 解读。", en: "Priority: B-tier (on-chain activity)\nMeaning: daily on-chain transaction fees—blockspace demand.\nVs BTC: weak daily-return correlation; syncs with volatility during congestion spikes.\nImpact: rising fees = stronger demand; extremes may be congestion, not fundamentals.\nPractice: focus on medium-term trends; single-day spikes need mempool context." },
  "compare.info.avgBlockSize": { zh: "优先级：C 级（环境变量）\n意义：平均区块大小，代表区块空间利用率。\n与 BTC：日收益率相关很弱。\n影响方向：上升=链上使用更满；下降=使用度走弱。\n实战：链上辅助指标，对 BTC 短线分析权重最低。", en: "Priority: C-tier (environmental)\nMeaning: average block size—blockspace utilization.\nVs BTC: very weak daily-return correlation.\nImpact: rising = fuller blocks; falling = weaker usage.\nPractice: low-weight on-chain auxiliary—lowest priority for BTC short-term analysis." },
  "compare.info.dxy": { zh: "优先级：S 级（核心驱动）\n意义：美元指数，衡量全球美元强弱和流动性背景。\n与 BTC：日/周收益率负相关常见，DXY↑ 通常压制 BTC。\n影响方向：美元走强=压制风险资产；美元走弱=改善流动性背景。\n实战：看涨组合需 DXY 下跌或企稳；看跌警惕 DXY 上升 + VIX 上升。", en: "Priority: S-tier (core driver)\nMeaning: US Dollar Index—global USD strength and liquidity backdrop.\nVs BTC: often negatively correlated on daily/weekly returns; DXY↑ usually pressures BTC.\nImpact: stronger USD = headwind for risk assets; weaker USD = better liquidity backdrop.\nPractice: bullish combo needs falling/stable DXY; bearish watch DXY↑ + VIX↑." },
  "compare.info.us10y": { zh: "优先级：A 级\n意义：美债 10 年期收益率，全球折现率锚。\n与 BTC：日收益率负相关，收益率↑ 通常压制高 Beta 资产如 BTC。\n影响方向：收益率上行=流动性收紧/估值压力；下行=利好长久期资产。\n实战：与 us2y 一起看曲线形态，判断降息预期变化。", en: "Priority: A-tier\nMeaning: US 10Y yield—the global discount-rate anchor.\nVs BTC: often negatively correlated on daily returns; rising yields pressure high-beta assets like BTC.\nImpact: rising yields = tighter liquidity/valuation pressure; falling = supports duration assets.\nPractice: pair with us2y for curve shape and rate-cut expectations." },
  "compare.info.us2y": { zh: "优先级：A 级\n意义：美债 2 年期收益率，短端政策利率预期代理。\n与 BTC：日收益率负相关，对 Fed 预期变化更敏感。\n影响方向：短端上行=降息预期降温；短端下行=宽松预期升温。\n实战：us2y 下行 + DXY 走弱 + Nasdaq 上涨 = 宏观友好组合。", en: "Priority: A-tier\nMeaning: US 2Y yield—short-end policy-rate expectations.\nVs BTC: often negatively correlated; more sensitive to Fed expectation shifts.\nImpact: rising short rates = cooler easing expectations; falling = easing priced in.\nPractice: us2y↓ + DXY↓ + Nasdaq↑ = macro-friendly combo for BTC." },
  "compare.info.vix": { zh: "优先级：S 级（核心驱动）\n意义：VIX 美股隐含波动率，衡量全球风险偏好和恐慌程度。\n与 BTC：日/周收益率负相关，VIX↑ 通常利空 BTC。\n影响方向：VIX 上升=避险升温；VIX 下降=风险偏好改善。\n实战：看跌组合=VIX 上升 + Nasdaq 下跌 + DXY 上升；与 BTC 同向时宏观信号更强。", en: "Priority: S-tier (core driver)\nMeaning: VIX—US equity implied vol and global risk sentiment.\nVs BTC: often negatively correlated on daily/weekly returns; VIX↑ usually hurts BTC.\nImpact: rising VIX = risk-off; falling VIX = improving risk appetite.\nPractice: bearish combo = VIX↑ + Nasdaq↓ + DXY↑; stronger when aligned with BTC." },
  "compare.info.sp500": { zh: "优先级：S 级（核心驱动）\n意义：标普 500，美股大盘风险偏好代理。\n与 BTC：日/周收益率正相关上升，BTC 越来越像高 Beta 风险资产。\n影响方向：SP500 上涨=跨资产风险情绪改善；下跌=避险。\n实战：看涨组合需 Nasdaq/SP500 同步上涨；BTC 独涨需警惕背离。", en: "Priority: S-tier (core driver)\nMeaning: S&P 500—broad US equity risk appetite.\nVs BTC: rising positive daily/weekly correlation; BTC behaves increasingly as high-beta risk asset.\nImpact: SP500 up = better cross-asset risk sentiment; down = risk-off.\nPractice: bullish combo needs Nasdaq/SP500 rising together; BTC-only rally warns divergence." },
  "compare.info.nasdaq": { zh: "优先级：S 级（核心驱动）\n意义：纳斯达克 100，科技/高久期成长资产代理，与 BTC 相关性最强的美股指数之一。\n与 BTC：日/周收益率正相关高，尤其 2024-2025 相关性明显上升。\n影响方向：Nasdaq 上涨=风险偏好/流动性友好；下跌=估值压力和 BTC 拖累。\n实战：宏观模块首选指数；Nasdaq 转弱时 BTC 独涨风险升高。", en: "Priority: S-tier (core driver)\nMeaning: Nasdaq 100—tech/long-duration growth proxy; among the strongest BTC-correlated US indices.\nVs BTC: high positive daily/weekly correlation, especially rising in 2024-2025.\nImpact: Nasdaq up = risk-on/liquidity-friendly; down = valuation pressure and BTC drag.\nPractice: top macro index to watch; BTC rallying alone while Nasdaq weakens is a warning." },
  "compare.info.russell": { zh: "优先级：A 级（从 B 级提升）\n意义：罗素 2000 小盘股指数，是风险偏好「广度」最灵敏的代理，对融资成本和信用环境极度敏感。研究支持：BTC 在融资宽松期与高 Beta 小盘股的相关性更强（Liu-Tsyvinski 2021 cross-asset beta 分析）；提升为 A 级。\n与 BTC：日收益率正相关，弱于 Nasdaq/SP500 但比 Nasdaq 更早反映信用压力和风险扩散收缩。\n影响方向：Russell 强势=风险扩散至全面牛市；弱势（尤其 Nasdaq 仍强时）=信用/增长分化，BTC 敞口需收窄。\n实战：观察 Nasdaq/Russell 是否同步；若 Nasdaq 新高而 Russell 滞涨，表明风险偏好集中而非扩散。", en: "Priority: A-tier (elevated from B-tier)\nMeaning: Russell 2000—the most sensitive breadth proxy for risk appetite, highly reactive to financing costs and credit conditions. Research: BTC correlates more strongly with high-beta small-caps during easy-financing regimes (Liu-Tsyvinski 2021 cross-asset beta).\nVs BTC: positive daily-return correlation, weaker than Nasdaq/SP500 but often earlier to signal credit stress or risk-diffusion contraction.\nImpact: Russell strength = broad risk-on; weakness when Nasdaq still rallies = concentrated risk appetite—tighten BTC exposure.\nPractice: watch Nasdaq vs Russell divergence; Nasdaq new high with lagging Russell warns that breadth is narrow, not expanding." },
  "compare.info.gold": { zh: "优先级：A 级（从 B 级提升）\n意义：黄金，反映实际利率、美元走势和避险需求，是与 BTC「数字黄金」叙事共振最紧密的实物资产。研究支持：Bianchi-Tamoni (2022) 发现实际利率（TIPS）和避险属性均影响加密资产跨截面定价，黄金是这两条路径的直接代理；提升为 A 级。\n与 BTC：日收益率相关不稳定，但实际利率下行周期中常与 BTC 同向。\n影响方向：黄金上涨若来自实际利率下行，通常同时利好 BTC；若来自纯避险（股市大跌），BTC 可能同向也可能背离。\n实战：结合 DXY 和 TIPS 收益率三角验证；黄金+BTC 同步上行时叙事更强。", en: "Priority: A-tier (elevated from B-tier)\nMeaning: gold—real rates, USD and safe-haven demand; the physical asset most closely linked to the BTC 'digital gold' narrative. Research: Bianchi-Tamoni (2022) finds real rates and safe-haven properties price crypto cross-sectionally; gold is the direct proxy for both channels.\nVs BTC: unstable daily-return correlation, but often co-directional during falling real-rate regimes.\nImpact: gold up driven by falling real rates usually also benefits BTC; gold up driven by pure risk-off (equity crash) may or may not drag BTC along.\nPractice: triangulate with DXY and TIPS yields; BTC + gold rising together strengthens the macro narrative." },
  "compare.info.silver": { zh: "优先级：C 级（环境变量）\n意义：白银，兼具贵金属和工业属性。\n与 BTC：日收益率相关弱。\n影响方向：上行可反映通胀、工业需求或风险偏好；需结合黄金和宏观。\n实战：环境变量，权重低。", en: "Priority: C-tier (environmental)\nMeaning: silver—precious-metal plus industrial exposure.\nVs BTC: weak daily-return correlation.\nImpact: upside may reflect inflation, industrial demand or risk appetite—read with gold/macro.\nPractice: low-weight environmental variable." },
  "compare.info.copper": { zh: "优先级：C 级（环境变量）\n意义：铜，全球制造业和需求周期代理。\n与 BTC：日收益率相关弱。\n影响方向：铜涨=周期需求改善；也可能推升通胀预期。\n实战：辅助周期判断，非 BTC 核心。", en: "Priority: C-tier (environmental)\nMeaning: copper—global manufacturing and demand cycle proxy.\nVs BTC: weak daily-return correlation.\nImpact: copper up = cyclical demand; may lift inflation expectations.\nPractice: supplementary cycle gauge—not core for BTC." },
  "compare.info.oil": { zh: "优先级：C 级（环境变量）\n意义：WTI 原油，能源供需和通胀压力代理。\n与 BTC：日收益率相关弱，有时负相关。\n影响方向：油价上涨推升通胀预期；下跌可能反映需求走弱。\n实战：宏观环境辅助，权重低于利率和股指。", en: "Priority: C-tier (environmental)\nMeaning: WTI crude—energy supply/demand and inflation pressure.\nVs BTC: weak daily-return correlation; sometimes negative.\nImpact: oil up lifts inflation expectations; down may signal weaker demand.\nPractice: macro environment auxiliary—lower weight than rates and equities." },
  "compare.info.natgas": { zh: "优先级：C 级（环境变量）\n意义：天然气，能源边际供需和季节性压力。\n与 BTC：日收益率相关很弱。\n影响方向：大幅波动影响能源成本和通胀预期。\n实战：环境变量，对 BTC 分析权重最低之一。", en: "Priority: C-tier (environmental)\nMeaning: natural gas—marginal energy demand/supply and seasonality.\nVs BTC: very weak daily-return correlation.\nImpact: sharp moves affect energy costs and inflation expectations.\nPractice: environmental variable—among the lowest weights for BTC analysis." },
  "compare.info.nikkei": { zh: "优先级：C 级（环境变量）\n意义：日经 225，日本/亚洲风险偏好代理。\n与 BTC：日收益率相关弱于 Nasdaq/SP500。\n影响方向：强势支持区域风险情绪；弱势提示全球资金避险。\n实战：辅助看全球风险偏好，通常弱于美股核心指数。", en: "Priority: C-tier (environmental)\nMeaning: Nikkei 225—Japan/Asia risk appetite proxy.\nVs BTC: weaker daily-return correlation than Nasdaq/SP500.\nImpact: strength supports regional risk sentiment; weakness warns global de-risking.\nPractice: supplementary global risk gauge—usually weaker than core US indices." },
  "compare.info.hangseng": { zh: "优先级：C 级（环境变量）\n意义：恒生指数，港股/中国资产和外资风险偏好。\n与 BTC：日收益率相关弱，受政策和地缘影响大。\n影响方向：上行=中国/HK 风险偏好改善；下行=政策或增长压力。\n实战：辅助观察，弱于 Nasdaq/SP500 对 BTC 的解释力。", en: "Priority: C-tier (environmental)\nMeaning: Hang Seng—Hong Kong/China assets and foreign risk appetite.\nVs BTC: weak daily-return correlation; heavily policy/geopolitics-driven.\nImpact: rising = better China/HK risk appetite; falling = policy or growth stress.\nPractice: supplementary—weaker BTC explanatory power than Nasdaq/SP500." },
  "compare.loading": { zh: "正在加载多指标历史…", en: "Loading multi-indicator history…" },
  "compare.s.price": { zh: "{ccy} 价格", en: "{ccy} Price" },
  "compare.s.miningCost": { zh: "电力成本/枚", en: "Electricity Cost / BTC" },
  "compare.s.miningElectricityCost": { zh: "电力成本/枚", en: "Electricity Cost / BTC" },
  "compare.s.miningComprehensiveCost": { zh: "综合成本/枚", en: "Comprehensive Cost / BTC" },
  "compare.s.oi": { zh: "{ccy} 未平仓 OI (USD)", en: "{ccy} Open Interest (USD)" },
  "compare.s.funding": { zh: "{ccy} 资金费率 (%)", en: "{ccy} Funding Rate (%)" },
  "compare.s.ls": { zh: "{ccy} 多空账户比", en: "{ccy} Long/Short Acct Ratio" },
  "compare.s.contractLs": { zh: "{ccy} 合约多空比", en: "{ccy} Contract Long/Short Ratio" },
  "compare.s.topTraderAccount": { zh: "{ccy} 大户账户多空比", en: "{ccy} Top Trader Account L/S" },
  "compare.s.topTraderPosition": { zh: "{ccy} 大户仓位多空比", en: "{ccy} Top Trader Position L/S" },
  "compare.s.cvd": { zh: "CVD 累计差量", en: "Cumulative Volume Delta" },
  "compare.s.smartCum": { zh: "{ccy} 聪明钱累计净买", en: "{ccy} Smart Money Cum. Net" },
  "compare.s.smartNet": { zh: "{ccy} 聪明钱净买入", en: "{ccy} Smart Money Net" },
  "compare.s.smartBuy": { zh: "{ccy} 聪明钱买入", en: "{ccy} Smart Money Buy" },
  "compare.s.smartSell": { zh: "{ccy} 聪明钱卖出", en: "{ccy} Smart Money Sell" },
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
  "compare.s.btcMomentum7d": { zh: "{ccy} 7日动量", en: "{ccy} 7D Momentum" },
  "compare.s.btcMomentum30d": { zh: "{ccy} 30日动量", en: "{ccy} 30D Momentum" },
  "compare.s.btcMomentum90d": { zh: "{ccy} 90日动量", en: "{ccy} 90D Momentum" },
  "compare.s.btcRealizedVol30d": { zh: "{ccy} 30日实现波动率", en: "{ccy} 30D Realized Vol" },
  "compare.s.btcDrawdown": { zh: "{ccy} 回撤", en: "{ccy} Drawdown" },
  "compare.s.returnZ": { zh: "{ccy} 日收益 Z-Score", en: "{ccy} Daily Return Z-Score" },
  "compare.s.volumeUsd": { zh: "{ccy} 成交量 (USD)", en: "{ccy} Volume (USD)" },
  "compare.s.volumeZ": { zh: "{ccy} 成交量 Z-Score", en: "{ccy} Volume Z-Score" },
  "compare.s.upperWick": { zh: "{ccy} 上影线比例", en: "{ccy} Upper Wick Ratio" },
  "compare.s.lowerWick": { zh: "{ccy} 下影线比例", en: "{ccy} Lower Wick Ratio" },
  "compare.s.basis": { zh: "{ccy} 永续溢价 / Basis", en: "{ccy} Perp Premium / Basis" },
  "compare.s.signalBuy": { zh: "{ccy} Current Signal 买入分", en: "{ccy} Current Signal Buy Score" },
  "compare.s.signalSell": { zh: "{ccy} Current Signal 卖出分", en: "{ccy} Current Signal Sell Score" },
  "compare.s.signalRisk": { zh: "{ccy} Current Signal 风险分", en: "{ccy} Current Signal Risk Score" },
  "compare.s.signalDirection": { zh: "{ccy} Current Signal 方向码", en: "{ccy} Current Signal Direction Code" },
  "compare.s.oiZ": { zh: "{ccy} OI 日变化 Z-Score", en: "{ccy} OI Daily Change Z-Score" },
  "compare.s.oiChangePct": { zh: "{ccy} OI 日变化率", en: "{ccy} OI Daily Change" },
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
