import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Tasks & Dependencies Database Foundation + RLS', () => {
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

    // 2. Apply migration 1: init database foundation
    const migration1Path = path.resolve(
      process.cwd(),
      '../../supabase/migrations/20261002000001_init_database_foundation.sql'
    );
    const sql1 = fs.readFileSync(migration1Path, 'utf8');
    await db.exec(sql1);

    // 3. Apply migration 2: goals & milestones
    const migration2Path = path.resolve(
      process.cwd(),
      '../../supabase/migrations/20261003000002_goals.sql'
    );
    const sql2 = fs.readFileSync(migration2Path, 'utf8');
    await db.exec(sql2);

    // 4. Apply migration 3: tasks & task_dependencies
    const migration3Path = path.resolve(
      process.cwd(),
      '../../supabase/migrations/20261003000003_tasks.sql'
    );
    const sql3 = fs.readFileSync(migration3Path, 'utf8');
    await db.exec(sql3);

    // 5. Grant schema permissions to authenticated & anon roles
    await db.exec(`
      GRANT USAGE ON SCHEMA public TO authenticated, anon;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
    `);
  }, 30000);

  describe('1. Schema & Table Structure', () => {
    it('creates tasks and task_dependencies tables', async () => {
      const res = await db.query<{ table_name: string }>(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('tasks', 'task_dependencies')
        ORDER BY table_name;
      `);

      const tables = res.rows.map((r) => r.table_name);
      expect(tables).toEqual(['task_dependencies', 'tasks']);
    });

    it('creates expected columns in tasks', async () => {
      const res = await db.query<{ column_name: string }>(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tasks'
        ORDER BY ordinal_position;
      `);

      const colNames = res.rows.map((r) => r.column_name);
      expect(colNames).toContain('id');
      expect(colNames).toContain('user_id');
      expect(colNames).toContain('title');
      expect(colNames).toContain('description');
      expect(colNames).toContain('status');
      expect(colNames).toContain('priority');
      expect(colNames).toContain('task_type');
      expect(colNames).toContain('goal_id');
      expect(colNames).toContain('milestone_id');
      expect(colNames).toContain('estimated_minutes');
      expect(colNames).toContain('actual_minutes');
      expect(colNames).toContain('due_at');
      expect(colNames).toContain('scheduled_start');
      expect(colNames).toContain('scheduled_end');
      expect(colNames).toContain('completed_at');
      expect(colNames).toContain('notes');
      expect(colNames).toContain('created_at');
      expect(colNames).toContain('updated_at');
    });

    it('creates expected columns in task_dependencies', async () => {
      const res = await db.query<{ column_name: string }>(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'task_dependencies'
        ORDER BY ordinal_position;
      `);

      const colNames = res.rows.map((r) => r.column_name);
      expect(colNames).toContain('id');
      expect(colNames).toContain('task_id');
      expect(colNames).toContain('depends_on_task_id');
      expect(colNames).toContain('created_at');
    });
  });

  describe('2. Constraints & Validation', () => {
    let testProfileId: string;

    beforeAll(async () => {
      const res = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_test_task_constraints_user', 'Task Constraints User')
        RETURNING id;
      `);
      testProfileId = res.rows[0]?.id as string;
    });

    it('rejects task with empty title', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.tasks (user_id, title)
          VALUES ('${testProfileId}', '   ');
        `)
      ).rejects.toThrow(/chk_tasks_title_non_empty/);
    });

    it('rejects task with invalid status', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.tasks (user_id, title, status)
          VALUES ('${testProfileId}', 'Invalid Status', 'doing');
        `)
      ).rejects.toThrow(/chk_tasks_status/);
    });

    it('rejects task with invalid priority', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.tasks (user_id, title, priority)
          VALUES ('${testProfileId}', 'Invalid Priority', 'urgent');
        `)
      ).rejects.toThrow(/chk_tasks_priority/);
    });

    it('rejects task with invalid task_type', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.tasks (user_id, title, task_type)
          VALUES ('${testProfileId}', 'Invalid Type', 'gaming');
        `)
      ).rejects.toThrow(/chk_tasks_task_type/);
    });

    it('rejects task with non-positive estimated_minutes (0 or negative)', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.tasks (user_id, title, estimated_minutes)
          VALUES ('${testProfileId}', 'Bad Estimate', 0);
        `)
      ).rejects.toThrow(/chk_tasks_estimated_minutes_positive/);

      await expect(
        db.exec(`
          INSERT INTO public.tasks (user_id, title, estimated_minutes)
          VALUES ('${testProfileId}', 'Bad Estimate', -10);
        `)
      ).rejects.toThrow(/chk_tasks_estimated_minutes_positive/);
    });

    it('rejects task with negative actual_minutes', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.tasks (user_id, title, actual_minutes)
          VALUES ('${testProfileId}', 'Bad Actual', -5);
        `)
      ).rejects.toThrow(/chk_tasks_actual_minutes_non_negative/);
    });

    it('allows 0 actual_minutes', async () => {
      const res = await db.query<{ id: string }>(`
        INSERT INTO public.tasks (user_id, title, actual_minutes)
        VALUES ('${testProfileId}', 'Zero Actual', 0)
        RETURNING id;
      `);
      expect(res.rows[0]?.id).toBeDefined();
    });

    it('rejects task where scheduled_end is before scheduled_start', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.tasks (user_id, title, scheduled_start, scheduled_end)
          VALUES ('${testProfileId}', 'Schedule Check', '2026-10-10 10:00:00Z', '2026-10-10 09:00:00Z');
        `)
      ).rejects.toThrow(/chk_tasks_schedule_dates/);
    });

    it('rejects self-referencing dependency', async () => {
      const taskRes = await db.query<{ id: string }>(`
        INSERT INTO public.tasks (user_id, title)
        VALUES ('${testProfileId}', 'Task with Self Dependency')
        RETURNING id;
      `);
      const taskId = taskRes.rows[0]?.id as string;

      await expect(
        db.exec(`
          INSERT INTO public.task_dependencies (task_id, depends_on_task_id)
          VALUES ('${taskId}', '${taskId}');
        `)
      ).rejects.toThrow(/chk_task_dependencies_no_self/);
    });

    it('rejects duplicate dependency pair', async () => {
      const t1 = (
        await db.query<{ id: string }>(`
        INSERT INTO public.tasks (user_id, title)
        VALUES ('${testProfileId}', 'Task 1')
        RETURNING id;
      `)
      ).rows[0]?.id as string;

      const t2 = (
        await db.query<{ id: string }>(`
        INSERT INTO public.tasks (user_id, title)
        VALUES ('${testProfileId}', 'Task 2')
        RETURNING id;
      `)
      ).rows[0]?.id as string;

      await db.exec(`
        INSERT INTO public.task_dependencies (task_id, depends_on_task_id)
        VALUES ('${t1}', '${t2}');
      `);

      await expect(
        db.exec(`
          INSERT INTO public.task_dependencies (task_id, depends_on_task_id)
          VALUES ('${t1}', '${t2}');
        `)
      ).rejects.toThrow();
    });
  });

  describe('3. Foreign Keys & Cascading/Set-Null Behavior', () => {
    let testProfileId: string;

    beforeAll(async () => {
      const res = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_fk_user', 'FK User')
        RETURNING id;
      `);
      testProfileId = res.rows[0]?.id as string;
    });

    it('sets goal_id and milestone_id to NULL when goal or milestone is deleted (preserves task history)', async () => {
      const goalRes = await db.query<{ id: string }>(`
        INSERT INTO public.goals (user_id, title, goal_type)
        VALUES ('${testProfileId}', 'Parent Goal For Task', 'learning')
        RETURNING id;
      `);
      const goalId = goalRes.rows[0]?.id as string;

      const msRes = await db.query<{ id: string }>(`
        INSERT INTO public.goal_milestones (goal_id, title, order_index)
        VALUES ('${goalId}', 'Parent Milestone For Task', 0)
        RETURNING id;
      `);
      const milestoneId = msRes.rows[0]?.id as string;

      const taskRes = await db.query<{ id: string }>(`
        INSERT INTO public.tasks (user_id, title, goal_id, milestone_id)
        VALUES ('${testProfileId}', 'Linked Task', '${goalId}', '${milestoneId}')
        RETURNING id;
      `);
      const taskId = taskRes.rows[0]?.id as string;

      // Delete milestone first
      await db.exec(`DELETE FROM public.goal_milestones WHERE id = '${milestoneId}';`);

      const taskAfterMsDelete = await db.query<{ goal_id: string | null; milestone_id: string | null }>(`
        SELECT goal_id, milestone_id FROM public.tasks WHERE id = '${taskId}';
      `);
      expect(taskAfterMsDelete.rows[0]?.goal_id).toBe(goalId);
      expect(taskAfterMsDelete.rows[0]?.milestone_id).toBeNull();

      // Delete goal next
      await db.exec(`DELETE FROM public.goals WHERE id = '${goalId}';`);

      const taskAfterGoalDelete = await db.query<{ goal_id: string | null; milestone_id: string | null }>(`
        SELECT goal_id, milestone_id FROM public.tasks WHERE id = '${taskId}';
      `);
      expect(taskAfterGoalDelete.rows[0]?.goal_id).toBeNull();
      expect(taskAfterGoalDelete.rows[0]?.milestone_id).toBeNull();
    });

    it('cascades task deletion to task_dependencies', async () => {
      const t1 = (
        await db.query<{ id: string }>(`
        INSERT INTO public.tasks (user_id, title)
        VALUES ('${testProfileId}', 'Main Task')
        RETURNING id;
      `)
      ).rows[0]?.id as string;

      const t2 = (
        await db.query<{ id: string }>(`
        INSERT INTO public.tasks (user_id, title)
        VALUES ('${testProfileId}', 'Prereq Task')
        RETURNING id;
      `)
      ).rows[0]?.id as string;

      await db.exec(`
        INSERT INTO public.task_dependencies (task_id, depends_on_task_id)
        VALUES ('${t1}', '${t2}');
      `);

      // Delete t1
      await db.exec(`DELETE FROM public.tasks WHERE id = '${t1}';`);

      const depCheck = await db.query(`
        SELECT * FROM public.task_dependencies WHERE task_id = '${t1}' OR depends_on_task_id = '${t1}';
      `);
      expect(depCheck.rows.length).toBe(0);
    });

    it('cascades profile deletion to tasks', async () => {
      const userRes = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_temp_task_user', 'Temp Task User')
        RETURNING id;
      `);
      const userId = userRes.rows[0]?.id as string;

      await db.exec(`
        INSERT INTO public.tasks (user_id, title)
        VALUES ('${userId}', 'Task to cascade');
      `);

      await db.exec(`DELETE FROM public.profiles WHERE id = '${userId}';`);

      const check = await db.query(`SELECT * FROM public.tasks WHERE user_id = '${userId}';`);
      expect(check.rows.length).toBe(0);
    });
  });

  describe('4. Row Level Security & Multi-tenant User Isolation', () => {
    let userAProfileId: string;
    let userBProfileId: string;
    let userATaskId: string;
    let userBTaskId: string;

    beforeAll(async () => {
      const resA = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_task_user_a', 'Task User A')
        RETURNING id;
      `);
      userAProfileId = resA.rows[0]?.id as string;

      const resB = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_task_user_b', 'Task User B')
        RETURNING id;
      `);
      userBProfileId = resB.rows[0]?.id as string;

      // Create Task for User A
      const taskARes = await db.query<{ id: string }>(`
        INSERT INTO public.tasks (user_id, title, status)
        VALUES ('${userAProfileId}', 'User A Private Task', 'planned')
        RETURNING id;
      `);
      userATaskId = taskARes.rows[0]?.id as string;

      // Create Task for User B
      const taskBRes = await db.query<{ id: string }>(`
        INSERT INTO public.tasks (user_id, title, status)
        VALUES ('${userBProfileId}', 'User B Private Task', 'inbox')
        RETURNING id;
      `);
      userBTaskId = taskBRes.rows[0]?.id as string;
    });

    it('allows User A to select their own tasks under RLS', async () => {
      await db.exec(`
        SET ROLE authenticated;
        SET "request.jwt.claim.role" = 'authenticated';
        SET "request.jwt.claims" = '{"sub": "clerk_task_user_a"}';
      `);

      const res = await db.query<{ id: string; title: string }>(`
        SELECT id, title FROM public.tasks;
      `);

      expect(res.rows.length).toBe(1);
      expect(res.rows[0]?.id).toBe(userATaskId);
      expect(res.rows[0]?.title).toBe('User A Private Task');

      await db.exec(`
        RESET ROLE;
        SET "request.jwt.claim.role" = 'service_role';
        SET "request.jwt.claims" = '{}';
      `);
    });

    it('prevents User B from selecting User A tasks under RLS', async () => {
      await db.exec(`
        SET ROLE authenticated;
        SET "request.jwt.claim.role" = 'authenticated';
        SET "request.jwt.claims" = '{"sub": "clerk_task_user_b"}';
      `);

      const res = await db.query<{ id: string }>(`
        SELECT id FROM public.tasks WHERE id = '${userATaskId}';
      `);

      expect(res.rows.length).toBe(0);

      await db.exec(`
        RESET ROLE;
        SET "request.jwt.claim.role" = 'service_role';
        SET "request.jwt.claims" = '{}';
      `);
    });

    it('prevents User B from updating User A tasks under RLS', async () => {
      await db.exec(`
        SET ROLE authenticated;
        SET "request.jwt.claim.role" = 'authenticated';
        SET "request.jwt.claims" = '{"sub": "clerk_task_user_b"}';
      `);

      const updateRes = await db.query(`
        UPDATE public.tasks
        SET title = 'Hacked Title'
        WHERE id = '${userATaskId}';
      `);
      expect(updateRes.affectedRows).toBe(0);

      await db.exec(`
        RESET ROLE;
        SET "request.jwt.claim.role" = 'service_role';
        SET "request.jwt.claims" = '{}';
      `);

      // Verify unhacked via superuser
      const verify = await db.query<{ title: string }>(`
        SELECT title FROM public.tasks WHERE id = '${userATaskId}';
      `);
      expect(verify.rows[0]?.title).toBe('User A Private Task');
    });

    it('prevents User B from deleting User A tasks under RLS', async () => {
      await db.exec(`
        SET ROLE authenticated;
        SET "request.jwt.claim.role" = 'authenticated';
        SET "request.jwt.claims" = '{"sub": "clerk_task_user_b"}';
      `);

      const delRes = await db.query(`
        DELETE FROM public.tasks WHERE id = '${userATaskId}';
      `);
      expect(delRes.affectedRows).toBe(0);

      await db.exec(`
        RESET ROLE;
        SET "request.jwt.claim.role" = 'service_role';
        SET "request.jwt.claims" = '{}';
      `);

      // Verify still exists via superuser
      const verify = await db.query<{ id: string }>(`
        SELECT id FROM public.tasks WHERE id = '${userATaskId}';
      `);
      expect(verify.rows.length).toBe(1);
    });

    it('prevents creating cross-user dependencies under RLS', async () => {
      await db.exec(`
        SET ROLE authenticated;
        SET "request.jwt.claim.role" = 'authenticated';
        SET "request.jwt.claims" = '{"sub": "clerk_task_user_a"}';
      `);

      // User A attempts to create dependency pointing to User B's task
      await expect(
        db.exec(`
          INSERT INTO public.task_dependencies (task_id, depends_on_task_id)
          VALUES ('${userATaskId}', '${userBTaskId}');
        `)
      ).rejects.toThrow();

      await db.exec(`
        RESET ROLE;
        SET "request.jwt.claim.role" = 'service_role';
        SET "request.jwt.claims" = '{}';
      `);
    });

    it('allows User A to create dependency between their own tasks under RLS', async () => {
      const taskA2 = (
        await db.query<{ id: string }>(`
        INSERT INTO public.tasks (user_id, title)
        VALUES ('${userAProfileId}', 'User A Task 2')
        RETURNING id;
      `)
      ).rows[0]?.id as string;

      await db.exec(`
        SET ROLE authenticated;
        SET "request.jwt.claim.role" = 'authenticated';
        SET "request.jwt.claims" = '{"sub": "clerk_task_user_a"}';
      `);

      const insertDep = await db.query<{ id: string }>(`
        INSERT INTO public.task_dependencies (task_id, depends_on_task_id)
        VALUES ('${userATaskId}', '${taskA2}')
        RETURNING id;
      `);

      expect(insertDep.rows.length).toBe(1);

      // User B cannot see User A's dependency
      await db.exec(`
        SET ROLE authenticated;
        SET "request.jwt.claim.role" = 'authenticated';
        SET "request.jwt.claims" = '{"sub": "clerk_task_user_b"}';
      `);

      const userBDepQuery = await db.query(`
        SELECT * FROM public.task_dependencies;
      `);
      expect(userBDepQuery.rows.length).toBe(0);

      await db.exec(`
        RESET ROLE;
        SET "request.jwt.claim.role" = 'service_role';
        SET "request.jwt.claims" = '{}';
      `);
    });
  });
});
