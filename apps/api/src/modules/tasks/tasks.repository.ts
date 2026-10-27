import type {
  TaskRow,
  TaskInsert,
  TaskUpdate,
  TaskDependencyRow,
  TaskDependencyInsert,
  PaginatedList,
  Database,
  TaskStatus,
} from '@avenza/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { getSupabaseAdminClient } from '../../db/supabase.client';
import type {
  DependencyWithPrerequisiteTask,
  ITasksRepository,
  TaskFindOptions,
} from './tasks.types';

interface SupabaseDepCheckRow {
  task_id: string;
  task: { user_id: string } | null;
  prerequisite: { id: string; status: TaskStatus; user_id: string } | null;
}

interface SupabaseDepListRow {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  created_at: string;
  task: { user_id: string } | null;
  prerequisite: { id: string; title: string; status: TaskStatus; user_id: string } | null;
}

interface SupabaseDependentRow {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  created_at: string;
  task: { user_id: string } | null;
}

interface SupabaseAllDepRow {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  task: { user_id: string } | null;
  prerequisite?: { user_id: string } | null;
}

interface SupabaseDepLookupRow {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  created_at: string;
  task: { user_id: string } | null;
}

interface SupabaseDepSummaryRow {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  task: { user_id: string } | null;
  prerequisite: { id: string; title: string; status: TaskStatus; user_id: string } | null;
}

export class SupabaseTasksRepository implements ITasksRepository {
  constructor(private readonly client: SupabaseClient<Database> = getSupabaseAdminClient()) {}

  private async fetchAllUserTaskIds(userId: string): Promise<string[]> {
    const PAGE_SIZE = 1000;
    let offset = 0;
    const taskIds: string[] = [];

    while (true) {
      const { data, error } = await this.client
        .from('tasks')
        .select('id')
        .eq('user_id', userId)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        throw new Error(`Failed to retrieve user task IDs: ${error.message}`);
      }

      if (!data || data.length === 0) {
        break;
      }

      for (const t of data) {
        taskIds.push(t.id);
      }

      if (data.length < PAGE_SIZE) {
        break;
      }

      offset += PAGE_SIZE;
    }

    return taskIds;
  }

  async findTasks(options: TaskFindOptions): Promise<PaginatedList<TaskRow>> {
    const {
      userId,
      status,
      priority,
      task_type,
      goal_id,
      milestone_id,
      search,
      due_before,
      due_after,
      scheduled_before,
      scheduled_after,
      blocked,
    } = options;

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'desc';

    // If blocked filter is specified, pre-calculate blocked task IDs
    let blockedTaskIds: string[] | null = null;
    if (blocked !== undefined) {
      // 1. Retrieve all task IDs belonging to the requesting user via paginated retrieval
      const userTaskIds = await this.fetchAllUserTaskIds(userId);

      const blockedSet = new Set<string>();

      // 2. Query task_dependencies only for user-owned tasks, in safe batches of at most 500 IDs with pagination
      if (userTaskIds.length > 0) {
        const BATCH_SIZE = 500;
        const DEP_PAGE_SIZE = 1000;
        for (let i = 0; i < userTaskIds.length; i += BATCH_SIZE) {
          const batch = userTaskIds.slice(i, i + BATCH_SIZE);
          let depOffset = 0;

          while (true) {
            const { data: depRows, error: depError } = await this.client
              .from('task_dependencies')
              .select(`
                task_id,
                task:tasks!task_id(user_id),
                prerequisite:tasks!depends_on_task_id(id, status, user_id)
              `)
              .in('task_id', batch)
              .order('id', { ascending: true })
              .range(depOffset, depOffset + DEP_PAGE_SIZE - 1);

            if (depError) {
              throw new Error(`Failed to check blocked dependencies: ${depError.message}`);
            }

            if (!depRows || depRows.length === 0) {
              break;
            }

            for (const row of depRows as unknown as SupabaseDepCheckRow[]) {
              // Verify BOTH dependent task and prerequisite belong to the requesting user
              if (row.task?.user_id === userId && row.prerequisite?.user_id === userId) {
                if (row.prerequisite.status !== 'completed') {
                  blockedSet.add(row.task_id);
                }
              }
            }

            if (depRows.length < DEP_PAGE_SIZE) {
              break;
            }

            depOffset += DEP_PAGE_SIZE;
          }
        }
      }

      blockedTaskIds = Array.from(blockedSet);
    }

    let query = this.client
      .from('tasks')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (status) {
      query = query.eq('status', status);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }
    if (task_type) {
      query = query.eq('task_type', task_type);
    }
    if (goal_id) {
      query = query.eq('goal_id', goal_id);
    }
    if (milestone_id) {
      query = query.eq('milestone_id', milestone_id);
    }
    if (options.project_id) {
      query = query.eq('project_id', options.project_id);
    }
    if (options.project_milestone_id) {
      query = query.eq('project_milestone_id', options.project_milestone_id);
    }
    if (options.application_id) {
      query = query.eq('application_id', options.application_id);
    }
    if (search && search.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }
    if (due_before) {
      query = query.lte('due_at', due_before);
    }
    if (due_after) {
      query = query.gte('due_at', due_after);
    }
    if (scheduled_before) {
      query = query.lte('scheduled_start', scheduled_before);
    }
    if (scheduled_after) {
      query = query.gte('scheduled_start', scheduled_after);
    }

    if (blocked !== undefined && blockedTaskIds !== null) {
      if (blocked) {
        if (blockedTaskIds.length === 0) {
          // No tasks are blocked
          return {
            data: [],
            pagination: { page, pageSize, total: 0, totalPages: 1 },
          };
        }
        query = query.in('id', blockedTaskIds);
      } else {
        if (blockedTaskIds.length > 0) {
          // Not blocked
          query = query.not('id', 'in', `(${blockedTaskIds.join(',')})`);
        }
      }
    }

    const orderAsc = sortOrder === 'asc';
    query = query.order(sortBy, { ascending: orderAsc });

    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;
    if (error) {
      throw new Error(`Failed to list tasks: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data: (data as TaskRow[]) || [],
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async findTaskById(id: string, userId: string): Promise<TaskRow | null> {
    const { data, error } = await this.client
      .from('tasks')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find task: ${error.message}`);
    }

    return (data as TaskRow | null) || null;
  }

  async createTask(data: TaskInsert): Promise<TaskRow> {
    const { data: created, error } = await this.client
      .from('tasks')
      .insert({
        user_id: data.user_id,
        title: data.title,
        description: data.description ?? null,
        status: data.status ?? 'inbox',
        priority: data.priority ?? 'medium',
        task_type: data.task_type ?? 'personal',
        goal_id: data.goal_id ?? null,
        milestone_id: data.milestone_id ?? null,
        estimated_minutes: data.estimated_minutes ?? null,
        actual_minutes: data.actual_minutes ?? null,
        due_at: data.due_at ?? null,
        scheduled_start: data.scheduled_start ?? null,
        scheduled_end: data.scheduled_end ?? null,
        completed_at: data.completed_at ?? null,
        notes: data.notes ?? null,
      })
      .select('*')
      .single();

    if (error || !created) {
      throw new Error(`Failed to create task: ${error?.message || 'Unknown error'}`);
    }

    return created as TaskRow;
  }

  async updateTask(id: string, userId: string, data: TaskUpdate): Promise<TaskRow | null> {
    const { data: updated, error } = await this.client
      .from('tasks')
      .update(data)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update task: ${error.message}`);
    }

    return (updated as TaskRow | null) || null;
  }

  async deleteTask(id: string, userId: string): Promise<boolean> {
    const { error, count } = await this.client
      .from('tasks')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete task: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  async findDependenciesByTaskId(taskId: string, userId: string): Promise<DependencyWithPrerequisiteTask[]> {
    // Return dependencies where task_id = taskId, joined with prerequisite task details
    const { data, error } = await this.client
      .from('task_dependencies')
      .select(`
        id,
        task_id,
        depends_on_task_id,
        created_at,
        task:tasks!task_id(user_id),
        prerequisite:tasks!depends_on_task_id(id, title, status, user_id)
      `)
      .eq('task_id', taskId);

    if (error) {
      throw new Error(`Failed to find task dependencies: ${error.message}`);
    }

    if (!data) return [];

    return (data as unknown as SupabaseDepListRow[])
      .filter((d) => d.task?.user_id === userId && d.prerequisite?.user_id === userId)
      .map((d) => ({
        id: d.id,
        task_id: d.task_id,
        depends_on_task_id: d.depends_on_task_id,
        created_at: d.created_at,
        prerequisite: {
          id: d.prerequisite!.id,
          title: d.prerequisite!.title,
          status: d.prerequisite!.status,
        },
      }));
  }

  async findDependentsByTaskId(taskId: string, userId: string): Promise<TaskDependencyRow[]> {
    const { data, error } = await this.client
      .from('task_dependencies')
      .select(`
        id,
        task_id,
        depends_on_task_id,
        created_at,
        task:tasks!task_id(user_id)
      `)
      .eq('depends_on_task_id', taskId);

    if (error) {
      throw new Error(`Failed to find dependents: ${error.message}`);
    }

    if (!data) return [];

    return (data as unknown as SupabaseDependentRow[])
      .filter((d) => d.task?.user_id === userId)
      .map((d) => ({
        id: d.id,
        task_id: d.task_id,
        depends_on_task_id: d.depends_on_task_id,
        created_at: d.created_at,
      }));
  }

  async getAllUserDependencies(
    userId: string
  ): Promise<Array<{ id: string; task_id: string; depends_on_task_id: string }>> {
    // 1. Retrieve all task IDs belonging to the requesting user via paginated retrieval
    const userTaskIds = await this.fetchAllUserTaskIds(userId);

    if (userTaskIds.length === 0) {
      return [];
    }

    const results: Array<{ id: string; task_id: string; depends_on_task_id: string }> = [];
    const BATCH_SIZE = 500;
    const DEP_PAGE_SIZE = 1000;

    // 2. Query task_dependencies only for user-owned tasks, in safe batches of at most 500 IDs with pagination
    for (let i = 0; i < userTaskIds.length; i += BATCH_SIZE) {
      const batch = userTaskIds.slice(i, i + BATCH_SIZE);
      let depOffset = 0;

      while (true) {
        const { data, error } = await this.client
          .from('task_dependencies')
          .select(`
            id,
            task_id,
            depends_on_task_id,
            task:tasks!task_id(user_id),
            prerequisite:tasks!depends_on_task_id(user_id)
          `)
          .in('task_id', batch)
          .order('id', { ascending: true })
          .range(depOffset, depOffset + DEP_PAGE_SIZE - 1);

        if (error) {
          throw new Error(`Failed to get all dependencies: ${error.message}`);
        }

        if (!data || data.length === 0) {
          break;
        }

        for (const d of data as unknown as SupabaseAllDepRow[]) {
          // Verify both dependent task and prerequisite belong to the requesting user
          if (d.task?.user_id === userId && d.prerequisite?.user_id === userId) {
            results.push({
              id: d.id,
              task_id: d.task_id,
              depends_on_task_id: d.depends_on_task_id,
            });
          }
        }

        if (data.length < DEP_PAGE_SIZE) {
          break;
        }

        depOffset += DEP_PAGE_SIZE;
      }
    }

    return results;
  }

  async createDependency(data: TaskDependencyInsert, userId: string): Promise<TaskDependencyRow> {
    // Verify both tasks belong to user
    const [t1, t2] = await Promise.all([
      this.findTaskById(data.task_id, userId),
      this.findTaskById(data.depends_on_task_id, userId),
    ]);

    if (!t1 || !t2) {
      throw new Error('Both tasks must exist and belong to the authenticated user.');
    }

    const { data: created, error } = await this.client
      .from('task_dependencies')
      .insert({
        task_id: data.task_id,
        depends_on_task_id: data.depends_on_task_id,
      })
      .select('*')
      .single();

    if (error || !created) {
      throw new Error(`Failed to create task dependency: ${error?.message || 'Unknown error'}`);
    }

    return created as TaskDependencyRow;
  }

  async deleteDependency(dependencyId: string, taskId: string, userId: string): Promise<boolean> {
    // Ensure task belongs to user
    const task = await this.findTaskById(taskId, userId);
    if (!task) return false;

    const { error, count } = await this.client
      .from('task_dependencies')
      .delete({ count: 'exact' })
      .eq('id', dependencyId)
      .eq('task_id', taskId);

    if (error) {
      throw new Error(`Failed to delete dependency: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  async findDependencyById(dependencyId: string, userId: string): Promise<TaskDependencyRow | null> {
    const { data, error } = await this.client
      .from('task_dependencies')
      .select(`
        id,
        task_id,
        depends_on_task_id,
        created_at,
        task:tasks!task_id(user_id)
      `)
      .eq('id', dependencyId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find dependency: ${error.message}`);
    }

    if (!data || (data as unknown as SupabaseDepLookupRow).task?.user_id !== userId) {
      return null;
    }

    return {
      id: data.id,
      task_id: data.task_id,
      depends_on_task_id: data.depends_on_task_id,
      created_at: data.created_at,
    };
  }

  async getDependencySummariesForTasks(
    taskIds: string[],
    userId: string
  ): Promise<
    Map<
      string,
      {
        totalPrerequisites: number;
        uncompletedPrerequisites: number;
        blockedBy: Array<{ id: string; title: string; status: TaskStatus }>;
      }
    >
  > {
    const map = new Map<
      string,
      {
        totalPrerequisites: number;
        uncompletedPrerequisites: number;
        blockedBy: Array<{ id: string; title: string; status: TaskStatus }>;
      }
    >();

    if (taskIds.length === 0) return map;

    // Initialize all tasks with 0
    for (const id of taskIds) {
      map.set(id, { totalPrerequisites: 0, uncompletedPrerequisites: 0, blockedBy: [] });
    }

    const { data, error } = await this.client
      .from('task_dependencies')
      .select(`
        id,
        task_id,
        depends_on_task_id,
        task:tasks!task_id(user_id),
        prerequisite:tasks!depends_on_task_id(id, title, status, user_id)
      `)
      .in('task_id', taskIds);

    if (error) {
      throw new Error(`Failed to get dependency summaries: ${error.message}`);
    }

    if (data) {
      for (const row of data as unknown as SupabaseDepSummaryRow[]) {
        if (row.task?.user_id === userId && row.prerequisite?.user_id === userId) {
          const entry = map.get(row.task_id);
          if (entry) {
            entry.totalPrerequisites += 1;
            if (row.prerequisite.status !== 'completed') {
              entry.uncompletedPrerequisites += 1;
              entry.blockedBy.push({
                id: row.prerequisite.id,
                title: row.prerequisite.title,
                status: row.prerequisite.status,
              });
            }
          }
        }
      }
    }

    return map;
  }
}

// In-memory implementation for unit testing
export class InMemoryTasksRepository implements ITasksRepository {
  private tasks: Map<string, TaskRow> = new Map();
  private dependencies: Map<string, TaskDependencyRow> = new Map();

  constructor(initialTasks: TaskRow[] = [], initialDeps: TaskDependencyRow[] = []) {
    for (const t of initialTasks) {
      this.tasks.set(t.id, { ...t });
    }
    for (const d of initialDeps) {
      this.dependencies.set(d.id, { ...d });
    }
  }

  getTasksMap(): Map<string, TaskRow> {
    return this.tasks;
  }

  async findTasks(options: TaskFindOptions): Promise<PaginatedList<TaskRow>> {
    const {
      userId,
      status,
      priority,
      task_type,
      goal_id,
      milestone_id,
      search,
      due_before,
      due_after,
      scheduled_before,
      scheduled_after,
      blocked,
    } = options;

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'desc';

    let list = Array.from(this.tasks.values()).filter((t) => t.user_id === userId);

    if (status) list = list.filter((t) => t.status === status);
    if (priority) list = list.filter((t) => t.priority === priority);
    if (task_type) list = list.filter((t) => t.task_type === task_type);
    if (goal_id) list = list.filter((t) => t.goal_id === goal_id);
    if (milestone_id) list = list.filter((t) => t.milestone_id === milestone_id);
    if (options.project_id) list = list.filter((t) => t.project_id === options.project_id);
    if (options.project_milestone_id) list = list.filter((t) => t.project_milestone_id === options.project_milestone_id);
    if (options.application_id) list = list.filter((t) => t.application_id === options.application_id);
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }
    if (due_before) list = list.filter((t) => t.due_at && t.due_at <= due_before);
    if (due_after) list = list.filter((t) => t.due_at && t.due_at >= due_after);
    if (scheduled_before) list = list.filter((t) => t.scheduled_start && t.scheduled_start <= scheduled_before);
    if (scheduled_after) list = list.filter((t) => t.scheduled_start && t.scheduled_start >= scheduled_after);

    if (blocked !== undefined) {
      list = list.filter((t) => {
        // check if t has uncompleted dependencies belonging to this user
        const taskDeps = Array.from(this.dependencies.values()).filter((d) => d.task_id === t.id);
        const isBlocked = taskDeps.some((d) => {
          const prereq = this.tasks.get(d.depends_on_task_id);
          return prereq && prereq.user_id === userId && prereq.status !== 'completed';
        });
        return blocked ? isBlocked : !isBlocked;
      });
    }

    list.sort((a, b) => {
      const field = sortBy as keyof TaskRow;
      const aVal = a[field] ?? '';
      const bVal = b[field] ?? '';
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = list.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const offset = (page - 1) * pageSize;
    const paginatedData = list.slice(offset, offset + pageSize);

    return {
      data: paginatedData,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async findTaskById(id: string, userId: string): Promise<TaskRow | null> {
    const task = this.tasks.get(id);
    if (!task || task.user_id !== userId) return null;
    return task;
  }

  async createTask(data: TaskInsert): Promise<TaskRow> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const task: TaskRow = {
      id,
      user_id: data.user_id,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? 'inbox',
      priority: data.priority ?? 'medium',
      task_type: data.task_type ?? 'personal',
      goal_id: data.goal_id ?? null,
      milestone_id: data.milestone_id ?? null,
      project_id: data.project_id ?? null,
      project_milestone_id: data.project_milestone_id ?? null,
      application_id: data.application_id ?? null,
      estimated_minutes: data.estimated_minutes ?? null,
      actual_minutes: data.actual_minutes ?? null,
      due_at: data.due_at ?? null,
      scheduled_start: data.scheduled_start ?? null,
      scheduled_end: data.scheduled_end ?? null,
      completed_at: data.completed_at ?? null,
      notes: data.notes ?? null,
      created_at: data.created_at || now,
      updated_at: data.updated_at || now,
    };
    this.tasks.set(id, task);
    return task;
  }

  async updateTask(id: string, userId: string, data: TaskUpdate): Promise<TaskRow | null> {
    const existing = await this.findTaskById(id, userId);
    if (!existing) return null;

    const updated: TaskRow = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: string, userId: string): Promise<boolean> {
    const existing = await this.findTaskById(id, userId);
    if (!existing) return false;

    this.tasks.delete(id);
    // Cascade delete dependencies
    for (const [depId, dep] of this.dependencies.entries()) {
      if (dep.task_id === id || dep.depends_on_task_id === id) {
        this.dependencies.delete(depId);
      }
    }
    return true;
  }

  async findDependenciesByTaskId(taskId: string, userId: string): Promise<DependencyWithPrerequisiteTask[]> {
    const task = await this.findTaskById(taskId, userId);
    if (!task) return [];

    const result: DependencyWithPrerequisiteTask[] = [];
    for (const dep of this.dependencies.values()) {
      if (dep.task_id === taskId) {
        const prereq = await this.findTaskById(dep.depends_on_task_id, userId);
        if (prereq) {
          result.push({
            id: dep.id,
            task_id: dep.task_id,
            depends_on_task_id: dep.depends_on_task_id,
            created_at: dep.created_at,
            prerequisite: {
              id: prereq.id,
              title: prereq.title,
              status: prereq.status as TaskStatus,
            },
          });
        }
      }
    }
    return result;
  }

  async findDependentsByTaskId(taskId: string, userId: string): Promise<TaskDependencyRow[]> {
    const task = await this.findTaskById(taskId, userId);
    if (!task) return [];

    const result: TaskDependencyRow[] = [];
    for (const dep of this.dependencies.values()) {
      if (dep.depends_on_task_id === taskId) {
        const dependentTask = await this.findTaskById(dep.task_id, userId);
        if (dependentTask) {
          result.push(dep);
        }
      }
    }
    return result;
  }

  async getAllUserDependencies(
    userId: string
  ): Promise<Array<{ id: string; task_id: string; depends_on_task_id: string }>> {
    const result: Array<{ id: string; task_id: string; depends_on_task_id: string }> = [];
    for (const dep of this.dependencies.values()) {
      const task = await this.findTaskById(dep.task_id, userId);
      const prereq = await this.findTaskById(dep.depends_on_task_id, userId);
      if (task && prereq) {
        result.push({
          id: dep.id,
          task_id: dep.task_id,
          depends_on_task_id: dep.depends_on_task_id,
        });
      }
    }
    return result;
  }

  async createDependency(data: TaskDependencyInsert, userId: string): Promise<TaskDependencyRow> {
    const [t1, t2] = await Promise.all([
      this.findTaskById(data.task_id, userId),
      this.findTaskById(data.depends_on_task_id, userId),
    ]);
    if (!t1 || !t2) {
      throw new Error('Both tasks must exist and belong to the authenticated user.');
    }

    const id = data.id || crypto.randomUUID();
    const dep: TaskDependencyRow = {
      id,
      task_id: data.task_id,
      depends_on_task_id: data.depends_on_task_id,
      created_at: data.created_at || new Date().toISOString(),
    };
    this.dependencies.set(id, dep);
    return dep;
  }

  async deleteDependency(dependencyId: string, taskId: string, userId: string): Promise<boolean> {
    const task = await this.findTaskById(taskId, userId);
    if (!task) return false;

    const dep = this.dependencies.get(dependencyId);
    if (!dep || dep.task_id !== taskId) return false;

    return this.dependencies.delete(dependencyId);
  }

  async findDependencyById(dependencyId: string, userId: string): Promise<TaskDependencyRow | null> {
    const dep = this.dependencies.get(dependencyId);
    if (!dep) return null;
    const task = await this.findTaskById(dep.task_id, userId);
    if (!task) return null;
    return dep;
  }

  async getDependencySummariesForTasks(
    taskIds: string[],
    userId: string
  ): Promise<
    Map<
      string,
      {
        totalPrerequisites: number;
        uncompletedPrerequisites: number;
        blockedBy: Array<{ id: string; title: string; status: TaskStatus }>;
      }
    >
  > {
    const map = new Map<
      string,
      {
        totalPrerequisites: number;
        uncompletedPrerequisites: number;
        blockedBy: Array<{ id: string; title: string; status: TaskStatus }>;
      }
    >();

    for (const id of taskIds) {
      map.set(id, { totalPrerequisites: 0, uncompletedPrerequisites: 0, blockedBy: [] });
    }

    for (const dep of this.dependencies.values()) {
      if (taskIds.includes(dep.task_id)) {
        const prereq = await this.findTaskById(dep.depends_on_task_id, userId);
        if (prereq) {
          const entry = map.get(dep.task_id)!;
          entry.totalPrerequisites += 1;
          if (prereq.status !== 'completed') {
            entry.uncompletedPrerequisites += 1;
            entry.blockedBy.push({
              id: prereq.id,
              title: prereq.title,
              status: prereq.status as TaskStatus,
            });
          }
        }
      }
    }

    return map;
  }
}

export const defaultTasksRepository: ITasksRepository = new SupabaseTasksRepository();
