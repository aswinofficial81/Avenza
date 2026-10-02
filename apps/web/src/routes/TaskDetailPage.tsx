import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Calendar,
  Target,
  Edit2,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Pause,
  SkipForward,
  XCircle,
  FileText,
  Timer,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import { Breadcrumbs } from '../components/navigation/Breadcrumbs';
import {
  TaskStatusBadge,
  TaskPriorityBadge,
  TaskTypeBadge,
  TaskBlockedBadge,
} from '../features/tasks/components/TaskBadges';
import { EditTaskModal } from '../features/tasks/components/EditTaskModal';
import { TaskDependencyManager } from '../features/tasks/components/TaskDependencyManager';
import { useTask, useUpdateTask, useDeleteTask } from '../features/tasks/useTasks';
import type { TaskStatus } from '@avenza/shared';

export const TaskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data: task, isLoading, isError, error, refetch } = useTask(id);
  const updateTaskMutation = useUpdateTask(id || '');
  const deleteTaskMutation = useDeleteTask();

  const handleStatusTransition = async (newStatus: TaskStatus) => {
    if (!task) return;
    try {
      await updateTaskMutation.mutateAsync({ status: newStatus });
      refetch();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleToggleComplete = async (t: typeof task) => {
    if (!t) return;
    const newStatus: TaskStatus = t.status === 'completed' ? 'inbox' : 'completed';
    await handleStatusTransition(newStatus);
  };

  const handleDeleteConfirm = async () => {
    if (!task) return;
    try {
      await deleteTaskMutation.mutateAsync(task.id);
      navigate('/tasks');
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="w-48 h-5" />
        <div className="space-y-3">
          <Skeleton className="w-3/4 h-8" />
          <Skeleton className="w-1/2 h-4" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="md:col-span-2 h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (isError || !task) {
    return (
      <div className="max-w-5xl mx-auto py-8">
        <ErrorState
          title="Task not found"
          description={error instanceof Error ? error.message : 'The requested task could not be loaded.'}
          onRetry={refetch}
        />
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" onClick={() => navigate('/tasks')}>
            Back to Tasks
          </Button>
        </div>
      </div>
    );
  }

  const isCompleted = task.status === 'completed';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. Breadcrumbs & Back Navigation */}
      <div className="flex items-center justify-between">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/overview' },
            { label: 'Tasks', href: '/tasks' },
            { label: task.title, isCurrent: true },
          ]}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/tasks')}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Tasks
        </Button>
      </div>

      {/* 2. Top Header & Primary Actions */}
      <div className="border border-border rounded-xl bg-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <TaskStatusBadge status={task.status} />
              <TaskPriorityBadge priority={task.priority} />
              <TaskTypeBadge type={task.task_type} />
              {task.is_blocked && (
                <TaskBlockedBadge blockingCount={task.blocking_task_count} />
              )}
            </div>

            <h1
              className={`text-2xl font-bold tracking-tight text-foreground ${
                isCompleted ? 'line-through text-muted-foreground' : ''
              }`}
            >
              {task.title}
            </h1>

            {task.description && (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {task.description}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            {/* Complete / Reopen */}
            <Button
              variant={isCompleted ? 'outline' : 'primary'}
              size="sm"
              onClick={() => handleToggleComplete(task)}
              isLoading={updateTaskMutation.isPending}
              className="flex items-center gap-1.5"
            >
              {isCompleted ? (
                <>
                  <Circle className="w-4 h-4" />
                  <span>Reopen Task</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Completed</span>
                </>
              )}
            </Button>

            {/* Edit */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </Button>

            {/* Quick Status Dropdown / Controls */}
            {!isCompleted && (
              <>
                {task.status !== 'deferred' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusTransition('deferred')}
                    title="Defer task"
                    className="text-muted-foreground hover:text-foreground h-9 px-2"
                  >
                    <Pause className="w-4 h-4" />
                  </Button>
                )}
                {task.status !== 'skipped' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusTransition('skipped')}
                    title="Skip task"
                    className="text-muted-foreground hover:text-foreground h-9 px-2"
                  >
                    <SkipForward className="w-4 h-4" />
                  </Button>
                )}
                {task.status !== 'cancelled' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusTransition('cancelled')}
                    title="Cancel task"
                    className="text-muted-foreground hover:text-rose-500 h-9 px-2"
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                )}
              </>
            )}

            {/* Delete */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDeleteOpen(true)}
              className="text-muted-foreground hover:text-rose-500 h-9 w-9 p-0"
              title="Delete task"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details, Timeline & Notes (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Execution Time & Estimates */}
          <div className="border border-border rounded-xl bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Timer className="w-4 h-4 text-primary" />
              Time & Estimates
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
              <div>
                <p className="text-xs text-muted-foreground">Estimated Time</p>
                <p className="text-base font-semibold text-foreground mt-0.5">
                  {task.estimated_minutes ? `${task.estimated_minutes} min` : 'Not set'}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Actual Time</p>
                <p className="text-base font-semibold text-foreground mt-0.5">
                  {task.actual_minutes !== null ? `${task.actual_minutes} min` : '0 min'}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className="text-sm font-medium text-foreground mt-0.5">
                  {task.due_at ? new Date(task.due_at).toLocaleDateString() : 'None'}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Completed At</p>
                <p className="text-sm font-medium text-foreground mt-0.5">
                  {task.completed_at ? new Date(task.completed_at).toLocaleDateString() : 'Incomplete'}
                </p>
              </div>
            </div>

            {(task.scheduled_start || task.scheduled_end) && (
              <div className="border-t border-border pt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                <span>
                  Scheduled:{' '}
                  {task.scheduled_start
                    ? new Date(task.scheduled_start).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Unscheduled'}{' '}
                  &rarr;{' '}
                  {task.scheduled_end
                    ? new Date(task.scheduled_end).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Open'}
                </span>
              </div>
            )}
          </div>

          {/* Notes & References */}
          {task.notes && (
            <div className="border border-border rounded-xl bg-card p-5 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Notes & References
              </h3>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {task.notes}
              </p>
            </div>
          )}

          {/* Dependency Manager Component */}
          <TaskDependencyManager task={task} />
        </div>

        {/* Right Column: Goal/Milestone Context & Meta (1 Col) */}
        <div className="space-y-6">
          {/* Associated Goal & Milestone */}
          <div className="border border-border rounded-xl bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Strategic Alignment
            </h3>

            {task.goal_id ? (
              <div className="space-y-2 pt-1">
                <div>
                  <span className="text-xs text-muted-foreground">Parent Goal:</span>
                  <Link
                    to={`/goals/${task.goal_id}`}
                    className="block text-sm font-medium text-foreground hover:text-primary transition-colors mt-0.5"
                  >
                    {task.goal_title || 'View Goal Details'}
                  </Link>
                </div>

                {task.milestone_id && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">Milestone:</span>
                    <p className="text-sm font-medium text-foreground mt-0.5">
                      {task.milestone_title || 'Linked Milestone'}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground pt-1">
                This is an independent task with no associated goal or milestone.
              </div>
            )}
          </div>

          {/* Task System Metadata */}
          <div className="border border-border rounded-xl bg-card p-5 space-y-3 text-xs text-muted-foreground">
            <h3 className="text-sm font-semibold text-foreground">Metadata</h3>
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between">
                <span>Task ID:</span>
                <span className="font-mono text-foreground">{task.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span>Created:</span>
                <span className="text-foreground">
                  {new Date(task.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Updated:</span>
                <span className="text-foreground">
                  {new Date(task.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <EditTaskModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          refetch();
        }}
        task={task}
      />

      <ConfirmationDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Task"
        message={`Are you sure you want to delete "${task.title}"? Any prerequisite relationships referencing this task will be removed. This cannot be undone.`}
        confirmLabel="Delete Task"
        variant="danger"
        isLoading={deleteTaskMutation.isPending}
      />
    </div>
  );
};
