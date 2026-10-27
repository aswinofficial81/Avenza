export const MINIMUM_DAILY_FOCUS_MINUTES = 15;

export interface ProductivityStreakSession {
  ended_at: string | null;
  actual_minutes: number | null;
}

export interface CalculateProductivityStreakInput {
  targetDate: string;
  timezone: string;
  completedTaskTimestamps: Array<string | null>;
  completedFocusSessions: ProductivityStreakSession[];
}

export interface ProductivityStreakSummary {
  currentDays: number;
  bestDays: number;
  qualifiesToday: boolean;
  qualifiesYesterday: boolean;
  todayFocusMinutes: number;
  todayCompletedTaskCount: number;
  minimumFocusMinutes: number;
}

/**
 * Convert an ISO timestamp to a calendar date in the user's timezone.
 * Returns YYYY-MM-DD, or null if the timestamp/timezone is invalid.
 */
function localDateOf(
  timestamp: string,
  timezone: string
): string | null {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const values: Record<string, string> = {};

    for (const part of parts) {
      values[part.type] = part.value;
    }

    const year = values['year'];
    const month = values['month'];
    const day = values['day'];

    if (!year || !month || !day) {
      return null;
    }

    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

/**
 * Shift a YYYY-MM-DD calendar date by whole days without relying on
 * the server's local timezone.
 */
function shiftDate(date: string, amount: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    throw new Error(`Invalid calendar date: ${date}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const shifted = new Date(
    Date.UTC(year, month - 1, day + amount)
  );

  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    String(shifted.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * A day qualifies when the user:
 * - completes at least one task, OR
 * - completes focus sessions totalling at least 15 minutes.
 *
 * Current streak remains visible during today if yesterday qualified,
 * even when the user has not been productive yet today.
 */
export function calculateProductivityStreak(
  input: CalculateProductivityStreakInput
): ProductivityStreakSummary {
  const {
    targetDate,
    timezone,
    completedTaskTimestamps,
    completedFocusSessions,
  } = input;

  // Validate the target calendar date and timezone before calculating.
  if (localDateOf(`${targetDate}T12:00:00.000Z`, 'UTC') !== targetDate) {
    throw new Error(`Invalid target date: ${targetDate}`);
  }

  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
  } catch {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  const completedTasksByDate = new Map<string, number>();
  const focusMinutesByDate = new Map<string, number>();

  // Count completed tasks on their completion dates.
  for (const timestamp of completedTaskTimestamps) {
    if (!timestamp) {
      continue;
    }

    const date = localDateOf(timestamp, timezone);

    if (!date) {
      continue;
    }

    completedTasksByDate.set(
      date,
      (completedTasksByDate.get(date) ?? 0) + 1
    );
  }

  // Sum completed focus minutes by the date the session ended.
  for (const session of completedFocusSessions) {
    if (!session.ended_at || session.actual_minutes == null) {
      continue;
    }

    if (
      !Number.isFinite(session.actual_minutes) ||
      session.actual_minutes <= 0
    ) {
      continue;
    }

    const date = localDateOf(session.ended_at, timezone);

    if (!date) {
      continue;
    }

    focusMinutesByDate.set(
      date,
      (focusMinutesByDate.get(date) ?? 0) + session.actual_minutes
    );
  }

  // Build a set containing every qualifying productive day.
  const activityDates = new Set<string>();

  for (const [date, taskCount] of completedTasksByDate) {
    if (taskCount > 0) {
      activityDates.add(date);
    }
  }

  for (const [date, focusMinutes] of focusMinutesByDate) {
    if (focusMinutes >= MINIMUM_DAILY_FOCUS_MINUTES) {
      activityDates.add(date);
    }
  }

  const yesterday = shiftDate(targetDate, -1);
  const qualifiesToday = activityDates.has(targetDate);
  const qualifiesYesterday = activityDates.has(yesterday);

  // If today is not productive yet, keep yesterday's streak active
  // until the current local day has finished.
  const streakAnchor = qualifiesToday
    ? targetDate
    : qualifiesYesterday
      ? yesterday
      : null;

  let currentDays = 0;

  if (streakAnchor) {
    let date = streakAnchor;

    while (activityDates.has(date)) {
      currentDays++;
      date = shiftDate(date, -1);
    }
  }

  // Calculate the longest consecutive productive-day run in history.
  const sortedDates = [...activityDates].sort();

  let bestDays = 0;
  let consecutiveDays = 0;
  let previousDate: string | null = null;

  for (const date of sortedDates) {
    if (
      previousDate !== null &&
      shiftDate(previousDate, 1) === date
    ) {
      consecutiveDays++;
    } else {
      consecutiveDays = 1;
    }

    bestDays = Math.max(bestDays, consecutiveDays);
    previousDate = date;
  }

  return {
    currentDays,
    bestDays,
    qualifiesToday,
    qualifiesYesterday,
    todayFocusMinutes: focusMinutesByDate.get(targetDate) ?? 0,
    todayCompletedTaskCount:
      completedTasksByDate.get(targetDate) ?? 0,
    minimumFocusMinutes: MINIMUM_DAILY_FOCUS_MINUTES,
  };
}