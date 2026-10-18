import { dateOnly, finite, reportingPeriods, yoy, profitState, isFinancialIndustry, addPeerValuations, coverageOf, isDepositaryReceiptCode } from "./market-model.ts"
import type { Exchange, MarketRow, MarketSnapshot, SourceHealth } from "./market-types.ts"

type Row = Record<string, unknown>
type Fetcher = typeof fetch
const ENDPOINT = "https://datacenter-web.eastmoney.com/api/data/v1/get"
export const A_SHARE_FILTER = '(SECURITY_TYPE_CODE="058001001")(TRADE_MARKET_CODE in ("069001001001","069001001003","069001001006","069001002001","069001002002","069001002003","069001002005","069001017"))'
const MAX_BODY = 12_000_000
const text = (v: unknown) => typeof v === "string" ? v.trim() : ""
const plain = (v: unknown) => text(v).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim()
export async function boundedFetch(url: string, fetcher: Fetcher = fetch, referer = "https://data.eastmoney.com/"): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(20000), redirect: "error", cache: "no-store", headers: { Referer: referer, "User-Agent": "Mozilla/5.0" } })
      if (!response.ok) throw new Error(`上游 HTTP ${response.status}`)
      if (Number(response.headers.get("content-length") ?? 0) > MAX_BODY || !response.body) throw new Error("上游体积无效")
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0
      try { for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > MAX_BODY) throw new Error("上游体积超限"); chunks.push(part.value) } }
      finally { await reader.cancel().catch(() => undefined); reader.releaseLock() }
      const all = new Uint8Array(bytes); let offset = 0; for (const c of chunks) { all.set(c, offset); offset += c.length }
      return new TextDecoder().decode(all)
    } catch (e) { if (attempt >= 2) throw e; await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))) }
  }
}
export async function pool<T, R>(items: T[], task: (item: T) => Promise<R>, concurrency = 3): Promise<R[]> {
  const results = new Array<R>(items.length); let next = 0, failed = false
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => { for (;;) { const i = next++; if (i >= items.length || failed) break; try { results[i] = await task(items[i]) } catch (error) { failed = true; throw error } } }))
  return results
}
export function eastmoneyUrl(reportName: string, filter: string, page = 1, pageSize = 500, columns = "ALL", sortColumns = "SECURITY_CODE") {
  const url = new URL(ENDPOINT)
  Object.entries({ reportName, columns, filter, pageNumber: String(page), pageSize: String(pageSize), sortColumns, sortTypes: "1", source: "WEB", client: "WEB" }).forEach(([k, v]) => url.searchParams.set(k, v))
  return url.href
}
export function parsePage(input: unknown) {
  const j = input as { success?: boolean; result?: { data?: Row[]; count?: number; pages?: number } }
  const r = j?.result
  if (j.success !== true || !r || !Array.isArray(r.data) || !Number.isInteger(r.count) || !Number.isInteger(r.pages) || r.count! < 1 || r.count! > 20000 || r.pages! < 1 || r.pages! > 300) throw new Error("分页元数据无效")
  return { data: r.data, count: r.count!, pages: r.pages! }
}
export async function table(report: string, filter: string, fetcher: Fetcher = fetch) {
  const first = parsePage(JSON.parse(await boundedFetch(eastmoneyUrl(report, filter), fetcher)))
  const rest = await pool(Array.from({ length: first.pages - 1 }, (_, i) => i + 2), async p => {
    const page = parsePage(JSON.parse(await boundedFetch(eastmoneyUrl(report, filter, p), fetcher)))
    if (page.count !== first.count || page.pages !== first.pages) throw new Error(`${report}采集中总数发生变化`)
    return page.data
  })
  const rows = [...first.data, ...rest.flat()]
  if (rows.length !== first.count || new Set(rows.map(r => r.SECUCODE)).size !== rows.length || rows.some(r => !/^\d{6}\.(SH|SZ|BJ)$/.test(text(r.SECUCODE)))) throw new Error(`${report}分页缺失、重复或证券身份异常`)
  return rows
}
type Identity = { code: string; name: string; exchange: Exchange; listed: boolean; verified: boolean; orgId: string | null; url: string }
async function officialIdentities(fetcher: Fetcher, today: string) {
  const identities = new Map<string, Identity>(); const sources: SourceHealth[] = []
  const cnUrl = "https://www.cninfo.com.cn/new/data/szse_stock.json"
  const cn = JSON.parse(await boundedFetch(cnUrl, fetcher, "https://www.cninfo.com.cn/"))
  if (!Array.isArray(cn.stockList) || cn.stockList.length < 4000) throw new Error("巨潮证券目录无效")
  for (const r of cn.stockList) {
    const code = text(r.code); if (!/^\d{6}$/.test(code) || isDepositaryReceiptCode(code) || r.category !== "A股") continue
    const exchange: Exchange | null = /^6/.test(code) ? "SSE" : /^[03]/.test(code) ? "SZSE" : /^(4|8|92)/.test(code) ? "BSE" : null
    if (!exchange) continue
    const prefix = exchange === "SSE" ? "sh" : exchange === "SZSE" ? "sz" : "bj"
    identities.set(prefix + code, { code, name: plain(r.zwjc), exchange, listed: false, verified: true, orgId: text(r.orgId) || null, url: `https://www.cninfo.com.cn/new/disclosure/stock?stockCode=${code}&orgId=${encodeURIComponent(text(r.orgId))}` })
  }
  sources.push({ id: "cninfo", name: "巨潮公开披露身份目录", url: cnUrl, status: "ok", count: identities.size, note: "核验证券与披露机构身份，含退市历史记录；不单独证明当前上市状态。" })
  const outcomes = await Promise.allSettled([
    (async () => {
      let count = 0
      for (const type of ["1", "8"]) {
        const page = async (n: number) => {
          const u = new URL("https://query.sse.com.cn/sseQuery/commonQuery.do")
          Object.entries({ sqlId: "COMMON_SSE_CP_GPJCTPZ_GPLB_GP_L", type: "inParams", COMPANY_STATUS: "2,4,5,7,8", STOCK_TYPE: type, isPagination: "true", "pageHelp.pageSize": "500", "pageHelp.pageNo": String(n), "pageHelp.beginPage": String(n), "pageHelp.cacheSize": "1" }).forEach(([k, v]) => u.searchParams.set(k, v))
          const j = JSON.parse(await boundedFetch(u.href, fetcher, "https://www.sse.com.cn/assortment/stock/list/share/"))
          if (!Array.isArray(j.result) || !Number.isInteger(j.pageHelp?.total) || !Number.isInteger(j.pageHelp?.pageCount) || j.pageHelp.pageCount > 200) throw new Error("上交所名录分页无效")
          return { data: j.result as Row[], total: j.pageHelp.total as number, pages: j.pageHelp.pageCount as number }
        }
        const first = await page(1), more = await pool(Array.from({ length: first.pages - 1 }, (_, i) => i + 2), page)
        if (more.some(p => p.total !== first.total)) throw new Error("上交所名录总数变化")
        const all = [...first.data, ...more.flatMap(p => p.data)]
        if (all.length !== first.total || new Set(all.map(r => r.A_STOCK_CODE)).size !== all.length) throw new Error("上交所名录不完整")
        for (const r of all) {
          const code = text(r.A_STOCK_CODE), name = plain(r.SEC_NAME_CN), listedAt = text(r.LIST_DATE)
          if (!/^\d{6}$/.test(code) || isDepositaryReceiptCode(code) || listedAt && listedAt.replaceAll("-", "") > today.replaceAll("-", "")) continue
          const old = identities.get("sh" + code)
          identities.set("sh" + code, { code, name, exchange: "SSE", listed: !dateOnly(r.DELIST_DATE), verified: true, orgId: old?.orgId ?? null, url: old?.url ?? `https://www.sse.com.cn/assortment/stock/list/info/company/index.shtml?COMPANY_CODE=${code}` }); count++
        }
      }
      return { id: "sse", name: "上交所A股名录", url: "https://www.sse.com.cn/assortment/stock/list/share/", status: "ok" as const, count, note: "主板与科创板名录完整分页；不含B股/CDR。" }
    })(),
    (async () => {
      const page = async (n: number) => {
        const j = JSON.parse(await boundedFetch(`https://www.szse.cn/api/report/ShowReport/data?SHOWTYPE=JSON&CATALOGID=1110&TABKEY=tab1&PAGENO=${n}`, fetcher, "https://www.szse.cn/market/product/stock/list/index.html"))
        const t = j[0]
        if (!Array.isArray(t?.data) || !Number.isInteger(t.metadata?.recordcount) || !Number.isInteger(t.metadata?.pagecount) || t.metadata.pagecount > 300) throw new Error("深交所名录分页无效")
        return { data: t.data as Row[], total: t.metadata.recordcount as number, pages: t.metadata.pagecount as number }
      }
      const first = await page(1), more = await pool(Array.from({ length: first.pages - 1 }, (_, i) => i + 2), page)
      const all = [...first.data, ...more.flatMap(p => p.data)]
      if (all.length !== first.total || more.some(p => p.total !== first.total) || new Set(all.map(r => r.agdm)).size !== all.length) throw new Error("深交所名录不完整")
      for (const r of all) { const code = text(r.agdm); if (!/^\d{6}$/.test(code) || dateOnly(r.agssrq)! > today) continue; const old = identities.get("sz" + code); identities.set("sz" + code, { code, name: plain(r.agjc), exchange: "SZSE", listed: true, verified: true, orgId: old?.orgId ?? null, url: old?.url ?? `https://www.szse.cn/certificate/individual/index.html?code=${code}` }) }
      return { id: "szse", name: "深交所A股名录", url: "https://www.szse.cn/market/product/stock/list/index.html", status: "ok" as const, count: all.length, note: "使用实际分页大小校验全部主板和创业板记录。" }
    })(),
  ])
  outcomes.forEach((o, i) => sources.push(o.status === "fulfilled" ? o.value : { id: i ? "szse" : "sse", name: i ? "深交所A股名录" : "上交所A股名录", url: i ? "https://www.szse.cn/market/product/stock/list/index.html" : "https://www.sse.com.cn/assortment/stock/list/share/", status: "unavailable", count: 0, note: o.reason instanceof Error ? o.reason.message : "官方名录请求失败" }))
  sources.push({ id: "bse", name: "北交所有效上市名录", url: "https://www.bse.cn/", status: "unavailable", count: 0, note: "尚未取得可验证的完整名录；北交所身份通过巨潮核对，候选范围来自当日日终数据，不宣称完整官方上市核验。" })
  return { identities, sources }
}
export function selectStatementRows(rows: Row[], date: string, today: string, statement = false) {
  const map = new Map<string, Row>()
  for (const r of rows) {
    if (dateOnly(statement ? r.REPORT_DATE : r.REPORTDATE) !== date || statement && r.REPORT_TYPE_CODE !== "001") throw new Error("财务报告期或报表类型错配")
    if (statement && r.DATE_TYPE_CODE !== ({ "03-31": "003", "06-30": "002", "09-30": "004", "12-31": "001" } as Record<string, string>)[date.slice(5)]) throw new Error("财务累计期间类型错配")
    const pub = dateOnly(r.NOTICE_DATE)
    if (!pub || pub > today) continue
    if (pub < date) throw new Error("财报公告时间早于报告期")
    const id = text(r.SECUCODE), old = map.get(id)
    if (!old || String(r.NOTICE_DATE) > String(old.NOTICE_DATE)) map.set(id, r)
  }
  return map
}
export async function collectMarket(fetcher: Fetcher = fetch, now = new Date()): Promise<Omit<MarketSnapshot, "snapshotId" | "macro">> {
  const today = new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10), periods = reportingPeriods(now)
  const html = await boundedFetch("https://data.eastmoney.com/gzfx/list.html", fetcher)
  const tradeDate = dateOnly(/(?:var\s+)?gzDate\s*=\s*["'](\d{4}-\d{2}-\d{2})/.exec(html)?.[1])
  if (!tradeDate || tradeDate > today) throw new Error("无法发现可信的最新日终估值日期")
  const reports = [
    ["valuation", "RPT_VALUEANALYSIS_DET", `(TRADE_DATE='${tradeDate}')`],
    ["current", "RPT_LICO_FN_CPD", `(REPORTDATE='${periods.reportDate}')${A_SHARE_FILTER}`],
    ["previous", "RPT_LICO_FN_CPD", `(REPORTDATE='${periods.comparisonDate}')${A_SHARE_FILTER}`],
    ["annual", "RPT_LICO_FN_CPD", `(REPORTDATE='${periods.annualReportDate}')${A_SHARE_FILTER}`],
    ["cashflow", "RPT_DMSK_FN_CASHFLOW", `(REPORT_DATE='${periods.reportDate}')(REPORT_TYPE_CODE="001")${A_SHARE_FILTER}`],
    ["previousCashflow", "RPT_DMSK_FN_CASHFLOW", `(REPORT_DATE='${periods.comparisonDate}')(REPORT_TYPE_CODE="001")${A_SHARE_FILTER}`],
    ["balance", "RPT_DMSK_FN_BALANCE", `(REPORT_DATE='${periods.reportDate}')(REPORT_TYPE_CODE="001")${A_SHARE_FILTER}`],
  ]
  const [official, loaded] = await Promise.all([officialIdentities(fetcher, today), pool(reports, async ([key, report, filter]) => ({ key, data: await table(report, filter, fetcher) }), 2)])
  const tables = Object.fromEntries(loaded.map(l => [l.key, l.data])) as Record<string, Row[]>
  const current = selectStatementRows(tables.current, periods.reportDate, today), previous = selectStatementRows(tables.previous, periods.comparisonDate, today), annual = selectStatementRows(tables.annual, periods.annualReportDate, today)
  const cashflow = selectStatementRows(tables.cashflow, periods.reportDate, today, true), previousCashflow = selectStatementRows(tables.previousCashflow, periods.comparisonDate, today, true), balance = selectStatementRows(tables.balance, periods.reportDate, today, true)
  const valuations = new Map(tables.valuation.filter(r => { const code = text(r.SECUCODE); return /^\d{6}\.(SH|SZ|BJ)$/.test(code) && dateOnly(r.TRADE_DATE) === tradeDate && (current.has(code) || official.identities.has((code.endsWith("SH") ? "sh" : code.endsWith("SZ") ? "sz" : "bj") + code.slice(0, 6))) }).map(r => [text(r.SECUCODE), r]))
  const universe = new Map<string, Identity>()
  for (const [id, identity] of official.identities) if (identity.listed) universe.set(id, identity)
  for (const [secucode, v] of valuations) {
    const exchange: Exchange = secucode.endsWith("SH") ? "SSE" : secucode.endsWith("SZ") ? "SZSE" : "BSE", code = secucode.slice(0, 6), id = (exchange === "SSE" ? "sh" : exchange === "SZSE" ? "sz" : "bj") + code
    universe.set(id, official.identities.get(id) ?? { code, name: plain(v.SECURITY_NAME_ABBR), exchange, listed: false, verified: false, orgId: null, url: `https://www.cninfo.com.cn/new/disclosure/stock?stockCode=${code}` })
  }
  const rows: MarketRow[] = []
  for (const [id, identity] of universe) {
    const secucode = identity.code + (identity.exchange === "SSE" ? ".SH" : identity.exchange === "SZSE" ? ".SZ" : ".BJ")
    const v = valuations.get(secucode), c = current.get(secucode), p = previous.get(secucode), a = annual.get(secucode), cf = cashflow.get(secucode), pcf = previousCashflow.get(secucode), b = balance.get(secucode)
    const revenue = finite(c?.TOTAL_OPERATE_INCOME), previousRevenue = finite(p?.TOTAL_OPERATE_INCOME), netIncome = finite(c?.PARENT_NETPROFIT), previousNetIncome = finite(p?.PARENT_NETPROFIT)
    const assets = finite(b?.TOTAL_ASSETS), liabilities = finite(b?.TOTAL_LIABILITIES), ratio = assets !== null && assets > 0 && liabilities !== null ? liabilities / assets * 100 : null
    const industry = text(v?.BOARD_NAME) || null, flags: string[] = []
    if (ratio !== null && finite(b?.DEBT_ASSET_RATIO) !== null && Math.abs(ratio - finite(b?.DEBT_ASSET_RATIO)!) > 0.05) throw new Error("负债率交叉校验失败")
    if (!identity.listed) flags.push("有效上市状态未获交易所名录完整核验")
    if (!identity.verified) flags.push("官方披露身份待核验")
    if (!cf) flags.push("本期现金流缺失")
    if (!pcf) flags.push("上年同期现金流缺失")
    if (!a) flags.push("完整年度ROE缺失")
    if (!b) flags.push("本期资产负债缺失")
    const publications = [c, cf, b].map(r => dateOnly(r?.NOTICE_DATE)).filter((d): d is string => !!d)
    rows.push({ id, code: identity.code, secucode, exchange: identity.exchange, name: identity.name, industryCode: text(v?.BOARD_CODE) || null, industry, financial: isFinancialIndustry(industry), identityVerified: identity.verified, listingVerified: identity.listed, listingStatus: /退/.test(identity.name) ? "delisted" : identity.listed ? "listed" : "unconfirmed", officialUrl: identity.url, orgId: identity.orgId, st: /ST|退/i.test(identity.name), quoteDate: v ? tradeDate : null, price: finite(v?.CLOSE_PRICE), peTtm: finite(v?.PE_TTM), pb: finite(v?.PB_MRQ), marketCap: finite(v?.TOTAL_MARKET_CAP), reportDate: c ? periods.reportDate : null, publishedAt: publications.sort().at(-1) ?? null, annualReportDate: periods.annualReportDate, annualPublishedAt: dateOnly(a?.NOTICE_DATE), annualRoe: finite(a?.WEIGHTAVG_ROE), revenue, previousRevenue, revenueGrowth: yoy(revenue, previousRevenue), netIncome, previousNetIncome, profitGrowth: yoy(netIncome, previousNetIncome), profitState: profitState(netIncome, previousNetIncome), operatingCashFlow: finite(cf?.NETCASH_OPERATE), previousOperatingCashFlow: finite(pcf?.NETCASH_OPERATE), totalAssets: assets, totalLiabilities: liabilities, debtRatio: ratio, pePercentile: null, pePeers: 0, flags })
  }
  addPeerValuations(rows); rows.sort((a, b) => a.id.localeCompare(b.id))
  const coverage = coverageOf(rows)
  if (coverage.valuation < 4000 || coverage.financials < coverage.valuation * .85 || !Object.values(coverage.exchanges).every(n => n >= 100)) throw new Error("全市场快照覆盖异常，拒绝发布")
  return { schemaVersion: 1, fetchedAt: now.toISOString(), tradeDate, ...periods, rows, coverage, sources: [...official.sources, ...loaded.map(l => ({ id: l.key, name: `东方财富${({ valuation: "日终估值", current: "统一报告期业绩", previous: "上年同期业绩", annual: "完整年度ROE", cashflow: "本期现金流", previousCashflow: "上年同期现金流", balance: "本期资产负债" } as Record<string, string>)[l.key]}`, url: l.key === "valuation" ? "https://data.eastmoney.com/gzfx/list.html" : `https://data.eastmoney.com/bbsj/${(l.key === "annual" ? periods.annualReportDate : l.key.startsWith("previous") ? periods.comparisonDate : periods.reportDate).slice(0, 7).replace("-", "")}/yjbb.html`, status: "ok" as const, count: l.data.length, note: "公开网页结构化转引，不是官方直连API；当前修订版，不用于历史当时可知回测。" }))], warnings: ["北交所身份通过巨潮核验，有效上市名录未完整直连；名单覆盖不等于官方上市状态覆盖。", "PE(TTM)与PB(MRQ)为日终供应商口径，可能采用最新业绩快报；不强行与所选累计财报分母等同。", "行业为东方财富当前二级分类，非申万分类；专题是行业关联假设，不证明公司已获得政策收益。"] }
}
