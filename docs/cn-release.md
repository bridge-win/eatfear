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
