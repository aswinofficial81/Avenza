import { describe, expect, it, vi, beforeEach } from 'vitest';
import fastify, { type FastifyInstance, type preHandlerHookHandler } from 'fastify';
import type {
  ExternalActivityEntity,
  ExternalRepositoryEntity,
  IIntegrationsRepository,
  IntegrationConnectionEntity,
  OAuthStateEntity,
} from './integrations.repository';
import { IntegrationsServiceImpl } from './integrations.service.impl';
import { IntegrationsController } from './integrations.controller';
import { createIntegrationsRoutes } from './integrations.routes';
import { ProviderRegistry } from '../../infrastructure/providers/base/provider.registry';
import { GitHubProvider } from '../../infrastructure/providers/github/github.provider';
import { LeetCodeProvider } from '../../infrastructure/providers/leetcode/leetcode.provider';
import { CodeforcesProvider } from '../../infrastructure/providers/codeforces/codeforces.provider';
import { GoogleCalendarProvider } from '../../infrastructure/providers/google-calendar/google-calendar.provider';
import { encryptToken } from '../../infrastructure/crypto/token-encryption';
import type { IAuthProvider } from '../../infrastructure/providers/base/auth.interface';
import type { ISyncProvider } from '../../infrastructure/providers/base/sync.interface';
import type { ExternalCalendarEventEntity } from './integrations.repository';

describe('Phase 14 External Integrations Domain & API (/api/v1/integrations)', () => {
  let app: FastifyInstance;
  let mockRepo: IIntegrationsRepository;
  let mockAuthAdapter: Required<IAuthProvider>;
  let mockSyncAdapter: ISyncProvider;
  let mockLeetCodeAuthAdapter: IAuthProvider;
  let mockLeetCodeSyncAdapter: ISyncProvider;
  let mockCodeforcesAuthAdapter: IAuthProvider;
  let mockCodeforcesSyncAdapter: ISyncProvider;
  let mockGoogleAuthAdapter: IAuthProvider;
  let mockGoogleSyncAdapter: ISyncProvider;
  let providerRegistry: ProviderRegistry;

  const mockUserA = { id: 'usr-11111111-1111-1111-1111-111111111111', clerkId: 'clerk_user_a' };
  const mockUserB = { id: 'usr-22222222-2222-2222-2222-222222222222', clerkId: 'clerk_user_b' };

  let currentAuthContext = mockUserA;

  beforeEach(() => {
    vi.restoreAllMocks();
    currentAuthContext = mockUserA;

    // In-memory fake repository
    const connections: IntegrationConnectionEntity[] = [];
    const oauthStates = new Map<string, OAuthStateEntity>();
    const repositories: ExternalRepositoryEntity[] = [];
    const activities: ExternalActivityEntity[] = [];
    const calendarEvents: ExternalCalendarEventEntity[] = [];
    const evidence: Array<{ user_id: string; source_id: string }> = [];

    mockRepo = {
      getConnection: vi.fn(async (userId, provider) => {
        return connections.find((c) => c.user_id === userId && c.provider === provider) || null;
      }),
      getConnectionById: vi.fn(async (id) => {
        return connections.find((c) => c.id === id) || null;
      }),
      listConnections: vi.fn(async (userId) => {
        return connections.filter((c) => c.user_id === userId);
      }),
      upsertConnection: vi.fn(async (userId, data) => {
        const existing = connections.find((c) => c.user_id === userId && c.provider === data.provider);
        if (existing) {
          Object.assign(existing, {
            ...data,
            updated_at: new Date().toISOString(),
          });
          return existing;
        }
        const created: IntegrationConnectionEntity = {
          id: 'conn-1',
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
          connected_at: new Date().toISOString(),
          disconnected_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        connections.push(created);
        return created;
      }),
      updateConnectionStatus: vi.fn(async (connectionId, updates) => {
        const found = connections.find((c) => c.id === connectionId);
        if (!found) throw new Error('Connection not found');
        Object.assign(found, updates);
        return found;
      }),
      saveOAuthState: vi.fn(async (userId, provider, state) => {
        const entity = {
          state,
          user_id: userId,
          provider,
          redirect_url: null,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        };
        oauthStates.set(state, entity);
        return entity;
      }),
      getAndConsumeOAuthState: vi.fn(async (state) => {
        const found = oauthStates.get(state);
        if (!found) return null;
        oauthStates.delete(state);
        return found;
      }),
      upsertRepositories: vi.fn(async (connectionId, userId, provider, repos) => {
        for (const r of repos) {
          const idx = repositories.findIndex(
            (item) => item.user_id === userId && item.provider === provider && item.external_id === r.externalId
          );
          const entity = {
            id: 'repo-' + r.externalId,
            connection_id: connectionId,
            user_id: userId,
            provider,
            external_id: r.externalId,
            ...r,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          if (idx >= 0) {
            repositories[idx] = entity;
          } else {
            repositories.push(entity);
          }
        }
        return repositories.filter((r) => r.user_id === userId && r.provider === provider);
      }),
      upsertActivities: vi.fn(async (connectionId, userId, provider, acts) => {
        for (const a of acts) {
          const idx = activities.findIndex(
            (item) => item.user_id === userId && item.provider === provider && item.external_id === a.externalId
          );
          const entity: ExternalActivityEntity = {
            id: 'act-' + a.externalId,
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
            raw_payload: a.metadata ?? {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          if (idx >= 0) {
            activities[idx] = entity;
          } else {
            activities.push(entity);
          }
        }
        return activities.filter((a) => a.user_id === userId && a.provider === provider);
      }),
      createSyncJob: vi.fn(async (connectionId, userId, provider, jobType) => ({
        id: 'job-1',
        connection_id: connectionId,
        user_id: userId,
        provider,
        job_type: jobType,
        status: 'RUNNING' as const,
        started_at: new Date().toISOString(),
        completed_at: null,
        records_synced: 0,
        error_message: null,
        created_at: new Date().toISOString(),
      })),
      updateSyncJob: vi.fn(async (jobId, updates) => ({
        id: jobId,
        connection_id: 'conn-1',
        user_id: currentAuthContext.id,
        provider: 'github' as const,
        job_type: 'manual' as const,
        status: updates.status,
        started_at: new Date().toISOString(),
        completed_at: updates.completed_at || new Date().toISOString(),
        records_synced: updates.records_synced || 0,
        error_message: updates.error_message || null,
        created_at: new Date().toISOString(),
      })),
      listRepositories: vi.fn(async (userId, provider) => {
        return repositories.filter((r) => r.user_id === userId && r.provider === provider);
      }),
      listActivities: vi.fn(async (userId, provider) => {
        return activities.filter((a) => a.user_id === userId && a.provider === provider);
      }),
      createExternalActivityEvidence: vi.fn(async (userId, provider, activity) => {
        const sourceId = `${provider}:activity:${activity.externalId}`;
        if (!evidence.some((e) => e.user_id === userId && e.source_id === sourceId)) {
          evidence.push({ user_id: userId, source_id: sourceId });
          return true;
        }
        return false;
      }),
      updateConnectionTokens: vi.fn(async () => {}),
      upsertCalendarEvents: vi.fn(async (connectionId, userId, evs) => {
        for (const e of evs) {
          const idx = calendarEvents.findIndex(
            (item) => item.user_id === userId && item.calendar_id === e.calendarId && item.external_event_id === e.externalId
          );
          const entity: ExternalCalendarEventEntity = {
            id: 'cal-ev-' + e.externalId,
            connection_id: connectionId,
            user_id: userId,
            calendar_id: e.calendarId,
            external_event_id: e.externalId,
            title: e.title,
            status: e.status,
            start_time: e.startTime,
            end_time: e.endTime,
            is_all_day: e.isAllDay,
            time_zone: e.timeZone ?? null,
            is_busy: e.isBusy,
            is_recurring: e.isRecurring,
            recurring_event_id: e.recurringEventId ?? null,
            html_link: e.htmlLink ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          if (idx >= 0) {
            calendarEvents[idx] = entity;
          } else {
            calendarEvents.push(entity);
          }
        }
        return calendarEvents.filter((ce) => ce.user_id === userId);
      }),
      listCalendarEvents: vi.fn(async (userId) => {
        return calendarEvents.filter((ce) => ce.user_id === userId);
      }),
    };

    mockAuthAdapter = {
      createAuthorizationUrl: vi.fn((state) => `https://github.com/login/oauth/authorize?state=${state}`),
      exchangeCodeForTokens: vi.fn(async () => ({
        accessToken: 'mock_gh_token_123',
        scope: 'read:user,repo',
      })),
      fetchIdentity: vi.fn(async () => ({
        externalAccountId: '583231',
        username: 'octocat',
        displayName: 'The Octocat',
        avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
        email: 'octocat@github.com',
      })),
      connectWithIdentifier: vi.fn(async (identifier) => ({
        externalAccountId: identifier,
        username: identifier,
        displayName: identifier,
        avatarUrl: null,
        email: null,
      })),
      refreshAccessToken: vi.fn(async () => ({
        accessToken: 'refreshed-token',
        scope: 'read:user,repo',
      })),
      revokeToken: vi.fn(async () => {}),
    };

    mockSyncAdapter = {
      sync: vi.fn(async () => ({
        success: true,
        repositories: [
          {
            externalId: '1296269',
            name: 'Hello-World',
            fullName: 'octocat/Hello-World',
            owner: 'octocat',
            isPrivate: false,
            htmlUrl: 'https://github.com/octocat/Hello-World',
            description: 'Public test repo',
            defaultBranch: 'main',
            primaryLanguage: 'TypeScript',
            languages: { TypeScript: 100 },
            starsCount: 42,
            forksCount: 5,
            openIssuesCount: 0,
            pushedAt: '2026-10-04T12:00:00Z',
          },
        ],
        activities: [
          {
            externalId: 'evt-999',
            activityType: 'push',
            occurredAt: '2026-10-04T12:00:00Z',
            title: 'Pushed to octocat/Hello-World',
            summary: 'feat: add feature',
            externalUrl: 'https://github.com/octocat/Hello-World',
            metadata: { actor: 'octocat' },
          },
        ],
      })),
    };

    mockLeetCodeAuthAdapter = {
      connectWithIdentifier: vi.fn(async (identifier) => {
        if (identifier === 'nonexistent_coder') {
          throw new Error('LeetCode user "nonexistent_coder" was not found.');
        }
        return {
          externalAccountId: identifier,
          username: identifier,
          displayName: 'LeetCode User',
          avatarUrl: 'https://assets.leetcode.com/avatar.png',
          email: null,
        };
      }),
    };

    mockLeetCodeSyncAdapter = {
      sync: vi.fn(async () => ({
        success: true,
        repositories: [],
        activities: [
          {
            externalId: 'submission:998877',
            activityType: 'dsa_solve',
            occurredAt: '2026-10-05T10:00:00Z',
            title: 'Solved 3Sum',
            summary: 'Solved on LeetCode: 3Sum',
            externalUrl: 'https://leetcode.com/problems/3sum/',
            metadata: { platform: 'leetcode', titleSlug: '3sum', submissionId: '998877' },
          },
        ],
        syncState: {
          totalSolved: 120,
          easySolved: 60,
          mediumSolved: 50,
          hardSolved: 10,
          ranking: 95000,
          contestRating: 1580,
          attendedContests: 5,
        },
      })),
    };

    mockCodeforcesAuthAdapter = {
      connectWithIdentifier: vi.fn(async (identifier) => {
        if (identifier === 'nonexistent_handle') {
          throw new Error('Codeforces user "nonexistent_handle" was not found.');
        }
        return {
          externalAccountId: identifier,
          username: identifier,
          displayName: 'Gennady Korotkevich',
          avatarUrl: 'https://userpic.codeforces.org/avatar.jpg',
          email: null,
        };
      }),
    };

    mockCodeforcesSyncAdapter = {
      sync: vi.fn(async () => ({
        success: true,
        repositories: [],
        activities: [
          {
            externalId: 'submission:392217392',
            activityType: 'dsa_solve',
            occurredAt: '2026-10-05T10:00:00Z',
            title: 'Solved AghaBalaSar and Hamed',
            summary: 'Solved AghaBalaSar and Hamed on Codeforces',
            externalUrl: 'https://codeforces.com/contest/2268/problem/D',
            metadata: { platform: 'codeforces', contestId: 2268, index: 'D', submissionId: 392217392 },
          },
          {
            externalId: 'contest:2268',
            activityType: 'contest_participation',
            occurredAt: '2026-10-05T12:00:00Z',
            title: 'Competed in Codeforces Round 1124 (Div. 1)',
            summary: 'Finished rank #1 in Codeforces Round 1124 (Div. 1)',
            externalUrl: 'https://codeforces.com/contest/2268',
            metadata: { platform: 'codeforces', contestId: 2268, rank: 1, ratingChange: 52 },
          },
        ],
        syncState: {
          handle: 'tourist',
          rating: 3384,
          maxRating: 4009,
          rank: 'legendary grandmaster',
          maxRank: 'tourist',
          contribution: 112,
          ratedContestsParticipated: 125,
          lastContestId: 2268,
          lastContestName: 'Codeforces Round 1124 (Div. 1)',
          lastContestRank: 1,
        },
      })),
    };

    providerRegistry = new ProviderRegistry();
    const githubProvider = new GitHubProvider();
    vi.spyOn(githubProvider, 'getAuthAdapter').mockReturnValue(mockAuthAdapter);
    vi.spyOn(githubProvider, 'getSyncAdapter').mockReturnValue(mockSyncAdapter);
    providerRegistry.register(githubProvider);

    const leetcodeProvider = new LeetCodeProvider();
    vi.spyOn(leetcodeProvider, 'getAuthAdapter').mockReturnValue(mockLeetCodeAuthAdapter);
    vi.spyOn(leetcodeProvider, 'getSyncAdapter').mockReturnValue(mockLeetCodeSyncAdapter);
    providerRegistry.register(leetcodeProvider);

    const codeforcesProvider = new CodeforcesProvider();
    vi.spyOn(codeforcesProvider, 'getAuthAdapter').mockReturnValue(mockCodeforcesAuthAdapter);
    vi.spyOn(codeforcesProvider, 'getSyncAdapter').mockReturnValue(mockCodeforcesSyncAdapter);
    providerRegistry.register(codeforcesProvider);

    mockGoogleAuthAdapter = {
      createAuthorizationUrl: vi.fn((state) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`),
      exchangeCodeForTokens: vi.fn(async () => ({
        accessToken: 'mock_google_access_token',
        refreshToken: 'mock_google_refresh_token',
        expiresIn: 3600,
        scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
      })),
      fetchIdentity: vi.fn(async () => ({
        externalAccountId: 'google-sub-101010',
        username: 'student@gmail.com',
        displayName: 'Google Student',
        avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
        email: 'student@gmail.com',
      })),
      refreshAccessToken: vi.fn(async () => ({
        accessToken: 'mock_google_refreshed_access_token',
        expiresIn: 3600,
      })),
      revokeToken: vi.fn(async () => {}),
    };

    mockGoogleSyncAdapter = {
      sync: vi.fn(async () => ({
        success: true,
        repositories: [],
        activities: [],
        calendarEvents: [
          {
            externalId: 'cal-event-1',
            calendarId: 'student@gmail.com',
            title: 'Algorithm Design Lecture',
            status: 'confirmed' as const,
            startTime: '2026-10-05T09:00:00Z',
            endTime: '2026-10-05T10:30:00Z',
            isAllDay: false,
            timeZone: 'UTC',
            isBusy: true,
            isRecurring: true,
            recurringEventId: 'algo_series_01',
            htmlLink: 'https://calendar.google.com/event?eid=1',
          },
        ],
        syncState: {
          primaryCalendarId: 'student@gmail.com',
          primaryCalendarTimeZone: 'UTC',
          selectedCalendarIds: ['student@gmail.com'],
          calendars: [
            {
              id: 'student@gmail.com',
              summary: 'Personal',
              timeZone: 'UTC',
              primary: true,
              accessRole: 'owner',
            },
          ],
          syncTokens: { 'student@gmail.com': 'token-sync-123' },
          lastSyncedAt: new Date().toISOString(),
        },
      })),
    };

    const googleCalendarProvider = new GoogleCalendarProvider();
    vi.spyOn(googleCalendarProvider, 'getAuthAdapter').mockReturnValue(mockGoogleAuthAdapter);
    vi.spyOn(googleCalendarProvider, 'getSyncAdapter').mockReturnValue(mockGoogleSyncAdapter);
    providerRegistry.register(googleCalendarProvider);

    const service = new IntegrationsServiceImpl(mockRepo, providerRegistry);
    const controller = new IntegrationsController(service);

    const testAuthMiddleware: preHandlerHookHandler = async (req, reply) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Bearer token required' },
        });
      }
      req.auth = { profileId: currentAuthContext.id, clerkUserId: currentAuthContext.clerkId };
    };

    app = fastify({ logger: false });
    app.register(
      createIntegrationsRoutes({
        requireAuthMiddleware: testAuthMiddleware,
        integrationsController: controller,
      })
    );
  });

  describe('1. Authentication Gate', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const endpoints: Array<{ method: 'GET' | 'POST'; url: string }> = [
        { method: 'GET', url: '/api/v1/integrations' },
        { method: 'POST', url: '/api/v1/integrations/github/connect' },
        { method: 'GET', url: '/api/v1/integrations/github/callback?code=1&state=2' },
        { method: 'POST', url: '/api/v1/integrations/github/sync' },
        { method: 'POST', url: '/api/v1/integrations/github/disconnect' },
        { method: 'GET', url: '/api/v1/integrations/github/status' },
      ];

      for (const ep of endpoints) {
        const res = await app.inject({
          method: ep.method,
          url: ep.url,
        });
        expect(res.statusCode).toBe(401);
      }
    });
  });

  describe('2. Provider Validation', () => {
    it('rejects unsupported provider requests with 400 UNSUPPORTED_PROVIDER', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/atcoder/connect',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.error.code).toBe('UNSUPPORTED_PROVIDER');
      expect(json.error.message).toContain('Supported providers: github, leetcode, codeforces');
    });
  });

  describe('3. OAuth Connection & State Validation', () => {
    it('generates state token and returns authorization url', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/github/connect',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.authorization_url).toContain('https://github.com/login/oauth/authorize');
      expect(json.data.state).toBeDefined();
    });

    it('returns configuration error when GitHub OAuth credentials are not configured', async () => {
      vi.spyOn(mockAuthAdapter, 'createAuthorizationUrl').mockImplementationOnce(() => {
        throw new Error('GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID in the backend environment.');
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/github/connect',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(500);
      const json = res.json();
      expect(json.error.code).toBe('OAUTH_INIT_ERROR');
      expect(json.error.message).toContain('GitHub OAuth is not configured');
      expect(json.error.message).not.toContain('not registered or supported');
    });

    it('rejects callback with invalid or expired state parameter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/integrations/github/callback?code=test_code&state=non_existent_state',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.error.code).toBe('OAUTH_CALLBACK_ERROR');
      expect(json.error.message).toContain('Invalid or expired OAuth state');
    });

    it('successfully processes callback and marks connection CONNECTED', async () => {
      // 1. Connect
      const connectRes = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/github/connect',
        headers: { Authorization: 'Bearer valid-token' },
      });
      const { state } = connectRes.json().data;

      // 2. Callback
      const callbackRes = await app.inject({
        method: 'GET',
        url: `/api/v1/integrations/github/callback?code=github_code_123&state=${state}`,
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(callbackRes.statusCode).toBe(200);
      const json = callbackRes.json();
      expect(json.success).toBe(true);
      expect(json.data.provider).toBe('github');
      expect(json.data.external_account_id).toBe('583231');
      expect(json.data.external_username).toBe('octocat');
      expect(json.data.status).toBe('SYNCED');

      // Crucial Security Verification: NEVER return encrypted_access_token or plaintext secrets to client!
      expect(json.data.encrypted_access_token).toBeUndefined();
      expect(json.data.accessToken).toBeUndefined();
    });
  });

  describe('4. Idempotent Synchronization & Evidence Boundary', () => {
    beforeEach(async () => {
      // Setup connected user
      await mockRepo.upsertConnection(mockUserA.id, {
        provider: 'github',
        external_account_id: '583231',
        external_username: 'octocat',
        external_display_name: 'The Octocat',
        external_avatar_url: null,
        external_email: null,
        status: 'CONNECTED',
        scopes: ['read:user', 'repo'],
        encrypted_access_token: encryptToken('test-access-token'),
      });
    });

    it('triggers sync, stores normalized entities, and creates evidence without duplicates', async () => {
      // First sync
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/github/sync',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res1.statusCode).toBe(200);
      const json1 = res1.json();
      expect(json1.success).toBe(true);
      expect(json1.data.repositories_synced).toBe(1);
      expect(json1.data.activities_synced).toBe(1);
      expect(json1.data.connection.status).toBe('SYNCED');

      // Second sync (idempotent repeat)
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/github/sync',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res2.statusCode).toBe(200);
      const json2 = res2.json();
      expect(json2.success).toBe(true);
      expect(json2.data.repositories_synced).toBe(1);

      // Verify evidence creation called idempotently
      expect(mockRepo.createExternalActivityEvidence).toHaveBeenCalledTimes(2);
    });

    it('handles rate limits cleanly without crashing or corrupting data', async () => {
      vi.spyOn(mockSyncAdapter, 'sync').mockResolvedValueOnce({
        success: false,
        repositories: [],
        activities: [],
        isRateLimited: true,
        rateLimitReset: 1791145000,
        errorCode: 'RATE_LIMITED',
        errorMessage: 'GitHub API rate limit exceeded',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/github/sync',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.connection.status).toBe('RATE_LIMITED');
      expect(json.data.connection.last_error_code).toBe('RATE_LIMITED');
      expect(json.data.job.status).toBe('RATE_LIMITED');
    });
  });

  describe('5. Disconnect', () => {
    it('disconnects active integration and revokes credentials', async () => {
      await mockRepo.upsertConnection(mockUserA.id, {
        provider: 'github',
        external_account_id: '583231',
        external_username: 'octocat',
        external_display_name: 'The Octocat',
        external_avatar_url: null,
        external_email: null,
        status: 'CONNECTED',
        scopes: ['read:user'],
        encrypted_access_token: encryptToken('token'),
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/github/disconnect',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.status).toBe('DISCONNECTED');
    });
  });

  describe('6. Cross-User Isolation', () => {
    it('prevents User B from accessing or syncing User A connection', async () => {
      // User A connects GitHub
      await mockRepo.upsertConnection(mockUserA.id, {
        provider: 'github',
        external_account_id: '583231',
        external_username: 'octocat_a',
        external_display_name: 'User A',
        external_avatar_url: null,
        external_email: null,
        status: 'CONNECTED',
        scopes: ['read:user'],
        encrypted_access_token: encryptToken('token_a'),
      });

      // Switch context to User B
      currentAuthContext = mockUserB;

      // User B checks status of GitHub: must return connected: false
      const statusRes = await app.inject({
        method: 'GET',
        url: '/api/v1/integrations/github/status',
        headers: { Authorization: 'Bearer token-b' },
      });

      expect(statusRes.statusCode).toBe(200);
      expect(statusRes.json().data.connected).toBe(false);
      expect(statusRes.json().data.connection).toBeNull();

      // User B attempts to sync GitHub: must fail because User B has no connection
      const syncRes = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/github/sync',
        headers: { Authorization: 'Bearer token-b' },
      });

      expect(syncRes.statusCode).toBe(400);
      expect(syncRes.json().error.message).toContain('not found');
    });
  });

  describe('7. LeetCode Public Handle Integration & Sync (/api/v1/integrations/leetcode)', () => {
    it('successfully connects LeetCode via public username and performs initial sync', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/leetcode/connect',
        headers: { Authorization: 'Bearer valid-token' },
        payload: { username: 'test_coder_81' },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.provider).toBe('leetcode');
      expect(json.data.external_account_id).toBe('test_coder_81');
      expect(json.data.external_username).toBe('test_coder_81');
      expect(json.data.status).toBe('SYNCED');
      expect(json.data.sync_state.totalSolved).toBe(120);
      expect(json.data.sync_state.easySolved).toBe(60);
      expect(json.data.sync_state.mediumSolved).toBe(50);
      expect(json.data.sync_state.hardSolved).toBe(10);
      expect(json.data.sync_state.contestRating).toBe(1580);
    });

    it('rejects connection with 400 when username is missing or empty', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/leetcode/connect',
        headers: { Authorization: 'Bearer valid-token' },
        payload: { username: '   ' },
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.error.code).toBe('INVALID_INPUT');
    });

    it('returns 400 when LeetCode username does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/leetcode/connect',
        headers: { Authorization: 'Bearer valid-token' },
        payload: { username: 'nonexistent_coder' },
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.error.code).toBe('CONNECT_ERROR');
      expect(json.error.message).toContain('was not found');
    });

    it('syncs LeetCode activities and creates external evidence idempotently', async () => {
      // Connect first
      await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/leetcode/connect',
        headers: { Authorization: 'Bearer valid-token' },
        payload: { username: 'test_coder_81' },
      });

      // First manual sync
      const sync1 = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/leetcode/sync',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(sync1.statusCode).toBe(200);
      const json1 = sync1.json();
      expect(json1.data.activities_synced).toBe(1);

      // Verify external activities
      const actsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/integrations/leetcode/activities',
        headers: { Authorization: 'Bearer valid-token' },
      });
      expect(actsRes.statusCode).toBe(200);
      const acts = actsRes.json().data;
      expect(acts).toHaveLength(1);
      expect(acts[0].external_id).toBe('submission:998877');
      expect(acts[0].activity_type).toBe('dsa_solve');
      expect(acts[0].title).toBe('Solved 3Sum');

      // Second manual sync: MUST be 100% idempotent
      const sync2 = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/leetcode/sync',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(sync2.statusCode).toBe(200);

      // Verify no duplicate activities exist
      const actsRes2 = await app.inject({
        method: 'GET',
        url: '/api/v1/integrations/leetcode/activities',
        headers: { Authorization: 'Bearer valid-token' },
      });
      expect(actsRes2.json().data).toHaveLength(1);
    });

    it('disconnects LeetCode integration', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/leetcode/connect',
        headers: { Authorization: 'Bearer valid-token' },
        payload: { username: 'test_coder_81' },
      });

      const disconnectRes = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/leetcode/disconnect',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(disconnectRes.statusCode).toBe(200);
      expect(disconnectRes.json().data.status).toBe('DISCONNECTED');

      // Subsequent sync fails
      const syncRes = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/leetcode/sync',
        headers: { Authorization: 'Bearer valid-token' },
      });
      expect(syncRes.statusCode).toBe(400);
      expect(syncRes.json().error.message).toContain('disconnected');
    });

    it('gets LeetCode connection status', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/leetcode/connect',
        headers: { Authorization: 'Bearer valid-token' },
        payload: { username: 'test_coder_81' },
      });

      const statusRes = await app.inject({
        method: 'GET',
        url: '/api/v1/integrations/leetcode/status',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(statusRes.statusCode).toBe(200);
      expect(statusRes.json().data.connected).toBe(true);
      expect(statusRes.json().data.connection.sync_state.totalSolved).toBe(120);
    });
  });

  describe('Part 4 — Codeforces Integration Routes & Service', () => {
    it('connects a Codeforces account using public handle', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/codeforces/connect',
        headers: { Authorization: 'Bearer valid-token' },
        payload: { handle: 'tourist' },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.provider).toBe('codeforces');
      expect(json.data.external_account_id).toBe('tourist');
      expect(json.data.external_username).toBe('tourist');
      expect(json.data.external_display_name).toBe('Gennady Korotkevich');
      expect(json.data.status).toBe('SYNCED');
      expect(json.data.sync_state.handle).toBe('tourist');
      expect(json.data.sync_state.rating).toBe(3384);
    });

    it('rejects connection when handle is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/codeforces/connect',
        headers: { Authorization: 'Bearer valid-token' },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.error.code).toBe('INVALID_INPUT');
      expect(json.error.message).toContain('handle');
    });

    it('returns error when Codeforces handle does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/codeforces/connect',
        headers: { Authorization: 'Bearer valid-token' },
        payload: { handle: 'nonexistent_handle' },
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.error.code).toBe('CONNECT_ERROR');
      expect(json.error.message).toContain('was not found');
    });

    it('syncs Codeforces activities and creates external evidence idempotently', async () => {
      // Connect first
      await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/codeforces/connect',
        headers: { Authorization: 'Bearer valid-token' },
        payload: { handle: 'tourist' },
      });

      // First manual sync
      const sync1 = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/codeforces/sync',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(sync1.statusCode).toBe(200);
      const json1 = sync1.json();
      // 1 submission + 1 contest in mock = 2 activities synced
      expect(json1.data.activities_synced).toBe(2);

      // Verify external activities
      const actsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/integrations/codeforces/activities',
        headers: { Authorization: 'Bearer valid-token' },
      });
      expect(actsRes.statusCode).toBe(200);
      const acts = actsRes.json().data;
      expect(acts).toHaveLength(2);
      expect(acts.some((a: { external_id: string }) => a.external_id === 'submission:392217392')).toBe(true);
      expect(acts.some((a: { external_id: string }) => a.external_id === 'contest:2268')).toBe(true);

      // Second manual sync: MUST be 100% idempotent
      const sync2 = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/codeforces/sync',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(sync2.statusCode).toBe(200);

      // Verify no duplicate activities exist
      const actsRes2 = await app.inject({
        method: 'GET',
        url: '/api/v1/integrations/codeforces/activities',
        headers: { Authorization: 'Bearer valid-token' },
      });
      expect(actsRes2.json().data).toHaveLength(2);
    });

    it('disconnects Codeforces integration', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/codeforces/connect',
        headers: { Authorization: 'Bearer valid-token' },
        payload: { handle: 'tourist' },
      });

      const disconnectRes = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/codeforces/disconnect',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(disconnectRes.statusCode).toBe(200);
      expect(disconnectRes.json().data.status).toBe('DISCONNECTED');
    });

    it('gets Codeforces connection status', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/codeforces/connect',
        headers: { Authorization: 'Bearer valid-token' },
        payload: { handle: 'tourist' },
      });

      const statusRes = await app.inject({
        method: 'GET',
        url: '/api/v1/integrations/codeforces/status',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(statusRes.statusCode).toBe(200);
      expect(statusRes.json().data.connected).toBe(true);
      expect(statusRes.json().data.connection.sync_state.handle).toBe('tourist');
      expect(statusRes.json().data.connection.sync_state.rating).toBe(3384);
    });
  });

  describe('8. Phase 14E — Google Calendar Endpoints', () => {
    it('initiates OAuth flow and returns Google authorization URL with state', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/google_calendar/connect',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.authorization_url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(json.data.authorization_url).toContain('state=');
      expect(json.data.state).toBeDefined();
    });

    it('exchanges OAuth code via callback and connects Google Calendar', async () => {
      // 1. Initiate OAuth
      const initRes = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/google_calendar/connect',
        headers: { Authorization: 'Bearer valid-token' },
      });
      const state = initRes.json().data.state;

      // 2. Callback
      const callbackRes = await app.inject({
        method: 'GET',
        url: `/api/v1/integrations/google_calendar/callback?code=mock_google_code&state=${state}`,
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(callbackRes.statusCode).toBe(200);
      const conn = callbackRes.json().data;
      expect(conn.provider).toBe('google_calendar');
      expect(conn.external_account_id).toBe('google-sub-101010');
      expect(conn.external_username).toBe('student@gmail.com');
      expect(conn.status).toBe('SYNCED');
    });

    it('performs manual sync, upserts calendar events, and returns events_synced without activities', async () => {
      // Setup connection
      const initRes = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/google_calendar/connect',
        headers: { Authorization: 'Bearer valid-token' },
      });
      const state = initRes.json().data.state;
      await app.inject({
        method: 'GET',
        url: `/api/v1/integrations/google_calendar/callback?code=mock_code&state=${state}`,
        headers: { Authorization: 'Bearer valid-token' },
      });

      // Sync
      const syncRes = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/google_calendar/sync',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(syncRes.statusCode).toBe(200);
      const syncData = syncRes.json().data;
      expect(syncData.events_synced).toBe(1);
      expect(syncData.activities_synced).toBe(0);

      // List calendar events
      const eventsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/integrations/google_calendar/events',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(eventsRes.statusCode).toBe(200);
      const events = eventsRes.json().data;
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Algorithm Design Lecture');
      expect(events[0].is_busy).toBe(true);
      expect(events[0].is_recurring).toBe(true);
    });

    it('disconnects Google Calendar and returns DISCONNECTED status', async () => {
      const initRes = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/google_calendar/connect',
        headers: { Authorization: 'Bearer valid-token' },
      });
      const state = initRes.json().data.state;
      await app.inject({
        method: 'GET',
        url: `/api/v1/integrations/google_calendar/callback?code=mock_code&state=${state}`,
        headers: { Authorization: 'Bearer valid-token' },
      });

      const disconnectRes = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/google_calendar/disconnect',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(disconnectRes.statusCode).toBe(200);
      expect(disconnectRes.json().data.status).toBe('DISCONNECTED');
    });

    it('rejects listing calendar events for non-calendar provider', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/integrations/github/events',
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('UNSUPPORTED_OPERATION');
    });
  });
});
