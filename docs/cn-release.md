# CN observatory integration review

Route: `/cn`. Entry points: main desktop/mobile navigation (`宏观 CN` / `Macro CN`) and command palette search (`CN`, `中国`, `化债`). The workspace keeps its own responsive navigation; the main header is intentionally not duplicated inside `/cn`.

## Data and evaluation hardening

- A failed refresh cannot keep a previously complete cached series eligible for current temperature. Its historical observations remain available, but `partial`/stale data cannot generate current percentiles or Z/M scores.
- Three-month momentum requires every intermediate month. A missing previous month suppresses the last-period delta. No interpolation of missing releases.
- Equity price levels are not tested as stationary outliers. Price-position percentiles are descriptive, not cheapness or return forecasts.
- Annualized daily volatility and policy event price windows reject long observation gaps. Event horizons must be positive integers. Price studies exclude dividends, benchmark and transaction costs and do not establish causality.
- CSI300 adds a third independent Tencent historical adapter after Yahoo and Eastmoney. It discovers source coverage, requests bounded calendar-year pages below the 640-row limit, validates boundaries and gaps, and never splices vendor histories together. Actual source availability is recorded by diagnostics, not assumed from adapter presence.

Tencent endpoint schema was cross-checked against the maintainers' current `stock_zh_index_daily_tx` source in `akfamily/akshare/akshare/index/index_stock_zh.py`; implementation is TypeScript and adds no Python/runtime dependency. Public webpage interfaces have no uptime guarantee; public access does not establish redistribution permission.

## Verification

`cn-validation.yml` runs the existing application's `pnpm test`, all `lib/cn/*.test.ts`, the CN-specific TypeScript check, a full Next.js build, real provider diagnostics and Chromium interaction tests. The generated provider report distinguishes full source coverage, partial archive coverage and unavailable endpoints. Inspect the run and report for the tested commit rather than interpreting a previous green run as a guarantee of all live data sources.

The first verified implementation had incomplete official archive coverage and an unavailable IMF API. These remain explicit data states; no placeholder values or fabricated history are substituted. Core national macro data do not require user API keys. Production is a Node.js Next application, not a static export. Runtime polling is 15 minutes while the page is open; macro observations retain their original daily/monthly/annual frequency. This is not a seconds-level trading feed or a guaranteed always-running background collector.

See `docs/cn-observatory.md` for methodology, API contracts, archive collection and operational limits.

## Research workspace upgrade — 2026-10-18

`/cn#research` adds five evidence-driven topics, nine manually verified stock/ETF identities and Tencent quotes, four stocks' same-period financial statements via Eastmoney, manual equity/bond scenarios, browser-local notes/watchlist and JSON research snapshots. `/cn#sources` includes seventeen official, market and institutional-source entries, with actual connection and subscription status. See `cn-research-upgrade.md` for source research, methodologies and remaining coverage limits.

Data review fixed official archive completeness, refresh failures, financial publication lineage in CSV, and insufficient price-history risk calculations. Macro diagnostics now identify four MOF series as partial due to historical coverage gaps; those series remain viewable but do not create current scores. No missing history is synthesized.

Local validation: 79 existing application tests and 85 CN tests passed, CN TypeScript check passed independently of the build's existing `ignoreBuildErrors` setting, and full Next.js production build passed. Chromium verified six workspaces, five topics, security filtering, valuation arithmetic, notes after reload, watchlist persistence, JSON export, source search, main navigation and command palette. Layout checks passed at 320/390/768/1440px with no page errors. Live verification returned nine quotes and all four stock financial adapters worked; formal browser report verifies China State Construction's same-period financial response.

The new UI was also reviewed using the React best-practices checklist: lazy-loaded research panels, client-safe catalogs, typed server responses, deduplicated requests, versioned local storage, labeled form controls and responsive table overflow. Browser testing found and fixed the persisted textarea accessible-label issue.

Public data availability depends on location and upstream changes. Paid Wind/CEIC feeds, complete industry/ETF valuation/holdings coverage, release-vintage databases and automatic whole-market opportunity ranking are not included. Candidate mappings and scenario assumptions are research inputs, not a validated return model.

## Whole-market screening — 2026-10-18

The default page now presents five computed economic observations, real company results and traceable conclusions. A-share screening covers Shanghai, Shenzhen and Beijing using a dated public-source snapshot; ETF and manual scenarios remain in `/cn#tools`. See [current capabilities, source limits and operating guide](cn-market-screening.md) and [real-data verification](cn-market-verification.json).

The new collection workflow publishes validated compressed snapshots to `codex/cn-market-data` after each weekday close. Identity coverage, official listing verification, financial coverage and data freshness remain separate. The local SZSE listing request failed and BSE full listing integration remains incomplete; these are visible source states, not claims of complete official listing verification.

Local release checks: existing application tests passed (79); CN test suite passed (114, including cross-market stable sorting); independent CN typecheck and production build passed. Both Chromium suites passed, including full-market filters, BSE statements, persisted notes, legacy ETF/scenario tools, navigation and 320/390/768/1440px layouts. Full custom export returned all 5,373 matching non-ST records via gzip. Reports retain the tested snapshot and dates.

Post-push verification: [first daily collection](https://github.com/bridge-win/eatfear/actions/runs/39118141590), [CN CI](https://github.com/bridge-win/eatfear/actions/runs/39118124401) and [production deployment](https://github.com/bridge-win/eatfear/actions/runs/39118124405) succeeded for 546d11b. Production `/api/cn/analysis` returned HTTP 200 in remote mode, snapshot `cn-20261016-dc5bbe092119`. Browser reloading now also verifies that macro analysis is pinned to the saved screening snapshot.

Low-valuation ordering also treats nonpositive PE/PB as inapplicable and keeps these rows last in either sort direction; custom screening cannot make negative PE appear cheapest. The numeric edge case has a dedicated regression test.

A final instrument-scope audit excluded STAR CDR code segment 689 from the ordinary A-share candidate and peer universe. The real archive contains 5,576 candidates; current financial screening had already excluded receipts through its strict A-share type filter. Older immutable snapshots remain readable with an explicit receipt-scope warning.
