import { z } from 'zod';

export const TASK_STATUSES = [
  'inbox',
  'planned',
  'scheduled',
  'in_progress',
  'completed',
  'skipped',
  'deferred',
  'cancelled',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TaskStatusSchema = z.enum(TASK_STATUSES);

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TaskPrioritySchema = z.enum(TASK_PRIORITIES);

export const TASK_TYPES = [
  'study',
  'practice',
  'revision',
  'assignment',
  'exam_preparation',
  'dsa',
  'project',
  'career',
  'administrative',
  'personal',
  'custom',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];
export const TaskTypeSchema = z.enum(TASK_TYPES);

// Dependency DTO
export interface TaskDependencyDto {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  prerequisite_title?: string;
  prerequisite_status?: TaskStatus;
  created_at: string;
}

// Blocked Prerequisite Summary
export interface BlockedBySummary {
  id: string;
  title: string;
  status: TaskStatus;
}

// Derived Metrics for a Task
export interface TaskDerivedMetrics {
  is_blocked: boolean;
  blocking_task_count: number;
  blocked_by: BlockedBySummary[];
}

// Task Item DTO (for list and dashboard views)
export interface TaskDto {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  task_type: TaskType;
  goal_id: string | null;
  milestone_id: string | null;
  goal_title?: string | null;
  milestone_title?: string | null;
  project_id?: string | null;
  project_milestone_id?: string | null;
  project_title?: string | null;
  project_milestone_title?: string | null;
  application_id?: string | null;
  academic_term_id?: string | null;
  academic_subject_id?: string | null;
  academic_topic_id?: string | null;
  subject_name?: string | null;
  topic_name?: string | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  due_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Derived state (accessible directly or via metrics)
  is_blocked: boolean;
  blocking_task_count: number;
  blocked_by: BlockedBySummary[];
  metrics: TaskDerivedMetrics;
}

// Task Detail DTO (includes dependency relationships)
export interface TaskDetailDto extends TaskDto {
  dependencies: TaskDependencyDto[]; // Prerequisites required before this task can start
  dependents: TaskDependencyDto[]; // Tasks blocked by this task
}

// Date comparison helper for scheduled_start vs scheduled_end
const scheduleComparisonRefine = <T extends { scheduled_start?: string | null; scheduled_end?: string | null }>(
  data: T
) => {
  if (data.scheduled_start && data.scheduled_end) {
    return new Date(data.scheduled_end).getTime() >= new Date(data.scheduled_start).getTime();
  }
  return true;
};

// Project milestone requires project helper
const projectMilestoneRequiresProjectRefine = <T extends { project_id?: string | null; project_milestone_id?: string | null }>(
  data: T
) => {
  if (data.project_milestone_id && !data.project_id) {
    return false;
  }
  return true;
};

// Zod Validation Schemas
export const CreateTaskSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(255, 'Title must be 255 characters or fewer'),
    description: z.string().max(2000, 'Description must be 2000 characters or fewer').nullable().optional(),
    status: TaskStatusSchema.default('inbox'),
    priority: TaskPrioritySchema.default('medium'),
    task_type: TaskTypeSchema.default('study'),
    goal_id: z.string().uuid('Invalid Goal ID format').nullable().optional(),
    milestone_id: z.string().uuid('Invalid Milestone ID format').nullable().optional(),
    project_id: z.string().uuid('Invalid Project ID format').nullable().optional(),
    project_milestone_id: z.string().uuid('Invalid Project Milestone ID format').nullable().optional(),
    application_id: z.string().uuid('Invalid Application ID format').nullable().optional(),
    academic_term_id: z.string().uuid('Invalid Term ID format').nullable().optional(),
    academic_subject_id: z.string().uuid('Invalid Subject ID format').nullable().optional(),
    academic_topic_id: z.string().uuid('Invalid Topic ID format').nullable().optional(),
    estimated_minutes: z.number().int().positive('Estimated minutes must be positive').nullable().optional(),
    actual_minutes: z.number().int().min(0, 'Actual minutes must be non-negative').nullable().optional(),
    due_at: z.string().datetime({ offset: true }).nullable().optional(),
    scheduled_start: z.string().datetime({ offset: true }).nullable().optional(),
    scheduled_end: z.string().datetime({ offset: true }).nullable().optional(),
    notes: z.string().max(5000, 'Notes must be 5000 characters or fewer').nullable().optional(),
  })
  .refine(scheduleComparisonRefine, {
    message: 'scheduled_end cannot be earlier than scheduled_start',
    path: ['scheduled_end'],
  })
  .refine(projectMilestoneRequiresProjectRefine, {
    message: 'project_milestone_id requires project_id',
    path: ['project_milestone_id'],
  });

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(255, 'Title must be 255 characters or fewer').optional(),
    description: z.string().max(2000, 'Description must be 2000 characters or fewer').nullable().optional(),
    status: TaskStatusSchema.optional(),
    priority: TaskPrioritySchema.optional(),
    task_type: TaskTypeSchema.optional(),
    goal_id: z.string().uuid('Invalid Goal ID format').nullable().optional(),
    milestone_id: z.string().uuid('Invalid Milestone ID format').nullable().optional(),
    project_id: z.string().uuid('Invalid Project ID format').nullable().optional(),
    project_milestone_id: z.string().uuid('Invalid Project Milestone ID format').nullable().optional(),
    application_id: z.string().uuid('Invalid Application ID format').nullable().optional(),
    academic_term_id: z.string().uuid('Invalid Term ID format').nullable().optional(),
    academic_subject_id: z.string().uuid('Invalid Subject ID format').nullable().optional(),
    academic_topic_id: z.string().uuid('Invalid Topic ID format').nullable().optional(),
    estimated_minutes: z.number().int().positive('Estimated minutes must be positive').nullable().optional(),
    actual_minutes: z.number().int().min(0, 'Actual minutes must be non-negative').nullable().optional(),
    due_at: z.string().datetime({ offset: true }).nullable().optional(),
    scheduled_start: z.string().datetime({ offset: true }).nullable().optional(),
    scheduled_end: z.string().datetime({ offset: true }).nullable().optional(),
    completed_at: z.string().datetime({ offset: true }).nullable().optional(),
    notes: z.string().max(5000, 'Notes must be 5000 characters or fewer').nullable().optional(),
  })
  .refine(scheduleComparisonRefine, {
    message: 'scheduled_end cannot be earlier than scheduled_start',
    path: ['scheduled_end'],
  })
  .refine(
    (data) => {
      if (data.project_milestone_id && data.project_id === null) {
        return false;
      }
      return true;
    },
    {
      message: 'project_milestone_id requires project_id',
      path: ['project_milestone_id'],
    }
  );

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const CreateTaskDependencySchema = z.object({
  depends_on_task_id: z.string().uuid('Invalid prerequisite Task ID'),
});

export type CreateTaskDependencyInput = z.infer<typeof CreateTaskDependencySchema>;

export const TaskQuerySchema = z.object({
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  task_type: TaskTypeSchema.optional(),
  goal_id: z.string().uuid().optional(),
  milestone_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  project_milestone_id: z.string().uuid().optional(),
  application_id: z.string().uuid().optional(),
  blocked: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
  due_before: z.string().datetime({ offset: true }).optional(),
  due_after: z.string().datetime({ offset: true }).optional(),
  scheduled_before: z.string().datetime({ offset: true }).optional(),
  scheduled_after: z.string().datetime({ offset: true }).optional(),
  sortBy: z.enum(['due_at', 'scheduled_start', 'created_at', 'priority', 'title']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type TaskQueryInput = z.input<typeof TaskQuerySchema>;
export type TaskQueryOutput = z.infer<typeof TaskQuerySchema>;
