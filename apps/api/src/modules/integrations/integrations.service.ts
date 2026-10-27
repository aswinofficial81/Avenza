import type {
  ExternalActivityDto,
  ExternalRepositoryDto,
  IntegrationConnectionDto,
  IntegrationProvider,
  IntegrationSyncResponseDto,
  OAuthInitResponseDto,
  SyncJobType,
} from '@avenza/shared';

export interface IIntegrationsService {
  initiateOAuth(
    userId: string,
    provider: IntegrationProvider,
    redirectUrl?: string
  ): Promise<OAuthInitResponseDto>;

  handleOAuthCallback(
    userId: string,
    provider: IntegrationProvider,
    code: string,
    state: string
  ): Promise<IntegrationConnectionDto>;

  connectWithIdentifier(
    userId: string,
    provider: IntegrationProvider,
    identifier: string
  ): Promise<IntegrationConnectionDto>;

  syncConnection(
    userId: string,
    provider: IntegrationProvider,
    jobType?: SyncJobType
  ): Promise<IntegrationSyncResponseDto>;

  disconnect(
    userId: string,
    provider: IntegrationProvider
  ): Promise<IntegrationConnectionDto>;

  revokeAllUserCredentials(
    userId: string
  ): Promise<{ success: boolean; revoked: string[]; errors: Array<{ provider: string; error: string }> }>;

  getConnection(
    userId: string,
    provider: IntegrationProvider
  ): Promise<IntegrationConnectionDto | null>;

  listConnections(
    userId: string
  ): Promise<IntegrationConnectionDto[]>;

  listRepositories(
    userId: string,
    provider: IntegrationProvider
  ): Promise<ExternalRepositoryDto[]>;

  listActivities(
    userId: string,
    provider: IntegrationProvider,
    limit?: number
  ): Promise<ExternalActivityDto[]>;

  listCalendarEvents(
    userId: string,
    options?: { calendarId?: string; timeMin?: string; timeMax?: string }
  ): Promise<import('@avenza/shared').ExternalCalendarEventDto[]>;
}
