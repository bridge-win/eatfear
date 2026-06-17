# eatfear — Market Intelligence Dashboard

A multi-asset intelligence platform for monitoring crypto and equity markets, detecting extreme panic conditions, and identifying historically attractive entry zones through quantitative signals.

## Core Features

### Crypto Dashboard
- **BTC Cycle Value Monitor** — Mayer Multiple (<0.8), Puell Multiple (<0.5), Fear & Greed Index (<20): explicit threshold tables with zone classification (not a timing signal; a forward-probability view)
- **Black Swan Opportunity Index** — 10-factor composite (0–100) scoring wick capitulation, fear extremes, leverage flush, drawdown, mean reversion, macro risk-off, volume climax, hash ribbon, Mayer Multiple, Puell Multiple
- **Crypto Regime Score** — market-structure regime built from stablecoin flows, ETF net flows, exchange balances, funding rate, OI, taker flow, order book, DVOL, hashrate, and put/call ratio
- **Cycle Position Card** — Mayer Multiple, Hash Ribbon (10/30/60d hashrate MAs), and Puell Multiple displayed with zone labels
- **Smart Money Tracker** — OKX Rubik taker-volume (buy vs. sell aggressive flow) bucketed by time range, with cumulative net chart
- **Options Max Pain** — Deribit options OI by strike (calls/puts), max pain calculation, call wall / put wall for BTC & ETH
- **Opportunity Radar** — synthesises all available series into human-readable trading setups
- **History Compare** — overlay any combination of indicators across configurable time ranges

### Stock Dashboard
- **Panic Conditions Monitor** — VIX vs 30/40 thresholds, HY credit spreads (FRED BAMLH0A0HYM2) vs 550/800 bps, SPX 52-week drawdown vs 20/30% — composite score with honest forward-probability framing
- **Opportunity Radar** — equity-focused synthesis of factor ETFs, credit, USD, and volatility signals
- **Crash Alert Banner** — real-time detection of significant intraday price drops
- **30+ macro indicators** — Fed Funds Rate, yield curve, CPI/PCE/TIPS, DXY, Fed balance sheet, M2, HY/IG spreads, NFCI, VIX, and more (Yahoo Finance + FRED)
- **Multi-region indices** — US, HK/China, Vietnam

### Cross-Asset
- **Panic Window Banner** — polls both crypto and stock condition APIs; shows a dismissible banner on any dashboard when historically attractive multi-signal conditions coincide. Reframes "buy window" as a probabilistic conditions gauge with caveats about interim drawdown risk.
- **Research-validated signal thresholds** — every threshold cross-validated against academic literature and real historical data (Wells Fargo VIX study, ScienceDirect on-chain research, FRED historical HY OAS)

### UI / UX
- **Command Palette** (⌘K / Ctrl+K) — search and navigate all pages, toggle theme
- **Dark / Light mode** — full theme system via next-themes
- **Mobile navigation** — hamburger drawer on small screens
- **Flash-on-update animations** — green/red pulse on realtime card value changes
- **Live funding countdown** — HH:MM:SS to next OKX funding settlement
- **Multi-language** (zh / en) toggle

---

## Quick Start

### Deploy to Vercel

Push to `main` triggers Vercel production deployment via the GitHub integration.

### Environment Variables

```bash
# Required for macro indicators (free sign-up)
# https://fred.stlouisfed.org/docs/api/api_key.html
FRED_API_KEY=your_fred_api_key

# Required for email alerts
RESEND_API_KEY=re_xxxxxxxxxxxx

# Required for server-side cron alerts
CRON_SECRET=your_random_secret_string

# Supabase (for auth + subscriptions)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: higher CoinGecko rate limits
COINGECKO_API_KEY=CG-xxxxxxxxxxxx

# Optional: CoinGlass ETF flows + exchange balance
COINGLASS_API_KEY=your_coinglass_key
```

All data sources used without API keys (OKX, Binance, Yahoo Finance, CoinGecko free, alternative.me, blockchain.info, mempool.space, Deribit public, DefiLlama) degrade gracefully when unavailable. FRED requires a free API key for HY spread and macro indicators.

---

## Architecture

### Data Sources

| Source | Auth | Data |
|--------|------|------|
| OKX | None | Candles, funding, OI, taker volume, L/S ratio, order book |
| Binance | None | Candles, funding, OI, taker volume |
| Yahoo Finance | None | Stocks, indices, VIX, FX, commodities |
| FRED (St. Louis Fed) | Free key | HY/IG spreads, yield curve, CPI, M2, Fed balance sheet |
| alternative.me | None | Crypto Fear & Greed Index |
| blockchain.info | None | Miners revenue, BTC price history |
| mempool.space | None | BTC hashrate |
| Deribit | None | Options OI, DVOL, put/call ratio |
| DefiLlama | None | Stablecoin market cap, DeFi TVL |
| CoinGecko | Optional | ATH distance, market cap |
| CoinGlass | Optional key | Bitcoin ETF flows, exchange balances |

### API Routes

| Route | Description |
|-------|-------------|
| `/api/crypto/history-compare` | Multi-series history for overlay charts |
| `/api/crypto/cycle-position` | Mayer Multiple, Hash Ribbon, Puell Multiple |
| `/api/crypto/black-swan` | 10-factor Black Swan Opportunity score |
| `/api/crypto/regime-score` | Market-structure regime score |
| `/api/crypto/buy-window` | Cycle value monitor (Mayer, Puell, F&G) |
| `/api/crypto/smart-money` | OKX taker-flow buy/sell buckets |
| `/api/crypto/options-oi` | Deribit options OI, max pain, call/put walls |
| `/api/crypto/btc-derivatives` | BTC perp derivatives (funding, OI, L/S) |
| `/api/crypto/mining-cost` | BTC estimated production cost |
| `/api/stock/panic-signal` | VIX + HY spread + SPX drawdown conditions |
| `/api/macro` | 30+ FRED + Yahoo Finance macro indicators |
| `/api/stock-quotes` | Real-time stock quotes |
| `/api/stock-sparklines` | Sparkline history for stock cards |
| `/api/check-alerts` | Cron: send crash-alert emails |
| `/api/send-immediate-alert` | Client-triggered immediate alert |

### Signal Calibration (research-validated)

**Crypto (on-chain cycle)**
| Indicator | Buy Zone | Source / Caveat |
|-----------|----------|-----------------|
| Mayer Multiple | < 0.8 | Below 200d SMA. Flags cheapness, not bottom (fell 30–50% further in 2018/2022). Canonical Mayer rule is >2.4 = overbought. |
| Puell Multiple | < 0.5 | Miner distress. ~+155% in 12m after 2022 low. Part of the MVRV/Puell on-chain family (ScienceDirect 2025). |
| Crypto Fear & Greed | < 20 | Above-average forward returns; large interim drawdown risk. Index live since Feb 2018. |

**US Equity (panic conditions)**
| Indicator | Watch | Elevated | Extreme |
|-----------|-------|----------|---------|
| VIX | > 20 | > 30 | > 40 |
| HY OAS (BAMLH0A0HYM2) | — | > 550 bps | > 800 bps |
| SPX drawdown from 52w high | — | > 20% | > 30% |

VIX context: since 1990, S&P 500 was higher 12 months after a >40 close ~90% of the time (avg +30%). The 2008 failure case: VIX stayed >40 for ~8 months while stocks fell another ~50%. All signals are forward-probability indicators, not timing triggers. Spread peaks lag equity bottoms.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4 (CSS-first, OKLCH tokens), shadcn/ui New York
- **Charts**: Recharts, TradingView Lightweight Charts
- **Data fetching**: SWR with persistent localStorage cache
- **Theme**: next-themes (dark/light)
- **Command palette**: cmdk
- **Auth**: Supabase Auth (email + Google OAuth)
- **Database**: Supabase (PostgreSQL + RLS)
- **Email**: Resend
- **Deployment**: Vercel

---

## Database Setup

Run the SQL scripts in order after creating your Supabase project:

1. `scripts/001_create_database_schema.sql` — tables and RLS policies
2. `scripts/002_create_profile_trigger.sql` — auto-creates user profiles on signup

---

## Cron Job (Crash Alerts)

The `/api/check-alerts` endpoint checks subscriptions and sends crash-alert emails. Secure it with `CRON_SECRET` in your Vercel environment variables.

```json
// vercel.json — runs daily on Hobby, every 5 min on Pro
{
  "crons": [{ "path": "/api/check-alerts", "schedule": "0 0 * * *" }]
}
```

Test manually:
```bash
curl -X GET https://your-domain.vercel.app/api/check-alerts \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## License

MIT
