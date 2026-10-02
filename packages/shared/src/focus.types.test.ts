import { describe, it, expect } from 'vitest';
import {
  CreateFocusSessionSchema,
  FocusSessionsQuerySchema,
  FocusSessionTypeSchema,
  FocusSessionStatusSchema,
} from './focus.types';

describe('Focus Shared Types & Schemas', () => {
  it('validates correct CreateFocusSessionInput', () => {
    const valid = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      sessionType: 'deep_work',
      plannedMinutes: 45,
      notes: 'Focusing on JWT middleware',
    };
    const parsed = CreateFocusSessionSchema.parse(valid);
    expect(parsed.taskId).toBe(valid.taskId);
    expect(parsed.sessionType).toBe('deep_work');
    expect(parsed.plannedMinutes).toBe(45);
  });

  it('applies defaults for CreateFocusSessionInput', () => {
    const input = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
    };
    const parsed = CreateFocusSessionSchema.parse(input);
    expect(parsed.sessionType).toBe('focus');
    expect(parsed.plannedMinutes).toBe(25);
  });

  it('rejects invalid planned minutes', () => {
    const zeroMinutes = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      plannedMinutes: 0,
    };
    expect(() => CreateFocusSessionSchema.parse(zeroMinutes)).toThrow();

    const tooManyMinutes = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      plannedMinutes: 500,
    };
    expect(() => CreateFocusSessionSchema.parse(tooManyMinutes)).toThrow();
  });

  it('validates focus session types and statuses', () => {
    expect(FocusSessionTypeSchema.parse('pomodoro')).toBe('pomodoro');
    expect(() => FocusSessionTypeSchema.parse('invalid_type')).toThrow();

    expect(FocusSessionStatusSchema.parse('active')).toBe('active');
    expect(FocusSessionStatusSchema.parse('completed')).toBe('completed');
    expect(FocusSessionStatusSchema.parse('cancelled')).toBe('cancelled');
    expect(() => FocusSessionStatusSchema.parse('paused')).toThrow();
  });

  it('parses FocusSessionsQuerySchema with defaults', () => {
    const parsed = FocusSessionsQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
  });
});
