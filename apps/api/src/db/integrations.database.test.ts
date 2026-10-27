import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Phase 14 Integrations Database Foundation, Constraints & RLS', () => {
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

    // 2. Apply all migrations in sequence (1 through 9)
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

  it('proves table schemas and constraints are correctly created', async () => {
    await asServiceRole(async () => {
      // Create user
      const userRes = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_test_user_1', 'Test User')
        RETURNING id;
      `);
      const userId = userRes.rows[0]!.id;

      // 1. Successful connection insert
      const connRes = await db.query<{ id: string }>(`
        INSERT INTO public.integration_connections (
          user_id, provider, external_account_id, external_username, status
        ) VALUES (
          '${userId}', 'github', '583231', 'octocat', 'CONNECTED'
        ) RETURNING id;
      `);
      expect(connRes.rows[0]!.id).toBeDefined();

      // 1b. Successful codeforces connection insert
      const cfRes = await db.query<{ id: string }>(`
        INSERT INTO public.integration_connections (
          user_id, provider, external_account_id, external_username, status
        ) VALUES (
          '${userId}', 'codeforces', 'tourist', 'tourist', 'CONNECTED'
        ) RETURNING id;
      `);
      expect(cfRes.rows[0]!.id).toBeDefined();

      // 1c. Successful codeforces activity insert
      const actRes = await db.query<{ id: string }>(`
        INSERT INTO public.external_activities (
          connection_id, user_id, provider, external_id, activity_type, occurred_at, title
        ) VALUES (
          '${cfRes.rows[0]!.id}', '${userId}', 'codeforces', 'submission:392217392', 'dsa_solve', NOW(), 'Solved A'
        ) RETURNING id;
      `);
      expect(actRes.rows[0]!.id).toBeDefined();

      // 2. Reject unsupported provider
      await expect(
        db.query(`
          INSERT INTO public.integration_connections (
            user_id, provider, external_account_id, status
          ) VALUES ('${userId}', 'unsupported_provider', '123', 'CONNECTED');
        `)
      ).rejects.toThrow();

      // 3. Reject duplicate connection for same user + provider
      await expect(
        db.query(`
          INSERT INTO public.integration_connections (
            user_id, provider, external_account_id, status
          ) VALUES ('${userId}', 'github', '999', 'CONNECTED');
        `)
      ).rejects.toThrow();
    });
  });

  it('enforces strict RLS isolation between User A and User B across all integration tables', async () => {
    let userAId: string;
    let _userBId: string;
    let connAId: string;

    await asServiceRole(async () => {
      const uA = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_A', 'User A')
        RETURNING id;
      `);
      userAId = uA.rows[0]!.id;

      const uB = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_B', 'User B')
        RETURNING id;
      `);
      _userBId = uB.rows[0]!.id;
      expect(_userBId).toBeDefined();

      const cA = await db.query<{ id: string }>(`
        INSERT INTO public.integration_connections (
          user_id, provider, external_account_id, external_username, status
        ) VALUES ('${userAId}', 'github', '111', 'octo_a', 'CONNECTED')
        RETURNING id;
      `);
      connAId = cA.rows[0]!.id;

      await db.query(`
        INSERT INTO public.external_repositories (
          connection_id, user_id, provider, external_id, name, full_name, owner, html_url
        ) VALUES ('${connAId}', '${userAId}', 'github', 'repo_111', 'my-repo', 'octo_a/my-repo', 'octo_a', 'https://github.com/octo_a/my-repo');
      `);

      await db.query(`
        INSERT INTO public.external_activities (
          connection_id, user_id, provider, external_id, activity_type, occurred_at, title
        ) VALUES ('${connAId}', '${userAId}', 'github', 'act_111', 'push', now(), 'Pushed code');
      `);

      await db.query(`
        INSERT INTO public.integration_oauth_states (
          state, user_id, provider
        ) VALUES ('state_secret_for_user_a', '${userAId}', 'github');
      `);
    });

    // Verify User A can see their own data
    await asUser('clerk_user_A', 'authenticated', async () => {
      const conns = await db.query(`SELECT * FROM public.integration_connections;`);
      expect(conns.rows).toHaveLength(1);

      const repos = await db.query(`SELECT * FROM public.external_repositories;`);
      expect(repos.rows).toHaveLength(1);

      const acts = await db.query(`SELECT * FROM public.external_activities;`);
      expect(acts.rows).toHaveLength(1);

      const states = await db.query(`SELECT * FROM public.integration_oauth_states;`);
      expect(states.rows).toHaveLength(1);
    });

    // Verify User B CANNOT see, modify, or delete User A's data
    await asUser('clerk_user_B', 'authenticated', async () => {
      const conns = await db.query(`SELECT * FROM public.integration_connections;`);
      expect(conns.rows).toHaveLength(0);

      const repos = await db.query(`SELECT * FROM public.external_repositories;`);
      expect(repos.rows).toHaveLength(0);

      const acts = await db.query(`SELECT * FROM public.external_activities;`);
      expect(acts.rows).toHaveLength(0);

      const states = await db.query(`SELECT * FROM public.integration_oauth_states;`);
      expect(states.rows).toHaveLength(0);

      // Attempt unauthorized delete
      await db.query(`DELETE FROM public.integration_connections WHERE id = '${connAId}';`);
    });

    // Check that User A's connection was NOT deleted by User B
    await asUser('clerk_user_A', 'authenticated', async () => {
      const conns = await db.query(`SELECT * FROM public.integration_connections WHERE id = '${connAId}';`);
      expect(conns.rows).toHaveLength(1);
    });
  });

  it('guarantees idempotent repository and activity upserts', async () => {
    await asServiceRole(async () => {
      const u = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_idemp', 'Idemp User')
        RETURNING id;
      `);
      const userId = u.rows[0]!.id;

      const c = await db.query<{ id: string }>(`
        INSERT INTO public.integration_connections (
          user_id, provider, external_account_id, status
        ) VALUES ('${userId}', 'github', 'idemp_acc', 'CONNECTED')
        RETURNING id;
      `);
      const connId = c.rows[0]!.id;

      // First insert repo
      await db.query(`
        INSERT INTO public.external_repositories (
          connection_id, user_id, provider, external_id, name, full_name, owner, html_url, stars_count
        ) VALUES ('${connId}', '${userId}', 'github', 'rep-999', 'star-repo', 'owner/star-repo', 'owner', 'http://url', 10)
        ON CONFLICT (user_id, provider, external_id) DO UPDATE SET stars_count = EXCLUDED.stars_count;
      `);

      // Second insert with updated stars count
      await db.query(`
        INSERT INTO public.external_repositories (
          connection_id, user_id, provider, external_id, name, full_name, owner, html_url, stars_count
        ) VALUES ('${connId}', '${userId}', 'github', 'rep-999', 'star-repo', 'owner/star-repo', 'owner', 'http://url', 25)
        ON CONFLICT (user_id, provider, external_id) DO UPDATE SET stars_count = EXCLUDED.stars_count;
      `);

      const repos = await db.query<{ stars_count: number }>(`
        SELECT stars_count FROM public.external_repositories WHERE user_id = '${userId}' AND external_id = 'rep-999';
      `);
      expect(repos.rows).toHaveLength(1);
      expect(repos.rows[0]!.stars_count).toBe(25);
    });
  });

  it('permits leetcode provider and rejects invalid providers', async () => {
    await asServiceRole(async () => {
      const u = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('clerk_user_leetcode', 'LeetCode User')
        RETURNING id;
      `);
      const userId = u.rows[0]!.id;

      // 1. Valid LeetCode connection with sync_state
      const c = await db.query<{ id: string }>(`
        INSERT INTO public.integration_connections (
          user_id, provider, external_account_id, external_username, status, sync_state
        ) VALUES (
          '${userId}',
          'leetcode',
          'lc_coder',
          'lc_coder',
          'SYNCED',
          '{"totalSolved": 150, "easySolved": 80, "mediumSolved": 60, "hardSolved": 10}'::jsonb
        )
        RETURNING id;
      `);
      expect(c.rows).toHaveLength(1);
      const connId = c.rows[0]!.id;

      // 2. LeetCode external activity
      await db.query(`
        INSERT INTO public.external_activities (
          connection_id, user_id, provider, external_id, activity_type, occurred_at, title
        ) VALUES (
          '${connId}', '${userId}', 'leetcode', 'submission:987654', 'dsa_solve', now(), 'Solved Two Sum'
        );
      `);

      const acts = await db.query<{ title: string }>(`
        SELECT title FROM public.external_activities
        WHERE user_id = '${userId}' AND provider = 'leetcode';
      `);
      expect(acts.rows).toHaveLength(1);
      expect(acts.rows[0]!.title).toBe('Solved Two Sum');

      // 3. Reject unsupported provider
      await expect(
        db.query(`
          INSERT INTO public.integration_connections (
            user_id, provider, external_account_id, status
          ) VALUES ('${userId}', 'unsupported_platform', 'acc123', 'CONNECTED');
        `)
      ).rejects.toThrow();

      // 4. Valid Google Calendar connection and external_calendar_events
      const gcal = await db.query<{ id: string }>(`
        INSERT INTO public.integration_connections (
          user_id, provider, external_account_id, external_username, status, sync_state
        ) VALUES (
          '${userId}',
          'google_calendar',
          'google_sub_1092830192',
          'user@gmail.com',
          'SYNCED',
          '{"primaryCalendarId": "user@gmail.com", "primaryCalendarTimeZone": "UTC", "selectedCalendarIds": ["user@gmail.com"]}'::jsonb
        )
        RETURNING id;
      `);
      expect(gcal.rows).toHaveLength(1);
      const gcalConnId = gcal.rows[0]!.id;

      // Insert calendar event
      await db.query(`
        INSERT INTO public.external_calendar_events (
          connection_id, user_id, calendar_id, external_event_id, title, status, start_time, end_time, is_all_day, is_busy
        ) VALUES (
          '${gcalConnId}', '${userId}', 'user@gmail.com', 'event_abc_123', 'CS101 Lecture', 'confirmed', now(), now() + interval '1 hour', false, true
        );
      `);

      const events = await db.query<{ title: string; is_busy: boolean }>(`
        SELECT title, is_busy FROM public.external_calendar_events
        WHERE user_id = '${userId}' AND calendar_id = 'user@gmail.com';
      `);
      expect(events.rows).toHaveLength(1);
      expect(events.rows[0]!.title).toBe('CS101 Lecture');
      expect(events.rows[0]!.is_busy).toBe(true);

      // Verify unique constraint: duplicate event insert fails
      await expect(
        db.query(`
          INSERT INTO public.external_calendar_events (
            connection_id, user_id, calendar_id, external_event_id, title, status, start_time, end_time
          ) VALUES (
            '${gcalConnId}', '${userId}', 'user@gmail.com', 'event_abc_123', 'Duplicate', 'confirmed', now(), now() + interval '1 hour'
          );
        `)
      ).rejects.toThrow();
    });
  });
});
