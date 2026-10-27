import fastify, { type FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@avenza/shared';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { IClerkClient } from '../../auth/clerk/clerk.client';
import { AuthService } from '../../auth/auth.service';
import { createRequireAuthMiddleware } from '../../auth/auth.middleware';
import { InMemoryProfileRepository } from './profile.repository';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { createProfileRoutes } from './profile.routes';
import { AccountExportService } from './account-export.service';
import { AccountDeletionService } from './account-deletion.service';
import { registerErrorHandler } from '../../plugins/error-handler';

describe('Phase 17B-2 SEC-17B2-03, 04, 05: Comprehensive Account Data Export & Concurrency', () => {
  let app: FastifyInstance;
  let mockClerkClient: IClerkClient;
  let profileRepo: InMemoryProfileRepository;
  let profileService: ProfileService;
  let exportService: AccountExportService;
  interface MockExportSupabaseClient {
    from: ReturnType<typeof vi.fn>;
  }

  let mockSupabaseClient: MockExportSupabaseClient;
  let tableDataStore: Record<string, Record<string, unknown>[]>;
  let ALICE_ID: string;
  let BOB_ID: string;
  let pageQueryErrorInjector: ((table: string, offset: number) => Error | null) | null = null;
  let leaseQueryErrorInjector: (() => Error | null) | null = null;

  beforeEach(async () => {
    pageQueryErrorInjector = null;
    leaseQueryErrorInjector = null;
    profileRepo = new InMemoryProfileRepository();
    profileService = new ProfileService(profileRepo);

    const aliceProfile = await profileService.getOrCreateProfile('clerk_alice_id', {
      displayName: 'Alice Architect',
      avatarUrl: 'https://example.com/alice.png',
      timezone: 'America/New_York',
    });
    ALICE_ID = aliceProfile.id;

    const bobProfile = await profileService.getOrCreateProfile('clerk_bob_id', {
      displayName: 'Bob Builder',
      avatarUrl: 'https://example.com/bob.png',
      timezone: 'Europe/London',
    });
    BOB_ID = bobProfile.id;

    tableDataStore = {
      account_export_leases: [],
      profiles: [
        { id: ALICE_ID, clerk_user_id: 'clerk_alice_id', display_name: 'Alice Architect', created_at: '2026-01-01T00:00:00Z' },
        { id: BOB_ID, clerk_user_id: 'clerk_bob_id', display_name: 'Bob Builder', created_at: '2026-01-01T00:00:00Z' },
      ],
      user_preferences: [
        { id: 'pref-1', user_id: ALICE_ID, theme: 'dark', created_at: '2026-01-01T00:00:00Z' },
      ],
      goals: [
        { id: 'goal-1', user_id: ALICE_ID, title: 'Master Distributed Systems', created_at: '2026-01-01T00:00:00Z' },
      ],
      goal_milestones: [
        { id: 'gm-1', goal_id: 'goal-1', title: 'Read Raft paper', created_at: '2026-01-01T00:00:00Z' },
      ],
      tasks: [
        { id: 'task-1', user_id: ALICE_ID, title: 'Implement Raft consensus', created_at: '2026-01-01T00:00:00Z' },
      ],
      task_dependencies: [
        { id: 'td-1', task_id: 'task-1', prerequisite_task_id: 'prereq-1', created_at: '2026-01-01T00:00:00Z' },
      ],
      focus_sessions: [
        { id: 'fs-1', user_id: ALICE_ID, duration_minutes: 50, created_at: '2026-01-01T00:00:00Z' },
      ],
      evidence: [
        { id: 'ev-1', user_id: ALICE_ID, title: 'Consensus PR Link', created_at: '2026-01-01T00:00:00Z' },
      ],
      evidence_links: [
        { id: 'el-1', evidence_id: 'ev-1', url: 'https://github.com/example/pr/1', created_at: '2026-01-01T00:00:00Z' },
      ],
      academic_years: [
        { id: 'ay-1', user_id: ALICE_ID, name: '2025-2026', created_at: '2026-01-01T00:00:00Z' },
      ],
      terms: [
        { id: 'term-1', academic_year_id: 'ay-1', name: 'Spring', created_at: '2026-01-01T00:00:00Z' },
      ],
      subjects: [
        { id: 'sub-1', user_id: ALICE_ID, name: 'Distributed Computing', created_at: '2026-01-01T00:00:00Z' },
      ],
      subject_topics: [
        { id: 'st-1', subject_id: 'sub-1', name: 'Byzantine Fault Tolerance', created_at: '2026-01-01T00:00:00Z' },
      ],
      assessments: [
        { id: 'as-1', subject_id: 'sub-1', title: 'Midterm Exam', created_at: '2026-01-01T00:00:00Z' },
      ],
      assessment_topics: [
        { assessment_id: 'as-1', topic_id: 'st-1', created_at: '2026-01-01T00:00:00Z' },
      ],
      exams: [
        { id: 'ex-1', subject_id: 'sub-1', title: 'Final Comprehensive Exam', created_at: '2026-01-01T00:00:00Z' },
      ],
      exam_topics: [
        { exam_id: 'ex-1', topic_id: 'st-1', created_at: '2026-01-01T00:00:00Z' },
      ],
      skills: [
        { id: 'sk-1', user_id: ALICE_ID, name: 'Raft Protocol', created_at: '2026-01-01T00:00:00Z' },
      ],
      evidence_skills: [
        { id: 'es-1', user_id: ALICE_ID, skill_id: 'sk-1', evidence_id: 'ev-1', created_at: '2026-01-01T00:00:00Z' },
      ],
      goal_skills: [
        { id: 'gs-1', user_id: ALICE_ID, goal_id: 'goal-1', skill_id: 'sk-1', created_at: '2026-01-01T00:00:00Z' },
      ],
      task_skills: [
        { id: 'ts-1', user_id: ALICE_ID, task_id: 'task-1', skill_id: 'sk-1', created_at: '2026-01-01T00:00:00Z' },
      ],
      topic_skills: [
        { id: 'tps-1', user_id: ALICE_ID, topic_id: 'st-1', skill_id: 'sk-1', created_at: '2026-01-01T00:00:00Z' },
      ],
      dsa_attempts: [
        { id: 'dsa-1', user_id: ALICE_ID, problem_id: 'prob-1', status: 'SOLVED', created_at: '2026-01-01T00:00:00Z' },
      ],
      integration_connections: [
        {
          id: 'conn-1',
          user_id: ALICE_ID,
          provider: 'github',
          encrypted_access_token: 'SUPER_SECRET_TOKEN',
          encrypted_refresh_token: 'SUPER_SECRET_REFRESH',
          token_iv: 'SECRET_IV',
          token_tag: 'SECRET_TAG',
          token_version: 1,
          account_username: 'alice-architect',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      external_repositories: [
        { id: 'repo-1', user_id: ALICE_ID, repo_name: 'raft-consensus', created_at: '2026-01-01T00:00:00Z' },
      ],
      external_activities: [
        { id: 'act-1', user_id: ALICE_ID, activity_type: 'commit', created_at: '2026-01-01T00:00:00Z' },
      ],
      external_calendar_events: [
        { id: 'cal-1', user_id: ALICE_ID, title: 'Architecture Review', created_at: '2026-01-01T00:00:00Z' },
      ],
      sync_jobs: [
        { id: 'sync-1', user_id: ALICE_ID, provider: 'github', status: 'completed', created_at: '2026-01-01T00:00:00Z' },
      ],
      projects: [
        { id: 'proj-1', user_id: ALICE_ID, name: 'Distributed KV Store', created_at: '2026-01-01T00:00:00Z' },
      ],
      project_milestones: [
        { id: 'pm-1', project_id: 'proj-1', title: 'Leader Election', created_at: '2026-01-01T00:00:00Z' },
      ],
      project_goals: [
        { id: 'pg-1', project_id: 'proj-1', goal_id: 'goal-1', created_at: '2026-01-01T00:00:00Z' },
      ],
      project_skills: [
        { id: 'ps-1', project_id: 'proj-1', skill_id: 'sk-1', created_at: '2026-01-01T00:00:00Z' },
      ],
      career_targets: [
        { id: 'ct-1', user_id: ALICE_ID, target_role: 'Principal Systems Architect', created_at: '2026-01-01T00:00:00Z' },
      ],
      career_target_skills: [
        { id: 'cts-1', user_id: ALICE_ID, target_id: 'ct-1', skill_id: 'sk-1', created_at: '2026-01-01T00:00:00Z' },
      ],
      career_opportunities: [
        { id: 'co-1', user_id: ALICE_ID, company_name: 'CloudCorp', created_at: '2026-01-01T00:00:00Z' },
      ],
      career_opportunity_skills: [
        { id: 'cos-1', user_id: ALICE_ID, opportunity_id: 'co-1', skill_id: 'sk-1', created_at: '2026-01-01T00:00:00Z' },
      ],
      career_applications: [
        { id: 'ca-1', user_id: ALICE_ID, opportunity_id: 'co-1', stage: 'applied', created_at: '2026-01-01T00:00:00Z' },
      ],
      career_application_history: [
        { id: 'cah-1', user_id: ALICE_ID, application_id: 'ca-1', to_stage: 'applied', created_at: '2026-01-01T00:00:00Z' },
      ],
      career_application_projects: [
        { id: 'cap-1', user_id: ALICE_ID, application_id: 'ca-1', project_id: 'proj-1', created_at: '2026-01-01T00:00:00Z' },
      ],
      career_interviews: [
        { id: 'ci-1', user_id: ALICE_ID, application_id: 'ca-1', round_type: 'technical', created_at: '2026-01-01T00:00:00Z' },
      ],
    };

    mockSupabaseClient = {
      from: vi.fn((table: string) => ({
        select: vi.fn((_cols: string) => ({
          eq: vi.fn((col: string, val: string) => {
            if (table === 'account_export_leases' && leaseQueryErrorInjector) {
              const err = leaseQueryErrorInjector();
              if (err) {
                return {
                  maybeSingle: async () => ({ data: null, error: err }),
                };
              }
            }
            const rows = (tableDataStore[table] || []).filter((r) => r[col] === val);
            return {
              maybeSingle: async () => ({ data: rows[0] || null, error: null }),
              order: vi.fn((_orderCol: string, _opts: { ascending: boolean }) => ({
                range: async (start: number, end: number) => {
                  if (pageQueryErrorInjector) {
                    const injected = pageQueryErrorInjector(table, start);
                    if (injected) return { data: null, error: injected };
                  }
                  const sliced = rows.slice(start, end + 1);
                  return { data: sliced, error: null };
                },
              })),
            };
          }),
          in: vi.fn((col: string, vals: string[]) => {
            const rows = (tableDataStore[table] || []).filter((r) => vals.includes(r[col] as string));
            return {
              order: vi.fn((_orderCol: string, _opts: { ascending: boolean }) => ({
                range: async (start: number, end: number) => {
                  if (pageQueryErrorInjector) {
                    const injected = pageQueryErrorInjector(table, start);
                    if (injected) return { data: null, error: injected };
                  }
                  const sliced = rows.slice(start, end + 1);
                  return { data: sliced, error: null };
                },
              })),
            };
          }),
        })),
        upsert: vi.fn(async (record: Record<string, unknown>) => {
          if (!tableDataStore[table]) tableDataStore[table] = [];
          const idx = tableDataStore[table].findIndex((r) => r.user_id === record.user_id);
          if (idx >= 0) {
            tableDataStore[table][idx] = { ...tableDataStore[table][idx], ...record };
          } else {
            tableDataStore[table].push(record);
          }
          return { error: null };
        }),
        update: vi.fn((updateData: Record<string, unknown>) => ({
          eq: vi.fn(async (col: string, val: string) => {
            if (!tableDataStore[table]) tableDataStore[table] = [];
            const idx = tableDataStore[table].findIndex((r) => r[col] === val);
            if (idx >= 0 && tableDataStore[table][idx]) {
              tableDataStore[table][idx] = { ...tableDataStore[table][idx], ...updateData };
            }
            return { error: null };
          }),
        })),
      })),
    };

    mockClerkClient = {
      async verifyBearerToken(token: string) {
        if (token === 'alice-valid-token') {
          return {
            clerkUserId: 'clerk_alice_id',
            displayName: 'Alice Architect',
            avatarUrl: 'https://example.com/alice.png',
            timezone: 'America/New_York',
          };
        }
        if (token === 'bob-valid-token') {
          return {
            clerkUserId: 'clerk_bob_id',
            displayName: 'Bob Builder',
            avatarUrl: 'https://example.com/bob.png',
            timezone: 'Europe/London',
          };
        }
        return null;
      },
    };

    exportService = new AccountExportService(
      mockSupabaseClient as unknown as SupabaseClient<Database>
    );

    const deletionService = new AccountDeletionService(
      mockSupabaseClient as unknown as SupabaseClient<Database>,
      profileService
    );

    const authService = new AuthService(mockClerkClient);
    const requireAuthMiddleware = createRequireAuthMiddleware(authService, profileService);
    const profileController = new ProfileController(deletionService, exportService);
    const profileRoutes = createProfileRoutes({
      requireAuthMiddleware,
      profileController,
    });

    app = fastify();
    registerErrorHandler(app);
    app.register(profileRoutes);
    await app.ready();
  });

  describe('1. SEC-17B2-04: Missing Academic Junction Tables (assessment_topics, exam_topics)', () => {
    it('includes non-empty assessment_topics and exam_topics in export envelope', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/account/export',
        headers: { authorization: 'Bearer alice-valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const d = body.data;

      // Both missing academic junction tables must be present and populated
      expect(d.assessmentTopics).toBeDefined();
      expect(d.assessmentTopics).toHaveLength(1);
      expect(d.assessmentTopics[0]).toMatchObject({
        assessment_id: 'as-1',
        topic_id: 'st-1',
      });

      expect(d.examTopics).toBeDefined();
      expect(d.examTopics).toHaveLength(1);
      expect(d.examTopics[0]).toMatchObject({
        exam_id: 'ex-1',
        topic_id: 'st-1',
      });
    });

    it('preserves cross-tenant isolation for assessment_topics and exam_topics', async () => {
      // Add Bob's academic data
      tableDataStore.subjects!.push({ id: 'sub-bob', user_id: BOB_ID, name: 'Bob Subject', created_at: '2026-01-01T00:00:00Z' });
      tableDataStore.assessments!.push({ id: 'as-bob', subject_id: 'sub-bob', title: 'Bob Midterm', created_at: '2026-01-01T00:00:00Z' });
      tableDataStore.assessment_topics!.push({ assessment_id: 'as-bob', topic_id: 'st-bob', created_at: '2026-01-01T00:00:00Z' });
      tableDataStore.exams!.push({ id: 'ex-bob', subject_id: 'sub-bob', title: 'Bob Exam', created_at: '2026-01-01T00:00:00Z' });
      tableDataStore.exam_topics!.push({ exam_id: 'ex-bob', topic_id: 'st-bob', created_at: '2026-01-01T00:00:00Z' });

      // Alice's export must NEVER include Bob's assessment_topics or exam_topics
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/account/export',
        headers: { authorization: 'Bearer alice-valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const d = body.data;

      expect(d.assessmentTopics).toHaveLength(1);
      expect(d.assessmentTopics[0].assessment_id).toBe('as-1');
      expect(d.examTopics).toHaveLength(1);
      expect(d.examTopics[0].exam_id).toBe('ex-1');
    });
  });

  describe('2. SEC-17B2-03: Child-Table PostgREST Pagination Limit Safety (>1,000 Rows)', () => {
    it('paginates child table task_dependencies across multiple pages when >1,000 rows exist', async () => {
      const manyDeps: Record<string, unknown>[] = [];
      for (let i = 0; i < 1250; i++) {
        manyDeps.push({
          id: `td-paged-${i}`,
          task_id: 'task-1',
          prerequisite_task_id: `prereq-${i}`,
          created_at: new Date(1700000000000 + i * 1000).toISOString(),
        });
      }
      tableDataStore.task_dependencies = manyDeps;

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/account/export',
        headers: { authorization: 'Bearer alice-valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.taskDependencies).toHaveLength(1250);
      expect(body.data.taskDependencies[0].id).toBe('td-paged-0');
      expect(body.data.taskDependencies[1249].id).toBe('td-paged-1249');
    });

    it('paginates child table goal_milestones across multiple pages when >1,000 rows exist', async () => {
      const manyMilestones: Record<string, unknown>[] = [];
      for (let i = 0; i < 1100; i++) {
        manyMilestones.push({
          id: `gm-paged-${i}`,
          goal_id: 'goal-1',
          title: `Milestone ${i}`,
          created_at: new Date(1700000000000 + i * 1000).toISOString(),
        });
      }
      tableDataStore.goal_milestones = manyMilestones;

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/account/export',
        headers: { authorization: 'Bearer alice-valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.goalMilestones).toHaveLength(1100);
    });

    it('handles exact page-size boundaries (exactly 1,000 rows) followed by empty page', async () => {
      const exactDeps: Record<string, unknown>[] = [];
      for (let i = 0; i < 1000; i++) {
        exactDeps.push({
          id: `td-exact-${i}`,
          task_id: 'task-1',
          prerequisite_task_id: `prereq-${i}`,
          created_at: new Date(1700000000000 + i * 1000).toISOString(),
        });
      }
      tableDataStore.task_dependencies = exactDeps;

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/account/export',
        headers: { authorization: 'Bearer alice-valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.taskDependencies).toHaveLength(1000);
    });

    it('propagates database errors on later page without returning partial data as complete', async () => {
      const manyMilestones: Record<string, unknown>[] = [];
      for (let i = 0; i < 1500; i++) {
        manyMilestones.push({
          id: `gm-paged-${i}`,
          goal_id: 'goal-1',
          title: `Milestone ${i}`,
          created_at: new Date(1700000000000 + i * 1000).toISOString(),
        });
      }
      tableDataStore.goal_milestones = manyMilestones;

      // Inject error on page 2 (offset 1000)
      pageQueryErrorInjector = (table, offset) => {
        if (table === 'goal_milestones' && offset >= 1000) {
          return new Error('Database connection interrupted on page 2');
        }
        return null;
      };

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/account/export',
        headers: { authorization: 'Bearer alice-valid-token' },
      });

      // Must fail with 500 error, never returning partial data as 200 OK
      expect(res.statusCode).toBe(500);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Database connection interrupted on page 2');
    });

    it('maintains stable ordering with duplicate timestamps', async () => {
      const duplicateTimestampDeps: Record<string, unknown>[] = [];
      const sameTimestamp = '2026-01-01T12:00:00Z';
      for (let i = 0; i < 50; i++) {
        duplicateTimestampDeps.push({
          id: `td-dup-${String(i).padStart(3, '0')}`,
          task_id: 'task-1',
          prerequisite_task_id: `prereq-${i}`,
          created_at: sameTimestamp,
        });
      }
      tableDataStore.task_dependencies = duplicateTimestampDeps;

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/account/export',
        headers: { authorization: 'Bearer alice-valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.taskDependencies).toHaveLength(50);
      // Items are stably ordered
      expect(body.data.taskDependencies[0].id).toBe('td-dup-000');
    });
  });

  describe('3. SEC-17B2-05: Distributed Concurrency Lease & Rate Limiting', () => {
    it('blocks concurrent export across separate service instances using database lease', async () => {
      // Simulate another API instance holding an active lease in account_export_leases
      tableDataStore.account_export_leases = [
        {
          user_id: ALICE_ID,
          leased_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60_000).toISOString(), // active for 1 more minute
          last_exported_at: null,
        },
      ];

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/account/export',
        headers: { authorization: 'Bearer alice-valid-token' },
      });

      expect(res.statusCode).toBe(429);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('CONCURRENT_EXPORT_IN_PROGRESS');
      expect(body.error.message).toContain('in progress');
    });

    it('permits new export when previous database lease is expired', async () => {
      // Simulate expired lease from an abandoned/crashed instance
      tableDataStore.account_export_leases = [
        {
          user_id: ALICE_ID,
          leased_at: new Date(Date.now() - 400_000).toISOString(),
          expires_at: new Date(Date.now() - 100_000).toISOString(), // expired in the past
          last_exported_at: new Date(Date.now() - 100_000).toISOString(),
        },
      ];

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/account/export',
        headers: { authorization: 'Bearer alice-valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.userId).toBe(ALICE_ID);
    });

    it('enforces 15-second distributed cooldown via database lease', async () => {
      // Simulate an export completed 5 seconds ago on another instance
      tableDataStore.account_export_leases = [
        {
          user_id: ALICE_ID,
          leased_at: new Date(Date.now() - 5000).toISOString(),
          expires_at: new Date(Date.now() - 5000).toISOString(), // lease ended
          last_exported_at: new Date(Date.now() - 5000).toISOString(), // exported 5s ago
        },
      ];

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/account/export',
        headers: { authorization: 'Bearer alice-valid-token' },
      });

      expect(res.statusCode).toBe(429);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('EXPORT_RATE_LIMITED');
      expect(body.error.message).toContain('Please wait');
    });

    it('safely releases lease upon failure so user is not locked out for 5 minutes', async () => {
      // Cause an error during export
      pageQueryErrorInjector = () => new Error('Fatal database disk failure');

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/account/export',
        headers: { authorization: 'Bearer alice-valid-token' },
      });

      expect(res.statusCode).toBe(500);

      // Verify lease was released (expires_at set to current/past time, not 5 mins in future)
      const lease = (tableDataStore.account_export_leases || []).find((l) => l.user_id === ALICE_ID);
      expect(lease).toBeDefined();
      expect(new Date(lease!.expires_at as string).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('returns 503 EXPORT_COORDINATION_UNAVAILABLE when database coordination fails', async () => {
      // Simulate database outage on account_export_leases lookup
      leaseQueryErrorInjector = () => new Error('Connection refused to database pooler');

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/account/export',
        headers: { authorization: 'Bearer alice-valid-token' },
      });

      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('EXPORT_COORDINATION_UNAVAILABLE');
    });

    it('coordinates leases via acquire_account_export_lease and release_account_export_lease RPCs', async () => {
      const mockRpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
        if (name === 'acquire_account_export_lease') {
          if (params.p_user_id === BOB_ID) {
            return {
              data: {
                success: false,
                code: 'CONCURRENT_EXPORT_IN_PROGRESS',
                message: 'Concurrent export in progress',
              },
              error: null,
            };
          }
          return {
            data: {
              success: true,
              lease_token: params.p_lease_token,
            },
            error: null,
          };
        }
        if (name === 'release_account_export_lease') {
          return { error: null };
        }
        return { error: new Error(`Unknown RPC ${name}`) };
      });

      const rpcClient = {
        ...mockSupabaseClient,
        rpc: mockRpc,
      };

      const rpcExportService = new AccountExportService(
        rpcClient as unknown as SupabaseClient<Database>
      );

      // Alice succeeds via RPC
      const result = await rpcExportService.exportUserData(ALICE_ID);
      expect(result.userId).toBe(ALICE_ID);
      expect(mockRpc).toHaveBeenCalledWith('acquire_account_export_lease', expect.objectContaining({
        p_user_id: ALICE_ID,
      }));
      expect(mockRpc).toHaveBeenCalledWith('release_account_export_lease', expect.objectContaining({
        p_user_id: ALICE_ID,
        p_success: true,
      }));

      // Bob blocked via RPC
      await expect(rpcExportService.exportUserData(BOB_ID)).rejects.toMatchObject({
        statusCode: 429,
        code: 'CONCURRENT_EXPORT_IN_PROGRESS',
      });
    });
  });

  describe('4. Full Envelope & Secret Sanitization', () => {
    it('strips all sensitive OAuth tokens and encryption keys from integration_connections', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/account/export',
        headers: { authorization: 'Bearer alice-valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const rawText = res.body;

      expect(rawText).not.toContain('SUPER_SECRET_TOKEN');
      expect(rawText).not.toContain('SUPER_SECRET_REFRESH');
      expect(rawText).not.toContain('SECRET_IV');
      expect(rawText).not.toContain('SECRET_TAG');

      const body = JSON.parse(rawText);
      const conn = body.data.integrationConnections[0];
      expect(conn).toBeDefined();
      expect(conn.account_username).toBe('alice-architect');
      expect(conn.encrypted_access_token).toBeUndefined();
    });
  });
});
