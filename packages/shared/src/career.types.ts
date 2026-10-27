import { z } from 'zod';

// ==============================================================================
// 1. Enum Definitions & Schemas
// ==============================================================================

export const CAREER_EMPLOYMENT_TYPES = [
  'internship',
  'full_time',
  'contract',
  'part_time',
  'co_op',
] as const;
export type CareerEmploymentType = (typeof CAREER_EMPLOYMENT_TYPES)[number];
export const CareerEmploymentTypeSchema = z.enum(CAREER_EMPLOYMENT_TYPES);

export const CAREER_LOCATION_TYPES = [
  'remote',
  'hybrid',
  'onsite',
] as const;
export type CareerLocationType = (typeof CAREER_LOCATION_TYPES)[number];
export const CareerLocationTypeSchema = z.enum(CAREER_LOCATION_TYPES);

export const CAREER_OPPORTUNITY_SOURCES = [
  'linkedin',
  'indeed',
  'company_website',
  'referral',
  'career_fair',
  'cold_outreach',
  'other',
] as const;
export type CareerOpportunitySource = (typeof CAREER_OPPORTUNITY_SOURCES)[number];
export const CareerOpportunitySourceSchema = z.enum(CAREER_OPPORTUNITY_SOURCES);

export const CAREER_OPPORTUNITY_STATUSES = [
  'active',
  'archived',
  'expired',
] as const;
export type CareerOpportunityStatus = (typeof CAREER_OPPORTUNITY_STATUSES)[number];
export const CareerOpportunityStatusSchema = z.enum(CAREER_OPPORTUNITY_STATUSES);

export const CAREER_APPLICATION_STAGES = [
  'saved',
  'applied',
  'screening',
  'assessment',
  'interview',
  'offer',
  'accepted',
  'declined',
  'rejected',
  'withdrawn',
  'closed',
] as const;
export type CareerApplicationStage = (typeof CAREER_APPLICATION_STAGES)[number];
export const CareerApplicationStageSchema = z.enum(CAREER_APPLICATION_STAGES);

export const CAREER_TERMINAL_STAGES: readonly CareerApplicationStage[] = [
  'accepted',
  'declined',
  'rejected',
  'withdrawn',
  'closed',
] as const;

export const CAREER_STAGE_TRANSITIONS: Record<
  CareerApplicationStage,
  readonly CareerApplicationStage[]
> = {
  saved: ['applied', 'withdrawn', 'closed'],
  applied: ['screening', 'assessment', 'interview', 'offer', 'rejected', 'withdrawn', 'closed'],
  screening: ['assessment', 'interview', 'offer', 'rejected', 'withdrawn', 'closed'],
  assessment: ['interview', 'offer', 'rejected', 'withdrawn', 'closed'],
  interview: ['assessment', 'interview', 'offer', 'rejected', 'withdrawn', 'closed'],
  offer: ['accepted', 'declined', 'withdrawn'],
  accepted: [],
  declined: [],
  rejected: [],
  withdrawn: [],
  closed: [],
};

export function isTerminalStage(stage: CareerApplicationStage): boolean {
  return (CAREER_TERMINAL_STAGES as readonly string[]).includes(stage);
}

export function isValidStageTransition(
  fromStage: CareerApplicationStage,
  toStage: CareerApplicationStage
): boolean {
  if (isTerminalStage(fromStage)) {
    return false;
  }
  const allowed = CAREER_STAGE_TRANSITIONS[fromStage];
  return allowed ? allowed.includes(toStage) : false;
}

export const CAREER_INTERVIEW_TYPES = [
  'recruiter_screen',
  'technical_dsa',
  'system_design',
  'take_home_review',
  'hiring_manager',
  'behavioral',
  'executive',
  'other',
] as const;
export type CareerInterviewType = (typeof CAREER_INTERVIEW_TYPES)[number];
export const CareerInterviewTypeSchema = z.enum(CAREER_INTERVIEW_TYPES);

export const CAREER_INTERVIEW_STATUSES = [
  'scheduled',
  'completed',
  'cancelled',
  'rescheduled',
] as const;
export type CareerInterviewStatus = (typeof CAREER_INTERVIEW_STATUSES)[number];
export const CareerInterviewStatusSchema = z.enum(CAREER_INTERVIEW_STATUSES);

export const CAREER_INTERVIEW_RESULTS = [
  'pending',
  'passed',
  'failed',
  'neutral',
] as const;
export type CareerInterviewResult = (typeof CAREER_INTERVIEW_RESULTS)[number];
export const CareerInterviewResultSchema = z.enum(CAREER_INTERVIEW_RESULTS);

export const CAREER_SKILL_IMPORTANCES = [
  'required',
  'preferred',
  'bonus',
] as const;
export type CareerSkillImportance = (typeof CAREER_SKILL_IMPORTANCES)[number];
export const CareerSkillImportanceSchema = z.enum(CAREER_SKILL_IMPORTANCES);

// ==============================================================================
// 2. Common URL & Currency Validators
// ==============================================================================

export const CareerUrlSchema = z
  .string()
  .trim()
  .max(2048, 'URL must be at most 2048 characters')
  .url('Must be a valid URL')
  .refine(
    (url) => /^https?:\/\//i.test(url),
    { message: 'URL must use http:// or https:// protocol' }
  );

export const CareerCurrencySchema = z
  .string()
  .trim()
  .length(3, 'Currency must be a 3-letter ISO code')
  .regex(/^[a-zA-Z]{3}$/, 'Currency must be 3 letters (e.g. USD, EUR, INR)')
  .transform((val) => val.toUpperCase());

// ==============================================================================
// 3. Entity & Response DTOs
// ==============================================================================

// --- Career Target ---
export interface CareerTargetDto {
  id: string;
  user_id: string;
  goal_id: string | null;
  title: string;
  target_role: string;
  target_locations: string[];
  employment_type: CareerEmploymentType | null;
  target_date: string | null;
  min_compensation: number | null;
  currency: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const CareerTargetDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  goal_id: z.string().uuid().nullable(),
  title: z.string(),
  target_role: z.string(),
  target_locations: z.array(z.string()),
  employment_type: CareerEmploymentTypeSchema.nullable(),
  target_date: z.string().nullable(),
  min_compensation: z.number().nullable(),
  currency: z.string().nullable(),
  is_primary: z.boolean(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// --- Career Target Skill ---
export interface CareerTargetSkillDto {
  id: string;
  user_id: string;
  target_id: string;
  skill_id: string;
  importance: CareerSkillImportance;
  created_at: string;
  skill_name?: string;
  skill_slug?: string;
  skill_category?: string | null;
}

export const CareerTargetSkillDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  target_id: z.string().uuid(),
  skill_id: z.string().uuid(),
  importance: CareerSkillImportanceSchema,
  created_at: z.string(),
  skill_name: z.string().optional(),
  skill_slug: z.string().optional(),
  skill_category: z.string().nullable().optional(),
});

export interface CareerTargetDetailDto extends CareerTargetDto {
  goal_title?: string | null;
  skills: CareerTargetSkillDto[];
  opportunity_count?: number;
}

// --- Career Opportunity ---
export interface CareerOpportunityDto {
  id: string;
  user_id: string;
  target_id: string | null;
  company_name: string;
  role_title: string;
  employment_type: CareerEmploymentType | null;
  location_type: CareerLocationType | null;
  location: string | null;
  source: CareerOpportunitySource;
  job_url: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  deadline: string | null;
  description: string | null;
  status: CareerOpportunityStatus;
  created_at: string;
  updated_at: string;
}

export const CareerOpportunityDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  target_id: z.string().uuid().nullable(),
  company_name: z.string(),
  role_title: z.string(),
  employment_type: CareerEmploymentTypeSchema.nullable(),
  location_type: CareerLocationTypeSchema.nullable(),
  location: z.string().nullable(),
  source: CareerOpportunitySourceSchema,
  job_url: z.string().nullable(),
  salary_min: z.number().nullable(),
  salary_max: z.number().nullable(),
  salary_currency: z.string().nullable(),
  deadline: z.string().nullable(),
  description: z.string().nullable(),
  status: CareerOpportunityStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

// --- Career Opportunity Skill ---
export interface CareerOpportunitySkillDto {
  id: string;
  user_id: string;
  opportunity_id: string;
  skill_id: string;
  importance: CareerSkillImportance;
  created_at: string;
  skill_name?: string;
  skill_slug?: string;
  skill_category?: string | null;
}

export const CareerOpportunitySkillDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  opportunity_id: z.string().uuid(),
  skill_id: z.string().uuid(),
  importance: CareerSkillImportanceSchema,
  created_at: z.string(),
  skill_name: z.string().optional(),
  skill_slug: z.string().optional(),
  skill_category: z.string().nullable().optional(),
});

export interface CareerOpportunityDetailDto extends CareerOpportunityDto {
  target_title?: string | null;
  skills: CareerOpportunitySkillDto[];
  application?: CareerApplicationDto | null;
}

// --- Career Application ---
export interface CareerApplicationDto {
  id: string;
  user_id: string;
  opportunity_id: string;
  stage: CareerApplicationStage;
  applied_at: string | null;
  deadline: string | null;
  resume_file_url: string | null;
  cover_letter_url: string | null;
  notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const CareerApplicationDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  opportunity_id: z.string().uuid(),
  stage: CareerApplicationStageSchema,
  applied_at: z.string().nullable(),
  deadline: z.string().nullable(),
  resume_file_url: z.string().nullable(),
  cover_letter_url: z.string().nullable(),
  notes: z.string().nullable(),
  rejection_reason: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// --- Career Application History ---
export interface CareerApplicationHistoryDto {
  id: string;
  user_id: string;
  application_id: string;
  from_stage: CareerApplicationStage | null;
  to_stage: CareerApplicationStage;
  changed_at: string;
  notes: string | null;
}

export const CareerApplicationHistoryDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  application_id: z.string().uuid(),
  from_stage: CareerApplicationStageSchema.nullable(),
  to_stage: CareerApplicationStageSchema,
  changed_at: z.string(),
  notes: z.string().nullable(),
});

// --- Career Application Project ---
export interface CareerApplicationProjectDto {
  id: string;
  user_id: string;
  application_id: string;
  project_id: string;
  is_featured: boolean;
  talking_points: string | null;
  created_at: string;
  project_title?: string;
  project_slug?: string;
  project_status?: string;
}

export const CareerApplicationProjectDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  application_id: z.string().uuid(),
  project_id: z.string().uuid(),
  is_featured: z.boolean(),
  talking_points: z.string().nullable(),
  created_at: z.string(),
  project_title: z.string().optional(),
  project_slug: z.string().optional(),
  project_status: z.string().optional(),
});

// --- Career Interview ---
export interface CareerInterviewDto {
  id: string;
  user_id: string;
  application_id: string;
  round_number: number;
  round_type: CareerInterviewType;
  scheduled_at: string | null;
  duration_minutes: number;
  meeting_link: string | null;
  status: CareerInterviewStatus;
  result: CareerInterviewResult;
  interviewer_names: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const CareerInterviewDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  application_id: z.string().uuid(),
  round_number: z.number().int().positive(),
  round_type: CareerInterviewTypeSchema,
  scheduled_at: z.string().nullable(),
  duration_minutes: z.number().int().positive(),
  meeting_link: z.string().nullable(),
  status: CareerInterviewStatusSchema,
  result: CareerInterviewResultSchema,
  interviewer_names: z.array(z.string()),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// --- Composite Detail for Application ---
export interface CareerApplicationDetailDto extends CareerApplicationDto {
  opportunity?: CareerOpportunityDto;
  history: CareerApplicationHistoryDto[];
  projects: CareerApplicationProjectDto[];
  interviews: CareerInterviewDto[];
}

// ==============================================================================
// 4. Input Validation Schemas
// ==============================================================================

// Helper for salary range comparison
const salaryRangeRefine = <T extends { salary_min?: number | null; salary_max?: number | null }>(
  data: T
) => {
  if (data.salary_min != null && data.salary_max != null) {
    return data.salary_max >= data.salary_min;
  }
  return true;
};

// --- Career Target Inputs ---
export const CreateCareerTargetSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Target title is required')
    .max(150, 'Target title must be at most 150 characters'),
  target_role: z
    .string()
    .trim()
    .min(1, 'Target role is required')
    .max(100, 'Target role must be at most 100 characters'),
  target_locations: z
    .array(z.string().trim().min(1).max(100))
    .default([]),
  employment_type: CareerEmploymentTypeSchema.nullable().optional(),
  target_date: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid target date format' })
    .nullable()
    .optional(),
  min_compensation: z
    .number()
    .min(0, 'Minimum compensation must be non-negative')
    .nullable()
    .optional(),
  currency: CareerCurrencySchema.nullable().optional(),
  is_primary: z.boolean().default(false),
  notes: z
    .string()
    .max(10000, 'Notes must be at most 10000 characters')
    .nullable()
    .optional(),
  goal_id: z.string().uuid('Invalid goal ID').nullable().optional(),
});

export type CreateCareerTargetInput = z.input<typeof CreateCareerTargetSchema>;

export const UpdateCareerTargetSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Target title cannot be empty')
    .max(150, 'Target title must be at most 150 characters')
    .optional(),
  target_role: z
    .string()
    .trim()
    .min(1, 'Target role cannot be empty')
    .max(100, 'Target role must be at most 100 characters')
    .optional(),
  target_locations: z
    .array(z.string().trim().min(1).max(100))
    .optional(),
  employment_type: CareerEmploymentTypeSchema.nullable().optional(),
  target_date: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid target date format' })
    .nullable()
    .optional(),
  min_compensation: z
    .number()
    .min(0, 'Minimum compensation must be non-negative')
    .nullable()
    .optional(),
  currency: CareerCurrencySchema.nullable().optional(),
  is_primary: z.boolean().optional(),
  notes: z
    .string()
    .max(10000, 'Notes must be at most 10000 characters')
    .nullable()
    .optional(),
  goal_id: z.string().uuid('Invalid goal ID').nullable().optional(),
});

export type UpdateCareerTargetInput = z.input<typeof UpdateCareerTargetSchema>;

// --- Career Target Skill Inputs ---
export const AddCareerTargetSkillSchema = z.object({
  skill_id: z.string().uuid('Invalid skill ID'),
  importance: CareerSkillImportanceSchema.default('required'),
});

export type AddCareerTargetSkillInput = z.input<typeof AddCareerTargetSkillSchema>;

export const UpdateCareerTargetSkillSchema = z.object({
  importance: CareerSkillImportanceSchema,
});

export type UpdateCareerTargetSkillInput = z.infer<typeof UpdateCareerTargetSkillSchema>;

// --- Career Opportunity Inputs ---
export const CreateCareerOpportunitySchema = z
  .object({
    company_name: z
      .string()
      .trim()
      .min(1, 'Company name is required')
      .max(150, 'Company name must be at most 150 characters'),
    role_title: z
      .string()
      .trim()
      .min(1, 'Role title is required')
      .max(150, 'Role title must be at most 150 characters'),
    target_id: z.string().uuid('Invalid target ID').nullable().optional(),
    employment_type: CareerEmploymentTypeSchema.nullable().optional(),
    location_type: CareerLocationTypeSchema.nullable().optional(),
    location: z
      .string()
      .trim()
      .max(200, 'Location must be at most 200 characters')
      .nullable()
      .optional(),
    source: CareerOpportunitySourceSchema.default('other'),
    job_url: CareerUrlSchema.nullable().optional(),
    salary_min: z
      .number()
      .min(0, 'Minimum salary must be non-negative')
      .nullable()
      .optional(),
    salary_max: z
      .number()
      .min(0, 'Maximum salary must be non-negative')
      .nullable()
      .optional(),
    salary_currency: CareerCurrencySchema.nullable().optional(),
    deadline: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional(),
    description: z
      .string()
      .max(10000, 'Description must be at most 10000 characters')
      .nullable()
      .optional(),
    status: CareerOpportunityStatusSchema.default('active'),
  })
  .refine(salaryRangeRefine, {
    message: 'salary_max must be greater than or equal to salary_min',
    path: ['salary_max'],
  });

export type CreateCareerOpportunityInput = z.input<typeof CreateCareerOpportunitySchema>;

export const UpdateCareerOpportunitySchema = z
  .object({
    company_name: z
      .string()
      .trim()
      .min(1, 'Company name cannot be empty')
      .max(150, 'Company name must be at most 150 characters')
      .optional(),
    role_title: z
      .string()
      .trim()
      .min(1, 'Role title cannot be empty')
      .max(150, 'Role title must be at most 150 characters')
      .optional(),
    target_id: z.string().uuid('Invalid target ID').nullable().optional(),
    employment_type: CareerEmploymentTypeSchema.nullable().optional(),
    location_type: CareerLocationTypeSchema.nullable().optional(),
    location: z
      .string()
      .trim()
      .max(200, 'Location must be at most 200 characters')
      .nullable()
      .optional(),
    source: CareerOpportunitySourceSchema.optional(),
    job_url: CareerUrlSchema.nullable().optional(),
    salary_min: z
      .number()
      .min(0, 'Minimum salary must be non-negative')
      .nullable()
      .optional(),
    salary_max: z
      .number()
      .min(0, 'Maximum salary must be non-negative')
      .nullable()
      .optional(),
    salary_currency: CareerCurrencySchema.nullable().optional(),
    deadline: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional(),
    description: z
      .string()
      .max(10000, 'Description must be at most 10000 characters')
      .nullable()
      .optional(),
    status: CareerOpportunityStatusSchema.optional(),
  })
  .refine(salaryRangeRefine, {
    message: 'salary_max must be greater than or equal to salary_min',
    path: ['salary_max'],
  });

export type UpdateCareerOpportunityInput = z.input<typeof UpdateCareerOpportunitySchema>;

// --- Career Opportunity Skill Inputs ---
export const AddCareerOpportunitySkillSchema = z.object({
  skill_id: z.string().uuid('Invalid skill ID'),
  importance: CareerSkillImportanceSchema.default('required'),
});

export type AddCareerOpportunitySkillInput = z.input<typeof AddCareerOpportunitySkillSchema>;

export const UpdateCareerOpportunitySkillSchema = z.object({
  importance: CareerSkillImportanceSchema,
});

export type UpdateCareerOpportunitySkillInput = z.input<typeof UpdateCareerOpportunitySkillSchema>;

// --- Career Application Inputs ---
export const CreateCareerApplicationSchema = z.object({
  opportunity_id: z.string().uuid('Invalid opportunity ID'),
  stage: CareerApplicationStageSchema.default('saved'),
  applied_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  deadline: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  resume_file_url: CareerUrlSchema.nullable().optional(),
  cover_letter_url: CareerUrlSchema.nullable().optional(),
  notes: z
    .string()
    .max(10000, 'Notes must be at most 10000 characters')
    .nullable()
    .optional(),
  rejection_reason: z
    .string()
    .max(2000, 'Rejection reason must be at most 2000 characters')
    .nullable()
    .optional(),
});

export type CreateCareerApplicationInput = z.input<typeof CreateCareerApplicationSchema>;

export const UpdateCareerApplicationSchema = z.object({
  stage: CareerApplicationStageSchema.optional(),
  applied_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  deadline: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  resume_file_url: CareerUrlSchema.nullable().optional(),
  cover_letter_url: CareerUrlSchema.nullable().optional(),
  notes: z
    .string()
    .max(10000, 'Notes must be at most 10000 characters')
    .nullable()
    .optional(),
  rejection_reason: z
    .string()
    .max(2000, 'Rejection reason must be at most 2000 characters')
    .nullable()
    .optional(),
});

export type UpdateCareerApplicationInput = z.input<typeof UpdateCareerApplicationSchema>;

// --- Career Application History Inputs ---
export const CreateCareerApplicationHistorySchema = z.object({
  from_stage: CareerApplicationStageSchema.nullable().optional(),
  to_stage: CareerApplicationStageSchema,
  changed_at: z
    .string()
    .datetime({ offset: true })
    .optional(),
  notes: z
    .string()
    .max(5000, 'History notes must be at most 5000 characters')
    .nullable()
    .optional(),
});

export type CreateCareerApplicationHistoryInput = z.input<typeof CreateCareerApplicationHistorySchema>;

// --- Career Application Project Inputs ---
export const AttachCareerApplicationProjectSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  is_featured: z.boolean().default(false),
  talking_points: z
    .string()
    .max(5000, 'Talking points must be at most 5000 characters')
    .nullable()
    .optional(),
});

export type AttachCareerApplicationProjectInput = z.input<typeof AttachCareerApplicationProjectSchema>;

export const UpdateCareerApplicationProjectSchema = z.object({
  is_featured: z.boolean().optional(),
  talking_points: z
    .string()
    .max(5000, 'Talking points must be at most 5000 characters')
    .nullable()
    .optional(),
});

export type UpdateCareerApplicationProjectInput = z.input<typeof UpdateCareerApplicationProjectSchema>;

// --- Career Interview Inputs ---
export const CreateCareerInterviewSchema = z.object({
  round_number: z
    .number()
    .int()
    .positive('Round number must be a positive integer')
    .default(1),
  round_type: CareerInterviewTypeSchema.default('recruiter_screen'),
  scheduled_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  duration_minutes: z
    .number()
    .int()
    .positive('Duration must be a positive integer')
    .default(45),
  meeting_link: CareerUrlSchema.nullable().optional(),
  status: CareerInterviewStatusSchema.default('scheduled'),
  result: CareerInterviewResultSchema.default('pending'),
  interviewer_names: z
    .array(z.string().trim().min(1).max(150))
    .default([]),
  notes: z
    .string()
    .max(10000, 'Notes must be at most 10000 characters')
    .nullable()
    .optional(),
});

export type CreateCareerInterviewInput = z.input<typeof CreateCareerInterviewSchema>;

export const UpdateCareerInterviewSchema = z.object({
  round_number: z
    .number()
    .int()
    .positive('Round number must be a positive integer')
    .optional(),
  round_type: CareerInterviewTypeSchema.optional(),
  scheduled_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  duration_minutes: z
    .number()
    .int()
    .positive('Duration must be a positive integer')
    .optional(),
  meeting_link: CareerUrlSchema.nullable().optional(),
  status: CareerInterviewStatusSchema.optional(),
  result: CareerInterviewResultSchema.optional(),
  interviewer_names: z
    .array(z.string().trim().min(1).max(150))
    .optional(),
  notes: z
    .string()
    .max(10000, 'Notes must be at most 10000 characters')
    .nullable()
    .optional(),
});

export type UpdateCareerInterviewInput = z.input<typeof UpdateCareerInterviewSchema>;

// ==============================================================================
// 5. Query & Filter Schemas
// ==============================================================================

export const CareerTargetQuerySchema = z.object({
  search: z.string().max(100).optional(),
  is_primary: z.coerce.boolean().optional(),
  employment_type: CareerEmploymentTypeSchema.optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'target_date', 'title']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CareerTargetQueryInput = z.input<typeof CareerTargetQuerySchema>;
export type CareerTargetQueryOutput = z.infer<typeof CareerTargetQuerySchema>;

export const CareerOpportunityQuerySchema = z.object({
  target_id: z.string().uuid().optional(),
  status: CareerOpportunityStatusSchema.optional(),
  employment_type: CareerEmploymentTypeSchema.optional(),
  location_type: CareerLocationTypeSchema.optional(),
  source: CareerOpportunitySourceSchema.optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'deadline', 'company_name', 'role_title']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CareerOpportunityQueryInput = z.input<typeof CareerOpportunityQuerySchema>;
export type CareerOpportunityQueryOutput = z.infer<typeof CareerOpportunityQuerySchema>;

export const CareerApplicationQuerySchema = z.object({
  stage: CareerApplicationStageSchema.optional(),
  opportunity_id: z.string().uuid().optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'applied_at', 'deadline']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CareerApplicationQueryInput = z.input<typeof CareerApplicationQuerySchema>;
export type CareerApplicationQueryOutput = z.infer<typeof CareerApplicationQuerySchema>;

export const CareerInterviewQuerySchema = z.object({
  application_id: z.string().uuid().optional(),
  status: CareerInterviewStatusSchema.optional(),
  result: CareerInterviewResultSchema.optional(),
  round_type: CareerInterviewTypeSchema.optional(),
  scheduled_after: z.string().datetime({ offset: true }).optional(),
  scheduled_before: z.string().datetime({ offset: true }).optional(),
  sortBy: z.enum(['scheduled_at', 'created_at', 'round_number']).default('scheduled_at'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CareerInterviewQueryInput = z.input<typeof CareerInterviewQuerySchema>;
export type CareerInterviewQueryOutput = z.infer<typeof CareerInterviewQuerySchema>;

// ==============================================================================
// 6. Readiness & Preparation Integration Contracts
// ==============================================================================

export interface CareerSkillReadinessItem {
  skill_id: string;
  skill_name: string;
  skill_slug: string;
  skill_category: string | null;
  importance: CareerSkillImportance;
  source: 'target' | 'opportunity' | 'both';
  // Authoritative mastery from Skills domain (read-only)
  current_level?: string | null;
  mastery_score?: number | null;
  confidence_score?: number | null;
  status?: string | null;
  is_verified?: boolean | null;
  is_acquired: boolean;
}

export interface CareerProjectEvidenceItem {
  id: string;
  title: string;
  evidence_type: string;
  verification_status: string;
  occurred_at: string;
  external_url: string | null;
}

export interface CareerProjectReadinessItem {
  project_id: string;
  title: string;
  slug: string;
  status: string;
  is_featured: boolean;
  talking_points: string | null;
  evidence: CareerProjectEvidenceItem[];
}

export interface CareerTaskReadinessItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  completed_at: string | null;
  is_blocked: boolean;
}

export interface CareerApplicationPreparationDto {
  application_id: string;
  company_name: string;
  role_title: string;
  current_stage: CareerApplicationStage;
  target_id: string | null;
  opportunity_id: string;
  skills: {
    required: CareerSkillReadinessItem[];
    preferred: CareerSkillReadinessItem[];
    bonus: CareerSkillReadinessItem[];
    summary: {
      total_skills: number;
      acquired_skills: number;
      missing_skills: number;
      required_total: number;
      required_acquired: number;
    };
  };
  projects: {
    featured: CareerProjectReadinessItem[];
    supporting: CareerProjectReadinessItem[];
  };
  tasks: {
    open: CareerTaskReadinessItem[];
    completed: CareerTaskReadinessItem[];
    open_count: number;
    completed_count: number;
  };
  interviews: CareerInterviewDto[];
}
