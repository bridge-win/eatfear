import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises"
import { join, resolve } from "node:path"
import { collectMarket, pool } from "../lib/cn/market-providers.ts"
import { encodeSnapshot, validateManifest, identifySnapshot } from "../lib/cn/snapshot-codec.ts"
import { SERIES } from "../lib/cn/catalog.ts"
import { getSeries } from "../lib/cn/providers.ts"
import type { CollectionHealth, MarketSnapshot, SnapshotManifest } from "../lib/cn/market-types.ts"

async function main() {
const args = process.argv.slice(2), output = resolve(args[args.indexOf("--output") + 1] && args.includes("--output") ? args[args.indexOf("--output") + 1] : "artifacts/cn-market-data")
const seed = args.includes("--seed"), attemptedAt = new Date().toISOString()
const runUrl = process.env.GITHUB_RUN_ID ? `https://github.com/bridge-win/eatfear/actions/runs/${process.env.GITHUB_RUN_ID}` : null
await mkdir(join(output, "snapshots"), { recursive: true })
let old: SnapshotManifest | undefined
try { const input = JSON.parse(await readFile(join(output, "manifest.json"), "utf8")); validateManifest(input); old = input } catch {}
try {
  console.log("采集沪深北名录、日终估值与统一报告期财务…")
  const collected = await collectMarket()
  const macro = Object.fromEntries(await pool(SERIES, async d => [d.id, await getSeries(d.id)] as const, 3))
  const macroFailures = SERIES.filter(d => !macro[d.id]?.points.length).map(d => d.name)
  const content = { ...collected, macro, warnings: [...collected.warnings, ...(macroFailures.length ? [`宏观数据缺失：${macroFailures.join("、")}`] : [])] }
  // Stable values determine identity; changing fetch timestamps alone must not duplicate a trading day.
  const snapshot: MarketSnapshot = { ...content, snapshotId: identifySnapshot(content) }
  const previous = old?.snapshots.find(e => e.snapshotId === old!.current)
  if (previous && snapshot.coverage.valuation < 4000) throw new Error("估值覆盖异常")
  const existing = old?.snapshots.find(e => e.snapshotId === snapshot.snapshotId)
  if (!existing) {
    const { bytes, entry } = encodeSnapshot(snapshot)
    await writeFile(join(output, entry.file), bytes)
    const manifest: SnapshotManifest = { schemaVersion: 1, current: snapshot.snapshotId, snapshots: [entry, ...(old?.snapshots ?? []).filter(e => e.snapshotId !== entry.snapshotId)].slice(0, 7) }
    validateManifest(manifest)
    await writeFile(join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")
    const keep = new Set(manifest.snapshots.map(e => e.file.split("/").at(-1)))
    for (const name of await readdir(join(output, "snapshots"))) if (/^cn-\d{8}-[a-f0-9]{12}\.json\.gz$/.test(name) && !keep.has(name)) await unlink(join(output, "snapshots", name))
    if (seed) { await mkdir("public/cn", { recursive: true }); await writeFile("public/cn/market-seed.json.gz", bytes) }
    console.log(JSON.stringify({ snapshotId: snapshot.snapshotId, tradeDate: snapshot.tradeDate, reportDate: snapshot.reportDate, coverage: snapshot.coverage, compressedBytes: bytes.length, sources: snapshot.sources.map(s => ({ id: s.id, status: s.status, count: s.count })) }, null, 2))
  } else {
    if (seed) await writeFile("public/cn/market-seed.json.gz", new Uint8Array(await readFile(join(output, existing.file))))
    console.log(JSON.stringify({ unchanged: true, snapshotId: existing.snapshotId }))
  }
  const h: CollectionHealth = { lastAttemptAt: attemptedAt, lastSuccessAt: new Date().toISOString(), status: "ok", errors: [], runUrl }
  await writeFile(join(output, "health.json"), JSON.stringify(h, null, 2) + "\n")
} catch (error) {
  const h: CollectionHealth = { lastAttemptAt: attemptedAt, lastSuccessAt: old?.snapshots.find(e => e.snapshotId === old.current)?.fetchedAt ?? null, status: "failed", errors: [error instanceof Error ? error.message : "采集失败"], runUrl }
  await writeFile(join(output, "health.json"), JSON.stringify(h, null, 2) + "\n")
  console.error(h.errors[0]); process.exitCode = 1
}
}
main().catch(error => { console.error(error instanceof Error ? error.message : "采集启动失败"); process.exitCode = 1 })
