import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TaskRow, TaskDependencyRow } from '@avenza/shared';
import { SupabaseTasksRepository, InMemoryTasksRepository } from './tasks.repository';

describe('Phase 17B-1: Tenant-Scoped Dependency Queries & Invariants (T1 - T8)', () => {
  const userA = '11111111-1111-1111-1111-111111111111';
  const userB = '22222222-2222-2222-2222-222222222222';

  // Helper to create a mock Supabase client for testing query builder calls
  function createMockSupabase(handlers: {
    onTasksSelect?: (queryState: { eqUserId?: string; range?: { from: number; to: number }; order?: { col: string; ascending?: boolean } }) => { data: unknown; error: unknown };
    onDepsSelect?: (queryState: { inTaskIds?: string[]; range?: { from: number; to: number }; order?: { col: string; ascending?: boolean } }) => { data: unknown; error: unknown };
    onTasksMainQuery?: (queryState: { inIds?: string[]; notInIds?: string; range?: { from: number; to: number } }) => { data: unknown; error: unknown; count: number };
  }) {
    const executedQueries: Array<{
      table: string;
      inFilter?: string[];
      eqFilters: Record<string, unknown>;
      range?: { from: number; to: number };
      order?: { col: string; ascending?: boolean };
    }> = [];

    const mockClient = {
      from: vi.fn((table: string) => {
        const currentEq: Record<string, unknown> = {};
        let currentIn: string[] | undefined = undefined;
        let currentOrder: { col: string; ascending?: boolean } | undefined = undefined;
        let currentRange: { from: number; to: number } | undefined = undefined;
        let isTasksIdOnly = false;

        const builder = {
          select: vi.fn((fields: string) => {
            if (table === 'tasks' && fields === 'id') {
              isTasksIdOnly = true;
            }
            return builder;
          }),
          eq: vi.fn((col: string, val: unknown) => {
            currentEq[col] = val;
            return builder;
          }),
          in: vi.fn((col: string, vals: string[]) => {
            if (col === 'task_id' || col === 'id') {
              currentIn = vals;
            }
            return builder;
          }),
          not: vi.fn((_col: string, _op: string, _val: string) => builder),
          ilike: vi.fn(() => builder),
          lte: vi.fn(() => builder),
          gte: vi.fn(() => builder),
          order: vi.fn((col: string, opts?: { ascending?: boolean }) => {
            currentOrder = { col, ascending: opts?.ascending };
            return builder;
          }),
          range: vi.fn((from: number, to: number) => {
            currentRange = { from, to };
            return builder;
          }),
          then: (resolve: (val: unknown) => void) => {
            executedQueries.push({
              table,
              inFilter: currentIn,
              eqFilters: { ...currentEq },
              range: currentRange,
              order: currentOrder,
            });

            if (table === 'tasks' && isTasksIdOnly) {
              const res = handlers.onTasksSelect?.({
                eqUserId: currentEq['user_id'] as string | undefined,
                range: currentRange,
                order: currentOrder,
              }) ?? { data: [], error: null };

              let data = res.data;
              if (Array.isArray(data) && currentRange) {
                if (currentRange.from > 0 || data.length > (currentRange.to - currentRange.from + 1)) {
                  data = data.slice(currentRange.from, currentRange.to + 1);
                }
              }
              return resolve({ ...res, data });
            }

            if (table === 'task_dependencies') {
              const res = handlers.onDepsSelect?.({
                inTaskIds: currentIn,
                range: currentRange,
                order: currentOrder,
              }) ?? { data: [], error: null };

              let data = res.data;
              if (Array.isArray(data) && currentRange) {
                if (currentRange.from > 0 || data.length > (currentRange.to - currentRange.from + 1)) {
                  data = data.slice(currentRange.from, currentRange.to + 1);
                }
              }
              return resolve({ ...res, data });
            }

            if (table === 'tasks') {
              const res = handlers.onTasksMainQuery?.({ inIds: currentIn, range: currentRange }) ?? { data: [], error: null, count: 0 };
              return resolve(res);
            }

            return resolve({ data: [], error: null });
          },
        };
        return builder;
      }),
    };

    return {
      client: mockClient as unknown as SupabaseClient<Database>,
      executedQueries,
    };
  }

  // ============================================================================
  // T1: Blocked-task query scoping
  // ============================================================================
  it('T1: Blocked-task query scoping — restricts task_dependencies query to user-owned task IDs', async () => {
    const userATaskIds = ['task-a1', 'task-a2'];

    const { client, executedQueries } = createMockSupabase({
      onTasksSelect: ({ eqUserId }) => {
        expect(eqUserId).toBe(userA);
        return { data: [{ id: 'task-a1' }, { id: 'task-a2' }], error: null };
      },
      onDepsSelect: ({ inTaskIds }) => {
        // Assert that the query builder was explicitly constrained to user-owned task IDs
        expect(inTaskIds).toEqual(userATaskIds);
        return {
          data: [
            {
              task_id: 'task-a1',
              task: { user_id: userA },
              prerequisite: { id: 'task-a2', status: 'in_progress', user_id: userA },
            },
          ],
          error: null,
        };
      },
      onTasksMainQuery: () => ({
        data: [{ id: 'task-a1', user_id: userA, title: 'Task A1', status: 'todo' }],
        count: 1,
        error: null,
      }),
    });

    const repo = new SupabaseTasksRepository(client);
    const result = await repo.findTasks({ userId: userA, blocked: true });

    // Verify task_dependencies was queried with the user's task IDs
    const depQuery = executedQueries.find((q) => q.table === 'task_dependencies');
    expect(depQuery).toBeDefined();
    expect(depQuery?.inFilter).toEqual(userATaskIds);
    expect(result.data).toHaveLength(1);
  });

  // ============================================================================
  // T2: Dependency retrieval scoping
  // ============================================================================
  it('T2: Dependency retrieval scoping — getAllUserDependencies restricts query to user-owned task IDs', async () => {
    const userATaskIds = ['task-a1', 'task-a2'];

    const { client, executedQueries } = createMockSupabase({
      onTasksSelect: ({ eqUserId }) => {
        expect(eqUserId).toBe(userA);
        return { data: [{ id: 'task-a1' }, { id: 'task-a2' }], error: null };
      },
      onDepsSelect: ({ inTaskIds }) => {
        expect(inTaskIds).toEqual(userATaskIds);
        return {
          data: [
            {
              id: 'dep-1',
              task_id: 'task-a1',
              depends_on_task_id: 'task-a2',
              task: { user_id: userA },
              prerequisite: { user_id: userA },
            },
          ],
          error: null,
        };
      },
    });

    const repo = new SupabaseTasksRepository(client);
    const deps = await repo.getAllUserDependencies(userA);

    const depQuery = executedQueries.find((q) => q.table === 'task_dependencies');
    expect(depQuery).toBeDefined();
    expect(depQuery?.inFilter).toEqual(userATaskIds);
    expect(deps).toHaveLength(1);
    expect(deps[0]?.id).toBe('dep-1');
  });

  // ============================================================================
  // T3: Cross-tenant isolation
  // ============================================================================
  it('T3: Cross-tenant isolation — User B dependencies never affect User A', async () => {
    const taskA1: TaskRow = {
      id: 'task-a1',
      user_id: userA,
      title: 'Alice Task 1',
      description: null,
      status: 'todo',
      priority: 'medium',
      task_type: 'study',
      goal_id: null,
      milestone_id: null,
      project_id: null,
      project_milestone_id: null,
      application_id: null,
      estimated_minutes: null,
      actual_minutes: null,
      due_at: null,
      scheduled_start: null,
      scheduled_end: null,
      completed_at: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const taskB1: TaskRow = {
      ...taskA1,
      id: 'task-b1',
      user_id: userB,
      title: 'Bob Task 1',
    };

    const taskB2: TaskRow = {
      ...taskA1,
      id: 'task-b2',
      user_id: userB,
      title: 'Bob Prereq (uncompleted)',
      status: 'in_progress',
    };

    // Bob has a dependency: task-b1 depends on uncompleted task-b2
    const bobDep: TaskDependencyRow = {
      id: 'dep-bob-1',
      task_id: 'task-b1',
      depends_on_task_id: 'task-b2',
      created_at: new Date().toISOString(),
    };

    const repo = new InMemoryTasksRepository([taskA1, taskB1, taskB2], [bobDep]);

    // Alice queries blocked tasks: Alice has NO dependencies, so 0 blocked tasks
    const aliceBlocked = await repo.findTasks({ userId: userA, blocked: true });
    expect(aliceBlocked.data).toHaveLength(0);

    // Alice queries unblocked tasks: Alice Task 1 should be returned
    const aliceUnblocked = await repo.findTasks({ userId: userA, blocked: false });
    expect(aliceUnblocked.data).toHaveLength(1);
    expect(aliceUnblocked.data[0]?.id).toBe('task-a1');

    // Bob queries blocked tasks: Bob Task 1 is blocked by Bob Task 2
    const bobBlocked = await repo.findTasks({ userId: userB, blocked: true });
    expect(bobBlocked.data).toHaveLength(1);
    expect(bobBlocked.data[0]?.id).toBe('task-b1');

    // Alice queries all dependencies: must NOT see Bob's dependency
    const aliceDeps = await repo.getAllUserDependencies(userA);
    expect(aliceDeps).toHaveLength(0);
  });

  // ============================================================================
  // T4: Cross-tenant prerequisite rejection
  // ============================================================================
  it('T4: Cross-tenant prerequisite rejection — dependency pointing to another user prerequisite cannot block task', async () => {
    const taskA1: TaskRow = {
      id: 'task-a1',
      user_id: userA,
      title: 'Alice Task 1',
      description: null,
      status: 'todo',
      priority: 'high',
      task_type: 'personal',
      goal_id: null,
      milestone_id: null,
      project_id: null,
      project_milestone_id: null,
      application_id: null,
      estimated_minutes: null,
      actual_minutes: null,
      due_at: null,
      scheduled_start: null,
      scheduled_end: null,
      completed_at: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const taskB_foreign: TaskRow = {
      ...taskA1,
      id: 'task-b-foreign',
      user_id: userB,
      title: 'Bob Foreign Task',
      status: 'in_progress', // uncompleted
    };

    // Rogue / corrupted dependency where Alice's task points to Bob's task
    const rogueDep: TaskDependencyRow = {
      id: 'dep-rogue',
      task_id: 'task-a1',
      depends_on_task_id: 'task-b-foreign',
      created_at: new Date().toISOString(),
    };

    // 1. Verify in InMemoryTasksRepository
    const memRepo = new InMemoryTasksRepository([taskA1, taskB_foreign], [rogueDep]);
    const blockedRes = await memRepo.findTasks({ userId: userA, blocked: true });
    expect(blockedRes.data).toHaveLength(0); // Cannot be blocked by another user's task!

    const unblockedRes = await memRepo.findTasks({ userId: userA, blocked: false });
    expect(unblockedRes.data).toHaveLength(1); // Task is treated as unblocked for Alice

    // 2. Verify in SupabaseTasksRepository
    const { client } = createMockSupabase({
      onTasksSelect: () => ({ data: [{ id: 'task-a1' }], error: null }),
      onDepsSelect: () => ({
        data: [
          {
            task_id: 'task-a1',
            task: { user_id: userA },
            prerequisite: { id: 'task-b-foreign', status: 'in_progress', user_id: userB }, // User B prerequisite!
          },
        ],
        error: null,
      }),
      onTasksMainQuery: () => ({
        data: [],
        count: 0,
        error: null,
      }),
    });

    const supaRepo = new SupabaseTasksRepository(client);
    const supaBlocked = await supaRepo.findTasks({ userId: userA, blocked: true });
    expect(supaBlocked.data).toHaveLength(0); // Dual-ownership check discarded rogue cross-tenant prerequisite
  });

  // ============================================================================
  // T5: Same-user dependency behavior
  // ============================================================================
  it('T5: Same-user dependency behavior — uncompleted prerequisite blocks, completed prerequisite unblocks', async () => {
    const taskA1: TaskRow = {
      id: 'task-a1',
      user_id: userA,
      title: 'Alice Task 1',
      description: null,
      status: 'todo',
      priority: 'high',
      task_type: 'personal',
      goal_id: null,
      milestone_id: null,
      project_id: null,
      project_milestone_id: null,
      application_id: null,
      estimated_minutes: null,
      actual_minutes: null,
      due_at: null,
      scheduled_start: null,
      scheduled_end: null,
      completed_at: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const taskA2: TaskRow = {
      ...taskA1,
      id: 'task-a2',
      title: 'Alice Prerequisite Task',
      status: 'in_progress',
    };

    const dep: TaskDependencyRow = {
      id: 'dep-a1-a2',
      task_id: 'task-a1',
      depends_on_task_id: 'task-a2',
      created_at: new Date().toISOString(),
    };

    const repo = new InMemoryTasksRepository([taskA1, taskA2], [dep]);

    // 1. When prerequisite is in_progress, Task A1 is BLOCKED
    const blockedInitial = await repo.findTasks({ userId: userA, blocked: true });
    expect(blockedInitial.data.map((t) => t.id)).toEqual(['task-a1']);

    // 2. Complete the prerequisite
    await repo.updateTask('task-a2', userA, { status: 'completed' });

    // 3. Now Task A1 is UNBLOCKED
    const blockedAfter = await repo.findTasks({ userId: userA, blocked: true });
    expect(blockedAfter.data).toHaveLength(0);

    const unblockedAfter = await repo.findTasks({ userId: userA, blocked: false });
    expect(unblockedAfter.data.map((t) => t.id).sort()).toEqual(['task-a1', 'task-a2']);
  });

  // ============================================================================
  // T6: Empty task-ID handling
  // ============================================================================
  it('T6: Empty task-ID handling — zero tasks skips dependency query and returns empty results safely', async () => {
    let depQueryExecuted = false;

    const { client } = createMockSupabase({
      onTasksSelect: () => ({ data: [], error: null }), // User has NO tasks
      onDepsSelect: () => {
        depQueryExecuted = true;
        return { data: [], error: null };
      },
    });

    const repo = new SupabaseTasksRepository(client);

    // findTasks({ blocked: true })
    const blockedRes = await repo.findTasks({ userId: userA, blocked: true });
    expect(depQueryExecuted).toBe(false); // task_dependencies was never queried!
    expect(blockedRes.data).toEqual([]);
    expect(blockedRes.pagination.total).toBe(0);

    // getAllUserDependencies()
    const allDeps = await repo.getAllUserDependencies(userA);
    expect(depQueryExecuted).toBe(false);
    expect(allDeps).toEqual([]);
  });

  // ============================================================================
  // T7: Batching and completeness beyond 500 tasks
  // ============================================================================
  it('T7: Batching beyond 500 tasks — batches in chunks of <= 500 and aggregates complete results without N+1', async () => {
    // Generate 1,250 tasks for userA
    const totalTasks = 1250;
    const taskIds = Array.from({ length: totalTasks }, (_, i) => `task-${i + 1}`);

    const batchesReceived: string[][] = [];

    const { client } = createMockSupabase({
      onTasksSelect: () => ({
        data: taskIds.map((id) => ({ id })),
        error: null,
      }),
      onDepsSelect: ({ inTaskIds }) => {
        batchesReceived.push(inTaskIds || []);
        // Return 1 dependency per batch
        const firstId = inTaskIds?.[0] || 'unknown';
        return {
          data: [
            {
              id: `dep-${firstId}`,
              task_id: firstId,
              depends_on_task_id: 'task-target',
              task: { user_id: userA },
              prerequisite: { user_id: userA },
            },
          ],
          error: null,
        };
      },
    });

    const repo = new SupabaseTasksRepository(client);
    const deps = await repo.getAllUserDependencies(userA);

    // 1,250 tasks must be chunked into exactly 3 batches: 500, 500, 250
    expect(batchesReceived).toHaveLength(3);
    expect(batchesReceived[0]).toHaveLength(500);
    expect(batchesReceived[1]).toHaveLength(500);
    expect(batchesReceived[2]).toHaveLength(250);

    // Completeness: all 3 dependencies aggregated
    expect(deps).toHaveLength(3);
  });

  // ============================================================================
  // T8: Existing filter, sorting, pagination, and total-count regression
  // ============================================================================
  it('T8: Existing filter regression — preserves status, priority, pagination, and sorting alongside blocked scoping', async () => {
    const tasks: TaskRow[] = [
      {
        id: 't-1',
        user_id: userA,
        title: 'Task Alpha',
        description: null,
        status: 'todo',
        priority: 'critical',
        task_type: 'study',
        goal_id: null,
        milestone_id: null,
        project_id: null,
        project_milestone_id: null,
        application_id: null,
        estimated_minutes: null,
        actual_minutes: null,
        due_at: null,
        scheduled_start: null,
        scheduled_end: null,
        completed_at: null,
        notes: null,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      },
      {
        id: 't-2',
        user_id: userA,
        title: 'Task Beta',
        description: null,
        status: 'in_progress',
        priority: 'critical',
        task_type: 'study',
        goal_id: null,
        milestone_id: null,
        project_id: null,
        project_milestone_id: null,
        application_id: null,
        estimated_minutes: null,
        actual_minutes: null,
        due_at: null,
        scheduled_start: null,
        scheduled_end: null,
        completed_at: null,
        notes: null,
        created_at: '2026-10-02T00:00:00Z',
        updated_at: '2026-10-02T00:00:00Z',
      },
      {
        id: 't-3',
        user_id: userA,
        title: 'Task Gamma',
        description: null,
        status: 'todo',
        priority: 'low',
        task_type: 'study',
        goal_id: null,
        milestone_id: null,
        project_id: null,
        project_milestone_id: null,
        application_id: null,
        estimated_minutes: null,
        actual_minutes: null,
        due_at: null,
        scheduled_start: null,
        scheduled_end: null,
        completed_at: null,
        notes: null,
        created_at: '2026-10-03T00:00:00Z',
        updated_at: '2026-10-03T00:00:00Z',
      },
    ];

    const repo = new InMemoryTasksRepository(tasks, []);

    // Filter by priority = 'critical', blocked = false
    const res = await repo.findTasks({
      userId: userA,
      priority: 'critical',
      blocked: false,
      sortBy: 'created_at',
      sortOrder: 'desc',
      page: 1,
      pageSize: 10,
    });

    expect(res.data).toHaveLength(2);
    expect(res.data[0]?.id).toBe('t-2'); // desc sort: t-2 (Oct 2) > t-1 (Oct 1)
    expect(res.data[1]?.id).toBe('t-1');
    expect(res.pagination.total).toBe(2);
    expect(res.pagination.totalPages).toBe(1);
  });

  // ============================================================================
  // T9: Retrieve 2,500 task IDs across pages of 1,000, 1,000, and 500
  // ============================================================================
  it('T9: Paginated task-ID retrieval — retrieves 2,500 task IDs across pages of 1,000, 1,000, and 500 with deterministic ordering', async () => {
    const totalTasks = 2500;
    const taskIds = Array.from({ length: totalTasks }, (_, i) => `task-${String(i + 1).padStart(5, '0')}`);

    const taskQueryRanges: Array<{ from: number; to: number }> = [];
    const taskQueryOrders: Array<{ col: string; ascending?: boolean }> = [];

    const { client, executedQueries } = createMockSupabase({
      onTasksSelect: ({ range, order, eqUserId }) => {
        expect(eqUserId).toBe(userA);
        if (range) taskQueryRanges.push({ ...range });
        if (order) taskQueryOrders.push({ ...order });
        return {
          data: taskIds.map((id) => ({ id })),
          error: null,
        };
      },
      onDepsSelect: () => ({
        data: [],
        error: null,
      }),
    });

    const repo = new SupabaseTasksRepository(client);
    await repo.getAllUserDependencies(userA);

    // Verify task-ID query executed across 3 pages: 0-999, 1000-1999, 2000-2999
    expect(taskQueryRanges).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
      { from: 2000, to: 2999 },
    ]);

    // All pages used deterministic ordering by id ascending
    expect(taskQueryOrders).toEqual([
      { col: 'id', ascending: true },
      { col: 'id', ascending: true },
      { col: 'id', ascending: true },
    ]);

    // And dependency queries were chunked into batches of at most 500 for the 2,500 task IDs:
    // 2500 / 500 = 5 batches
    const depQueries = executedQueries.filter((q) => q.table === 'task_dependencies');
    expect(depQueries).toHaveLength(5);
    for (const dq of depQueries) {
      expect(dq.inFilter).toBeDefined();
      expect(dq.inFilter!.length).toBeLessThanOrEqual(500);
    }
  });

  // ============================================================================
  // T10: Retrieve 1,500 dependency rows across pages of 1,000 and 500
  // ============================================================================
  it('T10: Paginated dependency retrieval — retrieves 1,500 dependency rows across pages of 1,000 and 500, preserving ownership checks and blocked status', async () => {
    const userATasks = [{ id: 'task-a1' }];

    // 1,500 dependency rows for task-a1:
    // 1,499 are valid userA prerequisites (uncompleted -> task-a1 is blocked)
    // 1 is a cross-tenant row (pointing to userB prerequisite) to prove ownership checks remain active across pages
    const totalDeps = 1500;
    const allDepRows = Array.from({ length: totalDeps }, (_, i) => {
      if (i === 1200) {
        // Cross-tenant row on page 2!
        return {
          id: `dep-${i + 1}`,
          task_id: 'task-a1',
          task: { user_id: userA },
          prerequisite: { id: `foreign-prereq`, status: 'in_progress', user_id: userB },
        };
      }
      return {
        id: `dep-${i + 1}`,
        task_id: 'task-a1',
        task: { user_id: userA },
        prerequisite: { id: `prereq-${i + 1}`, status: 'in_progress', user_id: userA },
      };
    });

    const depQueryRanges: Array<{ from: number; to: number }> = [];
    const depQueryOrders: Array<{ col: string; ascending?: boolean }> = [];

    const { client } = createMockSupabase({
      onTasksSelect: () => ({
        data: userATasks,
        error: null,
      }),
      onDepsSelect: ({ range, order, inTaskIds }) => {
        expect(inTaskIds).toEqual(['task-a1']);
        if (range) depQueryRanges.push({ ...range });
        if (order) depQueryOrders.push({ ...order });
        return {
          data: allDepRows,
          error: null,
        };
      },
      onTasksMainQuery: ({ inIds }) => {
        // Should receive task-a1 in inIds because task-a1 is blocked
        expect(inIds).toEqual(['task-a1']);
        return {
          data: [{ id: 'task-a1', user_id: userA, title: 'Task A1', status: 'todo' }],
          count: 1,
          error: null,
        };
      },
    });

    const repo = new SupabaseTasksRepository(client);
    const result = await repo.findTasks({ userId: userA, blocked: true });

    // Verify pagination across pages of 1,000 and 500
    expect(depQueryRanges).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);

    // Verify deterministic ordering on dependency queries
    expect(depQueryOrders).toEqual([
      { col: 'id', ascending: true },
      { col: 'id', ascending: true },
    ]);

    // Verify result is correctly returned as blocked
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe('task-a1');
  });

  // ============================================================================
  // T11: Handle exactly 1,000 task IDs, fetch empty next page and terminate
  // ============================================================================
  it('T11: Exact page boundary handling — handles exactly 1,000 task IDs, fetches empty next page, and safely terminates', async () => {
    const exactly1000Tasks = Array.from({ length: 1000 }, (_, i) => ({
      id: `task-${String(i + 1).padStart(4, '0')}`,
    }));

    const taskQueryRanges: Array<{ from: number; to: number }> = [];

    const { client } = createMockSupabase({
      onTasksSelect: ({ range }) => {
        if (range) taskQueryRanges.push({ ...range });
        return {
          data: exactly1000Tasks,
          error: null,
        };
      },
      onDepsSelect: () => ({
        data: [],
        error: null,
      }),
    });

    const repo = new SupabaseTasksRepository(client);
    const deps = await repo.getAllUserDependencies(userA);

    // Exactly 2 queries:
    // Page 1: [0, 999] returns 1,000 items
    // Page 2: [1000, 1999] returns 0 items (empty next page)
    // Terminates safely without further requests
    expect(taskQueryRanges).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
    ]);
    expect(deps).toEqual([]);
  });

  // ============================================================================
  // T12: Propagate database error on page two without returning incomplete results
  // ============================================================================
  it('T12: Error propagation — propagates database error on page two without returning incomplete results', async () => {
    const { client } = createMockSupabase({
      onTasksSelect: ({ range }) => {
        if (range?.from === 0) {
          // Page 1 succeeds with 1,000 items
          return {
            data: Array.from({ length: 1000 }, (_, i) => ({ id: `task-${i + 1}` })),
            error: null,
          };
        }
        // Page 2 fails with a database error
        return {
          data: null,
          error: { message: 'Connection timeout on page 2' },
        };
      },
    });

    const repo = new SupabaseTasksRepository(client);

    // Expect fetchAllUserTaskIds to immediately propagate error
    await expect(repo.getAllUserDependencies(userA)).rejects.toThrow(
      'Failed to retrieve user task IDs: Connection timeout on page 2'
    );

    // Also verify error propagation for dependency page 2
    const { client: clientDepErr } = createMockSupabase({
      onTasksSelect: () => ({
        data: [{ id: 'task-1' }],
        error: null,
      }),
      onDepsSelect: ({ range }) => {
        if (range?.from === 0) {
          // Page 1 succeeds with 1,000 dependencies
          return {
            data: Array.from({ length: 1000 }, (_, i) => ({
              id: `dep-${i + 1}`,
              task_id: 'task-1',
              depends_on_task_id: 'task-2',
              task: { user_id: userA },
              prerequisite: { user_id: userA },
            })),
            error: null,
          };
        }
        // Page 2 fails
        return {
          data: null,
          error: { message: 'Dependency query failed on page 2' },
        };
      },
    });

    const repoDepErr = new SupabaseTasksRepository(clientDepErr);
    await expect(repoDepErr.getAllUserDependencies(userA)).rejects.toThrow(
      'Failed to get all dependencies: Dependency query failed on page 2'
    );
  });
});
