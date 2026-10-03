import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { Select } from '../../../components/ui/Select';
import { useCreateExam, useSubjects, useTerms, useUpdateExam } from '../useAcademics';
import type { ExamDto, ExamStatus, ExamType } from '@avenza/shared';

interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTermId?: string;
  defaultSubjectId?: string;
}

export const CreateExamModal: React.FC<CreateExamModalProps> = ({
  isOpen,
  onClose,
  defaultTermId,
  defaultSubjectId,
}) => {
  const { data: terms = [] } = useTerms();
  const { data: subjects = [] } = useSubjects();

  const [termId, setTermId] = useState(defaultTermId || terms[0]?.id || '');
  const [subjectId, setSubjectId] = useState(defaultSubjectId || '');
  const [title, setTitle] = useState('');
  const [examType, setExamType] = useState<ExamType>('midterm');
  const [examDate, setExamDate] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('120');
  const [location, setLocation] = useState('');
  const [weightPercent, setWeightPercent] = useState('');
  const [status, setStatus] = useState<ExamStatus>('planned');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createExam = useCreateExam();

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
      setError('Please select an academic term');
      return;
    }
    if (!title.trim()) {
      setError('Exam title is required');
      return;
    }
    if (!examDate) {
      setError('Exam date & time is required');
      return;
    }

    try {
      await createExam.mutateAsync({
        term_id: selectedTerm,
        subject_id: subjectId || defaultSubjectId || null,
        title: title.trim(),
        exam_type: examType,
        exam_date: new Date(examDate).toISOString(),
        duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
        location: location.trim() || null,
        weight_percent: weightPercent ? parseFloat(weightPercent) : null,
        status,
        notes: notes.trim() || null,
      });
      onClose();
      setTitle('');
      setExamDate('');
      setLocation('');
      setWeightPercent('');
      setNotes('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create exam');
    }
  };

  const termOptions = terms.map((t) => ({ value: t.id, label: t.name }));
  const filteredSubjects = termId ? subjects.filter((s) => s.term_id === termId) : subjects;
  const subjectOptions = [
    { value: '', label: 'General / No Subject' },
    ...filteredSubjects.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule Exam" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Term *"
            value={termId || defaultTermId || terms[0]?.id || ''}
            onChange={(e) => setTermId(e.target.value)}
            options={termOptions}
            required
          />
          <Select
            label="Subject"
            value={subjectId || defaultSubjectId || ''}
            onChange={(e) => setSubjectId(e.target.value)}
            options={subjectOptions}
          />
        </div>

        <Input
          label="Exam Title *"
          placeholder="e.g. Distributed Systems Midterm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Type"
            value={examType}
            onChange={(e) => setExamType(e.target.value as ExamType)}
            options={[
              { value: 'midterm', label: 'Midterm' },
              { value: 'endterm', label: 'Endterm' },
              { value: 'final', label: 'Final Exam' },
              { value: 'mock', label: 'Mock Exam' },
              { value: 'practical', label: 'Practical / Lab' },
              { value: 'viva', label: 'Viva / Oral' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ExamStatus)}
            options={[
              { value: 'planned', label: 'Planned' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date & Time *"
            type="datetime-local"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            required
          />
          <Input
            label="Duration (Minutes)"
            type="number"
            min="1"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Location (Optional)"
            placeholder="e.g. Hall 4B, Lab 2"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <Input
            label="Weight (%)"
            type="number"
            min="0"
            max="100"
            placeholder="e.g. 35"
            value={weightPercent}
            onChange={(e) => setWeightPercent(e.target.value)}
          />
        </div>

        <Textarea
          label="Notes (Optional)"
          placeholder="Exam syllabus topics, allowed materials (calculator/cheatsheet), exam format..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={createExam.isPending}>
            {createExam.isPending ? 'Scheduling...' : 'Schedule Exam'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

interface EditExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: ExamDto;
}

export const EditExamModal: React.FC<EditExamModalProps> = ({ isOpen, onClose, exam }) => {
  const [title, setTitle] = useState(exam.title);
  const [examType, setExamType] = useState<ExamType>(exam.exam_type);
  const [examDate, setExamDate] = useState(
    exam.exam_date ? exam.exam_date.slice(0, 16) : ''
  );
  const [durationMinutes, setDurationMinutes] = useState(
    exam.duration_minutes != null ? String(exam.duration_minutes) : ''
  );
  const [location, setLocation] = useState(exam.location || '');
  const [weightPercent, setWeightPercent] = useState(
    exam.weight_percent != null ? String(exam.weight_percent) : ''
  );
  const [status, setStatus] = useState<ExamStatus>(exam.status);
  const [notes, setNotes] = useState(exam.notes || '');
  const [error, setError] = useState<string | null>(null);

  const updateExam = useUpdateExam();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!examDate) {
      setError('Date & time is required');
      return;
    }

    try {
      await updateExam.mutateAsync({
        id: exam.id,
        data: {
          title: title.trim(),
          exam_type: examType,
          exam_date: new Date(examDate).toISOString(),
          duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
          location: location.trim() || null,
          weight_percent: weightPercent ? parseFloat(weightPercent) : null,
          status,
          notes: notes.trim() || null,
        },
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update exam');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Exam" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded">
            {error}
          </div>
        )}

        <Input
          label="Exam Title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Type"
            value={examType}
            onChange={(e) => setExamType(e.target.value as ExamType)}
            options={[
              { value: 'midterm', label: 'Midterm' },
              { value: 'endterm', label: 'Endterm' },
              { value: 'final', label: 'Final Exam' },
              { value: 'mock', label: 'Mock Exam' },
              { value: 'practical', label: 'Practical / Lab' },
              { value: 'viva', label: 'Viva / Oral' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ExamStatus)}
            options={[
              { value: 'planned', label: 'Planned' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date & Time *"
            type="datetime-local"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            required
          />
          <Input
            label="Duration (Minutes)"
            type="number"
            min="1"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <Input
            label="Weight (%)"
            type="number"
            min="0"
            max="100"
            value={weightPercent}
            onChange={(e) => setWeightPercent(e.target.value)}
          />
        </div>

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
          <Button type="submit" variant="primary" disabled={updateExam.isPending}>
            {updateExam.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
