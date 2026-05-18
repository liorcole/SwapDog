/**
 * Formats a dog's age from ageYears + ageMonths into a human-readable string.
 *
 * Examples:
 *   0 years, 8 months → "8 months"
 *   1 year, 0 months  → "1 year"
 *   1 year, 6 months  → "1 year 6 months"
 *   2 years, 0 months → "2 years"
 *   2 years, 3 months → "2 years 3 months"
 */
export function formatDogAge(ageYears: number, ageMonths: number): string {
  const years = Math.max(0, Math.floor(ageYears));
  const months = Math.max(0, Math.floor(ageMonths));

  if (years === 0) {
    if (months <= 1) return '1 month';
    return `${months} months`;
  }

  const yearPart = years === 1 ? '1 year' : `${years} years`;
  if (months === 0) return yearPart;
  const monthPart = months === 1 ? '1 month' : `${months} months`;
  return `${yearPart} ${monthPart}`;
}
