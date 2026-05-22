export function formatRelevanceScore(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) return ""
  return `R${Math.round(score)}`
}

export function withRelevanceScore(label: string, score: number | null | undefined): string {
  const formatted = formatRelevanceScore(score)
  return formatted ? `${label} · ${formatted}` : label
}
