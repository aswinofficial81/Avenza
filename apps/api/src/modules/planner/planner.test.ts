import fastify from 'fastify';
import { describe, expect, it, beforeEach } from 'vitest';
import type { IClerkClient } from '../../auth/clerk/clerk.client';
import { AuthService } from '../../auth/auth.service';
import { createRequireAuthMiddleware } from '../../auth/auth.middleware';
import { InMemoryProfileRepository } from '../identity/profile.repository';
import { ProfileService } from '../identity/profile.service';
import { InMemoryTasksRepository } from '../tasks/tasks.repository';
import { InMemoryPreferencesRepository } from '../preferences/preferences.repository';
import { InMemoryIntegrationsRepository } from '../integrations/integrations.repository.impl';
import { InMemoryPlannerRepository } from './planner.repository';
import { PlannerService } from './planner.service';
import { PlannerController } from './planner.controller';
import { createPlannerRoutes } from './planner.routes';
import { registerErrorHandler } from '../../plugins/error-handler';

describe('Planner API Endpoints (/api/v1/planner)', () => {
  const mockClerkClient: IClerkClient = {
    async verifyBearerToken(token: string) {
      if (token === 'token-alice') {
        return {
          clerkUserId: 'clerk_alice_planner',
          displayName: 'Alice Planner',
        };
      }
      if (token === 'token-bob') {
        return {
          clerkUserId: 'clerk_bob_planner',
          displayName: 'Bob Planner',
        };
      }
      return null;
    },
  };

  const authService = new AuthService(mockClerkClient);
  let profileRepository: InMemoryProfileRepository;
  let profileService: ProfileService;
  let preferencesRepository: InMemoryPreferencesRepository;
  let tasksRepository: InMemoryTasksRepository;
  let integrationsRepository: InMemoryIntegrationsRepository;
  let plannerRepository: InMemoryPlannerRepository;
  let plannerService: PlannerService;
  let plannerController: PlannerController;
  let app: ReturnType<typeof fastify>;

  let aliceUserId: string;
  let bobUserId: string;

  beforeEach(async () => {
    profileRepository = new InMemoryProfileRepository();
    profileService = new ProfileService(profileRepository);
    preferencesRepository = new InMemoryPreferencesRepository();
    tasksRepository = new InMemoryTasksRepository();
    integrationsRepository = new InMemoryIntegrationsRepository();
    plannerRepository = new InMemoryPlannerRepository(tasksRepository);

    plannerService = new PlannerService(
      tasksRepository,
      preferencesRepository,
      integrationsRepository,
      plannerRepository
    );

    plannerController = new PlannerController(plannerService);

    app = fastify();
    registerErrorHandler(app);

    const requireAuth = createRequireAuthMiddleware(authService, profileService);
    app.register(createPlannerRoutes({ requireAuthMiddleware: requireAuth, plannerController }));
    await app.ready();

    // Create test profiles
    const alice = await profileService.getOrCreateProfile('clerk_alice_planner', { displayName: 'Alice' });
    aliceUserId = alice.id;

    const bob = await profileService.getOrCreateProfile('clerk_bob_planner', { displayName: 'Bob' });
    bobUserId = bob.id;

    // Set Alice preferences (09:00 - 17:00, 120 target, 240 max, America/New_York)
    const pref = await preferencesRepository.ensurePreferences(aliceUserId, 'America/New_York');
    preferencesRepository.setPreferences({
      ...pref,
      preferred_study_start: '09:00:00',
      preferred_study_end: '17:00:00',
      daily_target_minutes: 120,
      max_daily_study_minutes: 240,
    });
  });

  describe('POST /api/v1/planner/propose', () => {
    it('requires authentication (401 when token missing)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/propose',
        payload: { date: '2026-10-18' },
      });

      expect(response.statusCode).toBe(401);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('validates request payload (400 on malformed date)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/propose',
        headers: { authorization: 'Bearer token-alice' },
        payload: { date: 'invalid-date' },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('propose is strictly read-only and leaves tasks unmodified in the repository', async () => {
      const task = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Raft consensus review',
        status: 'planned',
        priority: 'high',
        task_type: 'project',
        estimated_minutes: 60,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/propose',
        headers: { authorization: 'Bearer token-alice' },
        payload: { date: '2026-10-18' },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(json.data.proposedBlocks.length).toBe(1);

      // Verify task in database is STILL planned with null scheduled times (READ-ONLY INVARIANT)
      const persisted = await tasksRepository.findTaskById(task.id, aliceUserId);
      expect(persisted?.status).toBe('planned');
      expect(persisted?.scheduled_start).toBeNull();
      expect(persisted?.scheduled_end).toBeNull();
    });

    it('rejects proposal when user has not configured study window preferences (422 CONFIGURATION_REQUIRED)', async () => {
      // Bob has null study window preferences
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/propose',
        headers: { authorization: 'Bearer token-bob' },
        payload: { date: '2026-10-18' },
      });

      expect(response.statusCode).toBe(422);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CONFIGURATION_REQUIRED');
      expect(json.error.message).toContain('Study window preferences');
    });

    it('rejects proposal when user has invalid study window start >= end (400 INVALID_STUDY_WINDOW)', async () => {
      // Set Alice preferences to invalid study window
      const alicePref = await preferencesRepository.ensurePreferences(aliceUserId);
      preferencesRepository.setPreferences({
        ...alicePref,
        preferred_study_start: '18:00:00',
        preferred_study_end: '09:00:00',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/propose',
        headers: { authorization: 'Bearer token-alice' },
        payload: { date: '2026-10-18' },
      });

      // Restore Alice preferences
      preferencesRepository.setPreferences({
        ...alicePref,
        preferred_study_start: '09:00:00',
        preferred_study_end: '17:00:00',
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_STUDY_WINDOW');
    });

    it('enforces cross-tenant isolation (Alice cannot see or propose Bob tasks)', async () => {
      // Bob's task
      await tasksRepository.createTask({
        user_id: bobUserId,
        title: 'Secret Bob Task',
        status: 'planned',
        priority: 'critical',
        task_type: 'project',
        estimated_minutes: 60,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/propose',
        headers: { authorization: 'Bearer token-alice' },
        payload: { date: '2026-10-18' },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.data.proposedBlocks.length).toBe(0);
      expect(json.data.unscheduledTasks.length).toBe(0);
    });
  });

  describe('POST /api/v1/planner/apply', () => {
    it('requires authentication (401 when token missing)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/apply',
        payload: {
          targetDate: '2026-10-18',
          blocks: [
            {
              taskId: '00000000-0000-0000-0000-000000000001',
              scheduledStart: '2026-10-18T13:00:00Z',
              scheduledEnd: '2026-10-18T14:00:00Z',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('rejects cross-tenant task ID in payload (404/rejection)', async () => {
      const bobTask = await tasksRepository.createTask({
        user_id: bobUserId,
        title: 'Bob Private Task',
        status: 'planned',
        priority: 'high',
        task_type: 'project',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/apply',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          targetDate: '2026-10-18',
          blocks: [
            {
              taskId: bobTask.id,
              scheduledStart: '2026-10-18T13:00:00Z',
              scheduledEnd: '2026-10-18T14:00:00Z',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(404);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('rejects stale proposals where task has been modified (409 STALE_PROPOSAL)', async () => {
      const aliceTask = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Concurrent Test Task',
        status: 'planned',
        priority: 'high',
        task_type: 'project',
        estimated_minutes: 60,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/apply',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          targetDate: '2026-10-18',
          blocks: [
            {
              taskId: aliceTask.id,
              scheduledStart: '2026-10-18T13:00:00Z',
              scheduledEnd: '2026-10-18T14:00:00Z',
              expectedUpdatedAt: '2020-01-01T00:00:00Z', // Deliberately stale timestamp
            },
          ],
        },
      });

      expect(response.statusCode).toBe(409);
      const json = JSON.parse(response.body);
      expect(json.error.code).toBe('STALE_PROPOSAL');
    });

    it('rejects overlapping blocks within the apply payload (409 SCHEDULE_CONFLICT)', async () => {
      const task1 = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Task 1',
        status: 'planned',
        priority: 'high',
        task_type: 'project',
        estimated_minutes: 60,
      });

      const task2 = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Task 2',
        status: 'planned',
        priority: 'medium',
        task_type: 'study',
        estimated_minutes: 60,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/apply',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          targetDate: '2026-10-18',
          blocks: [
            {
              taskId: task1.id,
              scheduledStart: '2026-10-18T13:00:00Z',
              scheduledEnd: '2026-10-18T14:00:00Z',
            },
            {
              taskId: task2.id,
              scheduledStart: '2026-10-18T13:30:00Z', // Overlaps task 1
              scheduledEnd: '2026-10-18T14:30:00Z',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(409);
      const json = JSON.parse(response.body);
      expect(json.error.code).toBe('SCHEDULE_CONFLICT');
    });

    it('successfully applies reviewed schedule and writes scheduling fields', async () => {
      const task = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Task to Schedule',
        status: 'planned',
        priority: 'high',
        task_type: 'project',
        estimated_minutes: 60,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/apply',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          targetDate: '2026-10-18',
          blocks: [
            {
              taskId: task.id,
              scheduledStart: '2026-10-18T13:00:00Z',
              scheduledEnd: '2026-10-18T14:00:00Z',
              expectedUpdatedAt: task.updated_at,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(json.data.appliedCount).toBe(1);
      expect(json.data.taskIds).toContain(task.id);

      // Verify persisted state
      const updated = await tasksRepository.findTaskById(task.id, aliceUserId);
      expect(updated?.status).toBe('scheduled');
      expect(updated?.scheduled_start).toBe('2026-10-18T13:00:00Z');
      expect(updated?.scheduled_end).toBe('2026-10-18T14:00:00Z');
    });

    it('rejects apply when user has not configured study window preferences (422 CONFIGURATION_REQUIRED)', async () => {
      const bobTask = await tasksRepository.createTask({
        user_id: bobUserId,
        title: 'Bob Task',
        status: 'planned',
        priority: 'high',
        task_type: 'project',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/apply',
        headers: { authorization: 'Bearer token-bob' },
        payload: {
          targetDate: '2026-10-18',
          blocks: [
            {
              taskId: bobTask.id,
              scheduledStart: '2026-10-18T13:00:00Z',
              scheduledEnd: '2026-10-18T14:00:00Z',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(422);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CONFIGURATION_REQUIRED');
    });

    it('rejects apply when proposed block is outside configured study window (400 BLOCK_OUTSIDE_STUDY_WINDOW)', async () => {
      const task = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Late Night Task',
        status: 'planned',
        priority: 'high',
        task_type: 'project',
      });

      // Alice study window is 09:00 - 17:00 America/New_York (13:00 - 21:00 UTC)
      // Sending block at 22:00 - 23:00 UTC (18:00 - 19:00 local, outside window)
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/apply',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          targetDate: '2026-10-18',
          blocks: [
            {
              taskId: task.id,
              scheduledStart: '2026-10-18T22:00:00Z',
              scheduledEnd: '2026-10-18T23:00:00Z',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('BLOCK_OUTSIDE_STUDY_WINDOW');
    });

    it('rejects apply when total applied duration exceeds max daily study capacity (400 CAPACITY_EXCEEDED)', async () => {
      // Alice has max_daily_study_minutes = 240 (4 hours)
      const task = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Marathon Task',
        status: 'planned',
        priority: 'high',
        task_type: 'project',
        estimated_minutes: 300,
      });

      // 5-hour block (300 minutes > 240 max)
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/apply',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          targetDate: '2026-10-18',
          blocks: [
            {
              taskId: task.id,
              scheduledStart: '2026-10-18T13:00:00Z',
              scheduledEnd: '2026-10-18T18:00:00Z', // 5 hours
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CAPACITY_EXCEEDED');
    });

    it('rejects apply when task is currently in_progress (400 TASK_INELIGIBLE)', async () => {
      const task = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Currently Active Task',
        status: 'in_progress',
        priority: 'high',
        task_type: 'project',
        estimated_minutes: 60,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/apply',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          targetDate: '2026-10-18',
          blocks: [
            {
              taskId: task.id,
              scheduledStart: '2026-10-18T13:00:00Z',
              scheduledEnd: '2026-10-18T14:00:00Z',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('TASK_INELIGIBLE');
    });

    it('rejects apply when task is blocked by incomplete prerequisite (400 TASK_BLOCKED)', async () => {
      const prereq = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Prerequisite Task',
        status: 'inbox',
        priority: 'high',
        task_type: 'project',
      });

      const dependent = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Dependent Task',
        status: 'planned',
        priority: 'high',
        task_type: 'project',
        estimated_minutes: 60,
      });

      await tasksRepository.createDependency(
        {
          task_id: dependent.id,
          depends_on_task_id: prereq.id,
        },
        aliceUserId
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/apply',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          targetDate: '2026-10-18',
          blocks: [
            {
              taskId: dependent.id,
              scheduledStart: '2026-10-18T13:00:00Z',
              scheduledEnd: '2026-10-18T14:00:00Z',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('TASK_BLOCKED');
    });

    it('rejects apply when block has non-positive or reversed interval (400 BAD_REQUEST)', async () => {
      const task = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Reversed Block Task',
        status: 'planned',
        priority: 'high',
        task_type: 'project',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/apply',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          targetDate: '2026-10-18',
          blocks: [
            {
              taskId: task.id,
              scheduledStart: '2026-10-18T14:00:00Z',
              scheduledEnd: '2026-10-18T13:00:00Z', // Reversed! End < Start
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('scheduledStart must be strictly before scheduledEnd');
    });

    it('rejects apply when client tampers with block duration (400 INVALID_DURATION) and preserves persisted state', async () => {
      // Task with explicit estimate of 45 minutes
      const task = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Tamper Target Task',
        status: 'planned',
        priority: 'high',
        task_type: 'study',
        estimated_minutes: 45,
      });

      const beforeTask = await tasksRepository.findTaskById(task.id, aliceUserId);
      expect(beforeTask?.status).toBe('planned');
      expect(beforeTask?.scheduled_start).toBeNull();
      expect(beforeTask?.scheduled_end).toBeNull();

      // Client tampers with interval to inflate duration to 90 minutes inside study window (13:00 - 14:30)
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/apply',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          targetDate: '2026-10-18',
          blocks: [
            {
              taskId: task.id,
              scheduledStart: '2026-10-18T13:00:00Z',
              scheduledEnd: '2026-10-18T14:30:00Z', // 90 min != 45 min estimate
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_DURATION');
      expect(json.error.message).toContain('does not match task estimate');

      // Verify before/after persistence: task state is entirely unchanged
      const afterTask = await tasksRepository.findTaskById(task.id, aliceUserId);
      expect(afterTask?.status).toBe('planned');
      expect(afterTask?.scheduled_start).toBeNull();
      expect(afterTask?.scheduled_end).toBeNull();
      expect(afterTask?.updated_at).toBe(beforeTask?.updated_at);
    });

    it('rejects apply when client tampers with unestimated task canonical duration (30m) and preserves state', async () => {
      // Task with no estimate (provisional default: 30m)
      const task = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Unestimated Tamper Task',
        status: 'planned',
        priority: 'medium',
        task_type: 'project',
      });

      // Client submits 60m block instead of canonical 30m
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/apply',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          targetDate: '2026-10-18',
          blocks: [
            {
              taskId: task.id,
              scheduledStart: '2026-10-18T13:00:00Z',
              scheduledEnd: '2026-10-18T14:00:00Z', // 60 min != 30 min default
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_DURATION');

      const afterTask = await tasksRepository.findTaskById(task.id, aliceUserId);
      expect(afterTask?.status).toBe('planned');
      expect(afterTask?.scheduled_start).toBeNull();
    });

    it('rejects apply when block timestamps contain non-zero seconds (400 VALIDATION_ERROR) and preserves state', async () => {
      const task = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Seconds Alignment Task',
        status: 'planned',
        priority: 'high',
        task_type: 'study',
        estimated_minutes: 60,
      });

      const beforeTask = await tasksRepository.findTaskById(task.id, aliceUserId);

      // Start contains 15 seconds: 13:00:15Z
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/apply',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          targetDate: '2026-10-18',
          blocks: [
            {
              taskId: task.id,
              scheduledStart: '2026-10-18T13:00:15Z',
              scheduledEnd: '2026-10-18T14:00:15Z',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');

      // Verify before/after persistence is unchanged
      const afterTask = await tasksRepository.findTaskById(task.id, aliceUserId);
      expect(afterTask?.status).toBe('planned');
      expect(afterTask?.scheduled_start).toBeNull();
      expect(afterTask?.scheduled_end).toBeNull();
      expect(afterTask?.updated_at).toBe(beforeTask?.updated_at);
    });

    it('rejects apply when block timestamps contain non-zero milliseconds (400 VALIDATION_ERROR) and preserves state', async () => {
      const task = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Milliseconds Alignment Task',
        status: 'planned',
        priority: 'high',
        task_type: 'study',
        estimated_minutes: 60,
      });

      const beforeTask = await tasksRepository.findTaskById(task.id, aliceUserId);

      // End contains 500 milliseconds: 14:00:00.500Z
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/apply',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          targetDate: '2026-10-18',
          blocks: [
            {
              taskId: task.id,
              scheduledStart: '2026-10-18T13:00:00.000Z',
              scheduledEnd: '2026-10-18T14:00:00.500Z',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');

      const afterTask = await tasksRepository.findTaskById(task.id, aliceUserId);
      expect(afterTask?.status).toBe('planned');
      expect(afterTask?.scheduled_start).toBeNull();
      expect(afterTask?.updated_at).toBe(beforeTask?.updated_at);
    });

    it('rejects apply when block timestamps contain fractional seconds (400 VALIDATION_ERROR) and preserves state', async () => {
      const task = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Microseconds Alignment Task',
        status: 'planned',
        priority: 'high',
        task_type: 'study',
        estimated_minutes: 60,
      });

      const beforeTask = await tasksRepository.findTaskById(task.id, aliceUserId);

      // Start contains fractional seconds: 13:00:00.000123Z
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/apply',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          targetDate: '2026-10-18',
          blocks: [
            {
              taskId: task.id,
              scheduledStart: '2026-10-18T13:00:00.000123Z',
              scheduledEnd: '2026-10-18T14:00:00.000000Z',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');

      const afterTask = await tasksRepository.findTaskById(task.id, aliceUserId);
      expect(afterTask?.status).toBe('planned');
      expect(afterTask?.scheduled_start).toBeNull();
      expect(afterTask?.updated_at).toBe(beforeTask?.updated_at);
    });

    it('successfully applies valid minute-aligned schedule with .000Z ISO strings', async () => {
      const task = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Valid Aligned Task',
        status: 'planned',
        priority: 'high',
        task_type: 'study',
        estimated_minutes: 60,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/planner/apply',
        headers: { authorization: 'Bearer token-alice' },
        payload: {
          targetDate: '2026-10-18',
          blocks: [
            {
              taskId: task.id,
              scheduledStart: '2026-10-18T13:00:00.000Z',
              scheduledEnd: '2026-10-18T14:00:00.000Z',
              expectedUpdatedAt: task.updated_at,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(json.data.appliedCount).toBe(1);

      const afterTask = await tasksRepository.findTaskById(task.id, aliceUserId);
      expect(afterTask?.status).toBe('scheduled');
      expect(afterTask?.scheduled_start).toBe('2026-10-18T13:00:00.000Z');
      expect(afterTask?.scheduled_end).toBe('2026-10-18T14:00:00.000Z');
    });
  });
});
