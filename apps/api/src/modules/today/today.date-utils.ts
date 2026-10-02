/**
 * Timezone and local calendar day calculation utilities for the Today execution surface.
 * Deterministic, robust, and zero-external-dependency using Node.js Intl API.
 */

export interface TodayDateBoundaries {
  localDate: string; // "YYYY-MM-DD"
  timeZone: string; // e.g. "Asia/Kolkata"
  startOfToday: string; // ISO string in UTC e.g. "2026-10-02T18:30:00.000Z"
  endOfToday: string; // ISO string in UTC e.g. "2026-10-03T18:29:59.999Z"
  endOfUpcoming: string; // ISO string in UTC (end of 7th day)
}

/**
 * Validates whether an IANA timezone string is recognized by Intl.
 */
export function isValidTimezone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the current calendar date in the specified timezone formatted as YYYY-MM-DD.
 */
export function getCurrentLocalDateString(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Converts a target local date and time in a specified timezone into the exact UTC Date instant.
 * Uses an offset convergence method to handle fractional hour offsets (+05:30) and daylight saving shifts.
 */
export function getUtcInstantForLocalTime(
  year: number,
  month: number, // 1-indexed (1 = Jan, 12 = Dec)
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string
): Date {
  // Initial guess in UTC:
  const guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(new Date(guessUtcMs));
  let pYear = year;
  let pMonth = month;
  let pDay = day;
  let pHour = hour;
  let pMinute = minute;
  let pSecond = second;

  for (const p of parts) {
    if (p.type === 'year') pYear = parseInt(p.value, 10);
    if (p.type === 'month') pMonth = parseInt(p.value, 10);
    if (p.type === 'day') pDay = parseInt(p.value, 10);
    if (p.type === 'hour') pHour = parseInt(p.value, 10);
    if (p.type === 'minute') pMinute = parseInt(p.value, 10);
    if (p.type === 'second') pSecond = parseInt(p.value, 10);
  }

  const localGuessMs = Date.UTC(pYear, pMonth - 1, pDay, pHour, pMinute, pSecond, millisecond);
  const offset = localGuessMs - guessUtcMs;

  const exactUtcMs = guessUtcMs - offset;
  return new Date(exactUtcMs);
}

/**
 * Computes deterministic boundaries for a target local date in a specified timezone.
 * Returns ISO strings for startOfToday (00:00:00.000), endOfToday (23:59:59.999),
 * and endOfUpcoming (end of 7th day: +7 days 23:59:59.999).
 */
export function getTodayBoundaries(
  targetDateStr?: string,
  timeZonePreference?: string | null,
  now: Date = new Date()
): TodayDateBoundaries {
  const timeZone =
    timeZonePreference && isValidTimezone(timeZonePreference) ? timeZonePreference : 'UTC';

  const localDate =
    targetDateStr && /^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)
      ? targetDateStr
      : getCurrentLocalDateString(now, timeZone);

  const parts = localDate.split('-');
  const year = parseInt(parts[0] || '2026', 10);
  const month = parseInt(parts[1] || '1', 10);
  const day = parseInt(parts[2] || '1', 10);

  // Start of target day: 00:00:00.000
  const startOfTodayDate = getUtcInstantForLocalTime(year, month, day, 0, 0, 0, 0, timeZone);

  // End of target day: 23:59:59.999
  const endOfTodayDate = getUtcInstantForLocalTime(year, month, day, 23, 59, 59, 999, timeZone);

  // 7 days ahead for upcoming horizon:
  const upcomingCalDate = new Date(Date.UTC(year, month - 1, day + 7));
  const upYear = upcomingCalDate.getUTCFullYear();
  const upMonth = upcomingCalDate.getUTCMonth() + 1;
  const upDay = upcomingCalDate.getUTCDate();

  const endOfUpcomingDate = getUtcInstantForLocalTime(
    upYear,
    upMonth,
    upDay,
    23,
    59,
    59,
    999,
    timeZone
  );

  return {
    localDate,
    timeZone,
    startOfToday: startOfTodayDate.toISOString(),
    endOfToday: endOfTodayDate.toISOString(),
    endOfUpcoming: endOfUpcomingDate.toISOString(),
  };
}

/**
 * Checks if an ISO timestamp is strictly before the given boundary.
 */
export function isBeforeIso(timestamp: string | null | undefined, boundaryIso: string): boolean {
  if (!timestamp) return false;
  return new Date(timestamp).getTime() < new Date(boundaryIso).getTime();
}

/**
 * Checks if an ISO timestamp is within [startIso, endIso] inclusive.
 */
export function isWithinIntervalIso(
  timestamp: string | null | undefined,
  startIso: string,
  endIso: string
): boolean {
  if (!timestamp) return false;
  const time = new Date(timestamp).getTime();
  return time >= new Date(startIso).getTime() && time <= new Date(endIso).getTime();
}
