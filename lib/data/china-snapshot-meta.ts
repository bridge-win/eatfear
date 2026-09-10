/**
 * Snapshot dates, duplicated as literals so client components can show them
 * without importing the snapshot JSON itself — `china-official-snapshot.ts`
 * pulls in ~140KB of observations that the browser has no use for.
 *
 * `lib/china-snapshot-meta.test.ts` asserts these stay in sync with the JSON,
 * so a stale literal fails CI rather than quietly mislabelling the dashboard.
 */
export const CHINA_SNAPSHOT_AS_OF = "2026-09-09"
export const CHINA_MANUAL_SNAPSHOT_AS_OF = "2026-09-10"
