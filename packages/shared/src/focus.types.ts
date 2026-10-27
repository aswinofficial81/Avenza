import { z } from 'zod';
import type { TaskPriority, TaskStatus, TaskType } from './tasks.types';

// ==============================================================================
// FOCUS SESSION ENUMS & SCHEMAS
// ==============================================================================

export const FOCUS_SESSION_TYPES = [
  'focus',
  'pomodoro',
  'deep_work',
  'revision',
  'practice',
  'custom',
] as const;

export type FocusSessionType = (typeof FOCUS_SESSION_TYPES)[number];

export const FocusSessionTypeSchema = z.enum(FOCUS_SESSION_TYPES);

export const FOCUS_SESSION_STATUSES = ['active', 'completed', 'cancelled'] as const;

export type FocusSessionStatus = (typeof FOCUS_SESSION_STATUSES)[number];

export const FocusSessionStatusSchema = z.enum(FOCUS_SESSION_STATUSES);

// ==============================================================================
// FOCUS SESSION DTO
// ==============================================================================

export interface FocusSessionTaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  task_type: TaskType;
  goal_title?: string | null;
  milestone_title?: string | null;
  project_title?: string | null;
  project_milestone_title?: string | null;
}

export interface FocusSessionDto {
  id: string;
  user_id: string;
  task_id: string | null;
  session_type: FocusSessionType;
  status: FocusSessionStatus;
  started_at: string;
  ended_at: string | null;
  planned_minutes: number;
  actual_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  task?: FocusSessionTaskSummary | null;
}

export const FocusSessionDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  task_id: z.string().uuid().nullable(),
  session_type: FocusSessionTypeSchema,
  status: FocusSessionStatusSchema,
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable(),
  planned_minutes: z.number().int().min(1).max(480),
  actual_minutes: z.number().int().min(0).nullable(),
  notes: z.string().max(2000).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ==============================================================================
// REQUEST SCHEMAS & INPUT TYPES
// ==============================================================================

export const CreateFocusSessionSchema = z.object({
  taskId: z.string().uuid({ message: 'Valid task UUID is required' }),
  sessionType: FocusSessionTypeSchema.default('focus'),
  plannedMinutes: z
    .number({ required_error: 'Planned minutes is required' })
    .int('Planned minutes must be an integer')
    .min(1, 'Planned minutes must be at least 1')
    .max(480, 'Planned minutes cannot exceed 480 (8 hours)')
    .default(25),
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional().nullable(),
});

export type CreateFocusSessionInput = z.infer<typeof CreateFocusSessionSchema>;

export const CompleteFocusSessionSchema = z.object({
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional().nullable(),
});

export type CompleteFocusSessionInput = z.infer<typeof CompleteFocusSessionSchema>;

export const CancelFocusSessionSchema = z.object({
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional().nullable(),
});

export type CancelFocusSessionInput = z.infer<typeof CancelFocusSessionSchema>;

export const FocusSessionsQuerySchema = z.object({
  taskId: z.string().uuid().optional(),
  status: FocusSessionStatusSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type FocusSessionsQueryInput = z.input<typeof FocusSessionsQuerySchema>;
export type FocusSessionsQueryOutput = z.output<typeof FocusSessionsQuerySchema>;

// Aliases matching prompt requirements
export type FocusSession = FocusSessionDto;

export interface FocusSessionResponse {
  success: boolean;
  data?: FocusSessionDto;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ActiveFocusSessionResponse {
  success: boolean;
  data: FocusSessionDto | null;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

