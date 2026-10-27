import { z } from 'zod';

// ==============================================================================
// 1. Providers & Status Enums
// ==============================================================================

export const IntegrationProviderSchema = z.enum(['github', 'leetcode', 'codeforces', 'google_calendar']);
export type IntegrationProvider = z.infer<typeof IntegrationProviderSchema>;

export const IntegrationConnectionStatusSchema = z.enum([
  'CONNECTED',
  'SYNCING',
  'SYNCED',
  'NEEDS_REAUTHORIZATION',
  'PERMISSION_ERROR',
  'RATE_LIMITED',
  'TEMPORARILY_UNAVAILABLE',
  'DISCONNECTED',
]);
export type IntegrationConnectionStatus = z.infer<typeof IntegrationConnectionStatusSchema>;

export const SyncJobStatusSchema = z.enum(['QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'RATE_LIMITED']);
export type SyncJobStatus = z.infer<typeof SyncJobStatusSchema>;

export const SyncJobTypeSchema = z.enum(['initial', 'incremental', 'manual']);
export type SyncJobType = z.infer<typeof SyncJobTypeSchema>;

export type ProviderCapability =
  | 'oauth'
  | 'repositories'
  | 'commits'
  | 'pull_requests'
  | 'issues'
  | 'profile'
  | 'languages'
  | 'activity'
  | 'calendar'
  | 'read_only';

// ==============================================================================
// 2. Safe Client DTOs (Never expose tokens or secrets to frontend)
// ==============================================================================

export const LeetCodeSyncStateSchema = z.object({
  totalSolved: z.number().int().nonnegative(),
  easySolved: z.number().int().nonnegative(),
  mediumSolved: z.number().int().nonnegative(),
  hardSolved: z.number().int().nonnegative(),
  ranking: z.number().int().nullable().optional(),
  contestRating: z.number().nullable().optional(),
  attendedContests: z.number().int().nullable().optional(),
});
export type LeetCodeSyncState = z.infer<typeof LeetCodeSyncStateSchema>;

export const CodeforcesSyncStateSchema = z.object({
  handle: z.string(),
  rating: z.number().int().nullable().optional(),
  maxRating: z.number().int().nullable().optional(),
  rank: z.string().nullable().optional(),
  maxRank: z.string().nullable().optional(),
  contribution: z.number().int().default(0),
  ratedContestsParticipated: z.number().int().nonnegative().default(0),
  lastContestId: z.number().int().nullable().optional(),
  lastContestName: z.string().nullable().optional(),
  lastContestRank: z.number().int().nullable().optional(),
});
export type CodeforcesSyncState = z.infer<typeof CodeforcesSyncStateSchema>;

export const GoogleCalendarSyncStateSchema = z.object({
  primaryCalendarId: z.string(),
  primaryCalendarTimeZone: z.string(),
  selectedCalendarIds: z.array(z.string()).default([]),
  calendars: z
    .array(
      z.object({
        id: z.string(),
        summary: z.string(),
        description: z.string().optional(),
        timeZone: z.string(),
        primary: z.boolean(),
        accessRole: z.string(),
      })
    )
    .default([]),
  syncTokens: z.record(z.string(), z.string()).default({}),
  lastSyncedAt: z.string().nullable().default(null),
});
export type GoogleCalendarSyncState = z.infer<typeof GoogleCalendarSyncStateSchema>;

export const NormalizedCalendarEventSchema = z.object({
  externalId: z.string(),
  calendarId: z.string(),
  title: z.string(),
  status: z.enum(['confirmed', 'tentative', 'cancelled']),
  startTime: z.string(),
  endTime: z.string(),
  isAllDay: z.boolean().default(false),
  timeZone: z.string().nullable().optional(),
  isBusy: z.boolean().default(true),
  isRecurring: z.boolean().default(false),
  recurringEventId: z.string().nullable().optional(),
  htmlLink: z.string().nullable().optional(),
});
export type NormalizedCalendarEvent = z.infer<typeof NormalizedCalendarEventSchema>;

export const ExternalCalendarEventDtoSchema = z.object({
  id: z.string().uuid(),
  connection_id: z.string().uuid(),
  calendar_id: z.string(),
  external_event_id: z.string(),
  title: z.string(),
  status: z.enum(['confirmed', 'tentative', 'cancelled']),
  start_time: z.string(),
  end_time: z.string(),
  is_all_day: z.boolean(),
  time_zone: z.string().nullable(),
  is_busy: z.boolean(),
  is_recurring: z.boolean(),
  recurring_event_id: z.string().nullable(),
  html_link: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ExternalCalendarEventDto = z.infer<typeof ExternalCalendarEventDtoSchema>;

export const IntegrationConnectionDtoSchema = z.object({
  id: z.string().uuid(),
  provider: IntegrationProviderSchema,
  external_account_id: z.string(),
  external_username: z.string().nullable(),
  external_display_name: z.string().nullable(),
  external_avatar_url: z.string().nullable(),
  external_email: z.string().nullable(),
  status: IntegrationConnectionStatusSchema,
  scopes: z.array(z.string()),
  sync_state: z.record(z.string(), z.unknown()).nullable().optional(),
  last_synced_at: z.string().nullable(),
  last_sync_started_at: z.string().nullable(),
  last_sync_completed_at: z.string().nullable(),
  last_error_code: z.string().nullable(),
  last_error_message: z.string().nullable(),
  connected_at: z.string(),
  disconnected_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type IntegrationConnectionDto = z.infer<typeof IntegrationConnectionDtoSchema>;

export const ExternalRepositoryDtoSchema = z.object({
  id: z.string().uuid(),
  connection_id: z.string().uuid(),
  provider: IntegrationProviderSchema,
  external_id: z.string(),
  name: z.string(),
  full_name: z.string(),
  owner: z.string(),
  is_private: z.boolean(),
  html_url: z.string().url(),
  description: z.string().nullable(),
  default_branch: z.string(),
  primary_language: z.string().nullable(),
  languages: z.record(z.string(), z.number()),
  stars_count: z.number().int(),
  forks_count: z.number().int(),
  open_issues_count: z.number().int(),
  pushed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ExternalRepositoryDto = z.infer<typeof ExternalRepositoryDtoSchema>;

export const ExternalActivityDtoSchema = z.object({
  id: z.string().uuid(),
  connection_id: z.string().uuid(),
  repository_id: z.string().uuid().nullable(),
  provider: IntegrationProviderSchema,
  external_id: z.string(),
  activity_type: z.string(),
  occurred_at: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  external_url: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ExternalActivityDto = z.infer<typeof ExternalActivityDtoSchema>;

export const SyncJobDtoSchema = z.object({
  id: z.string().uuid(),
  connection_id: z.string().uuid(),
  provider: IntegrationProviderSchema,
  job_type: SyncJobTypeSchema,
  status: SyncJobStatusSchema,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  records_synced: z.number().int(),
  error_message: z.string().nullable(),
  created_at: z.string(),
});
export type SyncJobDto = z.infer<typeof SyncJobDtoSchema>;

// ==============================================================================
// 3. API Request & Response Schemas
// ==============================================================================

export const CodeforcesConnectInputSchema = z.object({
  handle: z
    .string()
    .trim()
    .regex(
      /^[a-zA-Z0-9_.-]{3,24}$/,
      'Handle must be 3-24 characters containing letters, numbers, underscores, periods, or dashes'
    ),
});
export type CodeforcesConnectInput = z.infer<typeof CodeforcesConnectInputSchema>;

export const DirectConnectInputSchema = z
  .object({
    username: z.string().trim().max(100).optional(),
    handle: z.string().trim().max(100).optional(),
  })
  .refine((data) => Boolean(data.username || data.handle), {
    message: 'Username or handle is required',
  });
export type DirectConnectInput = z.infer<typeof DirectConnectInputSchema>;

export const OAuthInitResponseSchema = z.object({
  authorization_url: z.string().url(),
  state: z.string().min(16),
});
export type OAuthInitResponseDto = z.infer<typeof OAuthInitResponseSchema>;

export const OAuthCallbackInputSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
export type OAuthCallbackInput = z.infer<typeof OAuthCallbackInputSchema>;

export const IntegrationSyncResponseSchema = z.object({
  connection: IntegrationConnectionDtoSchema,
  job: SyncJobDtoSchema,
  repositories_synced: z.number().int().default(0),
  activities_synced: z.number().int().default(0),
  events_synced: z.number().int().optional().default(0),
});
export type IntegrationSyncResponseDto = z.infer<typeof IntegrationSyncResponseSchema>;

export const IntegrationStatusResponseSchema = z.object({
  connected: z.boolean(),
  connection: IntegrationConnectionDtoSchema.nullable(),
});
export type IntegrationStatusResponseDto = z.infer<typeof IntegrationStatusResponseSchema>;
