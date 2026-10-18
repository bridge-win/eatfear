import type { EvidenceConclusion, MarketRow, MarketSnapshot, Preset, ScreenFilters, ScreenItem, ScreenResult, SnapshotContext, Theme } from "./market-types.ts"

export const THEME_MAP: Record<Theme, { label: string; industries: string[] | null; reason: string }> = {
  all: { label: "全部经济专题", industries: null, reason: "按财务与估值条件观察全市场。" },
  debt: { label: "化债与清欠", industries: ["房屋建设Ⅱ", "基础建设", "专业工程", "装修装饰Ⅱ", "工程咨询服务Ⅱ", "银行Ⅱ", "工程机械", "水泥", "环保设备Ⅱ", "环境治理"], reason: "建筑、设备与银行可能受回款、项目和信用风险变化影响；行业关联不证明清欠款已到账。" },
  consumption: { label: "消费与内需", industries: ["白酒Ⅱ", "饮料乳品", "食品加工", "休闲食品", "调味发酵品Ⅱ", "一般零售", "专业连锁Ⅱ", "互联网电商", "家居用品", "白色家电", "小家电", "厨卫电器", "旅游及景区", "酒店餐饮", "旅游零售Ⅱ", "化妆品", "个护用品", "服装家纺", "乘用车"], reason: "这些行业关联居民商品与服务需求，仍须区分销量、价格、补贴和渠道库存。" },
  industry: { label: "工业与再通胀", industries: ["通用设备", "专用设备", "自动化设备", "电网设备", "工程机械", "电机Ⅱ", "仪器仪表", "工业金属", "化学原料", "基础建设", "汽车零部件", "轨交设备Ⅱ", "其他电源设备Ⅱ", "电池"], reason: "设备与工业链关联生产、投资和价格；订单、利润和现金回收需要同时验证。" },
  rates: { label: "利率与现金流", industries: ["银行Ⅱ", "电力", "燃气Ⅱ", "铁路公路", "航运港口"], reason: "融资成本和现金流折现与利率相关；股票不是固定久期债券，利率下降不保证盈利和股价上涨。" },
  broad: { label: "广谱复苏", industries: null, reason: "观察全行业盈利改善是否扩散；具体公司仍按相同经营和估值条件筛选。" },
}
export const PRESETS: { id: Preset; name: string; description: string }[] = [
  { id: "value", name: "盈利增长且估值较低", description: "非金融；收入、利润同比为正，经营现金流为正，年度ROE≥10%，正PE处于同行较低40%。" },
  { id: "improving", name: "经营改善", description: "非金融；收入同比为正，利润同比≥10%，经营现金流为正且高于上年同期。" },
  { id: "financial", name: "金融股PB与ROE", description: "金融行业；0<PB≤1，年度ROE≥10%，本期归母利润为正。" },
  { id: "custom", name: "自定义全市场", description: "自行组合条件；缺失值不当零，金融行业不使用工业企业现金流与负债率门槛。" },
]
export function presetFilters(preset: Preset = "value"): ScreenFilters {
  const common: ScreenFilters = { preset, theme: "all", exchange: "all", industry: "", search: "", peMin: null, peMax: null, pbMin: null, pbMax: null, pePercentileMax: null, roeMin: null, revenueGrowthMin: null, profitGrowthMin: null, debtRatioMax: null, cashFlow: "any", sector: "all", profit: "any", excludeSt: true, sort: "pePercentile", direction: "asc", page: 1, pageSize: 50 }
  if (preset === "value") return { ...common, sector: "nonfinancial", revenueGrowthMin: 0, profitGrowthMin: 0, roeMin: 10, cashFlow: "positive", profit: "positive", peMin: 0, pePercentileMax: 40 }
  if (preset === "improving") return { ...common, sector: "nonfinancial", revenueGrowthMin: 0, profitGrowthMin: 10, cashFlow: "improving", profit: "positive", sort: "profitGrowth", direction: "desc" }
  if (preset === "financial") return { ...common, sector: "financial", pbMin: 0, pbMax: 1, roeMin: 10, profit: "positive", sort: "pb" }
  return common
}
function choice<T extends string>(params: URLSearchParams, key: string, allowed: readonly T[], fallback: T): T {
  const v = params.get(key); if (v === null) return fallback
  if (!allowed.includes(v as T)) throw new Error(`无效参数：${key}`)
  return v as T
}
export function parseScreenFilters(params: URLSearchParams): ScreenFilters {
  const preset = choice(params, "preset", ["value", "improving", "financial", "custom"], "value"), f = presetFilters(preset)
  const known = new Set([...Object.keys(f), "snapshotId", "id", "export"])
  for (const key of params.keys()) if (!known.has(key) || params.getAll(key).length !== 1) throw new Error(`未知或重复参数：${key}`)
  f.theme = choice(params, "theme", Object.keys(THEME_MAP) as Theme[], f.theme)
  f.exchange = choice(params, "exchange", ["all", "SSE", "SZSE", "BSE"], f.exchange)
  f.cashFlow = choice(params, "cashFlow", ["any", "positive", "improving"], f.cashFlow)
  f.sector = choice(params, "sector", ["all", "financial", "nonfinancial"], f.sector)
  f.profit = choice(params, "profit", ["any", "positive", "loss", "turnaround"], f.profit)
  f.sort = choice(params, "sort", ["pePercentile", "profitGrowth", "pb", "peTtm", "annualRoe", "marketCap"], f.sort)
  f.direction = choice(params, "direction", ["asc", "desc"], f.direction)
  f.excludeSt = choice(params, "excludeSt", ["true", "false"], String(f.excludeSt) as "true" | "false") === "true"
  for (const key of ["peMin", "peMax", "pbMin", "pbMax", "pePercentileMax", "roeMin", "revenueGrowthMin", "profitGrowthMin", "debtRatioMax"] as const) if (params.has(key)) {
    const raw = params.get(key)!
    if (raw === "") { f[key] = null; continue }
    if (!/^-?\d+(?:\.\d+)?$/.test(raw) || !Number.isFinite(Number(raw)) || Math.abs(Number(raw)) > 1e6) throw new Error(`无效数字：${key}`)
    f[key] = Number(raw)
  }
  if (f.peMin !== null && f.peMin < 0 || f.pbMin !== null && f.pbMin < 0 || f.pePercentileMax !== null && (f.pePercentileMax < 0 || f.pePercentileMax > 100) || f.peMin !== null && f.peMax !== null && f.peMin > f.peMax || f.pbMin !== null && f.pbMax !== null && f.pbMin > f.pbMax) throw new Error("筛选范围无效")
  for (const key of ["page", "pageSize"] as const) if (params.has(key)) { const raw = params.get(key)!; if (!/^\d+$/.test(raw)) throw new Error(`无效分页：${key}`); f[key] = Number(raw) }
  if (f.page < 1 || f.page > 10000 || f.pageSize < 1 || f.pageSize > 100) throw new Error("分页超出范围")
  f.search = (params.get("search") ?? "").trim(); f.industry = params.get("industry") ?? ""
  if (f.search.length > 100 || f.industry && !/^[A-Za-z0-9_-]{1,30}$/.test(f.industry)) throw new Error("搜索条件无效")
  return f
}
export function screenFailures(r: MarketRow, f: ScreenFilters): string[] {
  const failures: string[] = []
  if (!r.identityVerified || r.listingStatus === "delisted" || r.price === null || r.reportDate === null || r.netIncome === null || r.revenue === null) failures.push("身份、估值或统一财报不足")
  if (f.excludeSt && r.st) failures.push("ST或退市风险")
  if (f.exchange !== "all" && r.exchange !== f.exchange) failures.push("交易所")
  if (f.industry && r.industryCode !== f.industry) failures.push("行业")
  if (f.search && !`${r.name} ${r.code} ${r.secucode}`.toLowerCase().includes(f.search.toLowerCase())) failures.push("代码名称")
  const theme = THEME_MAP[f.theme]; if (theme.industries && !theme.industries.includes(r.industry ?? "")) failures.push("专题行业关联")
  if (f.sector !== "all" && r.financial !== (f.sector === "financial")) failures.push("金融/非金融范围")
  const min = (field: number | null, value: number | null, label: string, strict = false) => { if (value !== null && (field === null || (strict ? field <= value : field < value))) failures.push(label) }
  const max = (field: number | null, value: number | null, label: string) => { if (value !== null && (field === null || field > value)) failures.push(label) }
  // A positive PE filter must never treat a loss-making company as cheap.
  const pe = r.peTtm !== null && r.peTtm > 0 ? r.peTtm : null
  min(pe, f.peMin, "PE下限/盈利适用性", f.peMin === 0); max(pe, f.peMax, "PE上限")
  const pb = r.pb !== null && r.pb > 0 ? r.pb : null
  min(pb, f.pbMin, "PB下限", f.pbMin === 0); max(pb, f.pbMax, "PB上限")
  max(r.pePercentile, f.pePercentileMax, "同行PE分位/样本不足")
  min(r.annualRoe, f.roeMin, "完整年度ROE")
  min(r.revenueGrowth, f.revenueGrowthMin, "收入同比", f.revenueGrowthMin === 0)
  min(r.profitGrowth, f.profitGrowthMin, "利润同比/负基数", f.profitGrowthMin === 0)
  if (f.profit === "positive" && !(r.netIncome !== null && r.netIncome > 0)) failures.push("本期盈利")
  if (f.profit === "loss" && !(r.netIncome !== null && r.netIncome <= 0)) failures.push("本期亏损")
  if (f.profit === "turnaround" && r.profitState !== "turnaround") failures.push("扭亏状态")
  if (f.cashFlow !== "any" && (r.financial || r.operatingCashFlow === null || r.operatingCashFlow <= 0 || f.cashFlow === "improving" && (r.previousOperatingCashFlow === null || r.operatingCashFlow <= r.previousOperatingCashFlow))) failures.push("经营现金流/金融行业不适用")
  if (f.debtRatioMax !== null && (r.financial || r.debtRatio === null || r.debtRatio > f.debtRatioMax)) failures.push("资产负债率/金融行业不适用")
  return failures
}
const fmt = (n: number | null, d = 2) => n === null ? "缺失" : n.toLocaleString("zh-CN", { maximumFractionDigits: d })
const amount = (n: number | null) => n === null ? "缺失" : `${fmt(n / 1e8)}亿元`
const profitLabels = { profit: "盈利", loss: "亏损", turnaround: "扭亏为盈", "loss-narrowing": "亏损收窄", "loss-widening": "亏损持平或扩大", unknown: "利润数据缺失" }
export function companyConclusions(r: MarketRow, f: ScreenFilters): EvidenceConclusion[] {
  const financialUrl = `https://data.eastmoney.com/bbsj/${r.reportDate?.slice(0, 7).replace("-", "") ?? ""}/yjbb.html`, valuationUrl = `https://data.eastmoney.com/gzfx/detail/${r.code}.html`
  const result: EvidenceConclusion[] = []
  result.push({ kind: "business", text: `收入${amount(r.revenue)}，同比${r.revenueGrowth === null ? "缺失或基数不适用" : fmt(r.revenueGrowth) + "%"}；归母利润${amount(r.netIncome)}，${r.profitGrowth === null ? profitLabels[r.profitState] : "同比" + fmt(r.profitGrowth) + "%"}。经营现金流${amount(r.operatingCashFlow)}${r.financial ? "（金融企业不按工业现金流门槛评价）" : ""}。`, fields: ["revenue", "previousRevenue", "revenueGrowth", "netIncome", "previousNetIncome", "profitGrowth", "operatingCashFlow"], period: r.reportDate, sourceUrl: financialUrl })
  result.push({ kind: "valuation", text: `日终PE(TTM)${r.peTtm !== null && r.peTtm > 0 ? fmt(r.peTtm) + "倍" : "亏损或不适用"}，PB(MRQ)${fmt(r.pb)}倍；${r.pePercentile !== null ? `同业PE分位${fmt(r.pePercentile)}%，有效同业${r.pePeers}家（数值越低，相对估值越低）` : `同行正PE有效样本${r.pePeers}家，未满足分位计算条件`}。这是当日横截面比较，不是历史估值分位。`, fields: ["price", "peTtm", "pb", "pePercentile", "pePeers"], period: r.quoteDate, sourceUrl: valuationUrl })
  const failures = screenFailures(r, f)
  const matched: string[] = []
  if (f.sector !== "all") matched.push(f.sector === "financial" ? "金融行业" : "非金融行业")
  if (f.revenueGrowthMin !== null) matched.push(`收入同比${fmt(r.revenueGrowth)}%${f.revenueGrowthMin === 0 ? ">" : "≥"}${f.revenueGrowthMin}%`)
  if (f.profitGrowthMin !== null) matched.push(`利润同比${fmt(r.profitGrowth)}%${f.profitGrowthMin === 0 ? ">" : "≥"}${f.profitGrowthMin}%`)
  if (f.roeMin !== null) matched.push(`年度ROE${fmt(r.annualRoe)}%≥${f.roeMin}%（${r.annualReportDate}）`)
  if (f.cashFlow !== "any") matched.push(`经营现金流${amount(r.operatingCashFlow)}>0${f.cashFlow === "improving" ? `且高于上年同期${amount(r.previousOperatingCashFlow)}` : ""}`)
  if (f.pePercentileMax !== null) matched.push(`同行PE分位${fmt(r.pePercentile)}%≤${f.pePercentileMax}%`)
  if (f.peMin !== null) matched.push(`PE${fmt(r.peTtm)}倍${f.peMin === 0 ? ">" : "≥"}${f.peMin}倍`)
  if (f.peMax !== null) matched.push(`PE${fmt(r.peTtm)}倍≤${f.peMax}倍`)
  if (f.pbMin !== null) matched.push(`PB${fmt(r.pb)}倍${f.pbMin === 0 ? ">" : "≥"}${f.pbMin}倍`)
  if (f.pbMax !== null) matched.push(`PB${fmt(r.pb)}倍≤${f.pbMax}倍`)
  if (f.debtRatioMax !== null) matched.push(`资产负债率${fmt(r.debtRatio)}%≤${f.debtRatioMax}%`)
  if (f.profit !== "any") matched.push(`盈利状态：${profitLabels[r.profitState]}`)
  result.push({ kind: "match", text: failures.length ? `当前条件未满足：${failures.join("、")}。` : `满足当前条件：${matched.length ? matched.join("；") : "官方身份已核验、有同日日终估值及统一财报"}。这表示条件匹配，不代表预计收益。`, fields: ["annualRoe", "revenueGrowth", "profitGrowth", "operatingCashFlow", "pePercentile", "pb"], period: r.reportDate, sourceUrl: financialUrl, references: [{ label: "完整年度ROE", period: r.annualReportDate, url: `https://data.eastmoney.com/bbsj/${r.annualReportDate.slice(0, 7).replace("-", "")}/yjbb.html` }, { label: "日终估值", period: r.quoteDate ?? "", url: valuationUrl }] })
  const risks: string[] = []
  if (!r.financial && r.operatingCashFlow !== null && r.operatingCashFlow <= 0) risks.push("经营现金流不为正，利润尚未转成净现金流入")
  if (!r.financial && r.operatingCashFlow !== null && r.previousOperatingCashFlow !== null && r.operatingCashFlow < r.previousOperatingCashFlow) risks.push("现金流低于上年同期")
  if (r.revenueGrowth !== null && r.revenueGrowth < 0) risks.push("收入同比下降")
  if (r.profitGrowth !== null && r.profitGrowth < 0) risks.push("利润同比下降")
  if (r.profitGrowth !== null && r.profitGrowth > 300) risks.push("利润同比超过300%，需核对低基数与一次性损益，增速不代表可持续盈利")
  if (r.peTtm !== null && r.peTtm > 100) risks.push("PE超过100倍观察阈值，对盈利不及预期较敏感")
  if (r.pePercentile !== null && r.pePercentile > 70) risks.push("PE位于同行较高区间")
  if (!r.financial && r.debtRatio !== null && r.debtRatio > 70) risks.push("资产负债率超过70%观察阈值")
  if (r.financial) risks.push("尚未自动覆盖息差、不良、拨备与资本充足率等金融专属风险")
  if (!r.listingVerified) risks.push("当前有效上市状态未获交易所完整名录核验")
  result.push({ kind: "risk", text: risks.length ? risks.join("；") + "。" : "已接入数字未触发上述观察阈值；仍需核对订单、业务分部、审计意见、减值和一次性损益，不能据此认定没有风险。", fields: ["operatingCashFlow", "previousOperatingCashFlow", "revenueGrowth", "profitGrowth", "debtRatio", "pePercentile"], period: r.reportDate, sourceUrl: r.officialUrl })
  const missing = [r.annualRoe === null ? "年度ROE" : "", r.operatingCashFlow === null ? "本期现金流" : "", r.previousOperatingCashFlow === null ? "上年同期现金流" : "", r.totalAssets === null ? "资产负债" : "", r.pePercentile === null ? "有效同行估值分位" : "", !r.publishedAt ? "财报公告日期" : ""].filter(Boolean)
  result.push({ kind: "missing", text: missing.length ? `当前缺项：${missing.join("、")}。依赖缺项的条件不视为满足。` : "本页筛选所需基础字段齐备；未接入主营业务收入暴露、订单、盈利预测及原始报告附注的自动核验。", fields: [], period: r.reportDate, sourceUrl: r.officialUrl })
  return result
}
export function selectRows(snapshot: MarketSnapshot, f: ScreenFilters) {
  const counts = new Map<string, number>(), rows: MarketRow[] = []
  for (const r of snapshot.rows) {
    const failures = screenFailures(r, f)
    if (!failures.length) rows.push(r)
    else for (const reason of failures) counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  const sortValue = (r: MarketRow) => { const value = r[f.sort]; return (f.sort === "peTtm" || f.sort === "pb") && value !== null && value <= 0 ? null : value }
  rows.sort((a, b) => { const av = sortValue(a), bv = sortValue(b); if (av === null && bv !== null) return 1; if (bv === null && av !== null) return -1; return (av !== null && bv !== null ? (av - bv) * (f.direction === "asc" ? 1 : -1) : 0) || a.code.localeCompare(b.code) || a.exchange.localeCompare(b.exchange) })
  return { rows, excluded: [...counts].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)) }
}
export function screenMarket(context: SnapshotContext, filters: ScreenFilters): ScreenResult {
  const s = context.snapshot, selected = selectRows(s, filters)
  const items: ScreenItem[] = selected.rows.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize).map(row => ({ row, conclusions: companyConclusions(row, filters), themeReason: filters.theme === "all" ? null : THEME_MAP[filters.theme].reason }))
  const industries = [...new Map(s.rows.filter(r => r.industryCode && r.industry).map(r => [r.industryCode!, { code: r.industryCode!, name: r.industry! }])).values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
  return { snapshotId: s.snapshotId, tradeDate: s.tradeDate, reportDate: s.reportDate, annualReportDate: s.annualReportDate, fetchedAt: s.fetchedAt, mode: context.mode, health: context.health, warning: context.warning, coverage: s.coverage, sources: s.sources, filters, total: selected.rows.length, page: filters.page, pageSize: filters.pageSize, pages: Math.ceil(selected.rows.length / filters.pageSize), items, excluded: selected.excluded, industries }
}
