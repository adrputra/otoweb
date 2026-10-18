/** Display helpers shared by the analytics read surface. */

/** One-decimal percentage used by the dashboard conversion metric. */
export function formatConversionPercent(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  return `${safe.toFixed(1)}%`
}
