import { z } from 'zod';

// ==============================================================================
// Academics Domain Types & Schemas
// Phase 11: Foundational Academics Domain (Source of Truth)
// ==============================================================================

// --- Enums & Validation Constants ---

export const TERM_STATUSES = ['planned', 'active', 'completed', 'archived'] as const;
export type TermStatus = (typeof TERM_STATUSES)[number];
export const TermStatusSchema = z.enum(TERM_STATUSES);

export const SUBJECT_STATUSES = ['planned', 'active', 'completed', 'archived'] as const;
export type SubjectStatus = (typeof SUBJECT_STATUSES)[number];
export const SubjectStatusSchema = z.enum(SUBJECT_STATUSES);

export const TOPIC_STATUSES = ['not_started', 'in_progress', 'covered', 'needs_review'] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];
export const TopicStatusSchema = z.enum(TOPIC_STATUSES);

export const TOPIC_IMPORTANCES = ['low', 'medium', 'high', 'critical'] as const;
export type TopicImportance = (typeof TOPIC_IMPORTANCES)[number];
export const TopicImportanceSchema = z.enum(TOPIC_IMPORTANCES);

export const ASSESSMENT_TYPES = [
  'assignment',
  'quiz',
  'lab',
  'project',
  'internal',
  'presentation',
  'mock',
  'custom',
] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];
export const AssessmentTypeSchema = z.enum(ASSESSMENT_TYPES);

export const ASSESSMENT_STATUSES = [
  'planned',
  'in_progress',
  'submitted',
  'completed',
  'cancelled',
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];
export const AssessmentStatusSchema = z.enum(ASSESSMENT_STATUSES);

export const EXAM_TYPES = [
  'midterm',
  'endterm',
  'final',
  'mock',
  'practical',
  'viva',
  'custom',
] as const;
export type ExamType = (typeof EXAM_TYPES)[number];
export const ExamTypeSchema = z.enum(EXAM_TYPES);

export const EXAM_STATUSES = ['planned', 'completed', 'cancelled'] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];
export const ExamStatusSchema = z.enum(EXAM_STATUSES);

// --- Topic Resource Reference ---

export interface TopicResource {
  title: string;
  url?: string;
  type?: 'notes' | 'textbook' | 'pdf' | 'slides' | 'url' | 'other';
}

export const TopicResourceSchema = z.object({
  title: z.string().trim().min(1, 'Resource title is required').max(255),
  url: z.string().url('Invalid resource URL').optional().or(z.literal('')),
  type: z.enum(['notes', 'textbook', 'pdf', 'slides', 'url', 'other']).optional(),
});

// --- Syllabus Coverage Derived Metrics ---
// NOTE: "coverage" is syllabus exposure/completion. It is strictly NOT mastery or readiness.

export interface SyllabusCoverageSummary {
  total_topics: number;
  covered_topics: number;
  in_progress_topics: number;
  needs_review_topics: number;
  not_started_topics: number;
  coverage_percentage: number;
}

// --- DTO Interfaces ---

export interface AcademicYearDto {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface TermDto {
  id: string;
  user_id: string;
  academic_year_id: string | null;
  name: string;
  code: string | null;
  start_date: string;
  end_date: string;
  status: TermStatus;
  is_current: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  academic_year_name?: string | null;
  subject_count?: number;
}

export interface SubjectDto {
  id: string;
  user_id: string;
  term_id: string;
  name: string;
  code: string | null;
  description: string | null;
  instructor: string | null;
  credits: number | null;
  color: string | null;
  status: SubjectStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  term_name?: string | null;
  coverage?: SyllabusCoverageSummary;
}

export interface SubjectTopicDto {
  id: string;
  user_id: string;
  subject_id: string;
  name: string;
  description: string | null;
  order_index: number;
  status: TopicStatus;
  importance: TopicImportance;
  estimated_minutes: number | null;
  resources: TopicResource[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssessmentDto {
  id: string;
  user_id: string;
  term_id: string;
  subject_id: string | null;
  title: string;
  assessment_type: AssessmentType;
  description: string | null;
  due_at: string | null;
  max_marks: number | null;
  obtained_marks: number | null;
  weight_percent: number | null;
  status: AssessmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  subject_name?: string | null;
  covered_topic_ids?: string[];
  covered_topics?: SubjectTopicDto[];
}

export interface ExamDto {
  id: string;
  user_id: string;
  term_id: string;
  subject_id: string | null;
  title: string;
  exam_type: ExamType;
  exam_date: string;
  duration_minutes: number | null;
  location: string | null;
  weight_percent: number | null;
  status: ExamStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  subject_name?: string | null;
  covered_topic_ids?: string[];
  covered_topics?: SubjectTopicDto[];
}

export interface AcademicsOverviewDto {
  active_term: TermDto | null;
  subjects: SubjectDto[];
  upcoming_exams: ExamDto[];
  upcoming_assessments: AssessmentDto[];
  overall_coverage: SyllabusCoverageSummary;
}

// --- Validation Schemas ---

const AcademicYearBaseSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be YYYY-MM-DD'),
  is_current: z.boolean().default(false),
});

export const CreateAcademicYearSchema = AcademicYearBaseSchema.refine(
  (d) => d.start_date <= d.end_date,
  {
    message: 'start_date must be on or before end_date',
    path: ['start_date'],
  }
);

export const UpdateAcademicYearSchema = AcademicYearBaseSchema.partial().refine(
  (d) => {
    if (d.start_date && d.end_date) {
      return d.start_date <= d.end_date;
    }
    return true;
  },
  {
    message: 'start_date must be on or before end_date',
    path: ['start_date'],
  }
);

const TermBaseSchema = z.object({
  academic_year_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1, 'Name is required').max(100),
  code: z.string().trim().max(30).nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be YYYY-MM-DD'),
  status: TermStatusSchema.default('planned'),
  is_current: z.boolean().default(false),
  notes: z.string().max(3000).nullable().optional(),
});

export const CreateTermSchema = TermBaseSchema.refine((d) => d.start_date <= d.end_date, {
  message: 'start_date must be on or before end_date',
  path: ['start_date'],
});

export const UpdateTermSchema = TermBaseSchema.partial().refine(
  (d) => {
    if (d.start_date && d.end_date) {
      return d.start_date <= d.end_date;
    }
    return true;
  },
  {
    message: 'start_date must be on or before end_date',
    path: ['start_date'],
  }
);

export const CreateSubjectSchema = z.object({
  term_id: z.string().uuid('Invalid Term ID'),
  name: z.string().trim().min(1, 'Name is required').max(150),
  code: z.string().trim().max(30).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  instructor: z.string().max(100).nullable().optional(),
  credits: z.number().min(0, 'Credits cannot be negative').max(50).nullable().optional(),
  color: z.string().max(30).nullable().optional(),
  status: SubjectStatusSchema.default('planned'),
  notes: z.string().max(3000).nullable().optional(),
});

export const UpdateSubjectSchema = CreateSubjectSchema.partial();

export const CreateTopicSchema = z.object({
  name: z.string().trim().min(1, 'Topic name is required').max(200),
  description: z.string().max(2000).nullable().optional(),
  order_index: z.number().int().min(0).default(0),
  status: TopicStatusSchema.default('not_started'),
  importance: TopicImportanceSchema.default('medium'),
  estimated_minutes: z.number().int().min(0).nullable().optional(),
  resources: z.array(TopicResourceSchema).default([]),
  notes: z.string().max(3000).nullable().optional(),
});

export const UpdateTopicSchema = CreateTopicSchema.partial();

const AssessmentBaseSchema = z.object({
  term_id: z.string().uuid('Invalid Term ID'),
  subject_id: z.string().uuid('Invalid Subject ID').nullable().optional(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  assessment_type: AssessmentTypeSchema.default('assignment'),
  description: z.string().max(2000).nullable().optional(),
  due_at: z.string().datetime({ offset: true }).nullable().optional(),
  max_marks: z.number().positive('Max marks must be greater than 0').nullable().optional(),
  obtained_marks: z.number().min(0, 'Obtained marks cannot be negative').nullable().optional(),
  weight_percent: z.number().min(0).max(100).nullable().optional(),
  status: AssessmentStatusSchema.default('planned'),
  notes: z.string().max(3000).nullable().optional(),
  topic_ids: z.array(z.string().uuid()).optional(),
});

export const CreateAssessmentSchema = AssessmentBaseSchema.refine(
  (d) =>
    d.obtained_marks == null ||
    d.max_marks == null ||
    d.obtained_marks <= d.max_marks,
  {
    message: 'obtained_marks cannot exceed max_marks',
    path: ['obtained_marks'],
  }
);

export const UpdateAssessmentSchema = AssessmentBaseSchema.partial().refine(
  (d) =>
    d.obtained_marks == null ||
    d.max_marks == null ||
    d.obtained_marks <= d.max_marks,
  {
    message: 'obtained_marks cannot exceed max_marks',
    path: ['obtained_marks'],
  }
);

export const CreateExamSchema = z.object({
  term_id: z.string().uuid('Invalid Term ID'),
  subject_id: z.string().uuid('Invalid Subject ID').nullable().optional(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  exam_type: ExamTypeSchema.default('midterm'),
  exam_date: z.string().datetime({ offset: true }),
  duration_minutes: z.number().int().positive('Duration must be positive').nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  weight_percent: z.number().min(0).max(100).nullable().optional(),
  status: ExamStatusSchema.default('planned'),
  notes: z.string().max(3000).nullable().optional(),
  topic_ids: z.array(z.string().uuid()).optional(),
});

export const UpdateExamSchema = CreateExamSchema.partial();
