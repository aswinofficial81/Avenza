import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { Button } from '../../../components/ui/Button';
import { useUpdateGoal } from '../useGoals';
import {
  type GoalType,
  type GoalPriority,
  type GoalStatus,
  type GoalDetailDto,
  GOAL_TYPES,
  GOAL_PRIORITIES,
  GOAL_STATUSES,
} from '@avenza/shared';

export interface EditGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: GoalDetailDto;
  onSuccess?: () => void;
}

export const EditGoalModal: React.FC<EditGoalModalProps> = ({
  isOpen,
  onClose,
  goal,
  onSuccess,
}) => {
  const updateGoal = useUpdateGoal(goal.id);

  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description || '');
  const [goalType, setGoalType] = useState<GoalType>(goal.goal_type);
  const [priority, setPriority] = useState<GoalPriority>(goal.priority);
  const [status, setStatus] = useState<GoalStatus>(goal.status);
  const [startDate, setStartDate] = useState(
    goal.start_date ? goal.start_date.substring(0, 10) : ''
  );
  const [targetDate, setTargetDate] = useState(
    goal.target_date ? goal.target_date.substring(0, 10) : ''
  );
  const [desiredOutcome, setDesiredOutcome] = useState(goal.desired_outcome || '');
  const [completionCriteria, setCompletionCriteria] = useState(goal.completion_criteria || '');
  const [notes, setNotes] = useState(goal.notes || '');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setTitle(goal.title);
    setDescription(goal.description || '');
    setGoalType(goal.goal_type);
    setPriority(goal.priority);
    setStatus(goal.status);
    setStartDate(goal.start_date ? goal.start_date.substring(0, 10) : '');
    setTargetDate(goal.target_date ? goal.target_date.substring(0, 10) : '');
    setDesiredOutcome(goal.desired_outcome || '');
    setCompletionCriteria(goal.completion_criteria || '');
    setNotes(goal.notes || '');
    setErrors({});
  }, [goal, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) {
      newErrors.title = 'Goal title is required';
    } else if (title.length > 255) {
      newErrors.title = 'Title must be 255 characters or fewer';
    }

    if (startDate && targetDate && new Date(targetDate) < new Date(startDate)) {
      newErrors.targetDate = 'Target date cannot be earlier than start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await updateGoal.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        goal_type: goalType,
        priority,
        status,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        target_date: targetDate ? new Date(targetDate).toISOString() : null,
        desired_outcome: desiredOutcome.trim() || null,
        completion_criteria: completionCriteria.trim() || null,
        notes: notes.trim() || null,
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      const error = err as Error;
      setErrors({ form: error.message || 'Failed to update goal' });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Goal"
      description="Update goal properties, scheduling, and strategic criteria."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto px-0.5">
        {errors.form && (
          <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded">
            {errors.form}
          </div>
        )}

        <Input
          label="Goal Title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Goal Type"
            value={goalType}
            onChange={(e) => setGoalType(e.target.value as GoalType)}
            options={GOAL_TYPES.map((t) => ({
              label: t.charAt(0).toUpperCase() + t.slice(1),
              value: t,
            }))}
          />

          <Select
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as GoalPriority)}
            options={GOAL_PRIORITIES.map((p) => ({
              label: p.charAt(0).toUpperCase() + p.slice(1),
              value: p,
            }))}
          />

          <Select
            label="Lifecycle Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as GoalStatus)}
            options={GOAL_STATUSES.map((s) => ({
              label: s.charAt(0).toUpperCase() + s.slice(1),
              value: s,
            }))}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <Input
            label="Target Date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            error={errors.targetDate}
          />
        </div>

        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        <Textarea
          label="Desired Outcome"
          value={desiredOutcome}
          onChange={(e) => setDesiredOutcome(e.target.value)}
          rows={2}
        />

        <Textarea
          label="Completion Criteria"
          value={completionCriteria}
          onChange={(e) => setCompletionCriteria(e.target.value)}
          rows={2}
        />

        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={updateGoal.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={updateGoal.isPending}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
