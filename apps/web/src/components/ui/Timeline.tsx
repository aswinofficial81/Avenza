import React from 'react';
import { cn } from '../../lib/utils';

export interface TimelineItemProps {
  title: string;
  time?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  isLast?: boolean;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({
  title,
  time,
  description,
  icon,
  isLast = false,
}) => {
  return (
    <div className="relative flex gap-3 text-xs">
      {!isLast && (
        <span
          className="absolute left-3 top-6 -bottom-2 w-px bg-border-subtle"
          aria-hidden="true"
        />
      )}
      <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-muted-foreground">
        {icon || <div className="h-2 w-2 rounded-full bg-primary" />}
      </div>
      <div className="flex-1 pb-4 pt-0.5 space-y-1">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-foreground">{title}</p>
          {time && <span className="font-mono text-[11px] text-muted-foreground">{time}</span>}
        </div>
        {description && <div className="text-muted-foreground leading-relaxed">{description}</div>}
      </div>
    </div>
  );
};

export interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Timeline: React.FC<TimelineProps> = ({ className, children, ...props }) => {
  return (
    <div className={cn('space-y-1', className)} {...props}>
      {children}
    </div>
  );
};
