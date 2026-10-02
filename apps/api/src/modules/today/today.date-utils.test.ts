import { describe, it, expect } from 'vitest';
import {
  getTodayBoundaries,
  getCurrentLocalDateString,
  getUtcInstantForLocalTime,
  isValidTimezone,
  isBeforeIso,
  isWithinIntervalIso,
} from './today.date-utils';

describe('today.date-utils', () => {
  describe('isValidTimezone', () => {
    it('recognizes valid IANA timezones', () => {
      expect(isValidTimezone('Asia/Kolkata')).toBe(true);
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
    });

    it('rejects invalid timezones', () => {
      expect(isValidTimezone('Invalid/Zone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
      expect(isValidTimezone(null as unknown as string)).toBe(false);
    });
  });

  describe('getCurrentLocalDateString', () => {
    it('formats date correctly across timezones', () => {
      // 2026-10-02 20:00:00 UTC is:
      // 2026-10-03 01:30:00 in Asia/Kolkata (+5:30)
      // 2026-10-02 16:00:00 in America/New_York (-4:00)
      const instant = new Date('2026-10-02T20:00:00.000Z');

      const kolkataDate = getCurrentLocalDateString(instant, 'Asia/Kolkata');
      expect(kolkataDate).toBe('2026-10-03');

      const nyDate = getCurrentLocalDateString(instant, 'America/New_York');
      expect(nyDate).toBe('2026-10-02');

      const utcDate = getCurrentLocalDateString(instant, 'UTC');
      expect(utcDate).toBe('2026-10-02');
    });
  });

  describe('getUtcInstantForLocalTime', () => {
    it('converts Asia/Kolkata midnight to UTC 18:30 of previous day', () => {
      // Target: 2026-10-03 00:00:00 in Asia/Kolkata (+05:30)
      const utc = getUtcInstantForLocalTime(2026, 10, 3, 0, 0, 0, 0, 'Asia/Kolkata');
      expect(utc.toISOString()).toBe('2026-10-02T18:30:00.000Z');
    });

    it('converts America/New_York midnight to UTC 04:00 (EDT)', () => {
      // Target: 2026-10-03 00:00:00 in America/New_York (-04:00 in Oct)
      const utc = getUtcInstantForLocalTime(2026, 10, 3, 0, 0, 0, 0, 'America/New_York');
      expect(utc.toISOString()).toBe('2026-10-03T04:00:00.000Z');
    });

    it('converts UTC midnight to UTC 00:00', () => {
      const utc = getUtcInstantForLocalTime(2026, 10, 3, 0, 0, 0, 0, 'UTC');
      expect(utc.toISOString()).toBe('2026-10-03T00:00:00.000Z');
    });
  });

  describe('getTodayBoundaries', () => {
    it('calculates exact start, end, and 7-day upcoming window for Asia/Kolkata', () => {
      const boundaries = getTodayBoundaries('2026-10-03', 'Asia/Kolkata');

      expect(boundaries.localDate).toBe('2026-10-03');
      expect(boundaries.timeZone).toBe('Asia/Kolkata');
      expect(boundaries.startOfToday).toBe('2026-10-02T18:30:00.000Z');
      expect(boundaries.endOfToday).toBe('2026-10-03T18:29:59.999Z');
      // 7 days after Oct 3 is Oct 10 23:59:59.999 IST -> Oct 10 18:29:59.999Z
      expect(boundaries.endOfUpcoming).toBe('2026-10-10T18:29:59.999Z');
    });

    it('falls back to UTC when timezone is missing or invalid', () => {
      const boundaries = getTodayBoundaries('2026-10-03', 'Invalid/Timezone');
      expect(boundaries.timeZone).toBe('UTC');
      expect(boundaries.startOfToday).toBe('2026-10-03T00:00:00.000Z');
      expect(boundaries.endOfToday).toBe('2026-10-03T23:59:59.999Z');
      expect(boundaries.endOfUpcoming).toBe('2026-10-10T23:59:59.999Z');
    });
  });

  describe('isBeforeIso and isWithinIntervalIso', () => {
    it('correctly compares ISO timestamps', () => {
      const start = '2026-10-02T18:30:00.000Z';
      const end = '2026-10-03T18:29:59.999Z';

      expect(isBeforeIso('2026-10-02T18:29:59.000Z', start)).toBe(true);
      expect(isBeforeIso('2026-10-02T18:30:00.000Z', start)).toBe(false);

      expect(isWithinIntervalIso('2026-10-02T18:30:00.000Z', start, end)).toBe(true);
      expect(isWithinIntervalIso('2026-10-03T00:00:00.000Z', start, end)).toBe(true);
      expect(isWithinIntervalIso('2026-10-03T18:29:59.999Z', start, end)).toBe(true);
      expect(isWithinIntervalIso('2026-10-03T18:30:00.000Z', start, end)).toBe(false);
    });
  });
});
