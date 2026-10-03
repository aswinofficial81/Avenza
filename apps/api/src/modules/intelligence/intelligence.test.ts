import fastify from 'fastify';
import { describe, expect, it, beforeEach } from 'vitest';
import type { IClerkClient } from '../../auth/clerk/clerk.client';
import { AuthService } from '../../auth/auth.service';
import { createRequireAuthMiddleware } from '../../auth/auth.middleware';
import { InMemoryProfileRepository } from '../identity/profile.repository';
import { ProfileService } from '../identity/profile.service';
import { InMemoryGoalsRepository } from '../goals/goals.repository';
import { InMemoryTasksRepository } from '../tasks/tasks.repository';
import { InMemoryPreferencesRepository } from '../preferences/preferences.repository';
import { InMemoryFocusRepository } from '../focus/focus.repository';
import { InMemoryEvidenceRepository } from '../evidence/evidence.repository';
import { IntelligenceContextBuilder } from './context/context-builder';
import { CandidateGenerator } from './candidates/candidate-generator';
import { CandidateScorer } from './scoring/candidate-scoring';
import { IntelligenceService } from './intelligence.service';
import { IntelligenceController } from './intelligence.controller';
import { createIntelligenceRoutes } from './intelligence.routes';
import { registerErrorHandler } from '../../plugins/error-handler';
import type { NextActionResponseData } from '@avenza/shared';

describe('Intelligence Engine & Next Best Action (/api/v1/intelligence/next-action)', () => {
  const mockClerkClient: IClerkClient = {
    async verifyBearerToken(token: string) {
      if (token === 'token-alice') {
        return { clerkUserId: 'clerk_alice_id', displayName: 'Alice' };
      }
      if (token === 'token-bob') {
        return { clerkUserId: 'clerk_bob_id', displayName: 'Bob' };
      }
      return null;
    },
  };

  const authService = new AuthService(mockClerkClient);
  let profileRepository: InMemoryProfileRepository;
  let profileService: ProfileService;
  let preferencesRepository: InMemoryPreferencesRepository;
  let goalsRepository: InMemoryGoalsRepository;
  let tasksRepository: InMemoryTasksRepository;
  let focusRepository: InMemoryFocusRepository;
  let evidenceRepository: InMemoryEvidenceRepository;

  let intelligenceService: IntelligenceService;
  let intelligenceController: IntelligenceController;
  let app: ReturnType<typeof fastify>;

  let aliceUserId: string;
  let bobUserId: string;

  beforeEach(async () => {
    profileRepository = new InMemoryProfileRepository();
    profileService = new ProfileService(profileRepository);
    preferencesRepository = new InMemoryPreferencesRepository();
    goalsRepository = new InMemoryGoalsRepository();
    tasksRepository = new InMemoryTasksRepository();
    focusRepository = new InMemoryFocusRepository();
    evidenceRepository = new InMemoryEvidenceRepository();

    const contextBuilder = new IntelligenceContextBuilder(
      tasksRepository,
      goalsRepository,
      focusRepository,
      evidenceRepository,
      preferencesRepository,
      profileRepository
    );
    const candidateGenerator = new CandidateGenerator();
    const candidateScorer = new CandidateScorer();

    intelligenceService = new IntelligenceService(
      contextBuilder,
      candidateGenerator,
      candidateScorer
    );
    intelligenceController = new IntelligenceController(intelligenceService);

    app = fastify();
    registerErrorHandler(app);

    const requireAuth = createRequireAuthMiddleware(authService, profileService);
    app.register(
      createIntelligenceRoutes({
        requireAuthMiddleware: requireAuth,
        intelligenceController,
      })
    );

    // Create profiles for Alice and Bob
    const aliceProfile = await profileService.getOrCreateProfile('clerk_alice_id', {
      displayName: 'Alice',
    });
    aliceUserId = aliceProfile.id;

    const bobProfile = await profileService.getOrCreateProfile('clerk_bob_id', {
      displayName: 'Bob',
    });
    bobUserId = bobProfile.id;
  });

  describe('1. Authentication Gate', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/intelligence/next-action',
      });

      expect(response.statusCode).toBe(401);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects invalid tokens with 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/intelligence/next-action',
        headers: { authorization: 'Bearer invalid-token' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('2. Empty / No-Action State', () => {
    it('returns structured no-action state when user has no tasks', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/intelligence/next-action',
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);

      const data: NextActionResponseData = json.data;
      expect(data.action).toBeNull();
      expect(data.reason.code).toBe('no_actionable_tasks');
      expect(data.reason.label).toBe('Nothing urgent');
      expect(data.reason.explanation).toBe('There are no actionable tasks available right now.');
      expect(data.confidence).toBe('high');
      expect(data.scoreBreakdown).toBeNull();
    });

    it('returns no-action state when user only has completed, cancelled, or skipped tasks', async () => {
      await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Already finished task',
        status: 'completed',
        priority: 'high',
      });
      await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Cancelled task',
        status: 'cancelled',
        priority: 'critical',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/intelligence/next-action',
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.data.action).toBeNull();
      expect(json.data.reason.code).toBe('no_actionable_tasks');
    });
  });

  describe('3. Single Task Execution & Deterministic Scoring', () => {
    it('returns exactly one actionable task with confidence and breakdown', async () => {
      const task = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Build Intelligence Module',
        status: 'todo',
        priority: 'high',
        due_at: '2026-10-03T18:00:00.000Z',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/intelligence/next-action?date=2026-10-03&timezone=UTC',
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);

      const data: NextActionResponseData = json.data;
      expect(data.action).not.toBeNull();
      expect(data.action?.taskId).toBe(task.id);
      expect(data.action?.title).toBe('Build Intelligence Module');
      expect(data.action?.score).toBeGreaterThan(0);
      expect(data.reason.code).toBe('due_today');
      expect(data.confidence).toBe('high');
      expect(data.scoreBreakdown).toBeDefined();
      expect(data.scoreBreakdown?.prioritySignal).toBe(30);
      expect(data.scoreBreakdown?.urgencySignal).toBe(20);
    });
  });

  describe('4. Dependency Handling', () => {
    it('does NOT select a blocked task as the primary next action; recommends the actionable dependency', async () => {
      // Task A: prerequisite (actionable)
      const taskA = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Implement DB Schema',
        status: 'todo',
        priority: 'medium',
      });

      // Task B: depends on Task A (blocked)
      const taskB = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Run DB Migration',
        status: 'todo',
        priority: 'critical', // Even though Task B is critical, it is blocked!
      });

      await tasksRepository.createDependency(
        {
          task_id: taskB.id,
          depends_on_task_id: taskA.id,
        },
        aliceUserId
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/intelligence/next-action?date=2026-10-03&timezone=UTC',
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      const data: NextActionResponseData = json.data;

      expect(data.action).not.toBeNull();
      // Must be Task A, NOT Task B!
      expect(data.action?.taskId).toBe(taskA.id);
      expect(data.action?.title).toBe('Implement DB Schema');
      // Task A should receive dependency unblock signal
      expect(data.scoreBreakdown?.dependencySignal).toBeGreaterThan(0);
    });
  });

  describe('5. Cross-User Isolation', () => {
    it('ensures User Bob cannot see User Alice tasks or next-action recommendations', async () => {
      // Alice creates high priority task
      await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Alice Secret Project',
        status: 'todo',
        priority: 'critical',
      });

      // Bob has no tasks
      const bobResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/intelligence/next-action',
        headers: { authorization: 'Bearer token-bob' },
      });

      expect(bobResponse.statusCode).toBe(200);
      expect(bobUserId).toBeDefined();
      const bobJson = JSON.parse(bobResponse.payload);
      expect(bobJson.data.action).toBeNull();
      expect(bobJson.data.reason.code).toBe('no_actionable_tasks');

      // Alice receives her task
      const aliceResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/intelligence/next-action',
        headers: { authorization: 'Bearer token-alice' },
      });
      const aliceJson = JSON.parse(aliceResponse.payload);
      expect(aliceJson.data.action?.title).toBe('Alice Secret Project');
    });
  });

  describe('6. Query Validation', () => {
    it('rejects invalid date format with 400 Validation Error', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/intelligence/next-action?date=invalid-date-format',
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
