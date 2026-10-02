import { describe, expect, it } from 'vitest';
import {
  CreateGoalSchema,
  UpdateGoalSchema,
  CreateMilestoneSchema,
  UpdateMilestoneSchema,
  GoalQuerySchema,
} from './goals.types';

describe('Goals Types & Schemas', () => {
  it('validates a valid CreateGoal input', () => {
    const input = {
      title: 'Master Backend Architecture',
      description: 'Study distributed systems and modern databases',
      goal_type: 'learning',
      priority: 'high',
      status: 'active',
      start_date: '2026-10-01T00:00:00.000Z',
      target_date: '2026-12-31T23:59:59.000Z',
      desired_outcome: 'Build production-ready microservices',
      completion_criteria: 'Pass mock technical interview',
    };

    const parsed = CreateGoalSchema.parse(input);
    expect(parsed.title).toBe('Master Backend Architecture');
    expect(parsed.goal_type).toBe('learning');
    expect(parsed.priority).toBe('high');
    expect(parsed.status).toBe('active');
  });

  it('rejects CreateGoal with empty title', () => {
    expect(() =>
      CreateGoalSchema.parse({
        title: '   ',
        goal_type: 'career',
      })
    ).toThrow(/Title is required/);
  });

  it('rejects CreateGoal when target_date is before start_date', () => {
    expect(() =>
      CreateGoalSchema.parse({
        title: 'Invalid Dates Goal',
        goal_type: 'career',
        start_date: '2026-10-10T00:00:00.000Z',
        target_date: '2026-10-01T00:00:00.000Z',
      })
    ).toThrow(/target_date cannot be earlier than start_date/);
  });

  it('validates a valid CreateMilestone input', () => {
    const input = {
      title: 'Complete Phase 1: Database Migration',
      description: 'Setup PostgreSQL schema and constraints',
      status: 'pending',
      priority: 'medium',
      order_index: 0,
      start_date: '2026-10-01T00:00:00.000Z',
      target_date: '2026-10-05T00:00:00.000Z',
    };

    const parsed = CreateMilestoneSchema.parse(input);
    expect(parsed.title).toBe('Complete Phase 1: Database Migration');
    expect(parsed.order_index).toBe(0);
    expect(parsed.status).toBe('pending');
  });

  it('rejects CreateMilestone with negative order_index', () => {
    expect(() =>
      CreateMilestoneSchema.parse({
        title: 'Milestone with bad order',
        order_index: -1,
      })
    ).toThrow(/Order index must be non-negative/);
  });

  it('validates UpdateGoalSchema partial updates', () => {
    const parsed = UpdateGoalSchema.parse({
      status: 'completed',
      completed_at: '2026-10-02T12:00:00.000Z',
    });
    expect(parsed.status).toBe('completed');
    expect(parsed.completed_at).toBe('2026-10-02T12:00:00.000Z');
  });

  it('validates UpdateMilestoneSchema partial updates', () => {
    const parsed = UpdateMilestoneSchema.parse({
      order_index: 3,
      status: 'completed',
    });
    expect(parsed.order_index).toBe(3);
    expect(parsed.status).toBe('completed');
  });

  it('validates GoalQuerySchema defaults and coercion', () => {
    const parsed = GoalQuerySchema.parse({
      page: '2',
      pageSize: '10',
      sortBy: 'priority',
      sortOrder: 'asc',
      status: 'active',
      goal_type: 'project',
    });

    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(10);
    expect(parsed.sortBy).toBe('priority');
    expect(parsed.sortOrder).toBe('asc');
    expect(parsed.status).toBe('active');
    expect(parsed.goal_type).toBe('project');
  });
});

