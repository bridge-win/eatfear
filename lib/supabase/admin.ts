import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Server-only Supabase client using the service_role key. Bypasses RLS — use it
 * for privileged writes the user session cannot do (signal_events, alert fan-out,
 * Telegram chat binding). Never import this into client code.
 *
 * Returns null when unconfigured so callers degrade gracefully instead of
 * throwing at import time.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
