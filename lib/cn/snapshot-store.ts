import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { decodeSnapshot, validateManifest, MAX_COMPRESSED } from "./snapshot-codec.ts"
import { SNAPSHOT_ID, isDepositaryReceiptCode } from "./market-model.ts"
import type { CollectionHealth, MarketSnapshot, SnapshotContext } from "./market-types.ts"
const ROOT = "https://raw.githubusercontent.com/bridge-win/eatfear/codex/cn-market-data/"
const UNKNOWN: CollectionHealth = { lastAttemptAt: "", lastSuccessAt: null, status: "unknown", errors: ["未取得采集运行状态"], runUrl: null }
const legacyScopeWarning = (snapshot: MarketSnapshot) => snapshot.rows.some(r => isDepositaryReceiptCode(r.code)) ? "此历史版本名录含科创CDR条目；财务筛选按A股类型约束，后续采集已排除该证券品种，请检查更新。" : null
let archive: Promise<MarketSnapshot> | undefined
export class SnapshotError extends Error { code: string; status: number; constructor(code: string, status: number) { super(code); this.code = code; this.status = status } }
async function bytes(url: string, limit: number, revalidate: number, fetcher: typeof fetch) {
  const response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(8000), next: { revalidate } })
  if (!response.ok || !response.body || Number(response.headers.get("content-length") ?? 0) > limit) throw new Error(`数据快照 HTTP ${response.status}`)
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0
  try { for (;;) { const p = await reader.read(); if (p.done) break; size += p.value.length; if (size > limit) throw new Error("快照响应超限"); chunks.push(p.value) } }
  finally { await reader.cancel().catch(() => undefined); reader.releaseLock() }
  return Buffer.concat(chunks)
}
async function health(fetcher: typeof fetch): Promise<CollectionHealth> {
  try {
    const h = JSON.parse((await bytes(ROOT + "health.json", 30000, 60, fetcher)).toString()) as CollectionHealth
    if (!h || !["ok", "failed", "unknown"].includes(h.status) || !Array.isArray(h.errors) || !Number.isFinite(Date.parse(h.lastAttemptAt)) || h.errors.some(e => typeof e !== "string") || h.runUrl && !/^https:\/\/github\.com\/bridge-win\/eatfear\/actions\/runs\/\d+$/.test(h.runUrl)) return UNKNOWN
    return { ...h, errors: h.errors.slice(0, 8).map(e => e.slice(0, 500)) }
  } catch { return UNKNOWN }
}
export function localArchive() {
  return archive ??= readFile(join(process.cwd(), "public/cn/market-seed.json.gz")).then(b => decodeSnapshot(new Uint8Array(b))).catch(e => { archive = undefined; throw e })
}
export async function getMarketSnapshot(snapshotId?: string | null, fetcher: typeof fetch = fetch): Promise<SnapshotContext> {
  if (snapshotId && !SNAPSHOT_ID.test(snapshotId)) throw new SnapshotError("invalid_snapshot_id", 400)
  const h = health(fetcher)
  try {
    const m: unknown = JSON.parse((await bytes(ROOT + "manifest.json", 30000, 60, fetcher)).toString()); validateManifest(m)
    const entry = m.snapshots.find(e => e.snapshotId === (snapshotId ?? m.current))
    if (!entry) throw new SnapshotError("snapshot_expired", 410)
    const data = decodeSnapshot(new Uint8Array(await bytes(ROOT + entry.file, MAX_COMPRESSED, 86400, fetcher)), entry)
    const status = await h
    return { snapshot: data, mode: "remote", health: status, warning: [legacyScopeWarning(data), status.status !== "ok" ? "本次更新状态异常或未知，以下为最近成功快照。" : Date.now() - Date.parse(status.lastAttemptAt) > 72 * 3600000 ? "超过72小时未确认采集任务运行，请核对数据日期。" : null].filter(Boolean).join(" ") || null }
  } catch (error) {
    if (error instanceof SnapshotError) throw error
    try {
      const data = await localArchive()
      if (snapshotId && snapshotId !== data.snapshotId) throw new SnapshotError("snapshot_temporarily_unavailable", 503)
      return { snapshot: data, mode: "archive", health: await h, warning: ["远端快照暂不可用；显示随应用保存的真实归档，请核对原始日期。", legacyScopeWarning(data)].filter(Boolean).join(" ") }
    } catch (e) { if (e instanceof SnapshotError) throw e; throw new SnapshotError("market_data_unavailable", 503) }
  }
}
