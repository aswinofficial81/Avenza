import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Phase 15A Projects Domain Database Foundation, Integrity & RLS', () => {
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

  const asServiceRole = async <T>(callback: () => Promise<T> = async () => ({} as T)): Promise<T> => {
    await db.exec(`
      RESET ROLE;
      SET "request.jwt.claim.role" = 'service_role';
      SET "request.jwt.claims" = '{}';
    `);
    return callback();
  };

  // 1. Project Creation
  it('1. creates a project with valid fields and defaults', async () => {
    await asServiceRole(async () => {
      const userRes = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_proj_1', 'Project Creator')
        RETURNING id;
      `);
      const userId = userRes.rows[0]!.id;

      const projRes = await db.query<{ id: string; status: string; priority: string; project_type: string }>(`
        INSERT INTO public.projects (user_id, title, slug, description, tech_stack)
        VALUES ('${userId}', 'Avenza Core', 'avenza-core', 'Core system', ARRAY['TypeScript', 'PostgreSQL'])
        RETURNING id, status, priority, project_type;
      `);

      expect(projRes.rows).toHaveLength(1);
      expect(projRes.rows[0]!.id).toBeDefined();
      expect(projRes.rows[0]!.status).toBe('backlog');
      expect(projRes.rows[0]!.priority).toBe('medium');
      expect(projRes.rows[0]!.project_type).toBe('software');
    });
  });

  // 2. Project Ownership
  it('2. verifies project ownership references the creator profile', async () => {
    await asServiceRole(async () => {
      const userRes = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_proj_owner', 'Owner User')
        RETURNING id;
      `);
      const userId = userRes.rows[0]!.id;

      const projRes = await db.query<{ user_id: string }>(`
        INSERT INTO public.projects (user_id, title, slug)
        VALUES ('${userId}', 'Owned Project', 'owned-project')
        RETURNING user_id;
      `);

      expect(projRes.rows[0]!.user_id).toBe(userId);

      // Foreign key rejection for nonexistent user
      await expect(
        db.query(`
          INSERT INTO public.projects (user_id, title, slug)
          VALUES ('00000000-0000-0000-0000-000000000000', 'Ghost Project', 'ghost-project');
        `)
      ).rejects.toThrow(/fk_projects_user_id/);
    });
  });

  // 3. RLS Isolation
  it('3. enforces RLS isolation: User A cannot read, update, or delete User B projects', async () => {
    let userAId: string;
    let userBId: string;
    let projectAId: string;

    await asServiceRole(async () => {
      const uA = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_alice_rls', 'Alice')
        RETURNING id;
      `);
      userAId = uA.rows[0]!.id;

      const uB = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_bob_rls', 'Bob')
        RETURNING id;
      `);
      userBId = uB.rows[0]!.id;

      const pA = await db.query<{ id: string }>(`
        INSERT INTO public.projects (user_id, title, slug)
        VALUES ('${userAId}', 'Alice Secret Engine', 'alice-secret-engine')
        RETURNING id;
      `);
      projectAId = pA.rows[0]!.id;
    });

    // Bob tries to access Alice's project
    await asUser('clerk_bob_rls', 'authenticated', async () => {
      // 1. Bob SELECTs projects -> Alice's project not visible
      const bobProjects = await db.query<{ id: string }>(`
        SELECT id FROM public.projects;
      `);
      const visibleIds = bobProjects.rows.map((r) => r.id);
      expect(visibleIds).not.toContain(projectAId);

      // 2. Bob tries to UPDATE Alice's project -> 0 rows affected
      const updateRes = await db.query(`
        UPDATE public.projects SET title = 'Bob Tampered' WHERE id = '${projectAId}';
      `);
      expect(updateRes.affectedRows).toBe(0);

      // 3. Bob tries to DELETE Alice's project -> 0 rows affected
      const deleteRes = await db.query(`
        DELETE FROM public.projects WHERE id = '${projectAId}';
      `);
      expect(deleteRes.affectedRows).toBe(0);

      // 4. Bob tries to INSERT specifying Alice's user_id -> rejected by WITH CHECK policy
      await expect(
        db.query(`
          INSERT INTO public.projects (user_id, title, slug)
          VALUES ('${userAId}', 'Bob Spoofed Alice', 'bob-spoofed-alice');
        `)
      ).rejects.toThrow();

      // 5. Bob can insert his own project with his own userBId under RLS
      const bobProj = await db.query<{ id: string }>(`
        INSERT INTO public.projects (user_id, title, slug)
        VALUES ('${userBId}', 'Bob Legitimate Project', 'bob-legit-proj')
        RETURNING id;
      `);
      expect(bobProj.rows[0]!.id).toBeDefined();
    });

    // Alice CAN read and update her own project
    await asUser('clerk_alice_rls', 'authenticated', async () => {
      const aliceProjects = await db.query<{ id: string }>(`
        SELECT id FROM public.projects WHERE id = '${projectAId}';
      `);
      expect(aliceProjects.rows).toHaveLength(1);

      const updateRes = await db.query(`
        UPDATE public.projects SET title = 'Alice Updated Engine' WHERE id = '${projectAId}';
      `);
      expect(updateRes.affectedRows).toBe(1);
    });
  });

  // 4. Milestone Ownership
  it('4. ensures milestone owner matches project owner via trigger', async () => {
    let userAId: string;
    let userBId: string;
    let projectAId: string;

    await asServiceRole(async () => {
      const uA = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_ms_a', 'Milestone User A')
        RETURNING id;
      `);
      userAId = uA.rows[0]!.id;

      const uB = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_ms_b', 'Milestone User B')
        RETURNING id;
      `);
      userBId = uB.rows[0]!.id;

      const pA = await db.query<{ id: string }>(`
        INSERT INTO public.projects (user_id, title, slug)
        VALUES ('${userAId}', 'Milestone Test Proj', 'ms-test-proj')
        RETURNING id;
      `);
      projectAId = pA.rows[0]!.id;

      // Milestone with same user succeeds
      const validMs = await db.query<{ id: string }>(`
        INSERT INTO public.project_milestones (project_id, user_id, title, order_index)
        VALUES ('${projectAId}', '${userAId}', 'Phase 1 MVP', 0)
        RETURNING id;
      `);
      expect(validMs.rows[0]!.id).toBeDefined();

      // Milestone with mismatched user is rejected by trigger
      await expect(
        db.query(`
          INSERT INTO public.project_milestones (project_id, user_id, title, order_index)
          VALUES ('${projectAId}', '${userBId}', 'Sneaky Milestone', 1);
        `)
      ).rejects.toThrow(/Project milestone must belong to the same user as the project/);
    });
  });

  // 5. Project-Goal Ownership
  it('5. prevents connecting a project and goal owned by different users', async () => {
    await asServiceRole(async () => {
      const uA = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_goal_u_a', 'Goal User A')
        RETURNING id;
      `);
      const userAId = uA.rows[0]!.id;

      const uB = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_goal_u_b', 'Goal User B')
        RETURNING id;
      `);
      const userBId = uB.rows[0]!.id;

      const pA = await db.query<{ id: string }>(`
        INSERT INTO public.projects (user_id, title, slug)
        VALUES ('${userAId}', 'Project A', 'proj-a-goal')
        RETURNING id;
      `);
      const projectAId = pA.rows[0]!.id;

      const gA = await db.query<{ id: string }>(`
        INSERT INTO public.goals (user_id, title, goal_type)
        VALUES ('${userAId}', 'Goal A', 'project')
        RETURNING id;
      `);
      const goalAId = gA.rows[0]!.id;

      const gB = await db.query<{ id: string }>(`
        INSERT INTO public.goals (user_id, title, goal_type)
        VALUES ('${userBId}', 'Goal B', 'project')
        RETURNING id;
      `);
      const goalBId = gB.rows[0]!.id;

      // Same user linking succeeds
      const validPg = await db.query(`
        INSERT INTO public.project_goals (project_id, goal_id, user_id, is_primary)
        VALUES ('${projectAId}', '${goalAId}', '${userAId}', true);
      `);
      expect(validPg.affectedRows).toBe(1);

      // Cross-user linking (User A project with User B goal) is rejected
      await expect(
        db.query(`
          INSERT INTO public.project_goals (project_id, goal_id, user_id, is_primary)
          VALUES ('${projectAId}', '${goalBId}', '${userAId}', false);
        `)
      ).rejects.toThrow(/User ID must match across project, goal, and relationship records/);
    });
  });

  // 6. Project-Skill Ownership
  it('6. prevents connecting a project and skill owned by different users', async () => {
    await asServiceRole(async () => {
      const uA = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_skill_u_a', 'Skill User A')
        RETURNING id;
      `);
      const userAId = uA.rows[0]!.id;

      const uB = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_skill_u_b', 'Skill User B')
        RETURNING id;
      `);
      const userBId = uB.rows[0]!.id;

      const pA = await db.query<{ id: string }>(`
        INSERT INTO public.projects (user_id, title, slug)
        VALUES ('${userAId}', 'Project A Skill', 'proj-a-skill')
        RETURNING id;
      `);
      const projectAId = pA.rows[0]!.id;

      const sA = await db.query<{ id: string }>(`
        INSERT INTO public.skills (user_id, name, slug)
        VALUES ('${userAId}', 'Rust', 'rust-a')
        RETURNING id;
      `);
      const skillAId = sA.rows[0]!.id;

      const sB = await db.query<{ id: string }>(`
        INSERT INTO public.skills (user_id, name, slug)
        VALUES ('${userBId}', 'Go', 'go-b')
        RETURNING id;
      `);
      const skillBId = sB.rows[0]!.id;

      // Same user linking succeeds
      const validPs = await db.query(`
        INSERT INTO public.project_skills (project_id, skill_id, user_id, role)
        VALUES ('${projectAId}', '${skillAId}', '${userAId}', 'primary');
      `);
      expect(validPs.affectedRows).toBe(1);

      // Cross-user linking rejected
      await expect(
        db.query(`
          INSERT INTO public.project_skills (project_id, skill_id, user_id, role)
          VALUES ('${projectAId}', '${skillBId}', '${userAId}', 'supporting');
        `)
      ).rejects.toThrow(/User ID must match across project, skill, and relationship records/);
    });
  });

  // 7. Repository Ownership
  it('7. prevents linking an external repository owned by a different user', async () => {
    await asServiceRole(async () => {
      const uA = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_repo_u_a', 'Repo User A')
        RETURNING id;
      `);
      const userAId = uA.rows[0]!.id;

      const uB = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_repo_u_b', 'Repo User B')
        RETURNING id;
      `);
      const userBId = uB.rows[0]!.id;

      // User A and User B connections and repositories
      const cA = await db.query<{ id: string }>(`
        INSERT INTO public.integration_connections (user_id, provider, external_account_id, status)
        VALUES ('${userAId}', 'github', 'acc_a', 'CONNECTED')
        RETURNING id;
      `);
      const connAId = cA.rows[0]!.id;

      const cB = await db.query<{ id: string }>(`
        INSERT INTO public.integration_connections (user_id, provider, external_account_id, status)
        VALUES ('${userBId}', 'github', 'acc_b', 'CONNECTED')
        RETURNING id;
      `);
      const connBId = cB.rows[0]!.id;

      const rA = await db.query<{ id: string }>(`
        INSERT INTO public.external_repositories (connection_id, user_id, provider, external_id, name, full_name, owner, html_url)
        VALUES ('${connAId}', '${userAId}', 'github', 'ext_repo_a', 'repo-a', 'owner/repo-a', 'owner', 'https://github.com/owner/repo-a')
        RETURNING id;
      `);
      const repoAId = rA.rows[0]!.id;

      const rB = await db.query<{ id: string }>(`
        INSERT INTO public.external_repositories (connection_id, user_id, provider, external_id, name, full_name, owner, html_url)
        VALUES ('${connBId}', '${userBId}', 'github', 'ext_repo_b', 'repo-b', 'owner/repo-b', 'owner', 'https://github.com/owner/repo-b')
        RETURNING id;
      `);
      const repoBId = rB.rows[0]!.id;

      // Project owned by User A with User A repository succeeds
      const pValid = await db.query<{ id: string }>(`
        INSERT INTO public.projects (user_id, title, slug, repository_id)
        VALUES ('${userAId}', 'Valid Repo Project', 'valid-repo-proj', '${repoAId}')
        RETURNING id;
      `);
      expect(pValid.rows[0]!.id).toBeDefined();

      // Project owned by User A with User B repository is rejected by trigger
      await expect(
        db.query(`
          INSERT INTO public.projects (user_id, title, slug, repository_id)
          VALUES ('${userAId}', 'Cross Repo Project', 'cross-repo-proj', '${repoBId}');
        `)
      ).rejects.toThrow(/Linked repository must belong to the same user as the project/);
    });
  });

  // 8. Task → Project Relationship
  it('8. associates task with project owned by same user', async () => {
    await asServiceRole(async () => {
      const u = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_task_proj_u', 'Task Project User')
        RETURNING id;
      `);
      const userId = u.rows[0]!.id;

      const p = await db.query<{ id: string }>(`
        INSERT INTO public.projects (user_id, title, slug)
        VALUES ('${userId}', 'Task Project', 'task-project')
        RETURNING id;
      `);
      const projectId = p.rows[0]!.id;

      const t = await db.query<{ id: string; project_id: string }>(`
        INSERT INTO public.tasks (user_id, title, project_id)
        VALUES ('${userId}', 'Build Compiler AST', '${projectId}')
        RETURNING id, project_id;
      `);

      expect(t.rows[0]!.id).toBeDefined();
      expect(t.rows[0]!.project_id).toBe(projectId);
    });
  });

  // 9. Task → Milestone Relationship
  it('9. associates task with milestone within the same project', async () => {
    await asServiceRole(async () => {
      const u = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_task_ms_u', 'Task Milestone User')
        RETURNING id;
      `);
      const userId = u.rows[0]!.id;

      const p = await db.query<{ id: string }>(`
        INSERT INTO public.projects (user_id, title, slug)
        VALUES ('${userId}', 'Milestone Task Project', 'ms-task-project')
        RETURNING id;
      `);
      const projectId = p.rows[0]!.id;

      const m = await db.query<{ id: string }>(`
        INSERT INTO public.project_milestones (project_id, user_id, title, order_index)
        VALUES ('${projectId}', '${userId}', 'Milestone 1 AST', 0)
        RETURNING id;
      `);
      const milestoneId = m.rows[0]!.id;

      const t = await db.query<{ id: string; project_id: string; project_milestone_id: string }>(`
        INSERT INTO public.tasks (user_id, title, project_id, project_milestone_id)
        VALUES ('${userId}', 'Implement Lexer', '${projectId}', '${milestoneId}')
        RETURNING id, project_id, project_milestone_id;
      `);

      expect(t.rows[0]!.id).toBeDefined();
      expect(t.rows[0]!.project_id).toBe(projectId);
      expect(t.rows[0]!.project_milestone_id).toBe(milestoneId);
    });
  });

  // 10. Invalid Cross-Project Milestone Assignment
  it('10. rejects assigning milestone without project_id or from a different project', async () => {
    await asServiceRole(async () => {
      const u = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_cross_ms_u', 'Cross Milestone User')
        RETURNING id;
      `);
      const userId = u.rows[0]!.id;

      const p1 = await db.query<{ id: string }>(`
        INSERT INTO public.projects (user_id, title, slug)
        VALUES ('${userId}', 'Project 1', 'proj-1-cross')
        RETURNING id;
      `);
      const proj1Id = p1.rows[0]!.id;

      const p2 = await db.query<{ id: string }>(`
        INSERT INTO public.projects (user_id, title, slug)
        VALUES ('${userId}', 'Project 2', 'proj-2-cross')
        RETURNING id;
      `);
      const proj2Id = p2.rows[0]!.id;

      const m1 = await db.query<{ id: string }>(`
        INSERT INTO public.project_milestones (project_id, user_id, title, order_index)
        VALUES ('${proj1Id}', '${userId}', 'P1 Milestone', 0)
        RETURNING id;
      `);
      const milestone1Id = m1.rows[0]!.id;

      // Rejection 1: Task has project_milestone_id but project_id is NULL
      await expect(
        db.query(`
          INSERT INTO public.tasks (user_id, title, project_id, project_milestone_id)
          VALUES ('${userId}', 'Invalid Task Without Project', NULL, '${milestone1Id}');
        `)
      ).rejects.toThrow(/Task cannot have a project milestone without a project_id/);

      // Rejection 2: Task has Project 2 but Milestone belongs to Project 1
      await expect(
        db.query(`
          INSERT INTO public.tasks (user_id, title, project_id, project_milestone_id)
          VALUES ('${userId}', 'Cross Project Mismatch Task', '${proj2Id}', '${milestone1Id}');
        `)
      ).rejects.toThrow(/Task project milestone must belong to the specified project/);
    });
  });

  // 11. Slug Uniqueness per User
  it('11. enforces slug uniqueness per user while allowing same slug for different users', async () => {
    await asServiceRole(async () => {
      const u1 = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_slug_user_1', 'Slug User 1')
        RETURNING id;
      `);
      const user1Id = u1.rows[0]!.id;

      const u2 = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_slug_user_2', 'Slug User 2')
        RETURNING id;
      `);
      const user2Id = u2.rows[0]!.id;

      // First project with slug 'web-app' for User 1
      await db.query(`
        INSERT INTO public.projects (user_id, title, slug)
        VALUES ('${user1Id}', 'Web App 1', 'web-app');
      `);

      // Duplicate slug for User 1 fails unique constraint
      await expect(
        db.query(`
          INSERT INTO public.projects (user_id, title, slug)
          VALUES ('${user1Id}', 'Web App 2', 'web-app');
        `)
      ).rejects.toThrow(/uq_projects_user_slug/);

      // Same slug for User 2 succeeds
      const u2Proj = await db.query<{ id: string }>(`
        INSERT INTO public.projects (user_id, title, slug)
        VALUES ('${user2Id}', 'User 2 Web App', 'web-app')
        RETURNING id;
      `);
      expect(u2Proj.rows[0]!.id).toBeDefined();
    });
  });

  // 12. Invalid Status
  it('12. rejects invalid status check constraint', async () => {
    await asServiceRole(async () => {
      const u = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_status_check_u', 'Status Check User')
        RETURNING id;
      `);
      const userId = u.rows[0]!.id;

      await expect(
        db.query(`
          INSERT INTO public.projects (user_id, title, slug, status)
          VALUES ('${userId}', 'Status Project', 'status-proj', 'nonexistent_status');
        `)
      ).rejects.toThrow(/chk_projects_status/);
    });
  });

  // 13. Invalid Priority
  it('13. rejects invalid priority check constraint', async () => {
    await asServiceRole(async () => {
      const u = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_prio_check_u', 'Priority Check User')
        RETURNING id;
      `);
      const userId = u.rows[0]!.id;

      await expect(
        db.query(`
          INSERT INTO public.projects (user_id, title, slug, priority)
          VALUES ('${userId}', 'Priority Project', 'prio-proj', 'mega_urgent');
        `)
      ).rejects.toThrow(/chk_projects_priority/);
    });
  });

  // 14. Invalid Project Type
  it('14. rejects invalid project_type check constraint', async () => {
    await asServiceRole(async () => {
      const u = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_type_check_u', 'Type Check User')
        RETURNING id;
      `);
      const userId = u.rows[0]!.id;

      await expect(
        db.query(`
          INSERT INTO public.projects (user_id, title, slug, project_type)
          VALUES ('${userId}', 'Type Project', 'type-proj', 'arbitrary_type');
        `)
      ).rejects.toThrow(/chk_projects_type/);
    });
  });

  // 15. Invalid URL
  it('15. rejects live_url without http/https protocol', async () => {
    await asServiceRole(async () => {
      const u = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_url_check_u', 'URL Check User')
        RETURNING id;
      `);
      const userId = u.rows[0]!.id;

      await expect(
        db.query(`
          INSERT INTO public.projects (user_id, title, slug, live_url)
          VALUES ('${userId}', 'FTP Project', 'ftp-proj', 'ftp://files.example.com');
        `)
      ).rejects.toThrow(/chk_projects_live_url_protocol/);

      // Valid https URL succeeds
      const valid = await db.query<{ id: string }>(`
        INSERT INTO public.projects (user_id, title, slug, live_url)
        VALUES ('${userId}', 'HTTP Project', 'http-proj', 'https://example.com/demo')
        RETURNING id;
      `);
      expect(valid.rows[0]!.id).toBeDefined();
    });
  });

  // 16. Date Constraint
  it('16. rejects project where target_date is earlier than start_date', async () => {
    await asServiceRole(async () => {
      const u = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_date_check_u', 'Date Check User')
        RETURNING id;
      `);
      const userId = u.rows[0]!.id;

      await expect(
        db.query(`
          INSERT INTO public.projects (user_id, title, slug, start_date, target_date)
          VALUES ('${userId}', 'Bad Dates Project', 'bad-dates-proj', '2026-12-01 00:00:00Z', '2026-11-01 00:00:00Z');
        `)
      ).rejects.toThrow(/chk_projects_dates/);
    });
  });

  // 17. Cascade Behavior
  it('17. validates all cascade semantics on deletion', async () => {
    await asServiceRole(async () => {
      const u = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_cascade_test_u', 'Cascade Test User')
        RETURNING id;
      `);
      const userId = u.rows[0]!.id;

      // Create integration connection & repo
      const conn = await db.query<{ id: string }>(`
        INSERT INTO public.integration_connections (user_id, provider, external_account_id, status)
        VALUES ('${userId}', 'github', 'cascade_gh_acc', 'CONNECTED')
        RETURNING id;
      `);
      const connId = conn.rows[0]!.id;

      const repo = await db.query<{ id: string }>(`
        INSERT INTO public.external_repositories (connection_id, user_id, provider, external_id, name, full_name, owner, html_url)
        VALUES ('${connId}', '${userId}', 'github', 'cascade_repo_1', 'my-repo', 'user/my-repo', 'user', 'https://github.com/user/my-repo')
        RETURNING id;
      `);
      const repoId = repo.rows[0]!.id;

      // Create project linked to repository
      const proj = await db.query<{ id: string }>(`
        INSERT INTO public.projects (user_id, title, slug, repository_id)
        VALUES ('${userId}', 'Cascade Project', 'cascade-proj', '${repoId}')
        RETURNING id;
      `);
      const projId = proj.rows[0]!.id;

      // Create milestone
      const ms = await db.query<{ id: string }>(`
        INSERT INTO public.project_milestones (project_id, user_id, title, order_index)
        VALUES ('${projId}', '${userId}', 'Milestone Alpha', 0)
        RETURNING id;
      `);
      const msId = ms.rows[0]!.id;

      // Create goal & project_goal
      const goal = await db.query<{ id: string }>(`
        INSERT INTO public.goals (user_id, title, goal_type)
        VALUES ('${userId}', 'Cascade Goal', 'project')
        RETURNING id;
      `);
      const goalId = goal.rows[0]!.id;

      await db.query(`
        INSERT INTO public.project_goals (project_id, goal_id, user_id)
        VALUES ('${projId}', '${goalId}', '${userId}');
      `);

      // Create skill & project_skill
      const skill = await db.query<{ id: string }>(`
        INSERT INTO public.skills (user_id, name, slug)
        VALUES ('${userId}', 'Systems Architecture', 'sys-arch-cascade')
        RETURNING id;
      `);
      const skillId = skill.rows[0]!.id;

      await db.query(`
        INSERT INTO public.project_skills (project_id, skill_id, user_id)
        VALUES ('${projId}', '${skillId}', '${userId}');
      `);

      // Create task linked to project and milestone
      const task = await db.query<{ id: string }>(`
        INSERT INTO public.tasks (user_id, title, project_id, project_milestone_id)
        VALUES ('${userId}', 'Preserved Task', '${projId}', '${msId}')
        RETURNING id;
      `);
      const taskId = task.rows[0]!.id;

      // Create evidence and evidence link for project
      const evid = await db.query<{ id: string }>(`
        INSERT INTO public.evidence (user_id, title, evidence_type, source_type)
        VALUES ('${userId}', 'Project Initial Commit', 'project_activity', 'project')
        RETURNING id;
      `);
      const evidId = evid.rows[0]!.id;

      const link = await db.query<{ id: string }>(`
        INSERT INTO public.evidence_links (evidence_id, entity_type, entity_id)
        VALUES ('${evidId}', 'project', '${projId}')
        RETURNING id;
      `);
      expect(link.rows[0]!.id).toBeDefined();

      // Also verify project_milestone evidence link
      const msLink = await db.query<{ id: string }>(`
        INSERT INTO public.evidence_links (evidence_id, entity_type, entity_id)
        VALUES ('${evidId}', 'project_milestone', '${msId}')
        RETURNING id;
      `);
      expect(msLink.rows[0]!.id).toBeDefined();

      // Test 17a: Deleting external repository sets project.repository_id = NULL
      await db.query(`DELETE FROM public.external_repositories WHERE id = '${repoId}';`);
      const projAfterRepoDelete = await db.query<{ repository_id: string | null }>(`
        SELECT repository_id FROM public.projects WHERE id = '${projId}';
      `);
      expect(projAfterRepoDelete.rows[0]!.repository_id).toBeNull();

      // Test 17b: Deleting project preserves tasks by setting project_id and project_milestone_id to NULL
      await db.query(`DELETE FROM public.projects WHERE id = '${projId}';`);

      const taskAfterProjDelete = await db.query<{ project_id: string | null; project_milestone_id: string | null }>(`
        SELECT project_id, project_milestone_id FROM public.tasks WHERE id = '${taskId}';
      `);
      expect(taskAfterProjDelete.rows[0]!.project_id).toBeNull();
      expect(taskAfterProjDelete.rows[0]!.project_milestone_id).toBeNull();

      // Test 17c: Deleting project removes its milestones and junction records
      const msCount = await db.query(`SELECT id FROM public.project_milestones WHERE project_id = '${projId}';`);
      expect(msCount.rows).toHaveLength(0);

      const pgCount = await db.query(`SELECT project_id FROM public.project_goals WHERE project_id = '${projId}';`);
      expect(pgCount.rows).toHaveLength(0);

      const psCount = await db.query(`SELECT project_id FROM public.project_skills WHERE project_id = '${projId}';`);
      expect(psCount.rows).toHaveLength(0);

      // Verify the task itself still exists!
      const taskExists = await db.query(`SELECT id FROM public.tasks WHERE id = '${taskId}';`);
      expect(taskExists.rows).toHaveLength(1);
    });
  });
});
