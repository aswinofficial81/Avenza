import { z } from 'zod';
import type { TaskPriority, TaskType } from './tasks.types';
import type { DsaProblemDifficulty } from './dsa.types';

// ==============================================================================
// Analytics Query Parameters
// ==============================================================================

const isValidIanaTimezone = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
};

export const AnalyticsSummaryQuerySchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be formatted as YYYY-MM-DD'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be formatted as YYYY-MM-DD'),
    timezone: z
      .string()
      .optional()
      .refine(
        (timezone) => timezone === undefined || isValidIanaTimezone(timezone),
        'timezone must be a valid IANA timezone'
      ),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(data.endDate)) {
        return true;
      }
      // Basic calendar validity check
      const [sY, sM, sD] = data.startDate.split('-').map(Number);
      if (!sY || !sM || !sD) return false;
      const sDate = new Date(Date.UTC(sY, sM - 1, sD));
      if (
        sDate.getUTCFullYear() !== sY ||
        sDate.getUTCMonth() + 1 !== sM ||
        sDate.getUTCDate() !== sD
      ) {
        return false;
      }

      const [eY, eM, eD] = data.endDate.split('-').map(Number);
      if (!eY || !eM || !eD) return false;
      const eDate = new Date(Date.UTC(eY, eM - 1, eD));
      if (
        eDate.getUTCFullYear() !== eY ||
        eDate.getUTCMonth() + 1 !== eM ||
        eDate.getUTCDate() !== eD
      ) {
        return false;
      }

      return true;
    },
    {
      message: 'startDate and endDate must be valid calendar dates',
      path: ['startDate'],
    }
  )
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return data.startDate <= data.endDate;
    },
    {
      message: 'startDate must be less than or equal to endDate',
      path: ['startDate'],
    }
  )
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      const s = new Date(data.startDate).getTime();
      const e = new Date(data.endDate).getTime();
      if (isNaN(s) || isNaN(e)) return true;
      // Both endpoints are inclusive local dates. A same-day range is one day,
      // so use the date difference plus one when enforcing the maximum.
      const inclusiveDays = Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
      return inclusiveDays <= 366;
    },
    {
      message: 'Reporting window cannot exceed 366 days',
      path: ['endDate'],
    }
  );

export type AnalyticsSummaryQueryInput = z.infer<typeof AnalyticsSummaryQuerySchema>;

// ==============================================================================
// Analytics DTOs
// ==============================================================================

export interface AnalyticsExecutionSummary {
  completedTaskCount: number;
  openTasksDueInPeriodCount: number;
  completionRate: number | null; // C / (C + O) * 100, null if C + O = 0
  zeroDemand: boolean; // true when C + O = 0
  currentOverdueCount: number; // Current snapshot: open tasks with due_at < asOf
  completedByPriority: Record<TaskPriority, number>;
  completedByType: Record<TaskType, number>;
}

export interface DailyFocusDistribution {
  date: string; // YYYY-MM-DD local date
  focusMinutes: number;
  completedSessionCount: number;
}

export interface AnalyticsFocusSummary {
  recordedFocusMinutes: number;
  completedSessionCount: number;
  cancelledSessionCount: number;
  averageSessionMinutes: number | null; // null if completedSessionCount = 0
  dailyDistribution: DailyFocusDistribution[];
}

export interface AnalyticsDsaSummary {
  totalAttempts: number;
  uniqueProblemsSolved: number;
  solvedByDifficulty: Record<DsaProblemDifficulty, number>;
  currentRevisionDueCount: number; // Current snapshot: next_review_at <= asOf
}

export interface AnalyticsGrowthSummary {
  newEvidenceCount: number;
  completedGoalMilestonesCount: number;
  completedProjectMilestonesCount: number;
  currentActiveGoalsCount: number; // Current snapshot: status = 'active'
}

export interface AnalyticsSummaryDto {
  period: {
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    timezone: string; // resolved IANA timezone
    startUtc: string; // ISO 8601 UTC
    endUtc: string; // ISO 8601 UTC
    asOf: string; // ISO 8601 UTC of query execution
  };
  execution: AnalyticsExecutionSummary;
  focus: AnalyticsFocusSummary;
  dsa: AnalyticsDsaSummary;
  growth: AnalyticsGrowthSummary;
}

export const AnalyticsSummaryDtoSchema = z.object({
  period: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timezone: z.string(),
    startUtc: z.string().datetime({ offset: true }),
    endUtc: z.string().datetime({ offset: true }),
    asOf: z.string().datetime({ offset: true }),
  }),
  execution: z.object({
    completedTaskCount: z.number().int().min(0),
    openTasksDueInPeriodCount: z.number().int().min(0),
    completionRate: z.number().nullable(),
    zeroDemand: z.boolean(),
    currentOverdueCount: z.number().int().min(0),
    completedByPriority: z.record(z.string(), z.number()),
    completedByType: z.record(z.string(), z.number()),
  }),
  focus: z.object({
    recordedFocusMinutes: z.number().min(0),
    completedSessionCount: z.number().int().min(0),
    cancelledSessionCount: z.number().int().min(0),
    averageSessionMinutes: z.number().nullable(),
    dailyDistribution: z.array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        focusMinutes: z.number().min(0),
        completedSessionCount: z.number().int().min(0),
      })
    ),
  }),
  dsa: z.object({
    totalAttempts: z.number().int().min(0),
    uniqueProblemsSolved: z.number().int().min(0),
    solvedByDifficulty: z.record(z.string(), z.number()),
    currentRevisionDueCount: z.number().int().min(0),
  }),
  growth: z.object({
    newEvidenceCount: z.number().int().min(0),
    completedGoalMilestonesCount: z.number().int().min(0),
    completedProjectMilestonesCount: z.number().int().min(0),
    currentActiveGoalsCount: z.number().int().min(0),
  }),
});
