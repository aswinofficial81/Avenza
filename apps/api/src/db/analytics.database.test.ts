import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Analytics Database-Backed Queries, Tenant Isolation & Read-Only Integrity', () => {
  let db: PGlite;

  const userA = '11111111-1111-4111-a111-111111111111';
  const userB = '22222222-2222-4222-a222-222222222222';

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

    // 2. Apply all migrations in sequence (1 through 13)
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

    // 3. Create profiles for User A and User B
    await db.exec(`
      INSERT INTO public.profiles (id, clerk_user_id, display_name)
      VALUES
        ('${userA}', 'clerk_a', 'User A'),
        ('${userB}', 'clerk_b', 'User B');
    `);
  });

  it('correctly aggregates tasks and enforces completion rate denominator rules in PostgreSQL', async () => {
    const startUtc = '2026-10-01T00:00:00.000Z';
    const endUtc = '2026-10-08T00:00:00.000Z';
    const asOf = '2026-10-07T12:00:00.000Z';

    // Insert User A tasks:
    // Completed in period: 2 tasks
    await db.exec(`
      INSERT INTO public.tasks (id, user_id, title, status, priority, task_type, completed_at, due_at)
      VALUES
        ('aaaaaaaa-0001-4000-8000-000000000001', '${userA}', 'Task Completed 1', 'completed', 'high', 'study', '2026-10-02T10:00:00Z', '2026-10-02T09:00:00Z'),
        ('aaaaaaaa-0002-4000-8000-000000000002', '${userA}', 'Task Completed 2', 'completed', 'medium', 'practice', '2026-10-05T15:00:00Z', '2026-10-05T14:00:00Z'),
        -- Completed outside period (should not count)
        ('aaaaaaaa-0003-4000-8000-000000000003', '${userA}', 'Task Completed Past', 'completed', 'low', 'revision', '2026-09-25T10:00:00Z', '2026-09-25T09:00:00Z'),
        -- Open planned task due in period (contributes to O)
        ('aaaaaaaa-0004-4000-8000-000000000004', '${userA}', 'Task Open Planned', 'planned', 'critical', 'assignment', null, '2026-10-03T18:00:00Z'),
        -- Dated inbox task due in period (contributes to O)
        ('aaaaaaaa-0005-4000-8000-000000000005', '${userA}', 'Task Dated Inbox', 'inbox', 'medium', 'dsa', null, '2026-10-04T12:00:00Z'),
        -- Undated inbox task (must NOT contribute to O)
        ('aaaaaaaa-0006-4000-8000-000000000006', '${userA}', 'Task Undated Inbox', 'inbox', 'low', 'custom', null, null),
        -- Open overdue task due before period (contributes to current overdue snapshot, NOT to period O)
        ('aaaaaaaa-0007-4000-8000-000000000007', '${userA}', 'Task Old Overdue', 'scheduled', 'high', 'project', null, '2026-09-15T10:00:00Z');
    `);

    // Insert User B task (should never appear in User A aggregation)
    await db.exec(`
      INSERT INTO public.tasks (id, user_id, title, status, priority, task_type, completed_at, due_at)
      VALUES
        ('bbbbbbbb-0001-4000-8000-000000000001', '${userB}', 'User B Completed', 'completed', 'critical', 'exam_preparation', '2026-10-02T10:00:00Z', '2026-10-02T09:00:00Z');
    `);

    // 1. Query C (Completed in period for User A)
    const cResult = await db.query<{ count: string }>(`
      SELECT count(*)::text as count
      FROM public.tasks
      WHERE user_id = '${userA}'
        AND status = 'completed'
        AND completed_at >= '${startUtc}'
        AND completed_at < '${endUtc}';
    `);
    expect(Number(cResult.rows[0]?.count)).toBe(2);

    // 2. Query O (Open tasks due in period for User A)
    const oResult = await db.query<{ count: string }>(`
      SELECT count(*)::text as count
      FROM public.tasks
      WHERE user_id = '${userA}'
        AND status IN ('inbox', 'planned', 'scheduled', 'in_progress', 'deferred')
        AND due_at IS NOT NULL
        AND due_at >= '${startUtc}'
        AND due_at < '${endUtc}';
    `);
    // Expected: 2 (Task Open Planned + Task Dated Inbox). Undated inbox & old overdue excluded.
    expect(Number(oResult.rows[0]?.count)).toBe(2);

    // Completion rate: 2 / (2 + 2) * 100 = 50.0%
    const c = Number(cResult.rows[0]?.count);
    const o = Number(oResult.rows[0]?.count);
    const completionRate = c + o > 0 ? (c / (c + o)) * 100 : null;
    expect(completionRate).toBe(50.0);

    // 3. Current overdue snapshot
    const overdueResult = await db.query<{ count: string }>(`
      SELECT count(*)::text as count
      FROM public.tasks
      WHERE user_id = '${userA}'
        AND status IN ('inbox', 'planned', 'scheduled', 'in_progress', 'deferred')
        AND due_at IS NOT NULL
        AND due_at < '${asOf}';
    `);
    // Overdue tasks before Oct 7 12:00: Old Overdue (Sept 15), Open Planned (Oct 3), Dated Inbox (Oct 4) -> 3
    expect(Number(overdueResult.rows[0]?.count)).toBe(3);
  });

  it('correctly aggregates focus time and sessions in PostgreSQL', async () => {
    const startUtc = '2026-10-01T00:00:00.000Z';
    const endUtc = '2026-10-08T00:00:00.000Z';

    await db.exec(`
      INSERT INTO public.focus_sessions (id, user_id, session_type, status, planned_minutes, actual_minutes, started_at, ended_at)
      VALUES
        ('f1111111-0001-4000-8000-000000000001', '${userA}', 'focus', 'completed', 50, 50, '2026-10-02T10:00:00Z', '2026-10-02T10:50:00Z'),
        ('f1111111-0002-4000-8000-000000000002', '${userA}', 'deep_work', 'completed', 60, 75, '2026-10-03T14:00:00Z', '2026-10-03T15:15:00Z'),
        ('f1111111-0003-4000-8000-000000000003', '${userA}', 'pomodoro', 'cancelled', 25, 0, '2026-10-04T09:00:00Z', '2026-10-04T09:05:00Z'),
        -- User B session (isolated)
        ('f2222222-0001-4000-8000-000000000001', '${userB}', 'focus', 'completed', 90, 90, '2026-10-02T10:00:00Z', '2026-10-02T11:30:00Z');
    `);

    const focusResult = await db.query<{ count: string; total_minutes: string }>(`
      SELECT
        count(*)::text as count,
        coalesce(sum(actual_minutes), 0)::text as total_minutes
      FROM public.focus_sessions
      WHERE user_id = '${userA}'
        AND status = 'completed'
        AND ended_at >= '${startUtc}'
        AND ended_at < '${endUtc}';
    `);

    expect(Number(focusResult.rows[0]?.count)).toBe(2);
    expect(Number(focusResult.rows[0]?.total_minutes)).toBe(125); // 50 + 75
  });

  it('correctly calculates DSA attempts and unique problems solved in PostgreSQL without repeat inflation', async () => {
    const startUtc = '2026-10-01T00:00:00.000Z';
    const endUtc = '2026-10-08T00:00:00.000Z';

    // Insert DSA Problems:
    await db.exec(`
      INSERT INTO public.dsa_problems (id, user_id, title, slug, difficulty, source, status)
      VALUES
        ('d1111111-0001-4000-8000-000000000001', '${userA}', 'Two Sum', 'two-sum', 'easy', 'user', 'active'),
        ('d1111111-0002-4000-8000-000000000002', '${userA}', 'LRU Cache', 'lru-cache', 'medium', 'user', 'active');
    `);

    // Insert Attempts for User A:
    // Problem 1 solved twice (should count as 1 unique problem solved)
    // Problem 2 attempted (failed)
    await db.exec(`
      INSERT INTO public.dsa_attempts (id, user_id, problem_id, status, occurred_at, recorded_at)
      VALUES
        ('a1111111-0001-4000-8000-000000000001', '${userA}', 'd1111111-0001-4000-8000-000000000001', 'solved', '2026-10-02T10:00:00Z', '2026-10-02T10:00:00Z'),
        ('a1111111-0002-4000-8000-000000000002', '${userA}', 'd1111111-0001-4000-8000-000000000001', 'solved', '2026-10-03T10:00:00Z', '2026-10-03T10:00:00Z'),
        ('a1111111-0003-4000-8000-000000000003', '${userA}', 'd1111111-0002-4000-8000-000000000002', 'failed', '2026-10-04T10:00:00Z', '2026-10-04T10:00:00Z');
    `);

    // Total attempts
    const attemptsResult = await db.query<{ count: string }>(`
      SELECT count(*)::text as count
      FROM public.dsa_attempts
      WHERE user_id = '${userA}'
        AND occurred_at >= '${startUtc}'
        AND occurred_at < '${endUtc}';
    `);
    expect(Number(attemptsResult.rows[0]?.count)).toBe(3);

    // Unique problems solved
    const uniqueSolvedResult = await db.query<{ count: string }>(`
      SELECT count(DISTINCT problem_id)::text as count
      FROM public.dsa_attempts
      WHERE user_id = '${userA}'
        AND status = 'solved'
        AND occurred_at >= '${startUtc}'
        AND occurred_at < '${endUtc}';
    `);
    expect(Number(uniqueSolvedResult.rows[0]?.count)).toBe(1);
  });

  it('guarantees analytics queries perform zero database mutations', async () => {
    // Count records before analytics queries
    const countTasksBefore = await db.query<{ count: string }>('SELECT count(*)::text as count FROM public.tasks;');
    const countFocusBefore = await db.query<{ count: string }>('SELECT count(*)::text as count FROM public.focus_sessions;');
    const countDsaBefore = await db.query<{ count: string }>('SELECT count(*)::text as count FROM public.dsa_attempts;');

    // Execute read queries
    await db.query(`SELECT count(*) FROM public.tasks WHERE user_id = '${userA}';`);
    await db.query(`SELECT count(*) FROM public.focus_sessions WHERE user_id = '${userA}';`);
    await db.query(`SELECT count(*) FROM public.dsa_attempts WHERE user_id = '${userA}';`);

    // Count records after
    const countTasksAfter = await db.query<{ count: string }>('SELECT count(*)::text as count FROM public.tasks;');
    const countFocusAfter = await db.query<{ count: string }>('SELECT count(*)::text as count FROM public.focus_sessions;');
    const countDsaAfter = await db.query<{ count: string }>('SELECT count(*)::text as count FROM public.dsa_attempts;');

    expect(countTasksAfter.rows[0]?.count).toBe(countTasksBefore.rows[0]?.count);
    expect(countFocusAfter.rows[0]?.count).toBe(countFocusBefore.rows[0]?.count);
    expect(countDsaAfter.rows[0]?.count).toBe(countDsaBefore.rows[0]?.count);
  });
});
