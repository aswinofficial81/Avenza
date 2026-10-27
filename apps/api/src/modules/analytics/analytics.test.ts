import fastify from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import type { IClerkClient } from '../../auth/clerk/clerk.client';
import { AuthService } from '../../auth/auth.service';
import { createRequireAuthMiddleware } from '../../auth/auth.middleware';
import { InMemoryProfileRepository } from '../identity/profile.repository';
import { ProfileService } from '../identity/profile.service';
import { InMemoryPreferencesRepository } from '../preferences/preferences.repository';
import { InMemoryAnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { createAnalyticsRoutes } from './analytics.routes';
import { registerErrorHandler } from '../../plugins/error-handler';
import { resolveAnalyticsDateRange } from './analytics.date-utils';

describe('Analytics Module & Diagnostics API (/api/v1/analytics/summary)', () => {
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
  let profileRepository: InMemoryProfileRepository;
  let profileService: ProfileService;
  let preferencesRepository: InMemoryPreferencesRepository;
  let analyticsRepository: InMemoryAnalyticsRepository;
  let analyticsService: AnalyticsService;
  let analyticsController: AnalyticsController;
  let app: ReturnType<typeof fastify>;

  let aliceUserId: string;
  let bobUserId: string;

  beforeEach(async () => {
    profileRepository = new InMemoryProfileRepository();
    profileService = new ProfileService(profileRepository);
    preferencesRepository = new InMemoryPreferencesRepository();
    analyticsRepository = new InMemoryAnalyticsRepository();

    analyticsService = new AnalyticsService(
      analyticsRepository,
      preferencesRepository
    );
    analyticsController = new AnalyticsController(analyticsService);

    // Setup profiles
    const aliceProfile = await profileService.getOrCreateProfile('clerk_alice_id', {
      displayName: 'Alice Architect',
      timezone: 'Asia/Kolkata',
    });
    aliceUserId = aliceProfile.id;

    const bobProfile = await profileService.getOrCreateProfile('clerk_bob_id', {
      displayName: 'Bob Builder',
      timezone: 'America/New_York',
    });
    bobUserId = bobProfile.id;

    // Set Alice's timezone to Asia/Kolkata (+05:30)
    await preferencesRepository.ensurePreferences(aliceUserId, 'Asia/Kolkata');
    // Set Bob's timezone to America/New_York (DST affected)
    await preferencesRepository.ensurePreferences(bobUserId, 'America/New_York');

    // Setup Fastify App
    app = fastify();
    registerErrorHandler(app);

    const requireAuth = createRequireAuthMiddleware(authService, profileService);
    app.register(
      createAnalyticsRoutes({
        requireAuthMiddleware: requireAuth,
        analyticsController,
      })
    );

    await app.ready();
  });

  // ----------------------------------------------------------------------------
  // 1. Authentication & Query Validation
  // ----------------------------------------------------------------------------
  it('returns 401 when no auth token is provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/summary?startDate=2026-10-01&endDate=2026-10-07',
    });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects missing or malformed query parameters with 400 VALIDATION_ERROR', async () => {
    // Missing dates
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/summary',
      headers: { authorization: 'Bearer token-alice' },
    });
    expect(res1.statusCode).toBe(400);

    // Inverted dates (startDate > endDate)
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/summary?startDate=2026-10-10&endDate=2026-10-05',
      headers: { authorization: 'Bearer token-alice' },
    });
    expect(res2.statusCode).toBe(400);

    // Invalid calendar date
    const res3 = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/summary?startDate=2026-02-30&endDate=2026-03-05',
      headers: { authorization: 'Bearer token-alice' },
    });
    expect(res3.statusCode).toBe(400);

    // Excessive range (> 366 days)
    const res4 = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/summary?startDate=2024-01-01&endDate=2026-01-01',
      headers: { authorization: 'Bearer token-alice' },
    });
    expect(res4.statusCode).toBe(400);

    // Invalid timezone must be rejected rather than silently falling back to preferences.
    const res5 = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/summary?startDate=2026-10-01&endDate=2026-10-07&timezone=Mars%2FOlympus_Mons',
      headers: { authorization: 'Bearer token-alice' },
    });
    expect(res5.statusCode).toBe(400);
    expect(res5.json().error.code).toBe('VALIDATION_ERROR');
  });

  // ----------------------------------------------------------------------------
  // 2. Truthful Empty / Zero-Demand States
  // ----------------------------------------------------------------------------
  it('returns truthful additive zeros and null completion rate when no activity exists', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/summary?startDate=2026-10-01&endDate=2026-10-07',
      headers: { authorization: 'Bearer token-alice' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    const data = body.data;

    // Period boundaries
    expect(data.period.startDate).toBe('2026-10-01');
    expect(data.period.endDate).toBe('2026-10-07');
    expect(data.period.timezone).toBe('Asia/Kolkata');

    // Execution
    expect(data.execution.completedTaskCount).toBe(0);
    expect(data.execution.openTasksDueInPeriodCount).toBe(0);
    expect(data.execution.completionRate).toBeNull();
    expect(data.execution.zeroDemand).toBe(true);
    expect(data.execution.currentOverdueCount).toBe(0);

    // Focus
    expect(data.focus.recordedFocusMinutes).toBe(0);
    expect(data.focus.completedSessionCount).toBe(0);
    expect(data.focus.cancelledSessionCount).toBe(0);
    expect(data.focus.averageSessionMinutes).toBeNull();
    expect(data.focus.dailyDistribution).toHaveLength(7);

    // DSA
    expect(data.dsa.totalAttempts).toBe(0);
    expect(data.dsa.uniqueProblemsSolved).toBe(0);
    expect(data.dsa.currentRevisionDueCount).toBe(0);

    // Growth
    expect(data.growth.newEvidenceCount).toBe(0);
    expect(data.growth.completedGoalMilestonesCount).toBe(0);
    expect(data.growth.completedProjectMilestonesCount).toBe(0);
    expect(data.growth.currentActiveGoalsCount).toBe(0);
  });

  // ----------------------------------------------------------------------------
  // 3. Execution Metrics & Completion-Rate Policy
  // ----------------------------------------------------------------------------
  it('enforces exact task completion boundaries, inbox due-date policy, and overdue snapshot separation', async () => {
    // Target period: 2026-10-05 to 2026-10-07 in UTC (for simplicity test query with timezone=UTC)
    // startUtc: 2026-10-05T00:00:00.000Z
    // endUtc:   2026-10-08T00:00:00.000Z

    // Alice Tasks:
    // Task 1: Completed within period (2026-10-06)
    analyticsRepository.tasks.push({
      id: 'task-1',
      user_id: aliceUserId,
      status: 'completed',
      priority: 'high',
      task_type: 'study',
      due_at: '2026-10-06T10:00:00.000Z',
      completed_at: '2026-10-06T11:00:00.000Z',
    });

    // Task 2: Completed BEFORE period (2026-10-04) - must NOT be counted in C
    analyticsRepository.tasks.push({
      id: 'task-2',
      user_id: aliceUserId,
      status: 'completed',
      priority: 'medium',
      task_type: 'practice',
      due_at: '2026-10-04T10:00:00.000Z',
      completed_at: '2026-10-04T11:00:00.000Z',
    });

    // Task 3: Completed on exact endUtc boundary (2026-10-08T00:00:00.000Z) - half-open interval, excluded from C!
    analyticsRepository.tasks.push({
      id: 'task-3',
      user_id: aliceUserId,
      status: 'completed',
      priority: 'low',
      task_type: 'revision',
      due_at: '2026-10-08T00:00:00.000Z',
      completed_at: '2026-10-08T00:00:00.000Z',
    });

    // Task 4: Open planned task due within period (2026-10-06) - contributes to O
    analyticsRepository.tasks.push({
      id: 'task-4',
      user_id: aliceUserId,
      status: 'planned',
      priority: 'critical',
      task_type: 'dsa',
      due_at: '2026-10-06T15:00:00.000Z',
      completed_at: null,
    });

    // Task 5: Dated Inbox task due within period (2026-10-07) - contributes to O per policy!
    analyticsRepository.tasks.push({
      id: 'task-5',
      user_id: aliceUserId,
      status: 'inbox',
      priority: 'medium',
      task_type: 'administrative',
      due_at: '2026-10-07T10:00:00.000Z',
      completed_at: null,
    });

    // Task 6: Undated Inbox task (due_at = null) - excluded from O per policy!
    analyticsRepository.tasks.push({
      id: 'task-6',
      user_id: aliceUserId,
      status: 'inbox',
      priority: 'low',
      task_type: 'custom',
      due_at: null,
      completed_at: null,
    });

    // Task 7: Open task due in the past (2026-09-01) - overdue backlog snapshot, NOT in period denominator O!
    analyticsRepository.tasks.push({
      id: 'task-7',
      user_id: aliceUserId,
      status: 'scheduled',
      priority: 'medium',
      task_type: 'project',
      due_at: '2026-09-01T10:00:00.000Z',
      completed_at: null,
    });

    // Task 8: Cancelled task due in period - excluded from O
    analyticsRepository.tasks.push({
      id: 'task-8',
      user_id: aliceUserId,
      status: 'cancelled',
      priority: 'low',
      task_type: 'personal',
      due_at: '2026-10-06T10:00:00.000Z',
      completed_at: null,
    });

    // Bob's task (cross-tenant) - must NOT appear in Alice's metrics
    analyticsRepository.tasks.push({
      id: 'task-bob',
      user_id: bobUserId,
      status: 'completed',
      priority: 'critical',
      task_type: 'career',
      due_at: '2026-10-06T10:00:00.000Z',
      completed_at: '2026-10-06T11:00:00.000Z',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/summary?startDate=2026-10-05&endDate=2026-10-07&timezone=UTC',
      headers: { authorization: 'Bearer token-alice' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const ex = body.data.execution;

    // C = 1 (task-1)
    expect(ex.completedTaskCount).toBe(1);
    expect(ex.completedByPriority.high).toBe(1);
    expect(ex.completedByType.study).toBe(1);

    // O = 2 (task-4 [planned], task-5 [dated inbox])
    // task-6 (undated inbox) is EXCLUDED.
    // task-7 (past overdue) is EXCLUDED from O.
    // task-8 (cancelled) is EXCLUDED.
    expect(ex.openTasksDueInPeriodCount).toBe(2);

    // Completion rate = 1 / (1 + 2) * 100 = 33.3%
    expect(ex.completionRate).toBe(33.3);
    expect(ex.zeroDemand).toBe(false);

    // Current overdue backlog snapshot:
    // Open tasks with due_at < asOf (2026-10-07T12:00:00Z):
    // task-7 (due 2026-09-01), task-4 (due 2026-10-06), task-5 (due 2026-10-07 10:00)
    // All 3 are currently overdue as of query instant!
    expect(ex.currentOverdueCount).toBe(3);
  });

  // ----------------------------------------------------------------------------
  // 4. Focus Metrics
  // ----------------------------------------------------------------------------
  it('correctly aggregates focus time from actual_minutes, counts sessions, and tracks cancellations', async () => {
    // Session 1: Completed in period (60 actual minutes)
    analyticsRepository.focusSessions.push({
      id: 'f-1',
      user_id: aliceUserId,
      status: 'completed',
      actual_minutes: 60,
      started_at: '2026-10-05T09:00:00.000Z',
      ended_at: '2026-10-05T10:00:00.000Z',
    });

    // Session 2: Completed in period (45 actual minutes)
    analyticsRepository.focusSessions.push({
      id: 'f-2',
      user_id: aliceUserId,
      status: 'completed',
      actual_minutes: 45,
      started_at: '2026-10-06T14:00:00.000Z',
      ended_at: '2026-10-06T14:45:00.000Z',
    });

    // Session 3: Active session (must NOT be counted as completed focus time)
    analyticsRepository.focusSessions.push({
      id: 'f-3',
      user_id: aliceUserId,
      status: 'active',
      actual_minutes: null,
      started_at: '2026-10-06T16:00:00.000Z',
      ended_at: null,
    });

    // Session 4: Cancelled session in period
    analyticsRepository.focusSessions.push({
      id: 'f-4',
      user_id: aliceUserId,
      status: 'cancelled',
      actual_minutes: 0,
      started_at: '2026-10-06T17:00:00.000Z',
      ended_at: '2026-10-06T17:10:00.000Z',
    });

    // Bob session (tenant isolation)
    analyticsRepository.focusSessions.push({
      id: 'f-bob',
      user_id: bobUserId,
      status: 'completed',
      actual_minutes: 120,
      started_at: '2026-10-05T09:00:00.000Z',
      ended_at: '2026-10-05T11:00:00.000Z',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/summary?startDate=2026-10-05&endDate=2026-10-06&timezone=UTC',
      headers: { authorization: 'Bearer token-alice' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const focus = body.data.focus;

    expect(focus.recordedFocusMinutes).toBe(105); // 60 + 45
    expect(focus.completedSessionCount).toBe(2);
    expect(focus.cancelledSessionCount).toBe(1);
    expect(focus.averageSessionMinutes).toBe(52.5); // 105 / 2

    expect(focus.dailyDistribution).toHaveLength(2);
    expect(focus.dailyDistribution[0]).toEqual({
      date: '2026-10-05',
      focusMinutes: 60,
      completedSessionCount: 1,
    });
    expect(focus.dailyDistribution[1]).toEqual({
      date: '2026-10-06',
      focusMinutes: 45,
      completedSessionCount: 1,
    });
  });

  // ----------------------------------------------------------------------------
  // 5. DSA Metrics
  // ----------------------------------------------------------------------------
  it('counts attempts and unique problems solved without repeated solve inflation', async () => {
    // Alice DSA problems
    analyticsRepository.dsaProblems.push(
      {
        id: 'prob-1',
        user_id: aliceUserId,
        difficulty: 'easy',
        status: 'active',
        next_review_at: null,
      },
      {
        id: 'prob-2',
        user_id: aliceUserId,
        difficulty: 'hard',
        status: 'active',
        next_review_at: '2026-10-01T00:00:00.000Z', // Overdue revision!
      }
    );

    // Attempts:
    // Attempt 1: prob-1 solved
    analyticsRepository.dsaAttempts.push({
      id: 'att-1',
      user_id: aliceUserId,
      problem_id: 'prob-1',
      status: 'solved',
      occurred_at: '2026-10-05T10:00:00.000Z',
    });
    // Attempt 2: prob-1 solved AGAIN in same period - must NOT inflate unique count
    analyticsRepository.dsaAttempts.push({
      id: 'att-2',
      user_id: aliceUserId,
      problem_id: 'prob-1',
      status: 'solved',
      occurred_at: '2026-10-05T14:00:00.000Z',
    });
    // Attempt 3: prob-2 failed
    analyticsRepository.dsaAttempts.push({
      id: 'att-3',
      user_id: aliceUserId,
      problem_id: 'prob-2',
      status: 'failed',
      occurred_at: '2026-10-06T10:00:00.000Z',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/summary?startDate=2026-10-05&endDate=2026-10-06&timezone=UTC',
      headers: { authorization: 'Bearer token-alice' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const dsa = body.data.dsa;

    expect(dsa.totalAttempts).toBe(3);
    expect(dsa.uniqueProblemsSolved).toBe(1); // Only prob-1 solved
    expect(dsa.solvedByDifficulty.easy).toBe(1);
    expect(dsa.solvedByDifficulty.medium).toBe(0);
    expect(dsa.solvedByDifficulty.hard).toBe(0);
    expect(dsa.currentRevisionDueCount).toBe(1); // prob-2 is due
  });

  // ----------------------------------------------------------------------------
  // 6. Growth & Milestone Metrics
  // ----------------------------------------------------------------------------
  it('correctly aggregates evidence, completed milestones, and active goals', async () => {
    // Goals:
    analyticsRepository.goals.push(
      { id: 'goal-1', user_id: aliceUserId, status: 'active' },
      { id: 'goal-2', user_id: aliceUserId, status: 'completed' },
      { id: 'goal-bob', user_id: bobUserId, status: 'active' }
    );

    // Goal Milestones:
    analyticsRepository.goalMilestones.push(
      {
        id: 'gm-1',
        goal_id: 'goal-1',
        status: 'completed',
        completed_at: '2026-10-05T12:00:00.000Z',
      },
      {
        id: 'gm-2',
        goal_id: 'goal-1',
        status: 'pending',
        completed_at: null,
      }
    );

    // Project Milestones:
    analyticsRepository.projectMilestones.push(
      {
        id: 'pm-1',
        user_id: aliceUserId,
        status: 'completed',
        completed_at: '2026-10-06T12:00:00.000Z',
      },
      {
        id: 'pm-bob',
        user_id: bobUserId,
        status: 'completed',
        completed_at: '2026-10-06T12:00:00.000Z',
      }
    );

    // Evidence:
    analyticsRepository.evidence.push(
      {
        id: 'ev-1',
        user_id: aliceUserId,
        recorded_at: '2026-10-05T15:00:00.000Z',
      },
      {
        id: 'ev-2',
        user_id: aliceUserId,
        recorded_at: '2026-10-06T15:00:00.000Z',
      },
      {
        id: 'ev-bob',
        user_id: bobUserId,
        recorded_at: '2026-10-05T15:00:00.000Z',
      }
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/summary?startDate=2026-10-05&endDate=2026-10-06&timezone=UTC',
      headers: { authorization: 'Bearer token-alice' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const growth = body.data.growth;

    expect(growth.newEvidenceCount).toBe(2);
    expect(growth.completedGoalMilestonesCount).toBe(1);
    expect(growth.completedProjectMilestonesCount).toBe(1);
    expect(growth.currentActiveGoalsCount).toBe(1); // Only goal-1 is active for Alice
  });

  // ----------------------------------------------------------------------------
  // 7. Timezone Semantics & DST Handling
  // ----------------------------------------------------------------------------
  it('correctly handles non-24h DST transition days in America/New_York', () => {
    // In America/New_York, Fall back 2026 is Nov 1 (25 hours)
    const range = resolveAnalyticsDateRange(
      '2026-11-01',
      '2026-11-01',
      'America/New_York'
    );

    // Midnight Nov 1 in EDT (UTC-4) -> 2026-11-01T04:00:00.000Z
    expect(range.startUtc).toBe('2026-11-01T04:00:00.000Z');
    // Midnight Nov 2 in EST (UTC-5) -> 2026-11-02T05:00:00.000Z
    expect(range.endUtc).toBe('2026-11-02T05:00:00.000Z');

    const durationHours =
      (new Date(range.endUtc).getTime() - new Date(range.startUtc).getTime()) /
      (1000 * 60 * 60);
    expect(durationHours).toBe(25); // Exactly 25 hours accounted for!
  });

  it('correctly resolves half-hour timezone Asia/Kolkata (+05:30)', () => {
    const range = resolveAnalyticsDateRange(
      '2026-10-18',
      '2026-10-18',
      'Asia/Kolkata'
    );

    // Midnight Oct 18 in IST (+05:30) is 2026-10-17T18:30:00.000Z
    expect(range.startUtc).toBe('2026-10-17T18:30:00.000Z');
    // Midnight Oct 19 in IST (+05:30) is 2026-10-18T18:30:00.000Z
    expect(range.endUtc).toBe('2026-10-18T18:30:00.000Z');
  });
});
