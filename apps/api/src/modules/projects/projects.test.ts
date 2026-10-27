import fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { IClerkClient } from '../../auth/clerk/clerk.client';
import { AuthService } from '../../auth/auth.service';
import { createRequireAuthMiddleware } from '../../auth/auth.middleware';
import { InMemoryProfileRepository } from '../identity/profile.repository';
import { ProfileService } from '../identity/profile.service';
import { InMemoryProjectsRepository } from './projects.repository';
import { calculateProjectMetrics, ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { createProjectsRoutes } from './projects.routes';
import { registerErrorHandler } from '../../plugins/error-handler';

describe('Projects Domain API (/api/v1/projects)', () => {
  const mockClerkClient: IClerkClient = {
    async verifyBearerToken(token: string) {
      if (token === 'token-alice') {
        return {
          clerkUserId: 'clerk_alice_id',
          displayName: 'Alice Architect',
        };
      }
      if (token === 'token-bob') {
        return {
          clerkUserId: 'clerk_bob_id',
          displayName: 'Bob Builder',
        };
      }
      return null;
    },
  };

  const authService = new AuthService(mockClerkClient);
  const profileRepository = new InMemoryProfileRepository();
  const profileService = new ProfileService(profileRepository);
  const requireAuthMiddleware = createRequireAuthMiddleware(authService, profileService);

  const projectsRepository = new InMemoryProjectsRepository();
  const projectsService = new ProjectsService(projectsRepository);
  const projectsController = new ProjectsController(projectsService);

  const customProjectsRoutes = createProjectsRoutes({
    requireAuthMiddleware,
    projectsController,
  });

  function createTestApp() {
    const app = fastify();
    registerErrorHandler(app);
    app.register(customProjectsRoutes);
    return app;
  }

  const app = createTestApp();

  let aliceProfileId: string;
  let bobProfileId: string;

  it('sets up test profiles for Alice and Bob', async () => {
    const alice = await profileRepository.createProfile({
      clerk_user_id: 'clerk_alice_id',
      display_name: 'Alice Architect',
    });
    aliceProfileId = alice.id;

    const bob = await profileRepository.createProfile({
      clerk_user_id: 'clerk_bob_id',
      display_name: 'Bob Builder',
    });
    bobProfileId = bob.id;

    expect(aliceProfileId).toBeDefined();
    expect(bobProfileId).toBeDefined();
  });

  describe('1. Authentication Gate', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/projects',
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects invalid bearer token with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer bad-token' },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('2. Project CRUD & Validation', () => {
    let aliceProjectId: string;

    it('creates a project with valid payload for Alice', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Avenza Core Engine',
          slug: 'avenza-core-engine',
          description: 'High-performance orchestration engine',
          status: 'in_progress',
          priority: 'high',
          project_type: 'software',
          start_date: '2026-10-01T00:00:00.000Z',
          target_date: '2026-12-31T00:00:00.000Z',
          live_url: 'https://avenza.dev',
          tech_stack: ['TypeScript', 'Fastify', 'PostgreSQL'],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.slug).toBe('avenza-core-engine');
      expect(body.data.metrics).toBeDefined();
      aliceProjectId = body.data.id;
    });

    it('rejects project creation with invalid slug format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Invalid Slug Project',
          slug: 'Invalid Slug!',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects duplicate slug for the same user with 409 Conflict', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Duplicate Slug Project',
          slug: 'avenza-core-engine',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('allows Bob to use the same slug (slug uniqueness is per user)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer token-bob' },
        payload: {
          title: 'Bob Avenza Fork',
          slug: 'avenza-core-engine',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.slug).toBe('avenza-core-engine');
    });

    it('gets project by ID with full details (ProjectDetailDto)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${aliceProjectId}`,
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(aliceProjectId);
      expect(body.data.milestones).toEqual([]);
      expect(body.data.tasks).toEqual([]);
      expect(body.data.goals).toEqual([]);
      expect(body.data.skills).toEqual([]);
      expect(body.data.metrics).toBeDefined();
    });

    it('updates project fields via PATCH', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${aliceProjectId}`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Avenza Core Engine V2',
          priority: 'critical',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe('Avenza Core Engine V2');
      expect(body.data.priority).toBe('critical');
    });

    it('rejects updating slug to an existing slug of the same user with 409', async () => {
      // Create a second project for Alice
      await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Alice Second Project',
          slug: 'alice-second-project',
        },
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${aliceProjectId}`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          slug: 'alice-second-project',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('deletes project via DELETE and returns { deleted: true }', async () => {
      // Create disposable project
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Disposable Project',
          slug: 'disposable-project',
        },
      });
      const disposableId = JSON.parse(createRes.body).data.id;

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${disposableId}`,
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(deleteRes.statusCode).toBe(200);
      const body = JSON.parse(deleteRes.body);
      expect(body.success).toBe(true);
      expect(body.data.deleted).toBe(true);

      // Verify 404 on subsequent get
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${disposableId}`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(getRes.statusCode).toBe(404);
    });
  });

  describe('3. Filtering, Pagination & Search', () => {
    it('supports listing with filtering, search, and pagination', async () => {
      // Create multiple projects with different statuses and priorities
      await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Machine Learning Pipeline',
          slug: 'ml-pipeline',
          status: 'planning',
          priority: 'medium',
          project_type: 'research',
        },
      });

      await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Hardware Sensor Node',
          slug: 'hw-sensor-node',
          status: 'paused',
          priority: 'low',
          project_type: 'hardware',
        },
      });

      // Filter by status=planning
      const statusRes = await app.inject({
        method: 'GET',
        url: '/api/v1/projects?status=planning',
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(statusRes.statusCode).toBe(200);
      const statusBody = JSON.parse(statusRes.body);
      expect(statusBody.data.every((p: { status: string }) => p.status === 'planning')).toBe(true);

      // Search by title "sensor"
      const searchRes = await app.inject({
        method: 'GET',
        url: '/api/v1/projects?search=sensor',
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(searchRes.statusCode).toBe(200);
      const searchBody = JSON.parse(searchRes.body);
      expect(searchBody.data).toHaveLength(1);
      expect(searchBody.data[0].slug).toBe('hw-sensor-node');

      // Pagination
      const pageRes = await app.inject({
        method: 'GET',
        url: '/api/v1/projects?pageSize=2&page=1',
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(pageRes.statusCode).toBe(200);
      const pageBody = JSON.parse(pageRes.body);
      expect(pageBody.data.length).toBeLessThanOrEqual(2);
      expect(pageBody.pagination.pageSize).toBe(2);
      expect(pageBody.pagination.total).toBeGreaterThanOrEqual(3);
    });
  });

  describe('4. IDOR Protection (Cross-User Isolation)', () => {
    let aliceSecretProjId: string;

    it('prevents Bob from accessing or mutating Alice projects', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Alice Confidential',
          slug: 'alice-confidential',
        },
      });
      aliceSecretProjId = JSON.parse(createRes.body).data.id;

      // 1. Bob cannot see Alice project in list
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer token-bob' },
      });
      const listBody = JSON.parse(listRes.body);
      const visibleIds = listBody.data.map((p: { id: string }) => p.id);
      expect(visibleIds).not.toContain(aliceSecretProjId);

      // 2. Bob cannot GET Alice project by ID
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${aliceSecretProjId}`,
        headers: { authorization: 'Bearer token-bob' },
      });
      expect(getRes.statusCode).toBe(404);

      // 3. Bob cannot UPDATE Alice project
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${aliceSecretProjId}`,
        headers: { authorization: 'Bearer token-bob' },
        payload: { title: 'Bob Tampering' },
      });
      expect(patchRes.statusCode).toBe(404);

      // 4. Bob cannot DELETE Alice project
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${aliceSecretProjId}`,
        headers: { authorization: 'Bearer token-bob' },
      });
      expect(delRes.statusCode).toBe(404);
    });
  });

  describe('5. Milestone CRUD & Cross-Project Isolation', () => {
    let proj1Id: string;
    let proj2Id: string;
    let milestoneId: string;

    it('creates, lists, updates, and deletes project milestones', async () => {
      const p1 = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer token-alice' },
        payload: { title: 'Milestone Test Project 1', slug: 'ms-test-p1' },
      });
      proj1Id = JSON.parse(p1.body).data.id;

      const p2 = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer token-alice' },
        payload: { title: 'Milestone Test Project 2', slug: 'ms-test-p2' },
      });
      proj2Id = JSON.parse(p2.body).data.id;

      // Create milestone on Project 1
      const createMs = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${proj1Id}/milestones`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Phase 1 Architecture',
          description: 'Design and review',
          status: 'pending',
          order_index: 0,
        },
      });
      expect(createMs.statusCode).toBe(201);
      const msBody = JSON.parse(createMs.body);
      milestoneId = msBody.data.id;
      expect(msBody.data.title).toBe('Phase 1 Architecture');

      // List milestones for Project 1
      const listMs = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${proj1Id}/milestones`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(listMs.statusCode).toBe(200);
      expect(JSON.parse(listMs.body).data).toHaveLength(1);

      // Update milestone
      const updateMs = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${proj1Id}/milestones/${milestoneId}`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { status: 'completed' },
      });
      expect(updateMs.statusCode).toBe(200);
      expect(JSON.parse(updateMs.body).data.status).toBe('completed');

      // Cross-project milestone manipulation rejection: trying to update milestoneId using Project 2 URL
      const crossUpdate = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${proj2Id}/milestones/${milestoneId}`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { status: 'in_progress' },
      });
      expect(crossUpdate.statusCode).toBe(404);

      // Cross-user milestone manipulation rejection (Bob trying to update Alice milestone)
      const bobUpdate = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${proj1Id}/milestones/${milestoneId}`,
        headers: { authorization: 'Bearer token-bob' },
        payload: { title: 'Bob Stole Milestone' },
      });
      expect(bobUpdate.statusCode).toBe(404);

      // Delete milestone
      const delMs = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${proj1Id}/milestones/${milestoneId}`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(delMs.statusCode).toBe(200);
      expect(JSON.parse(delMs.body).data.deleted).toBe(true);
    });
  });

  describe('6. Repository Linking & Ownership', () => {
    let projId: string;
    const aliceRepoId = '11111111-1111-4111-a111-111111111111';
    const bobRepoId = '22222222-2222-4222-a222-222222222222';

    it('links repository and rejects cross-user repositories', async () => {
      const p = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer token-alice' },
        payload: { title: 'Repo Linking Project', slug: 'repo-link-proj' },
      });
      projId = JSON.parse(p.body).data.id;

      // Seed repositories
      projectsRepository.seedRepository({
        id: aliceRepoId,
        connection_id: 'conn-alice',
        user_id: aliceProfileId,
        provider: 'github',
        external_id: 'repo-ext-1',
        name: 'alice-engine',
        full_name: 'alice/alice-engine',
        owner: 'alice',
        is_private: false,
        html_url: 'https://github.com/alice/alice-engine',
        description: 'Engine repo',
        default_branch: 'main',
        primary_language: 'TypeScript',
        languages: {},
        stars_count: 10,
        forks_count: 2,
        open_issues_count: 0,
        pushed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      projectsRepository.seedRepository({
        id: bobRepoId,
        connection_id: 'conn-bob',
        user_id: bobProfileId,
        provider: 'github',
        external_id: 'repo-ext-2',
        name: 'bob-engine',
        full_name: 'bob/bob-engine',
        owner: 'bob',
        is_private: false,
        html_url: 'https://github.com/bob/bob-engine',
        description: 'Bob repo',
        default_branch: 'main',
        primary_language: 'Go',
        languages: {},
        stars_count: 5,
        forks_count: 1,
        open_issues_count: 0,
        pushed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Link Alice's repository -> succeeds
      const linkRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projId}/link-repository`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { repositoryId: aliceRepoId },
      });
      expect(linkRes.statusCode).toBe(200);
      expect(JSON.parse(linkRes.body).data.repository_id).toBe(aliceRepoId);

      // Attempt to link Bob's repository to Alice's project -> returns 404
      const crossLinkRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projId}/link-repository`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { repositoryId: bobRepoId },
      });
      expect(crossLinkRes.statusCode).toBe(404);

      // Unlink repository (null) -> succeeds
      const unlinkRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projId}/link-repository`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { repositoryId: null },
      });
      expect(unlinkRes.statusCode).toBe(200);
      expect(JSON.parse(unlinkRes.body).data.repository_id).toBeNull();
    });
  });

  describe('7. Goal Linking & Ownership', () => {
    let projId: string;
    const aliceGoalId = '33333333-3333-4333-a333-333333333333';
    const bobGoalId = '44444444-4444-4444-a444-444444444444';

    it('attaches and detaches goals with ownership enforcement', async () => {
      const p = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer token-alice' },
        payload: { title: 'Goal Linking Project', slug: 'goal-link-proj' },
      });
      projId = JSON.parse(p.body).data.id;

      projectsRepository.seedGoal({ id: aliceGoalId, title: 'Alice Goal', user_id: aliceProfileId });
      projectsRepository.seedGoal({ id: bobGoalId, title: 'Bob Goal', user_id: bobProfileId });

      // Alice links her goal -> succeeds
      const attachRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projId}/goals`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { goalId: aliceGoalId, isPrimary: true },
      });
      expect(attachRes.statusCode).toBe(201);
      const attachBody = JSON.parse(attachRes.body);
      expect(attachBody.data.goal_id).toBe(aliceGoalId);
      expect(attachBody.data.is_primary).toBe(true);

      // Duplicate link returns 409
      const dupRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projId}/goals`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { goalId: aliceGoalId, isPrimary: false },
      });
      expect(dupRes.statusCode).toBe(409);

      // Cross-user goal link (Alice trying to link Bob's goal) -> returns 404
      const crossRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projId}/goals`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { goalId: bobGoalId },
      });
      expect(crossRes.statusCode).toBe(404);

      // Detach goal -> succeeds
      const detachRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${projId}/goals/${aliceGoalId}`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(detachRes.statusCode).toBe(200);
      expect(JSON.parse(detachRes.body).data.unlinked).toBe(true);
    });
  });

  describe('8. Skill Linking & Ownership', () => {
    let projId: string;
    const aliceSkillId = '55555555-5555-4555-a555-555555555555';
    const bobSkillId = '66666666-6666-4666-a666-666666666666';

    it('attaches and detaches skills with ownership enforcement', async () => {
      const p = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer token-alice' },
        payload: { title: 'Skill Linking Project', slug: 'skill-link-proj' },
      });
      projId = JSON.parse(p.body).data.id;

      projectsRepository.seedSkill({ id: aliceSkillId, name: 'Rust', slug: 'rust', user_id: aliceProfileId });
      projectsRepository.seedSkill({ id: bobSkillId, name: 'Python', slug: 'python', user_id: bobProfileId });

      // Alice links her skill -> succeeds
      const attachRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projId}/skills`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { skillId: aliceSkillId, role: 'primary' },
      });
      expect(attachRes.statusCode).toBe(201);
      const attachBody = JSON.parse(attachRes.body);
      expect(attachBody.data.skill_id).toBe(aliceSkillId);
      expect(attachBody.data.role).toBe('primary');

      // Duplicate skill link returns 409
      const dupRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projId}/skills`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { skillId: aliceSkillId, role: 'supporting' },
      });
      expect(dupRes.statusCode).toBe(409);

      // Cross-user skill link -> returns 404
      const crossRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projId}/skills`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { skillId: bobSkillId, role: 'supporting' },
      });
      expect(crossRes.statusCode).toBe(404);

      // Detach skill -> succeeds
      const detachRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${projId}/skills/${aliceSkillId}`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(detachRes.statusCode).toBe(200);
      expect(JSON.parse(detachRes.body).data.unlinked).toBe(true);
    });
  });

  describe('9. Project Activities', () => {
    let projId: string;
    const repoId = '77777777-7777-4777-a777-777777777777';

    it('returns empty array when no repository is linked', async () => {
      const p = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer token-alice' },
        payload: { title: 'No Repo Activity Project', slug: 'no-repo-act-proj' },
      });
      projId = JSON.parse(p.body).data.id;

      const actRes = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${projId}/activities`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(actRes.statusCode).toBe(200);
      expect(JSON.parse(actRes.body).data).toEqual([]);
    });

    it('returns external activities associated with linked repository', async () => {
      projectsRepository.seedRepository({
        id: repoId,
        connection_id: 'conn-act',
        user_id: aliceProfileId,
        provider: 'github',
        external_id: 'repo-ext-act',
        name: 'act-repo',
        full_name: 'alice/act-repo',
        owner: 'alice',
        is_private: false,
        html_url: 'https://github.com/alice/act-repo',
        description: null,
        default_branch: 'main',
        primary_language: 'TS',
        languages: {},
        stars_count: 0,
        forks_count: 0,
        open_issues_count: 0,
        pushed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Link repository
      await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${projId}/link-repository`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { repositoryId: repoId },
      });

      // Seed activity
      projectsRepository.seedActivity({
        id: 'act-1',
        connection_id: 'conn-act',
        user_id: aliceProfileId,
        repository_id: repoId,
        provider: 'github',
        external_id: 'commit-123',
        activity_type: 'commit',
        occurred_at: new Date().toISOString(),
        title: 'Initial Commit',
        summary: 'Add setup files',
        external_url: 'https://github.com/alice/act-repo/commit/123',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const actRes = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${projId}/activities?limit=10`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(actRes.statusCode).toBe(200);
      const actBody = JSON.parse(actRes.body);
      expect(actBody.data).toHaveLength(1);
      expect(actBody.data[0].title).toBe('Initial Commit');
    });
  });

  describe('10. Pure Derived Metrics (calculateProjectMetrics)', () => {
    it('calculates progress from milestones when milestones exist (Case 1)', () => {
      const metrics = calculateProjectMetrics(
        { status: 'in_progress', start_date: null, target_date: '2026-12-31T00:00:00.000Z' },
        {
          totalMilestones: 4,
          completedMilestones: 3,
          totalTasks: 10,
          completedTasks: 10,
          hasOverdueMilestones: false,
        }
      );
      expect(metrics.progressPercentage).toBe(75);
      expect(metrics.milestoneCount).toBe(4);
      expect(metrics.completedMilestoneCount).toBe(3);
    });

    it('calculates progress from tasks when no milestones exist (Case 2)', () => {
      const metrics = calculateProjectMetrics(
        { status: 'in_progress', start_date: null, target_date: '2026-12-31T00:00:00.000Z' },
        {
          totalMilestones: 0,
          completedMilestones: 0,
          totalTasks: 5,
          completedTasks: 2,
          hasOverdueMilestones: false,
        }
      );
      expect(metrics.progressPercentage).toBe(40);
    });

    it('calculates progress when no milestones and no tasks exist (Case 3)', () => {
      const completed = calculateProjectMetrics(
        { status: 'completed', start_date: null, target_date: null },
        {
          totalMilestones: 0,
          completedMilestones: 0,
          totalTasks: 0,
          completedTasks: 0,
          hasOverdueMilestones: false,
        }
      );
      expect(completed.progressPercentage).toBe(100);

      const inProgress = calculateProjectMetrics(
        { status: 'in_progress', start_date: null, target_date: null },
        {
          totalMilestones: 0,
          completedMilestones: 0,
          totalTasks: 0,
          completedTasks: 0,
          hasOverdueMilestones: false,
        }
      );
      expect(inProgress.progressPercentage).toBe(0);
    });

    it('determines healthStatus: unknown for backlog/planning/paused/archived or no target_date', () => {
      const noTarget = calculateProjectMetrics(
        { status: 'in_progress', start_date: null, target_date: null },
        {
          totalMilestones: 2,
          completedMilestones: 1,
          totalTasks: 0,
          completedTasks: 0,
          hasOverdueMilestones: false,
        }
      );
      expect(noTarget.healthStatus).toBe('unknown');

      const backlog = calculateProjectMetrics(
        { status: 'backlog', start_date: null, target_date: '2026-12-31T00:00:00.000Z' },
        {
          totalMilestones: 2,
          completedMilestones: 1,
          totalTasks: 0,
          completedTasks: 0,
          hasOverdueMilestones: false,
        }
      );
      expect(backlog.healthStatus).toBe('unknown');
    });

    it('determines healthStatus: at_risk when target date has passed with incomplete progress', () => {
      const pastDate = '2026-09-01T00:00:00.000Z';
      const atRisk = calculateProjectMetrics(
        { status: 'in_progress', start_date: '2026-08-01T00:00:00.000Z', target_date: pastDate },
        {
          totalMilestones: 2,
          completedMilestones: 1,
          totalTasks: 0,
          completedTasks: 0,
          hasOverdueMilestones: false,
        },
        new Date('2026-10-06T00:00:00.000Z')
      );
      expect(atRisk.healthStatus).toBe('at_risk');
      expect(atRisk.healthReason).toContain('Target date has passed');
    });

    it('determines healthStatus: at_risk when active milestone is overdue', () => {
      const atRisk = calculateProjectMetrics(
        { status: 'in_progress', start_date: '2026-10-01T00:00:00.000Z', target_date: '2026-12-31T00:00:00.000Z' },
        {
          totalMilestones: 2,
          completedMilestones: 0,
          totalTasks: 0,
          completedTasks: 0,
          hasOverdueMilestones: true,
        },
        new Date('2026-10-06T00:00:00.000Z')
      );
      expect(atRisk.healthStatus).toBe('at_risk');
      expect(atRisk.healthReason).toContain('Active milestone is overdue');
    });

    it('determines healthStatus: at_risk when pacing is more than 20% behind expected progress', () => {
      // 50 days total, 25 days elapsed (50% expected), but progress is only 10% (diff = 40% > 20%)
      const atRisk = calculateProjectMetrics(
        {
          status: 'in_progress',
          start_date: '2026-10-01T00:00:00.000Z',
          target_date: '2026-10-31T00:00:00.000Z',
        },
        {
          totalMilestones: 10,
          completedMilestones: 1, // 10% progress
          totalTasks: 0,
          completedTasks: 0,
          hasOverdueMilestones: false,
        },
        new Date('2026-10-16T00:00:00.000Z') // ~50% elapsed
      );
      expect(atRisk.healthStatus).toBe('at_risk');
      expect(atRisk.healthReason).toContain('Pacing is');
    });

    it('determines healthStatus: on_track for active project on schedule', () => {
      const onTrack = calculateProjectMetrics(
        {
          status: 'in_progress',
          start_date: '2026-10-01T00:00:00.000Z',
          target_date: '2026-10-31T00:00:00.000Z',
        },
        {
          totalMilestones: 10,
          completedMilestones: 6, // 60% progress
          totalTasks: 0,
          completedTasks: 0,
          hasOverdueMilestones: false,
        },
        new Date('2026-10-16T00:00:00.000Z') // ~50% elapsed, 60% progress >= expected
      );
      expect(onTrack.healthStatus).toBe('on_track');
      expect(onTrack.healthReason).toContain('on track');
    });
  });
});
