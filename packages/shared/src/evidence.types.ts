import { z } from 'zod';
import type { PaginatedList } from './goals.types';

// ==============================================================================
// Evidence Domain Types & Schemas
// Phase 9: Foundational Evidence Domain
// ==============================================================================

export const EvidenceTypeSchema = z.enum([
  'task_completion',
  'focus_session',
  'manual',
  'artifact',
  'assessment',
  'external_activity',
  'external_result',
  'project_activity',
  'custom',
]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const EvidenceSourceTypeSchema = z.enum([
  'task',
  'focus_session',
  'user',
  'assessment',
  'project',
  'external_provider',
  'system',
]);
export type EvidenceSourceType = z.infer<typeof EvidenceSourceTypeSchema>;

export const EvidenceVerificationStatusSchema = z.enum([
  'unverified',
  'verified',
  'rejected',
]);
export type EvidenceVerificationStatus = z.infer<typeof EvidenceVerificationStatusSchema>;

export const EvidenceStrengthSchema = z.enum(['low', 'medium', 'high']);
export type EvidenceStrength = z.infer<typeof EvidenceStrengthSchema>;

export const EvidenceReliabilitySchema = z.enum(['low', 'medium', 'high']);
export type EvidenceReliability = z.infer<typeof EvidenceReliabilitySchema>;

export const EvidenceDirectnessSchema = z.enum(['indirect', 'direct']);
export type EvidenceDirectness = z.infer<typeof EvidenceDirectnessSchema>;

export const EvidenceLinkEntityTypeSchema = z.enum(['goal', 'milestone', 'task']);
export type EvidenceLinkEntityType = z.infer<typeof EvidenceLinkEntityTypeSchema>;

export interface EvidenceLinkDto {
  id: string;
  evidence_id: string;
  entity_type: EvidenceLinkEntityType;
  entity_id: string;
  created_at: string;
  entity_title?: string | null;
}

export const EvidenceLinkDtoSchema = z.object({
  id: z.string().uuid(),
  evidence_id: z.string().uuid(),
  entity_type: EvidenceLinkEntityTypeSchema,
  entity_id: z.string().uuid(),
  created_at: z.string().datetime({ offset: true }),
  entity_title: z.string().nullable().optional(),
});

export interface EvidenceDto {
  id: string;
  user_id: string;
  evidence_type: EvidenceType;
  title: string;
  description: string | null;
  source_type: EvidenceSourceType;
  source_id: string | null;
  source_reference: string | null;
  external_url: string | null;
  occurred_at: string;
  recorded_at: string;
  verification_status: EvidenceVerificationStatus;
  evidence_strength: EvidenceStrength;
  reliability: EvidenceReliability;
  directness: EvidenceDirectness;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  links?: EvidenceLinkDto[];
}

export const EvidenceDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  evidence_type: EvidenceTypeSchema,
  title: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  source_type: EvidenceSourceTypeSchema,
  source_id: z.string().nullable().optional(),
  source_reference: z.string().nullable().optional(),
  external_url: z.string().url().max(1000).nullable().optional(),
  occurred_at: z.string().datetime({ offset: true }),
  recorded_at: z.string().datetime({ offset: true }),
  verification_status: EvidenceVerificationStatusSchema,
  evidence_strength: EvidenceStrengthSchema,
  reliability: EvidenceReliabilitySchema,
  directness: EvidenceDirectnessSchema,
  notes: z.string().max(2000).nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
  links: z.array(EvidenceLinkDtoSchema).optional(),
});

export const CreateEvidenceLinkInputSchema = z.object({
  entity_type: EvidenceLinkEntityTypeSchema,
  entity_id: z.string().uuid(),
});
export type CreateEvidenceLinkInput = z.infer<typeof CreateEvidenceLinkInputSchema>;

export const CreateEvidenceInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title cannot exceed 255 characters'),
  evidence_type: EvidenceTypeSchema,
  description: z.string().max(2000).optional().nullable(),
  occurred_at: z.string().datetime({ offset: true }).optional(),
  external_url: z
    .string()
    .url('Must be a valid URL')
    .max(1000)
    .optional()
    .nullable()
    .or(z.literal('')),
  notes: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
  links: z.array(CreateEvidenceLinkInputSchema).optional(),
});
export type CreateEvidenceInput = z.infer<typeof CreateEvidenceInputSchema>;

export const UpdateEvidenceInputSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  external_url: z
    .string()
    .url('Must be a valid URL')
    .max(1000)
    .optional()
    .nullable()
    .or(z.literal('')),
  metadata: z.record(z.unknown()).optional(),
  verification_status: EvidenceVerificationStatusSchema.optional(),
});
export type UpdateEvidenceInput = z.infer<typeof UpdateEvidenceInputSchema>;

export const EvidenceQuerySchema = z.object({
  evidence_type: EvidenceTypeSchema.optional(),
  source_type: EvidenceSourceTypeSchema.optional(),
  verification_status: EvidenceVerificationStatusSchema.optional(),
  occurred_from: z.string().datetime({ offset: true }).optional(),
  occurred_to: z.string().datetime({ offset: true }).optional(),
  goal_id: z.string().uuid().optional(),
  milestone_id: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type EvidenceQueryInput = z.input<typeof EvidenceQuerySchema>;
export type EvidenceQueryOutput = z.output<typeof EvidenceQuerySchema>;

export interface EvidenceSummary {
  total: number;
  verified: number;
  unverified: number;
  rejected: number;
}

export type EvidenceListResponse = PaginatedList<EvidenceDto> & {
  summary: EvidenceSummary;
};

// Aliases matching prompt requirements
export type Evidence = EvidenceDto;
export type EvidenceLink = EvidenceLinkDto;
