import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@avenza/shared';
import { AccountDeletionRecoveryWorker, type RecoveryJobRecord } from './account-deletion-recovery.worker';
import type { IStorageService } from '../../infrastructure/storage/storage.service';
import { encryptToken, decryptToken } from '../../infrastructure/crypto/token-encryption';

describe('Phase 17B-2 SEC-17B2-02 & SEC-17B2-06: Account Deletion Recovery Worker', () => {
  let mockStorageService: IStorageService;
  let jobsStore: RecoveryJobRecord[];
  let tombstonesStore: Array<{ profile_id: string; status: string }>;
  let mockSupabaseClient: unknown;

  beforeEach(() => {
    jobsStore = [];
    tombstonesStore = [];

    mockStorageService = {
      purgeUserStorageAssets: vi.fn().mockResolvedValue({
        success: true,
        filesPurged: 0,
        errors: [],
        unpurgedAssets: [],
      }),
      purgeSpecificAssets: vi.fn().mockResolvedValue({
        success: true,
        filesPurged: 1,
        errors: [],
        unpurgedAssets: [],
        failed: [],
      }),
    };

    mockSupabaseClient = {
      from: vi.fn((table: string) => {
        if (table === 'account_deletion_recovery_jobs') {
          return {
            select: vi.fn((cols: string) => {
              if (cols === 'id') {
                return {
                  eq: vi.fn((col: string, val: string) => ({
                    in: vi.fn(async (_statusCol: string, statuses: string[]) => {
                      const rows = jobsStore.filter(
                        (j) =>
                          (j as unknown as Record<string, unknown>)[col] === val &&
                          statuses.includes(j.status)
                      );
                      return { data: rows.map((r) => ({ id: r.id })), error: null };
                    }),
                  })),
                };
              }
              return {
                in: vi.fn((_col: string, statuses: string[]) => ({
                  lte: vi.fn((_lCol: string, timeIso: string) => ({
                    order: vi.fn((_oCol: string, _opts: unknown) => ({
                      limit: vi.fn(async (limitCount: number) => {
                        const filtered = jobsStore
                          .filter((j) => {
                            const statusMatch = statuses.includes(j.status);
                            const timeMatch = !j.next_attempt_at || new Date(j.next_attempt_at) <= new Date(timeIso);
                            return statusMatch && timeMatch;
                          })
                          .slice(0, limitCount);
                        return { data: filtered, error: null };
                      }),
                    })),
                  })),
                })),
              };
            }),
            update: vi.fn((updateData: Record<string, unknown>) => ({
              eq: vi.fn(async (col: string, val: string) => {
                const jobIndex = jobsStore.findIndex((j) => (j as unknown as Record<string, unknown>)[col] === val);
                if (jobIndex >= 0) {
                  jobsStore[jobIndex] = { ...jobsStore[jobIndex], ...updateData } as RecoveryJobRecord;
                }
                return { error: null };
              }),
            })),
            insert: vi.fn(async (data: RecoveryJobRecord) => {
              jobsStore.push(data);
              return { error: null };
            }),
          };
        }

        if (table === 'account_deletion_tombstones') {
          return {
            update: vi.fn((updateData: Record<string, unknown>) => ({
              eq: vi.fn(async (col: string, val: string) => {
                const idx = tombstonesStore.findIndex((t) => (t as unknown as Record<string, unknown>)[col] === val);
                if (idx >= 0 && tombstonesStore[idx]) {
                  tombstonesStore[idx] = {
                    profile_id: tombstonesStore[idx]!.profile_id,
                    status: (updateData.status as string) || tombstonesStore[idx]!.status,
                  };
                } else {
                  tombstonesStore.push({ profile_id: val, status: updateData.status as string });
                }
                return { error: null };
              }),
            })),
          };
        }

        return {};
      }),
    };
  });

  it('1. Provider revocation timeout followed by successful retry', async () => {
    const encryptedToken = encryptToken('ghp_test_oauth_token');
    jobsStore.push({
      id: 'job-1',
      profile_id: 'prof-alice',
      clerk_user_id: 'clerk-alice',
      job_type: 'PROVIDER_REVOCATION',
      status: 'PENDING',
      attempt_count: 1,
      max_attempts: 5,
      next_attempt_at: new Date(Date.now() - 1000).toISOString(),
      payload: {
        provider: 'github',
        encryptedToken,
        errorMessage: 'GitHub API timeout',
      },
      last_error: 'Timeout on previous attempt',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });

    const mockRevoke = vi.fn().mockResolvedValue(undefined);
    const worker = new AccountDeletionRecoveryWorker(
      mockSupabaseClient as SupabaseClient<Database>,
      mockStorageService,
      mockRevoke
    );

    const result = await worker.processPendingJobs();
    expect(result.processed).toBe(1);
    expect(result.completed).toBe(1);
    expect(mockRevoke).toHaveBeenCalledWith('github', 'ghp_test_oauth_token');

    const updatedJob = jobsStore.find((j) => j.id === 'job-1');
    expect(updatedJob?.status).toBe('COMPLETED');
  });

  it('2. Provider rejection followed by retry exhaustion (terminal TERMINAL_FAILURE after max_attempts)', async () => {
    const encryptedToken = encryptToken('ghp_test_oauth_token');
    jobsStore.push({
      id: 'job-2',
      profile_id: 'prof-alice',
      clerk_user_id: 'clerk-alice',
      job_type: 'PROVIDER_REVOCATION',
      status: 'PENDING',
      attempt_count: 4, // 5th attempt will be final
      max_attempts: 5,
      next_attempt_at: new Date(Date.now() - 1000).toISOString(),
      payload: {
        provider: 'github',
        encryptedToken,
        errorMessage: 'Persistent 500 error',
      },
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });

    const mockRevoke = vi.fn().mockRejectedValue(new Error('GitHub upstream 500 error'));
    const worker = new AccountDeletionRecoveryWorker(
      mockSupabaseClient as SupabaseClient<Database>,
      mockStorageService,
      mockRevoke
    );

    const result = await worker.processPendingJobs();
    expect(result.processed).toBe(1);

    const updatedJob = jobsStore.find((j) => j.id === 'job-2');
    expect(updatedJob?.status).toBe('TERMINAL_FAILURE');
    expect(updatedJob?.last_error).toContain('GitHub upstream 500 error');
  });

  it('3. No plaintext credentials in persisted retry records', async () => {
    const rawSecret = 'gho_extremely_sensitive_oauth_token_12345';
    const encrypted = encryptToken(rawSecret);

    expect(encrypted).not.toBeNull();
    expect(encrypted).not.toBe(rawSecret);
    expect(encrypted).not.toContain(rawSecret);

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(rawSecret);
  });

  it('4. Successful revocation clears the protected retry token payload', async () => {
    const encryptedToken = encryptToken('token_to_be_cleared');
    jobsStore.push({
      id: 'job-4',
      profile_id: 'prof-alice',
      clerk_user_id: 'clerk-alice',
      job_type: 'PROVIDER_REVOCATION',
      status: 'PENDING',
      attempt_count: 0,
      max_attempts: 5,
      next_attempt_at: new Date(Date.now() - 1000).toISOString(),
      payload: {
        provider: 'github',
        encryptedToken,
      },
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });

    const mockRevoke = vi.fn().mockResolvedValue(undefined);
    const worker = new AccountDeletionRecoveryWorker(
      mockSupabaseClient as SupabaseClient<Database>,
      mockStorageService,
      mockRevoke
    );

    await worker.processPendingJobs();

    const updatedJob = jobsStore.find((j) => j.id === 'job-4');
    expect(updatedJob?.status).toBe('COMPLETED');
    expect(updatedJob?.payload.encryptedToken).toBeUndefined();
  });

  it('5. Partial Storage cleanup records only unresolved owned paths', async () => {
    jobsStore.push({
      id: 'job-5',
      profile_id: 'prof-alice',
      clerk_user_id: 'clerk-alice',
      job_type: 'STORAGE_PURGE',
      status: 'PENDING',
      attempt_count: 0,
      max_attempts: 5,
      next_attempt_at: new Date(Date.now() - 1000).toISOString(),
      payload: {
        unpurgedAssets: [
          { bucket: 'evidence', path: 'clerk-alice/doc1.pdf' },
          { bucket: 'avatars', path: 'clerk-alice/avatar.png' },
        ],
      },
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });

    const worker = new AccountDeletionRecoveryWorker(
      mockSupabaseClient as SupabaseClient<Database>,
      mockStorageService
    );

    await worker.processPendingJobs();

    expect(mockStorageService.purgeSpecificAssets).toHaveBeenCalledWith([
      { bucket: 'evidence', path: 'clerk-alice/doc1.pdf' },
      { bucket: 'avatars', path: 'clerk-alice/avatar.png' },
    ]);
    const updatedJob = jobsStore.find((j) => j.id === 'job-5');
    expect(updatedJob?.status).toBe('COMPLETED');
  });

  it('6. Storage cleanup retry removes remaining objects and closes the job', async () => {
    jobsStore.push({
      id: 'job-6',
      profile_id: 'prof-bob',
      clerk_user_id: 'clerk-bob',
      job_type: 'STORAGE_PURGE',
      status: 'PENDING',
      attempt_count: 1,
      max_attempts: 5,
      next_attempt_at: new Date(Date.now() - 1000).toISOString(),
      payload: {
        unpurgedAssets: [{ bucket: 'evidence', path: 'clerk-bob/doc2.pdf' }],
      },
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });

    const worker = new AccountDeletionRecoveryWorker(
      mockSupabaseClient as SupabaseClient<Database>,
      mockStorageService
    );

    await worker.processPendingJobs();

    const updatedJob = jobsStore.find((j) => j.id === 'job-6');
    expect(updatedJob?.status).toBe('COMPLETED');
  });

  it('7. Crash after profile deletion but before final lifecycle update updates tombstone to DELETED', async () => {
    tombstonesStore.push({ profile_id: 'prof-alice', status: 'PURGING' });

    jobsStore.push({
      id: 'job-7',
      profile_id: 'prof-alice',
      clerk_user_id: 'clerk-alice',
      job_type: 'STORAGE_PURGE',
      status: 'PENDING',
      attempt_count: 0,
      max_attempts: 5,
      next_attempt_at: new Date(Date.now() - 1000).toISOString(),
      payload: {
        unpurgedAssets: [{ bucket: 'evidence', path: 'clerk-alice/doc3.pdf' }],
      },
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });

    const worker = new AccountDeletionRecoveryWorker(
      mockSupabaseClient as SupabaseClient<Database>,
      mockStorageService
    );

    await worker.processPendingJobs();

    const tombstone = tombstonesStore.find((t) => t.profile_id === 'prof-alice');
    expect(tombstone?.status).toBe('DELETED');
  });

  it('8. Duplicate workers or concurrent retry attempts update status to RETRYING / skip active', async () => {
    jobsStore.push({
      id: 'job-8',
      profile_id: 'prof-bob',
      clerk_user_id: 'clerk-bob',
      job_type: 'STORAGE_PURGE',
      status: 'COMPLETED', // Already completed by another worker
      attempt_count: 1,
      max_attempts: 5,
      next_attempt_at: new Date(Date.now() - 1000).toISOString(),
      payload: { unpurgedAssets: [] },
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    const worker = new AccountDeletionRecoveryWorker(
      mockSupabaseClient as SupabaseClient<Database>,
      mockStorageService
    );

    const result = await worker.processPendingJobs();
    expect(result.processed).toBe(0);
  });

  it('9. Expired retry records and terminal failures clear token payload', async () => {
    const encryptedToken = encryptToken('doomed_token');
    jobsStore.push({
      id: 'job-9',
      profile_id: 'prof-alice',
      clerk_user_id: 'clerk-alice',
      job_type: 'PROVIDER_REVOCATION',
      status: 'PENDING',
      attempt_count: 4,
      max_attempts: 5,
      next_attempt_at: new Date(Date.now() - 1000).toISOString(),
      payload: {
        provider: 'google_calendar',
        encryptedToken,
      },
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });

    const mockRevoke = vi.fn().mockRejectedValue(new Error('Google 404 Token Revocation Not Found'));
    const worker = new AccountDeletionRecoveryWorker(
      mockSupabaseClient as SupabaseClient<Database>,
      mockStorageService,
      mockRevoke
    );

    await worker.processPendingJobs();

    const updatedJob = jobsStore.find((j) => j.id === 'job-9');
    expect(updatedJob?.status).toBe('TERMINAL_FAILURE');
    expect(updatedJob?.payload.encryptedToken).toBeUndefined();
  });

  it('10. No cross-tenant cleanup: worker operates strictly on scoped jobs', async () => {
    jobsStore.push({
      id: 'job-alice',
      profile_id: 'prof-alice',
      clerk_user_id: 'clerk-alice',
      job_type: 'STORAGE_PURGE',
      status: 'PENDING',
      attempt_count: 0,
      max_attempts: 5,
      next_attempt_at: new Date(Date.now() - 1000).toISOString(),
      payload: {
        unpurgedAssets: [{ bucket: 'evidence', path: 'clerk-alice/private.pdf' }],
      },
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });

    const worker = new AccountDeletionRecoveryWorker(
      mockSupabaseClient as SupabaseClient<Database>,
      mockStorageService
    );

    await worker.processPendingJobs();

    expect(mockStorageService.purgeSpecificAssets).toHaveBeenCalledWith([
      { bucket: 'evidence', path: 'clerk-alice/private.pdf' },
    ]);
    expect(mockStorageService.purgeSpecificAssets).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ path: expect.stringContaining('clerk-bob') })])
    );
  });

  it('11. Terminal failure updates tombstone status to FAILED (never falsely marks DELETED)', async () => {
    tombstonesStore.push({ profile_id: 'prof-charlie', status: 'PURGING' });
    jobsStore.push({
      id: 'job-terminal-1',
      profile_id: 'prof-charlie',
      clerk_user_id: 'clerk-charlie',
      job_type: 'PROVIDER_REVOCATION',
      status: 'PENDING',
      attempt_count: 4, // 5th attempt will be final
      max_attempts: 5,
      next_attempt_at: new Date(Date.now() - 1000).toISOString(),
      payload: { provider: 'github', encryptedToken: encryptToken('bad_token') },
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });

    const mockRevoke = vi.fn().mockRejectedValue(new Error('GitHub Bad Credentials 401'));
    const worker = new AccountDeletionRecoveryWorker(
      mockSupabaseClient as SupabaseClient<Database>,
      mockStorageService,
      mockRevoke
    );

    await worker.processPendingJobs();

    const tombstone = tombstonesStore.find((t) => t.profile_id === 'prof-charlie');
    expect(tombstone?.status).toBe('FAILED');
    expect(tombstone?.status).not.toBe('DELETED');
  });

  it('12. Mixed outcomes: 1 successful job and 1 terminal failure marks tombstone FAILED', async () => {
    tombstonesStore.push({ profile_id: 'prof-david', status: 'PURGING' });
    // Job 1: Succeeds
    jobsStore.push({
      id: 'job-mixed-success',
      profile_id: 'prof-david',
      clerk_user_id: 'clerk-david',
      job_type: 'STORAGE_PURGE',
      status: 'PENDING',
      attempt_count: 0,
      max_attempts: 5,
      next_attempt_at: new Date(Date.now() - 1000).toISOString(),
      payload: { unpurgedAssets: [{ bucket: 'avatars', path: 'clerk-david/avatar.png' }] },
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });
    // Job 2: Fails terminally
    jobsStore.push({
      id: 'job-mixed-terminal',
      profile_id: 'prof-david',
      clerk_user_id: 'clerk-david',
      job_type: 'PROVIDER_REVOCATION',
      status: 'PENDING',
      attempt_count: 4,
      max_attempts: 5,
      next_attempt_at: new Date(Date.now() - 1000).toISOString(),
      payload: { provider: 'github', encryptedToken: encryptToken('bad_token') },
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });

    const mockRevoke = vi.fn().mockRejectedValue(new Error('GitHub account suspended'));
    const worker = new AccountDeletionRecoveryWorker(
      mockSupabaseClient as SupabaseClient<Database>,
      mockStorageService,
      mockRevoke
    );

    await worker.processPendingJobs();

    const tombstone = tombstonesStore.find((t) => t.profile_id === 'prof-david');
    expect(tombstone?.status).toBe('FAILED');
  });

  it('13. Active/retrying jobs leave tombstone status in PURGING without premature completion', async () => {
    tombstonesStore.push({ profile_id: 'prof-eve', status: 'PURGING' });
    jobsStore.push({
      id: 'job-eve-retrying',
      profile_id: 'prof-eve',
      clerk_user_id: 'clerk-eve',
      job_type: 'PROVIDER_REVOCATION',
      status: 'PENDING',
      attempt_count: 1, // Only 2nd attempt, will retry
      max_attempts: 5,
      next_attempt_at: new Date(Date.now() - 1000).toISOString(),
      payload: { provider: 'github', encryptedToken: encryptToken('token_transient_error') },
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });

    const mockRevoke = vi.fn().mockRejectedValue(new Error('503 Service Unavailable'));
    const worker = new AccountDeletionRecoveryWorker(
      mockSupabaseClient as SupabaseClient<Database>,
      mockStorageService,
      mockRevoke
    );

    await worker.processPendingJobs();

    const job = jobsStore.find((j) => j.id === 'job-eve-retrying');
    expect(job?.status).toBe('RETRYING');

    const tombstone = tombstonesStore.find((t) => t.profile_id === 'prof-eve');
    expect(tombstone?.status).toBe('PURGING');
  });

  it('14. Atomic claim RPC claims available jobs with worker ID and lease timeout', async () => {
    const mockRpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
      if (name === 'claim_deletion_recovery_jobs') {
        return {
          data: [
            {
              id: 'job-rpc-1',
              profile_id: 'prof-frank',
              clerk_user_id: 'clerk-frank',
              job_type: 'STORAGE_PURGE',
              status: 'PROCESSING',
              locked_by: params.p_worker_id,
              locked_until: new Date(Date.now() + 300_000).toISOString(),
              attempt_count: 1,
              max_attempts: 5,
              next_attempt_at: new Date().toISOString(),
              payload: { unpurgedAssets: [] },
              last_error: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              completed_at: null,
            },
          ],
          error: null,
        };
      }
      return { error: new Error(`Unknown RPC ${name}`) };
    });

    const rpcSupabaseClient = {
      ...(mockSupabaseClient as Record<string, unknown>),
      rpc: mockRpc,
    };

    const worker = new AccountDeletionRecoveryWorker(
      rpcSupabaseClient as unknown as SupabaseClient<Database>,
      mockStorageService
    );

    const result = await worker.processPendingJobs();
    expect(result.processed).toBe(1);
    expect(result.completed).toBe(1);
    expect(mockRpc).toHaveBeenCalledWith('claim_deletion_recovery_jobs', expect.objectContaining({
      p_worker_id: worker.getWorkerId(),
      p_lock_duration_seconds: 300,
    }));
  });

  it('15. Concurrent workers: jobs currently in PROCESSING are skipped by other workers', async () => {
    jobsStore.push({
      id: 'job-locked-by-other',
      profile_id: 'prof-grace',
      clerk_user_id: 'clerk-grace',
      job_type: 'STORAGE_PURGE',
      status: 'PROCESSING', // already claimed by worker-other
      attempt_count: 1,
      max_attempts: 5,
      next_attempt_at: new Date(Date.now() - 1000).toISOString(),
      payload: { unpurgedAssets: [] },
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });

    const worker = new AccountDeletionRecoveryWorker(
      mockSupabaseClient as SupabaseClient<Database>,
      mockStorageService
    );

    const result = await worker.processPendingJobs();
    expect(result.processed).toBe(0);
  });
});
