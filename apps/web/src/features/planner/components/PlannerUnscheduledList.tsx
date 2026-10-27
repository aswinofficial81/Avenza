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
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Unscheduled Tasks
          <span className="ml-2 text-[var(--color-text-muted)] font-normal">
            {unscheduledTasks.length}
          </span>
        </h2>
        <span className="text-xs text-[var(--color-text-muted)]">Requiring action or deferred</span>
      </div>

      <Card className="divide-y divide-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] overflow-hidden">
        {unscheduledTasks.map((t) => (
          <div
            key={t.taskId}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-[var(--color-bg-subtle)]/50 transition-colors"
          >
            {/* Task name */}
            <Link
              to={`/tasks/${t.taskId}`}
              className="text-sm font-medium text-[var(--color-text-primary)] hover:underline hover:text-[var(--color-primary)] truncate min-w-0"
            >
              {t.title}
            </Link>

            {/* Right cluster: badge + message + link */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {getReasonBadge(t.reason)}
              {t.reasonMessage && (
                <span className="text-xs text-[var(--color-text-muted)] truncate max-w-[200px]">
                  {t.reasonMessage}
                </span>
              )}
              <Link
                to={`/tasks/${t.taskId}`}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:underline whitespace-nowrap"
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
