import fastify, { type FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@avenza/shared';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { IClerkClient } from '../../auth/clerk/clerk.client';
import { AuthService } from '../../auth/auth.service';
import { createRequireAuthMiddleware } from '../../auth/auth.middleware';
import { InMemoryProfileRepository } from './profile.repository';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { createProfileRoutes } from './profile.routes';
import { AccountDeletionService, type IClerkUserDeletionClient } from './account-deletion.service';
import type { IIntegrationsService } from '../integrations/integrations.service';
import type { IStorageService, StoragePurgeResult } from '../../infrastructure/storage/storage.service';
import { registerErrorHandler } from '../../plugins/error-handler';

describe('Phase 17B-2 SEC-17B2-01 & SEC-17B2-02: Account Deletion Re-Authentication & Recovery', () => {
  let app: FastifyInstance;
  let mockClerkClient: IClerkClient;
  let mockClerkDeletionClient: IClerkUserDeletionClient;
  let mockIntegrationsService: IIntegrationsService;
  let mockStorageService: IStorageService;
  let profileRepo: InMemoryProfileRepository;
  let profileService: ProfileService;
  let deletionService: AccountDeletionService;
  interface MockSupabaseClient {
    from: ReturnType<typeof vi.fn>;
  }

  let mockSupabaseClient: MockSupabaseClient;
  let tombstoneInserts: Array<{ table: string; data: Record<string, unknown> }>;
  let consumedTokensStore: Array<Record<string, unknown>>;
  let dbOutageInjector: boolean;

  beforeEach(async () => {
    AccountDeletionService.resetConsumedReauthTokens();
    tombstoneInserts = [];
    consumedTokensStore = [];
    dbOutageInjector = false;

    mockSupabaseClient = {
      from: vi.fn((table: string) => ({
        select: vi.fn((_cols?: string) => ({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
          lt: vi.fn(async (_col: string, val: string) => {
            if (table === 'consumed_reauth_tokens') {
              consumedTokensStore = consumedTokensStore.filter(
                (t) => (t.expires_at as string) >= val
              );
            }
            return { error: null };
          }),
        })),
        insert: vi.fn(async (data: Record<string, unknown>) => {
          if (table === 'consumed_reauth_tokens') {
            if (dbOutageInjector) {
              return { error: new Error('Postgres connection pool exhausted') };
            }
            const exists = consumedTokensStore.some((t) => t.token_digest === data.token_digest);
            if (exists) {
              return {
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint "consumed_reauth_tokens_pkey"',
                },
              };
            }
            consumedTokensStore.push(data);
            return { error: null };
          }
          tombstoneInserts.push({ table, data });
          return { error: null };
        }),
      })),
    };

    mockClerkClient = {
      async verifyBearerToken(token: string) {
        if (token === 'alice-valid-token') {
          return {
            clerkUserId: 'clerk_alice_id',
            displayName: 'Alice Architect',
            avatarUrl: 'https://example.com/alice.png',
            timezone: 'America/New_York',
          };
        }
        if (token === 'bob-valid-token') {
          return {
            clerkUserId: 'clerk_bob_id',
            displayName: 'Bob Builder',
            avatarUrl: 'https://example.com/bob.png',
            timezone: 'Europe/London',
          };
        }
        return null;
      },
    };

    mockClerkDeletionClient = {
      users: {
        verifyPassword: vi.fn(async ({ password }: { password: string }) => {
          if (password === 'CorrectPassword123!') {
            return { verified: true };
          }
          return { verified: false };
        }),
        deleteUser: vi.fn().mockResolvedValue({ deleted: true }),
      },
      verifyToken: vi.fn(async (token: string) => {
        const nowSec = Math.floor(Date.now() / 1000);
        if (token === 'alice-standard-bearer-token') {
          // Standard session token: valid sub, but lacks fresh step-up challenge proof
          return { sub: 'clerk_alice_id', iat: nowSec - 3600, exp: nowSec + 3600 };
        }
        if (token === 'alice-stale-reauth-token') {
          // Stale token: auth_time older than 120s
          return { sub: 'clerk_alice_id', purpose: 'reauth', auth_time: nowSec - 300, jti: 'stale-jti' };
        }
        if (token === 'alice-valid-stepup-token') {
          return { sub: 'clerk_alice_id', purpose: 'reauth', auth_time: nowSec - 10, jti: 'alice-jti-1' };
        }
        if (token === 'alice-replayed-stepup-token') {
          return { sub: 'clerk_alice_id', purpose: 'reauth', auth_time: nowSec - 10, jti: 'replayed-jti-fixed' };
        }
        if (token === 'bob-valid-stepup-token') {
          return { sub: 'clerk_bob_id', purpose: 'reauth', auth_time: nowSec - 10, jti: 'bob-jti-1' };
        }
        if (token === 'forged-token') {
          throw new Error('Token signature invalid or tampered');
        }
        if (token.startsWith('alice-')) {
          return { sub: 'clerk_alice_id', purpose: 'reauth', auth_time: nowSec - 10, jti: token };
        }
        throw new Error('Invalid token');
      }),
    };

    mockIntegrationsService = {
      revokeAllUserCredentials: vi.fn(async () => ({
        success: true,
        revoked: ['google_calendar', 'github'],
        errors: [],
      })),
    } as unknown as IIntegrationsService;

    mockStorageService = {
      purgeUserStorageAssets: vi.fn(async (): Promise<StoragePurgeResult> => ({
        success: true,
        filesPurged: 3,
        errors: [],
        unpurgedAssets: [],
      })),
      purgeSpecificAssets: vi.fn(async () => ({
        purged: [],
        failed: [],
      })),
    };

    profileRepo = new InMemoryProfileRepository();
    profileService = new ProfileService(profileRepo);

    // Bootstrap Alice and Bob profiles
    await profileService.getOrCreateProfile('clerk_alice_id', {
      displayName: 'Alice Architect',
      avatarUrl: 'https://example.com/alice.png',
      timezone: 'America/New_York',
    });

    await profileService.getOrCreateProfile('clerk_bob_id', {
      displayName: 'Bob Builder',
      avatarUrl: 'https://example.com/bob.png',
      timezone: 'Europe/London',
    });

    deletionService = new AccountDeletionService(
      mockSupabaseClient as unknown as SupabaseClient<Database>,
      profileService,
      mockIntegrationsService,
      mockStorageService,
      mockClerkDeletionClient
    );

    const authService = new AuthService(mockClerkClient);
    const requireAuthMiddleware = createRequireAuthMiddleware(authService, profileService);
    const profileController = new ProfileController(deletionService);
    const profileRoutes = createProfileRoutes({
      requireAuthMiddleware,
      profileController,
    });

    app = fastify();
    registerErrorHandler(app);
    app.register(profileRoutes);
    await app.ready();
  });

  describe('1. SEC-17B2-01: Explicit Confirmation & Re-Authentication Safeguards', () => {
    it('1. Correct confirmation phrase with no password or alternative proof → rejected (401 REAUTH_REQUIRED)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('REAUTH_REQUIRED');
      expect(mockClerkDeletionClient.users.deleteUser).not.toHaveBeenCalled();
    });

    it('2. Invalid password → rejected (401 REAUTH_FAILED)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
          password: 'WrongPassword!',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('REAUTH_FAILED');
      expect(mockClerkDeletionClient.users.deleteUser).not.toHaveBeenCalled();
    });

    it('3. Valid password verification → permitted to continue', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
          password: 'CorrectPassword123!',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(mockClerkDeletionClient.users.deleteUser).toHaveBeenCalledWith('clerk_alice_id');
    });

    it('4. Standard bearer token without step-up proof → rejected (401 REAUTH_STEP_UP_REQUIRED)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
          reauthToken: 'alice-standard-bearer-token',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('REAUTH_STEP_UP_REQUIRED');
      expect(body.error.message).toContain('Standard bearer session tokens cannot be used');
      expect(mockClerkDeletionClient.users.deleteUser).not.toHaveBeenCalled();
    });

    it('5. Stale step-up token (> 120s old) → rejected (401 REAUTH_STALE)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
          reauthToken: 'alice-stale-reauth-token',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('REAUTH_STALE');
      expect(body.error.message).toContain('expired');
      expect(mockClerkDeletionClient.users.deleteUser).not.toHaveBeenCalled();
    });

    it('6. Forged or invalid signature token → rejected (401 REAUTH_FAILED)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
          reauthToken: 'forged-token',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error.code).toBe('REAUTH_FAILED');
    });

    it('7. OAuth/passwordless user with static template token → rejected by safety gate (403 OAUTH_DELETION_RESTRICTED)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
          reauthToken: 'alice-valid-stepup-token',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('OAUTH_DELETION_RESTRICTED');
      expect(body.error.message).toContain('OAuth/passwordless accounts is restricted');
      expect(mockClerkDeletionClient.users.deleteUser).not.toHaveBeenCalled();
    });

    it('7b. OAuth/passwordless user without password or token → rejected by safety gate (403 OAUTH_DELETION_RESTRICTED)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
          authMethod: 'oauth',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('OAUTH_DELETION_RESTRICTED');
      expect(mockClerkDeletionClient.users.deleteUser).not.toHaveBeenCalled();
    });

    it('8. Single-use replay protection: reusing consumed step-up token → rejected (401 REAUTH_REPLAY_DETECTED)', async () => {
      // First use consumes token and is rejected by OAuth gate
      const res1 = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
          reauthToken: 'alice-replayed-stepup-token',
        },
      });
      expect(res1.statusCode).toBe(403);
      expect(JSON.parse(res1.body).error.code).toBe('OAUTH_DELETION_RESTRICTED');

      // Replay attempt with same token/jti is rejected by replay protection BEFORE reaching gate
      const res2 = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
          reauthToken: 'alice-replayed-stepup-token',
        },
      });
      expect(res2.statusCode).toBe(401);
      const body2 = JSON.parse(res2.body);
      expect(body2.error.code).toBe('REAUTH_REPLAY_DETECTED');
      expect(body2.error.message).toContain('already been consumed');
    });

    it('8b. Replay rejected across separate simulated API instances sharing database', async () => {
      // Instance 1 consumes the token
      const res1 = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
          reauthToken: 'alice-multi-instance-token',
        },
      });
      expect(res1.statusCode).toBe(403);
      expect(JSON.parse(res1.body).error.code).toBe('OAUTH_DELETION_RESTRICTED');

      // Simulate Instance 2: completely new service and empty in-memory cache, but sharing the database
      AccountDeletionService.resetConsumedReauthTokens();
      const instance2DeletionService = new AccountDeletionService(
        mockSupabaseClient as unknown as SupabaseClient<Database>,
        profileService,
        mockIntegrationsService,
        mockStorageService,
        mockClerkDeletionClient
      );

      // Instance 2 attempts to consume the same token
      await expect(
        instance2DeletionService.initiateUserDeletion('alice-profile-id', 'clerk_alice_id', {
          confirmation: 'DELETE MY ACCOUNT',
          reauthToken: 'alice-multi-instance-token',
        })
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'REAUTH_REPLAY_DETECTED',
      });
    });

    it('8c. Replay rejected after process restart (in-memory cache cleared, database persisted)', async () => {
      // First use on process 1 consumes token and hits gate
      await expect(
        deletionService.initiateUserDeletion('alice-profile-id', 'clerk_alice_id', {
          confirmation: 'DELETE MY ACCOUNT',
          reauthToken: 'alice-restart-token',
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'OAUTH_DELETION_RESTRICTED',
      });

      // Simulate complete process restart: clear in-memory caches
      AccountDeletionService.resetConsumedReauthTokens();

      // Process 2 starts up and points to same database
      await expect(
        deletionService.initiateUserDeletion('alice-profile-id', 'clerk_alice_id', {
          confirmation: 'DELETE MY ACCOUNT',
          reauthToken: 'alice-restart-token',
        })
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'REAUTH_REPLAY_DETECTED',
      });
    });

    it('8d. Database outage during token coordination fails closed with 503 REAUTH_COORDINATION_UNAVAILABLE', async () => {
      dbOutageInjector = true;

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
          reauthToken: 'alice-db-fail-token',
        },
      });

      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('REAUTH_COORDINATION_UNAVAILABLE');
    });

    it('8e. Concurrent requests with same proof: one hits OAuth gate, other receives 401 REAUTH_REPLAY_DETECTED', async () => {
      const p1 = deletionService.initiateUserDeletion('alice-profile-id', 'clerk_alice_id', {
        confirmation: 'DELETE MY ACCOUNT',
        reauthToken: 'alice-concurrent-race-token',
      });
      const p2 = deletionService.initiateUserDeletion('alice-profile-id', 'clerk_alice_id', {
        confirmation: 'DELETE MY ACCOUNT',
        reauthToken: 'alice-concurrent-race-token',
      });

      const results = await Promise.allSettled([p1, p2]);
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(rejected).toHaveLength(2);

      const errors = rejected.map((r) => (r as PromiseRejectedResult).reason);
      const codes = errors.map((e) => e.code);
      expect(codes).toContain('OAUTH_DELETION_RESTRICTED');
      expect(codes).toContain('REAUTH_REPLAY_DETECTED');
    });

    it('9. Cross-user identity mismatch → rejected (403 IDENTITY_MISMATCH)', async () => {
      // Alice tries to use Bob's step-up token
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
          reauthToken: 'bob-valid-stepup-token',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('IDENTITY_MISMATCH');
      expect(mockClerkDeletionClient.users.deleteUser).not.toHaveBeenCalled();
    });

    it('10. Unsupported authentication method → fails safely without starting deletion (400 UNSUPPORTED_AUTH_METHOD)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
          authMethod: 'magic_link_unsupported_v2',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNSUPPORTED_AUTH_METHOD');
      expect(mockClerkDeletionClient.users.deleteUser).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated deletion requests with 401', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        payload: { confirmation: 'DELETE MY ACCOUNT' },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects deletion if confirmation phrase is missing', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: { password: 'CorrectPassword123!' },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_CONFIRMATION');
    });

    it('accepts confirmation phrase with leading/trailing whitespace and lowercase', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: '  delete my account  ',
          password: 'CorrectPassword123!',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
    });
  });

  describe('2. Successful Deletion Engine Execution & Lifecycle', () => {
    it('executes full lifecycle: revokes credentials, purges storage, pre-deletes junctions, deletes profile and Clerk user', async () => {
      const aliceProfileBefore = await profileService.getProfileByClerkId('clerk_alice_id');
      expect(aliceProfileBefore).toBeDefined();

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
          password: 'CorrectPassword123!',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('Account deleted');

      // Verify external credential revocation was called for Alice
      expect(mockIntegrationsService.revokeAllUserCredentials).toHaveBeenCalledWith(aliceProfileBefore!.id);

      // Verify storage assets were purged
      expect(mockStorageService.purgeUserStorageAssets).toHaveBeenCalledWith(aliceProfileBefore!.id);

      // Verify junction tables were pre-deleted
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('career_target_skills');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('career_opportunity_skills');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('career_application_projects');

      // Verify Clerk user was deleted
      expect(mockClerkDeletionClient.users.deleteUser).toHaveBeenCalledWith('clerk_alice_id');

      // Verify profile is completely gone from repository
      const aliceProfileAfter = await profileService.getProfileByClerkId('clerk_alice_id');
      expect(aliceProfileAfter).toBeNull();

      // Verify tombstone records progressed through lifecycle: DELETION_PENDING -> PURGING -> DELETED
      const statuses = tombstoneInserts.filter((t) => t.table === 'account_deletion_tombstones').map((t) => t.data.status);
      expect(statuses).toContain('DELETION_PENDING');
      expect(statuses).toContain('PURGING');
      expect(statuses).toContain('DELETED');
    });

    it('preserves tenant isolation: Alice deletion leaves Bob untouched', async () => {
      const bobProfileBefore = await profileService.getProfileByClerkId('clerk_bob_id');
      expect(bobProfileBefore).toBeDefined();

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
          password: 'CorrectPassword123!',
        },
      });

      expect(res.statusCode).toBe(200);

      // Bob must remain completely intact
      const bobProfileAfter = await profileService.getProfileByClerkId('clerk_bob_id');
      expect(bobProfileAfter).toBeDefined();
      expect(bobProfileAfter?.clerk_user_id).toBe('clerk_bob_id');
    });
  });

  describe('3. SEC-17B2-02 & SEC-17B2-06: Durable Recovery Jobs & Tombstone Semantics', () => {
    it('persists durable PROVIDER_REVOCATION recovery job and keeps tombstone in PURGING when revocation fails', async () => {
      mockIntegrationsService.revokeAllUserCredentials = vi.fn().mockResolvedValue({
        success: false,
        revoked: ['google_calendar'],
        errors: [{ provider: 'github', error: 'GitHub API timeout' }],
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
          password: 'CorrectPassword123!',
        },
      });

      expect(res.statusCode).toBe(200);

      // Local profile is still deleted cleanly
      const aliceProfileAfter = await profileService.getProfileByClerkId('clerk_alice_id');
      expect(aliceProfileAfter).toBeNull();

      // Verify a durable recovery job was persisted in account_deletion_recovery_jobs
      const recoveryJobs = tombstoneInserts.filter((t) => t.table === 'account_deletion_recovery_jobs');
      expect(recoveryJobs.length).toBeGreaterThanOrEqual(1);
      const providerJob = recoveryJobs.find((j) => j.data.job_type === 'PROVIDER_REVOCATION');
      expect(providerJob).toBeDefined();
      expect(providerJob?.data.status).toBe('PENDING');

      // Tombstone must NOT be marked DELETED when recovery is pending; it remains PURGING
      const finalTombstones = tombstoneInserts.filter((t) => t.table === 'account_deletion_tombstones');
      const lastTombstone = finalTombstones[finalTombstones.length - 1];
      expect(lastTombstone?.data.status).toBe('PURGING');
    });

    it('persists durable STORAGE_PURGE recovery job with unresolved paths and keeps tombstone in PURGING', async () => {
      mockStorageService.purgeUserStorageAssets = vi.fn().mockResolvedValue({
        success: false,
        filesPurged: 1,
        errors: ['Storage bucket timeout: evidence'],
        unpurgedAssets: [{ bucket: 'evidence', path: 'clerk_alice_id/doc1.pdf' }],
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer alice-valid-token' },
        payload: {
          confirmation: 'DELETE MY ACCOUNT',
          password: 'CorrectPassword123!',
        },
      });

      expect(res.statusCode).toBe(200);

      // Local profile is still deleted cleanly
      const aliceProfileAfter = await profileService.getProfileByClerkId('clerk_alice_id');
      expect(aliceProfileAfter).toBeNull();

      // Verify a durable recovery job was persisted for storage
      const recoveryJobs = tombstoneInserts.filter((t) => t.table === 'account_deletion_recovery_jobs');
      const storageJob = recoveryJobs.find((j) => j.data.job_type === 'STORAGE_PURGE');
      expect(storageJob).toBeDefined();
      expect(storageJob?.data.status).toBe('PENDING');
      const payload = storageJob?.data.payload as { unpurgedAssets: Array<{ bucket: string; path: string }> };
      expect(payload.unpurgedAssets).toEqual([{ bucket: 'evidence', path: 'clerk_alice_id/doc1.pdf' }]);

      // Tombstone remains PURGING
      const finalTombstones = tombstoneInserts.filter((t) => t.table === 'account_deletion_tombstones');
      const lastTombstone = finalTombstones[finalTombstones.length - 1];
      expect(lastTombstone?.data.status).toBe('PURGING');
    });
  });

  describe('4. Webhook & Duplicate Deletion Idempotency', () => {
    it('handles webhook deletion idempotently when user profile was already deleted', async () => {
      const result = await deletionService.handleWebhookUserDeleted('non_existent_or_deleted_clerk_id');

      expect(result.success).toBe(true);
      expect(result.status).toBe('DELETED');
      expect(result.profileId).toBe('');
      expect(result.message).toContain('already deleted or does not exist');
    });
  });
});
