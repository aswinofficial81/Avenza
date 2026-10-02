import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Supabase PostgreSQL Database Foundation', () => {
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

      -- Create non-owner roles mimicking Supabase
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

    // 2. Read and apply the actual production migration file
    const migrationPath = path.resolve(
      process.cwd(),
      '../../supabase/migrations/20261002000001_init_database_foundation.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await db.exec(sql);

    // 3. Grant schema permissions to authenticated & anon roles
    await db.exec(`
      GRANT USAGE ON SCHEMA public TO authenticated, anon;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
    `);
  });

  describe('1. Schema & Table Verification', () => {
    it('creates profiles and user_preferences tables', async () => {
      const res = await db.query<{ table_name: string }>(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('profiles', 'user_preferences')
        ORDER BY table_name;
      `);

      const tables = res.rows.map((r) => r.table_name);
      expect(tables).toEqual(['profiles', 'user_preferences']);
    });

    it('creates expected columns in profiles', async () => {
      const res = await db.query<{ column_name: string; data_type: string }>(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles'
        ORDER BY ordinal_position;
      `);

      const colNames = res.rows.map((r) => r.column_name);
      expect(colNames).toContain('id');
      expect(colNames).toContain('clerk_user_id');
      expect(colNames).toContain('display_name');
      expect(colNames).toContain('avatar_url');
      expect(colNames).toContain('timezone');
      expect(colNames).toContain('created_at');
      expect(colNames).toContain('updated_at');
    });

    it('creates expected columns in user_preferences', async () => {
      const res = await db.query<{ column_name: string }>(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'user_preferences'
        ORDER BY ordinal_position;
      `);

      const colNames = res.rows.map((r) => r.column_name);
      expect(colNames).toContain('id');
      expect(colNames).toContain('user_id');
      expect(colNames).toContain('theme');
      expect(colNames).toContain('timezone');
      expect(colNames).toContain('preferred_study_start');
      expect(colNames).toContain('preferred_study_end');
      expect(colNames).toContain('daily_minimum_minutes');
      expect(colNames).toContain('daily_target_minutes');
      expect(colNames).toContain('max_daily_study_minutes');
      expect(colNames).toContain('created_at');
      expect(colNames).toContain('updated_at');
    });
  });

  describe('2. Constraints & Uniqueness', () => {
    it('enforces clerk_user_id uniqueness on profiles', async () => {
      await db.exec(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('user_unique_test', 'User Test');
      `);

      await expect(
        db.exec(`
          INSERT INTO public.profiles (clerk_user_id, display_name)
          VALUES ('user_unique_test', 'Duplicate User');
        `)
      ).rejects.toThrow(/uq_profiles_clerk_user_id/);
    });

    it('rejects empty clerk_user_id strings', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.profiles (clerk_user_id, display_name)
          VALUES ('   ', 'Empty User');
        `)
      ).rejects.toThrow(/chk_profiles_clerk_user_id_non_empty/);
    });

    it('enforces user_preferences.user_id 1:1 uniqueness', async () => {
      const res = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('user_pref_unique_test', 'Preference User')
        RETURNING id;
      `);
      const userId = res.rows[0]?.id;

      await db.exec(`
        INSERT INTO public.user_preferences (user_id, theme)
        VALUES ('${userId}', 'dark');
      `);

      await expect(
        db.exec(`
          INSERT INTO public.user_preferences (user_id, theme)
          VALUES ('${userId}', 'light');
        `)
      ).rejects.toThrow(/uq_user_preferences_user_id/);
    });
  });

  describe('3. Foreign Keys & Cascading Deletion', () => {
    it('rejects user_preferences referencing non-existent profile', async () => {
      const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
      await expect(
        db.exec(`
          INSERT INTO public.user_preferences (user_id, theme)
          VALUES ('${nonExistentUuid}', 'system');
        `)
      ).rejects.toThrow(/fk_user_preferences_user_id/);
    });

    it('cascades profile deletion to user_preferences', async () => {
      const res = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('user_cascade_test', 'Cascade User')
        RETURNING id;
      `);
      const userId = res.rows[0]?.id;

      await db.exec(`
        INSERT INTO public.user_preferences (user_id, theme)
        VALUES ('${userId}', 'dark');
      `);

      // Delete the profile
      await db.exec(`DELETE FROM public.profiles WHERE id = '${userId}';`);

      // Verify user_preferences was automatically cascaded
      const prefCheck = await db.query(`
        SELECT * FROM public.user_preferences WHERE user_id = '${userId}';
      `);
      expect(prefCheck.rows.length).toBe(0);
    });
  });

  describe('4. Timestamp Defaults & updated_at Triggers', () => {
    it('populates created_at and updated_at automatically', async () => {
      const res = await db.query<{ created_at: string; updated_at: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('user_time_test', 'Time Test')
        RETURNING created_at, updated_at;
      `);

      const row = res.rows[0];
      expect(row?.created_at).toBeDefined();
      expect(row?.updated_at).toBeDefined();
      expect(new Date(row?.created_at as string).getTime()).toBeGreaterThan(0);
    });

    it('automatically updates updated_at upon row modification', async () => {
      const insertRes = await db.query<{ id: string; updated_at: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name, updated_at)
        VALUES ('user_trigger_test', 'Original Name', now() - interval '1 hour')
        RETURNING id, updated_at;
      `);

      const id = insertRes.rows[0]?.id;
      const initialUpdatedAt = new Date(insertRes.rows[0]?.updated_at as string).getTime();

      // Perform update
      await db.exec(`
        UPDATE public.profiles 
        SET display_name = 'Updated Name' 
        WHERE id = '${id}';
      `);

      const updatedRes = await db.query<{ updated_at: string }>(`
        SELECT updated_at FROM public.profiles WHERE id = '${id}';
      `);
      const newUpdatedAt = new Date(updatedRes.rows[0]?.updated_at as string).getTime();

      expect(newUpdatedAt).toBeGreaterThan(initialUpdatedAt);
    });
  });

  describe('5. Preference Constraints & Validation', () => {
    let testUserId: string;

    beforeAll(async () => {
      const res = await db.query<{ id: string }>(`
        INSERT INTO public.profiles (clerk_user_id, display_name)
        VALUES ('pref_constraints_test_user', 'Prefs Tester')
        RETURNING id;
      `);
      testUserId = res.rows[0]?.id as string;
    });

    it('rejects invalid theme names', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.user_preferences (user_id, theme)
          VALUES ('${testUserId}', 'neon');
        `)
      ).rejects.toThrow(/chk_user_preferences_theme/);
    });

    it('rejects negative daily minimum minutes', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.user_preferences (user_id, daily_minimum_minutes)
          VALUES ('${testUserId}', -10);
        `)
      ).rejects.toThrow(/chk_daily_minimum_minutes_non_negative/);
    });

    it('rejects negative daily target minutes', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.user_preferences (user_id, daily_target_minutes)
          VALUES ('${testUserId}', -5);
        `)
      ).rejects.toThrow(/chk_daily_target_minutes_non_negative/);
    });

    it('rejects target minutes smaller than minimum minutes', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.user_preferences (user_id, daily_minimum_minutes, daily_target_minutes)
          VALUES ('${testUserId}', 60, 30);
        `)
      ).rejects.toThrow(/chk_target_gte_minimum/);
    });

    it('rejects max study minutes smaller than target minutes', async () => {
      await expect(
        db.exec(`
          INSERT INTO public.user_preferences (user_id, daily_minimum_minutes, daily_target_minutes, max_daily_study_minutes)
          VALUES ('${testUserId}', 30, 120, 60);
        `)
      ).rejects.toThrow(/chk_max_gte_target/);
    });

    it('accepts valid preference boundaries', async () => {
      await db.exec(`
        INSERT INTO public.user_preferences (
          user_id, 
          theme, 
          daily_minimum_minutes, 
          daily_target_minutes, 
          max_daily_study_minutes
        )
        VALUES ('${testUserId}', 'dark', 45, 120, 300);
      `);

      const res = await db.query<{ theme: string; daily_target_minutes: number }>(`
        SELECT theme, daily_target_minutes FROM public.user_preferences WHERE user_id = '${testUserId}';
      `);
      expect(res.rows[0]?.theme).toBe('dark');
      expect(res.rows[0]?.daily_target_minutes).toBe(120);
    });
  });

  describe('6. Row Level Security Policies & Cross-User Isolation', () => {
    it('verifies RLS is enabled on both tables', async () => {
      const res = await db.query<{ relname: string; relrowsecurity: boolean }>(`
        SELECT relname, relrowsecurity 
        FROM pg_class 
        WHERE relname IN ('profiles', 'user_preferences')
          AND relnamespace = 'public'::regnamespace;
      `);

      expect(res.rows.length).toBe(2);
      for (const row of res.rows) {
        expect(row.relrowsecurity).toBe(true);
      }
    });

    it('verifies defined policies in pg_policies', async () => {
      const res = await db.query<{ tablename: string; policyname: string }>(`
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname;
      `);

      const policyNames = res.rows.map((p) => p.policyname);
      expect(policyNames).toContain('profiles_select_policy');
      expect(policyNames).toContain('profiles_insert_policy');
      expect(policyNames).toContain('profiles_update_policy');
      expect(policyNames).toContain('profiles_delete_policy');
      expect(policyNames).toContain('user_preferences_select_policy');
      expect(policyNames).toContain('user_preferences_insert_policy');
      expect(policyNames).toContain('user_preferences_update_policy');
      expect(policyNames).toContain('user_preferences_delete_policy');
    });

    it('enforces cross-user isolation when querying with Clerk JWT identity', async () => {
      // 1. Create Profile and Preferences for User Alpha
      await db.exec(`
        INSERT INTO public.profiles (id, clerk_user_id, display_name)
        VALUES ('11111111-1111-1111-1111-111111111111', 'clerk_user_alpha', 'Alpha');

        INSERT INTO public.user_preferences (user_id, theme, daily_target_minutes)
        VALUES ('11111111-1111-1111-1111-111111111111', 'dark', 90);
      `);

      // 2. Create Profile and Preferences for User Beta
      await db.exec(`
        INSERT INTO public.profiles (id, clerk_user_id, display_name)
        VALUES ('22222222-2222-2222-2222-222222222222', 'clerk_user_beta', 'Beta');

        INSERT INTO public.user_preferences (user_id, theme, daily_target_minutes)
        VALUES ('22222222-2222-2222-2222-222222222222', 'light', 150);
      `);

      // 3. Set auth context for User Beta
      await db.exec(`
        SET ROLE authenticated;
        SET "request.jwt.claim.role" = 'authenticated';
        SET "request.jwt.claims" = '{"sub": "clerk_user_beta"}';
      `);

      // 4. Query profiles - User Beta must NOT see User Alpha's profile
      const betaProfileQuery = await db.query<{ clerk_user_id: string }>(`
        SELECT clerk_user_id FROM public.profiles;
      `);
      const visibleProfiles = betaProfileQuery.rows.map((r) => r.clerk_user_id);
      expect(visibleProfiles).toContain('clerk_user_beta');
      expect(visibleProfiles).not.toContain('clerk_user_alpha');

      // 5. Query preferences - User Beta must NOT see User Alpha's preferences
      const betaPrefQuery = await db.query<{ user_id: string }>(`
        SELECT user_id FROM public.user_preferences;
      `);
      const visiblePrefs = betaPrefQuery.rows.map((r) => r.user_id);
      expect(visiblePrefs).toContain('22222222-2222-2222-2222-222222222222');
      expect(visiblePrefs).not.toContain('11111111-1111-1111-1111-111111111111');

      // 6. User Beta attempts to UPDATE User Alpha's profile - must affect 0 rows
      const updateAttempt = await db.query(`
        UPDATE public.profiles 
        SET display_name = 'Hacked Alpha' 
        WHERE clerk_user_id = 'clerk_user_alpha';
      `);
      expect(updateAttempt.affectedRows).toBe(0);

      // 7. Verify with service_role that Alpha's profile remains untouched
      await db.exec(`
        RESET ROLE;
        SET "request.jwt.claim.role" = 'service_role';
        SET "request.jwt.claims" = '{}';
      `);

      const alphaCheck = await db.query<{ display_name: string }>(`
        SELECT display_name FROM public.profiles WHERE clerk_user_id = 'clerk_user_alpha';
      `);
      expect(alphaCheck.rows[0]?.display_name).toBe('Alpha');
    });
  });
});
