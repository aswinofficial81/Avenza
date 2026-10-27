import fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { IClerkClient } from '../../auth/clerk/clerk.client';
import { AuthService } from '../../auth/auth.service';
import { createRequireAuthMiddleware } from '../../auth/auth.middleware';
import { InMemoryProfileRepository } from '../identity/profile.repository';
import { ProfileService } from '../identity/profile.service';
import { InMemoryProjectsRepository } from './projects.repository';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { createProjectsRoutes } from './projects.routes';
import { registerErrorHandler } from '../../plugins/error-handler';

describe('Phase 15D — Project Relationships: Goals, Skills & GitHub', () => {
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
  let aliceProjectId: string;
  let bobProjectId: string;

  const aliceGoal1Id = '11111111-1111-4111-8111-111111111111';
  const aliceGoal2Id = '22222222-2222-4222-8222-222222222222';
  const bobGoalId = '33333333-3333-4333-8333-333333333333';

  const aliceSkill1Id = '44444444-4444-4444-8444-444444444444';
  const aliceSkill2Id = '55555555-5555-4555-8555-555555555555';
  const bobSkillId = '66666666-6666-4666-8666-666666666666';

  const aliceRepo1Id = '77777777-7777-4777-8777-777777777777';
  const aliceRepo2Id = '88888888-8888-4888-8888-888888888888';
  const bobRepoId = '99999999-9999-4999-8999-999999999999';

  it('sets up test profiles, projects, goals, skills, and repositories', async () => {
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

    // Seed Alice Project
    const projAlice = await projectsRepository.createProject({
      user_id: aliceProfileId,
      title: 'Avenza Core Platform',
      slug: 'avenza-core-platform',
      status: 'in_progress',
      priority: 'high',
      project_type: 'software',
      tech_stack: ['TypeScript', 'Fastify', 'React'],
    });
    aliceProjectId = projAlice.id;

    // Seed Bob Project
    const projBob = await projectsRepository.createProject({
      user_id: bobProfileId,
      title: 'Bob Sandbox',
      slug: 'bob-sandbox',
      status: 'planning',
      priority: 'low',
      project_type: 'software',
      tech_stack: ['Python'],
    });
    bobProjectId = projBob.id;

    // Seed Goals
    projectsRepository.seedGoal({
      id: aliceGoal1Id,
      title: 'Launch MVP Beta',
      user_id: aliceProfileId,
    });
    projectsRepository.seedGoal({
      id: aliceGoal2Id,
      title: 'Achieve Sub-100ms Latency',
      user_id: aliceProfileId,
    });
    projectsRepository.seedGoal({
      id: bobGoalId,
      title: 'Bob Secret Goal',
      user_id: bobProfileId,
    });

    // Seed Skills
    projectsRepository.seedSkill({
      id: aliceSkill1Id,
      name: 'System Architecture',
      slug: 'system-architecture',
      user_id: aliceProfileId,
    });
    projectsRepository.seedSkill({
      id: aliceSkill2Id,
      name: 'PostgreSQL Optimization',
      slug: 'postgresql-optimization',
      user_id: aliceProfileId,
    });
    projectsRepository.seedSkill({
      id: bobSkillId,
      name: 'Bob Secret Skill',
      slug: 'bob-secret-skill',
      user_id: bobProfileId,
    });

    // Seed Repositories
    projectsRepository.seedRepository({
      id: aliceRepo1Id,
      connection_id: 'conn-alice-1',
      user_id: aliceProfileId,
      provider: 'github',
      external_id: 'gh-12345',
      name: 'avenza-monorepo',
      full_name: 'alice/avenza-monorepo',
      owner: 'alice',
      is_private: false,
      html_url: 'https://github.com/alice/avenza-monorepo',
      description: 'The core personal operating system',
      default_branch: 'main',
      primary_language: 'TypeScript',
      languages: { TypeScript: 90, Rust: 10 },
      stars_count: 42,
      forks_count: 5,
      open_issues_count: 2,
      pushed_at: '2026-10-06T12:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-10-06T12:00:00Z',
    });

    projectsRepository.seedRepository({
      id: aliceRepo2Id,
      connection_id: 'conn-alice-1',
      user_id: aliceProfileId,
      provider: 'github',
      external_id: 'gh-67890',
      name: 'avenza-docs',
      full_name: 'alice/avenza-docs',
      owner: 'alice',
      is_private: false,
      html_url: 'https://github.com/alice/avenza-docs',
      description: 'Documentation site',
      default_branch: 'main',
      primary_language: 'Markdown',
      languages: { Markdown: 100 },
      stars_count: 10,
      forks_count: 1,
      open_issues_count: 0,
      pushed_at: '2026-10-05T10:00:00Z',
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-10-05T10:00:00Z',
    });

    projectsRepository.seedRepository({
      id: bobRepoId,
      connection_id: 'conn-bob-1',
      user_id: bobProfileId,
      provider: 'github',
      external_id: 'gh-bob-1',
      name: 'bob-repo',
      full_name: 'bob/bob-repo',
      owner: 'bob',
      is_private: true,
      html_url: 'https://github.com/bob/bob-repo',
      description: 'Private repo',
      default_branch: 'main',
      primary_language: 'Python',
      languages: { Python: 100 },
      stars_count: 0,
      forks_count: 0,
      open_issues_count: 0,
      pushed_at: '2026-10-04T00:00:00Z',
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-10-04T00:00:00Z',
    });

    // Seed Activities for Alice Repo 1
    projectsRepository.seedActivity({
      id: 'act-1',
      connection_id: 'conn-alice-1',
      user_id: aliceProfileId,
      repository_id: aliceRepo1Id,
      provider: 'github',
      external_id: 'commit-111',
      activity_type: 'commit',
      occurred_at: '2026-10-06T11:00:00Z',
      title: 'feat: implement Phase 15C execution integration',
      summary: 'Connected tasks with projects and milestone tracking',
      external_url: 'https://github.com/alice/avenza-monorepo/commit/111',
      metadata: { sha: '111', branch: 'main' },
      created_at: '2026-10-06T11:05:00Z',
      updated_at: '2026-10-06T11:05:00Z',
    });

    projectsRepository.seedActivity({
      id: 'act-2',
      connection_id: 'conn-alice-1',
      user_id: aliceProfileId,
      repository_id: aliceRepo1Id,
      provider: 'github',
      external_id: 'pr-222',
      activity_type: 'pull_request',
      occurred_at: '2026-10-06T09:00:00Z',
      title: 'pr: database migrations for projects',
      summary: 'Added tables and invariants',
      external_url: 'https://github.com/alice/avenza-monorepo/pull/222',
      metadata: { number: 42, state: 'merged' },
      created_at: '2026-10-06T09:05:00Z',
      updated_at: '2026-10-06T09:05:00Z',
    });

    projectsRepository.seedActivity({
      id: 'act-3',
      connection_id: 'conn-alice-1',
      user_id: aliceProfileId,
      repository_id: aliceRepo1Id,
      provider: 'github',
      external_id: 'commit-333',
      activity_type: 'commit',
      occurred_at: '2026-10-05T08:00:00Z',
      title: 'docs: update architecture design notes',
      summary: null,
      external_url: 'https://github.com/alice/avenza-monorepo/commit/333',
      metadata: { sha: '333' },
      created_at: '2026-10-05T08:05:00Z',
      updated_at: '2026-10-05T08:05:00Z',
    });

    // Seed Activity for Bob Repo
    projectsRepository.seedActivity({
      id: 'act-bob-1',
      connection_id: 'conn-bob-1',
      user_id: bobProfileId,
      repository_id: bobRepoId,
      provider: 'github',
      external_id: 'commit-bob-1',
      activity_type: 'commit',
      occurred_at: '2026-10-04T00:00:00Z',
      title: 'initial commit',
      summary: null,
      external_url: 'https://github.com/bob/bob-repo/commit/bob1',
      metadata: {},
      created_at: '2026-10-04T00:01:00Z',
      updated_at: '2026-10-04T00:01:00Z',
    });
  });

  // ============================================================================
  // GOALS (Tests 1 to 6)
  // ============================================================================
  describe('GOALS Integration', () => {
    it('1. Attach goal to project', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${aliceProjectId}/goals`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          goal_id: aliceGoal1Id,
          is_primary: true,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.project_id).toBe(aliceProjectId);
      expect(body.data.goal_id).toBe(aliceGoal1Id);
      expect(body.data.is_primary).toBe(true);
      expect(body.data.goal_title).toBe('Launch MVP Beta');
    });

    it('2. List project goals', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${aliceProjectId}/goals`,
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].goal_id).toBe(aliceGoal1Id);
      expect(body.data[0].is_primary).toBe(true);
    });

    it('3. Detach goal from project', async () => {
      // First attach a second goal
      await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${aliceProjectId}/goals`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          goal_id: aliceGoal2Id,
          is_primary: false,
        },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${aliceProjectId}/goals/${aliceGoal2Id}`,
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.unlinked).toBe(true);

      // Verify it was detached
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${aliceProjectId}/goals`,
        headers: { authorization: 'Bearer token-alice' },
      });
      const listBody = JSON.parse(listRes.body);
      expect(listBody.data).toHaveLength(1);
      expect(listBody.data[0].goal_id).toBe(aliceGoal1Id);
    });

    it('4. Duplicate goal rejection (409 Conflict)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${aliceProjectId}/goals`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          goal_id: aliceGoal1Id, // already attached
          is_primary: false,
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('5. Primary goal behavior (unsets previous primary deterministically)', async () => {
      // Re-attach goal 2 with is_primary: true
      const attachRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${aliceProjectId}/goals`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          goal_id: aliceGoal2Id,
          is_primary: true,
        },
      });
      expect(attachRes.statusCode).toBe(201);

      // Verify that goal 2 is now primary, and goal 1 is no longer primary
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${aliceProjectId}/goals`,
        headers: { authorization: 'Bearer token-alice' },
      });
      const listBody = JSON.parse(listRes.body);
      expect(listBody.data).toHaveLength(2);

      const g1 = listBody.data.find((g: { goal_id: string }) => g.goal_id === aliceGoal1Id);
      const g2 = listBody.data.find((g: { goal_id: string }) => g.goal_id === aliceGoal2Id);
      expect(g2.is_primary).toBe(true);
      expect(g1.is_primary).toBe(false);

      // Also verify PATCH /api/v1/projects/:id/goals/:goalId to set primary back to goal 1
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${aliceProjectId}/goals/${aliceGoal1Id}`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { is_primary: true },
      });
      expect(patchRes.statusCode).toBe(200);

      const listResAfter = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${aliceProjectId}/goals`,
        headers: { authorization: 'Bearer token-alice' },
      });
      const listBodyAfter = JSON.parse(listResAfter.body);
      const g1After = listBodyAfter.data.find((g: { goal_id: string }) => g.goal_id === aliceGoal1Id);
      const g2After = listBodyAfter.data.find((g: { goal_id: string }) => g.goal_id === aliceGoal2Id);
      expect(g1After.is_primary).toBe(true);
      expect(g2After.is_primary).toBe(false);
    });

    it("6. Cross-user goal rejection (Alice cannot attach Bob's goal)", async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${aliceProjectId}/goals`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          goal_id: bobGoalId,
          is_primary: false,
        },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
    });
  });

  // ============================================================================
  // SKILLS (Tests 7 to 13)
  // ============================================================================
  describe('SKILLS Integration', () => {
    it('7. Attach skill to project', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${aliceProjectId}/skills`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          skill_id: aliceSkill1Id,
          role: 'primary',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.project_id).toBe(aliceProjectId);
      expect(body.data.skill_id).toBe(aliceSkill1Id);
      expect(body.data.role).toBe('primary');
      expect(body.data.skill_name).toBe('System Architecture');
    });

    it('8. List project skills', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${aliceProjectId}/skills`,
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].skill_id).toBe(aliceSkill1Id);
      expect(body.data[0].role).toBe('primary');
    });

    it('9. Detach skill from project', async () => {
      // Attach second skill
      await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${aliceProjectId}/skills`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          skill_id: aliceSkill2Id,
          role: 'supporting',
        },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${aliceProjectId}/skills/${aliceSkill2Id}`,
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.unlinked).toBe(true);

      // Verify detached
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${aliceProjectId}/skills`,
        headers: { authorization: 'Bearer token-alice' },
      });
      const listBody = JSON.parse(listRes.body);
      expect(listBody.data).toHaveLength(1);
      expect(listBody.data[0].skill_id).toBe(aliceSkill1Id);
    });

    it('10. Duplicate skill rejection (409 Conflict)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${aliceProjectId}/skills`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          skill_id: aliceSkill1Id, // already attached
          role: 'supporting',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('11. Role validation (only primary or supporting allowed)', async () => {
      // Invalid role rejected
      const badRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${aliceProjectId}/skills`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          skill_id: aliceSkill2Id,
          role: 'invalid_role',
        },
      });
      expect(badRes.statusCode).toBe(400);

      // Valid update role supported
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${aliceProjectId}/skills/${aliceSkill1Id}`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { role: 'supporting' },
      });
      expect(patchRes.statusCode).toBe(200);
      const patchBody = JSON.parse(patchRes.body);
      expect(patchBody.data.role).toBe('supporting');
    });

    it("12. Cross-user skill rejection (Alice cannot attach Bob's skill)", async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${aliceProjectId}/skills`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          skill_id: bobSkillId,
          role: 'primary',
        },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
    });

    it('13. Verify mastery unchanged by project linking or role update', async () => {
      // The skills repository/domain is completely separate; no mastery score or XP was awarded
      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${aliceProjectId}`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(detailRes.statusCode).toBe(200);
      const detail = JSON.parse(detailRes.body).data;
      expect(detail.skills).toBeDefined();
      expect(detail.skills[0].skill_id).toBe(aliceSkill1Id);
      // Project skill DTO contains only link metadata: role, created_at, skill_name, slug
      expect(detail.skills[0]).not.toHaveProperty('mastery_score');
    });
  });

  // ============================================================================
  // GITHUB REPOSITORY LINKING & ACTIVITY (Tests 14 to 22)
  // ============================================================================
  describe('GITHUB Repository & Activity Integration', () => {
    it('14. Link repository to project', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${aliceProjectId}/link-repository`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          repository_id: aliceRepo1Id,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.repository_id).toBe(aliceRepo1Id);
    });

    it('15. Change repository linkage', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${aliceProjectId}/link-repository`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          repository_id: aliceRepo2Id,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.repository_id).toBe(aliceRepo2Id);

      // Switch back to aliceRepo1Id for activity tests
      await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${aliceProjectId}/link-repository`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { repository_id: aliceRepo1Id },
      });
    });

    it('16. Unlink repository (set repository_id to null)', async () => {
      // Create a temporary project to test unlinking
      const tempRes = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Unlink Test Project',
          slug: 'unlink-test-project',
          repository_id: aliceRepo2Id,
        },
      });
      const tempId = JSON.parse(tempRes.body).data.id;

      // Unlink
      const unlinkRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${tempId}/link-repository`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { repository_id: null },
      });

      expect(unlinkRes.statusCode).toBe(200);
      const body = JSON.parse(unlinkRes.body);
      expect(body.data.repository_id).toBeNull();
    });

    it("17. Cross-user repository rejection (Alice cannot link Bob's repository)", async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${aliceProjectId}/link-repository`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { repository_id: bobRepoId },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
    });

    it('18. Disconnected repository behavior (project survives, repository becomes null)', async () => {
      // Create project linked to aliceRepo2Id
      const tempProj = await projectsRepository.createProject({
        user_id: aliceProfileId,
        title: 'Disconnect Survives Project',
        slug: 'disconnect-survives-project',
        repository_id: aliceRepo2Id,
      });

      // Disconnect/delete repository
      projectsRepository.deleteRepository(aliceRepo2Id);

      // Verify project survived and repository_id is null
      const fetched = await projectsRepository.findProjectById(tempProj.id, aliceProfileId);
      expect(fetched).not.toBeNull();
      expect(fetched?.repository_id).toBeNull();
      expect(fetched?.title).toBe('Disconnect Survives Project');
    });

    it('19. Activity retrieval for linked project', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${aliceProjectId}/activities`,
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);
      expect(body.data[0].id).toBe('act-1');
      expect(body.data[0].activity_type).toBe('commit');
      expect(body.data[1].id).toBe('act-2');
      expect(body.data[1].activity_type).toBe('pull_request');
    });

    it('20. Empty activity without repository (returns empty array)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${bobProjectId}/activities`, // Bob project has no repo
        headers: { authorization: 'Bearer token-bob' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });

    it("21. Activity ownership isolation (Bob cannot access Alice's project activities)", async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${aliceProjectId}/activities`,
        headers: { authorization: 'Bearer token-bob' },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
    });

    it('22. Activity pagination and bounded result', async () => {
      // Query with limit = 2
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${aliceProjectId}/activities?limit=2`,
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].id).toBe('act-1');
      expect(body.data[1].id).toBe('act-2');

      // Query second page using cursor of act-2 (occurred_at: 2026-10-06T09:00:00Z)
      const resPage2 = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${aliceProjectId}/activities?limit=2&cursor=2026-10-06T09:00:00Z`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(resPage2.statusCode).toBe(200);
      const bodyPage2 = JSON.parse(resPage2.body);
      expect(bodyPage2.data).toHaveLength(1);
      expect(bodyPage2.data[0].id).toBe('act-3');
    });
  });

  // ============================================================================
  // PROJECT DETAIL (Tests 23 to 27)
  // ============================================================================
  describe('PROJECT DETAIL Data Consistency', () => {
    it('23. Goals included in Project Detail', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${aliceProjectId}`,
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.goals).toBeDefined();
      expect(body.data.goals.length).toBeGreaterThanOrEqual(1);
      expect(body.data.goals.some((g: { is_primary: boolean }) => g.is_primary)).toBe(true);
    });

    it('24. Skills included in Project Detail', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${aliceProjectId}`,
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.skills).toBeDefined();
      expect(body.data.skills.length).toBeGreaterThanOrEqual(1);
      expect(body.data.skills[0].skill_name).toBe('System Architecture');
    });

    it('25. Repository included in Project Detail', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${aliceProjectId}`,
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.repository).toBeDefined();
      expect(body.data.repository.full_name).toBe('alice/avenza-monorepo');
      expect(body.data.repository.primary_language).toBe('TypeScript');
      expect(body.data.repository.stars_count).toBe(42);
    });

    it('26. Recent Activity included in Project Detail', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${aliceProjectId}`,
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.activities).toBeDefined();
      expect(body.data.activities.length).toBeGreaterThanOrEqual(1);
      expect(body.data.activities[0].title).toBe('feat: implement Phase 15C execution integration');
    });

    it('27. Null-safe empty states in Project Detail', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${bobProjectId}`,
        headers: { authorization: 'Bearer token-bob' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.goals).toEqual([]);
      expect(body.data.skills).toEqual([]);
      expect(body.data.repository).toBeNull();
      expect(body.data.activities).toEqual([]);
      expect(body.data.milestones).toEqual([]);
      expect(body.data.tasks).toEqual([]);
    });
  });
});
