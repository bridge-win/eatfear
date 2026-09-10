"use client"

import { useEffect, useMemo, useState } from "react"

import { FactorMap } from "@/components/factor-map"
import { ForecastDetail } from "@/components/forecast-detail"
import { LiveBacktestPanel } from "@/components/live-backtest-panel"

import { DashboardFrame } from "@/components/page-frame"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { evidence, formatPct, type StrategyEvidence } from "@/lib/research-evidence"

type SortKey = "sharpe" | "total" | "windows"

function verdictTone(verdict: string[]): string {
  if (verdict.length === 1 && verdict[0] === "未被证伪") return "border-sky-500/40 bg-sky-500/10 text-sky-300"
  if (verdict.includes("样本外为负")) return "border-emerald-600/40 bg-emerald-600/10 text-emerald-300"
  return "border-amber-500/40 bg-amber-500/10 text-amber-300"
}

function num(v: number | null | undefined, digits = 2): string {
  return v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(digits)
}

function StrategyTable() {
  const [sort, setSort] = useState<SortKey>("sharpe")
  const [family, setFamily] = useState<string>("")
  const families = useMemo(() => [...new Set(evidence.strategies.map((s) => s.family))], [])

  const rows = useMemo(() => {
    const filtered = family ? evidence.strategies.filter((s) => s.family === family) : evidence.strategies
    const key = (s: StrategyEvidence) =>
      sort === "sharpe" ? s.oos.sharpe : sort === "total" ? s.oos.total : (s.robustness.walkForward.pct_windows ?? -1)
    return [...filtered].sort((a, b) => key(b) - key(a))
  }, [sort, family])

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">排序</span>
        {([["sharpe", "样本外夏普"], ["total", "样本外收益"], ["windows", "滚动前推正窗"]] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setSort(k)}
            className={`rounded-md border px-2 py-1 ${sort === k ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
        <span className="ml-2 text-muted-foreground">族</span>
        <select
          value={family}
          onChange={(e) => setFamily(e.target.value)}
          className="rounded-md border border-border bg-transparent px-2 py-1"
        >
          <option value="">全部</option>
          {families.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 text-left font-medium">策略</th>
              <th className="text-left font-medium">族</th>
              <th className="text-right font-medium">训练集</th>
              <th className="text-right font-medium">样本外</th>
              <th className="text-right font-medium">夏普</th>
              <th className="text-right font-medium">回撤</th>
              <th className="text-right font-medium">剔3笔后</th>
              <th className="text-right font-medium">滚动前推</th>
              <th className="text-left font-medium">判定</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const wf = s.robustness.walkForward
              return (
                <tr key={s.id} className="border-b border-border/40">
                  <td className="py-1.5 text-left">{s.name}</td>
                  <td className="text-left text-muted-foreground">{s.family}</td>
                  <td className="text-right tabular-nums text-muted-foreground">{formatPct(s.is_.total, 0)}</td>
                  <td className={`text-right tabular-nums ${s.oos.total > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {formatPct(s.oos.total)}
                  </td>
                  <td className="text-right tabular-nums">{num(s.oos.sharpe)}</td>
                  <td className="text-right tabular-nums">{formatPct(s.oos.maxdd, 0)}</td>
                  <td className="text-right tabular-nums">
                    {s.robustness.concentration ? formatPct(s.robustness.concentration.drop3) : "—"}
                  </td>
                  <td className="text-right tabular-nums">
                    {wf.n_windows ? `${wf.win_windows}/${wf.n_windows}` : "—"}
                  </td>
                  <td className="text-left">
                    <Badge variant="outline" className={`text-[10px] font-normal ${verdictTone(s.verdict)}`}>
                      {s.verdict.join("、")}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        三项检验:参数平面极差 &gt; 1.2 记「参数尖峰」;剔除最赚 3 笔由正转负记「靠少数几笔」;盈利年份不足一半记「年份不稳」;
        滚动前推正窗不过半单列。全部通过才记「未被证伪」——这仍<strong>不等于</strong>有效,没有任何一个策略的 Deflated Sharpe 达到 0.95。
      </p>
    </div>
  )
}

function CombosPanel() {
  const rows = evidence.combos.slice(0, 30)
  return (
    <div>
      <Card className="mb-3 border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed">
        <p>
          {evidence.summary.nCombos} 个跨镜头组合,样本外买入持有 {formatPct(evidence.summary.combosBuyHoldOos)},
          <strong> 跑赢的组合数:{evidence.summary.nCombosBeatBuyHold}</strong>。
          按训练集收益选出的前 10 名,样本外 {evidence.summary.selectionTest.top_is_oos_beat_bh}/10 跑赢基准,
          与样本外前 10 只重叠 {evidence.summary.selectionTest.overlap} 个——「按历史收益排序挑策略」这件事本身没有通过检验。
        </p>
      </Card>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 text-left font-medium">组合</th>
              <th className="text-right font-medium">样本外</th>
              <th className="text-right font-medium">插针压力下</th>
              <th className="text-right font-medium">夏普</th>
              <th className="text-right font-medium">换手</th>
              <th className="text-right font-medium">正窗</th>
              <th className="text-right font-medium">DSR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-border/40">
                <td className="py-1.5 text-left">{c.desc}</td>
                <td className={`text-right tabular-nums ${c.oos.total > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {formatPct(c.oos.total)}
                </td>
                <td className={`text-right tabular-nums ${c.oosStress.total > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {formatPct(c.oosStress.total)}
                </td>
                <td className="text-right tabular-nums">{num(c.oos.sharpe)}</td>
                <td className="text-right tabular-nums">{c.trades}</td>
                <td className="text-right tabular-nums">{(c.winPct * 100).toFixed(0)}%</td>
                <td className="text-right tabular-nums">{num(c.dsr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        插针压力 = 每次成交落在当日不利极值的 {(evidence.windows.combos.wickW * 100).toFixed(0)}% 处
        (BTC 日振幅中位约 3.9%,即每笔额外约 1%)。高换手组合在压力下大面积转负,存活者都是低换手。
      </p>
    </div>
  )
}

const TABS = ["strategies", "combos", "live", "forecast", "factors", "method"] as const
type Tab = (typeof TABS)[number]

export function ResearchWorkbench() {
  const [tab, setTab] = useState<Tab>("strategies")
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab")
    if (wanted && (TABS as readonly string[]).includes(wanted)) setTab(wanted as Tab)
  }, [])
  return (
    <DashboardFrame>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">研究工作台</h1>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          这一页不产生交易信号。它回答三个问题:我想用的信号历史上兑现过没有(证据库)、未来的合理区间有多宽(区间与检验)、这次波动是什么在推(传导图谱)。
          {evidence.summary.headline}。
          结论冻结自 {evidence.provenance.origin}({evidence.provenance.commit}),窗口
          {evidence.windows.strategies.train[0]}→{evidence.windows.strategies.train[1]} 选参、
          {evidence.windows.strategies.test[0]}→{evidence.windows.strategies.test[1]} 样本外。
        </p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="strategies">策略证据库</TabsTrigger>
          <TabsTrigger value="combos">组合研究</TabsTrigger>
          <TabsTrigger value="live">在线回测</TabsTrigger>
          <TabsTrigger value="forecast">未来区间与检验</TabsTrigger>
          <TabsTrigger value="factors">价格传导图谱</TabsTrigger>
          <TabsTrigger value="method">方法与边界</TabsTrigger>
        </TabsList>
        <TabsContent value="live" className="mt-4">
          <LiveBacktestPanel />
        </TabsContent>
        <TabsContent value="forecast" className="mt-4">
          <ForecastDetail />
        </TabsContent>
        <TabsContent value="factors" className="mt-4">
          <FactorMap />
        </TabsContent>
        <TabsContent value="strategies" className="mt-4">
          <StrategyTable />
        </TabsContent>
        <TabsContent value="combos" className="mt-4">
          <CombosPanel />
        </TabsContent>
        <TabsContent value="method" className="mt-4">
          <div className="max-w-3xl space-y-3 text-xs leading-relaxed">
            <p>
              <strong>为什么交付「证据」而不是「信号」。</strong>
              50 个策略里只有 {evidence.summary.nSurvivors} 个未被证伪,{evidence.summary.nBeatBuyHold} 个跑赢买入持有;
              57 个组合无一跑赢。样本外表现最好的那个策略,判定是「靠少数几笔」——剔掉最赚的 3 笔就归零。
              把排行榜第一名拿去用,是这套数据反复证伪过的做法。
            </p>
            <p>
              <strong>怎么用。</strong>先有想法,再来查:看到某个读数想动手时,回到这里查同类策略历史上兑现过没有。
              反过来在榜单上挑第一名去用,顺序就错了。
            </p>
            <p>
              <strong>已知边界。</strong>样本外只有一段窗口,单窗口结论有运气成分,所以每个策略同时给了滚动前推的正窗占比;
              成本只计手续费与滑点,未计资金费率与借币成本;组合研究额外做了插针压力,策略库没有;
              全部结论截至冻结时点,不随行情更新。
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardFrame>
  )
}
