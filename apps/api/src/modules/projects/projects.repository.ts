import type {
  Database,
  Json,
  PaginatedList,
  ProjectGoalRow,
  ProjectInsert,
  ProjectMilestoneInsert,
  ProjectMilestoneRow,
  ProjectMilestoneUpdate,
  ProjectRow,
  ProjectSkillRow,
  ProjectUpdate,
  TaskRow,
} from '@avenza/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../../db/supabase.client';
import type {
  ExternalActivityRow,
  ExternalRepositoryRow,
  IProjectsRepository,
  ProjectCountsSummary,
  ProjectFindOptions,
  ProjectGoalWithTitle,
  ProjectSkillWithName,
} from './projects.types';

export type { IProjectsRepository, ExternalRepositoryRow } from './projects.types';

export class SupabaseProjectsRepository implements IProjectsRepository {
  constructor(private readonly client: SupabaseClient<Database> = getSupabaseAdminClient()) {}

  async findProjects(options: ProjectFindOptions): Promise<PaginatedList<ProjectRow>> {
    const { userId, status, priority, project_type, search } = options;
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'desc';

    let query = this.client
      .from('projects')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (status) {
      query = query.eq('status', status);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }
    if (project_type) {
      query = query.eq('project_type', project_type);
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
      throw new Error(`Failed to list projects: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data: (data as ProjectRow[]) || [],
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async findProjectById(id: string, userId: string): Promise<ProjectRow | null> {
    const { data, error } = await this.client
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find project by id: ${error.message}`);
    }
    return (data as ProjectRow) || null;
  }

  async findProjectBySlug(slug: string, userId: string): Promise<ProjectRow | null> {
    const { data, error } = await this.client
      .from('projects')
      .select('*')
      .eq('slug', slug)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find project by slug: ${error.message}`);
    }
    return (data as ProjectRow) || null;
  }

  async createProject(data: ProjectInsert): Promise<ProjectRow> {
    const { data: created, error } = await this.client
      .from('projects')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }
    return created as ProjectRow;
  }

  async updateProject(
    id: string,
    userId: string,
    data: ProjectUpdate
  ): Promise<ProjectRow | null> {
    const { data: updated, error } = await this.client
      .from('projects')
      .update(data)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }
    return (updated as ProjectRow) || null;
  }

  async deleteProject(id: string, userId: string): Promise<boolean> {
    const { error } = await this.client
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete project: ${error.message}`);
    }
    return true;
  }

  async findMilestonesByProjectId(
    projectId: string,
    userId: string
  ): Promise<ProjectMilestoneRow[]> {
    const { data, error } = await this.client
      .from('project_milestones')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('order_index', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch project milestones: ${error.message}`);
    }
    return (data as ProjectMilestoneRow[]) || [];
  }

  async findMilestoneById(
    milestoneId: string,
    projectId: string,
    userId: string
  ): Promise<ProjectMilestoneRow | null> {
    const { data, error } = await this.client
      .from('project_milestones')
      .select('*')
      .eq('id', milestoneId)
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find project milestone: ${error.message}`);
    }
    return (data as ProjectMilestoneRow) || null;
  }

  async createMilestone(data: ProjectMilestoneInsert): Promise<ProjectMilestoneRow> {
    const { data: created, error } = await this.client
      .from('project_milestones')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create project milestone: ${error.message}`);
    }
    return created as ProjectMilestoneRow;
  }

  async updateMilestone(
    milestoneId: string,
    projectId: string,
    userId: string,
    data: ProjectMilestoneUpdate
  ): Promise<ProjectMilestoneRow | null> {
    const { data: updated, error } = await this.client
      .from('project_milestones')
      .update(data)
      .eq('id', milestoneId)
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update project milestone: ${error.message}`);
    }
    return (updated as ProjectMilestoneRow) || null;
  }

  async deleteMilestone(
    milestoneId: string,
    projectId: string,
    userId: string
  ): Promise<boolean> {
    const { error } = await this.client
      .from('project_milestones')
      .delete()
      .eq('id', milestoneId)
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete project milestone: ${error.message}`);
    }
    return true;
  }

  async findRepositoryById(
    repositoryId: string,
    userId: string
  ): Promise<ExternalRepositoryRow | null> {
    const { data, error } = await this.client
      .from('external_repositories')
      .select('*')
      .eq('id', repositoryId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find repository: ${error.message}`);
    }
    return (data as unknown as ExternalRepositoryRow) || null;
  }

  async updateProjectRepository(
    projectId: string,
    userId: string,
    repositoryId: string | null
  ): Promise<ProjectRow | null> {
    const { data, error } = await this.client
      .from('projects')
      .update({ repository_id: repositoryId })
      .eq('id', projectId)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update project repository: ${error.message}`);
    }
    return (data as ProjectRow) || null;
  }

  async findGoalById(
    goalId: string,
    userId: string
  ): Promise<{ id: string; title: string; user_id: string } | null> {
    const { data, error } = await this.client
      .from('goals')
      .select('id, title, user_id')
      .eq('id', goalId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find goal: ${error.message}`);
    }
    return (data as { id: string; title: string; user_id: string }) || null;
  }

  async findGoalsByProjectId(
    projectId: string,
    userId: string
  ): Promise<ProjectGoalWithTitle[]> {
    const { data, error } = await this.client
      .from('project_goals')
      .select('project_id, goal_id, user_id, is_primary, created_at, goals(title)')
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to find project goals: ${error.message}`);
    }

    return ((data || []) as unknown as Array<{
      project_id: string;
      goal_id: string;
      user_id: string;
      is_primary: boolean;
      created_at: string;
      goals: { title: string } | null;
    }>).map((row) => ({
      project_id: row.project_id,
      goal_id: row.goal_id,
      user_id: row.user_id,
      is_primary: row.is_primary,
      created_at: row.created_at,
      goal_title: row.goals?.title,
    }));
  }

  async findProjectGoal(
    projectId: string,
    goalId: string,
    userId: string
  ): Promise<ProjectGoalRow | null> {
    const { data, error } = await this.client
      .from('project_goals')
      .select('*')
      .eq('project_id', projectId)
      .eq('goal_id', goalId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check project goal: ${error.message}`);
    }
    return (data as ProjectGoalRow) || null;
  }

  async attachGoal(
    projectId: string,
    goalId: string,
    userId: string,
    isPrimary: boolean
  ): Promise<ProjectGoalRow> {
    if (isPrimary) {
      await this.client
        .from('project_goals')
        .update({ is_primary: false })
        .eq('project_id', projectId)
        .eq('user_id', userId);
    }

    const { data, error } = await this.client
      .from('project_goals')
      .insert({
        project_id: projectId,
        goal_id: goalId,
        user_id: userId,
        is_primary: isPrimary,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to attach goal to project: ${error.message}`);
    }
    return data as ProjectGoalRow;
  }

  async updateProjectGoal(
    projectId: string,
    goalId: string,
    userId: string,
    isPrimary: boolean
  ): Promise<ProjectGoalRow | null> {
    if (isPrimary) {
      await this.client
        .from('project_goals')
        .update({ is_primary: false })
        .eq('project_id', projectId)
        .eq('user_id', userId);
    }

    const { data, error } = await this.client
      .from('project_goals')
      .update({ is_primary: isPrimary })
      .eq('project_id', projectId)
      .eq('goal_id', goalId)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update project goal: ${error.message}`);
    }
    return (data as ProjectGoalRow) || null;
  }

  async detachGoal(projectId: string, goalId: string, userId: string): Promise<boolean> {
    const { error } = await this.client
      .from('project_goals')
      .delete()
      .eq('project_id', projectId)
      .eq('goal_id', goalId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to detach goal from project: ${error.message}`);
    }
    return true;
  }

  async findSkillById(
    skillId: string,
    userId: string
  ): Promise<{ id: string; name: string; slug: string; user_id: string } | null> {
    const { data, error } = await this.client
      .from('skills')
      .select('id, name, slug, user_id')
      .eq('id', skillId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find skill: ${error.message}`);
    }
    return (data as { id: string; name: string; slug: string; user_id: string }) || null;
  }

  async findSkillsByProjectId(
    projectId: string,
    userId: string
  ): Promise<ProjectSkillWithName[]> {
    const { data, error } = await this.client
      .from('project_skills')
      .select('project_id, skill_id, user_id, role, created_at, skills(name, slug)')
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to find project skills: ${error.message}`);
    }

    return ((data || []) as unknown as Array<{
      project_id: string;
      skill_id: string;
      user_id: string;
      role: string;
      created_at: string;
      skills: { name: string; slug: string } | null;
    }>).map((row) => ({
      project_id: row.project_id,
      skill_id: row.skill_id,
      user_id: row.user_id,
      role: row.role,
      created_at: row.created_at,
      skill_name: row.skills?.name,
      skill_slug: row.skills?.slug,
    }));
  }

  async findProjectSkill(
    projectId: string,
    skillId: string,
    userId: string
  ): Promise<ProjectSkillRow | null> {
    const { data, error } = await this.client
      .from('project_skills')
      .select('*')
      .eq('project_id', projectId)
      .eq('skill_id', skillId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check project skill: ${error.message}`);
    }
    return (data as ProjectSkillRow) || null;
  }

  async attachSkill(
    projectId: string,
    skillId: string,
    userId: string,
    role: string
  ): Promise<ProjectSkillRow> {
    const { data, error } = await this.client
      .from('project_skills')
      .insert({
        project_id: projectId,
        skill_id: skillId,
        user_id: userId,
        role,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to attach skill to project: ${error.message}`);
    }
    return data as ProjectSkillRow;
  }

  async updateProjectSkill(
    projectId: string,
    skillId: string,
    userId: string,
    role: string
  ): Promise<ProjectSkillRow | null> {
    const { data, error } = await this.client
      .from('project_skills')
      .update({ role })
      .eq('project_id', projectId)
      .eq('skill_id', skillId)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update project skill: ${error.message}`);
    }
    return (data as ProjectSkillRow) || null;
  }

  async detachSkill(projectId: string, skillId: string, userId: string): Promise<boolean> {
    const { error } = await this.client
      .from('project_skills')
      .delete()
      .eq('project_id', projectId)
      .eq('skill_id', skillId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to detach skill from project: ${error.message}`);
    }
    return true;
  }

  async findTasksByProjectId(projectId: string, userId: string): Promise<TaskRow[]> {
    const { data, error } = await this.client
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to find tasks for project: ${error.message}`);
    }
    return (data as TaskRow[]) || [];
  }

  async findActivitiesByRepositoryId(
    repositoryId: string,
    userId: string,
    limit: number,
    cursor?: string
  ): Promise<ExternalActivityRow[]> {
    let query = this.client
      .from('external_activities')
      .select('*')
      .eq('repository_id', repositoryId)
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('occurred_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to find activities for repository: ${error.message}`);
    }
    return (data as unknown as ExternalActivityRow[]) || [];
  }

  async getProjectSummaries(
    projectIds: string[]
  ): Promise<Map<string, ProjectCountsSummary>> {
    const map = new Map<string, ProjectCountsSummary>();
    if (projectIds.length === 0) return map;

    // Initialize all with 0 counts
    for (const pid of projectIds) {
      map.set(pid, {
        totalMilestones: 0,
        completedMilestones: 0,
        totalTasks: 0,
        completedTasks: 0,
        hasOverdueMilestones: false,
      });
    }

    // 1. Fetch milestones for these projects
    const { data: milestones, error: msError } = await this.client
      .from('project_milestones')
      .select('project_id, status, target_date')
      .in('project_id', projectIds);

    if (!msError && milestones) {
      const now = new Date();
      for (const m of milestones) {
        const item = map.get(m.project_id);
        if (item) {
          item.totalMilestones += 1;
          if (m.status === 'completed') {
            item.completedMilestones += 1;
          } else if (m.status !== 'skipped' && m.target_date && new Date(m.target_date) < now) {
            item.hasOverdueMilestones = true;
          }
        }
      }
    }

    // 2. Fetch tasks for these projects
    const { data: tasks, error: taskError } = await this.client
      .from('tasks')
      .select('project_id, status')
      .in('project_id', projectIds);

    if (!taskError && tasks) {
      for (const t of tasks) {
        if (t.project_id) {
          const item = map.get(t.project_id);
          if (item) {
            item.totalTasks += 1;
            if (t.status === 'completed') {
              item.completedTasks += 1;
            }
          }
        }
      }
    }

    return map;
  }
}

export const defaultProjectsRepository = new SupabaseProjectsRepository();

export class InMemoryProjectsRepository implements IProjectsRepository {
  private projects = new Map<string, ProjectRow>();
  private milestones = new Map<string, ProjectMilestoneRow>();
  private projectGoals = new Map<string, ProjectGoalRow>();
  private projectSkills = new Map<string, ProjectSkillRow>();
  private repositories = new Map<string, ExternalRepositoryRow>();
  private activities = new Map<string, ExternalActivityRow>();
  private goals = new Map<string, { id: string; title: string; user_id: string }>();
  private skills = new Map<string, { id: string; name: string; slug: string; user_id: string }>();
  private tasks: Map<string, TaskRow>;

  constructor(
    tasksMap?: Map<string, TaskRow>,
    private externalReposProvider?: { listRepositories(userId: string): Promise<ExternalRepositoryRow[]> }
  ) {
    this.tasks = tasksMap || new Map();
  }

  seedRepository(repo: ExternalRepositoryRow): void {
    this.repositories.set(repo.id, { ...repo });
  }

  seedActivity(act: ExternalActivityRow): void {
    this.activities.set(act.id, { ...act });
  }

  seedGoal(goal: { id: string; title: string; user_id: string }): void {
    this.goals.set(goal.id, { ...goal });
  }

  seedSkill(skill: { id: string; name: string; slug: string; user_id: string }): void {
    this.skills.set(skill.id, { ...skill });
  }

  seedTask(task: TaskRow): void {
    this.tasks.set(task.id, { ...task });
  }

  async findProjects(options: ProjectFindOptions): Promise<PaginatedList<ProjectRow>> {
    let list = Array.from(this.projects.values()).filter((p) => p.user_id === options.userId);

    if (options.status) {
      list = list.filter((p) => p.status === options.status);
    }
    if (options.priority) {
      list = list.filter((p) => p.priority === options.priority);
    }
    if (options.project_type) {
      list = list.filter((p) => p.project_type === options.project_type);
    }
    if (options.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q));
    }

    const sortField = options.sortBy || 'created_at';
    const isAsc = options.sortOrder === 'asc';
    list.sort((a, b) => {
      const valA = (a as unknown as Record<string, unknown>)[sortField] ?? '';
      const valB = (b as unknown as Record<string, unknown>)[sortField] ?? '';
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
      data: paged.map((p) => ({ ...p })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async findProjectById(id: string, userId: string): Promise<ProjectRow | null> {
    const proj = this.projects.get(id);
    if (!proj || proj.user_id !== userId) return null;
    return { ...proj };
  }

  async findProjectBySlug(slug: string, userId: string): Promise<ProjectRow | null> {
    for (const proj of this.projects.values()) {
      if (proj.user_id === userId && proj.slug === slug) {
        return { ...proj };
      }
    }
    return null;
  }

  async createProject(data: ProjectInsert): Promise<ProjectRow> {
    const now = new Date().toISOString();
    const newProj: ProjectRow = {
      id: data.id || crypto.randomUUID(),
      user_id: data.user_id,
      title: data.title,
      slug: data.slug,
      description: data.description ?? null,
      status: data.status ?? 'backlog',
      priority: data.priority ?? 'medium',
      project_type: data.project_type ?? 'software',
      repository_id: data.repository_id ?? null,
      start_date: data.start_date ?? null,
      target_date: data.target_date ?? null,
      completed_at: data.completed_at ?? null,
      live_url: data.live_url ?? null,
      architecture_notes: data.architecture_notes ?? null,
      tech_stack: data.tech_stack ?? [],
      metadata: (data.metadata as unknown as Json) ?? {},
      created_at: data.created_at || now,
      updated_at: data.updated_at || now,
    };
    this.projects.set(newProj.id, newProj);
    return { ...newProj };
  }

  async updateProject(
    id: string,
    userId: string,
    data: ProjectUpdate
  ): Promise<ProjectRow | null> {
    const existing = this.projects.get(id);
    if (!existing || existing.user_id !== userId) return null;

    const updated: ProjectRow = {
      ...existing,
      ...data,
      metadata: data.metadata !== undefined ? (data.metadata as unknown as Json) : existing.metadata,
      updated_at: new Date().toISOString(),
    };
    this.projects.set(id, updated);
    return { ...updated };
  }

  async deleteProject(id: string, userId: string): Promise<boolean> {
    const existing = this.projects.get(id);
    if (!existing || existing.user_id !== userId) return false;

    this.projects.delete(id);

    // Cascades
    for (const [mid, m] of this.milestones.entries()) {
      if (m.project_id === id) {
        this.milestones.delete(mid);
      }
    }

    for (const [gid, g] of this.projectGoals.entries()) {
      if (g.project_id === id) {
        this.projectGoals.delete(gid);
      }
    }

    for (const [sid, s] of this.projectSkills.entries()) {
      if (s.project_id === id) {
        this.projectSkills.delete(sid);
      }
    }

    for (const [tid, t] of this.tasks.entries()) {
      if (t.project_id === id) {
        this.tasks.set(tid, {
          ...t,
          project_id: null,
          project_milestone_id: null,
        });
      }
    }

    return true;
  }

  async findMilestonesByProjectId(
    projectId: string,
    userId: string
  ): Promise<ProjectMilestoneRow[]> {
    return Array.from(this.milestones.values())
      .filter((m) => m.project_id === projectId && m.user_id === userId)
      .sort((a, b) => a.order_index - b.order_index)
      .map((m) => ({ ...m }));
  }

  async findMilestoneById(
    milestoneId: string,
    projectId: string,
    userId: string
  ): Promise<ProjectMilestoneRow | null> {
    const m = this.milestones.get(milestoneId);
    if (!m || m.project_id !== projectId || m.user_id !== userId) return null;
    return { ...m };
  }

  async createMilestone(data: ProjectMilestoneInsert): Promise<ProjectMilestoneRow> {
    const now = new Date().toISOString();
    const newM: ProjectMilestoneRow = {
      id: data.id || crypto.randomUUID(),
      project_id: data.project_id,
      user_id: data.user_id,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? 'pending',
      order_index: data.order_index ?? 0,
      target_date: data.target_date ?? null,
      completed_at: data.completed_at ?? null,
      created_at: data.created_at || now,
      updated_at: data.updated_at || now,
    };
    this.milestones.set(newM.id, newM);
    return { ...newM };
  }

  async updateMilestone(
    milestoneId: string,
    projectId: string,
    userId: string,
    data: ProjectMilestoneUpdate
  ): Promise<ProjectMilestoneRow | null> {
    const existing = this.milestones.get(milestoneId);
    if (!existing || existing.project_id !== projectId || existing.user_id !== userId) {
      return null;
    }
    const updated: ProjectMilestoneRow = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    this.milestones.set(milestoneId, updated);
    return { ...updated };
  }

  async deleteMilestone(
    milestoneId: string,
    projectId: string,
    userId: string
  ): Promise<boolean> {
    const existing = this.milestones.get(milestoneId);
    if (!existing || existing.project_id !== projectId || existing.user_id !== userId) {
      return false;
    }
    this.milestones.delete(milestoneId);

    // Unlink from tasks
    for (const [tid, t] of this.tasks.entries()) {
      if (t.project_milestone_id === milestoneId) {
        this.tasks.set(tid, {
          ...t,
          project_milestone_id: null,
        });
      }
    }

    return true;
  }

  async findRepositoryById(
    repositoryId: string,
    userId: string
  ): Promise<ExternalRepositoryRow | null> {
    const repo = this.repositories.get(repositoryId);
    if (repo && repo.user_id === userId) return { ...repo };
    if (this.externalReposProvider) {
      const externalRepos = await this.externalReposProvider.listRepositories(userId);
      const found = externalRepos.find((r) => r.id === repositoryId && r.user_id === userId);
      if (found) {
        return { ...found };
      }
    }
    return null;
  }

  async updateProjectRepository(
    projectId: string,
    userId: string,
    repositoryId: string | null
  ): Promise<ProjectRow | null> {
    const proj = this.projects.get(projectId);
    if (!proj || proj.user_id !== userId) return null;
    const updated: ProjectRow = {
      ...proj,
      repository_id: repositoryId,
      updated_at: new Date().toISOString(),
    };
    this.projects.set(projectId, updated);
    return { ...updated };
  }

  async findGoalById(
    goalId: string,
    userId: string
  ): Promise<{ id: string; title: string; user_id: string } | null> {
    const goal = this.goals.get(goalId);
    if (!goal || goal.user_id !== userId) return null;
    return { ...goal };
  }

  async findGoalsByProjectId(
    projectId: string,
    userId: string
  ): Promise<ProjectGoalWithTitle[]> {
    return Array.from(this.projectGoals.values())
      .filter((pg) => pg.project_id === projectId && pg.user_id === userId)
      .map((pg) => ({
        ...pg,
        goal_title: this.goals.get(pg.goal_id)?.title,
      }));
  }

  async findProjectGoal(
    projectId: string,
    goalId: string,
    userId: string
  ): Promise<ProjectGoalRow | null> {
    const key = `${projectId}:${goalId}`;
    const pg = this.projectGoals.get(key);
    if (!pg || pg.user_id !== userId) return null;
    return { ...pg };
  }

  deleteRepository(id: string): void {
    this.repositories.delete(id);
    for (const [pid, p] of this.projects.entries()) {
      if (p.repository_id === id) {
        this.projects.set(pid, { ...p, repository_id: null });
      }
    }
  }

  async attachGoal(
    projectId: string,
    goalId: string,
    userId: string,
    isPrimary: boolean
  ): Promise<ProjectGoalRow> {
    if (isPrimary) {
      for (const [k, pg] of this.projectGoals.entries()) {
        if (pg.project_id === projectId && pg.user_id === userId && pg.is_primary) {
          this.projectGoals.set(k, { ...pg, is_primary: false });
        }
      }
    }

    const key = `${projectId}:${goalId}`;
    const row: ProjectGoalRow = {
      project_id: projectId,
      goal_id: goalId,
      user_id: userId,
      is_primary: isPrimary,
      created_at: new Date().toISOString(),
    };
    this.projectGoals.set(key, row);
    return { ...row };
  }

  async updateProjectGoal(
    projectId: string,
    goalId: string,
    userId: string,
    isPrimary: boolean
  ): Promise<ProjectGoalRow | null> {
    const key = `${projectId}:${goalId}`;
    const existing = this.projectGoals.get(key);
    if (!existing || existing.user_id !== userId) return null;

    if (isPrimary) {
      for (const [k, pg] of this.projectGoals.entries()) {
        if (pg.project_id === projectId && pg.user_id === userId && pg.is_primary) {
          this.projectGoals.set(k, { ...pg, is_primary: false });
        }
      }
    }

    const updated: ProjectGoalRow = {
      ...existing,
      is_primary: isPrimary,
    };
    this.projectGoals.set(key, updated);
    return { ...updated };
  }

  async detachGoal(projectId: string, goalId: string, userId: string): Promise<boolean> {
    const key = `${projectId}:${goalId}`;
    const existing = this.projectGoals.get(key);
    if (!existing || existing.user_id !== userId) return false;
    this.projectGoals.delete(key);
    return true;
  }

  async findSkillById(
    skillId: string,
    userId: string
  ): Promise<{ id: string; name: string; slug: string; user_id: string } | null> {
    const skill = this.skills.get(skillId);
    if (!skill || skill.user_id !== userId) return null;
    return { ...skill };
  }

  async findSkillsByProjectId(
    projectId: string,
    userId: string
  ): Promise<ProjectSkillWithName[]> {
    return Array.from(this.projectSkills.values())
      .filter((ps) => ps.project_id === projectId && ps.user_id === userId)
      .map((ps) => {
        const s = this.skills.get(ps.skill_id);
        return {
          ...ps,
          skill_name: s?.name,
          skill_slug: s?.slug,
        };
      });
  }

  async findProjectSkill(
    projectId: string,
    skillId: string,
    userId: string
  ): Promise<ProjectSkillRow | null> {
    const key = `${projectId}:${skillId}`;
    const ps = this.projectSkills.get(key);
    if (!ps || ps.user_id !== userId) return null;
    return { ...ps };
  }

  async attachSkill(
    projectId: string,
    skillId: string,
    userId: string,
    role: string
  ): Promise<ProjectSkillRow> {
    const key = `${projectId}:${skillId}`;
    const row: ProjectSkillRow = {
      project_id: projectId,
      skill_id: skillId,
      user_id: userId,
      role,
      created_at: new Date().toISOString(),
    };
    this.projectSkills.set(key, row);
    return { ...row };
  }

  async updateProjectSkill(
    projectId: string,
    skillId: string,
    userId: string,
    role: string
  ): Promise<ProjectSkillRow | null> {
    const key = `${projectId}:${skillId}`;
    const existing = this.projectSkills.get(key);
    if (!existing || existing.user_id !== userId) return null;

    const updated: ProjectSkillRow = {
      ...existing,
      role,
    };
    this.projectSkills.set(key, updated);
    return { ...updated };
  }

  async detachSkill(projectId: string, skillId: string, userId: string): Promise<boolean> {
    const key = `${projectId}:${skillId}`;
    const existing = this.projectSkills.get(key);
    if (!existing || existing.user_id !== userId) return false;
    this.projectSkills.delete(key);
    return true;
  }

  async findTasksByProjectId(projectId: string, userId: string): Promise<TaskRow[]> {
    return Array.from(this.tasks.values())
      .filter((t) => t.project_id === projectId && t.user_id === userId)
      .map((t) => ({ ...t }));
  }

  async findActivitiesByRepositoryId(
    repositoryId: string,
    userId: string,
    limit: number,
    cursor?: string
  ): Promise<ExternalActivityRow[]> {
    let list = Array.from(this.activities.values())
      .filter((a) => a.repository_id === repositoryId && a.user_id === userId);

    if (cursor) {
      const cursorTime = new Date(cursor).getTime();
      list = list.filter((a) => new Date(a.occurred_at).getTime() < cursorTime);
    }

    return list
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      .slice(0, limit)
      .map((a) => ({ ...a }));
  }

  async getProjectSummaries(
    projectIds: string[]
  ): Promise<Map<string, ProjectCountsSummary>> {
    const map = new Map<string, ProjectCountsSummary>();
    const now = new Date();

    for (const pid of projectIds) {
      const projMilestones = Array.from(this.milestones.values()).filter(
        (m) => m.project_id === pid
      );
      const projTasks = Array.from(this.tasks.values()).filter((t) => t.project_id === pid);

      const totalMilestones = projMilestones.length;
      const completedMilestones = projMilestones.filter((m) => m.status === 'completed').length;
      const hasOverdueMilestones = projMilestones.some(
        (m) => m.status !== 'completed' && m.status !== 'skipped' && m.target_date && new Date(m.target_date) < now
      );

      const totalTasks = projTasks.length;
      const completedTasks = projTasks.filter((t) => t.status === 'completed').length;

      map.set(pid, {
        totalMilestones,
        completedMilestones,
        totalTasks,
        completedTasks,
        hasOverdueMilestones,
      });
    }

    return map;
  }
}
