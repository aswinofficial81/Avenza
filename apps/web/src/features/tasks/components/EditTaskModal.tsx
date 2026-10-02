import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { Label } from '../../../components/ui/Label';
import { useUpdateTask } from '../useTasks';
import { useGoals, useGoalMilestones } from '../../goals/useGoals';
import {
  TASK_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskType,
  type TaskPriority,
  type TaskStatus,
  type TaskDetailDto,
} from '@avenza/shared';
import { AlertCircle } from 'lucide-react';

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDetailDto;
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({ isOpen, onClose, task }) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [taskType, setTaskType] = useState<TaskType>(task.task_type);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [goalId, setGoalId] = useState(task.goal_id || '');
  const [milestoneId, setMilestoneId] = useState(task.milestone_id || '');
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>(
    task.estimated_minutes ? String(task.estimated_minutes) : ''
  );
  const [actualMinutes, setActualMinutes] = useState<string>(
    task.actual_minutes !== null && task.actual_minutes !== undefined ? String(task.actual_minutes) : ''
  );
  const [dueAt, setDueAt] = useState(
    task.due_at ? new Date(task.due_at).toISOString().slice(0, 16) : ''
  );
  const [scheduledStart, setScheduledStart] = useState(
    task.scheduled_start ? new Date(task.scheduled_start).toISOString().slice(0, 16) : ''
  );
  const [scheduledEnd, setScheduledEnd] = useState(
    task.scheduled_end ? new Date(task.scheduled_end).toISOString().slice(0, 16) : ''
  );
  const [notes, setNotes] = useState(task.notes || '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateTaskMutation = useUpdateTask(task.id);

  // Fetch real goals
  const { data: goalsData, isLoading: isLoadingGoals } = useGoals({ pageSize: 100 });
  const goals = goalsData?.data || [];

  // Fetch milestones for selected goal
  const { data: milestones = [], isLoading: isLoadingMilestones } = useGoalMilestones(
    goalId || undefined
  );

  // Sync state if task prop changes
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setTaskType(task.task_type);
    setPriority(task.priority);
    setStatus(task.status);
    setGoalId(task.goal_id || '');
    setMilestoneId(task.milestone_id || '');
    setEstimatedMinutes(task.estimated_minutes ? String(task.estimated_minutes) : '');
    setActualMinutes(
      task.actual_minutes !== null && task.actual_minutes !== undefined
        ? String(task.actual_minutes)
        : ''
    );
    setDueAt(task.due_at ? new Date(task.due_at).toISOString().slice(0, 16) : '');
    setScheduledStart(
      task.scheduled_start ? new Date(task.scheduled_start).toISOString().slice(0, 16) : ''
    );
    setScheduledEnd(task.scheduled_end ? new Date(task.scheduled_end).toISOString().slice(0, 16) : '');
    setNotes(task.notes || '');
    setErrorMessage(null);
  }, [task]);

  const handleGoalChange = (newGoalId: string) => {
    setGoalId(newGoalId);
    setMilestoneId(''); // Clear milestone when goal changes to preserve integrity
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Task title is required.');
      return;
    }

    if (scheduledStart && scheduledEnd) {
      if (new Date(scheduledEnd).getTime() < new Date(scheduledStart).getTime()) {
        setErrorMessage('Scheduled end cannot be earlier than scheduled start.');
        return;
      }
    }

    let parsedEstimate: number | null = null;
    if (estimatedMinutes.trim()) {
      const val = parseInt(estimatedMinutes, 10);
      if (isNaN(val) || val <= 0) {
        setErrorMessage('Estimated minutes must be a positive integer.');
        return;
      }
      parsedEstimate = val;
    }

    let parsedActual: number | null = null;
    if (actualMinutes.trim()) {
      const val = parseInt(actualMinutes, 10);
      if (isNaN(val) || val < 0) {
        setErrorMessage('Actual minutes must be a non-negative integer.');
        return;
      }
      parsedActual = val;
    }

    try {
      await updateTaskMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        task_type: taskType,
        priority,
        status,
        goal_id: goalId || null,
        milestone_id: milestoneId || null,
        estimated_minutes: parsedEstimate,
        actual_minutes: parsedActual,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        scheduled_start: scheduledStart ? new Date(scheduledStart).toISOString() : null,
        scheduled_end: scheduledEnd ? new Date(scheduledEnd).toISOString() : null,
        notes: notes.trim() || null,
      });

      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update task.';
      setErrorMessage(message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Task"
      description="Update task details, schedule, estimates, and goal associations."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 text-sm text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Title */}
        <div>
          <Label htmlFor="edit-task-title" required>
            Task Title
          </Label>
          <Input
            id="edit-task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="edit-task-description">Description</Label>
          <Textarea
            id="edit-task-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Type, Priority, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="edit-task-type">Task Type</Label>
            <Select
              id="edit-task-type"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as TaskType)}
            >
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="edit-task-priority">Priority</Label>
            <Select
              id="edit-task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="edit-task-status">Status</Label>
            <Select
              id="edit-task-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Goal and Milestone Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="edit-task-goal">Associated Goal (Optional)</Label>
            <Select
              id="edit-task-goal"
              value={goalId}
              onChange={(e) => handleGoalChange(e.target.value)}
              disabled={isLoadingGoals}
            >
              <option value="">None (Independent Task)</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="edit-task-milestone">Associated Milestone (Optional)</Label>
            <Select
              id="edit-task-milestone"
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              disabled={!goalId || isLoadingMilestones}
            >
              <option value="">
                {!goalId
                  ? 'Select a goal first'
                  : milestones.length === 0
                  ? 'No milestones in this goal'
                  : 'None'}
              </option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Estimated Duration & Actual Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="edit-task-estimate">Estimated Minutes (Optional)</Label>
            <Input
              id="edit-task-estimate"
              type="number"
              min="1"
              step="5"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="edit-task-actual">Actual Minutes (Optional)</Label>
            <Input
              id="edit-task-actual"
              type="number"
              min="0"
              step="5"
              value={actualMinutes}
              onChange={(e) => setActualMinutes(e.target.value)}
            />
          </div>
        </div>

        {/* Schedule & Due Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="edit-task-due-at">Due Date (Optional)</Label>
            <Input
              id="edit-task-due-at"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="edit-task-sched-start">Scheduled Start (Optional)</Label>
            <Input
              id="edit-task-sched-start"
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="edit-task-sched-end">Scheduled End (Optional)</Label>
            <Input
              id="edit-task-sched-end"
              type="datetime-local"
              value={scheduledEnd}
              onChange={(e) => setScheduledEnd(e.target.value)}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="edit-task-notes">Notes & References (Optional)</Label>
          <Textarea
            id="edit-task-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={updateTaskMutation.isPending}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
