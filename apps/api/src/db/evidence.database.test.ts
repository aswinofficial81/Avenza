import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Evidence Database Foundation, Constraints, Links & RLS', () => {
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

    // 2. Apply all migrations in sequence (1 through 5)
    const migrations = [
      '../../supabase/migrations/20261002000001_init_database_foundation.sql',
      '../../supabase/migrations/20261003000002_goals.sql',
      '../../supabase/migrations/20261003000003_tasks.sql',
      '../../supabase/migrations/20261003000004_focus_sessions.sql',
      '../../supabase/migrations/20261003000005_evidence.sql',
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
    clerkUserId: string,
    role = 'authenticated',
    callback: () => Promise<T> = async () => ({} as T)
  ): Promise<T> => {
    await db.exec(`
      SET ROLE ${role};
      SET "request.jwt.claim.role" = '${role}';
      SET "request.jwt.claims" = '{"sub": "${clerkUserId}"}';
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

  it('creates tables, triggers, and indexes properly', async () => {
    const tableRes = await db.query<{ tablename: string }>(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('evidence', 'evidence_links');
    `);
    expect(tableRes.rows.map((r) => r.tablename).sort()).toEqual(['evidence', 'evidence_links']);

    const indexRes = await db.query<{ indexname: string }>(`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'evidence';
    `);
    const indexNames = indexRes.rows.map((r) => r.indexname);
    expect(indexNames).toContain('idx_evidence_user_source_unique');
    expect(indexNames).toContain('idx_evidence_user_occurred');
  });

  it('enforces check constraints on evidence type, source type, and status', async () => {
    const userRes = await db.query<{ id: string }>(`
      INSERT INTO public.profiles (clerk_user_id, display_name)
      VALUES ('clerk_test_evidence_1', 'Evidence Tester')
      RETURNING id;
    `);
    const userId = userRes.rows[0]!.id;

    // Invalid evidence_type
    await expect(
      db.query(`
        INSERT INTO public.evidence (user_id, title, evidence_type, source_type)
        VALUES ('${userId}', 'Bad Type', 'invalid_type', 'user');
      `)
    ).rejects.toThrow();

    // Invalid source_type
    await expect(
      db.query(`
        INSERT INTO public.evidence (user_id, title, evidence_type, source_type)
        VALUES ('${userId}', 'Bad Source', 'manual', 'alien_source');
      `)
    ).rejects.toThrow();

    // Invalid verification_status
    await expect(
      db.query(`
        INSERT INTO public.evidence (user_id, title, evidence_type, source_type, verification_status)
        VALUES ('${userId}', 'Bad Status', 'manual', 'user', 'super_verified');
      `)
    ).rejects.toThrow();
  });

  it('enforces duplicate source protection via partial unique index', async () => {
    const userRes = await db.query<{ id: string }>(`
      INSERT INTO public.profiles (clerk_user_id, display_name)
      VALUES ('clerk_test_dup_source', 'Dup Source Tester')
      RETURNING id;
    `);
    const userId = userRes.rows[0]!.id;
    const focusSessionId = '22222222-2222-4222-a222-222222222222';

    // First insert for focus_session source succeeds
    await db.query(`
      INSERT INTO public.evidence (user_id, title, evidence_type, source_type, source_id, verification_status)
      VALUES ('${userId}', 'Completed Focus Session', 'focus_session', 'focus_session', '${focusSessionId}', 'verified');
    `);

    // Second insert for same source_type and source_id for the same user fails with unique violation
    await expect(
      db.query(`
        INSERT INTO public.evidence (user_id, title, evidence_type, source_type, source_id, verification_status)
        VALUES ('${userId}', 'Duplicate Focus Evidence', 'focus_session', 'focus_session', '${focusSessionId}', 'verified');
      `)
    ).rejects.toThrow();

    // Manual evidence (source_id IS NULL) can have multiple entries
    await db.query(`
      INSERT INTO public.evidence (user_id, title, evidence_type, source_type, source_id)
      VALUES ('${userId}', 'Manual Entry 1', 'manual', 'user', NULL);
    `);
    await db.query(`
      INSERT INTO public.evidence (user_id, title, evidence_type, source_type, source_id)
      VALUES ('${userId}', 'Manual Entry 2', 'manual', 'user', NULL);
    `);
  });

  it('links evidence to entities and enforces unique link constraint and cascade deletion', async () => {
    const userRes = await db.query<{ id: string }>(`
      INSERT INTO public.profiles (clerk_user_id, display_name)
      VALUES ('clerk_test_links', 'Links Tester')
      RETURNING id;
    `);
    const userId = userRes.rows[0]!.id;

    // Create task
    const taskRes = await db.query<{ id: string }>(`
      INSERT INTO public.tasks (user_id, title)
      VALUES ('${userId}', 'Test Task for Evidence Link')
      RETURNING id;
    `);
    const taskId = taskRes.rows[0]!.id;

    // Create evidence
    const evidenceRes = await db.query<{ id: string }>(`
      INSERT INTO public.evidence (user_id, title, evidence_type, source_type)
      VALUES ('${userId}', 'Task Work Evidence', 'manual', 'user')
      RETURNING id;
    `);
    const evidenceId = evidenceRes.rows[0]!.id;

    // Link evidence to task
    await db.query(`
      INSERT INTO public.evidence_links (evidence_id, entity_type, entity_id)
      VALUES ('${evidenceId}', 'task', '${taskId}');
    `);

    // Duplicate link fails
    await expect(
      db.query(`
        INSERT INTO public.evidence_links (evidence_id, entity_type, entity_id)
        VALUES ('${evidenceId}', 'task', '${taskId}');
      `)
    ).rejects.toThrow();

    // Deleting evidence cascades and removes the evidence_links
    await db.query(`DELETE FROM public.evidence WHERE id = '${evidenceId}';`);
    const remainingLinks = await db.query(`
      SELECT * FROM public.evidence_links WHERE evidence_id = '${evidenceId}';
    `);
    expect(remainingLinks.rows).toHaveLength(0);
  });

  it('enforces strict RLS user isolation on evidence and evidence_links', async () => {
    // 1. Create Profile 1 (Alice) & Profile 2 (Bob)
    const aliceRes = await db.query<{ id: string }>(`
      INSERT INTO public.profiles (clerk_user_id, display_name)
      VALUES ('clerk_rls_alice_ev', 'Alice Evidence')
      RETURNING id;
    `);
    const aliceId = aliceRes.rows[0]!.id;

    await db.query(`
      INSERT INTO public.profiles (clerk_user_id, display_name)
      VALUES ('clerk_rls_bob_ev', 'Bob Evidence');
    `);

    // Alice creates an evidence item and a link
    const evRes = await db.query<{ id: string }>(`
      INSERT INTO public.evidence (user_id, title, evidence_type, source_type)
      VALUES ('${aliceId}', 'Alice Private Evidence', 'manual', 'user')
      RETURNING id;
    `);
    const aliceEvId = evRes.rows[0]!.id;

    await db.query(`
      INSERT INTO public.evidence_links (evidence_id, entity_type, entity_id)
      VALUES ('${aliceEvId}', 'task', '33333333-3333-4333-a333-333333333333');
    `);

    // 2. Query as Alice: sees her evidence and link
    await asUser('clerk_rls_alice_ev', 'authenticated', async () => {
      const evidenceRows = await db.query(`SELECT * FROM public.evidence WHERE id = '${aliceEvId}';`);
      expect(evidenceRows.rows).toHaveLength(1);

      const linkRows = await db.query(`SELECT * FROM public.evidence_links WHERE evidence_id = '${aliceEvId}';`);
      expect(linkRows.rows).toHaveLength(1);
    });

    // 3. Query as Bob: cannot see Alice's evidence or links
    await asUser('clerk_rls_bob_ev', 'authenticated', async () => {
      const evidenceRows = await db.query(`SELECT * FROM public.evidence WHERE id = '${aliceEvId}';`);
      expect(evidenceRows.rows).toHaveLength(0);

      const linkRows = await db.query(`SELECT * FROM public.evidence_links WHERE evidence_id = '${aliceEvId}';`);
      expect(linkRows.rows).toHaveLength(0);

      // Bob cannot modify Alice's evidence
      const updateRes = await db.query(`
        UPDATE public.evidence SET title = 'Hacked' WHERE id = '${aliceEvId}' RETURNING id;
      `);
      expect(updateRes.rows).toHaveLength(0);

      // Bob cannot delete Alice's evidence
      const deleteRes = await db.query(`
        DELETE FROM public.evidence WHERE id = '${aliceEvId}' RETURNING id;
      `);
      expect(deleteRes.rows).toHaveLength(0);
    });
  });
});
