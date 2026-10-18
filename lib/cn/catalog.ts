export type Point = { date: string; value: number; sourceUrl?: string; publishedAt?: string | null; fetchedAt?: string }
export type Group = "activity" | "prices" | "money" | "fiscal" | "markets"
export type Definition = {
  id: string; name: string; short: string; group: Group; unit: string
  frequency: "monthly" | "daily" | "annual"; provider: "eastmoney" | "worldbank" | "imf" | "yahoo" | "mof"
  report: string; field: string; dateField?: string; legacy?: boolean; reference?: number
  noScore?: boolean; seasonal?: boolean; estimated?: boolean; price?: boolean
  meaning: string; high: string; low: string; caveat: string; sourceUrl: string; origin: string
}
const em = "https://data.eastmoney.com/cjsj/"
export const GROUPS: { id: Group; name: string; subtitle: string }[] = [
  { id: "activity", name: "实体需求", subtitle: "生产、消费与景气" },
  { id: "prices", name: "价格温度", subtitle: "终端价格与工业价格" },
  { id: "money", name: "货币信用", subtitle: "货币增速与信贷投放" },
  { id: "fiscal", name: "财政债务", subtitle: "收入能力与债务存量" },
  { id: "markets", name: "市场定价", subtitle: "利率、风险与预期" },
]
const monthly = (d: Omit<Definition, "frequency" | "provider" | "sourceUrl" | "origin"> & { origin?: string; sourceUrl?: string }): Definition => ({ frequency: "monthly", provider: "eastmoney", sourceUrl: em, origin: "国家统计局（东方财富转引）", ...d })
export const SERIES: Definition[] = [
  ...[
    { id: "lg_issuance", field: "issuance", name: "地方债当月发行", short: "地方政府融资", unit: "亿元", seasonal: true, meaning: "财政部披露的当月地方政府债券发行总额，不是净融资或新增支出。", caveat: "严格区分当月和年初累计；发行高低还受额度下达及季节性影响。" },
    { id: "lg_refinance", field: "refinance", name: "地方再融资债当月发行", short: "接续与置换", unit: "亿元", seasonal: true, meaning: "再融资债包含到期接续等用途，不能全部算成隐债置换。", caveat: "本指标是再融资债总发行，不是化债执行进度。未披露月份不填0。" },
    { id: "lg_balance", field: "balance", name: "地方政府债务余额", short: "法定政府债务", unit: "亿元", noScore: true, meaning: "财政部披露的地方政府债务余额，反映法定口径存量。", caveat: "不包括全部城投经营债，不与IMF口径直接相加。存量有长期趋势，不用水平Z分数判定风险。" },
    { id: "lg_rate", field: "rate", name: "地方债当月平均发行利率", short: "新融资成本", unit: "%", meaning: "财政部披露的当月新发行地方债平均利率。", caveat: "发行期限和地区构成变化影响均值，不等于同一债务置换前后的利差。" },
  ].map(d => ({ ...d, frequency: "monthly" as const, provider: "mof" as const, group: "fiscal" as const, report: "MOF_MONTHLY", origin: "财政部原文 · 自动采集", sourceUrl: "https://zwgls.mof.gov.cn/tjsj/", high: "该指标相对历史偏高，应结合用途、期限和当地财力解释。", low: "该指标相对历史偏低，不应独立推断财政支持或债务风险。" })),
  monthly({ id: "pmi", name: "制造业 PMI", short: "制造业景气", group: "activity", unit: "指数", report: "RPT_ECONOMY_PMI", field: "MAKE_INDEX", reference: 50, meaning: "采购经理调查的扩张与收缩分界为50；不是GDP增速。", high: "制造业景气相对历史偏强，继续核对新订单与企业现金流。", low: "制造业景气相对历史偏弱，政策到订单的传导仍需验证。", caveat: "历史分位与50荣枯线不同；高于50也可能处于历史低位。", sourceUrl: `${em}pmi.html` }),
  monthly({ id: "nonpmi", name: "非制造业商务活动", short: "服务与建筑", group: "activity", unit: "指数", report: "RPT_ECONOMY_PMI", field: "NMAKE_INDEX", reference: 50, meaning: "覆盖建筑业与服务业的商务活动，不是纯服务业PMI。", high: "非制造业活动相对偏强，仍需拆分建筑与服务需求。", low: "非制造业活动相对偏弱，观察就业、订单与消费。", caveat: "不能把非制造业全部归因于消费。" }),
  monthly({ id: "retail", name: "社会消费品零售同比", short: "消费修复", group: "activity", unit: "%", report: "RPT_ECONOMY_TOTAL_RETAIL", field: "RETAIL_TOTAL_SAME", meaning: "消费品零售的名义同比变化，不含全部服务消费。", high: "商品消费增速相对偏高，需排除基数与价格因素。", low: "商品消费修复相对偏慢，居民需求接力仍需观察。", caveat: "春节错位与低基数影响明显；1—2月合并发布不拆造月值。" }),
  monthly({ id: "industrial", name: "工业增加值同比", short: "工业生产", group: "activity", unit: "%", report: "RPT_ECONOMY_INDUS_GROW", field: "BASE_SAME", meaning: "规模以上工业生产的实际同比增速。", high: "工业生产相对较强，核对订单与库存，避免把生产等同需求。", low: "工业生产相对偏弱，观察订单、库存与利润。", caveat: "范围不等于全社会产出；1—2月数据可能合并披露。" }),
  monthly({ id: "cpi", name: "CPI 同比", short: "居民消费价格", group: "prices", unit: "%", report: "RPT_ECONOMY_CPI", field: "NATIONAL_SAME", reference: 0, meaning: "居民消费价格相对上年同期的涨幅。", high: "消费价格相对偏热；不直接代表购买力或股市上涨。", low: "消费价格相对偏冷，需结合食品、核心价格与需求。", caveat: "同比存在基数效应；不能单凭一个月判断通缩。", sourceUrl: `${em}cpi.html` }),
  monthly({ id: "ppi", name: "PPI 同比", short: "工业品价格", group: "prices", unit: "%", report: "RPT_ECONOMY_PPI", field: "BASE_SAME", reference: 0, meaning: "工业生产者出厂价格同比，是工业定价与利润环境的线索。", high: "工业价格相对偏强，但可能挤压下游成本。", low: "工业品价格相对偏弱，观察企业利润与债务实际负担。", caveat: "行业分化大；不能把价格上涨都当作需求改善。", sourceUrl: `${em}ppi.html` }),
  monthly({ id: "m2", name: "M2 同比", short: "广义货币", group: "money", unit: "%", report: "RPT_ECONOMY_CURRENCY_SUPPLY", field: "BASIC_CURRENCY_SAME", origin: "中国人民银行（东方财富转引）", meaning: "广义货币存量同比，不是新增财政支出。", high: "货币增速相对偏高；资金是否进入实体仍需信贷与订单验证。", low: "货币增速相对偏低，不能脱离融资结构解释。", caveat: "M2增长不等于流入股票；本模块不拼接2025年断点前后的M1。" }),
  monthly({ id: "loans", name: "新增人民币贷款", short: "信贷投放", group: "money", unit: "亿元", report: "RPT_ECONOMY_RMB_LOAN", field: "RMB_LOAN", seasonal: true, origin: "中国人民银行（东方财富转引）", meaning: "当期新增贷款流量，不是存量，不等于全部私人部门融资。", high: "投放高于过去同月水平；还需看居民、企业与票据构成。", low: "投放低于过去同月水平；可能有需求、置换与季节因素。", caveat: "只与过去同一日历月比较，至少5个样本；未经季调信贷不做简单环比判断。" }),
  monthly({ id: "fiscal", name: "财政收入累计同比", short: "财政收入", group: "fiscal", unit: "%", report: "RPT_ECONOMY_INCOME", field: "ACCUMULATE_SAME", origin: "财政部（东方财富转引）", meaning: "年初至统计期末的财政收入增速，用于观察财政收入端。", high: "收入增长相对较强，进一步核对税收与非税结构。", low: "收入增长相对较弱，偿付能力改善不能只依靠展期。", caveat: "累计同比不是单月同比，不包含全部土地出让收入；不等于地方可用财力。" }),
  { id: "cn10y", name: "中国10年国债收益率", short: "长期资金价格", group: "markets", unit: "%", frequency: "daily", provider: "eastmoney", report: "RPTA_WEB_TREASURYYIELD", field: "EMM00166466", dateField: "SOLAR_DATE", legacy: true, origin: "中债收益率（东方财富转引）", sourceUrl: "https://data.eastmoney.com/cjsj/zmgzsyl.html", meaning: "长期无风险利率的市场定价参考，非保证可成交收益率。", high: "长端利率相对偏高，长久期资产价格对上行风险敏感。", low: "长端利率相对偏低，可能反映避险、需求偏弱或宽松预期。", caveat: "低信用风险不等于低净值波动；收益率下降通常对应存量固定利率债价格上升。" },
  { id: "cn2y", name: "中国2年国债收益率", short: "短端资金价格", group: "markets", unit: "%", frequency: "daily", provider: "eastmoney", report: "RPTA_WEB_TREASURYYIELD", field: "EMM00166462", dateField: "SOLAR_DATE", legacy: true, origin: "中债收益率（东方财富转引）", sourceUrl: "https://data.eastmoney.com/cjsj/zmgzsyl.html", meaning: "短期限国债的收益率参考，可与同日10年期构造期限利差。", high: "短端利率相对偏高，融资与持债成本需进一步观察。", low: "短端利率相对偏低，可能反映宽松或资金需求偏弱。", caveat: "期限利差是10年减2年，不是城投信用利差。" },
  monthly({ id: "lpr", name: "1年期 LPR", short: "贷款报价", group: "money", unit: "%", report: "RPTA_WEB_RATE", field: "LPR1Y", dateField: "TRADE_DATE", origin: "全国银行间同业拆借中心（东方财富转引）", meaning: "贷款市场报价利率，不等于每位借款人的实际贷款成本。", high: "贷款报价相对偏高，观察企业实际融资成本。", low: "贷款报价相对偏低，能否刺激需求还需贷款与订单验证。", caveat: "采用2019-08改革后月频口径，不拼接此前旧制度日频。政策阶梯可能长期不变，MAD为0时不计算稳健异常分。" }),
  { id: "equity", name: "沪深300价格指数", short: "权益风险偏好", group: "markets", unit: "点", frequency: "daily", provider: "yahoo", report: "000300.SS", field: "close", price: true, origin: "Yahoo / 东方财富二次行情（实际来源见链接）", sourceUrl: "https://finance.yahoo.com/quote/000300.SS/", meaning: "大盘股票的价格表现；用于对照政策预期与波动。", high: "价格处于近期高位，必须另看盈利与估值，不代表便宜。", low: "价格处于近期低位，不意味着已经见底。", caveat: "日终/延迟行情；使用未含分红的价格收益，非总回报，不是化债因果收益。" },
  { id: "debt", name: "IMF一般政府债务 / GDP", short: "政府杠杆", group: "fiscal", unit: "%GDP", frequency: "annual", provider: "imf", report: "GGXWDG_NGDP", field: "", estimated: true, origin: "IMF WEO（年度估算口径）", sourceUrl: "https://www.imf.org/external/datamapper/profile/CHN", meaning: "IMF口径的一般政府总债务比率，用于中长期背景观察。", high: "该口径杠杆相对历史较高，需要看收入、利息与名义增长。", low: "该口径杠杆相对历史较低，不足以单独判定债务安全。", caveat: "不等于中国官方认定隐债，不与其相加。只展示已结束年份，仍可能含估算；不进入温度评分。" },
  { id: "gdp", name: "实际 GDP 年度增长", short: "长期增长", group: "activity", unit: "%", frequency: "annual", provider: "worldbank", report: "NY.GDP.MKTP.KD.ZG", field: "", origin: "世界银行 WDI", sourceUrl: "https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG?locations=CN", meaning: "中国实际GDP年度增长，用于长周期历史对照。", high: "年度增长相对历史偏高，不表示未来增速会持续。", low: "年度增长相对历史偏低，应结合发展阶段解释。", caveat: "年频、修订后数据，不进入当期月度温度，不能用于当时可知回测。" },
  { id: "govcons", name: "政府最终消费 / GDP", short: "政府消费结构", group: "fiscal", unit: "%GDP", frequency: "annual", provider: "worldbank", report: "NE.CON.GOVT.ZS", field: "", origin: "世界银行 WDI", sourceUrl: "https://data.worldbank.org/indicator/NE.CON.GOVT.ZS?locations=CN", meaning: "政府最终消费支出占GDP比例，用于结构观察。", high: "政府最终消费占比相对较高，不能等同刺激力度。", low: "政府最终消费占比相对较低，需结合其他支出项目。", caveat: "不是财政总支出、政府投资或化债资金，不能彼此替代。" },
]
export const BY_ID = Object.fromEntries(SERIES.map(d => [d.id, d])) as Record<string, Definition>
export type SeriesData = {
  id: string; points: Point[]; status: "ok" | "partial" | "unavailable"
  fetchedAt: string | null; publishedAt: string | null; sourceUrl: string
  warning: string | null; complete: boolean; firstDate: string | null; lastDate: string | null
  latestVerified?: boolean
}
export const METHODS = [
  { title: "历史分位", formula: "100 × (低于当前的样本数 + 0.5 × 相同值样本数) / N", text: "当前值不进入基准。月频取此前60期、日频756期；信贷流量只取过去10年同月，少于5个不评分。P10/P90为本站观察阈值，不是投资买卖点。", url: "https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm" },
  { title: "Z-score 与稳健异常", formula: "Z = (x − 均值) / 样本标准差；M = 0.6745 × (x − 中位数) / MAD", text: "月/日频至少24个基准样本；|M|>3.5标记潜在异常。分布不一定正态，不能把Z转成投资胜率。MAD为0返回缺失，不伪造无限值。", url: "https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm" },
  { title: "趋势与周期", formula: "当前值 − 3个连续月前的值；PMI以50为荣枯参考", text: "变化显示百分点或基点，而非将利率变化错误写成涨跌收益。缺月不跨期顶替；未经季调信贷不做这个比较。年度与陈旧序列不进入温度。", url: "https://data.eastmoney.com/cjsj/pmi.html" },
  { title: "市场风险与事件复盘", formula: "252期峰值回撤；日对数收益标准差 × √252", text: "仅对股票价格序列计算。事件前后收益是价格同期变化，不含分红、费用，不声称政策导致涨跌。数据按最新修订版回看，不是point-in-time回测。", url: "https://www.investor.gov/introduction-investing/investing-basics/investment-products/bonds-or-fixed-income-products/bonds" },
]
