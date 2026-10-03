import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { Select } from '../../../components/ui/Select';
import { useCreateAssessment, useSubjects, useTerms, useUpdateAssessment } from '../useAcademics';
import type { AssessmentDto, AssessmentStatus, AssessmentType } from '@avenza/shared';

interface CreateAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTermId?: string;
  defaultSubjectId?: string;
}

export const CreateAssessmentModal: React.FC<CreateAssessmentModalProps> = ({
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
  const [assessmentType, setAssessmentType] = useState<AssessmentType>('assignment');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxMarks, setMaxMarks] = useState<string>('');
  const [obtainedMarks, setObtainedMarks] = useState<string>('');
  const [weightPercent, setWeightPercent] = useState<string>('');
  const [status, setStatus] = useState<AssessmentStatus>('planned');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createAssessment = useCreateAssessment();

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
      setError('Assessment title is required');
      return;
    }

    const max = maxMarks ? parseFloat(maxMarks) : null;
    const obtained = obtainedMarks ? parseFloat(obtainedMarks) : null;

    if (max != null && obtained != null && obtained > max) {
      setError('Obtained marks cannot exceed maximum marks');
      return;
    }

    try {
      await createAssessment.mutateAsync({
        term_id: selectedTerm,
        subject_id: subjectId || defaultSubjectId || null,
        title: title.trim(),
        assessment_type: assessmentType,
        description: description.trim() || null,
        due_at: dueDate ? new Date(dueDate).toISOString() : null,
        max_marks: max,
        obtained_marks: obtained,
        weight_percent: weightPercent ? parseFloat(weightPercent) : null,
        status,
        notes: notes.trim() || null,
      });
      onClose();
      setTitle('');
      setDescription('');
      setDueDate('');
      setMaxMarks('');
      setObtainedMarks('');
      setWeightPercent('');
      setNotes('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create assessment');
    }
  };

  const termOptions = terms.map((t) => ({ value: t.id, label: t.name }));
  const filteredSubjects = termId ? subjects.filter((s) => s.term_id === termId) : subjects;
  const subjectOptions = [
    { value: '', label: 'General / No Subject' },
    ...filteredSubjects.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Assessment" size="md">
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
          label="Title *"
          placeholder="e.g. Lab 2: Cache Simulation, Quiz 1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Type"
            value={assessmentType}
            onChange={(e) => setAssessmentType(e.target.value as AssessmentType)}
            options={[
              { value: 'assignment', label: 'Assignment' },
              { value: 'quiz', label: 'Quiz' },
              { value: 'lab', label: 'Lab' },
              { value: 'project', label: 'Project' },
              { value: 'internal', label: 'Internal Exam' },
              { value: 'presentation', label: 'Presentation' },
              { value: 'mock', label: 'Mock Test' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AssessmentStatus)}
            options={[
              { value: 'planned', label: 'Planned' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'submitted', label: 'Submitted' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>

        <Input
          label="Due Date & Time (Optional)"
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Max Marks"
            type="number"
            min="0"
            step="0.5"
            placeholder="e.g. 100"
            value={maxMarks}
            onChange={(e) => setMaxMarks(e.target.value)}
          />
          <Input
            label="Obtained Marks"
            type="number"
            min="0"
            step="0.5"
            placeholder="e.g. 88"
            value={obtainedMarks}
            onChange={(e) => setObtainedMarks(e.target.value)}
          />
          <Input
            label="Weight (%)"
            type="number"
            min="0"
            max="100"
            placeholder="e.g. 20"
            value={weightPercent}
            onChange={(e) => setWeightPercent(e.target.value)}
          />
        </div>

        <Textarea
          label="Description (Optional)"
          placeholder="Assessment guidelines, deliverables, rubric notes..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={createAssessment.isPending}>
            {createAssessment.isPending ? 'Adding...' : 'Add Assessment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

interface EditAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: AssessmentDto;
}

export const EditAssessmentModal: React.FC<EditAssessmentModalProps> = ({
  isOpen,
  onClose,
  assessment,
}) => {
  const [title, setTitle] = useState(assessment.title);
  const [assessmentType, setAssessmentType] = useState<AssessmentType>(assessment.assessment_type);
  const [description, setDescription] = useState(assessment.description || '');
  const [dueDate, setDueDate] = useState(
    assessment.due_at ? assessment.due_at.slice(0, 16) : ''
  );
  const [maxMarks, setMaxMarks] = useState<string>(
    assessment.max_marks != null ? String(assessment.max_marks) : ''
  );
  const [obtainedMarks, setObtainedMarks] = useState<string>(
    assessment.obtained_marks != null ? String(assessment.obtained_marks) : ''
  );
  const [weightPercent, setWeightPercent] = useState<string>(
    assessment.weight_percent != null ? String(assessment.weight_percent) : ''
  );
  const [status, setStatus] = useState<AssessmentStatus>(assessment.status);
  const [notes, setNotes] = useState(assessment.notes || '');
  const [error, setError] = useState<string | null>(null);

  const updateAssessment = useUpdateAssessment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    const max = maxMarks ? parseFloat(maxMarks) : null;
    const obtained = obtainedMarks ? parseFloat(obtainedMarks) : null;

    if (max != null && obtained != null && obtained > max) {
      setError('Obtained marks cannot exceed maximum marks');
      return;
    }

    try {
      await updateAssessment.mutateAsync({
        id: assessment.id,
        data: {
          title: title.trim(),
          assessment_type: assessmentType,
          description: description.trim() || null,
          due_at: dueDate ? new Date(dueDate).toISOString() : null,
          max_marks: max,
          obtained_marks: obtained,
          weight_percent: weightPercent ? parseFloat(weightPercent) : null,
          status,
          notes: notes.trim() || null,
        },
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update assessment');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Assessment" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded">
            {error}
          </div>
        )}

        <Input
          label="Title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Type"
            value={assessmentType}
            onChange={(e) => setAssessmentType(e.target.value as AssessmentType)}
            options={[
              { value: 'assignment', label: 'Assignment' },
              { value: 'quiz', label: 'Quiz' },
              { value: 'lab', label: 'Lab' },
              { value: 'project', label: 'Project' },
              { value: 'internal', label: 'Internal Exam' },
              { value: 'presentation', label: 'Presentation' },
              { value: 'mock', label: 'Mock Test' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AssessmentStatus)}
            options={[
              { value: 'planned', label: 'Planned' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'submitted', label: 'Submitted' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>

        <Input
          label="Due Date & Time"
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Max Marks"
            type="number"
            min="0"
            step="0.5"
            value={maxMarks}
            onChange={(e) => setMaxMarks(e.target.value)}
          />
          <Input
            label="Obtained Marks"
            type="number"
            min="0"
            step="0.5"
            value={obtainedMarks}
            onChange={(e) => setObtainedMarks(e.target.value)}
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
          <Button type="submit" variant="primary" disabled={updateAssessment.isPending}>
            {updateAssessment.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
