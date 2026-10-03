import { describe, it, expect } from 'vitest';
import {
  NextActionItemSchema,
  NextActionReasonSchema,
  NextActionResponseDataSchema,
  NextActionQuerySchema,
} from './intelligence.types';

describe('Intelligence Types & Schemas', () => {
  it('validates a well-formed NextActionItem', () => {
    const validItem = {
      type: 'focus_task',
      taskId: 'b4a0f44e-0968-45a4-9e79-56bfb05c56e2',
      title: 'Practice Binary Search',
      score: 84,
      goalId: 'e8654157-5d07-4e78-8314-e0c2f8295a09',
      goalTitle: 'DSA Mastery',
      priority: 'high',
      dueAt: '2026-10-03T18:00:00.000Z',
      estimatedMinutes: 45,
    };

    const parsed = NextActionItemSchema.safeParse(validItem);
    expect(parsed.success).toBe(true);
  });

  it('validates a well-formed NextActionReason', () => {
    const validReason = {
      code: 'due_today',
      label: 'Due today',
      explanation: 'This task is due today and is currently actionable.',
    };

    const parsed = NextActionReasonSchema.safeParse(validReason);
    expect(parsed.success).toBe(true);
  });

  it('validates a no-action NextActionResponseData', () => {
    const emptyResponse = {
      action: null,
      reason: {
        code: 'no_actionable_tasks',
        label: 'Nothing urgent',
        explanation: 'There are no actionable tasks available right now.',
      },
      confidence: 'high',
      generatedAt: '2026-10-03T07:00:00.000Z',
      scoreBreakdown: null,
    };

    const parsed = NextActionResponseDataSchema.safeParse(emptyResponse);
    expect(parsed.success).toBe(true);
  });

  it('validates query schema parameters', () => {
    expect(NextActionQuerySchema.safeParse({ date: '2026-10-03', timezone: 'UTC' }).success).toBe(true);
    expect(NextActionQuerySchema.safeParse({ date: 'invalid-date' }).success).toBe(false);
    expect(NextActionQuerySchema.safeParse({}).success).toBe(true);
  });
});
