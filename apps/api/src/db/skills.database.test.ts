import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Skills Database Foundation, Constraints, Hierarchy & RLS', () => {
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

    // 2. Apply all migrations in sequence (1 through 7)
    const migrations = [
      '../../supabase/migrations/20261002000001_init_database_foundation.sql',
      '../../supabase/migrations/20261003000002_goals.sql',
      '../../supabase/migrations/20261003000003_tasks.sql',
      '../../supabase/migrations/20261003000004_focus_sessions.sql',
      '../../supabase/migrations/20261003000005_evidence.sql',
      '../../supabase/migrations/20261003000006_academics.sql',
      '../../supabase/migrations/20261003000007_skills.sql',
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
    userId: string,
    role = 'authenticated',
    callback: () => Promise<T> = async () => ({} as T)
  ): Promise<T> => {
    await db.exec(`
      SET ROLE ${role};
      SET "request.jwt.claim.role" = '${role}';
      SET "request.jwt.claims" = '{"sub": "${userId}"}';
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

  const setupProfiles = async () => {
    await db.query(
      `INSERT INTO public.profiles (id, clerk_user_id, display_name)
       VALUES ($1, $2, $3), ($4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [USER_A, 'clerk_a', 'User A', USER_B, 'clerk_b', 'User B']
    );
  };

  it('allows skill creation with valid attributes', async () => {
    await setupProfiles();

    const result = await db.query<{ id: string; name: string; slug: string; status: string }>(
      `INSERT INTO public.skills (user_id, name, slug, description, category)
       VALUES ($1, 'TypeScript', 'typescript', 'Typed JavaScript', 'Engineering')
       RETURNING id, name, slug, status`,
      [USER_A]
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.name).toBe('TypeScript');
    expect(result.rows[0]!.slug).toBe('typescript');
    expect(result.rows[0]!.status).toBe('active');
  });

  it('enforces unique slug per user, but allows different users to use the same slug', async () => {
    await setupProfiles();

    // User A can't insert duplicate slug 'typescript'
    await expect(
      db.query(
        `INSERT INTO public.skills (user_id, name, slug)
         VALUES ($1, 'TypeScript Duplicate', 'typescript')`,
        [USER_A]
      )
    ).rejects.toThrow();

    // User B CAN insert slug 'typescript'
    const resultB = await db.query<{ id: string; user_id: string }>(
      `INSERT INTO public.skills (user_id, name, slug)
       VALUES ($1, 'TypeScript for B', 'typescript')
       RETURNING id, user_id`,
      [USER_B]
    );
    expect(resultB.rows).toHaveLength(1);
    expect(resultB.rows[0]!.user_id).toBe(USER_B);
  });

  it('rejects self-parenting', async () => {
    await setupProfiles();

    const skill = (
      await db.query<{ id: string }>(
        `INSERT INTO public.skills (user_id, name, slug)
         VALUES ($1, 'React', 'react')
         RETURNING id`,
        [USER_A]
      )
    ).rows[0]!;

    // Attempt to make skill its own parent
    await expect(
      db.query(`UPDATE public.skills SET parent_skill_id = $1 WHERE id = $1`, [skill.id])
    ).rejects.toThrow();
  });

  it('rejects cross-user parent skill assignment', async () => {
    await setupProfiles();

    // Skill owned by User B
    const parentB = (
      await db.query<{ id: string }>(
        `INSERT INTO public.skills (user_id, name, slug)
         VALUES ($1, 'Backend Dev', 'backend-dev')
         RETURNING id`,
        [USER_B]
      )
    ).rows[0]!;

    // User A attempts to set parent to User B's skill
    await expect(
      db.query(
        `INSERT INTO public.skills (user_id, name, slug, parent_skill_id)
         VALUES ($1, 'Node.js', 'node-js', $2)`,
        [USER_A, parentB.id]
      )
    ).rejects.toThrow(/Parent skill must belong to the same user/);
  });

  it('detects and prevents circular hierarchy (A -> B -> C -> A)', async () => {
    await setupProfiles();

    // Create Skill A
    const skillA = (
      await db.query<{ id: string }>(
        `INSERT INTO public.skills (user_id, name, slug)
         VALUES ($1, 'Root Skill', 'root-skill')
         RETURNING id`,
        [USER_A]
      )
    ).rows[0]!;

    // Create Skill B with parent A
    const skillB = (
      await db.query<{ id: string }>(
        `INSERT INTO public.skills (user_id, name, slug, parent_skill_id)
         VALUES ($1, 'Mid Skill', 'mid-skill', $2)
         RETURNING id`,
        [USER_A, skillA.id]
      )
    ).rows[0]!;

    // Create Skill C with parent B
    const skillC = (
      await db.query<{ id: string }>(
        `INSERT INTO public.skills (user_id, name, slug, parent_skill_id)
         VALUES ($1, 'Leaf Skill', 'leaf-skill', $2)
         RETURNING id`,
        [USER_A, skillB.id]
      )
    ).rows[0]!;

    // Attempt to set A's parent to C (creating cycle A -> B -> C -> A)
    await expect(
      db.query(`UPDATE public.skills SET parent_skill_id = $1 WHERE id = $2`, [skillC.id, skillA.id])
    ).rejects.toThrow(/Circular hierarchy detected in skills/);
  });

  it('preserves child skill when parent skill is deleted (SET NULL)', async () => {
    await setupProfiles();

    const parent = (
      await db.query<{ id: string }>(
        `INSERT INTO public.skills (user_id, name, slug)
         VALUES ($1, 'Frontend Dev', 'frontend-dev')
         RETURNING id`,
        [USER_A]
      )
    ).rows[0]!;

    const child = (
      await db.query<{ id: string }>(
        `INSERT INTO public.skills (user_id, name, slug, parent_skill_id)
         VALUES ($1, 'CSS Mastery', 'css-mastery', $2)
         RETURNING id`,
        [USER_A, parent.id]
      )
    ).rows[0]!;

    // Delete parent
    await db.query(`DELETE FROM public.skills WHERE id = $1`, [parent.id]);

    // Child should still exist, with parent_skill_id set to null
    const res = await db.query<{ id: string; parent_skill_id: string | null }>(
      `SELECT id, parent_skill_id FROM public.skills WHERE id = $1`,
      [child.id]
    );

    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]!.parent_skill_id).toBeNull();
  });

  it('allows skill archive without deleting data', async () => {
    await setupProfiles();

    const skill = (
      await db.query<{ id: string; status: string }>(
        `INSERT INTO public.skills (user_id, name, slug)
         VALUES ($1, 'SQL', 'sql')
         RETURNING id, status`,
        [USER_A]
      )
    ).rows[0]!;

    expect(skill.status).toBe('active');

    const updated = await db.query<{ id: string; status: string }>(
      `UPDATE public.skills SET status = 'archived' WHERE id = $1 RETURNING id, status`,
      [skill.id]
    );

    expect(updated.rows[0]!.status).toBe('archived');
  });

  it('links evidence to skill and blocks cross-user linking', async () => {
    await setupProfiles();

    const skillA = (
      await db.query<{ id: string }>(
        `INSERT INTO public.skills (user_id, name, slug)
         VALUES ($1, 'Database Design', 'database-design')
         RETURNING id`,
        [USER_A]
      )
    ).rows[0]!;

    const evidenceA = (
      await db.query<{ id: string }>(
        `INSERT INTO public.evidence (user_id, evidence_type, title, source_type)
         VALUES ($1, 'manual', 'Completed DB schema', 'user')
         RETURNING id`,
        [USER_A]
      )
    ).rows[0]!;

    // Valid same-user linking
    const link = await db.query(
      `INSERT INTO public.evidence_skills (evidence_id, skill_id, user_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [evidenceA.id, skillA.id, USER_A]
    );
    expect(link.rows).toHaveLength(1);

    // Cross-user attempt: User B trying to link User A's skill to User B's evidence
    const evidenceB = (
      await db.query<{ id: string }>(
        `INSERT INTO public.evidence (user_id, evidence_type, title, source_type)
         VALUES ($1, 'manual', 'User B activity', 'user')
         RETURNING id`,
        [USER_B]
      )
    ).rows[0]!;

    await expect(
      db.query(
        `INSERT INTO public.evidence_skills (evidence_id, skill_id, user_id)
         VALUES ($1, $2, $3)`,
        [evidenceB.id, skillA.id, USER_B]
      )
    ).rejects.toThrow(/User ID must match/);
  });

  it('links goals, tasks, and academic topics to skills with strict user matching', async () => {
    await setupProfiles();

    const skillA = (
      await db.query<{ id: string }>(
        `INSERT INTO public.skills (user_id, name, slug)
         VALUES ($1, 'Algorithms', 'algorithms')
         RETURNING id`,
        [USER_A]
      )
    ).rows[0]!;

    // Goal linking
    const goalA = (
      await db.query<{ id: string }>(
        `INSERT INTO public.goals (user_id, title, goal_type)
         VALUES ($1, 'Master CS Algorithms', 'learning')
         RETURNING id`,
        [USER_A]
      )
    ).rows[0]!;

    const goalLink = await db.query<{ goal_id: string; skill_id: string; target_mastery_state: string }>(
      `INSERT INTO public.goal_skills (goal_id, skill_id, user_id, target_mastery_state)
       VALUES ($1, $2, $3, 'proficient')
       RETURNING *`,
      [goalA.id, skillA.id, USER_A]
    );
    expect(goalLink.rows).toHaveLength(1);
    expect(goalLink.rows[0]!.target_mastery_state).toBe('proficient');

    // Task linking
    const taskA = (
      await db.query<{ id: string }>(
        `INSERT INTO public.tasks (user_id, title)
         VALUES ($1, 'Implement Binary Search')
         RETURNING id`,
        [USER_A]
      )
    ).rows[0]!;

    const taskLink = await db.query(
      `INSERT INTO public.task_skills (task_id, skill_id, user_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [taskA.id, skillA.id, USER_A]
    );
    expect(taskLink.rows).toHaveLength(1);

    // Subject Topic linking
    const termA = (
      await db.query<{ id: string }>(
        `INSERT INTO public.terms (user_id, name, start_date, end_date)
         VALUES ($1, 'Fall 2026', '2026-09-01', '2026-12-15')
         RETURNING id`,
        [USER_A]
      )
    ).rows[0]!;

    const subjectA = (
      await db.query<{ id: string }>(
        `INSERT INTO public.subjects (user_id, term_id, name)
         VALUES ($1, $2, 'Data Structures')
         RETURNING id`,
        [USER_A, termA.id]
      )
    ).rows[0]!;

    const topicA = (
      await db.query<{ id: string }>(
        `INSERT INTO public.subject_topics (user_id, subject_id, name)
         VALUES ($1, $2, 'Binary Search Trees')
         RETURNING id`,
        [USER_A, subjectA.id]
      )
    ).rows[0]!;

    const topicLink = await db.query(
      `INSERT INTO public.topic_skills (topic_id, skill_id, user_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [topicA.id, skillA.id, USER_A]
    );
    expect(topicLink.rows).toHaveLength(1);

    // Deleting skill removes relationships, but preserves original entities
    await db.query(`DELETE FROM public.skills WHERE id = $1`, [skillA.id]);

    const remainingGoal = await db.query(`SELECT id FROM public.goals WHERE id = $1`, [goalA.id]);
    expect(remainingGoal.rows).toHaveLength(1);

    const remainingTask = await db.query(`SELECT id FROM public.tasks WHERE id = $1`, [taskA.id]);
    expect(remainingTask.rows).toHaveLength(1);

    const remainingTopic = await db.query(`SELECT id FROM public.subject_topics WHERE id = $1`, [topicA.id]);
    expect(remainingTopic.rows).toHaveLength(1);
  });

  it('enforces RLS isolation between users', async () => {
    await setupProfiles();

    // Insert skill as User A
    const skillA = (
      await db.query<{ id: string }>(
        `INSERT INTO public.skills (user_id, name, slug)
         VALUES ($1, 'Private Skill A', 'private-skill-a')
         RETURNING id`,
        [USER_A]
      )
    ).rows[0]!;

    // Query as User B with RLS
    await asUser(USER_B, 'authenticated', async () => {
      const bView = await db.query(`SELECT * FROM public.skills WHERE id = $1`, [skillA.id]);
      expect(bView.rows).toHaveLength(0);

      // User B cannot update User A's skill
      const updateRes = await db.query(`UPDATE public.skills SET name = 'Hacked' WHERE id = $1`, [skillA.id]);
      expect(updateRes.affectedRows ?? updateRes.rowCount ?? 0).toBe(0);
    });

    // Query as User A with RLS
    await asUser(USER_A, 'authenticated', async () => {
      const aView = await db.query(`SELECT * FROM public.skills WHERE id = $1`, [skillA.id]);
      expect(aView.rows).toHaveLength(1);
    });
  });
});
