# CrashWatch - Real-time Market Monitoring System

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

## Environment Variables

Required environment variables:

```bash
# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Email Service (Resend)
RESEND_API_KEY=your_resend_api_key

# Cron Job Security
CRON_SECRET=your_random_secret_string

# App URL (optional, for development redirects)
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000
```

### Adding Environment Variables

Add the following environment variables in the **Vars** section of the in-chat sidebar:

1. **RESEND_API_KEY**: Get from [Resend.com](https://resend.com) after signing up
2. **CRON_SECRET**: Generate a random string (e.g., `openssl rand -base64 32`)

## Setup Instructions

### 1. Database Setup

Run the SQL scripts in order from the Scripts panel:
1. `scripts/001_create_database_schema.sql` - Creates tables and RLS policies
2. `scripts/002_create_profile_trigger.sql` - Auto-creates user profiles

### 2. Email Configuration

1. Sign up for [Resend](https://resend.com)
2. Add your domain or use their test domain (`onboarding@resend.dev`)
3. Get your API key and add to environment variables in Vars section
4. Update the `from` email in both:
   - `/app/api/check-alerts/route.ts`
   - `/app/api/send-immediate-alert/route.ts`
   
   Example: Change `alerts@crashwatch.app` to your verified domain

### 3. Cron Job Setup

The system uses a **hybrid alert approach**:

#### For Hobby Plan Users (Default)
- Cron runs every 6 hours: `0 */6 * * *`
- Real-time monitoring when dashboard is open
- Instant toast notifications in browser

#### For Pro Plan Users (Optional)
Edit `vercel.json` to run every 5 minutes:
```json
{
  "crons": [
    {
      "path": "/api/check-alerts",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

To manually trigger alerts:
```bash
curl -X GET https://your-domain.com/api/check-alerts \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 4. Testing Alerts

Users can send a test alert from their profile page to verify email delivery.

## Tech Stack

- **Frontend**: Next.js 16, React 19, TailwindCSS v4
- **Backend**: Next.js API Routes (Edge Runtime)
- **Database**: Supabase (PostgreSQL with RLS)
- **Authentication**: Supabase Auth with email/password
- **Email**: Resend
- **Real-time Data**: 
  - Binance WebSocket API (crypto prices)
  - Yahoo Finance API (stock prices)
  - Alternative.me API (Fear & Greed Index)
  - CoinGecko API (market statistics)

## API Endpoints

- `GET /api/stock-price?symbol=AAPL` - Fetch individual stock price
- `GET /api/check-alerts` - Check and send crash alerts (cron job)
- `POST /api/send-test-alert` - Send test alert to authenticated user
- `POST /api/send-immediate-alert` - Trigger immediate alert from client

## Architecture

### Dual Alert System

**1. Client-side Real-time Monitoring** (Primary)
- Runs when user has dashboard open
- WebSocket connections provide instant price updates
- Checks user subscriptions against live prices
- Shows toast notifications immediately
- Records alerts in database
- Triggers email via `/api/send-immediate-alert`
- 5-minute cooldown between same alerts

**2. Server-side Cron Job** (Backup)
- Runs every 6 hours (Hobby) or 5 minutes (Pro)
- Checks all active subscriptions
- Sends emails for crashes detected
- Anti-spam: Max 1 email per asset per 24 hours

### Crash Detection System

1. **Real-time Monitoring**: WebSocket connections track price changes
2. **Historical Analysis**: Price history stored for 15-minute and 24-hour crash detection
3. **Alert Triggers**: Compares current prices against user-defined thresholds
4. **Toast Notifications**: Instant in-app alerts with Radix UI Toast
5. **Email Delivery**: Professional HTML emails sent via Resend
6. **Anti-spam**: Maximum 1 alert per asset per 24 hours

### Security

- Row Level Security (RLS) on all database tables
- Server-side API key management
- Cron job authorization via Bearer token
- Secure session management with HTTP-only cookies
- Email verification required for signup

## Usage

1. **Sign Up**: Create account with email/password
2. **Verify Email**: Check inbox for confirmation email
3. **Browse Markets**: View real-time crypto and stock prices
4. **Subscribe**: Click bell icon on assets you want to monitor
5. **Customize**: Set alert thresholds in profile settings
6. **Enable Notifications**: Toggle email notifications in profile
7. **Receive Alerts**: 
   - Toast notifications while dashboard is open
   - Email notifications when away

## Default Alert Thresholds

- **Cryptocurrencies**: 5% drop in 15 minutes
- **Stocks**: 3% daily drop

These can be customized per subscription in the profile page.

## Crash Detection Rules

- **15-minute crashes**: Price drops > 3% in 15 minutes (crypto only)
- **24-hour crashes**: Price drops > 10% in 24 hours (crypto and stocks)
- **Visual alerts**: Red banner at top of dashboard when crashes detected

## License

MIT
