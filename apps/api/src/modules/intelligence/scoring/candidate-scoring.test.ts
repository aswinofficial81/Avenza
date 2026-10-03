import { describe, it, expect } from 'vitest';
import { CandidateScorer } from './candidate-scoring';
import type { CandidateAction } from '../candidates/candidate.types';
import type { IntelligenceContext, TaskContextItem } from '../context/context.types';

function createMockContext(overrides?: Partial<IntelligenceContext>): IntelligenceContext {
  return {
    userId: 'user-123',
    currentDate: '2026-10-03',
    currentTimeIso: '2026-10-03T10:00:00.000Z',
    timezone: 'UTC',
    activeGoals: [
      { id: 'goal-1', title: 'DSA Mastery', status: 'active', priority: 1 },
    ],
    activeMilestones: [
      { id: 'milestone-1', goalId: 'goal-1', title: 'Trees & Graphs', status: 'active', target_date: '2026-10-10' },
    ],
    openTasks: [],
    recentCompletedTasks: [],
    recentFocusSessions: [],
    recentEvidence: [],
    activeFocusSessionTaskId: null,
    ...overrides,
  };
}

function createMockTask(overrides?: Partial<TaskContextItem>): TaskContextItem {
  return {
    id: 'task-1',
    goal_id: 'goal-1',
    milestone_id: 'milestone-1',
    title: 'Implement Dijkstra',
    description: null,
    priority: 'medium',
    task_type: 'practice',
    status: 'planned',
    due_at: null,
    scheduled_date: null,
    estimated_minutes: 60,
    actual_minutes: 0,
    is_blocked: false,
    unblocks_count: 0,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('CandidateScorer', () => {
  const scorer = new CandidateScorer();

  describe('Signal Independence Tests', () => {
    it('scores explicit priority signals strictly in order: critical > high > medium > low', () => {
      const context = createMockContext({ activeGoals: [], activeMilestones: [] });

      const pCritical = scorer.scoreCandidate(
        { type: 'focus_task', taskId: 'c', task: createMockTask({ id: 'c', priority: 'critical', goal_id: null, milestone_id: null }) },
        context
      );
      const pHigh = scorer.scoreCandidate(
        { type: 'focus_task', taskId: 'h', task: createMockTask({ id: 'h', priority: 'high', goal_id: null, milestone_id: null }) },
        context
      );
      const pMedium = scorer.scoreCandidate(
        { type: 'focus_task', taskId: 'm', task: createMockTask({ id: 'm', priority: 'medium', goal_id: null, milestone_id: null }) },
        context
      );
      const pLow = scorer.scoreCandidate(
        { type: 'focus_task', taskId: 'l', task: createMockTask({ id: 'l', priority: 'low', goal_id: null, milestone_id: null }) },
        context
      );

      expect(pCritical.scoreBreakdown.prioritySignal).toBe(40);
      expect(pHigh.scoreBreakdown.prioritySignal).toBe(30);
      expect(pMedium.scoreBreakdown.prioritySignal).toBe(20);
      expect(pLow.scoreBreakdown.prioritySignal).toBe(10);

      expect(pCritical.scoreBreakdown.totalScore).toBeGreaterThan(pHigh.scoreBreakdown.totalScore);
      expect(pHigh.scoreBreakdown.totalScore).toBeGreaterThan(pMedium.scoreBreakdown.totalScore);
      expect(pMedium.scoreBreakdown.totalScore).toBeGreaterThan(pLow.scoreBreakdown.totalScore);
    });

    it('scores urgency signals: overdue > due_today > deadline_soon > no deadline', () => {
      const context = createMockContext();

      const overdue = scorer.scoreCandidate(
        { type: 'focus_task', taskId: '1', task: createMockTask({ due_at: '2026-10-01T12:00:00.000Z' }) },
        context
      );
      const dueToday = scorer.scoreCandidate(
        { type: 'focus_task', taskId: '2', task: createMockTask({ due_at: '2026-10-03T18:00:00.000Z' }) },
        context
      );
      const deadlineSoon = scorer.scoreCandidate(
        { type: 'focus_task', taskId: '3', task: createMockTask({ due_at: '2026-10-04T12:00:00.000Z' }) },
        context
      );
      const noDeadline = scorer.scoreCandidate(
        { type: 'focus_task', taskId: '4', task: createMockTask({ due_at: null }) },
        context
      );

      expect(overdue.scoreBreakdown.urgencySignal).toBe(25);
      expect(dueToday.scoreBreakdown.urgencySignal).toBe(20);
      expect(deadlineSoon.scoreBreakdown.urgencySignal).toBe(12);
      expect(noDeadline.scoreBreakdown.urgencySignal).toBe(0);
    });

    it('scores dependency unblock count proportionately and bounds it', () => {
      const context = createMockContext();

      const unblock0 = scorer.scoreCandidate(
        { type: 'focus_task', taskId: '1', task: createMockTask({ unblocks_count: 0 }) },
        context
      );
      const unblock1 = scorer.scoreCandidate(
        { type: 'focus_task', taskId: '2', task: createMockTask({ unblocks_count: 1 }) },
        context
      );
      const unblock2 = scorer.scoreCandidate(
        { type: 'focus_task', taskId: '3', task: createMockTask({ unblocks_count: 2 }) },
        context
      );
      const unblock5 = scorer.scoreCandidate(
        { type: 'focus_task', taskId: '4', task: createMockTask({ unblocks_count: 5 }) },
        context
      );

      expect(unblock0.scoreBreakdown.dependencySignal).toBe(0);
      expect(unblock1.scoreBreakdown.dependencySignal).toBe(5);
      expect(unblock2.scoreBreakdown.dependencySignal).toBe(10);
      expect(unblock5.scoreBreakdown.dependencySignal).toBe(15); // capped at 15
    });

    it('scores goal and milestone relevance', () => {
      const context = createMockContext();

      const both = scorer.scoreCandidate(
        { type: 'focus_task', taskId: '1', task: createMockTask({ goal_id: 'goal-1', milestone_id: 'milestone-1' }) },
        context
      );
      const goalOnly = scorer.scoreCandidate(
        { type: 'focus_task', taskId: '2', task: createMockTask({ goal_id: 'goal-1', milestone_id: null }) },
        context
      );
      const neither = scorer.scoreCandidate(
        { type: 'focus_task', taskId: '3', task: createMockTask({ goal_id: null, milestone_id: null }) },
        context
      );

      expect(both.scoreBreakdown.goalSignal).toBe(15);
      expect(goalOnly.scoreBreakdown.goalSignal).toBe(10);
      expect(neither.scoreBreakdown.goalSignal).toBe(0);
    });

    it('scores schedule signal for tasks scheduled today', () => {
      const context = createMockContext();

      const scheduledToday = scorer.scoreCandidate(
        { type: 'focus_task', taskId: '1', task: createMockTask({ scheduled_date: '2026-10-03' }) },
        context
      );
      const notScheduled = scorer.scoreCandidate(
        { type: 'focus_task', taskId: '2', task: createMockTask({ scheduled_date: null }) },
        context
      );

      expect(scheduledToday.scoreBreakdown.scheduleSignal).toBe(15);
      expect(notScheduled.scoreBreakdown.scheduleSignal).toBe(0);
    });

    it('scores continuation signal for active session and recent focus sessions', () => {
      const contextWithActive = createMockContext({
        activeFocusSessionTaskId: 'task-active',
        recentFocusSessions: [
          {
            id: 'session-1',
            task_id: 'task-recent',
            session_type: 'pomodoro',
            status: 'completed',
            started_at: '2026-10-03T08:00:00.000Z',
            ended_at: '2026-10-03T08:30:00.000Z',
            actual_minutes: 30,
          },
        ],
      });

      const activeTask = scorer.scoreCandidate(
        { type: 'continue_task', taskId: 'task-active', task: createMockTask({ id: 'task-active', status: 'in_progress' }) },
        contextWithActive
      );
      const recentTask = scorer.scoreCandidate(
        { type: 'continue_task', taskId: 'task-recent', task: createMockTask({ id: 'task-recent', status: 'in_progress' }) },
        contextWithActive
      );
      const freshTask = scorer.scoreCandidate(
        { type: 'start_task', taskId: 'task-fresh', task: createMockTask({ id: 'task-fresh', status: 'planned' }) },
        contextWithActive
      );

      expect(activeTask.scoreBreakdown.continuationSignal).toBe(10);
      expect(recentTask.scoreBreakdown.continuationSignal).toBe(8);
      expect(freshTask.scoreBreakdown.continuationSignal).toBe(0);
    });

    it('scores staleness signal for tasks open > 14 days', () => {
      const context = createMockContext({ currentTimeIso: '2026-10-20T10:00:00.000Z' });

      const staleTask = scorer.scoreCandidate(
        { type: 'start_task', taskId: '1', task: createMockTask({ created_at: '2026-10-01T00:00:00.000Z' }) }, // 19 days old
        context
      );
      const freshTask = scorer.scoreCandidate(
        { type: 'start_task', taskId: '2', task: createMockTask({ created_at: '2026-10-18T00:00:00.000Z' }) }, // 2 days old
        context
      );

      expect(staleTask.scoreBreakdown.stalenessSignal).toBe(5);
      expect(freshTask.scoreBreakdown.stalenessSignal).toBe(0);
    });
  });

  describe('Precedence & Conflict Scenarios', () => {
    it('Scenario 1: Critical priority task vs Low priority task due today', () => {
      const context = createMockContext();

      const criticalNoDue: CandidateAction = {
        type: 'focus_task',
        taskId: 'crit',
        task: createMockTask({ id: 'crit', priority: 'critical', due_at: null, goal_id: null, milestone_id: null }),
      };

      const lowDueToday: CandidateAction = {
        type: 'start_task',
        taskId: 'low',
        task: createMockTask({ id: 'low', priority: 'low', due_at: '2026-10-03T18:00:00.000Z', goal_id: null, milestone_id: null }),
      };

      const results = scorer.scoreCandidates([lowDueToday, criticalNoDue], context);

      // Critical priority (40) > Low priority (10) + Due Today (20) = 30
      expect(results[0]!.candidate.taskId).toBe('crit');
      expect(results[0]!.scoreBreakdown.totalScore).toBe(40);
      expect(results[1]!.scoreBreakdown.totalScore).toBe(30);
    });

    it('Scenario 2: Overdue task vs High priority future task', () => {
      const context = createMockContext();

      const overdueMed: CandidateAction = {
        type: 'focus_task',
        taskId: 'overdue-med',
        task: createMockTask({
          id: 'overdue-med',
          priority: 'medium', // 20
          due_at: '2026-10-01T10:00:00.000Z', // 25
          goal_id: 'goal-1', // 10
        }), // total 55
      };

      const highFuture: CandidateAction = {
        type: 'focus_task',
        taskId: 'high-future',
        task: createMockTask({
          id: 'high-future',
          priority: 'high', // 30
          due_at: '2026-10-15T10:00:00.000Z', // 4
          goal_id: 'goal-1', // 10
        }), // total 44
      };

      const results = scorer.scoreCandidates([highFuture, overdueMed], context);
      expect(results[0]!.candidate.taskId).toBe('overdue-med');
      expect(results[0]!.primaryReason.code).toBe('overdue');
    });

    it('Scenario 3: Task that unblocks 3 tasks vs unrelated task with same priority', () => {
      const context = createMockContext();

      const unblocker: CandidateAction = {
        type: 'focus_task',
        taskId: 'unblocker',
        task: createMockTask({ id: 'unblocker', priority: 'high', unblocks_count: 3 }),
      };

      const isolated: CandidateAction = {
        type: 'focus_task',
        taskId: 'isolated',
        task: createMockTask({ id: 'isolated', priority: 'high', unblocks_count: 0 }),
      };

      const results = scorer.scoreCandidates([isolated, unblocker], context);
      expect(results[0]!.candidate.taskId).toBe('unblocker');
      expect(results[0]!.primaryReason.code).toBe('dependency_unblock');
      expect(results[0]!.primaryReason.explanation).toContain('unblock 3 other active tasks');
    });
  });

  describe('Determinism & Tie-Breaking Tests', () => {
    it('produces identical output for identical inputs across 100 consecutive runs', () => {
      const context = createMockContext();
      const candidates: CandidateAction[] = [
        { type: 'focus_task', taskId: 't1', task: createMockTask({ id: 't1', priority: 'high', due_at: '2026-10-03T18:00:00.000Z' }) },
        { type: 'start_task', taskId: 't2', task: createMockTask({ id: 't2', priority: 'medium', unblocks_count: 2 }) },
        { type: 'complete_task', taskId: 't3', task: createMockTask({ id: 't3', priority: 'critical' }) },
      ];

      const baseline = scorer.scoreCandidates(candidates, context);
      const baselineJson = JSON.stringify(baseline);

      for (let i = 0; i < 100; i++) {
        const nextRun = scorer.scoreCandidates(candidates, context);
        expect(JSON.stringify(nextRun)).toBe(baselineJson);
      }
    });

    it('breaks ties deterministically using stable task ID when all scores and metadata are equal', () => {
      const context = createMockContext();
      const taskA: CandidateAction = {
        type: 'start_task',
        taskId: 'aaa-task',
        task: createMockTask({ id: 'aaa-task', priority: 'medium' }),
      };
      const taskZ: CandidateAction = {
        type: 'start_task',
        taskId: 'zzz-task',
        task: createMockTask({ id: 'zzz-task', priority: 'medium' }),
      };

      // Regardless of array order, 'aaa-task' should deterministically come first
      const order1 = scorer.scoreCandidates([taskZ, taskA], context);
      const order2 = scorer.scoreCandidates([taskA, taskZ], context);

      expect(order1[0]!.candidate.taskId).toBe('aaa-task');
      expect(order2[0]!.candidate.taskId).toBe('aaa-task');
    });
  });
});
