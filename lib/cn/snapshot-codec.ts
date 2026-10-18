import { createHash } from "node:crypto"
import { gzipSync, gunzipSync } from "node:zlib"
import { SNAPSHOT_ID, validateSnapshot } from "./market-model.ts"
import type { MarketSnapshot, SnapshotEntry, SnapshotManifest } from "./market-types.ts"
export const MAX_COMPRESSED = 8_000_000
export const MAX_UNCOMPRESSED = 32_000_000
export function identifySnapshot(s: Omit<MarketSnapshot, "snapshotId">) {
  const content = { tradeDate: s.tradeDate, periods: [s.reportDate, s.annualReportDate], rows: s.rows, sources: s.sources, warnings: s.warnings, macro: Object.fromEntries(Object.entries(s.macro).map(([id, data]) => [id, { points: data.points.map(p => [p.date, p.value]), status: data.status, latestVerified: data.latestVerified }])) }
  return `cn-${s.tradeDate.replaceAll("-", "")}-${createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 12)}`
}
export function encodeSnapshot(snapshot: MarketSnapshot) {
  validateSnapshot(snapshot)
  const raw = new TextEncoder().encode(JSON.stringify(snapshot)), bytes = new Uint8Array(gzipSync(raw, { level: 9 }))
  if (bytes.length > MAX_COMPRESSED || raw.length > MAX_UNCOMPRESSED) throw new Error("快照体积超限")
  const entry: SnapshotEntry = { snapshotId: snapshot.snapshotId, file: `snapshots/${snapshot.snapshotId}.json.gz`, sha256: createHash("sha256").update(bytes).digest("hex"), compressedBytes: bytes.length, uncompressedBytes: raw.length, tradeDate: snapshot.tradeDate, fetchedAt: snapshot.fetchedAt }
  return { bytes, entry }
}
export function validateManifest(input: unknown): asserts input is SnapshotManifest {
  const m = input as SnapshotManifest
  if (!m || m.schemaVersion !== 1 || !SNAPSHOT_ID.test(m.current) || !Array.isArray(m.snapshots) || m.snapshots.length < 1 || m.snapshots.length > 7 || !m.snapshots.some(s => s.snapshotId === m.current) || new Set(m.snapshots.map(e => e.snapshotId)).size !== m.snapshots.length) throw new Error("清单结构无效")
  for (const e of m.snapshots) if (!SNAPSHOT_ID.test(e.snapshotId) || e.file !== `snapshots/${e.snapshotId}.json.gz` || !/^[a-f0-9]{64}$/.test(e.sha256) || !Number.isInteger(e.compressedBytes) || e.compressedBytes < 1 || e.compressedBytes > MAX_COMPRESSED || !Number.isInteger(e.uncompressedBytes) || e.uncompressedBytes < 1 || e.uncompressedBytes > MAX_UNCOMPRESSED) throw new Error("清单文件记录无效")
}
export function decodeSnapshot(bytes: Uint8Array, entry?: SnapshotEntry): MarketSnapshot {
  if (bytes.byteLength > MAX_COMPRESSED || entry && (bytes.byteLength !== entry.compressedBytes || createHash("sha256").update(bytes).digest("hex") !== entry.sha256)) throw new Error("快照大小或摘要不匹配")
  const raw = gunzipSync(bytes, { maxOutputLength: MAX_UNCOMPRESSED })
  if (entry && raw.length !== entry.uncompressedBytes) throw new Error("快照解压体积不匹配")
  const data: unknown = JSON.parse(raw.toString("utf8")); validateSnapshot(data)
  if (entry && (data.snapshotId !== entry.snapshotId || data.tradeDate !== entry.tradeDate || data.fetchedAt !== entry.fetchedAt)) throw new Error("快照清单日期或版本错配")
  return data
}
