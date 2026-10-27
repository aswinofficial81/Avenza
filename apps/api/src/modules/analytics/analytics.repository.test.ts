import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@avenza/shared';
import { SupabaseAnalyticsRepository } from './analytics.repository';

type Row = Record<string, unknown>;
type FakeResponse = {
  data: Row[] | null;
  error: { message: string } | null;
  count: number | null;
};
type Filter = (row: Row) => boolean;

/** Minimal thenable PostgREST fake that applies query filters, ordering, and range. */
class FakeQuery implements PromiseLike<FakeResponse> {
  private filters: Filter[] = [];
  private orders: Array<{ field: string; ascending: boolean }> = [];
  private selected = '*';
  private fromIndex = 0;
  private toIndex = Number.MAX_SAFE_INTEGER;
  private countRequested = false;
  private head = false;

  constructor(private readonly table: string, private readonly rowsByTable: Record<string, Row[]>) { }

  select(columns: string, options?: { count?: string; head?: boolean }): this {
    this.selected = columns;
    this.countRequested = options?.count === 'exact';
    this.head = options?.head === true;
    return this;
  }

  eq(field: string, expected: unknown): this {
    this.filters.push((row) => row[field] === expected);
    return this;
  }

  gte(field: string, expected: unknown): this {
    this.filters.push((row) => String(row[field] ?? '') >= String(expected ?? ''));
    return this;
  }

  gt(field: string, expected: unknown): this {
    this.filters.push((row) => String(row[field] ?? '') > String(expected ?? ''));
    return this;
  }

  lt(field: string, expected: unknown): this {
    this.filters.push((row) => String(row[field] ?? '') < String(expected ?? ''));
    return this;
  }

  lte(field: string, expected: unknown): this {
    this.filters.push((row) => String(row[field] ?? '') <= String(expected ?? ''));
    return this;
  }

  not(field: string, operator: string, expected: unknown): this {
    if (operator === 'is' && expected === null) {
      this.filters.push((row) => row[field] !== null && row[field] !== undefined);
    }
    return this;
  }

  in(field: string, values: unknown[]): this {
    const accepted = new Set(values);
    this.filters.push((row) => accepted.has(row[field]));
    return this;
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.orders.push({ field, ascending: options?.ascending !== false });
    return this;
  }

  range(fromIndex: number, toIndex: number): this {
    this.fromIndex = fromIndex;
    this.toIndex = toIndex;
    return this;
  }

  private execute(): FakeResponse {
    let rows = (this.rowsByTable[this.table] ?? []).filter((row) =>
      this.filters.every((filter) => filter(row))
    );

    if (this.orders.length > 0) {
      rows = [...rows].sort((left, right) => {
        for (const order of this.orders) {
          const a = String(left[order.field] ?? '');
          const b = String(right[order.field] ?? '');
          const comparison = a.localeCompare(b);
          if (comparison !== 0) return order.ascending ? comparison : -comparison;
        }
        return 0;
      });
    }

    const count = this.countRequested ? rows.length : null;
    if (this.head) return { data: null, error: null, count };

    rows = rows.slice(this.fromIndex, this.toIndex + 1);
    const columns = this.selected.trim() === '*'
      ? null
      : this.selected.split(',').map((column) => column.trim());
    const data = columns
      ? rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])))
      : rows;
    return { data, error: null, count };
  }

  then<TResult1 = FakeResponse, TResult2 = never>(
    onfulfilled?: ((value: FakeResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

class FakeSupabaseClient {
  constructor(private readonly rowsByTable: Record<string, Row[]>) { }

  from(table: string): FakeQuery {
    return new FakeQuery(table, this.rowsByTable);
  }
}

const IN_PERIOD = '2026-10-05T10:00:00.000Z';
const START_UTC = '2026-10-05T00:00:00.000Z';
const END_UTC = '2026-10-06T00:00:00.000Z';
const USER_ID = 'user-a';

function makeLargeFixture(): Record<string, Row[]> {
  const tasks: Row[] = Array.from({ length: 1001 }, (_, index) => ({
    id: `task-${String(index).padStart(4, '0')}`,
    user_id: USER_ID,
    status: 'completed',
    priority: index === 1000 ? 'critical' : 'low',
    task_type: 'study',
    completed_at: IN_PERIOD,
    due_at: null,
  }));

  const focusSessions: Row[] = Array.from({ length: 1001 }, (_, index) => ({
    id: `focus-${String(index).padStart(4, '0')}`,
    user_id: USER_ID,
    status: 'completed',
    actual_minutes: 25,
    started_at: IN_PERIOD,
    ended_at: IN_PERIOD,
  }));

  const dsaProblems: Row[] = Array.from({ length: 1001 }, (_, index) => ({
    id: `problem-${String(index).padStart(4, '0')}`,
    user_id: USER_ID,
    status: 'active',
    difficulty: (['easy', 'medium', 'hard'] as const)[index % 3],
    next_review_at: null,
  }));

  const dsaAttempts: Row[] = dsaProblems.map((problem, index) => ({
    id: `attempt-${String(index).padStart(4, '0')}`,
    user_id: USER_ID,
    problem_id: problem.id,
    status: 'solved',
    occurred_at: IN_PERIOD,
  }));

  const goals: Row[] = Array.from({ length: 1001 }, (_, index) => ({
    id: `goal-${String(index).padStart(4, '0')}`,
    user_id: USER_ID,
    status: 'active',
  }));

  return {
    tasks,
    focus_sessions: focusSessions,
    dsa_problems: dsaProblems,
    dsa_attempts: dsaAttempts,
    goals,
    goal_milestones: [
      {
        id: 'milestone-1',
        goal_id: goals[1000]?.id,
        status: 'completed',
        completed_at: IN_PERIOD,
      },
    ],
    project_milestones: [
      {
        id: 'project-milestone-1',
        user_id: USER_ID,
        status: 'completed',
        completed_at: IN_PERIOD,
      },
    ],
    evidence: [
      { id: 'evidence-1', user_id: USER_ID, recorded_at: IN_PERIOD },
    ],
  };
}

describe('SupabaseAnalyticsRepository pagination', () => {
  it('aggregates more than 1,000 rows without PostgREST row-cap truncation', async () => {
    const fakeClient = new FakeSupabaseClient(makeLargeFixture());
    const repository = new SupabaseAnalyticsRepository(
      fakeClient as unknown as SupabaseClient<Database>
    );

    const execution = await repository.getExecutionSummary(USER_ID, START_UTC, END_UTC, END_UTC);
    expect(execution.completedTaskCount).toBe(1001);
    expect(execution.completedByPriority.low).toBe(1000);
    expect(execution.completedByPriority.critical).toBe(1);
    expect(execution.completedByType.study).toBe(1001);

    const focus = await repository.getFocusSummary(USER_ID, START_UTC, END_UTC, [
      { date: '2026-10-05', startUtc: START_UTC, endUtc: END_UTC },
    ]);
    expect(focus.completedSessionCount).toBe(1001);
    expect(focus.recordedFocusMinutes).toBe(25025);
    expect(focus.dailyDistribution[0]?.completedSessionCount).toBe(1001);
    expect(focus.dailyDistribution[0]?.focusMinutes).toBe(25025);

    const dsa = await repository.getDsaSummary(USER_ID, START_UTC, END_UTC, END_UTC);
    expect(dsa.totalAttempts).toBe(1001);
    expect(dsa.uniqueProblemsSolved).toBe(1001);
    expect(
      dsa.solvedByDifficulty.easy + dsa.solvedByDifficulty.medium + dsa.solvedByDifficulty.hard
    ).toBe(1001);

    const growth = await repository.getGrowthSummary(USER_ID, START_UTC, END_UTC);
    expect(growth.newEvidenceCount).toBe(1);
    expect(growth.completedGoalMilestonesCount).toBe(1);
    expect(growth.completedProjectMilestonesCount).toBe(1);
    expect(growth.currentActiveGoalsCount).toBe(1001);
  });
});
