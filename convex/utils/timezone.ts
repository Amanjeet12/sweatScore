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

function getDateTimePartsInTZ(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    second: getPart('second'),
  };
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const parts = getDateTimePartsInTZ(date, timezone);

  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  const timestampWithoutMilliseconds = Math.floor(date.getTime() / 1000) * 1000;

  return representedAsUtc - timestampWithoutMilliseconds;
}

function localMidnightToUtcTimestamp(
  year: number,
  month: number,
  day: number,
  timezone: string
): number {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);

  const firstOffset = getTimezoneOffsetMs(new Date(utcGuess), timezone);

  let timestamp = utcGuess - firstOffset;

  // Recalculate once to handle daylight-saving timezone changes.
  const correctedOffset = getTimezoneOffsetMs(new Date(timestamp), timezone);

  timestamp = utcGuess - correctedOffset;

  return timestamp;
}

export function getNextMidnightTimestamp(
  date: Date = new Date(),
  timezone?: string | null
): number {
  const tz = timezone || DEFAULT_TZ;

  const currentLocalDate = getDateTimePartsInTZ(date, tz);

  const nextDate = new Date(
    Date.UTC(currentLocalDate.year, currentLocalDate.month - 1, currentLocalDate.day + 1)
  );

  return localMidnightToUtcTimestamp(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth() + 1,
    nextDate.getUTCDate(),
    tz
  );
}
