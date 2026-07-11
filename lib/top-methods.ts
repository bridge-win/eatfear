import { PRACTITIONER_SIGNAL_CORPUS, type PractitionerPriority } from "@/lib/research-corpus"

/**
 * Bilingual "Top 100 money-making methods" summary layer.
 *
 * The English side derives directly from PRACTITIONER_SIGNAL_CORPUS
 * (method/interpretation/failureMode) so there is a single English source of
 * truth; this file only authors the Chinese join table plus the executable
 * playbook tier from docs/PLAYBOOKS_SPEC.md. A unit-style invariant in
 * getTopMethodSummaries() guarantees every corpus id has a zh entry.
 */

export interface LocalizedMethodText {
  name: string
  /** How the method makes money — the edge, one line. */
  edge: string
  /** How it loses money — the failure mode, one line. */
  risk: string
}

interface MethodZh {
  [id: string]: LocalizedMethodText
}

const METHOD_ZH: MethodZh = {
  // ── On-chain 链上 ──────────────────────────────────────────────────────
  m001: { name: "交易所储备趋势", edge: "储备下降=抛压库存减少,支持持有;上升=抛压预警", risk: "托管迁移与 ETF 钱包调仓会掩盖真实意图" },
  m002: { name: "交易所净流量", edge: "净流出支持积累判断,净流入预警派发", risk: "交易所内部转账制造假信号" },
  m003: { name: "交易所流入激增", edge: "大额充值常先于抛售或波动,提前减仓/对冲", risk: "OTC 与抵押转账并非现货抛售" },
  m004: { name: "流入币龄销毁(CDD)", edge: "老币进交易所=老手派发风险,跟随减仓", risk: "托管迁移看起来像老持有者抛售" },
  m005: { name: "矿工储备趋势", edge: "矿工储备下降提示矿工抛压,规避或等待吸收", risk: "矿池钱包标注变化扭曲读数" },
  m006: { name: "Coinbase 溢价", edge: "正溢价=美国现货买盘强,顺势持有", risk: "稳定币锚定与计价货币差扭曲溢价" },
  m007: { name: "泡菜溢价", edge: "韩国极端溢价=散户 FOMO 顶部风险,反向减仓", risk: "韩元管制与本地流动性冲击主导" },
  m008: { name: "已实现价格收复/跌破", edge: "价格站上已实现价格=宏观修复做多;跌破=投降区风险", risk: "熊市横盘可长期贴着该位运行" },
  m009: { name: "SOPR 1.0 体制", edge: "SOPR 回踩 1.0 获支撑=牛市需求确认,做多", risk: "链上结算清淡时信号变弱" },
  m010: { name: "aSOPR 回收", edge: "aSOPR 重回 1 上方=获利盘被吸收,趋势健康", risk: "日内噪音与交易所批量处理干扰" },
  m011: { name: "长短手 SOPR 比", edge: "长手获利了结 vs 短手止损对比,判断周期轮动位置", risk: "持有期阈值划分粗糙" },
  m012: { name: "MVRV 区间", edge: "低 MVRV 买价值区,高 MVRV 减仓获利饱和区", risk: "ETF 时代结构变化使历史区间漂移" },
  m013: { name: "短手 MVRV 公允值", edge: "STH-MVRV≈1 或以下=短手成本支撑区,逢低吸纳", risk: "动量崩溃可长期低于 1" },
  m014: { name: "长手 MVRV 过热", edge: "长手浮盈过高=派发风险,提前止盈", risk: "沉睡币扭曲比率" },
  m015: { name: "NUPL 体制", edge: "投降区买入赔率优,亢奋区收益/风险恶化则减仓", risk: "阈值随周期漂移" },
  m016: { name: "HODL 波龄迁移", edge: "老币占比升=积累期布局;新币激增=投机后期减仓", risk: "丢失币与托管批量扭曲龄层" },
  m017: { name: "已实现市值 HODL 波", edge: "新钱主导已实现价值=周期后段过热,防守", risk: "ETF/托管移动改变龄层" },
  m018: { name: "币龄休眠飙升", edge: "休眠激增=老手动币,预警波动或转折", risk: "钱包合并与安全迁移是噪音" },
  m019: { name: "花费产出龄带", edge: "高位老币带放量=派发预警,减仓", risk: "交易所 UTXO 管理伪装成移动" },
  m020: { name: "积累趋势评分", edge: "大实体持续积累=趋势质量高,持有加仓", risk: "实体聚类识别误差" },
  // ── Derivatives 衍生品 ────────────────────────────────────────────────
  m021: { name: "永续资金费率极值", edge: "极正=多头拥挤反向减/空;极负=空头拥挤反向多", risk: "强趋势可长期维持极值" },
  m022: { name: "OI+资金费率拥挤", edge: "OI 升+费率极端=清算风险高,提前避险或反向", risk: "对冲基差仓位虚增 OI" },
  m023: { name: "负费率轧空", edge: "价涨+费率为负=轧空燃料,顺势做多", risk: "现货驱动的行情可能快速回吐" },
  m024: { name: "OI 压缩突破", edge: "窄幅震荡中 OI 积累=突破蓄能,突破跟随", risk: "不看流向无法预知方向" },
  m025: { name: "OI 清洗重置", edge: "连环爆仓后 OI 骤降=仓位干净,布局反弹", risk: "熊市趋势中可能只是中继" },
  m026: { name: "期货年化基差", edge: "高基差做套利收carry;深贴水=压力见底信号", risk: "ETF 基差交易扭曲信号" },
  m027: { name: "CME 与离岸基差", edge: "CME 溢价=机构需求顺势;贴水=谨慎", risk: "移仓与 ETF 对冲影响" },
  m028: { name: "期限结构", edge: "contango 正常收carry;backwardation=压力,择机布局", risk: "远月流动性差扭曲曲线" },
  m029: { name: "跨所费率离散", edge: "费率分化=局部杠杆或套利机会", risk: "交易所故障与延迟主导" },
  m030: { name: "清算簇距离", edge: "价格附近清算簇=磁吸目标,顺势打簇或提前避让", risk: "簇估算依赖杠杆假设" },
  m031: { name: "币本位/U 本位 OI 结构", edge: "币本位占比升=凸性清算风险,减杠杆", risk: "交易所覆盖不全" },
  m032: { name: "大户多空比背离", edge: "大户一边倒时反向博弈", risk: "大户可能在别处对冲" },
  // ── Stablecoins 稳定币 ────────────────────────────────────────────────
  m033: { name: "稳定币供应比(SSR)", edge: "SSR 低/下行=场外弹药充足,支持做多", risk: "稳定币用途不止交易" },
  m034: { name: "SSR 趋势振荡器", edge: "SSR 下行趋势确认风险偏好,顺势持有", risk: "增发/销毁时点制造噪音" },
  m035: { name: "交易所稳定币储备", edge: "所内稳定币上升=待入场干火药,偏多", risk: "可能只是避险停泊" },
  m036: { name: "稳定币交易所净流入", edge: "正净流入常先于现货买盘,提前布局", risk: "资金可能持续闲置" },
  m037: { name: "稳定币总供应增速", edge: "供应扩张=流动性扩张,系统性顺风", risk: "发行商监管或激励扭曲供应" },
  m038: { name: "USDT/USDC 结构", edge: "USDT 主导=币圈原生资金;USDC 主导=美元机构资金,判断资金性质", risk: "发行商活动扭曲结构" },
  m039: { name: "稳定币脱锚压力", edge: "脱锚=流动性/传染压力预警,先降风险", risk: "小所报价夸大脱锚" },
  // ── Liquidity 流动性 ─────────────────────────────────────────────────
  m040: { name: "1%-2% 盘口深度", edge: "深度上升=执行环境好、趋势承载力强", risk: "幌骗与快速撤单降低可靠性" },
  m041: { name: "买卖价差", edge: "价差走阔=流动性脆弱,先减仓避免滑点", risk: "新闻窗口与维护期临时性走阔" },
  m042: { name: "滑点模拟", edge: "模拟滑点高=下调单笔规模,保护执行成本", risk: "隐藏流动性未被捕捉" },
  // ── ETF/funds ETF与基金 ───────────────────────────────────────────────
  m043: { name: "美国现货 ETF 日净流", edge: "大额净流入=真实现货需求,顺势;净流出=压力", risk: "T+1 报告与基差对冲滞后于价格" },
  m044: { name: "ETF 连续流入", edge: "多日连续流入=趋势持续性强,持有", risk: "震荡期反复打脸" },
  m045: { name: "ETF 累计流趋势", edge: "累计上行=结构性需求,长线底仓依据", risk: "利好可能已被定价" },
  m046: { name: "发行商广度", edge: "多家同时净流入>单一基金流入,信号更强", risk: "基金间轮换互相抵消" },
  m047: { name: "GBTC 流出拖累", edge: "GBTC 主导流出压制需求,等待衰竭再进场", risk: "悬压消化后相关性减弱" },
  m048: { name: "ETF 流滞后效应", edge: "大流量披露后的滞后影响可交易", risk: "结构性关系会衰减" },
  m049: { name: "周度基金资金流", edge: "按资产/地区确认机构风险偏好", risk: "周频滞后于快市" },
  m050: { name: "ETF/CME 基差平仓", edge: "ETF 多+CME 空的解仓会双向施压,提前预判", risk: "真实对冲账本难以识别" },
  // ── Macro 宏观 ────────────────────────────────────────────────────────
  m051: { name: "美元流动性指数", edge: "USD 流动性扩张=BTC 贝塔顺风,加仓窗口", risk: "信贷流向可能绕过加密" },
  m052: { name: "美联储资产负债表", edge: "QE/减缓 QT=流动性顺风", risk: "币圈内生冲击可以压倒宏观" },
  m053: { name: "TGA 抽放", edge: "TGA 下降注入流动性=顺风;回补=抽水", risk: "货币基金可吸收发行" },
  m054: { name: "逆回购下行", edge: "RRP 释放对冲 QT,阶段性顺风", risk: "RRP 见底后失效" },
  m055: { name: "M2/全球流动性", edge: "流动性扩张做多 BTC,收缩防守", risk: "相关性随体制切换" },
  m056: { name: "实际利率趋势", edge: "实际利率上行压估值,下行利多", risk: "抗通胀叙事期会失灵" },
  m057: { name: "美元指数代理", edge: "强美元收紧加密流动性,弱美元顺风", risk: "非美需求冲击主导时失效" },
  m058: { name: "FOMC/CPI 事件过滤", edge: "高波动宏观事件前降杠杆,规避跳空", risk: "币圈原生危机时宏观被忽略" },
  m059: { name: "BTC/纳指相关体制", edge: "高相关期把 BTC 当高贝塔科技股交易", risk: "加密催化剂期会脱钩" },
  m060: { name: "油价/收益率冲击过滤", edge: "能源与利率飙升收紧风险偏好,防守", risk: "叙事化、精度低" },
  // ── Sentiment 情绪 ────────────────────────────────────────────────────
  m061: { name: "恐惧贪婪极值", edge: "极度恐惧反向买,极度贪婪减仓", risk: "强趋势可长期停留极值" },
  m062: { name: "恐惧贪婪动量", edge: "恐惧→中性修复=风险买盘确认", risk: "指数方法论变更移动水位" },
  m063: { name: "社交声量激增", edge: "上涨中声量爆表=局部顶/FOMO,反向减仓", risk: "真实新闻也会推高声量" },
  m064: { name: "社交主导度", edge: "被冷落+超卖=机会;全网聚焦=拥挤", risk: "梗与新闻周期扭曲" },
  m065: { name: "加权情绪背离", edge: "价升而情绪降=健康的担忧之墙,持有", risk: "NLP 误判与反讽" },
  m066: { name: "Google 搜索热度", edge: "搜索峰值=散户后期,减仓;无人问津=左侧", risk: "ETF 后搜索行为已改变" },
  m067: { name: "叙事轮动", edge: "新叙事声量上行=板块轮动先行指标", risk: "垃圾信息与机器人操纵" },
  m068: { name: "巨鲸交易计数", edge: "极值区巨鲸活跃=波动或反转预警", risk: "转账未必是交易行为" },
  // ── Order flow 订单流 ─────────────────────────────────────────────────
  m069: { name: "CVD 背离", edge: "价升量弱=虚涨防守;价跌 CVD 升=吸筹做多", risk: "单一交易所口径失真" },
  m070: { name: "吃单买卖比", edge: "主动买占优确认动能,顺势", risk: "刷量与场所偏差" },
  m071: { name: "盘口失衡", edge: "买盘厚支持反弹,卖盘厚压制反抽", risk: "幌骗与瞬时撤单" },
  m072: { name: "买墙邻近度", edge: "近处大买墙=支撑或磁吸,可挂单博弈", risk: "墙会瞬间消失" },
  m073: { name: "卖墙拒绝", edge: "重卖压+弱吃单=拒绝概率高,先减仓", risk: "真突破会吃掉墙" },
  m074: { name: "IOMAP 成本簇", edge: "价格附近大成本簇=天然支撑/阻力位交易", risk: "地址≠交易者" },
  m075: { name: "大户净流量", edge: "巨鲸净积累=趋势质量高,跟随", risk: "托管调仓扭曲流向" },
  m076: { name: "时段流动性择时", edge: "深度充足时段交易,避开薄弱窗口降低成本", risk: "事件风险压倒季节性" },
  // ── Options/vol 期权与波动率 ───────────────────────────────────────────
  m077: { name: "IV/RV 波动溢价", edge: "IV 远高于 RV 卖权收租;RV>IV 买波动", risk: "跳跃风险摧毁 carry" },
  m078: { name: "ATM IV 体制", edge: "低 IV 买便宜期权博弈;高 IV 卖贵溢价", risk: "低波动可以更低更久" },
  m079: { name: "25Δ 风险逆转", edge: "负偏斜=避险需求重(左侧);正偏斜=追涨(右侧过热)", risk: "结构性对冲基线漂移" },
  m080: { name: "IV 期限结构", edge: "倒挂=压力/事件,事后修复可做;正挂=正常 carry", risk: "事件日历解释部分形态" },
  m081: { name: "偏斜期限结构", edge: "近端 put 偏斜=短期恐惧;远端 call 偏斜=长期看涨结构", risk: "翼部流动性差" },
  m082: { name: "看跌/看涨流量比", edge: "put 激增=恐惧对冲;call 激增=投机过热,反向参考", risk: "价差单与对冲难分类" },
  m083: { name: "最大痛点磁吸", edge: "临近交割价格常向最大痛点收敛,区间博弈", risk: "强现货趋势直接碾过" },
  m084: { name: "Gamma 敞口/翻转位", edge: "正 gamma 区间震荡卖波动;负 gamma 助涨助跌顺势", risk: "做市商仓位只能推断" },
  m085: { name: "交割后 Gamma 释放", edge: "交割后钉扎解除,波动释放可提前布局", risk: "需要准确的 dealer 模型" },
  m086: { name: "期权大宗流冲击", edge: "大额方向性结构揭示机构意图,跟随", risk: "名义量可能已对冲" },
  // ── Cycle/valuation 周期与估值 ─────────────────────────────────────────
  m087: { name: "MVRV Z 分数带", edge: "高 Z 过热减仓,低/负 Z 价值区买入", risk: "结构变化后固定带失效" },
  m088: { name: "Puell 倍数", edge: "低值=矿工投降买入区;高值=收入过热减仓区", risk: "减半与手续费体制切换" },
  m089: { name: "Reserve Risk", edge: "低 reserve risk=长线赔率优,底仓布局", risk: "需要数年持有期" },
  m090: { name: "RHODL 比率", edge: "极高=新钱亢奋顶部;低=筑底支持", risk: "市场结构变化移位" },
  m091: { name: "Pi Cycle 顶部", edge: "均线上穿预警周期顶部热度,提示减仓", risk: "样本仅 3 次且曾漏顶" },
  m092: { name: "S2F 偏离", edge: "价格远低于模型=粗略低估参考", risk: "完全忽略需求与流动性" },
  m093: { name: "NVT/NVTS", edge: "低 NVT=网络活动支撑估值;高 NVT=价格跑在使用前面", risk: "交易所/闪电/链下量扭曲" },
  // ── Risk 风险执行 ─────────────────────────────────────────────────────
  m094: { name: "波动率目标定仓", edge: "波动升先减仓、波动降才加仓——活得久才赚得到", risk: "波动跳升快于再平衡" },
  m095: { name: "固定比例风险", edge: "每笔只冒固定小比例风险,复利曲线平滑", risk: "跳空越过止损" },
  m096: { name: "失效价定仓", edge: "用止损距离倒推仓位,而非信心定仓", risk: "薄盘口猎杀止损" },
  m097: { name: "清算缓冲", edge: "清算价远离预期波动区,杠杆才可持续", risk: "ADL 与跳空" },
  m098: { name: "组合回撤熔断", edge: "阈值亏损后停手或降风险,防止螺旋", risk: "可能错过最佳反弹" },
  m099: { name: "CME 期货/期权对冲", edge: "不卖现货对冲下行,保留敞口", risk: "基差与保证金风险" },
  m100: { name: "现金/稳定币储备", edge: "高风险体制抬升现金,留足弹药等恐慌", risk: "强趋势中的机会成本" },
}

export const METHOD_CATEGORY_LABELS: Record<string, { zh: string; en: string }> = {
  "On-chain": { zh: "链上", en: "On-chain" },
  Derivatives: { zh: "衍生品", en: "Derivatives" },
  Stablecoins: { zh: "稳定币", en: "Stablecoins" },
  Liquidity: { zh: "流动性", en: "Liquidity" },
  "ETF/funds": { zh: "ETF 与基金", en: "ETF/funds" },
  Macro: { zh: "宏观", en: "Macro" },
  Sentiment: { zh: "情绪", en: "Sentiment" },
  "Order flow": { zh: "订单流", en: "Order flow" },
  "Options/vol": { zh: "期权与波动率", en: "Options/vol" },
  "Cycle/valuation": { zh: "周期与估值", en: "Cycle/valuation" },
  Risk: { zh: "风险执行", en: "Risk" },
}

export interface TopMethodSummary {
  id: string
  category: string
  priority: PractitionerPriority
  sourceUrl: string
  zh: LocalizedMethodText
  en: LocalizedMethodText
}

/**
 * Joins the English corpus with the zh table. Throws at module-eval time in
 * dev if a corpus id is missing a translation, so the two can never drift.
 */
export function getTopMethodSummaries(): TopMethodSummary[] {
  return PRACTITIONER_SIGNAL_CORPUS.map((method) => {
    const zh = METHOD_ZH[method.id]
    if (!zh) throw new Error(`top-methods: missing zh entry for ${method.id}`)
    return {
      id: method.id,
      category: method.category,
      priority: method.priority,
      sourceUrl: method.url,
      zh,
      en: { name: method.method, edge: method.interpretation, risk: method.failureMode },
    }
  })
}

/** Executable playbook tier from docs/PLAYBOOKS_SPEC.md — methods with full entry/exit/sizing rules. */
export interface PlaybookSummary {
  id: string
  direction: "long" | "short" | "trim" | "program"
  status: "active" | "candidate"
  zh: LocalizedMethodText
  en: LocalizedMethodText
}

export const PLAYBOOK_SUMMARIES: readonly PlaybookSummary[] = [
  {
    id: "pb-01",
    direction: "long",
    status: "active",
    zh: { name: "恐慌插针反转做多", edge: "黑天鹅分≥70+≥2个警报信号+强平证据,次日收上插针中点确认后进场,1R 止盈一半、SMA20 移动止盈", risk: "2018/2022 首次投降后再跌 30–50%——所以必须等确认、必须带插针低点硬止损" },
    en: { name: "Capitulation Reversal Long", edge: "Black Swan ≥70 + ≥2 alert signals + flush evidence; enter on next-close confirmation above the wick midpoint; half off at +1R, trail SMA20", risk: "First capitulation prints in 2018/2022 fell another 30–50% — hence the confirmation gate and hard stop below the wick low" },
  },
  {
    id: "pb-02",
    direction: "trim",
    status: "active",
    zh: { name: "亢奋止盈阶梯", edge: "亢奋分≥68 减 25%,≥82 减至半仓,Mayer≥2.4 只留核心仓;<34 才重新武装", risk: "风险是机会成本——超买可以更久,所以默认动作是减仓而不是做空" },
    en: { name: "Euphoria Trim Ladder", edge: "Euphoria ≥68 trim 25%; ≥82 trim to half; Mayer ≥2.4 keep core only; re-arms below 34", risk: "The cost is opportunity — overbought persists, which is why the default is trimming, not shorting" },
  },
  {
    id: "pb-03",
    direction: "short",
    status: "candidate",
    zh: { name: "吹顶做空(严格门槛)", edge: "四重同时满足才可做:亢奋≥82+拒绝插针+资金费率≥0.10%+OI 膨胀>10%;半仓风险,费率转负立即离场", risk: "2020–2021 每一段亢奋>80 持续数周——回测样本不足前不发实盘警报" },
    en: { name: "Blow-off Short (strictly gated)", edge: "Four simultaneous gates: Euphoria ≥82 + rejection wick + funding ≥0.10% + OI ballooning >10%; half risk; exit instantly on funding flip", risk: "Every 2020–2021 leg held Euphoria >80 for weeks — no live alerts until the backtest sample is sufficient" },
  },
  {
    id: "pb-04",
    direction: "long",
    status: "active",
    zh: { name: "资金费率清洗回归", edge: "费率从>+0.03% 六期内转负 + OI 24期降≥8% + 价格仍在90日低点上方=仓位重置买点,3–7 天", risk: "不接飞刀——价格创90日新低时该场景归 PB-01 管" },
    en: { name: "Funding-Flush Mean Reversion", edge: "Funding flips from >+0.03% to negative within 6 prints + OI −8%/24 prints + price above its 90d low = positioning-reset entry, 3–7d", risk: "Not a knife-catch — if price is at fresh 90d lows the setup belongs to PB-01" },
  },
  {
    id: "pb-05",
    direction: "program",
    status: "active",
    zh: { name: "Mayer 区间定投程序", edge: "Mayer<0.8 每周定投 1 份,<0.6 双倍,≥1.2 停买;2.4 阶梯退出——纪律替代择时", risk: "2018/2022 便宜区又跌 30–50%,防御靠节奏与单位上限,不靠预测" },
    en: { name: "Mayer Value DCA Program", edge: "Mayer <0.8 buy 1 unit weekly, <0.6 double, halt ≥1.2; exit ladder at 2.4 — schedule replaces timing", risk: "The <0.8 zone deepened another 30–50% in 2018/2022; the defense is cadence + unit cap, not prediction" },
  },
  {
    id: "pb-06",
    direction: "long",
    status: "candidate",
    zh: { name: "VIX 恐慌分批入场(美股)", edge: "VIX 收盘≥40(或≥30 且 HY 利差≥550bp)分 3 批 10 个交易日建仓;1990 年来 VIX>40 后 12 个月约 90% 上涨", risk: "2008 失败案例:VIX>40 持续约 8 个月、SPX 再跌约 50%——分批上限是生存机制" },
    en: { name: "VIX Panic Staged Entry (US equity)", edge: "VIX close ≥40 (or ≥30 with HY OAS ≥550bp): 3 tranches over 10 sessions; since 1990, SPX higher 12m after a >40 close ~90% of the time", risk: "2008 failure case: VIX held >40 for ~8 months while SPX fell another ~50% — tranche capping is the survival mechanism" },
  },
  {
    id: "pb-07",
    direction: "program",
    status: "active",
    zh: { name: "回撤阶梯加仓(美股)", edge: "SPX 距 52 周高点 −20% 投 1 份、−30% 投 2 份;HY 利差>800bp 暂停,<700bp 重启", risk: "信用极端压力期阶梯必须暂停——利差熔断就是这个方法的止损" },
    en: { name: "Drawdown Ladder Add (US equity)", edge: "SPX −20% from 52w high deploy unit 1, −30% deploy 2×; pause while HY OAS >800bp, re-arm <700bp", risk: "The OAS circuit-breaker is this method's stop — the ladder must pause in extreme credit stress" },
  },
] as const
