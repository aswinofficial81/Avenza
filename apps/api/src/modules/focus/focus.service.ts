import type {
  FocusSessionDto,
  FocusSessionStatus,
  FocusSessionType,
  FocusSessionTaskSummary,
  PaginatedList,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '@avenza/shared';
import type { ITasksRepository } from '../tasks/tasks.types';
import { defaultTasksRepository } from '../tasks/tasks.repository';
import type { IGoalsRepository } from '../goals/goals.types';
import { defaultGoalsRepository } from '../goals/goals.repository';
import type { IProjectsRepository } from '../projects/projects.repository';
import { defaultProjectsRepository } from '../projects/projects.repository';
import type {
  FocusSessionRow,
  IFocusRepository,
  IFocusService,
} from './focus.types';
import { defaultFocusRepository } from './focus.repository';

export class FocusError extends Error {
  constructor(
    message: string,
    public readonly code: 'CONFLICT' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'FORBIDDEN',
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'FocusError';
  }
}

export class FocusService implements IFocusService {
  constructor(
    private readonly focusRepository: IFocusRepository = defaultFocusRepository,
    private readonly tasksRepository: ITasksRepository = defaultTasksRepository,
    private readonly goalsRepository: IGoalsRepository = defaultGoalsRepository,
    private readonly projectsRepository: IProjectsRepository = defaultProjectsRepository
  ) {}

  private async enrichSessionWithTask(
    session: FocusSessionRow,
    userId: string
  ): Promise<FocusSessionDto> {
    let taskSummary: FocusSessionTaskSummary | null = null;

    if (session.task_id) {
      const task = await this.tasksRepository.findTaskById(session.task_id, userId);
      if (task) {
        let goalTitle: string | null = null;
        if (task.goal_id) {
          const goal = await this.goalsRepository.findGoalById(task.goal_id, userId);
          goalTitle = goal?.title || null;
        }

        let projectTitle: string | null = null;
        let projectMilestoneTitle: string | null = null;
        if (task.project_id) {
          const proj = await this.projectsRepository.findProjectById(task.project_id, userId);
          projectTitle = proj?.title || null;
          if (task.project_milestone_id) {
            const ms = await this.projectsRepository.findMilestoneById(
              task.project_milestone_id,
              task.project_id,
              userId
            );
            projectMilestoneTitle = ms?.title || null;
          }
        }

        taskSummary = {
          id: task.id,
          title: task.title,
          status: task.status as TaskStatus,
          priority: task.priority as TaskPriority,
          task_type: task.task_type as TaskType,
          goal_title: goalTitle,
          project_title: projectTitle,
          project_milestone_title: projectMilestoneTitle,
        };
      }
    }

    return {
      id: session.id,
      user_id: session.user_id,
      task_id: session.task_id,
      session_type: session.session_type,
      status: session.status,
      started_at: session.started_at,
      ended_at: session.ended_at,
      planned_minutes: session.planned_minutes,
      actual_minutes: session.actual_minutes,
      notes: session.notes,
      created_at: session.created_at,
      updated_at: session.updated_at,
      task: taskSummary,
    };
  }

  async startSession(
    userId: string,
    input: {
      taskId: string;
      sessionType?: FocusSessionType;
      plannedMinutes: number;
      notes?: string | null;
    }
  ): Promise<FocusSessionDto> {
    // 1. Invariant: At most one active session per user
    const existingActive = await this.focusRepository.findActiveSessionByUserId(userId);
    if (existingActive) {
      throw new FocusError(
        'You already have an active focus session. Complete or cancel it before starting a new one.',
        'CONFLICT',
        409
      );
    }

    // 2. Verify task existence & ownership
    const task = await this.tasksRepository.findTaskById(input.taskId, userId);
    if (!task) {
      throw new FocusError('Task not found or does not belong to the user.', 'NOT_FOUND', 404);
    }

    // 3. Task eligibility: Reject completed, cancelled, or skipped tasks
    if (task.status === 'completed' || task.status === 'cancelled' || task.status === 'skipped') {
      throw new FocusError(
        `Cannot start focus on a task with status '${task.status}'. Choose an actionable task.`,
        'CONFLICT',
        409
      );
    }

    // 4. Blocked tasks check: Reject if task has uncompleted prerequisites
    const depSummaries = await this.tasksRepository.getDependencySummariesForTasks(
      [task.id],
      userId
    );
    const summary = depSummaries.get(task.id);
    if (summary && summary.uncompletedPrerequisites > 0) {
      throw new FocusError(
        `Cannot start focus on a blocked task. It has ${summary.uncompletedPrerequisites} uncompleted prerequisite(s).`,
        'CONFLICT',
        409
      );
    }

    // 5. Lifecycle Transition: If task is in 'inbox', 'planned', or 'scheduled', advance to 'in_progress'
    if (task.status === 'inbox' || task.status === 'planned' || task.status === 'scheduled') {
      await this.tasksRepository.updateTask(task.id, userId, { status: 'in_progress' });
    }

    // 6. Create active focus session (authoritative server started_at)
    const sessionType = input.sessionType || 'focus';
    const createdSession = await this.focusRepository.createSession({
      user_id: userId,
      task_id: task.id,
      session_type: sessionType,
      planned_minutes: input.plannedMinutes,
      notes: input.notes?.trim() || null,
    });

    return this.enrichSessionWithTask(createdSession, userId);
  }

  async getActiveSession(userId: string): Promise<FocusSessionDto | null> {
    const active = await this.focusRepository.findActiveSessionByUserId(userId);
    if (!active) return null;
    return this.enrichSessionWithTask(active, userId);
  }

  async getSessionById(id: string, userId: string): Promise<FocusSessionDto | null> {
    const session = await this.focusRepository.findSessionById(id, userId);
    if (!session) return null;
    return this.enrichSessionWithTask(session, userId);
  }

  async listSessions(
    userId: string,
    options: {
      taskId?: string;
      status?: FocusSessionStatus;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<PaginatedList<FocusSessionDto>> {
    const paginated = await this.focusRepository.findSessions({
      userId,
      ...options,
    });

    // Batch enrich with task information
    const taskIds = Array.from(
      new Set(paginated.data.map((s) => s.task_id).filter((id): id is string => Boolean(id)))
    );

    const taskMap = new Map<string, FocusSessionTaskSummary>();
    if (taskIds.length > 0) {
      await Promise.all(
        taskIds.map(async (tId) => {
          const task = await this.tasksRepository.findTaskById(tId, userId);
          if (task) {
            taskMap.set(tId, {
              id: task.id,
              title: task.title,
              status: task.status as TaskStatus,
              priority: task.priority as TaskPriority,
              task_type: task.task_type as TaskType,
            });
          }
        })
      );
    }

    const enrichedData: FocusSessionDto[] = paginated.data.map((s) => ({
      id: s.id,
      user_id: s.user_id,
      task_id: s.task_id,
      session_type: s.session_type,
      status: s.status,
      started_at: s.started_at,
      ended_at: s.ended_at,
      planned_minutes: s.planned_minutes,
      actual_minutes: s.actual_minutes,
      notes: s.notes,
      created_at: s.created_at,
      updated_at: s.updated_at,
      task: s.task_id ? taskMap.get(s.task_id) || null : null,
    }));

    return {
      data: enrichedData,
      pagination: paginated.pagination,
    };
  }

  async completeSession(
    id: string,
    userId: string,
    notes?: string | null
  ): Promise<FocusSessionDto> {
    const session = await this.focusRepository.findSessionById(id, userId);
    if (!session) {
      throw new FocusError('Focus session not found.', 'NOT_FOUND', 404);
    }

    if (session.status !== 'active') {
      throw new FocusError(
        `Cannot complete focus session with status '${session.status}'. Only active sessions can be completed.`,
        'CONFLICT',
        409
      );
    }

    // Authoritative server timestamps & duration calculation
    const endedAt = new Date().toISOString();
    const durationMs = new Date(endedAt).getTime() - new Date(session.started_at).getTime();
    const durationMinutes = Math.floor(durationMs / 60_000);
    // Minimum 1 minute rule: less than 1 minute yields 0 actual minutes
    const actualMinutes = durationMinutes < 1 ? 0 : durationMinutes;

    const completed = await this.focusRepository.completeSession(
      id,
      userId,
      endedAt,
      actualMinutes,
      notes
    );

    if (!completed) {
      throw new FocusError('Failed to complete focus session.', 'CONFLICT', 409);
    }

    return this.enrichSessionWithTask(completed, userId);
  }

  async cancelSession(
    id: string,
    userId: string,
    notes?: string | null
  ): Promise<FocusSessionDto> {
    const session = await this.focusRepository.findSessionById(id, userId);
    if (!session) {
      throw new FocusError('Focus session not found.', 'NOT_FOUND', 404);
    }

    if (session.status !== 'active') {
      throw new FocusError(
        `Cannot cancel focus session with status '${session.status}'. Only active sessions can be cancelled.`,
        'CONFLICT',
        409
      );
    }

    const endedAt = new Date().toISOString();
    const cancelled = await this.focusRepository.cancelSession(id, userId, endedAt, notes);

    if (!cancelled) {
      throw new FocusError('Failed to cancel focus session.', 'CONFLICT', 409);
    }

    return this.enrichSessionWithTask(cancelled, userId);
  }
}

export const defaultFocusService = new FocusService();
