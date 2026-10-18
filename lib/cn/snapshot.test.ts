import { test } from "node:test"
import assert from "node:assert/strict"
import { gzipSync } from "node:zlib"
import { encodeSnapshot, decodeSnapshot, validateManifest, identifySnapshot, MAX_UNCOMPRESSED } from "./snapshot-codec.ts"
import { getMarketSnapshot } from "./snapshot-store.ts"
import { marketSnapshot } from "./market-fixtures.ts"
test("snapshot roundtrip verifies compressed checksum and immutable metadata", () => {
  const s = marketSnapshot(), { bytes, entry } = encodeSnapshot(s)
  assert.equal(decodeSnapshot(bytes, entry).snapshotId, s.snapshotId)
  assert.throws(() => decodeSnapshot(bytes, { ...entry, sha256: "0".repeat(64) }))
  assert.throws(() => decodeSnapshot(bytes, { ...entry, tradeDate: "2026-10-15" }))
  assert.throws(() => decodeSnapshot(bytes, { ...entry, uncompressedBytes: 1 }))
  assert.throws(() => decodeSnapshot(new Uint8Array([1, 2, 3])))
})
test("manifest rejects traversal paths, duplicated entries and missing head", () => {
  const { entry } = encodeSnapshot(marketSnapshot()), m = { schemaVersion: 1, current: entry.snapshotId, snapshots: [entry] }
  validateManifest(m)
  assert.throws(() => validateManifest({ ...m, snapshots: [{ ...entry, file: "../private" }] }))
  assert.throws(() => validateManifest({ ...m, snapshots: [entry, entry] }))
  assert.throws(() => validateManifest({ ...m, current: "cn-20261015-0123456789ab" }))
})
test("unchanged observed data retain identity while source or quality changes create a new version", () => {
  const s = marketSnapshot(), id = identifySnapshot(s)
  assert.equal(identifySnapshot({ ...s, fetchedAt: "2026-10-19T00:00Z" }), id)
  assert.notEqual(identifySnapshot({ ...s, warnings: ["源状态变化"] }), id)
})
test("gzip expansion is bounded", () => {
  const bomb = new Uint8Array(gzipSync(new Uint8Array(MAX_UNCOMPRESSED + 1)))
  assert.throws(() => decodeSnapshot(bomb))
})
test("expired pinned snapshot returns 410 without switching versions", async () => {
  const { entry } = encodeSnapshot(marketSnapshot())
  const fetcher = (async (url: string | URL | Request) => new Response(JSON.stringify(String(url).endsWith("health.json") ? {} : { schemaVersion: 1, current: entry.snapshotId, snapshots: [entry] }))) as typeof fetch
  await assert.rejects(getMarketSnapshot("cn-20261015-0123456789ab", fetcher), (e: unknown) => (e as { status: number }).status === 410)
  await assert.rejects(getMarketSnapshot("../../secret", fetcher), (e: unknown) => (e as { status: number }).status === 400)
})
test("failed update health stays visible while the last successful snapshot remains readable", async () => {
  const s = marketSnapshot(), { bytes, entry } = encodeSnapshot(s)
  const fetcher = (async (url: string | URL | Request) => {
    const path = String(url)
    if (path.endsWith("health.json")) return new Response(JSON.stringify({ status: "failed", errors: ["分页失败"], lastAttemptAt: s.fetchedAt, lastSuccessAt: s.fetchedAt, runUrl: null }))
    if (path.endsWith("manifest.json")) return new Response(JSON.stringify({ schemaVersion: 1, current: entry.snapshotId, snapshots: [entry] }))
    return new Response(bytes)
  }) as typeof fetch
  const result = await getMarketSnapshot(undefined, fetcher)
  assert.equal(result.snapshot.snapshotId, s.snapshotId); assert.equal(result.health.status, "failed"); assert.match(result.warning!, /更新状态/)
})
test("unreachable or corrupt remote data uses dated real local archive", async () => {
  const result = await getMarketSnapshot(undefined, (async () => new Response("unavailable", { status: 503 })) as typeof fetch)
  assert.equal(result.mode, "archive"); assert.ok(result.snapshot.rows.length > 4000); assert.match(result.warning!, /真实归档/)
})
