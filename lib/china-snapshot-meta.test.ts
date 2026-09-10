import assert from "node:assert/strict"
import test from "node:test"

import official from "./data/china-official-snapshot.json" with { type: "json" }
import manual from "./data/china-manual-snapshot.json" with { type: "json" }
import { CHINA_MANUAL_SNAPSHOT_AS_OF, CHINA_SNAPSHOT_AS_OF } from "./data/china-snapshot-meta.ts"

test("snapshot date literals match the snapshot files", () => {
  assert.equal(CHINA_SNAPSHOT_AS_OF, official.asOf)
  assert.equal(CHINA_MANUAL_SNAPSHOT_AS_OF, manual.asOf)
})

test("manual snapshot observations are sorted, finite and sourced", () => {
  const groups = [manual.safe, manual.cfets, manual.rates] as Record<string, unknown>[]
  for (const group of groups) {
    for (const [key, rawSeries] of Object.entries(group)) {
      const series = rawSeries as {
        unit: string
        observations: { date: string; value: number; source?: string }[]
      }
      assert.ok(series.observations.length > 0, `${key} has no observations`)
      let previous = ""
      for (const observation of series.observations) {
        assert.match(observation.date, /^\d{4}-\d{2}-\d{2}$/, `${key} has a malformed date`)
        assert.ok(observation.date > previous, `${key} observations must be strictly ascending`)
        assert.ok(Number.isFinite(observation.value), `${key} has a non-numeric value`)
        assert.ok(observation.source, `${key} observation ${observation.date} has no source link`)
        previous = observation.date
      }
    }
  }
})

test("SAFE settlement balance equals settlement minus sales", () => {
  const settlement = new Map(manual.safe.settlement.observations.map((o) => [o.date, o.value]))
  const sales = new Map(manual.safe.sales.observations.map((o) => [o.date, o.value]))
  for (const observation of manual.safe.net_settlement.observations) {
    const expected = (settlement.get(observation.date) ?? NaN) - (sales.get(observation.date) ?? NaN)
    assert.equal(observation.value, expected, `net settlement mismatch on ${observation.date}`)
  }
})
