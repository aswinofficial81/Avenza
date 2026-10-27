import React, { useState, useEffect } from 'react';
import type { CareerApplicationDto, CareerApplicationStage, CareerOpportunityDto } from '@avenza/shared';
import { CAREER_STAGE_TRANSITIONS, isTerminalStage } from '@avenza/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { Label } from '../../../components/ui/Label';
import { Badge } from '../../../components/ui/Badge';
import { AlertCircle, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useTransitionCareerApplicationStage } from '../hooks/useCareer';

export interface StageTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: CareerApplicationDto | null;
  opportunity?: CareerOpportunityDto;
  onSuccess?: (updated: CareerApplicationDto) => void;
}

export const StageTransitionModal: React.FC<StageTransitionModalProps> = ({
  isOpen,
  onClose,
  application,
  opportunity,
  onSuccess,
}) => {
  const currentStage = application?.stage || 'saved';
  const isTerminal = isTerminalStage(currentStage);
  const allowedNextStages = CAREER_STAGE_TRANSITIONS[currentStage] || [];

  const [selectedStage, setSelectedStage] = useState<CareerApplicationStage | ''>(
    allowedNextStages[0] || ''
  );
  const [notes, setNotes] = useState('');
  const [conflictError, setConflictError] = useState<string | null>(null);

  const transitionMutation = useTransitionCareerApplicationStage(application?.id || '');

  // Reset selected stage when application or allowed stages change
  useEffect(() => {
    if (allowedNextStages.length > 0 && allowedNextStages[0]) {
      setSelectedStage(allowedNextStages[0]);
    } else {
      setSelectedStage('');
    }
    setNotes('');
    setConflictError(null);
  }, [application?.id, application?.stage, isOpen]);

  if (!application) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);

    if (!selectedStage) {
      setConflictError('Please select a target stage.');
      return;
    }

    try {
      const updated = await transitionMutation.mutateAsync({
        stage: selectedStage,
        from_stage: currentStage,
        expected_stage: currentStage,
        notes: notes.trim() || undefined,
      });

      if (onSuccess) {
        onSuccess(updated);
      }
      onClose();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Stage transition failed.';
      // Specifically format and present HTTP 409 conflict
      if (
        errorMsg.toLowerCase().includes('conflict') ||
        errorMsg.toLowerCase().includes('409') ||
        errorMsg.toLowerCase().includes('mismatch')
      ) {
        setConflictError(
          `Conflict detected: The server persisted stage has changed. Real-time data has been refreshed. (${errorMsg})`
        );
      } else {
        setConflictError(errorMsg);
      }
    }
  };

  const company = opportunity?.company_name || 'Opportunity';
  const role = opportunity?.role_title || 'Role';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Advance Application Stage"
      description={`Update candidate workflow state for ${role} at ${company}.`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {/* Current vs Target Stage Visual */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border-subtle bg-surface-2 text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">Current Stage</span>
            <Badge variant="secondary" className="mt-1 capitalize font-medium">
              {currentStage}
            </Badge>
          </div>

          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />

          <div>
            <span className="text-muted-foreground block text-[11px]">Target Stage</span>
            <Badge variant="default" className="mt-1 capitalize font-semibold">
              {selectedStage || 'None'}
            </Badge>
          </div>
        </div>

        {/* Conflict / Error Banner */}
        {conflictError && (
          <div
            className="rounded-lg p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 flex items-start gap-2"
            role="alert"
          >
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Stage Transition Notice</p>
              <p className="text-[11px] leading-relaxed">{conflictError}</p>
            </div>
          </div>
        )}

        {isTerminal ? (
          <div className="rounded-lg p-3 text-xs bg-surface-2 border border-border-subtle text-muted-foreground flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              This application is in a terminal stage (<code className="font-mono">{currentStage}</code>). No further state transitions are permitted by business rules.
            </span>
          </div>
        ) : (
          <>
            {/* Allowed Stages Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="target-stage-select" required>
                Next Permitted Stage
              </Label>
              <Select
                id="target-stage-select"
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value as CareerApplicationStage)}
                disabled={transitionMutation.isPending}
                className="w-full text-xs capitalize"
              >
                {allowedNextStages.map((stage) => (
                  <option key={stage} value={stage} className="capitalize">
                    {stage}
                  </option>
                ))}
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Only valid transitions governed by the state machine are available.
              </p>
            </div>

            {/* Notes / Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="transition-notes">Stage Transition Notes (Optional)</Label>
              <Textarea
                id="transition-notes"
                placeholder="e.g. Cleared technical screen; proceeding to take-home assessment..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={transitionMutation.isPending}
                rows={3}
                className="text-xs resize-none"
              />
            </div>
          </>
        )}

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={transitionMutation.isPending}
          >
            Cancel
          </Button>

          {!isTerminal && (
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={transitionMutation.isPending}
              disabled={!selectedStage || transitionMutation.isPending}
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              id="confirm-stage-transition-btn"
            >
              Confirm Transition
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
};
