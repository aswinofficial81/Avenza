/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { DsaRepositoryImpl } from './dsa.repository.impl';
import { DsaServiceImpl } from './dsa.service.impl';

describe('Phase 13 DSA Domain, Repository, Invariants & Deterministic Engine', () => {
  let db: PGlite;
  let repository: DsaRepositoryImpl;
  let service: DsaServiceImpl;

  const USER_A = 'a0000000-0000-0000-0000-000000000001';
  const USER_B = 'b0000000-0000-0000-0000-000000000002';
  const CLERK_A = 'clerk_user_a';
  const CLERK_B = 'clerk_user_b';
  const nowIso = new Date().toISOString();

  beforeAll(async () => {
    db = new PGlite();

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

    const migrations = [
      '../../supabase/migrations/20261002000001_init_database_foundation.sql',
      '../../supabase/migrations/20261003000002_goals.sql',
      '../../supabase/migrations/20261003000003_tasks.sql',
      '../../supabase/migrations/20261003000004_focus_sessions.sql',
      '../../supabase/migrations/20261003000005_evidence.sql',
      '../../supabase/migrations/20261003000006_academics.sql',
      '../../supabase/migrations/20261003000007_skills.sql',
      '../../supabase/migrations/20261004000008_dsa.sql',
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

    await db.query(
      `INSERT INTO public.profiles (id, clerk_user_id, display_name)
       VALUES ($1, $2, $3), ($4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [USER_A, CLERK_A, 'User A', USER_B, CLERK_B, 'User B']
    );

    // Create repository adapter wrapping PGlite to match SupabaseClient interface for tests
    const createPgLiteSupabaseAdapter = (pg: PGlite) => {
      const queryBuilder = (tableName: string) => {
        let action = 'select';
        let selectColumns = '*';
        let insertData: any = null;
        let updateData: any = null;
        const whereClauses: string[] = [];
        let orderClause = '';
        let limitClause = '';
        let isSingle = false;
        let isMaybeSingle = false;

        const builder: any = {
          select(cols = '*', _opts?: any) {
            selectColumns = cols;
            return builder;
          },
          insert(data: any) {
            action = 'insert';
            insertData = Array.isArray(data) ? data : [data];
            return builder;
          },
          update(data: any) {
            action = 'update';
            updateData = data;
            return builder;
          },
          delete() {
            action = 'delete';
            return builder;
          },
          eq(col: string, val: any) {
            if (val === null) {
              whereClauses.push(`${col} IS NULL`);
            } else {
              whereClauses.push(`${col} = '${String(val).replace(/'/g, "''")}'`);
            }
            return builder;
          },
          neq(col: string, val: any) {
            whereClauses.push(`${col} <> '${String(val).replace(/'/g, "''")}'`);
            return builder;
          },
          gt(col: string, val: any) {
            whereClauses.push(`${col} > ${val}`);
            return builder;
          },
          gte(col: string, val: any) {
            whereClauses.push(`${col} >= ${val}`);
            return builder;
          },
          lt(col: string, val: any) {
            whereClauses.push(`${col} < ${val}`);
            return builder;
          },
          lte(col: string, val: any) {
            whereClauses.push(`${col} <= '${String(val).replace(/'/g, "''")}'`);
            return builder;
          },
          not(col: string, op: string, val: any) {
            if (op === 'is' && val === null) {
              whereClauses.push(`${col} IS NOT NULL`);
            }
            return builder;
          },
          in(col: string, vals: any[]) {
            if (!vals || vals.length === 0) {
              whereClauses.push(`1 = 0`);
            } else {
              const formatted = vals.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ');
              whereClauses.push(`${col} IN (${formatted})`);
            }
            return builder;
          },
          order(col: string, opts?: { ascending?: boolean }) {
            const dir = opts?.ascending ? 'ASC' : 'DESC';
            orderClause = `ORDER BY ${col} ${dir}`;
            return builder;
          },
          limit(count: number) {
            limitClause = `LIMIT ${count}`;
            return builder;
          },
          single() {
            isSingle = true;
            return builder;
          },
          maybeSingle() {
            isMaybeSingle = true;
            return builder;
          },
          async then(resolve: any, _reject: any) {
            try {
              let sql = '';
              const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

              if (action === 'select') {
                sql = `SELECT ${selectColumns === '*' ? '*' : selectColumns} FROM public.${tableName} ${whereSql} ${orderClause} ${limitClause}`;
                const res = await pg.query(sql);
                let data: any = res.rows;
                if (isSingle) {
                  data = res.rows[0] ?? null;
                  if (!data) {
                    return resolve({ data: null, error: new Error('Row not found') });
                  }
                } else if (isMaybeSingle) {
                  data = res.rows[0] ?? null;
                }
                return resolve({ data, count: res.rows.length, error: null });
              } else if (action === 'insert') {
                const keys = Object.keys(insertData[0]);
                const cols = keys.join(', ');
                const valRows = insertData.map((d: any) => {
                  return `(${keys.map(k => {
                    const v = d[k];
                    if (v === null || v === undefined) return 'NULL';
                    if (typeof v === 'number') return v;
                    if (v instanceof Date) return `'${v.toISOString()}'`;
                    return `'${String(v).replace(/'/g, "''")}'`;
                  }).join(', ')})`;
                }).join(', ');

                sql = `INSERT INTO public.${tableName} (${cols}) VALUES ${valRows} RETURNING *`;
                const res = await pg.query(sql);
                const data = isSingle || isMaybeSingle ? res.rows[0] : res.rows;
                return resolve({ data, error: null });
              } else if (action === 'update') {
                const keys = Object.keys(updateData);
                const setClauses = keys.map(k => {
                  const v = updateData[k];
                  if (v === null || v === undefined) return `${k} = NULL`;
                  if (typeof v === 'number') return `${k} = ${v}`;
                  if (v instanceof Date) return `${k} = '${v.toISOString()}'`;
                  return `${k} = '${String(v).replace(/'/g, "''")}'`;
                }).join(', ');

                sql = `UPDATE public.${tableName} SET ${setClauses} ${whereSql} RETURNING *`;
                const res = await pg.query(sql);
                const data = isSingle || isMaybeSingle ? res.rows[0] : res.rows;
                return resolve({ data, error: null });
              } else if (action === 'delete') {
                sql = `DELETE FROM public.${tableName} ${whereSql}`;
                await pg.query(sql);
                return resolve({ data: null, error: null });
              }
            } catch (err: any) {
              return resolve({ data: null, error: err });
            }
          },
        };
        return builder;
      };

      return {
        from(tableName: string) {
          return queryBuilder(tableName);
        },
      } as any;
    };

    const mockClient = createPgLiteSupabaseAdapter(db);
    repository = new DsaRepositoryImpl(mockClient);
    service = new DsaServiceImpl(repository);
  });

  describe('Part 2 — Evidence Creation on Solved Attempts & Idempotency', () => {
    it('creates exactly one evidence record when an attempt is SOLVED', async () => {
      const problem = await service.createProblem(USER_A, {
        title: 'Two Sum Evidence Test',
        difficulty: 'easy',
        source: 'user',
      });

      const attempt = await service.createAttempt(USER_A, {
        problem_id: problem.id,
        status: 'solved',
        solve_time_minutes: 15,
        occurred_at: nowIso,
      });

      expect(attempt.status).toBe('solved');

      // Check evidence table directly
      const evRows = (
        await db.query<{ id: string; evidence_type: string; source_type: string; source_id: string }>(
          `SELECT id, evidence_type, source_type, source_id
           FROM public.evidence
           WHERE source_type = 'dsa_attempt' AND source_id = $1`,
          [attempt.id]
        )
      ).rows;

      expect(evRows).toHaveLength(1);
      expect(evRows[0]!.evidence_type).toBe('dsa_problem_solved');
      expect(evRows[0]!.source_id).toBe(attempt.id);
    });

    it('does NOT create evidence when an attempt is FAILED', async () => {
      const problem = await service.createProblem(USER_A, {
        title: 'Failed Problem Evidence Test',
        difficulty: 'medium',
        source: 'user',
      });

      const attempt = await service.createAttempt(USER_A, {
        problem_id: problem.id,
        status: 'failed',
        occurred_at: nowIso,
      });

      expect(attempt.status).toBe('failed');

      const evRows = (
        await db.query(
          `SELECT id FROM public.evidence
           WHERE source_type = 'dsa_attempt' AND source_id = $1`,
          [attempt.id]
        )
      ).rows;

      expect(evRows).toHaveLength(0);
    });

    it('is idempotent: repeated processing does not create duplicate evidence', async () => {
      const problem = await service.createProblem(USER_A, {
        title: 'Idempotency Test Problem',
        difficulty: 'hard',
        source: 'user',
      });

      const attempt = await service.createAttempt(USER_A, {
        problem_id: problem.id,
        status: 'solved',
        solve_time_minutes: 40,
        occurred_at: nowIso,
      });

      // Repeatedly invoke evidence generator for the same attempt
      await (repository as any).ensureEvidenceForSolvedAttempt(USER_A, attempt.id, problem.id, 40);

      const evRows = (
        await db.query(
          `SELECT id FROM public.evidence
           WHERE source_type = 'dsa_attempt' AND source_id = $1`,
          [attempt.id]
        )
      ).rows;

      expect(evRows).toHaveLength(1);
    });
  });

  describe('Part 3 — Append-Only Attempt History', () => {
    it('preserves history: failed -> failed -> solved persists all three attempts', async () => {
      const problem = await service.createProblem(USER_A, {
        title: 'Three Attempts Problem',
        difficulty: 'medium',
        source: 'user',
      });

      const a1 = await service.createAttempt(USER_A, { problem_id: problem.id, status: 'failed', occurred_at: nowIso });
      const a2 = await service.createAttempt(USER_A, { problem_id: problem.id, status: 'failed', occurred_at: nowIso });
      const a3 = await service.createAttempt(USER_A, { problem_id: problem.id, status: 'solved', solve_time_minutes: 20, occurred_at: nowIso });

      const history = await service.listAttemptsByProblem(USER_A, problem.id);
      expect(history).toHaveLength(3);
      const ids = history.map(h => h.id);
      expect(ids).toContain(a1.id);
      expect(ids).toContain(a2.id);
      expect(ids).toContain(a3.id);
    });

    it('proves deleteAttempt is not exposed on service or repository', () => {
      expect((service as any).deleteAttempt).toBeUndefined();
      expect((repository as any).deleteAttempt).toBeUndefined();
    });
  });

  describe('Part 4 — Weak Area Analysis Boundaries', () => {
    it('correctly evaluates all 5 boundary conditions for weak areas', async () => {
      // Create a test user specific to weak areas
      const WEAK_USER = 'c0000000-0000-0000-0000-000000000003';
      await db.query(
        `INSERT INTO public.profiles (id, clerk_user_id, display_name)
         VALUES ($1, 'clerk_user_c', 'User C')
         ON CONFLICT (id) DO NOTHING`,
        [WEAK_USER]
      );

      // Topic 1: 2 attempts, 2 failures (100%) -> NOT WEAK (< 3 attempts)
      const t1 = await service.createTopic(WEAK_USER, { name: 'Topic 2 Attempts' });
      const p1 = await service.createProblem(WEAK_USER, { title: 'P1 T1', difficulty: 'easy', source: 'user' });
      await service.linkProblemTopic(WEAK_USER, { problem_id: p1.id, topic_id: t1.id });
      await service.createAttempt(WEAK_USER, { problem_id: p1.id, status: 'failed', occurred_at: nowIso });
      await service.createAttempt(WEAK_USER, { problem_id: p1.id, status: 'failed', occurred_at: nowIso });

      // Topic 2: 3 attempts, 1 failure (33.3%) -> NOT WEAK (<= 50%)
      const t2 = await service.createTopic(WEAK_USER, { name: 'Topic 3 Att 1 Fail' });
      const p2 = await service.createProblem(WEAK_USER, { title: 'P2 T2', difficulty: 'easy', source: 'user' });
      await service.linkProblemTopic(WEAK_USER, { problem_id: p2.id, topic_id: t2.id });
      await service.createAttempt(WEAK_USER, { problem_id: p2.id, status: 'failed', occurred_at: nowIso });
      await service.createAttempt(WEAK_USER, { problem_id: p2.id, status: 'solved', solve_time_minutes: 10, occurred_at: nowIso });
      await service.createAttempt(WEAK_USER, { problem_id: p2.id, status: 'solved', solve_time_minutes: 12, occurred_at: nowIso });

      // Topic 3: 4 attempts, 2 failures (50.0%) -> NOT WEAK (condition is strictly > 50%)
      const t3 = await service.createTopic(WEAK_USER, { name: 'Topic 4 Att 2 Fail' });
      const p3 = await service.createProblem(WEAK_USER, { title: 'P3 T3', difficulty: 'easy', source: 'user' });
      await service.linkProblemTopic(WEAK_USER, { problem_id: p3.id, topic_id: t3.id });
      await service.createAttempt(WEAK_USER, { problem_id: p3.id, status: 'failed', occurred_at: nowIso });
      await service.createAttempt(WEAK_USER, { problem_id: p3.id, status: 'failed', occurred_at: nowIso });
      await service.createAttempt(WEAK_USER, { problem_id: p3.id, status: 'solved', solve_time_minutes: 15, occurred_at: nowIso });
      await service.createAttempt(WEAK_USER, { problem_id: p3.id, status: 'solved', solve_time_minutes: 18, occurred_at: nowIso });

      // Topic 4: 3 attempts, 2 failures (66.7%) -> WEAK!
      const t4 = await service.createTopic(WEAK_USER, { name: 'Topic 3 Att 2 Fail' });
      const p4 = await service.createProblem(WEAK_USER, { title: 'P4 T4', difficulty: 'medium', source: 'user' });
      await service.linkProblemTopic(WEAK_USER, { problem_id: p4.id, topic_id: t4.id });
      await service.createAttempt(WEAK_USER, { problem_id: p4.id, status: 'failed', occurred_at: nowIso });
      await service.createAttempt(WEAK_USER, { problem_id: p4.id, status: 'failed', occurred_at: nowIso });
      await service.createAttempt(WEAK_USER, { problem_id: p4.id, status: 'solved', solve_time_minutes: 20, occurred_at: nowIso });

      // Topic 5: 3 attempts, 3 failures (100.0%) -> WEAK!
      const t5 = await service.createTopic(WEAK_USER, { name: 'Topic 3 Att 3 Fail' });
      const p5 = await service.createProblem(WEAK_USER, { title: 'P5 T5', difficulty: 'hard', source: 'user' });
      await service.linkProblemTopic(WEAK_USER, { problem_id: p5.id, topic_id: t5.id });
      await service.createAttempt(WEAK_USER, { problem_id: p5.id, status: 'failed', occurred_at: nowIso });
      await service.createAttempt(WEAK_USER, { problem_id: p5.id, status: 'failed', occurred_at: nowIso });
      await service.createAttempt(WEAK_USER, { problem_id: p5.id, status: 'failed', occurred_at: nowIso });

      const overview = await service.getOverview(WEAK_USER);
      const weakTopicIds = overview.weak_areas.map(w => w.topic_id);

      // Verify boundary results
      expect(weakTopicIds).not.toContain(t1.id); // 2 attempts -> NOT weak
      expect(weakTopicIds).not.toContain(t2.id); // 3 attempts, 1 fail (33%) -> NOT weak
      expect(weakTopicIds).not.toContain(t3.id); // 4 attempts, 2 fail (50%) -> NOT weak (strictly > 50%)
      expect(weakTopicIds).toContain(t4.id);     // 3 attempts, 2 fail (67%) -> WEAK
      expect(weakTopicIds).toContain(t5.id);     // 3 attempts, 3 fail (100%) -> WEAK

      // Verify deterministic ordering: t5 (100%) must appear before t4 (66.7%)
      expect(weakTopicIds[0]).toBe(t5.id);
      expect(weakTopicIds[1]).toBe(t4.id);
    });
  });

  describe('Part 5 — Deterministic Recommendation Engine', () => {
    it('executes 100 times with identical state and yields 100 identical results', async () => {
      const REC_USER = 'd0000000-0000-0000-0000-000000000004';
      await db.query(
        `INSERT INTO public.profiles (id, clerk_user_id, display_name)
         VALUES ($1, 'clerk_user_d', 'User D')
         ON CONFLICT (id) DO NOTHING`,
        [REC_USER]
      );

      const p1 = await service.createProblem(REC_USER, { title: 'Rec Problem 1', difficulty: 'easy', source: 'user' });
      const p2 = await service.createProblem(REC_USER, { title: 'Rec Problem 2', difficulty: 'medium', source: 'user' });
      expect(p1.id).toBeDefined();
      expect(p2.id).toBeDefined();

      // Run 100 consecutive recommendations
      const results: string[] = [];
      for (let i = 0; i < 100; i++) {
        const overview = await service.getOverview(REC_USER);
        results.push(JSON.stringify(overview.recommended_problem));
      }

      // Prove all 100 are identical
      const first = results[0];
      expect(first).toBeDefined();
      for (let i = 1; i < 100; i++) {
        expect(results[i]).toBe(first);
      }
    });

    it('prioritizes Revision Due over recent failures and weak areas', async () => {
      const PRIO_USER = 'e0000000-0000-0000-0000-000000000005';
      await db.query(
        `INSERT INTO public.profiles (id, clerk_user_id, display_name)
         VALUES ($1, 'clerk_user_e', 'User E')
         ON CONFLICT (id) DO NOTHING`,
        [PRIO_USER]
      );

      // Problem 1: Revision due (next_review_at in the past)
      const pRevision = await service.createProblem(PRIO_USER, { title: 'Revision Due Problem', difficulty: 'hard', source: 'user' });
      await db.query(
        `UPDATE public.dsa_problems
         SET solved_count = 1, next_review_at = now() - interval '1 hour'
         WHERE id = $1`,
        [pRevision.id]
      );

      // Problem 2: Recent failure
      const pFailed = await service.createProblem(PRIO_USER, { title: 'Recently Failed Problem', difficulty: 'easy', source: 'user' });
      await service.createAttempt(PRIO_USER, { problem_id: pFailed.id, status: 'failed', occurred_at: nowIso });

      const overview = await service.getOverview(PRIO_USER);
      expect(overview.recommended_problem).not.toBeNull();
      expect(overview.recommended_problem!.id).toBe(pRevision.id);
      expect(overview.recommended_problem!.reason).toBe('Revision is due.');
    });

    it('returns null when all problems are solved and no revisions are due', async () => {
      const EMPTY_USER = 'f0000000-0000-0000-0000-000000000006';
      await db.query(
        `INSERT INTO public.profiles (id, clerk_user_id, display_name)
         VALUES ($1, 'clerk_user_f', 'User F')
         ON CONFLICT (id) DO NOTHING`,
        [EMPTY_USER]
      );

      const p = await service.createProblem(EMPTY_USER, { title: 'Solved Future Review', difficulty: 'easy', source: 'user' });
      await service.createAttempt(EMPTY_USER, { problem_id: p.id, status: 'solved', solve_time_minutes: 10, occurred_at: nowIso });
      // Next review is +2 days in future, so no candidates are due or unsolved
      const overview = await service.getOverview(EMPTY_USER);
      expect(overview.recommended_problem).toBeNull();
    });
  });

  describe('Part 10 — Spaced Repetition Revision Scheduling', () => {
    it('sets +2 days on 1st solve, +7 days on 2nd solve, +21 days on 3rd solve', async () => {
      const REV_USER = '00000000-0000-0000-0000-000000000007';
      await db.query(
        `INSERT INTO public.profiles (id, clerk_user_id, display_name)
         VALUES ($1, 'clerk_user_g', 'User G')
         ON CONFLICT (id) DO NOTHING`,
        [REV_USER]
      );

      const problem = await service.createProblem(REV_USER, { title: 'Revision Intervals Problem', difficulty: 'easy', source: 'user' });

      // First solve
      const baseDate = new Date('2026-10-01T12:00:00.000Z');
      await service.createAttempt(REV_USER, {
        problem_id: problem.id,
        status: 'solved',
        occurred_at: baseDate.toISOString(),
        solve_time_minutes: 15,
      });

      let p = await service.getProblem(REV_USER, problem.id);
      expect(p.review_stage).toBe(1);
      expect(p.revision_count).toBe(1);
      const expectedDate1 = new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000);
      expect(new Date(p.next_review_at!).toISOString()).toBe(expectedDate1.toISOString());

      // Second solve
      const date2 = new Date('2026-10-03T12:00:00.000Z');
      await service.createAttempt(REV_USER, {
        problem_id: problem.id,
        status: 'solved',
        occurred_at: date2.toISOString(),
        solve_time_minutes: 12,
      });

      p = await service.getProblem(REV_USER, problem.id);
      expect(p.review_stage).toBe(2);
      expect(p.revision_count).toBe(2);
      const expectedDate2 = new Date(date2.getTime() + 7 * 24 * 60 * 60 * 1000);
      expect(new Date(p.next_review_at!).toISOString()).toBe(expectedDate2.toISOString());

      // Third solve
      const date3 = new Date('2026-10-10T12:00:00.000Z');
      await service.createAttempt(REV_USER, {
        problem_id: problem.id,
        status: 'solved',
        occurred_at: date3.toISOString(),
        solve_time_minutes: 10,
      });

      p = await service.getProblem(REV_USER, problem.id);
      expect(p.review_stage).toBe(3);
      expect(p.revision_count).toBe(3);
      const expectedDate3 = new Date(date3.getTime() + 21 * 24 * 60 * 60 * 1000);
      expect(new Date(p.next_review_at!).toISOString()).toBe(expectedDate3.toISOString());

      // Failed revision attempt does NOT advance stage or next_review_at
      const dateFail = new Date('2026-10-15T12:00:00.000Z');
      await service.createAttempt(REV_USER, {
        problem_id: problem.id,
        status: 'failed',
        occurred_at: dateFail.toISOString(),
      });

      p = await service.getProblem(REV_USER, problem.id);
      expect(p.review_stage).toBe(3); // unchanged
      expect(p.revision_count).toBe(3); // unchanged
      expect(new Date(p.next_review_at!).toISOString()).toBe(expectedDate3.toISOString()); // unchanged
    });
  });

  describe('Part 9 — Architectural Invariants Verification', () => {
    it('proves DSA has no mastery score or state', async () => {
      const problem = await service.createProblem(USER_A, { title: 'Invariant Mastery Check', difficulty: 'easy', source: 'user' });
      expect((problem as any).mastery).toBeUndefined();
      expect((problem as any).mastery_score).toBeUndefined();
      expect((problem as any).mastery_state).toBeUndefined();
    });

    it('proves solving a DSA problem does NOT auto-complete Goals or Tasks', async () => {
      // Create a goal and a task
      const goalRes = await db.query<{ id: string }>(
        `INSERT INTO public.goals (user_id, title, goal_type, status)
         VALUES ($1, 'Master Algorithms Goal', 'learning', 'active')
         RETURNING id`,
        [USER_A]
      );
      const goalId = goalRes.rows[0]!.id;

      const taskRes = await db.query<{ id: string }>(
        `INSERT INTO public.tasks (user_id, title, status)
         VALUES ($1, 'Solve LeetCode Problem Task', 'in_progress')
         RETURNING id`,
        [USER_A]
      );
      const taskId = taskRes.rows[0]!.id;

      const problem = await service.createProblem(USER_A, { title: 'Linked Goal Task Problem', difficulty: 'medium', source: 'user' });
      await service.linkProblemGoal(USER_A, { problem_id: problem.id, goal_id: goalId });
      await service.linkProblemTask(USER_A, { problem_id: problem.id, task_id: taskId });

      // Solve problem
      await service.createAttempt(USER_A, { problem_id: problem.id, status: 'solved', solve_time_minutes: 25, occurred_at: nowIso });

      // Verify goal and task remain 'in_progress' and are NOT completed
      const checkGoal = await db.query<{ status: string }>(`SELECT status FROM public.goals WHERE id = $1`, [goalId]);
      const checkTask = await db.query<{ status: string }>(`SELECT status FROM public.tasks WHERE id = $1`, [taskId]);

      expect(checkGoal.rows[0]!.status).toBe('active');
      expect(checkTask.rows[0]!.status).toBe('in_progress');
    });
  });
});
