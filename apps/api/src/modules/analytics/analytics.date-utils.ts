import {
  getUtcInstantForLocalTime,
  isValidTimezone,
} from '../today/today.date-utils';
import type { AnalyticsDateRange, AnalyticsDayBucket } from './analytics.types';

export function resolveAnalyticsDateRange(
  startDate: string,
  endDate: string,
  timeZonePreference?: string | null,
  now: Date = new Date()
): AnalyticsDateRange {
  const timeZone =
    timeZonePreference && isValidTimezone(timeZonePreference)
      ? timeZonePreference
      : 'UTC';

  const sParts = startDate.split('-').map(Number);
  const sY = sParts[0] ?? 1970;
  const sM = sParts[1] ?? 1;
  const sD = sParts[2] ?? 1;

  const eParts = endDate.split('-').map(Number);
  const eY = eParts[0] ?? 1970;
  const eM = eParts[1] ?? 1;
  const eD = eParts[2] ?? 1;

  // Local midnight of startDate
  const startUtcDate = getUtcInstantForLocalTime(sY, sM, sD, 0, 0, 0, 0, timeZone);

  // Local midnight immediately after endDate (i.e. start of next calendar day)
  const nextDayAfterEnd = new Date(Date.UTC(eY, eM - 1, eD + 1));
  const endUtcDate = getUtcInstantForLocalTime(
    nextDayAfterEnd.getUTCFullYear(),
    nextDayAfterEnd.getUTCMonth() + 1,
    nextDayAfterEnd.getUTCDate(),
    0,
    0,
    0,
    0,
    timeZone
  );

  // Generate daily buckets from startDate through endDate
  const dayBuckets: AnalyticsDayBucket[] = [];
  let dayOffset = 0;

  while (true) {
    const curCal = new Date(Date.UTC(sY, sM - 1, sD + dayOffset));
    const nextCal = new Date(Date.UTC(sY, sM - 1, sD + dayOffset + 1));

    const curY = curCal.getUTCFullYear();
    const curM = curCal.getUTCMonth() + 1;
    const curD = curCal.getUTCDate();

    const localDateStr = `${curY}-${String(curM).padStart(2, '0')}-${String(curD).padStart(2, '0')}`;

    const bStart = getUtcInstantForLocalTime(curY, curM, curD, 0, 0, 0, 0, timeZone);
    const bEnd = getUtcInstantForLocalTime(
      nextCal.getUTCFullYear(),
      nextCal.getUTCMonth() + 1,
      nextCal.getUTCDate(),
      0,
      0,
      0,
      0,
      timeZone
    );

    dayBuckets.push({
      date: localDateStr,
      startUtc: bStart.toISOString(),
      endUtc: bEnd.toISOString(),
    });

    if (localDateStr === endDate || dayOffset > 400) {
      break;
    }
    dayOffset++;
  }

  return {
    startDate,
    endDate,
    timeZone,
    startUtc: startUtcDate.toISOString(),
    endUtc: endUtcDate.toISOString(),
    asOf: now.toISOString(),
    dayBuckets,
  };
}
