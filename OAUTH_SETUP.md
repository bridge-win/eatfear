# Google OAuth Setup Instructions

To enable Google OAuth login, you need to configure Google OAuth in your Supabase project.

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Select "Web application"
6. Add authorized redirect URIs:
   - For development: `https://[YOUR_SUPABASE_PROJECT_REF].supabase.co/auth/v1/callback`
   - Replace `[YOUR_SUPABASE_PROJECT_REF]` with your Supabase project reference ID

## Step 2: Configure Supabase

1. Go to your Supabase Dashboard
2. Navigate to Authentication > Providers
3. Enable "Google" provider
4. Enter your Google Client ID and Client Secret from Step 1
5. Save the configuration

## Step 3: Update Site URL

1. In Supabase Dashboard, go to Authentication > URL Configuration
2. Add your production URL to "Site URL"
3. Add your development URL (e.g., `http://localhost:3000`) to "Redirect URLs"
4. Add `https://[YOUR_PRODUCTION_DOMAIN]/auth/callback` to "Redirect URLs"

## Step 4: Test

1. Click "Continue with Google" on the login or sign-up page
2. You should be redirected to Google's OAuth consent screen
3. After authorizing, you'll be redirected back to your dashboard

## Troubleshooting

- **"Error sending confirmation email"**: This error occurs when email confirmation is required but fails. Google OAuth bypasses email confirmation.
- **Redirect errors**: Make sure all URLs in both Google Console and Supabase match exactly
- **Provider not enabled**: Verify Google is enabled in Supabase Authentication settings

## Email Confirmation

With the new callback route at `/auth/callback`, email confirmations will now work properly. The callback route exchanges the confirmation code for a session and redirects users to the dashboard.
