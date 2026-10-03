import React, { useState } from 'react';
import type { MasteryState } from '@avenza/shared';
import { Button, Modal, Select } from '../../../components/ui';
import { useEvidence } from '../../evidence/useEvidence';
import { useGoals } from '../../goals/useGoals';
import { useTasks } from '../../tasks/useTasks';
import { useLinkEvidenceToSkill, useLinkGoalToSkill, useLinkTaskToSkill } from '../useSkills';

// ------------------------------------------------------------------------------
// Link Evidence Modal
// ------------------------------------------------------------------------------
interface LinkEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  skillId: string;
  alreadyLinkedEvidenceIds?: string[];
}

export const LinkEvidenceModal: React.FC<LinkEvidenceModalProps> = ({
  isOpen,
  onClose,
  skillId,
  alreadyLinkedEvidenceIds = [],
}) => {
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: evidenceData, isLoading } = useEvidence({ limit: 50 });
  const linkEvidence = useLinkEvidenceToSkill();

  const availableEvidence = (evidenceData?.data || []).filter(
    (e) => !alreadyLinkedEvidenceIds.includes(e.id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvidenceId) {
      setErrorMsg('Please select an evidence item.');
      return;
    }

    setErrorMsg(null);
    try {
      await linkEvidence.mutateAsync({
        skill_id: skillId,
        evidence_id: selectedEvidenceId,
      });
      setSelectedEvidenceId('');
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to link evidence');
    }
  };

  const options = [
    { value: '', label: isLoading ? 'Loading evidence...' : 'Select evidence record...' },
    ...availableEvidence.map((ev) => ({
      value: ev.id,
      label: `[${ev.evidence_type.toUpperCase()}] ${ev.title} (${ev.verification_status})`,
    })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Link Supporting Evidence">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
            Choose Verified or Recorded Evidence *
          </label>
          <Select
            value={selectedEvidenceId}
            onChange={(e) => setSelectedEvidenceId(e.target.value)}
            options={options}
            disabled={isLoading || availableEvidence.length === 0}
          />
          {availableEvidence.length === 0 && !isLoading && (
            <p className="mt-1.5 text-xs text-zinc-500">
              No unlinked evidence found. Create or record evidence first in the Evidence view.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={linkEvidence.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={linkEvidence.isPending || !selectedEvidenceId}
          >
            {linkEvidence.isPending ? 'Linking...' : 'Link Evidence'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ------------------------------------------------------------------------------
// Link Goal Modal
// ------------------------------------------------------------------------------
interface LinkGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  skillId: string;
  alreadyLinkedGoalIds?: string[];
}

export const LinkGoalModal: React.FC<LinkGoalModalProps> = ({
  isOpen,
  onClose,
  skillId,
  alreadyLinkedGoalIds = [],
}) => {
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [targetMastery, setTargetMastery] = useState<string>('proficient');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: goalsData, isLoading } = useGoals();
  const linkGoal = useLinkGoalToSkill();

  const availableGoals = (goalsData?.data || []).filter((g) => !alreadyLinkedGoalIds.includes(g.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalId) {
      setErrorMsg('Please select a goal.');
      return;
    }

    setErrorMsg(null);
    try {
      await linkGoal.mutateAsync({
        skill_id: skillId,
        goal_id: selectedGoalId,
        target_mastery_state: (targetMastery as MasteryState) || null,
      });
      setSelectedGoalId('');
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to link goal');
    }
  };

  const goalOptions = [
    { value: '', label: isLoading ? 'Loading goals...' : 'Select a goal...' },
    ...availableGoals.map((g) => ({
      value: g.id,
      label: g.title,
    })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connect Skill to Goal">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
            Goal *
          </label>
          <Select
            value={selectedGoalId}
            onChange={(e) => setSelectedGoalId(e.target.value)}
            options={goalOptions}
            disabled={isLoading || availableGoals.length === 0}
          />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
            Target Mastery State (Requirement)
          </label>
          <Select
            value={targetMastery}
            onChange={(e) => setTargetMastery(e.target.value)}
            options={[
              { value: 'exploring', label: 'Exploring' },
              { value: 'learning', label: 'Learning' },
              { value: 'developing', label: 'Developing' },
              { value: 'proficient', label: 'Proficient' },
              { value: 'strong', label: 'Strong' },
            ]}
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={linkGoal.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={linkGoal.isPending || !selectedGoalId}>
            {linkGoal.isPending ? 'Linking...' : 'Connect Goal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ------------------------------------------------------------------------------
// Link Task Modal
// ------------------------------------------------------------------------------
interface LinkTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  skillId: string;
  alreadyLinkedTaskIds?: string[];
}

export const LinkTaskModal: React.FC<LinkTaskModalProps> = ({
  isOpen,
  onClose,
  skillId,
  alreadyLinkedTaskIds = [],
}) => {
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: tasksData, isLoading } = useTasks();
  const linkTask = useLinkTaskToSkill();

  const availableTasks = (tasksData?.data || []).filter((t) => !alreadyLinkedTaskIds.includes(t.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) {
      setErrorMsg('Please select a task.');
      return;
    }

    setErrorMsg(null);
    try {
      await linkTask.mutateAsync({
        skill_id: skillId,
        task_id: selectedTaskId,
      });
      setSelectedTaskId('');
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to link task');
    }
  };

  const taskOptions = [
    { value: '', label: isLoading ? 'Loading tasks...' : 'Select a task...' },
    ...availableTasks.map((t) => ({
      value: t.id,
      label: `[${t.status}] ${t.title}`,
    })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connect Skill to Task">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
            Task *
          </label>
          <Select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            options={taskOptions}
            disabled={isLoading || availableTasks.length === 0}
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={linkTask.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={linkTask.isPending || !selectedTaskId}>
            {linkTask.isPending ? 'Linking...' : 'Connect Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
