import React, { useState } from 'react';
import type { SkillWithMasteryDto } from '@avenza/shared';
import { Button, Input, Modal, Select, Textarea } from '../../../components/ui';
import { useCreateSkill } from '../useSkills';

interface CreateSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableSkills?: SkillWithMasteryDto[];
  defaultParentId?: string | null;
}

export const CreateSkillModal: React.FC<CreateSkillModalProps> = ({
  isOpen,
  onClose,
  availableSkills = [],
  defaultParentId = null,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [parentSkillId, setParentSkillId] = useState<string>(defaultParentId || '');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createSkill = useCreateSkill();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Skill name is required.');
      return;
    }

    setErrorMsg(null);
    try {
      await createSkill.mutateAsync({
        name: name.trim(),
        category: category.trim() || undefined,
        parent_skill_id: parentSkillId || undefined,
        description: description.trim() || undefined,
      });
      setName('');
      setCategory('');
      setParentSkillId('');
      setDescription('');
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create skill');
    }
  };

  const parentOptions = [
    { value: '', label: 'None (Top-level Skill)' },
    ...availableSkills
      .filter((s) => s.skill.status === 'active')
      .map((s) => ({
        value: s.skill.id,
        label: `${s.skill.name}${s.skill.category ? ` (${s.skill.category})` : ''}`,
      })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Capability / Skill">
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
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Binary Search, PostgreSQL, React"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
            Category
          </label>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Algorithms, Databases, Engineering"
          />
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
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional context about what capability this represents..."
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={createSkill.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={createSkill.isPending}>
            {createSkill.isPending ? 'Creating...' : 'Create Skill'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
