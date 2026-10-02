import React from 'react';
import type { TodayTaskItem } from '@avenza/shared';
import { TodayTaskRow } from './TodayTaskRow';

export interface TodaySectionProps {
  title: string;
  icon?: React.ReactNode;
  count: number;
  tasks: TodayTaskItem[];
  variant?: 'default' | 'danger' | 'warning' | 'muted';
  onComplete: (taskId: string) => void;
  onDefer?: (taskId: string) => void;
  onSkip?: (taskId: string) => void;
  emptyMessage?: string;
}

export const TodaySection: React.FC<TodaySectionProps> = ({
  title,
  icon,
  count,
  tasks,
  variant = 'default',
  onComplete,
  onDefer,
  onSkip,
  emptyMessage,
}) => {
  if (tasks.length === 0 && !emptyMessage) {
    return null;
  }

  const badgeVariantStyles = {
    default: 'bg-primary/10 text-primary border-primary/20',
    danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    muted: 'bg-muted text-muted-foreground border-border',
  }[variant];

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badgeVariantStyles}`}
        >
          {count}
        </span>
      </div>

      {/* Task List */}
      {tasks.length > 0 ? (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TodayTaskRow
              key={task.id}
              task={task}
              onComplete={onComplete}
              onDefer={onDefer}
              onSkip={onSkip}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic px-1">{emptyMessage}</p>
      )}
    </div>
  );
};
