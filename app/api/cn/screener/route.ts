import { NextResponse } from "next/server"
import { getMarketSnapshot, SnapshotError } from "@/lib/cn/snapshot-store"
import { parseScreenFilters, screenMarket, selectRows, companyConclusions } from "@/lib/cn/screener"
import { gzipSync } from "node:zlib"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams
  let filters
  try { filters = parseScreenFilters(p); if (p.has("id") && !/^(sh|sz|bj)\d{6}$/.test(p.get("id")!)) throw new Error("invalid_id"); if (p.has("export") && p.get("export") !== "json") throw new Error("invalid_export") }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "invalid_filters" }, { status: 400 }) }
  try {
    const context = await getMarketSnapshot(p.get("snapshotId")), result = screenMarket(context, filters)
    if (p.has("id")) {
      const row = context.snapshot.rows.find(r => r.id === p.get("id"))
      if (!row) return NextResponse.json({ error: "unknown_security" }, { status: 404 })
      return NextResponse.json({ ...result, items: [{ row, conclusions: companyConclusions(row, filters), themeReason: null }], total: 1 }, { headers: { "Cache-Control": "public, s-maxage=60" } })
    }
    if (p.get("export") === "json") {
      const rows = selectRows(context.snapshot, filters).rows
      const json = JSON.stringify({ ...result, exportedAt: new Date().toISOString(), purpose: "当前修订版研究结果，不是历史当时可知回测数据", items: rows.map(row => ({ row, conclusions: companyConclusions(row, filters) })), page: 1, pageSize: rows.length })
      const compressed = new Uint8Array(gzipSync(new TextEncoder().encode(json)))
      if (compressed.byteLength > 4_000_000) return NextResponse.json({ error: "export_too_large_refine_filters" }, { status: 413 })
      return new Response(compressed, { headers: { "Content-Type": "application/json;charset=utf-8", "Content-Encoding": "gzip", "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="cn-screen-${result.snapshotId}.json"` } })
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "public, s-maxage=60" } })
  } catch (e) { return NextResponse.json({ error: e instanceof SnapshotError ? e.code : "screener_unavailable" }, { status: e instanceof SnapshotError ? e.status : 503 }) }
}
