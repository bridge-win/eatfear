import assert from "node:assert/strict"
import test from "node:test"

import {
  getCryptoSeriesScope,
  getCryptoWorkspaceIndicators,
  normalizeCryptoHistorySeries,
} from "./crypto-series-workspace.ts"

test("workspace catalog exposes instrument, bitcoin, and global series in the correct domains", () => {
  const ethKeys = new Set(getCryptoWorkspaceIndicators("ETH").map((indicator) => indicator.key))
  const btcKeys = new Set(getCryptoWorkspaceIndicators("BTC").map((indicator) => indicator.key))
  const globalKeys = new Set(getCryptoWorkspaceIndicators("GLOBAL").map((indicator) => indicator.key))

  assert.equal(ethKeys.has("btcPrice"), true)
  assert.equal(ethKeys.has("oi"), true)
  assert.equal(ethKeys.has("circulatingSupply"), true)
  assert.equal(ethKeys.has("hashRate"), false)
  assert.equal(btcKeys.has("hashRate"), true)
  assert.equal(globalKeys.has("dxy"), true)
  assert.equal(globalKeys.has("oi"), false)
  assert.equal(getCryptoSeriesScope("dxy"), "global")
})

test("indexed comparison rebases each series to 100 without changing missing points", () => {
  const normalized = normalizeCryptoHistorySeries({
    key: "ETH:oi",
    i18nKey: "compare.s.oi",
    infoI18nKey: "compare.info.oi",
    order: 1,
    paneIndex: 0,
    color: "blue",
    source: "test",
    unit: "usd",
    data: [
      { time: 1, value: 200 },
      { time: 2, value: null },
      { time: 3, value: 250 },
    ],
  }, "indexed")

  assert.equal(normalized.unit, "raw")
  assert.deepEqual(normalized.data.map((point) => point.value), [100, null, 125])
})

test("z-score comparison centers a series in the selected window", () => {
  const normalized = normalizeCryptoHistorySeries({
    key: "GLOBAL:dxy",
    i18nKey: "compare.s.dxy",
    infoI18nKey: "compare.info.dxy",
    order: 1,
    paneIndex: 0,
    color: "blue",
    source: "test",
    unit: "raw",
    data: [
      { time: 1, value: 10 },
      { time: 2, value: 20 },
      { time: 3, value: 30 },
    ],
  }, "zscore")

  const values = normalized.data.map((point) => point.value ?? 0)
  assert.ok(Math.abs(values.reduce((sum, value) => sum + value, 0)) < 1e-12)
})
