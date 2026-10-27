import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';
import { useGoals } from '../../goals/useGoals';
import { useAttachProjectGoal } from '../hooks/useProjects';
import type { ProjectGoalDto } from '@avenza/shared';

export interface LinkGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  existingGoals?: ProjectGoalDto[];
}

export const LinkGoalModal: React.FC<LinkGoalModalProps> = ({
  isOpen,
  onClose,
  projectId,
  existingGoals = [],
}) => {
  const { data: goalsData, isLoading: isLoadingGoals } = useGoals();
  const attachGoalMutation = useAttachProjectGoal();

  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const linkedGoalIds = new Set(existingGoals.map((g) => g.goal_id));
  const availableGoals = (goalsData?.data || []).filter((g) => !linkedGoalIds.has(g.id));

  const goalOptions = [
    { label: '-- Select a goal --', value: '' },
    ...availableGoals.map((g) => ({
      label: `${g.title} (${g.status})`,
      value: g.id,
    })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalId) {
      setErrorMessage('Please select a goal to link.');
      return;
    }
    setErrorMessage(null);

    try {
      await attachGoalMutation.mutateAsync({
        projectId,
        goalId: selectedGoalId,
        isPrimary,
      });
      setSelectedGoalId('');
      setIsPrimary(false);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to attach goal.';
      setErrorMessage(msg);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Link Goal to Project"
      description="Associate an existing goal to align this project's roadmap with your high-level outcomes."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {errorMessage && (
          <div className="p-2.5 rounded text-sm bg-danger/10 text-danger border border-danger/20">
            {errorMessage}
          </div>
        )}

        <Select
          label="Select Goal"
          options={goalOptions}
          value={selectedGoalId}
          onChange={(e) => setSelectedGoalId(e.target.value)}
          disabled={isLoadingGoals || attachGoalMutation.isPending}
          required
        />

        <div className="pt-1">
          <Checkbox
            label="Mark as Primary Goal"
            description="At most one primary goal can exist per project. If selected, any previous primary goal will be safely unset."
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
            disabled={attachGoalMutation.isPending}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={attachGoalMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={attachGoalMutation.isPending}
            disabled={!selectedGoalId || isLoadingGoals}
          >
            Attach Goal
          </Button>
        </div>
      </form>
    </Modal>
  );
};
