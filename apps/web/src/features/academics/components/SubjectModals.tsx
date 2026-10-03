import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { Select } from '../../../components/ui/Select';
import { useCreateSubject, useTerms, useUpdateSubject } from '../useAcademics';
import type { SubjectDto, SubjectStatus } from '@avenza/shared';

interface CreateSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTermId?: string;
}

export const CreateSubjectModal: React.FC<CreateSubjectModalProps> = ({
  isOpen,
  onClose,
  defaultTermId,
}) => {
  const { data: terms = [] } = useTerms();
  const [termId, setTermId] = useState(defaultTermId || terms[0]?.id || '');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [instructor, setInstructor] = useState('');
  const [credits, setCredits] = useState<string>('');
  const [color, setColor] = useState('');
  const [status, setStatus] = useState<SubjectStatus>('active');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createSubject = useCreateSubject();

  // If defaultTermId changes or terms load
  React.useEffect(() => {
    if (!termId && terms.length > 0) {
      setTermId(defaultTermId || terms[0]?.id || '');
    }
  }, [terms, defaultTermId, termId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const selectedTerm = termId || defaultTermId || terms[0]?.id;
    if (!selectedTerm) {
      setError('Please select or create an academic term first');
      return;
    }
    if (!name.trim()) {
      setError('Subject name is required');
      return;
    }

    try {
      await createSubject.mutateAsync({
        term_id: selectedTerm,
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        instructor: instructor.trim() || null,
        credits: credits ? parseFloat(credits) : null,
        color: color.trim() || null,
        status,
        notes: notes.trim() || null,
      });
      onClose();
      setName('');
      setCode('');
      setDescription('');
      setInstructor('');
      setCredits('');
      setColor('');
      setNotes('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create subject');
    }
  };

  const termOptions = terms.map((t) => ({
    value: t.id,
    label: `${t.name} (${t.start_date.slice(0, 7)})`,
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Academic Subject" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded">
            {error}
          </div>
        )}

        <Select
          label="Academic Term *"
          value={termId || defaultTermId || terms[0]?.id || ''}
          onChange={(e) => setTermId(e.target.value)}
          options={termOptions}
          disabled={Boolean(defaultTermId && terms.length === 1)}
          required
        />

        <Input
          label="Subject Name *"
          placeholder="e.g. Distributed Systems, Algorithms"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Subject Code"
            placeholder="e.g. CS602, MATH101"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Input
            label="Instructor (Optional)"
            placeholder="e.g. Dr. Lamport"
            value={instructor}
            onChange={(e) => setInstructor(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Credits (Optional)"
            type="number"
            step="0.5"
            min="0"
            placeholder="e.g. 4.0"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as SubjectStatus)}
            options={[
              { value: 'planned', label: 'Planned' },
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>

        <Textarea
          label="Description (Optional)"
          placeholder="Course syllabus scope, goals, or prerequisites..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={createSubject.isPending}>
            {createSubject.isPending ? 'Adding...' : 'Add Subject'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

interface EditSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: SubjectDto;
}

export const EditSubjectModal: React.FC<EditSubjectModalProps> = ({
  isOpen,
  onClose,
  subject,
}) => {
  const [name, setName] = useState(subject.name);
  const [code, setCode] = useState(subject.code || '');
  const [description, setDescription] = useState(subject.description || '');
  const [instructor, setInstructor] = useState(subject.instructor || '');
  const [credits, setCredits] = useState<string>(subject.credits != null ? String(subject.credits) : '');
  const [status, setStatus] = useState<SubjectStatus>(subject.status);
  const [notes, setNotes] = useState(subject.notes || '');
  const [error, setError] = useState<string | null>(null);

  const updateSubject = useUpdateSubject();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Subject name is required');
      return;
    }

    try {
      await updateSubject.mutateAsync({
        id: subject.id,
        data: {
          name: name.trim(),
          code: code.trim() || null,
          description: description.trim() || null,
          instructor: instructor.trim() || null,
          credits: credits ? parseFloat(credits) : null,
          status,
          notes: notes.trim() || null,
        },
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update subject');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Academic Subject" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded">
            {error}
          </div>
        )}

        <Input
          label="Subject Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Subject Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Input
            label="Instructor"
            value={instructor}
            onChange={(e) => setInstructor(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Credits"
            type="number"
            step="0.5"
            min="0"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as SubjectStatus)}
            options={[
              { value: 'planned', label: 'Planned' },
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>

        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={updateSubject.isPending}>
            {updateSubject.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
