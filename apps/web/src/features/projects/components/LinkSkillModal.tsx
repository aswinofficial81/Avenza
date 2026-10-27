import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { useSkills } from '../../skills/useSkills';
import { useAttachProjectSkill } from '../hooks/useProjects';
import type { ProjectSkillDto, ProjectSkillRole } from '@avenza/shared';

export interface LinkSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  existingSkills?: ProjectSkillDto[];
}

export const LinkSkillModal: React.FC<LinkSkillModalProps> = ({
  isOpen,
  onClose,
  projectId,
  existingSkills = [],
}) => {
  const { data: skillsData, isLoading: isLoadingSkills } = useSkills();
  const attachSkillMutation = useAttachProjectSkill();

  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [role, setRole] = useState<ProjectSkillRole>('primary');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const linkedSkillIds = new Set(existingSkills.map((s) => s.skill_id));
  const availableSkills = (skillsData || []).filter((s) => !linkedSkillIds.has(s.skill.id));

  const skillOptions = [
    { label: '-- Select a skill --', value: '' },
    ...availableSkills.map((s) => ({
      label: `${s.skill.name} (${s.skill.category || 'General'})`,
      value: s.skill.id,
    })),
  ];

  const roleOptions = [
    { label: 'Primary (Core competency applied in this project)', value: 'primary' },
    { label: 'Supporting (Secondary/auxiliary tool or library)', value: 'supporting' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSkillId) {
      setErrorMessage('Please select a skill to link.');
      return;
    }
    setErrorMessage(null);

    try {
      await attachSkillMutation.mutateAsync({
        projectId,
        skillId: selectedSkillId,
        role,
      });
      setSelectedSkillId('');
      setRole('primary');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to attach skill.';
      setErrorMessage(msg);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Link Skill to Project"
      description="Declare the skills practiced or applied in this project. Linking does not award XP or modify mastery."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {errorMessage && (
          <div className="p-2.5 rounded text-sm bg-danger/10 text-danger border border-danger/20">
            {errorMessage}
          </div>
        )}

        <Select
          label="Select Skill"
          options={skillOptions}
          value={selectedSkillId}
          onChange={(e) => setSelectedSkillId(e.target.value)}
          disabled={isLoadingSkills || attachSkillMutation.isPending}
          required
        />

        <Select
          label="Skill Role"
          options={roleOptions}
          value={role}
          onChange={(e) => setRole(e.target.value as ProjectSkillRole)}
          disabled={attachSkillMutation.isPending}
        />

        <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={attachSkillMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={attachSkillMutation.isPending}
            disabled={!selectedSkillId || isLoadingSkills}
          >
            Attach Skill
          </Button>
        </div>
      </form>
    </Modal>
  );
};
