import { z } from 'zod';
import { TaskPrioritySchema, TaskStatusSchema, TaskTypeSchema } from './tasks.types';

export const NextActionTypeSchema = z.enum([
  'complete_task',
  'continue_task',
  'start_task',
  'focus_task',
  'review_task',
]);

export type NextActionType = z.infer<typeof NextActionTypeSchema>;

export const NextActionReasonCodeSchema = z.enum([
  'overdue',
  'due_today',
  'deadline_soon',
  'goal_priority',
  'milestone_priority',
  'critical_priority',
  'high_priority',
  'dependency_unblock',
  'scheduled_now',
  'user_priority',
  'stale_task',
  'in_progress_continuation',
  'no_actionable_tasks',
]);

export type NextActionReasonCode = z.infer<typeof NextActionReasonCodeSchema>;

export const NextActionConfidenceSchema = z.enum(['high', 'medium', 'low']);

export type NextActionConfidence = z.infer<typeof NextActionConfidenceSchema>;

export const ScoreBreakdownSchema = z.object({
  prioritySignal: z.number(),
  urgencySignal: z.number(),
  goalSignal: z.number(),
  dependencySignal: z.number(),
  scheduleSignal: z.number(),
  continuationSignal: z.number(),
  stalenessSignal: z.number(),
  totalScore: z.number(),
});

export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export const NextActionItemSchema = z.object({
  type: NextActionTypeSchema,
  taskId: z.string().uuid(),
  title: z.string().min(1),
  score: z.number(),
  goalId: z.string().uuid().nullable().optional(),
  goalTitle: z.string().nullable().optional(),
  milestoneId: z.string().uuid().nullable().optional(),
  milestoneTitle: z.string().nullable().optional(),
  priority: TaskPrioritySchema.optional(),
  taskType: TaskTypeSchema.optional(),
  status: TaskStatusSchema.optional(),
  dueAt: z.string().nullable().optional(),
  scheduledDate: z.string().nullable().optional(),
  estimatedMinutes: z.number().nullable().optional(),
});

export type NextActionItem = z.infer<typeof NextActionItemSchema>;

export const NextActionReasonSchema = z.object({
  code: NextActionReasonCodeSchema,
  label: z.string().min(1),
  explanation: z.string().min(1),
});

export type NextActionReason = z.infer<typeof NextActionReasonSchema>;

export const NextActionResponseDataSchema = z.object({
  action: NextActionItemSchema.nullable(),
  reason: NextActionReasonSchema,
  confidence: NextActionConfidenceSchema,
  generatedAt: z.string(),
  scoreBreakdown: ScoreBreakdownSchema.nullable().optional(),
});

export type NextActionResponseData = z.infer<typeof NextActionResponseDataSchema>;

export const NextActionQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted YYYY-MM-DD').optional(),
  timezone: z.string().optional(),
});

export type NextActionQueryInput = z.infer<typeof NextActionQuerySchema>;
