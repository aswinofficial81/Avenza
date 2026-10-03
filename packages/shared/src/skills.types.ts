import { z } from 'zod';
import type { EvidenceDto } from './evidence.types';

// ==============================================================================
// Skills Domain Types & Schemas
// Phase 12: Unified Skills + Mastery Foundation
// ==============================================================================

export const SkillStatusSchema = z.enum(['active', 'archived']);
export type SkillStatus = z.infer<typeof SkillStatusSchema>;

export const SkillSourceSchema = z.enum(['user', 'system', 'imported']);
export type SkillSource = z.infer<typeof SkillSourceSchema>;

// Derived Mastery States
export const MasteryStateSchema = z.enum([
  'unknown',
  'exploring',
  'learning',
  'developing',
  'proficient',
  'strong',
  'needs_review',
  'inactive',
]);
export type MasteryState = z.infer<typeof MasteryStateSchema>;

export const ConfidenceLevelSchema = z.enum(['low', 'medium', 'high']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const SkillHealthSchema = z.enum(['healthy', 'developing', 'needs_attention', 'inactive']);
export type SkillHealth = z.infer<typeof SkillHealthSchema>;

// Utility function to convert skill name to a standard slug
export function slugifySkillName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

// ------------------------------------------------------------------------------
// Core Skill DTO
// ------------------------------------------------------------------------------
export interface SkillDto {
  id: string;
  user_id: string;
  parent_skill_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  status: SkillStatus;
  source: SkillSource;
  created_at: string;
  updated_at: string;
  parent_skill?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  children?: SkillDto[];
}

// ------------------------------------------------------------------------------
// Derived Mastery DTO
// Strictly derived from evidence records, recency, diversity, and quality
// ------------------------------------------------------------------------------
export interface SkillMasteryDto {
  state: MasteryState;
  score: number; // 0–100 bounded
  confidence: ConfidenceLevel;
  evidence_count: number;
  verified_evidence_count: number;
  health: SkillHealth;
  explanation: string;
  calculated_at: string;
  recent_activity_at: string | null;
}

export interface SkillWithMasteryDto {
  skill: SkillDto;
  mastery: SkillMasteryDto;
}

// ------------------------------------------------------------------------------
// Relationship DTOs
// ------------------------------------------------------------------------------
export interface EvidenceSkillDto {
  evidence_id: string;
  skill_id: string;
  user_id: string;
  created_at: string;
  evidence?: EvidenceDto;
  skill?: SkillDto;
}

export interface GoalSkillDto {
  goal_id: string;
  skill_id: string;
  user_id: string;
  target_mastery_state: MasteryState | null;
  created_at: string;
  goal?: {
    id: string;
    title: string;
    status: string;
  };
  skill?: SkillDto;
}

export interface TaskSkillDto {
  task_id: string;
  skill_id: string;
  user_id: string;
  created_at: string;
  task?: {
    id: string;
    title: string;
    status: string;
  };
  skill?: SkillDto;
}

export interface TopicSkillDto {
  topic_id: string;
  skill_id: string;
  user_id: string;
  created_at: string;
  topic?: {
    id: string;
    name: string;
    status: string;
    subject_id?: string;
    subject_name?: string;
  };
  skill?: SkillDto;
}

// ------------------------------------------------------------------------------
// Skill Detail View DTO
// ------------------------------------------------------------------------------
export interface SkillDetailDto {
  skill: SkillDto;
  mastery: SkillMasteryDto;
  evidence: EvidenceDto[];
  goals: Array<{
    id: string;
    title: string;
    status: string;
    target_mastery_state: MasteryState | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
  }>;
  topics: Array<{
    id: string;
    name: string;
    status: string;
    subject_id: string;
    subject_name?: string;
  }>;
  children: SkillDto[];
}

// ------------------------------------------------------------------------------
// Zod Input Schemas
// ------------------------------------------------------------------------------
export const CreateSkillInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
  slug: z
    .string()
    .trim()
    .max(120, 'Slug cannot exceed 120 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lower-case alphanumeric separated by hyphens')
    .optional(),
  parent_skill_id: z.string().uuid('Invalid parent skill ID').optional().nullable(),
  description: z.string().max(2000, 'Description cannot exceed 2000 characters').optional().nullable(),
  category: z.string().max(50, 'Category cannot exceed 50 characters').optional().nullable(),
});
export type CreateSkillInput = z.infer<typeof CreateSkillInputSchema>;

export const UpdateSkillInputSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  slug: z
    .string()
    .trim()
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lower-case alphanumeric separated by hyphens')
    .optional(),
  parent_skill_id: z.string().uuid().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  status: SkillStatusSchema.optional(),
});
export type UpdateSkillInput = z.infer<typeof UpdateSkillInputSchema>;

export const SkillQuerySchema = z.object({
  status: SkillStatusSchema.optional(),
  category: z.string().optional(),
  parent_skill_id: z.string().uuid().optional().nullable(),
  search: z.string().optional(),
});
export type SkillQueryInput = z.infer<typeof SkillQuerySchema>;

export const LinkEvidenceToSkillInputSchema = z.object({
  evidence_id: z.string().uuid('Invalid evidence ID'),
  skill_id: z.string().uuid('Invalid skill ID'),
});
export type LinkEvidenceToSkillInput = z.infer<typeof LinkEvidenceToSkillInputSchema>;

export const LinkGoalToSkillInputSchema = z.object({
  goal_id: z.string().uuid('Invalid goal ID'),
  skill_id: z.string().uuid('Invalid skill ID'),
  target_mastery_state: MasteryStateSchema.optional().nullable(),
});
export type LinkGoalToSkillInput = z.infer<typeof LinkGoalToSkillInputSchema>;

export const LinkTaskToSkillInputSchema = z.object({
  task_id: z.string().uuid('Invalid task ID'),
  skill_id: z.string().uuid('Invalid skill ID'),
});
export type LinkTaskToSkillInput = z.infer<typeof LinkTaskToSkillInputSchema>;

export const LinkTopicToSkillInputSchema = z.object({
  topic_id: z.string().uuid('Invalid topic ID'),
  skill_id: z.string().uuid('Invalid skill ID'),
});
export type LinkTopicToSkillInput = z.infer<typeof LinkTopicToSkillInputSchema>;
