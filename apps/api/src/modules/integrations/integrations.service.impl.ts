import crypto from 'node:crypto';
import type {
  ExternalActivityDto,
  ExternalCalendarEventDto,
  ExternalRepositoryDto,
  IntegrationConnectionDto,
  IntegrationProvider,
  IntegrationSyncResponseDto,
  OAuthInitResponseDto,
  SyncJobDto,
  SyncJobType,
} from '@avenza/shared';
import { decryptToken, encryptToken } from '../../infrastructure/crypto/token-encryption';
import { defaultProviderRegistry, ProviderRegistry } from '../../infrastructure/providers/base/provider.registry';
import type {
  ExternalActivityEntity,
  ExternalCalendarEventEntity,
  ExternalRepositoryEntity,
  IIntegrationsRepository,
  IntegrationConnectionEntity,
  SyncJobEntity,
} from './integrations.repository';
import { IntegrationsRepositoryImpl } from './integrations.repository.impl';
import type { IIntegrationsService } from './integrations.service';

export class IntegrationsServiceImpl implements IIntegrationsService {
  constructor(
    private readonly repository: IIntegrationsRepository,
    private readonly providerRegistry: ProviderRegistry = defaultProviderRegistry
  ) {}

  private mapConnection(entity: IntegrationConnectionEntity): IntegrationConnectionDto {
    return {
      id: entity.id,
      provider: entity.provider,
      external_account_id: entity.external_account_id,
      external_username: entity.external_username,
      external_display_name: entity.external_display_name,
      external_avatar_url: entity.external_avatar_url,
      external_email: entity.external_email,
      status: entity.status,
      scopes: entity.scopes,
      sync_state: entity.sync_state || {},
      last_synced_at: entity.last_synced_at,
      last_sync_started_at: entity.last_sync_started_at,
      last_sync_completed_at: entity.last_sync_completed_at,
      last_error_code: entity.last_error_code,
      last_error_message: entity.last_error_message,
      connected_at: entity.connected_at,
      disconnected_at: entity.disconnected_at,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  private mapRepository(entity: ExternalRepositoryEntity): ExternalRepositoryDto {
    return {
      id: entity.id,
      connection_id: entity.connection_id,
      provider: entity.provider,
      external_id: entity.external_id,
      name: entity.name,
      full_name: entity.full_name,
      owner: entity.owner,
      is_private: entity.is_private,
      html_url: entity.html_url,
      description: entity.description,
      default_branch: entity.default_branch,
      primary_language: entity.primary_language,
      languages: entity.languages,
      stars_count: entity.stars_count,
      forks_count: entity.forks_count,
      open_issues_count: entity.open_issues_count,
      pushed_at: entity.pushed_at,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  private mapActivity(entity: ExternalActivityEntity): ExternalActivityDto {
    return {
      id: entity.id,
      connection_id: entity.connection_id,
      repository_id: entity.repository_id,
      provider: entity.provider,
      external_id: entity.external_id,
      activity_type: entity.activity_type,
      occurred_at: entity.occurred_at,
      title: entity.title,
      summary: entity.summary,
      external_url: entity.external_url,
      metadata: entity.metadata,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  private mapCalendarEvent(entity: ExternalCalendarEventEntity): ExternalCalendarEventDto {
    return {
      id: entity.id,
      connection_id: entity.connection_id,
      calendar_id: entity.calendar_id,
      external_event_id: entity.external_event_id,
      title: entity.title,
      status: entity.status,
      start_time: entity.start_time,
      end_time: entity.end_time,
      is_all_day: entity.is_all_day,
      time_zone: entity.time_zone,
      is_busy: entity.is_busy,
      is_recurring: entity.is_recurring,
      recurring_event_id: entity.recurring_event_id,
      html_link: entity.html_link,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  private mapSyncJob(entity: SyncJobEntity): SyncJobDto {
    return {
      id: entity.id,
      connection_id: entity.connection_id,
      provider: entity.provider,
      job_type: entity.job_type,
      status: entity.status,
      started_at: entity.started_at,
      completed_at: entity.completed_at,
      records_synced: entity.records_synced,
      error_message: entity.error_message,
      created_at: entity.created_at,
    };
  }

  async initiateOAuth(
    userId: string,
    providerId: IntegrationProvider,
    redirectUrl?: string
  ): Promise<OAuthInitResponseDto> {
    const provider = this.providerRegistry.getOrThrow(providerId);
    const authAdapter = provider.getAuthAdapter();
    if (!authAdapter.createAuthorizationUrl) {
      throw new Error(`Provider "${providerId}" does not support OAuth authorization.`);
    }

    const state = crypto.randomBytes(24).toString('hex');

    await this.repository.saveOAuthState(userId, providerId, state, redirectUrl);

    const authorizationUrl = authAdapter.createAuthorizationUrl(state, redirectUrl);

    return {
      authorization_url: authorizationUrl,
      state,
    };
  }

  async handleOAuthCallback(
    userId: string,
    providerId: IntegrationProvider,
    code: string,
    state: string
  ): Promise<IntegrationConnectionDto> {
    const provider = this.providerRegistry.getOrThrow(providerId);
    const authAdapter = provider.getAuthAdapter();

    if (!authAdapter.exchangeCodeForTokens || !authAdapter.fetchIdentity) {
      throw new Error(`Provider "${providerId}" does not support OAuth token exchange.`);
    }

    // 1. Validate & consume CSRF OAuth state token (one-time use)
    const stateEntity = await this.repository.getAndConsumeOAuthState(state);
    if (!stateEntity || stateEntity.user_id !== userId || stateEntity.provider !== providerId) {
      throw new Error('Invalid or expired OAuth state parameter.');
    }

    // 2. Exchange authorization code for OAuth tokens
    const tokens = await authAdapter.exchangeCodeForTokens(code, stateEntity.redirect_url ?? undefined);

    // 3. Encrypt sensitive tokens before database insertion
    const encryptedAccessToken = encryptToken(tokens.accessToken);
    const encryptedRefreshToken = encryptToken(tokens.refreshToken);

    // 4. Fetch external identity (stable provider ID)
    const identity = await authAdapter.fetchIdentity(tokens.accessToken);

    // 5. Upsert connection record (mark as CONNECTED)
    const connection = await this.repository.upsertConnection(userId, {
      provider: providerId,
      external_account_id: identity.externalAccountId,
      external_username: identity.username,
      external_display_name: identity.displayName,
      external_avatar_url: identity.avatarUrl,
      external_email: identity.email,
      status: 'CONNECTED',
      scopes: tokens.scope ? tokens.scope.split(',').map((s) => s.trim()) : [],
      encrypted_access_token: encryptedAccessToken,
      encrypted_refresh_token: encryptedRefreshToken,
    });

    // 6. Trigger initial sync in background
    try {
      await this.syncConnection(userId, providerId, 'initial');
    } catch {
      // Background sync errors are logged in sync_jobs and connection.status
    }

    const refreshed = await this.repository.getConnection(userId, providerId);
    return this.mapConnection(refreshed || connection);
  }

  async connectWithIdentifier(
    userId: string,
    providerId: IntegrationProvider,
    identifier: string
  ): Promise<IntegrationConnectionDto> {
    const provider = this.providerRegistry.getOrThrow(providerId);
    const authAdapter = provider.getAuthAdapter();

    if (!authAdapter.connectWithIdentifier) {
      throw new Error(`Provider "${providerId}" does not support direct handle connection.`);
    }

    const identity = await authAdapter.connectWithIdentifier(identifier);

    const connection = await this.repository.upsertConnection(userId, {
      provider: providerId,
      external_account_id: identity.externalAccountId,
      external_username: identity.username,
      external_display_name: identity.displayName,
      external_avatar_url: identity.avatarUrl,
      external_email: identity.email,
      status: 'CONNECTED',
      scopes: [],
      encrypted_access_token: null,
      encrypted_refresh_token: null,
    });

    // Trigger initial sync
    try {
      await this.syncConnection(userId, providerId, 'initial');
    } catch {
      // Handled in sync_jobs and connection status
    }

    const refreshed = await this.repository.getConnection(userId, providerId);
    return this.mapConnection(refreshed || connection);
  }

  async syncConnection(
    userId: string,
    providerId: IntegrationProvider,
    jobType: SyncJobType = 'manual'
  ): Promise<IntegrationSyncResponseDto> {
    const connection = await this.repository.getConnection(userId, providerId);
    if (!connection) {
      throw new Error(`Integration connection for "${providerId}" not found.`);
    }

    if (connection.status === 'DISCONNECTED') {
      throw new Error(`Cannot sync disconnected integration for "${providerId}". Please reconnect.`);
    }

    const provider = this.providerRegistry.getOrThrow(providerId);
    let decryptedToken: string | null = null;

    if (provider.hasCapability('oauth')) {
      decryptedToken = decryptToken(connection.encrypted_access_token);
      const decryptedRefreshToken = decryptToken(connection.encrypted_refresh_token);

      const isExpiringSoon = connection.token_expires_at
        ? new Date(connection.token_expires_at).getTime() - Date.now() < 5 * 60 * 1000
        : false;

      // Automatically refresh token if missing or expiring within 5 minutes
      if ((!decryptedToken || isExpiringSoon) && decryptedRefreshToken) {
        const authAdapter = provider.getAuthAdapter();
        if (authAdapter.refreshAccessToken) {
          try {
            const refreshedTokens = await authAdapter.refreshAccessToken(decryptedRefreshToken);
            decryptedToken = refreshedTokens.accessToken;
            const newExpiresAt = refreshedTokens.expiresIn
              ? new Date(Date.now() + refreshedTokens.expiresIn * 1000).toISOString()
              : null;
            await this.repository.updateConnectionTokens(connection.id, {
              encrypted_access_token: encryptToken(refreshedTokens.accessToken),
              encrypted_refresh_token: refreshedTokens.refreshToken
                ? encryptToken(refreshedTokens.refreshToken)
                : connection.encrypted_refresh_token,
              token_expires_at: newExpiresAt,
            });
          } catch {
            await this.repository.updateConnectionStatus(connection.id, {
              status: 'NEEDS_REAUTHORIZATION',
              last_error_code: 'TOKEN_REFRESH_FAILED',
              last_error_message: 'Failed to refresh expired OAuth token. Please reauthorize.',
            });
            throw new Error('OAuth token has expired and could not be refreshed. Please reauthorize.');
          }
        }
      }

      if (!decryptedToken) {
        await this.repository.updateConnectionStatus(connection.id, {
          status: 'NEEDS_REAUTHORIZATION',
          last_error_code: 'MISSING_TOKEN',
          last_error_message: 'Access token is missing or invalid. Please reauthorize account.',
        });
        throw new Error('Access token is missing. Please reauthorize your account.');
      }
    }

    // 1. Mark status SYNCING and create sync job
    const startedAt = new Date().toISOString();
    await this.repository.updateConnectionStatus(connection.id, {
      status: 'SYNCING',
      last_sync_started_at: startedAt,
    });

    const job = await this.repository.createSyncJob(connection.id, userId, providerId, jobType);

    // 2. Perform synchronization via isolated sync adapter
    const result = await provider.getSyncAdapter().sync({
      userId,
      connectionId: connection.id,
      accessToken: decryptedToken,
      refreshToken: connection.encrypted_refresh_token ? decryptToken(connection.encrypted_refresh_token) : null,
      accountIdentifier: connection.external_username || connection.external_account_id,
      syncCursor: connection.sync_cursor,
      syncState: connection.sync_state,
      lastSyncedAt: connection.last_synced_at,
    });

    if (!result.success) {
      const isRateLimit = result.isRateLimited || result.errorCode === 'RATE_LIMITED';
      const status = isRateLimit ? 'RATE_LIMITED' : 'TEMPORARILY_UNAVAILABLE';

      const updatedConn = await this.repository.updateConnectionStatus(connection.id, {
        status,
        last_error_code: result.errorCode || 'SYNC_ERROR',
        last_error_message: result.errorMessage || 'Synchronization failed.',
      });

      const updatedJob = await this.repository.updateSyncJob(job.id, {
        status: isRateLimit ? 'RATE_LIMITED' : 'FAILED',
        error_message: result.errorMessage || 'Sync failed.',
      });

      return {
        connection: this.mapConnection(updatedConn),
        job: this.mapSyncJob(updatedJob),
        repositories_synced: 0,
        activities_synced: 0,
        events_synced: 0,
      };
    }

    // 3. Persist normalized repositories and activities (idempotent upserts)
    const upsertedRepos = await this.repository.upsertRepositories(
      connection.id,
      userId,
      providerId,
      result.repositories
    );

    const upsertedActivities = await this.repository.upsertActivities(
      connection.id,
      userId,
      providerId,
      result.activities
    );

    // 4. Persist calendar events if present (scheduling context, strictly NO evidence created)
    let upsertedEventsCount = 0;
    if (result.calendarEvents && result.calendarEvents.length > 0) {
      const upsertedEvents = await this.repository.upsertCalendarEvents(
        connection.id,
        userId,
        result.calendarEvents
      );
      upsertedEventsCount = upsertedEvents.length;
    }

    // 5. Expose activity signals to Evidence domain (strictly idempotent, activities only)
    for (const activity of result.activities) {
      try {
        await this.repository.createExternalActivityEvidence(userId, providerId, activity);
      } catch {
        // Evidence generation failure must not fail the primary sync
      }
    }

    // 6. Update connection and job to SYNCED
    const completedAt = new Date().toISOString();
    const updatedConn = await this.repository.updateConnectionStatus(connection.id, {
      status: 'SYNCED',
      sync_state: result.syncState ? { ...connection.sync_state, ...result.syncState } : connection.sync_state,
      sync_cursor: result.nextCursor ?? connection.sync_cursor,
      last_sync_completed_at: completedAt,
      last_synced_at: completedAt,
      last_error_code: null,
      last_error_message: null,
    });

    const updatedJob = await this.repository.updateSyncJob(job.id, {
      status: 'SUCCESS',
      completed_at: completedAt,
      records_synced: upsertedRepos.length + upsertedActivities.length + upsertedEventsCount,
    });

    return {
      connection: this.mapConnection(updatedConn),
      job: this.mapSyncJob(updatedJob),
      repositories_synced: upsertedRepos.length,
      activities_synced: upsertedActivities.length,
      events_synced: upsertedEventsCount,
    };
  }

  async disconnect(userId: string, providerId: IntegrationProvider): Promise<IntegrationConnectionDto> {
    const connection = await this.repository.getConnection(userId, providerId);
    if (!connection) {
      throw new Error(`Integration connection for "${providerId}" not found.`);
    }

    const provider = this.providerRegistry.get(providerId);
    if (provider && provider.hasCapability('oauth')) {
      const authAdapter = provider.getAuthAdapter();
      if (authAdapter.revokeToken) {
        const tokenToRevoke =
          decryptToken(connection.encrypted_refresh_token) ||
          decryptToken(connection.encrypted_access_token);
        if (tokenToRevoke) {
          await authAdapter.revokeToken(tokenToRevoke).catch(() => {});
        }
      }
    }

    const updated = await this.repository.updateConnectionStatus(connection.id, {
      status: 'DISCONNECTED',
      encrypted_access_token: null,
      encrypted_refresh_token: null,
      disconnected_at: new Date().toISOString(),
    });

    return this.mapConnection(updated);
  }

  async revokeAllUserCredentials(
    userId: string
  ): Promise<{ success: boolean; revoked: string[]; errors: Array<{ provider: string; error: string }> }> {
    const connections = await this.repository.listConnections(userId);
    const revoked: string[] = [];
    const errors: Array<{ provider: string; error: string }> = [];

    for (const conn of connections) {
      const provider = this.providerRegistry.get(conn.provider);
      if (provider && provider.hasCapability('oauth')) {
        const authAdapter = provider.getAuthAdapter();
        if (authAdapter.revokeToken) {
          const tokenToRevoke =
            decryptToken(conn.encrypted_refresh_token) ||
            decryptToken(conn.encrypted_access_token);
          if (tokenToRevoke) {
            try {
              await authAdapter.revokeToken(tokenToRevoke);
              revoked.push(conn.provider);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              errors.push({ provider: conn.provider, error: msg });
            }
          }
        }
      }

      try {
        await this.repository.updateConnectionStatus(conn.id, {
          status: 'DISCONNECTED',
          encrypted_access_token: null,
          encrypted_refresh_token: null,
          disconnected_at: new Date().toISOString(),
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ provider: conn.provider, error: `Failed to update connection status: ${msg}` });
      }
    }

    return {
      success: errors.length === 0,
      revoked,
      errors,
    };
  }

  async listCalendarEvents(
    userId: string,
    options?: { calendarId?: string; timeMin?: string; timeMax?: string }
  ): Promise<ExternalCalendarEventDto[]> {
    const events = await this.repository.listCalendarEvents(userId, options);
    return events.map((e) => this.mapCalendarEvent(e));
  }

  async getConnection(userId: string, providerId: IntegrationProvider): Promise<IntegrationConnectionDto | null> {
    const connection = await this.repository.getConnection(userId, providerId);
    return connection ? this.mapConnection(connection) : null;
  }

  async listConnections(userId: string): Promise<IntegrationConnectionDto[]> {
    const connections = await this.repository.listConnections(userId);
    return connections.map((c) => this.mapConnection(c));
  }

  async listRepositories(userId: string, providerId: IntegrationProvider): Promise<ExternalRepositoryDto[]> {
    const repos = await this.repository.listRepositories(userId, providerId);
    return repos.map((r) => this.mapRepository(r));
  }

  async listActivities(
    userId: string,
    providerId: IntegrationProvider,
    limit?: number
  ): Promise<ExternalActivityDto[]> {
    const acts = await this.repository.listActivities(userId, providerId, limit);
    return acts.map((a) => this.mapActivity(a));
  }
}

export const defaultIntegrationsService = new IntegrationsServiceImpl(
  new IntegrationsRepositoryImpl(),
  defaultProviderRegistry
);
