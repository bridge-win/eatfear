import { mkdir, readFile, writeFile } from "node:fs/promises"
import { ARCHIVES, officialHtml, parseMofArticle, type MofRecord } from "../lib/cn/mof.ts"
import { parsePolicyList, type Policy } from "../lib/cn/research.ts"
const file = "public/cn/mof-history.json"
const old = JSON.parse(await readFile(file, "utf8"))
const records = new Map<string, MofRecord>((old.records ?? []).map((r: MofRecord) => [r.date, r]))
const candidates = new Map<string, Policy>()
const errors: string[] = []
for (const base of ARCHIVES) {
  const signatures = new Set<string>()
  for (let page = 0; page < 30; page++) {
    const url = page === 0 ? base : `${base}index_${page}.htm`
    let html: string
    try { html = await officialHtml(url) } catch (e) {
      if (page > 0 && String(e).includes("404")) break
      errors.push(`${url}: ${String(e)}`); break
    }
    const items = parsePolicyList(html, base).filter(p => /\d{4}年\d{1,2}月地方政府债券发行/.test(p.title))
    const signature = items.map(p => p.url).join("|")
    if (!items.length) { if (page === 0) errors.push(`${url}: no monthly disclosures`); break }
    if (signatures.has(signature)) { errors.push(`${url}: repeated page`); break }
    signatures.add(signature)
    for (const p of items) if (Number(p.title.match(/\d{4}/)?.[0]) >= 2015) candidates.set(p.url, p)
    if (items.some(p => Number(p.title.match(/\d{4}/)?.[0]) < 2015)) break
    const count = /createPageHTML\(\s*(\d+)/i.exec(html)
    if (count && page + 1 >= Number(count[1])) break
    if (page === 29) errors.push(`${base}: pagination limit reached`)
  }
}
const queue = [...candidates.values()]
let index = 0
await Promise.all(Array.from({ length: 3 }, async () => {
  while (index < queue.length) {
    const p = queue[index++]
    try {
      const html = await officialHtml(p.url)
      const r = parseMofArticle(html, p.title, p.url)
      if (!r) throw new Error("unrecognized amounts or reconciliation failure")
      const previous = records.get(r.date)
      if (!previous || (r.publishedAt ?? "") >= (previous.publishedAt ?? "")) records.set(r.date, r)
    } catch (e) { errors.push(`${p.url}: ${String(e)}`) }
  }
}))
const output = { collectedAt: new Date().toISOString(), startYear: 2015, records: [...records.values()].sort((a, b) => a.date.localeCompare(b.date)), errors, documents: candidates.size }
await mkdir("public/cn", { recursive: true })
await writeFile(file, JSON.stringify(output, null, 2) + "\n")
console.log(JSON.stringify({ ...output, records: `${output.records.length} months`, errors: errors.slice(0, 8) }, null, 2))
if (!output.records.length) process.exitCode = 1
