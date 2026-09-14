/**
 * One attention scale for every dashboard number.
 *   ok    = healthy / nothing unusual        (green)
 *   watch = worth attention                  (amber)
 *   alert = abnormal or actionable extreme   (red)
 * The scale is about attention, not direction: a screaming buy signal and a
 * liquidation cascade are both "alert" because both need a human to look now.
 */
export type Tone = "ok" | "watch" | "alert"

export const TONE_TEXT: Record<Tone, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  watch: "text-amber-600 dark:text-amber-400",
  alert: "text-red-600 dark:text-red-400",
}
export const TONE_BADGE: Record<Tone, string> = {
  ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  watch: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  alert: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
}
export const TONE_BAR: Record<Tone, string> = {
  ok: "border-t-emerald-500/60",
  watch: "border-t-amber-500/70",
  alert: "border-t-red-500/70",
}
export const TONE_LABEL: Record<Tone, { zh: string; en: string }> = {
  ok: { zh: "健康", en: "OK" },
  watch: { zh: "关注", en: "Watch" },
  alert: { zh: "警示", en: "Alert" },
}

/** 0–100 stress-style scores (crowding, cascade, extension, exhaustion, opportunity): higher = more extreme. */
export function stressTone(score: number | null | undefined, watchAt = 35, alertAt = 65): Tone {
  if (score === null || score === undefined || !Number.isFinite(score)) return "ok"
  if (score >= alertAt) return "alert"
  if (score >= watchAt) return "watch"
  return "ok"
}

/** Signed setup scores (−100…+100): magnitude is what needs attention. */
export function signedTone(score: number | null | undefined): Tone {
  return stressTone(score === null || score === undefined ? null : Math.abs(score), 30, 60)
}

/** Regime-style scores where the middle is calm and both tails deserve a look. */
export function regimeTone(score: number | null | undefined, calmBand = 15, extremeBand = 35): Tone {
  if (score === null || score === undefined || !Number.isFinite(score)) return "ok"
  const d = Math.abs(score - 50)
  return d >= extremeBand ? "alert" : d >= calmBand ? "watch" : "ok"
}

/** Zone scores used by valuation sub-metrics (0 = extreme greed … 100 = extreme fear). */
export function zoneTone(score: number | null | undefined): Tone {
  if (score === null || score === undefined || !Number.isFinite(score)) return "ok"
  return score >= 85 || score <= 15 ? "alert" : score >= 65 || score <= 35 ? "watch" : "ok"
}
