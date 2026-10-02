import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Focus Sessions Database Foundation, Constraints & RLS', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Establish Supabase auth schema and authenticated role in embedded Postgres for tests
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

    // 2. Apply migrations 1, 2, 3, 4 in sequence
    const migrations = [
      '../../supabase/migrations/20261002000001_init_database_foundation.sql',
      '../../supabase/migrations/20261003000002_goals.sql',
      '../../supabase/migrations/20261003000003_tasks.sql',
      '../../supabase/migrations/20261003000004_focus_sessions.sql',
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

  async function asUser<T>(clerkUserId: string, role = 'authenticated', fn: () => Promise<T>): Promise<T> {
    await db.exec(`
      SET ROLE ${role};
      SET "request.jwt.claim.role" = '${role}';
      SET "request.jwt.claims" = '{"sub": "${clerkUserId}"}';
    `);
    try {
      return await fn();
    } finally {
      await db.exec(`
        RESET ROLE;
        SET "request.jwt.claim.role" = 'service_role';
        SET "request.jwt.claims" = '{}';
      `);
    }
  }

  describe('Database Schema & Table Structure', () => {
    it('creates public.focus_sessions table with expected columns', async () => {
      const result = await db.query<{ column_name: string }>(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'focus_sessions';
      `);

      const columns = result.rows.map((r) => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('task_id');
      expect(columns).toContain('session_type');
      expect(columns).toContain('status');
      expect(columns).toContain('started_at');
      expect(columns).toContain('ended_at');
      expect(columns).toContain('planned_minutes');
      expect(columns).toContain('actual_minutes');
      expect(columns).toContain('notes');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('creates expected indexes and partial unique index', async () => {
      const result = await db.query<{ indexname: string }>(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public' AND tablename = 'focus_sessions';
      `);

      const indexNames = result.rows.map((r) => r.indexname);
      expect(indexNames).toContain('idx_focus_sessions_user_active');
      expect(indexNames).toContain('idx_focus_sessions_user_started');
      expect(indexNames).toContain('idx_focus_sessions_user_status');
      expect(indexNames).toContain('idx_focus_sessions_task_started');
    });
  });

  describe('Constraints & Invariants', () => {
    it('enforces single active session per user invariant (partial unique index)', async () => {
      // 1. Create a profile and task
      const userRes = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_focus_user_1', 'Focus User One')
        RETURNING id;
      `);
      const userId = userRes.rows[0]!.id;

      const taskRes = await db.query<{ id: string }>(`
        INSERT INTO public.tasks (user_id, title)
        VALUES ('${userId}', 'Task for Focus Test')
        RETURNING id;
      `);
      const taskId = taskRes.rows[0]!.id;

      // 2. Insert first active session
      await db.query(`
        INSERT INTO public.focus_sessions (user_id, task_id, planned_minutes, status)
        VALUES ('${userId}', '${taskId}', 25, 'active');
      `);

      // 3. Attempting second active session for same user must be rejected by PostgreSQL
      await expect(
        db.query(`
          INSERT INTO public.focus_sessions (user_id, task_id, planned_minutes, status)
          VALUES ('${userId}', '${taskId}', 30, 'active');
        `)
      ).rejects.toThrow();

      // 4. After completing first session, a new active session is allowed
      await db.query(`
        UPDATE public.focus_sessions 
        SET status = 'completed', ended_at = now(), actual_minutes = 25
        WHERE user_id = '${userId}' AND status = 'active';
      `);

      const secondActiveRes = await db.query<{ id: string }>(`
        INSERT INTO public.focus_sessions (user_id, task_id, planned_minutes, status)
        VALUES ('${userId}', '${taskId}', 30, 'active')
        RETURNING id;
      `);
      expect(secondActiveRes.rows).toHaveLength(1);
    });

    it('rejects invalid planned_minutes (<= 0 or > 480)', async () => {
      const userRes = await db.query<{ id: string }>(`
        SELECT id FROM public.profiles WHERE clerk_user_id = 'clerk_focus_user_1';
      `);
      const userId = userRes.rows[0]!.id;

      // 0 minutes
      await expect(
        db.query(`
          INSERT INTO public.focus_sessions (user_id, planned_minutes, status, ended_at, actual_minutes)
          VALUES ('${userId}', 0, 'completed', now(), 0);
        `)
      ).rejects.toThrow();

      // 500 minutes
      await expect(
        db.query(`
          INSERT INTO public.focus_sessions (user_id, planned_minutes, status, ended_at, actual_minutes)
          VALUES ('${userId}', 500, 'completed', now(), 0);
        `)
      ).rejects.toThrow();
    });

    it('rejects invalid session_type and status enums', async () => {
      const userRes = await db.query<{ id: string }>(`
        SELECT id FROM public.profiles WHERE clerk_user_id = 'clerk_focus_user_1';
      `);
      const userId = userRes.rows[0]!.id;

      await expect(
        db.query(`
          INSERT INTO public.focus_sessions (user_id, planned_minutes, session_type, status, ended_at, actual_minutes)
          VALUES ('${userId}', 25, 'invalid_session_type', 'completed', now(), 25);
        `)
      ).rejects.toThrow();

      await expect(
        db.query(`
          INSERT INTO public.focus_sessions (user_id, planned_minutes, status, ended_at, actual_minutes)
          VALUES ('${userId}', 25, 'paused', now(), 25);
        `)
      ).rejects.toThrow();
    });
  });

  describe('Row Level Security (RLS) Isolation', () => {
    it('isolates focus sessions between users under authenticated role', async () => {
      // 1. Create two users
      const user1Res = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_rls_alice', 'Alice Focus')
        RETURNING id;
      `);
      const user1Id = user1Res.rows[0]!.id;

      await db.query(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_rls_bob', 'Bob Focus');
      `);

      // Alice creates a task and a completed focus session
      const aliceTask = await db.query<{ id: string }>(`
        INSERT INTO public.tasks (user_id, title)
        VALUES ('${user1Id}', 'Alice Deep Work Task')
        RETURNING id;
      `);
      const aliceTaskId = aliceTask.rows[0]!.id;

      await db.query(`
        INSERT INTO public.focus_sessions (user_id, task_id, planned_minutes, status, ended_at, actual_minutes)
        VALUES ('${user1Id}', '${aliceTaskId}', 45, 'completed', now(), 45);
      `);

      // 2. Query as Alice
      await asUser('clerk_rls_alice', 'authenticated', async () => {
        const aliceSessions = await db.query(`SELECT * FROM public.focus_sessions;`);
        expect(aliceSessions.rows.length).toBeGreaterThanOrEqual(1);
      });

      // 3. Query as Bob
      await asUser('clerk_rls_bob', 'authenticated', async () => {
        const bobSessions = await db.query(`SELECT * FROM public.focus_sessions;`);
        expect(bobSessions.rows).toHaveLength(0);
      });
    });
  });
});
