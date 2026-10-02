import fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { IClerkClient } from '../../auth/clerk/clerk.client';
import { AuthService } from '../../auth/auth.service';
import { createRequireAuthMiddleware } from '../../auth/auth.middleware';
import { InMemoryProfileRepository } from '../identity/profile.repository';
import { ProfileService } from '../identity/profile.service';
import { InMemoryGoalsRepository } from '../goals/goals.repository';
import { InMemoryTasksRepository } from './tasks.repository';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { createTasksRoutes } from './tasks.routes';
import { registerErrorHandler } from '../../plugins/error-handler';

describe('Tasks & Dependencies API (/api/v1/tasks)', () => {
  const mockClerkClient: IClerkClient = {
    async verifyBearerToken(token: string) {
      if (token === 'token-alice') {
        return {
          clerkUserId: 'clerk_alice_task_id',
          displayName: 'Alice Architect',
        };
      }
      if (token === 'token-bob') {
        return {
          clerkUserId: 'clerk_bob_task_id',
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
  const tasksRepository = new InMemoryTasksRepository();
  const tasksService = new TasksService(tasksRepository, goalsRepository);
  const tasksController = new TasksController(tasksService);

  const customTasksRoutes = createTasksRoutes({
    requireAuthMiddleware,
    tasksController,
  });

  function createTestApp() {
    const app = fastify();
    registerErrorHandler(app);
    app.register(customTasksRoutes);
    return app;
  }

  const app = createTestApp();

  let aliceGoalId: string;
  let aliceMilestoneId: string;
  let bobGoalId: string;

  describe('1. Authentication Gate', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects invalid bearer token with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks',
        headers: { authorization: 'Bearer invalid-token' },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('2. Task Creation & Validation', () => {
    it('creates a task with valid payload for Alice', async () => {
      // Bootstrap Alice's profile
      const aliceProfile = await profileService.getOrCreateProfile(
        'clerk_alice_task_id',
        { displayName: 'Alice Architect' }
      );
      // Create a goal and milestone for Alice
      const g = await goalsRepository.createGoal({
        user_id: aliceProfile.id,
        title: 'Learn Distributed Systems',
        goal_type: 'learning',
      });
      aliceGoalId = g.id;

      const m = await goalsRepository.createMilestone(
        {
          goal_id: aliceGoalId,
          title: 'Implement Raft Consensus',
          order_index: 0,
        },
        aliceProfile.id
      );
      aliceMilestoneId = m.id;

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Implement Leader Election',
          description: 'Handle heartbeat timers and term increments',
          task_type: 'project',
          priority: 'high',
          status: 'planned',
          goal_id: aliceGoalId,
          milestone_id: aliceMilestoneId,
          estimated_minutes: 120,
          due_at: '2026-10-15T18:00:00.000Z',
          scheduled_start: '2026-10-10T09:00:00.000Z',
          scheduled_end: '2026-10-10T11:00:00.000Z',
          notes: 'Read Ongaro thesis section 5.2',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe('Implement Leader Election');
      expect(body.data.goal_id).toBe(aliceGoalId);
      expect(body.data.goal_title).toBe('Learn Distributed Systems');
      expect(body.data.milestone_id).toBe(aliceMilestoneId);
      expect(body.data.milestone_title).toBe('Implement Raft Consensus');
      expect(body.data.estimated_minutes).toBe(120);
      expect(body.data.is_blocked).toBe(false);
      expect(body.data.blocking_task_count).toBe(0);
    });

    it('rejects task creation with empty title', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: '   ',
          task_type: 'study',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects task creation with invalid status or priority', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Invalid Status Task',
          status: 'done_zo',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects task creation with non-positive estimated minutes', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Bad Estimate Task',
          estimated_minutes: 0,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects scheduled_end earlier than scheduled_start', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Bad Schedule Task',
          scheduled_start: '2026-10-10T12:00:00.000Z',
          scheduled_end: '2026-10-10T11:00:00.000Z',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details.scheduled_end[0]).toContain('scheduled_end cannot be earlier than scheduled_start');
    });
  });

  describe('3. Cross-Domain Ownership & Integrity', () => {
    it('rejects attaching a goal belonging to another user', async () => {
      // Bob profile
      const bobProfile = await profileService.getOrCreateProfile(
        'clerk_bob_task_id',
        { displayName: 'Bob Builder' }
      );
      const bobGoal = await goalsRepository.createGoal({
        user_id: bobProfile.id,
        title: 'Bob Personal Goal',
        goal_type: 'personal',
      });
      bobGoalId = bobGoal.id;

      // Alice tries to attach Bob's goal to her task
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Alice Task with Bob Goal',
          goal_id: bobGoalId,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain('Goal not found or does not belong');
    });

    it('rejects attaching a milestone from Goal B when task is set to Goal A', async () => {
      // Alice creates a second goal
      const aliceProfile = await profileService.getOrCreateProfile(
        'clerk_alice_task_id',
        { displayName: 'Alice Architect' }
      );
      const secondGoal = await goalsRepository.createGoal({
        user_id: aliceProfile.id,
        title: 'Second Alice Goal',
        goal_type: 'project',
      });

      // Try to create task with secondGoal as goal_id but aliceMilestoneId (which belongs to aliceGoalId)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Mismatched Goal and Milestone Task',
          goal_id: secondGoal.id,
          milestone_id: aliceMilestoneId,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain('Milestone not found or does not belong to the specified goal');
    });
  });

  describe('4. Task Lifecycle Transitions', () => {
    let lifecycleTaskId: string;

    it('creates task and verifies initial completed_at is null', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          title: 'Lifecycle Verification Task',
          status: 'planned',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      lifecycleTaskId = body.data.id;
      expect(body.data.status).toBe('planned');
      expect(body.data.completed_at).toBeNull();
    });

    it('sets completed_at automatically when transitioning to completed', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${lifecycleTaskId}`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          status: 'completed',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.status).toBe('completed');
      expect(body.data.completed_at).toBeDefined();
      expect(body.data.completed_at).not.toBeNull();
    });

    it('clears completed_at when reopening task back to in_progress', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${lifecycleTaskId}`,
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          status: 'in_progress',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.status).toBe('in_progress');
      expect(body.data.completed_at).toBeNull();
    });
  });

  describe('5. Task Dependencies & Blocked State Derivation', () => {
    let taskA: string;
    let taskB: string;
    let taskC: string;
    let dependencyABId: string;

    it('creates three tasks: A, B, C', async () => {
      const resA = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: 'Bearer token-alice' },
        payload: { title: 'Task A (Deploy API)', status: 'planned' },
      });
      taskA = JSON.parse(resA.body).data.id;

      const resB = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: 'Bearer token-alice' },
        payload: { title: 'Task B (Write Unit Tests)', status: 'planned' },
      });
      taskB = JSON.parse(resB.body).data.id;

      const resC = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: 'Bearer token-alice' },
        payload: { title: 'Task C (Configure CI)', status: 'inbox' },
      });
      taskC = JSON.parse(resC.body).data.id;
    });

    it('rejects self-dependency (Task A depends on Task A)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${taskA}/dependencies`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { depends_on_task_id: taskA },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain('A task cannot depend on itself');
    });

    it('creates dependency: Task A depends on Task B and reflects blocked state', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${taskA}/dependencies`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { depends_on_task_id: taskB },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      dependencyABId = body.data.id;
      expect(body.data.task_id).toBe(taskA);
      expect(body.data.depends_on_task_id).toBe(taskB);

      // Verify Task A detail is now BLOCKED
      const taskADetail = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/${taskA}`,
        headers: { authorization: 'Bearer token-alice' },
      });
      const aData = JSON.parse(taskADetail.body).data;
      expect(aData.is_blocked).toBe(true);
      expect(aData.blocking_task_count).toBe(1);
      expect(aData.blocked_by).toHaveLength(1);
      expect(aData.blocked_by[0].id).toBe(taskB);
      expect(aData.status).toBe('planned'); // Status itself was NOT overwritten!
    });

    it('rejects duplicate dependency pair (Task A depends on Task B)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${taskA}/dependencies`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { depends_on_task_id: taskB },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain('already exists');
    });

    it('creates second dependency: Task B depends on Task C', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${taskB}/dependencies`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { depends_on_task_id: taskC },
      });

      expect(res.statusCode).toBe(201);
    });

    it('detects and rejects circular dependency: Task C depends on Task A (A -> B -> C -> A cycle)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${taskC}/dependencies`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { depends_on_task_id: taskA },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain('Circular dependency detected');
    });

    it('unblocks Task A when its prerequisites are completed', async () => {
      // Complete Task B
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${taskB}`,
        headers: { authorization: 'Bearer token-alice' },
        payload: { status: 'completed' },
      });

      // Task A should now be unblocked
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/${taskA}`,
        headers: { authorization: 'Bearer token-alice' },
      });
      const data = JSON.parse(res.body).data;
      expect(data.is_blocked).toBe(false);
      expect(data.blocking_task_count).toBe(0);
    });

    it('removes dependency via DELETE endpoint and verifies', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/tasks/${taskA}/dependencies/${dependencyABId}`,
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(res.statusCode).toBe(200);

      // Verify listDependencies is empty for Task A
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/${taskA}/dependencies`,
        headers: { authorization: 'Bearer token-alice' },
      });
      const listData = JSON.parse(listRes.body).data;
      expect(listData).toHaveLength(0);
    });
  });

  describe('6. Listing, Pagination, Filters & Search', () => {
    it('supports pagination, filters, and title search', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/tasks?page=1&pageSize=10&search=Election',
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(listRes.statusCode).toBe(200);
      const body = JSON.parse(listRes.body);
      expect(body.success).toBe(true);
      expect(body.pagination.total).toBe(1);
      expect(body.data[0].title).toBe('Implement Leader Election');
    });
  });

  describe('7. Multi-Tenant User Isolation', () => {
    let aliceTaskId: string;

    it('prevents Bob from viewing, updating, or deleting Alice tasks', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: 'Bearer token-alice' },
        payload: { title: 'Alice Secret Task' },
      });
      aliceTaskId = JSON.parse(createRes.body).data.id;

      // Bob tries to GET Alice task
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/tasks/${aliceTaskId}`,
        headers: { authorization: 'Bearer token-bob' },
      });
      expect(getRes.statusCode).toBe(404);

      // Bob tries to PATCH Alice task
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${aliceTaskId}`,
        headers: { authorization: 'Bearer token-bob' },
        payload: { title: 'Bob Hijacked Task' },
      });
      expect(patchRes.statusCode).toBe(404);

      // Bob tries to DELETE Alice task
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/tasks/${aliceTaskId}`,
        headers: { authorization: 'Bearer token-bob' },
      });
      expect(delRes.statusCode).toBe(404);
    });

    it('prevents Bob from creating dependency on Alice task', async () => {
      const bobTaskRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        headers: { authorization: 'Bearer token-bob' },
        payload: { title: 'Bob Own Task' },
      });
      const bobTaskId = JSON.parse(bobTaskRes.body).data.id;

      // Bob tries to depend on Alice task
      const depRes = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${bobTaskId}/dependencies`,
        headers: { authorization: 'Bearer token-bob' },
        payload: { depends_on_task_id: aliceTaskId },
      });

      expect(depRes.statusCode).toBe(400);
      const body = JSON.parse(depRes.body);
      expect(body.error.message).toContain('Prerequisite task not found or does not belong to the user');
    });
  });
});
