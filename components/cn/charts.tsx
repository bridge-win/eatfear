"use client"
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { Point } from "@/lib/cn/catalog"
export function HistoryChart({ points, unit, reference, event }: { points: Point[]; unit: string; reference?: number; event?: string }) {
  const monthly = points.length > 1800
  const display = monthly ? [...new Map(points.map(p => [p.date.slice(0, 7), p])).values()] : points
  const marker = event ? display.find(p => p.date >= event)?.date : undefined
  return <div>
    <div style={{ width: "100%", height: 300 }} role="img" aria-label={`历史趋势图，单位${unit}，${points.length}个原始观测；完整数据可通过CSV下载`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={display} margin={{ top: 14, right: 12, bottom: 0, left: -16 }}>
          <defs><linearGradient id="cn-series-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#36cbb5" stopOpacity={0.24} /><stop offset="100%" stopColor="#36cbb5" stopOpacity={0.01} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="var(--cn-line)" strokeDasharray="3 5" />
          <XAxis dataKey="date" tickFormatter={v => String(v).slice(0, 7)} minTickGap={45} axisLine={false} tickLine={false} tick={{ fill: "var(--cn-muted)", fontSize: 11 }} dy={9} />
          <YAxis domain={["auto", "auto"]} tickFormatter={v => Number(v).toLocaleString("zh-CN", { maximumFractionDigits: 1 })} tick={{ fill: "var(--cn-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={65} />
          <Tooltip contentStyle={{ background: "var(--cn-panel)", border: "1px solid var(--cn-line)", borderRadius: 12, color: "var(--cn-text)", fontSize: 12 }} labelStyle={{ color: "var(--cn-muted)", marginBottom: 6 }} formatter={(value: unknown) => [`${Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 3 })} ${unit}`, "观测值"]} />
          {reference !== undefined && <ReferenceLine y={reference} stroke="#d9a45e" strokeDasharray="5 5" label={{ value: `参考 ${reference}`, fill: "var(--cn-muted)", fontSize: 11, position: "insideTopRight" }} />}
          {marker && <ReferenceLine x={marker} stroke="#d9a45e" strokeDasharray="4 4" label={{ value: "政策观察起点", fill: "var(--cn-muted)", fontSize: 10 }} />}
          <Area type="linear" dataKey="value" stroke="var(--cn-teal)" strokeWidth={2} fill="url(#cn-series-fill)" isAnimationActive={false} connectNulls={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
    {monthly && <p style={{ fontSize: 11, color: "var(--cn-muted)" }}>长区间图表按每月最后一个观测展示；统计计算与CSV仍使用完整日频历史。</p>}
  </div>
}
export function Sparkline({ points }: { points: Point[] }) {
  const values = points.slice(-36).map(p => p.value)
  if (values.length < 2) return <span>—</span>
  const min = Math.min(...values), max = Math.max(...values)
  const path = values.map((v, i) => `${i ? "L" : "M"}${(i / (values.length - 1) * 96).toFixed(1)},${(26 - (v - min) / (max - min || 1) * 22).toFixed(1)}`).join(" ")
  return <svg width="96" height="30" viewBox="0 0 100 30" aria-hidden="true"><path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
}
