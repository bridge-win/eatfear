"use client"
import useSWR from "swr"
import { useEffect } from "react"
import { ExternalLink } from "lucide-react"
import type { CnSecurity } from "@/lib/cn/security-catalog"
import type { CnFundamentalsResponse } from "@/lib/cn/fundamentals"
import s from "./research-workspace.module.css"

const amount = (value: number | null) => value === null || !Number.isFinite(value) ? "—" : (value / 1e8).toLocaleString("zh-CN", { maximumFractionDigits: 2 })
const pct = (value: number | null) => value === null || !Number.isFinite(value) ? "—" : `${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}%`
async function fetchFundamentals(url: string): Promise<CnFundamentalsResponse> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`财报接口 HTTP ${response.status}`)
  return response.json()
}
export default function FundamentalsPanel({ security, onData }: { security: CnSecurity; onData: (data: CnFundamentalsResponse) => void }) {
  const { data, error, isLoading } = useSWR<CnFundamentalsResponse>(security.kind === "stock" ? `/api/cn/fundamentals?id=${security.id}` : null, fetchFundamentals, { revalidateOnFocus: false, errorRetryCount: 1, dedupingInterval: 300000 })
  useEffect(() => { if (data) onData(data) }, [data, onData])
  if (security.kind !== "stock") return null
  return <section className={s.lab}>
    <div className={s.heading}><div><span className={s.eyebrow}>BUSINESS EVIDENCE / 财报验证</span><h3>增长有没有变成利润和现金</h3><p>利润表与现金流量表采用年初至报告期末累计值；资产负债表采用期末值。仅比较上年同一报告期。</p></div><span className={s.badge}>{isLoading ? "获取中" : data?.status === "ok" ? "三表同报告期" : "披露待补齐"}</span></div>
    {isLoading ? <p role="status">正在读取已披露财务报表…</p> : error || !data || data.status === "unavailable" ? <p className={s.warning}>当前财报数据暂不可用。请通过官方公司资料核对，缺失数值不填0。</p> : <>
      <p className={s.dataStatus}>报告期 {data.reportDate ?? "未提供"} · 对比期 {data.comparisonDate ?? "未提供"} · {data.periodLabel} · 金额单位：亿元</p>
      <div className={s.tableScroll}><table className={s.table}><caption>财报来源：{data.source}。数据由第三方整理，重要结论请核对原始财报。</caption><thead><tr><th>财务指标</th><th>本期（亿元）</th><th>上年同期（亿元）</th><th>变化额（亿元）</th><th>同比</th><th>口径与解释</th></tr></thead><tbody>{data.metrics.map(metric => <tr key={metric.id}><td>{metric.label}<small style={{ display: "block" }}>{metric.basis === "period-end" ? "期末存量" : "年初至今累计"}</small></td><td>{amount(metric.current)}</td><td>{amount(metric.previous)}</td><td>{amount(metric.change)}</td><td>{pct(metric.yoyPercent)}</td><td style={{ maxWidth: 300, minWidth: 200, fontSize: 11, color: "var(--cn-muted)" }}>{metric.note}</td></tr>)}</tbody></table></div>
      <p className={s.explanation}>{data.bank ? "银行经营现金流包含贷款、存款等金融业务变动，不能直接套用工业企业的现金转化率；请结合净息差、资产质量及资本充足率。" : "利润与现金流背离时，进一步查应收账龄、存货、预付款与非经常损益；应收下降也可能来自核销或保理。"} 负数或零基数不展示易误导的同比百分比，改看变化额。</p>
      <p className={s.dataStatus}>披露日期：利润表 {data.publicationDates.income ?? "未提供"} / 资产负债表 {data.publicationDates.balance ?? "未提供"} / 现金流量表 {data.publicationDates.cashflow ?? "未提供"}。获取时间 {data.fetchedAt ? new Date(data.fetchedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) : "未提供"}。</p>
      {data.warnings.map(warning => <p key={warning} className={s.warning}>{warning}</p>)}
      <div className={s.links}><a href={data.sourceUrl} target="_blank" rel="noopener noreferrer">查看财务数据来源<ExternalLink size={12} /></a><a href={data.officialUrl} target="_blank" rel="noopener noreferrer">核对公司正式披露<ExternalLink size={12} /></a></div>
    </>}
  </section>
}
