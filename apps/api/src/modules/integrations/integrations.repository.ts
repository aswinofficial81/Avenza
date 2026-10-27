import type {
  IntegrationConnectionStatus,
  IntegrationProvider,
  SyncJobStatus,
  SyncJobType,
} from '@avenza/shared';
import type {
  NormalizedActivityData,
  NormalizedRepositoryData,
} from '../../infrastructure/providers/base/provider.types';

export interface IntegrationConnectionEntity {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  external_account_id: string;
  external_username: string | null;
  external_display_name: string | null;
  external_avatar_url: string | null;
  external_email: string | null;
  status: IntegrationConnectionStatus;
  scopes: string[];
  encrypted_access_token: string | null;
  encrypted_refresh_token: string | null;
  token_expires_at: string | null;
  sync_state: Record<string, unknown>;
  sync_cursor: string | null;
  last_sync_started_at: string | null;
  last_sync_completed_at: string | null;
  last_synced_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  connected_at: string;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExternalRepositoryEntity {
  id: string;
  connection_id: string;
  user_id: string;
  provider: IntegrationProvider;
  external_id: string;
  name: string;
  full_name: string;
  owner: string;
  is_private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  primary_language: string | null;
  languages: Record<string, number>;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExternalActivityEntity {
  id: string;
  connection_id: string;
  user_id: string;
  repository_id: string | null;
  provider: IntegrationProvider;
  external_id: string;
  activity_type: string;
  occurred_at: string;
  title: string;
  summary: string | null;
  external_url: string | null;
  metadata: Record<string, unknown>;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SyncJobEntity {
  id: string;
  connection_id: string;
  user_id: string;
  provider: IntegrationProvider;
  job_type: SyncJobType;
  status: SyncJobStatus;
  started_at: string | null;
  completed_at: string | null;
  records_synced: number;
  error_message: string | null;
  created_at: string;
}

export interface OAuthStateEntity {
  state: string;
  user_id: string;
  provider: IntegrationProvider;
  redirect_url: string | null;
  created_at: string;
  expires_at: string;
}

export interface ExternalCalendarEventEntity {
  id: string;
  connection_id: string;
  user_id: string;
  calendar_id: string;
  external_event_id: string;
  title: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  time_zone: string | null;
  is_busy: boolean;
  is_recurring: boolean;
  recurring_event_id: string | null;
  html_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface IIntegrationsRepository {
  getConnection(userId: string, provider: IntegrationProvider): Promise<IntegrationConnectionEntity | null>;
  getConnectionById(connectionId: string): Promise<IntegrationConnectionEntity | null>;
  listConnections(userId: string): Promise<IntegrationConnectionEntity[]>;
  upsertConnection(
    userId: string,
    data: {
      provider: IntegrationProvider;
      external_account_id: string;
      external_username: string | null;
      external_display_name: string | null;
      external_avatar_url: string | null;
      external_email: string | null;
      status: IntegrationConnectionStatus;
      scopes: string[];
      encrypted_access_token: string | null;
      encrypted_refresh_token?: string | null;
      token_expires_at?: string | null;
    }
  ): Promise<IntegrationConnectionEntity>;
  updateConnectionStatus(
    connectionId: string,
    updates: {
      status: IntegrationConnectionStatus;
      sync_cursor?: string | null;
      last_sync_started_at?: string | null;
      last_sync_completed_at?: string | null;
      last_synced_at?: string | null;
      last_error_code?: string | null;
      last_error_message?: string | null;
      disconnected_at?: string | null;
      encrypted_access_token?: string | null;
      encrypted_refresh_token?: string | null;
      token_expires_at?: string | null;
      sync_state?: Record<string, unknown>;
    }
  ): Promise<IntegrationConnectionEntity>;
  updateConnectionTokens(
    connectionId: string,
    tokens: {
      encrypted_access_token: string | null;
      encrypted_refresh_token?: string | null;
      token_expires_at?: string | null;
    }
  ): Promise<void>;
  saveOAuthState(
    userId: string,
    provider: IntegrationProvider,
    state: string,
    redirectUrl?: string
  ): Promise<OAuthStateEntity>;
  getAndConsumeOAuthState(state: string): Promise<OAuthStateEntity | null>;
  upsertRepositories(
    connectionId: string,
    userId: string,
    provider: IntegrationProvider,
    repos: NormalizedRepositoryData[]
  ): Promise<ExternalRepositoryEntity[]>;
  upsertActivities(
    connectionId: string,
    userId: string,
    provider: IntegrationProvider,
    activities: NormalizedActivityData[]
  ): Promise<ExternalActivityEntity[]>;
  upsertCalendarEvents(
    connectionId: string,
    userId: string,
    events: import('@avenza/shared').NormalizedCalendarEvent[]
  ): Promise<ExternalCalendarEventEntity[]>;
  listCalendarEvents(
    userId: string,
    options?: { calendarId?: string; timeMin?: string; timeMax?: string }
  ): Promise<ExternalCalendarEventEntity[]>;
  createSyncJob(
    connectionId: string,
    userId: string,
    provider: IntegrationProvider,
    jobType: SyncJobType
  ): Promise<SyncJobEntity>;
  updateSyncJob(
    jobId: string,
    updates: {
      status: SyncJobStatus;
      completed_at?: string | null;
      records_synced?: number;
      error_message?: string | null;
    }
  ): Promise<SyncJobEntity>;
  listRepositories(userId: string, provider: IntegrationProvider): Promise<ExternalRepositoryEntity[]>;
  listActivities(userId: string, provider: IntegrationProvider, limit?: number): Promise<ExternalActivityEntity[]>;
  createExternalActivityEvidence(
    userId: string,
    provider: IntegrationProvider,
    activity: NormalizedActivityData
  ): Promise<boolean>;
}
