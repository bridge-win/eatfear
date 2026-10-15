import { mkdir, writeFile } from "node:fs/promises"
import { SERIES } from "../lib/cn/catalog.ts"
import { getSeries } from "../lib/cn/providers.ts"
import { rangePoints } from "../lib/cn/metrics.ts"
async function main() {
  const results = await Promise.all(SERIES.map(async d => {
    const started = Date.now()
    const s = await getSeries(d.id)
    return { id: d.id, name: d.name, provider: d.provider, status: s.status, points: s.points.length, first: s.firstDate, last: s.lastDate, latest: s.points.at(-1)?.value ?? null, milliseconds: Date.now() - started, warning: s.warning, complete: s.complete, sourceUrl: s.sourceUrl, fetchedAt: s.fetchedAt, windows: Object.fromEntries([1, 5, 10, null].map(y => { const p = rangePoints(s.points, y); return [y ?? "max", { first: p[0]?.date ?? null, count: p.length }] })) }
  }))
  await mkdir("docs", { recursive: true })
  await writeFile("docs/cn-provider-verification.json", JSON.stringify({ checkedAt: new Date().toISOString(), environment: "GitHub Actions or operator runtime; source availability is location-dependent", results }, null, 2) + "\n")
  console.log(JSON.stringify(results, null, 2))
  const monthly = results.filter(r => r.provider === "eastmoney" && r.points >= 24).length
  const official = results.filter(r => ["mof", "worldbank"].includes(r.provider) && r.points > 0).length
  if (monthly < 5 || official < 2) process.exitCode = 1
}
main().catch(error => { console.error(error); process.exitCode = 1 })
