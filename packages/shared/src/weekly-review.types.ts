import { z } from 'zod';

const DateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD')
    .refine((value) => {
        const parsed = new Date(`${value}T00:00:00.000Z`);

        return (
            !Number.isNaN(parsed.getTime()) &&
            parsed.toISOString().slice(0, 10) === value
        );
    }, 'Date must be a valid calendar date');

const MondayDateSchema = DateSchema.refine(
    (value) => new Date(`${value}T00:00:00.000Z`).getUTCDay() === 1,
    'Week start must be a Monday',
);

export const WeeklyReviewSaveSchema = z.object({
    weekStart: MondayDateSchema,
    timezone: z.string().trim().min(1).max(100),
    wentWell: z.string().max(3000),
    challenges: z.string().max(3000),
    nextWeekPriority: z.string().max(1000),
});

export const WeeklyReviewQuerySchema = z.object({
    weekStart: MondayDateSchema,
    timezone: z.string().trim().min(1).max(100),
});

export const WeeklyReviewRecordSchema = z.object({
    id: z.string().uuid(),
    weekStart: DateSchema,
    weekEnd: DateSchema,
    timezone: z.string(),
    wentWell: z.string(),
    challenges: z.string(),
    nextWeekPriority: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const WeeklyReviewMetricsSchema = z.object({
    completedTasks: z.number().int().nonnegative(),
    focusMinutes: z.number().nonnegative(),
    dsaAttempts: z.number().int().nonnegative(),
    goalsCompleted: z.number().int().nonnegative(),
});

export const WeeklyReviewSummarySchema = z.object({
    weekStart: MondayDateSchema,
    weekEnd: DateSchema,
    timezone: z.string(),
    metrics: WeeklyReviewMetricsSchema,
    review: WeeklyReviewRecordSchema.nullable(),
});

export type WeeklyReviewSaveInput = z.infer<
    typeof WeeklyReviewSaveSchema
>;

export type WeeklyReviewQueryInput = z.infer<
    typeof WeeklyReviewQuerySchema
>;

export type WeeklyReviewRecord = z.infer<
    typeof WeeklyReviewRecordSchema
>;

export type WeeklyReviewMetrics = z.infer<
    typeof WeeklyReviewMetricsSchema
>;

export type WeeklyReviewSummary = z.infer<
    typeof WeeklyReviewSummarySchema
>;