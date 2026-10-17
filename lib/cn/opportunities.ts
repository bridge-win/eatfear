import { BY_ID, type SeriesData } from "./catalog.ts"
import { evaluate } from "./metrics.ts"

export type ThemeId = "debt" | "consumption" | "industry" | "rates" | "broad"
export type EvidenceState = "support" | "against" | "neutral" | "missing"
export type EvidenceRule = {
  id: string; title: string; seriesId: string; metric: "value" | "momentum" | "percentile"
  direction: "higher" | "lower"; threshold: number; unit: string; rule: string; meaning: string
}
export type ResearchTheme = {
  id: ThemeId; title: string; subtitle: string; question: string; transmission: string[]
  rules: EvidenceRule[]; confirm: string[]; invalidate: string[]; nextRelease: string; sources: { name: string; url: string }[]
}
export const RESEARCH_THEMES: ResearchTheme[] = [
  {
    id: "debt", title: "化债与清欠", subtitle: "追踪资金到企业现金流", question: "债务置换是否真正降低成本，并改善企业回款？",
    transmission: ["地方债发行", "偿债与清欠用途", "企业实际回款", "融资成本与现金流", "盈利质量与估值"],
    rules: [
      { id: "refinance", title: "再融资发行活跃度", seriesId: "lg_refinance", metric: "percentile", direction: "higher", threshold: 50, unit: "分位", rule: "最新发行量在过去十年同月历史中的分位高于50；至少5个同月样本", meaning: "只提示再融资活动，需查发行用途才能确认隐债置换。" },
      { id: "debt-cost", title: "新发行债券成本", seriesId: "lg_rate", metric: "momentum", direction: "lower", threshold: 0, unit: "百分点", rule: "当月平均发行利率较连续3个月前下降", meaning: "期限与地区构成会影响均值，不能直接视为实际节息。" },
      { id: "fiscal-capacity", title: "财政收入增长", seriesId: "fiscal", metric: "value", direction: "higher", threshold: 0, unit: "%", rule: "全国财政收入累计同比大于0", meaning: "全国收入端的背景证据，尚不能代表某省或平台的偿付能力。" },
    ],
    confirm: ["在地方发行文件中确认置换/清欠用途及地区", "核对企业经营现金流、应收账龄、坏账计提与净债务", "银行同时核对资产质量、拨备和净息差，避免只看不良率"],
    invalidate: ["发行增加但清欠款未到账", "应收下降来自核销或保理，经营现金流未改善", "信用成本下降不足以抵消息差收窄"],
    nextRelease: "下一份地方资金使用披露、上市公司季报或年报；以公告日期为准。",
    sources: [{ name: "财政部债务管理司", url: "https://zwgls.mof.gov.cn/" }, { name: "巨潮资讯财报与公告", url: "https://www.cninfo.com.cn/" }],
  },
  {
    id: "consumption", title: "消费与内需", subtitle: "区分名义增长和真实需求", question: "消费改善能否转化为销量、利润和经营现金流？",
    transmission: ["收入与就业", "消费意愿", "零售与服务需求", "销量和毛利率", "盈利与价格"],
    rules: [
      { id: "retail-trend", title: "零售增长趋势", seriesId: "retail", metric: "momentum", direction: "higher", threshold: 0, unit: "百分点", rule: "零售同比较连续3个月前改善；缺月不比较", meaning: "名义商品零售仍受基数和价格影响，服务消费需另核对。" },
      { id: "nonpmi-level", title: "非制造业景气", seriesId: "nonpmi", metric: "value", direction: "higher", threshold: 50, unit: "指数", rule: "非制造业商务活动指数高于50", meaning: "包含建筑业，需用服务业分项确认消费传导。" },
      { id: "retail-level", title: "零售同比增长", seriesId: "retail", metric: "value", direction: "higher", threshold: 0, unit: "%", rule: "零售名义同比大于0", meaning: "与趋势条件来自同一序列，不是独立的第二份需求证据。" },
    ],
    confirm: ["用居民收入、就业、核心CPI与零售分项交叉核对", "拆分公司销量、单价、渠道库存与补贴影响", "消费ETF核对最新前十大持仓，防止行业集中暴露"],
    invalidate: ["收入与就业未改善，增长主要来自低基数", "企业销量上升但促销侵蚀毛利", "渠道压货增长快于终端销售"],
    nextRelease: "月度零售与就业、季度居民收入、公司经营数据与财报。",
    sources: [{ name: "国家统计局月度发布", url: "https://www.stats.gov.cn/sj/zxfb/" }, { name: "巨潮资讯公司披露", url: "https://www.cninfo.com.cn/" }],
  },
  {
    id: "industry", title: "工业与再通胀", subtitle: "从量价走到行业利润", question: "生产和价格改善来自需求复苏，还是供给冲击？",
    transmission: ["订单与需求", "产量与库存", "出厂价及投入成本", "利润与现金回收", "行业及公司估值"],
    rules: [
      { id: "pmi-level", title: "制造业景气", seriesId: "pmi", metric: "value", direction: "higher", threshold: 50, unit: "指数", rule: "制造业PMI高于50", meaning: "景气扩张的线索，仍需新订单与库存分项验证。" },
      { id: "industry-trend", title: "工业生产趋势", seriesId: "industrial", metric: "momentum", direction: "higher", threshold: 0, unit: "百分点", rule: "工业增加值同比较连续3个月前改善", meaning: "生产不等于销售，须同时检查库存。" },
      { id: "ppi-trend", title: "出厂价格变化", seriesId: "ppi", metric: "momentum", direction: "higher", threshold: 0, unit: "百分点", rule: "PPI同比较连续3个月前上升", meaning: "利好上游或挤压下游取决于行业成本结构，不能全行业同向推断。" },
    ],
    confirm: ["查统计局分行业利润、存货周转天数与应收回收期", "把产成品售价与原材料价格配对，研究价差", "工程机械等公司核对订单、出口和自由现金流"],
    invalidate: ["PPI上涨来自供给收缩，订单同步转弱", "库存和应收增长快于收入", "利润周期顶部的低PE被误当成低估"],
    nextRelease: "PMI及新订单分项、工业企业利润与存货、公司订单公告。",
    sources: [{ name: "国家统计局工业数据", url: "https://www.stats.gov.cn/sj/zxfb/" }, { name: "上市公司披露", url: "https://www.cninfo.com.cn/" }],
  },
  {
    id: "rates", title: "利率与久期", subtitle: "把利率判断转成价格敏感性", question: "利率环境是否支持持有久期，承担了多大价格风险？",
    transmission: ["通胀与增长", "货币与资金条件", "期限结构", "基金真实久期", "票息与净值变化"],
    rules: [
      { id: "inflation-trend", title: "通胀变化", seriesId: "cpi", metric: "momentum", direction: "lower", threshold: 0, unit: "百分点", rule: "CPI同比较连续3个月前下降", meaning: "仅是通胀背景，不包含资金利率、债券供给和政策预期。" },
      { id: "lpr-trend", title: "贷款报价变化", seriesId: "lpr", metric: "momentum", direction: "lower", threshold: 0, unit: "百分点", rule: "1年期LPR较连续3个月前下降", meaning: "LPR不是央行政策利率，也不是国债的直接定价锚。" },
      { id: "pmi-soft", title: "增长压力", seriesId: "pmi", metric: "value", direction: "lower", threshold: 50, unit: "指数", rule: "制造业PMI低于50", meaning: "弱需求可能形成债市支持，同时需要核对财政供给与资金面。" },
    ],
    confirm: ["在中国货币网核对DR007、公开市场操作与政策利率", "用基金最新报告确认久期、到期收益率及债券类型", "检查买卖价差、溢折价、成交量和持有成本"],
    invalidate: ["通胀或增长超预期回升", "财政发债供给集中、资金成本上升", "长期限ETF久期远高于预期承受范围"],
    nextRelease: "央行操作公告、月度价格数据、债券发行计划和基金定期报告。",
    sources: [{ name: "中国货币网", url: "https://www.chinamoney.com.cn/" }, { name: "中债收益率曲线", url: "https://yield.chinabond.com.cn/" }],
  },
  {
    id: "broad", title: "广谱复苏", subtitle: "验证信用到实体的接力", question: "景气、消费与融资是否出现共同改善？",
    transmission: ["政策支持", "融资结构", "企业与居民需求", "盈利扩散", "宽基估值"],
    rules: [
      { id: "broad-pmi", title: "制造业扩张", seriesId: "pmi", metric: "value", direction: "higher", threshold: 50, unit: "指数", rule: "制造业PMI高于50", meaning: "单月越线不足以确认持续复苏。" },
      { id: "broad-retail", title: "消费趋势", seriesId: "retail", metric: "momentum", direction: "higher", threshold: 0, unit: "百分点", rule: "零售同比较连续3个月前改善", meaning: "继续验证收入、就业和服务消费。" },
      { id: "broad-loans", title: "信贷季节性位置", seriesId: "loans", metric: "percentile", direction: "higher", threshold: 50, unit: "分位", rule: "新增人民币贷款在过去十年同月历史中的分位高于50；至少5个样本", meaning: "还需拆分企业中长期、居民和票据融资，不能替代社融结构。" },
    ],
    confirm: ["查央行社融结构，区分政府融资与私人信用需求", "观察行业盈利改善的广度和持续性", "宽基ETF核对成分权重、估值口径和跟踪误差"],
    invalidate: ["融资仅由政府债或票据推动", "消费和企业资本开支未接力", "市场估值先行上升，盈利兑现落后"],
    nextRelease: "央行金融与社融数据、统计局月度经济数据、上市公司财报季。",
    sources: [{ name: "中国人民银行", url: "https://www.pbc.gov.cn/" }, { name: "中证指数", url: "https://www.csindex.com.cn/" }],
  },
]
export type RuleEvidence = { rule: EvidenceRule; state: EvidenceState; value: number | null; period: string | null; sourceUrl: string; fetchedAt: string | null; reason: string }
export function assessRule(rule: EvidenceRule, data: Record<string, SeriesData>, now = new Date()): RuleEvidence {
  const series = data[rule.seriesId], definition = BY_ID[rule.seriesId]
  const ev = evaluate(definition, series, now)
  const value = ev[rule.metric]
  const valid = series?.status === "ok" && series.complete && !ev.stale && value !== null && Number.isFinite(value)
  const base = { rule, value: valid ? value : null, period: series?.lastDate ?? null, sourceUrl: series?.points.at(-1)?.sourceUrl ?? series?.sourceUrl ?? definition.sourceUrl, fetchedAt: series?.fetchedAt ?? null }
  if (!valid) return { ...base, state: "missing", reason: series?.warning ?? (ev.stale ? "统计期陈旧，等待新披露" : "等待可验证数据、连续月份或足够基准样本") }
  const difference = (value! - rule.threshold) * (rule.direction === "higher" ? 1 : -1)
  return { ...base, state: difference > 1e-9 ? "support" : difference < -1e-9 ? "against" : "neutral", reason: rule.meaning }
}
export function assessTheme(theme: ResearchTheme, data: Record<string, SeriesData>, now = new Date()) {
  const evidence = theme.rules.map(rule => assessRule(rule, data, now))
  const support = evidence.filter(e => e.state === "support").length
  const against = evidence.filter(e => e.state === "against").length
  const missing = evidence.filter(e => e.state === "missing").length
  const label = missing === evidence.length ? "等待数据" : missing ? "证据待补齐" : support && against ? "宏观线索分化" : support ? "存在支持线索" : against ? "存在反向线索" : "等待方向变化"
  return { evidence, support, against, missing, label }
}
export function equityScenario(price: number, baseEps: number, earningsGrowth: number, exitPe: number, cashDividend = 0) {
  if (![price, baseEps, earningsGrowth, exitPe, cashDividend].every(Number.isFinite) || price <= 0 || baseEps <= 0 || earningsGrowth <= -100 || exitPe <= 0 || cashDividend < 0) return null
  const terminalEps = baseEps * (1 + earningsGrowth / 100)
  const terminalPrice = terminalEps * exitPe
  return { terminalEps, terminalPrice, totalReturn: ((terminalPrice + cashDividend) / price - 1) * 100 }
}
export function bondScenario(duration: number, yieldChangeBp: number, annualCarry: number) {
  if (![duration, yieldChangeBp, annualCarry].every(Number.isFinite) || duration < 0 || duration > 50 || Math.abs(yieldChangeBp) > 1000 || Math.abs(annualCarry) > 30) return null
  const priceChange = -duration * yieldChangeBp / 100
  return { priceChange, approximateReturn: priceChange + annualCarry }
}
export type ResearchNote = { thesis: string; confirmation: string; invalidation: string; sourceUrl: string; reviewedAt: string; savedAt: string }
export type ResearchNotebook = { version: 1; watchlist: string[]; notes: Record<string, ResearchNote> }
export function readNotebook(raw: string | null, allowedIds: string[]): ResearchNotebook {
  const empty: ResearchNotebook = { version: 1, watchlist: [], notes: {} }
  try {
    const input = JSON.parse(raw ?? "null")
    if (!input || input.version !== 1 || !Array.isArray(input.watchlist) || !input.notes || typeof input.notes !== "object") return empty
    const watchlist = [...new Set(input.watchlist.filter((id: unknown): id is string => typeof id === "string" && allowedIds.includes(id)))] as string[]
    const notes: Record<string, ResearchNote> = {}
    for (const id of allowedIds) {
      const n = input.notes[id]
      if (n && ["thesis", "confirmation", "invalidation", "sourceUrl", "reviewedAt", "savedAt"].every(key => typeof n[key] === "string")) {
        const sourceUrl = /^https?:\/\//.test(n.sourceUrl) ? n.sourceUrl.slice(0, 2000) : ""
        notes[id] = { thesis: n.thesis.slice(0, 4000), confirmation: n.confirmation.slice(0, 4000), invalidation: n.invalidation.slice(0, 4000), sourceUrl, reviewedAt: n.reviewedAt.slice(0, 10), savedAt: n.savedAt.slice(0, 40) }
      }
    }
    return { version: 1, watchlist, notes }
  } catch { return empty }
}
