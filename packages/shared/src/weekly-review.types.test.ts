import { describe, expect, it } from 'vitest';
import {
    WeeklyReviewQuerySchema,
    WeeklyReviewSaveSchema,
} from './weekly-review.types';

describe('Weekly Review validation', () => {
    it('accepts a Monday week start', () => {
        const result = WeeklyReviewQuerySchema.safeParse({
            weekStart: '2026-10-26',
            timezone: 'Asia/Kolkata',
        });

        expect(result.success).toBe(true);
    });

    it('rejects a Sunday week start', () => {
        const result = WeeklyReviewQuerySchema.safeParse({
            weekStart: '2026-10-25',
            timezone: 'Asia/Kolkata',
        });

        expect(result.success).toBe(false);
    });

    it('rejects an impossible calendar date', () => {
        const result = WeeklyReviewQuerySchema.safeParse({
            weekStart: '2026-02-30',
            timezone: 'Asia/Kolkata',
        });

        expect(result.success).toBe(false);
    });

    it('accepts a valid review', () => {
        const result = WeeklyReviewSaveSchema.safeParse({
            weekStart: '2026-10-26',
            timezone: 'Asia/Kolkata',
            wentWell: 'Completed planned tasks',
            challenges: 'Some distractions',
            nextWeekPriority: 'Practise DSA daily',
        });

        expect(result.success).toBe(true);
    });

    it('rejects review text exceeding the allowed length', () => {
        const result = WeeklyReviewSaveSchema.safeParse({
            weekStart: '2026-10-26',
            timezone: 'Asia/Kolkata',
            wentWell: 'x'.repeat(3001),
            challenges: '',
            nextWeekPriority: '',
        });

        expect(result.success).toBe(false);
    });
});