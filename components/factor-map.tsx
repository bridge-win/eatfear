"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import factorsJson from "@/public/research/factors.json"

interface FactorNode {
  id: string
  label: string
  level: number
  family: string
  mechanism: string
  evidence?: string
  coef?: {
    tier: "A" | "B" | "C"
    beta: number
    beta_down?: number
    beta_up?: number
    unit: string
    text: string
    derivation: string
    slider?: { label: string; unit: string; min: number; max: number; step: number; default: number }
    slider2?: { label: string; unit: string; min: number; max: number; step: number; default: number }
    choices?: [string, string, number][]
  }
}
interface FactorEdge { source: string; target: string; sign: "+" | "−" | "±"; strength: "strong" | "mid" | "weak" }
interface FactorLoop { id: string; name: string; polarity: string; mechanism: string; evidence: string }
interface FactorMap {
  nodes: FactorNode[]
  edges: FactorEdge[]
  loops: FactorLoop[]
  correlation: { groups: { name: string; members: string[]; rho: number; note: string }[]; method: string }
  presets?: Record<string, Record<string, number | string>>
  meta: { base_price: number; horizon: string; tiers: Record<string, string> }
}

const F = factorsJson as unknown as FactorMap
const SIGN_COLOR: Record<string, string> = { "+": "#e05d5d", "−": "#2fa37a", "±": "#9aa0ac" }
const FAMILY_COLOR: Record<string, string> = {
  宏观: "#5b8def", 资金: "#3fb0c4", 供给: "#d69a3a", 杠杆: "#9a6fd6", 情绪: "#e05d5d", 政策: "#8fa63a", 量: "#5d7fb0", 估值: "#c46fb0", 目标: "#e6e8ee",
}

const CARD_W = 136, CARD_H = 46, HGAP = 16, VGAP = 56

const byId = new Map(F.nodes.map((n) => [n.id, n]))
const parentOf = new Map(F.edges.map((e) => [e.source, e.target]))
const edgeOf = new Map(F.edges.map((e) => [e.source, e]))
const childrenOf = new Map<string, string[]>()
F.nodes.forEach((n) => childrenOf.set(n.id, []))
F.edges.forEach((e) => childrenOf.get(e.target)?.push(e.source))

interface Placed { id: string; depth: number; x: number; y: number; cx: number; w: number; h: number; open: boolean; nKids: number }

/** Tidy layered layout: each leaf owns a column slot, parents centre over children, root sits at the bottom. */
function layout(rootId: string, collapsed: Set<string>) {
  type T = { id: string; depth: number; kids: T[]; w: number; cx: number; open: boolean; nKids: number }
  let maxDepth = 0
  const build = (id: string, depth: number): T => {
    maxDepth = Math.max(maxDepth, depth)
    const all = childrenOf.get(id) ?? []
    const kids = collapsed.has(id) ? [] : all.map((k) => build(k, depth + 1))
    const w = kids.length ? Math.max(CARD_W + HGAP, kids.reduce((a, k) => a + k.w, 0)) : CARD_W + HGAP
    return { id, depth, kids, w, cx: 0, open: !collapsed.has(id), nKids: all.length }
  }
  const root = build(rootId, 0)
  const place = (n: T, x0: number) => {
    if (n.kids.length) {
      let x = x0 + (n.w - n.kids.reduce((a, k) => a + k.w, 0)) / 2
      n.kids.forEach((k) => { place(k, x); x += k.w })
      n.cx = (n.kids[0].cx + n.kids[n.kids.length - 1].cx) / 2
    } else n.cx = x0 + n.w / 2
  }
  place(root, 0)
  const pitch = CARD_H + VGAP
  const out: Placed[] = []
  const walk = (n: T) => {
    const isRoot = n.id === rootId
    const w = isRoot ? 150 : CARD_W, h = isRoot ? 52 : CARD_H
    out.push({ id: n.id, depth: n.depth, x: n.cx - w / 2, y: (maxDepth - n.depth) * pitch + 16, cx: n.cx, w, h, open: n.open, nKids: n.nKids })
    n.kids.forEach(walk)
  }
  walk(root)
  return { nodes: out, W: Math.ceil(root.w + 24), H: (maxDepth + 1) * pitch + 8 }
}

const defaultCollapsed = () => new Set(F.nodes.filter((n) => n.level >= 1 && (childrenOf.get(n.id)?.length ?? 0) > 0).map((n) => n.id))

export function FactorMap() {
  const [collapsed, setCollapsed] = useState<Set<string>>(defaultCollapsed)
  const [focus, setFocus] = useState<string | null>(null)
  const [selected, setSelected] = useState<string>("BTC")
  const [zoom, setZoom] = useState(1)
  const wrapRef = useRef<HTMLDivElement>(null)

  const rootId = focus ?? "BTC"
  const L = useMemo(() => layout(rootId, focus ? new Set() : collapsed), [rootId, focus, collapsed])
  const pos = useMemo(() => new Map(L.nodes.map((n) => [n.id, n])), [L])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const fit = (wrap.clientWidth - 8) / L.W
    setZoom(fit >= 0.75 ? Math.min(1, fit) : 1)
    wrap.scrollTop = wrap.scrollHeight
    wrap.scrollLeft = Math.max(0, (L.W * zoom - wrap.clientWidth) / 2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId, L.W])

  const toggle = (id: string) => {
    setSelected(id)
    if (focus || id === "BTC" || !(childrenOf.get(id)?.length)) return
    setCollapsed((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const sel = byId.get(selected)
  const directFactors = F.nodes.filter((n) => n.level === 1)

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <select value={focus ?? ""} onChange={(e) => { setFocus(e.target.value || null); setSelected(e.target.value || "BTC") }} className="rounded-md border border-border bg-transparent px-2 py-1">
          <option value="">全图 · 分层传导树</option>
          {directFactors.map((n) => <option key={n.id} value={n.id}>聚焦 · {n.label}</option>)}
        </select>
        <button type="button" onClick={() => setCollapsed(new Set())} className="rounded-md border border-border px-2 py-1">展开全部</button>
        <button type="button" onClick={() => setCollapsed(defaultCollapsed())} className="rounded-md border border-border px-2 py-1">收起到直接因素</button>
        <span className="mx-1 h-4 border-l border-border" />
        <button type="button" onClick={() => setZoom((z) => Math.max(0.3, z / 1.2))} className="rounded-md border border-border px-2 py-1">−</button>
        <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(2, z * 1.2))} className="rounded-md border border-border px-2 py-1">+</button>
        <button type="button" onClick={() => wrapRef.current && setZoom(Math.min(1, (wrapRef.current.clientWidth - 8) / L.W))} className="rounded-md border border-border px-2 py-1">适应宽度</button>
        <span className="ml-auto text-muted-foreground">上游在上、下游在下,箭头 = 传导方向 · <span style={{ color: SIGN_COLOR["+"] }}>━</span> 同向 <span style={{ color: SIGN_COLOR["−"] }}>━</span> 反向 <span style={{ color: SIGN_COLOR["±"] }}>┄</span> 视情况</span>
      </div>

      <div ref={wrapRef} className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-background/40">
        <div className="relative origin-top-left" style={{ width: L.W, height: L.H, zoom }}>
          <svg width={L.W} height={L.H} className="pointer-events-none absolute left-0 top-0">
            <defs>
              {(["+", "−", "±"] as const).map((s, i) => (
                <marker key={s} id={`fm-ar${i}`} markerWidth="8" markerHeight="8" refX="4" refY="7" orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M0,0 L8,0 L4,7 z" fill={SIGN_COLOR[s]} />
                </marker>
              ))}
            </defs>
            {L.nodes.filter((n) => n.id !== rootId).map((n) => {
              const P = pos.get(parentOf.get(n.id) ?? "")
              const e = edgeOf.get(n.id)
              if (!P || !e) return null
              const ci = e.sign === "+" ? 0 : e.sign === "−" ? 1 : 2
              const bus = P.y - VGAP / 2 + (ci === 0 ? -4 : ci === 1 ? 4 : 0)
              const width = e.strength === "strong" ? 2.2 : e.strength === "mid" ? 1.4 : 0.9
              return (
                <path key={n.id} d={`M${n.cx},${n.y + n.h} V${bus} H${P.cx} V${P.y - 1}`} fill="none" stroke={SIGN_COLOR[e.sign]} strokeWidth={width} strokeDasharray={e.sign === "±" ? "5 4" : undefined} opacity={0.9} markerEnd={`url(#fm-ar${ci})`} />
              )
            })}
          </svg>
          {L.nodes.map((n) => {
            const d = byId.get(n.id)!
            const isRoot = n.id === rootId
            const fam = FAMILY_COLOR[d.family] ?? "#6a7286"
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => toggle(n.id)}
                title={d.mechanism.slice(0, 140)}
                className={`absolute flex flex-col justify-center rounded-lg border px-2 py-1 text-left leading-tight shadow-sm ${isRoot ? "bg-foreground text-background font-bold" : "bg-card"} ${selected === n.id ? "ring-2 ring-amber-400" : ""}`}
                style={{ left: n.x, top: n.y, width: n.w, height: n.h, borderLeft: `4px solid ${isRoot ? "transparent" : fam}`, fontSize: isRoot ? 13 : 11 }}
              >
                {!isRoot && <span className="absolute -top-2 left-1.5 rounded px-1 text-[9px] text-white" style={{ background: fam }}>{["", "直接", "二级", "三级", "四级"][Math.min(d.level, 4)]}</span>}
                <span className="line-clamp-2">{d.label}</span>
                {n.nKids > 0 && !isRoot && <span className="absolute bottom-0.5 right-1.5 text-[9.5px] font-semibold text-primary">{focus ? n.nKids : `${n.open ? "▾" : "▸"} ${n.nKids}`}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {sel && <NodeDetail node={sel} />}
      {focus && <ChainList rootId={focus} onPick={setSelected} />}
      <ScenarioPanel />
      <LoopsAndCoefficients />
    </div>
  )
}

function NodeDetail({ node }: { node: FactorNode }) {
  const e = edgeOf.get(node.id)
  const parent = e ? byId.get(e.target) : undefined
  const kids = (childrenOf.get(node.id) ?? []).map((k) => ({ n: byId.get(k)!, e: edgeOf.get(k)! }))
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-1"><span className="font-semibold" style={{ color: FAMILY_COLOR[node.family] }}>{node.label}</span> <span className="text-muted-foreground">{["价格", "直接因素", "二级因素", "三级因素", "四级因素"][Math.min(node.level, 4)]} · {node.family}</span></div>
      <p><b>作用机制</b> {node.mechanism}</p>
      {node.evidence && <p className="mt-1"><b>证据</b> {node.evidence}</p>}
      {node.coef && (
        <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
          <p><b>系数</b> <span className="rounded border border-border px-1">档次 {node.coef.tier}</span> {node.coef.unit} → {node.coef.text}</p>
          <p className="mt-1 text-muted-foreground"><b>系数怎么来的</b> {node.coef.derivation}</p>
        </div>
      )}
      {parent && <p className="mt-1 text-muted-foreground">→ 作用于「{parent.label}」,<span style={{ color: SIGN_COLOR[e!.sign] }}>{e!.sign === "+" ? "同向" : e!.sign === "−" ? "反向" : "视情况"}</span></p>}
      {kids.length > 0 && <p className="mt-1 text-muted-foreground">← 上游:{kids.map(({ n, e }) => <span key={n.id} className="mr-2"><span style={{ color: SIGN_COLOR[e.sign] }}>{e.sign}</span> {n.label}</span>)}</p>}
    </div>
  )
}

function ChainList({ rootId, onPick }: { rootId: string; onPick: (id: string) => void }) {
  const leaves: string[] = []
  const rec = (id: string) => { const k = childrenOf.get(id) ?? []; if (!k.length) leaves.push(id); else k.forEach(rec) }
  rec(rootId)
  const root = byId.get(rootId)!
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2"><b>单因素传导分析 · {root.label}</b> <span className="text-muted-foreground">{leaves.length} 条完整链路,从最上游读到价格</span></p>
      {leaves.map((leaf) => {
        const path: string[] = []
        let x: string | undefined = leaf
        while (x) { path.push(x); if (x === "BTC") break; x = parentOf.get(x) }
        return (
          <div key={leaf} className="flex flex-wrap items-center gap-1 border-b border-dashed border-border/60 py-1.5 last:border-0">
            {path.map((id, i) => {
              const e = edgeOf.get(id)
              return (
                <span key={id} className="flex items-center gap-1">
                  <button type="button" onClick={() => onPick(id)} className="rounded bg-primary/10 px-1.5 py-0.5 hover:ring-1 hover:ring-primary">{byId.get(id)!.label}</button>
                  {i < path.length - 1 && e && <span style={{ color: SIGN_COLOR[e.sign] }}>{e.sign === "−" ? "─▶(反)" : e.sign === "±" ? "┄▶" : "─▶"}</span>}
                </span>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function ScenarioPanel() {
  const direct = F.nodes.filter((n) => n.level === 1 && n.coef)
  const init = () => {
    const s: Record<string, number | string> = {}
    for (const n of direct) { if (n.coef!.slider) s[n.id] = n.coef!.slider.default; if (n.coef!.slider2) s[n.id + "_L"] = n.coef!.slider2.default; if (n.coef!.choices) s[n.id] = n.coef!.choices[0][0] }
    return s
  }
  const [state, setState] = useState<Record<string, number | string>>(init)
  const [base, setBase] = useState<number>(F.meta.base_price)

  const result = useMemo(() => {
    const g = (id: string) => byId.get(id)!.coef!
    const e: Record<string, number> = {}
    const v = state
    e.D1 = ((v.D1 as number) / 100) * ((v.D1 as number) < 0 ? g("D1").beta_down! : g("D1").beta_up!)
    e.D2 = (v.D2 as number) * g("D2").beta / 100
    e.D3 = (v.D3 as number) * g("D3").beta / 1000
    e.D4 = (v.D4 as number) * g("D4").beta / 100
    e.D5 = -0.00025 * ((v.D5 as number) - 10) + ((v.D5 as number) < -10 ? 0.025 : 0)
    e.D6 = (v.D6 as number) * g("D6").beta / 100
    e.D7 = g("D7").choices!.find((c) => c[0] === v.D7)?.[2] ?? 0
    e.D8 = g("D8").choices!.find((c) => c[0] === v.D8)?.[2] ?? 0
    e.D9 = byId.has("D9") ? ((((v.D9 as number) ?? 0.52) - 0.52) / 0.1) * g("D9").beta / 12 : 0
    // Correlation haircut: macro, ETF flow, stablecoins and sentiment mostly measure one
    // thing (global risk appetite); adding them as independent factors overstates extremes.
    const grp = F.correlation.groups[0]
    const damp: Record<string, number> = {}
    for (const sgn of [1, -1]) {
      const act = grp.members.filter((m) => Math.sign(e[m] ?? 0) === sgn && e[m] !== 0)
      if (act.length > 1) act.forEach((m) => (damp[m] = 1 / (1 + grp.rho * (act.length - 1))))
    }
    const L = (v.D5_L as number) ?? 1
    let logp = 0
    const contrib: Record<string, number> = {}
    for (const k in e) { const d = damp[k] ?? 1; const lev = k === "D5" || k === "D8" || k === "D9" ? 1 : L; contrib[k] = lev * e[k] * d; logp += lev * Math.log(1 + e[k] * d) }
    return { price: base * Math.exp(logp), contrib, damped: Object.keys(damp).length > 0, L }
  }, [state, base])

  const names: Record<string, string> = { D1: "宏观/纳指", D2: "ETF流入", D3: "稳定币", D4: "供给净卖", D5: "资金费率", D6: "情绪", D7: "政策事件", D8: "量能", D9: "周期估值" }
  const chg = result.price / base - 1

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <b>情景推演</b>
        <span className="text-muted-foreground">拖动直接因素,看约 {F.meta.horizon} 的价格含义。这是把方向与数量级变成直觉的工具,不是预测——检验证明按状态条件化分布在样本外更差。</span>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_260px]">
        <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          <label className="text-muted-foreground">基准价 $ <input type="number" value={base} step={500} onChange={(ev) => setBase(Number(ev.target.value) || F.meta.base_price)} className="w-24 rounded border border-border bg-transparent px-1" /></label>
          {F.presets && <label className="text-muted-foreground">预设 <select onChange={(ev) => { const p = F.presets![ev.target.value]; setState({ ...init(), ...(p ?? {}) }) }} className="rounded border border-border bg-transparent px-1"><option value="">—</option>{Object.keys(F.presets).map((k) => <option key={k} value={k}>{k}</option>)}</select></label>}
          {direct.map((n) => {
            const c = n.coef!
            return (
              <div key={n.id} className="contents">
                {c.slider && (
                  <div>
                    <div className="flex justify-between"><span>{c.slider.label}</span><b className="tabular-nums">{state[n.id]}{c.slider.unit}</b></div>
                    <input type="range" min={c.slider.min} max={c.slider.max} step={c.slider.step} value={state[n.id] as number} onChange={(ev) => setState({ ...state, [n.id]: Number(ev.target.value) })} className="w-full accent-primary" />
                  </div>
                )}
                {c.slider2 && (
                  <div>
                    <div className="flex justify-between"><span>{c.slider2.label}</span><b className="tabular-nums">{state[n.id + "_L"]}{c.slider2.unit}</b></div>
                    <input type="range" min={c.slider2.min} max={c.slider2.max} step={c.slider2.step} value={state[n.id + "_L"] as number} onChange={(ev) => setState({ ...state, [n.id + "_L"]: Number(ev.target.value) })} className="w-full accent-primary" />
                  </div>
                )}
                {c.choices && (
                  <div>
                    <div>{n.label}</div>
                    <select value={state[n.id] as string} onChange={(ev) => setState({ ...state, [n.id]: ev.target.value })} className="w-full rounded border border-border bg-transparent px-1">
                      {c.choices.map((ch) => <option key={ch[0]} value={ch[0]}>{ch[1]} ({(ch[2] * 100).toFixed(0)}%)</option>)}
                    </select>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div>
          <div className="text-muted-foreground">推演价格(不是预测)</div>
          <div className="text-2xl font-bold tabular-nums">${Math.round(result.price).toLocaleString()}</div>
          <div className={chg > 0 ? "text-rose-400" : chg < 0 ? "text-emerald-400" : ""}>{chg > 0 ? "+" : ""}{(chg * 100).toFixed(1)}% vs 基准 · 杠杆 {result.L.toFixed(1)}×</div>
          {result.damped && <div className="mt-1 text-[11px] text-amber-400">已施加相关性折减(风险偏好簇同向)</div>}
          <div className="mt-2 space-y-1">
            {Object.entries(result.contrib).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-[11px]">
                <span className="w-16 text-muted-foreground">{names[k]}</span>
                <div className="h-2 flex-1 rounded bg-muted"><div className="h-2 rounded" style={{ width: `${Math.min(100, Math.abs(v) * 300)}%`, background: v > 0 ? SIGN_COLOR["+"] : v < 0 ? SIGN_COLOR["−"] : "#9aa0ac" }} /></div>
                <span className="w-12 text-right tabular-nums">{v ? `${(v * 100).toFixed(1)}%` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function LoopsAndCoefficients() {
  const direct = F.nodes.filter((n) => n.level === 1 && n.coef)
  return (
    <div className="space-y-3">
      <div>
        <h3 className="mb-1 text-sm font-semibold">反馈回路(图中被截断的循环)</h3>
        <p className="mb-2 text-muted-foreground">树是单向的,真实系统有循环。这些回路解释了为什么冲击会自我放大或自我熄灭。</p>
        {F.loops.map((l) => (
          <div key={l.id} className="mb-2 rounded-lg border border-border p-2" style={{ borderLeft: `4px solid ${l.polarity.includes("正") ? SIGN_COLOR["+"] : SIGN_COLOR["−"]}` }}>
            <p><b>{l.name}</b> <span className="rounded border border-border px-1 text-[10px]">{l.polarity}</span></p>
            <p className="mt-1">{l.mechanism}</p>
            <p className="mt-1 text-muted-foreground"><b>证据</b> {l.evidence}</p>
          </div>
        ))}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2"><b>因素相关性折减</b> {F.correlation.groups[0].note} 处理:{F.correlation.method}(ρ={F.correlation.groups[0].rho})。</div>
      </div>
      <div>
        <h3 className="mb-1 text-sm font-semibold">直接因素的系数、档次与推导</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-muted-foreground"><tr className="border-b border-border"><th className="py-1 text-left font-medium">因素</th><th className="text-left font-medium">方向</th><th className="text-left font-medium">系数</th><th className="font-medium">档</th><th className="text-left font-medium">推导</th></tr></thead>
            <tbody>
              {direct.map((n) => {
                const e = edgeOf.get(n.id)!
                return (
                  <tr key={n.id} className="border-b border-border/40 align-top">
                    <td className="py-1.5 font-medium">{n.label}</td>
                    <td style={{ color: SIGN_COLOR[e.sign] }}>{e.sign}</td>
                    <td className="max-w-[26em] whitespace-normal">{n.coef!.unit} → {n.coef!.text}</td>
                    <td className="text-center"><span className="rounded border border-border px-1">{n.coef!.tier}</span></td>
                    <td className="max-w-[34em] whitespace-normal text-muted-foreground">{n.coef!.derivation}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-muted-foreground">档次:<b>A</b> {F.meta.tiers.A};<b>B</b> {F.meta.tiers.B};<b>C</b> {F.meta.tiers.C}。</p>
      </div>
    </div>
  )
}
