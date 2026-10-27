import fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerErrorHandler } from '../plugins/error-handler';
import type { requireAuth as defaultRequireAuth } from '../auth/auth.middleware';

// DSA Domain
import { InMemoryDsaRepository } from '../modules/dsa/dsa.repository';
import { DsaServiceImpl } from '../modules/dsa/dsa.service.impl';
import { DsaController } from '../modules/dsa/dsa.controller';
import { createDsaRoutes } from '../modules/dsa/dsa.routes';

// Projects Domain
import { InMemoryProjectsRepository } from '../modules/projects/projects.repository';
import { ProjectsService } from '../modules/projects/projects.service';
import { ProjectsController } from '../modules/projects/projects.controller';
import { createProjectsRoutes } from '../modules/projects/projects.routes';

// Tasks Domain
import { InMemoryTasksRepository } from '../modules/tasks/tasks.repository';
import { TasksService } from '../modules/tasks/tasks.service';
import { TasksController } from '../modules/tasks/tasks.controller';
import { createTasksRoutes } from '../modules/tasks/tasks.routes';

// Integrations Domain
import { InMemoryIntegrationsRepository } from '../modules/integrations/integrations.repository.impl';
import { IntegrationsServiceImpl } from '../modules/integrations/integrations.service.impl';
import { IntegrationsController } from '../modules/integrations/integrations.controller';
import { createIntegrationsRoutes } from '../modules/integrations/integrations.routes';

// Infrastructure Providers
import { ProviderRegistry } from '../infrastructure/providers/base/provider.registry';
import { GitHubProvider } from '../infrastructure/providers/github/github.provider';
import { LeetCodeProvider } from '../infrastructure/providers/leetcode/leetcode.provider';
import { CodeforcesProvider } from '../infrastructure/providers/codeforces/codeforces.provider';
import type { IAuthProvider } from '../infrastructure/providers/base/auth.interface';
import type { ISyncProvider } from '../infrastructure/providers/base/sync.interface';
import type { ExternalRepositoryRow } from '../modules/projects/projects.repository';

// ==============================================================================
// Phase 17C Journey C: DSA and Project Integrity Integration Journey
//
// Invariants Verified:
// 1. External sync NEVER silently fabricates user-authored DSA problems or attempts.
// 2. External sync NEVER silently completes, reopens, or alters user-authored tasks.
// 3. External sync NEVER manufactures project milestones or marks deliverables complete.
// 4. Repeated synchronization is strictly idempotent: no duplicate repositories, activities, or records.
// 5. Strict multi-tenant isolation: Users cannot access, sync, or attach cross-tenant records.
// 6. Resilient failure recovery: Provider timeouts and malformed responses fail safely without corrupting state.
// 7. Each provider persists strictly to its intended domain records (external_repositories, external_activities).
// ==============================================================================

describe('Phase 17C Journey C: DSA and Project Integrity', () => {
  let app: FastifyInstance;

  // Domain Repositories
  let dsaRepo: InMemoryDsaRepository;
  let dsaService: DsaServiceImpl;
  let dsaController: DsaController;

  let tasksRepo: InMemoryTasksRepository;
  let tasksService: TasksService;
  let tasksController: TasksController;

  let projectsRepo: InMemoryProjectsRepository;
  let projectsService: ProjectsService;
  let projectsController: ProjectsController;

  let integrationsRepo: InMemoryIntegrationsRepository;
  let integrationsService: IntegrationsServiceImpl;
  let integrationsController: IntegrationsController;

  // Mock Provider Adapters
  let mockGitHubAuthAdapter: Required<IAuthProvider>;
  let mockGitHubSyncAdapter: ISyncProvider;

  let mockLeetCodeAuthAdapter: IAuthProvider;
  let mockLeetCodeSyncAdapter: ISyncProvider;

  let mockCodeforcesAuthAdapter: IAuthProvider;
  let mockCodeforcesSyncAdapter: ISyncProvider;

  let providerRegistry: ProviderRegistry;

  // Synthetic Test Users
  const ALICE_ID = '00000000-0000-4000-8000-000000000001';
  const BOB_ID = '00000000-0000-4000-8000-000000000002';
  let currentUserId: string = ALICE_ID;

  beforeEach(async () => {
    vi.restoreAllMocks();
    currentUserId = ALICE_ID;

    // 1. Initialize Repositories
    dsaRepo = new InMemoryDsaRepository();
    tasksRepo = new InMemoryTasksRepository();
    integrationsRepo = new InMemoryIntegrationsRepository();

    // Wire Projects repository with tasks map and external repos provider
    projectsRepo = new InMemoryProjectsRepository(
      tasksRepo.getTasksMap(),
      {
        listRepositories: async (uid: string) => {
          const repos = await integrationsRepo.listRepositories(uid);
          return repos as unknown as ExternalRepositoryRow[];
        },
      }
    );

    // 2. Initialize Services & Controllers
    dsaService = new DsaServiceImpl(dsaRepo);
    dsaController = new DsaController(dsaService);

    tasksService = new TasksService(tasksRepo, undefined, projectsRepo);
    tasksController = new TasksController(tasksService);

    projectsService = new ProjectsService(projectsRepo);
    projectsController = new ProjectsController(projectsService);

    // 3. Provider Adapters Configuration
    mockGitHubAuthAdapter = {
      createAuthorizationUrl: vi.fn((state) => `https://github.com/login/oauth/authorize?state=${state}`),
      exchangeCodeForTokens: vi.fn(async () => ({
        accessToken: 'mock_gh_access_token_alice',
        scope: 'read:user,repo',
      })),
      fetchIdentity: vi.fn(async () => ({
        externalAccountId: 'gh-acc-555',
        username: 'alice-engineer',
        displayName: 'Alice Engineer',
        avatarUrl: 'https://avatars.githubusercontent.com/u/555',
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
        accessToken: 'refreshed_gh_token',
        scope: 'read:user,repo',
      })),
      revokeToken: vi.fn(async () => {}),
    };

    mockGitHubSyncAdapter = {
      sync: vi.fn(async () => ({
        success: true,
        repositories: [
          {
            externalId: 'gh-repo-raft-99',
            name: 'distributed-consensus-engine',
            fullName: 'alice-engineer/distributed-consensus-engine',
            owner: 'alice-engineer',
            isPrivate: false,
            htmlUrl: 'https://github.com/alice-engineer/distributed-consensus-engine',
            description: 'Production-grade Raft consensus implementation in Rust.',
            defaultBranch: 'main',
            primaryLanguage: 'Rust',
            languages: { Rust: 98, Shell: 2 },
            starsCount: 120,
            forksCount: 15,
            openIssuesCount: 2,
            pushedAt: '2026-10-15T02:30:00.000Z',
          },
        ],
        activities: [
          {
            externalId: 'gh-commit-c101',
            activityType: 'commit',
            occurredAt: '2026-10-15T02:35:00.000Z',
            title: 'feat(raft): implement persistent log compaction snapshots',
            summary: 'Added memory-mapped snapshot engine and state serialization',
            externalUrl: 'https://github.com/alice-engineer/distributed-consensus-engine/commit/c101',
            metadata: { branch: 'main', commitSha: 'c101abcdef' },
          },
        ],
      })),
    };

    mockLeetCodeAuthAdapter = {
      connectWithIdentifier: vi.fn(async (username: string) => ({
        externalAccountId: username,
        username,
        displayName: 'Alice on LeetCode',
        avatarUrl: 'https://assets.leetcode.com/avatar_alice.png',
        email: null,
      })),
    };

    mockLeetCodeSyncAdapter = {
      sync: vi.fn(async () => ({
        success: true,
        repositories: [],
        activities: [
          {
            externalId: 'lc-sub-9001',
            activityType: 'dsa_solve',
            occurredAt: '2026-10-15T02:40:00.000Z',
            title: 'Solved LRU Cache',
            summary: 'Solved on LeetCode: LRU Cache (Design / Doubly Linked List)',
            externalUrl: 'https://leetcode.com/problems/lru-cache/',
            metadata: { platform: 'leetcode', titleSlug: 'lru-cache', runtimeMs: 76 },
          },
        ],
        syncState: {
          totalSolved: 150,
          hardSolved: 25,
          mediumSolved: 85,
          easySolved: 40,
        },
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
            externalId: 'cf-sub-4001',
            activityType: 'dsa_solve',
            occurredAt: '2026-10-15T02:45:00.000Z',
            title: 'Solved Watermelon',
            summary: 'Accepted submission for Codeforces 4A',
            externalUrl: 'https://codeforces.com/contest/4/problem/A',
            metadata: { platform: 'codeforces', contestId: 4, index: 'A', verdict: 'OK' },
          },
          {
            externalId: 'cf-contest-9900',
            activityType: 'contest_participation',
            occurredAt: '2026-10-15T02:50:00.000Z',
            title: 'Competed in Codeforces Round 950 (Div. 2)',
            summary: 'Finished rank #42 in Codeforces Round 950 (Div. 2)',
            externalUrl: 'https://codeforces.com/contest/9900',
            metadata: { platform: 'codeforces', contestId: 9900, rank: 42, ratingChange: 84 },
          },
        ],
        syncState: {
          handle: 'alice_master',
          rating: 2150,
          maxRating: 2210,
        },
      })),
    };

    // 4. Register Providers
    providerRegistry = new ProviderRegistry();

    const ghProvider = new GitHubProvider();
    vi.spyOn(ghProvider, 'getAuthAdapter').mockReturnValue(mockGitHubAuthAdapter);
    vi.spyOn(ghProvider, 'getSyncAdapter').mockReturnValue(mockGitHubSyncAdapter);
    providerRegistry.register(ghProvider);

    const lcProvider = new LeetCodeProvider();
    vi.spyOn(lcProvider, 'getAuthAdapter').mockReturnValue(mockLeetCodeAuthAdapter);
    vi.spyOn(lcProvider, 'getSyncAdapter').mockReturnValue(mockLeetCodeSyncAdapter);
    providerRegistry.register(lcProvider);

    const cfProvider = new CodeforcesProvider();
    vi.spyOn(cfProvider, 'getAuthAdapter').mockReturnValue(mockCodeforcesAuthAdapter);
    vi.spyOn(cfProvider, 'getSyncAdapter').mockReturnValue(mockCodeforcesSyncAdapter);
    providerRegistry.register(cfProvider);

    integrationsService = new IntegrationsServiceImpl(integrationsRepo, providerRegistry);
    integrationsController = new IntegrationsController(integrationsService);

    // 5. Fastify App Setup
    app = fastify();
    registerErrorHandler(app);

    const mockAuthHook = async (request: FastifyRequest) => {
      request.auth = { profileId: currentUserId, clerkUserId: `clerk_${currentUserId}` };
      (request as unknown as { profile: { id: string } }).profile = { id: currentUserId };
    };

    app.register(
      createDsaRoutes({
        requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth,
        dsaController,
      })
    );

    app.register(
      createProjectsRoutes({
        requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth,
        projectsController,
      })
    );

    app.register(
      createTasksRoutes({
        requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth,
        tasksController,
      })
    );

    app.register(
      createIntegrationsRoutes({
        requireAuthMiddleware: mockAuthHook as unknown as typeof defaultRequireAuth,
        integrationsController,
      })
    );

    await app.ready();
  });

  // ============================================================================
  // Complete Journey C Integration Test Suite
  // ============================================================================

  it('executes full Journey C verifying DSA & project domain boundaries, provider sync integrity, and tenant isolation', async () => {
    // --------------------------------------------------------------------------
    // Step 1: Create a DSA Problem & Record Attempt (User A / Alice)
    // --------------------------------------------------------------------------
    const createProblemRes = await app.inject({
      method: 'POST',
      url: '/api/v1/dsa/problems',
      payload: {
        title: 'Median of Two Sorted Arrays',
        difficulty: 'hard',
        source: 'imported',
        description: 'Given two sorted arrays nums1 and nums2, return the median of the two sorted arrays in O(log(min(m, n))) time.',
        external_url: 'https://leetcode.com/problems/median-of-two-sorted-arrays/',
        estimated_minutes: 45,
      },
    });

    expect(createProblemRes.statusCode).toBe(201);
    const createdProblem = JSON.parse(createProblemRes.body).data;
    expect(createdProblem.id).toBeDefined();
    expect(createdProblem.user_id).toBe(ALICE_ID);
    expect(createdProblem.title).toBe('Median of Two Sorted Arrays');
    expect(createdProblem.slug).toBe('median-of-two-sorted-arrays');
    expect(createdProblem.difficulty).toBe('hard');
    expect(createdProblem.source).toBe('imported');
    expect(createdProblem.status).toBe('active');
    expect(createdProblem.attempt_count).toBe(0);
    expect(createdProblem.solved_count).toBe(0);

    const aliceProblemId = createdProblem.id;

    // Record a genuine solve attempt
    const attemptTime = '2026-10-15T02:00:00.000Z';
    const createAttemptRes = await app.inject({
      method: 'POST',
      url: `/api/v1/dsa/problems/${aliceProblemId}/attempts`,
      payload: {
        status: 'solved',
        started_at: '2026-10-15T01:25:00.000Z',
        submitted_at: attemptTime,
        occurred_at: attemptTime,
        solve_time_minutes: 35,
        language: 'typescript',
        notes: 'Optimal partition binary search with edge case handling for uneven arrays.',
      },
    });

    expect(createAttemptRes.statusCode).toBe(201);
    const createdAttempt = JSON.parse(createAttemptRes.body).data;
    expect(createdAttempt.id).toBeDefined();
    expect(createdAttempt.problem_id).toBe(aliceProblemId);
    expect(createdAttempt.user_id).toBe(ALICE_ID);
    expect(createdAttempt.status).toBe('solved');
    expect(createdAttempt.solve_time_minutes).toBe(35);
    expect(createdAttempt.language).toBe('typescript');

    const aliceAttemptId = createdAttempt.id;

    // --------------------------------------------------------------------------
    // Step 2: Verify Problem Identity, Attempt Status, & Execution Metadata
    // --------------------------------------------------------------------------
    const getProblemRes = await app.inject({
      method: 'GET',
      url: `/api/v1/dsa/problems/${aliceProblemId}`,
    });
    expect(getProblemRes.statusCode).toBe(200);
    const problemDetail = JSON.parse(getProblemRes.body).data;

    // Invariant: Problem projection stats were accurately calculated
    expect(problemDetail.attempt_count).toBe(1);
    expect(problemDetail.solved_count).toBe(1);
    expect(problemDetail.failed_count).toBe(0);
    expect(problemDetail.last_attempt_at).toBe(attemptTime);
    expect(problemDetail.last_solved_at).toBe(attemptTime);
    expect(problemDetail.review_stage).toBe(1);
    expect(problemDetail.next_review_at).toBeDefined();

    // Verify persisted attempt list
    const listAttemptsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/dsa/problems/${aliceProblemId}/attempts`,
    });
    expect(listAttemptsRes.statusCode).toBe(200);
    const attempts = JSON.parse(listAttemptsRes.body).data;
    expect(attempts).toHaveLength(1);
    expect(attempts[0].id).toBe(aliceAttemptId);
    expect(attempts[0].notes).toContain('Optimal partition binary search');

    // Snapshot canonical DSA repository state
    const dsaProblemsBaseline = await dsaRepo.listProblems(ALICE_ID);
    const dsaAttemptsBaseline = await dsaRepo.listAttemptsByProblem(ALICE_ID, aliceProblemId);
    expect(dsaProblemsBaseline).toHaveLength(1);
    expect(dsaAttemptsBaseline).toHaveLength(1);

    // --------------------------------------------------------------------------
    // Step 3: Create a Portfolio Project (Projects Domain Workflow)
    // --------------------------------------------------------------------------
    const createProjectRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: {
        title: 'Distributed Consensus Engine',
        slug: 'distributed-consensus-engine',
        description: 'Production-grade Raft consensus implementation in Rust.',
        project_type: 'software',
        priority: 'high',
        status: 'in_progress',
      },
    });

    expect(createProjectRes.statusCode).toBe(201);
    const createdProject = JSON.parse(createProjectRes.body).data;
    expect(createdProject.id).toBeDefined();
    expect(createdProject.user_id).toBe(ALICE_ID);
    expect(createdProject.title).toBe('Distributed Consensus Engine');
    expect(createdProject.status).toBe('in_progress');
    expect(createdProject.repository_id).toBeNull();

    const aliceProjectId = createdProject.id;

    // --------------------------------------------------------------------------
    // Step 4: Link Valid Deliverables, Milestones, and Tasks
    // --------------------------------------------------------------------------
    const createMilestoneRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${aliceProjectId}/milestones`,
      payload: {
        title: 'Log Replication Protocol',
        description: 'AppendEntries RPC with majority quorum acknowledgments and safety checks.',
        target_date: '2026-11-01T00:00:00.000Z',
      },
    });

    expect(createMilestoneRes.statusCode).toBe(201);
    const createdMilestone = JSON.parse(createMilestoneRes.body).data;
    expect(createdMilestone.id).toBeDefined();
    expect(createdMilestone.project_id).toBe(aliceProjectId);
    expect(createdMilestone.user_id).toBe(ALICE_ID);
    expect(createdMilestone.status).toBe('pending');
    expect(createdMilestone.completed_at).toBeNull();

    const aliceMilestoneId = createdMilestone.id;

    // Create a task explicitly scoped to this project and milestone
    const createTaskRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Implement heartbeat timer and leader lease election',
        project_id: aliceProjectId,
        project_milestone_id: aliceMilestoneId,
        priority: 'high',
        status: 'planned',
        task_type: 'project',
      },
    });

    expect(createTaskRes.statusCode).toBe(201);
    const createdTask = JSON.parse(createTaskRes.body).data;
    expect(createdTask.id).toBeDefined();
    expect(createdTask.user_id).toBe(ALICE_ID);
    expect(createdTask.project_id).toBe(aliceProjectId);
    expect(createdTask.project_milestone_id).toBe(aliceMilestoneId);
    expect(createdTask.status).toBe('planned');

    const aliceTaskId = createdTask.id;

    // Verify task is mapped to the project via queries
    const projectTasksRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${aliceProjectId}/tasks`,
    });
    expect(projectTasksRes.statusCode).toBe(200);
    const projectTasks = JSON.parse(projectTasksRes.body).data;
    expect(projectTasks).toHaveLength(1);
    expect(projectTasks[0].id).toBe(aliceTaskId);

    // --------------------------------------------------------------------------
    // Step 5: Synchronize Mock GitHub Data & Link Repository
    // --------------------------------------------------------------------------
    // Canonical OAuth initiation & callback
    const oauthInitRes = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/github/connect',
    });
    expect(oauthInitRes.statusCode).toBe(200);
    const { state } = JSON.parse(oauthInitRes.body).data;
    expect(state).toBeDefined();

    const oauthCallbackRes = await app.inject({
      method: 'GET',
      url: `/api/v1/integrations/github/callback?code=mock_oauth_code&state=${state}`,
    });
    expect(oauthCallbackRes.statusCode).toBe(200);
    const connection = JSON.parse(oauthCallbackRes.body).data;
    expect(connection.provider).toBe('github');
    expect(['CONNECTED', 'SYNCED']).toContain(connection.status);

    // Trigger explicit manual sync
    const ghSyncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/github/sync',
    });
    expect(ghSyncRes.statusCode).toBe(200);
    const ghSyncBody = JSON.parse(ghSyncRes.body).data;
    expect(ghSyncBody.repositories_synced).toBe(1);
    expect(ghSyncBody.activities_synced).toBe(1);

    // Fetch synced GitHub repository
    const ghReposRes = await app.inject({
      method: 'GET',
      url: '/api/v1/integrations/github/repositories',
    });
    expect(ghReposRes.statusCode).toBe(200);
    const ghRepos = JSON.parse(ghReposRes.body).data;
    expect(ghRepos).toHaveLength(1);
    const syncedRepo = ghRepos[0];
    expect(syncedRepo.name).toBe('distributed-consensus-engine');

    // Canonical project repository linking workflow
    const linkRepoRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${aliceProjectId}/link-repository`,
      payload: {
        repository_id: syncedRepo.id,
      },
    });
    expect(linkRepoRes.statusCode).toBe(200);
    const updatedProject = JSON.parse(linkRepoRes.body).data;
    expect(updatedProject.repository_id).toBe(syncedRepo.id);

    // --------------------------------------------------------------------------
    // Required Invariants Verification: Post-GitHub Sync
    // --------------------------------------------------------------------------
    // Invariant 1: DSA problems & attempts are UNCHANGED (no fabricated problems or attempts)
    const postGhDsaProblems = await dsaRepo.listProblems(ALICE_ID);
    const postGhDsaAttempts = await dsaRepo.listAttemptsByProblem(ALICE_ID, aliceProblemId);
    expect(postGhDsaProblems).toHaveLength(1);
    expect(postGhDsaProblems[0]!.id).toBe(aliceProblemId);
    expect(postGhDsaAttempts).toHaveLength(1);
    expect(postGhDsaAttempts[0]!.id).toBe(aliceAttemptId);

    // Invariant 2: User tasks are UNCHANGED (commit activity does NOT mutate task status)
    const postGhTask = await tasksRepo.findTaskById(aliceTaskId, ALICE_ID);
    expect(postGhTask).not.toBeNull();
    expect(postGhTask!.status).toBe('planned'); // MUST remain 'planned'

    // Invariant 3: Project deliverables & milestones are UNCHANGED
    const postGhMilestone = await projectsRepo.findMilestoneById(aliceMilestoneId, aliceProjectId, ALICE_ID);
    expect(postGhMilestone).not.toBeNull();
    expect(postGhMilestone!.status).toBe('pending');
    expect(postGhMilestone!.completed_at).toBeNull();

    // --------------------------------------------------------------------------
    // Step 6: Synchronize Mock LeetCode Data
    // --------------------------------------------------------------------------
    const lcConnectRes = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/leetcode/connect',
      payload: {
        username: 'alice_lc',
      },
    });
    expect(lcConnectRes.statusCode).toBe(200);

    const lcSyncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/leetcode/sync',
    });
    expect(lcSyncRes.statusCode).toBe(200);
    const lcSyncBody = JSON.parse(lcSyncRes.body).data;
    expect(lcSyncBody.repositories_synced).toBe(0);
    expect(lcSyncBody.activities_synced).toBe(1);

    // Verify activity persisted to external_activities
    const lcActivitiesRes = await app.inject({
      method: 'GET',
      url: '/api/v1/integrations/leetcode/activities',
    });
    expect(lcActivitiesRes.statusCode).toBe(200);
    const lcActivities = JSON.parse(lcActivitiesRes.body).data;
    expect(lcActivities).toHaveLength(1);
    expect(lcActivities[0].external_id).toBe('lc-sub-9001');
    expect(lcActivities[0].title).toBe('Solved LRU Cache');

    // --------------------------------------------------------------------------
    // Required Invariants Verification: Post-LeetCode Sync
    // --------------------------------------------------------------------------
    // Invariant 1: LeetCode sync did NOT create a user problem in dsa_problems
    const postLcDsaProblems = await dsaRepo.listProblems(ALICE_ID);
    expect(postLcDsaProblems).toHaveLength(1);
    expect(postLcDsaProblems.some((p) => p.title === 'Solved LRU Cache' || p.title === 'LRU Cache')).toBe(false);

    // Invariant 2: LeetCode sync did NOT fabricate a dsa_attempt in dsa_attempts
    const postLcDsaAttempts = await dsaRepo.listAttemptsByProblem(ALICE_ID, aliceProblemId);
    expect(postLcDsaAttempts).toHaveLength(1);
    expect(postLcDsaAttempts[0]!.id).toBe(aliceAttemptId);

    // Invariant 3: Tasks and Project Milestones remain completely untouched
    const postLcTask = await tasksRepo.findTaskById(aliceTaskId, ALICE_ID);
    expect(postLcTask!.status).toBe('planned');
    const postLcMilestone = await projectsRepo.findMilestoneById(aliceMilestoneId, aliceProjectId, ALICE_ID);
    expect(postLcMilestone!.status).toBe('pending');

    // --------------------------------------------------------------------------
    // Step 7: Synchronize Mock Codeforces Data
    // --------------------------------------------------------------------------
    const cfConnectRes = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/codeforces/connect',
      payload: {
        handle: 'alice_master',
      },
    });
    expect(cfConnectRes.statusCode).toBe(200);

    const cfSyncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/codeforces/sync',
    });
    expect(cfSyncRes.statusCode).toBe(200);
    const cfSyncBody = JSON.parse(cfSyncRes.body).data;
    expect(cfSyncBody.repositories_synced).toBe(0);
    expect(cfSyncBody.activities_synced).toBe(2);

    // Verify activities persisted to external_activities
    const cfActivitiesRes = await app.inject({
      method: 'GET',
      url: '/api/v1/integrations/codeforces/activities',
    });
    expect(cfActivitiesRes.statusCode).toBe(200);
    const cfActivities = JSON.parse(cfActivitiesRes.body).data;
    expect(cfActivities).toHaveLength(2);

    // Verify canonical DSA, Task, and Project states remain unchanged
    const postCfDsaProblems = await dsaRepo.listProblems(ALICE_ID);
    expect(postCfDsaProblems).toHaveLength(1);
    const postCfTask = await tasksRepo.findTaskById(aliceTaskId, ALICE_ID);
    expect(postCfTask!.status).toBe('planned');

    // --------------------------------------------------------------------------
    // Step 8: Repeated Synchronization (Idempotency Proof)
    // --------------------------------------------------------------------------
    // Re-sync GitHub
    const repeatGhRes = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/github/sync',
    });
    expect(repeatGhRes.statusCode).toBe(200);

    // Re-sync LeetCode
    const repeatLcRes = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/leetcode/sync',
    });
    expect(repeatLcRes.statusCode).toBe(200);

    // Re-sync Codeforces
    const repeatCfRes = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/codeforces/sync',
    });
    expect(repeatCfRes.statusCode).toBe(200);

    // Assert strict record count preservation (NO duplicate records)
    const allGhRepos = await integrationsRepo.listRepositories(ALICE_ID, 'github');
    expect(allGhRepos).toHaveLength(1); // EXACTLY 1, not 2

    const allGhActivities = await integrationsRepo.listActivities(ALICE_ID, 'github');
    expect(allGhActivities).toHaveLength(1); // EXACTLY 1, not 2

    const allLcActivities = await integrationsRepo.listActivities(ALICE_ID, 'leetcode');
    expect(allLcActivities).toHaveLength(1); // EXACTLY 1, not 2

    const allCfActivities = await integrationsRepo.listActivities(ALICE_ID, 'codeforces');
    expect(allCfActivities).toHaveLength(2); // EXACTLY 2, not 4

    // Assert DSA, Tasks, and Projects remain strictly unchanged after repeated sync
    expect(await dsaRepo.listProblems(ALICE_ID)).toHaveLength(1);
    expect(await dsaRepo.listAttemptsByProblem(ALICE_ID, aliceProblemId)).toHaveLength(1);
    const idempotentTask = await tasksRepo.findTaskById(aliceTaskId, ALICE_ID);
    expect(idempotentTask!.status).toBe('planned');

    // --------------------------------------------------------------------------
    // Step 9: Safe Failure Handling (Provider Timeout & Malformed Response)
    // --------------------------------------------------------------------------
    // 9A: Injected Provider Timeout / Network Error
    vi.spyOn(mockLeetCodeSyncAdapter, 'sync').mockRejectedValueOnce(
      new Error('ETIMEDOUT: Connection to LeetCode API timed out after 10000ms')
    );

    const timeoutSyncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/leetcode/sync',
    });

    // The endpoint safely catches the error without crashing
    expect(timeoutSyncRes.statusCode).toBeGreaterThanOrEqual(400);

    // Assert existing LeetCode activities are NOT lost or corrupted
    const activitiesAfterTimeout = await integrationsRepo.listActivities(ALICE_ID, 'leetcode');
    expect(activitiesAfterTimeout).toHaveLength(1);
    expect(activitiesAfterTimeout[0]!.external_id).toBe('lc-sub-9001');

    // 9B: Injected Malformed / Partial Provider Response
    vi.spyOn(mockGitHubSyncAdapter, 'sync').mockResolvedValueOnce({
      success: false,
      errorCode: 'MALFORMED_API_RESPONSE',
      errorMessage: 'GitHub GraphQL endpoint returned invalid JSON schema.',
      repositories: [],
      activities: [],
    });

    const malformedSyncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/github/sync',
    });
    expect(malformedSyncRes.statusCode).toBe(200); // 200 with error details or handled sync result
    const malformedBody = JSON.parse(malformedSyncRes.body).data;
    expect(malformedBody.repositories_synced).toBe(0);
    expect(malformedBody.activities_synced).toBe(0);
    expect(malformedBody.job.status).toBe('FAILED');
    expect(malformedBody.connection.status).toBe('TEMPORARILY_UNAVAILABLE');

    // Assert existing GitHub repositories and activities remain preserved
    const reposAfterMalformed = await integrationsRepo.listRepositories(ALICE_ID, 'github');
    expect(reposAfterMalformed).toHaveLength(1);

    // Assert core DSA, Task, and Project records remain completely intact
    expect(await dsaRepo.listProblems(ALICE_ID)).toHaveLength(1);
    const taskAfterFailures = await tasksRepo.findTaskById(aliceTaskId, ALICE_ID);
    expect(taskAfterFailures!.status).toBe('planned');

    // --------------------------------------------------------------------------
    // Step 10: Multi-Tenant Boundary & Cross-Tenant Rejections
    // --------------------------------------------------------------------------
    // Switch auth context to Bob (User B)
    currentUserId = BOB_ID;

    // 10A: Bob attempts to read or mutate Alice's DSA problem
    const bobGetAliceProblemRes = await app.inject({
      method: 'GET',
      url: `/api/v1/dsa/problems/${aliceProblemId}`,
    });
    expect([400, 404]).toContain(bobGetAliceProblemRes.statusCode);
    expect(JSON.parse(bobGetAliceProblemRes.body).success).toBe(false);

    const bobAttemptAliceProblemRes = await app.inject({
      method: 'POST',
      url: `/api/v1/dsa/problems/${aliceProblemId}/attempts`,
      payload: {
        status: 'solved',
        solve_time_minutes: 10,
      },
    });
    expect(bobAttemptAliceProblemRes.statusCode).toBeGreaterThanOrEqual(400);

    // 10B: Bob attempts to read or mutate Alice's Project or Milestone
    const bobGetAliceProjectRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${aliceProjectId}`,
    });
    expect(bobGetAliceProjectRes.statusCode).toBe(404);

    const bobCreateMilestoneOnAliceProjectRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${aliceProjectId}/milestones`,
      payload: {
        title: 'Unauthorized Intrusion Milestone',
      },
    });
    expect(bobCreateMilestoneOnAliceProjectRes.statusCode).toBeGreaterThanOrEqual(400);

    // 10C: Bob creates his own project and attempts to link Alice's GitHub repository
    const bobCreateProjectRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: {
        title: "Bob's Rogue Project",
        slug: 'bobs-rogue-project',
        description: 'Attempting to attach cross-tenant repository.',
        project_type: 'software',
        status: 'in_progress',
      },
    });
    expect(bobCreateProjectRes.statusCode).toBe(201);
    const bobProject = JSON.parse(bobCreateProjectRes.body).data;

    const bobLinkAliceRepoRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${bobProject.id}/link-repository`,
      payload: {
        repository_id: syncedRepo.id, // Alice's repository ID!
      },
    });
    // Rejected because syncedRepo does NOT belong to Bob
    expect(bobLinkAliceRepoRes.statusCode).toBeGreaterThanOrEqual(400);

    // 10D: Bob attempts to sync Alice's GitHub integration connection
    const bobSyncAliceGhRes = await app.inject({
      method: 'POST',
      url: '/api/v1/integrations/github/sync',
    });
    expect(bobSyncAliceGhRes.statusCode).toBeGreaterThanOrEqual(400);

    // --------------------------------------------------------------------------
    // Final Invariant Check: Switch back to Alice and verify 100% integrity
    // --------------------------------------------------------------------------
    currentUserId = ALICE_ID;

    const aliceFinalProjectRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${aliceProjectId}`,
    });
    expect(aliceFinalProjectRes.statusCode).toBe(200);
    const aliceFinalProject = JSON.parse(aliceFinalProjectRes.body).data;
    expect(aliceFinalProject.repository_id).toBe(syncedRepo.id); // Alice's repo link is intact

    const aliceFinalTask = await tasksRepo.findTaskById(aliceTaskId, ALICE_ID);
    expect(aliceFinalTask!.status).toBe('planned'); // Never mutated

    const aliceFinalDsaProblems = await dsaRepo.listProblems(ALICE_ID);
    expect(aliceFinalDsaProblems).toHaveLength(1);
    expect(aliceFinalDsaProblems[0]!.id).toBe(aliceProblemId);

    const aliceFinalDsaAttempts = await dsaRepo.listAttemptsByProblem(ALICE_ID, aliceProblemId);
    expect(aliceFinalDsaAttempts).toHaveLength(1);
    expect(aliceFinalDsaAttempts[0]!.id).toBe(aliceAttemptId);
  });
});
