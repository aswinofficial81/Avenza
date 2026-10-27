import { describe, expect, it } from 'vitest';
import { calculateProductivityStreak } from './productivity-streak';

describe('calculateProductivityStreak', () => {
    const base = {
        targetDate: '2026-10-27',
        timezone: 'UTC',
        completedTaskTimestamps: [] as Array<string | null>,
        completedFocusSessions: [] as Array<{
            ended_at: string | null;
            actual_minutes: number | null;
        }>,
    };

    it('qualifies a day when at least one task is completed', () => {
        const result = calculateProductivityStreak({
            ...base,
            completedTaskTimestamps: [
                '2026-10-27T12:00:00.000Z',
            ],
        });

        expect(result.qualifiesToday).toBe(true);
        expect(result.todayCompletedTaskCount).toBe(1);
        expect(result.currentDays).toBe(1);
        expect(result.bestDays).toBe(1);
    });

    it('qualifies a day when completed focus sessions total 15 minutes', () => {
        const result = calculateProductivityStreak({
            ...base,
            completedFocusSessions: [
                {
                    ended_at: '2026-10-27T10:00:00.000Z',
                    actual_minutes: 8,
                },
                {
                    ended_at: '2026-10-27T10:30:00.000Z',
                    actual_minutes: 7,
                },
            ],
        });

        expect(result.todayFocusMinutes).toBe(15);
        expect(result.qualifiesToday).toBe(true);
        expect(result.currentDays).toBe(1);
    });

    it('does not qualify a day with less than 15 focus minutes and no completed task', () => {
        const result = calculateProductivityStreak({
            ...base,
            completedFocusSessions: [
                {
                    ended_at: '2026-10-27T10:00:00.000Z',
                    actual_minutes: 14,
                },
            ],
        });

        expect(result.qualifiesToday).toBe(false);
        expect(result.currentDays).toBe(0);
        expect(result.bestDays).toBe(0);
    });

    it('keeps yesterday’s streak active when today has no activity yet', () => {
        const result = calculateProductivityStreak({
            ...base,
            completedTaskTimestamps: [
                '2026-10-25T12:00:00.000Z',
                '2026-10-26T12:00:00.000Z',
            ],
        });

        expect(result.qualifiesToday).toBe(false);
        expect(result.qualifiesYesterday).toBe(true);
        expect(result.currentDays).toBe(2);
        expect(result.bestDays).toBe(2);
    });

    it('starts a new streak after a missed day but preserves the best streak', () => {
        const result = calculateProductivityStreak({
            ...base,
            completedTaskTimestamps: [
                '2026-10-22T12:00:00.000Z',
                '2026-10-23T12:00:00.000Z',
                // October 24 was missed.
                '2026-10-25T12:00:00.000Z',
                '2026-10-27T12:00:00.000Z',
            ],
        });

        expect(result.currentDays).toBe(1);
        expect(result.bestDays).toBe(2);
    });

    it('uses the configured timezone to determine the productive day', () => {
        const result = calculateProductivityStreak({
            ...base,
            timezone: 'Asia/Kolkata',
            completedTaskTimestamps: [
                '2026-10-26T19:00:00.000Z',
            ],
        });

        // 19:00 UTC is 00:30 on October 27 in India.
        expect(result.qualifiesToday).toBe(true);
        expect(result.todayCompletedTaskCount).toBe(1);
    });

    it('does not count cancelled sessions or sessions with zero minutes', () => {
        const result = calculateProductivityStreak({
            ...base,
            completedFocusSessions: [
                {
                    ended_at: '2026-10-27T10:00:00.000Z',
                    actual_minutes: 0,
                },
                {
                    ended_at: null,
                    actual_minutes: 30,
                },
            ],
        });

        expect(result.qualifiesToday).toBe(false);
        expect(result.todayFocusMinutes).toBe(0);
        expect(result.currentDays).toBe(0);
    });

    it('rejects an invalid timezone', () => {
        expect(() =>
            calculateProductivityStreak({
                ...base,
                timezone: 'Not/A_Timezone',
            })
        ).toThrow('Invalid timezone');
    });
});