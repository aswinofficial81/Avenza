import fs from 'node:fs';
import path from 'node:path';
import fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { beforeEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import type { ProviderCapability } from '@avenza/shared';
import { registerErrorHandler } from '../plugins/error-handler';
import type { requireAuth as defaultRequireAuth } from '../auth/auth.middleware';

// Goals Domain
import { InMemoryGoalsRepository } from '../modules/goals/goals.repository';
import { GoalsService } from '../modules/goals/goals.service';
import { GoalsController } from '../modules/goals/goals.controller';
import { createGoalsRoutes } from '../modules/goals/goals.routes';

// Tasks Domain
import { InMemoryTasksRepository } from '../modules/tasks/tasks.repository';
import { TasksService } from '../modules/tasks/tasks.service';
import { TasksController } from '../modules/tasks/tasks.controller';
import { createTasksRoutes } from '../modules/tasks/tasks.routes';

// Evidence Domain
import { InMemoryEvidenceRepository } from '../modules/evidence/evidence.repository';
import { EvidenceService } from '../modules/evidence/evidence.service';
import { EvidenceController } from '../modules/evidence/evidence.controller';
import { createEvidenceRoutes } from '../modules/evidence/evidence.routes';

// Skills Domain
import { InMemorySkillsRepository } from '../modules/skills/skills.repository';
import { SkillsService } from '../modules/skills/skills.service';
import { SkillsController } from '../modules/skills/skills.controller';
import { createSkillsRoutes } from '../modules/skills/skills.routes';

// DSA Domain
import { InMemoryDsaRepository } from '../modules/dsa/dsa.repository';
import { DsaServiceImpl } from '../modules/dsa/dsa.service.impl';
import { DsaController } from '../modules/dsa/dsa.controller';
import { createDsaRoutes } from '../modules/dsa/dsa.routes';

// Projects Domain
import { InMemoryProjectsRepository, type ExternalRepositoryRow } from '../modules/projects/projects.repository';
import { ProjectsService } from '../modules/projects/projects.service';
import { ProjectsController } from '../modules/projects/projects.controller';
import { createProjectsRoutes } from '../modules/projects/projects.routes';

// Career Domain
import { InMemoryCareerRepository } from '../modules/career/career.repository.impl';
import { CareerService } from '../modules/career/career.service';
import { CareerController } from '../modules/career/career.controller';
import { createCareerRoutes } from '../modules/career/career.routes';
import { CareerConflictError, CareerNotFoundError } from '../modules/career/career.repository';

// Integrations Domain
import { InMemoryIntegrationsRepository } from '../modules/integrations/integrations.repository.impl';
import { IntegrationsServiceImpl } from '../modules/integrations/integrations.service.impl';
import { IntegrationsController } from '../modules/integrations/integrations.controller';
import { createIntegrationsRoutes } from '../modules/integrations/integrations.routes';

// Intelligence Domain
import { IntelligenceContextBuilder } from '../modules/intelligence/context/context-builder';
import { CandidateGenerator } from '../modules/intelligence/candidates/candidate-generator';
import { CandidateScorer } from '../modules/intelligence/scoring/candidate-scoring';
import { IntelligenceService } from '../modules/intelligence/intelligence.service';
import { IntelligenceController } from '../modules/intelligence/intelligence.controller';
import { createIntelligenceRoutes } from '../modules/intelligence/intelligence.routes';

// Identity & Auxiliary Repositories
import { InMemoryProfileRepository } from '../modules/identity/profile.repository';
import { InMemoryPreferencesRepository } from '../modules/preferences/preferences.repository';
import { InMemoryFocusRepository } from '../modules/focus/focus.repository';

// Infrastructure Providers
import { ProviderRegistry } from '../infrastructure/providers/base/provider.registry';
import type { IAuthProvider } from '../infrastructure/providers/base/auth.interface';
import type { ISyncProvider } from '../infrastructure/providers/base/sync.interface';

// ==============================================================================
// Phase 17C Journey D: Cross-Domain Reliability, Intelligence Resilience,
// Tenant Isolation, Failure Atomicity & Database-Backed Constraints
// ==============================================================================

describe('Phase 17C Journey D: Cross-Domain Reliability & Resilience', () => {
  let app: FastifyInstance;

  // Domain Repositories
  let goalsRepo: InMemoryGoalsRepository;
  let goalsService: GoalsService;
  let goalsController: GoalsController;

  let tasksRepo: InMemoryTasksRepository;
  let tasksService: TasksService;
  let tasksController: TasksController;

  let evidenceRepo: InMemoryEvidenceRepository;
  let evidenceService: EvidenceService;
  let evidenceController: EvidenceController;

  let skillsRepo: InMemorySkillsRepository;
  let skillsService: SkillsService;
  let skillsController: SkillsController;

  let dsaRepo: InMemoryDsaRepository;
  let dsaService: DsaServiceImpl;
  let dsaController: DsaController;

  let projectsRepo: InMemoryProjectsRepository;
  let projectsService: ProjectsService;
  let projectsController: ProjectsController;

  let careerRepo: InMemoryCareerRepository;
  let careerService: CareerService;
  let careerController: CareerController;

  let integrationsRepo: InMemoryIntegrationsRepository;
  let integrationsService: IntegrationsServiceImpl;
  let integrationsController: IntegrationsController;

  let profileRepo: InMemoryProfileRepository;
  let preferencesRepo: InMemoryPreferencesRepository;
  let focusRepo: InMemoryFocusRepository;

  let intelligenceContextBuilder: IntelligenceContextBuilder;
  let intelligenceService: IntelligenceService;
  let intelligenceController: IntelligenceController;

  // Provider Registry & Mocks
  let providerRegistry: ProviderRegistry;

  let mockGitHubAuthAdapter: Required<IAuthProvider>;
  let mockGitHubSyncAdapter: ISyncProvider;

  let mockLeetCodeAuthAdapter: IAuthProvider;
  let mockLeetCodeSyncAdapter: ISyncProvider;

  let mockCodeforcesAuthAdapter: IAuthProvider;
  let mockCodeforcesSyncAdapter: ISyncProvider;

  let mockGoogleCalendarAuthAdapter: Required<IAuthProvider>;
  let mockGoogleCalendarSyncAdapter: ISyncProvider;

  // Synthetic Multi-Tenant Users
  const ALICE_ID = '00000000-0000-4000-8000-000000000001';
  const BOB_ID = '00000000-0000-4000-8000-000000000002';
  let currentUserId: string = ALICE_ID;

  beforeEach(async () => {
    vi.restoreAllMocks();
    currentUserId = ALICE_ID;

    // 1. Initialize Repositories
    goalsRepo = new InMemoryGoalsRepository();
    tasksRepo = new InMemoryTasksRepository();
    evidenceRepo = new InMemoryEvidenceRepository();
    skillsRepo = new InMemorySkillsRepository([], evidenceRepo);
    dsaRepo = new InMemoryDsaRepository();
    integrationsRepo = new InMemoryIntegrationsRepository();

    projectsRepo = new InMemoryProjectsRepository(
      tasksRepo.getTasksMap(),
      {
        listRepositories: async (uid: string) => {
          const repos = await integrationsRepo.listRepositories(uid);
          return repos as unknown as ExternalRepositoryRow[];
        },
      }
    );

    careerRepo = new InMemoryCareerRepository();
    profileRepo = new InMemoryProfileRepository();
    preferencesRepo = new InMemoryPreferencesRepository();
    focusRepo = new InMemoryFocusRepository();

    // 2. Initialize Services
    goalsService = new GoalsService(goalsRepo);
    tasksService = new TasksService(tasksRepo, goalsRepo, projectsRepo);
    evidenceService = new EvidenceService(evidenceRepo, tasksRepo, goalsRepo);
    skillsService = new SkillsService(skillsRepo);
    dsaService = new DsaServiceImpl(dsaRepo);
    projectsService = new ProjectsService(projectsRepo);
    careerService = new CareerService(careerRepo);

    // 3. Provider Adapters Configuration
    mockGitHubAuthAdapter = {
      createAuthorizationUrl: vi.fn((state) => `https://github.com/login/oauth/authorize?state=${state}`),
      exchangeCodeForTokens: vi.fn(async () => ({
        accessToken: 'mock_gh_token',
        refreshToken: 'mock_gh_refresh',
        scope: 'read:user,repo',
      })),
      fetchIdentity: vi.fn(async () => ({
        externalAccountId: 'gh-acc-alice',
        username: 'alice-engineer',
        displayName: 'Alice Engineer',
        avatarUrl: 'https://avatars.githubusercontent.com/u/101',
        email: 'alice@avenza.local',
      })),
      connectWithIdentifier: vi.fn(async (id) => ({
        externalAccountId: id,
        username: id,
        displayName: id,
        avatarUrl: null,
        email: null,
      })),
      refreshAccessToken: vi.fn(async () => ({
        accessToken: 'mock_gh_refreshed_token',
        scope: 'read:user,repo',
      })),
      revokeToken: vi.fn(async () => {}),
    };

    mockGitHubSyncAdapter = {
      sync: vi.fn(async () => ({
        success: true,
        repositories: [
          {
            externalId: 'gh-repo-100',
            name: 'consensus-core',
            fullName: 'alice-engineer/consensus-core',
            owner: 'alice-engineer',
            isPrivate: false,
            htmlUrl: 'https://github.com/alice-engineer/consensus-core',
            description: 'Raft consensus in Rust',
            defaultBranch: 'main',
            primaryLanguage: 'Rust',
            languages: { Rust: 100 },
            starsCount: 42,
            forksCount: 5,
            openIssuesCount: 2,
            pushedAt: '2026-10-15T00:00:00.000Z',
          },
        ],
        activities: [
          {
            externalId: 'gh-act-201',
            activityType: 'push',
            occurredAt: '2026-10-15T01:00:00.000Z',
            title: 'Pushed commits to consensus-core',
            summary: 'Added Raft log replication tests',
            externalUrl: 'https://github.com/alice-engineer/consensus-core/commit/abc1234',
            repositoryExternalId: 'gh-repo-100',
            metadata: { commits: 3 },
          },
        ],
      })),
    };

    mockLeetCodeAuthAdapter = {
      connectWithIdentifier: vi.fn(async (username: string) => ({
        externalAccountId: username,
        username,
        displayName: 'Alice LeetCode',
        avatarUrl: 'https://assets.leetcode.com/users/alice.jpg',
        email: null,
      })),
    };

    mockLeetCodeSyncAdapter = {
      sync: vi.fn(async () => ({
        success: true,
        repositories: [],
        activities: [
          {
            externalId: 'lc-sub-301',
            activityType: 'dsa_solve',
            occurredAt: '2026-10-15T02:00:00.000Z',
            title: 'Solved LRU Cache',
            summary: 'Solved on LeetCode: LRU Cache',
            externalUrl: 'https://leetcode.com/problems/lru-cache/',
            metadata: { platform: 'leetcode', titleSlug: 'lru-cache' },
          },
        ],
        syncState: { totalSolved: 120 },
      })),
    };

    mockCodeforcesAuthAdapter = {
      connectWithIdentifier: vi.fn(async (handle: string) => ({
        externalAccountId: handle,
        username: handle,
        displayName: 'Alice Codeforces Master',
        avatarUrl: 'https://userpic.codeforces.org/avatar_alice.jpg',
        email: null,
      })),
    };

    mockCodeforcesSyncAdapter = {
      sync: vi.fn(async () => ({
        success: true,
        repositories: [],
        activities: [
          {
            externalId: 'cf-sub-401',
            activityType: 'dsa_solve',
            occurredAt: '2026-10-15T02:30:00.000Z',
            title: 'Solved Watermelon',
            summary: 'Accepted submission for Codeforces 4A',
            externalUrl: 'https://codeforces.com/contest/4/problem/A',
            metadata: { platform: 'codeforces', contestId: 4, index: 'A' },
          },
        ],
        syncState: { rating: 2150 },
      })),
    };

    mockGoogleCalendarAuthAdapter = {
      createAuthorizationUrl: vi.fn((state) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`),
      exchangeCodeForTokens: vi.fn(async () => ({
        accessToken: 'mock_gcal_token',
        refreshToken: 'mock_gcal_refresh',
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        expiresIn: 3600,
      })),
      fetchIdentity: vi.fn(async () => ({
        externalAccountId: 'gcal-user-alice',
        username: 'alice@avenza.local',
        displayName: 'Alice Calendar',
        avatarUrl: null,
        email: 'alice@avenza.local',
      })),
      connectWithIdentifier: vi.fn(async (id) => ({
        externalAccountId: id,
        username: id,
        displayName: id,
        avatarUrl: null,
        email: null,
      })),
      refreshAccessToken: vi.fn(async () => ({
        accessToken: 'mock_gcal_refreshed_token',
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
      })),
      revokeToken: vi.fn(async () => {}),
    };

    mockGoogleCalendarSyncAdapter = {
      sync: vi.fn(async () => ({
        success: true,
        repositories: [],
        activities: [],
        calendarEvents: [
          {
            externalId: 'cal-event-501',
            calendarId: 'primary',
            title: 'Distributed Systems Architecture Review',
            status: 'confirmed' as const,
            startTime: '2026-10-18T14:00:00.000Z',
            endTime: '2026-10-18T15:00:00.000Z',
            isAllDay: false,
            timeZone: 'UTC',
            isBusy: true,
            isRecurring: false,
            recurringEventId: null,
            htmlLink: 'https://calendar.google.com/event?id=501',
          },
        ],
        syncState: { primaryCalendarId: 'primary' },
      })),
    };

    providerRegistry = new ProviderRegistry();
    providerRegistry.register({
      getProviderId: () => 'github',
      getCapabilities: () => new Set<ProviderCapability>(['oauth', 'repositories', 'activity', 'read_only']),
      hasCapability: (cap) => ['oauth', 'repositories', 'activity', 'read_only'].includes(cap),
      getAuthAdapter: () => mockGitHubAuthAdapter,
      getSyncAdapter: () => mockGitHubSyncAdapter,
    });
    providerRegistry.register({
      getProviderId: () => 'leetcode',
      getCapabilities: () => new Set<ProviderCapability>(['profile', 'activity', 'read_only']),
      hasCapability: (cap) => ['profile', 'activity', 'read_only'].includes(cap),
      getAuthAdapter: () => mockLeetCodeAuthAdapter,
      getSyncAdapter: () => mockLeetCodeSyncAdapter,
    });
    providerRegistry.register({
      getProviderId: () => 'codeforces',
      getCapabilities: () => new Set<ProviderCapability>(['profile', 'activity', 'read_only']),
      hasCapability: (cap) => ['profile', 'activity', 'read_only'].includes(cap),
      getAuthAdapter: () => mockCodeforcesAuthAdapter,
      getSyncAdapter: () => mockCodeforcesSyncAdapter,
    });
    providerRegistry.register({
      getProviderId: () => 'google_calendar',
      getCapabilities: () => new Set(['oauth', 'calendar', 'read_only']),
      hasCapability: (cap) => ['oauth', 'calendar', 'read_only'].includes(cap),
      getAuthAdapter: () => mockGoogleCalendarAuthAdapter,
      getSyncAdapter: () => mockGoogleCalendarSyncAdapter,
    });

    integrationsService = new IntegrationsServiceImpl(integrationsRepo, providerRegistry);

    // 4. Intelligence Engine Wiring
    intelligenceContextBuilder = new IntelligenceContextBuilder(
      tasksRepo,
      goalsRepo,
      focusRepo,
      evidenceRepo,
      preferencesRepo,
      profileRepo,
      projectsRepo,
      careerRepo,
      skillsRepo
    );
    intelligenceService = new IntelligenceService(
      intelligenceContextBuilder,
      new CandidateGenerator(),
      new CandidateScorer()
    );

    // 5. Controllers
    goalsController = new GoalsController(goalsService);
    tasksController = new TasksController(tasksService);
    evidenceController = new EvidenceController(evidenceService);
    skillsController = new SkillsController(skillsService);
    dsaController = new DsaController(dsaService);
    projectsController = new ProjectsController(projectsService);
    careerController = new CareerController(careerService);
    integrationsController = new IntegrationsController(integrationsService);
    intelligenceController = new IntelligenceController(intelligenceService);

    // 6. Fastify Application
    app = fastify();
    registerErrorHandler(app);

    const mockAuthHook = async (request: FastifyRequest) => {
      request.auth = { profileId: currentUserId, clerkUserId: `clerk_${currentUserId}` };
      (request as unknown as { profile: { id: string } }).profile = { id: currentUserId };
    };

    app.register(createGoalsRoutes({ requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth, goalsController }));
    app.register(createTasksRoutes({ requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth, tasksController }));
    app.register(createEvidenceRoutes({ requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth, evidenceController }));
    app.register(createSkillsRoutes({ requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth, skillsController }));
    app.register(createDsaRoutes({ requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth, dsaController }));
    app.register(createProjectsRoutes({ requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth, projectsController }));
    app.register(createCareerRoutes({ requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth, careerController }));
    app.register(createIntegrationsRoutes({ requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth, integrationsController }));
    app.register(createIntelligenceRoutes({ requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth, intelligenceController }));

    await app.ready();
  });

  // ============================================================================
  // Scenario A: Cross-Domain Tenant Isolation
  // ============================================================================
  describe('A. Cross-Domain Tenant Isolation', () => {
    it('enforces strict multi-tenant isolation across goals, tasks, evidence, skills, DSA, projects, career, and integrations', async () => {
      // 1. User A (Alice) establishes canonical domain records
      currentUserId = ALICE_ID;

      // Goal & Task
      const goalRes = await app.inject({
        method: 'POST',
        url: '/api/v1/goals',
        payload: {
          title: 'Alice Goal: Distributed Systems',
          description: 'Consensus algorithms and formal verification',
          goal_type: 'academic',
          priority: 'high',
          status: 'active',
          start_date: '2026-01-01T00:00:00.000Z',
          target_date: '2026-12-31T00:00:00.000Z',
        },
      });
      expect(goalRes.statusCode).toBe(201);
      const aliceGoalId = JSON.parse(goalRes.body).data.id;

      const taskRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        payload: { title: 'Alice Task: Write Raft tests', goal_id: aliceGoalId, priority: 'high', status: 'planned', task_type: 'study' },
      });
      expect(taskRes.statusCode).toBe(201);
      const aliceTaskId = JSON.parse(taskRes.body).data.id;

      // Skill & Evidence
      const skillRes = await app.inject({
        method: 'POST',
        url: '/api/v1/skills',
        payload: { name: 'Distributed Consensus', category: 'systems' },
      });
      expect(skillRes.statusCode).toBe(201);
      const aliceSkillId = JSON.parse(skillRes.body).data.id;

      const evidenceRes = await app.inject({
        method: 'POST',
        url: '/api/v1/evidence',
        payload: {
          evidence_type: 'artifact',
          title: 'Alice Raft Proof',
          links: [{ entity_type: 'task', entity_id: aliceTaskId }],
        },
      });
      expect(evidenceRes.statusCode).toBe(201);
      const aliceEvidenceId = JSON.parse(evidenceRes.body).data.id;

      // DSA & Project
      const dsaRes = await app.inject({
        method: 'POST',
        url: '/api/v1/dsa/problems',
        payload: { title: 'Alice Private DSA Problem', difficulty: 'hard', source: 'user' },
      });
      expect(dsaRes.statusCode).toBe(201);
      const aliceDsaProblemId = JSON.parse(dsaRes.body).data.id;

      const projectRes = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        payload: { title: 'Alice Raft Engine', slug: 'alice-raft-engine', project_type: 'software', priority: 'high', status: 'in_progress' },
      });
      expect(projectRes.statusCode).toBe(201);
      const aliceProjectId = JSON.parse(projectRes.body).data.id;

      // Career Target & Application
      const targetRes = await app.inject({
        method: 'POST',
        url: '/api/v1/career/targets',
        payload: { title: 'Alice Target: Principal Engineer', target_role: 'Principal SWE', is_primary: true },
      });
      expect(targetRes.statusCode).toBe(201);
      const aliceTargetId = JSON.parse(targetRes.body).data.id;

      const oppRes = await app.inject({
        method: 'POST',
        url: '/api/v1/career/opportunities',
        payload: { company_name: 'Distributed Cloud Inc', role_title: 'Staff Systems Engineer', status: 'active' },
      });
      expect(oppRes.statusCode).toBe(201);
      const aliceOppId = JSON.parse(oppRes.body).data.id;

      const appRes = await app.inject({
        method: 'POST',
        url: '/api/v1/career/applications',
        payload: { opportunity_id: aliceOppId, stage: 'applied' },
      });
      expect(appRes.statusCode).toBe(201);
      const aliceAppId = JSON.parse(appRes.body).data.id;

      // Connect GitHub & Sync for Alice
      const ghInitRes = await app.inject({ method: 'POST', url: '/api/v1/integrations/github/connect' });
      const { state: ghState } = JSON.parse(ghInitRes.body).data;
      await app.inject({ method: 'GET', url: `/api/v1/integrations/github/callback?code=mock_code&state=${ghState}` });
      await app.inject({ method: 'POST', url: '/api/v1/integrations/github/sync' });

      // ------------------------------------------------------------------------
      // 2. Switch Context to User B (Bob) - Verify unauthorized access & mutation
      // ------------------------------------------------------------------------
      currentUserId = BOB_ID;

      // A. Goals & Tasks Isolation
      const bobGetGoal = await app.inject({ method: 'GET', url: `/api/v1/goals/${aliceGoalId}` });
      expect(bobGetGoal.statusCode).toBe(404);

      const bobPatchGoal = await app.inject({ method: 'PATCH', url: `/api/v1/goals/${aliceGoalId}`, payload: { title: 'Hacked Goal' } });
      expect(bobPatchGoal.statusCode).toBe(404);

      const bobDeleteGoal = await app.inject({ method: 'DELETE', url: `/api/v1/goals/${aliceGoalId}` });
      expect(bobDeleteGoal.statusCode).toBe(404);

      const bobGetTask = await app.inject({ method: 'GET', url: `/api/v1/tasks/${aliceTaskId}` });
      expect(bobGetTask.statusCode).toBe(404);

      const bobPatchTask = await app.inject({ method: 'PATCH', url: `/api/v1/tasks/${aliceTaskId}`, payload: { status: 'completed' } });
      expect(bobPatchTask.statusCode).toBe(404);

      const bobDeleteTask = await app.inject({ method: 'DELETE', url: `/api/v1/tasks/${aliceTaskId}` });
      expect(bobDeleteTask.statusCode).toBe(404);

      // Bob cannot create a task attached to Alice's goal
      const bobTaskOnAliceGoal = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        payload: { title: 'Bob Task on Alice Goal', goal_id: aliceGoalId, priority: 'medium', status: 'planned', task_type: 'study' },
      });
      expect([400, 403, 404]).toContain(bobTaskOnAliceGoal.statusCode);

      // Bob creates his own task then tries to create a dependency on Alice's task
      const bobOwnTaskRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        payload: { title: 'Bob Independent Task', priority: 'medium', status: 'planned', task_type: 'study' },
      });
      expect(bobOwnTaskRes.statusCode).toBe(201);
      const bobTaskId = JSON.parse(bobOwnTaskRes.body).data.id;

      const bobDepOnAliceTask = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${bobTaskId}/dependencies`,
        payload: { depends_on_task_id: aliceTaskId },
      });
      expect([400, 403, 404]).toContain(bobDepOnAliceTask.statusCode);

      // B. Evidence & Skills Isolation
      const bobGetSkill = await app.inject({ method: 'GET', url: `/api/v1/skills/${aliceSkillId}` });
      expect([400, 404]).toContain(bobGetSkill.statusCode);

      const bobGetEvidence = await app.inject({ method: 'GET', url: `/api/v1/evidence/${aliceEvidenceId}` });
      expect(bobGetEvidence.statusCode).toBe(404);

      // Bob creates a skill, then tries to link Alice's evidence to it
      const bobSkillRes = await app.inject({
        method: 'POST',
        url: '/api/v1/skills',
        payload: { name: 'Bob Distributed Systems', category: 'systems' },
      });
      const bobSkillId = JSON.parse(bobSkillRes.body).data.id;

      const bobLinkAliceEvidence = await app.inject({
        method: 'POST',
        url: `/api/v1/skills/${bobSkillId}/evidence`,
        payload: { evidence_id: aliceEvidenceId },
      });
      expect([400, 404]).toContain(bobLinkAliceEvidence.statusCode);

      // Bob tries to create evidence linked to Alice's task
      const bobEvidenceOnAliceTask = await app.inject({
        method: 'POST',
        url: '/api/v1/evidence',
        payload: {
          evidence_type: 'artifact',
          title: 'Bob Fraudulent Evidence',
          links: [{ entity_type: 'task', entity_id: aliceTaskId }],
        },
      });
      expect(bobEvidenceOnAliceTask.statusCode).toBe(403);

      // C. DSA & Projects Isolation
      const bobGetDsa = await app.inject({ method: 'GET', url: `/api/v1/dsa/problems/${aliceDsaProblemId}` });
      expect([400, 404]).toContain(bobGetDsa.statusCode);

      const bobAttemptAliceDsa = await app.inject({
        method: 'POST',
        url: '/api/v1/dsa/attempts',
        payload: { problem_id: aliceDsaProblemId, status: 'solved', solve_time_minutes: 20 },
      });
      expect([400, 404]).toContain(bobAttemptAliceDsa.statusCode);

      const bobGetProject = await app.inject({ method: 'GET', url: `/api/v1/projects/${aliceProjectId}` });
      expect(bobGetProject.statusCode).toBe(404);

      const bobPatchProject = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${aliceProjectId}`,
        payload: { title: 'Compromised Project' },
      });
      expect(bobPatchProject.statusCode).toBe(404);

      const bobDeleteProject = await app.inject({ method: 'DELETE', url: `/api/v1/projects/${aliceProjectId}` });
      expect(bobDeleteProject.statusCode).toBe(404);

      // Bob creates a project and tries to link Alice's goal
      const bobProjectRes = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        payload: { title: 'Bob Project', slug: 'bob-project', project_type: 'software', priority: 'medium', status: 'planning' },
      });
      const bobProjectId = JSON.parse(bobProjectRes.body).data.id;

      const bobLinkAliceGoalToProject = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${bobProjectId}/goals`,
        payload: { goal_id: aliceGoalId },
      });
      expect(bobLinkAliceGoalToProject.statusCode).toBe(404);

      // D. Career Isolation
      const bobGetTarget = await app.inject({ method: 'GET', url: `/api/v1/career/targets/${aliceTargetId}` });
      expect(bobGetTarget.statusCode).toBe(404);

      const bobPatchTarget = await app.inject({
        method: 'PATCH',
        url: `/api/v1/career/targets/${aliceTargetId}`,
        payload: { title: 'Compromised Target' },
      });
      expect(bobPatchTarget.statusCode).toBe(404);

      const bobGetApp = await app.inject({ method: 'GET', url: `/api/v1/career/applications/${aliceAppId}` });
      expect(bobGetApp.statusCode).toBe(404);

      const bobTransitionApp = await app.inject({
        method: 'POST',
        url: `/api/v1/career/applications/${aliceAppId}/transition-stage`,
        payload: { stage: 'rejected' },
      });
      expect(bobTransitionApp.statusCode).toBe(404);

      // E. Integrations Isolation
      const bobGetGh = await app.inject({ method: 'GET', url: '/api/v1/integrations/github' });
      expect(bobGetGh.statusCode).toBe(200);
      expect(JSON.parse(bobGetGh.body).data).toBeNull(); // Bob has no connection despite Alice having one

      const bobSyncGh = await app.inject({ method: 'POST', url: '/api/v1/integrations/github/sync' });
      expect([400, 404]).toContain(bobSyncGh.statusCode); // Cannot sync unowned / non-existent connection

      const bobListRepos = await app.inject({ method: 'GET', url: '/api/v1/integrations/github/repositories' });
      expect(bobListRepos.statusCode).toBe(200);
      expect(JSON.parse(bobListRepos.body).data).toEqual([]);

      const bobListActivities = await app.inject({ method: 'GET', url: '/api/v1/integrations/github/activities' });
      expect(bobListActivities.statusCode).toBe(200);
      expect(JSON.parse(bobListActivities.body).data).toEqual([]);

      // ------------------------------------------------------------------------
      // 3. Persisted State Invariant Assertions: Alice's records remain untouched
      // ------------------------------------------------------------------------
      const aliceGoalPersisted = await goalsRepo.findGoalById(aliceGoalId, ALICE_ID);
      expect(aliceGoalPersisted?.title).toBe('Alice Goal: Distributed Systems');

      const aliceTaskPersisted = await tasksRepo.findTaskById(aliceTaskId, ALICE_ID);
      expect(aliceTaskPersisted?.status).toBe('planned');

      const aliceEvidencePersisted = await evidenceRepo.findEvidenceById(aliceEvidenceId, ALICE_ID);
      expect(aliceEvidencePersisted?.evidence.title).toBe('Alice Raft Proof');

      const aliceSkillMastery = await skillsService.getSkillMastery(ALICE_ID, aliceSkillId);
      expect(aliceSkillMastery.evidence_count).toBe(0);

      const aliceProjectPersisted = await projectsRepo.findProjectById(aliceProjectId, ALICE_ID);
      expect(aliceProjectPersisted?.title).toBe('Alice Raft Engine');

      const aliceAppPersisted = await careerRepo.getApplicationById(ALICE_ID, aliceAppId);
      expect(aliceAppPersisted?.stage).toBe('applied');

      const aliceRepos = await integrationsRepo.listRepositories(ALICE_ID);
      expect(aliceRepos).toHaveLength(1);
      expect(aliceRepos[0]?.name).toBe('consensus-core');
    });
  });

  // ============================================================================
  // Scenario B: Intelligence Engine Resilience
  // ============================================================================
  describe('B. Intelligence Resilience', () => {
    it('handles incomplete, empty, failing sources without crashing, without silent fabrication, adhering to strict score bounds and determinism', async () => {
      currentUserId = ALICE_ID;

      // 1. Empty collections produce valid calm state
      const emptyResult = await intelligenceService.getNextAction(ALICE_ID, {
        date: '2026-10-17',
        timezone: 'UTC',
      });
      expect(emptyResult.action).toBeNull();
      expect(emptyResult.reason.code).toBe('no_actionable_tasks');

      // 2. Establish realistic domain context for Alice
      const task1 = await tasksRepo.createTask({
        user_id: ALICE_ID,
        title: 'Review Consensus Paper',
        priority: 'high',
        status: 'in_progress',
        task_type: 'study',
        due_at: '2026-10-18T10:00:00.000Z',
      });

      const task2 = await tasksRepo.createTask({
        user_id: ALICE_ID,
        title: 'Submit Distributed Assignment',
        priority: 'critical',
        status: 'todo',
        task_type: 'assignment',
        due_at: '2026-10-17T23:59:59.000Z',
      });

      // 3. Repeated evaluations with identical inputs yield identical results (Pure determinism)
      const eval1 = await intelligenceService.getNextAction(ALICE_ID, {
        date: '2026-10-17',
        timezone: 'UTC',
      });
      const eval2 = await intelligenceService.getNextAction(ALICE_ID, {
        date: '2026-10-17',
        timezone: 'UTC',
      });

      expect(eval1.action).not.toBeNull();
      expect(eval2.action).not.toBeNull();
      expect(eval1.action?.taskId).toBe(eval2.action?.taskId);
      expect(eval1.action?.score).toBe(eval2.action?.score);
      expect(eval1.reason.code).toBe(eval2.reason.code);
      expect(eval1.scoreBreakdown?.totalScore).toBe(eval2.scoreBreakdown?.totalScore);

      // 4. Scores remain strictly within [0, 100]
      expect(eval1.action!.score).toBeGreaterThanOrEqual(0);
      expect(eval1.action!.score).toBeLessThanOrEqual(100);

      // 5. Missing optional context / Failing downstream source resilience
      vi.spyOn(careerRepo, 'listApplications').mockRejectedValueOnce(new Error('Career service timeout'));
      vi.spyOn(evidenceRepo, 'findEvidence').mockRejectedValueOnce(new Error('Evidence storage unavailable'));
      vi.spyOn(focusRepo, 'findSessions').mockRejectedValueOnce(new Error('Focus DB transient failure'));

      const resilientResult = await intelligenceService.getNextAction(ALICE_ID, {
        date: '2026-10-17',
        timezone: 'UTC',
      });

      // Engine does NOT crash and evaluates tasks gracefully
      expect(resilientResult.action).not.toBeNull();
      expect([task1.id, task2.id]).toContain(resilientResult.action?.taskId);

      // 6. Tenant-owned context never leaks between users
      const bobTask = await tasksRepo.createTask({
        user_id: BOB_ID,
        title: 'Bob Private Machine Learning Study',
        priority: 'high',
        status: 'todo',
        task_type: 'study',
      });

      const aliceEvaluation = await intelligenceService.getNextAction(ALICE_ID, {
        date: '2026-10-17',
        timezone: 'UTC',
      });
      const bobEvaluation = await intelligenceService.getNextAction(BOB_ID, {
        date: '2026-10-17',
        timezone: 'UTC',
      });

      expect(aliceEvaluation.action?.taskId).not.toBe(bobTask.id);
      expect(bobEvaluation.action?.taskId).toBe(bobTask.id);

      // 7. Intelligence recommendations do NOT complete or mutate domain entities (Read-only guarantee)
      const task1After = await tasksRepo.findTaskById(task1.id, ALICE_ID);
      const task2After = await tasksRepo.findTaskById(task2.id, ALICE_ID);
      expect(task1After?.status).toBe('in_progress');
      expect(task2After?.status).toBe('todo');
    });
  });

  // ============================================================================
  // Scenario C: Integration Failure Resilience & Idempotency
  // ============================================================================
  describe('C. Integration Failure Resilience', () => {
    it('handles provider timeouts, rate limits, repeated sync idempotency, and reconciliation without corrupting core domains', async () => {
      currentUserId = ALICE_ID;

      // 1. Connect all 4 supported providers: GitHub, LeetCode, Codeforces, Google Calendar
      const ghInit = await app.inject({ method: 'POST', url: '/api/v1/integrations/github/connect' });
      const { state: ghState } = JSON.parse(ghInit.body).data;
      await app.inject({ method: 'GET', url: `/api/v1/integrations/github/callback?code=code_1&state=${ghState}` });

      await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/leetcode/connect',
        payload: { username: 'alice_leetcode' },
      });

      await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/codeforces/connect',
        payload: { handle: 'alice_master' },
      });

      const gcalInit = await app.inject({ method: 'POST', url: '/api/v1/integrations/google_calendar/connect' });
      const { state: gcalState } = JSON.parse(gcalInit.body).data;
      await app.inject({ method: 'GET', url: `/api/v1/integrations/google_calendar/callback?code=code_cal&state=${gcalState}` });

      // 2. Initial Successful Synchronization across all providers
      const ghSync1 = await app.inject({ method: 'POST', url: '/api/v1/integrations/github/sync' });
      expect(ghSync1.statusCode).toBe(200);
      expect(JSON.parse(ghSync1.body).data.repositories_synced).toBe(1);
      expect(JSON.parse(ghSync1.body).data.activities_synced).toBe(1);

      const lcSync1 = await app.inject({ method: 'POST', url: '/api/v1/integrations/leetcode/sync' });
      expect(lcSync1.statusCode).toBe(200);
      expect(JSON.parse(lcSync1.body).data.activities_synced).toBe(1);

      const cfSync1 = await app.inject({ method: 'POST', url: '/api/v1/integrations/codeforces/sync' });
      expect(cfSync1.statusCode).toBe(200);
      expect(JSON.parse(cfSync1.body).data.activities_synced).toBe(1);

      const gcalSync1 = await app.inject({ method: 'POST', url: '/api/v1/integrations/google_calendar/sync' });
      expect(gcalSync1.statusCode).toBe(200);
      expect(JSON.parse(gcalSync1.body).data.events_synced).toBe(1);

      // Verify baseline counts using provider-specific queries
      const baselineRepos = await integrationsRepo.listRepositories(ALICE_ID);
      const ghActivities = await integrationsRepo.listActivities(ALICE_ID, 'github');
      const lcActivities = await integrationsRepo.listActivities(ALICE_ID, 'leetcode');
      const cfActivities = await integrationsRepo.listActivities(ALICE_ID, 'codeforces');
      const baselineEvents = await integrationsRepo.listCalendarEvents(ALICE_ID);

      expect(baselineRepos).toHaveLength(1);
      expect(ghActivities).toHaveLength(1);
      expect(lcActivities).toHaveLength(1);
      expect(cfActivities).toHaveLength(1);
      expect(baselineEvents).toHaveLength(1);

      // 3. Repeated Synchronization (Strict Idempotency - Zero Duplicates)
      const ghSync2 = await app.inject({ method: 'POST', url: '/api/v1/integrations/github/sync' });
      expect(ghSync2.statusCode).toBe(200);

      const lcSync2 = await app.inject({ method: 'POST', url: '/api/v1/integrations/leetcode/sync' });
      expect(lcSync2.statusCode).toBe(200);

      const cfSync2 = await app.inject({ method: 'POST', url: '/api/v1/integrations/codeforces/sync' });
      expect(cfSync2.statusCode).toBe(200);

      const gcalSync2 = await app.inject({ method: 'POST', url: '/api/v1/integrations/google_calendar/sync' });
      expect(gcalSync2.statusCode).toBe(200);

      // Assert zero duplicate records created
      const postSyncRepos = await integrationsRepo.listRepositories(ALICE_ID);
      const postGhActivities = await integrationsRepo.listActivities(ALICE_ID, 'github');
      const postLcActivities = await integrationsRepo.listActivities(ALICE_ID, 'leetcode');
      const postCfActivities = await integrationsRepo.listActivities(ALICE_ID, 'codeforces');
      const postSyncEvents = await integrationsRepo.listCalendarEvents(ALICE_ID);

      expect(postSyncRepos).toHaveLength(1);
      expect(postGhActivities).toHaveLength(1);
      expect(postLcActivities).toHaveLength(1);
      expect(postCfActivities).toHaveLength(1);
      expect(postSyncEvents).toHaveLength(1);

      // 4. Reconciliation with Existing Records (Updates in-place without duplicating)
      vi.mocked(mockGitHubSyncAdapter.sync).mockResolvedValueOnce({
        success: true,
        repositories: [
          {
            externalId: 'gh-repo-100', // Same external ID
            name: 'consensus-core',
            fullName: 'alice-engineer/consensus-core',
            owner: 'alice-engineer',
            isPrivate: false,
            htmlUrl: 'https://github.com/alice-engineer/consensus-core',
            description: 'Raft consensus in Rust (Updated Description)',
            defaultBranch: 'main',
            primaryLanguage: 'Rust',
            languages: { Rust: 100 },
            starsCount: 999, // Stars increased
            forksCount: 50,
            openIssuesCount: 0,
            pushedAt: '2026-10-17T12:00:00.000Z',
          },
        ],
        activities: [],
      });

      const ghReconcileSync = await app.inject({ method: 'POST', url: '/api/v1/integrations/github/sync' });
      expect(ghReconcileSync.statusCode).toBe(200);

      const reconciledRepos = await integrationsRepo.listRepositories(ALICE_ID);
      expect(reconciledRepos).toHaveLength(1);
      expect(reconciledRepos[0]?.stars_count).toBe(999);
      expect(reconciledRepos[0]?.description).toContain('Updated Description');

      // 5. Provider Timeout & Unavailable Handling
      vi.mocked(mockGitHubSyncAdapter.sync).mockResolvedValueOnce({
        success: false,
        repositories: [],
        activities: [],
        errorCode: 'UPSTREAM_TIMEOUT',
        errorMessage: 'GitHub API gateway timeout (504).',
      });

      const ghTimeoutRes = await app.inject({ method: 'POST', url: '/api/v1/integrations/github/sync' });
      expect(ghTimeoutRes.statusCode).toBe(200);
      const ghTimeoutBody = JSON.parse(ghTimeoutRes.body).data;
      expect(ghTimeoutBody.connection.status).toBe('TEMPORARILY_UNAVAILABLE');
      expect(ghTimeoutBody.job.status).toBe('FAILED');
      expect(ghTimeoutBody.job.error_message).toContain('timeout');

      // Verify existing repository was NOT corrupted or lost during timeout
      const reposAfterTimeout = await integrationsRepo.listRepositories(ALICE_ID);
      expect(reposAfterTimeout).toHaveLength(1);
      expect(reposAfterTimeout[0]?.name).toBe('consensus-core');

      // 6. Rate Limit Handling (LeetCode)
      vi.mocked(mockLeetCodeSyncAdapter.sync).mockResolvedValueOnce({
        success: false,
        repositories: [],
        activities: [],
        isRateLimited: true,
        errorCode: 'RATE_LIMITED',
        errorMessage: 'LeetCode GraphQL rate limit exceeded.',
      });

      const lcRateLimitRes = await app.inject({ method: 'POST', url: '/api/v1/integrations/leetcode/sync' });
      expect(lcRateLimitRes.statusCode).toBe(200);
      const lcRateLimitBody = JSON.parse(lcRateLimitRes.body).data;
      expect(lcRateLimitBody.connection.status).toBe('RATE_LIMITED');
      expect(lcRateLimitBody.job.status).toBe('RATE_LIMITED');

      // 7. Core-Domain Invariant: External sync NEVER creates core tasks, goals, projects, or DSA attempts
      const allTasks = await tasksRepo.findTasks({ userId: ALICE_ID });
      const allGoals = await goalsRepo.findGoals({ userId: ALICE_ID });
      const allProjects = await projectsRepo.findProjects({
        userId: ALICE_ID,
        page: 1,
        pageSize: 20,
        sortBy: 'created_at',
        sortOrder: 'desc',
      });
      const allDsaProblems = await dsaRepo.listProblems(ALICE_ID);

      expect(allTasks.data).toHaveLength(0);
      expect(allGoals.data).toHaveLength(0);
      expect(allProjects.data).toHaveLength(0);
      expect(allDsaProblems).toHaveLength(0);
    });
  });

  // ============================================================================
  // Scenario D: Failure Atomicity & Rollback Guarantees
  // ============================================================================
  describe('D. Failure Atomicity', () => {
    it('operation 1: rolls back evidence creation when downstream entity link validation fails', async () => {
      currentUserId = ALICE_ID;

      // Alice creates a valid task
      const task = await tasksRepo.createTask({
        user_id: ALICE_ID,
        title: 'Valid Task',
        priority: 'medium',
        status: 'todo',
        task_type: 'study',
      });

      const beforeEvidence = await evidenceRepo.findEvidence({ userId: ALICE_ID });
      expect(beforeEvidence.data).toHaveLength(0);

      // Attempt to create evidence linked to an unauthorized / non-existent task
      const nonExistentTaskId = '00000000-9999-4999-8999-999999999999';
      const failRes = await app.inject({
        method: 'POST',
        url: '/api/v1/evidence',
        payload: {
          evidence_type: 'artifact',
          title: 'Unlinkable Evidence',
          links: [
            { entity_type: 'task', entity_id: task.id },
            { entity_type: 'task', entity_id: nonExistentTaskId },
          ],
        },
      });

      expect(failRes.statusCode).toBe(403);

      // Verify ATOMIC ROLLBACK: No partial evidence was persisted
      const afterEvidence = await evidenceRepo.findEvidence({ userId: ALICE_ID });
      expect(afterEvidence.data).toHaveLength(0);
    });

    it('operation 2: preserves existing primary career target when setting new primary target fails', async () => {
      currentUserId = ALICE_ID;

      // 1. Create initial primary target
      const target1 = await careerRepo.createTarget(ALICE_ID, {
        title: 'Initial Primary Target',
        target_role: 'Staff SWE',
        is_primary: true,
      });
      expect(target1.is_primary).toBe(true);

      // 2. Attempt to create second target with is_primary = true pointing to an invalid goal
      await expect(
        careerRepo.createTarget(ALICE_ID, {
          title: 'Failing Target',
          target_role: 'Principal SWE',
          is_primary: true,
          goal_id: '99999999-9999-4999-8999-999999999999',
        })
      ).rejects.toThrow(CareerNotFoundError);

      // 3. Verify ATOMIC ROLLBACK: target1 was NOT stripped of is_primary
      const refetched = await careerRepo.getTargetById(ALICE_ID, target1.id);
      expect(refetched?.is_primary).toBe(true);

      const allTargets = await careerRepo.listTargets(ALICE_ID, { is_primary: true });
      expect(allTargets.data).toHaveLength(1);
      expect(allTargets.data[0]?.id).toBe(target1.id);
    });

    it('operation 3: preserves application stage and creates 0 history records when stage transition conflict occurs', async () => {
      currentUserId = ALICE_ID;

      // Create opportunity and application
      const opp = await careerRepo.createOpportunity(ALICE_ID, {
        company_name: 'Tech Corp',
        role_title: 'Infrastructure Engineer',
      });
      const appRecord = await careerRepo.createApplication(ALICE_ID, {
        opportunity_id: opp.id,
        stage: 'applied',
      });
      expect(appRecord.stage).toBe('applied');

      const beforeHistory = await careerRepo.listApplicationHistory(ALICE_ID, appRecord.id);
      expect(beforeHistory).toHaveLength(1);

      // Attempt transition with mismatched expectedStage (concurrency guard violation)
      await expect(
        careerRepo.updateApplicationStageWithHistory(
          ALICE_ID,
          appRecord.id,
          'interview',
          'Attempted skip',
          'screening'
        )
      ).rejects.toThrow(CareerConflictError);

      // Verify ATOMIC ROLLBACK: Application stage is still 'applied' and NO new history record was persisted
      const refetchedApp = await careerRepo.getApplicationById(ALICE_ID, appRecord.id);
      expect(refetchedApp?.stage).toBe('applied');

      const afterHistory = await careerRepo.listApplicationHistory(ALICE_ID, appRecord.id);
      expect(afterHistory).toHaveLength(1);
    });
  });

  // ============================================================================
  // Scenario E: Regression Safety Invariants
  // ============================================================================
  describe('E. Regression Safety', () => {
    it('invariant 1: blocked task cannot be completed or moved to in-progress while prerequisites remain incomplete', async () => {
      currentUserId = ALICE_ID;

      const prereq = await tasksRepo.createTask({
        user_id: ALICE_ID,
        title: 'Prerequisite Task A',
        priority: 'high',
        status: 'todo',
        task_type: 'study',
      });

      const dependent = await tasksRepo.createTask({
        user_id: ALICE_ID,
        title: 'Dependent Task B',
        priority: 'medium',
        status: 'planned',
        task_type: 'study',
      });

      // Link dependency via canonical tasks API
      const depRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${dependent.id}/dependencies`,
        payload: { depends_on_task_id: prereq.id },
      });
      expect(depRes.statusCode).toBe(201);

      // Attempt to move dependent to in_progress while prereq is incomplete
      const progressRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${dependent.id}`,
        payload: { status: 'in_progress' },
      });
      expect(progressRes.statusCode).toBe(400);
      const progressBody = JSON.parse(progressRes.body);
      expect(progressBody.error.code).toBe('TASK_BLOCKED');
      expect(progressBody.error.details.blocked_by).toBeDefined();

      // Attempt to move dependent directly to completed
      const completeRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${dependent.id}`,
        payload: { status: 'completed' },
      });
      expect(completeRes.statusCode).toBe(400);
      expect(JSON.parse(completeRes.body).error.code).toBe('TASK_BLOCKED');

      // Complete prerequisite task
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${prereq.id}`,
        payload: { status: 'completed' },
      });

      // Now dependent CAN transition to in_progress and completed
      const validProgressRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${dependent.id}`,
        payload: { status: 'in_progress' },
      });
      expect(validProgressRes.statusCode).toBe(200);
      expect(JSON.parse(validProgressRes.body).data.status).toBe('in_progress');
    });

    it('invariant 2: completing all child tasks does not implicitly mark goal completed', async () => {
      currentUserId = ALICE_ID;

      const goal = await goalsRepo.createGoal({
        user_id: ALICE_ID,
        title: 'Long-term Architecture Goal',
        goal_type: 'academic',
        status: 'active',
      });

      const t1 = await tasksRepo.createTask({
        user_id: ALICE_ID,
        goal_id: goal.id,
        title: 'Child Task 1',
        status: 'todo',
        priority: 'high',
        task_type: 'study',
      });

      // Complete child task
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${t1.id}`,
        payload: { status: 'completed' },
      });

      // Goal MUST remain active (no implicit goal completion)
      const refetchedGoal = await goalsRepo.findGoalById(goal.id, ALICE_ID);
      expect(refetchedGoal?.status).toBe('active');
    });

    it('invariant 3: duplicate evidence linking is rejected and does not inflate mastery score', async () => {
      currentUserId = ALICE_ID;

      const createSkillRes = await app.inject({
        method: 'POST',
        url: '/api/v1/skills',
        payload: { name: 'Formal Verification with TLA+', category: 'systems' },
      });
      expect(createSkillRes.statusCode).toBe(201);
      const skill = JSON.parse(createSkillRes.body).data;

      const createEvRes = await app.inject({
        method: 'POST',
        url: '/api/v1/evidence',
        payload: {
          evidence_type: 'artifact',
          title: 'Raft Formal Proof',
          verification_status: 'verified',
        },
      });
      expect(createEvRes.statusCode).toBe(201);
      const ev = JSON.parse(createEvRes.body).data;

      // First link
      const link1 = await app.inject({
        method: 'POST',
        url: `/api/v1/skills/${skill.id}/evidence`,
        payload: { evidence_id: ev.id },
      });
      expect(link1.statusCode).toBe(201);

      const mastery1 = await skillsService.getSkillMastery(ALICE_ID, skill.id);
      expect(mastery1.evidence_count).toBe(1);
      const initialScore = mastery1.score;

      // Second identical link attempt
      const link2 = await app.inject({
        method: 'POST',
        url: `/api/v1/skills/${skill.id}/evidence`,
        payload: { evidence_id: ev.id },
      });
      expect([400, 409]).toContain(link2.statusCode); // Conflict or invalid request due to unique violation

      const mastery2 = await skillsService.getSkillMastery(ALICE_ID, skill.id);
      expect(mastery2.evidence_count).toBe(1);
      expect(mastery2.score).toBe(initialScore); // Zero inflation
    });
  });
});

// ==============================================================================
// Scenario F: Database-Backed Constraints, Ownership & RLS (PGlite)
// ==============================================================================
describe('Phase 17C Journey D: Database-Backed Constraints, Ownership & RLS (PGlite)', () => {
  let db: PGlite;

  function getMigrationPath(file: string): string {
    const candidates = [
      path.resolve(process.cwd(), '../../supabase/migrations', file),
      path.resolve(process.cwd(), '../supabase/migrations', file),
      path.resolve(process.cwd(), 'supabase/migrations', file),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    throw new Error(`Migration file not found: ${file}`);
  }

  beforeAll(async () => {
    db = new PGlite();

    // 1. Establish auth schema, roles, and context helpers
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
          CREATE ROLE authenticated NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN;
        END IF;
      END
      $$;
    `);

    // 2. Apply Migrations 1 through 17 in sequence
    const migrationFiles = [
      '20261002000001_init_database_foundation.sql',
      '20261003000002_goals.sql',
      '20261003000003_tasks.sql',
      '20261003000004_focus_sessions.sql',
      '20261003000005_evidence.sql',
      '20261003000006_academics.sql',
      '20261003000007_skills.sql',
      '20261004000008_dsa.sql',
      '20261004000009_integrations.sql',
      '20261005000010_integrations_leetcode.sql',
      '20261005000011_integrations_codeforces.sql',
      '20261005000012_integrations_google_calendar.sql',
      '20261006000013_projects.sql',
      '20261007000014_career.sql',
      '20261007000015_career_atomic_operations.sql',
      '20261007000016_career_rpc_security_hardening.sql',
      '20261007000017_career_atomic_stage_transition_guard.sql',
    ];

    for (const file of migrationFiles) {
      const fullPath = getMigrationPath(file);
      const sql = fs.readFileSync(fullPath, 'utf8');
      await db.exec(sql);
    }

    await db.exec(`
      GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
      GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon, service_role;
    `);
  }, 45000);

  it('verifies PostgreSQL Row Level Security (RLS) tenant isolation across tasks and goals', async () => {
    // Insert Alice and Bob profiles as superuser
    const uAlice = await db.query<{ id: string }>(`
      INSERT INTO public.profiles (clerk_user_id, display_name)
      VALUES ('clerk_pg_alice', 'Alice Database') RETURNING id;
    `);
    const aliceId = uAlice.rows[0]!.id;

    const uBob = await db.query<{ id: string }>(`
      INSERT INTO public.profiles (clerk_user_id, display_name)
      VALUES ('clerk_pg_bob', 'Bob Database') RETURNING id;
    `);
    const bobId = uBob.rows[0]!.id;
    expect(bobId).toBeDefined();

    // Create Alice's private goal & task as superuser
    const gAlice = await db.query<{ id: string }>(`
      INSERT INTO public.goals (user_id, title, goal_type)
      VALUES ('${aliceId}', 'Alice Secret Goal', 'academic') RETURNING id;
    `);
    const aliceGoalId = gAlice.rows[0]!.id;

    await db.query(`
      INSERT INTO public.tasks (user_id, title, goal_id)
      VALUES ('${aliceId}', 'Alice Secret Task', '${aliceGoalId}');
    `);

    // Switch session to authenticated Bob
    await db.exec(`
      SET ROLE authenticated;
      SET "request.jwt.claim.role" = 'authenticated';
      SET "request.jwt.claims" = '{"sub": "clerk_pg_bob"}';
    `);

    // Bob queries goals and tasks
    const bobGoals = await db.query<{ id: string }>(`SELECT id FROM public.goals;`);
    const bobTasks = await db.query<{ id: string }>(`SELECT id FROM public.tasks;`);

    // RLS filters out Alice's records completely
    expect(bobGoals.rows).toHaveLength(0);
    expect(bobTasks.rows).toHaveLength(0);

    // Bob attempts to update Alice's goal
    const updateResult = await db.query(`
      UPDATE public.goals SET title = 'Bob Overwrite' WHERE id = '${aliceGoalId}';
    `);
    expect(updateResult.affectedRows).toBe(0);

    // Reset to service role
    await db.exec(`SET ROLE postgres; RESET "request.jwt.claim.role"; RESET "request.jwt.claims";`);
  });

  it('enforces database check and uniqueness constraints for tasks, dependencies, projects, and integrations', async () => {
    const uRes = await db.query<{ id: string }>(`
      INSERT INTO public.profiles (clerk_user_id, display_name)
      VALUES ('clerk_constraints_user', 'Constraint User') RETURNING id;
    `);
    const userId = uRes.rows[0]!.id;

    // 1. Task non-negative actual_minutes
    await expect(
      db.query(`
        INSERT INTO public.tasks (user_id, title, actual_minutes)
        VALUES ('${userId}', 'Negative Minutes Task', -15);
      `)
    ).rejects.toThrow(/chk_tasks_actual_minutes_non_negative/);

    // 2. Task dependency no self-referencing loop
    const tRes = await db.query<{ id: string }>(`
      INSERT INTO public.tasks (user_id, title)
      VALUES ('${userId}', 'Self Task') RETURNING id;
    `);
    const taskId = tRes.rows[0]!.id;

    await expect(
      db.query(`
        INSERT INTO public.task_dependencies (task_id, depends_on_task_id)
        VALUES ('${taskId}', '${taskId}');
      `)
    ).rejects.toThrow(/chk_task_dependencies_no_self/);

    // 3. Project slug uniqueness per user
    await db.query(`
      INSERT INTO public.projects (user_id, title, slug)
      VALUES ('${userId}', 'Project 1', 'unique-portfolio-slug');
    `);

    await expect(
      db.query(`
        INSERT INTO public.projects (user_id, title, slug)
        VALUES ('${userId}', 'Project 2', 'unique-portfolio-slug');
      `)
    ).rejects.toThrow();

    // But a DIFFERENT user CAN use the same slug
    const otherUserRes = await db.query<{ id: string }>(`
      INSERT INTO public.profiles (clerk_user_id, display_name)
      VALUES ('clerk_other_user', 'Other User') RETURNING id;
    `);
    const otherUserId = otherUserRes.rows[0]!.id;

    const crossUserProject = await db.query<{ id: string }>(`
      INSERT INTO public.projects (user_id, title, slug)
      VALUES ('${otherUserId}', 'Other Project', 'unique-portfolio-slug') RETURNING id;
    `);
    expect(crossUserProject.rows[0]?.id).toBeDefined();

    // 4. Integrations uniqueness constraints (external repository unique per connection)
    const connRes = await db.query<{ id: string }>(`
      INSERT INTO public.integration_connections (user_id, provider, external_account_id)
      VALUES ('${userId}', 'github', 'gh-user-999') RETURNING id;
    `);
    const connId = connRes.rows[0]!.id;

    await db.query(`
      INSERT INTO public.external_repositories (connection_id, user_id, provider, external_id, name, full_name, owner, is_private, html_url)
      VALUES ('${connId}', '${userId}', 'github', 'repo-ext-1', 'repo-one', 'user/repo-one', 'user', false, 'https://github.com/user/repo-one');
    `);

    // Inserting duplicate external_id for same connection is rejected
    await expect(
      db.query(`
        INSERT INTO public.external_repositories (connection_id, user_id, provider, external_id, name, full_name, owner, is_private, html_url)
        VALUES ('${connId}', '${userId}', 'github', 'repo-ext-1', 'repo-one-dup', 'user/repo-one', 'user', false, 'https://github.com/user/repo-one');
      `)
    ).rejects.toThrow();
  });

  it('verifies database-level career_create_target transaction rollback and career_update_application_stage_with_history concurrency guard', async () => {
    const uRes = await db.query<{ id: string }>(`
      INSERT INTO public.profiles (clerk_user_id, display_name)
      VALUES ('clerk_career_db_tester', 'Career DB Tester') RETURNING id;
    `);
    const userId = uRes.rows[0]!.id;

    // 1. Create Target A as primary
    const tA = await db.query<{ id: string; is_primary: boolean }>(`
      SELECT id, is_primary FROM public.career_create_target(
        '${userId}', 'Target Alpha', 'Staff SWE', '{}', 'full_time', NULL, NULL, NULL, TRUE, NULL, NULL
      );
    `);
    expect(tA.rows[0]!.is_primary).toBe(true);
    const targetAId = tA.rows[0]!.id;

    // 2. Create Target B as primary (atomically switches primary)
    const tB = await db.query<{ id: string; is_primary: boolean }>(`
      SELECT id, is_primary FROM public.career_create_target(
        '${userId}', 'Target Beta', 'Principal SWE', '{}', 'full_time', NULL, NULL, NULL, TRUE, NULL, NULL
      );
    `);
    expect(tB.rows[0]!.is_primary).toBe(true);
    const targetBId = tB.rows[0]!.id;

    // Verify Target A was automatically unset
    const checkA = await db.query<{ is_primary: boolean }>(`
      SELECT is_primary FROM public.career_targets WHERE id = '${targetAId}';
    `);
    expect(checkA.rows[0]!.is_primary).toBe(false);

    // 3. Attempt to create invalid Target C with empty title (violating CHECK constraint)
    // Transaction MUST rollback completely, leaving Target B as primary
    await expect(
      db.query(`
        SELECT id FROM public.career_create_target(
          '${userId}', '', 'Invalid Role', '{}', 'full_time', NULL, NULL, NULL, TRUE, NULL, NULL
        );
      `)
    ).rejects.toThrow();

    const checkB = await db.query<{ is_primary: boolean }>(`
      SELECT is_primary FROM public.career_targets WHERE id = '${targetBId}';
    `);
    expect(checkB.rows[0]!.is_primary).toBe(true);

    // 4. Test career_update_application_stage_with_history RPC
    const oppRes = await db.query<{ id: string }>(`
      INSERT INTO public.career_opportunities (user_id, company_name, role_title)
      VALUES ('${userId}', 'Global Corp', 'Lead Architect') RETURNING id;
    `);
    const oppId = oppRes.rows[0]!.id;

    const appRes = await db.query<{ id: string }>(`
      INSERT INTO public.career_applications (user_id, opportunity_id, stage)
      VALUES ('${userId}', '${oppId}', 'applied') RETURNING id;
    `);
    const appId = appRes.rows[0]!.id;

    // Attempt illegal transition from 'applied' directly to 'accepted'
    await expect(
      db.query(`
        SELECT public.career_update_application_stage_with_history(
          '${userId}'::uuid,
          '${appId}'::uuid,
          'accepted'::public.career_application_stage,
          'Illegal jump'
        );
      `)
    ).rejects.toThrow(/Illegal stage transition/);

    // Verify application stage remained 'applied' and no history row was inserted
    const appCheck = await db.query<{ stage: string }>(`
      SELECT stage FROM public.career_applications WHERE id = '${appId}';
    `);
    expect(appCheck.rows[0]!.stage).toBe('applied');

    const histCheck = await db.query(`
      SELECT id FROM public.career_application_history WHERE application_id = '${appId}';
    `);
    expect(histCheck.rows).toHaveLength(0);

    // Valid transition with matching expected_stage succeeds atomically
    const validTransition = await db.query<{ career_update_application_stage_with_history: { application: { stage: string } } }>(`
      SELECT public.career_update_application_stage_with_history(
        '${userId}'::uuid,
        '${appId}'::uuid,
        'screening'::public.career_application_stage,
        'Passed initial resume screen',
        'applied'::public.career_application_stage
      );
    `);
    expect(validTransition.rows[0]!.career_update_application_stage_with_history.application.stage).toBe('screening');

    // Concurrency guard: mismatched expected_stage rejects
    await expect(
      db.query(`
        SELECT public.career_update_application_stage_with_history(
          '${userId}'::uuid,
          '${appId}'::uuid,
          'interview'::public.career_application_stage,
          'Interview step',
          'applied'::public.career_application_stage
        );
      `)
    ).rejects.toThrow(/Application stage conflict/);
  });
});
