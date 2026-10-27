import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Account Deletion & Export RPC Security Hardening', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Establish Supabase auth schema and standard roles in embedded Postgres
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;

      CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
      BEGIN
        RETURN coalesce(current_setting('request.jwt.claim.role', true), 'anon');
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
      BEGIN
        RETURN coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
      BEGIN
        RETURN coalesce(nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid, null);
      END;
      $$ LANGUAGE plpgsql;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN;
        END IF;
      END
      $$;
    `);

    // 2. Apply all migrations in sequence 1 through 20
    const migrations = [
      '../../supabase/migrations/20261002000001_init_database_foundation.sql',
      '../../supabase/migrations/20261003000002_goals.sql',
      '../../supabase/migrations/20261003000003_tasks.sql',
      '../../supabase/migrations/20261003000004_focus_sessions.sql',
      '../../supabase/migrations/20261003000005_evidence.sql',
      '../../supabase/migrations/20261003000006_academics.sql',
      '../../supabase/migrations/20261003000007_skills.sql',
      '../../supabase/migrations/20261004000008_dsa.sql',
      '../../supabase/migrations/20261004000009_integrations.sql',
      '../../supabase/migrations/20261005000010_integrations_leetcode.sql',
      '../../supabase/migrations/20261005000011_integrations_codeforces.sql',
      '../../supabase/migrations/20261005000012_integrations_google_calendar.sql',
      '../../supabase/migrations/20261006000013_projects.sql',
      '../../supabase/migrations/20261007000014_career.sql',
      '../../supabase/migrations/20261007000015_career_atomic_operations.sql',
      '../../supabase/migrations/20261007000016_career_rpc_security_hardening.sql',
      '../../supabase/migrations/20261007000017_career_atomic_stage_transition_guard.sql',
      '../../supabase/migrations/20261014000018_account_lifecycle_cascades.sql',
      '../../supabase/migrations/20261015000019_account_deletion_recovery_and_export_leases.sql',
      '../../supabase/migrations/20261015000020_rpc_security_and_consumed_reauth_tokens.sql',
    ];

    for (const mPath of migrations) {
      const fullPath = path.resolve(process.cwd(), mPath);
      const sql = fs.readFileSync(fullPath, 'utf8');
      await db.exec(sql);
    }
  }, 180000);

  const asRole = async <T>(role: 'anon' | 'authenticated' | 'service_role', fn: () => Promise<T>): Promise<T> => {
    await db.exec(`SET ROLE ${role};`);
    try {
      return await fn();
    } finally {
      await db.exec('RESET ROLE;');
    }
  };

  describe('1. Function Security Configuration in pg_proc', () => {
    it('verifies all 4 RPCs are SECURITY DEFINER with empty search_path', async () => {
      const res = await db.query<{
        proname: string;
        prosecdef: boolean;
        proconfig: string[] | null;
      }>(`
        SELECT proname, prosecdef, proconfig
        FROM pg_proc
        JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
        WHERE n.nspname = 'public'
          AND proname IN (
            'claim_deletion_recovery_jobs',
            'acquire_account_export_lease',
            'release_account_export_lease',
            'consume_reauth_token'
          )
        ORDER BY proname;
      `);

      expect(res.rows).toHaveLength(4);
      for (const row of res.rows) {
        expect(row.prosecdef).toBe(true);
        expect(row.proconfig).toEqual(expect.arrayContaining(['search_path=""']));
      }
    });
  });

  describe('2. Unauthorized Role Execution Denials (anon and authenticated)', () => {
    it('denies claim_deletion_recovery_jobs to anon', async () => {
      await expect(
        asRole('anon', async () => {
          return db.query("SELECT * FROM public.claim_deletion_recovery_jobs('worker-1'::text, 10, 300);");
        })
      ).rejects.toThrow(/permission denied for function claim_deletion_recovery_jobs/i);
    });

    it('denies claim_deletion_recovery_jobs to authenticated', async () => {
      await expect(
        asRole('authenticated', async () => {
          return db.query("SELECT * FROM public.claim_deletion_recovery_jobs('worker-1'::text, 10, 300);");
        })
      ).rejects.toThrow(/permission denied for function claim_deletion_recovery_jobs/i);
    });

    it('denies acquire_account_export_lease to anon', async () => {
      await expect(
        asRole('anon', async () => {
          return db.query(
            "SELECT public.acquire_account_export_lease('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 300, 15);"
          );
        })
      ).rejects.toThrow(/permission denied for function acquire_account_export_lease/i);
    });

    it('denies acquire_account_export_lease to authenticated', async () => {
      await expect(
        asRole('authenticated', async () => {
          return db.query(
            "SELECT public.acquire_account_export_lease('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 300, 15);"
          );
        })
      ).rejects.toThrow(/permission denied for function acquire_account_export_lease/i);
    });

    it('denies release_account_export_lease to anon', async () => {
      await expect(
        asRole('anon', async () => {
          return db.query(
            "SELECT public.release_account_export_lease('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, true);"
          );
        })
      ).rejects.toThrow(/permission denied for function release_account_export_lease/i);
    });

    it('denies release_account_export_lease to authenticated', async () => {
      await expect(
        asRole('authenticated', async () => {
          return db.query(
            "SELECT public.release_account_export_lease('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, true);"
          );
        })
      ).rejects.toThrow(/permission denied for function release_account_export_lease/i);
    });

    it('denies consume_reauth_token to anon', async () => {
      await expect(
        asRole('anon', async () => {
          return db.query(
            "SELECT public.consume_reauth_token('sha256hash'::text, '00000000-0000-0000-0000-000000000001'::uuid, now());"
          );
        })
      ).rejects.toThrow(/permission denied for function consume_reauth_token/i);
    });

    it('denies consume_reauth_token to authenticated', async () => {
      await expect(
        asRole('authenticated', async () => {
          return db.query(
            "SELECT public.consume_reauth_token('sha256hash'::text, '00000000-0000-0000-0000-000000000001'::uuid, now());"
          );
        })
      ).rejects.toThrow(/permission denied for function consume_reauth_token/i);
    });
  });

  describe('3. Authorized Execution by service_role', () => {
    it('allows service_role to execute claim_deletion_recovery_jobs', async () => {
      const res = await asRole('service_role', async () => {
        return db.query("SELECT * FROM public.claim_deletion_recovery_jobs('worker-1'::text, 5, 300);");
      });
      expect(Array.isArray(res.rows)).toBe(true);
    });

    it('allows service_role to acquire and release account_export_lease', async () => {
      const uRes = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_export_user_1', 'Export Test User')
        RETURNING id;
      `);
      const testUserId = uRes.rows[0]!.id;
      const testLeaseToken = '99999999-8888-7777-6666-555555555555';

      const acquired = await asRole('service_role', async () => {
        const r = await db.query<{ acquire_account_export_lease: { success: boolean } }>(
          `SELECT public.acquire_account_export_lease('${testUserId}'::uuid, '${testLeaseToken}'::uuid, 300, 15);`
        );
        return r.rows[0]?.acquire_account_export_lease;
      });
      expect(acquired?.success).toBe(true);

      // Re-acquiring within cooldown should return success: false
      const reacquired = await asRole('service_role', async () => {
        const r = await db.query<{ acquire_account_export_lease: { success: boolean } }>(
          `SELECT public.acquire_account_export_lease('${testUserId}'::uuid, '${testLeaseToken}'::uuid, 300, 15);`
        );
        return r.rows[0]?.acquire_account_export_lease;
      });
      expect(reacquired?.success).toBe(false);

      // Release lease
      const released = await asRole('service_role', async () => {
        const r = await db.query<{ release_account_export_lease: boolean }>(
          `SELECT public.release_account_export_lease('${testUserId}'::uuid, '${testLeaseToken}'::uuid, true);`
        );
        return r.rows[0]?.release_account_export_lease;
      });
      expect(released).toBe(true);
    });

    it('allows service_role to execute consume_reauth_token with atomic single-use semantics', async () => {
      const testUserId = '11111111-2222-3333-4444-555555555555';
      const tokenDigest = 'unique_sha256_digest_for_security_test_1';

      // First consumption succeeds
      const firstConsume = await asRole('service_role', async () => {
        const r = await db.query<{ consume_reauth_token: boolean }>(
          `SELECT public.consume_reauth_token('${tokenDigest}'::text, '${testUserId}'::uuid, now() + interval '5 minutes');`
        );
        return r.rows[0]?.consume_reauth_token;
      });
      expect(firstConsume).toBe(true);

      // Immediate reuse is rejected (returns false)
      const secondConsume = await asRole('service_role', async () => {
        const r = await db.query<{ consume_reauth_token: boolean }>(
          `SELECT public.consume_reauth_token('${tokenDigest}'::text, '${testUserId}'::uuid, now() + interval '5 minutes');`
        );
        return r.rows[0]?.consume_reauth_token;
      });
      expect(secondConsume).toBe(false);
    });
  });
});
