import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  IntegrationConnectionStatus,
  IntegrationProvider,
  NormalizedCalendarEvent,
  SyncJobStatus,
  SyncJobType,
} from '@avenza/shared';
import { getSupabaseAdminClient } from '../../db/supabase.client';
import type {
  NormalizedActivityData,
  NormalizedRepositoryData,
} from '../../infrastructure/providers/base/provider.types';
import type {
  ExternalActivityEntity,
  ExternalCalendarEventEntity,
  ExternalRepositoryEntity,
  IIntegrationsRepository,
  IntegrationConnectionEntity,
  OAuthStateEntity,
  SyncJobEntity,
} from './integrations.repository';

export class IntegrationsRepositoryImpl implements IIntegrationsRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly client: SupabaseClient<any> = getSupabaseAdminClient() as any) {}

  async getConnection(userId: string, provider: IntegrationProvider): Promise<IntegrationConnectionEntity | null> {
    const { data, error } = await this.client
      .from('integration_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch connection: ${error.message}`);
    }

    return (data as IntegrationConnectionEntity) || null;
  }

  async getConnectionById(connectionId: string): Promise<IntegrationConnectionEntity | null> {
    const { data, error } = await this.client
      .from('integration_connections')
      .select('*')
      .eq('id', connectionId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch connection by id: ${error.message}`);
    }

    return (data as IntegrationConnectionEntity) || null;
  }

  async listConnections(userId: string): Promise<IntegrationConnectionEntity[]> {
    const { data, error } = await this.client
      .from('integration_connections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to list connections: ${error.message}`);
    }

    return (data as IntegrationConnectionEntity[]) || [];
  }

  async upsertConnection(
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
  ): Promise<IntegrationConnectionEntity> {
    const existing = await this.getConnection(userId, data.provider);

    if (existing) {
      const { data: updated, error } = await this.client
        .from('integration_connections')
        .update({
          external_account_id: data.external_account_id,
          external_username: data.external_username,
          external_display_name: data.external_display_name,
          external_avatar_url: data.external_avatar_url,
          external_email: data.external_email,
          status: data.status,
          scopes: data.scopes,
          encrypted_access_token: data.encrypted_access_token,
          encrypted_refresh_token: data.encrypted_refresh_token ?? existing.encrypted_refresh_token,
          token_expires_at: data.token_expires_at ?? existing.token_expires_at,
          disconnected_at: null,
          last_error_code: null,
          last_error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error || !updated) {
        throw new Error(`Failed to update integration connection: ${error?.message || 'Unknown error'}`);
      }

      return updated as IntegrationConnectionEntity;
    }

    const { data: created, error } = await this.client
      .from('integration_connections')
      .insert({
        user_id: userId,
        provider: data.provider,
        external_account_id: data.external_account_id,
        external_username: data.external_username,
        external_display_name: data.external_display_name,
        external_avatar_url: data.external_avatar_url,
        external_email: data.external_email,
        status: data.status,
        scopes: data.scopes,
        encrypted_access_token: data.encrypted_access_token,
        encrypted_refresh_token: data.encrypted_refresh_token ?? null,
        token_expires_at: data.token_expires_at ?? null,
        connected_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error || !created) {
      throw new Error(`Failed to create integration connection: ${error?.message || 'Unknown error'}`);
    }

    return created as IntegrationConnectionEntity;
  }

  async updateConnectionStatus(
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
  ): Promise<IntegrationConnectionEntity> {
    const payload: Record<string, unknown> = {
      status: updates.status,
      updated_at: new Date().toISOString(),
    };

    if (updates.sync_cursor !== undefined) payload.sync_cursor = updates.sync_cursor;
    if (updates.last_sync_started_at !== undefined) payload.last_sync_started_at = updates.last_sync_started_at;
    if (updates.last_sync_completed_at !== undefined) payload.last_sync_completed_at = updates.last_sync_completed_at;
    if (updates.last_synced_at !== undefined) payload.last_synced_at = updates.last_synced_at;
    if (updates.last_error_code !== undefined) payload.last_error_code = updates.last_error_code;
    if (updates.last_error_message !== undefined) payload.last_error_message = updates.last_error_message;
    if (updates.disconnected_at !== undefined) payload.disconnected_at = updates.disconnected_at;
    if (updates.encrypted_access_token !== undefined) payload.encrypted_access_token = updates.encrypted_access_token;
    if (updates.encrypted_refresh_token !== undefined) payload.encrypted_refresh_token = updates.encrypted_refresh_token;
    if (updates.token_expires_at !== undefined) payload.token_expires_at = updates.token_expires_at;
    if (updates.sync_state !== undefined) payload.sync_state = updates.sync_state;

    const { data, error } = await this.client
      .from('integration_connections')
      .update(payload)
      .eq('id', connectionId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to update connection status: ${error?.message || 'Unknown error'}`);
    }

    return data as IntegrationConnectionEntity;
  }

  async saveOAuthState(
    userId: string,
    provider: IntegrationProvider,
    state: string,
    redirectUrl?: string
  ): Promise<OAuthStateEntity> {
    const { data, error } = await this.client
      .from('integration_oauth_states')
      .insert({
        state,
        user_id: userId,
        provider,
        redirect_url: redirectUrl ?? null,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to save OAuth state: ${error?.message || 'Unknown error'}`);
    }

    return data as OAuthStateEntity;
  }

  async getAndConsumeOAuthState(state: string): Promise<OAuthStateEntity | null> {
    const { data, error } = await this.client
      .from('integration_oauth_states')
      .select('*')
      .eq('state', state)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Single-use CSRF state token: delete immediately
    await this.client.from('integration_oauth_states').delete().eq('state', state);

    // Verify expiry (15 minutes)
    if (new Date(data.expires_at).getTime() < Date.now()) {
      return null;
    }

    return data as OAuthStateEntity;
  }

  async upsertRepositories(
    connectionId: string,
    userId: string,
    provider: IntegrationProvider,
    repos: NormalizedRepositoryData[]
  ): Promise<ExternalRepositoryEntity[]> {
    if (repos.length === 0) return [];

    const rows = repos.map((repo) => ({
      connection_id: connectionId,
      user_id: userId,
      provider,
      external_id: repo.externalId,
      name: repo.name,
      full_name: repo.fullName,
      owner: repo.owner,
      is_private: repo.isPrivate,
      html_url: repo.htmlUrl,
      description: repo.description,
      default_branch: repo.defaultBranch,
      primary_language: repo.primaryLanguage,
      languages: repo.languages,
      stars_count: repo.starsCount,
      forks_count: repo.forksCount,
      open_issues_count: repo.openIssuesCount,
      pushed_at: repo.pushedAt,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await this.client
      .from('external_repositories')
      .upsert(rows, {
        onConflict: 'user_id,provider,external_id',
      })
      .select('*');

    if (error) {
      throw new Error(`Failed to upsert external repositories: ${error.message}`);
    }

    return (data as ExternalRepositoryEntity[]) || [];
  }

  async upsertActivities(
    connectionId: string,
    userId: string,
    provider: IntegrationProvider,
    activities: NormalizedActivityData[]
  ): Promise<ExternalActivityEntity[]> {
    if (activities.length === 0) return [];

    const rows = activities.map((act) => ({
      connection_id: connectionId,
      user_id: userId,
      provider,
      external_id: act.externalId,
      activity_type: act.activityType,
      occurred_at: act.occurredAt,
      title: act.title,
      summary: act.summary,
      external_url: act.externalUrl,
      metadata: act.metadata,
      raw_payload: act.rawPayload ?? null,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await this.client
      .from('external_activities')
      .upsert(rows, {
        onConflict: 'user_id,provider,external_id',
      })
      .select('*');

    if (error) {
      throw new Error(`Failed to upsert external activities: ${error.message}`);
    }

    return (data as ExternalActivityEntity[]) || [];
  }

  async createSyncJob(
    connectionId: string,
    userId: string,
    provider: IntegrationProvider,
    jobType: SyncJobType
  ): Promise<SyncJobEntity> {
    const { data, error } = await this.client
      .from('sync_jobs')
      .insert({
        connection_id: connectionId,
        user_id: userId,
        provider,
        job_type: jobType,
        status: 'RUNNING',
        started_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create sync job: ${error?.message || 'Unknown error'}`);
    }

    return data as SyncJobEntity;
  }

  async updateSyncJob(
    jobId: string,
    updates: {
      status: SyncJobStatus;
      completed_at?: string | null;
      records_synced?: number;
      error_message?: string | null;
    }
  ): Promise<SyncJobEntity> {
    const payload: Record<string, unknown> = {
      status: updates.status,
      completed_at: updates.completed_at ?? new Date().toISOString(),
    };
    if (updates.records_synced !== undefined) payload.records_synced = updates.records_synced;
    if (updates.error_message !== undefined) payload.error_message = updates.error_message;

    const { data, error } = await this.client
      .from('sync_jobs')
      .update(payload)
      .eq('id', jobId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to update sync job: ${error?.message || 'Unknown error'}`);
    }

    return data as SyncJobEntity;
  }

  async listRepositories(userId: string, provider: IntegrationProvider): Promise<ExternalRepositoryEntity[]> {
    const { data, error } = await this.client
      .from('external_repositories')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .order('pushed_at', { ascending: false, nullsFirst: false });

    if (error) {
      throw new Error(`Failed to list external repositories: ${error.message}`);
    }

    return (data as ExternalRepositoryEntity[]) || [];
  }

  async listActivities(
    userId: string,
    provider: IntegrationProvider,
    limit = 50
  ): Promise<ExternalActivityEntity[]> {
    const { data, error } = await this.client
      .from('external_activities')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .order('occurred_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to list external activities: ${error.message}`);
    }

    return (data as ExternalActivityEntity[]) || [];
  }

  async createExternalActivityEvidence(
    userId: string,
    provider: IntegrationProvider,
    activity: NormalizedActivityData
  ): Promise<boolean> {
    // For GitHub: 'github:activity:<extId>'
    // For LeetCode: 'leetcode:submission:<id>' (since activity.externalId is 'submission:<id>')
    const sourceId =
      provider === 'github'
        ? `github:activity:${activity.externalId}`
        : `${provider}:${activity.externalId}`;

    const { error } = await this.client.from('evidence').upsert(
      {
        user_id: userId,
        evidence_type: 'external_activity',
        title: activity.title,
        description: activity.summary,
        source_type: 'external_provider',
        source_id: sourceId,
        source_reference: `${provider}/${activity.activityType}`,
        external_url: activity.externalUrl,
        occurred_at: activity.occurredAt,
        recorded_at: new Date().toISOString(),
        verification_status: 'unverified',
        evidence_strength: 'medium',
        reliability: 'medium',
        directness: 'direct',
        metadata: {
          provider,
          activity_type: activity.activityType,
          external_id: activity.externalId,
          ...activity.metadata,
        },
      },
      {
        onConflict: 'user_id,source_type,source_id',
        ignoreDuplicates: true,
      }
    );

    return !error;
  }

  async updateConnectionTokens(
    connectionId: string,
    tokens: {
      encrypted_access_token: string | null;
      encrypted_refresh_token?: string | null;
      token_expires_at?: string | null;
    }
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      encrypted_access_token: tokens.encrypted_access_token,
      updated_at: new Date().toISOString(),
    };
    if (tokens.encrypted_refresh_token !== undefined) {
      payload.encrypted_refresh_token = tokens.encrypted_refresh_token;
    }
    if (tokens.token_expires_at !== undefined) {
      payload.token_expires_at = tokens.token_expires_at;
    }

    const { error } = await this.client
      .from('integration_connections')
      .update(payload)
      .eq('id', connectionId);

    if (error) {
      throw new Error(`Failed to update connection tokens: ${error.message}`);
    }
  }

  async upsertCalendarEvents(
    connectionId: string,
    userId: string,
    events: NormalizedCalendarEvent[]
  ): Promise<ExternalCalendarEventEntity[]> {
    if (events.length === 0) return [];

    const rows = events.map((ev) => ({
      connection_id: connectionId,
      user_id: userId,
      calendar_id: ev.calendarId,
      external_event_id: ev.externalId,
      title: ev.title,
      status: ev.status,
      start_time: ev.startTime,
      end_time: ev.endTime,
      is_all_day: ev.isAllDay,
      time_zone: ev.timeZone ?? null,
      is_busy: ev.isBusy,
      is_recurring: ev.isRecurring,
      recurring_event_id: ev.recurringEventId ?? null,
      html_link: ev.htmlLink ?? null,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await this.client
      .from('external_calendar_events')
      .upsert(rows, {
        onConflict: 'user_id,calendar_id,external_event_id',
      })
      .select('*');

    if (error) {
      throw new Error(`Failed to upsert external calendar events: ${error.message}`);
    }

    return (data as ExternalCalendarEventEntity[]) || [];
  }

  async listCalendarEvents(
    userId: string,
    options: { calendarId?: string; timeMin?: string; timeMax?: string } = {}
  ): Promise<ExternalCalendarEventEntity[]> {
    let query = this.client
      .from('external_calendar_events')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true });

    if (options.calendarId) {
      query = query.eq('calendar_id', options.calendarId);
    }
    if (options.timeMin) {
      query = query.gte('end_time', options.timeMin);
    }
    if (options.timeMax) {
      query = query.lte('start_time', options.timeMax);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list calendar events: ${error.message}`);
    }

    return (data as ExternalCalendarEventEntity[]) || [];
  }
}

export class InMemoryIntegrationsRepository implements IIntegrationsRepository {
  private connections: IntegrationConnectionEntity[] = [];
  private oauthStates = new Map<string, OAuthStateEntity>();
  private repositories: ExternalRepositoryEntity[] = [];
  private activities: ExternalActivityEntity[] = [];
  private calendarEvents: ExternalCalendarEventEntity[] = [];
  private evidence: Array<{ user_id: string; source_id: string }> = [];
  private syncJobs: SyncJobEntity[] = [];

  async getConnection(userId: string, provider: IntegrationProvider): Promise<IntegrationConnectionEntity | null> {
    const found = this.connections.find((c) => c.user_id === userId && c.provider === provider);
    return found ? { ...found } : null;
  }

  async getConnectionById(connectionId: string): Promise<IntegrationConnectionEntity | null> {
    const found = this.connections.find((c) => c.id === connectionId);
    return found ? { ...found } : null;
  }

  async listConnections(userId: string): Promise<IntegrationConnectionEntity[]> {
    return this.connections.filter((c) => c.user_id === userId).map((c) => ({ ...c }));
  }

  async upsertConnection(
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
  ): Promise<IntegrationConnectionEntity> {
    const idx = this.connections.findIndex((c) => c.user_id === userId && c.provider === data.provider);
    const now = new Date().toISOString();
    if (idx >= 0) {
      const existing = this.connections[idx]!;
      const updated: IntegrationConnectionEntity = {
        ...existing,
        ...data,
        encrypted_refresh_token: data.encrypted_refresh_token ?? existing.encrypted_refresh_token,
        token_expires_at: data.token_expires_at ?? existing.token_expires_at,
        updated_at: now,
      };
      this.connections[idx] = updated;
      return { ...updated };
    }

    const created: IntegrationConnectionEntity = {
      id: crypto.randomUUID(),
      user_id: userId,
      provider: data.provider,
      external_account_id: data.external_account_id,
      external_username: data.external_username,
      external_display_name: data.external_display_name,
      external_avatar_url: data.external_avatar_url,
      external_email: data.external_email,
      status: data.status,
      scopes: data.scopes,
      encrypted_access_token: data.encrypted_access_token,
      encrypted_refresh_token: data.encrypted_refresh_token || null,
      token_expires_at: data.token_expires_at || null,
      sync_state: {},
      sync_cursor: null,
      last_sync_started_at: null,
      last_sync_completed_at: null,
      last_synced_at: null,
      last_error_code: null,
      last_error_message: null,
      connected_at: now,
      disconnected_at: null,
      created_at: now,
      updated_at: now,
    };
    this.connections.push(created);
    return { ...created };
  }

  async updateConnectionStatus(
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
  ): Promise<IntegrationConnectionEntity> {
    const idx = this.connections.findIndex((c) => c.id === connectionId);
    if (idx === -1) {
      throw new Error('Connection not found');
    }
    const updated = {
      ...this.connections[idx]!,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.connections[idx] = updated;
    return { ...updated };
  }

  async updateConnectionTokens(
    connectionId: string,
    tokens: {
      encrypted_access_token: string | null;
      encrypted_refresh_token?: string | null;
      token_expires_at?: string | null;
    }
  ): Promise<void> {
    const idx = this.connections.findIndex((c) => c.id === connectionId);
    if (idx >= 0) {
      this.connections[idx] = {
        ...this.connections[idx]!,
        ...tokens,
        updated_at: new Date().toISOString(),
      };
    }
  }

  async saveOAuthState(
    userId: string,
    provider: IntegrationProvider,
    state: string,
    redirectUrl?: string
  ): Promise<OAuthStateEntity> {
    const entity: OAuthStateEntity = {
      state,
      user_id: userId,
      provider,
      redirect_url: redirectUrl ?? null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    this.oauthStates.set(state, entity);
    return { ...entity };
  }

  async getAndConsumeOAuthState(state: string): Promise<OAuthStateEntity | null> {
    const found = this.oauthStates.get(state);
    if (!found) return null;
    this.oauthStates.delete(state);
    return { ...found };
  }

  async upsertRepositories(
    connectionId: string,
    userId: string,
    provider: IntegrationProvider,
    repos: NormalizedRepositoryData[]
  ): Promise<ExternalRepositoryEntity[]> {
    const now = new Date().toISOString();
    for (const r of repos) {
      const idx = this.repositories.findIndex(
        (item) => item.user_id === userId && item.provider === provider && item.external_id === r.externalId
      );
      const entity: ExternalRepositoryEntity = {
        id: idx >= 0 ? this.repositories[idx]!.id : crypto.randomUUID(),
        connection_id: connectionId,
        user_id: userId,
        provider,
        external_id: r.externalId,
        name: r.name,
        full_name: r.fullName,
        owner: r.owner,
        is_private: r.isPrivate,
        html_url: r.htmlUrl,
        description: r.description,
        default_branch: r.defaultBranch,
        primary_language: r.primaryLanguage,
        languages: r.languages,
        stars_count: r.starsCount,
        forks_count: r.forksCount,
        open_issues_count: r.openIssuesCount,
        pushed_at: r.pushedAt,
        created_at: idx >= 0 ? this.repositories[idx]!.created_at : now,
        updated_at: now,
      };
      if (idx >= 0) {
        this.repositories[idx] = entity;
      } else {
        this.repositories.push(entity);
      }
    }
    return this.repositories.filter((r) => r.user_id === userId && r.provider === provider).map((r) => ({ ...r }));
  }

  async upsertActivities(
    connectionId: string,
    userId: string,
    provider: IntegrationProvider,
    activities: NormalizedActivityData[]
  ): Promise<ExternalActivityEntity[]> {
    const now = new Date().toISOString();
    for (const a of activities) {
      const idx = this.activities.findIndex(
        (item) => item.user_id === userId && item.provider === provider && item.external_id === a.externalId
      );
      const entity: ExternalActivityEntity = {
        id: idx >= 0 ? this.activities[idx]!.id : crypto.randomUUID(),
        connection_id: connectionId,
        user_id: userId,
        repository_id: null,
        provider,
        external_id: a.externalId,
        activity_type: a.activityType,
        occurred_at: a.occurredAt,
        title: a.title,
        summary: a.summary,
        external_url: a.externalUrl,
        metadata: a.metadata,
        raw_payload: a.rawPayload ?? a.metadata ?? {},
        created_at: idx >= 0 ? this.activities[idx]!.created_at : now,
        updated_at: now,
      };
      if (idx >= 0) {
        this.activities[idx] = entity;
      } else {
        this.activities.push(entity);
      }
    }
    return this.activities.filter((a) => a.user_id === userId && a.provider === provider).map((a) => ({ ...a }));
  }

  async upsertCalendarEvents(
    connectionId: string,
    userId: string,
    events: NormalizedCalendarEvent[]
  ): Promise<ExternalCalendarEventEntity[]> {
    const now = new Date().toISOString();
    for (const ev of events) {
      const idx = this.calendarEvents.findIndex(
        (item) => item.user_id === userId && item.calendar_id === ev.calendarId && item.external_event_id === ev.externalId
      );
      const entity: ExternalCalendarEventEntity = {
        id: idx >= 0 ? this.calendarEvents[idx]!.id : crypto.randomUUID(),
        connection_id: connectionId,
        user_id: userId,
        calendar_id: ev.calendarId,
        external_event_id: ev.externalId,
        title: ev.title,
        status: ev.status,
        start_time: ev.startTime,
        end_time: ev.endTime,
        is_all_day: ev.isAllDay,
        time_zone: ev.timeZone ?? null,
        is_busy: ev.isBusy,
        is_recurring: ev.isRecurring,
        recurring_event_id: ev.recurringEventId ?? null,
        html_link: ev.htmlLink ?? null,
        created_at: idx >= 0 ? this.calendarEvents[idx]!.created_at : now,
        updated_at: now,
      };
      if (idx >= 0) {
        this.calendarEvents[idx] = entity;
      } else {
        this.calendarEvents.push(entity);
      }
    }
    return this.calendarEvents.filter((e) => e.user_id === userId).map((e) => ({ ...e }));
  }

  async listCalendarEvents(
    userId: string,
    options: { calendarId?: string; timeMin?: string; timeMax?: string } = {}
  ): Promise<ExternalCalendarEventEntity[]> {
    return this.calendarEvents
      .filter((e) => {
        if (e.user_id !== userId) return false;
        if (e.status === 'cancelled') return false;
        if (options.calendarId && e.calendar_id !== options.calendarId) return false;
        if (options.timeMin && e.end_time < options.timeMin) return false;
        if (options.timeMax && e.start_time > options.timeMax) return false;
        return true;
      })
      .map((e) => ({ ...e }));
  }

  async createSyncJob(
    connectionId: string,
    userId: string,
    provider: IntegrationProvider,
    jobType: SyncJobType
  ): Promise<SyncJobEntity> {
    const now = new Date().toISOString();
    const job: SyncJobEntity = {
      id: crypto.randomUUID(),
      connection_id: connectionId,
      user_id: userId,
      provider,
      job_type: jobType,
      status: 'RUNNING',
      started_at: now,
      completed_at: null,
      records_synced: 0,
      error_message: null,
      created_at: now,
    };
    this.syncJobs.push(job);
    return { ...job };
  }

  async updateSyncJob(
    jobId: string,
    updates: {
      status: SyncJobStatus;
      completed_at?: string | null;
      records_synced?: number;
      error_message?: string | null;
    }
  ): Promise<SyncJobEntity> {
    const idx = this.syncJobs.findIndex((j) => j.id === jobId);
    if (idx === -1) {
      throw new Error('Sync job not found');
    }
    const updated = {
      ...this.syncJobs[idx]!,
      ...updates,
    };
    this.syncJobs[idx] = updated;
    return { ...updated };
  }

  async listRepositories(userId: string, provider?: IntegrationProvider): Promise<ExternalRepositoryEntity[]> {
    return this.repositories
      .filter((r) => r.user_id === userId && (!provider || r.provider === provider))
      .map((r) => ({ ...r }));
  }

  async listActivities(
    userId: string,
    provider: IntegrationProvider,
    limit = 50
  ): Promise<ExternalActivityEntity[]> {
    return this.activities
      .filter((a) => a.user_id === userId && a.provider === provider)
      .slice(0, limit)
      .map((a) => ({ ...a }));
  }

  async createExternalActivityEvidence(
    userId: string,
    provider: IntegrationProvider,
    activity: NormalizedActivityData
  ): Promise<boolean> {
    const sourceId = `${provider}:activity:${activity.externalId}`;
    if (!this.evidence.some((e) => e.user_id === userId && e.source_id === sourceId)) {
      this.evidence.push({ user_id: userId, source_id: sourceId });
      return true;
    }
    return false;
  }
}
