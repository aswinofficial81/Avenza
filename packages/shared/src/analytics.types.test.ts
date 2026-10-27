import { describe, expect, it } from 'vitest';
import {
  AnalyticsSummaryDtoSchema,
  AnalyticsSummaryQuerySchema,
} from './analytics.types';

describe('Analytics Shared Types & Validation', () => {
  it('validates a correct analytics query range', () => {
    const valid = {
      startDate: '2026-10-01',
      endDate: '2026-10-07',
      timezone: 'Asia/Kolkata',
    };
    const parsed = AnalyticsSummaryQuerySchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects startDate greater than endDate', () => {
    const invalid = {
      startDate: '2026-10-10',
      endDate: '2026-10-01',
    };
    const parsed = AnalyticsSummaryQuerySchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain('startDate must be less than or equal to endDate');
    }
  });

  it('rejects invalid calendar date like 2026-02-30', () => {
    const invalid = {
      startDate: '2026-02-30',
      endDate: '2026-03-05',
    };
    const parsed = AnalyticsSummaryQuerySchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('accepts exactly 366 inclusive calendar dates', () => {
    const parsed = AnalyticsSummaryQuerySchema.safeParse({
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      timezone: 'UTC',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects 367 inclusive calendar dates', () => {
    const parsed = AnalyticsSummaryQuerySchema.safeParse({
      startDate: '2025-01-01',
      endDate: '2026-01-02',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.message).join(' ')).toContain(
        'Reporting window cannot exceed 366 days'
      );
    }
  });

  it('rejects an invalid IANA timezone instead of silently falling back', () => {
    const parsed = AnalyticsSummaryQuerySchema.safeParse({
      startDate: '2026-10-01',
      endDate: '2026-10-07',
      timezone: 'Mars/Olympus_Mons',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message.includes('valid IANA timezone'))).toBe(true);
    }
  });

  it('rejects query ranges exceeding 366 inclusive days', () => {
    const invalid = {
      startDate: '2025-01-01',
      endDate: '2026-02-01',
    };
    const parsed = AnalyticsSummaryQuerySchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.message).join(' ')).toContain(
        'Reporting window cannot exceed 366 days'
      );
    }
  });

  it('validates a complete AnalyticsSummaryDto', () => {
    const dto = {
      period: {
        startDate: '2026-10-01',
        endDate: '2026-10-07',
        timezone: 'UTC',
        startUtc: '2026-10-01T00:00:00.000Z',
        endUtc: '2026-10-08T00:00:00.000Z',
        asOf: '2026-10-07T12:00:00.000Z',
      },
      execution: {
        completedTaskCount: 5,
        openTasksDueInPeriodCount: 5,
        completionRate: 50.0,
        zeroDemand: false,
        currentOverdueCount: 2,
        completedByPriority: { low: 1, medium: 2, high: 2, critical: 0 },
        completedByType: { study: 3, practice: 2 },
      },
      focus: {
        recordedFocusMinutes: 120,
        completedSessionCount: 2,
        cancelledSessionCount: 1,
        averageSessionMinutes: 60,
        dailyDistribution: [
          { date: '2026-10-01', focusMinutes: 60, completedSessionCount: 1 },
          { date: '2026-10-02', focusMinutes: 60, completedSessionCount: 1 },
        ],
      },
      dsa: {
        totalAttempts: 4,
        uniqueProblemsSolved: 2,
        solvedByDifficulty: { easy: 1, medium: 1, hard: 0 },
        currentRevisionDueCount: 3,
      },
      growth: {
        newEvidenceCount: 3,
        completedGoalMilestonesCount: 1,
        completedProjectMilestonesCount: 1,
        currentActiveGoalsCount: 2,
      },
    };

    const parsed = AnalyticsSummaryDtoSchema.safeParse(dto);
    expect(parsed.success).toBe(true);
  });
});
