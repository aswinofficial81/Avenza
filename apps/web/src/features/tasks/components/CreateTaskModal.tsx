import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { Label } from '../../../components/ui/Label';
import { useCreateTask } from '../useTasks';
import { useGoals, useGoalMilestones } from '../../goals/useGoals';
import {
  TASK_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskType,
  type TaskPriority,
  type TaskStatus,
} from '@avenza/shared';
import { AlertCircle, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGoalId?: string;
  initialMilestoneId?: string;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  initialGoalId = '',
  initialMilestoneId = '',
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('study');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('inbox');
  const [goalId, setGoalId] = useState(initialGoalId);
  const [milestoneId, setMilestoneId] = useState(initialMilestoneId);
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>('');
  const [dueAt, setDueAt] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createTaskMutation = useCreateTask();

  // Fetch real goals
  const { data: goalsData, isLoading: isLoadingGoals } = useGoals({ pageSize: 100 });
  const goals = goalsData?.data || [];

  // Fetch milestones for selected goal
  const { data: milestones = [], isLoading: isLoadingMilestones } = useGoalMilestones(
    goalId || undefined
  );

  const handleGoalChange = (newGoalId: string) => {
    setGoalId(newGoalId);
    setMilestoneId(''); // Clear milestone when goal changes
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

    let parsedEstimate: number | undefined;
    if (estimatedMinutes.trim()) {
      parsedEstimate = parseInt(estimatedMinutes, 10);
      if (isNaN(parsedEstimate) || parsedEstimate <= 0) {
        setErrorMessage('Estimated minutes must be a positive integer.');
        return;
      }
    }

    try {
      await createTaskMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        task_type: taskType,
        priority,
        status,
        goal_id: goalId || undefined,
        milestone_id: milestoneId || undefined,
        estimated_minutes: parsedEstimate,
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
        scheduled_start: scheduledStart ? new Date(scheduledStart).toISOString() : undefined,
        scheduled_end: scheduledEnd ? new Date(scheduledEnd).toISOString() : undefined,
        notes: notes.trim() || undefined,
      });

      // Reset and close
      resetForm();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create task.';
      setErrorMessage(message);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTaskType('study');
    setPriority('medium');
    setStatus('inbox');
    setGoalId(initialGoalId);
    setMilestoneId(initialMilestoneId);
    setEstimatedMinutes('');
    setDueAt('');
    setScheduledStart('');
    setScheduledEnd('');
    setNotes('');
    setErrorMessage(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Task"
      description="Define an executable unit of work linked to your growth plan."
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
          <Label htmlFor="task-title" required>
            Task Title
          </Label>
          <Input
            id="task-title"
            placeholder="e.g. Implement Raft heartbeat timers"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="task-description">Description</Label>
          <Textarea
            id="task-description"
            placeholder="What concrete action needs to be performed?"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Type, Priority, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="task-type">Task Type</Label>
            <Select
              id="task-type"
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
            <Label htmlFor="task-priority">Priority</Label>
            <Select
              id="task-priority"
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
            <Label htmlFor="task-status">Status</Label>
            <Select
              id="task-status"
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
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="task-goal">Associated Goal (Optional)</Label>
              {goals.length === 0 && !isLoadingGoals && (
                <Link
                  to="/goals"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <LinkIcon className="w-3 h-3" /> Create Goal
                </Link>
              )}
            </div>
            <Select
              id="task-goal"
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
            <Label htmlFor="task-milestone">Associated Milestone (Optional)</Label>
            <Select
              id="task-milestone"
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

        {/* Estimated Duration & Due Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="task-estimate">Estimated Minutes (Optional)</Label>
            <Input
              id="task-estimate"
              type="number"
              min="1"
              step="5"
              placeholder="e.g. 45"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="task-due-at">Due Date (Optional)</Label>
            <Input
              id="task-due-at"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
        </div>

        {/* Schedule Start and End */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="task-sched-start">Scheduled Start (Optional)</Label>
            <Input
              id="task-sched-start"
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="task-sched-end">Scheduled End (Optional)</Label>
            <Input
              id="task-sched-end"
              type="datetime-local"
              value={scheduledEnd}
              onChange={(e) => setScheduledEnd(e.target.value)}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor="task-notes">Notes & References (Optional)</Label>
          <Textarea
            id="task-notes"
            placeholder="Helpful links, checklist items, or execution instructions..."
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
          <Button type="submit" isLoading={createTaskMutation.isPending}>
            Create Task
          </Button>
        </div>
      </form>
    </Modal>
  );
};
