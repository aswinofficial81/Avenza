import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Goals & Milestones Database Foundation + RLS', () => {
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

    // 4. Grant schema permissions to authenticated & anon roles
    await db.exec(`
      GRANT USAGE ON SCHEMA public TO authenticated, anon;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
    `);
  }, 30000);

  describe('1. Schema & Table Structure', () => {
    it('creates goals and goal_milestones tables', async () => {
      const res = await db.query<{ table_name: string }>(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('goals', 'goal_milestones')
        ORDER BY table_name;
      `);

      const tables = res.rows.map((r) => r.table_name);
      expect(tables).toEqual(['goal_milestones', 'goals']);
    });

    it('creates expected columns in goals', async () => {
      const res = await db.query<{ column_name: string }>(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'goals'
        ORDER BY ordinal_position;
      `);

      const colNames = res.rows.map((r) => r.column_name);
      expect(colNames).toContain('id');
      expect(colNames).toContain('user_id');
      expect(colNames).toContain('title');
      expect(colNames).toContain('description');
      expect(colNames).toContain('goal_type');
      expect(colNames).toContain('status');
      expect(colNames).toContain('priority');
      expect(colNames).toContain('start_date');
      expect(colNames).toContain('target_date');
      expect(colNames).toContain('completed_at');
      expect(colNames).toContain('desired_outcome');
      expect(colNames).toContain('completion_criteria');
      expect(colNames).toContain('notes');
      expect(colNames).toContain('created_at');
      expect(colNames).toContain('updated_at');
    });

    it('creates expected columns in goal_milestones', async () => {
      const res = await db.query<{ column_name: string }>(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'goal_milestones'
        ORDER BY ordinal_position;
      `);

      const colNames = res.rows.map((r) => r.column_name);
      expect(colNames).toContain('id');
      expect(colNames).toContain('goal_id');
      expect(colNames).toContain('title');
      expect(colNames).toContain('description');
      expect(colNames).toContain('status');
      expect(colNames).toContain('priority');
      expect(colNames).toContain('order_index');
      expect(colNames).toContain('start_date');
      expect(colNames).toContain('target_date');
      expect(colNames).toContain('completed_at');
      expect(colNames).toContain('created_at');
      expect(colNames).toContain('updated_at');
    });
  });

  describe('2. Constraints & Validation', () => {
    let testProfileId: string;

    beforeAll(async () => {
      const res = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_test_constraints_user', 'Constraints User')
        RETURNING id;
      `);
      testProfileId = res.rows[0]?.id as string;
    });

    it('rejects goal with empty title', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.goals (user_id, title, goal_type)
          VALUES ('${testProfileId}', '   ', 'academic');
        `)
      ).rejects.toThrow(/chk_goals_title_non_empty/);
    });

    it('rejects goal with invalid goal_type', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.goals (user_id, title, goal_type)
          VALUES ('${testProfileId}', 'Invalid Type', 'gaming');
        `)
      ).rejects.toThrow(/chk_goals_goal_type/);
    });

    it('rejects goal with invalid status', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.goals (user_id, title, goal_type, status)
          VALUES ('${testProfileId}', 'Invalid Status', 'personal', 'in_progress');
        `)
      ).rejects.toThrow(/chk_goals_status/);
    });

    it('rejects goal with invalid priority', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.goals (user_id, title, goal_type, priority)
          VALUES ('${testProfileId}', 'Invalid Priority', 'career', 'super_high');
        `)
      ).rejects.toThrow(/chk_goals_priority/);
    });

    it('rejects goal where target_date is before start_date', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.goals (user_id, title, goal_type, start_date, target_date)
          VALUES ('${testProfileId}', 'Date Check Goal', 'project', '2026-10-10 00:00:00Z', '2026-10-01 00:00:00Z');
        `)
      ).rejects.toThrow(/chk_goals_dates/);
    });

    it('rejects milestone with negative order_index', async () => {
      const goalRes = await db.query<{ id: string }>(`
        INSERT INTO public.goals (user_id, title, goal_type)
        VALUES ('${testProfileId}', 'Parent Goal', 'project')
        RETURNING id;
      `);
      const goalId = goalRes.rows[0]?.id as string;

      await expect(
        db.exec(`
          INSERT INTO public.goal_milestones (goal_id, title, order_index)
          VALUES ('${goalId}', 'Bad Order Milestone', -1);
        `)
      ).rejects.toThrow(/chk_milestones_order_index/);
    });

    it('rejects milestone where target_date is before start_date', async () => {
      const goalRes = await db.query<{ id: string }>(`
        INSERT INTO public.goals (user_id, title, goal_type)
        VALUES ('${testProfileId}', 'Parent Goal 2', 'project')
        RETURNING id;
      `);
      const goalId = goalRes.rows[0]?.id as string;

      await expect(
        db.exec(`
          INSERT INTO public.goal_milestones (goal_id, title, start_date, target_date)
          VALUES ('${goalId}', 'Date Check Milestone', '2026-10-20 00:00:00Z', '2026-10-15 00:00:00Z');
        `)
      ).rejects.toThrow(/chk_milestones_dates/);
    });
  });

  describe('3. Foreign Keys & Cascading Deletion', () => {
    it('cascades goal deletion to its goal_milestones', async () => {
      const profRes = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_cascade_goal_user', 'Cascade User')
        RETURNING id;
      `);
      const profileId = profRes.rows[0]?.id as string;

      const goalRes = await db.query<{ id: string }>(`
        INSERT INTO public.goals (user_id, title, goal_type)
        VALUES ('${profileId}', 'Goal with Milestones', 'learning')
        RETURNING id;
      `);
      const goalId = goalRes.rows[0]?.id as string;

      await db.exec(`
        INSERT INTO public.goal_milestones (goal_id, title, order_index)
        VALUES 
          ('${goalId}', 'Milestone 1', 0),
          ('${goalId}', 'Milestone 2', 1);
      `);

      // Delete the goal
      await db.exec(`DELETE FROM public.goals WHERE id = '${goalId}';`);

      // Milestones must be cascaded
      const milestoneCheck = await db.query(`
        SELECT * FROM public.goal_milestones WHERE goal_id = '${goalId}';
      `);
      expect(milestoneCheck.rows.length).toBe(0);
    });

    it('cascades profile deletion to goals and their milestones', async () => {
      const profRes = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_full_cascade_user', 'Full Cascade User')
        RETURNING id;
      `);
      const profileId = profRes.rows[0]?.id as string;

      const goalRes = await db.query<{ id: string }>(`
        INSERT INTO public.goals (user_id, title, goal_type)
        VALUES ('${profileId}', 'Cascade Profile Goal', 'career')
        RETURNING id;
      `);
      const goalId = goalRes.rows[0]?.id as string;

      await db.exec(`
        INSERT INTO public.goal_milestones (goal_id, title, order_index)
        VALUES ('${goalId}', 'Cascade Profile Milestone', 0);
      `);

      // Delete the profile
      await db.exec(`DELETE FROM public.profiles WHERE id = '${profileId}';`);

      const goalCheck = await db.query(`SELECT * FROM public.goals WHERE id = '${goalId}';`);
      expect(goalCheck.rows.length).toBe(0);

      const milestoneCheck = await db.query(`SELECT * FROM public.goal_milestones WHERE goal_id = '${goalId}';`);
      expect(milestoneCheck.rows.length).toBe(0);
    });
  });

  describe('4. Timestamps & Triggers', () => {
    it('automatically updates updated_at when goal is modified', async () => {
      const profRes = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_trigger_test_user', 'Trigger User')
        RETURNING id;
      `);
      const profileId = profRes.rows[0]?.id as string;

      const goalRes = await db.query<{ id: string; updated_at: string }>(`
        INSERT INTO public.goals (user_id, title, goal_type, updated_at)
        VALUES ('${profileId}', 'Trigger Goal', 'personal', now() - interval '1 hour')
        RETURNING id, updated_at;
      `);
      const goalId = goalRes.rows[0]?.id as string;
      const initialUpdatedAt = new Date(goalRes.rows[0]?.updated_at as string).getTime();

      await db.exec(`
        UPDATE public.goals SET title = 'Updated Trigger Goal' WHERE id = '${goalId}';
      `);

      const updatedRes = await db.query<{ updated_at: string }>(`
        SELECT updated_at FROM public.goals WHERE id = '${goalId}';
      `);
      const newUpdatedAt = new Date(updatedRes.rows[0]?.updated_at as string).getTime();
      expect(newUpdatedAt).toBeGreaterThan(initialUpdatedAt);
    });
  });

  describe('5. Row Level Security & Cross-User Isolation', () => {
    let userAId: string;
    let goalAId: string;
    let milestoneAId: string;

    beforeAll(async () => {
      // Create User A
      const resA = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_alice', 'Alice')
        RETURNING id;
      `);
      userAId = resA.rows[0]?.id as string;

      // Create User B
      await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_bob', 'Bob')
        RETURNING id;
      `);

      // User A creates Goal A and Milestone A
      const goalRes = await db.query<{ id: string }>(`
        INSERT INTO public.goals (user_id, title, goal_type, priority, status)
        VALUES ('${userAId}', 'Alice Goal', 'learning', 'high', 'active')
        RETURNING id;
      `);
      goalAId = goalRes.rows[0]?.id as string;

      const msRes = await db.query<{ id: string }>(`
        INSERT INTO public.goal_milestones (goal_id, title, order_index)
        VALUES ('${goalAId}', 'Alice Milestone', 0)
        RETURNING id;
      `);
      milestoneAId = msRes.rows[0]?.id as string;
    });

    it('enforces RLS on goals: Bob cannot SELECT, UPDATE, or DELETE Alice goal', async () => {
      // Set context to Bob
      await db.exec(`
        SET ROLE authenticated;
        SET "request.jwt.claim.role" = 'authenticated';
        SET "request.jwt.claims" = '{"sub": "clerk_user_bob"}';
      `);

      // 1. Bob SELECTs goals -> should NOT see Alice's goal
      const bobGoals = await db.query<{ id: string }>(`
        SELECT id FROM public.goals;
      `);
      const visibleIds = bobGoals.rows.map((r) => r.id);
      expect(visibleIds).not.toContain(goalAId);

      // 2. Bob tries to UPDATE Alice's goal -> 0 rows affected
      const updateRes = await db.query(`
        UPDATE public.goals SET title = 'Bob Hacked Goal' WHERE id = '${goalAId}';
      `);
      expect(updateRes.affectedRows).toBe(0);

      // 3. Bob tries to DELETE Alice's goal -> 0 rows affected
      const deleteRes = await db.query(`
        DELETE FROM public.goals WHERE id = '${goalAId}';
      `);
      expect(deleteRes.affectedRows).toBe(0);

      // 4. Bob tries to INSERT a goal specifying Alice's user_id -> should fail check constraint
      await expect(
        db.exec(`
          INSERT INTO public.goals (user_id, title, goal_type)
          VALUES ('${userAId}', 'Bob Spoofed Goal', 'project');
        `)
      ).rejects.toThrow();

      // Reset to service_role to verify Alice's goal is unchanged
      await db.exec(`
        RESET ROLE;
        SET "request.jwt.claim.role" = 'service_role';
        SET "request.jwt.claims" = '{}';
      `);

      const check = await db.query<{ title: string }>(`
        SELECT title FROM public.goals WHERE id = '${goalAId}';
      `);
      expect(check.rows[0]?.title).toBe('Alice Goal');
    });

    it('enforces RLS on goal_milestones: Bob cannot SELECT, INSERT, UPDATE, or DELETE Alice milestone', async () => {
      // Set context to Bob
      await db.exec(`
        SET ROLE authenticated;
        SET "request.jwt.claim.role" = 'authenticated';
        SET "request.jwt.claims" = '{"sub": "clerk_user_bob"}';
      `);

      // 1. Bob SELECTs milestones -> should NOT see Alice's milestone
      const bobMilestones = await db.query<{ id: string }>(`
        SELECT id FROM public.goal_milestones;
      `);
      const visibleIds = bobMilestones.rows.map((r) => r.id);
      expect(visibleIds).not.toContain(milestoneAId);

      // 2. Bob tries to INSERT a milestone into Alice's goal -> should fail RLS check
      await expect(
        db.exec(`
          INSERT INTO public.goal_milestones (goal_id, title, order_index)
          VALUES ('${goalAId}', 'Bob Injected Milestone', 1);
        `)
      ).rejects.toThrow();

      // 3. Bob tries to UPDATE Alice's milestone -> 0 rows affected
      const updateRes = await db.query(`
        UPDATE public.goal_milestones SET title = 'Bob Hacked Milestone' WHERE id = '${milestoneAId}';
      `);
      expect(updateRes.affectedRows).toBe(0);

      // 4. Bob tries to DELETE Alice's milestone -> 0 rows affected
      const deleteRes = await db.query(`
        DELETE FROM public.goal_milestones WHERE id = '${milestoneAId}';
      `);
      expect(deleteRes.affectedRows).toBe(0);

      // Reset to service_role
      await db.exec(`
        RESET ROLE;
        SET "request.jwt.claim.role" = 'service_role';
        SET "request.jwt.claims" = '{}';
      `);

      const check = await db.query<{ title: string }>(`
        SELECT title FROM public.goal_milestones WHERE id = '${milestoneAId}';
      `);
      expect(check.rows[0]?.title).toBe('Alice Milestone');
    });

    it('allows Alice to CRUD her own goals and milestones', async () => {
      // Set context to Alice
      await db.exec(`
        SET ROLE authenticated;
        SET "request.jwt.claim.role" = 'authenticated';
        SET "request.jwt.claims" = '{"sub": "clerk_user_alice"}';
      `);

      // Alice reads her goal
      const aliceGoals = await db.query<{ id: string }>(`
        SELECT id FROM public.goals WHERE id = '${goalAId}';
      `);
      expect(aliceGoals.rows.length).toBe(1);

      // Alice updates her goal
      const updateRes = await db.query(`
        UPDATE public.goals SET description = 'Alice updated description' WHERE id = '${goalAId}';
      `);
      expect(updateRes.affectedRows).toBe(1);

      // Alice creates a second milestone
      const newMsRes = await db.query<{ id: string }>(`
        INSERT INTO public.goal_milestones (goal_id, title, order_index)
        VALUES ('${goalAId}', 'Alice Milestone 2', 1)
        RETURNING id;
      `);
      expect(newMsRes.rows.length).toBe(1);
      const milestone2Id = newMsRes.rows[0]?.id as string;

      // Alice reads both milestones
      const aliceMilestones = await db.query<{ id: string }>(`
        SELECT id FROM public.goal_milestones WHERE goal_id = '${goalAId}' ORDER BY order_index;
      `);
      expect(aliceMilestones.rows.length).toBe(2);

      // Alice deletes milestone 2
      const deleteMsRes = await db.query(`
        DELETE FROM public.goal_milestones WHERE id = '${milestone2Id}';
      `);
      expect(deleteMsRes.affectedRows).toBe(1);

      // Reset role
      await db.exec(`
        RESET ROLE;
        SET "request.jwt.claim.role" = 'service_role';
        SET "request.jwt.claims" = '{}';
      `);
    });
  });
});
