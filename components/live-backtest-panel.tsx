"use client"

import { useState } from "react"

import carryJson from "@/public/research/carry-evidence.json"
import { jsonFetcher, usePersistentSWR } from "@/lib/client-persistence"
import { formatPct } from "@/lib/research-evidence"

interface Stats { total: number; cagr: number; sharpe: number; maxdd: number; trades: number; win: number; pf: number; exposure: number }
interface Payload {
  rule: { id: string; name: string; family: string; gridSize: number }
  window: { train: [string, string]; test: [string, string] }
  costs: { fee: number; slippage: number; wickWeight: number }
  params: Record<string, number | boolean>
  is: Stats; oos: Stats
  plane: { params: Record<string, number | boolean>; oosSharpe: number; oosTotal: number }[]
  planeSpread: number
  concentration: { all: number; drop1: number; drop3: number; n: number }
  yearly: Record<string, number>
  walkForward: { nWindows: number; winWindows: number; pctWindows: number; paramSwitches: number; sharpe: number; windows: { trainEnd: string; testEnd: string; params: Record<string, number | boolean>; total: number }[] }
  verdict: string[]
  benchmark: { is: Stats; oos: Stats }
  rules: { id: string; name: string; family: string; gridSize: number }[]
}
const CARRY = carryJson as { windows: { train: string; test: string }; model: string; dataNote: string; train: { apr: number }; test: { apr: number; maxdd: number }; testFiltered: { apr: number; note: string }; yearly: Record<string, { apr: number; gross: number }>; verdict: string }
const RULE_OPTIONS = [["faber_ma", "Faber 长均线择时"], ["sma_cross", "双均线交叉"], ["donchian", "唐奇安通道"], ["tsmom", "时间序列动量"], ["rsi2_mr", "RSI(2) 均值回归"], ["bollinger_mr", "布林带回归"]] as const
const fmtParams = (p: Record<string, number | boolean>) => Object.entries(p).map(([k, v]) => `${k}=${v}`).join(" ")

export function LiveBacktestPanel() {
  const [rule, setRule] = useState<string>("faber_ma")
  const [testStart, setTestStart] = useState("2024-01-01")
  const [stress, setStress] = useState(false)
  const key = `/api/crypto/research-backtest?ccy=BTC&rule=${rule}&testStart=${testStart}&stress=${stress ? 1 : 0}`
  const { data, error, isLoading } = usePersistentSWR<Payload>(`research-backtest:${key}`, key, jsonFetcher, { revalidateOnFocus: false })

  return (
    <div className="space-y-5 text-xs">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 leading-relaxed">
        <p><b>在线回测</b> 用 OKX 日线实时跑一条经典规则。参数只在训练窗上选、样本外只评估;附参数平面、集中度、滚动前推与判定——和证据库同一套纪律。</p>
        <p className="mt-1 text-muted-foreground">只开放六条可解释规则,网格取文献默认值。五十条规则随点随跑只会让过拟合更快,不会让结论更好。</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label>规则 <select value={rule} onChange={(e) => setRule(e.target.value)} className="rounded border border-border bg-transparent px-2 py-1">{RULE_OPTIONS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label>样本外起点 <input type="date" value={testStart} min="2020-01-01" max="2026-06-01" onChange={(e) => setTestStart(e.target.value)} className="rounded border border-border bg-transparent px-2 py-1" /></label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={stress} onChange={(e) => setStress(e.target.checked)} /> 插针压力(成交落在不利极值 50% 处)</label>
      </div>

      {error ? <p className="text-muted-foreground">不可用:{String(error.message ?? error)}</p> : isLoading || !data ? <p className="text-muted-foreground">拉取日线并回测中…</p> : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Stat title="训练集(已选参)" s={data.is} bench={data.benchmark.is} />
            <Stat title="样本外(参数冻结)" s={data.oos} bench={data.benchmark.oos} highlight />
            <div className="rounded-lg border border-border p-3">
              <div className="text-muted-foreground">冻结参数 <b className="text-foreground">{fmtParams(data.params)}</b>(网格 {data.rule.gridSize} 组)</div>
              <div className="mt-1">判定:{data.verdict.map((v) => <span key={v} className={`mr-1 rounded border px-1 ${v === "未被证伪" ? "border-sky-500/40 text-sky-300" : "border-amber-500/40 text-amber-300"}`}>{v}</span>)}</div>
              <div className="mt-1 text-muted-foreground">参数极差 {data.planeSpread.toFixed(2)} · 剔 3 笔后 {formatPct(data.concentration.drop3)} · 滚动前推 {data.walkForward.winWindows}/{data.walkForward.nWindows} 窗为正,换参 {data.walkForward.paramSwitches} 次</div>
              <div className="mt-1 text-muted-foreground">窗口 {data.window.train[0]}→{data.window.train[1]} 选参,{data.window.test[0]}→{data.window.test[1]} 样本外;成本 {(data.costs.fee * 1e4).toFixed(0)}+{(data.costs.slippage * 1e4).toFixed(0)}bp{data.costs.wickWeight ? ",插针压力" : ""}</div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 font-medium">参数平面(样本外夏普,诊断用,未参与选参)</div>
              <table className="w-full"><tbody>{data.plane.map((p) => (
                <tr key={fmtParams(p.params)} className={`border-b border-border/40 ${fmtParams(p.params) === fmtParams(data.params) ? "font-semibold" : ""}`}><td className="py-0.5">{fmtParams(p.params)}</td><td className={`text-right tabular-nums ${p.oosSharpe > 0 ? "text-rose-400" : "text-emerald-400"}`}>{p.oosSharpe.toFixed(2)}</td><td className="text-right tabular-nums text-muted-foreground">{formatPct(p.oosTotal)}</td></tr>
              ))}</tbody></table>
            </div>
            <div>
              <div className="mb-1 font-medium">滚动前推(每窗独立重选参数)</div>
              <table className="w-full"><tbody>{data.walkForward.windows.map((w) => (
                <tr key={w.testEnd} className="border-b border-border/40"><td className="py-0.5">{w.trainEnd} → {w.testEnd}</td><td className="text-muted-foreground">{fmtParams(w.params)}</td><td className={`text-right tabular-nums ${w.total > 0 ? "text-rose-400" : "text-emerald-400"}`}>{formatPct(w.total)}</td></tr>
              ))}</tbody></table>
            </div>
          </div>
        </>
      )}

      <section className="rounded-lg border border-border p-3">
        <h3 className="mb-1 text-sm font-semibold">资金费率套利研究(冻结)</h3>
        <p className="text-muted-foreground">{CARRY.model}。{CARRY.dataNote}。</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <div className="rounded border border-border p-2">训练 {CARRY.windows.train}<br /><b className="tabular-nums">{formatPct(CARRY.train.apr)}</b> 年化</div>
          <div className="rounded border border-border p-2">样本外 {CARRY.windows.test}<br /><b className="tabular-nums">{formatPct(CARRY.test.apr)}</b> 年化 · 回撤 {formatPct(CARRY.test.maxdd)}</div>
          <div className="rounded border border-border p-2">加择时滤波<br /><b className="tabular-nums">{formatPct(CARRY.testFiltered.apr)}</b> · {CARRY.testFiltered.note}</div>
          <div className="rounded border border-border p-2">分年度<br />{Object.entries(CARRY.yearly).map(([y, v]) => <span key={y} className="mr-1 tabular-nums">{y} {formatPct(v.apr)}</span>)}</div>
        </div>
        <p className="mt-2"><b>结论</b> {CARRY.verdict}。</p>
      </section>
    </div>
  )
}

function Stat({ title, s, bench, highlight }: { title: string; s: Stats; bench: Stats; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-amber-500/40 bg-amber-500/5" : "border-border"}`}>
      <div className="font-medium">{title}</div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums">
        <span className="text-muted-foreground">收益</span><span className={s.total > 0 ? "text-rose-400" : "text-emerald-400"}>{formatPct(s.total)}</span>
        <span className="text-muted-foreground">买入持有</span><span>{formatPct(bench.total)}</span>
        <span className="text-muted-foreground">夏普</span><span>{s.sharpe.toFixed(2)}</span>
        <span className="text-muted-foreground">回撤</span><span>{formatPct(s.maxdd, 0)}</span>
        <span className="text-muted-foreground">笔数 / 胜率</span><span>{s.trades} / {(s.win * 100).toFixed(0)}%</span>
        <span className="text-muted-foreground">PF / 暴露</span><span>{s.pf.toFixed(2)} / {(s.exposure * 100).toFixed(0)}%</span>
      </div>
    </div>
  )
}
