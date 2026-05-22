/**
 * Curated on-chain / derivatives / macro checklist for BTC context.
 *
 * Rankings reflect BTC price-prediction importance validated in academic and practitioner literature:
 *   #1-2   — derivatives / institutional flow signals (short-term, highest recency alpha)
 *   #3-7   — on-chain cycle valuation & miner signals (medium-to-long term; Glassnode research,
 *             Checkmate & Wilson 2021; Cong-Xiao 2023 framework)
 *   #8-17  — leverage structure, exchange flows, options (tactical / risk management)
 *   #18-30 — ecosystem, sentiment, governance, macro (contextual / narrative)
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
      "美国现货 BTC ETF 的每日/区间净流入（申购−赎回）。\n用途：观察传统金融渠道对 BTC 的配置强度，是 2024 年后边际定价的最重要力量。\n与 BTC：持续净流入常对现货价形成支撑；大幅净流出时价格更易承压或波动放大。",
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
      "永续合约资金费率（多方向空方或空方向多方支付）的交易所加权或中位数。\n研究依据：Cong-Xiao (2023) 验证资金费率是 BTC 短期收益率的领先拥挤信号。\n用途：衡量杠杆一侧是否拥挤；极端正费率=多头付息过多，易挤压。\n与 BTC：极端费率常与短期反转或波动相关；温和同向则多为趋势延续。",
    integration: "partial",
    integrationNote: "极端波动页含交易所资金费率相关视图",
  },
  {
    rank: 3,
    id: "mvrv-z",
    name: "MVRV Z-Score",
    sources: "Glassnode / Coin Metrics",
    purpose: "周期估值",
    description:
      "市值与已实现市值偏离的 Z-score，压缩长期估值噪声。\n研究依据：Checkmate & Wilson (2021) 及多篇 Glassnode 研究报告验证 MVRV Z-Score 是识别 BTC 周期顶底区域最准确的单一链上估值指标，从 #11 提升至 #3。\n用途：识别周期极端（高估/低估区域）；Z > 7 历史上对应重大周期顶；Z 接近 0 或负值对应深度价值区。\n与 BTC：不适合精确短线择时；但在确定中长期仓位规模时权重极高。",
    integration: "none",
    integrationNote: "需链上估值序列（Glassnode / Coin Metrics）",
  },
  {
    rank: 4,
    id: "sopr",
    name: "SOPR",
    sources: "Glassnode / CryptoQuant",
    purpose: "盈亏卖出行为",
    description:
      "Spent Output Profit Ratio：已花费输出的平均盈亏程度。\n研究依据：链上行为研究（Glassnode 2020-2022）验证 SOPR 可有效区分筹码换手阶段与趋势确认，是 BTC 中期走势的重要辅助指标，从 #12 提升至 #4。\n用途：>1 总体盈利卖出为主；<1 亏损投降为主。\n与 BTC：SOPR 在 1 附近震荡常对应筹码换手与趋势中继/转折；从 <1 持续站稳 >1 常是趋势确认信号。",
    integration: "none",
    integrationNote: "需 Glassnode / CryptoQuant 链上指标",
  },
  {
    rank: 5,
    id: "realized-price",
    name: "Realized Price",
    sources: "Glassnode / Coin Metrics",
    purpose: "牛熊成本线",
    description:
      "按币天加权的「已实现价格」，可理解为全链平均成本基准。\n研究依据：Coin Metrics & Glassnode 研究（2020-2024）反复验证已实现价格是区分牛熊周期的最重要链上价格参考线，从 #13 提升至 #5。\n用途：现价 vs 已实现价的相对位置是 BTC 长期周期阶段（积累/扩张/分配）的核心判据。\n与 BTC：价格显著低于已实现价时，历史上多处于深度价值区（矿工投降/恐慌底）；非投资建议。",
    integration: "none",
    integrationNote: "需链上供应估值（Glassnode / Coin Metrics）",
  },
  {
    rank: 6,
    id: "lth-supply",
    name: "LTH Supply",
    sources: "Glassnode",
    purpose: "长期持有者行为",
    description:
      "长期持有者（持有 >155 天）筹码占比或绝对量变化。\n研究依据：Glassnode 研究（2021-2024）验证 LTH 供应变化是判断周期阶段转换（积累→扩张→分配）最可靠的链上结构信号之一，从 #14 提升至 #6。\n用途：衡量「坚定筹码」与「浮动筹码」结构；LTH 供应减少且价格新高=分配压力上升。\n与 BTC：LTH 持续积累通常偏中长期支撑；集中派发阶段若与 MVRV 高值共振，需警惕周期顶风险。",
    integration: "none",
    integrationNote: "需 Glassnode 链上持仓分层数据",
  },
  {
    rank: 7,
    id: "puell-multiple",
    name: "Puell Multiple",
    sources: "Glassnode",
    purpose: "矿工周期",
    description:
      "矿工日收入相对其 365 日均线的比值（矿工「景气度」指标）。\n研究依据：Glassnode 及矿工周期研究验证 Puell Multiple 极值与 BTC 周期顶底历史吻合，是判断矿工资本开支意愿的核心指标，从 #15 提升至 #7。\n用途：矿工现金流压力（极端低值=成本线以下，出清概率上升）与出货动机（极端高值=超额利润）。\n与 BTC：极端低位配合算力出清（hashRate 急跌），历史上多为深度价值信号；极端高位配合 MVRV 过热，需关注分配压力。",
    integration: "none",
    integrationNote: "需 Glassnode 链上矿工收入数据",
  },
  {
    rank: 8,
    id: "open-interest-aggregated",
    name: "Open Interest Aggregated",
    sources: "Coinglass / Binance",
    purpose: "杠杆规模",
    description:
      "未平仓合约总额：当前市场承载的衍生品名义风险。\n用途：区分「价涨+OI 增」的新增杠杆多头 vs 「价涨+OI 降」的空头回补。\n与 BTC：OI 快升+费率极端时，清算级波动风险上升；OI 快速去化通常是清洗信号。",
    integration: "partial",
    integrationNote: "见永续监控模块",
  },
  {
    rank: 9,
    id: "miner-outflow",
    name: "Miner Outflow",
    sources: "CryptoQuant",
    purpose: "矿工抛压",
    description:
      "从矿工地址转出的 BTC 流量。\n用途：矿工向交易所或 OTC 转移常解读为潜在卖压，配合 Puell Multiple 判断是否处于集中出货期。\n与 BTC：短期脉冲性上升值得关注；需区分内部钱包整理与真实卖出；Puell 低值时矿工出流更具信号价值。",
    integration: "none",
    integrationNote: "需 CryptoQuant 链上流量",
  },
  {
    rank: 10,
    id: "exchange-btc-reserve",
    name: "Exchange BTC Reserve",
    sources: "CryptoQuant / Glassnode",
    purpose: "抛压 / 囤币",
    description:
      "交易所钱包中 BTC 存量估计。\n用途：链上转入交易所≈潜在卖压；净流出≈囤币或冷存；长期下降趋势是市场常引用的供给收缩叙事之一。\n与 BTC：储备趋势性下降常被视为中长期利多叙事（需结合价量验证，非充分条件）。",
    integration: "none",
    integrationNote: "需链上数据供应商（CryptoQuant / Glassnode）",
  },
  {
    rank: 11,
    id: "liquidation-data",
    name: "Liquidation Data",
    sources: "Coinglass",
    purpose: "爆仓反转",
    description:
      "一段时间内多头/空头被强制平仓的名义金额。\n用途：捕捉「级联清算」后的均值回归或燃料耗尽；短期战术信号，中长期权重低。\n与 BTC：单边大额爆仓后，短期常出现过度修正或反弹；配合 OI 和 funding 看清洗是否充分。",
    integration: "none",
    integrationNote: "需 Coinglass 等清算数据",
  },
  {
    rank: 12,
    id: "stablecoin-total-mcap",
    name: "Stablecoin Total Market Cap",
    sources: "DefiLlama",
    purpose: "场内流动性",
    description:
      "主要美元稳定币总市值变化。\n用途：代表加密市场「弹药池」扩容或收缩；Cong-Xiao (2023) 将稳定币供应列为 BTC 流动性的结构性代理变量。\n与 BTC：稳定币总盘子上升，通常利于风险资产定价；持续收缩则需警惕流动性逆风。",
    integration: "none",
    integrationNote: "可接 DefiLlama stablecoins API",
  },
  {
    rank: 13,
    id: "spot-cvd",
    name: "Spot CVD",
    sources: "Kaiko / 交易所 API",
    purpose: "主动买卖力量",
    description:
      "Cumulative Volume Delta：主动买量−主动卖量的累计。\n用途：比单纯成交量更能看出「谁在主动吃单」；价格新高而 CVD 走弱，提示上涨质量不佳（背离）。\n与 BTC：短期战术信号，配合 OI 和 funding 判断主动多空力量是否与杠杆方向一致。",
    integration: "partial",
    integrationNote: "极端波动模块含 CVD 说明与相关序列",
  },
  {
    rank: 14,
    id: "stablecoin-exchange-inflow",
    name: "Stablecoin Exchange Inflow",
    sources: "CryptoQuant",
    purpose: "潜在买盘",
    description:
      "稳定币净流入交易所的规模。\n用途：「子弹上膛」—预备在 CEX 上买现货/合约的购买力；通常需持续大额流入才有统计意义。\n与 BTC：持续大额流入有时领先于反弹或波动放大（非必然因果，需排除季节性和交易所套利因素）。",
    integration: "none",
    integrationNote: "需 CryptoQuant 链上稳定币流量",
  },
  {
    rank: 15,
    id: "deribit-iv",
    name: "Deribit IV",
    sources: "Deribit / Amberdata",
    purpose: "波动率预期",
    description:
      "期权市场隐含的波动率水平（DVOL 或 ATM IV）。\n研究依据：Alexander-Baig (2020) 验证期权 IV 是 BTC 已实现波动率的领先预测指标（对应看板中已升为 S 级的 DVOL）。\n用途：IV 极低时常酝酿波动释放；IV 极高时卖方占优、现货易剧烈摆动；适合判断「会不会波动」而非方向。\n与 BTC：方向中性的风险量化工具，需结合 25D Skew 判断市场对方向的偏好。",
    integration: "none",
    integrationNote: "需 Deribit / Amberdata 期权数据（看板 DVOL 已部分覆盖）",
  },
  {
    rank: 16,
    id: "25d-skew",
    name: "25D Skew",
    sources: "Deribit / Amberdata",
    purpose: "期权方向偏好",
    description:
      "25 Delta Risk Reversal：看涨与看跌隐含波动率之差。\n用途：市场愿意为哪一侧「灾难保险」付更高溢价，反映期权市场的方向性偏好。\n与 BTC：Skew 偏负（puts 更贵）=市场主要担忧下行尾部；偏正（calls 更贵）=市场追逐上行杠杆；配合 IV 水平一起解读。",
    integration: "none",
    integrationNote: "需期权曲面数据（Deribit / Amberdata）",
  },
  {
    rank: 17,
    id: "order-book-depth",
    name: "Order Book Depth",
    sources: "Kaiko / Binance",
    purpose: "流动性与滑点",
    description:
      "盘口一定距离内的挂单量（买卖墙）。\n用途：评估大单冲击成本与短期支撑/阻力；流动性薄的市场价格更易被撬动，清算链式反应也更剧烈。\n与 BTC：深买墙可能在下跌中提供缓冲；深卖墙压制突破效率；需实时获取，静态截图意义有限。",
    integration: "partial",
    integrationNote: "OKX 深度在波动监控中可参考",
  },
  {
    rank: 18,
    id: "dex-volume",
    name: "DEX Volume",
    sources: "DefiLlama / Dune",
    purpose: "链上交易活跃",
    description:
      "去中心化交易所成交总额。\n用途：链上投机与 DeFi 活跃度；主要反映 ETH 生态风险偏好，对 BTC 为间接指标。\n与 BTC：整体上升常反映风险偏好改善，与 BTC 多为同向 β 环境；DEX 活跃通常滞后于 CEX 量能。",
    integration: "none",
    integrationNote: "可接 DefiLlama DEX 聚合数据",
  },
  {
    rank: 19,
    id: "smart-money-flow",
    name: "Smart Money Flow",
    sources: "Nansen",
    purpose: "资金提前布局",
    description:
      "标签为 Smart Money 的钱包净流向（链上+部分 CEX 标签）。\n用途：跟踪相对活跃资金的板块轮动和仓位变化；Nansen 标签体系基于历史行为打分，非零知识证明。\n与 BTC：可观察资金是先回流 BTC 还是流向山寨龙头；Smart Money 的准确率因周期差异显著，需综合判断。",
    integration: "none",
    integrationNote: "需 Nansen 订阅数据",
  },
  {
    rank: 20,
    id: "whale-exchange-deposit",
    name: "Whale Exchange Deposit",
    sources: "Arkham / Nansen",
    purpose: "大户抛压",
    description:
      "大户地址向交易所的充值事件监控。\n用途：链上「聪明钱」或巨鲸的短期卖压预警；需结合地址标签可信度判断。\n与 BTC：大额连续充值提高短期回调概率（统计规律，非必然）；配合 exchange-btc-reserve 趋势一起看。",
    integration: "none",
    integrationNote: "需 Arkham / Nansen 地址标签数据",
  },
  {
    rank: 21,
    id: "bridge-netflow",
    name: "Bridge Netflow",
    sources: "DefiLlama / Dune",
    purpose: "公链资金迁移",
    description:
      "跨链桥净流入/净流出。\n用途：看资金在 L1/L2 之间的轮动，反映生态竞争格局变化。\n与 BTC：间接指标；风险偏好与生态竞争会影响山寨，进而反馈到 BTC dominance 和整体加密市值结构。",
    integration: "none",
    integrationNote: "需桥数据聚合面板（DefiLlama Bridges）",
  },
  {
    rank: 22,
    id: "chain-revenue-fees",
    name: "Chain Revenue / Fees",
    sources: "Token Terminal / Artemis",
    purpose: "项目基本面",
    description:
      "公链或协议的费用/收入类基本面。\n用途：评估真实使用需求 vs 代币激励驱动的虚高；BTC 费用更多反映拥堵与铭文/NFT 活动。\n与 BTC：BTC 链费用上升常反映链上热度与博弈需求；与短期价格更多为同向而非领先关系。",
    integration: "none",
    integrationNote: "需 Token Terminal / Artemis 协议数据",
  },
  {
    rank: 23,
    id: "tvl-by-chain",
    name: "TVL by Chain",
    sources: "DefiLlama",
    purpose: "DeFi 风险偏好",
    description:
      "各链锁仓总价值。\n用途：DeFi 资本沉淀与杠杆 farming 意愿；TVL 增长质量（真实用户 vs 积分激励）需辨别。\n与 BTC：TVL 扩张常出现在风险偏好上升阶段，与 BTC 多为同向；TVL 大幅收缩时需关注去杠杆传导。",
    integration: "none",
    integrationNote: "可接 DefiLlama TVL API",
  },
  {
    rank: 24,
    id: "token-unlock",
    name: "Token Unlock",
    sources: "Tokenomist / Messari",
    purpose: "供给冲击",
    description:
      "未来代币解锁日历与规模。\n用途：评估项目方、投资人、团队的潜在卖压时间表；对山寨影响最直接。\n与 BTC：大盘情绪差时解锁事件更易砸盘；集中解锁若与宏观走弱叠加，可能拖累整体风险偏好进而间接影响 BTC。",
    integration: "none",
    integrationNote: "需 Tokenomist / Messari 解锁日历",
  },
  {
    rank: 25,
    id: "active-addresses",
    name: "Active Addresses",
    sources: "Coin Metrics / Artemis",
    purpose: "链上活跃度",
    description:
      "活跃地址数等网络用量指标。\n用途：用户增长或投机活跃度的代理变量；趋势比单日读数更有意义。\n与 BTC：趋势性上升可支持采用叙事；单点爆量需辨别是转账还是粉尘/混币，避免误读。",
    integration: "none",
    integrationNote: "需 Coin Metrics / Artemis 链上数据",
  },
  {
    rank: 26,
    id: "exchange-netflow",
    name: "Exchange Netflow",
    sources: "Glassnode / CryptoQuant",
    purpose: "买卖压力",
    description:
      "全市场或主要交易所的 BTC 净流入/净流出。\n用途：比单看储备更偏短期流量节奏；但噪声较大，需多日平滑。\n与 BTC：净入所偏空解读、净出所偏多解读是主流框架（需去噪和去除内部转账）。",
    integration: "none",
    integrationNote: "需链上流量数据（Glassnode / CryptoQuant）",
  },
  {
    rank: 27,
    id: "fear-greed",
    name: "Fear & Greed",
    sources: "Alternative.me",
    purpose: "情绪背景",
    description:
      "综合波动率、动量、社交、调查等的 0–100 情绪指数。\n用途：极端读数作逆向参考或波动率背景，不单独作为趋势信号；已集成至看板 KPI。\n与 BTC：极度贪婪阶段波动加剧；极度恐慌后常见技术性反弹（历史统计，非保证）。",
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
      "社交渠道上某资产的讨论量与情绪。\n用途：识别 FOMO 或恐慌传播是否过热；社交指标在衍生品数据充足时权重较低。\n与 BTC：社交量异常放大有时对应短期顶部或事件驱动波动；但与价格同步性强，领先性有限。",
    integration: "none",
    integrationNote: "需 Santiment / LunarCrush 订阅数据",
  },
  {
    rank: 29,
    id: "developer-activity",
    name: "Developer Activity",
    sources: "Santiment / GitHub",
    purpose: "长期质量",
    description:
      "代码提交、开发者活跃度代理指标。\n用途：评估生态是否「空心化」；对 BTC 本身权重低，对公链/L2/DeFi 协议更相关。\n与 BTC：生态弱则风险偏好下降，间接影响 BTC；开发活跃通常是叙事基础，而非短期价格驱动。",
    integration: "none",
    integrationNote: "需 GitHub / Santiment 开发活跃度数据",
  },
  {
    rank: 30,
    id: "macro-liquidity-dxy-us10y-fed",
    name: "Macro Liquidity: DXY / US10Y / Fed Rate",
    sources: "FRED / TradingView / Yahoo",
    purpose: "风险资产大环境",
    description:
      "美元指数、美债收益率、政策利率等综合宏观锚。\n研究依据：Bianchi-Tamoni (2022) 验证实际利率和美元流动性是加密资产跨截面收益的定价因子；宏观看板已覆盖核心系列。\n用途：判断全球流动性与贴现率环境。\n与 BTC：DXY↑、实际利率↑ 历史上多压制 BTC；宽松预期与收益率回落阶段更友好（相关性随周期变化）。",
    integration: "partial",
    integrationNote: "宏观页可查看 DXY、美债、联邦基金利率等",
  },
]
