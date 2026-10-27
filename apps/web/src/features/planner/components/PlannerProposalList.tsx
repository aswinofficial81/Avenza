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

  if (items.length === 0) {
    return (
      <Card className="p-8 text-center bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
        <p className="text-[var(--color-text-muted)] text-sm">
          No tasks were scheduled for this date.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          Timeline ({proposedBlocks.length} proposed, {existingCommitments.length} existing)
        </h2>
        <span className="text-xs text-[var(--color-text-muted)]">
          Chronological sequence
        </span>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => {
          if (item.kind === 'existing') {
            const c = item.data;
            return (
              <div
                key={`existing-${idx}`}
                className="flex items-center gap-4 p-3 rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)]/50 opacity-80"
              >
                <div className="w-28 shrink-0 font-mono text-xs text-[var(--color-text-muted)]">
                  {formatTime(c.start)} – {formatTime(c.end)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text-muted)] truncate">
                      {c.title}
                    </span>
                    <Badge variant="secondary" size="sm" className="text-[10px]">
                      {c.source === 'google_calendar' ? 'Google Calendar' : 'Avenza Scheduled'}
                    </Badge>
                  </div>
                </div>
                <div className="text-xs text-[var(--color-text-muted)] font-mono">
                  Occupied (Fixed)
                </div>
              </div>
            );
          }

          const block = item.data;
          return (
            <div
              key={`proposed-${block.taskId}`}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] hover:border-[var(--color-border-hover)] transition-all shadow-xs"
            >
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-28 shrink-0 font-mono text-sm font-semibold text-[var(--color-primary)]">
                  {formatTime(block.scheduledStart)} – {formatTime(block.scheduledEnd)}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/tasks/${block.taskId}`}
                      className="text-sm font-semibold text-[var(--color-text-primary)] hover:underline hover:text-[var(--color-primary)]"
                    >
                      {block.title}
                    </Link>
                    <Badge variant={getPriorityVariant(block.priority)} size="sm" className="capitalize">
                      {block.priority}
                    </Badge>
                    {block.isDurationDefaulted && (
                      <Badge variant="warning" size="sm" className="text-[10px]">
                        Provisional (30m default)
                      </Badge>
                    )}
                  </div>
                  {block.primaryReason && (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {block.primaryReason}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                <span className="text-xs font-mono font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-subtle)] px-2 py-0.5 rounded">
                  {block.durationMinutes} min
                </span>
                <Link
                  to={`/tasks/${block.taskId}`}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:underline"
                >
                  View Details →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
