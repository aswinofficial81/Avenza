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
import { TodayService } from './today.service';
import { TodayController } from './today.controller';
import { createTodayRoutes } from './today.routes';
import { registerErrorHandler } from '../../plugins/error-handler';
import type { TodayTaskItem } from '@avenza/shared';

describe('Today API & Execution Domain (/api/v1/today)', () => {
  const mockClerkClient: IClerkClient = {
    async verifyBearerToken(token: string) {
      if (token === 'token-alice') {
        return {
          clerkUserId: 'clerk_alice_today_id',
          displayName: 'Alice Architect',
        };
      }
      if (token === 'token-bob') {
        return {
          clerkUserId: 'clerk_bob_today_id',
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
  let goalsRepository: InMemoryGoalsRepository;
  let tasksRepository: InMemoryTasksRepository;
  let todayService: TodayService;
  let todayController: TodayController;
  let app: ReturnType<typeof fastify>;

  let aliceUserId: string;
  let bobUserId: string;

  beforeEach(async () => {
    profileRepository = new InMemoryProfileRepository();
    profileService = new ProfileService(profileRepository);
    preferencesRepository = new InMemoryPreferencesRepository();
    goalsRepository = new InMemoryGoalsRepository();
    tasksRepository = new InMemoryTasksRepository();

    todayService = new TodayService(
      tasksRepository,
      goalsRepository,
      profileRepository,
      preferencesRepository
    );

    todayController = new TodayController(todayService);

    const requireAuthMiddleware = createRequireAuthMiddleware(authService, profileService);
    const customTodayRoutes = createTodayRoutes({
      requireAuthMiddleware,
      todayController,
    });

    app = fastify();
    registerErrorHandler(app);
    app.register(customTodayRoutes);

    // Bootstrap Alice & Bob
    const aliceProfile = await profileService.getOrCreateProfile('clerk_alice_today_id', {
      displayName: 'Alice Architect',
      timezone: 'Asia/Kolkata',
    });
    aliceUserId = aliceProfile.id;

    const bobProfile = await profileService.getOrCreateProfile('clerk_bob_today_id', {
      displayName: 'Bob Builder',
      timezone: 'America/New_York',
    });
    bobUserId = bobProfile.id;

    // Set Alice preferences: 45 min min, 120 min target, Asia/Kolkata
    preferencesRepository.setPreferences({
      id: 'pref-alice',
      user_id: aliceUserId,
      theme: 'system',
      timezone: 'Asia/Kolkata',
      preferred_study_start: null,
      preferred_study_end: null,
      daily_minimum_minutes: 45,
      daily_target_minutes: 120,
      max_daily_study_minutes: 240,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  describe('Authentication & Authorization', () => {
    it('returns 401 Unauthorized when unauthenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/today',
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 400 Bad Request when date parameter format is invalid', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/today?date=not-a-date',
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 200 with structured response for authenticated user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/today?date=2026-10-03',
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.date).toBe('2026-10-03');
      expect(json.data.timezone).toBe('Asia/Kolkata');
      expect(json.data.summary.dailyMinimum).toBe(45);
      expect(json.data.summary.dailyTarget).toBe(120);
    });
  });

  describe('Task Classification & Precedence', () => {
    // In Asia/Kolkata (+05:30) on 2026-10-03:
    // startOfToday = 2026-10-02T18:30:00.000Z
    // endOfToday   = 2026-10-03T18:29:59.999Z
    // midDay       = 2026-10-03T06:30:00.000Z (12:00 PM IST)
    // yesterday    = 2026-10-02T12:00:00.000Z (before startOfToday)
    // tomorrow     = 2026-10-04T06:30:00.000Z (in upcoming)

    it('correctly classifies tasks into Overdue, Due Today, Scheduled Today, Upcoming, and Completed Today', async () => {
      // 1. Overdue task (due yesterday)
      const overdueTask = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Revise Graph Algorithms (Overdue)',
        description: 'Should have been done yesterday',
        status: 'in_progress',
        priority: 'high',
        task_type: 'dsa',
        goal_id: null,
        milestone_id: null,
        estimated_minutes: 60,
        actual_minutes: null,
        due_at: '2026-10-02T12:00:00.000Z',
        scheduled_start: null,
        scheduled_end: null,
        completed_at: null,
        notes: null,
      });

      // 2. Due Today task (due 3 PM IST today)
      const dueTodayTask = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Complete DBMS Assignment 3 (Due Today)',
        description: 'Due this afternoon',
        status: 'planned',
        priority: 'critical',
        task_type: 'assignment',
        goal_id: null,
        milestone_id: null,
        estimated_minutes: 90,
        actual_minutes: null,
        due_at: '2026-10-03T09:30:00.000Z', // 3:00 PM IST
        scheduled_start: null,
        scheduled_end: null,
        completed_at: null,
        notes: null,
      });

      // 3. Scheduled Today task (not due today, but scheduled 10 AM IST)
      const scheduledTodayTask = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Read OS Concurrency Chapter (Scheduled)',
        description: 'Scheduled for morning',
        status: 'scheduled',
        priority: 'medium',
        task_type: 'study',
        goal_id: null,
        milestone_id: null,
        estimated_minutes: 45,
        actual_minutes: null,
        due_at: null,
        scheduled_start: '2026-10-03T04:30:00.000Z', // 10:00 AM IST
        scheduled_end: '2026-10-03T05:15:00.000Z',
        completed_at: null,
        notes: null,
      });

      // 4. Upcoming task (due 3 days from now)
      const upcomingTask = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Submit Paper Review (Upcoming)',
        description: 'Due in 3 days',
        status: 'planned',
        priority: 'low',
        task_type: 'career',
        goal_id: null,
        milestone_id: null,
        estimated_minutes: 30,
        actual_minutes: null,
        due_at: '2026-10-06T10:00:00.000Z',
        scheduled_start: null,
        scheduled_end: null,
        completed_at: null,
        notes: null,
      });

      // 5. Completed Today task (completed at 11 AM IST today)
      const completedTodayTask = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Morning Code Review (Completed Today)',
        description: 'Done',
        status: 'completed',
        priority: 'medium',
        task_type: 'project',
        goal_id: null,
        milestone_id: null,
        estimated_minutes: 30,
        actual_minutes: 35,
        due_at: '2026-10-03T08:00:00.000Z',
        scheduled_start: null,
        scheduled_end: null,
        completed_at: '2026-10-03T05:30:00.000Z', // 11:00 AM IST
        notes: null,
      });

      // 6. Completed Yesterday task (completed_at before startOfToday)
      await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Old Task (Completed Yesterday)',
        description: 'Done yesterday',
        status: 'completed',
        priority: 'medium',
        task_type: 'personal',
        goal_id: null,
        milestone_id: null,
        estimated_minutes: 40,
        actual_minutes: 40,
        due_at: null,
        scheduled_start: null,
        scheduled_end: null,
        completed_at: '2026-10-02T10:00:00.000Z', // Yesterday
        notes: null,
      });

      // 7. Inactive tasks (cancelled, skipped, deferred)
      await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Cancelled Task',
        status: 'cancelled',
        priority: 'low',
        task_type: 'personal',
        goal_id: null,
        milestone_id: null,
        estimated_minutes: null,
        actual_minutes: null,
        due_at: '2026-10-03T09:00:00.000Z',
        scheduled_start: null,
        scheduled_end: null,
        completed_at: null,
        notes: null,
      });

      await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Deferred Task',
        status: 'deferred',
        priority: 'medium',
        task_type: 'study',
        goal_id: null,
        milestone_id: null,
        estimated_minutes: null,
        actual_minutes: null,
        due_at: '2026-10-03T09:00:00.000Z',
        scheduled_start: null,
        scheduled_end: null,
        completed_at: null,
        notes: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/today?date=2026-10-03',
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      const data = json.data;

      // Section counts
      expect(data.overdue.map((t: TodayTaskItem) => t.id)).toEqual([overdueTask.id]);
      expect(data.dueToday.map((t: TodayTaskItem) => t.id)).toEqual([dueTodayTask.id]);
      expect(data.scheduledToday.map((t: TodayTaskItem) => t.id)).toEqual([scheduledTodayTask.id]);
      expect(data.upcoming.map((t: TodayTaskItem) => t.id)).toEqual([upcomingTask.id]);
      expect(data.completedToday.map((t: TodayTaskItem) => t.id)).toEqual([completedTodayTask.id]);

      // Completed yesterday, cancelled, and deferred must NOT appear in active buckets
      const allActiveIds = [
        ...data.overdue,
        ...data.dueToday,
        ...data.scheduledToday,
        ...data.upcoming,
      ].map((t: TodayTaskItem) => t.title);

      expect(allActiveIds).not.toContain('Cancelled Task');
      expect(allActiveIds).not.toContain('Deferred Task');
      expect(allActiveIds).not.toContain('Old Task (Completed Yesterday)');
    });
  });

  describe('Deterministic "Next Up" Task Selection', () => {
    it('selects unblocked overdue task over due today task', async () => {
      // Create overdue task
      const overdue = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Urgent Overdue Task',
        status: 'planned',
        priority: 'high',
        task_type: 'assignment',
        goal_id: null,
        milestone_id: null,
        estimated_minutes: 30,
        actual_minutes: null,
        due_at: '2026-10-02T10:00:00.000Z',
        scheduled_start: null,
        scheduled_end: null,
        completed_at: null,
        notes: null,
      });

      // Create due today critical task
      await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Due Today Critical Task',
        status: 'planned',
        priority: 'critical',
        task_type: 'dsa',
        goal_id: null,
        milestone_id: null,
        estimated_minutes: 30,
        actual_minutes: null,
        due_at: '2026-10-03T10:00:00.000Z',
        scheduled_start: null,
        scheduled_end: null,
        completed_at: null,
        notes: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/today?date=2026-10-03',
        headers: { authorization: 'Bearer token-alice' },
      });

      const json = response.json();
      expect(json.data.next).not.toBeNull();
      expect(json.data.next.id).toBe(overdue.id);
    });

    it('bypasses blocked tasks when selecting Next Up', async () => {
      // Prerequisite task (incomplete)
      const prereq = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Prerequisite Task',
        status: 'planned',
        priority: 'medium',
        task_type: 'study',
        goal_id: null,
        milestone_id: null,
        estimated_minutes: 30,
        actual_minutes: null,
        due_at: '2026-10-03T12:00:00.000Z',
        scheduled_start: null,
        scheduled_end: null,
        completed_at: null,
        notes: null,
      });

      // Overdue task that depends on prereq (blocked!)
      const blockedOverdue = await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Blocked Overdue Task',
        status: 'planned',
        priority: 'critical',
        task_type: 'assignment',
        goal_id: null,
        milestone_id: null,
        estimated_minutes: 30,
        actual_minutes: null,
        due_at: '2026-10-02T10:00:00.000Z',
        scheduled_start: null,
        scheduled_end: null,
        completed_at: null,
        notes: null,
      });

      await tasksRepository.createDependency(
        {
          task_id: blockedOverdue.id,
          depends_on_task_id: prereq.id,
        },
        aliceUserId
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/today?date=2026-10-03',
        headers: { authorization: 'Bearer token-alice' },
      });

      const json = response.json();
      // Blocked task is in overdue section with is_blocked = true
      const overdueItem = json.data.overdue.find((t: TodayTaskItem) => t.id === blockedOverdue.id);
      expect(overdueItem).toBeDefined();
      expect(overdueItem.is_blocked).toBe(true);

      // But Next Up picks the unblocked prerequisite task!
      expect(json.data.next).not.toBeNull();
      expect(json.data.next.id).toBe(prereq.id);
    });
  });

  describe('Meaningful Work & Target Calculations', () => {
    it('distinguishes actual minutes from estimated minutes and calculates target percentages', async () => {
      // Alice dailyMinimum: 45 min, dailyTarget: 120 min

      // Task 1: Completed today with actual minutes = 30
      await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Task With Actual Minutes',
        status: 'completed',
        priority: 'high',
        task_type: 'practice',
        goal_id: null,
        milestone_id: null,
        estimated_minutes: 45,
        actual_minutes: 30,
        due_at: null,
        scheduled_start: null,
        scheduled_end: null,
        completed_at: '2026-10-03T04:00:00.000Z',
        notes: null,
      });

      // Task 2: Completed today with estimated minutes = 25 (actual is null)
      await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Task With Estimated Minutes Only',
        status: 'completed',
        priority: 'medium',
        task_type: 'revision',
        goal_id: null,
        milestone_id: null,
        estimated_minutes: 25,
        actual_minutes: null,
        due_at: null,
        scheduled_start: null,
        scheduled_end: null,
        completed_at: '2026-10-03T05:00:00.000Z',
        notes: null,
      });

      // Task 3: Completed today with neither (0 minutes)
      await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Task Without Durations',
        status: 'completed',
        priority: 'low',
        task_type: 'administrative',
        goal_id: null,
        milestone_id: null,
        estimated_minutes: null,
        actual_minutes: null,
        due_at: null,
        scheduled_start: null,
        scheduled_end: null,
        completed_at: '2026-10-03T06:00:00.000Z',
        notes: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/today?date=2026-10-03',
        headers: { authorization: 'Bearer token-alice' },
      });

      expect(response.statusCode).toBe(200);
      const { summary } = response.json().data;

      // 3 completed tasks
      expect(summary.completedTaskCount).toBe(3);

      // Only task 1 contributes to meaningfulMinutes (30 min)
      expect(summary.meaningfulMinutes).toBe(30);

      // Task 2 contributes to estimatedMinutesWithoutActual (25 min)
      expect(summary.estimatedMinutesWithoutActual).toBe(25);

      // dailyMinimum = 45 -> 30/45 = 66.6% -> Math.round is 67%
      expect(summary.minimumProgress).toBe(67);

      // dailyTarget = 120 -> 30/120 = 25%
      expect(summary.targetProgress).toBe(25);
    });

    it('handles zero daily minimum and target gracefully without division by zero', async () => {
      // Set Bob's preferences to 0 minimum and 0 target
      preferencesRepository.setPreferences({
        id: 'pref-bob',
        user_id: bobUserId,
        theme: 'dark',
        timezone: 'America/New_York',
        preferred_study_start: null,
        preferred_study_end: null,
        daily_minimum_minutes: 0,
        daily_target_minutes: 0,
        max_daily_study_minutes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/today?date=2026-10-03',
        headers: { authorization: 'Bearer token-bob' },
      });

      expect(response.statusCode).toBe(200);
      const { summary } = response.json().data;
      expect(summary.minimumProgress).toBe(100);
      expect(summary.targetProgress).toBe(100);
    });
  });

  describe('Multi-Tenant User Isolation', () => {
    it('ensures Bob cannot see Alice tasks or summary metrics', async () => {
      // Alice creates a task
      await tasksRepository.createTask({
        user_id: aliceUserId,
        title: 'Alice Confidential Research',
        status: 'planned',
        priority: 'critical',
        task_type: 'project',
        goal_id: null,
        milestone_id: null,
        estimated_minutes: 120,
        actual_minutes: null,
        due_at: '2026-10-03T10:00:00.000Z',
        scheduled_start: null,
        scheduled_end: null,
        completed_at: null,
        notes: null,
      });

      // Bob accesses Today
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/today?date=2026-10-03',
        headers: { authorization: 'Bearer token-bob' },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json().data;
      expect(data.dueToday).toHaveLength(0);
      expect(data.overdue).toHaveLength(0);
      expect(data.next).toBeNull();
    });
  });
});
