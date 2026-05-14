/**
 * Internal helper for all macro data-source fetchers.
 *
 * - Adds a hard timeout so a single slow upstream cannot block `/api/macro`.
 * - Passes through Next.js `next: { revalidate }` for server-side caching.
 * - Returns `null` on any failure (HTTP error / timeout / abort) so callers can
 *   gracefully skip the indicator instead of throwing.
 */

// Tightened from 8s → 5s: macro fan-out blocks on the slowest upstream, so a
// lower ceiling caps cold-cache latency. Indicators that genuinely need >5s
// upstream simply get dropped from this page-load (allSettled handles it).
const DEFAULT_TIMEOUT_MS = 5000

export interface FetchJsonOptions {
  revalidate?: number
  timeoutMs?: number
  headers?: Record<string, string>
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T | null> {
  const { revalidate = 300, timeoutMs = DEFAULT_TIMEOUT_MS, headers } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      next: { revalidate },
    })

    if (!response.ok) return null

    return (await response.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
