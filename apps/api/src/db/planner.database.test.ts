import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Planner Atomic Apply Schedule RPC (PostgreSQL/PGlite)', () => {
  let db: PGlite;
  const aliceId = '00000000-0000-0000-0000-000000000001';
  const bobId = '00000000-0000-0000-0000-000000000002';

  beforeAll(async () => {
    db = new PGlite();

    // 1. Setup Supabase auth mock schema and roles
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;

      CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
      BEGIN
        RETURN coalesce(current_setting('request.jwt.claim.role', true), 'service_role');
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

    // 2. Apply migrations in order
    const migrationFiles = [
      '20261002000001_init_database_foundation.sql',
      '20261003000002_goals.sql',
      '20261003000003_tasks.sql',
      '20261004000009_integrations.sql',
      '20261005000012_integrations_google_calendar.sql',
      '20261017000021_planner_atomic_apply_schedule.sql',
    ];

    for (const file of migrationFiles) {
      const migPath = path.resolve(process.cwd(), `../../supabase/migrations/${file}`);
      const sql = fs.readFileSync(migPath, 'utf8');
      await db.exec(sql);
    }

    // 3. Insert test profiles
    await db.exec(`
      INSERT INTO public.profiles (id, clerk_user_id, display_name)
      VALUES
        ('${aliceId}', 'clerk_alice_db', 'Alice DB'),
        ('${bobId}', 'clerk_bob_db', 'Bob DB');
    `);
  }, 30000);

  it('RPC function planner_apply_schedule exists with secure definitions', async () => {
    const res = await db.query<{ proname: string; prosecdef: boolean }>(`
      SELECT proname, prosecdef
      FROM pg_proc
      JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
      WHERE pg_namespace.nspname = 'public'
        AND proname = 'planner_apply_schedule';
    `);

    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]?.proname).toBe('planner_apply_schedule');
    expect(res.rows[0]?.prosecdef).toBe(true); // SECURITY DEFINER
  });

  it('successfully applies a batch of tasks atomically and updates status to scheduled', async () => {
    // Insert 2 tasks for Alice
    const t1Res = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, priority, estimated_minutes)
      VALUES ('${aliceId}', 'Algorithmic Trading', 'planned', 'high', 60)
      RETURNING id, updated_at;
    `);
    const t2Res = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, priority, estimated_minutes)
      VALUES ('${aliceId}', 'Market Making Engine', 'planned', 'medium', 45)
      RETURNING id, updated_at;
    `);

    const t1 = t1Res.rows[0]!;
    const t2 = t2Res.rows[0]!;

    const blocks = [
      {
        task_id: t1.id,
        scheduled_start: '2026-10-18T09:00:00.000Z',
        scheduled_end: '2026-10-18T10:00:00.000Z',
        expected_updated_at: t1.updated_at,
      },
      {
        task_id: t2.id,
        scheduled_start: '2026-10-18T10:30:00.000Z',
        scheduled_end: '2026-10-18T11:15:00.000Z',
        expected_updated_at: t2.updated_at,
      },
    ];

    const applyRes = await db.query<{ planner_apply_schedule: { applied_count: number; task_ids: string[] } }>(`
      SELECT public.planner_apply_schedule(
        '${aliceId}'::UUID,
        '${JSON.stringify(blocks)}'::JSONB
      );
    `);

    const data = applyRes.rows[0]!.planner_apply_schedule;
    expect(data.applied_count).toBe(2);
    expect(data.task_ids).toContain(t1.id);
    expect(data.task_ids).toContain(t2.id);

    // Verify tasks are persisted with new status and schedule times
    const checkRes = await db.query<{ id: string; status: string; scheduled_start: string; scheduled_end: string }>(`
      SELECT id, status, scheduled_start, scheduled_end
      FROM public.tasks
      WHERE id IN ('${t1.id}', '${t2.id}')
      ORDER BY scheduled_start ASC;
    `);

    expect(checkRes.rows).toHaveLength(2);
    expect(checkRes.rows[0]?.status).toBe('scheduled');
    expect(new Date(checkRes.rows[0]!.scheduled_start).toISOString()).toBe('2026-10-18T09:00:00.000Z');
    expect(checkRes.rows[1]?.status).toBe('scheduled');
    expect(new Date(checkRes.rows[1]!.scheduled_start).toISOString()).toBe('2026-10-18T10:30:00.000Z');
  });

  it('guarantees atomicity: rolls back all task updates when payload contains cross-tenant task ID', async () => {
    // Alice's task
    const tAliceRes = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, priority, estimated_minutes)
      VALUES ('${aliceId}', 'Alice Private Task', 'planned', 'high', 60)
      RETURNING id, updated_at;
    `);
    const tAlice = tAliceRes.rows[0]!;

    // Bob's task
    const tBobRes = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, priority, estimated_minutes)
      VALUES ('${bobId}', 'Bob Private Task', 'planned', 'high', 60)
      RETURNING id, updated_at;
    `);
    const tBob = tBobRes.rows[0]!;

    const payload = [
      {
        task_id: tAlice.id,
        scheduled_start: '2026-10-18T13:00:00.000Z',
        scheduled_end: '2026-10-18T14:00:00.000Z',
        expected_updated_at: tAlice.updated_at,
      },
      {
        task_id: tBob.id,
        scheduled_start: '2026-10-18T14:00:00.000Z',
        scheduled_end: '2026-10-18T15:00:00.000Z',
        expected_updated_at: tBob.updated_at,
      },
    ];

    // Attempt to apply as Alice
    await expect(
      db.query(`
        SELECT public.planner_apply_schedule(
          '${aliceId}'::UUID,
          '${JSON.stringify(payload)}'::JSONB
        );
      `)
    ).rejects.toThrow(/belongs to another user/);

    // Atomicity check: Alice's task was NOT modified!
    const verifyAlice = await db.query<{ status: string; scheduled_start: string | null }>(`
      SELECT status, scheduled_start FROM public.tasks WHERE id = '${tAlice.id}';
    `);
    expect(verifyAlice.rows[0]?.status).toBe('planned');
    expect(verifyAlice.rows[0]?.scheduled_start).toBeNull();
  });

  it('guarantees atomicity: rolls back when a task is blocked by incomplete prerequisite', async () => {
    // Create prerequisite task (incomplete)
    const prereqRes = await db.query<{ id: string }>(`
      INSERT INTO public.tasks (user_id, title, status)
      VALUES ('${aliceId}', 'Read Paper', 'inbox')
      RETURNING id;
    `);
    const prereqId = prereqRes.rows[0]!.id;

    // Create dependent task
    const depRes = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, estimated_minutes)
      VALUES ('${aliceId}', 'Implement Paper', 'planned', 60)
      RETURNING id, updated_at;
    `);
    const dep = depRes.rows[0]!;

    // Link dependency
    await db.exec(`
      INSERT INTO public.task_dependencies (task_id, depends_on_task_id)
      VALUES ('${dep.id}', '${prereqId}');
    `);

    const payload = [
      {
        task_id: dep.id,
        scheduled_start: '2026-10-18T15:00:00.000Z',
        scheduled_end: '2026-10-18T16:00:00.000Z',
        expected_updated_at: dep.updated_at,
      },
    ];

    await expect(
      db.query(`
        SELECT public.planner_apply_schedule(
          '${aliceId}'::UUID,
          '${JSON.stringify(payload)}'::JSONB
        );
      `)
    ).rejects.toThrow(/incomplete prerequisite/);

    // Verify task not scheduled
    const verify = await db.query<{ status: string }>(`
      SELECT status FROM public.tasks WHERE id = '${dep.id}';
    `);
    expect(verify.rows[0]?.status).toBe('planned');
  });

  it('guarantees atomicity: rolls back when proposal is stale (updated_at mismatch)', async () => {
    const taskRes = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, estimated_minutes)
      VALUES ('${aliceId}', 'Stale Check Task', 'planned', 60)
      RETURNING id, updated_at;
    `);
    const task = taskRes.rows[0]!;

    const payload = [
      {
        task_id: task.id,
        scheduled_start: '2026-10-18T16:00:00.000Z',
        scheduled_end: '2026-10-18T17:00:00.000Z',
        expected_updated_at: '2020-01-01T00:00:00.000Z', // intentionally stale timestamp
      },
    ];

    await expect(
      db.query(`
        SELECT public.planner_apply_schedule(
          '${aliceId}'::UUID,
          '${JSON.stringify(payload)}'::JSONB
        );
      `)
    ).rejects.toThrow(/Stale proposal/);

    // Verify task untouched
    const verify = await db.query<{ status: string; scheduled_start: string | null }>(`
      SELECT status, scheduled_start FROM public.tasks WHERE id = '${task.id}';
    `);
    expect(verify.rows[0]?.status).toBe('planned');
    expect(verify.rows[0]?.scheduled_start).toBeNull();
  });

  it('guarantees atomicity: rolls back when payload contains internal overlapping blocks', async () => {
    const t1Res = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, estimated_minutes)
      VALUES ('${aliceId}', 'Overlap 1', 'planned', 60)
      RETURNING id, updated_at;
    `);
    const t2Res = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, estimated_minutes)
      VALUES ('${aliceId}', 'Overlap 2', 'planned', 60)
      RETURNING id, updated_at;
    `);

    const t1 = t1Res.rows[0]!;
    const t2 = t2Res.rows[0]!;

    const payload = [
      {
        task_id: t1.id,
        scheduled_start: '2026-10-19T09:00:00.000Z',
        scheduled_end: '2026-10-19T10:00:00.000Z',
        expected_updated_at: t1.updated_at,
      },
      {
        task_id: t2.id,
        scheduled_start: '2026-10-19T09:30:00.000Z', // overlaps t1!
        scheduled_end: '2026-10-19T10:30:00.000Z',
        expected_updated_at: t2.updated_at,
      },
    ];

    await expect(
      db.query(`
        SELECT public.planner_apply_schedule(
          '${aliceId}'::UUID,
          '${JSON.stringify(payload)}'::JSONB
        );
      `)
    ).rejects.toThrow(/overlapping schedule blocks/);

    // Verify neither task was updated
    const verify = await db.query<{ status: string }>(`
      SELECT status FROM public.tasks WHERE id IN ('${t1.id}', '${t2.id}');
    `);
    expect(verify.rows.every((r) => r.status === 'planned')).toBe(true);
  });

  it('guarantees atomicity: rolls back when proposed block conflicts with existing scheduled task', async () => {
    // Existing scheduled task
    await db.exec(`
      INSERT INTO public.tasks (user_id, title, status, scheduled_start, scheduled_end)
      VALUES (
        '${aliceId}',
        'Existing Focus Block',
        'scheduled',
        '2026-10-20 10:00:00+00',
        '2026-10-20 11:30:00+00'
      );
    `);

    // Candidate new task
    const tNewRes = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, estimated_minutes)
      VALUES ('${aliceId}', 'Conflicting Candidate', 'planned', 60)
      RETURNING id, updated_at;
    `);
    const tNew = tNewRes.rows[0]!;

    const payload = [
      {
        task_id: tNew.id,
        scheduled_start: '2026-10-20T11:00:00.000Z', // overlaps 10:00-11:30
        scheduled_end: '2026-10-20T12:00:00.000Z',
        expected_updated_at: tNew.updated_at,
      },
    ];

    await expect(
      db.query(`
        SELECT public.planner_apply_schedule(
          '${aliceId}'::UUID,
          '${JSON.stringify(payload)}'::JSONB
        );
      `)
    ).rejects.toThrow(/overlaps with another scheduled task/);

    const verify = await db.query<{ status: string }>(`
      SELECT status FROM public.tasks WHERE id = '${tNew.id}';
    `);
    expect(verify.rows[0]?.status).toBe('planned');
  });

  it('guarantees atomicity: rolls back when proposed block conflicts with confirmed external calendar event', async () => {
    // Setup connection and external calendar event
    const connRes = await db.query<{ id: string }>(`
      INSERT INTO public.integration_connections (user_id, provider, status, external_account_id)
      VALUES ('${aliceId}', 'google_calendar', 'CONNECTED', 'gcal_acct_alice')
      RETURNING id;
    `);
    const connId = connRes.rows[0]!.id;

    await db.exec(`
      INSERT INTO public.external_calendar_events (
        connection_id, user_id, calendar_id, external_event_id, title, status, start_time, end_time, is_all_day
      ) VALUES (
        '${connId}',
        '${aliceId}',
        'primary',
        'gcal_event_busy_1',
        'Client Meeting',
        'confirmed',
        '2026-10-21 14:00:00+00',
        '2026-10-21 15:00:00+00',
        false
      );
    `);

    const tRes = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, estimated_minutes)
      VALUES ('${aliceId}', 'Overlapping GCal Task', 'planned', 60)
      RETURNING id, updated_at;
    `);
    const t = tRes.rows[0]!;

    const payload = [
      {
        task_id: t.id,
        scheduled_start: '2026-10-21T14:30:00.000Z',
        scheduled_end: '2026-10-21T15:30:00.000Z',
        expected_updated_at: t.updated_at,
      },
    ];

    await expect(
      db.query(`
        SELECT public.planner_apply_schedule(
          '${aliceId}'::UUID,
          '${JSON.stringify(payload)}'::JSONB
        );
      `)
    ).rejects.toThrow(/overlaps with an external busy calendar event/);

    const verify = await db.query<{ status: string }>(`
      SELECT status FROM public.tasks WHERE id = '${t.id}';
    `);
    expect(verify.rows[0]?.status).toBe('planned');
  });

  it('guarantees atomicity: rolls back when task is currently in_progress', async () => {
    const tRes = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, estimated_minutes)
      VALUES ('${aliceId}', 'Ongoing Task', 'in_progress', 60)
      RETURNING id, updated_at;
    `);
    const t = tRes.rows[0]!;

    const payload = [
      {
        task_id: t.id,
        scheduled_start: '2026-10-22T09:00:00.000Z',
        scheduled_end: '2026-10-22T10:00:00.000Z',
        expected_updated_at: t.updated_at,
      },
    ];

    await expect(
      db.query(`
        SELECT public.planner_apply_schedule(
          '${aliceId}'::UUID,
          '${JSON.stringify(payload)}'::JSONB
        );
      `)
    ).rejects.toThrow(/non-schedulable status.*in_progress/);

    const verify = await db.query<{ status: string; scheduled_start: string | null }>(`
      SELECT status, scheduled_start FROM public.tasks WHERE id = '${t.id}';
    `);
    expect(verify.rows[0]?.status).toBe('in_progress');
    expect(verify.rows[0]?.scheduled_start).toBeNull();
  });

  it('guarantees transactional atomicity: earlier block update in batch does not persist if later block fails', async () => {
    const t1Res = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, estimated_minutes)
      VALUES ('${aliceId}', 'Valid First Block Task', 'planned', 60)
      RETURNING id, updated_at;
    `);
    const t2Res = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, estimated_minutes)
      VALUES ('${aliceId}', 'Failing Second Block Task', 'planned', 60)
      RETURNING id, updated_at;
    `);

    const t1 = t1Res.rows[0]!;
    const t2 = t2Res.rows[0]!;

    const payload = [
      {
        task_id: t1.id,
        scheduled_start: '2026-10-23T09:00:00.000Z',
        scheduled_end: '2026-10-23T10:00:00.000Z',
        expected_updated_at: t1.updated_at,
      },
      {
        task_id: t2.id,
        scheduled_start: '2026-10-23T10:30:00.000Z',
        scheduled_end: '2026-10-23T11:30:00.000Z',
        expected_updated_at: '2020-01-01T00:00:00.000Z', // STALE! Fails!
      },
    ];

    await expect(
      db.query(`
        SELECT public.planner_apply_schedule(
          '${aliceId}'::UUID,
          '${JSON.stringify(payload)}'::JSONB
        );
      `)
    ).rejects.toThrow(/Stale proposal/);

    // Verify Block 1 was NOT updated or scheduled (true ACID rollback)
    const check1 = await db.query<{ status: string; scheduled_start: string | null }>(`
      SELECT status, scheduled_start FROM public.tasks WHERE id = '${t1.id}';
    `);
    expect(check1.rows[0]?.status).toBe('planned');
    expect(check1.rows[0]?.scheduled_start).toBeNull();
  });

  it('enforces privilege isolation: anon and authenticated roles have EXECUTE revoked, granted only to service_role', async () => {
    const aclRes = await db.query<{ grantee: string; privilege_type: string }>(`
      SELECT grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public'
        AND routine_name = 'planner_apply_schedule';
    `);

    const grantees = aclRes.rows.map((r) => r.grantee);
    expect(grantees).not.toContain('PUBLIC');
    expect(grantees).not.toContain('anon');
    expect(grantees).not.toContain('authenticated');
    expect(grantees).toContain('service_role');
  });

  it('prevents concurrent schedule overlap: simultaneous calls for the same user with overlapping intervals cannot both succeed', async () => {
    // Alice has two eligible planned tasks
    const t1Res = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, priority, estimated_minutes)
      VALUES ('${aliceId}', 'Concurrent Task 1', 'planned', 'high', 60)
      RETURNING id, updated_at;
    `);
    const t2Res = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, priority, estimated_minutes)
      VALUES ('${aliceId}', 'Concurrent Task 2', 'planned', 'medium', 60)
      RETURNING id, updated_at;
    `);

    const t1 = t1Res.rows[0]!;
    const t2 = t2Res.rows[0]!;

    // Proposal 1: 10:00 to 11:00 UTC
    const payload1 = [
      {
        task_id: t1.id,
        scheduled_start: '2026-10-25T10:00:00.000Z',
        scheduled_end: '2026-10-25T11:00:00.000Z',
        expected_updated_at: t1.updated_at,
      },
    ];

    // Proposal 2: 10:30 to 11:30 UTC (overlaps with Proposal 1)
    const payload2 = [
      {
        task_id: t2.id,
        scheduled_start: '2026-10-25T10:30:00.000Z',
        scheduled_end: '2026-10-25T11:30:00.000Z',
        expected_updated_at: t2.updated_at,
      },
    ];

    // Simultaneously apply both schedules
    const results = await Promise.allSettled([
      db.query(`
        SELECT public.planner_apply_schedule(
          '${aliceId}'::UUID,
          '${JSON.stringify(payload1)}'::JSONB
        );
      `),
      db.query(`
        SELECT public.planner_apply_schedule(
          '${aliceId}'::UUID,
          '${JSON.stringify(payload2)}'::JSONB
        );
      `),
    ]);

    // Exactly one must succeed, and one must be rejected
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(/Schedule conflict.*overlaps/);

    // Final verification: database contains NO overlapping newly applied tasks
    const scheduled = await db.query<{ id: string; status: string }>(`
      SELECT id, status FROM public.tasks
      WHERE id IN ('${t1.id}', '${t2.id}') AND status = 'scheduled';
    `);
    expect(scheduled.rows).toHaveLength(1);
  });

  it('guarantees atomicity: rolls back when client tampers with block duration (estimate mismatch)', async () => {
    // Task with explicit estimate of 45 minutes
    const tRes = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, estimated_minutes)
      VALUES ('${aliceId}', 'Tampered Estimate Task', 'planned', 45)
      RETURNING id, updated_at;
    `);
    const t = tRes.rows[0]!;

    // Tampered payload: 90-minute block (10:00 to 11:30) != 45 minutes
    const payload = [
      {
        task_id: t.id,
        scheduled_start: '2026-10-26T10:00:00.000Z',
        scheduled_end: '2026-10-26T11:30:00.000Z',
        expected_updated_at: t.updated_at,
      },
    ];

    await expect(
      db.query(`
        SELECT public.planner_apply_schedule(
          '${aliceId}'::UUID,
          '${JSON.stringify(payload)}'::JSONB
        );
      `)
    ).rejects.toThrow(/Invalid block duration for task.*scheduled duration \(90m\) does not match task estimate \(45m\)/);

    // Verify task was NOT modified
    const verify = await db.query<{ status: string; scheduled_start: string | null }>(`
      SELECT status, scheduled_start FROM public.tasks WHERE id = '${t.id}';
    `);
    expect(verify.rows[0]?.status).toBe('planned');
    expect(verify.rows[0]?.scheduled_start).toBeNull();
  });

  it('guarantees atomicity: rolls back when client tampers with unestimated task canonical duration (30m)', async () => {
    // Task with NULL estimated_minutes (canonical provisional default is 30m)
    const tRes = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status)
      VALUES ('${aliceId}', 'Unestimated Tampered Task', 'planned')
      RETURNING id, updated_at;
    `);
    const t = tRes.rows[0]!;

    // Tampered payload: 60-minute block != 30 minutes default
    const payload = [
      {
        task_id: t.id,
        scheduled_start: '2026-10-26T12:00:00.000Z',
        scheduled_end: '2026-10-26T13:00:00.000Z',
        expected_updated_at: t.updated_at,
      },
    ];

    await expect(
      db.query(`
        SELECT public.planner_apply_schedule(
          '${aliceId}'::UUID,
          '${JSON.stringify(payload)}'::JSONB
        );
      `)
    ).rejects.toThrow(/Invalid block duration for task.*scheduled duration \(60m\) does not match task estimate \(30m\)/);

    // Verify task was NOT modified
    const verify = await db.query<{ status: string; scheduled_start: string | null }>(`
      SELECT status, scheduled_start FROM public.tasks WHERE id = '${t.id}';
    `);
    expect(verify.rows[0]?.status).toBe('planned');
    expect(verify.rows[0]?.scheduled_start).toBeNull();
  });

  it('guarantees atomicity: rolls back when block timestamps contain non-zero seconds', async () => {
    const tRes = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, estimated_minutes)
      VALUES ('${aliceId}', 'DB Seconds Task', 'planned', 60)
      RETURNING id, updated_at;
    `);
    const t = tRes.rows[0]!;

    // 14:00:15 to 15:00:15 (contains 15 seconds)
    const payload = [
      {
        task_id: t.id,
        scheduled_start: '2026-10-26T14:00:15.000Z',
        scheduled_end: '2026-10-26T15:00:15.000Z',
        expected_updated_at: t.updated_at,
      },
    ];

    await expect(
      db.query(`
        SELECT public.planner_apply_schedule(
          '${aliceId}'::UUID,
          '${JSON.stringify(payload)}'::JSONB
        );
      `)
    ).rejects.toThrow(/must be aligned to whole-minute boundaries \(zero seconds and fractional seconds\)/);

    // Verify task remains untouched
    const verify = await db.query<{ status: string; scheduled_start: string | null }>(`
      SELECT status, scheduled_start FROM public.tasks WHERE id = '${t.id}';
    `);
    expect(verify.rows[0]?.status).toBe('planned');
    expect(verify.rows[0]?.scheduled_start).toBeNull();
  });

  it('guarantees atomicity: rolls back when block timestamps contain non-zero milliseconds', async () => {
    const tRes = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, estimated_minutes)
      VALUES ('${aliceId}', 'DB Milliseconds Task', 'planned', 60)
      RETURNING id, updated_at;
    `);
    const t = tRes.rows[0]!;

    // 14:00:00.000 to 15:00:00.500 (contains 500ms)
    const payload = [
      {
        task_id: t.id,
        scheduled_start: '2026-10-26T14:00:00.000Z',
        scheduled_end: '2026-10-26T15:00:00.500Z',
        expected_updated_at: t.updated_at,
      },
    ];

    await expect(
      db.query(`
        SELECT public.planner_apply_schedule(
          '${aliceId}'::UUID,
          '${JSON.stringify(payload)}'::JSONB
        );
      `)
    ).rejects.toThrow(/must be aligned to whole-minute boundaries \(zero seconds and fractional seconds\)/);

    const verify = await db.query<{ status: string; scheduled_start: string | null }>(`
      SELECT status, scheduled_start FROM public.tasks WHERE id = '${t.id}';
    `);
    expect(verify.rows[0]?.status).toBe('planned');
    expect(verify.rows[0]?.scheduled_start).toBeNull();
  });

  it('guarantees atomicity: rolls back when block timestamps contain fractional seconds (microseconds)', async () => {
    const tRes = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, estimated_minutes)
      VALUES ('${aliceId}', 'DB Microseconds Task', 'planned', 60)
      RETURNING id, updated_at;
    `);
    const t = tRes.rows[0]!;

    // Start contains microseconds: 14:00:00.000123Z
    const payload = [
      {
        task_id: t.id,
        scheduled_start: '2026-10-26T14:00:00.000123Z',
        scheduled_end: '2026-10-26T15:00:00.000000Z',
        expected_updated_at: t.updated_at,
      },
    ];

    await expect(
      db.query(`
        SELECT public.planner_apply_schedule(
          '${aliceId}'::UUID,
          '${JSON.stringify(payload)}'::JSONB
        );
      `)
    ).rejects.toThrow(/must be aligned to whole-minute boundaries \(zero seconds and fractional seconds\)/);

    const verify = await db.query<{ status: string; scheduled_start: string | null }>(`
      SELECT status, scheduled_start FROM public.tasks WHERE id = '${t.id}';
    `);
    expect(verify.rows[0]?.status).toBe('planned');
    expect(verify.rows[0]?.scheduled_start).toBeNull();
  });

  it('successfully applies schedule when block timestamps are strictly minute-aligned', async () => {
    const tRes = await db.query<{ id: string; updated_at: string }>(`
      INSERT INTO public.tasks (user_id, title, status, estimated_minutes)
      VALUES ('${aliceId}', 'DB Valid Aligned Task', 'planned', 60)
      RETURNING id, updated_at;
    `);
    const t = tRes.rows[0]!;

    const payload = [
      {
        task_id: t.id,
        scheduled_start: '2026-10-26T14:00:00.000Z',
        scheduled_end: '2026-10-26T15:00:00.000Z',
        expected_updated_at: t.updated_at,
      },
    ];

    const res = await db.query<{ planner_apply_schedule: { applied_count: number; task_ids: string[] } }>(`
      SELECT public.planner_apply_schedule(
        '${aliceId}'::UUID,
        '${JSON.stringify(payload)}'::JSONB
      );
    `);

    expect(res.rows[0]?.planner_apply_schedule.applied_count).toBe(1);

    const verify = await db.query<{ status: string; scheduled_start: string }>(`
      SELECT status, scheduled_start FROM public.tasks WHERE id = '${t.id}';
    `);
    expect(verify.rows[0]?.status).toBe('scheduled');
    expect(new Date(verify.rows[0]!.scheduled_start).toISOString()).toBe('2026-10-26T14:00:00.000Z');
  });
});
