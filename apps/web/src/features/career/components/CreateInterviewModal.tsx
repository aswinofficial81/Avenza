import React, { useState } from 'react';
import {
  CAREER_INTERVIEW_TYPES,
  type CareerInterviewType,
  type CreateCareerInterviewInput,
} from '@avenza/shared';
import { useCreateCareerInterview } from '../hooks/useCareer';

interface CreateInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  nextRoundNumber?: number;
}

const INTERVIEW_TYPE_LABELS: Record<CareerInterviewType, string> = {
  recruiter_screen: 'Recruiter Screen',
  technical_dsa: 'Technical / DSA',
  system_design: 'System Design',
  take_home_review: 'Take-Home Review',
  hiring_manager: 'Hiring Manager',
  behavioral: 'Behavioral',
  executive: 'Executive',
  other: 'Other Round',
};

export const CreateInterviewModal: React.FC<CreateInterviewModalProps> = ({
  isOpen,
  onClose,
  applicationId,
  nextRoundNumber = 1,
}) => {
  const createInterviewMutation = useCreateCareerInterview(applicationId);

  const [roundNumber, setRoundNumber] = useState(nextRoundNumber);
  const [roundType, setRoundType] = useState<CareerInterviewType>('recruiter_screen');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [meetingLink, setMeetingLink] = useState('');
  const [interviewerNamesInput, setInterviewerNamesInput] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const interviewerNames = interviewerNamesInput
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    const payload: CreateCareerInterviewInput = {
      round_number: roundNumber,
      round_type: roundType,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      duration_minutes: durationMinutes,
      meeting_link: meetingLink.trim() || null,
      interviewer_names: interviewerNames,
      notes: notes.trim() || null,
      status: 'scheduled',
      result: 'pending',
    };

    try {
      await createInterviewMutation.mutateAsync(payload);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to schedule interview.';
      setFormError(msg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-interview-title"
    >
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl p-6 text-foreground my-8">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <h2 id="create-interview-title" className="text-xl font-bold tracking-tight">
            Schedule Interview Round
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground text-xl p-1 rounded transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {formError && (
          <div className="mb-4 p-3 bg-error/10 border border-error/30 text-error rounded-lg text-sm">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Round Number <span className="text-error">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={roundNumber}
                onChange={(e) => setRoundNumber(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Round Type <span className="text-error">*</span>
              </label>
              <select
                value={roundType}
                onChange={(e) => setRoundType(e.target.value as CareerInterviewType)}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {CAREER_INTERVIEW_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {INTERVIEW_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date & Time</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
              <input
                type="number"
                min={15}
                max={480}
                step={15}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Meeting Link or Location</label>
            <input
              type="url"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://meet.google.com/xyz or Zoom link"
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Interviewers (comma-separated)
            </label>
            <input
              type="text"
              value={interviewerNamesInput}
              onChange={(e) => setInterviewerNamesInput(e.target.value)}
              placeholder="Jane Doe (EM), John Smith (Senior SWE)"
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Preparation Notes / Focus Areas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Topics to prepare, questions to ask, behavioral examples to review..."
              rows={3}
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border text-sm font-medium rounded-lg hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createInterviewMutation.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createInterviewMutation.isPending ? 'Scheduling...' : 'Schedule Interview'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
