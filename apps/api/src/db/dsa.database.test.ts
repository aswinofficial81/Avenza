import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

describe('DSA Database Foundation, Schema, Constraints, Triggers & RLS', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Establish Supabase auth schema and roles in embedded Postgres
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
          CREATE ROLE authenticated;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon;
        END IF;
      END
      $$;
    `);

    // 2. Apply all migrations in sequence (1 through 8)
    const migrations = [
      '../../supabase/migrations/20261002000001_init_database_foundation.sql',
      '../../supabase/migrations/20261003000002_goals.sql',
      '../../supabase/migrations/20261003000003_tasks.sql',
      '../../supabase/migrations/20261003000004_focus_sessions.sql',
      '../../supabase/migrations/20261003000005_evidence.sql',
      '../../supabase/migrations/20261003000006_academics.sql',
      '../../supabase/migrations/20261003000007_skills.sql',
      '../../supabase/migrations/20261004000008_dsa.sql',
    ];

    for (const mPath of migrations) {
      const fullPath = path.resolve(process.cwd(), mPath);
      const sql = fs.readFileSync(fullPath, 'utf8');
      await db.exec(sql);
    }

    await db.exec(`
      GRANT USAGE ON SCHEMA public TO authenticated, anon;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
    `);
  });

  const asUser = async <T>(
    clerkId: string,
    role = 'authenticated',
    callback: () => Promise<T> = async () => ({} as T)
  ): Promise<T> => {
    await db.exec(`
      SET ROLE ${role};
      SET "request.jwt.claim.role" = '${role}';
      SET "request.jwt.claims" = '{"sub": "${clerkId}"}';
    `);
    try {
      return await callback();
    } finally {
      await db.exec(`
        RESET ROLE;
        SET "request.jwt.claim.role" = 'service_role';
        SET "request.jwt.claims" = '{}';
      `);
    }
  };

  const USER_A = 'a0000000-0000-0000-0000-000000000001';
  const USER_B = 'b0000000-0000-0000-0000-000000000002';
  const CLERK_A = 'clerk_user_a';
  const CLERK_B = 'clerk_user_b';

  const setupProfiles = async () => {
    await db.query(
      `INSERT INTO public.profiles (id, clerk_user_id, display_name)
       VALUES ($1, $2, $3), ($4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [USER_A, CLERK_A, 'User A', USER_B, CLERK_B, 'User B']
    );
  };

  describe('1. Schema, Tables, Constraints & Triggers', () => {
    it('creates problems with valid constraints', async () => {
      await setupProfiles();

      const result = await db.query<{ id: string; title: string; difficulty: string; review_stage: number }>(
        `INSERT INTO public.dsa_problems (user_id, title, slug, difficulty, source)
         VALUES ($1, 'Two Sum', 'two-sum', 'easy', 'user')
         RETURNING id, title, difficulty, review_stage`,
        [USER_A]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.title).toBe('Two Sum');
      expect(result.rows[0]!.difficulty).toBe('easy');
      expect(result.rows[0]!.review_stage).toBe(0);
    });

    it('enforces unique slug per user for problems', async () => {
      await setupProfiles();

      // Duplicate slug for same user fails
      await expect(
        db.query(
          `INSERT INTO public.dsa_problems (user_id, title, slug, difficulty)
           VALUES ($1, 'Two Sum Again', 'two-sum', 'easy')`,
          [USER_A]
        )
      ).rejects.toThrow();

      // Different user CAN use same slug
      const resB = await db.query<{ id: string }>(
        `INSERT INTO public.dsa_problems (user_id, title, slug, difficulty)
         VALUES ($1, 'Two Sum User B', 'two-sum', 'easy')
         RETURNING id`,
        [USER_B]
      );
      expect(resB.rows).toHaveLength(1);
    });

    it('enforces difficulty and status check constraints', async () => {
      await setupProfiles();

      await expect(
        db.query(
          `INSERT INTO public.dsa_problems (user_id, title, slug, difficulty)
           VALUES ($1, 'Invalid Diff', 'inv-diff', 'super_hard')`,
          [USER_A]
        )
      ).rejects.toThrow();

      await expect(
        db.query(
          `INSERT INTO public.dsa_problems (user_id, title, slug, difficulty, status)
           VALUES ($1, 'Invalid Status', 'inv-status', 'easy', 'deleted')`,
          [USER_A]
        )
      ).rejects.toThrow();
    });

    it('creates topics and prevents self-parenting or circular hierarchy', async () => {
      await setupProfiles();

      const t1 = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_topics (user_id, name, slug)
           VALUES ($1, 'Dynamic Programming', 'dp')
           RETURNING id`,
          [USER_A]
        )
      ).rows[0]!;

      // Self-parenting fails
      await expect(
        db.query(
          `UPDATE public.dsa_topics SET parent_topic_id = $1 WHERE id = $1`,
          [t1.id]
        )
      ).rejects.toThrow();

      // Child topic
      const t2 = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_topics (user_id, name, slug, parent_topic_id)
           VALUES ($1, '1D DP', '1d-dp', $2)
           RETURNING id`,
          [USER_A, t1.id]
        )
      ).rows[0]!;

      // Circular reference t1 -> t2 fails
      await expect(
        db.query(
          `UPDATE public.dsa_topics SET parent_topic_id = $1 WHERE id = $2`,
          [t2.id, t1.id]
        )
      ).rejects.toThrow();
    });

    it('prevents cross-user parent topic assignment', async () => {
      await setupProfiles();

      const topicA = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_topics (user_id, name, slug)
           VALUES ($1, 'Trees', 'trees')
           RETURNING id`,
          [USER_A]
        )
      ).rows[0]!;

      // User B cannot use User A's topic as parent
      await expect(
        db.query(
          `INSERT INTO public.dsa_topics (user_id, name, slug, parent_topic_id)
           VALUES ($1, 'Binary Trees', 'binary-trees', $2)`,
          [USER_B, topicA.id]
        )
      ).rejects.toThrow();
    });
  });

  describe('2. Historical Execution Preservation (failed -> failed -> solved)', () => {
    it('preserves all three attempts without overwriting history', async () => {
      await setupProfiles();

      const problem = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_problems (user_id, title, slug, difficulty)
           VALUES ($1, 'Merge Sort', 'merge-sort', 'medium')
           RETURNING id`,
          [USER_A]
        )
      ).rows[0]!;

      // Attempt 1: Failed
      const a1 = (
        await db.query<{ id: string; status: string }>(
          `INSERT INTO public.dsa_attempts (user_id, problem_id, status, occurred_at)
           VALUES ($1, $2, 'failed', now() - interval '2 days')
           RETURNING id, status`,
          [USER_A, problem.id]
        )
      ).rows[0]!;

      // Attempt 2: Failed
      const a2 = (
        await db.query<{ id: string; status: string }>(
          `INSERT INTO public.dsa_attempts (user_id, problem_id, status, occurred_at)
           VALUES ($1, $2, 'failed', now() - interval '1 day')
           RETURNING id, status`,
          [USER_A, problem.id]
        )
      ).rows[0]!;

      // Attempt 3: Solved
      const a3 = (
        await db.query<{ id: string; status: string }>(
          `INSERT INTO public.dsa_attempts (user_id, problem_id, status, occurred_at, solve_time_minutes)
           VALUES ($1, $2, 'solved', now(), 25)
           RETURNING id, status`,
          [USER_A, problem.id]
        )
      ).rows[0]!;

      // Verify all 3 attempts exist in history
      const history = await db.query<{ id: string; status: string }>(
        `SELECT id, status FROM public.dsa_attempts
         WHERE problem_id = $1 ORDER BY occurred_at ASC`,
        [problem.id]
      );

      expect(history.rows).toHaveLength(3);
      expect(history.rows[0]!.id).toBe(a1.id);
      expect(history.rows[0]!.status).toBe('failed');
      expect(history.rows[1]!.id).toBe(a2.id);
      expect(history.rows[1]!.status).toBe('failed');
      expect(history.rows[2]!.id).toBe(a3.id);
      expect(history.rows[2]!.status).toBe('solved');
    });
  });

  describe('3. Evidence Trigger & Idempotency Rules', () => {
    it('allows evidence referencing a SOLVED attempt owned by the user', async () => {
      await setupProfiles();

      const prob = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_problems (user_id, title, slug, difficulty)
           VALUES ($1, 'Binary Search', 'binary-search', 'easy')
           RETURNING id`,
          [USER_A]
        )
      ).rows[0]!;

      const solvedAttempt = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_attempts (user_id, problem_id, status, occurred_at)
           VALUES ($1, $2, 'solved', now())
           RETURNING id`,
          [USER_A, prob.id]
        )
      ).rows[0]!;

      // Insert evidence referencing solved attempt
      const ev = await db.query<{ id: string; evidence_type: string }>(
        `INSERT INTO public.evidence (user_id, title, evidence_type, source_type, source_id)
         VALUES ($1, 'Solved Binary Search', 'dsa_problem_solved', 'dsa_attempt', $2)
         RETURNING id, evidence_type`,
        [USER_A, solvedAttempt.id]
      );

      expect(ev.rows).toHaveLength(1);
      expect(ev.rows[0]!.evidence_type).toBe('dsa_problem_solved');
    });

    it('rejects evidence referencing a FAILED attempt', async () => {
      await setupProfiles();

      const prob = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_problems (user_id, title, slug, difficulty)
           VALUES ($1, 'Quick Sort', 'quick-sort', 'medium')
           RETURNING id`,
          [USER_A]
        )
      ).rows[0]!;

      const failedAttempt = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_attempts (user_id, problem_id, status, occurred_at)
           VALUES ($1, $2, 'failed', now())
           RETURNING id`,
          [USER_A, prob.id]
        )
      ).rows[0]!;

      await expect(
        db.query(
          `INSERT INTO public.evidence (user_id, title, evidence_type, source_type, source_id)
           VALUES ($1, 'Failed Quick Sort Evidence', 'dsa_problem_solved', 'dsa_attempt', $2)`,
          [USER_A, failedAttempt.id]
        )
      ).rejects.toThrow(/Only a solved DSA attempt can produce solved evidence/);
    });

    it('enforces idempotency: at most one evidence record per attempt', async () => {
      await setupProfiles();

      const prob = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_problems (user_id, title, slug, difficulty)
           VALUES ($1, 'Invert Tree', 'invert-tree', 'easy')
           RETURNING id`,
          [USER_A]
        )
      ).rows[0]!;

      const solvedAttempt = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_attempts (user_id, problem_id, status, occurred_at)
           VALUES ($1, $2, 'solved', now())
           RETURNING id`,
          [USER_A, prob.id]
        )
      ).rows[0]!;

      // First evidence insert succeeds
      await db.query(
        `INSERT INTO public.evidence (user_id, title, evidence_type, source_type, source_id)
         VALUES ($1, 'Solved Invert Tree', 'dsa_problem_solved', 'dsa_attempt', $2)`,
        [USER_A, solvedAttempt.id]
      );

      // Repeated generation with same (user_id, source_type, source_id) is rejected by unique constraint
      await expect(
        db.query(
          `INSERT INTO public.evidence (user_id, title, evidence_type, source_type, source_id)
           VALUES ($1, 'Solved Invert Tree Duplicate', 'dsa_problem_solved', 'dsa_attempt', $2)`,
          [USER_A, solvedAttempt.id]
        )
      ).rejects.toThrow();
    });

    it('rejects cross-user evidence generation', async () => {
      await setupProfiles();

      const probA = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_problems (user_id, title, slug, difficulty)
           VALUES ($1, 'User A Problem', 'user-a-problem', 'easy')
           RETURNING id`,
          [USER_A]
        )
      ).rows[0]!;

      const attemptA = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_attempts (user_id, problem_id, status, occurred_at)
           VALUES ($1, $2, 'solved', now())
           RETURNING id`,
          [USER_A, probA.id]
        )
      ).rows[0]!;

      // User B cannot create evidence claiming User A's attempt
      await expect(
        db.query(
          `INSERT INTO public.evidence (user_id, title, evidence_type, source_type, source_id)
           VALUES ($1, 'Stolen Evidence', 'dsa_problem_solved', 'dsa_attempt', $2)`,
          [USER_B, attemptA.id]
        )
      ).rejects.toThrow(/DSA attempt evidence must belong to the attempt owner/);
    });
  });

  describe('4. Row Level Security (RLS) Isolation', () => {
    it('User A cannot read User B problems', async () => {
      await setupProfiles();

      const probB = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_problems (user_id, title, slug, difficulty)
           VALUES ($1, 'Secret Problem B', 'secret-b', 'hard')
           RETURNING id`,
          [USER_B]
        )
      ).rows[0]!;

      // User A reads dsa_problems under RLS
      const visibleToA = await asUser(CLERK_A, 'authenticated', async () => {
        const res = await db.query<{ id: string }>(
          `SELECT id FROM public.dsa_problems WHERE id = $1`,
          [probB.id]
        );
        return res.rows;
      });

      expect(visibleToA).toHaveLength(0);
    });

    it('User A cannot read User B topics', async () => {
      await setupProfiles();

      const topicB = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_topics (user_id, name, slug)
           VALUES ($1, 'User B Topics', 'user-b-topics')
           RETURNING id`,
          [USER_B]
        )
      ).rows[0]!;

      const visibleToA = await asUser(CLERK_A, 'authenticated', async () => {
        const res = await db.query<{ id: string }>(
          `SELECT id FROM public.dsa_topics WHERE id = $1`,
          [topicB.id]
        );
        return res.rows;
      });

      expect(visibleToA).toHaveLength(0);
    });

    it('User A cannot read User B attempts', async () => {
      await setupProfiles();

      const probB = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_problems (user_id, title, slug, difficulty)
           VALUES ($1, 'Prob B For Attempt', 'prob-b-attempt', 'medium')
           RETURNING id`,
          [USER_B]
        )
      ).rows[0]!;

      const attemptB = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_attempts (user_id, problem_id, status, occurred_at)
           VALUES ($1, $2, 'solved', now())
           RETURNING id`,
          [USER_B, probB.id]
        )
      ).rows[0]!;

      const visibleToA = await asUser(CLERK_A, 'authenticated', async () => {
        const res = await db.query<{ id: string }>(
          `SELECT id FROM public.dsa_attempts WHERE id = $1`,
          [attemptB.id]
        );
        return res.rows;
      });

      expect(visibleToA).toHaveLength(0);
    });

    it('User A cannot modify User B records', async () => {
      await setupProfiles();

      const probB = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_problems (user_id, title, slug, difficulty)
           VALUES ($1, 'Problem To Mutate', 'prob-to-mutate', 'medium')
           RETURNING id`,
          [USER_B]
        )
      ).rows[0]!;

      // User A attempts update under RLS
      const updatedRows = await asUser(CLERK_A, 'authenticated', async () => {
        const res = await db.query(
          `UPDATE public.dsa_problems SET title = 'Hacked Title' WHERE id = $1 RETURNING id`,
          [probB.id]
        );
        return res.rows;
      });

      expect(updatedRows).toHaveLength(0);

      // Verify original title unchanged
      const check = await db.query<{ title: string }>(
        `SELECT title FROM public.dsa_problems WHERE id = $1`,
        [probB.id]
      );
      expect(check.rows[0]!.title).toBe('Problem To Mutate');
    });

    it('User A cannot create relationships involving User B records', async () => {
      await setupProfiles();

      const probB = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_problems (user_id, title, slug, difficulty)
           VALUES ($1, 'Problem Owned By B', 'prob-owned-by-b', 'medium')
           RETURNING id`,
          [USER_B]
        )
      ).rows[0]!;

      const topicA = (
        await db.query<{ id: string }>(
          `INSERT INTO public.dsa_topics (user_id, name, slug)
           VALUES ($1, 'Topic Owned By A', 'topic-owned-by-a')
           RETURNING id`,
          [USER_A]
        )
      ).rows[0]!;

      // Foreign key / cross-user ownership trigger prevents linking User B's problem to User A's user_id or topic
      await expect(
        db.query(
          `INSERT INTO public.dsa_problem_topics (user_id, problem_id, topic_id)
           VALUES ($1, $2, $3)`,
          [USER_A, probB.id, topicA.id]
        )
      ).rejects.toThrow();
    });
  });
});
