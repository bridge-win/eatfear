import { BY_ID } from "./catalog.ts"
import { evaluate, difference } from "./metrics.ts"
import { assessTheme, RESEARCH_THEMES } from "./opportunities.ts"
import { PRESETS, presetFilters, selectRows } from "./screener.ts"
import type { SnapshotContext } from "./market-types.ts"

export type EconomicFinding = { id: string; title: string; conclusion: string; counterEvidence: string; evidence: { id: string; name: string; value: number; unit: string; period: string; sourceUrl: string }[] }
const fmt = (n: number) => n.toLocaleString("zh-CN", { maximumFractionDigits: 2 })
export function marketAnalysis(context: SnapshotContext) {
  const s = context.snapshot, data = s.macro
  const point = (id: string) => {
    const d = data[id], ev = evaluate(BY_ID[id], d)
    return d?.lastDate && ev.value !== null && !ev.stale && (d.latestVerified ?? d.status === "ok") ? { id, name: BY_ID[id].name, value: ev.value, unit: BY_ID[id].unit, period: d.lastDate, sourceUrl: d.sourceUrl } : null
  }
  const findings: EconomicFinding[] = []
  const pmi = point("pmi"), retail = point("retail"), industrial = point("industrial"), ppi = point("ppi"), m2 = point("m2"), loans = point("loans"), long = point("cn10y"), short = point("cn2y"), issuance = point("lg_issuance"), rate = point("lg_rate")
  if (pmi || retail) findings.push({ id: "demand", title: "需求与景气", conclusion: `${pmi ? `制造业PMI为${fmt(pmi.value)}，${pmi.value > 50 ? "略高于" : pmi.value < 50 ? "低于" : "处于"}50荣枯线` : "制造业PMI待更新"}；${retail ? `商品零售同比${fmt(retail.value)}%，${retail.value > 3 ? "名义商品需求增长" : retail.value > 0 ? "仍增长但幅度较小" : "需求承压"}` : "零售证据缺失"}。`, counterEvidence: "PMI与零售统计期可能不同，商品零售不含全部服务消费；经济景气不能替代公司盈利。", evidence: [pmi, retail].filter(p => p !== null) })
  if (industrial || ppi) findings.push({ id: "production", title: "生产与价格", conclusion: `${industrial ? `工业增加值同比${fmt(industrial.value)}%` : "工业生产待更新"}；${ppi ? `PPI同比${fmt(ppi.value)}%，${ppi.value < 0 ? "工业品价格仍低于上年同期，生产增长未必转化为同等利润增长" : "出厂价格同比上升，需区分需求与成本推动"}` : "工业价格证据缺失"}。`, counterEvidence: "价格和产量方向可以不同；接下来检查相关公司的收入、利润和现金流是否同步。", evidence: [industrial, ppi].filter(p => p !== null) })
  if (m2 || loans) findings.push({ id: "credit", title: "货币与信用", conclusion: `${m2 ? `M2同比${fmt(m2.value)}%` : "M2待更新"}；${loans ? `当期新增人民币贷款${fmt(loans.value)}亿元` : "贷款数据待更新"}。${loans && evaluate(BY_ID.loans, data.loans).percentile !== null ? `贷款在历史同月处于P${fmt(evaluate(BY_ID.loans, data.loans).percentile!)}。` : "信贷有明显季节性，不用简单环比判断强弱。"}`, counterEvidence: "货币或贷款增加不等于流入股市，也不能代替居民与企业融资结构。", evidence: [m2, loans].filter(p => p !== null) })
  if (long) {
    const spread = short ? difference(data.cn10y.points, data.cn2y.points, 100).at(-1) : null
    findings.push({ id: "rates", title: "市场利率", conclusion: `10年国债收益率${fmt(long.value)}%${short && spread ? `；同日10年减2年利差${fmt(spread.value)}bp（${spread.date}）` : ""}。这是利率与资产折现的观察基准。`, counterEvidence: "收益率低不等于股票便宜；长债在收益率上行时仍可能出现价格损失。", evidence: [long, short].filter(p => p !== null) })
  }
  if (issuance || rate) findings.push({ id: "fiscal", title: "地方债与融资成本", conclusion: `${issuance ? `地方债当月发行${fmt(issuance.value)}亿元` : "发行数据待更新"}${rate ? `，当月平均发行利率${fmt(rate.value)}%` : ""}。发行与企业回款是不同环节。`, counterEvidence: "发行金额不是净融资、清欠到账或公司新增订单；历史缺口单独披露，不抹去已核验的新观测。", evidence: [issuance, rate].filter(p => p !== null) })
  const presets = PRESETS.filter(p => p.id !== "custom").map(p => { const f = presetFilters(p.id), selected = selectRows(s, f); return { ...p, count: selected.rows.length, examples: selected.rows.slice(0, 3).map(r => ({ id: r.id, name: r.name, code: r.code })) } })
  const macroCoverage = Object.values(data).filter(d => d.points.length).length
  return { snapshotId: s.snapshotId, tradeDate: s.tradeDate, reportDate: s.reportDate, annualReportDate: s.annualReportDate, fetchedAt: s.fetchedAt, coverage: s.coverage, macroCoverage, mode: context.mode, warning: context.warning, health: context.health, sources: s.sources, warnings: s.warnings, findings, presets, themes: RESEARCH_THEMES.map(t => ({ id: t.id, title: t.title, ...assessTheme(t, data) })) }
}
export type MarketAnalysis = ReturnType<typeof marketAnalysis>
