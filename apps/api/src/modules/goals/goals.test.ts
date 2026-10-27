import fastify from 'fastify';
import type { IClerkClient } from '../../auth/clerk/clerk.client';
import { AuthService } from '../../auth/auth.service';
import { createRequireAuthMiddleware } from '../../auth/auth.middleware';
import { InMemoryProfileRepository } from '../identity/profile.repository';
import { ProfileService } from '../identity/profile.service';
import { InMemoryGoalsRepository } from './goals.repository';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';
import { createGoalsRoutes } from './goals.routes';
import { registerErrorHandler } from '../../plugins/error-handler';
import { describe, expect, it, vi } from 'vitest';

describe('Goals & Milestones API (/api/v1/goals)', () => {
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

  const goalsRepository = new InMemoryGoalsRepository();
  const goalsService = new GoalsService(goalsRepository);
  const goalsController = new GoalsController(goalsService);

  const customGoalsRoutes = createGoalsRoutes({
    requireAuthMiddleware,
    goalsController,
  });

  function createTestApp() {
    const app = fastify();
    registerErrorHandler(app);
    app.register(customGoalsRoutes);
    return app;
  }

  const app = createTestApp();

  describe('1. Authentication Gate', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/goals',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects invalid bearer token with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/goals',
        headers: {
          authorization: 'Bearer bad-token',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('2. Goal Creation & Validation', () => {
    it('creates a goal with valid payload for Alice', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-15T12:00:00.000Z'));
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/goals',
          headers: { authorization: 'Bearer token-alice' },
          payload: {
            title: 'Master TypeScript & Distributed Systems',
            description: 'Deep dive into concurrent architectures',
            goal_type: 'learning',
            priority: 'high',
            status: 'active',
            start_date: '2026-10-01T00:00:00.000Z',
            target_date: '2026-12-31T00:00:00.000Z',
            desired_outcome: 'Build production-ready distributed services',
            completion_criteria: 'Pass systems architecture review',
          },
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.data.title).toBe('Master TypeScript & Distributed Systems');
        expect(body.data.goal_type).toBe('learning');
        expect(body.data.priority).toBe('high');
        expect(body.data.status).toBe('active');
        expect(body.data.metrics).toBeDefined();
        expect(body.data.metrics.progressPercentage).toBe(0);
        expect(body.data.metrics.healthStatus).toBe('on_track');

      } finally {
        vi.useRealTimers();
      }
    });
    it('rejects goal creation with empty title', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/goals',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: '   ',
          goal_type: 'career',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects goal creation when target_date is before start_date', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/goals',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Invalid Date Goal',
          goal_type: 'personal',
          start_date: '2026-11-01T00:00:00.000Z',
          target_date: '2026-10-01T00:00:00.000Z',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('3. Goal Listing, Filtering, and Pagination', () => {
    it('lists goals belonging only to the authenticated user', async () => {
      // Create a goal for Bob
      await app.inject({
        method: 'POST',
        url: '/api/v1/goals',
        headers: { authorization: 'Bearer token-bob' },
        payload: {
          title: 'Bob Personal Project',
          goal_type: 'project',
          priority: 'medium',
        },
      });

      // Alice lists her goals
      const resAlice = await app.inject({
        method: 'GET',
        url: '/api/v1/goals',
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(resAlice.statusCode).toBe(200);
      const bodyAlice = JSON.parse(resAlice.body);
      expect(bodyAlice.success).toBe(true);
      expect(bodyAlice.data.length).toBe(1);
      expect(bodyAlice.data[0].title).toBe('Master TypeScript & Distributed Systems');

      // Bob lists his goals
      const resBob = await app.inject({
        method: 'GET',
        url: '/api/v1/goals',
        headers: { authorization: 'Bearer token-bob' },
      });

      expect(resBob.statusCode).toBe(200);
      const bodyBob = JSON.parse(resBob.body);
      expect(bodyBob.success).toBe(true);
      expect(bodyBob.data.length).toBe(1);
      expect(bodyBob.data[0].title).toBe('Bob Personal Project');
    });

    it('filters goals by status and goal_type', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/goals?status=active&goal_type=learning',
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.length).toBe(1);

      const noMatch = await app.inject({
        method: 'GET',
        url: '/api/v1/goals?status=draft',
        headers: { authorization: 'Bearer token-alice' },
      });
      const noMatchBody = JSON.parse(noMatch.body);
      expect(noMatchBody.data.length).toBe(0);
    });
  });

  describe('4. Goal Details, Milestones & Progress Computation', () => {
    let aliceGoalId: string;
    let milestone1Id: string;

    it('fetches goal details with empty milestones initially', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/goals',
        headers: { authorization: 'Bearer token-alice' },
      });
      aliceGoalId = JSON.parse(listRes.body).data[0].id;

      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/v1/goals/${aliceGoalId}`,
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(detailRes.statusCode).toBe(200);
      const body = JSON.parse(detailRes.body);
      expect(body.data.id).toBe(aliceGoalId);
      expect(body.data.milestones).toEqual([]);
      expect(body.data.metrics.progressPercentage).toBe(0);
    });

    it('creates milestones under a goal and orders deterministically', async () => {
      // Milestone 1
      const ms1Res = await app.inject({
        method: 'POST',
        url: `/api/v1/goals/${aliceGoalId}/milestones`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Phase 1: Read Designing Data-Intensive Applications',
          order_index: 0,
          status: 'pending',
          priority: 'high',
        },
      });
      expect(ms1Res.statusCode).toBe(201);
      milestone1Id = JSON.parse(ms1Res.body).data.id;

      // Milestone 2
      const ms2Res = await app.inject({
        method: 'POST',
        url: `/api/v1/goals/${aliceGoalId}/milestones`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Phase 2: Implement Raft Consensus Protocol',
          order_index: 1,
          status: 'pending',
          priority: 'critical',
        },
      });
      expect(ms2Res.statusCode).toBe(201);

      // Verify list of milestones
      const listMs = await app.inject({
        method: 'GET',
        url: `/api/v1/goals/${aliceGoalId}/milestones`,
        headers: { authorization: 'Bearer token-alice' },
      });
      const listMsBody = JSON.parse(listMs.body);
      expect(listMsBody.data.length).toBe(2);
      expect(listMsBody.data[0].order_index).toBe(0);
      expect(listMsBody.data[1].order_index).toBe(1);
    });

    it('derives progress percentage when completing milestones', async () => {
      // Complete milestone 1
      const updateMs = await app.inject({
        method: 'PATCH',
        url: `/api/v1/goals/${aliceGoalId}/milestones/${milestone1Id}`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          status: 'completed',
        },
      });
      expect(updateMs.statusCode).toBe(200);
      expect(JSON.parse(updateMs.body).data.completed_at).toBeDefined();

      // Check parent goal detail
      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/v1/goals/${aliceGoalId}`,
        headers: { authorization: 'Bearer token-alice' },
      });
      const body = JSON.parse(detailRes.body);
      // 1 of 2 completed -> 50%
      expect(body.data.metrics.milestoneCount).toBe(2);
      expect(body.data.metrics.completedMilestoneCount).toBe(1);
      expect(body.data.metrics.progressPercentage).toBe(50);
    });

    it('prevents Bob from accessing or modifying Alice goal or milestones', async () => {
      // Bob tries to read Alice's goal -> 404
      const res1 = await app.inject({
        method: 'GET',
        url: `/api/v1/goals/${aliceGoalId}`,
        headers: { authorization: 'Bearer token-bob' },
      });
      expect(res1.statusCode).toBe(404);

      // Bob tries to add milestone to Alice's goal -> 404
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/v1/goals/${aliceGoalId}/milestones`,
        headers: { authorization: 'Bearer token-bob' },
        payload: {
          title: 'Bob Hacked Milestone',
        },
      });
      expect(res2.statusCode).toBe(404);

      // Bob tries to delete Alice's milestone -> 404
      const res3 = await app.inject({
        method: 'DELETE',
        url: `/api/v1/goals/${aliceGoalId}/milestones/${milestone1Id}`,
        headers: { authorization: 'Bearer token-bob' },
      });
      expect(res3.statusCode).toBe(404);
    });
  });

  describe('5. Goal Updates, Lifecycle & Deletion', () => {
    let aliceGoalId: string;

    it('updates goal properties and transitions lifecycle', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/goals',
        headers: { authorization: 'Bearer token-alice' },
      });
      aliceGoalId = JSON.parse(listRes.body).data[0].id;

      // Update goal status to paused
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/goals/${aliceGoalId}`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          status: 'paused',
          notes: 'Paused temporarily for exams',
        },
      });

      expect(patchRes.statusCode).toBe(200);
      const body = JSON.parse(patchRes.body);
      expect(body.data.status).toBe('paused');
      expect(body.data.notes).toBe('Paused temporarily for exams');
      expect(body.data.metrics.healthStatus).toBe('unknown'); // Paused goals have unknown health
    });

    it('completes goal and sets completed_at automatically', async () => {
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/goals/${aliceGoalId}`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          status: 'completed',
        },
      });

      expect(patchRes.statusCode).toBe(200);
      const body = JSON.parse(patchRes.body);
      expect(body.data.status).toBe('completed');
      expect(body.data.completed_at).toBeDefined();
      expect(body.data.metrics.healthStatus).toBe('on_track');
      expect(body.data.metrics.progressPercentage).toBe(100);
    });

    it('deletes goal and cascades deletion of milestones', async () => {
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/goals/${aliceGoalId}`,
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(delRes.statusCode).toBe(200);

      // Verify goal is gone
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/goals/${aliceGoalId}`,
        headers: { authorization: 'Bearer token-alice' },
      });
      expect(getRes.statusCode).toBe(404);
    });
  });
});
