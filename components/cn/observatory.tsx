"use client"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import useSWR, { useSWRConfig } from "swr"
import { useTheme } from "next-themes"
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronRight, CircleHelp, Database, Download, ExternalLink, History, Landmark, Layers3, LayoutDashboard, Moon, Network, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Sun, TrendingUp, Waves } from "lucide-react"
import { BY_ID, GROUPS, METHODS, SERIES, type Group, type SeriesData } from "@/lib/cn/catalog"
import { csv, difference, evaluate, eventStudy, interestSaving, mean, rangePoints } from "@/lib/cn/metrics"
import { ASSETS, BASELINE, HISTORY, POLICY_SOURCE, TRANSMISSION, type Policy } from "@/lib/cn/research"
import styles from "./observatory.module.css"
import researchStyles from "./research-workspace.module.css"
import type { Preset } from "@/lib/cn/market-types"
const MarketWorkspace = dynamic(() => import("./market-workspace"), { loading: () => <p>正在读取全市场研究工作台…</p> })
const ResearchWorkspace = dynamic(() => import("./research-workspace"), { loading: () => <p>正在打开专题研究…</p> })
const SourceGuide = dynamic(() => import("./source-guide"), { loading: () => <p>正在打开数据源目录…</p> })
const Chart = dynamic(() => import("./charts").then(m => m.HistoryChart), { ssr: false, loading: () => <div className={styles.chartLoading}>加载图表组件…</div> })
const Sparkline = dynamic(() => import("./charts").then(m => m.Sparkline), { ssr: false })
const tabs = [
  { id: "overview", label: "今日经济判断", icon: LayoutDashboard },
  { id: "research", label: "全市场筛选", icon: Search },
  { id: "tools", label: "ETF与情景", icon: Layers3 },
  { id: "indicators", label: "指标实验室", icon: Activity },
  { id: "debt", label: "化债与传导", icon: Network },
  { id: "history", label: "历史与情景", icon: History },
  { id: "sources", label: "数据与方法", icon: Database },
] as const
type Tab = typeof tabs[number]["id"]
const fmt = (v: number | null | undefined, digits = 2) => v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toLocaleString("zh-CN", { maximumFractionDigits: digits })
const dateTime = (s?: string | null) => s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}（仅日期）` : s ? new Date(s).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) : "未提供"
const tone = (p: number | null) => p === null ? "muted" : p >= 90 || p <= 10 ? "amber" : "teal"
async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(35000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<T>
}
function Probe({ id, onData }: { id: string; onData: (data: SeriesData) => void }) {
  const { data, error } = useSWR<SeriesData>(`/api/cn/series?id=${id}`, fetcher, { refreshInterval: 900000, revalidateOnFocus: false, errorRetryCount: 1, dedupingInterval: 60000 })
  useEffect(() => {
    if (error && data) onData({ ...data, status: "partial", latestVerified: false, warning: "本次请求失败，保留上次历史；当前判断待复核。" })
    else if (data) onData(data)
    else if (error) onData({ id, points: [], status: "unavailable", complete: false, fetchedAt: null, publishedAt: null, firstDate: null, lastDate: null, sourceUrl: BY_ID[id].sourceUrl, warning: "网络或接口暂不可用；可手动重试。" })
  }, [id, data, error, onData])
  return null
}
function Tag({ children, kind = "muted" }: { children: ReactNode; kind?: string }) { return <span className={`${styles.tag} ${styles[kind] ?? ""}`}>{children}</span> }
function Out({ href, children }: { href: string; children: ReactNode }) { return <a href={href} target="_blank" rel="noopener noreferrer" className={styles.out}>{children}<ExternalLink size={12} /></a> }
function Empty({ text }: { text?: string }) { return <div className={styles.empty}><Database size={28} /><strong>等待真实数据</strong><p>{text ?? "正在连接上游。没有填充模拟曲线，缺失值不会视为0。"}</p></div> }
function SectionTitle({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) { return <div className={styles.sectionTitle}><div><span className={styles.kicker}>{kicker}</span><h2>{title}</h2></div>{children}</div> }
function Flow() { return <div className={styles.flow}>{TRANSMISSION.map((s, i) => <article key={s.title}><div className={styles.flowNum}>0{i + 1}<ArrowRight size={17} /></div><Tag>{s.kind}</Tag><h3>{s.title}</h3><p>{s.text}</p><div className={styles.evidence}><Check size={13} />{s.evidence}</div><small>{s.missing}</small></article>)}</div> }
export default function Observatory() {
  const [tab, setTab] = useState<Tab>("overview")
  const [marketPreset, setMarketPreset] = useState<Preset>("value")
  const [selected, setSelected] = useState("pmi")
  const [group, setGroup] = useState<Group | "all">("all")
  const [search, setSearch] = useState("")
  const [years, setYears] = useState<number | null>(5)
  const [data, setData] = useState<Record<string, SeriesData>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [principal, setPrincipal] = useState(1000)
  const [oldRate, setOldRate] = useState(6)
  const [newRate, setNewRate] = useState(2.5)
  const [duration, setDuration] = useState(8)
  const [rateShock, setRateShock] = useState(50)
  const { resolvedTheme, setTheme } = useTheme()
  const { mutate } = useSWRConfig()
  const onData = useCallback((value: SeriesData) => setData(prev => prev[value.id] === value ? prev : { ...prev, [value.id]: value }), [])
  const { data: feed } = useSWR<{ items: Policy[]; checkedAt: string; liveCount: number; status: string }>("/api/cn/policies", fetcher, { refreshInterval: 900000, revalidateOnFocus: false, errorRetryCount: 1 })
  useEffect(() => { setMounted(true); const hash = location.hash.slice(1); if (tabs.some(t => t.id === hash)) setTab(hash as Tab) }, [])
  const go = (next: Tab) => { setTab(next); history.replaceState(null, "", `#${next}`); window.scrollTo({ top: 0, behavior: "smooth" }) }
  const refresh = async () => { setRefreshing(true); try { await Promise.allSettled([...SERIES.map(d => mutate(`/api/cn/series?id=${d.id}`)), mutate("/api/cn/policies"), mutate("/api/cn/securities"), mutate("/api/cn/analysis")]) } finally { setRefreshing(false) } }
  const openMarket = (preset: Preset) => { setMarketPreset(preset); history.replaceState(null, "", location.pathname); go("research") }
  const evaluations = useMemo(() => Object.fromEntries(SERIES.map(d => [d.id, evaluate(d, data[d.id])])), [data])
  const available = SERIES.filter(d => data[d.id]?.points.length).length
  const finished = Object.keys(data).length
  const partial = SERIES.filter(d => data[d.id]?.status === "partial").length
  const failed = SERIES.filter(d => data[d.id]?.status === "unavailable").length
  const def = BY_ID[selected], current = data[selected], ev = evaluations[selected]
  const filtered = SERIES.filter(d => (group === "all" || d.group === group) && `${d.name} ${d.short} ${d.origin}`.toLowerCase().includes(search.toLowerCase()))
  const points = rangePoints(current?.points ?? [], years)
  const sameDaySpread = difference(data.cn10y?.points ?? [], data.cn2y?.points ?? [], 100).at(-1)
  const priceSpread = difference(data.cpi?.points ?? [], data.ppi?.points ?? []).at(-1)
  const monitored = SERIES.filter(d => d.frequency !== "annual" && !evaluations[d.id].stale && evaluations[d.id].robustZ !== null)
  const anomalies = monitored.filter(d => Math.abs(evaluations[d.id].robustZ!) > 3.5)
  const heatIds: Record<Group, string[]> = { activity: ["pmi", "nonpmi", "retail", "industrial"], prices: ["cpi", "ppi"], money: ["m2", "loans"], fiscal: ["fiscal"], markets: ["cn10y"] }
  const choose = (id: string) => { setSelected(id); if (tab !== "overview" && tab !== "indicators") go("indicators"); else document.getElementById("cn-chart")?.scrollIntoView({ behavior: "smooth", block: "start" }) }
  const download = () => { if (!current?.points.length) return; const url = URL.createObjectURL(new Blob([csv(def, current)], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `eatfear-cn-${selected}-${current.lastDate}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
  const library = <>
    <SectionTitle kicker="INDICATOR LAB" title="每个信号，都回到数据"><Tag>{filtered.length} 个指标</Tag></SectionTitle>
    <div className={styles.filters}><label className={styles.search}><Search size={16} /><input aria-label="搜索指标" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索指标、来源或关键词" /></label><div className={styles.chips}>{[{ id: "all", name: "全部" }, ...GROUPS].map(g => <button key={g.id} className={group === g.id ? styles.activeChip : ""} onClick={() => setGroup(g.id as Group | "all")}>{g.name}</button>)}</div></div>
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>观察指标</th><th>最新值</th><th>统计期</th><th>历史分位</th><th>状态</th><th className={styles.sparkCell}>近期走势</th></tr></thead><tbody>{filtered.map(d => { const e = evaluations[d.id], s = data[d.id]; return <tr key={d.id} className={selected === d.id ? styles.selectedRow : ""}><td><button className={styles.rowButton} onClick={() => choose(d.id)}>{d.name}<small>{d.short} · {d.frequency === "annual" ? "年度" : d.frequency === "daily" ? "日频" : "月频"}</small></button></td><td className={styles.numeric}>{fmt(e.value)} <small>{d.unit}</small></td><td>{s?.lastDate ?? "—"}</td><td><div className={styles.miniMeter}><span style={{ width: `${e.percentile ?? 0}%` }} /></div><small>{e.percentile === null ? "不评分" : `P${fmt(e.percentile, 0)} · N=${e.samples}`}</small></td><td><Tag kind={e.stale || s?.status === "unavailable" ? "muted" : tone(e.percentile)}>{s?.status === "unavailable" ? "源不可用" : e.label}</Tag></td><td className={`${styles.sparkCell} ${styles.teal}`}><Sparkline points={s?.points ?? []} /></td></tr> })}</tbody></table>{!filtered.length && <Empty text="没有匹配指标，请修改筛选条件。" />}</div>
  </>
  const mainChart = <div className={styles.chartGrid} id="cn-chart"><section className={styles.panel}>
    <div className={styles.panelHead}><div><span className={styles.kicker}>HISTORY & CONTEXT</span><h2>{def.name}<Tag>{def.unit}</Tag></h2></div><button className={styles.iconButton} onClick={download} disabled={!current?.points.length} aria-label="下载完整历史CSV" title="下载完整历史CSV"><Download size={17} /></button></div>
    <div className={styles.chartControls}><select aria-label="选择图表指标" value={selected} onChange={e => setSelected(e.target.value)}>{SERIES.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select><div className={styles.ranges}>{[1, 3, 5, 10, null].map(n => <button key={String(n)} aria-pressed={years === n} className={years === n ? styles.rangeActive : ""} onClick={() => setYears(n)}>{n === null ? "全部" : `${n}年`}</button>)}</div></div>
    <div className={styles.chartValue}><strong>{fmt(ev.value)}</strong><span>{def.unit}</span>{ev.delta !== null && <span className={ev.delta >= 0 ? styles.teal : styles.amber}>{ev.delta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{fmt(Math.abs(ev.delta))} {def.unit === "%" ? "百分点" : def.unit} / 上期</span>}</div>
    {points.length ? <Chart points={points} unit={def.unit} reference={def.reference} /> : <Empty text={current?.warning ?? undefined} />}
    <div className={styles.chartFoot}><span>统计期 {current?.lastDate ?? "—"} · 原始历史 {current?.firstDate ?? "—"} 起 · {current?.points.length ?? 0} 点</span><Out href={current?.sourceUrl ?? def.sourceUrl}>数据源</Out></div>
    <p className={styles.subtle}>{def.origin} · 窗口相对最后观测日；短上市/披露历史不向前补造。月度数据不插值为日频。</p>
    {current?.warning && <p className={styles.warning}>{current.warning}</p>}
  </section><aside className={`${styles.panel} ${styles.interpretation}`}>
    <div className={styles.panelHead}><h3><Waves size={17} /> 这个数字意味着什么</h3><Tag kind={tone(ev.percentile)}>{ev.label}</Tag></div>
    <p className={styles.meaning}>{def.meaning}</p><div className={styles.bigPercentile}><span>相对历史位置</span><strong>{ev.percentile === null ? "—" : `P${fmt(ev.percentile, 0)}`}</strong></div>
    <div className={styles.spectrum}><i style={{ left: `${Math.max(1, Math.min(99, ev.percentile ?? 50))}%`, opacity: ev.percentile === null ? 0 : 1 }} /></div><div className={styles.spectrumLabels}><span>历史低位</span><span>中位</span><span>历史高位</span></div>
    <div className={styles.miniStats}><div><span>Z-score</span><b>{fmt(ev.z)}</b></div><div><span>稳健 M-score</span><b>{fmt(ev.robustZ)}</b></div><div><span>基准样本</span><b>{ev.samples}</b></div></div>
    {(ev.momentum !== null || def.price) && <div className={styles.miniStats}><div><span>3个月变化</span><b>{fmt(ev.momentum)}</b></div><div><span>252期峰值回撤</span><b>{fmt(ev.drawdown)}{def.price ? "%" : ""}</b></div><div><span>年化波动率</span><b>{fmt(ev.volatility)}{def.price ? "%" : ""}</b></div></div>}
    <p className={styles.insight}>{ev.explanation}</p><div className={styles.caution}><CircleHelp size={15} /><span>{def.caveat}</span></div>
    <button className={styles.textButton} onClick={() => go("sources")}>查看公式、阈值与数据口径 <ArrowRight size={14} /></button>
  </aside></div>
  return <div className={styles.root} data-theme={mounted && resolvedTheme === "light" ? "light" : "dark"} lang="zh-CN">
    {SERIES.map(d => <Probe key={d.id} id={d.id} onData={onData} />)}
    <aside className={styles.sidebar}><Link href="/home" className={styles.brand}><span className={styles.brandMark}><Activity size={22} /></span>eatfear<span className={styles.cnBadge}>CN</span></Link><div className={styles.workspace}>CHINA OBSERVATORY<span>中国经济 · 专题研究台</span></div><nav aria-label="中国观察导航">{tabs.map(t => <button key={t.id} aria-current={tab === t.id ? "page" : undefined} className={tab === t.id ? styles.navActive : ""} onClick={() => go(t.id)}><t.icon size={18} />{t.label}{tab === t.id && <span className={styles.navDot} />}</button>)}</nav><div className={styles.sidebarNote}><ShieldCheck size={20} /><strong>证据先于结论</strong><p>从政策到现金流，<br />从预期到真实定价。</p><span>事实 / 估算 / 假设<br />始终分开展示</span></div><Link href="/macro" className={styles.backLink}>全球宏观工作台 <ArrowRight size={14} /></Link></aside>
    <div className={styles.content}><header className={styles.topbar}><div className={styles.breadcrumb}><span className={styles.mobileBrand}>eatfear <b>CN</b></span><span>研究工作台</span><ChevronRight size={13} /><strong>{tabs.find(t => t.id === tab)?.label}</strong></div><div className={styles.topActions}><span className={styles.connection}><i />{available}/{SERIES.length} 有历史</span><button className={styles.iconButton} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="切换深色浅色">{mounted && resolvedTheme === "light" ? <Moon size={17} /> : <Sun size={17} />}</button><button className={styles.refresh} disabled={refreshing} onClick={refresh}><RefreshCw size={14} className={refreshing ? styles.spinning : ""} /><span>{refreshing ? "更新中" : "刷新"}</span></button></div></header>
      <nav className={styles.mobileNav} aria-label="页面分区">{tabs.map(t => <button key={t.id} aria-pressed={tab === t.id} className={tab === t.id ? styles.activeChip : ""} onClick={() => go(t.id)}>{t.label}</button>)}</nav>
      <main className={styles.main}>
        <section className={`${styles.hero} ${(tab === "overview" || tab === "research") ? styles.marketHero : ""}`}><div><div className={styles.heroKicker}><span /> FOLLOW THE EVIDENCE, NOT THE NOISE</div><h1>{tab === "overview" ? <>看懂经济变化，<br /><em>筛出具体公司。</em></> : tab === "research" ? <>从经济变化，<em>找到值得研究的标的。</em></> : tab === "indicators" ? <>让判断，<em>经得起数据验证。</em></> : tab === "debt" ? <>从债务置换，<em>追到现金流。</em></> : tab === "history" ? <>理解来路，<em>而非复制过去。</em></> : <>每一个结论，<em>都有来处。</em></>}</h1><p>查看日终更新的经济判断、公司财务和估值筛选。先看结论，再核对数字、来源和风险。</p><div className={styles.heroTags}><span><Database size={13} />官方与第三方数据</span><span><Layers3 size={13} />五维观察框架</span><span><ShieldCheck size={13} />非买卖信号</span></div></div><div className={styles.heroOrbit} aria-hidden="true"><div /><div /><div /><Landmark size={40} /><span>POLICY → CASH FLOW</span></div></section>
        <div className={styles.statusLine}><span><i className={finished < SERIES.length ? styles.pulse : ""} />{finished < SERIES.length ? `连接上游 ${finished}/${SERIES.length}` : `本轮获取完成 · ${available}项有数据${partial ? ` · ${partial}项历史待核对` : ""}${failed ? ` · ${failed}项暂不可用` : ""}`}</span><span>打开页面每15分钟检查 · 月度 / 日终 / 年度按原始频率展示</span></div>
        {(tab === "overview" || tab === "research") && <MarketWorkspace key={tab} compact={tab === "overview"} initialPreset={marketPreset} onOpen={openMarket} onIndicator={id => { setSelected(id); go("indicators") }} />}
        {tab === "tools" && <><section className={researchStyles.intro}><div><h2>ETF与手动情景工具</h2><p>这里保留原有9个核验案例；全部A股公司的真实筛选结果，请打开“全市场筛选”。</p></div><button onClick={() => openMarket("value")}>进入全市场筛选 <ArrowRight size={16} /></button></section><ResearchWorkspace data={data} onIndicator={choose} /></>}
        {(tab === "overview" || tab === "indicators") && <>
          <div className={styles.heatGrid}>{GROUPS.map(g => { const ids = heatIds[g.id]; const valid = ids.filter(id => evaluations[id].percentile !== null && !evaluations[id].stale && data[id]?.complete); const value = valid.length >= Math.ceil(ids.length / 2) ? mean(valid.map(id => evaluations[id].percentile!)) : null; return <button className={styles.heatCard} key={g.id} onClick={() => { setGroup(g.id); choose(ids[0]) }}><div><span>{g.name}</span><ArrowUpRight size={16} /></div><strong>{fmt(value, 0)}<small>/100</small></strong><div className={styles.heatBar}><i style={{ width: `${value ?? 0}%` }} /></div><p>{g.id === "markets" ? "长端利率相对位置" : g.id === "fiscal" ? "财政收入增速位置" : g.subtitle}</p><small>有效覆盖 {valid.length}/{ids.length} · {value === null ? "暂不评分" : "历史分位等权"}</small></button> })}</div>
          <p className={styles.subtle}>温度只表达相对历史强弱，不代表资产便宜或经济好坏。各组样本与统计期不同，不合成总买入分。</p>
          {mainChart}
          {tab === "overview" && <div className={styles.threeCards}><article className={styles.panel}><span className={styles.kicker}>YIELD CURVE</span><h3>10年 − 2年期限利差</h3><strong className={styles.cardNumber}>{fmt(sameDaySpread?.value)}<small> bp</small></strong><p>严格匹配同一天，不前向填充；不是城投信用利差。</p><small>{sameDaySpread?.date ?? "等待两条曲线"}</small></article><article className={styles.panel}><span className={styles.kicker}>PRICE TRANSMISSION</span><h3>CPI − PPI 价格差</h3><strong className={styles.cardNumber}>{fmt(priceSpread?.value)}<small> 个百分点</small></strong><p>上下游价格分化的线索，不直接等于企业利润率。</p><small>{priceSpread?.date ?? "等待同月观测"}</small></article><article className={styles.panel}><span className={styles.kicker}>ANOMALY WATCH</span><h3>潜在异常观察</h3><strong className={styles.cardNumber}>{monitored.length ? anomalies.length : "—"}<small> / {monitored.length} 可评估</small></strong><p>{anomalies.length ? anomalies.map(d => d.name).join("、") : "以稳健M-score识别极端值；异常可能来自经济变化、基数或数据问题。"}</p><small>|M| &gt; 3.5 · 陈旧数据不参与</small></article></div>}
          {library}
          {tab === "overview" && <><SectionTitle kicker="POLICY TO CASH FLOW" title="不止看规模，更要看钱走到了哪里"><button className={styles.textButton} onClick={() => go("debt")}>进入化债观察 <ArrowRight size={14} /></button></SectionTitle><Flow /></>}
        </>}
        {tab === "debt" && <>
          <SectionTitle kicker="POLICY BASELINE · 2024-11" title="拆开看，才不会重复计算"><Out href={POLICY_SOURCE}>财政部原文</Out></SectionTitle>
          <div className={styles.threeCards}>{[{ n: "6", label: "万亿元 · 增加债务限额", date: "2024—2026", desc: "每年2万亿元，支持置换存量隐性债务。" }, { n: "4", label: "万亿元 · 配套化债安排", date: "2024—2028", desc: "每年从新增地方专项债安排8000亿元。" }, { n: "2", label: "万亿元 · 远期偿还安排", date: "2029年及以后到期", desc: "相关棚改隐债按原合同偿还，不是新增2万亿元现金。" }].map(x => <article key={x.n} className={`${styles.panel} ${styles.quota}`}><Tag kind="amber">{x.date}</Tag><strong>{x.n}<span>{x.label}</span></strong><p>{x.desc}</p><small>政策安排，不是已经发行或实际使用的金额</small></article>)}</div>
          <div className={styles.threeCards}>{["lg_issuance", "lg_refinance", "lg_balance"].map(id => <article key={id} className={styles.panel}><span className={styles.kicker}>MOF · OFFICIAL DISCLOSURE</span><h3>{BY_ID[id].name}</h3><strong className={styles.cardNumber}>{fmt(evaluations[id].value, 0)}<small> 亿元</small></strong><small>统计期 {data[id]?.lastDate ?? "待获取"}</small><p>{BY_ID[id].meaning}</p><button className={styles.textButton} onClick={() => choose(id)}>查看官方历史曲线 <ArrowRight size={14} /></button></article>)}</div>
          <div className={styles.callout}><Landmark size={24} /><div><strong>直接增加的置换资源是10万亿元，不是12万亿元新增刺激。</strong><p>这里不使用虚构执行进度条。官方发行与余额自动更新；实际使用和企业回款仍须分别核验，不能从发行或额度反推。</p></div></div>
          <SectionTitle kicker="TRANSMISSION MAP" title="三本账，两条时间线" /><Flow />
          <p className={styles.subtle}>这是待验证的机制图，不是已穿透追踪每一元资金的流水图；执行进度与市场预期可能不同步。</p>
          <SectionTitle kicker="OFFICIAL POLICY RADAR" title="从官方信息发现变化"><Tag kind={feed?.status === "ok" ? "teal" : "amber"}>{feed?.liveCount ?? 0} 条自动发现</Tag></SectionTitle>
          <div className={styles.policyList}>{(feed?.items ?? BASELINE).map(p => <a className={styles.policyItem} key={p.url} href={p.url} target="_blank" rel="noopener noreferrer"><div><span>{p.date ?? "目录未标日期"}</span><Tag kind={p.type === "live" ? "teal" : "muted"}>{p.type === "live" ? "自动发现" : "历史基线"}</Tag></div><h3>{p.title}<ArrowUpRight size={16} /></h3><small>{p.source}</small></a>)}</div><p className={styles.subtle}>目录检查 {dateTime(feed?.checkedAt)}。{feed?.status !== "ok" ? "部分目录未能获取；历史基线不冒充最新政策。" : "目录不等于全文研判，请打开原文核对适用范围与用途。"}</p>
          <SectionTitle kicker="ASSET RESEARCH" title="受益假设，必须带着反证" /><div className={styles.assetGrid}>{ASSETS.map(a => <article className={styles.panel} key={a.name}><span className={styles.kicker}>{a.driver}</span><h3>{a.name}</h3><p>{a.thesis}</p><div className={styles.evidence}><Check size={14} />{a.confirm}</div><div className={styles.caution}><ShieldCheck size={15} /><span>{a.risk}</span></div><button className={styles.textButton} onClick={() => choose(a.id)}>查看相关指标 <ArrowRight size={14} /></button></article>)}</div>
        </>}
        {tab === "history" && <>
          <SectionTitle kicker="HISTORICAL FRAMEWORK" title="同样叫化债，解决的并不是同一个问题" /><div className={styles.timeline}>{HISTORY.map((h, i) => <article key={h.year}><div className={styles.timelineYear}><i />{h.year}</div><div className={styles.panel}><span className={styles.kicker}>CHAPTER 0{i + 1} · {h.tool}</span><h3>{h.title}</h3><p>{h.body}</p><div className={styles.chartFoot}><span>跟踪：{h.watch}</span><Out href={h.url}>参考资料</Out></div></div></article>)}</div>
          <SectionTitle kicker="EVENT EXPLORER" title="政策之后，市场实际发生了什么？"><Tag>描述性复盘 · 非因果回测</Tag></SectionTitle>
          <section className={styles.panel}><h3>沪深300 · 2024年11月化债安排前后</h3><p>以2024-11-11首个完整交易日收盘为观察起点，不假设提前交易。图示为价格指数，不含分红与费用。</p>{data.equity?.points.length ? <Chart points={data.equity.points.filter(p => p.date >= "2024-05-01" && p.date <= "2025-11-30")} unit="点" event="2024-11-11" /> : <Empty text={data.equity?.warning ?? "等待真实市场历史，不使用模拟收益曲线。"} />}<div className={styles.threeCards}>{[20, 60, 120].map(n => { const study = eventStudy(data.equity?.points ?? [], "2024-11-11", n); return <div className={styles.eventMetric} key={n}><span>后 {n} 个交易观测</span><strong>{fmt(study?.change)}%</strong><small>期间最大回撤 {fmt(study?.drawdown)}%</small><small>{study ? `${study.start} → ${study.end}` : "历史样本不足"}</small></div> })}</div><p className={styles.subtle}>没有控制同期利率、房地产与盈利等因素，也没有样本外策略验证；这里不计算化债胜率。</p></section>
          <SectionTitle kicker="SCENARIO LAB" title="改变假设，看清收益和风险来自哪里"><Tag kind="amber">假设计算 · 不是预测</Tag></SectionTitle><div className={styles.assetGrid}>
            <section className={styles.panel}><h3><SlidersHorizontal size={18} /> 利息负担改善</h3><p>本金没有消失，减少的是一定期间的利息支出。</p>{[{ label: "实际置换本金（亿元）", value: principal, min: 100, max: 10000, step: 100, change: setPrincipal }, { label: "原年利率（%）", value: oldRate, min: 0, max: 12, step: 0.1, change: setOldRate }, { label: "新年利率（%）", value: newRate, min: 0, max: 8, step: 0.1, change: setNewRate }].map(x => <label className={styles.slider} key={x.label}><span>{x.label}<b>{fmt(x.value)}</b></span><input type="range" aria-label={x.label} min={x.min} max={x.max} step={x.step} value={x.value} onChange={e => x.change(Number(e.target.value))} /></label>)}<div className={styles.scenarioResult}><span>运行满一年 · 未计增量费用</span><strong>{fmt(interestSaving(principal, oldRate, newRate, 365))}<small> 亿元</small></strong></div><p className={styles.subtle}>当年实际节息还要按生效天数折算；不得把本金或多年累计节息当作当年新增需求。</p></section>
            <section className={styles.panel}><h3><TrendingUp size={18} /> 长债价格敏感性</h3><p>债务信用可靠，也可能发生明显净值回撤。</p><label className={styles.slider}><span>修正久期（年）<b>{duration}</b></span><input aria-label="修正久期" type="range" min="1" max="25" step="1" value={duration} onChange={e => setDuration(Number(e.target.value))} /></label><label className={styles.slider}><span>收益率变化（基点）<b>{rateShock > 0 ? "+" : ""}{rateShock}</b></span><input aria-label="收益率变化" type="range" min="-150" max="150" step="10" value={rateShock} onChange={e => setRateShock(Number(e.target.value))} /></label><div className={styles.scenarioResult}><span>价格变化一阶近似</span><strong className={rateShock > 0 ? styles.amber : styles.teal}>{fmt(-duration * rateShock / 100)}<small>%</small></strong></div><p className={styles.subtle}>ΔP/P ≈ −修正久期 × Δ收益率。未计凸性、票息、税费；大幅冲击时一阶近似误差增加。</p></section>
          </div>
        </>}
        {tab === "sources" && <>
          <SourceGuide />
          <SectionTitle kicker="DATA CONTRACT" title="数据从哪里来，什么时候才算新？"><Tag>{available}/{SERIES.length} 有效历史</Tag></SectionTitle><div className={styles.callout}><Database size={25} /><div><strong>统计期、发布日期和获取时间，不能混为一谈。</strong><p>当前接口未提供可靠发布日期时保留空值。展示最新修订历史，不宣称已经拥有历史时点版本库；本页面不是无前视偏差的量化回测。</p></div></div>
          <div className={styles.sourceGrid}>{SERIES.map(d => { const s = data[d.id]; return <article className={styles.panel} key={d.id}><div className={styles.panelHead}><h3>{d.name}</h3><Tag kind={s?.status === "ok" ? "teal" : "amber"}>{s?.status === "ok" ? "已获取" : s?.status === "partial" ? "历史待核对" : s ? "暂不可用" : "连接中"}</Tag></div><p>{d.origin}</p><dl><dt>历史区间</dt><dd>{s?.firstDate ?? "—"} → {s?.lastDate ?? "—"}</dd><dt>原始观测</dt><dd>{s?.points.length ?? 0} · {s?.complete ? "上游分页已遍历" : "未确认完整"}</dd><dt>获取时间</dt><dd>{dateTime(s?.fetchedAt)}</dd><dt>发布日期</dt><dd>{dateTime(s?.publishedAt)}</dd></dl>{s?.warning && <p className={styles.warning}>{s.warning}</p>}<p className={styles.subtle}>{d.caveat}</p><Out href={s?.sourceUrl ?? d.sourceUrl}>来源与口径</Out></article> })}</div>
          <SectionTitle kicker="RESEARCH METHODOLOGY" title="公式公开，阈值可解释" /><div className={styles.assetGrid}>{METHODS.map(m => <article key={m.title} className={styles.panel}><h3>{m.title}</h3><code className={styles.formula}>{m.formula}</code><p>{m.text}</p><Out href={m.url}>方法参考</Out></article>)}</div>
          <section className={styles.panel}><h3>尚未接入，不用代理变量冒充</h3><p>全国实际化债资金穿透流向、城投贷款合同与隐债明细、企业逐笔回款、REITs基金级估值、实时ETF申赎，目前不在已接通范围。政策目录用于发现公告，不自动推算执行金额。</p><p>东方财富和Yahoo的公开网页接口不提供可用性保证；公开展示与商业再分发需核对各来源授权。没有把API可访问等同于拥有再分发许可，也不声称获得研究机构认证。</p></section>
        </>}
        <footer className={styles.footer}><div><ShieldCheck size={15} /><strong>先理解，再决策。</strong><span>经济研究与教育用途，不构成个性化投资建议。不存在保证低风险翻倍的模型。</span></div><Out href="https://github.com/bridge-win/eatfear">eatfear / cn</Out></footer>
      </main>
    </div>
  </div>
}
