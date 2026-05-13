/**
 * Curated on-chain / derivatives / macro checklist for BTC context.
 * Rankings and sources follow internal research watchlist; tooltips explain usage vs BTC.
 */

export type CryptoWatchlistIntegration = "none" | "partial" | "dashboard"

export interface CryptoWatchlistMetric {
  rank: number
  id: string
  name: string
  sources: string
  purpose: string
  /** Shown in tooltip: 定义 / 用途 / 与 BTC */
  description: string
  /** How this row is covered in eatfear today */
  integration: CryptoWatchlistIntegration
  integrationNote?: string
}

export const CRYPTO_WATCHLIST_METRICS: CryptoWatchlistMetric[] = [
  {
    rank: 1,
    id: "btc-etf-net-flow",
    name: "BTC ETF Net Flow",
    sources: "Coinglass / SoSoValue / Farside",
    purpose: "机构资金方向",
    description:
      "美国现货 BTC ETF 的每日/区间净流入（申购−赎回）。\n用途：观察传统金融渠道对 BTC 的配置强度，是近年边际定价的重要力量。\n与 BTC：持续净流入常对现货价形成支撑；大幅净流出时价格更易承压或波动放大。",
    integration: "none",
    integrationNote: "需接入 ETF 聚合 API",
  },
  {
    rank: 2,
    id: "funding-rate-aggregated",
    name: "Funding Rate Aggregated",
    sources: "Coinglass / Binance",
    purpose: "杠杆情绪",
    description:
      "永续合约资金费率（多方向空方或空方向多方支付）的交易所加权或中位数。\n用途：衡量杠杆一侧是否拥挤；极端正费率=多头付息过多，易挤压。\n与 BTC：极端费率常与短期反转或波动相关；温和同向则多为趋势延续。",
    integration: "partial",
    integrationNote: "极端波动页含交易所资金费率相关视图",
  },
  {
    rank: 3,
    id: "open-interest-aggregated",
    name: "Open Interest Aggregated",
    sources: "Coinglass / Binance",
    purpose: "杠杆规模",
    description:
      "未平仓合约总额：当前市场承载的衍生品名义风险。\n用途：区分「价涨+OI 增」的新增杠杆多头 vs 「价涨+OI 降」的空头回补。\n与 BTC：OI 快升+费率极端时，清算级波动风险上升。",
    integration: "partial",
    integrationNote: "见永续监控模块",
  },
  {
    rank: 4,
    id: "liquidation-data",
    name: "Liquidation Data",
    sources: "Coinglass",
    purpose: "爆仓反转",
    description:
      "一段时间内多头/空头被强制平仓的名义金额。\n用途：捕捉「级联清算」后的均值回归或燃料耗尽。\n与 BTC：单边大额爆仓后，短期常出现过度修正或反弹。",
    integration: "none",
    integrationNote: "需 Coinglass 等清算数据",
  },
  {
    rank: 5,
    id: "stablecoin-total-mcap",
    name: "Stablecoin Total Market Cap",
    sources: "DefiLlama",
    purpose: "场内流动性",
    description:
      "主要美元稳定币总市值变化。\n用途：代表加密市场「弹药池」扩容或收缩。\n与 BTC：稳定币总盘子上升，通常利于风险资产定价；持续收缩则需警惕流动性逆风。",
    integration: "none",
    integrationNote: "可接 DefiLlama stablecoins",
  },
  {
    rank: 6,
    id: "exchange-btc-reserve",
    name: "Exchange BTC Reserve",
    sources: "CryptoQuant / Glassnode",
    purpose: "抛压 / 囤币",
    description:
      "交易所钱包中 BTC 存量估计。\n用途：链上转入交易所≈潜在卖压；净流出≈囤币或冷存。\n与 BTC：储备趋势性下降常被视为中长期利多叙事之一（需结合价量验证）。",
    integration: "none",
    integrationNote: "需链上数据供应商",
  },
  {
    rank: 7,
    id: "spot-cvd",
    name: "Spot CVD",
    sources: "Kaiko / 交易所 API",
    purpose: "主动买卖力量",
    description:
      "Cumulative Volume Delta：主动买量−主动卖量的累计。\n用途：比单纯成交量更能看出「谁在主动吃单」。\n与 BTC：价格新高而 CVD 走弱，可能提示上涨质量不佳（背离）。",
    integration: "partial",
    integrationNote: "极端波动模块含 CVD 说明与相关序列",
  },
  {
    rank: 8,
    id: "order-book-depth",
    name: "Order Book Depth",
    sources: "Kaiko / Binance",
    purpose: "流动性与滑点",
    description:
      "盘口一定距离内的挂单量（买卖墙）。\n用途：评估大单冲击成本与短期支撑/阻力。\n与 BTC：深买墙可能在下跌中提供缓冲；深卖墙压制突破效率。",
    integration: "partial",
    integrationNote: "OKX 深度在波动监控中可参考",
  },
  {
    rank: 9,
    id: "deribit-iv",
    name: "Deribit IV",
    sources: "Deribit / Amberdata",
    purpose: "波动率预期",
    description:
      "期权市场隐含的波动率水平（常看 DVOL 或 ATM IV）。\n用途：期权定价对未来的「恐惧/贪婪」量化。\n与 BTC：IV 极低时常酝酿波动释放；IV 极高时卖方占优、现货易剧烈摆动。",
    integration: "none",
    integrationNote: "需 Deribit / 期权数据",
  },
  {
    rank: 10,
    id: "25d-skew",
    name: "25D Skew",
    sources: "Deribit / Amberdata",
    purpose: "期权方向偏好",
    description:
      "25 Delta Risk Reversal：看涨与看跌隐含波动率之差。\n用途：市场愿意为哪一侧「灾难保险」付更高溢价。\n与 BTC：skew 偏向看涨（puts 更贵或 calls 更便宜的对侧）可解读为情绪与尾部偏好，需结合趋势。",
    integration: "none",
    integrationNote: "需期权曲面数据",
  },
  {
    rank: 11,
    id: "mvrv-z",
    name: "MVRV Z-Score",
    sources: "Glassnode / Coin Metrics",
    purpose: "周期估值",
    description:
      "市值与已实现市值偏离的 Z-score，压缩长期估值噪声。\n用途：识别周期极端（高估/低估区域）。\n与 BTC：历史上有助于判断大级别顶底区域，但非精确择时工具。",
    integration: "none",
    integrationNote: "需链上估值序列",
  },
  {
    rank: 12,
    id: "sopr",
    name: "SOPR",
    sources: "Glassnode / CryptoQuant",
    purpose: "盈亏卖出行为",
    description:
      "Spent Output Profit Ratio：已花费输出的平均盈亏程度。\n用途：>1 总体盈利卖出为主；<1 亏损投降为主。\n与 BTC：SOPR 在 1 附近震荡常对应筹码换手与趋势中继/转折。",
    integration: "none",
    integrationNote: "需 Glassnode 类指标",
  },
  {
    rank: 13,
    id: "realized-price",
    name: "Realized Price",
    sources: "Glassnode / Coin Metrics",
    purpose: "牛熊成本线",
    description:
      "按币天加权的「已实现价格」，可理解为链上平均成本参考。\n用途：现货长期相对该线的位置，常用来讨论牛熊阶段。\n与 BTC：价格显著低于已实现价时，历史上多处于深度价值或恐慌区（非投资建议）。",
    integration: "none",
    integrationNote: "需链上供应估值",
  },
  {
    rank: 14,
    id: "lth-supply",
    name: "LTH Supply",
    sources: "Glassnode",
    purpose: "长期持有者行为",
    description:
      "长期持有者（如 >155 天）筹码占比或变化。\n用途：衡量「坚定筹码」与「浮动筹码」结构。\n与 BTC：LTH 派发阶段若与价格新高共振，需警惕周期顶风险；累积阶段则偏中长期支撑叙事。",
    integration: "none",
    integrationNote: "需 Glassnode",
  },
  {
    rank: 15,
    id: "puell-multiple",
    name: "Puell Multiple",
    sources: "Glassnode",
    purpose: "矿工周期",
    description:
      "矿工收入相对其 365 日均线的比值类指标（矿工「景气度」）。\n用途：矿工现金流压力与抛售动机。\n与 BTC：极端高位可能对应矿工集中出货；极端低位可能对应哈希/难度周期出清。",
    integration: "none",
    integrationNote: "需 Glassnode",
  },
  {
    rank: 16,
    id: "miner-outflow",
    name: "Miner Outflow",
    sources: "CryptoQuant",
    purpose: "矿工抛压",
    description:
      "从矿工地址转出的 BTC 流量。\n用途：矿工向交易所或 OTC 转移常解读为潜在卖压。\n与 BTC：短期脉冲性上升值得关注；需区分内部钱包整理与真实卖出。",
    integration: "none",
    integrationNote: "需 CryptoQuant",
  },
  {
    rank: 17,
    id: "stablecoin-exchange-inflow",
    name: "Stablecoin Exchange Inflow",
    sources: "CryptoQuant",
    purpose: "潜在买盘",
    description:
      "稳定币净流入交易所的规模。\n用途：「子弹上膛」—预备在 CEX 上买现货/合约的购买力。\n与 BTC：持续大额流入有时领先于反弹或波动放大（非必然因果）。",
    integration: "none",
    integrationNote: "需 CryptoQuant",
  },
  {
    rank: 18,
    id: "dex-volume",
    name: "DEX Volume",
    sources: "DefiLlama / Dune",
    purpose: "链上交易活跃",
    description:
      "去中心化交易所成交总额。\n用途：链上投机与 DeFi 活跃度。\n与 BTC：ETH 生态为主；整体上升常反映风险偏好，与 BTC 多为同向β环境。",
    integration: "none",
    integrationNote: "可接 DefiLlama DEX",
  },
  {
    rank: 19,
    id: "bridge-netflow",
    name: "Bridge Netflow",
    sources: "DefiLlama / Dune",
    purpose: "公链资金迁移",
    description:
      "跨链桥净流入/净流出。\n用途：看资金在 L1/L2 之间的轮动。\n与 BTC：间接指标；风险偏好与生态竞争会影响山寨，再反馈到 BTC dominance。",
    integration: "none",
    integrationNote: "需桥数据面板",
  },
  {
    rank: 20,
    id: "chain-revenue-fees",
    name: "Chain Revenue / Fees",
    sources: "Token Terminal / Artemis",
    purpose: "项目基本面",
    description:
      "公链或协议的费用/收入类基本面。\n用途：评估真实使用需求 vs 代币激励驱动的虚高。\n与 BTC：BTC 费用更多反映拥堵与铭文/NFT 活动；与周期热度相关。",
    integration: "none",
    integrationNote: "需 Token Terminal / Artemis",
  },
  {
    rank: 21,
    id: "tvl-by-chain",
    name: "TVL by Chain",
    sources: "DefiLlama",
    purpose: "DeFi 风险偏好",
    description:
      "各链锁仓总价值。\n用途：DeFi 资本沉淀与杠杆 farming 意愿。\n与 BTC：TVL 扩张常出现在风险偏好上升阶段，与 BTC 同向居多。",
    integration: "none",
    integrationNote: "可接 DefiLlama TVL",
  },
  {
    rank: 22,
    id: "active-addresses",
    name: "Active Addresses",
    sources: "Coin Metrics / Artemis",
    purpose: "链上活跃度",
    description:
      "活跃地址数等网络用量指标。\n用途：用户增长或投机活跃度代理变量。\n与 BTC：趋势性上升可支持采用叙事；单点爆量需辨别是转账还是粉尘/混币。",
    integration: "none",
    integrationNote: "需 Coin Metrics",
  },
  {
    rank: 23,
    id: "token-unlock",
    name: "Token Unlock",
    sources: "Tokenomist / Messari",
    purpose: "供给冲击",
    description:
      "未来代币解锁日历与规模。\n用途：评估项目方、投资人、团队的潜在卖压时间表。\n与 BTC：对山寨影响更直接；大盘情绪差时解锁事件更易砸盘并拖累 BTC。",
    integration: "none",
    integrationNote: "需 Tokenomist",
  },
  {
    rank: 24,
    id: "whale-exchange-deposit",
    name: "Whale Exchange Deposit",
    sources: "Arkham / Nansen",
    purpose: "大户抛压",
    description:
      "大户地址向交易所的充值事件监控。\n用途：链上「聪明钱」或巨鲸的短期卖压预警。\n与 BTC：大额连续充值提高短期回调概率，但需结合地址标签可信度。",
    integration: "none",
    integrationNote: "需 Arkham / Nansen",
  },
  {
    rank: 25,
    id: "smart-money-flow",
    name: "Smart Money Flow",
    sources: "Nansen",
    purpose: "资金提前布局",
    description:
      "标签为 Smart Money 的钱包净流向（链上+部分 CEX 标签）。\n用途：跟踪相对活跃资金的板块轮动。\n与 BTC：可观察资金是先回流 BTC 还是流向山寨龙头。",
    integration: "none",
    integrationNote: "需 Nansen",
  },
  {
    rank: 26,
    id: "exchange-netflow",
    name: "Exchange Netflow",
    sources: "Glassnode / CryptoQuant",
    purpose: "买卖压力",
    description:
      "全市场或主要交易所的 BTC 净流入/净流出。\n用途：比单看储备更偏短期流量节奏。\n与 BTC：净入所偏空解读、净出所偏多解读为主流框架（需去噪）。",
    integration: "none",
    integrationNote: "需链上流量",
  },
  {
    rank: 27,
    id: "fear-greed",
    name: "Fear & Greed",
    sources: "Alternative.me",
    purpose: "情绪背景",
    description:
      "综合波动率、动量、社交、调查等的 0–100 情绪指数。\n用途：极端读数作逆向参考或波动率背景，不单独作为趋势信号。\n与 BTC：极度贪婪阶段波动加剧；极度恐慌后常见技术性反弹（历史统计，非保证）。",
    integration: "dashboard",
    integrationNote: "本页 KPI 已接入",
  },
  {
    rank: 28,
    id: "social-volume",
    name: "Social Volume",
    sources: "Santiment / LunarCrush",
    purpose: "热点监控",
    description:
      "社交渠道上某资产的讨论量与情绪。\n用途：识别 FOMO 或恐慌传播是否过热。\n与 BTC：社交量异常放大有时对应短期顶部或事件驱动波动。",
    integration: "none",
    integrationNote: "需 Santiment / LunarCrush",
  },
  {
    rank: 29,
    id: "developer-activity",
    name: "Developer Activity",
    sources: "Santiment / GitHub",
    purpose: "长期质量",
    description:
      "代码提交、开发者活跃度代理指标。\n用途：评估生态是否「空心化」。\n与 BTC：对 BTC 本身较弱，对公链/L2 与大型 DeFi 更相关；生态弱则风险偏好下降间接影响 BTC。",
    integration: "none",
    integrationNote: "需 GitHub / Santiment",
  },
  {
    rank: 30,
    id: "macro-liquidity-dxy-us10y-fed",
    name: "Macro Liquidity: DXY / US10Y / Fed Rate",
    sources: "FRED / TradingView / Yahoo",
    purpose: "风险资产大环境",
    description:
      "美元指数、美债收益率、政策利率等综合宏观锚。\n用途：判断全球流动性与贴现率环境。\n与 BTC：DXY↑、实际利率↑ 历史上多压制 BTC；宽松预期与收益率回落阶段更友好（相关性随周期变化）。",
    integration: "partial",
    integrationNote: "宏观页可查看 DXY、美债、联邦基金利率等",
  },
]
