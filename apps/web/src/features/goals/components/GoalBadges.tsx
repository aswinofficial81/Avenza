import React from 'react';
import { Badge, type BadgeVariant } from '../../../components/ui/Badge';
import type {
  GoalType,
  GoalStatus,
  GoalPriority,
  GoalHealthStatus,
  MilestoneStatus,
} from '@avenza/shared';

export const GoalTypeBadge: React.FC<{ type: GoalType; className?: string }> = ({ type, className }) => {
  const map: Record<GoalType, { label: string; variant: BadgeVariant }> = {
    academic: { label: 'Academic', variant: 'info' },
    learning: { label: 'Learning', variant: 'default' },
    career: { label: 'Career', variant: 'warning' },
    project: { label: 'Project', variant: 'success' },
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

export const GoalStatusBadge: React.FC<{ status: GoalStatus; className?: string }> = ({
  status,
  className,
}) => {
  const map: Record<GoalStatus, { label: string; variant: BadgeVariant }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    active: { label: 'Active', variant: 'info' },
    paused: { label: 'Paused', variant: 'warning' },
    completed: { label: 'Completed', variant: 'success' },
    archived: { label: 'Archived', variant: 'secondary' },
  };

  const item = map[status] || { label: status, variant: 'default' };
  return (
    <Badge variant={item.variant} className={className}>
      {item.label}
    </Badge>
  );
};

export const GoalPriorityBadge: React.FC<{ priority: GoalPriority; className?: string }> = ({
  priority,
  className,
}) => {
  const map: Record<GoalPriority, { label: string; variant: BadgeVariant }> = {
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

export const GoalHealthBadge: React.FC<{ health: GoalHealthStatus; className?: string }> = ({
  health,
  className,
}) => {
  const map: Record<GoalHealthStatus, { label: string; variant: BadgeVariant }> = {
    on_track: { label: 'On Track', variant: 'success' },
    at_risk: { label: 'At Risk', variant: 'danger' },
    unknown: { label: 'Unknown', variant: 'secondary' },
  };

  const item = map[health] || { label: health, variant: 'secondary' };
  return (
    <Badge variant={item.variant} className={className}>
      {item.label}
    </Badge>
  );
};

export const MilestoneStatusBadge: React.FC<{ status: MilestoneStatus; className?: string }> = ({
  status,
  className,
}) => {
  const map: Record<MilestoneStatus, { label: string; variant: BadgeVariant }> = {
    pending: { label: 'Pending', variant: 'secondary' },
    active: { label: 'In Progress', variant: 'info' },
    completed: { label: 'Completed', variant: 'success' },
    skipped: { label: 'Skipped', variant: 'warning' },
  };

  const item = map[status] || { label: status, variant: 'default' };
  return (
    <Badge variant={item.variant} className={className}>
      {item.label}
    </Badge>
  );
};
