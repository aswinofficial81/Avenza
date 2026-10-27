import React, { useState, useEffect } from 'react';
import type {
  CreateProjectMilestoneInput,
  ProjectMilestoneDto,
  ProjectMilestoneStatus,
  UpdateProjectMilestoneInput,
} from '@avenza/shared';
import { PROJECT_MILESTONE_STATUSES } from '@avenza/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { Button } from '../../../components/ui/Button';
import { Label } from '../../../components/ui/Label';
import {
  useCreateProjectMilestone,
  useUpdateProjectMilestone,
} from '../hooks/useProjects';
import { AlertCircle } from 'lucide-react';

export interface ProjectMilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  milestone?: ProjectMilestoneDto | null;
  defaultOrderIndex?: number;
  onSuccess?: () => void;
}

export const ProjectMilestoneModal: React.FC<ProjectMilestoneModalProps> = ({
  isOpen,
  onClose,
  projectId,
  milestone,
  defaultOrderIndex = 0,
  onSuccess,
}) => {
  const isEditing = Boolean(milestone);
  const createMutation = useCreateProjectMilestone(projectId);
  const updateMutation = useUpdateProjectMilestone(projectId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectMilestoneStatus>('pending');
  const [orderIndex, setOrderIndex] = useState(defaultOrderIndex);
  const [targetDate, setTargetDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (milestone) {
      setTitle(milestone.title);
      setDescription(milestone.description || '');
      setStatus(milestone.status);
      setOrderIndex(milestone.order_index);
      setTargetDate(milestone.target_date ? milestone.target_date.substring(0, 10) : '');
    } else {
      setTitle('');
      setDescription('');
      setStatus('pending');
      setOrderIndex(defaultOrderIndex);
      setTargetDate('');
    }
    setErrors({});
    setGeneralError(null);
  }, [milestone, defaultOrderIndex, isOpen]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) {
      newErrors.title = 'Milestone title is required';
    } else if (title.trim().length > 255) {
      newErrors.title = 'Milestone title must be 255 characters or fewer';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) return;

    try {
      if (isEditing && milestone) {
        const payload: UpdateProjectMilestoneInput = {
          title: title.trim(),
          description: description.trim() || null,
          status,
          order_index: orderIndex,
          target_date: targetDate ? new Date(targetDate).toISOString() : null,
        };
        await updateMutation.mutateAsync({
          id: milestone.id,
          data: payload,
        });
      } else {
        const payload: CreateProjectMilestoneInput = {
          title: title.trim(),
          description: description.trim() || null,
          status,
          order_index: orderIndex,
          target_date: targetDate ? new Date(targetDate).toISOString() : null,
        };
        await createMutation.mutateAsync(payload);
      }
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save milestone.';
      setGeneralError(msg);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Milestone' : 'Create Milestone'}
      description={
        isEditing
          ? 'Update milestone scope, pacing, and target delivery.'
          : 'Define a distinct stage or key deliverable for this project.'
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="project-milestone-form">
        {generalError && (
          <div className="flex items-center gap-2 p-3 text-sm text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        <div>
          <Label htmlFor="milestone-title" required>
            Milestone Title
          </Label>
          <Input
            id="milestone-title"
            placeholder="e.g. Core Engine MVP Architecture"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
            }}
            error={errors.title}
            autoFocus
          />
        </div>

        <div>
          <Label htmlFor="milestone-description">Description</Label>
          <Textarea
            id="milestone-description"
            placeholder="Deliverables, scope boundary, or acceptance criteria..."
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="milestone-status">Status</Label>
            <Select
              id="milestone-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectMilestoneStatus)}
            >
              {PROJECT_MILESTONE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="milestone-target-date">Target Date</Label>
            <Input
              id="milestone-target-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            {isEditing ? 'Save Changes' : 'Create Milestone'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
