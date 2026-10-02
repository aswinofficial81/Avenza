import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Calendar,
  Trash2,
  Edit2,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  Target,
  CheckSquare,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import { Pagination } from '../components/ui/Pagination';
import {
  TaskStatusBadge,
  TaskPriorityBadge,
  TaskTypeBadge,
  TaskBlockedBadge,
} from '../features/tasks/components/TaskBadges';
import { CreateTaskModal } from '../features/tasks/components/CreateTaskModal';
import { EditTaskModal } from '../features/tasks/components/EditTaskModal';
import {
  useTasks,
  useUpdateTask,
  useDeleteTask,
  useTask,
} from '../features/tasks/useTasks';
import { useGoals } from '../features/goals/useGoals';
import type {
  TaskDto,
  TaskStatus,
  TaskPriority,
  TaskType,
} from '@avenza/shared';

export const TasksPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL Query State
  const search = searchParams.get('search') || '';
  const status = (searchParams.get('status') as TaskStatus) || undefined;
  const priority = (searchParams.get('priority') as TaskPriority) || undefined;
  const taskType = (searchParams.get('task_type') as TaskType) || undefined;
  const goalId = searchParams.get('goal_id') || undefined;
  const blockedParam = searchParams.get('blocked');
  const blocked = blockedParam !== null ? blockedParam === 'true' : undefined;
  const sortBy = (searchParams.get('sortBy') as 'due_at' | 'scheduled_start' | 'created_at' | 'priority') || 'created_at';
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 20;

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [taskToEditId, setTaskToEditId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<TaskDto | null>(null);

  // Queries
  const { data, isLoading, isError, error, refetch } = useTasks({
    search: search || undefined,
    status,
    priority,
    task_type: taskType,
    goal_id: goalId,
    blocked,
    sortBy,
    sortOrder,
    page,
    pageSize,
  });

  const { data: goalsData } = useGoals({ pageSize: 100 });
  const goals = goalsData?.data || [];

  const { data: taskToEdit } = useTask(taskToEditId || undefined);

  // Mutations
  const updateTaskMutation = useUpdateTask(taskToEditId || '');
  const deleteTaskMutation = useDeleteTask();

  const updateFilter = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    next.set('page', '1'); // Reset to page 1 on filter change
    setSearchParams(next, { replace: true });
  };

  const tasks = data?.data || [];
  const pagination = data?.pagination;
  const hasActiveFilters = Boolean(search || status || priority || taskType || goalId || blockedParam !== null);

  const handleToggleComplete = async (task: TaskDto) => {
    const newStatus: TaskStatus = task.status === 'completed' ? 'inbox' : 'completed';
    try {
      await updateTaskMutation.mutateAsync({ status: newStatus });
      refetch();
    } catch {
      // Ignored, mutation error will be logged
    }
  };

  const handleDeleteConfirm = async () => {
    if (!taskToDelete) return;
    try {
      await deleteTaskMutation.mutateAsync(taskToDelete.id);
      setTaskToDelete(null);
      refetch();
    } catch {
      // Handled by react-query
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Tasks</h1>
            <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 rounded bg-surface-2 border border-border">
              {pagination?.total ?? tasks.length} {pagination?.total === 1 ? 'task' : 'tasks'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Turn goals into concrete work. Manage execution units, dependencies, schedules, and estimates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCreateOpen(true)}
          >
            Create Task
          </Button>
        </div>
      </div>

      {/* 2. Filter & Controls Toolbar */}
      <div className="bg-surface border border-border rounded-lg p-3 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tasks by title..."
              value={search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <select
              aria-label="Filter by Status"
              value={status || 'all'}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Statuses</option>
              <option value="inbox">Inbox</option>
              <option value="planned">Planned</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="skipped">Skipped</option>
              <option value="deferred">Deferred</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Priority Filter */}
            <select
              aria-label="Filter by Priority"
              value={priority || 'all'}
              onChange={(e) => updateFilter('priority', e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Task Type Filter */}
            <select
              aria-label="Filter by Type"
              value={taskType || 'all'}
              onChange={(e) => updateFilter('task_type', e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Types</option>
              <option value="study">Study</option>
              <option value="practice">Practice</option>
              <option value="revision">Revision</option>
              <option value="assignment">Assignment</option>
              <option value="exam_preparation">Exam Prep</option>
              <option value="dsa">DSA</option>
              <option value="project">Project</option>
              <option value="career">Career</option>
              <option value="administrative">Admin</option>
              <option value="personal">Personal</option>
              <option value="custom">Custom</option>
            </select>

            {/* Goal Filter */}
            <select
              aria-label="Filter by Goal"
              value={goalId || 'all'}
              onChange={(e) => updateFilter('goal_id', e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[160px] truncate"
            >
              <option value="all">All Goals</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>

            {/* Blocked Filter */}
            <select
              aria-label="Filter by Blocked Status"
              value={blockedParam !== null ? blockedParam : 'all'}
              onChange={(e) => updateFilter('blocked', e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Dependencies</option>
              <option value="true">Blocked Only</option>
              <option value="false">Unblocked Only</option>
            </select>

            {/* Sort Filter */}
            <select
              aria-label="Sort tasks by"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const parts = e.target.value.split('-');
                const sb = parts[0];
                const so = parts[1];
                if (sb && so) {
                  const next = new URLSearchParams(searchParams);
                  next.set('sortBy', sb);
                  next.set('sortOrder', so);
                  setSearchParams(next, { replace: true });
                }
              }}
              className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="due_at-asc">Due Date (Earliest)</option>
              <option value="scheduled_start-asc">Scheduled Start</option>
              <option value="priority-desc">Priority</option>
            </select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
                className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Task List Section */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="p-3 rounded-lg border border-border bg-surface flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="w-5 h-5 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="w-48 h-4" />
                  <Skeleton className="w-32 h-3" />
                </div>
              </div>
              <Skeleton className="w-24 h-6" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to load tasks"
          description={error instanceof Error ? error.message : 'An error occurred while fetching tasks.'}
          onRetry={refetch}
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="h-6 w-6 stroke-[1.5]" />}
          title={hasActiveFilters ? 'No tasks match criteria' : 'No tasks yet'}
          description={
            hasActiveFilters
              ? 'Try adjusting your filters or clearing search terms.'
              : 'Create your first task to turn a goal into executable work.'
          }
          action={
            hasActiveFilters ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
              >
                Reset Filters
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setIsCreateOpen(true)}
              >
                Create Task
              </Button>
            )
          }
        />
      ) : (
        <div className="border border-border rounded-xl bg-card divide-y divide-border overflow-hidden">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:bg-muted/40 ${
                task.status === 'completed' ? 'opacity-70 bg-surface/30' : ''
              }`}
            >
              {/* Left Column: Complete Toggle, Title & Meta */}
              <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                {/* Complete Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleComplete(task)}
                  className="mt-0.5 sm:mt-0 flex-shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors focus:outline-none"
                  title={task.status === 'completed' ? 'Reopen task' : 'Mark task completed'}
                >
                  {task.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/10" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/tasks/${task.id}`}
                      className={`text-sm font-semibold hover:text-primary transition-colors truncate ${
                        task.status === 'completed'
                          ? 'line-through text-muted-foreground'
                          : 'text-foreground'
                      }`}
                    >
                      {task.title}
                    </Link>

                    {/* Blocked Badge */}
                    {task.is_blocked && (
                      <TaskBlockedBadge
                        blockingCount={task.blocking_task_count}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                      />
                    )}

                    <TaskStatusBadge status={task.status} />
                    <TaskPriorityBadge priority={task.priority} />
                    <TaskTypeBadge type={task.task_type} />
                  </div>

                  {/* Secondary info: Goal / Milestone & Schedule */}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {task.goal_id && (
                      <span className="flex items-center gap-1 font-medium text-foreground/80">
                        <Target className="w-3 h-3 text-primary flex-shrink-0" />
                        <Link
                          to={`/goals/${task.goal_id}`}
                          className="hover:underline truncate max-w-[150px]"
                        >
                          {task.goal_title || 'Goal'}
                        </Link>
                        {task.milestone_title && (
                          <span className="text-muted-foreground">
                            &rsaquo; {task.milestone_title}
                          </span>
                        )}
                      </span>
                    )}

                    {task.due_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span>Due {new Date(task.due_at).toLocaleDateString()}</span>
                      </span>
                    )}

                    {task.estimated_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span>{task.estimated_minutes}m est</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex items-center gap-1.5 self-end sm:self-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTaskToEditId(task.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  title="Edit Task"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTaskToDelete(task)}
                  className="text-muted-foreground hover:text-rose-500 h-8 w-8 p-0"
                  title="Delete Task"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="h-8 px-2.5 text-xs flex items-center gap-1"
                >
                  <span>Details</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={(p) => updateFilter('page', String(p))}
        />
      )}

      {/* Modals */}
      <CreateTaskModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          refetch();
        }}
      />

      {taskToEdit && (
        <EditTaskModal
          isOpen={Boolean(taskToEditId)}
          onClose={() => {
            setTaskToEditId(null);
            refetch();
          }}
          task={taskToEdit}
        />
      )}

      <ConfirmationDialog
        isOpen={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Task"
        message={`Are you sure you want to delete "${taskToDelete?.title}"? Any prerequisite relationships referencing this task will be removed. This cannot be undone.`}
        confirmLabel="Delete Task"
        variant="danger"
        isLoading={deleteTaskMutation.isPending}
      />
    </div>
  );
};
