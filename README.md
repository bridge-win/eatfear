# eatfear - Real-time Market Crash Monitoring

A comprehensive platform for monitoring cryptocurrency and stock market crashes with automated email alerts.

## Features

- **Real-time Price Tracking**: Live WebSocket updates for top 100 cryptocurrencies via Binance
- **Stock Market Monitoring**: Track major indices (S&P 500, NASDAQ, Dow Jones) and top U.S. stocks
- **Crash Detection**: Automatic identification of significant price drops with customizable thresholds
- **Dual Alert System**: 
  - **Client-side monitoring** (instant alerts while dashboard is open)
  - **Server-side cron job** (backup alerts every 6 hours)
- **Email Alerts**: Receive instant notifications when subscribed assets crash
- **Toast Notifications**: In-app alerts when crashes are detected in real-time
- **Market Sentiment**: View Fear & Greed Index and global market statistics
- **Subscription Management**: Full control over alerts with pause/resume/edit capabilities

## Quick Start

### 1. Deploy to Vercel

Production deploys are automated through GitHub Actions. Every push to `main`
runs `.github/workflows/vercel-production.yml`, builds the app with the Vercel
CLI, and publishes the prebuilt output to the linked Vercel production project.

Add these repository secrets in GitHub **Settings → Secrets and variables →
Actions**:

```bash
VERCEL_TOKEN=your_vercel_access_token
VERCEL_ORG_ID=your_vercel_org_id
VERCEL_PROJECT_ID=your_vercel_project_id
```

The local `.vercel/project.json` file contains `orgId` and `projectId` after
running `vercel link`, but the `.vercel` directory must stay uncommitted. Keep
runtime/build variables such as `FRED_API_KEY`, `RESEND_API_KEY`, and Supabase
keys in Vercel Project Settings, not in GitHub.

If the Vercel Git integration is also enabled for this repository, disable one
of the two deployment paths to avoid duplicate production builds.

### 2. Setup Environment Variables

Add these environment variables in your Vercel project settings (or in the **Vars** section in v0):

```bash
# Supabase (already configured in v0)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Email Service - Required for alerts
RESEND_API_KEY=re_xxxxxxxxxxxx

# Cron Job Security - Required for automated alerts
CRON_SECRET=your_random_secret_string

# Optional: Development OAuth redirect
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000

# ====== Data Source API Keys ======

# FRED API (Required for macro indicators)
# Free unlimited usage, just need to register
# Get your free API key at: https://fred.stlouisfed.org/docs/api/api_key.html
FRED_API_KEY=your_fred_api_key

# ====== Crypto Data Sources (all optional) ======
# OKX: No API key needed - full public data access
# Binance: No API key needed - full public data access
# CoinGecko: No API key needed for basic data (10-30 calls/min)
#            Optional key for higher rate limits (500 calls/min)
# Get your optional key at: https://www.coingecko.com/en/api/pricing
COINGECKO_API_KEY=CG-xxxxxxxxxxxx
```

### 3. Configure Resend (Required)

**Step 1: Sign up for Resend**
1. Go to [resend.com](https://resend.com) and create a free account
2. Navigate to **API Keys** in the dashboard
3. Click **Create API Key**
4. Copy the API key (starts with `re_`)

**Step 2: Add API Key to Vercel**
1. In Vercel dashboard, go to your project **Settings**
2. Click **Environment Variables**
3. Add new variable:
   - Name: `RESEND_API_KEY`
   - Value: Your API key from Resend
   - Environment: Production, Preview, Development

**Step 3: Email Domain Configuration**

**Option A: Use Test Domain (Quick Start)**
- The app is pre-configured to use `onboarding@resend.dev`
- This works immediately without any setup
- ⚠️ Limited to 100 emails/day, only for testing
- Emails may land in spam folder

**Option B: Use Your Own Domain (Recommended for Production)**
1. In Resend dashboard, click **Domains**
2. Click **Add Domain** and enter your domain (e.g., `yourdomain.com`)
3. Add DNS records shown by Resend to your domain provider
4. Wait for verification (usually 5-10 minutes)
5. Update the `from` email in these files:
   - `app/api/check-alerts/route.ts` (line ~182)
   - `app/api/send-immediate-alert/route.ts` (line ~90)
   - `app/api/send-test-alert/route.ts` (line ~33)
   
   Change from:
   ```typescript
   from: "eatfear <onboarding@resend.dev>",
   ```
   To:
   ```typescript
   from: "eatfear <alerts@yourdomain.com>",
   ```

### 4. Configure Cron Secret

Generate a secure random string:

```bash
# On macOS/Linux:
openssl rand -base64 32

# Or use any random string generator
```

Add to Vercel environment variables:
- Name: `CRON_SECRET`
- Value: Your generated random string

### 5. Setup Database

The database schema is automatically created when you deploy. The SQL scripts run in order:
1. `scripts/001_create_database_schema.sql` - Creates tables and RLS policies
2. `scripts/002_create_profile_trigger.sql` - Auto-creates user profiles

### 6. Test Email Alerts

1. Log in to your account
2. Go to **Profile** page
3. Enable **Email Alerts** toggle
4. Click **Send Test Alert** button
5. Check your email inbox (and spam folder)

If the test alert fails:
- ✅ Verify `RESEND_API_KEY` is set in Vercel environment variables
- ✅ Check that the from email domain is verified (if using custom domain)
- ✅ Check browser console for error messages
- ✅ Verify you're using the correct Resend API key

## Email Configuration Troubleshooting

### Test Alert Returns "Email service not configured"
- **Solution**: Add `RESEND_API_KEY` to environment variables and redeploy

### Test Alert Returns "Failed to send email"
- **Cause 1**: Invalid API key
  - **Solution**: Verify the API key in Resend dashboard
- **Cause 2**: Unverified domain (if using custom domain)
  - **Solution**: Check DNS records in Resend dashboard
  - **Workaround**: Use `onboarding@resend.dev` temporarily

### Emails Land in Spam
- **Cause**: Using test domain `onboarding@resend.dev`
- **Solution**: Setup your own verified domain in Resend

### "Domain not found" Error
- **Cause**: Trying to use a domain that isn't verified in Resend
- **Solution**: Either verify the domain or use `onboarding@resend.dev`

## Cron Job Configuration

### For Vercel Hobby Plan (Default)
- Cron runs once per day at midnight UTC
- Configuration in `vercel.json`:
  ```json
  {
    "crons": [{
      "path": "/api/check-alerts",
      "schedule": "0 0 * * *"
    }]
  }
  ```
- Real-time monitoring compensates with instant alerts when dashboard is open

### For Vercel Pro Plan (Optional)
Edit `vercel.json` to run every 5 minutes:
```json
{
  "crons": [{
    "path": "/api/check-alerts",
    "schedule": "*/5 * * * *"
  }]
}
```

### Manual Trigger (Testing)
```bash
curl -X GET https://your-domain.vercel.app/api/check-alerts \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Architecture

### Dual Alert System

**1. Client-side Real-time Monitoring** (Primary)
- Runs when dashboard is open in browser
- WebSocket connections provide instant price updates
- Checks user subscriptions against live prices every 30 seconds
- Shows toast notifications immediately
- Records alerts in database
- Triggers email via `/api/send-immediate-alert`
- 5-minute cooldown between duplicate alerts

**2. Server-side Cron Job** (Backup)
- Runs daily (Hobby plan) or every 5 minutes (Pro plan)
- Checks all active subscriptions
- Sends emails for crashes detected while users are offline
- Anti-spam: Maximum 1 email per asset per 24 hours

### Security Features

- Row Level Security (RLS) on all database tables
- Cron job authorization via Bearer token
- Secure session management with HTTP-only cookies
- Environment variables for sensitive keys
- Email verification required for signup

## Tech Stack

- **Frontend**: Next.js 16, React 19, TailwindCSS v4
- **Backend**: Next.js API Routes (Edge Runtime)
- **Database**: Supabase (PostgreSQL with RLS)
- **Authentication**: Supabase Auth (Email/Password + Google OAuth)
- **Email**: Resend
- **Real-time Data**: 
  - OKX Public API (crypto derivatives - no key needed)
  - Binance Public API (crypto derivatives - no key needed)
  - Yahoo Finance API (stock prices, indices, FX, commodities - no key needed)
  - FRED API (macro indicators - free key required)
  - CoinGecko API (market data - no key needed, optional for higher limits)
  - Alternative.me API (Fear & Greed Index - no key needed)
  - Blockchain.com API (BTC on-chain data - no key needed)
  - DefiLlama API (stablecoin market cap, DeFi TVL - no key needed)

## Crypto Data Sources

| Source | API Key | Features | Rate Limit |
|--------|---------|----------|------------|
| **OKX** | Not needed | K线, 订单簿, Funding, OI, 多空比, CVD, 大户仓位 | 20 req/2s |
| **Binance** | Not needed | K线, Funding, OI, 多空比, 大户仓位, Taker Volume | 2400 req/min |
| **CoinGecko** | Optional | 价格, 市值, 成交量, ATH/ATL (无衍生品数据) | 10-30 req/min (free), 500 req/min (pro) |

**Recommended**: Use OKX or Binance for complete derivatives data. CoinGecko is only useful for market cap and ATH/ATL data.
  - DefiLlama API (stablecoin market cap, DeFi TVL)

## Investment Indicators

### Macro Indicators (30+)

| Category | Indicator | Source | Correlation to BTC |
|----------|-----------|--------|-------------------|
| **Rates** | Fed Funds Rate | FRED | High (inverse) |
| **Rates** | 10Y Treasury Yield | FRED | High (inverse) |
| **Rates** | 2Y Treasury Yield | FRED | Medium |
| **Rates** | 10Y TIPS Real Yield | FRED | High (inverse) |
| **Rates** | 10Y-2Y Spread | FRED | Medium |
| **Rates** | 10Y-3M Spread | FRED | Medium |
| **FX** | DXY (Dollar Index) | Yahoo | High (inverse) |
| **Inflation** | CPI (Headline) | FRED | Medium |
| **Inflation** | Core CPI | FRED | Medium |
| **Inflation** | PCE Price Index | FRED | Medium |
| **Inflation** | Core PCE | FRED | Medium |
| **Inflation** | 5Y Breakeven | FRED | Medium |
| **Inflation** | 10Y Breakeven | FRED | Medium |
| **Employment** | Unemployment Rate | FRED | Low |
| **Employment** | Nonfarm Payrolls | FRED | Low |
| **Employment** | Initial Jobless Claims | FRED | Low |
| **Liquidity** | Fed Balance Sheet | FRED | High |
| **Liquidity** | Bank Reserves | FRED | Medium |
| **Liquidity** | Reverse Repo (RRP) | FRED | High |
| **Liquidity** | Treasury TGA | FRED | High |
| **Liquidity** | M2 Money Supply | FRED | High |
| **Credit** | HY Credit Spread | FRED | High (inverse) |
| **Credit** | IG Credit Spread | FRED | Medium |
| **Credit** | Chicago Fed NFCI | FRED | High (inverse) |
| **Equity** | Nasdaq 100 | Yahoo | Very High |
| **Equity** | S&P 500 | Yahoo | High |
| **Equity** | SOX (Semiconductors) | Yahoo | High |
| **Volatility** | VIX | Yahoo | High (inverse) |
| **Growth** | GDPNow | FRED | Low |
| **Growth** | Retail Sales | FRED | Low |

### US Stock Indices

| Indicator | Source | Description |
|-----------|--------|-------------|
| Nasdaq Composite | Yahoo | Tech-heavy, high BTC correlation |
| Nasdaq 100 | Yahoo | Top 100 non-financial growth stocks |
| S&P 500 | Yahoo | Broad market benchmark |
| Dow Jones | Yahoo | 30 blue-chip value stocks |
| Russell 2000 | Yahoo | Small caps, rate sensitive |
| SOX (Semiconductors) | Yahoo | AI/tech cycle leader |

### China/HK Stock Indices

| Indicator | Source | Description |
|-----------|--------|-------------|
| Hang Seng Index | Yahoo | Hong Kong benchmark |
| H-Shares (HSCE) | Yahoo | HK-listed China enterprises |
| CSI 300 | Yahoo | A-share large caps |
| Shanghai Composite | Yahoo | A-share broad market |
| ChiNext | Yahoo | A-share growth stocks |
| KWEB ETF | Yahoo | China internet ADRs |

### BTC Derivatives Indicators (20)

| Category | Indicator | Source | Description |
|----------|-----------|--------|-------------|
| **Price** | BTC Spot Price | OKX | Real-time perpetual contract price |
| **Price** | Spot Price | OKX | Spot market price for basis calc |
| **Volatility** | 5m Return Z-Score | Calculated | Standardized 5-min price change |
| **Volatility** | Wick Ratio | Calculated | Upper/lower shadow percentage |
| **Volatility** | Volume Z-Score | Calculated | Standardized 1-min volume |
| **Derivatives** | Funding Rate | OKX | 8-hour funding payment rate |
| **Derivatives** | Open Interest | OKX | Total outstanding contracts |
| **Derivatives** | OI Change Rate | Calculated | 5-min OI change percentage |
| **Derivatives** | Perp Premium/Basis | Calculated | (Perp - Spot) / Spot |
| **Sentiment** | Long/Short Ratio (Account) | OKX | Account count ratio |
| **Sentiment** | Long/Short Ratio (Contract) | OKX | Position size ratio |
| **Sentiment** | Top Trader Account Ratio | OKX | Whale account L/S ratio |
| **Sentiment** | Top Trader Position Ratio | OKX | Whale position L/S ratio |
| **Order Book** | Bid/Ask Depth | OKX | Top 20 level depth |
| **Order Book** | Bid/Ask Ratio | Calculated | Bid depth / Ask depth |
| **Order Book** | Orderbook Imbalance | Calculated | (Bid - Ask) / Total |
| **Flow** | CVD (Cumulative Volume Delta) | OKX | Buy volume - Sell volume |
| **Flow** | Taker Buy/Sell Volume | OKX | Aggressive order flow |

### On-Chain Indicators

| Indicator | Source | Description |
|-----------|--------|-------------|
| BTC Hash Rate | Blockchain.com | Network security metric |
| Mining Difficulty | Blockchain.com | Bi-weekly adjustment |
| Active Addresses | Blockchain.com | Daily unique addresses |
| Transaction Count | Blockchain.com | Daily on-chain txs |
| On-chain Volume (USD) | Blockchain.com | Estimated transfer value |
| BTC Market Cap | Blockchain.com | Historical market cap |
| Stablecoin Market Cap | DefiLlama | Crypto "dry powder" |
| DeFi TVL | DefiLlama | On-chain capital locked |
| Fear & Greed Index | Alternative.me | Sentiment composite (0-100) |

### Indicator Priority Groups

**Daily Must-Watch (Priority 1-15)**
- Fed Funds Rate, 10Y/2Y Yields, Real Yield, DXY
- Nasdaq/S&P/VIX
- CPI, Core CPI, PCE

**Liquidity & Credit (Priority 16-30)**
- Fed Balance Sheet, RRP, TGA, M2
- HY/IG Credit Spreads, NFCI
- Yield Curve Spreads

**BTC Leverage Signals**
- Funding Rate, OI, OI Change Rate
- Long/Short Ratio, Top Trader Ratio
- Liquidations (when available)

**BTC Spike Detection**
- Return Z-Score, Wick Ratio, Volume Z-Score
- ATR, VWAP Deviation

**BTC Order Flow**
- Bid/Ask Ratio, Orderbook Imbalance
- Spread, CVD

**BTC Capital Flow**
- ETF Net Flow (paid API)
- Exchange Net Flow (paid API)
- Stablecoin Inflow

## API Endpoints

- `GET /api/stock-price?symbol=AAPL` - Fetch individual stock price
- `GET /api/check-alerts` - Check and send crash alerts (cron job)
- `POST /api/send-test-alert` - Send test alert to authenticated user
- `POST /api/send-immediate-alert` - Trigger immediate alert from client

## Default Alert Thresholds

- **Cryptocurrencies**: 5% drop in 15 minutes
- **Stocks**: 3% daily drop

Thresholds can be customized per subscription in the profile page.

## Usage

1. **Sign Up**: Create account with email/password or Google
2. **Verify Email**: Check inbox for confirmation (email/password only)
3. **Browse Markets**: View real-time crypto and stock prices on dashboard
4. **Subscribe**: Click bell icon on any asset to enable alerts
5. **Customize Thresholds**: Edit alert thresholds in profile page
6. **Enable Notifications**: Toggle email notifications in profile
7. **Test Alerts**: Click "Send Test Alert" to verify email delivery
8. **Receive Alerts**: 
   - Instant toast notifications while dashboard is open
   - Email notifications delivered within 1 minute

## Support

For issues with:
- **Email delivery**: Check Resend dashboard logs
- **Cron jobs**: Check Vercel deployment logs
- **Authentication**: Check Supabase Auth logs
- **Database**: Check Supabase table editor

## License

MIT
