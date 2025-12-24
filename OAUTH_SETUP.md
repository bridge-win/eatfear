# Google OAuth Setup Instructions

## Quick Fix for Current Error

The error `Unable to exchange external code` means the redirect URL configuration doesn't match between Google Console and Supabase. Follow these exact steps:

## Step 1: Get Your Supabase Callback URL

Your Supabase OAuth callback URL is:
```
https://[YOUR_SUPABASE_PROJECT_REF].supabase.co/auth/v1/callback
```

To find your project ref:
1. Go to your Supabase Dashboard
2. Look at the URL: `https://supabase.com/dashboard/project/[YOUR_PROJECT_REF]`
3. Or go to Settings > API, and find your project URL

## Step 2: Configure Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. If prompted, configure the OAuth consent screen first
6. Select "Web application" as application type
7. Add **Authorized JavaScript origins**:
   - `http://localhost:3000` (for local development)
   - `https://yourdomain.com` (your production domain)
8. Add **Authorized redirect URIs** (IMPORTANT - must be exact):
   - `https://[YOUR_SUPABASE_PROJECT_REF].supabase.co/auth/v1/callback`
   - Example: `https://abcdefghijklmnop.supabase.co/auth/v1/callback`
9. Click "Create" and copy the Client ID and Client Secret

## Step 3: Enable Google Provider in Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** > **Providers**
4. Find "Google" and toggle it to **Enabled**
5. Paste your Google **Client ID** 
6. Paste your Google **Client Secret**
7. Click **Save**

## Step 4: Configure Redirect URLs in Supabase

1. In Supabase Dashboard, go to **Authentication** > **URL Configuration**
2. Set **Site URL** to your production domain:
   - Production: `https://yourdomain.com`
   - Or use your Vercel URL: `https://your-app.vercel.app`
3. Add **Redirect URLs** (one per line):
   ```
   http://localhost:3000/auth/callback
   https://yourdomain.com/auth/callback
   https://your-app.vercel.app/auth/callback
   ```
4. Click **Save**

## Step 5: Set Environment Variable (Optional)

For local development, you can set this environment variable:
```
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback
```

This helps with local testing.

## Step 6: Test the Integration

1. Clear your browser cache and cookies
2. Go to your login page
3. Click "Continue with Google"
4. You should see Google's consent screen
5. After authorizing, you should be redirected to `/dashboard`

## Common Issues & Solutions

### Issue: "Unable to exchange external code"
**Solution**: The redirect URL in Google Console doesn't match Supabase's callback URL.
- Double-check Step 2, item 8 - the URL must be EXACTLY: `https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback`
- No trailing slashes, no extra parameters

### Issue: "Error sending confirmation email"
**Solution**: This only affects email/password signup. Google OAuth bypasses email confirmation.
- The callback route at `/auth/callback` now handles email confirmations properly
- For email signups, users will receive a confirmation email and the callback will work

### Issue: OAuth redirects to wrong domain
**Solution**: Check your Site URL in Supabase
- Go to Authentication > URL Configuration
- Make sure Site URL matches your actual domain

### Issue: "Provider not enabled"
**Solution**: Google provider is not enabled in Supabase
- Go to Authentication > Providers
- Toggle Google to enabled
- Add Client ID and Secret

## Testing Checklist

- [ ] Google OAuth credentials created with correct redirect URI
- [ ] Google provider enabled in Supabase with Client ID and Secret
- [ ] Redirect URLs configured in Supabase URL Configuration
- [ ] Site URL set correctly in Supabase
- [ ] Cleared browser cache
- [ ] Tested "Continue with Google" button
- [ ] Successfully redirected to dashboard after login

## Production Deployment

When deploying to production:
1. Add your production domain to Google Console authorized origins and redirect URIs
2. Update Supabase Site URL to your production domain
3. Add production callback URL to Supabase Redirect URLs
4. The `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` variable is only for local development
