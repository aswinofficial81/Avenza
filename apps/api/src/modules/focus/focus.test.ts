import { describe, it, expect, beforeEach } from 'vitest';
import fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import type { TaskRow, TaskDependencyRow } from '@avenza/shared';
import { InMemoryFocusRepository } from './focus.repository';
import { FocusService } from './focus.service';
import { FocusController } from './focus.controller';
import { createFocusRoutes } from './focus.routes';
import { InMemoryTasksRepository } from '../tasks/tasks.repository';
import { InMemoryGoalsRepository } from '../goals/goals.repository';

describe('Focus Sessions Domain & API', () => {
  let focusRepo: InMemoryFocusRepository;
  let tasksRepo: InMemoryTasksRepository;
  let goalsRepo: InMemoryGoalsRepository;
  let service: FocusService;
  let controller: FocusController;
  let app: FastifyInstance;

  const testUserId = '11111111-1111-1111-1111-111111111111';
  const otherUserId = '22222222-2222-2222-2222-222222222222';

  const sampleTask: TaskRow = {
    id: '33333333-3333-3333-3333-333333333333',
    user_id: testUserId,
    title: 'Build JWT Authentication',
    description: 'Implement token validation middleware',
    status: 'planned',
    priority: 'high',
    task_type: 'project',
    goal_id: null,
    milestone_id: null,
    project_id: null,
    project_milestone_id: null,
    estimated_minutes: 60,
    actual_minutes: null,
    due_at: null,
    scheduled_start: null,
    scheduled_end: null,
    completed_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const blockedTask: TaskRow = {
    id: '44444444-4444-4444-4444-444444444444',
    user_id: testUserId,
    title: 'Deploy to Production',
    description: null,
    status: 'planned',
    priority: 'critical',
    task_type: 'project',
    goal_id: null,
    milestone_id: null,
    project_id: null,
    project_milestone_id: null,
    estimated_minutes: 30,
    actual_minutes: null,
    due_at: null,
    scheduled_start: null,
    scheduled_end: null,
    completed_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const prerequisiteTask: TaskRow = {
    id: '55555555-5555-5555-5555-555555555555',
    user_id: testUserId,
    title: 'Setup Database',
    description: null,
    status: 'in_progress', // Not completed -> blocks task 4444
    priority: 'high',
    task_type: 'project',
    goal_id: null,
    milestone_id: null,
    project_id: null,
    project_milestone_id: null,
    estimated_minutes: 30,
    actual_minutes: null,
    due_at: null,
    scheduled_start: null,
    scheduled_end: null,
    completed_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const dependencyRow: TaskDependencyRow = {
    id: '66666666-6666-6666-6666-666666666666',
    task_id: blockedTask.id,
    depends_on_task_id: prerequisiteTask.id,
    created_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    focusRepo = new InMemoryFocusRepository();
    tasksRepo = new InMemoryTasksRepository(
      [sampleTask, blockedTask, prerequisiteTask],
      [dependencyRow]
    );
    goalsRepo = new InMemoryGoalsRepository();

    service = new FocusService(focusRepo, tasksRepo, goalsRepo);
    controller = new FocusController(service);

    app = fastify();

    // Mock auth preHandler injecting testUserId
    const mockAuth = async (req: FastifyRequest) => {
      const augmentedReq = req as unknown as {
        profile: { id: string; clerk_user_id: string };
        auth: { profileId: string; clerkUserId: string };
      };
      augmentedReq.profile = { id: testUserId, clerk_user_id: 'clerk_test_123' };
      augmentedReq.auth = { profileId: testUserId, clerkUserId: 'clerk_test_123' };
    };

    const routes = createFocusRoutes({
      requireAuthMiddleware: mockAuth,
      focusController: controller,
    });

    await app.register(routes);
    await app.ready();
  });

  describe('Focus Service Unit & Invariant Tests', () => {
    it('starts an active focus session and transitions task to in_progress', async () => {
      const session = await service.startSession(testUserId, {
        taskId: sampleTask.id,
        sessionType: 'deep_work',
        plannedMinutes: 45,
        notes: 'Building authentication middleware',
      });

      expect(session.id).toBeDefined();
      expect(session.user_id).toBe(testUserId);
      expect(session.task_id).toBe(sampleTask.id);
      expect(session.status).toBe('active');
      expect(session.planned_minutes).toBe(45);
      expect(session.actual_minutes).toBeNull();
      expect(session.ended_at).toBeNull();
      expect(session.task?.title).toBe('Build JWT Authentication');

      // Check task status advanced from 'planned' -> 'in_progress'
      const updatedTask = await tasksRepo.findTaskById(sampleTask.id, testUserId);
      expect(updatedTask?.status).toBe('in_progress');
    });

    it('enforces single active session invariant: rejects starting second active session', async () => {
      await service.startSession(testUserId, {
        taskId: sampleTask.id,
        plannedMinutes: 25,
      });

      // Attempt second session
      await expect(
        service.startSession(testUserId, {
          taskId: sampleTask.id,
          plannedMinutes: 30,
        })
      ).rejects.toThrow(/already have an active focus session/i);
    });

    it('rejects starting focus on a blocked task', async () => {
      await expect(
        service.startSession(testUserId, {
          taskId: blockedTask.id,
          plannedMinutes: 30,
        })
      ).rejects.toThrow(/cannot start focus on a blocked task/i);
    });

    it('rejects starting focus on another user task', async () => {
      await expect(
        service.startSession(otherUserId, {
          taskId: sampleTask.id,
          plannedMinutes: 30,
        })
      ).rejects.toThrow(/task not found/i);
    });

    it('completes active session with server duration calculation and enforces 1-min minimum', async () => {
      const session = await service.startSession(testUserId, {
        taskId: sampleTask.id,
        plannedMinutes: 45,
      });

      // Complete immediately (< 1 min elapsed)
      const completedQuick = await service.completeSession(session.id, testUserId);
      expect(completedQuick.status).toBe('completed');
      expect(completedQuick.ended_at).toBeDefined();
      expect(completedQuick.actual_minutes).toBe(0); // < 1 min yields 0 actual minutes

      // Task status must NOT be automatically completed
      const task = await tasksRepo.findTaskById(sampleTask.id, testUserId);
      expect(task?.status).toBe('in_progress');
    });

    it('calculates duration correctly for sessions >= 1 minute', async () => {
      // Seed a session started 25 minutes ago
      const twentyFiveMinsAgo = new Date(Date.now() - 25 * 60_000).toISOString();
      const created = await focusRepo.createSession({
        user_id: testUserId,
        task_id: sampleTask.id,
        session_type: 'pomodoro',
        status: 'active',
        started_at: twentyFiveMinsAgo,
        planned_minutes: 25,
      });

      const completed = await service.completeSession(created.id, testUserId, 'Finished timer');
      expect(completed.status).toBe('completed');
      expect(completed.actual_minutes).toBe(25);
      expect(completed.planned_minutes).toBe(25);
      expect(completed.notes).toBe('Finished timer');
    });

    it('cancels active session with actual_minutes set to 0', async () => {
      const session = await service.startSession(testUserId, {
        taskId: sampleTask.id,
        plannedMinutes: 30,
      });

      const cancelled = await service.cancelSession(session.id, testUserId, 'Interrupted');
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.actual_minutes).toBe(0);
      expect(cancelled.notes).toBe('Interrupted');

      // Now user can start a new active session
      const newSession = await service.startSession(testUserId, {
        taskId: sampleTask.id,
        plannedMinutes: 20,
      });
      expect(newSession.status).toBe('active');
    });

    it('rejects completing or cancelling an already completed session', async () => {
      const session = await service.startSession(testUserId, {
        taskId: sampleTask.id,
        plannedMinutes: 30,
      });

      await service.completeSession(session.id, testUserId);

      await expect(service.completeSession(session.id, testUserId)).rejects.toThrow(
        /cannot complete focus session with status 'completed'/i
      );

      await expect(service.cancelSession(session.id, testUserId)).rejects.toThrow(
        /cannot cancel focus session with status 'completed'/i
      );
    });

    it('retrieves active session for user or returns null when idle', async () => {
      const noneActive = await service.getActiveSession(testUserId);
      expect(noneActive).toBeNull();

      await service.startSession(testUserId, {
        taskId: sampleTask.id,
        plannedMinutes: 30,
      });

      const active = await service.getActiveSession(testUserId);
      expect(active).not.toBeNull();
      expect(active?.task_id).toBe(sampleTask.id);
      expect(active?.task?.title).toBe('Build JWT Authentication');
    });

    it('enforces tenant isolation: user B cannot access or modify user A session', async () => {
      const session = await service.startSession(testUserId, {
        taskId: sampleTask.id,
        plannedMinutes: 30,
      });

      const lookupOther = await service.getSessionById(session.id, otherUserId);
      expect(lookupOther).toBeNull();

      await expect(service.completeSession(session.id, otherUserId)).rejects.toThrow(
        /focus session not found/i
      );
      await expect(service.cancelSession(session.id, otherUserId)).rejects.toThrow(
        /focus session not found/i
      );
    });
  });

  describe('Focus HTTP API Endpoints', () => {
    it('POST /api/v1/focus-sessions - starts a session successfully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/focus-sessions',
        payload: {
          taskId: sampleTask.id,
          sessionType: 'focus',
          plannedMinutes: 30,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.status).toBe('active');
      expect(body.data.started_at).toBeDefined();
    });

    it('GET /api/v1/focus-sessions/active - returns active session', async () => {
      await service.startSession(testUserId, {
        taskId: sampleTask.id,
        plannedMinutes: 25,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/focus-sessions/active',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('active');
      expect(body.data.task_id).toBe(sampleTask.id);
    });

    it('POST /api/v1/focus-sessions/:id/complete - completes active session', async () => {
      const session = await service.startSession(testUserId, {
        taskId: sampleTask.id,
        plannedMinutes: 25,
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/focus-sessions/${session.id}/complete`,
        payload: {
          notes: 'Completed session successfully',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('completed');
      expect(body.data.ended_at).toBeDefined();
    });

    it('POST /api/v1/focus-sessions/:id/cancel - cancels active session', async () => {
      const session = await service.startSession(testUserId, {
        taskId: sampleTask.id,
        plannedMinutes: 25,
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/focus-sessions/${session.id}/cancel`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('cancelled');
      expect(body.data.actual_minutes).toBe(0);
    });

    it('GET /api/v1/focus-sessions - lists focus history with pagination', async () => {
      await service.startSession(testUserId, {
        taskId: sampleTask.id,
        plannedMinutes: 25,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/focus-sessions?page=1&limit=10',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });
  });
});
