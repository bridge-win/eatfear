import { readFile } from "node:fs/promises"
import { resolve, join } from "node:path"
import { decodeSnapshot, validateManifest } from "../lib/cn/snapshot-codec.ts"
import { boundedFetch } from "../lib/cn/market-providers.ts"
async function main() {
const args = process.argv.slice(2), directory = args.includes("--directory") ? resolve(args[args.indexOf("--directory") + 1]) : null
const revision = args.includes("--revision") ? args[args.indexOf("--revision") + 1] : "codex/cn-market-data"
if (revision !== "codex/cn-market-data" && !/^[a-f0-9]{40}$/.test(revision)) throw new Error("Invalid data revision")
const root = `https://raw.githubusercontent.com/bridge-win/eatfear/${revision}/`
const manifest: unknown = JSON.parse(directory ? await readFile(join(directory, "manifest.json"), "utf8") : await boundedFetch(root + "manifest.json"))
validateManifest(manifest)
for (const entry of manifest.snapshots) {
  let bytes: Uint8Array
  if (directory) bytes = new Uint8Array(await readFile(join(directory, entry.file)))
  else { const response = await fetch(root + entry.file, { signal: AbortSignal.timeout(20000), redirect: "error" }); if (!response.ok || Number(response.headers.get("content-length")) > 8e6) throw new Error("Remote snapshot unreadable"); bytes = new Uint8Array(await response.arrayBuffer()) }
  const snapshot = decodeSnapshot(bytes, entry)
  console.log(JSON.stringify({ snapshotId: snapshot.snapshotId, coverage: snapshot.coverage, verified: true }))
}
}
main().catch(error => { console.error(error instanceof Error ? error.message : "快照验证失败"); process.exitCode = 1 })
