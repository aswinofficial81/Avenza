import type {
  CreateProjectInput,
  CreateProjectMilestoneInput,
  ExternalActivityDto,
  ExternalRepositoryDto,
  Json,
  PaginatedList,
  ProjectDetailDto,
  ProjectDerivedMetrics,
  ProjectDto,
  ProjectGoalDto,
  ProjectMilestoneDto,
  ProjectMilestoneRow,
  ProjectPriority,
  ProjectRow,
  ProjectSkillDto,
  ProjectStatus,
  ProjectType,
  TaskDto,
  TaskPriority,
  TaskRow,
  TaskStatus,
  TaskType,
  UpdateProjectInput,
  UpdateProjectMilestoneInput,
} from '@avenza/shared';
import { defaultProjectsRepository } from './projects.repository';
import {
  type ExternalActivityRow,
  type ExternalRepositoryRow,
  type IProjectsRepository,
  type ProjectCountsSummary,
  type ProjectFindOptions,
  type ProjectGoalWithTitle,
  type ProjectSkillWithName,
  ProjectsError,
} from './projects.types';

export function calculateProjectMetrics(
  project: {
    status: string;
    start_date: string | null;
    target_date: string | null;
  },
  counts: ProjectCountsSummary,
  now: Date = new Date()
): ProjectDerivedMetrics {
  const {
    totalMilestones,
    completedMilestones,
    totalTasks,
    completedTasks,
    hasOverdueMilestones,
  } = counts;

  // 1. Progress Calculation
  let progressPercentage = 0;
  if (totalMilestones > 0) {
    progressPercentage = Math.round((completedMilestones / totalMilestones) * 100);
  } else if (totalTasks > 0) {
    progressPercentage = Math.round((completedTasks / totalTasks) * 100);
  } else {
    progressPercentage = project.status === 'completed' ? 100 : 0;
  }

  // Bound between 0 and 100
  progressPercentage = Math.max(0, Math.min(100, progressPercentage));

  // 2. Health Calculation
  let healthStatus: 'unknown' | 'on_track' | 'at_risk' = 'unknown';
  let healthReason: string | undefined;

  const isCompleted = project.status === 'completed' || progressPercentage === 100;
  if (isCompleted) {
    healthStatus = 'on_track';
    healthReason = 'Project is completed.';
  } else if (
    ['backlog', 'planning', 'paused', 'archived'].includes(project.status) ||
    !project.target_date
  ) {
    healthStatus = 'unknown';
    healthReason =
      !project.target_date
        ? 'No target date specified.'
        : `Project status is '${project.status}'.`;
  } else {
    // Active project with target date
    const targetTime = new Date(project.target_date).getTime();
    const currentTime = now.getTime();

    if (targetTime < currentTime && progressPercentage < 100) {
      healthStatus = 'at_risk';
      healthReason = 'Target date has passed with incomplete progress.';
    } else if (hasOverdueMilestones) {
      healthStatus = 'at_risk';
      healthReason = 'Active milestone is overdue.';
    } else if (project.start_date) {
      const startTime = new Date(project.start_date).getTime();
      if (targetTime > startTime) {
        const elapsed = Math.max(0, currentTime - startTime);
        const totalDuration = targetTime - startTime;
        const expectedProgress = Math.min(100, Math.round((elapsed / totalDuration) * 100));

        if (expectedProgress - progressPercentage > 20) {
          healthStatus = 'at_risk';
          healthReason = `Pacing is ${expectedProgress - progressPercentage}% behind expected progress.`;
        } else {
          healthStatus = 'on_track';
          healthReason = 'Project is on track.';
        }
      } else {
        healthStatus = 'on_track';
        healthReason = 'Project is on track.';
      }
    } else {
      healthStatus = 'on_track';
      healthReason = 'Project is on track.';
    }
  }

  return {
    milestoneCount: totalMilestones,
    completedMilestoneCount: completedMilestones,
    progressPercentage,
    taskCount: totalTasks,
    completedTaskCount: completedTasks,
    healthStatus,
    healthReason,
  };
}

export class ProjectsService {
  constructor(private readonly repository: IProjectsRepository = defaultProjectsRepository) {}

  private mapRepositoryDto(repo: ExternalRepositoryRow | null): ExternalRepositoryDto | null {
    if (!repo) return null;
    return {
      id: repo.id,
      connection_id: repo.connection_id,
      provider: repo.provider as 'github',
      external_id: repo.external_id,
      name: repo.name,
      full_name: repo.full_name,
      owner: repo.owner,
      is_private: repo.is_private,
      html_url: repo.html_url,
      description: repo.description,
      default_branch: repo.default_branch,
      primary_language: repo.primary_language,
      languages: (repo.languages as Record<string, number>) || {},
      stars_count: repo.stars_count,
      forks_count: repo.forks_count,
      open_issues_count: repo.open_issues_count,
      pushed_at: repo.pushed_at,
      created_at: repo.created_at,
      updated_at: repo.updated_at,
    };
  }

  mapActivityDto(act: ExternalActivityRow): ExternalActivityDto {
    return {
      id: act.id,
      connection_id: act.connection_id,
      repository_id: act.repository_id,
      provider: act.provider as 'github',
      external_id: act.external_id,
      activity_type: act.activity_type,
      occurred_at: act.occurred_at,
      title: act.title,
      summary: act.summary,
      external_url: act.external_url,
      metadata: (act.metadata as Record<string, unknown>) || {},
      created_at: act.created_at,
      updated_at: act.updated_at,
    };
  }

  async listProjects(options: ProjectFindOptions): Promise<PaginatedList<ProjectDto>> {
    const paginated = await this.repository.findProjects(options);
    const projectIds = paginated.data.map((p: ProjectRow) => p.id);
    const summaries = await this.repository.getProjectSummaries(projectIds);

    const data: ProjectDto[] = paginated.data.map((proj: ProjectRow) => {
      const summary = summaries.get(proj.id) || {
        totalMilestones: 0,
        completedMilestones: 0,
        totalTasks: 0,
        completedTasks: 0,
        hasOverdueMilestones: false,
      };
      const metrics = calculateProjectMetrics(proj, summary);

      return {
        id: proj.id,
        user_id: proj.user_id,
        title: proj.title,
        slug: proj.slug,
        description: proj.description,
        status: proj.status as ProjectStatus,
        priority: proj.priority as ProjectPriority,
        project_type: proj.project_type as ProjectType,
        repository_id: proj.repository_id,
        start_date: proj.start_date,
        target_date: proj.target_date,
        completed_at: proj.completed_at,
        live_url: proj.live_url,
        architecture_notes: proj.architecture_notes,
        tech_stack: proj.tech_stack,
        metadata: (proj.metadata as Record<string, unknown>) || {},
        created_at: proj.created_at,
        updated_at: proj.updated_at,
        metrics,
      };
    });

    return {
      data,
      pagination: paginated.pagination,
    };
  }

  async getProjectById(id: string, userId: string): Promise<ProjectDetailDto | null> {
    const proj = await this.repository.findProjectById(id, userId);
    if (!proj) return null;

    const [milestones, tasks, goals, skills, linkedRepo, recentActivities] = await Promise.all([
      this.repository.findMilestonesByProjectId(id, userId),
      this.repository.findTasksByProjectId(id, userId),
      this.repository.findGoalsByProjectId(id, userId),
      this.repository.findSkillsByProjectId(id, userId),
      proj.repository_id
        ? this.repository.findRepositoryById(proj.repository_id, userId)
        : Promise.resolve(null),
      proj.repository_id
        ? this.repository.findActivitiesByRepositoryId(proj.repository_id, userId, 10)
        : Promise.resolve([]),
    ]);

    const now = new Date();
    const hasOverdueMilestones = milestones.some(
      (m: ProjectMilestoneRow) => m.status !== 'completed' && m.status !== 'skipped' && m.target_date && new Date(m.target_date) < now
    );

    const counts: ProjectCountsSummary = {
      totalMilestones: milestones.length,
      completedMilestones: milestones.filter((m: ProjectMilestoneRow) => m.status === 'completed').length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t: TaskRow) => t.status === 'completed').length,
      hasOverdueMilestones,
    };

    const metrics = calculateProjectMetrics(proj, counts, now);

    return {
      id: proj.id,
      user_id: proj.user_id,
      title: proj.title,
      slug: proj.slug,
      description: proj.description,
      status: proj.status as ProjectStatus,
      priority: proj.priority as ProjectPriority,
      project_type: proj.project_type as ProjectType,
      repository_id: proj.repository_id,
      start_date: proj.start_date,
      target_date: proj.target_date,
      completed_at: proj.completed_at,
      live_url: proj.live_url,
      architecture_notes: proj.architecture_notes,
      tech_stack: proj.tech_stack,
      metadata: (proj.metadata as Record<string, unknown>) || {},
      created_at: proj.created_at,
      updated_at: proj.updated_at,
      metrics,
      milestones: milestones.map((m: ProjectMilestoneRow) => ({
        id: m.id,
        project_id: m.project_id,
        user_id: m.user_id,
        title: m.title,
        description: m.description,
        status: m.status as ProjectMilestoneDto['status'],
        order_index: m.order_index,
        target_date: m.target_date,
        completed_at: m.completed_at,
        created_at: m.created_at,
        updated_at: m.updated_at,
      })),
      tasks: tasks.map((t: TaskRow) => ({
        id: t.id,
        user_id: t.user_id,
        title: t.title,
        description: t.description,
        status: t.status as TaskStatus,
        priority: t.priority as TaskPriority,
        task_type: t.task_type as TaskType,
        goal_id: t.goal_id,
        milestone_id: t.milestone_id,
        project_id: t.project_id,
        project_milestone_id: t.project_milestone_id,
        estimated_minutes: t.estimated_minutes,
        actual_minutes: t.actual_minutes,
        due_at: t.due_at,
        scheduled_start: t.scheduled_start,
        scheduled_end: t.scheduled_end,
        completed_at: t.completed_at,
        notes: t.notes,
        created_at: t.created_at,
        updated_at: t.updated_at,
      })) as TaskDto[],
      goals: goals.map((g: ProjectGoalWithTitle) => ({
        project_id: g.project_id,
        goal_id: g.goal_id,
        user_id: g.user_id,
        is_primary: g.is_primary,
        created_at: g.created_at,
        goal_title: g.goal_title,
      })),
      skills: skills.map((s: ProjectSkillWithName) => ({
        project_id: s.project_id,
        skill_id: s.skill_id,
        user_id: s.user_id,
        role: s.role as ProjectSkillDto['role'],
        created_at: s.created_at,
        skill_name: s.skill_name,
        skill_slug: s.skill_slug,
      })),
      repository: this.mapRepositoryDto(linkedRepo),
      activities: (recentActivities || []).map((a: ExternalActivityRow) => this.mapActivityDto(a)),
    };
  }

  async createProject(userId: string, input: CreateProjectInput): Promise<ProjectDto> {
    // 1. Slug uniqueness per user check
    const existing = await this.repository.findProjectBySlug(input.slug, userId);
    if (existing) {
      throw new ProjectsError(
        `A project with slug '${input.slug}' already exists for this user.`,
        'CONFLICT',
        409
      );
    }

    // 2. Repository ownership check if repository_id provided
    if (input.repository_id) {
      const repo = await this.repository.findRepositoryById(input.repository_id, userId);
      if (!repo) {
        throw new ProjectsError('Linked repository not found or access denied.', 'NOT_FOUND', 404);
      }
      if (repo.provider !== 'github') {
        throw new ProjectsError('Only GitHub repositories can be linked to projects.', 'BAD_REQUEST', 400);
      }
    }

    const created = await this.repository.createProject({
      user_id: userId,
      title: input.title,
      slug: input.slug,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      project_type: input.project_type,
      repository_id: input.repository_id ?? null,
      start_date: input.start_date ?? null,
      target_date: input.target_date ?? null,
      live_url: input.live_url ?? null,
      architecture_notes: input.architecture_notes ?? null,
      tech_stack: input.tech_stack,
      metadata: (input.metadata as unknown as Json) ?? {},
    });

    const metrics = calculateProjectMetrics(created, {
      totalMilestones: 0,
      completedMilestones: 0,
      totalTasks: 0,
      completedTasks: 0,
      hasOverdueMilestones: false,
    });

    return {
      id: created.id,
      user_id: created.user_id,
      title: created.title,
      slug: created.slug,
      description: created.description,
      status: created.status as ProjectStatus,
      priority: created.priority as ProjectPriority,
      project_type: created.project_type as ProjectType,
      repository_id: created.repository_id,
      start_date: created.start_date,
      target_date: created.target_date,
      completed_at: created.completed_at,
      live_url: created.live_url,
      architecture_notes: created.architecture_notes,
      tech_stack: created.tech_stack,
      metadata: (created.metadata as Record<string, unknown>) || {},
      created_at: created.created_at,
      updated_at: created.updated_at,
      metrics,
    };
  }

  async updateProject(
    id: string,
    userId: string,
    input: UpdateProjectInput
  ): Promise<ProjectDto> {
    const existing = await this.repository.findProjectById(id, userId);
    if (!existing) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    // 1. Slug check if updating slug
    if (input.slug && input.slug !== existing.slug) {
      const slugColliding = await this.repository.findProjectBySlug(input.slug, userId);
      if (slugColliding && slugColliding.id !== id) {
        throw new ProjectsError(
          `A project with slug '${input.slug}' already exists for this user.`,
          'CONFLICT',
          409
        );
      }
    }

    // 2. Repository check if updating repository_id
    if (input.repository_id !== undefined && input.repository_id !== null) {
      const repo = await this.repository.findRepositoryById(input.repository_id, userId);
      if (!repo) {
        throw new ProjectsError('Linked repository not found or access denied.', 'NOT_FOUND', 404);
      }
      if (repo.provider !== 'github') {
        throw new ProjectsError('Only GitHub repositories can be linked to projects.', 'BAD_REQUEST', 400);
      }
    }

    const updated = await this.repository.updateProject(id, userId, {
      ...input,
      metadata: input.metadata !== undefined ? (input.metadata as unknown as Json) : undefined,
      updated_at: new Date().toISOString(),
    });

    if (!updated) {
      throw new ProjectsError('Project update failed.', 'INTERNAL_ERROR', 500);
    }

    const summaries = await this.repository.getProjectSummaries([id]);
    const summary = summaries.get(id) || {
      totalMilestones: 0,
      completedMilestones: 0,
      totalTasks: 0,
      completedTasks: 0,
      hasOverdueMilestones: false,
    };
    const metrics = calculateProjectMetrics(updated, summary);

    return {
      id: updated.id,
      user_id: updated.user_id,
      title: updated.title,
      slug: updated.slug,
      description: updated.description,
      status: updated.status as ProjectStatus,
      priority: updated.priority as ProjectPriority,
      project_type: updated.project_type as ProjectType,
      repository_id: updated.repository_id,
      start_date: updated.start_date,
      target_date: updated.target_date,
      completed_at: updated.completed_at,
      live_url: updated.live_url,
      architecture_notes: updated.architecture_notes,
      tech_stack: updated.tech_stack,
      metadata: (updated.metadata as Record<string, unknown>) || {},
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      metrics,
    };
  }

  async deleteProject(id: string, userId: string): Promise<boolean> {
    const existing = await this.repository.findProjectById(id, userId);
    if (!existing) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    return this.repository.deleteProject(id, userId);
  }

  // --- Milestone Operations ---
  async listMilestones(projectId: string, userId: string): Promise<ProjectMilestoneDto[]> {
    const project = await this.repository.findProjectById(projectId, userId);
    if (!project) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    const rows = await this.repository.findMilestonesByProjectId(projectId, userId);
    return rows.map((m: ProjectMilestoneRow) => ({
      id: m.id,
      project_id: m.project_id,
      user_id: m.user_id,
      title: m.title,
      description: m.description,
      status: m.status as ProjectMilestoneDto['status'],
      order_index: m.order_index,
      target_date: m.target_date,
      completed_at: m.completed_at,
      created_at: m.created_at,
      updated_at: m.updated_at,
    }));
  }

  async createMilestone(
    projectId: string,
    userId: string,
    input: CreateProjectMilestoneInput
  ): Promise<ProjectMilestoneDto> {
    const project = await this.repository.findProjectById(projectId, userId);
    if (!project) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    let orderIndex = input.order_index;
    if (orderIndex === undefined || orderIndex === 0) {
      const existing = await this.repository.findMilestonesByProjectId(projectId, userId);
      orderIndex = existing.length > 0 ? Math.max(...existing.map((m: ProjectMilestoneRow) => m.order_index)) + 1 : 0;
    }

    const row = await this.repository.createMilestone({
      project_id: projectId,
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      order_index: orderIndex,
      target_date: input.target_date ?? null,
    });

    return {
      id: row.id,
      project_id: row.project_id,
      user_id: row.user_id,
      title: row.title,
      description: row.description,
      status: row.status as ProjectMilestoneDto['status'],
      order_index: row.order_index,
      target_date: row.target_date,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async updateMilestone(
    projectId: string,
    milestoneId: string,
    userId: string,
    input: UpdateProjectMilestoneInput
  ): Promise<ProjectMilestoneDto> {
    const project = await this.repository.findProjectById(projectId, userId);
    if (!project) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    const milestone = await this.repository.findMilestoneById(milestoneId, projectId, userId);
    if (!milestone) {
      throw new ProjectsError('Milestone not found or does not belong to this project.', 'NOT_FOUND', 404);
    }

    const updated = await this.repository.updateMilestone(milestoneId, projectId, userId, {
      ...input,
      updated_at: new Date().toISOString(),
    });

    if (!updated) {
      throw new ProjectsError('Milestone update failed.', 'INTERNAL_ERROR', 500);
    }

    return {
      id: updated.id,
      project_id: updated.project_id,
      user_id: updated.user_id,
      title: updated.title,
      description: updated.description,
      status: updated.status as ProjectMilestoneDto['status'],
      order_index: updated.order_index,
      target_date: updated.target_date,
      completed_at: updated.completed_at,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    };
  }

  async deleteMilestone(
    projectId: string,
    milestoneId: string,
    userId: string
  ): Promise<boolean> {
    const project = await this.repository.findProjectById(projectId, userId);
    if (!project) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    const milestone = await this.repository.findMilestoneById(milestoneId, projectId, userId);
    if (!milestone) {
      throw new ProjectsError('Milestone not found or does not belong to this project.', 'NOT_FOUND', 404);
    }

    return this.repository.deleteMilestone(milestoneId, projectId, userId);
  }

  // --- Repository Linking ---
  async linkRepository(
    projectId: string,
    userId: string,
    repositoryId: string | null
  ): Promise<ProjectDto> {
    const project = await this.repository.findProjectById(projectId, userId);
    if (!project) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    if (repositoryId !== null) {
      const repo = await this.repository.findRepositoryById(repositoryId, userId);
      if (!repo) {
        throw new ProjectsError('External repository not found or access denied.', 'NOT_FOUND', 404);
      }
      if (repo.provider !== 'github') {
        throw new ProjectsError('Only GitHub repositories can be linked to projects.', 'BAD_REQUEST', 400);
      }
    }

    const updated = await this.repository.updateProjectRepository(projectId, userId, repositoryId);
    if (!updated) {
      throw new ProjectsError('Failed to update project repository linkage.', 'INTERNAL_ERROR', 500);
    }

    const summaries = await this.repository.getProjectSummaries([projectId]);
    const summary = summaries.get(projectId) || {
      totalMilestones: 0,
      completedMilestones: 0,
      totalTasks: 0,
      completedTasks: 0,
      hasOverdueMilestones: false,
    };
    const metrics = calculateProjectMetrics(updated, summary);

    return {
      id: updated.id,
      user_id: updated.user_id,
      title: updated.title,
      slug: updated.slug,
      description: updated.description,
      status: updated.status as ProjectStatus,
      priority: updated.priority as ProjectPriority,
      project_type: updated.project_type as ProjectType,
      repository_id: updated.repository_id,
      start_date: updated.start_date,
      target_date: updated.target_date,
      completed_at: updated.completed_at,
      live_url: updated.live_url,
      architecture_notes: updated.architecture_notes,
      tech_stack: updated.tech_stack,
      metadata: (updated.metadata as Record<string, unknown>) || {},
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      metrics,
    };
  }

  // --- Goal Linking ---
  async listGoals(projectId: string, userId: string): Promise<ProjectGoalDto[]> {
    const project = await this.repository.findProjectById(projectId, userId);
    if (!project) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    const goals = await this.repository.findGoalsByProjectId(projectId, userId);
    return goals.map((g) => ({
      project_id: g.project_id,
      goal_id: g.goal_id,
      user_id: g.user_id,
      is_primary: g.is_primary,
      created_at: g.created_at,
      goal_title: g.goal_title,
    }));
  }

  async attachGoal(
    projectId: string,
    userId: string,
    goalId: string,
    isPrimary: boolean
  ): Promise<ProjectGoalDto> {
    const project = await this.repository.findProjectById(projectId, userId);
    if (!project) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    const goal = await this.repository.findGoalById(goalId, userId);
    if (!goal) {
      throw new ProjectsError('Goal not found or access denied.', 'NOT_FOUND', 404);
    }

    const existing = await this.repository.findProjectGoal(projectId, goalId, userId);
    if (existing) {
      throw new ProjectsError('Goal is already linked to this project.', 'CONFLICT', 409);
    }

    const attached = await this.repository.attachGoal(projectId, goalId, userId, isPrimary);
    return {
      project_id: attached.project_id,
      goal_id: attached.goal_id,
      user_id: attached.user_id,
      is_primary: attached.is_primary,
      created_at: attached.created_at,
      goal_title: goal.title,
    };
  }

  async updateGoal(
    projectId: string,
    userId: string,
    goalId: string,
    isPrimary: boolean
  ): Promise<ProjectGoalDto> {
    const project = await this.repository.findProjectById(projectId, userId);
    if (!project) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    const existing = await this.repository.findProjectGoal(projectId, goalId, userId);
    if (!existing) {
      throw new ProjectsError('Goal link not found on this project.', 'NOT_FOUND', 404);
    }

    const updated = await this.repository.updateProjectGoal(projectId, goalId, userId, isPrimary);
    if (!updated) {
      throw new ProjectsError('Failed to update project goal.', 'INTERNAL_ERROR', 500);
    }

    const goal = await this.repository.findGoalById(goalId, userId);
    return {
      project_id: updated.project_id,
      goal_id: updated.goal_id,
      user_id: updated.user_id,
      is_primary: updated.is_primary,
      created_at: updated.created_at,
      goal_title: goal?.title,
    };
  }

  async detachGoal(projectId: string, userId: string, goalId: string): Promise<boolean> {
    const project = await this.repository.findProjectById(projectId, userId);
    if (!project) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    const existing = await this.repository.findProjectGoal(projectId, goalId, userId);
    if (!existing) {
      throw new ProjectsError('Goal link not found on this project.', 'NOT_FOUND', 404);
    }

    return this.repository.detachGoal(projectId, goalId, userId);
  }

  // --- Skill Linking ---
  async listSkills(projectId: string, userId: string): Promise<ProjectSkillDto[]> {
    const project = await this.repository.findProjectById(projectId, userId);
    if (!project) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    const skills = await this.repository.findSkillsByProjectId(projectId, userId);
    return skills.map((s) => ({
      project_id: s.project_id,
      skill_id: s.skill_id,
      user_id: s.user_id,
      role: s.role as ProjectSkillDto['role'],
      created_at: s.created_at,
      skill_name: s.skill_name,
      skill_slug: s.skill_slug,
    }));
  }

  async attachSkill(
    projectId: string,
    userId: string,
    skillId: string,
    role: 'primary' | 'supporting'
  ): Promise<ProjectSkillDto> {
    const project = await this.repository.findProjectById(projectId, userId);
    if (!project) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    const skill = await this.repository.findSkillById(skillId, userId);
    if (!skill) {
      throw new ProjectsError('Skill not found or access denied.', 'NOT_FOUND', 404);
    }

    const existing = await this.repository.findProjectSkill(projectId, skillId, userId);
    if (existing) {
      throw new ProjectsError('Skill is already linked to this project.', 'CONFLICT', 409);
    }

    const attached = await this.repository.attachSkill(projectId, skillId, userId, role);
    return {
      project_id: attached.project_id,
      skill_id: attached.skill_id,
      user_id: attached.user_id,
      role: attached.role as ProjectSkillDto['role'],
      created_at: attached.created_at,
      skill_name: skill.name,
      skill_slug: skill.slug,
    };
  }

  async updateSkill(
    projectId: string,
    userId: string,
    skillId: string,
    role: 'primary' | 'supporting'
  ): Promise<ProjectSkillDto> {
    const project = await this.repository.findProjectById(projectId, userId);
    if (!project) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    const existing = await this.repository.findProjectSkill(projectId, skillId, userId);
    if (!existing) {
      throw new ProjectsError('Skill link not found on this project.', 'NOT_FOUND', 404);
    }

    const updated = await this.repository.updateProjectSkill(projectId, skillId, userId, role);
    if (!updated) {
      throw new ProjectsError('Failed to update project skill.', 'INTERNAL_ERROR', 500);
    }

    const skill = await this.repository.findSkillById(skillId, userId);
    return {
      project_id: updated.project_id,
      skill_id: updated.skill_id,
      user_id: updated.user_id,
      role: updated.role as ProjectSkillDto['role'],
      created_at: updated.created_at,
      skill_name: skill?.name,
      skill_slug: skill?.slug,
    };
  }

  async detachSkill(projectId: string, userId: string, skillId: string): Promise<boolean> {
    const project = await this.repository.findProjectById(projectId, userId);
    if (!project) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    const existing = await this.repository.findProjectSkill(projectId, skillId, userId);
    if (!existing) {
      throw new ProjectsError('Skill link not found on this project.', 'NOT_FOUND', 404);
    }

    return this.repository.detachSkill(projectId, skillId, userId);
  }

  // --- Project Activities ---
  async getProjectActivities(
    projectId: string,
    userId: string,
    limit = 20,
    cursor?: string
  ): Promise<ExternalActivityDto[]> {
    const project = await this.repository.findProjectById(projectId, userId);
    if (!project) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    if (!project.repository_id) {
      return [];
    }

    const clampedLimit = Math.max(1, Math.min(100, limit));
    const activities = await this.repository.findActivitiesByRepositoryId(
      project.repository_id,
      userId,
      clampedLimit,
      cursor
    );
    return (activities || []).map((a: ExternalActivityRow) => this.mapActivityDto(a));
  }

  // --- Project Tasks ---
  async listProjectTasks(
    projectId: string,
    userId: string,
    filters?: { status?: TaskStatus; milestoneId?: string }
  ): Promise<TaskDto[]> {
    const project = await this.repository.findProjectById(projectId, userId);
    if (!project) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    let tasks = await this.repository.findTasksByProjectId(projectId, userId);
    if (filters?.milestoneId) {
      tasks = tasks.filter((t: TaskRow) => t.project_milestone_id === filters.milestoneId);
    }
    if (filters?.status) {
      tasks = tasks.filter((t: TaskRow) => t.status === filters.status);
    }

    return tasks.map((t: TaskRow) => ({
      id: t.id,
      user_id: t.user_id,
      title: t.title,
      description: t.description,
      status: t.status as TaskStatus,
      priority: t.priority as TaskPriority,
      task_type: t.task_type as TaskType,
      goal_id: t.goal_id,
      milestone_id: t.milestone_id,
      project_id: t.project_id,
      project_milestone_id: t.project_milestone_id,
      project_title: project.title,
      estimated_minutes: t.estimated_minutes,
      actual_minutes: t.actual_minutes,
      due_at: t.due_at,
      scheduled_start: t.scheduled_start,
      scheduled_end: t.scheduled_end,
      completed_at: t.completed_at,
      notes: t.notes,
      created_at: t.created_at,
      updated_at: t.updated_at,
    })) as TaskDto[];
  }

  async listMilestoneTasks(
    projectId: string,
    milestoneId: string,
    userId: string,
    filters?: { status?: TaskStatus }
  ): Promise<TaskDto[]> {
    const project = await this.repository.findProjectById(projectId, userId);
    if (!project) {
      throw new ProjectsError('Project not found or access denied.', 'NOT_FOUND', 404);
    }

    const milestone = await this.repository.findMilestoneById(milestoneId, projectId, userId);
    if (!milestone) {
      throw new ProjectsError('Milestone not found or does not belong to this project.', 'NOT_FOUND', 404);
    }

    let tasks = await this.repository.findTasksByProjectId(projectId, userId);
    tasks = tasks.filter((t: TaskRow) => t.project_milestone_id === milestoneId);
    if (filters?.status) {
      tasks = tasks.filter((t: TaskRow) => t.status === filters.status);
    }

    return tasks.map((t: TaskRow) => ({
      id: t.id,
      user_id: t.user_id,
      title: t.title,
      description: t.description,
      status: t.status as TaskStatus,
      priority: t.priority as TaskPriority,
      task_type: t.task_type as TaskType,
      goal_id: t.goal_id,
      milestone_id: t.milestone_id,
      project_id: t.project_id,
      project_milestone_id: t.project_milestone_id,
      project_title: project.title,
      project_milestone_title: milestone.title,
      estimated_minutes: t.estimated_minutes,
      actual_minutes: t.actual_minutes,
      due_at: t.due_at,
      scheduled_start: t.scheduled_start,
      scheduled_end: t.scheduled_end,
      completed_at: t.completed_at,
      notes: t.notes,
      created_at: t.created_at,
      updated_at: t.updated_at,
    })) as TaskDto[];
  }
}

export const defaultProjectsService = new ProjectsService();
