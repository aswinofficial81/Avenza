import type {
  GoalRow,
  GoalInsert,
  GoalUpdate,
  GoalMilestoneRow,
  GoalMilestoneInsert,
  GoalMilestoneUpdate,
  PaginatedList,
  Database,
} from '@avenza/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../../db/supabase.client';
import type { GoalFindOptions, IGoalsRepository } from './goals.types';

export class SupabaseGoalsRepository implements IGoalsRepository {
  constructor(private readonly client: SupabaseClient<Database> = getSupabaseAdminClient()) {}

  async findGoals(options: GoalFindOptions): Promise<PaginatedList<GoalRow>> {
    const { userId, status, goal_type, priority, search } = options;
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'desc';

    let query = this.client
      .from('goals')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (status) {
      query = query.eq('status', status);
    }
    if (goal_type) {
      query = query.eq('goal_type', goal_type);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }
    if (search && search.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }

    const orderAsc = sortOrder === 'asc';
    query = query.order(sortBy, { ascending: orderAsc });

    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;
    if (error) {
      throw new Error(`Failed to list goals: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data: (data as GoalRow[]) || [],
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async findGoalById(id: string, userId: string): Promise<GoalRow | null> {
    const { data, error } = await this.client
      .from('goals')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find goal: ${error.message}`);
    }

    return (data as GoalRow | null) || null;
  }

  async createGoal(data: GoalInsert): Promise<GoalRow> {
    const { data: created, error } = await this.client
      .from('goals')
      .insert({
        user_id: data.user_id,
        title: data.title,
        description: data.description ?? null,
        goal_type: data.goal_type,
        status: data.status ?? 'draft',
        priority: data.priority ?? 'medium',
        start_date: data.start_date ?? null,
        target_date: data.target_date ?? null,
        completed_at: data.completed_at ?? null,
        desired_outcome: data.desired_outcome ?? null,
        completion_criteria: data.completion_criteria ?? null,
        notes: data.notes ?? null,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create goal: ${error.message}`);
    }

    return created as GoalRow;
  }

  async updateGoal(id: string, userId: string, data: GoalUpdate): Promise<GoalRow | null> {
    const updatePayload: GoalUpdate = {};

    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.goal_type !== undefined) updatePayload.goal_type = data.goal_type;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.priority !== undefined) updatePayload.priority = data.priority;
    if (data.start_date !== undefined) updatePayload.start_date = data.start_date;
    if (data.target_date !== undefined) updatePayload.target_date = data.target_date;
    if (data.completed_at !== undefined) updatePayload.completed_at = data.completed_at;
    if (data.desired_outcome !== undefined) updatePayload.desired_outcome = data.desired_outcome;
    if (data.completion_criteria !== undefined) updatePayload.completion_criteria = data.completion_criteria;
    if (data.notes !== undefined) updatePayload.notes = data.notes;

    const { data: updated, error } = await this.client
      .from('goals')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update goal: ${error.message}`);
    }

    return (updated as GoalRow | null) || null;
  }

  async deleteGoal(id: string, userId: string): Promise<boolean> {
    const { error, count } = await this.client
      .from('goals')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete goal: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  async findMilestonesByGoalId(goalId: string, userId: string): Promise<GoalMilestoneRow[]> {
    // Verify goal ownership first
    const goal = await this.findGoalById(goalId, userId);
    if (!goal) return [];

    const { data, error } = await this.client
      .from('goal_milestones')
      .select('*')
      .eq('goal_id', goalId)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to list milestones: ${error.message}`);
    }

    return (data as GoalMilestoneRow[]) || [];
  }

  async findMilestoneById(milestoneId: string, goalId: string, userId: string): Promise<GoalMilestoneRow | null> {
    // Verify goal ownership first
    const goal = await this.findGoalById(goalId, userId);
    if (!goal) return null;

    const { data, error } = await this.client
      .from('goal_milestones')
      .select('*')
      .eq('id', milestoneId)
      .eq('goal_id', goalId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find milestone: ${error.message}`);
    }

    return (data as GoalMilestoneRow | null) || null;
  }

  async createMilestone(data: GoalMilestoneInsert, userId: string): Promise<GoalMilestoneRow> {
    // Verify goal ownership
    const goal = await this.findGoalById(data.goal_id, userId);
    if (!goal) {
      throw new Error('Parent goal not found or unauthorized');
    }

    const { data: created, error } = await this.client
      .from('goal_milestones')
      .insert({
        goal_id: data.goal_id,
        title: data.title,
        description: data.description ?? null,
        status: data.status ?? 'pending',
        priority: data.priority ?? 'medium',
        order_index: data.order_index ?? 0,
        start_date: data.start_date ?? null,
        target_date: data.target_date ?? null,
        completed_at: data.completed_at ?? null,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create milestone: ${error.message}`);
    }

    return created as GoalMilestoneRow;
  }

  async updateMilestone(
    milestoneId: string,
    goalId: string,
    userId: string,
    data: GoalMilestoneUpdate
  ): Promise<GoalMilestoneRow | null> {
    // Verify goal ownership
    const goal = await this.findGoalById(goalId, userId);
    if (!goal) {
      return null;
    }

    const updatePayload: GoalMilestoneUpdate = {};
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.priority !== undefined) updatePayload.priority = data.priority;
    if (data.order_index !== undefined) updatePayload.order_index = data.order_index;
    if (data.start_date !== undefined) updatePayload.start_date = data.start_date;
    if (data.target_date !== undefined) updatePayload.target_date = data.target_date;
    if (data.completed_at !== undefined) updatePayload.completed_at = data.completed_at;

    const { data: updated, error } = await this.client
      .from('goal_milestones')
      .update(updatePayload)
      .eq('id', milestoneId)
      .eq('goal_id', goalId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update milestone: ${error.message}`);
    }

    return (updated as GoalMilestoneRow | null) || null;
  }

  async deleteMilestone(milestoneId: string, goalId: string, userId: string): Promise<boolean> {
    // Verify goal ownership
    const goal = await this.findGoalById(goalId, userId);
    if (!goal) {
      return false;
    }

    const { error, count } = await this.client
      .from('goal_milestones')
      .delete({ count: 'exact' })
      .eq('id', milestoneId)
      .eq('goal_id', goalId);

    if (error) {
      throw new Error(`Failed to delete milestone: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  async getMilestoneSummariesForGoals(
    goalIds: string[]
  ): Promise<Map<string, { total: number; completed: number; overdueCount: number }>> {
    const summaryMap = new Map<string, { total: number; completed: number; overdueCount: number }>();
    for (const gid of goalIds) {
      summaryMap.set(gid, { total: 0, completed: 0, overdueCount: 0 });
    }

    if (goalIds.length === 0) {
      return summaryMap;
    }

    const { data, error } = await this.client
      .from('goal_milestones')
      .select('goal_id, status, target_date')
      .in('goal_id', goalIds);

    if (error) {
      throw new Error(`Failed to load milestone summaries: ${error.message}`);
    }

    const now = Date.now();
    for (const row of data || []) {
      const summary = summaryMap.get(row.goal_id);
      if (summary) {
        summary.total += 1;
        if (row.status === 'completed') {
          summary.completed += 1;
        }
        if (
          row.status !== 'completed' &&
          row.status !== 'skipped' &&
          row.target_date &&
          new Date(row.target_date).getTime() < now
        ) {
          summary.overdueCount += 1;
        }
      }
    }

    return summaryMap;
  }
}

export class InMemoryGoalsRepository implements IGoalsRepository {
  private goals = new Map<string, GoalRow>();
  private milestones = new Map<string, GoalMilestoneRow>();

  async findGoals(options: GoalFindOptions): Promise<PaginatedList<GoalRow>> {
    let list = Array.from(this.goals.values()).filter((g) => g.user_id === options.userId);

    if (options.status) {
      list = list.filter((g) => g.status === options.status);
    }
    if (options.goal_type) {
      list = list.filter((g) => g.goal_type === options.goal_type);
    }
    if (options.priority) {
      list = list.filter((g) => g.priority === options.priority);
    }
    if (options.search && options.search.trim()) {
      const query = options.search.trim().toLowerCase();
      list = list.filter((g) => g.title.toLowerCase().includes(query));
    }

    // Sort
    const sortField = options.sortBy || 'created_at';
    const isAsc = options.sortOrder === 'asc';
    list.sort((a, b) => {
      const valA = a[sortField as keyof GoalRow] ?? '';
      const valB = b[sortField as keyof GoalRow] ?? '';
      if (valA < valB) return isAsc ? -1 : 1;
      if (valA > valB) return isAsc ? 1 : -1;
      return 0;
    });

    const total = list.length;
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const offset = (page - 1) * pageSize;
    const paged = list.slice(offset, offset + pageSize);

    return {
      data: paged.map((g) => ({ ...g })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async findGoalById(id: string, userId: string): Promise<GoalRow | null> {
    const goal = this.goals.get(id);
    if (!goal || goal.user_id !== userId) return null;
    return { ...goal };
  }

  async createGoal(data: GoalInsert): Promise<GoalRow> {
    const now = new Date().toISOString();
    const newGoal: GoalRow = {
      id: data.id || crypto.randomUUID(),
      user_id: data.user_id,
      title: data.title,
      description: data.description ?? null,
      goal_type: data.goal_type,
      status: data.status ?? 'draft',
      priority: data.priority ?? 'medium',
      start_date: data.start_date ?? null,
      target_date: data.target_date ?? null,
      completed_at: data.completed_at ?? null,
      desired_outcome: data.desired_outcome ?? null,
      completion_criteria: data.completion_criteria ?? null,
      notes: data.notes ?? null,
      created_at: data.created_at || now,
      updated_at: data.updated_at || now,
    };
    this.goals.set(newGoal.id, newGoal);
    return { ...newGoal };
  }

  async updateGoal(id: string, userId: string, data: GoalUpdate): Promise<GoalRow | null> {
    const goal = this.goals.get(id);
    if (!goal || goal.user_id !== userId) return null;

    const updated: GoalRow = {
      ...goal,
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.goal_type !== undefined ? { goal_type: data.goal_type } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.start_date !== undefined ? { start_date: data.start_date } : {}),
      ...(data.target_date !== undefined ? { target_date: data.target_date } : {}),
      ...(data.completed_at !== undefined ? { completed_at: data.completed_at } : {}),
      ...(data.desired_outcome !== undefined ? { desired_outcome: data.desired_outcome } : {}),
      ...(data.completion_criteria !== undefined ? { completion_criteria: data.completion_criteria } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      updated_at: new Date().toISOString(),
    };

    this.goals.set(id, updated);
    return { ...updated };
  }

  async deleteGoal(id: string, userId: string): Promise<boolean> {
    const goal = this.goals.get(id);
    if (!goal || goal.user_id !== userId) return false;

    this.goals.delete(id);
    // Cascade delete milestones
    for (const [msId, ms] of this.milestones.entries()) {
      if (ms.goal_id === id) {
        this.milestones.delete(msId);
      }
    }
    return true;
  }

  async findMilestonesByGoalId(goalId: string, userId: string): Promise<GoalMilestoneRow[]> {
    const goal = await this.findGoalById(goalId, userId);
    if (!goal) return [];

    return Array.from(this.milestones.values())
      .filter((m) => m.goal_id === goalId)
      .sort((a, b) => a.order_index - b.order_index)
      .map((m) => ({ ...m }));
  }

  async findMilestoneById(milestoneId: string, goalId: string, userId: string): Promise<GoalMilestoneRow | null> {
    const goal = await this.findGoalById(goalId, userId);
    if (!goal) return null;

    const ms = this.milestones.get(milestoneId);
    if (!ms || ms.goal_id !== goalId) return null;
    return { ...ms };
  }

  async createMilestone(data: GoalMilestoneInsert, userId: string): Promise<GoalMilestoneRow> {
    const goal = await this.findGoalById(data.goal_id, userId);
    if (!goal) {
      throw new Error('Parent goal not found or unauthorized');
    }

    const now = new Date().toISOString();
    const newMs: GoalMilestoneRow = {
      id: data.id || crypto.randomUUID(),
      goal_id: data.goal_id,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? 'pending',
      priority: data.priority ?? 'medium',
      order_index: data.order_index ?? 0,
      start_date: data.start_date ?? null,
      target_date: data.target_date ?? null,
      completed_at: data.completed_at ?? null,
      created_at: data.created_at || now,
      updated_at: data.updated_at || now,
    };

    this.milestones.set(newMs.id, newMs);
    return { ...newMs };
  }

  async updateMilestone(
    milestoneId: string,
    goalId: string,
    userId: string,
    data: GoalMilestoneUpdate
  ): Promise<GoalMilestoneRow | null> {
    const goal = await this.findGoalById(goalId, userId);
    if (!goal) return null;

    const ms = this.milestones.get(milestoneId);
    if (!ms || ms.goal_id !== goalId) return null;

    const updated: GoalMilestoneRow = {
      ...ms,
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.order_index !== undefined ? { order_index: data.order_index } : {}),
      ...(data.start_date !== undefined ? { start_date: data.start_date } : {}),
      ...(data.target_date !== undefined ? { target_date: data.target_date } : {}),
      ...(data.completed_at !== undefined ? { completed_at: data.completed_at } : {}),
      updated_at: new Date().toISOString(),
    };

    this.milestones.set(milestoneId, updated);
    return { ...updated };
  }

  async deleteMilestone(milestoneId: string, goalId: string, userId: string): Promise<boolean> {
    const goal = await this.findGoalById(goalId, userId);
    if (!goal) return false;

    const ms = this.milestones.get(milestoneId);
    if (!ms || ms.goal_id !== goalId) return false;

    this.milestones.delete(milestoneId);
    return true;
  }

  async getMilestoneSummariesForGoals(
    goalIds: string[]
  ): Promise<Map<string, { total: number; completed: number; overdueCount: number }>> {
    const summaryMap = new Map<string, { total: number; completed: number; overdueCount: number }>();
    for (const gid of goalIds) {
      summaryMap.set(gid, { total: 0, completed: 0, overdueCount: 0 });
    }

    const now = Date.now();
    for (const ms of this.milestones.values()) {
      if (summaryMap.has(ms.goal_id)) {
        const s = summaryMap.get(ms.goal_id)!;
        s.total += 1;
        if (ms.status === 'completed') {
          s.completed += 1;
        }
        if (
          ms.status !== 'completed' &&
          ms.status !== 'skipped' &&
          ms.target_date &&
          new Date(ms.target_date).getTime() < now
        ) {
          s.overdueCount += 1;
        }
      }
    }

    return summaryMap;
  }
}

export const defaultGoalsRepository = new SupabaseGoalsRepository();
