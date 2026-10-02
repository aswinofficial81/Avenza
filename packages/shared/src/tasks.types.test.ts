import { describe, expect, it } from 'vitest';
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  CreateTaskDependencySchema,
  TaskQuerySchema,
} from './tasks.types';

describe('Tasks Types & Schemas', () => {
  it('validates a valid CreateTask input', () => {
    const input = {
      title: 'Revise binary search boundary conditions',
      description: 'Review lower_bound vs upper_bound variations',
      status: 'planned',
      priority: 'high',
      task_type: 'dsa',
      estimated_minutes: 45,
      due_at: '2026-10-10T18:00:00.000Z',
      scheduled_start: '2026-10-05T10:00:00.000Z',
      scheduled_end: '2026-10-05T10:45:00.000Z',
      notes: 'Check LeetCode problems 34 and 35',
    };

    const parsed = CreateTaskSchema.parse(input);
    expect(parsed.title).toBe('Revise binary search boundary conditions');
    expect(parsed.status).toBe('planned');
    expect(parsed.priority).toBe('high');
    expect(parsed.task_type).toBe('dsa');
    expect(parsed.estimated_minutes).toBe(45);
  });

  it('rejects CreateTask with empty title', () => {
    expect(() =>
      CreateTaskSchema.parse({
        title: '   ',
        task_type: 'study',
      })
    ).toThrow(/Title is required/);
  });

  it('rejects CreateTask with negative or zero estimated_minutes', () => {
    expect(() =>
      CreateTaskSchema.parse({
        title: 'Test Task',
        estimated_minutes: 0,
      })
    ).toThrow(/Estimated minutes must be positive/);

    expect(() =>
      CreateTaskSchema.parse({
        title: 'Test Task',
        estimated_minutes: -15,
      })
    ).toThrow(/Estimated minutes must be positive/);
  });

  it('rejects CreateTask when scheduled_end is before scheduled_start', () => {
    expect(() =>
      CreateTaskSchema.parse({
        title: 'Timing Task',
        scheduled_start: '2026-10-05T12:00:00.000Z',
        scheduled_end: '2026-10-05T11:00:00.000Z',
      })
    ).toThrow(/scheduled_end cannot be earlier than scheduled_start/);
  });

  it('validates UpdateTaskSchema partial update', () => {
    const parsed = UpdateTaskSchema.parse({
      status: 'completed',
      actual_minutes: 50,
      completed_at: '2026-10-05T10:50:00.000Z',
    });

    expect(parsed.status).toBe('completed');
    expect(parsed.actual_minutes).toBe(50);
    expect(parsed.completed_at).toBe('2026-10-05T10:50:00.000Z');
  });

  it('validates CreateTaskDependencySchema', () => {
    const parsed = CreateTaskDependencySchema.parse({
      depends_on_task_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });
    expect(parsed.depends_on_task_id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

    expect(() =>
      CreateTaskDependencySchema.parse({
        depends_on_task_id: 'not-a-uuid',
      })
    ).toThrow(/Invalid prerequisite Task ID/);
  });

  it('validates TaskQuerySchema defaults and coercion', () => {
    const parsed = TaskQuerySchema.parse({
      page: '2',
      pageSize: '15',
      blocked: 'true',
      status: 'inbox',
      task_type: 'project',
      sortBy: 'due_at',
      sortOrder: 'asc',
    });

    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(15);
    expect(parsed.blocked).toBe(true);
    expect(parsed.status).toBe('inbox');
    expect(parsed.task_type).toBe('project');
    expect(parsed.sortBy).toBe('due_at');
    expect(parsed.sortOrder).toBe('asc');
  });
});
