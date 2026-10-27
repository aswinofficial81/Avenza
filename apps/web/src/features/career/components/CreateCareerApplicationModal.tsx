import React, { useState, useEffect } from 'react';
import type {
  CareerApplicationStage,
  CareerOpportunityDto,
  CreateCareerApplicationInput,
} from '@avenza/shared';
import { CAREER_APPLICATION_STAGES } from '@avenza/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { Label } from '../../../components/ui/Label';
import { useCreateCareerApplication } from '../hooks/useCareer';
import { Plus } from 'lucide-react';

export interface CreateCareerApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunities: CareerOpportunityDto[];
  initialOpportunityId?: string;
  onSuccess?: (appId: string) => void;
}

export const CreateCareerApplicationModal: React.FC<CreateCareerApplicationModalProps> = ({
  isOpen,
  onClose,
  opportunities,
  initialOpportunityId = '',
  onSuccess,
}) => {
  const [opportunityId, setOpportunityId] = useState(initialOpportunityId);
  const [stage, setStage] = useState<CareerApplicationStage>('saved');
  const [appliedAt, setAppliedAt] = useState('');
  const [deadline, setDeadline] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [coverLetterUrl, setCoverLetterUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createApplicationMutation = useCreateCareerApplication();

  useEffect(() => {
    if (initialOpportunityId) {
      setOpportunityId(initialOpportunityId);
    }
  }, [initialOpportunityId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!opportunityId) {
      setErrorMsg('Please select a job opportunity to track.');
      return;
    }

    if (resumeUrl.trim()) {
      try {
        const u = new URL(resumeUrl.trim());
        if (!u.protocol.startsWith('http')) {
          setErrorMsg('Resume link must use http:// or https://');
          return;
        }
      } catch {
        setErrorMsg('Please enter a valid Resume URL.');
        return;
      }
    }

    if (coverLetterUrl.trim()) {
      try {
        const u = new URL(coverLetterUrl.trim());
        if (!u.protocol.startsWith('http')) {
          setErrorMsg('Cover letter link must use http:// or https://');
          return;
        }
      } catch {
        setErrorMsg('Please enter a valid Cover Letter URL.');
        return;
      }
    }

    const payload: CreateCareerApplicationInput = {
      opportunity_id: opportunityId,
      stage,
      applied_at: appliedAt ? new Date(appliedAt).toISOString() : null,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      resume_file_url: resumeUrl.trim() || null,
      cover_letter_url: coverLetterUrl.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      const created = await createApplicationMutation.mutateAsync(payload);
      resetForm();
      if (onSuccess) onSuccess(created.id);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create application.');
    }
  };

  const resetForm = () => {
    setOpportunityId(initialOpportunityId);
    setStage('saved');
    setAppliedAt('');
    setDeadline('');
    setResumeUrl('');
    setCoverLetterUrl('');
    setNotes('');
    setErrorMsg(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Career Application"
      description="Track a new submission in your personal application pipeline."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {errorMsg && (
          <div className="p-3 text-xs rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
            {errorMsg}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="app-opp-select" required>
              Select Opportunity
            </Label>
            <Select
              id="app-opp-select"
              value={opportunityId}
              onChange={(e) => setOpportunityId(e.target.value)}
              disabled={createApplicationMutation.isPending}
              className="text-xs"
            >
              <option value="">-- Choose an opportunity --</option>
              {opportunities.map((opp) => (
                <option key={opp.id} value={opp.id}>
                  {opp.role_title} at {opp.company_name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="app-stage-select">Initial Pipeline Stage</Label>
              <Select
                id="app-stage-select"
                value={stage}
                onChange={(e) => setStage(e.target.value as CareerApplicationStage)}
                disabled={createApplicationMutation.isPending}
                className="text-xs capitalize"
              >
                {CAREER_APPLICATION_STAGES.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="app-applied-at-input">Date Submitted</Label>
              <Input
                id="app-applied-at-input"
                type="date"
                value={appliedAt}
                onChange={(e) => setAppliedAt(e.target.value)}
                disabled={createApplicationMutation.isPending}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="app-deadline-input">Follow-up / Submission Deadline</Label>
              <Input
                id="app-deadline-input"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={createApplicationMutation.isPending}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="app-resume-url-input">Tailored Resume Link (Optional)</Label>
              <Input
                id="app-resume-url-input"
                type="url"
                placeholder="https://drive.google.com/... or portfolio link"
                value={resumeUrl}
                onChange={(e) => setResumeUrl(e.target.value)}
                disabled={createApplicationMutation.isPending}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="app-cover-url-input">Cover Letter Link (Optional)</Label>
              <Input
                id="app-cover-url-input"
                type="url"
                placeholder="https://..."
                value={coverLetterUrl}
                onChange={(e) => setCoverLetterUrl(e.target.value)}
                disabled={createApplicationMutation.isPending}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="app-notes-input">Application Notes & Referral Context</Label>
            <Textarea
              id="app-notes-input"
              placeholder="Referral name, recruiter contact, specific team mission..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={createApplicationMutation.isPending}
              rows={2}
              className="text-xs resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={createApplicationMutation.isPending}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={createApplicationMutation.isPending}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            id="submit-create-app-btn"
          >
            Track in Pipeline
          </Button>
        </div>
      </form>
    </Modal>
  );
};
