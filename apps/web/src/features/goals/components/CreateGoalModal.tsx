import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { Button } from '../../../components/ui/Button';
import { useCreateGoal } from '../useGoals';
import {
  type GoalType,
  type GoalPriority,
  type GoalStatus,
  GOAL_TYPES,
  GOAL_PRIORITIES,
} from '@avenza/shared';

export interface CreateGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateGoalModal: React.FC<CreateGoalModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const createGoal = useCreateGoal();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('learning');
  const [priority, setPriority] = useState<GoalPriority>('medium');
  const [status, setStatus] = useState<GoalStatus>('active');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [completionCriteria, setCompletionCriteria] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

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
      await createGoal.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        goal_type: goalType,
        priority,
        status,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        target_date: targetDate ? new Date(targetDate).toISOString() : undefined,
        desired_outcome: desiredOutcome.trim() || undefined,
        completion_criteria: completionCriteria.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setStartDate('');
      setTargetDate('');
      setDesiredOutcome('');
      setCompletionCriteria('');
      setNotes('');
      setErrors({});

      onSuccess?.();
      onClose();
    } catch (err) {
      const error = err as Error;
      setErrors({ form: error.message || 'Failed to create goal' });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Growth Goal"
      description="Define an outcome-driven goal to anchor your roadmap and milestones."
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
          placeholder="e.g. Master Distributed Systems Architecture"
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
            label="Initial Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as GoalStatus)}
            options={[
              { label: 'Active', value: 'active' },
              { label: 'Draft', value: 'draft' },
            ]}
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
          placeholder="High-level purpose and context for this goal..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        <Textarea
          label="Desired Outcome"
          placeholder="What specific capability, state, or achievement will exist once finished?"
          value={desiredOutcome}
          onChange={(e) => setDesiredOutcome(e.target.value)}
          rows={2}
        />

        <Textarea
          label="Completion Criteria"
          placeholder="How will you objectively verify this goal is fulfilled?"
          value={completionCriteria}
          onChange={(e) => setCompletionCriteria(e.target.value)}
          rows={2}
        />

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={createGoal.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={createGoal.isPending}>
            Create Goal
          </Button>
        </div>
      </form>
    </Modal>
  );
};
