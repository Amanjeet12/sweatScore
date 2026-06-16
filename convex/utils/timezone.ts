export const DEFAULT_TZ = 'UTC';

export function formatDateInTZ(date: Date, timezone?: string | null): string {
  const tz = timezone || DEFAULT_TZ;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

export function getMondayInTZ(date: Date, timezone?: string | null): Date {
  const ymd = formatDateInTZ(date, timezone);
  const [y, m, d] = ymd.split('-').map(Number);
  const utcDay = new Date(Date.UTC(y, m - 1, d));
  const dow = utcDay.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  utcDay.setUTCDate(utcDay.getUTCDate() + offset);
  return utcDay;
}

export function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function ymdUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
