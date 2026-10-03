import { describe, it, expect } from 'vitest';
import { CandidateGenerator } from './candidate-generator';
import type { IntelligenceContext, TaskContextItem } from '../context/context.types';

function createMockContext(overrides?: Partial<IntelligenceContext>): IntelligenceContext {
  return {
    userId: 'user-123',
    currentDate: '2026-10-03',
    currentTimeIso: '2026-10-03T10:00:00.000Z',
    timezone: 'UTC',
    activeGoals: [{ id: 'goal-1', title: 'DSA Mastery', status: 'active', priority: 1 }],
    activeMilestones: [{ id: 'milestone-1', goalId: 'goal-1', title: 'Trees', status: 'active', target_date: null }],
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
    title: 'Study Heaps',
    description: null,
    priority: 'medium',
    task_type: 'study',
    status: 'planned',
    due_at: null,
    scheduled_date: null,
    estimated_minutes: 45,
    actual_minutes: 0,
    is_blocked: false,
    unblocks_count: 0,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('CandidateGenerator', () => {
  const generator = new CandidateGenerator();

  it('generates a candidate from an actionable task', () => {
    const task = createMockTask();
    const context = createMockContext({ openTasks: [task] });

    const candidates = generator.generateCandidates(context);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.taskId).toBe(task.id);
    expect(candidates[0]!.goalTitle).toBe('DSA Mastery');
    expect(candidates[0]!.milestoneTitle).toBe('Trees');
  });

  it('excludes blocked tasks from candidate generation', () => {
    const blockedByDep = createMockTask({ id: 'blocked-1', is_blocked: true, status: 'planned' });
    const blockedByStatus = createMockTask({ id: 'blocked-2', is_blocked: false, status: 'inbox' });
    const actionable = createMockTask({ id: 'actionable-1', is_blocked: false, status: 'planned' });

    const context = createMockContext({ openTasks: [blockedByDep, blockedByStatus, actionable] });
    // make blockedByStatus actually blocked
    blockedByStatus.is_blocked = true;
    const candidates = generator.generateCandidates(context);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.taskId).toBe('actionable-1');
  });

  it('excludes completed, cancelled, and skipped tasks', () => {
    const completed = createMockTask({ id: 'c-1', status: 'completed' });
    const cancelled = createMockTask({ id: 'c-2', status: 'cancelled' });
    const skipped = createMockTask({ id: 's-1', status: 'skipped' });
    const actionable = createMockTask({ id: 'act-1', status: 'planned' });

    const context = createMockContext({ openTasks: [completed, cancelled, skipped, actionable] });
    const candidates = generator.generateCandidates(context);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.taskId).toBe('act-1');
  });

  it('assigns "continue_task" when a task has an active focus session or ongoing work', () => {
    const taskInFocus = createMockTask({ id: 'focus-target', status: 'in_progress' });
    const context = createMockContext({
      openTasks: [taskInFocus],
      activeFocusSessionTaskId: 'focus-target',
    });

    const candidates = generator.generateCandidates(context);
    expect(candidates[0]!.type).toBe('continue_task');
  });

  it('assigns "review_task" when a task has unverified linked evidence', () => {
    const task = createMockTask({ id: 'task-evidence' });
    const context = createMockContext({
      openTasks: [task],
      recentEvidence: [
        {
          id: 'ev-1',
          evidence_type: 'artifact',
          title: 'Git commit',
          verification_status: 'unverified',
          occurred_at: '2026-10-03T09:00:00.000Z',
          linked_task_ids: ['task-evidence'],
        },
      ],
    });

    const candidates = generator.generateCandidates(context);
    expect(candidates[0]!.type).toBe('review_task');
  });

  it('returns empty array when context has no actionable tasks', () => {
    const context = createMockContext({ openTasks: [] });
    const candidates = generator.generateCandidates(context);
    expect(candidates).toEqual([]);
  });
});
