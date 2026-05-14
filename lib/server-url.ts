import { headers } from "next/headers"

/**
 * Compute the absolute base URL for hitting our own API routes from a
 * server component. Order of preference:
 *   1. NEXT_PUBLIC_SITE_URL — explicit override
 *   2. The request host header (works in dev + behind proxies)
 *   3. VERCEL_URL — production fallback
 *   4. http://localhost:3000 — last-resort dev fallback
 */
export async function getServerBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL

  try {
    const h = await headers()
    const host = h.get("x-forwarded-host") ?? h.get("host")
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
      return `${proto}://${host}`
    }
  } catch {
    // headers() throws outside a request scope — fall through
  }

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}
