"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import dynamic from "next/dynamic"
import useSWR from "swr"
import { ArrowRight, Bookmark, Download, ExternalLink, RefreshCw } from "lucide-react"
import type { MarketAnalysis } from "@/lib/cn/market-analysis"
import type { Preset, ScreenFilters, ScreenItem, ScreenResult } from "@/lib/cn/market-types"
import { PRESETS, presetFilters, parseScreenFilters, THEME_MAP } from "@/lib/cn/screener"
import { securityFromMarketRow } from "@/lib/cn/market-security"
import { CN_SECURITIES } from "@/lib/cn/security-catalog"
import { readNotebook, type ResearchNotebook, type ResearchNote } from "@/lib/cn/opportunities"
import { NoteEditor } from "./research-workspace"
import s from "./market-workspace.module.css"
const FundamentalsPanel = dynamic(() => import("./fundamentals-panel"))
const ValuationLab = dynamic(() => import("./research-workspace").then(m => m.ValuationLab))
const STORAGE = "eatfear.cn.research.v1"
const EMPTY_NOTE: ResearchNote = { thesis: "", confirmation: "", invalidation: "", sourceUrl: "", reviewedAt: "", savedAt: "" }
const number = (n: number | null | undefined, digits = 2) => n == null ? "—" : n.toLocaleString("zh-CN", { maximumFractionDigits: digits })
const amount = (n: number | null) => n === null ? "—" : number(n / 1e8)
const time = (raw: string | null | undefined) => raw ? new Date(raw).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) : "未确认"
const sorts = { pePercentile: "同行PE分位", profitGrowth: "利润同比", pb: "PB", peTtm: "PE TTM", annualRoe: "年度ROE", marketCap: "总市值" }
class RequestError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status } }
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) }); const body = await response.json()
  if (!response.ok) throw new RequestError(body.error ?? `HTTP ${response.status}`, response.status)
  return body as T
}
function paramsFor(filters: ScreenFilters, snapshotId?: string) {
  const p = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) p.set(key, value === null ? "" : String(value))
  if (snapshotId) p.set("snapshotId", snapshotId)
  return p
}
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" })), a = document.createElement("a")
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function SourceLink({ href, children }: { href: string; children: React.ReactNode }) { return <a href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={11} /></a> }

export default function MarketWorkspace({ compact = false, initialPreset = "value", onOpen, onIndicator }: { compact?: boolean; initialPreset?: Preset; onOpen: (preset: Preset) => void; onIndicator: (id: string) => void }) {
  const [filters, setFilters] = useState<ScreenFilters>(() => presetFilters(initialPreset))
  const [draft, setDraft] = useState<ScreenFilters>(() => presetFilters(initialPreset))
  const [pinned, setPinned] = useState("")
  const [selectedId, setSelectedId] = useState("")
  const [notebook, setNotebook] = useState<ResearchNotebook>({ version: 1, watchlist: [], notes: {} })
  const [ready, setReady] = useState(false), [message, setMessage] = useState(""), [exporting, setExporting] = useState(false)
  const [scenario, setScenario] = useState<Record<string, unknown>>({})
  const { data: analysis, error: analysisError, mutate: refreshAnalysis } = useSWR<MarketAnalysis>("/api/cn/analysis", fetchJson, { revalidateOnFocus: false, errorRetryCount: 1, dedupingInterval: 60000 })
  const snapshotId = pinned || analysis?.snapshotId
  const p = paramsFor({ ...filters, pageSize: compact ? 10 : filters.pageSize }, snapshotId)
  const { data: result, error, isLoading, mutate } = useSWR<ScreenResult>(snapshotId ? `/api/cn/screener?${p}` : null, fetchJson, { revalidateOnFocus: false, errorRetryCount: 0, keepPreviousData: false })
  const outsideSelection = !!selectedId && !result?.items.some(item => item.row.id === selectedId)
  const { data: outside, error: detailError } = useSWR<ScreenResult>(outsideSelection && snapshotId ? `/api/cn/screener?${p}&id=${encodeURIComponent(selectedId)}` : null, fetchJson, { revalidateOnFocus: false, errorRetryCount: 0 })
  const selected = selectedId ? result?.items.find(item => item.row.id === selectedId) ?? outside?.items[0] : result?.items[0]
  useEffect(() => {
    try { setNotebook(readNotebook(localStorage.getItem(STORAGE), CN_SECURITIES.map(c => c.id), true)) }
    catch { setMessage("浏览器本地存储不可用，可导出研究结果保存。") }
    if (!compact && location.search) {
      try { const query = new URLSearchParams(location.search); const restored = parseScreenFilters(query); setFilters(restored); setDraft(restored); setPinned(query.get("snapshotId") ?? "") }
      catch { setMessage("链接筛选参数无效，已恢复默认条件。") }
    }
    setReady(true)
  }, [compact])
  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(STORAGE, JSON.stringify(notebook)) } catch { setMessage("本地保存失败，请导出研究结果。") }
  }, [notebook, ready])
  const apply = (next: ScreenFilters) => {
    setFilters(next); setDraft(next); setSelectedId("")
    if (!compact) history.replaceState(null, "", `?${paramsFor(next, snapshotId)}#research`)
  }
  const usePreset = (preset: Preset) => { if (compact) onOpen(preset); else apply({ ...presetFilters(preset), theme: filters.theme }) }
  const toggleWatch = (id: string) => setNotebook(prev => ({ ...prev, watchlist: prev.watchlist.includes(id) ? prev.watchlist.filter(v => v !== id) : [...prev.watchlist, id].slice(0, 1000) }))
  const saveNote = (id: string, note: ResearchNote) => { setNotebook(prev => ({ ...prev, notes: { ...prev.notes, [id]: note } })); setMessage("研究记录已保存到当前浏览器。") }
  const saveScenario = useCallback((id: string, value: unknown) => setScenario(prev => ({ ...prev, [id]: value })), [])
  const exportResults = async () => {
    if (!snapshotId) return
    setExporting(true)
    try { const ep = paramsFor({ ...filters, page: 1 }, snapshotId); ep.set("export", "json"); const data = await fetchJson<ScreenResult>(`/api/cn/screener?${ep}`); download(`cn-screen-${snapshotId}.json`, { ...data, notebook, scenarios: scenario }); setMessage("已导出全部匹配结果、数值结论、来源、观察清单和笔记。") }
    catch (e) { setMessage(e instanceof Error ? `导出失败：${e.message}` : "导出失败") }
    finally { setExporting(false) }
  }
  const reload = async () => { setPinned(""); setSelectedId(""); await refreshAnalysis(); await mutate(); setMessage("已重新检查最新成功快照。") }
  return <div className={s.workspace} data-testid="cn-market-workspace">
    <div className={s.heading}><div><span className={s.kicker}>CHINA / DATA → EVIDENCE → COMPANIES</span><h2>{compact ? "先看经济判断，再看具体公司" : "沪深北A股 · 全市场筛选"}</h2><p>日终估值 × 统一报告期财务。打开就有结果，每条结论都能查看依据。</p></div><button className={s.button} onClick={() => void reload()}><RefreshCw size={14} />检查更新</button></div>
    {analysisError ? <p className={s.warning} role="alert">经济分析暂不可用，{analysisError.message}。<button onClick={() => void refreshAnalysis()}>重试</button></p> : !analysis ? <p className={s.loading} role="status">正在读取最近成功的真实市场快照…</p> : <>
      <p className={s.dates}>估值日期 <b>{analysis.tradeDate}</b> · 统一财报 <b>{analysis.reportDate}</b> · 年度ROE <b>{analysis.annualReportDate}</b> · 抓取 {time(analysis.fetchedAt)}</p>
      <div className={s.coverage} aria-label="真实数据覆盖">{[{ label: "候选名单", n: analysis.coverage.universe }, { label: "官方身份核验", n: analysis.coverage.identityVerified }, { label: "上市名录核验", n: analysis.coverage.listingVerified }, { label: "有日终估值", n: analysis.coverage.valuation }, { label: "有本期财报", n: analysis.coverage.financials }, { label: "基础可筛选", n: analysis.coverage.screenable }].map(x => <div key={x.label}><strong>{number(x.n, 0)}</strong><span>{x.label}</span></div>)}</div>
      {(analysis.warning || analysis.health.status !== "ok") && <p className={s.warning}>{analysis.warning ?? "最新采集状态待核对。"} 最近尝试 {time(analysis.health.lastAttemptAt)}。{analysis.health.errors.join("；")}</p>}
      <p className={s.meta}>沪市 {number(analysis.coverage.exchanges.SSE, 0)} · 深市 {number(analysis.coverage.exchanges.SZSE, 0)} · 北交所 {number(analysis.coverage.exchanges.BSE, 0)}。名单覆盖、身份核验和有效上市状态核验分别统计；缺失数据不填0。</p>
      <details className={s.help}><summary>第一次使用：这页怎么看？</summary><ol><li>先看下方经济判断，注意统计期与反向证据。</li><li>选择一组筛选条件，再按经济专题缩小范围；条件可自行调整。</li><li>点击公司，看“为什么入选”和风险；把需要继续核验的公司加入观察清单。</li></ol><p>已接入：{analysis.macroCoverage}条宏观/市场历史、本页覆盖数量所示的日终估值、财务摘要及现金流/资产负债。未自动核验：公司订单、政策到账、业务分部、报告附注及盈利预测。</p></details>
      {compact && <section className={s.section}><div className={s.heading}><div><span className={s.kicker}>01 / 经济发生了什么</span><h2>数字对应的当前判断</h2></div><small>{analysis.findings.length}条有数据依据的观察</small></div><div className={s.findings}>{analysis.findings.map(finding => <article className={s.card} key={finding.id}><h3>{finding.title}</h3><p className={s.conclusion}>{finding.conclusion}</p><div className={s.evidence}>{finding.evidence.map(ev => <button key={ev.id} onClick={() => onIndicator(ev.id)}><b>{ev.name} {number(ev.value)}{ev.unit}</b><small>{ev.period} · 打开历史</small></button>)}</div><p className={s.counter}>需同时考虑：{finding.counterEvidence}</p><div className={s.links}>{finding.evidence.map(ev => <SourceLink key={ev.id} href={ev.sourceUrl}>{ev.name}来源</SourceLink>)}</div></article>)}</div></section>}
      {!compact && <details className={s.help}><summary>五个专题的宏观证据与反向线索</summary>{analysis.themes.map(theme => <article key={theme.id}><h3>{theme.title} · {theme.label}</h3>{theme.evidence.map(e => <p key={e.rule.id}>{e.rule.title}：{e.value === null ? "数据不足" : `${number(e.value)}${e.rule.unit}`}（{e.period ?? "待披露"}）· {e.reason}</p>)}</article>)}</details>}
      <section className={s.section} id="cn-screen-results"><div className={s.heading}><div><span className={s.kicker}>02 / 哪些公司符合条件</span><h2>用经营与估值筛出研究对象</h2></div><button className={s.button} onClick={() => void exportResults()} disabled={exporting || !result}><Download size={14} />{exporting ? "导出中…" : "导出全部结果"}</button></div>
        <div className={s.presets}>{analysis.presets.map(preset => <button key={preset.id} aria-pressed={filters.preset === preset.id} className={filters.preset === preset.id ? s.active : ""} onClick={() => usePreset(preset.id)}><span>{preset.name}<ArrowRight size={14} /></span><strong>{number(preset.count, 0)}<small>家公司符合全市场预设</small></strong><p>{preset.description}</p><small>{preset.examples.map(x => x.name).join(" · ") || "当前无匹配公司"}</small></button>)}</div>
        {!compact && <FilterForm draft={draft} setDraft={setDraft} industries={result?.industries ?? []} onApply={e => { e.preventDefault(); try { apply(parseScreenFilters(paramsFor({ ...draft, page: 1 }))) } catch (err) { setMessage(err instanceof Error ? err.message : "筛选条件有误") } }} onReset={() => apply(presetFilters("custom"))} />}
        {result && <p className={s.resultStatus} role="status"><strong data-testid="cn-screen-count">{result.total}家公司符合当前条件</strong> · 排序：{sorts[filters.sort]}{filters.direction === "asc" ? "从低到高" : "从高到低"}，同值按代码 · {THEME_MAP[filters.theme].label}。同行PE为当日横截面分位。</p>}
        {filters.theme !== "all" && <p className={s.counter}>宏观证据状态：{analysis.themes.find(t => t.id === filters.theme)?.label ?? "待核对"}。{THEME_MAP[filters.theme].reason}</p>}
        {error && <p className={s.warning} role="alert">{error.status === 410 ? "此快照已过保留期，请检查更新后重新筛选。" : `筛选暂不可用：${error.message}`}<button onClick={() => void reload()}>重新读取</button></p>}
        {isLoading && <p role="status">正在按真实数据筛选…</p>}
        {result && <><div className={s.tableWrap}><table className={s.table}><caption>单位：亿元、%与倍；利润/现金流为年初累计，资产负债为期末值。日终价格可能不是可成交报价。</caption><thead><tr><th>公司 / 行业</th><th>收盘价</th><th>PE / PB</th><th>同行PE分位</th><th>收入同比</th><th>利润同比</th><th>年度ROE</th><th>经营现金流</th><th>研究</th></tr></thead><tbody>{result.items.map(item => { const r = item.row; return <tr key={r.id} className={selected?.row.id === r.id ? s.selected : ""}><td><button className={s.name} onClick={() => setSelectedId(r.id)}>{r.name}<small>{r.code} · {r.exchange} · {r.industry ?? "行业缺失"}</small></button></td><td>{number(r.price)}</td><td>{r.peTtm !== null && r.peTtm > 0 ? number(r.peTtm) : "亏损/不适用"}<small> / {number(r.pb)}</small></td><td>{r.pePercentile === null ? "样本不足" : `${number(r.pePercentile)}%`}<small>N={r.pePeers}</small></td><td>{number(r.revenueGrowth)}{r.revenueGrowth !== null ? "%" : ""}</td><td>{r.profitGrowth === null ? r.profitState === "turnaround" ? "扭亏" : "基数/数据不适用" : `${number(r.profitGrowth)}%`}</td><td>{number(r.annualRoe)}%</td><td>{amount(r.operatingCashFlow)}{r.financial ? <small>金融口径</small> : null}</td><td><button className={s.linkButton} onClick={() => setSelectedId(r.id)}>为什么入选</button><button className={s.bookmark} disabled={!ready} aria-label={`${notebook.watchlist.includes(r.id) ? "移出" : "加入"}观察清单 ${r.code}`} aria-pressed={notebook.watchlist.includes(r.id)} onClick={() => toggleWatch(r.id)}><Bookmark size={15} fill={notebook.watchlist.includes(r.id) ? "currentColor" : "none"} /></button></td></tr> })}</tbody></table></div>
          {!result.total && <div className={s.empty}><h3>当前条件没有匹配公司</h3><p>未自动放宽条件。可修改门槛或切换预设；以下是各条件排除数量（同一公司可能命中多项）。</p>{result.excluded.slice(0, 5).map(e => <p key={e.reason}>{e.reason}：{number(e.count, 0)}家</p>)}</div>}
          {compact ? <button className={s.primary} onClick={() => onOpen(filters.preset)}>查看全部{result.total}家公司与完整筛选条件 <ArrowRight size={15} /></button> : <div className={s.pagination}><button className={s.button} disabled={filters.page <= 1} onClick={() => apply({ ...filters, page: filters.page - 1 })}>上一页</button><span>第{result.page}页 / {result.pages || 1}页 · {result.pageSize}条/页 · 同一快照</span><button className={s.button} disabled={filters.page >= result.pages} onClick={() => apply({ ...filters, page: filters.page + 1 })}>下一页</button></div>}
        </>}
      </section>
      <details className={s.help}><summary>我的观察清单（{notebook.watchlist.length}）</summary><div className={s.watchlist}>{notebook.watchlist.map(id => <div key={id}><button onClick={() => setSelectedId(id)}>{result?.items.find(item => item.row.id === id)?.row.name ?? CN_SECURITIES.find(c => c.id === id)?.name ?? id}</button><button aria-label={`移出观察清单 ${id}`} onClick={() => toggleWatch(id)}>移出</button></div>)}</div><p>原有ETF和样本笔记继续保留；ETF请到“ETF与情景”查看。清单只保存在当前浏览器。</p></details>
      {detailError && <p className={s.warning}>该标的不在本次A股快照内；ETF请到“ETF与情景”查看。原记录仍保留。</p>}
      {selected && <CompanyDetail key={selected.row.id} item={selected} note={notebook.notes[selected.row.id] ?? EMPTY_NOTE} ready={ready} onSave={note => saveNote(selected.row.id, note)} onScenario={saveScenario} />}
      <details className={s.help}><summary>当前真实接入与数据源状态</summary><p>每项展示实际成功范围；“官方原始披露”和“第三方结构化转引”分别说明。</p>{analysis.sources.map(source => <article key={source.id}><h3>{source.name} · {source.status === "ok" ? "本次获取成功" : source.status === "partial" ? "部分覆盖" : "未完成接入/核验"} · {number(source.count, 0)}条</h3><p>{source.note}</p><SourceLink href={source.url}>来源</SourceLink></article>)}{analysis.warnings.map(w => <p key={w}>{w}</p>)}<p>快照 {analysis.snapshotId} · 采集计划：工作日18:23（北京时间）。节假日可能没有新交易数据；任务计划不等于已成功运行。</p>{analysis.health.runUrl && <SourceLink href={analysis.health.runUrl}>最近自动采集记录</SourceLink>}</details>
    </>}
    {message && <p className={s.message} aria-live="polite">{message}</p>}
  </div>
}

function FilterForm({ draft, setDraft, industries, onApply, onReset }: { draft: ScreenFilters; setDraft: (f: ScreenFilters) => void; industries: ScreenResult["industries"]; onApply: (e: FormEvent) => void; onReset: () => void }) {
  const update = (key: keyof ScreenFilters, value: unknown) => setDraft({ ...draft, [key]: value })
  const numbers: { key: keyof ScreenFilters; label: string }[] = [{ key: "peMin", label: "PE下限（倍；0表示正PE）" }, { key: "peMax", label: "PE上限（倍）" }, { key: "pbMin", label: "PB下限（倍；0表示正PB）" }, { key: "pbMax", label: "PB上限（倍）" }, { key: "pePercentileMax", label: "同行PE分位上限（%）" }, { key: "roeMin", label: "完整年度ROE下限（%）" }, { key: "revenueGrowthMin", label: "收入同比下限（%；0表示增长）" }, { key: "profitGrowthMin", label: "利润同比下限（%；0表示增长）" }, { key: "debtRatioMax", label: "非金融负债率上限（%）" }]
  return <form className={s.filterForm} onSubmit={onApply} aria-label="全市场筛选条件"><div className={s.basicFilters}>
    <label>经济专题<select aria-label="经济专题" value={draft.theme} onChange={e => update("theme", e.target.value)}>{Object.entries(THEME_MAP).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}</select></label>
    <label>市场<select aria-label="筛选市场" value={draft.exchange} onChange={e => update("exchange", e.target.value)}><option value="all">沪深北全部</option><option value="SSE">上海</option><option value="SZSE">深圳</option><option value="BSE">北交所</option></select></label>
    <label>行业<select aria-label="筛选行业" value={draft.industry} onChange={e => update("industry", e.target.value)}><option value="">全部行业</option>{industries.map(i => <option key={i.code} value={i.code}>{i.name}</option>)}</select></label>
    <label>公司<input aria-label="搜索全市场公司" placeholder="代码或名称" maxLength={100} value={draft.search} onChange={e => update("search", e.target.value)} /></label>
  </div><details><summary>调整估值与财务门槛</summary><div className={s.numericFilters}>{numbers.map(field => <label key={field.key}>{field.label}<input aria-label={field.label} type="number" step="any" value={draft[field.key] == null ? "" : String(draft[field.key])} placeholder="不限" onChange={e => update(field.key, e.target.value === "" ? null : Number(e.target.value))} /></label>)}</div><div className={s.basicFilters}>
    <label>企业类别<select aria-label="企业类别" value={draft.sector} onChange={e => update("sector", e.target.value)}><option value="all">全部</option><option value="nonfinancial">非金融</option><option value="financial">金融</option></select></label>
    <label>经营现金流<select aria-label="现金流条件" value={draft.cashFlow} onChange={e => update("cashFlow", e.target.value)}><option value="any">不限</option><option value="positive">为正（非金融）</option><option value="improving">为正且高于上年同期</option></select></label>
    <label>盈利状态<select aria-label="盈利状态" value={draft.profit} onChange={e => update("profit", e.target.value)}><option value="any">不限</option><option value="positive">本期盈利</option><option value="loss">本期亏损</option><option value="turnaround">扭亏为盈</option></select></label>
    <label>排序<select aria-label="筛选排序" value={draft.sort} onChange={e => update("sort", e.target.value)}>{Object.entries(sorts).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
    <label>方向<select aria-label="排序方向" value={draft.direction} onChange={e => update("direction", e.target.value)}><option value="asc">从低到高</option><option value="desc">从高到低</option></select></label>
  </div><p>同行不足10家不生成分位；同比基数非正时不生成普通增长率。现金流与负债率门槛不适用于金融行业。</p></details><div className={s.actions}><label><input type="checkbox" checked={draft.excludeSt} onChange={e => update("excludeSt", e.target.checked)} />排除ST及已识别退市风险</label><button type="button" className={s.button} onClick={onReset}>清除为自定义</button><button className={s.primary} type="submit">应用筛选条件</button></div></form>
}

function CompanyDetail({ item, note, ready, onSave, onScenario }: { item: ScreenItem; note: ResearchNote; ready: boolean; onSave: (n: ResearchNote) => void; onScenario: (id: string, value: unknown) => void }) {
  const [statements, setStatements] = useState(false), [lab, setLab] = useState(false)
  const row = item.row, security = securityFromMarketRow(row), labels = { business: "经营表现", valuation: "估值位置", match: "为什么入选 / 条件核对", risk: "反向证据与风险", missing: "还缺哪些证据" }
  const ignoreData = useCallback(() => {}, [])
  return <section className={s.detail} data-testid="cn-company-detail"><div className={s.heading}><div><span className={s.kicker}>03 / 为什么是这家公司</span><h2>{row.name} <small>{row.code}</small></h2><p>{row.industry} · {row.exchange} · 公告日 {row.publishedAt ?? "未提供"}</p></div><SourceLink href={row.officialUrl}>原始披露核验</SourceLink></div>
    <div className={s.detailMetrics}>{[{ name: "营业收入", value: amount(row.revenue) + "亿元" }, { name: "归母利润", value: amount(row.netIncome) + "亿元" }, { name: "经营现金流", value: amount(row.operatingCashFlow) + "亿元" }, { name: "资产负债率", value: row.financial ? "金融行业另行评价" : number(row.debtRatio) + "%" }].map(m => <div key={m.name}><span>{m.name}</span><strong>{m.value}</strong></div>)}</div>
    <div className={s.conclusions}>{item.conclusions.map(c => <article key={c.kind}><h3>{labels[c.kind]}</h3><p>{c.text}</p><small>对应期间 {c.period ?? "未提供"}</small><div className={s.links}><SourceLink href={c.sourceUrl}>核对数据来源</SourceLink>{c.references?.map(ref => <SourceLink key={ref.label} href={ref.url}>{ref.label} · {ref.period}</SourceLink>)}</div><details><summary>查看参与判断的数值</summary><dl>{c.fields.map(field => <div key={field}><dt>{({ revenue: "收入（元）", previousRevenue: "上年同期收入（元）", revenueGrowth: "收入同比（%）", netIncome: "归母利润（元）", previousNetIncome: "上年同期归母利润（元）", profitGrowth: "利润同比（%）", operatingCashFlow: "经营现金流（元）", previousOperatingCashFlow: "上年同期经营现金流（元）", price: "日终价格（元）", peTtm: "PE TTM（倍）", pb: "PB MRQ（倍）", pePercentile: "同行PE分位（%）", pePeers: "有效同行数", annualRoe: "完整年度ROE（%）", debtRatio: "资产负债率（%）" } as Record<string, string>)[field] ?? field}</dt><dd>{number(row[field as keyof typeof row] as number | null)}</dd></div>)}</dl></details></article>)}</div>
    {item.themeReason && <p className={s.counter}>{item.themeReason}</p>}
    <details className={s.help} onToggle={e => setStatements(e.currentTarget.open)}><summary>查看三张财报及上年同期比较</summary><p>按需读取最新共同报告期，可能晚于筛选所用的统一期间；本区数据不改变当前快照筛选结果。</p>{statements && <FundamentalsPanel security={security} onData={ignoreData} />}</details>
    <details className={s.help} onToggle={e => setLab(e.currentTarget.open)}><summary>高级工具：自行输入估值情景</summary>{lab && <ValuationLab security={security} quote={null} onScenario={onScenario} />}</details>
    <NoteEditor security={security} note={note} ready={ready} onSave={onSave} />
  </section>
}
