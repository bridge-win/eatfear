import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

import { RULES, buyHold } from "./rules.ts"
import type { Bar } from "./ledger.ts"

const read = (p: string) => JSON.parse(readFileSync(new URL(`../../public/research/${p}`, import.meta.url), "utf8"))

test("evidence.json keeps its schema and headline counts", () => {
  const ev = read("evidence.json")
  assert.equal(ev.schema, "research-evidence/1")
  assert.equal(ev.strategies.length, ev.summary.nStrategies)
  assert.equal(ev.combos.length, ev.summary.nCombos)
  const survivors = ev.strategies.filter((s: { verdict: string[] }) => s.verdict.length === 1 && s.verdict[0] === "未被证伪").map((s: { id: string }) => s.id)
  assert.deepEqual(survivors.sort(), [...ev.summary.survivors].sort(), "survivor list must match verdicts")
  assert.equal(ev.summary.nSurvivors, survivors.length)
  const ids = new Set(ev.strategies.map((s: { id: string }) => s.id))
  assert.equal(ids.size, ev.strategies.length, "duplicate strategy ids")
  for (const s of ev.strategies) {
    assert.ok(Number.isFinite(s.oos.total) && Number.isFinite(s.oos.sharpe), s.id)
    assert.ok(s.oos.maxdd <= 0, `${s.id} maxdd must be non-positive`)
    assert.ok(s.verdict.length > 0)
  }
})

test("every SIGNAL_MAP id resolves to a strategy in evidence.json", () => {
  const ev = read("evidence.json")
  const ids = new Set<string>(ev.strategies.map((s: { id: string }) => s.id))
  const src = readFileSync(new URL("../research-evidence.ts", import.meta.url), "utf8")
  const block = src.slice(src.indexOf("SIGNAL_MAP"), src.indexOf("}", src.indexOf("SIGNAL_MAP: Record")))
  const referenced = [...block.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1])
  const missing = referenced.filter((id) => !ids.has(id))
  assert.deepEqual(missing, [], `SIGNAL_MAP references unknown strategies: ${missing.join(", ")}`)
})

test("forecast, carry and factor evidence files are internally consistent", () => {
  const fc = read("forecast-evidence.json")
  assert.ok(fc.driftTest.models.length >= 5)
  for (const m of fc.driftTest.models) assert.ok(m.r2VsZero <= 0.2, "implausible drift predictability — inspect for leakage")
  for (const rows of Object.values(fc.regimeTest.byHorizon) as { improvement: number }[][]) for (const r of rows) assert.ok(Number.isFinite(r.improvement))
  const carry = read("carry-evidence.json")
  assert.ok(carry.test.apr > 0 && carry.test.apr < 0.5)
  const factors = read("factors.json")
  const parents = new Map(factors.edges.map((e: { source: string; target: string }) => [e.source, e.target]))
  assert.equal(parents.size, factors.edges.length, "a node may have only one parent")
  assert.equal(factors.nodes.length, factors.edges.length + 1, "tree: nodes = edges + 1")
  for (const n of factors.nodes) if (n.id !== "BTC") assert.ok(parents.has(n.id), `${n.id} is orphaned`)
})

function ramp(n: number): Bar[] {
  let p = 100
  return Array.from({ length: n }, (_, i) => {
    const open = p
    p *= 1 + Math.sin(i / 9) * 0.03
    return { time: Date.UTC(2019, 0, 1) + i * 86_400_000, open, high: Math.max(open, p) * 1.01, low: Math.min(open, p) * 0.99, close: p }
  })
}

test("no canonical rule reads future bars", () => {
  const bars = ramp(900)
  const shocked = bars.map((b, i) => (i >= 700 ? { ...b, open: b.open * 3, high: b.high * 3, low: b.low * 3, close: b.close * 3 } : b))
  for (const rule of [...RULES, buyHold]) {
    for (const params of rule.grid) {
      const a = rule.targets(bars, params as never)
      const b = rule.targets(shocked, params as never)
      for (let i = 0; i < 700; i++) assert.equal(a[i], b[i], `${rule.id} ${JSON.stringify(params)} changed at bar ${i} after a future shock`)
      assert.ok(a.every((v) => v === 0 || v === 1 || v === -1), `${rule.id} must emit -1/0/1`)
    }
  }
})
