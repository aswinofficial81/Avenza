import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CAREER_APPLICATION_STAGES,
  CAREER_EMPLOYMENT_TYPES,
  CAREER_INTERVIEW_RESULTS,
  CAREER_INTERVIEW_STATUSES,
  CAREER_INTERVIEW_TYPES,
  CAREER_LOCATION_TYPES,
  CAREER_OPPORTUNITY_SOURCES,
  CAREER_OPPORTUNITY_STATUSES,
  CAREER_SKILL_IMPORTANCES,
} from '@avenza/shared';

describe('Phase 16A Career Domain Database Foundation, Integrity & RLS', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Establish Supabase auth schema and mock auth functions in embedded Postgres
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
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role;
        END IF;
      END
      $$;
    `);

    // 2. Apply all migrations in sequence (1 through 16)
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
  }, 180000);

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

  const asServiceRole = async <T>(callback: () => Promise<T> = async () => ({} as T)): Promise<T> => {
    await db.exec(`
      RESET ROLE;
      SET "request.jwt.claim.role" = 'service_role';
      SET "request.jwt.claims" = '{}';
    `);
    return callback();
  };

  // 1. Schema & Foundation Creation
  it('1. creates career domain tables and validates defaults', async () => {
    await asServiceRole(async () => {
      const uRes = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_career_user_1', 'Career Explorer')
        RETURNING id;
      `);
      const userId = uRes.rows[0]!.id;

      // 1a. Career Target
      const targetRes = await db.query<{ id: string; is_primary: boolean }>(`
        INSERT INTO public.career_targets (user_id, title, target_role, employment_type, min_compensation, currency, is_primary)
        VALUES ('${userId}', 'Staff Engineer Path', 'Staff Software Engineer', 'full_time', 200000.00, 'USD', true)
        RETURNING id, is_primary;
      `);
      expect(targetRes.rows).toHaveLength(1);
      const targetId = targetRes.rows[0]!.id;
      expect(targetRes.rows[0]!.is_primary).toBe(true);

      // 1b. Career Target Skill
      const skillRes = await db.query<{ id: string }>(`
        INSERT INTO public.skills (user_id, name, slug)
        VALUES ('${userId}', 'Distributed Systems', 'distributed-systems')
        RETURNING id;
      `);
      const skillId = skillRes.rows[0]!.id;

      const targetSkillRes = await db.query<{ id: string; importance: string }>(`
        INSERT INTO public.career_target_skills (user_id, target_id, skill_id, importance)
        VALUES ('${userId}', '${targetId}', '${skillId}', 'required')
        RETURNING id, importance;
      `);
      expect(targetSkillRes.rows).toHaveLength(1);
      expect(targetSkillRes.rows[0]!.importance).toBe('required');

      // 1c. Career Opportunity
      const oppRes = await db.query<{ id: string; status: string }>(`
        INSERT INTO public.career_opportunities (user_id, target_id, company_name, role_title, employment_type, location_type, salary_min, salary_max, salary_currency)
        VALUES ('${userId}', '${targetId}', 'Acme AI', 'Principal Architect', 'full_time', 'remote', 220000.00, 260000.00, 'USD')
        RETURNING id, status;
      `);
      expect(oppRes.rows).toHaveLength(1);
      const oppId = oppRes.rows[0]!.id;
      expect(oppRes.rows[0]!.status).toBe('active');

      // 1d. Career Opportunity Skill
      const oppSkillRes = await db.query<{ id: string }>(`
        INSERT INTO public.career_opportunity_skills (user_id, opportunity_id, skill_id, importance)
        VALUES ('${userId}', '${oppId}', '${skillId}', 'required')
        RETURNING id;
      `);
      expect(oppSkillRes.rows).toHaveLength(1);

      // 1e. Career Application
      const appRes = await db.query<{ id: string; stage: string }>(`
        INSERT INTO public.career_applications (user_id, opportunity_id, stage)
        VALUES ('${userId}', '${oppId}', 'applied')
        RETURNING id, stage;
      `);
      expect(appRes.rows).toHaveLength(1);
      const appId = appRes.rows[0]!.id;
      expect(appRes.rows[0]!.stage).toBe('applied');

      // 1f. Career Application History
      const histRes = await db.query<{ id: string; from_stage: string | null; to_stage: string }>(`
        INSERT INTO public.career_application_history (user_id, application_id, from_stage, to_stage)
        VALUES ('${userId}', '${appId}', 'saved', 'applied')
        RETURNING id, from_stage, to_stage;
      `);
      expect(histRes.rows).toHaveLength(1);
      expect(histRes.rows[0]!.to_stage).toBe('applied');

      // 1g. Career Application Project
      const projRes = await db.query<{ id: string }>(`
        INSERT INTO public.projects (user_id, title, slug)
        VALUES ('${userId}', 'Vector Index Engine', 'vector-index-engine')
        RETURNING id;
      `);
      const projId = projRes.rows[0]!.id;

      const appProjRes = await db.query<{ id: string; is_featured: boolean }>(`
        INSERT INTO public.career_application_projects (user_id, application_id, project_id, is_featured, talking_points)
        VALUES ('${userId}', '${appId}', '${projId}', true, 'Discussed zero-copy SIMD performance')
        RETURNING id, is_featured;
      `);
      expect(appProjRes.rows).toHaveLength(1);
      expect(appProjRes.rows[0]!.is_featured).toBe(true);

      // 1h. Career Interview
      const interviewRes = await db.query<{ id: string; round_number: number; round_type: string; status: string }>(`
        INSERT INTO public.career_interviews (user_id, application_id, round_number, round_type, status, duration_minutes)
        VALUES ('${userId}', '${appId}', 1, 'technical_dsa', 'scheduled', 60)
        RETURNING id, round_number, round_type, status;
      `);
      expect(interviewRes.rows).toHaveLength(1);
      expect(interviewRes.rows[0]!.round_number).toBe(1);
      expect(interviewRes.rows[0]!.round_type).toBe('technical_dsa');

      // 1i. Task linked to Career Application
      const taskRes = await db.query<{ id: string; application_id: string }>(`
        INSERT INTO public.tasks (user_id, title, application_id)
        VALUES ('${userId}', 'Prepare DSA System Design Collateral', '${appId}')
        RETURNING id, application_id;
      `);
      expect(taskRes.rows).toHaveLength(1);
      expect(taskRes.rows[0]!.application_id).toBe(appId);
    });
  });

  // A & B: RLS Isolation (SELECT, INSERT, UPDATE, DELETE)
  it('A & B: enforces strict RLS isolation across users', async () => {
    let aliceId = '';
    let bobId = '';
    let aliceTargetId = '';
    let aliceOppId = '';
    let aliceAppId = '';

    await asServiceRole(async () => {
      const uA = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_alice_career', 'Alice')
        RETURNING id;
      `);
      aliceId = uA.rows[0]!.id;

      const uB = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_bob_career', 'Bob')
        RETURNING id;
      `);
      bobId = uB.rows[0]!.id;

      const tA = await db.query<{ id: string }>(`
        INSERT INTO public.career_targets (user_id, title, target_role)
        VALUES ('${aliceId}', 'Alice Target', 'Security Engineer')
        RETURNING id;
      `);
      aliceTargetId = tA.rows[0]!.id;

      const oA = await db.query<{ id: string }>(`
        INSERT INTO public.career_opportunities (user_id, target_id, company_name, role_title)
        VALUES ('${aliceId}', '${aliceTargetId}', 'Alice Company', 'SecOps Lead')
        RETURNING id;
      `);
      aliceOppId = oA.rows[0]!.id;

      const aA = await db.query<{ id: string }>(`
        INSERT INTO public.career_applications (user_id, opportunity_id, stage)
        VALUES ('${aliceId}', '${aliceOppId}', 'applied')
        RETURNING id;
      `);
      aliceAppId = aA.rows[0]!.id;
    });

    // Bob tests RLS restrictions against Alice's resources
    await asUser('clerk_bob_career', 'authenticated', async () => {
      // 1. Bob cannot SELECT Alice's targets
      const targets = await db.query<{ id: string }>(`SELECT id FROM public.career_targets;`);
      expect(targets.rows.map((r) => r.id)).not.toContain(aliceTargetId);

      // 2. Bob cannot SELECT Alice's opportunities
      const opps = await db.query<{ id: string }>(`SELECT id FROM public.career_opportunities;`);
      expect(opps.rows.map((r) => r.id)).not.toContain(aliceOppId);

      // 3. Bob cannot SELECT Alice's applications
      const apps = await db.query<{ id: string }>(`SELECT id FROM public.career_applications;`);
      expect(apps.rows.map((r) => r.id)).not.toContain(aliceAppId);

      // 4. Bob cannot UPDATE Alice's target
      const updateTargetRes = await db.query(`
        UPDATE public.career_targets SET title = 'Bob Tampered' WHERE id = '${aliceTargetId}';
      `);
      expect(updateTargetRes.affectedRows).toBe(0);

      // 5. Bob cannot DELETE Alice's opportunity
      const deleteOppRes = await db.query(`
        DELETE FROM public.career_opportunities WHERE id = '${aliceOppId}';
      `);
      expect(deleteOppRes.affectedRows).toBe(0);

      // 6. Bob cannot INSERT a Career Target using Alice's user_id
      await expect(
        db.query(`
          INSERT INTO public.career_targets (user_id, title, target_role)
          VALUES ('${aliceId}', 'Bob Impersonating Alice', 'Intruder');
        `)
      ).rejects.toThrow();

      // 7. Bob CAN insert his own Career Target with his own bobId
      const bobTarget = await db.query<{ id: string }>(`
        INSERT INTO public.career_targets (user_id, title, target_role)
        VALUES ('${bobId}', 'Bob Target', 'DevOps Specialist')
        RETURNING id;
      `);
      expect(bobTarget.rows[0]!.id).toBeDefined();
    });
  });

  // C: Target -> Goal ownership validation
  it('C: prevents attaching another user goal to career target', async () => {
    let aliceId = '';
    let bobId = '';
    let bobGoalId = '';

    await asServiceRole(async () => {
      const uA = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_c_alice', 'Alice')
        RETURNING id;
      `);
      aliceId = uA.rows[0]!.id;

      const uB = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_c_bob', 'Bob')
        RETURNING id;
      `);
      bobId = uB.rows[0]!.id;

      const gB = await db.query<{ id: string }>(`
        INSERT INTO public.goals (user_id, title, goal_type)
        VALUES ('${bobId}', 'Bob Career Goal', 'career')
        RETURNING id;
      `);
      bobGoalId = gB.rows[0]!.id;
    });

    // Alice tries to link Bob's goal to her career target -> rejected by trigger
    await expect(
      db.query(`
        INSERT INTO public.career_targets (user_id, goal_id, title, target_role)
        VALUES ('${aliceId}', '${bobGoalId}', 'Alice Target', 'Engineer');
      `)
    ).rejects.toThrow(/must belong to the same user as the career target/);
  });

  // D: Target Skill & Opportunity Skill -> Skill ownership validation
  it('D: prevents attaching another user skill to target or opportunity', async () => {
    let aliceId = '';
    let bobId = '';
    let aliceTargetId = '';
    let aliceOppId = '';
    let bobSkillId = '';

    await asServiceRole(async () => {
      const uA = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_d_alice', 'Alice')
        RETURNING id;
      `);
      aliceId = uA.rows[0]!.id;

      const uB = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_d_bob', 'Bob')
        RETURNING id;
      `);
      bobId = uB.rows[0]!.id;

      const tA = await db.query<{ id: string }>(`
        INSERT INTO public.career_targets (user_id, title, target_role)
        VALUES ('${aliceId}', 'Alice Target', 'Frontend Lead')
        RETURNING id;
      `);
      aliceTargetId = tA.rows[0]!.id;

      const oA = await db.query<{ id: string }>(`
        INSERT INTO public.career_opportunities (user_id, target_id, company_name, role_title)
        VALUES ('${aliceId}', '${aliceTargetId}', 'Tech Corp', 'Staff Frontend')
        RETURNING id;
      `);
      aliceOppId = oA.rows[0]!.id;

      const sB = await db.query<{ id: string }>(`
        INSERT INTO public.skills (user_id, name, slug)
        VALUES ('${bobId}', 'Rust Programming', 'rust-programming')
        RETURNING id;
      `);
      bobSkillId = sB.rows[0]!.id;
    });

    // Alice linking Bob's skill to her target -> rejected
    await expect(
      db.query(`
        INSERT INTO public.career_target_skills (user_id, target_id, skill_id)
        VALUES ('${aliceId}', '${aliceTargetId}', '${bobSkillId}');
      `)
    ).rejects.toThrow(/User ID must match across career target, skill/);

    // Alice linking Bob's skill to her opportunity -> rejected
    await expect(
      db.query(`
        INSERT INTO public.career_opportunity_skills (user_id, opportunity_id, skill_id)
        VALUES ('${aliceId}', '${aliceOppId}', '${bobSkillId}');
      `)
    ).rejects.toThrow(/User ID must match across career opportunity, skill/);
  });

  // E: Application Project -> Project ownership validation
  it('E: prevents attaching another user project to application collateral', async () => {
    let aliceId = '';
    let bobId = '';
    let aliceAppId = '';
    let bobProjectId = '';

    await asServiceRole(async () => {
      const uA = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_e_alice', 'Alice')
        RETURNING id;
      `);
      aliceId = uA.rows[0]!.id;

      const uB = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_e_bob', 'Bob')
        RETURNING id;
      `);
      bobId = uB.rows[0]!.id;

      const oA = await db.query<{ id: string }>(`
        INSERT INTO public.career_opportunities (user_id, company_name, role_title)
        VALUES ('${aliceId}', 'Startup Hub', 'CTO')
        RETURNING id;
      `);
      const oppId = oA.rows[0]!.id;

      const aA = await db.query<{ id: string }>(`
        INSERT INTO public.career_applications (user_id, opportunity_id)
        VALUES ('${aliceId}', '${oppId}')
        RETURNING id;
      `);
      aliceAppId = aA.rows[0]!.id;

      const pB = await db.query<{ id: string }>(`
        INSERT INTO public.projects (user_id, title, slug)
        VALUES ('${bobId}', 'Bob Proprietary Core', 'bob-core')
        RETURNING id;
      `);
      bobProjectId = pB.rows[0]!.id;
    });

    // Alice linking Bob's project to her application -> rejected
    await expect(
      db.query(`
        INSERT INTO public.career_application_projects (user_id, application_id, project_id)
        VALUES ('${aliceId}', '${aliceAppId}', '${bobProjectId}');
      `)
    ).rejects.toThrow(/User ID must match across career application, project/);
  });

  // F: Opportunity -> Target & Application -> Opportunity ownership validation
  it('F: prevents cross-user target-opportunity and opportunity-application linkages', async () => {
    let aliceId = '';
    let bobId = '';
    let bobTargetId = '';
    let bobOppId = '';

    await asServiceRole(async () => {
      const uA = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_f_alice', 'Alice')
        RETURNING id;
      `);
      aliceId = uA.rows[0]!.id;

      const uB = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_f_bob', 'Bob')
        RETURNING id;
      `);
      bobId = uB.rows[0]!.id;

      const tB = await db.query<{ id: string }>(`
        INSERT INTO public.career_targets (user_id, title, target_role)
        VALUES ('${bobId}', 'Bob Target', 'Manager')
        RETURNING id;
      `);
      bobTargetId = tB.rows[0]!.id;

      const oB = await db.query<{ id: string }>(`
        INSERT INTO public.career_opportunities (user_id, target_id, company_name, role_title)
        VALUES ('${bobId}', '${bobTargetId}', 'Enterprise Inc', 'VP Eng')
        RETURNING id;
      `);
      bobOppId = oB.rows[0]!.id;
    });

    // Alice creating opportunity referencing Bob's target -> rejected
    await expect(
      db.query(`
        INSERT INTO public.career_opportunities (user_id, target_id, company_name, role_title)
        VALUES ('${aliceId}', '${bobTargetId}', 'Rival Inc', 'Director');
      `)
    ).rejects.toThrow(/must belong to the same user as the career opportunity/);

    // Alice creating application referencing Bob's opportunity -> rejected
    await expect(
      db.query(`
        INSERT INTO public.career_applications (user_id, opportunity_id)
        VALUES ('${aliceId}', '${bobOppId}');
      `)
    ).rejects.toThrow(/Career application must belong to the same user as the opportunity/);
  });

  // G: Task -> Career Application ownership validation
  it('G: prevents attaching an application from another user to a task', async () => {
    let aliceId = '';
    let bobId = '';
    let bobAppId = '';

    await asServiceRole(async () => {
      const uA = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_g_alice', 'Alice')
        RETURNING id;
      `);
      aliceId = uA.rows[0]!.id;

      const uB = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_g_bob', 'Bob')
        RETURNING id;
      `);
      bobId = uB.rows[0]!.id;

      const oB = await db.query<{ id: string }>(`
        INSERT INTO public.career_opportunities (user_id, company_name, role_title)
        VALUES ('${bobId}', 'Big Tech', 'L6 Eng')
        RETURNING id;
      `);
      const oppId = oB.rows[0]!.id;

      const aB = await db.query<{ id: string }>(`
        INSERT INTO public.career_applications (user_id, opportunity_id)
        VALUES ('${bobId}', '${oppId}')
        RETURNING id;
      `);
      bobAppId = aB.rows[0]!.id;
    });

    // Alice creates task with Bob's application_id -> rejected
    await expect(
      db.query(`
        INSERT INTO public.tasks (user_id, title, application_id)
        VALUES ('${aliceId}', 'Hijack Bob Application Prep', '${bobAppId}');
      `)
    ).rejects.toThrow(/Referenced career application must belong to the same user as the task/);
  });

  // H: Safe failure on nonexistent references
  it('H: ensures invalid foreign references fail safely', async () => {
    const nonexistentId = '00000000-0000-0000-0000-000000000000';
    let userId = '';

    await asServiceRole(async () => {
      const u = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_h_safe', 'Safe Tester')
        RETURNING id;
      `);
      userId = u.rows[0]!.id;
    });

    // Invalid target_id on opportunity
    await expect(
      db.query(`
        INSERT INTO public.career_opportunities (user_id, target_id, company_name, role_title)
        VALUES ('${userId}', '${nonexistentId}', 'Company', 'Role');
      `)
    ).rejects.toThrow(/Referenced career target does not exist/);

    // Invalid application_id on task
    await expect(
      db.query(`
        INSERT INTO public.tasks (user_id, title, application_id)
        VALUES ('${userId}', 'Study Task', '${nonexistentId}');
      `)
    ).rejects.toThrow(/Referenced career application does not exist/);
  });

  // I: Immutable audit trail for application stage history
  it('I: enforces immutability on application stage history (rejects updates)', async () => {
    let userId = '';
    let appId = '';
    let historyId = '';

    await asServiceRole(async () => {
      const u = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_i_audit', 'Audit Tester')
        RETURNING id;
      `);
      userId = u.rows[0]!.id;

      const opp = await db.query<{ id: string }>(`
        INSERT INTO public.career_opportunities (user_id, company_name, role_title)
        VALUES ('${userId}', 'FinTech Co', 'Software Engineer')
        RETURNING id;
      `);

      const app = await db.query<{ id: string }>(`
        INSERT INTO public.career_applications (user_id, opportunity_id, stage)
        VALUES ('${userId}', '${opp.rows[0]!.id}', 'interview')
        RETURNING id;
      `);
      appId = app.rows[0]!.id;

      const hist = await db.query<{ id: string }>(`
        INSERT INTO public.career_application_history (user_id, application_id, from_stage, to_stage)
        VALUES ('${userId}', '${appId}', 'screening', 'interview')
        RETURNING id;
      `);
      historyId = hist.rows[0]!.id;
    });

    // Attempting to mutate history record -> blocked by trigger
    await expect(
      db.query(`
        UPDATE public.career_application_history
        SET to_stage = 'offer'
        WHERE id = '${historyId}';
      `)
    ).rejects.toThrow(/career_application_history records are immutable and cannot be updated/);
  });

  // J: Application deletion preserves linked tasks with application_id set to NULL
  it('J: deleting career application preserves linked tasks and clears application_id', async () => {
    let userId = '';
    let appId = '';
    let taskId = '';

    await asServiceRole(async () => {
      const u = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_j_preserve', 'Preserve Tester')
        RETURNING id;
      `);
      userId = u.rows[0]!.id;

      const opp = await db.query<{ id: string }>(`
        INSERT INTO public.career_opportunities (user_id, company_name, role_title)
        VALUES ('${userId}', 'Cloud Services', 'Cloud Architect')
        RETURNING id;
      `);

      const app = await db.query<{ id: string }>(`
        INSERT INTO public.career_applications (user_id, opportunity_id)
        VALUES ('${userId}', '${opp.rows[0]!.id}')
        RETURNING id;
      `);
      appId = app.rows[0]!.id;

      const task = await db.query<{ id: string }>(`
        INSERT INTO public.tasks (user_id, title, application_id)
        VALUES ('${userId}', 'System Architecture Deep Dive', '${appId}')
        RETURNING id;
      `);
      taskId = task.rows[0]!.id;

      // Delete the application
      await db.query(`DELETE FROM public.career_applications WHERE id = '${appId}';`);

      // Verify the task still exists and application_id became NULL
      const taskAfter = await db.query<{ id: string; application_id: string | null }>(`
        SELECT id, application_id FROM public.tasks WHERE id = '${taskId}';
      `);
      expect(taskAfter.rows).toHaveLength(1);
      expect(taskAfter.rows[0]!.application_id).toBeNull();
    });
  });

  // K: Deleting Goal preserves Career Target with goal_id set to NULL
  it('K: deleting goal preserves linked career target and nullifies goal_id', async () => {
    let userId = '';
    let goalId = '';
    let targetId = '';

    await asServiceRole(async () => {
      const u = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_k_goal', 'Goal Preserver')
        RETURNING id;
      `);
      userId = u.rows[0]!.id;

      const goal = await db.query<{ id: string }>(`
        INSERT INTO public.goals (user_id, title, goal_type)
        VALUES ('${userId}', 'Become Senior SRE', 'career')
        RETURNING id;
      `);
      goalId = goal.rows[0]!.id;

      const target = await db.query<{ id: string }>(`
        INSERT INTO public.career_targets (user_id, goal_id, title, target_role)
        VALUES ('${userId}', '${goalId}', 'Senior SRE Target', 'Site Reliability Engineer')
        RETURNING id;
      `);
      targetId = target.rows[0]!.id;

      // Delete the goal
      await db.query(`DELETE FROM public.goals WHERE id = '${goalId}';`);

      // Verify the career target survived and goal_id became NULL
      const targetAfter = await db.query<{ id: string; goal_id: string | null }>(`
        SELECT id, goal_id FROM public.career_targets WHERE id = '${targetId}';
      `);
      expect(targetAfter.rows).toHaveLength(1);
      expect(targetAfter.rows[0]!.goal_id).toBeNull();
    });
  });

  // L: Primary Career Target uniqueness enforced per user
  it('L: enforces at most one primary career target per user via partial unique index', async () => {
    let aliceId = '';
    let bobId = '';

    await asServiceRole(async () => {
      const uA = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_l_alice', 'Alice Primary')
        RETURNING id;
      `);
      aliceId = uA.rows[0]!.id;

      const uB = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_l_bob', 'Bob Primary')
        RETURNING id;
      `);
      bobId = uB.rows[0]!.id;

      // Alice sets her first primary target -> succeeds
      await db.query(`
        INSERT INTO public.career_targets (user_id, title, target_role, is_primary)
        VALUES ('${aliceId}', 'Primary Target 1', 'Lead Architect', true);
      `);

      // Alice tries to insert a second primary target -> rejected by partial unique index
      await expect(
        db.query(`
          INSERT INTO public.career_targets (user_id, title, target_role, is_primary)
          VALUES ('${aliceId}', 'Primary Target 2', 'Staff Architect', true);
        `)
      ).rejects.toThrow(/uq_career_targets_user_primary/);

      // Alice CAN insert non-primary targets
      const nonPrimary = await db.query<{ id: string }>(`
        INSERT INTO public.career_targets (user_id, title, target_role, is_primary)
        VALUES ('${aliceId}', 'Secondary Target', 'Advisory Architect', false)
        RETURNING id;
      `);
      expect(nonPrimary.rows[0]!.id).toBeDefined();

      // Bob CAN set his own primary target (tenant-isolated uniqueness)
      const bobPrimary = await db.query<{ id: string }>(`
        INSERT INTO public.career_targets (user_id, title, target_role, is_primary)
        VALUES ('${bobId}', 'Bob Primary Target', 'ML Engineer', true)
        RETURNING id;
      `);
      expect(bobPrimary.rows[0]!.id).toBeDefined();
    });
  });

  // Data Integrity: Cascades and Restrictions
  it('validates cascades and restrictions across skill, project, and profile deletions', async () => {
    let userId = '';
    let skillId = '';
    let projectId = '';
    let targetId = '';
    let oppId = '';
    let appId = '';

    await asServiceRole(async () => {
      const u = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_integrity', 'Integrity Tester')
        RETURNING id;
      `);
      userId = u.rows[0]!.id;

      const s = await db.query<{ id: string }>(`
        INSERT INTO public.skills (user_id, name, slug)
        VALUES ('${userId}', 'GraphQL APIs', 'graphql-apis')
        RETURNING id;
      `);
      skillId = s.rows[0]!.id;

      const p = await db.query<{ id: string }>(`
        INSERT INTO public.projects (user_id, title, slug)
        VALUES ('${userId}', 'GraphQL Gateway', 'graphql-gateway')
        RETURNING id;
      `);
      projectId = p.rows[0]!.id;

      const t = await db.query<{ id: string }>(`
        INSERT INTO public.career_targets (user_id, title, target_role)
        VALUES ('${userId}', 'API Lead', 'API Architect')
        RETURNING id;
      `);
      targetId = t.rows[0]!.id;

      // Link skill to target
      await db.query(`
        INSERT INTO public.career_target_skills (user_id, target_id, skill_id)
        VALUES ('${userId}', '${targetId}', '${skillId}');
      `);

      const o = await db.query<{ id: string }>(`
        INSERT INTO public.career_opportunities (user_id, target_id, company_name, role_title)
        VALUES ('${userId}', '${targetId}', 'Gateway Co', 'Lead Backend')
        RETURNING id;
      `);
      oppId = o.rows[0]!.id;

      const a = await db.query<{ id: string }>(`
        INSERT INTO public.career_applications (user_id, opportunity_id)
        VALUES ('${userId}', '${oppId}')
        RETURNING id;
      `);
      appId = a.rows[0]!.id;

      // Link project to application
      await db.query(`
        INSERT INTO public.career_application_projects (user_id, application_id, project_id)
        VALUES ('${userId}', '${appId}', '${projectId}');
      `);

      // 1. Deleting Skill is BLOCKED by ON DELETE RESTRICT from career_target_skills
      await expect(
        db.query(`DELETE FROM public.skills WHERE id = '${skillId}';`)
      ).rejects.toThrow();

      // 2. Deleting Project is BLOCKED by ON DELETE RESTRICT from career_application_projects
      await expect(
        db.query(`DELETE FROM public.projects WHERE id = '${projectId}';`)
      ).rejects.toThrow();

      // 3. Deleting Profile cascades and cleans up all Career tables
      await db.query(`DELETE FROM public.profiles WHERE id = '${userId}';`);

      const targetsLeft = await db.query(`SELECT id FROM public.career_targets WHERE user_id = '${userId}';`);
      expect(targetsLeft.rows).toHaveLength(0);

      const oppsLeft = await db.query(`SELECT id FROM public.career_opportunities WHERE user_id = '${userId}';`);
      expect(oppsLeft.rows).toHaveLength(0);

      const appsLeft = await db.query(`SELECT id FROM public.career_applications WHERE user_id = '${userId}';`);
      expect(appsLeft.rows).toHaveLength(0);
    });
  });

  // ============================================================================
  // 14. Phase 16B Enum Parity Verification
  // ============================================================================
  it('14. asserts 100% parity between PostgreSQL enums and shared contract enums', async () => {
    const enumRes = await db.query<{ typname: string; labels: string[] }>(`
      SELECT
        t.typname,
        array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname LIKE 'career_%'
      GROUP BY t.typname;
    `);

    const dbEnums: Record<string, string[]> = {};
    for (const r of enumRes.rows) {
      dbEnums[r.typname] = r.labels;
    }

    expect(dbEnums['career_employment_type']).toEqual([...CAREER_EMPLOYMENT_TYPES]);
    expect(dbEnums['career_location_type']).toEqual([...CAREER_LOCATION_TYPES]);
    expect(dbEnums['career_opportunity_source']).toEqual([...CAREER_OPPORTUNITY_SOURCES]);
    expect(dbEnums['career_opportunity_status']).toEqual([...CAREER_OPPORTUNITY_STATUSES]);
    expect(dbEnums['career_application_stage']).toEqual([...CAREER_APPLICATION_STAGES]);
    expect(dbEnums['career_interview_type']).toEqual([...CAREER_INTERVIEW_TYPES]);
    expect(dbEnums['career_interview_status']).toEqual([...CAREER_INTERVIEW_STATUSES]);
    expect(dbEnums['career_interview_result']).toEqual([...CAREER_INTERVIEW_RESULTS]);
    expect(dbEnums['career_skill_importance']).toEqual([...CAREER_SKILL_IMPORTANCES]);
  });

  // ============================================================================
  // 15. Phase 16B Transaction-Safe Primary Target Operations
  // ============================================================================
  it('15. verifies career_create_target transaction safety and rollback on failure', async () => {
    await asServiceRole(async () => {
      const uRes = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_career_atomic_user', 'Atomic Tester')
        RETURNING id;
      `);
      const userId = uRes.rows[0]!.id;

      // 1. Create initial primary target
      const t1 = await db.query<{ id: string; is_primary: boolean }>(`
        SELECT id, is_primary FROM public.career_create_target(
          '${userId}',
          'Target A',
          'Staff SWE',
          '{}',
          'full_time',
          NULL,
          NULL,
          NULL,
          TRUE,
          NULL,
          NULL
        );
      `);
      expect(t1.rows[0]!.is_primary).toBe(true);
      const t1Id = t1.rows[0]!.id;

      // 2. Create second primary target - should atomically switch primary
      const t2 = await db.query<{ id: string; is_primary: boolean }>(`
        SELECT id, is_primary FROM public.career_create_target(
          '${userId}',
          'Target B',
          'Principal SWE',
          '{}',
          'full_time',
          NULL,
          NULL,
          NULL,
          TRUE,
          NULL,
          NULL
        );
      `);
      expect(t2.rows[0]!.is_primary).toBe(true);
      const t2Id = t2.rows[0]!.id;

      // Verify Target A was unset
      const t1Check = await db.query<{ is_primary: boolean }>(`
        SELECT is_primary FROM public.career_targets WHERE id = '${t1Id}';
      `);
      expect(t1Check.rows[0]!.is_primary).toBe(false);

      // 3. Attempt to create target C with is_primary = true with an INVALID title (violating CHECK constraint)
      // Transaction MUST rollback completely, leaving Target B as primary
      await expect(
        db.query(`
          SELECT id FROM public.career_create_target(
            '${userId}',
            '', -- Invalid title! Violates length(trim(title)) > 0
            'Invalid Role',
            '{}',
            'full_time',
            NULL,
            NULL,
            NULL,
            TRUE,
            NULL,
            NULL
          );
        `)
      ).rejects.toThrow();

      // Verify Target B is STILL primary (did not get unset by aborted operation!)
      const t2CheckAfterAbort = await db.query<{ is_primary: boolean }>(`
        SELECT is_primary FROM public.career_targets WHERE id = '${t2Id}';
      `);
      expect(t2CheckAfterAbort.rows[0]!.is_primary).toBe(true);

      // 4. Switch Target A back to primary via career_set_target_primary
      const switched = await db.query<{ id: string; is_primary: boolean }>(`
        SELECT id, is_primary FROM public.career_set_target_primary('${userId}', '${t1Id}');
      `);
      expect(switched.rows[0]!.is_primary).toBe(true);

      const t2AfterSwitch = await db.query<{ is_primary: boolean }>(`
        SELECT is_primary FROM public.career_targets WHERE id = '${t2Id}';
      `);
      expect(t2AfterSwitch.rows[0]!.is_primary).toBe(false);
    });
  });

  // ============================================================================
  // 16. Phase 16B Transaction-Safe Application & History Operations
  // ============================================================================
  it('16. verifies atomic career_create_application and stage transition with history', async () => {
    await asServiceRole(async () => {
      const uRes = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_career_app_atomic', 'App Atomic Tester')
        RETURNING id;
      `);
      const userId = uRes.rows[0]!.id;

      const oppRes = await db.query<{ id: string }>(`
        INSERT INTO public.career_opportunities (user_id, company_name, role_title)
        VALUES ('${userId}', 'Stripe', 'Staff Infrastructure')
        RETURNING id;
      `);
      const oppId = oppRes.rows[0]!.id;

      // 1. Create application and initial history atomically
      const createdRes = await db.query<{ career_create_application: { application: { id: string; stage: string }; history: { id: string; to_stage: string } } }>(`
        SELECT public.career_create_application(
          '${userId}',
          '${oppId}',
          'saved',
          NULL,
          NULL,
          NULL,
          NULL,
          'Test notes',
          NULL,
          'Initial entry'
        );
      `);
      const createdData = createdRes.rows[0]!.career_create_application;
      expect(createdData.application.stage).toBe('saved');
      expect(createdData.history.to_stage).toBe('saved');
      const appId = createdData.application.id;

      // 2. Update stage with transition history atomically
      const updatedRes = await db.query<{ career_update_application_stage_with_history: { application: { stage: string }; history: { from_stage: string; to_stage: string; notes: string } } }>(`
        SELECT public.career_update_application_stage_with_history(
          '${userId}',
          '${appId}',
          'applied',
          'Submitted application with referral'
        );
      `);
      const updatedData = updatedRes.rows[0]!.career_update_application_stage_with_history;
      expect(updatedData.application.stage).toBe('applied');
      expect(updatedData.history.from_stage).toBe('saved');
      expect(updatedData.history.to_stage).toBe('applied');
      expect(updatedData.history.notes).toBe('Submitted application with referral');

      // 3. Verify history count in table
      const histRows = await db.query<{ to_stage: string }>(`
        SELECT to_stage FROM public.career_application_history
        WHERE application_id = '${appId}'
        ORDER BY changed_at DESC;
      `);
      expect(histRows.rows).toHaveLength(2);
      expect(histRows.rows[0]!.to_stage).toBe('applied');
      expect(histRows.rows[1]!.to_stage).toBe('saved');
    });
  });

  // ============================================================================
  // 17. Concurrency & Single-Primary Partial Index Invariant
  // ============================================================================
  it('17. verifies concurrent primary operations preserve single-primary invariant and partial index', async () => {
    await asServiceRole(async () => {
      const uRes = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_career_concurrency_user', 'Concurrency Tester')
        RETURNING id;
      `);
      const userId = uRes.rows[0]!.id;

      // Create 3 targets
      await db.query<{ id: string }>(`
        SELECT id FROM public.career_create_target('${userId}', 'Target 1', 'Role 1', '{}', 'full_time', NULL, NULL, NULL, TRUE);
      `);
      const t2 = await db.query<{ id: string }>(`
        SELECT id FROM public.career_create_target('${userId}', 'Target 2', 'Role 2', '{}', 'full_time', NULL, NULL, NULL, FALSE);
      `);
      const t3 = await db.query<{ id: string }>(`
        SELECT id FROM public.career_create_target('${userId}', 'Target 3', 'Role 3', '{}', 'full_time', NULL, NULL, NULL, FALSE);
      `);

      const t2Id = t2.rows[0]!.id;
      const t3Id = t3.rows[0]!.id;

      // Concurrently promote targets 2 and 3 using career_set_target_primary
      await Promise.all([
        db.query(`SELECT public.career_set_target_primary('${userId}', '${t2Id}');`),
        db.query(`SELECT public.career_set_target_primary('${userId}', '${t3Id}');`),
      ]);

      // Assert database invariant: exactly one primary target exists
      const primaries = await db.query<{ id: string }>(`
        SELECT id FROM public.career_targets
        WHERE user_id = '${userId}' AND is_primary = TRUE;
      `);
      expect(primaries.rows).toHaveLength(1);
      expect([t2Id, t3Id]).toContain(primaries.rows[0]!.id);
    });
  });

  // ============================================================================
  // 18. Phase 16B RPC Security Hardening Verification
  // ============================================================================
  it('18. verifies search_path hardening in pg_proc.proconfig and least-privilege role execution grants', async () => {
    // A: Verify pg_proc.proconfig has search_path = '' for all four SECURITY DEFINER functions
    const proconfigRes = await db.query<{ proname: string; proconfig: string[] | null }>(`
      SELECT p.proname, p.proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'career_create_target',
          'career_set_target_primary',
          'career_create_application',
          'career_update_application_stage_with_history'
        );
    `);

    expect(proconfigRes.rows).toHaveLength(4);
    for (const row of proconfigRes.rows) {
      expect(row.proconfig).toBeDefined();
      expect(row.proconfig).toContain('search_path=""');
    }

    // B: Verify effective function privileges via has_function_privilege
    const privRes = await db.query<{
      proname: string;
      anon_can_exec: boolean;
      auth_can_exec: boolean;
      service_can_exec: boolean;
    }>(`
      SELECT
        p.proname,
        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_exec,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_can_exec,
        has_function_privilege('service_role', p.oid, 'EXECUTE') as service_can_exec
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'career_create_target',
          'career_set_target_primary',
          'career_create_application',
          'career_update_application_stage_with_history'
        );
    `);

    expect(privRes.rows).toHaveLength(4);
    for (const row of privRes.rows) {
      expect(row.anon_can_exec).toBe(false);
      expect(row.auth_can_exec).toBe(false);
      expect(row.service_can_exec).toBe(true);
    }

    // C: Verify direct execution as role authenticated is rejected at permission boundary
    await asUser('clerk_test_unauth_caller', 'authenticated', async () => {
      const dummyId = '00000000-0000-0000-0000-000000000001';

      await expect(
        db.query(`SELECT public.career_set_target_primary('${dummyId}', '${dummyId}');`)
      ).rejects.toThrow(/permission denied for function career_set_target_primary/);

      await expect(
        db.query(`SELECT public.career_create_target('${dummyId}', 'Title', 'Role');`)
      ).rejects.toThrow(/permission denied for function career_create_target/);

      await expect(
        db.query(`SELECT public.career_create_application('${dummyId}', '${dummyId}');`)
      ).rejects.toThrow(/permission denied for function career_create_application/);

      await expect(
        db.query(`SELECT public.career_update_application_stage_with_history('${dummyId}', '${dummyId}', 'applied');`)
      ).rejects.toThrow(/permission denied for function career_update_application_stage_with_history/);
    });

    // D: Verify direct execution as role anon is rejected at permission boundary
    await asUser('anon_caller', 'anon', async () => {
      const dummyId = '00000000-0000-0000-0000-000000000001';

      await expect(
        db.query(`SELECT public.career_set_target_primary('${dummyId}', '${dummyId}');`)
      ).rejects.toThrow(/permission denied for function career_set_target_primary/);
    });

    // E: Verify execution succeeds under service_role
    const dummyUser = await db.query<{ id: string }>(`
      INSERT INTO public.profiles (clerk_user_id, display_name)
      VALUES ('clerk_test_service_caller', 'Service Caller')
      RETURNING id;
    `);
    const userId = dummyUser.rows[0]!.id;

    await db.exec(`SET ROLE service_role;`);
    try {
      const created = await db.query<{ id: string }>(`
        SELECT id FROM public.career_create_target('${userId}', 'Service Target', 'Role');
      `);
      expect(created.rows[0]!.id).toBeDefined();
    } finally {
      await db.exec(`RESET ROLE;`);
    }
  });

  // ============================================================================
  // 19. Atomic Stale-Stage Concurrency Guard & Terminal Restrictions in SQL
  // ============================================================================
  it('19. verifies atomic expected_stage validation, terminal stage restriction, and rollback', async () => {
    await asServiceRole(async () => {
      const uRes = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_career_stage_guard_user', 'Stage Guard Tester')
        RETURNING id;
      `);
      const userId = uRes.rows[0]!.id;

      const oppRes = await db.query<{ id: string }>(`
        INSERT INTO public.career_opportunities (user_id, company_name, role_title)
        VALUES ('${userId}', 'Guard Corp', 'Guard Engineer')
        RETURNING id;
      `);
      const oppId = oppRes.rows[0]!.id;

      // 1. Create application at 'saved'
      const appRes = await db.query<{ career_create_application: { application: { id: string; stage: string } } }>(`
        SELECT public.career_create_application(
          '${userId}',
          '${oppId}',
          'saved',
          NULL, NULL, NULL, NULL, NULL, NULL, 'Initial entry'
        );
      `);
      const appId = appRes.rows[0]!.career_create_application.application.id;

      // 2. First transition succeeds with matching expected_stage 'saved'
      await db.query(`
        SELECT public.career_update_application_stage_with_history(
          '${userId}',
          '${appId}',
          'applied',
          'Transition 1',
          'saved'
        );
      `);

      // 3. Stale transition with expected_stage 'saved' is rejected atomically by RPC
      await expect(
        db.query(`
          SELECT public.career_update_application_stage_with_history(
            '${userId}',
            '${appId}',
            'withdrawn',
            'Stale Transition',
            'saved'
          );
        `)
      ).rejects.toThrow(/Application stage conflict: current stage is applied, expected saved/);

      // Verify no extra history row was created
      const histRows = await db.query<{ to_stage: string }>(`
        SELECT to_stage FROM public.career_application_history
        WHERE application_id = '${appId}'
        ORDER BY changed_at DESC;
      `);
      expect(histRows.rows).toHaveLength(2);
      expect(histRows.rows[0]!.to_stage).toBe('applied');
      expect(histRows.rows[1]!.to_stage).toBe('saved');

      // 4. Illegal transition 'applied' -> 'saved' is rejected inside SQL
      await expect(
        db.query(`
          SELECT public.career_update_application_stage_with_history(
            '${userId}',
            '${appId}',
            'saved',
            'Illegal jump back'
          );
        `)
      ).rejects.toThrow(/Illegal stage transition from applied to saved/);

      // 5. Advance to terminal state 'closed'
      await db.query(`
        SELECT public.career_update_application_stage_with_history(
          '${userId}',
          '${appId}',
          'closed',
          'Closing application'
        );
      `);

      // 6. Transition out of terminal state 'closed' is rejected inside SQL
      await expect(
        db.query(`
          SELECT public.career_update_application_stage_with_history(
            '${userId}',
            '${appId}',
            'interview',
            'Illegal reopen'
          );
        `)
      ).rejects.toThrow(/Cannot transition application from terminal stage closed/);
    });
  });
});
