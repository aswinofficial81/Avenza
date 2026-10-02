import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { Button } from '../../../components/ui/Button';
import { useCreateMilestone, useUpdateMilestone } from '../useGoals';
import {
  type MilestoneDto,
  type MilestoneStatus,
  type GoalPriority,
  MILESTONE_STATUSES,
  GOAL_PRIORITIES,
} from '@avenza/shared';

export interface MilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalId: string;
  milestone?: MilestoneDto | null;
  defaultOrderIndex?: number;
  onSuccess?: () => void;
}

export const MilestoneModal: React.FC<MilestoneModalProps> = ({
  isOpen,
  onClose,
  goalId,
  milestone,
  defaultOrderIndex = 0,
  onSuccess,
}) => {
  const isEditing = Boolean(milestone);
  const createMutation = useCreateMilestone(goalId);
  const updateMutation = useUpdateMilestone(goalId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<MilestoneStatus>('pending');
  const [priority, setPriority] = useState<GoalPriority>('medium');
  const [orderIndex, setOrderIndex] = useState(defaultOrderIndex);
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (milestone) {
      setTitle(milestone.title);
      setDescription(milestone.description || '');
      setStatus(milestone.status);
      setPriority(milestone.priority);
      setOrderIndex(milestone.order_index);
      setStartDate(milestone.start_date ? milestone.start_date.substring(0, 10) : '');
      setTargetDate(milestone.target_date ? milestone.target_date.substring(0, 10) : '');
    } else {
      setTitle('');
      setDescription('');
      setStatus('pending');
      setPriority('medium');
      setOrderIndex(defaultOrderIndex);
      setStartDate('');
      setTargetDate('');
    }
    setErrors({});
  }, [milestone, defaultOrderIndex, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) {
      newErrors.title = 'Milestone title is required';
    } else if (title.length > 255) {
      newErrors.title = 'Title must be 255 characters or fewer';
    }

    if (orderIndex < 0) {
      newErrors.orderIndex = 'Order index must be non-negative';
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
      if (isEditing && milestone) {
        await updateMutation.mutateAsync({
          milestoneId: milestone.id,
          data: {
            title: title.trim(),
            description: description.trim() || null,
            status,
            priority,
            order_index: orderIndex,
            start_date: startDate ? new Date(startDate).toISOString() : null,
            target_date: targetDate ? new Date(targetDate).toISOString() : null,
          },
        });
      } else {
        await createMutation.mutateAsync({
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          order_index: orderIndex,
          start_date: startDate ? new Date(startDate).toISOString() : undefined,
          target_date: targetDate ? new Date(targetDate).toISOString() : undefined,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      const error = err as Error;
      setErrors({ form: error.message || 'Failed to save milestone' });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Milestone' : 'Add Milestone'}
      description="Milestones represent deterministic checkpoint outcomes toward your goal."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && (
          <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded">
            {errors.form}
          </div>
        )}

        <Input
          label="Milestone Title"
          required
          placeholder="e.g. Implement Raft Consensus Algorithm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
            options={MILESTONE_STATUSES.map((s) => ({
              label: s.charAt(0).toUpperCase() + s.slice(1),
              value: s,
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

          <Input
            label="Order Index"
            type="number"
            min={0}
            value={orderIndex}
            onChange={(e) => setOrderIndex(Math.max(0, parseInt(e.target.value, 10) || 0))}
            error={errors.orderIndex}
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
          placeholder="Describe the milestone scope and deliverable..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isPending}>
            {isEditing ? 'Save Milestone' : 'Add Milestone'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
