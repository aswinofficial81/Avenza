import type {
  CreateTaskDependencyInput,
  CreateTaskInput,
  PaginatedList,
  TaskDependencyDto,
  TaskDetailDto,
  TaskDto,
  TaskPriority,
  TaskStatus,
  TaskType,
  TaskUpdate,
  UpdateTaskInput,
} from '@avenza/shared';
import type { IGoalsRepository } from '../goals/goals.types';
import { defaultGoalsRepository } from '../goals/goals.repository';
import type { IProjectsRepository } from '../projects/projects.repository';
import { defaultProjectsRepository } from '../projects/projects.repository';
import { type ITasksRepository, type TaskFindOptions, TaskBlockedError } from './tasks.types';
import { defaultTasksRepository } from './tasks.repository';

export class TasksService {
  constructor(
    private readonly tasksRepository: ITasksRepository = defaultTasksRepository,
    private readonly goalsRepository: IGoalsRepository = defaultGoalsRepository,
    private readonly projectsRepository: IProjectsRepository = defaultProjectsRepository
  ) {}

  async listTasks(options: TaskFindOptions): Promise<PaginatedList<TaskDto>> {
    const paginated = await this.tasksRepository.findTasks(options);
    const taskIds = paginated.data.map((t) => t.id);

    const summaries = await this.tasksRepository.getDependencySummariesForTasks(
      taskIds,
      options.userId
    );

    // Batch fetch project and milestone titles if present
    const projectTitlesMap = new Map<string, string>();
    const projectMilestoneTitlesMap = new Map<string, string>();
    const distinctProjectIds = Array.from(
      new Set(paginated.data.map((t) => t.project_id).filter((id): id is string => Boolean(id)))
    );

    if (distinctProjectIds.length > 0) {
      await Promise.all(
        distinctProjectIds.map(async (pId) => {
          const proj = await this.projectsRepository.findProjectById(pId, options.userId);
          if (proj) {
            projectTitlesMap.set(proj.id, proj.title);
          }
          const milestones = await this.projectsRepository.findMilestonesByProjectId(pId, options.userId);
          for (const m of milestones) {
            projectMilestoneTitlesMap.set(m.id, m.title);
          }
        })
      );
    }

    const data: TaskDto[] = paginated.data.map((task) => {
      const summary = summaries.get(task.id) || {
        totalPrerequisites: 0,
        uncompletedPrerequisites: 0,
        blockedBy: [],
      };

      const isBlocked = summary.uncompletedPrerequisites > 0;

      const metrics = {
        is_blocked: isBlocked,
        blocking_task_count: summary.uncompletedPrerequisites,
        blocked_by: summary.blockedBy,
      };

      return {
        ...task,
        status: task.status as TaskStatus,
        priority: task.priority as TaskPriority,
        task_type: task.task_type as TaskType,
        project_title: task.project_id ? projectTitlesMap.get(task.project_id) || null : null,
        project_milestone_title: task.project_milestone_id
          ? projectMilestoneTitlesMap.get(task.project_milestone_id) || null
          : null,
        is_blocked: isBlocked,
        blocking_task_count: summary.uncompletedPrerequisites,
        blocked_by: summary.blockedBy,
        metrics,
      };
    });

    return {
      data,
      pagination: paginated.pagination,
    };
  }

  async getTaskById(id: string, userId: string): Promise<TaskDetailDto | null> {
    const task = await this.tasksRepository.findTaskById(id, userId);
    if (!task) return null;

    // Fetch dependencies (prerequisites)
    const dependenciesWithPrereqs = await this.tasksRepository.findDependenciesByTaskId(id, userId);

    // Fetch dependents (tasks depending on this task)
    const dependentRows = await this.tasksRepository.findDependentsByTaskId(id, userId);
    const dependents: TaskDependencyDto[] = dependentRows.map((d) => ({
      id: d.id,
      task_id: d.task_id,
      depends_on_task_id: d.depends_on_task_id,
      created_at: d.created_at,
    }));

    const blockedBy = dependenciesWithPrereqs
      .filter((d) => d.prerequisite.status !== 'completed')
      .map((d) => ({
        id: d.prerequisite.id,
        title: d.prerequisite.title,
        status: d.prerequisite.status,
      }));

    const isBlocked = blockedBy.length > 0;

    // Fetch goal title if goal_id present
    let goalTitle: string | null = null;
    if (task.goal_id) {
      const goal = await this.goalsRepository.findGoalById(task.goal_id, userId);
      if (goal) {
        goalTitle = goal.title;
      }
    }

    // Fetch milestone title if milestone_id present
    let milestoneTitle: string | null = null;
    if (task.milestone_id && task.goal_id) {
      const milestone = await this.goalsRepository.findMilestoneById(
        task.milestone_id,
        task.goal_id,
        userId
      );
      if (milestone) {
        milestoneTitle = milestone.title;
      }
    }

    // Fetch project title and project milestone title if present
    let projectTitle: string | null = null;
    let projectMilestoneTitle: string | null = null;
    if (task.project_id) {
      const proj = await this.projectsRepository.findProjectById(task.project_id, userId);
      if (proj) {
        projectTitle = proj.title;
      }
      if (task.project_milestone_id) {
        const ms = await this.projectsRepository.findMilestoneById(
          task.project_milestone_id,
          task.project_id,
          userId
        );
        if (ms) {
          projectMilestoneTitle = ms.title;
        }
      }
    }

    const dependencies: TaskDependencyDto[] = dependenciesWithPrereqs.map((d) => ({
      id: d.id,
      task_id: d.task_id,
      depends_on_task_id: d.depends_on_task_id,
      prerequisite_title: d.prerequisite.title,
      prerequisite_status: d.prerequisite.status,
      created_at: d.created_at,
    }));

    const metrics = {
      is_blocked: isBlocked,
      blocking_task_count: blockedBy.length,
      blocked_by: blockedBy,
    };

    return {
      ...task,
      status: task.status as TaskStatus,
      priority: task.priority as TaskPriority,
      task_type: task.task_type as TaskType,
      goal_title: goalTitle,
      milestone_title: milestoneTitle,
      project_title: projectTitle,
      project_milestone_title: projectMilestoneTitle,
      is_blocked: isBlocked,
      blocking_task_count: blockedBy.length,
      blocked_by: blockedBy,
      metrics,
      dependencies,
      dependents,
    };
  }

  async createTask(userId: string, input: CreateTaskInput): Promise<TaskDetailDto> {
    // 1. Cross-domain ownership & consistency validation for goals & milestones
    let resolvedGoalId = input.goal_id ?? null;
    const resolvedMilestoneId = input.milestone_id ?? null;

    if (resolvedMilestoneId) {
      // Find milestone across user's goals
      // To ensure user ownership and find parent goal:
      if (resolvedGoalId) {
        const ms = await this.goalsRepository.findMilestoneById(
          resolvedMilestoneId,
          resolvedGoalId,
          userId
        );
        if (!ms) {
          throw new Error('Milestone not found or does not belong to the specified goal and user.');
        }
      } else {
        // Find parent goal of milestone
        const allGoals = await this.goalsRepository.findGoals({ userId, pageSize: 100 });
        let matchedGoalId: string | null = null;
        for (const g of allGoals.data) {
          const ms = await this.goalsRepository.findMilestoneById(
            resolvedMilestoneId,
            g.id,
            userId
          );
          if (ms) {
            matchedGoalId = g.id;
            break;
          }
        }
        if (!matchedGoalId) {
          throw new Error('Milestone not found or does not belong to the authenticated user.');
        }
        resolvedGoalId = matchedGoalId;
      }
    } else if (resolvedGoalId) {
      const goal = await this.goalsRepository.findGoalById(resolvedGoalId, userId);
      if (!goal) {
        throw new Error('Goal not found or does not belong to the authenticated user.');
      }
    }

    // 2. Cross-domain ownership & consistency validation for projects & project milestones
    const resolvedProjectId = input.project_id ?? null;
    const resolvedProjectMilestoneId = input.project_milestone_id ?? null;

    if (resolvedProjectMilestoneId) {
      if (!resolvedProjectId) {
        throw new Error('Project milestone requires a project.');
      }
      const ms = await this.projectsRepository.findMilestoneById(
        resolvedProjectMilestoneId,
        resolvedProjectId,
        userId
      );
      if (!ms) {
        throw new Error('Project milestone not found or does not belong to the specified project and user.');
      }
    } else if (resolvedProjectId) {
      const proj = await this.projectsRepository.findProjectById(resolvedProjectId, userId);
      if (!proj) {
        throw new Error('Project not found or does not belong to the authenticated user.');
      }
    }

    // 3. Schedule dates validation
    if (input.scheduled_start && input.scheduled_end) {
      const start = new Date(input.scheduled_start).getTime();
      const end = new Date(input.scheduled_end).getTime();
      if (end < start) {
        throw new Error('Scheduled end cannot be before scheduled start.');
      }
    }

    // 4. Lifecycle status & completed_at
    const status = input.status || 'inbox';
    const completedAt = status === 'completed' ? new Date().toISOString() : null;

    const created = await this.tasksRepository.createTask({
      user_id: userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      status,
      priority: input.priority || 'medium',
      task_type: input.task_type || 'personal',
      goal_id: resolvedGoalId,
      milestone_id: resolvedMilestoneId,
      project_id: resolvedProjectId,
      project_milestone_id: resolvedProjectMilestoneId,
      application_id: input.application_id ?? null,
      estimated_minutes: input.estimated_minutes ?? null,
      actual_minutes: input.actual_minutes ?? null,
      due_at: input.due_at ?? null,
      scheduled_start: input.scheduled_start ?? null,
      scheduled_end: input.scheduled_end ?? null,
      completed_at: completedAt,
      notes: input.notes?.trim() || null,
    });

    const detailed = await this.getTaskById(created.id, userId);
    if (!detailed) {
      throw new Error('Failed to retrieve task after creation.');
    }
    return detailed;
  }

  async updateTask(
    id: string,
    userId: string,
    input: UpdateTaskInput
  ): Promise<TaskDetailDto | null> {
    const existing = await this.tasksRepository.findTaskById(id, userId);
    if (!existing) return null;

    // 1. Cross-domain ownership & consistency validation for goals & milestones
    const resolvedGoalId: string | null =
      input.goal_id !== undefined ? input.goal_id : existing.goal_id;
    const resolvedMilestoneId: string | null =
      input.milestone_id !== undefined ? input.milestone_id : existing.milestone_id;

    if (resolvedMilestoneId) {
      if (resolvedGoalId) {
        const ms = await this.goalsRepository.findMilestoneById(
          resolvedMilestoneId,
          resolvedGoalId,
          userId
        );
        if (!ms) {
          throw new Error('Milestone not found or does not belong to the specified goal and user.');
        }
      } else {
        throw new Error('A milestone must be associated with its parent goal.');
      }
    } else if (input.goal_id) {
      const goal = await this.goalsRepository.findGoalById(input.goal_id, userId);
      if (!goal) {
        throw new Error('Goal not found or does not belong to the authenticated user.');
      }
    }

    // 2. Cross-domain ownership & consistency validation for projects & project milestones
    let finalProjectId =
      input.project_id !== undefined ? input.project_id : existing.project_id;
    let finalProjectMilestoneId =
      input.project_milestone_id !== undefined
        ? input.project_milestone_id
        : existing.project_milestone_id;

    if (input.project_id === null) {
      finalProjectId = null;
      finalProjectMilestoneId = null;
    }

    if (input.project_milestone_id && finalProjectId === null) {
      throw new Error('Project milestone requires a project.');
    }

    if (finalProjectMilestoneId) {
      if (!finalProjectId) {
        throw new Error('Project milestone requires a project.');
      }
      const ms = await this.projectsRepository.findMilestoneById(
        finalProjectMilestoneId,
        finalProjectId,
        userId
      );
      if (!ms) {
        throw new Error('Project milestone not found or does not belong to the specified project and user.');
      }
    } else if (input.project_id !== undefined && input.project_id !== null) {
      const proj = await this.projectsRepository.findProjectById(input.project_id, userId);
      if (!proj) {
        throw new Error('Project not found or does not belong to the authenticated user.');
      }
    }

    // 3. Schedule dates validation
    const effectiveStart =
      input.scheduled_start !== undefined ? input.scheduled_start : existing.scheduled_start;
    const effectiveEnd =
      input.scheduled_end !== undefined ? input.scheduled_end : existing.scheduled_end;

    if (effectiveStart && effectiveEnd) {
      const start = new Date(effectiveStart).getTime();
      const end = new Date(effectiveEnd).getTime();
      if (end < start) {
        throw new Error('Scheduled end cannot be before scheduled start.');
      }
    }

    // 4. Blocked task state transition validation (DEF-17C-01)
    // Authoritative check: Tasks with uncompleted prerequisites cannot transition to 'in_progress' or 'completed'.
    // Concurrency note: Dependency state is rechecked immediately prior to mutation. Under standard non-locking read-then-write,
    // a concurrent transaction reopening a prerequisite between this check and the write could theoretically create an edge case;
    // this check provides authoritative application-level enforcement given the current repository locking model.
    if (input.status === 'completed' || input.status === 'in_progress') {
      const dependencies = await this.tasksRepository.findDependenciesByTaskId(id, userId);
      const incompletePrereqs = dependencies.filter(
        (d) => d.prerequisite.status !== 'completed'
      );
      if (incompletePrereqs.length > 0) {
        const blockedBy = incompletePrereqs.map((d) => ({
          id: d.prerequisite.id,
          title: d.prerequisite.title,
          status: d.prerequisite.status,
        }));
        throw new TaskBlockedError(
          `Cannot transition task to '${input.status}' because it is blocked by ${incompletePrereqs.length} incomplete prerequisite task(s).`,
          blockedBy
        );
      }
    }

    // 5. Lifecycle transitions for status & completed_at
    let completedAt = existing.completed_at;
    if (input.status !== undefined) {
      if (input.status === 'completed' && existing.status !== 'completed') {
        completedAt = new Date().toISOString();
      } else if (input.status !== 'completed' && existing.status === 'completed') {
        completedAt = null;
      }
    }

    const updatePayload: TaskUpdate = {};
    if (input.title !== undefined) updatePayload.title = input.title.trim();
    if (input.description !== undefined)
      updatePayload.description = input.description ? input.description.trim() : null;
    if (input.status !== undefined) updatePayload.status = input.status;
    if (input.priority !== undefined) updatePayload.priority = input.priority;
    if (input.task_type !== undefined) updatePayload.task_type = input.task_type;
    if (input.goal_id !== undefined) updatePayload.goal_id = resolvedGoalId;
    if (input.milestone_id !== undefined) updatePayload.milestone_id = resolvedMilestoneId;
    if (input.project_id !== undefined) updatePayload.project_id = finalProjectId;
    if (input.project_milestone_id !== undefined || input.project_id === null) {
      updatePayload.project_milestone_id = finalProjectMilestoneId;
    }
    if (input.application_id !== undefined) updatePayload.application_id = input.application_id;
    if (input.estimated_minutes !== undefined)
      updatePayload.estimated_minutes = input.estimated_minutes;
    if (input.actual_minutes !== undefined) updatePayload.actual_minutes = input.actual_minutes;
    if (input.due_at !== undefined) updatePayload.due_at = input.due_at;
    if (input.scheduled_start !== undefined) updatePayload.scheduled_start = input.scheduled_start;
    if (input.scheduled_end !== undefined) updatePayload.scheduled_end = input.scheduled_end;
    if (input.notes !== undefined) updatePayload.notes = input.notes ? input.notes.trim() : null;
    updatePayload.completed_at = completedAt;

    await this.tasksRepository.updateTask(id, userId, updatePayload);

    return this.getTaskById(id, userId);
  }

  async deleteTask(id: string, userId: string): Promise<boolean> {
    return this.tasksRepository.deleteTask(id, userId);
  }

  async listDependencies(taskId: string, userId: string): Promise<TaskDependencyDto[]> {
    const task = await this.tasksRepository.findTaskById(taskId, userId);
    if (!task) {
      throw new Error('Task not found');
    }

    const dependenciesWithPrereqs = await this.tasksRepository.findDependenciesByTaskId(
      taskId,
      userId
    );

    return dependenciesWithPrereqs.map((d) => ({
      id: d.id,
      task_id: d.task_id,
      depends_on_task_id: d.depends_on_task_id,
      prerequisite_title: d.prerequisite.title,
      prerequisite_status: d.prerequisite.status,
      created_at: d.created_at,
    }));
  }

  async createDependency(
    taskId: string,
    input: CreateTaskDependencyInput,
    userId: string
  ): Promise<TaskDependencyDto> {
    const dependsOnTaskId = input.depends_on_task_id;

    // 1. Cannot depend on self
    if (taskId === dependsOnTaskId) {
      throw new Error('A task cannot depend on itself.');
    }

    // 2. Both tasks must exist and belong to user
    const [task, prereqTask] = await Promise.all([
      this.tasksRepository.findTaskById(taskId, userId),
      this.tasksRepository.findTaskById(dependsOnTaskId, userId),
    ]);

    if (!task) {
      throw new Error('Task not found or does not belong to the user.');
    }
    if (!prereqTask) {
      throw new Error('Prerequisite task not found or does not belong to the user.');
    }

    // 3. Duplicate check
    const existingDeps = await this.tasksRepository.findDependenciesByTaskId(taskId, userId);
    if (existingDeps.some((d) => d.depends_on_task_id === dependsOnTaskId)) {
      throw new Error('This task dependency relationship already exists.');
    }

    // 4. Cycle detection
    // Edge: A -> B means A depends on B.
    // If we want to add taskId -> dependsOnTaskId, we must check if dependsOnTaskId already transitively depends on taskId.
    const allUserDeps = await this.tasksRepository.getAllUserDependencies(userId);
    const adjMap = new Map<string, string[]>();
    for (const dep of allUserDeps) {
      const list = adjMap.get(dep.task_id) || [];
      list.push(dep.depends_on_task_id);
      adjMap.set(dep.task_id, list);
    }

    // Run DFS starting from dependsOnTaskId to see if taskId is reachable
    const visited = new Set<string>();
    const stack: string[] = [dependsOnTaskId];
    let cycleFound = false;

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === taskId) {
        cycleFound = true;
        break;
      }
      if (!visited.has(current)) {
        visited.add(current);
        const neighbors = adjMap.get(current) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            stack.push(neighbor);
          }
        }
      }
    }

    if (cycleFound) {
      throw new Error(
        'Circular dependency detected: adding this dependency would create a cycle.'
      );
    }

    const created = await this.tasksRepository.createDependency(
      {
        task_id: taskId,
        depends_on_task_id: dependsOnTaskId,
      },
      userId
    );

    return {
      id: created.id,
      task_id: created.task_id,
      depends_on_task_id: created.depends_on_task_id,
      prerequisite_title: prereqTask.title,
      prerequisite_status: prereqTask.status as TaskStatus,
      created_at: created.created_at,
    };
  }

  async deleteDependency(
    taskId: string,
    dependencyId: string,
    userId: string
  ): Promise<boolean> {
    const task = await this.tasksRepository.findTaskById(taskId, userId);
    if (!task) return false;

    return this.tasksRepository.deleteDependency(dependencyId, taskId, userId);
  }
}

export const defaultTasksService = new TasksService();
