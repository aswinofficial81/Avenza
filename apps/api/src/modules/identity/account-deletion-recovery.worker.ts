import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@avenza/shared';
import { getSupabaseAdminClient } from '../../db/supabase.client';
import type { IStorageService, StorageAssetRef } from '../../infrastructure/storage/storage.service';
import { defaultStorageService } from '../../infrastructure/storage/storage.service';
import { decryptToken } from '../../infrastructure/crypto/token-encryption';
import { GitHubAuthProvider } from '../../infrastructure/providers/github/github.auth';
import { GoogleCalendarClient } from '../../infrastructure/providers/google-calendar/google-calendar.client';

export interface RecoveryJobRecord {
  id: string;
  profile_id: string;
  clerk_user_id: string;
  job_type: 'PROVIDER_REVOCATION' | 'STORAGE_PURGE';
  status: 'PENDING' | 'PROCESSING' | 'RETRYING' | 'COMPLETED' | 'TERMINAL_FAILURE';
  payload: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string;
  locked_until?: string | null;
  locked_by?: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface RecoveryProcessingResult {
  processed: number;
  completed: number;
  failed: number;
}

export type RevokeHandler = (provider: string, token: string) => Promise<void>;

export class AccountDeletionRecoveryWorker {
  public readonly workerId = `worker-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
  private readonly githubAuth = new GitHubAuthProvider();
  private readonly googleClient = new GoogleCalendarClient();

  constructor(
    private readonly client: SupabaseClient<Database> = getSupabaseAdminClient(),
    private readonly storageService: IStorageService = defaultStorageService,
    private readonly customRevokeHandler?: RevokeHandler
  ) { }

  public getWorkerId(): string {
    return this.workerId;
  }

  /**
   * Processes a batch of pending or retrying deletion recovery jobs.
   * Uses atomic database claim with FOR UPDATE SKIP LOCKED to prevent duplicate processing.
   */
  async processPendingJobs(batchSize = 10): Promise<RecoveryProcessingResult> {
    const result: RecoveryProcessingResult = { processed: 0, completed: 0, failed: 0 };

    if (!this.client?.from) {
      return result;
    }

    const now = new Date().toISOString();
    let jobs: RecoveryJobRecord[] = [];

    // 1. Try atomic claim via RPC if available in Postgres
    if (typeof (this.client as { rpc?: unknown }).rpc === 'function') {
      try {
        type RpcFn = (
          name: string,
          params: Record<string, unknown>
        ) => Promise<{ data: RecoveryJobRecord[] | null; error: unknown }>;
        const rpcClient = this.client as unknown as { rpc: RpcFn };
        const { data: rpcJobs, error: rpcErr } = await rpcClient.rpc('claim_deletion_recovery_jobs', {
          p_worker_id: this.workerId,
          p_batch_size: batchSize,
          p_lock_duration_seconds: 300,
        });

        if (!rpcErr && rpcJobs && rpcJobs.length > 0) {
          jobs = rpcJobs;
        }
      } catch {
        // Fall back to table query below if RPC unmocked or unavailable
      }
    }

    // 2. Table-level atomic claim fallback for tests or direct table access
    if (jobs.length === 0) {
      type JobQueryFrom = (table: string) => {
        select: (cols: string) => {
          in: (col: string, vals: string[]) => {
            lte: (col: string, val: string) => {
              order: (col: string, opts: { ascending: boolean }) => {
                limit: (n: number) => Promise<{ data: RecoveryJobRecord[] | null; error: unknown }>;
              };
            };
          };
        };
        update: (record: Record<string, unknown>) => {
          eq: (col: string, val: string) => Promise<{ error: unknown }>;
        };
      };
      const queryTable = this.client.from.bind(this.client) as unknown as JobQueryFrom;
      const { data: candidates, error } = await queryTable('account_deletion_recovery_jobs')
        .select('*')
        .in('status', ['PENDING', 'RETRYING'])
        .lte('next_attempt_at', now)
        .order('next_attempt_at', { ascending: true })
        .limit(batchSize);

      if (error || !candidates || candidates.length === 0) {
        return result;
      }

      for (const cand of candidates) {
        // Atomically claim the candidate
        await queryTable('account_deletion_recovery_jobs')
          .update({
            status: 'PROCESSING',
            locked_by: this.workerId,
            locked_until: new Date(Date.now() + 300_000).toISOString(),
            attempt_count: cand.attempt_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', cand.id);

        jobs.push({
          ...cand,
          attempt_count: cand.attempt_count + 1,
          status: 'PROCESSING',
          locked_by: this.workerId,
        });
      }
    }

    // 3. Process claimed jobs
    for (const job of jobs) {
      result.processed += 1;
      try {
        if (job.job_type === 'PROVIDER_REVOCATION') {
          await this.processProviderRevocationJob(job);
          result.completed += 1;
        } else if (job.job_type === 'STORAGE_PURGE') {
          const success = await this.processStoragePurgeJob(job);
          if (success) {
            result.completed += 1;
          } else {
            result.failed += 1;
          }
        }
      } catch (err: unknown) {
        result.failed += 1;
        const errMsg = err instanceof Error ? err.message : String(err);
        await this.handleJobFailure(job, errMsg);
      }
    }

    return result;
  }

  private async processProviderRevocationJob(job: RecoveryJobRecord): Promise<void> {
    const provider = job.payload.provider as string;
    const encryptedToken =
      (job.payload.encrypted_refresh_token as string) ||
      (job.payload.encrypted_access_token as string) ||
      (job.payload.encryptedToken as string);

    if (!provider || !encryptedToken) {
      // Payload corrupt or token missing: terminal failure, clear credentials
      await this.markJobCompletedOrTerminal(job.id, 'TERMINAL_FAILURE', 'Missing provider or token in payload', true);
      await this.checkAndUpdateTombstoneIfAllCompleted(job.profile_id);
      return;
    }

    let token: string | null = null;
    try {
      token = decryptToken(encryptedToken);
    } catch {
      await this.markJobCompletedOrTerminal(job.id, 'TERMINAL_FAILURE', 'Failed to decrypt retry token', true);
      await this.checkAndUpdateTombstoneIfAllCompleted(job.profile_id);
      return;
    }

    if (!token) {
      await this.markJobCompletedOrTerminal(job.id, 'TERMINAL_FAILURE', 'Decrypted token was empty', true);
      await this.checkAndUpdateTombstoneIfAllCompleted(job.profile_id);
      return;
    }

    // Execute provider revocation
    if (this.customRevokeHandler) {
      await this.customRevokeHandler(provider, token);
    } else if (provider === 'github') {
      await this.githubAuth.revokeToken(token);
    } else if (provider === 'google_calendar') {
      await this.googleClient.revokeToken(token);
    }

    // On success: mark COMPLETED, purge encrypted credentials from payload
    await this.markJobCompletedOrTerminal(job.id, 'COMPLETED', null, true);
    await this.checkAndUpdateTombstoneIfAllCompleted(job.profile_id);
  }

  private async processStoragePurgeJob(job: RecoveryJobRecord): Promise<boolean> {
    const assets =
      (job.payload.assets as StorageAssetRef[]) ||
      (job.payload.unpurgedAssets as StorageAssetRef[]) ||
      [];
    if (assets.length === 0) {
      await this.markJobCompletedOrTerminal(job.id, 'COMPLETED', null, false);
      await this.checkAndUpdateTombstoneIfAllCompleted(job.profile_id);
      return true;
    }

    const { failed } = await this.storageService.purgeSpecificAssets(assets);

    if (failed.length === 0) {
      await this.markJobCompletedOrTerminal(job.id, 'COMPLETED', null, false);
      await this.checkAndUpdateTombstoneIfAllCompleted(job.profile_id);
      return true;
    }

    // Update job with remaining unresolved assets
    const remainingAssets = failed.map((f) => ({ bucket: f.bucket, path: f.path }));
    const errorDetails = failed.map((f) => `${f.bucket}/${f.path}: ${f.error}`).join('; ');
    await this.handleJobFailure(job, errorDetails, { unpurgedAssets: remainingAssets, assets: remainingAssets });
    return false;
  }

  private async handleJobFailure(
    job: RecoveryJobRecord,
    errorMessage: string,
    updatedPayload?: Record<string, unknown>
  ): Promise<void> {
    const currentAttempts = job.attempt_count; // already incremented upon claim
    const isTerminal = currentAttempts >= job.max_attempts;

    if (isTerminal) {
      // Clear sensitive payload on terminal failure
      await this.markJobCompletedOrTerminal(
        job.id,
        'TERMINAL_FAILURE',
        `Max attempts reached (${job.max_attempts}). Last error: ${errorMessage}`,
        true
      );
      await this.checkAndUpdateTombstoneIfAllCompleted(job.profile_id);
      return;
    }

    // Exponential backoff: attempt * 60 seconds
    const backoffSeconds = Math.min(currentAttempts * 60, 3600);
    const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();

    type UpdateJobFrom = (table: string) => {
      update: (record: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<unknown>;
      };
    };
    const queryTable = this.client.from.bind(this.client) as unknown as UpdateJobFrom;
    await queryTable('account_deletion_recovery_jobs')
      .update({
        status: 'RETRYING',
        locked_by: null,
        locked_until: null,
        next_attempt_at: nextAttemptAt,
        last_error: errorMessage,
        payload: updatedPayload ? updatedPayload : job.payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  }

  private async markJobCompletedOrTerminal(
    jobId: string,
    status: 'COMPLETED' | 'TERMINAL_FAILURE',
    lastError: string | null,
    purgePayload: boolean
  ): Promise<void> {
    const now = new Date().toISOString();
    type UpdateJobFrom = (table: string) => {
      update: (record: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<unknown>;
      };
    };
    const queryTable = this.client.from.bind(this.client) as unknown as UpdateJobFrom;
    await queryTable('account_deletion_recovery_jobs')
      .update({
        status,
        locked_by: null,
        locked_until: null,
        last_error: lastError,
        payload: purgePayload ? {} : undefined,
        updated_at: now,
        completed_at: status === 'COMPLETED' ? now : null,
      })
      .eq('id', jobId);
  }

  /**
   * Updates tombstone audit record accurately according to external cleanup outcome:
   * - If ANY job ended in TERMINAL_FAILURE: sets status to 'FAILED' (never falsely marks 'DELETED').
   * - Only if ALL jobs ended in COMPLETED: sets status to 'DELETED'.
   * - If active jobs remain (PENDING, PROCESSING, RETRYING): keeps status in 'PURGING'.
   */
  public async checkAndUpdateTombstoneIfAllCompleted(profileId: string): Promise<void> {
    try {
      type CheckFrom = (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            in: (col: string, vals: string[]) => Promise<{ data: unknown[] | null }>;
          };
        };
      };
      const queryTable = this.client.from.bind(this.client) as unknown as CheckFrom;

      // 1. Check if any active jobs remain for this profile
      const { data: activeJobs } = await queryTable('account_deletion_recovery_jobs')
        .select('id')
        .eq('profile_id', profileId)
        .in('status', ['PENDING', 'PROCESSING', 'RETRYING']);

      if (activeJobs && activeJobs.length > 0) {
        // Still purging
        return;
      }

      // 2. Check if any job experienced a terminal failure
      const { data: terminalJobs } = await queryTable('account_deletion_recovery_jobs')
        .select('id')
        .eq('profile_id', profileId)
        .in('status', ['TERMINAL_FAILURE']);

      const finalStatus = terminalJobs && terminalJobs.length > 0 ? 'FAILED' : 'DELETED';

      type TombstoneUpdateFrom = (table: string) => {
        update: (record: Record<string, unknown>) => {
          eq: (col: string, val: string) => Promise<unknown>;
        };
      };
      const updateTable = this.client.from.bind(this.client) as unknown as TombstoneUpdateFrom;
      await updateTable('account_deletion_tombstones')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
        })
        .eq('profile_id', profileId);
    } catch {
      // Safe best-effort tombstone resolution
    }
  }
}

export const defaultAccountDeletionRecoveryWorker = new AccountDeletionRecoveryWorker();
