import React from 'react';
import { Badge, type BadgeVariant } from '../../../components/ui/Badge';
import { Lock } from 'lucide-react';
import type { TaskPriority, TaskStatus, TaskType } from '@avenza/shared';

export const TaskStatusBadge: React.FC<{ status: TaskStatus; className?: string }> = ({
  status,
  className,
}) => {
  const map: Record<TaskStatus, { label: string; variant: BadgeVariant }> = {
    inbox: { label: 'Inbox', variant: 'secondary' },
    planned: { label: 'Planned', variant: 'default' },
    scheduled: { label: 'Scheduled', variant: 'info' },
    in_progress: { label: 'In Progress', variant: 'warning' },
    completed: { label: 'Completed', variant: 'success' },
    skipped: { label: 'Skipped', variant: 'secondary' },
    deferred: { label: 'Deferred', variant: 'warning' },
    cancelled: { label: 'Cancelled', variant: 'danger' },
  };

  const item = map[status] || { label: status, variant: 'default' };
  return (
    <Badge variant={item.variant} className={className}>
      {item.label}
    </Badge>
  );
};

export const TaskPriorityBadge: React.FC<{ priority: TaskPriority; className?: string }> = ({
  priority,
  className,
}) => {
  const map: Record<TaskPriority, { label: string; variant: BadgeVariant }> = {
    low: { label: 'Low', variant: 'secondary' },
    medium: { label: 'Medium', variant: 'default' },
    high: { label: 'High', variant: 'warning' },
    critical: { label: 'Critical', variant: 'danger' },
  };

  const item = map[priority] || { label: priority, variant: 'default' };
  return (
    <Badge variant={item.variant} className={className}>
      {item.label}
    </Badge>
  );
};

export const TaskTypeBadge: React.FC<{ type: TaskType; className?: string }> = ({
  type,
  className,
}) => {
  const map: Record<TaskType, { label: string; variant: BadgeVariant }> = {
    study: { label: 'Study', variant: 'info' },
    practice: { label: 'Practice', variant: 'default' },
    revision: { label: 'Revision', variant: 'secondary' },
    assignment: { label: 'Assignment', variant: 'warning' },
    exam_preparation: { label: 'Exam Prep', variant: 'danger' },
    dsa: { label: 'DSA', variant: 'default' },
    project: { label: 'Project', variant: 'success' },
    career: { label: 'Career', variant: 'warning' },
    administrative: { label: 'Admin', variant: 'secondary' },
    personal: { label: 'Personal', variant: 'secondary' },
    custom: { label: 'Custom', variant: 'default' },
  };

  const item = map[type] || { label: type, variant: 'default' };
  return (
    <Badge variant={item.variant} className={className}>
      {item.label}
    </Badge>
  );
};

export const TaskBlockedBadge: React.FC<{
  blockingCount?: number;
  className?: string;
  onClick?: () => void;
}> = ({ blockingCount, className = '', onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20 dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-400/20 ${
        onClick ? 'cursor-pointer hover:bg-amber-500/20 transition-colors' : 'cursor-default'
      } ${className}`}
      title={
        blockingCount && blockingCount > 0
          ? `Blocked — waiting for ${blockingCount} prerequisite task${blockingCount > 1 ? 's' : ''}`
          : 'Blocked by prerequisite tasks'
      }
    >
      <Lock className="w-3 h-3 flex-shrink-0" />
      <span>Blocked{blockingCount && blockingCount > 0 ? ` (${blockingCount})` : ''}</span>
    </button>
  );
};
