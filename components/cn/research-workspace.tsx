"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { ArrowRight, Bookmark, Check, Download, ExternalLink, Search } from "lucide-react"
import type { CnFundamentalsResponse } from "@/lib/cn/fundamentals"
import type { SeriesData } from "@/lib/cn/catalog"
import { CN_SECURITIES, type CnSecurity } from "@/lib/cn/security-catalog"
import type { CnSecuritiesResponse, CnSecurityQuote } from "@/lib/cn/securities"
import { RESEARCH_THEMES, assessTheme, bondScenario, equityScenario, readNotebook, type ResearchNotebook, type ResearchNote, type ThemeId } from "@/lib/cn/opportunities"
import s from "./research-workspace.module.css"
import FundamentalsPanel from "./fundamentals-panel"

const STORAGE_KEY = "eatfear.cn.research.v1"
const EMPTY_NOTE: ResearchNote = { thesis: "", confirmation: "", invalidation: "", sourceUrl: "", reviewedAt: "", savedAt: "" }
const stateLabels = { support: "支持线索", against: "反向线索", neutral: "方向中性", missing: "待补证据" }
const number = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? "—" : value.toLocaleString("zh-CN", { maximumFractionDigits: digits })
const time = (value?: string | null) => value ? new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) : "尚未取得"
const kindLabel = (kind: CnSecurity["kind"]) => kind === "stock" ? "股票" : kind === "bond-etf" ? "债券ETF" : "权益ETF"
const parseInput = (value: string) => value.trim() ? Number(value) : NaN
function External({ href, children }: { href: string; children: React.ReactNode }) { return <a href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={12} /></a> }
async function fetchSecurities(url: string): Promise<CnSecuritiesResponse> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`证券接口 HTTP ${response.status}`)
  return response.json()
}
function saveFile(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }))
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function ResearchWorkspace({ data, onIndicator }: { data: Record<string, SeriesData>; onIndicator: (id: string) => void }) {
  const [themeId, setThemeId] = useState<ThemeId>("debt")
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState("all")
  const [onlySaved, setOnlySaved] = useState(false)
  const [selectedId, setSelectedId] = useState(CN_SECURITIES.find(item => item.themeIds.includes("debt"))!.id)
  const [notebook, setNotebook] = useState<ResearchNotebook>({ version: 1, watchlist: [], notes: {} })
  const [storageReady, setStorageReady] = useState(false)
  const [storageWarning, setStorageWarning] = useState("")
  const [announcement, setAnnouncement] = useState("")
  const [financials, setFinancials] = useState<Record<string, CnFundamentalsResponse>>({})
  const [scenarios, setScenarios] = useState<Record<string, unknown>>({})
  const receiveFinancials = useCallback((value: CnFundamentalsResponse) => setFinancials(previous => previous[value.id] === value ? previous : { ...previous, [value.id]: value }), [])
  const receiveScenario = useCallback((id: string, value: unknown) => setScenarios(previous => ({ ...previous, [id]: value })), [])
  const { data: securities, error, isLoading, mutate } = useSWR<CnSecuritiesResponse>("/api/cn/securities", fetchSecurities, { refreshInterval: 300000, revalidateOnFocus: false, errorRetryCount: 1, dedupingInterval: 60000 })
  useEffect(() => {
    try { setNotebook(readNotebook(localStorage.getItem(STORAGE_KEY), CN_SECURITIES.map(item => item.id), true)) }
    catch { setStorageWarning("浏览器未允许本地存储；可下载研究快照保存。") }
    setStorageReady(true)
  }, [])
  useEffect(() => {
    if (!storageReady) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notebook)) }
    catch { setStorageWarning("本地保存失败；请下载研究快照。") }
  }, [notebook, storageReady])
  const theme = RESEARCH_THEMES.find(item => item.id === themeId)!
  const assessment = useMemo(() => assessTheme(theme, data), [theme, data])
  const selected = CN_SECURITIES.find(item => item.id === selectedId)!
  const quoteMap = new Map(securities?.items.map(item => [item.security.id, item]) ?? [])
  const selectedItem = quoteMap.get(selectedId)
  const candidates = CN_SECURITIES.filter(item => item.themeIds.includes(themeId) && (kind === "all" || item.kind === kind) && (!onlySaved || notebook.watchlist.includes(item.id)) && `${item.name} ${item.code} ${item.exposure}`.toLowerCase().includes(search.toLowerCase()))
  const changeTheme = (id: ThemeId) => {
    setThemeId(id); setSearch(""); setKind("all")
    const first = CN_SECURITIES.find(item => item.themeIds.includes(id)); if (first) setSelectedId(first.id)
  }
  const toggleWatch = (id: string) => {
    setNotebook(previous => ({ ...previous, watchlist: previous.watchlist.includes(id) ? previous.watchlist.filter(item => item !== id) : [...previous.watchlist, id] }))
  }
  const exportResearch = () => {
    saveFile(`cn-research-${themeId}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), purpose: "用户研究快照；不是历史当时可知数据集或投资建议", theme: { id: theme.id, title: theme.title, question: theme.question }, evidence: assessment.evidence, securities: securities?.items.filter(item => item.security.themeIds.includes(themeId)) ?? [], financials, scenarios, notebook, limitations: ["宏观条件由本站定义，未验证收益预测能力", "候选池是人工映射，不覆盖全市场", "行情来源与官方披露分开，财报与估值需要复核", "研究快照保存当前修订数据，不能用于无前视偏差回测"] }, null, 2))
    setAnnouncement("研究快照已生成，包含来源、统计期、已加载财报、行情、情景输入和已保存笔记。")
  }
  return <div className={s.workspace}>
    <div className={s.heading}><div><span className={s.eyebrow}>FROM ECONOMY TO INVESTMENTS</span><h2>从一个问题，开始一份研究</h2><p>先验证经济变化，再核对受益机制、经营兑现与买入价格。</p></div><button className={s.action} onClick={exportResearch}><Download size={15} />导出研究快照</button></div>
    <div className={s.themeGrid} role="group" aria-label="选择研究专题">{RESEARCH_THEMES.map(item => <button key={item.id} aria-pressed={themeId === item.id} onClick={() => changeTheme(item.id)} className={themeId === item.id ? s.activeTheme : ""}><span>{item.title}</span><small>{item.subtitle}</small></button>)}</div>
    <section className={s.thesis}>
      <div><span className={s.eyebrow}>01 / 宏观假设</span><h3>{theme.question}</h3></div><span className={s.badge}>{assessment.label}</span>
      <ol className={s.chain}>{theme.transmission.map((step, index) => <li key={step}><small>0{index + 1}</small>{step}{index < theme.transmission.length - 1 && <ArrowRight size={14} />}</li>)}</ol>
      <p>以下条件只检测宏观线索。各项可能相关、统计期可能不同，条件数量不代表概率或预期收益。</p>
    </section>
    <div className={s.evidenceGrid}>{assessment.evidence.map(item => <article key={item.rule.id} className={s.card}>
      <div className={s.cardHead}><h3>{item.rule.title}</h3><span className={`${s.badge} ${s[item.state]}`}>{stateLabels[item.state]}</span></div>
      <strong className={s.metric}>{number(item.value)}<small>{item.rule.unit}</small></strong>
      <p>{item.rule.rule}</p><p className={s.explanation}>{item.reason}</p>
      <small>统计期 {item.period ?? "待获取"} · 抓取 {time(item.fetchedAt)}</small>
      <div className={s.links}><button onClick={() => onIndicator(item.rule.seriesId)}>打开指标与历史 <ArrowRight size={13} /></button><External href={item.sourceUrl}>数据来源</External></div>
    </article>)}</div>
    <section className={s.section}>
      <div className={s.heading}><div><span className={s.eyebrow}>02 / 传导与反证</span><h2>证据走到了哪一步</h2></div><span className={s.badge}>经营与估值仍需核对</span></div>
      <div className={s.twoColumns}><article className={s.card}><h3>要继续验证</h3><ol className={s.checklist}>{theme.confirm.map(item => <li key={item}>{item}</li>)}</ol><p className={s.explanation}>下一观察点：{theme.nextRelease}</p><div className={s.links}>{theme.sources.map(item => <External key={item.url} href={item.url}>{item.name}</External>)}</div></article><article className={s.card}><h3>什么会推翻这个判断</h3><ol className={s.checklist}>{theme.invalidate.map(item => <li key={item}>{item}</li>)}</ol><p className={s.explanation}>把反证写在买入前。政策公告、资金到账和盈利改善分别核实，不能互相替代。</p></article></div>
    </section>
    <section className={s.section}>
      <div className={s.heading}><div><span className={s.eyebrow}>03 / 可研究的具体标的</span><h2>把主题映射到真实证券</h2><p>人工核验的有限候选池，按经济暴露关联；列表顺序不代表推荐或收益排名。</p></div><button className={s.action} onClick={() => void mutate()}>更新行情</button></div>
      <div className={s.filters}><label className={s.search}><Search size={15} /><input aria-label="搜索研究标的" placeholder="代码、名称或经济暴露" value={search} onChange={event => setSearch(event.target.value)} /></label><select aria-label="标的类型" value={kind} onChange={event => setKind(event.target.value)}><option value="all">全部类型</option><option value="stock">股票</option><option value="equity-etf">权益ETF</option><option value="bond-etf">债券ETF</option></select><label className={s.checkbox}><input type="checkbox" checked={onlySaved} onChange={event => setOnlySaved(event.target.checked)} />只看观察清单 ({notebook.watchlist.length})</label></div>
      <p className={s.dataStatus} role="status">{isLoading ? "正在获取证券行情，候选池可先查看。" : error ? "行情接口暂不可用；可继续查官方披露并记录研究。" : `${securities?.source ?? "行情源"} · 抓取 ${time(securities?.fetchedAt)} · ${securities?.status === "ok" ? "本轮获取完成" : "部分或全部行情待核对"}`}{securities?.warning ? ` · ${securities.warning}` : ""}</p>
      <div className={s.tableScroll}><table className={s.table}><caption>专题候选池 · 人民币报价 · PE TTM未核验留空；PB为个股行情商口径，ETF不套用个股估值</caption><thead><tr><th>标的 / 暴露</th><th>最新价</th><th>涨跌幅</th><th>PE TTM / PB</th><th>行情时间（北京时间）</th><th>研究</th></tr></thead><tbody>{candidates.map(item => {
        const quote = quoteMap.get(item.id)?.quote
        return <tr key={item.id} className={selectedId === item.id ? s.selectedRow : ""}><td><button className={s.nameButton} onClick={() => setSelectedId(item.id)}>{item.name}<small>{item.code} · {kindLabel(item.kind)} · {item.exposure}</small></button></td><td>{number(quote?.price, 3)}</td><td>{number(quote?.changePercent)}{quote ? "%" : ""}</td><td>{item.kind === "stock" ? `${number(quote?.peTtm)} / ${number(quote?.pb)}` : "不适用"}</td><td><small>{time(quote?.quotedAt)}<br />{quote?.freshness === "stale" ? "行情陈旧，待更新" : quote ? "日终 / 可能延迟" : "暂不可用"}</small></td><td><button className={s.watchButton} disabled={!storageReady} aria-label={`${notebook.watchlist.includes(item.id) ? "移出" : "加入"}观察清单 ${item.code}`} aria-pressed={notebook.watchlist.includes(item.id)} onClick={() => toggleWatch(item.id)}><Bookmark size={16} fill={notebook.watchlist.includes(item.id) ? "currentColor" : "none"} /></button><button className={s.inlineButton} onClick={() => setSelectedId(item.id)}>详情</button></td></tr>
      })}</tbody></table>{!candidates.length && <p className={s.empty}>没有匹配标的。可切换专题、清除搜索或取消“只看观察清单”。</p>}</div>
      <div className={s.detail} key={selected.id}>
        <div className={s.heading}><div><span className={s.eyebrow}>{selected.code} / RESEARCH FILE</span><h2>{selected.name}</h2><p>{selected.fullName}</p></div><External href={selected.officialUrl}>官方产品或公司资料</External></div>
        <p className={s.thesisText}>{selected.thesis}</p>
        <div className={s.twoColumns}><article><h3>看哪些经营与产品数据</h3><ul className={s.checklist}>{selected.checklist.map(item => <li key={item}>{item}</li>)}</ul></article><article><h3>这项暴露的主要风险</h3><ul className={s.checklist}>{selected.risks.map(item => <li key={item}>{item}</li>)}</ul></article></div>
        <small>身份与官方入口核验：{selected.verifiedAt}。持仓、费用、财报和估值以最新正式披露为准。</small>
        <FundamentalsPanel security={selected} onData={receiveFinancials} />
        <ValuationLab security={selected} quote={selectedItem?.quote ?? null} onScenario={receiveScenario} />
        <NoteEditor security={selected} note={notebook.notes[selected.id] ?? EMPTY_NOTE} ready={storageReady} onSave={note => { setNotebook(previous => ({ ...previous, notes: { ...previous.notes, [selected.id]: note } })); setAnnouncement(`${selected.name}研究记录已保存到当前浏览器。`) }} />
      </div>
    </section>
    {storageWarning && <p className={s.warning} role="alert">{storageWarning}</p>}
    <p className={s.dataStatus} aria-live="polite">{announcement}</p>
  </div>
}

function NumberField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className={s.field}><span>{label}</span><input type="number" step="any" value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} /></label>
}
export function ValuationLab({ security, quote, onScenario }: { security: CnSecurity; quote: CnSecurityQuote | null; onScenario: (id: string, value: unknown) => void }) {
  const [price, setPrice] = useState("")
  const [eps, setEps] = useState("")
  const [growth, setGrowth] = useState("5")
  const [pe, setPe] = useState("")
  const [dividend, setDividend] = useState("0")
  const [duration, setDuration] = useState("")
  const [shock, setShock] = useState("50")
  const [carry, setCarry] = useState("")
  useEffect(() => {
    onScenario(security.id, { kind: security.kind, inputs: { price, eps, growth, pe, dividend, duration, shock, carry }, note: "用户情景假设；不是预测。股票一年；债券忽略凸性。", capturedAt: new Date().toISOString() })
  }, [security.id, security.kind, price, eps, growth, pe, dividend, duration, shock, carry, onScenario])
  const scenario = equityScenario(parseInput(price), parseInput(eps), parseInput(growth), parseInput(pe), parseInput(dividend))
  const bond = bondScenario(parseInput(duration), parseInput(shock), parseInput(carry))
  const useQuote = () => { if (quote?.freshness === "recent") setPrice(String(quote.price)) }
  return <section className={s.lab}><div className={s.heading}><div><span className={s.eyebrow}>04 / 价格与假设</span><h3>{security.kind === "bond-etf" ? "利率变动会影响多少净值" : security.kind === "stock" ? "盈利改善，是否已经反映在价格里" : "买入ETF前的估值核验"}</h3></div></div>
    {security.kind === "stock" ? <>
      <p>一年持有情景：用盈利、退出估值和现金分红拆解结果。输入为你的假设，未扣费用与税费；每股收益须采用与PE相同口径。</p>
      <button className={s.inlineButton} disabled={!quote || quote.freshness !== "recent"} onClick={useQuote}>用最新行情填入买入价</button>
      <div className={s.inputGrid}><NumberField label="买入价（元）" value={price} onChange={setPrice} /><NumberField label="基期每股收益（元）" value={eps} onChange={setEps} /><NumberField label="未来一年盈利增长假设（%）" value={growth} onChange={setGrowth} /><NumberField label="一年后PE假设（倍）" value={pe} onChange={setPe} /><NumberField label="期间每股现金分红假设（元）" value={dividend} onChange={setDividend} /></div>
      <div className={s.scenarioResult}><div><span>假设期末价格</span><strong>{number(scenario?.terminalPrice)}<small>元</small></strong></div><div><span>含假设分红的情景回报</span><strong>{number(scenario?.totalReturn)}<small>%</small></strong></div></div>
      <p className={s.explanation}>期末价 = 基期EPS × (1 + 盈利增长) × 退出PE；回报 = (期末价 + 期间分红) ÷ 买入价 − 1。盈利下降或估值收缩可抵消增长。银行需另结合ROE、PB和资产质量；周期股需用正常化盈利。未填完整或输入不适用时不计算。</p>
    </> : security.kind === "bond-etf" ? <>
      <p>从最新基金报告填写修正久期和一年持有收益假设。ETF名称中的期限不等于组合久期。</p>
      <div className={s.inputGrid}><NumberField label="修正久期（年）" value={duration} onChange={setDuration} /><NumberField label="收益率变动（bp）" value={shock} onChange={setShock} /><NumberField label="一年票息/应计收益假设（%，不含价格涨跌）" value={carry} onChange={setCarry} /></div>
      <div className={s.scenarioResult}><div><span>价格一阶变化</span><strong>{number(bond?.priceChange)}<small>%</small></strong></div><div><span>加持有收益的近似回报</span><strong>{number(bond?.approximateReturn)}<small>%</small></strong></div></div><p className={s.explanation}>价格变化 ≈ −修正久期 × 利率变动。忽略凸性、曲线非平行变化、费用、再投资与溢折价，不能作为净值预测。</p>
    </> : <ol className={s.checklist}><li>先核对跟踪指数、前十大权重、行业集中度及最新基金定期报告。</li><li>去指数公司核对PE/PB口径及历史分位；价格指数的位置不能替代估值。</li><li>去基金管理人核对净值、费用、跟踪误差、规模和交易溢折价。本模块尚未取得基金净值与指数估值序列，暂不计算溢价或目标价。</li></ol>}
  </section>
}

export function NoteEditor({ security, note, ready, onSave }: { security: CnSecurity; note: ResearchNote; ready: boolean; onSave: (note: ResearchNote) => void }) {
  const [draft, setDraft] = useState(note)
  const [error, setError] = useState("")
  useEffect(() => { setDraft(note) }, [note])
  const update = (key: keyof ResearchNote, value: string) => setDraft(previous => ({ ...previous, [key]: value }))
  return <form className={s.notebook} onSubmit={event => {
    event.preventDefault()
    if (draft.sourceUrl) { try { const url = new URL(draft.sourceUrl); if (!["http:", "https:"].includes(url.protocol)) throw new Error() } catch { setError("证据链接请填写有效的 http 或 https 地址。"); return } }
    setError(""); onSave({ ...draft, savedAt: new Date().toISOString() })
  }}><div className={s.heading}><div><span className={s.eyebrow}>05 / 我的研究记录</span><h3>让每次判断可以复盘</h3><p>记录保存在当前浏览器；导出快照可另行留档。</p></div></div><div className={s.noteGrid}>{[{ key: "thesis", label: "我的投资假设", placeholder: "例如：清欠到账会改善经营现金流，但当前估值仍待核对。" }, { key: "confirmation", label: "支持证据与统计期", placeholder: "写明公告日期、财报期、具体指标和原文位置。" }, { key: "invalidation", label: "反证与退出观察条件", placeholder: "哪些事实出现时，需要放弃或修改这个判断？" }].map(field => <label className={s.field} key={field.key}><span>{field.label}</span><textarea aria-label={field.label} maxLength={4000} rows={3} value={draft[field.key as keyof ResearchNote]} placeholder={field.placeholder} onChange={event => update(field.key as keyof ResearchNote, event.target.value)} /></label>)}</div><div className={s.twoColumns}><label className={s.field}><span>原始证据链接</span><input type="url" value={draft.sourceUrl} maxLength={2000} placeholder={security.officialUrl} onChange={event => update("sourceUrl", event.target.value)} /></label><label className={s.field}><span>下次复核日期</span><input type="date" value={draft.reviewedAt} onChange={event => update("reviewedAt", event.target.value)} /></label></div><div className={s.links}><button disabled={!ready} className={s.action} type="submit"><Check size={14} />保存研究记录</button><small>{note.savedAt ? `上次保存 ${time(note.savedAt)}` : "尚未保存"} · 日期仅作记录，未设置通知</small></div>{error && <p role="alert" className={s.warning}>{error}</p>}</form>
}
