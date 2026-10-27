import type {
  TaskRow,
  TaskInsert,
  TaskUpdate,
  TaskDependencyRow,
  TaskDependencyInsert,
  TaskQueryInput,
  PaginatedList,
  TaskStatus,
} from '@avenza/shared';

export interface TaskFindOptions extends TaskQueryInput {
  userId: string;
}

export interface DependencyWithPrerequisiteTask extends TaskDependencyRow {
  prerequisite: {
    id: string;
    title: string;
    status: TaskStatus;
  };
}

export class TaskBlockedError extends Error {
  public readonly code = 'TASK_BLOCKED';
  public readonly statusCode = 400;

  constructor(
    message: string = 'Cannot transition blocked task to in_progress or completed while prerequisites remain incomplete.',
    public readonly blockedBy?: Array<{ id: string; title: string; status: TaskStatus }>
  ) {
    super(message);
    this.name = 'TaskBlockedError';
  }
}

export interface ITasksRepository {
  // Task operations
  findTasks(options: TaskFindOptions): Promise<PaginatedList<TaskRow>>;
  findTaskById(id: string, userId: string): Promise<TaskRow | null>;
  createTask(data: TaskInsert): Promise<TaskRow>;
  updateTask(id: string, userId: string, data: TaskUpdate): Promise<TaskRow | null>;
  deleteTask(id: string, userId: string): Promise<boolean>;

  // Dependency operations
  // Returns dependencies where task_id = taskId (what this task depends on)
  findDependenciesByTaskId(taskId: string, userId: string): Promise<DependencyWithPrerequisiteTask[]>;
  // Returns dependencies where depends_on_task_id = taskId (what depends on this task)
  findDependentsByTaskId(taskId: string, userId: string): Promise<TaskDependencyRow[]>;
  // Fetch all dependencies for a user to facilitate graph algorithms / cycle detection
  getAllUserDependencies(userId: string): Promise<Array<{ id: string; task_id: string; depends_on_task_id: string }>>;
  createDependency(data: TaskDependencyInsert, userId: string): Promise<TaskDependencyRow>;
  deleteDependency(dependencyId: string, taskId: string, userId: string): Promise<boolean>;
  findDependencyById(dependencyId: string, userId: string): Promise<TaskDependencyRow | null>;

  // Batch dependency info for task lists (to avoid N+1 queries when calculating blocked state)
  getDependencySummariesForTasks(
    taskIds: string[],
    userId: string
  ): Promise<Map<string, { totalPrerequisites: number; uncompletedPrerequisites: number; blockedBy: Array<{ id: string; title: string; status: TaskStatus }> }>>;
}
