// Calendar date (YYYY-MM-DD) in the user's own time zone. toISOString() would give the UTC
// date, which puts anything logged just after midnight in Sweden on the previous day.
export function toLocalDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
