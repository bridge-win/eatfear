import assert from "node:assert/strict"
import test from "node:test"

import { buildSourceHealth } from "./server.ts"

const SOURCE = {
  sourceId: "example",
  name: "Example",
  sourceUrl: "https://example.com",
}

test("maps probe outcomes without claiming unverified availability", () => {
  const successful = buildSourceHealth({ ...SOURCE, outcome: "success", latencyMs: 120, observedAt: 1_000 })
  const mismatch = buildSourceHealth({ ...SOURCE, outcome: "schema_mismatch", latencyMs: 150, observedAt: 1_000 })
  const timeout = buildSourceHealth({ ...SOURCE, outcome: "timeout", latencyMs: 4_000, observedAt: 1_000 })
  const absent = buildSourceHealth({ ...SOURCE, outcome: "not_configured", observedAt: 1_000 })

  assert.equal(successful.status, "operational")
  assert.equal(successful.lastSuccessAt, 1_000)
  assert.equal(mismatch.status, "degraded")
  assert.equal(mismatch.lastSuccessAt, null)
  assert.equal(timeout.status, "unavailable")
  assert.equal(absent.status, "not_configured")
  assert.equal(absent.latencyMs, null)
})
