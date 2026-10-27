import { z } from 'zod';
import { TaskPrioritySchema, TaskTypeSchema } from './tasks.types';

export const UnscheduledReasonSchema = z.enum([
  'BLOCKED_BY_DEPENDENCY',
  'NO_CONTIGUOUS_SLOT',
  'CAPACITY_REACHED',
  'INVALID_ESTIMATE',
  'INELIGIBLE_STATUS',
]);
export type UnscheduledReason = z.infer<typeof UnscheduledReasonSchema>;

export const ProposeScheduleInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});
export type ProposeScheduleInput = z.infer<typeof ProposeScheduleInputSchema>;

export const ProposedTaskBlockDtoSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  isDurationDefaulted: z.boolean(),
  priority: TaskPrioritySchema,
  taskType: TaskTypeSchema,
  goalTitle: z.string().nullable().optional(),
  projectTitle: z.string().nullable().optional(),
  score: z.number(),
  primaryReason: z.string(),
  expectedUpdatedAt: z.string().datetime(),
});
export type ProposedTaskBlockDto = z.infer<typeof ProposedTaskBlockDtoSchema>;

export const UnscheduledTaskDtoSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string(),
  priority: TaskPrioritySchema,
  estimatedMinutes: z.number().nullable().optional(),
  reason: UnscheduledReasonSchema,
  reasonMessage: z.string(),
  blockedBy: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        status: z.string(),
      })
    )
    .optional(),
});
export type UnscheduledTaskDto = z.infer<typeof UnscheduledTaskDtoSchema>;

export const ExistingCommitmentDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.enum(['task_scheduled', 'google_calendar']),
  start: z.string(),
  end: z.string(),
  isAllDay: z.boolean(),
  isBusy: z.boolean(),
});
export type ExistingCommitmentDto = z.infer<typeof ExistingCommitmentDtoSchema>;

export const ScheduleProposalResponseDtoSchema = z.object({
  proposalId: z.string().uuid(),
  targetDate: z.string(),
  timezone: z.string(),
  studyWindow: z.object({
    start: z.string(),
    end: z.string(),
  }),
  dailyTargetMinutes: z.number().int(),
  maxDailyStudyMinutes: z.number().int().nullable(),
  totalProposedMinutes: z.number().int(),
  proposedBlocks: z.array(ProposedTaskBlockDtoSchema),
  unscheduledTasks: z.array(UnscheduledTaskDtoSchema),
  existingCommitments: z.array(ExistingCommitmentDtoSchema),
  isExternalCalendarAvailable: z.boolean(),
  warnings: z.array(z.string()),
  generatedAt: z.string().datetime(),
});
export type ScheduleProposalResponseDto = z.infer<typeof ScheduleProposalResponseDtoSchema>;

/**
 * Asserts that an ISO timestamp string represents a whole-minute boundary
 * where seconds, milliseconds, and fractional seconds are all strictly zero.
 */
export function isMinuteAligned(isoString: string): boolean {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) {
    return false;
  }
  if (d.getUTCSeconds() !== 0 || d.getUTCMilliseconds() !== 0) {
    return false;
  }
  const fractionMatch = isoString.match(/\.(\d+)/);
  if (fractionMatch?.[1] && !/^0+$/.test(fractionMatch[1])) {
    return false;
  }
  return true;
}

export const ApplyScheduleBlockInputSchema = z
  .object({
    taskId: z.string().uuid(),
    scheduledStart: z.string().datetime(),
    scheduledEnd: z.string().datetime(),
    expectedUpdatedAt: z.string().datetime().optional(),
  })
  .refine(
    (data) => isMinuteAligned(data.scheduledStart) && isMinuteAligned(data.scheduledEnd),
    {
      message: 'Schedule block timestamps must be aligned to whole-minute boundaries (zero seconds and fractional seconds)',
      path: ['scheduledStart'],
    }
  );
export type ApplyScheduleBlockInput = z.infer<typeof ApplyScheduleBlockInputSchema>;

export const ApplyScheduleInputSchema = z.object({
  proposalId: z.string().uuid().optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  blocks: z.array(ApplyScheduleBlockInputSchema).min(1, 'At least one block must be provided to apply'),
});
export type ApplyScheduleInput = z.infer<typeof ApplyScheduleInputSchema>;

export const ApplyScheduleResponseDtoSchema = z.object({
  success: z.boolean(),
  appliedCount: z.number().int(),
  taskIds: z.array(z.string().uuid()),
  appliedAt: z.string().datetime(),
});
export type ApplyScheduleResponseDto = z.infer<typeof ApplyScheduleResponseDtoSchema>;
