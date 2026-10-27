import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import type { UnscheduledTaskDto, UnscheduledReason } from '@avenza/shared';

interface PlannerUnscheduledListProps {
  unscheduledTasks: UnscheduledTaskDto[];
}

export const PlannerUnscheduledList: React.FC<PlannerUnscheduledListProps> = ({
  unscheduledTasks,
}) => {
  if (unscheduledTasks.length === 0) {
    return null;
  }

  const getReasonBadge = (reason: UnscheduledReason) => {
    switch (reason) {
      case 'BLOCKED_BY_DEPENDENCY':
        return <Badge variant="warning" size="sm">Prerequisites Incomplete</Badge>;
      case 'CAPACITY_REACHED':
        return <Badge variant="secondary" size="sm">Daily Target Reached</Badge>;
      case 'NO_CONTIGUOUS_SLOT':
        return <Badge variant="default" size="sm">No Free Slot</Badge>;
      case 'INVALID_ESTIMATE':
        return <Badge variant="info" size="sm">Needs Estimate</Badge>;
      case 'INELIGIBLE_STATUS':
      default:
        return <Badge variant="secondary" size="sm">Ineligible</Badge>;
    }
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          Unscheduled Tasks ({unscheduledTasks.length})
        </h2>
        <span className="text-xs text-[var(--color-text-muted)]">
          Tasks requiring action or deferred
        </span>
      </div>

      <Card className="divide-y divide-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] overflow-hidden">
        {unscheduledTasks.map((t) => (
          <div
            key={t.taskId}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 text-sm hover:bg-[var(--color-bg-subtle)]/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Link
                to={`/tasks/${t.taskId}`}
                className="font-medium text-[var(--color-text-primary)] hover:underline hover:text-[var(--color-primary)]"
              >
                {t.title}
              </Link>
            </div>

            <div className="flex items-center gap-3">
              {getReasonBadge(t.reason)}
              <span className="text-xs text-[var(--color-text-muted)]">
                {t.reasonMessage}
              </span>
              <Link
                to={`/tasks/${t.taskId}`}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:underline ml-2"
              >
                Edit →
              </Link>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
};
