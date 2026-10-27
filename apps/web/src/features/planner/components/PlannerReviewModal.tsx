import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import type { ScheduleProposalResponseDto } from '@avenza/shared';

interface PlannerReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  proposal: ScheduleProposalResponseDto;
  isApplying: boolean;
}

export const PlannerReviewModal: React.FC<PlannerReviewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  proposal,
  isApplying,
}) => {
  const { proposedBlocks, totalProposedMinutes, isExternalCalendarAvailable } = proposal;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Schedule Application"
      description="Applying this plan will update task statuses to 'scheduled' and assign their start and end times in your calendar."
      size="md"
    >
      <div className="space-y-4 pt-2">
        {!isExternalCalendarAvailable && (
          <Alert variant="warning" className="text-xs">
            Google Calendar is disconnected. Potential external calendar conflicts were not verified.
          </Alert>
        )}

        <div className="p-3 bg-[var(--color-bg-subtle)] rounded-lg space-y-1.5 text-xs text-[var(--color-text-secondary)]">
          <div className="flex justify-between">
            <span className="text-[var(--color-text-muted)]">Target Date:</span>
            <span className="font-semibold text-[var(--color-text-primary)]">{proposal.targetDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-muted)]">Tasks to Schedule:</span>
            <span className="font-semibold text-[var(--color-text-primary)]">{proposedBlocks.length} tasks</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-muted)]">Total Work Duration:</span>
            <span className="font-semibold text-[var(--color-text-primary)]">{totalProposedMinutes} minutes</span>
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-[var(--color-border-subtle)] rounded-lg p-2 bg-[var(--color-bg-surface)]">
          <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider px-1">
            Tasks to be scheduled
          </span>
          {proposedBlocks.map((b) => (
            <div
              key={b.taskId}
              className="flex items-center justify-between text-xs p-1.5 rounded bg-[var(--color-bg-subtle)]/60"
            >
              <span className="font-medium truncate max-w-[240px] text-[var(--color-text-primary)]">
                {b.title}
              </span>
              <span className="font-mono text-[var(--color-text-muted)] text-[11px]">
                {new Date(b.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} – {new Date(b.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-border-subtle)]">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isApplying}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onConfirm}
            disabled={isApplying || proposedBlocks.length === 0}
          >
            {isApplying ? 'Applying Schedule...' : 'Confirm & Apply'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
