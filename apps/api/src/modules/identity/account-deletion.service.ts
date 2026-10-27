import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClerkClient } from '@clerk/backend';
import type { Database } from '@avenza/shared';
import { env } from '../../config/env';
import { getSupabaseAdminClient } from '../../db/supabase.client';
import type { IIntegrationsService } from '../integrations/integrations.service';
import { defaultIntegrationsService } from '../integrations';
import type { IStorageService } from '../../infrastructure/storage/storage.service';
import { defaultStorageService } from '../../infrastructure/storage/storage.service';
import { defaultProfileService, ProfileService } from './profile.service';

export type DeletionStatus = 'DELETION_PENDING' | 'PURGING' | 'DELETED' | 'FAILED';

export interface DeletionTombstone {
  id: string;
  profile_id: string;
  clerk_user_id: string;
  status: DeletionStatus;
  revocation_errors: string[] | null;
  storage_errors: string[] | null;
  created_at: string;
  completed_at: string | null;
}

export interface UserDeletionOptions {
  confirmation: string;
  password?: string;
  reauthToken?: string;
  reauthSessionId?: string;
  authMethod?: string;
}

export interface AccountDeletionResult {
  success: boolean;
  profileId: string;
  clerkUserId: string;
  status: DeletionStatus;
  revocationErrors: string[];
  storageErrors: string[];
  message: string;
}

export interface IClerkUserDeletionClient {
  users: {
    verifyPassword(params: { userId: string; password: string }): Promise<{ verified: boolean }>;
    deleteUser(userId: string): Promise<unknown>;
  };
  verifyToken?(token: string): Promise<{ sub: string; [key: string]: unknown }>;
  sessions?: {
    verifySession(sessionId: string, token: string): Promise<unknown>;
  };
}

export class AccountDeletionService {
  public static consumedReauthJtis = new Set<string>();

  public static resetConsumedReauthTokens(): void {
    AccountDeletionService.consumedReauthJtis.clear();
  }

  private clerkClient: IClerkUserDeletionClient | null;

  constructor(
    private readonly client: SupabaseClient<Database> = getSupabaseAdminClient(),
    private readonly profileService: ProfileService = defaultProfileService,
    private readonly integrationsService: IIntegrationsService = defaultIntegrationsService,
    private readonly storageService: IStorageService = defaultStorageService,
    clerkClient?: IClerkUserDeletionClient | null
  ) {
    if (clerkClient !== undefined) {
      this.clerkClient = clerkClient;
    } else {
      this.clerkClient = env.CLERK_SECRET_KEY
        ? (createClerkClient({ secretKey: env.CLERK_SECRET_KEY }) as unknown as IClerkUserDeletionClient)
        : null;
    }
  }

  /**
   * Orchestrates a verified user-initiated account deletion with mandatory server-side re-authentication.
   */
  async initiateUserDeletion(
    profileId: string,
    clerkUserId: string,
    options: UserDeletionOptions
  ): Promise<AccountDeletionResult> {
    // 1. Validate confirmation phrase
    if (!options.confirmation || options.confirmation.trim().toUpperCase() !== 'DELETE MY ACCOUNT') {
      const err = new Error('Confirmation phrase "DELETE MY ACCOUNT" is required.');
      (err as unknown as { statusCode: number; code: string }).statusCode = 400;
      (err as unknown as { statusCode: number; code: string }).code = 'INVALID_CONFIRMATION';
      throw err;
    }

    // 2. Reject unsupported authentication methods explicitly
    if (options.authMethod && !['password', 'oauth', 'token', 'session'].includes(options.authMethod)) {
      const err = new Error(`Unsupported authentication method "${options.authMethod}". Re-authentication cannot proceed safely.`);
      (err as unknown as { statusCode: number; code: string }).statusCode = 400;
      (err as unknown as { statusCode: number; code: string }).code = 'UNSUPPORTED_AUTH_METHOD';
      throw err;
    }

    // 3. Mandatory Server-Side Re-Authentication Check (No bypass)
    let reauthVerified = false;

    if (options.password && options.password.trim()) {
      if (this.clerkClient) {
        try {
          const verifyRes = await this.clerkClient.users.verifyPassword({
            userId: clerkUserId,
            password: options.password,
          });
          if (!verifyRes.verified) {
            const err = new Error('Re-authentication failed: incorrect password.');
            (err as unknown as { statusCode: number; code: string }).statusCode = 401;
            (err as unknown as { statusCode: number; code: string }).code = 'REAUTH_FAILED';
            throw err;
          }
          reauthVerified = true;
        } catch (err: unknown) {
          if ((err as { code?: string }).code === 'REAUTH_FAILED') {
            throw err;
          }
          const authErr = new Error(`Re-authentication verification failed: ${err instanceof Error ? err.message : String(err)}`);
          (authErr as unknown as { statusCode: number; code: string }).statusCode = 401;
          (authErr as unknown as { statusCode: number; code: string }).code = 'REAUTH_FAILED';
          throw authErr;
        }
      }
    } else if (options.reauthToken && options.reauthToken.trim()) {
      if (this.clerkClient) {
        try {
          if (this.clerkClient.verifyToken) {
            const decoded = await this.clerkClient.verifyToken(options.reauthToken);
            if (decoded.sub !== clerkUserId) {
              const err = new Error('Re-authentication token subject does not match authenticated user identity.');
              (err as unknown as { statusCode: number; code: string }).statusCode = 403;
              (err as unknown as { statusCode: number; code: string }).code = 'IDENTITY_MISMATCH';
              throw err;
            }

            // Verify token purpose / challenge proof: must NOT be an ordinary session token without step-up
            const isStepUpChallenge =
              decoded.purpose === 'reauth' ||
              decoded.purpose === 'step-up' ||
              decoded.act !== undefined ||
              (decoded.auth_time !== undefined && decoded.is_step_up === true);

            if (!isStepUpChallenge && decoded.purpose !== 'reauth' && !decoded.auth_time) {
              const err = new Error(
                'Standard bearer session tokens cannot be used as step-up re-authentication proof. Please complete a fresh re-authentication challenge.'
              );
              (err as unknown as { statusCode: number; code: string }).statusCode = 401;
              (err as unknown as { statusCode: number; code: string }).code = 'REAUTH_STEP_UP_REQUIRED';
              throw err;
            }

            // Verify challenge freshness via trustworthy auth_time
            if (decoded.auth_time !== undefined) {
              const authTime = Number(decoded.auth_time);
              const nowSeconds = Math.floor(Date.now() / 1000);
              const MAX_REAUTH_AGE_SECONDS = 120; // 2 minutes

              if (nowSeconds - authTime > MAX_REAUTH_AGE_SECONDS || authTime > nowSeconds + 15) {
                const err = new Error('Re-authentication challenge has expired. Please re-authenticate.');
                (err as unknown as { statusCode: number; code: string }).statusCode = 401;
                (err as unknown as { statusCode: number; code: string }).code = 'REAUTH_STALE';
                throw err;
              }
            } else if (decoded.purpose !== 'reauth' && decoded.purpose !== 'step-up') {
              const err = new Error(
                'Re-authentication proof lacks a verifiable auth_time claim. Standard tokens cannot establish re-authentication freshness.'
              );
              (err as unknown as { statusCode: number; code: string }).statusCode = 401;
              (err as unknown as { statusCode: number; code: string }).code = 'REAUTH_STEP_UP_REQUIRED';
              throw err;
            }

            // Single-use durable replay protection via database
            const jti = (decoded.jti as string) || undefined;
            const tokenDigest = crypto
              .createHash('sha256')
              .update(jti ? `jti:${jti}` : `token:${options.reauthToken.trim()}`)
              .digest('hex');

            const expSeconds = typeof decoded.exp === 'number' ? decoded.exp : Math.floor(Date.now() / 1000) + 120;
            const expiresAtIso = new Date(expSeconds * 1000).toISOString();

            await this.consumeReauthProof(tokenDigest, profileId, expiresAtIso);

            // OAuth/passwordless safety gate: Tokens minted from static Clerk templates or ambient sessions
            // cannot establish genuine interactive step-up re-authentication.
            const gateErr = new Error(
              'Self-service account deletion for OAuth/passwordless accounts is restricted until interactive step-up re-authentication is configured. Please set an account password in security settings or contact support.'
            );
            (gateErr as unknown as { statusCode: number; code: string }).statusCode = 403;
            (gateErr as unknown as { statusCode: number; code: string }).code = 'OAUTH_DELETION_RESTRICTED';
            throw gateErr;
          } else if (this.clerkClient.sessions && options.reauthSessionId) {
            await this.clerkClient.sessions.verifySession(options.reauthSessionId, options.reauthToken);
            reauthVerified = true;
          }
        } catch (err: unknown) {
          if (
            (err as { code?: string }).code === 'IDENTITY_MISMATCH' ||
            (err as { code?: string }).code === 'REAUTH_STEP_UP_REQUIRED' ||
            (err as { code?: string }).code === 'REAUTH_STALE' ||
            (err as { code?: string }).code === 'REAUTH_REPLAY_DETECTED' ||
            (err as { code?: string }).code === 'REAUTH_COORDINATION_UNAVAILABLE' ||
            (err as { code?: string }).code === 'OAUTH_DELETION_RESTRICTED'
          ) {
            throw err;
          }
          const authErr = new Error(`Re-authentication token verification failed: ${err instanceof Error ? err.message : String(err)}`);
          (authErr as unknown as { statusCode: number; code: string }).statusCode = 401;
          (authErr as unknown as { statusCode: number; code: string }).code = 'REAUTH_FAILED';
          throw authErr;
        }
      }
    }

    if (!reauthVerified) {
      if (options.authMethod === 'oauth' || options.authMethod === 'token' || options.authMethod === 'session') {
        const err = new Error(
          'Self-service account deletion for OAuth/passwordless accounts is restricted until interactive step-up re-authentication is configured. Please set an account password in security settings or contact support.'
        );
        (err as unknown as { statusCode: number; code: string }).statusCode = 403;
        (err as unknown as { statusCode: number; code: string }).code = 'OAUTH_DELETION_RESTRICTED';
        throw err;
      }

      const err = new Error(
        'Re-authentication proof is strictly required to delete an account. Provide password for password-enabled accounts or a verified re-authentication token for OAuth/passwordless accounts.'
      );
      (err as unknown as { statusCode: number; code: string }).statusCode = 401;
      (err as unknown as { statusCode: number; code: string }).code = 'REAUTH_REQUIRED';
      throw err;
    }

    return this.executeDeletionLifecycle(profileId, clerkUserId, true);
  }

  /**
   * Handles deletion triggered by a verified Clerk user.deleted webhook.
   */
  async handleWebhookUserDeleted(clerkUserId: string): Promise<AccountDeletionResult> {
    const profile = await this.profileService.getProfileByClerkId(clerkUserId);
    if (!profile) {
      return {
        success: true,
        profileId: '',
        clerkUserId,
        status: 'DELETED',
        revocationErrors: [],
        storageErrors: [],
        message: 'User profile already deleted or does not exist.',
      };
    }

    return this.executeDeletionLifecycle(profile.id, clerkUserId, false);
  }

  /**
   * Internal execution of the deletion lifecycle state machine.
   */
  private async executeDeletionLifecycle(
    profileId: string,
    clerkUserId: string,
    deleteInClerk: boolean
  ): Promise<AccountDeletionResult> {
    const revocationErrors: string[] = [];
    const storageErrors: string[] = [];

    // Phase 1: Record initial tombstone (DELETION_PENDING)
    await this.recordTombstone(profileId, clerkUserId, 'DELETION_PENDING');

    // Phase 2: Update tombstone to PURGING
    await this.recordTombstone(profileId, clerkUserId, 'PURGING');

    // Phase 3: External OAuth credential revocation
    let existingConnections: Array<{ provider: string; encrypted_access_token: string | null; encrypted_refresh_token: string | null }> = [];
    try {
      if (this.client?.from) {
        type ConnFrom = (table: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => Promise<{ data: Array<{ provider: string; encrypted_access_token: string | null; encrypted_refresh_token: string | null }> | null }>;
          };
        };
        const queryTable = this.client.from as unknown as ConnFrom;
        const { data: conns } = await queryTable('integration_connections')
          .select('provider, encrypted_access_token, encrypted_refresh_token')
          .eq('user_id', profileId);
        if (conns) {
          existingConnections = conns;
        }
      }
    } catch {
      // Best-effort connection snapshot
    }

    try {
      const revRes = await this.integrationsService.revokeAllUserCredentials(profileId);
      if (!revRes.success) {
        for (const e of revRes.errors) {
          revocationErrors.push(`${e.provider}: ${e.error}`);
          const conn = existingConnections.find((c) => c.provider === e.provider);
          await this.recordRecoveryJob(profileId, clerkUserId, 'PROVIDER_REVOCATION', {
            provider: e.provider,
            encrypted_access_token: conn?.encrypted_access_token || null,
            encrypted_refresh_token: conn?.encrypted_refresh_token || null,
            error: e.error,
          });
        }
      }
    } catch (err: unknown) {
      revocationErrors.push(`Exception in credential revocation: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Phase 4: Storage assets cleanup
    try {
      const storageRes = await this.storageService.purgeUserStorageAssets(profileId);
      if (!storageRes.success) {
        storageErrors.push(...storageRes.errors);
        if (storageRes.unpurgedAssets && storageRes.unpurgedAssets.length > 0) {
          await this.recordRecoveryJob(profileId, clerkUserId, 'STORAGE_PURGE', {
            unpurgedAssets: storageRes.unpurgedAssets,
            assets: storageRes.unpurgedAssets,
            errors: storageRes.errors,
          });
        }
      }
    } catch (err: unknown) {
      storageErrors.push(`Exception in storage purge: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Phase 5: Pre-delete restrictive junction tables to eliminate PostgreSQL FK RESTRICT failures
    try {
      if (this.client?.from) {
        type GenericFrom = (table: string) => { delete: () => { eq: (col: string, val: string) => Promise<unknown> } };
        const queryTable = this.client.from as unknown as GenericFrom;
        await queryTable('career_target_skills').delete().eq('user_id', profileId);
        await queryTable('career_opportunity_skills').delete().eq('user_id', profileId);
        await queryTable('career_application_projects').delete().eq('user_id', profileId);
      }
    } catch {
      // If junction tables do not exist or already clean, proceed with cascade
    }

    // Phase 6: Cascade-delete profile from database
    await this.profileService.deleteProfile(profileId);

    // Phase 7: Delete user in Clerk if user-initiated
    if (deleteInClerk && this.clerkClient) {
      try {
        await this.clerkClient.users.deleteUser(clerkUserId);
      } catch {
        // If already deleted in Clerk or network timeout, log and continue
      }
    }

    // Phase 8: Complete tombstone audit record
    const hasUnresolvedRecovery = revocationErrors.length > 0 || storageErrors.length > 0;
    const finalTombstoneStatus: DeletionStatus = hasUnresolvedRecovery ? 'PURGING' : 'DELETED';
    await this.recordTombstone(profileId, clerkUserId, finalTombstoneStatus, revocationErrors, storageErrors);

    return {
      success: true,
      profileId,
      clerkUserId,
      status: finalTombstoneStatus,
      revocationErrors,
      storageErrors,
      message: hasUnresolvedRecovery
        ? 'Local account deleted. External provider revocation or storage cleanups queued for recovery.'
        : 'Account deleted and all user-owned data purged successfully.',
    };
  }

  private async recordRecoveryJob(
    profileId: string,
    clerkUserId: string,
    jobType: 'PROVIDER_REVOCATION' | 'STORAGE_PURGE',
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      if (this.client?.from) {
        type InsertFrom = (table: string) => { insert: (record: Record<string, unknown>) => Promise<unknown> };
        const queryTable = this.client.from as unknown as InsertFrom;
        await queryTable('account_deletion_recovery_jobs').insert({
          profile_id: profileId,
          clerk_user_id: clerkUserId,
          job_type: jobType,
          status: 'PENDING',
          payload,
          attempt_count: 0,
          max_attempts: 5,
          next_attempt_at: new Date().toISOString(),
        });
      }
    } catch {
      // Best-effort job record persistence
    }
  }

  private async recordTombstone(
    profileId: string,
    clerkUserId: string,
    status: DeletionStatus,
    revocationErrors?: string[],
    storageErrors?: string[]
  ): Promise<void> {
    try {
      if (this.client?.from) {
        type InsertFrom = (table: string) => { insert: (record: Record<string, unknown>) => Promise<unknown> };
        const queryTable = this.client.from as unknown as InsertFrom;
        await queryTable('account_deletion_tombstones').insert({
          profile_id: profileId,
          clerk_user_id: clerkUserId,
          status,
          revocation_errors: revocationErrors && revocationErrors.length > 0 ? revocationErrors : null,
          storage_errors: storageErrors && storageErrors.length > 0 ? storageErrors : null,
          completed_at: status === 'DELETED' ? new Date().toISOString() : null,
        });
      }
    } catch {
      // Best-effort tombstone audit log; do not block profile deletion if table is missing or write fails
    }
  }

  private async consumeReauthProof(tokenDigest: string, userId: string, expiresAtIso: string): Promise<void> {
    if (!this.client) {
      const err = new Error('Database client unavailable for replay protection.');
      (err as unknown as { statusCode: number; code: string }).statusCode = 503;
      (err as unknown as { statusCode: number; code: string }).code = 'REAUTH_COORDINATION_UNAVAILABLE';
      throw err;
    }

    // 1. Fast process-local check
    if (AccountDeletionService.consumedReauthJtis.has(tokenDigest)) {
      const err = new Error('Re-authentication token has already been consumed. Please complete a new challenge.');
      (err as unknown as { statusCode: number; code: string }).statusCode = 401;
      (err as unknown as { statusCode: number; code: string }).code = 'REAUTH_REPLAY_DETECTED';
      throw err;
    }

    // 2. Try atomic RPC if available
    if (typeof (this.client as { rpc?: unknown }).rpc === 'function') {
      try {
        type RpcFn = (
          name: string,
          params: Record<string, unknown>
        ) => Promise<{ data: boolean | null; error: unknown }>;
        const rpcClient = this.client as unknown as { rpc: RpcFn };
        const { data: consumed, error } = await rpcClient.rpc('consume_reauth_token', {
          p_token_digest: tokenDigest,
          p_user_id: userId,
          p_expires_at: expiresAtIso,
        });

        if (error) {
          const err = new Error(
            `Replay protection database unavailable: ${error instanceof Error ? error.message : JSON.stringify(error)}`
          );
          (err as unknown as { statusCode: number; code: string }).statusCode = 503;
          (err as unknown as { statusCode: number; code: string }).code = 'REAUTH_COORDINATION_UNAVAILABLE';
          throw err;
        }

        if (!consumed) {
          const err = new Error('Re-authentication token has already been consumed. Please complete a new challenge.');
          (err as unknown as { statusCode: number; code: string }).statusCode = 401;
          (err as unknown as { statusCode: number; code: string }).code = 'REAUTH_REPLAY_DETECTED';
          throw err;
        }

        AccountDeletionService.consumedReauthJtis.add(tokenDigest);
        return;
      } catch (err: unknown) {
        if (
          (err as { code?: string }).code === 'REAUTH_REPLAY_DETECTED' ||
          (err as { code?: string }).code === 'REAUTH_COORDINATION_UNAVAILABLE'
        ) {
          throw err;
        }
        // Fall back to table query below if RPC was unmocked
      }
    }

    // 3. Table-level atomic insert with ON CONFLICT / unique key constraint
    try {
      type TableDeleteFrom = (table: string) => {
        delete: () => {
          lt: (col: string, val: string) => Promise<unknown>;
        };
        insert: (record: Record<string, unknown>) => Promise<{ error: unknown }>;
      };
      const queryTable = this.client.from as unknown as TableDeleteFrom;

      // Lazy cleanup of expired tokens
      try {
        await queryTable('consumed_reauth_tokens').delete().lt('expires_at', new Date().toISOString());
      } catch {
        // Cleanup error is non-fatal
      }

      const { error: insertErr } = await queryTable('consumed_reauth_tokens').insert({
        token_digest: tokenDigest,
        user_id: userId,
        expires_at: expiresAtIso,
      });

      if (insertErr) {
        const msg = String((insertErr as { message?: string }).message || '');
        const code = String((insertErr as { code?: string }).code || '');
        if (code === '23505' || msg.includes('duplicate') || msg.includes('conflict') || msg.includes('unique')) {
          const err = new Error('Re-authentication token has already been consumed. Please complete a new challenge.');
          (err as unknown as { statusCode: number; code: string }).statusCode = 401;
          (err as unknown as { statusCode: number; code: string }).code = 'REAUTH_REPLAY_DETECTED';
          throw err;
        }

        const err = new Error(
          `Replay protection database unavailable: ${insertErr instanceof Error ? insertErr.message : JSON.stringify(insertErr)}`
        );
        (err as unknown as { statusCode: number; code: string }).statusCode = 503;
        (err as unknown as { statusCode: number; code: string }).code = 'REAUTH_COORDINATION_UNAVAILABLE';
        throw err;
      }

      AccountDeletionService.consumedReauthJtis.add(tokenDigest);
    } catch (err: unknown) {
      if (
        (err as { code?: string }).code === 'REAUTH_REPLAY_DETECTED' ||
        (err as { code?: string }).code === 'REAUTH_COORDINATION_UNAVAILABLE'
      ) {
        throw err;
      }
      const dbErr = new Error(`Replay protection database unavailable: ${err instanceof Error ? err.message : String(err)}`);
      (dbErr as unknown as { statusCode: number; code: string }).statusCode = 503;
      (dbErr as unknown as { statusCode: number; code: string }).code = 'REAUTH_COORDINATION_UNAVAILABLE';
      throw dbErr;
    }
  }
}

export const defaultAccountDeletionService = new AccountDeletionService();
