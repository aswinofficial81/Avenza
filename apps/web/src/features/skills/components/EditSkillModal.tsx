import React, { useEffect, useState } from 'react';
import type { SkillDto, SkillWithMasteryDto } from '@avenza/shared';
import { Button, Input, Modal, Select, Textarea } from '../../../components/ui';
import { useUpdateSkill } from '../useSkills';

interface EditSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  skill: SkillDto;
  availableSkills?: SkillWithMasteryDto[];
}

export const EditSkillModal: React.FC<EditSkillModalProps> = ({
  isOpen,
  onClose,
  skill,
  availableSkills = [],
}) => {
  const [name, setName] = useState(skill.name);
  const [category, setCategory] = useState(skill.category || '');
  const [parentSkillId, setParentSkillId] = useState<string>(skill.parent_skill_id || '');
  const [description, setDescription] = useState(skill.description || '');
  const [status, setStatus] = useState<SkillDto['status']>(skill.status);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const updateSkill = useUpdateSkill();

  useEffect(() => {
    setName(skill.name);
    setCategory(skill.category || '');
    setParentSkillId(skill.parent_skill_id || '');
    setDescription(skill.description || '');
    setStatus(skill.status);
    setErrorMsg(null);
  }, [skill]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Skill name is required.');
      return;
    }

    setErrorMsg(null);
    try {
      await updateSkill.mutateAsync({
        id: skill.id,
        data: {
          name: name.trim(),
          category: category.trim() || null,
          parent_skill_id: parentSkillId || null,
          description: description.trim() || null,
          status,
        },
      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update skill');
    }
  };

  const parentOptions = [
    { value: '', label: 'None (Top-level Skill)' },
    ...availableSkills
      .filter((s) => s.skill.id !== skill.id) // exclude self to prevent cycle
      .map((s) => ({
        value: s.skill.id,
        label: `${s.skill.name}${s.skill.category ? ` (${s.skill.category})` : ''}`,
      })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Skill: ${skill.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
            Skill Name *
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
            Category
          </label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
            Parent Skill (Hierarchy)
          </label>
          <Select
            value={parentSkillId}
            onChange={(e) => setParentSkillId(e.target.value)}
            options={parentOptions}
          />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
            Status
          </label>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as SkillDto['status'])}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={updateSkill.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={updateSkill.isPending}>
            {updateSkill.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
