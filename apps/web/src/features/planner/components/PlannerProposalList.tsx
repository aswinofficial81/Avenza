import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { Badge, type BadgeVariant } from '../../../components/ui/Badge';
import type { ProposedTaskBlockDto, ExistingCommitmentDto } from '@avenza/shared';

interface PlannerProposalListProps {
  proposedBlocks: ProposedTaskBlockDto[];
  existingCommitments: ExistingCommitmentDto[];
}

export const PlannerProposalList: React.FC<PlannerProposalListProps> = ({
  proposedBlocks,
  existingCommitments,
}) => {
  // Merge items chronologically for timeline display
  type TimelineItem =
    | { kind: 'proposed'; data: ProposedTaskBlockDto; start: Date }
    | { kind: 'existing'; data: ExistingCommitmentDto; start: Date };

  const items: TimelineItem[] = [
    ...proposedBlocks.map((b) => ({ kind: 'proposed' as const, data: b, start: new Date(b.scheduledStart) })),
    ...existingCommitments.map((c) => ({ kind: 'existing' as const, data: c, start: new Date(c.start) })),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return isoString;
    }
  };

  const getPriorityVariant = (priority: string): BadgeVariant => {
    switch (priority.toLowerCase()) {
      case 'critical':
      case 'urgent':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      default:
        return 'default';
    }
  };

  // Only existing commitments (no proposed blocks) — show commitments with a clear note
  const hasProposed = proposedBlocks.length > 0;
  const hasExisting = existingCommitments.length > 0;

  if (!hasProposed && !hasExisting) {
    return (
      <Card className="py-10 px-6 text-center bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
        <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
          No timeline to display
        </p>
        <p className="text-xs text-[var(--color-text-muted)] max-w-sm mx-auto leading-relaxed">
          No tasks were proposed and no existing commitments were found in your study window for this date.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Timeline
          <span className="ml-2 text-[var(--color-text-muted)] font-normal">
            {hasProposed && `${proposedBlocks.length} proposed`}
            {hasProposed && hasExisting && ' · '}
            {hasExisting && `${existingCommitments.length} existing`}
          </span>
        </h2>
        <span className="text-xs text-[var(--color-text-muted)]">Chronological</span>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => {
          if (item.kind === 'existing') {
            const c = item.data;
            return (
              <div
                key={`existing-${idx}`}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/50 opacity-75"
              >
                {/* Time */}
                <div className="w-28 shrink-0 font-mono text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                  {formatTime(c.start)} – {formatTime(c.end)}
                </div>
                {/* Title */}
                <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-text-muted)] truncate">
                    {c.title}
                  </span>
                  <Badge variant="secondary" size="sm">
                    {c.source === 'google_calendar' ? 'Google Calendar' : 'Avenza'}
                  </Badge>
                </div>
                {/* Fixed label */}
                <span className="text-[10px] text-[var(--color-text-muted)] font-mono shrink-0">
                  Fixed
                </span>
              </div>
            );
          }

          const block = item.data;
          return (
            <div
              key={`proposed-${block.taskId}`}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 py-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] hover:border-[var(--color-border-hover)] transition-colors"
            >
              {/* Left: time + title */}
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-28 shrink-0 font-mono text-sm font-semibold text-[var(--color-primary)] whitespace-nowrap">
                  {formatTime(block.scheduledStart)} – {formatTime(block.scheduledEnd)}
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <Link
                      to={`/tasks/${block.taskId}`}
                      className="text-sm font-semibold text-[var(--color-text-primary)] hover:underline hover:text-[var(--color-primary)] truncate"
                    >
                      {block.title}
                    </Link>
                    <Badge variant={getPriorityVariant(block.priority)} size="sm" className="capitalize shrink-0">
                      {block.priority}
                    </Badge>
                    {block.isDurationDefaulted && (
                      <Badge variant="warning" size="sm" className="shrink-0">
                        Provisional 30m
                      </Badge>
                    )}
                  </div>
                  {block.primaryReason && (
                    <p className="text-xs text-[var(--color-text-muted)] leading-snug">
                      {block.primaryReason}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: duration + link */}
              <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                <span className="text-xs font-mono font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] px-2 py-0.5 rounded-md whitespace-nowrap">
                  {block.durationMinutes} min
                </span>
                <Link
                  to={`/tasks/${block.taskId}`}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:underline whitespace-nowrap"
                >
                  View →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
