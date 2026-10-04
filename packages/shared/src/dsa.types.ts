import { z } from 'zod';

// ==============================================================================
// DSA Domain Types & Schemas
// Phase 13: DSA Foundation
// ==============================================================================

export const DsaProblemStatusSchema = z.enum(['active', 'archived']);
export type DsaProblemStatus = z.infer<typeof DsaProblemStatusSchema>;

export const DsaProblemSourceSchema = z.enum(['user', 'system', 'imported']);
export type DsaProblemSource = z.infer<typeof DsaProblemSourceSchema>;

export const DsaProblemDifficultySchema = z.enum(['easy', 'medium', 'hard']);
export type DsaProblemDifficulty = z.infer<typeof DsaProblemDifficultySchema>;

export const DsaAttemptStatusSchema = z.enum(['attempted', 'solved', 'failed', 'abandoned']);
export type DsaAttemptStatus = z.infer<typeof DsaAttemptStatusSchema>;

export const DsaTopicStatusSchema = z.enum(['active', 'archived']);
export type DsaTopicStatus = z.infer<typeof DsaTopicStatusSchema>;

// Revision stages (0 = never solved, 1 = first solve (+2 days), 2 = second revision (+7 days), 3 = third revision (+21 days))
export const DsaRevisionStageSchema = z.number().min(0).max(3);
export type DsaRevisionStage = z.infer<typeof DsaRevisionStageSchema>;

// ------------------------------------------------------------------------------
// Core DSA Problem DTO
// ------------------------------------------------------------------------------
export interface DsaProblemDto {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  description: string | null;
  difficulty: DsaProblemDifficulty;
  source: DsaProblemSource;
  status: DsaProblemStatus;
  external_url: string | null;
  estimated_minutes: number | null;

  // Derived projection (recomputed from dsa_attempts)
  attempt_count: number;
  solved_count: number;
  failed_count: number;
  last_attempt_at: string | null;
  last_solved_at: string | null;
  next_review_at: string | null;
  revision_count: number;
  review_stage: DsaRevisionStage;

  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------------------
// DSA Topic DTO
// ------------------------------------------------------------------------------
export interface DsaTopicDto {
  id: string;
  user_id: string;
  parent_topic_id: string | null;
  name: string;
  slug: string;
  status: DsaTopicStatus;
  created_at: string;
  updated_at: string;
  parent_topic?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  children?: DsaTopicDto[];
}

// ------------------------------------------------------------------------------
// DSA Attempt DTO
// ------------------------------------------------------------------------------
export interface DsaAttemptDto {
  id: string;
  user_id: string;
  problem_id: string;
  status: DsaAttemptStatus;
  started_at: string | null;
  submitted_at: string | null;
  occurred_at: string;
  recorded_at: string;
  solve_time_minutes: number | null;
  language: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------------------
// Relationship DTOs
// ------------------------------------------------------------------------------
export interface DsaProblemTopicDto {
  problem_id: string;
  topic_id: string;
  user_id: string;
  created_at: string;
  topic?: DsaTopicDto;
}

export interface DsaProblemSkillDto {
  problem_id: string;
  skill_id: string;
  user_id: string;
  created_at: string;
  skill?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface DsaProblemGoalDto {
  problem_id: string;
  goal_id: string;
  user_id: string;
  created_at: string;
  goal?: {
    id: string;
    title: string;
    status: string;
  };
}

export interface DsaProblemTaskDto {
  problem_id: string;
  task_id: string;
  user_id: string;
  created_at: string;
  task?: {
    id: string;
    title: string;
    status: string;
  };
}

// ------------------------------------------------------------------------------
// DSA Problem Detail View DTO
// ------------------------------------------------------------------------------
export interface DsaProblemDetailDto {
  problem: DsaProblemDto;
  topics: DsaTopicDto[];
  skills: {
    id: string;
    name: string;
    slug: string;
  }[];
  goals: Array<{
    id: string;
    title: string;
    status: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
  }>;
  recent_attempts: DsaAttemptDto[];
}

// ------------------------------------------------------------------------------
// DSA Overview DTO
// ------------------------------------------------------------------------------
export interface DsaOverviewDto {
  total_problems: number;
  solved_problems: number;
  attempted_problems: number;
  revision_due_count: number;
  weak_areas: Array<{
    topic_id: string;
    topic_name: string;
    problem_count: number;
    failure_count: number;
    reason: string;
  }>;
  recommended_problem: {
    id: string;
    title: string;
    reason: string;
  } | null;
}

// ------------------------------------------------------------------------------
// Zod Input Schemas
// ------------------------------------------------------------------------------
export const CreateDsaProblemInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
  slug: z
    .string()
    .trim()
    .max(120, 'Slug cannot exceed 120 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lower-case alphanumeric separated by hyphens')
    .optional(),
  description: z.string().max(5000, 'Description cannot exceed 5000 characters').optional().nullable(),
  difficulty: DsaProblemDifficultySchema,
  source: DsaProblemSourceSchema.default('user'),
  external_url: z.string().max(1000, 'External URL cannot exceed 1000 characters').optional().nullable(),
  estimated_minutes: z
    .number()
    .int()
    .min(1, 'Estimated minutes must be at least 1')
    .max(1440, 'Estimated minutes cannot exceed 1440 (24 hours)')
    .optional()
    .nullable(),
});
export type CreateDsaProblemInput = z.infer<typeof CreateDsaProblemInputSchema>;

export const UpdateDsaProblemInputSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  slug: z
    .string()
    .trim()
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lower-case alphanumeric separated by hyphens')
    .optional(),
  description: z.string().max(5000).optional().nullable(),
  difficulty: DsaProblemDifficultySchema.optional(),
  source: DsaProblemSourceSchema.optional(),
  external_url: z.string().max(1000).optional().nullable(),
  estimated_minutes: z
    .number()
    .int()
    .min(1)
    .max(1440)
    .optional()
    .nullable(),
  status: DsaProblemStatusSchema.optional(),
});
export type UpdateDsaProblemInput = z.infer<typeof UpdateDsaProblemInputSchema>;

export const CreateDsaTopicInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
  slug: z
    .string()
    .trim()
    .max(120, 'Slug cannot exceed 120 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lower-case alphanumeric separated by hyphens')
    .optional(),
  parent_topic_id: z.string().uuid('Invalid parent topic ID').optional().nullable(),
});
export type CreateDsaTopicInput = z.infer<typeof CreateDsaTopicInputSchema>;

export const UpdateDsaTopicInputSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  slug: z
    .string()
    .trim()
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lower-case alphanumeric separated by hyphens')
    .optional(),
  parent_topic_id: z.string().uuid().optional().nullable(),
  status: DsaTopicStatusSchema.optional(),
});
export type UpdateDsaTopicInput = z.infer<typeof UpdateDsaTopicInputSchema>;

export const CreateDsaAttemptInputSchema = z.object({
  problem_id: z.string().uuid('Invalid problem ID'),
  status: DsaAttemptStatusSchema,
  started_at: z.string().datetime().optional().nullable(),
  submitted_at: z.string().datetime().optional().nullable(),
  occurred_at: z.string().datetime().default(() => new Date().toISOString()),
  solve_time_minutes: z
    .number()
    .int()
    .min(1, 'Solve time must be at least 1 minute')
    .max(1440, 'Solve time cannot exceed 1440 minutes (24 hours)')
    .optional()
    .nullable(),
  language: z.string().max(40, 'Language cannot exceed 40 characters').optional().nullable(),
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional().nullable(),
}).refine(
  (data) => {
    // If solve_time_minutes is provided, status must not be 'attempted'
    if (data.solve_time_minutes !== null && data.solve_time_minutes !== undefined) {
      return data.status !== 'attempted';
    }
    return true;
  },
  {
    message: 'Solve time can only be set for completed attempts',
    path: ['solve_time_minutes'],
  }
);
export type CreateDsaAttemptInput = z.infer<typeof CreateDsaAttemptInputSchema>;

export const UpdateDsaAttemptInputSchema = z.object({
  status: DsaAttemptStatusSchema.optional(),
  started_at: z.string().datetime().optional().nullable(),
  submitted_at: z.string().datetime().optional().nullable(),
  solve_time_minutes: z
    .number()
    .int()
    .min(1)
    .max(1440)
    .optional()
    .nullable(),
  language: z.string().max(40).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
}).refine(
  (data) => {
    // If solve_time_minutes is being set, status must not be 'attempted'
    if (data.solve_time_minutes !== null && data.solve_time_minutes !== undefined) {
      return data.status !== 'attempted' || data.status === undefined;
    }
    return true;
  },
  {
    message: 'Solve time can only be set for completed attempts',
    path: ['solve_time_minutes'],
  }
);
export type UpdateDsaAttemptInput = z.infer<typeof UpdateDsaAttemptInputSchema>;

export const LinkDsaProblemTopicInputSchema = z.object({
  problem_id: z.string().uuid('Invalid problem ID'),
  topic_id: z.string().uuid('Invalid topic ID'),
});
export type LinkDsaProblemTopicInput = z.infer<typeof LinkDsaProblemTopicInputSchema>;

export const LinkDsaProblemSkillInputSchema = z.object({
  problem_id: z.string().uuid('Invalid problem ID'),
  skill_id: z.string().uuid('Invalid skill ID'),
});
export type LinkDsaProblemSkillInput = z.infer<typeof LinkDsaProblemSkillInputSchema>;

export const LinkDsaProblemGoalInputSchema = z.object({
  problem_id: z.string().uuid('Invalid problem ID'),
  goal_id: z.string().uuid('Invalid goal ID'),
});
export type LinkDsaProblemGoalInput = z.infer<typeof LinkDsaProblemGoalInputSchema>;

export const LinkDsaProblemTaskInputSchema = z.object({
  problem_id: z.string().uuid('Invalid problem ID'),
  task_id: z.string().uuid('Invalid task ID'),
});
export type LinkDsaProblemTaskInput = z.infer<typeof LinkDsaProblemTaskInputSchema>;

// ------------------------------------------------------------------------------
// Query Input Schemas
// ------------------------------------------------------------------------------
export const DsaProblemQuerySchema = z.object({
  status: DsaProblemStatusSchema.optional(),
  difficulty: DsaProblemDifficultySchema.optional(),
  source: DsaProblemSourceSchema.optional(),
  topic_id: z.string().uuid().optional(),
  skill_id: z.string().uuid().optional(),
  goal_id: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
  search: z.string().optional(),
  revision_due: z.boolean().optional(),
});
export type DsaProblemQueryInput = z.infer<typeof DsaProblemQuerySchema>;

export const DsaTopicQuerySchema = z.object({
  status: DsaTopicStatusSchema.optional(),
  parent_topic_id: z.string().uuid().optional().nullable(),
  search: z.string().optional(),
});
export type DsaTopicQueryInput = z.infer<typeof DsaTopicQuerySchema>;