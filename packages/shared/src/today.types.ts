import { z } from 'zod';
import type { TaskDto } from './tasks.types';

export interface TodaySummary {
  completedTaskCount: number;
  meaningfulMinutes: number;
  focusMinutes?: number;
  fallbackTaskActualMinutes?: number;
  estimatedMinutesWithoutActual: number;
  dailyMinimum: number;
  dailyTarget: number;
  maxDailyStudy: number | null;
  minimumProgress: number; // 0 to 100
  targetProgress: number; // 0 to 100
}

export type TodayTaskItem = TaskDto;

export interface TodayResponse {
  date: string; // YYYY-MM-DD in user's timezone
  timezone: string; // IANA timezone string e.g. "Asia/Kolkata"
  summary: TodaySummary;
  next: TodayTaskItem | null;
  overdue: TodayTaskItem[];
  dueToday: TodayTaskItem[];
  scheduledToday: TodayTaskItem[];
  upcoming: TodayTaskItem[];
  completedToday: TodayTaskItem[];
}

// Validation schema for GET /api/v1/today query parameters
export const TodayQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD')
    .optional(),
  timezone: z.string().optional(),
});

export type TodayQueryInput = z.infer<typeof TodayQuerySchema>;
