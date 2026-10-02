import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Label } from '../../../components/ui/Label';
import { TaskStatusBadge } from './TaskBadges';
import {
  useTasks,
  useCreateTaskDependency,
  useDeleteTaskDependency,
  useTaskDependencies,
} from '../useTasks';
import type { TaskDetailDto } from '@avenza/shared';
import {
  Lock,
  Plus,
  Trash2,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  GitCommit,
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface TaskDependencyManagerProps {
  task: TaskDetailDto;
}

export const TaskDependencyManager: React.FC<TaskDependencyManagerProps> = ({ task }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPrereqId, setSelectedPrereqId] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: dependencies = [] } = useTaskDependencies(task.id);
  const createDependencyMutation = useCreateTaskDependency(task.id);
  const deleteDependencyMutation = useDeleteTaskDependency(task.id);

  // Fetch candidate tasks to add as dependencies (belonging to current user)
  const { data: candidateTasksData, isLoading: isLoadingCandidates } = useTasks({ pageSize: 100 });
  const candidateTasks = (candidateTasksData?.data || []).filter(
    (t) =>
      t.id !== task.id &&
      !dependencies.some((d) => d.depends_on_task_id === t.id)
  );

  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedPrereqId) {
      setErrorMessage('Please select a prerequisite task.');
      return;
    }

    try {
      await createDependencyMutation.mutateAsync({
        depends_on_task_id: selectedPrereqId,
      });
      setSelectedPrereqId('');
      setIsAddModalOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add dependency relationship.';
      setErrorMessage(message);
    }
  };

  const handleDeleteDependency = async (dependencyId: string) => {
    try {
      await deleteDependencyMutation.mutateAsync(dependencyId);
    } catch (err: unknown) {
      console.error('Failed to remove dependency:', err);
    }
  };

  const uncompletedDeps = dependencies.filter((d) => d.prerequisite_status !== 'completed');
  const isBlocked = uncompletedDeps.length > 0;

  return (
    <div className="space-y-6">
      {/* Blocked State Alert Banner */}
      {isBlocked ? (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300">
          <Lock className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
          <div className="text-sm">
            <p className="font-semibold">
              Execution Blocked — waiting for {uncompletedDeps.length} task
              {uncompletedDeps.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-1">
              This task cannot safely start until all prerequisite tasks are completed.
            </p>
          </div>
        </div>
      ) : dependencies.length > 0 ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>All prerequisite tasks have been completed. This task is unblocked.</span>
        </div>
      ) : null}

      {/* Prerequisites Section */}
      <div className="border border-border rounded-xl p-4 bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-primary" />
              Prerequisites ({dependencies.length})
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tasks that must be completed before this task can be executed.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Dependency</span>
          </Button>
        </div>

        {dependencies.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            No prerequisites defined. This task can be started at any time.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {dependencies.map((dep) => (
              <div
                key={dep.id}
                className="py-2.5 flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <Link
                    to={`/tasks/${dep.depends_on_task_id}`}
                    className="font-medium text-foreground hover:text-primary transition-colors truncate flex items-center gap-1"
                  >
                    <span>{dep.prerequisite_title || dep.depends_on_task_id}</span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground opacity-60" />
                  </Link>
                  {dep.prerequisite_status && (
                    <TaskStatusBadge status={dep.prerequisite_status} />
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteDependency(dep.id)}
                  isLoading={deleteDependencyMutation.isPending}
                  className="text-muted-foreground hover:text-rose-500 h-8 w-8 p-0"
                  title="Remove dependency relationship"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dependents Section */}
      {task.dependents && task.dependents.length > 0 && (
        <div className="border border-border rounded-xl p-4 bg-card">
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Blocking Other Tasks ({task.dependents.length})
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            These tasks depend on this task and will remain blocked until it is completed.
          </p>
          <div className="divide-y divide-border">
            {task.dependents.map((dep) => (
              <div key={dep.id} className="py-2 flex items-center gap-2 text-sm">
                <ArrowRight className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <Link
                  to={`/tasks/${dep.task_id}`}
                  className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  <span>Task {dep.task_id.slice(0, 8)}...</span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground opacity-60" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Dependency Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setErrorMessage(null);
        }}
        title="Add Task Prerequisite"
        description="Choose a task that must be completed before this task can start."
      >
        <form onSubmit={handleAddDependency} className="space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 text-sm text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <Label htmlFor="candidate-task">Select Prerequisite Task</Label>
            <Select
              id="candidate-task"
              value={selectedPrereqId}
              onChange={(e) => setSelectedPrereqId(e.target.value)}
              disabled={isLoadingCandidates}
            >
              <option value="">Choose a task...</option>
              {candidateTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.status})
                </option>
              ))}
            </Select>
            {candidateTasks.length === 0 && !isLoadingCandidates && (
              <p className="text-xs text-muted-foreground mt-1.5">
                No eligible tasks available to add as prerequisites.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddModalOpen(false);
                setErrorMessage(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedPrereqId || createDependencyMutation.isPending}
              isLoading={createDependencyMutation.isPending}
            >
              Add Dependency
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
