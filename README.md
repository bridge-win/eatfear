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

Click the "Publish" button in v0 to deploy your app to Vercel.

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
  - Binance WebSocket API (crypto prices)
  - Yahoo Finance API (stock prices)
  - Alternative.me API (Fear & Greed Index)
  - CoinGecko API (market statistics)

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
