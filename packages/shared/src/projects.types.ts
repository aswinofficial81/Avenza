import { z } from 'zod';
import type { ExternalRepositoryDto } from './integrations.types';

export const PROJECT_STATUSES = [
  'backlog',
  'planning',
  'in_progress',
  'paused',
  'completed',
  'archived',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const ProjectStatusSchema = z.enum(PROJECT_STATUSES);

export const PROJECT_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];
export const ProjectPrioritySchema = z.enum(PROJECT_PRIORITIES);

export const PROJECT_TYPES = [
  'software',
  'research',
  'open_source',
  'hardware',
  'content',
  'custom',
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];
export const ProjectTypeSchema = z.enum(PROJECT_TYPES);

export const PROJECT_MILESTONE_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'skipped',
] as const;
export type ProjectMilestoneStatus = (typeof PROJECT_MILESTONE_STATUSES)[number];
export const ProjectMilestoneStatusSchema = z.enum(PROJECT_MILESTONE_STATUSES);

export const PROJECT_HEALTH_STATUSES = ['unknown', 'on_track', 'at_risk'] as const;
export type ProjectHealthStatus = (typeof PROJECT_HEALTH_STATUSES)[number];
export const ProjectHealthSchema = z.enum(PROJECT_HEALTH_STATUSES);

export const PROJECT_SKILL_ROLES = ['primary', 'supporting'] as const;
export type ProjectSkillRole = (typeof PROJECT_SKILL_ROLES)[number];
export const ProjectSkillRoleSchema = z.enum(PROJECT_SKILL_ROLES);

// Derived Metrics for a Project
export interface ProjectDerivedMetrics {
  milestoneCount: number;
  completedMilestoneCount: number;
  progressPercentage: number;
  taskCount?: number;
  completedTaskCount?: number;
  healthStatus: ProjectHealthStatus;
  healthReason?: string;
}

export const ProjectDerivedMetricsSchema = z.object({
  milestoneCount: z.number().int().nonnegative(),
  completedMilestoneCount: z.number().int().nonnegative(),
  progressPercentage: z.number().min(0).max(100),
  taskCount: z.number().int().nonnegative().optional(),
  completedTaskCount: z.number().int().nonnegative().optional(),
  healthStatus: ProjectHealthSchema,
  healthReason: z.string().optional(),
});

// Base Project DTO
export interface ProjectDto {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  project_type: ProjectType;
  repository_id: string | null;
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  live_url: string | null;
  architecture_notes: string | null;
  tech_stack: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  metrics?: ProjectDerivedMetrics;
}

export const ProjectDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  status: ProjectStatusSchema,
  priority: ProjectPrioritySchema,
  project_type: ProjectTypeSchema,
  repository_id: z.string().uuid().nullable(),
  start_date: z.string().nullable(),
  target_date: z.string().nullable(),
  completed_at: z.string().nullable(),
  live_url: z.string().nullable(),
  architecture_notes: z.string().nullable(),
  tech_stack: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
  metrics: ProjectDerivedMetricsSchema.optional(),
});

// Project Milestone DTO
export interface ProjectMilestoneDto {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: ProjectMilestoneStatus;
  order_index: number;
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const ProjectMilestoneDtoSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: ProjectMilestoneStatusSchema,
  order_index: z.number().int(),
  target_date: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Project Goal Relationship DTO
export interface ProjectGoalDto {
  project_id: string;
  goal_id: string;
  user_id: string;
  is_primary: boolean;
  created_at: string;
  goal_title?: string;
}

export const ProjectGoalDtoSchema = z.object({
  project_id: z.string().uuid(),
  goal_id: z.string().uuid(),
  user_id: z.string().uuid(),
  is_primary: z.boolean(),
  created_at: z.string(),
  goal_title: z.string().optional(),
});

// Project Skill Relationship DTO
export interface ProjectSkillDto {
  project_id: string;
  skill_id: string;
  user_id: string;
  role: ProjectSkillRole;
  created_at: string;
  skill_name?: string;
  skill_slug?: string;
}

export const ProjectSkillDtoSchema = z.object({
  project_id: z.string().uuid(),
  skill_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: ProjectSkillRoleSchema,
  created_at: z.string(),
  skill_name: z.string().optional(),
  skill_slug: z.string().optional(),
});

import type { TaskDto } from './tasks.types';
import type { ExternalActivityDto } from './integrations.types';

// Full Project Detail DTO
export interface ProjectDetailDto extends ProjectDto {
  milestones: ProjectMilestoneDto[];
  tasks: TaskDto[];
  goals: ProjectGoalDto[];
  skills: ProjectSkillDto[];
  repository?: ExternalRepositoryDto | null;
  activities?: ExternalActivityDto[];
}

// Validation Refinement Helpers
const dateComparisonRefine = <T extends { start_date?: string | null; target_date?: string | null }>(
  data: T
) => {
  if (data.start_date && data.target_date) {
    return new Date(data.target_date).getTime() >= new Date(data.start_date).getTime();
  }
  return true;
};

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const LiveUrlSchema = z
  .string()
  .max(1000, 'Live URL must be at most 1000 characters')
  .url('Must be a valid URL')
  .refine(
    (url) => /^https?:\/\//i.test(url),
    { message: 'Live URL must use http:// or https:// protocol' }
  );

// Input Validation Schemas
export const CreateProjectSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Project title is required')
      .max(255, 'Project title must be at most 255 characters'),
    slug: z
      .string()
      .trim()
      .min(1, 'Project slug is required')
      .max(120, 'Project slug must be at most 120 characters')
      .regex(SLUG_REGEX, 'Slug must be lowercase alphanumeric and hyphens only (kebab-case)'),
    description: z
      .string()
      .max(3000, 'Description must be at most 3000 characters')
      .nullable()
      .optional(),
    status: ProjectStatusSchema.default('backlog'),
    priority: ProjectPrioritySchema.default('medium'),
    project_type: ProjectTypeSchema.default('software'),
    repository_id: z.string().uuid('Invalid repository ID').nullable().optional(),
    start_date: z.string().datetime({ offset: true }).nullable().optional(),
    target_date: z.string().datetime({ offset: true }).nullable().optional(),
    live_url: LiveUrlSchema.nullable().optional(),
    architecture_notes: z
      .string()
      .max(10000, 'Architecture notes must be at most 10000 characters')
      .nullable()
      .optional(),
    tech_stack: z.array(z.string().trim().min(1).max(50)).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .refine(dateComparisonRefine, {
    message: 'Target date must be on or after start date',
    path: ['target_date'],
  });

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Project title cannot be empty')
      .max(255, 'Project title must be at most 255 characters')
      .optional(),
    slug: z
      .string()
      .trim()
      .min(1, 'Project slug cannot be empty')
      .max(120, 'Project slug must be at most 120 characters')
      .regex(SLUG_REGEX, 'Slug must be lowercase alphanumeric and hyphens only (kebab-case)')
      .optional(),
    description: z
      .string()
      .max(3000, 'Description must be at most 3000 characters')
      .nullable()
      .optional(),
    status: ProjectStatusSchema.optional(),
    priority: ProjectPrioritySchema.optional(),
    project_type: ProjectTypeSchema.optional(),
    repository_id: z.string().uuid('Invalid repository ID').nullable().optional(),
    start_date: z.string().datetime({ offset: true }).nullable().optional(),
    target_date: z.string().datetime({ offset: true }).nullable().optional(),
    completed_at: z.string().datetime({ offset: true }).nullable().optional(),
    live_url: LiveUrlSchema.nullable().optional(),
    architecture_notes: z
      .string()
      .max(10000, 'Architecture notes must be at most 10000 characters')
      .nullable()
      .optional(),
    tech_stack: z.array(z.string().trim().min(1).max(50)).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(dateComparisonRefine, {
    message: 'Target date must be on or after start date',
    path: ['target_date'],
  });

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export const CreateProjectMilestoneSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Milestone title is required')
    .max(255, 'Milestone title must be at most 255 characters'),
  description: z
    .string()
    .max(2000, 'Milestone description must be at most 2000 characters')
    .nullable()
    .optional(),
  status: ProjectMilestoneStatusSchema.default('pending'),
  order_index: z.number().int().default(0),
  target_date: z.string().datetime({ offset: true }).nullable().optional(),
});

export type CreateProjectMilestoneInput = z.infer<typeof CreateProjectMilestoneSchema>;

export const UpdateProjectMilestoneSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Milestone title cannot be empty')
    .max(255, 'Milestone title must be at most 255 characters')
    .optional(),
  description: z
    .string()
    .max(2000, 'Milestone description must be at most 2000 characters')
    .nullable()
    .optional(),
  status: ProjectMilestoneStatusSchema.optional(),
  order_index: z.number().int().optional(),
  target_date: z.string().datetime({ offset: true }).nullable().optional(),
  completed_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export type UpdateProjectMilestoneInput = z.infer<typeof UpdateProjectMilestoneSchema>;

export const LinkRepositorySchema = z.object({
  repository_id: z.string().uuid('Invalid repository ID').nullable(),
});
export type LinkRepositoryInput = z.infer<typeof LinkRepositorySchema>;

export const AttachProjectGoalSchema = z.object({
  goal_id: z.string().uuid('Invalid goal ID'),
  is_primary: z.boolean().default(false),
});
export type AttachProjectGoalInput = z.infer<typeof AttachProjectGoalSchema>;

export const AttachProjectSkillSchema = z.object({
  skill_id: z.string().uuid('Invalid skill ID'),
  role: ProjectSkillRoleSchema.default('primary'),
});
export type AttachProjectSkillInput = z.infer<typeof AttachProjectSkillSchema>;

export const UpdateProjectGoalSchema = z.object({
  is_primary: z.boolean(),
});
export type UpdateProjectGoalInput = z.infer<typeof UpdateProjectGoalSchema>;

export const UpdateProjectSkillSchema = z.object({
  role: ProjectSkillRoleSchema,
});
export type UpdateProjectSkillInput = z.infer<typeof UpdateProjectSkillSchema>;

export const ProjectActivitiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ProjectActivitiesQueryInput = z.infer<typeof ProjectActivitiesQuerySchema>;

export const ProjectQuerySchema = z.object({
  status: ProjectStatusSchema.optional(),
  priority: ProjectPrioritySchema.optional(),
  project_type: ProjectTypeSchema.optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['created_at', 'updated_at', 'target_date', 'title', 'priority']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ProjectQueryInput = z.infer<typeof ProjectQuerySchema>;
