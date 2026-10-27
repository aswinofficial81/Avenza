import type {
  PaginatedList,
  ProjectGoalRow,
  ProjectInsert,
  ProjectMilestoneInsert,
  ProjectMilestoneRow,
  ProjectMilestoneUpdate,
  ProjectQueryInput,
  ProjectRow,
  ProjectSkillRow,
  ProjectUpdate,
  TaskRow,
} from '@avenza/shared';

export interface ExternalRepositoryRow {
  id: string;
  connection_id: string;
  user_id: string;
  provider: string;
  external_id: string;
  name: string;
  full_name: string;
  owner: string;
  is_private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  primary_language: string | null;
  languages: Record<string, unknown>;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExternalActivityRow {
  id: string;
  connection_id: string;
  user_id: string;
  repository_id: string | null;
  provider: string;
  external_id: string;
  activity_type: string;
  occurred_at: string;
  title: string;
  summary: string | null;
  external_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProjectFindOptions extends ProjectQueryInput {
  userId: string;
}

export interface ProjectCountsSummary {
  totalMilestones: number;
  completedMilestones: number;
  totalTasks: number;
  completedTasks: number;
  hasOverdueMilestones: boolean;
}

export interface ProjectGoalWithTitle extends ProjectGoalRow {
  goal_title?: string;
}

export interface ProjectSkillWithName extends ProjectSkillRow {
  skill_name?: string;
  skill_slug?: string;
}

export class ProjectsError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'BAD_REQUEST',
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'ProjectsError';
  }
}

export interface IProjectsRepository {
  // Project operations
  findProjects(options: ProjectFindOptions): Promise<PaginatedList<ProjectRow>>;
  findProjectById(id: string, userId: string): Promise<ProjectRow | null>;
  findProjectBySlug(slug: string, userId: string): Promise<ProjectRow | null>;
  createProject(data: ProjectInsert): Promise<ProjectRow>;
  updateProject(id: string, userId: string, data: ProjectUpdate): Promise<ProjectRow | null>;
  deleteProject(id: string, userId: string): Promise<boolean>;

  // Milestone operations
  findMilestonesByProjectId(projectId: string, userId: string): Promise<ProjectMilestoneRow[]>;
  findMilestoneById(milestoneId: string, projectId: string, userId: string): Promise<ProjectMilestoneRow | null>;
  createMilestone(data: ProjectMilestoneInsert): Promise<ProjectMilestoneRow>;
  updateMilestone(milestoneId: string, projectId: string, userId: string, data: ProjectMilestoneUpdate): Promise<ProjectMilestoneRow | null>;
  deleteMilestone(milestoneId: string, projectId: string, userId: string): Promise<boolean>;

  // Repository linkage
  findRepositoryById(repositoryId: string, userId: string): Promise<ExternalRepositoryRow | null>;
  updateProjectRepository(projectId: string, userId: string, repositoryId: string | null): Promise<ProjectRow | null>;

  // Goal relationships
  findGoalById(goalId: string, userId: string): Promise<{ id: string; title: string; user_id: string } | null>;
  findGoalsByProjectId(projectId: string, userId: string): Promise<ProjectGoalWithTitle[]>;
  findProjectGoal(projectId: string, goalId: string, userId: string): Promise<ProjectGoalRow | null>;
  attachGoal(projectId: string, goalId: string, userId: string, isPrimary: boolean): Promise<ProjectGoalRow>;
  updateProjectGoal(projectId: string, goalId: string, userId: string, isPrimary: boolean): Promise<ProjectGoalRow | null>;
  detachGoal(projectId: string, goalId: string, userId: string): Promise<boolean>;

  // Skill relationships
  findSkillById(skillId: string, userId: string): Promise<{ id: string; name: string; slug: string; user_id: string } | null>;
  findSkillsByProjectId(projectId: string, userId: string): Promise<ProjectSkillWithName[]>;
  findProjectSkill(projectId: string, skillId: string, userId: string): Promise<ProjectSkillRow | null>;
  attachSkill(projectId: string, skillId: string, userId: string, role: string): Promise<ProjectSkillRow>;
  updateProjectSkill(projectId: string, skillId: string, userId: string, role: string): Promise<ProjectSkillRow | null>;
  detachSkill(projectId: string, skillId: string, userId: string): Promise<boolean>;

  // Tasks associated with project
  findTasksByProjectId(projectId: string, userId: string): Promise<TaskRow[]>;

  // Activities for project repository
  findActivitiesByRepositoryId(repositoryId: string, userId: string, limit: number, cursor?: string): Promise<ExternalActivityRow[]>;

  // Batch counts summary for project listings
  getProjectSummaries(projectIds: string[]): Promise<Map<string, ProjectCountsSummary>>;
}
