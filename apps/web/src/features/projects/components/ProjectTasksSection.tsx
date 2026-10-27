import React, { useState } from 'react';
import type { ProjectMilestoneDto, TaskDetailDto, TaskDto } from '@avenza/shared';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ConfirmationDialog } from '../../../components/ui/ConfirmationDialog';
import { CreateTaskModal } from '../../tasks/components/CreateTaskModal';
import { EditTaskModal } from '../../tasks/components/EditTaskModal';
import { useDeleteTask, useUpdateTask } from '../../tasks/useTasks';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit2,
  Flag,
  ListTodo,
  Plus,
  Trash2,
} from 'lucide-react';

export interface ProjectTasksSectionProps {
  projectId: string;
  tasks?: TaskDto[];
  milestones?: ProjectMilestoneDto[];
}

export const ProjectTasksSection: React.FC<ProjectTasksSectionProps> = ({
  projectId,
  tasks = [],
  milestones = [],
}) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskDetailDto | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const deleteTaskMutation = useDeleteTask();

  const milestoneMap = new Map<string, string>();
  milestones.forEach((m) => {
    milestoneMap.set(m.id, m.title);
  });

  const getStatusBadge = (status: TaskDto['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success" className="text-2xs capitalize">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="info" className="text-2xs capitalize">In Progress</Badge>;
      case 'scheduled':
      case 'planned':
        return <Badge variant="warning" className="text-2xs capitalize">{status}</Badge>;
      case 'cancelled':
      case 'skipped':
        return <Badge variant="danger" className="text-2xs capitalize">{status}</Badge>;
      case 'deferred':
      case 'inbox':
      default:
        return <Badge variant="secondary" className="text-2xs capitalize">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: TaskDto['priority']) => {
    switch (priority) {
      case 'critical':
        return <Badge variant="danger" className="text-2xs capitalize">Critical</Badge>;
      case 'high':
        return <Badge variant="warning" className="text-2xs capitalize">High</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="text-2xs capitalize">Medium</Badge>;
      case 'low':
      default:
        return <Badge variant="default" className="text-2xs capitalize">Low</Badge>;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTaskId) return;
    await deleteTaskMutation.mutateAsync(deletingTaskId);
    setDeletingTaskId(null);
  };

  return (
    <div className="space-y-4" data-testid="project-tasks-section">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Project Tasks</h3>
          <p className="text-xs text-muted-foreground">
            Universal Avenza tasks linked to this project workspace.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="w-6 h-6 stroke-[1.5]" />}
          title="No tasks linked"
          description="Create actionable engineering tasks linked directly to this project workspace."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Task
            </Button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {tasks.map((task) => (
            <ProjectTaskRow
              key={task.id}
              task={task}
              milestoneTitle={task.project_milestone_id ? milestoneMap.get(task.project_milestone_id) : undefined}
              getStatusBadge={getStatusBadge}
              getPriorityBadge={getPriorityBadge}
              onEdit={(t) => setEditingTask(t as unknown as TaskDetailDto)}
              onDelete={(id) => setDeletingTaskId(id)}
            />
          ))}
        </div>
      )}

      {/* Universal Create Task Modal prefilled with current project */}
      <CreateTaskModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        initialProjectId={projectId}
      />

      {/* Universal Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          isOpen={Boolean(editingTask)}
          onClose={() => setEditingTask(null)}
          task={editingTask}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={Boolean(deletingTaskId)}
        onClose={() => setDeletingTaskId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Task"
        message="Are you sure you want to permanently delete this task? This action cannot be undone."
        confirmLabel="Delete Task"
        variant="danger"
        isLoading={deleteTaskMutation.isPending}
      />
    </div>
  );
};

interface ProjectTaskRowProps {
  task: TaskDto;
  milestoneTitle?: string;
  getStatusBadge: (status: TaskDto['status']) => React.ReactNode;
  getPriorityBadge: (priority: TaskDto['priority']) => React.ReactNode;
  onEdit: (task: TaskDto) => void;
  onDelete: (id: string) => void;
}

const ProjectTaskRow: React.FC<ProjectTaskRowProps> = ({
  task,
  milestoneTitle,
  getStatusBadge,
  getPriorityBadge,
  onEdit,
  onDelete,
}) => {
  const updateTaskMutation = useUpdateTask(task.id);
  const isCompleted = task.status === 'completed';

  const handleToggleCompletion = async () => {
    const nextStatus = isCompleted ? 'inbox' : 'completed';
    await updateTaskMutation.mutateAsync({
      status: nextStatus,
    });
  };

  return (
    <Card
      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-border/80 hover:border-border transition-colors"
      data-testid={`project-task-${task.id}`}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={handleToggleCompletion}
          disabled={updateTaskMutation.isPending}
          aria-label={isCompleted ? 'Mark incomplete' : 'Mark completed'}
          className={`w-5 h-5 mt-0.5 sm:mt-0 rounded border flex items-center justify-center shrink-0 transition-colors ${
            isCompleted
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-border hover:border-primary text-transparent'
          }`}
        >
          <Check className="w-3.5 h-3.5" />
        </button>

        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4
              className={`text-sm font-medium truncate ${
                isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
              }`}
            >
              {task.title}
            </h4>
            {getStatusBadge(task.status)}
            {getPriorityBadge(task.priority)}
            {milestoneTitle && (
              <Badge variant="default" className="text-2xs flex items-center gap-1 font-mono">
                <Flag className="w-2.5 h-2.5 text-muted-foreground" />
                <span>{milestoneTitle}</span>
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-0.5 flex-wrap">
            {task.due_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-muted-foreground" />
                Due: {new Date(task.due_at).toLocaleDateString()}
              </span>
            )}
            {task.estimated_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-muted-foreground" />
                {task.estimated_minutes}m est
              </span>
            )}
            {isCompleted && task.completed_at && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                {new Date(task.completed_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(task)}
          title="Edit Task"
          aria-label="Edit task"
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(task.id)}
          title="Delete Task"
          aria-label="Delete task"
          className="h-8 px-2 text-xs text-danger hover:text-danger hover:bg-danger/10"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Card>
  );
};
