import { NextResponse } from "next/server"
import { BASELINE, MOF_LISTS, parsePolicyList } from "@/lib/cn/research"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 15
export async function GET() {
  const outcomes = await Promise.allSettled(MOF_LISTS.map(async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(9000), redirect: "error", next: { revalidate: 900 } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > 2_000_000) throw new Error("响应过大")
    const utf = new TextDecoder().decode(bytes)
    const html = /charset\s*=\s*["']?gb/i.test(utf) ? new TextDecoder("gb18030").decode(bytes) : utf
    const items = parsePolicyList(html, url)
    if (!items.length) throw new Error("目录结构变化或没有匹配项")
    return items
  }))
  const items = outcomes.flatMap(r => r.status === "fulfilled" ? r.value : [])
  const unique = [...new Map([...items, ...BASELINE].map(p => [p.url, p])).values()].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
  return NextResponse.json({ items: unique, checkedAt: new Date().toISOString(), status: outcomes.every(r => r.status === "fulfilled") ? "ok" : "partial", liveCount: items.length, note: "只发现公开目录，不代表提前获知政策。历史基线与自动发现分别标注；目录未给日期时留空。" }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } })
}
