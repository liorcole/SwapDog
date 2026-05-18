/**
 * Calculate points cost for a swap based on coverage dates.
 * - Same day (start === end) = 0.5 points (half day)
 * - N nights apart = N points (e.g. May 1 → May 3 = 2 points)
 */
export function calculatePoints(startDate: Date, endDate: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  // Normalize to midnight to avoid DST/time-of-day drift
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  const diffDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);

  if (diffDays <= 0) {
    // Same day or invalid range → half day
    return 0.5;
  }

  return diffDays; // 1 night = 1 point, 2 nights = 2 points, etc.
}
