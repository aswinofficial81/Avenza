import { z } from 'zod';

export const GOAL_TYPES = ['academic', 'learning', 'career', 'project', 'personal', 'custom'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];
export const GoalTypeSchema = z.enum(GOAL_TYPES);

export const GOAL_STATUSES = ['draft', 'active', 'paused', 'completed', 'archived'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];
export const GoalStatusSchema = z.enum(GOAL_STATUSES);

export const GOAL_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type GoalPriority = (typeof GOAL_PRIORITIES)[number];
export const GoalPrioritySchema = z.enum(GOAL_PRIORITIES);

export const GOAL_HEALTH_STATUSES = ['unknown', 'on_track', 'at_risk'] as const;
export type GoalHealthStatus = (typeof GOAL_HEALTH_STATUSES)[number];
export const GoalHealthSchema = z.enum(GOAL_HEALTH_STATUSES);

export const MILESTONE_STATUSES = ['pending', 'active', 'completed', 'skipped'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
export const MilestoneStatusSchema = z.enum(MILESTONE_STATUSES);

// Base Milestone Model
export interface MilestoneDto {
  id: string;
  goal_id: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  priority: GoalPriority;
  order_index: number;
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Derived Metrics for a Goal
export interface GoalDerivedMetrics {
  milestoneCount: number;
  completedMilestoneCount: number;
  progressPercentage: number;
  healthStatus: GoalHealthStatus;
  healthReason?: string;
}

// Goal List Item DTO
export interface GoalDto {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  goal_type: GoalType;
  status: GoalStatus;
  priority: GoalPriority;
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  desired_outcome: string | null;
  completion_criteria: string | null;
  academic_term_id?: string | null;
  academic_subject_id?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Derived
  metrics: GoalDerivedMetrics;
}

// Goal Detail DTO (includes milestones)
export interface GoalDetailDto extends GoalDto {
  milestones: MilestoneDto[];
}

// Pagination & Query Types
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedList<T> {
  data: T[];
  pagination: PaginationMeta;
}

// Validation schemas
const dateComparisonRefine = <T extends { start_date?: string | null; target_date?: string | null }>(
  data: T
) => {
  if (data.start_date && data.target_date) {
    return new Date(data.target_date).getTime() >= new Date(data.start_date).getTime();
  }
  return true;
};

export const CreateGoalSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(255, 'Title must be 255 characters or fewer'),
    description: z.string().max(2000, 'Description must be 2000 characters or fewer').nullable().optional(),
    goal_type: GoalTypeSchema,
    priority: GoalPrioritySchema.default('medium'),
    status: GoalStatusSchema.default('draft'),
    start_date: z.string().datetime({ offset: true }).nullable().optional(),
    target_date: z.string().datetime({ offset: true }).nullable().optional(),
    desired_outcome: z.string().max(2000, 'Desired outcome must be 2000 characters or fewer').nullable().optional(),
    completion_criteria: z.string().max(2000, 'Completion criteria must be 2000 characters or fewer').nullable().optional(),
    academic_term_id: z.string().uuid('Invalid Term ID format').nullable().optional(),
    academic_subject_id: z.string().uuid('Invalid Subject ID format').nullable().optional(),
    notes: z.string().max(5000, 'Notes must be 5000 characters or fewer').nullable().optional(),
  })
  .refine(dateComparisonRefine, {
    message: 'target_date cannot be earlier than start_date',
    path: ['target_date'],
  });

export type CreateGoalInput = z.infer<typeof CreateGoalSchema>;

export const UpdateGoalSchema = z
  .object({
    title: z.string().trim().min(1, 'Title cannot be empty').max(255).optional(),
    description: z.string().max(2000).nullable().optional(),
    goal_type: GoalTypeSchema.optional(),
    priority: GoalPrioritySchema.optional(),
    status: GoalStatusSchema.optional(),
    start_date: z.string().datetime({ offset: true }).nullable().optional(),
    target_date: z.string().datetime({ offset: true }).nullable().optional(),
    completed_at: z.string().datetime({ offset: true }).nullable().optional(),
    desired_outcome: z.string().max(2000).nullable().optional(),
    completion_criteria: z.string().max(2000).nullable().optional(),
    academic_term_id: z.string().uuid('Invalid Term ID format').nullable().optional(),
    academic_subject_id: z.string().uuid('Invalid Subject ID format').nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
  })
  .refine(dateComparisonRefine, {
    message: 'target_date cannot be earlier than start_date',
    path: ['target_date'],
  });

export type UpdateGoalInput = z.infer<typeof UpdateGoalSchema>;

export const CreateMilestoneSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(255, 'Title must be 255 characters or fewer'),
    description: z.string().max(2000, 'Description must be 2000 characters or fewer').nullable().optional(),
    status: MilestoneStatusSchema.default('pending'),
    priority: GoalPrioritySchema.default('medium'),
    order_index: z.number().int().min(0, 'Order index must be non-negative').default(0),
    start_date: z.string().datetime({ offset: true }).nullable().optional(),
    target_date: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine(dateComparisonRefine, {
    message: 'target_date cannot be earlier than start_date',
    path: ['target_date'],
  });

export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>;

export const UpdateMilestoneSchema = z
  .object({
    title: z.string().trim().min(1, 'Title cannot be empty').max(255).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: MilestoneStatusSchema.optional(),
    priority: GoalPrioritySchema.optional(),
    order_index: z.number().int().min(0).optional(),
    start_date: z.string().datetime({ offset: true }).nullable().optional(),
    target_date: z.string().datetime({ offset: true }).nullable().optional(),
    completed_at: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine(dateComparisonRefine, {
    message: 'target_date cannot be earlier than start_date',
    path: ['target_date'],
  });

export type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneSchema>;

export const GoalQuerySchema = z.object({
  status: GoalStatusSchema.optional(),
  goal_type: GoalTypeSchema.optional(),
  priority: GoalPrioritySchema.optional(),
  health: GoalHealthSchema.optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['target_date', 'created_at', 'priority', 'title']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type GoalQueryInput = z.input<typeof GoalQuerySchema>;
export type GoalQueryOutput = z.infer<typeof GoalQuerySchema>;
