# Discover Yield Intelligence

## Goal

Add a first-release `Discover` module that helps ordinary investors find relatively conservative income opportunities. The first scope covers:

- Cash-secured put and covered-call candidates with an estimated annualized premium yield of at least 10%.
- Stable-yield methods such as Treasury bills, Treasury money-market funds, insured deposits, overnight cash/repo sweeps, ultrashort bond funds, and collateralized cash/lending programs.
- Concrete stable-yield assets/funds such as Treasury bill ETFs, floating-rate Treasury ETFs, and ultrashort bond ETFs with live price/risk data and issuer sources.
- 15-minute refresh through a server-side cached API so the page updates at least daily and normally much faster without manual edits.

This is an information and screening surface, not personalized financial advice.

## Data Contract

`GET /api/discover` returns:

- `candidates`: screened option-income opportunities with price, strike, days to expiration, premium, annualized yield, realized volatility, max drawdown, risk score, reasons, cautions, and source metadata.
- `stableYieldIdeas`: lower-risk income methods with estimated yield, liquidity, principal risk, access notes, tax notes, and source links.
- `stableYieldAssets`: concrete ETF/fund candidates with live price, day change, Treasury-proxy yield guide, one-year realized volatility, max drawdown, risk score, reasons, cautions, and issuer links.
- `sources`: data sources and limitations.
- `updatedAt` and `nextUpdateAt`: cache timestamps for refresh visibility.

The first release uses no paid credentials. Yahoo chart data supplies current price snapshots and one-year history. Cboe delayed option-chain JSON supplies bid/ask, volume, and open interest when a liquid target contract is available. Black-Scholes estimates from realized volatility are kept as fallback only when delayed option data is missing or too illiquid.

## Screening Rules

Candidates must pass:

- Estimated option income yield of at least 10% annualized.
- Risk score of at least 55 out of 100.
- Liquid, widely followed ETF or large-cap stock universe only.
- Covered-call contracts must be out of the money above spot; cash-secured-put contracts must be out of the money below spot.
- No leveraged ETFs, no low-price meme names, no single-name candidates without meaningful historical data.

Risk score combines realized volatility, max drawdown, underlying quality class, trend support, and liquidity proxy. A high premium alone is not enough.

## UI

`/discover` is a nav-level page. It opens with the current income map, then provides:

- Segmented strategy filters.
- A minimum-yield control.
- Candidate cards with key data, option-chain bid/ask/open-interest data when available, and rationale.
- Stable asset cards with concrete ticker, live price history, issuer source, risk score, yield guide, and cautions.
- A stable-yield information center.
- A source and limitations section.

Visual direction: dense operator console, calm off-black/white base, restrained cyan/amber/emerald status colors, and a "yield ladder" motif through ordered rows and compact metric rails.

## Verification

Run:

- `pnpm test`
- `pnpm exec tsc --noEmit`
- `pnpm build`

Use a browser pass on `/discover` at desktop and mobile widths when possible.
