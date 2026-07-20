import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

function source(file: string): string {
  return readFileSync(path.join(process.cwd(), file), "utf8")
}

test("smart money command center preserves the required evidence surfaces", () => {
  const commandCenter = source("components/smart-money-command-center.tsx")
  for (const tab of ["pulse", "feed", "discover", "wallets", "sources"]) {
    assert.match(commandCenter, new RegExp(`value=["']${tab}["']`))
  }
  assert.match(commandCenter, /refreshInterval:\s*15_000/)
  assert.match(commandCenter, /SmartMoneySourceHealth/)
})

test("evidence rows expose safe direct links and copy avoids absolute authenticity claims", () => {
  const evidence = source("components/smart-money-evidence-tape.tsx")
  const liveFeed = source("components/smart-money-live-feed.tsx")
  const translations = source("lib/i18n.tsx")

  assert.match(`${evidence}\n${liveFeed}`, /rel="noreferrer"/)
  assert.doesNotMatch(translations, /cannot be faked/i)
})
