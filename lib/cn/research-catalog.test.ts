import test from "node:test"
import assert from "node:assert/strict"
import { BY_ID } from "./catalog.ts"
import { RESEARCH_THEMES } from "./opportunities.ts"
import { CN_SECURITIES } from "./security-catalog.ts"
import { RESEARCH_SOURCES } from "./source-registry.ts"

function verifyLink(raw: string) {
  const url = new URL(raw)
  assert.equal(url.protocol, "https:", `research link must use HTTPS: ${raw}`)
  assert.equal(url.username, "")
  assert.equal(url.password, "")
  assert.ok(url.hostname.includes("."))
  return url
}

test("research rules and source coverage reference actual indicators, without orphaned theme mappings", () => {
  const themeIds = new Set(RESEARCH_THEMES.map(theme => theme.id))
  assert.equal(themeIds.size, RESEARCH_THEMES.length)
  for (const theme of RESEARCH_THEMES) {
    assert.ok(CN_SECURITIES.some(security => security.themeIds.includes(theme.id)), `no candidate for ${theme.id}`)
    assert.ok(theme.confirm.length && theme.invalidate.length, `missing two-sided due diligence for ${theme.id}`)
    assert.equal(new Set(theme.rules.map(rule => rule.id)).size, theme.rules.length)
    for (const rule of theme.rules) {
      assert.ok(Object.hasOwn(BY_ID, rule.seriesId), `${rule.id} references an unknown indicator`)
      if (rule.metric === "momentum") {
        assert.equal(BY_ID[rule.seriesId].frequency, "monthly")
        assert.ok(!BY_ID[rule.seriesId].seasonal, "raw seasonal flow must not use simple monthly momentum")
      }
      assert.ok(Number.isFinite(rule.threshold))
    }
    theme.sources.forEach(source => verifyLink(source.url))
  }
  for (const security of CN_SECURITIES) {
    assert.ok(security.themeIds.length)
    assert.ok(security.themeIds.every(id => themeIds.has(id as typeof RESEARCH_THEMES[number]["id"])), `${security.id} has an unrenderable theme`)
  }
  assert.equal(new Set(RESEARCH_SOURCES.map(source => source.id)).size, RESEARCH_SOURCES.length)
  for (const source of RESEARCH_SOURCES) {
    source.seriesIds.forEach(id => assert.ok(Object.hasOwn(BY_ID, id), `${source.id} references unknown series ${id}`))
    verifyLink(source.url)
    if (source.documentationUrl) verifyLink(source.documentationUrl)
    if (source.connection === "subscription" || source.connection === "reference") {
      assert.equal(source.seriesIds.length, 0, `${source.id} cannot imply an implemented feed`)
    }
  }
})

test("security identities have unique market-qualified codes and primary-source disclosure links", () => {
  const officialHosts = new Set(["www.sse.com.cn", "www.fsfund.com", "www.99fund.com", "www.gtfund.com", "www.cscec.com", "cmbchina.com", "www.sany.com.cn", "www.ctg.com.cn"])
  assert.equal(new Set(CN_SECURITIES.map(security => security.id)).size, CN_SECURITIES.length)
  for (const security of CN_SECURITIES) {
    assert.match(security.code, /^\d{6}$/)
    assert.equal(security.id, `${security.exchange === "SSE" ? "sh" : "sz"}${security.code}`)
    assert.ok(security.name && security.fullName)
    assert.ok(officialHosts.has(verifyLink(security.officialUrl).hostname), `${security.id} needs an issuer or exchange source`)
    assert.equal(new Date(`${security.verifiedAt}T00:00:00Z`).toISOString().slice(0, 10), security.verifiedAt)
    assert.ok(security.checklist.length >= 2 && security.risks.length >= 1)
  }
})
