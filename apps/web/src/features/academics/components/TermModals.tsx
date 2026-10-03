import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { Select } from '../../../components/ui/Select';
import { useCreateTerm, useUpdateTerm } from '../useAcademics';
import type { TermDto, TermStatus } from '@avenza/shared';

interface CreateTermModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateTermModal: React.FC<CreateTermModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<TermStatus>('active');
  const [isCurrent, setIsCurrent] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createTerm = useCreateTerm();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Term name is required');
      return;
    }
    if (!startDate || !endDate) {
      setError('Start date and End date are required');
      return;
    }
    if (startDate > endDate) {
      setError('Start date must be before or equal to End date');
      return;
    }

    try {
      await createTerm.mutateAsync({
        name: name.trim(),
        code: code.trim() || null,
        start_date: startDate,
        end_date: endDate,
        status,
        is_current: isCurrent,
        notes: notes.trim() || null,
      });
      onClose();
      setName('');
      setCode('');
      setStartDate('');
      setEndDate('');
      setNotes('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create term');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Academic Term" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded">
            {error}
          </div>
        )}

        <Input
          label="Term Name *"
          placeholder="e.g. Fall 2026, Semester 1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Code (Optional)"
            placeholder="e.g. F26, S1"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TermStatus)}
            options={[
              { value: 'planned', label: 'Planned' },
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start Date *"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <Input
            label="End Date *"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="isCurrentTerm"
            checked={isCurrent}
            onChange={(e) => setIsCurrent(e.target.checked)}
            className="rounded border-border text-primary focus:ring-0"
          />
          <label htmlFor="isCurrentTerm" className="text-xs text-foreground font-medium select-none cursor-pointer">
            Set as current active term
          </label>
        </div>

        <Textarea
          label="Notes (Optional)"
          placeholder="Term goals, academic calendar references, or milestones..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={createTerm.isPending}>
            {createTerm.isPending ? 'Creating...' : 'Create Term'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

interface EditTermModalProps {
  isOpen: boolean;
  onClose: () => void;
  term: TermDto;
}

export const EditTermModal: React.FC<EditTermModalProps> = ({ isOpen, onClose, term }) => {
  const [name, setName] = useState(term.name);
  const [code, setCode] = useState(term.code || '');
  const [startDate, setStartDate] = useState(term.start_date);
  const [endDate, setEndDate] = useState(term.end_date);
  const [status, setStatus] = useState<TermStatus>(term.status);
  const [isCurrent, setIsCurrent] = useState(term.is_current);
  const [notes, setNotes] = useState(term.notes || '');
  const [error, setError] = useState<string | null>(null);

  const updateTerm = useUpdateTerm();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Term name is required');
      return;
    }
    if (startDate > endDate) {
      setError('Start date must be before or equal to End date');
      return;
    }

    try {
      await updateTerm.mutateAsync({
        id: term.id,
        data: {
          name: name.trim(),
          code: code.trim() || null,
          start_date: startDate,
          end_date: endDate,
          status,
          is_current: isCurrent,
          notes: notes.trim() || null,
        },
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update term');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Academic Term" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded">
            {error}
          </div>
        )}

        <Input
          label="Term Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Code (Optional)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TermStatus)}
            options={[
              { value: 'planned', label: 'Planned' },
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start Date *"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <Input
            label="End Date *"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="editIsCurrentTerm"
            checked={isCurrent}
            onChange={(e) => setIsCurrent(e.target.checked)}
            className="rounded border-border text-primary focus:ring-0"
          />
          <label htmlFor="editIsCurrentTerm" className="text-xs text-foreground font-medium select-none cursor-pointer">
            Current active term
          </label>
        </div>

        <Textarea
          label="Notes (Optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={updateTerm.isPending}>
            {updateTerm.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
